import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ── GET /api/admin/metrics ───────────────────────────────────────────────────
// Returns SaaS metrics: MRR, churn, LTV, trial conversion, revenue history.
// Admin-only endpoint.
export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const svc = getServiceClient()

  // Verify admin
  const { data: profile } = await svc.from('venue_profiles').select('role').eq('user_id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch all data needed
  const [{ data: subs }, { data: payments }, { data: plans }] = await Promise.all([
    svc.from('venue_subscriptions').select('*'),
    svc.from('venue_payment_history').select('*').order('created_at', { ascending: true }),
    svc.from('venue_plans').select('id, name, display_name, billing_cycles'),
  ])

  const allSubs = subs || []
  const allPayments = payments || []
  const allPlans = plans || []

  // ── MRR (Monthly Recurring Revenue) ──────────────────────────────────────
  const activeSubs = allSubs.filter(s => s.status === 'active')
  let mrr = 0
  for (const sub of activeSubs) {
    const plan = allPlans.find(p => p.id === sub.plan_id)
    if (!plan) continue
    const cycle = (plan.billing_cycles as any[])?.find((c: any) => c.id === sub.billing_cycle)
    if (cycle?.price) {
      const months = cycle.interval_months || 12
      mrr += cycle.price / months
    }
  }

  // ── ARR ──────────────────────────────────────────────────────────────────
  const arr = mrr * 12

  // ── Churn (last 30 days) ─────────────────────────────────────────────────
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const cancelledRecently = allSubs.filter(s =>
    s.status === 'cancelled' && s.cancel_requested_at &&
    new Date(s.cancel_requested_at) >= thirtyDaysAgo
  ).length
  const totalActiveStart = activeSubs.length + cancelledRecently // approx start-of-period
  const churnRate = totalActiveStart > 0 ? (cancelledRecently / totalActiveStart) * 100 : 0

  // ── Trial conversion ─────────────────────────────────────────────────────
  const trialSubs = allSubs.filter(s => s.status === 'trial')
  const trialExpired = allSubs.filter(s => s.status === 'trial_expired')
  const convertedFromTrial = allSubs.filter(s =>
    s.status === 'active' && allPayments.some(p =>
      p.subscription_id === s.id && p.event_type === 'activated'
    )
  )
  const totalTrialEver = trialSubs.length + trialExpired.length + convertedFromTrial.length
  const trialConversion = totalTrialEver > 0 ? (convertedFromTrial.length / totalTrialEver) * 100 : 0

  // ── LTV (simple: ARPU / churn) ───────────────────────────────────────────
  const arpu = activeSubs.length > 0 ? mrr / activeSubs.length : 0
  const monthlyChurn = churnRate / 100
  const ltv = monthlyChurn > 0 ? arpu / monthlyChurn : arpu * 24 // default 24 months if no churn

  // ── Revenue by month (last 12 months) ────────────────────────────────────
  const revenueByMonth: { month: string; revenue: number; count: number }[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
    const monthPayments = allPayments.filter(p => {
      if (p.event_type !== 'payment' || !p.amount) return false
      const pd = new Date(p.created_at)
      return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth()
    })
    revenueByMonth.push({
      month: label,
      revenue: monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
      count: monthPayments.length,
    })
  }

  // ── Subscription breakdown ───────────────────────────────────────────────
  const statusBreakdown: Record<string, number> = {}
  for (const s of allSubs) {
    statusBreakdown[s.status] = (statusBreakdown[s.status] || 0) + 1
  }

  // ── Plan breakdown (enhanced with per-plan metrics) ──────────────────────
  const planBreakdown: { plan: string; planId: string; count: number; revenue: number; trialCount: number; churnCount: number; conversionRate: number }[] = []
  for (const plan of allPlans) {
    const planSubs = activeSubs.filter(s => s.plan_id === plan.id)
    const planTrials = trialSubs.filter(s => s.plan_id === plan.id)
    const planCancelled = allSubs.filter(s => s.plan_id === plan.id && s.status === 'cancelled')
    const planConverted = allSubs.filter(s => s.plan_id === plan.id && s.status === 'active')
    const planTrialTotal = planTrials.length + planConverted.length + planCancelled.filter(s => (s as any).trial_end_date).length
    let revenue = 0
    for (const sub of planSubs) {
      const cycle = (plan.billing_cycles as any[])?.find((c: any) => c.id === sub.billing_cycle)
      if (cycle?.price) revenue += cycle.price / (cycle.interval_months || 12)
    }
    if (planSubs.length > 0 || planTrials.length > 0) {
      planBreakdown.push({
        plan: plan.display_name || plan.name,
        planId: plan.id,
        count: planSubs.length,
        revenue,
        trialCount: planTrials.length,
        churnCount: planCancelled.length,
        conversionRate: planTrialTotal > 0 ? Math.round((planConverted.length / planTrialTotal) * 100) : 0,
      })
    }
  }

  return NextResponse.json({
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(arr * 100) / 100,
    churnRate: Math.round(churnRate * 10) / 10,
    churnCount: cancelledRecently,
    trialConversion: Math.round(trialConversion * 10) / 10,
    trialsActive: trialSubs.length,
    trialsExpired: trialExpired.length,
    trialsConverted: convertedFromTrial.length,
    ltv: Math.round(ltv * 100) / 100,
    arpu: Math.round(arpu * 100) / 100,
    activeSubs: activeSubs.length,
    totalSubs: allSubs.length,
    statusBreakdown,
    planBreakdown,
    revenueByMonth,
  })
}

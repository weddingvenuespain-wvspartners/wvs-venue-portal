import { NextRequest, NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// POST /api/redsys/activate-from-success
// Fallback activation: creates subscription if the webhook hasn't fired yet.
// Only works if user has NO active subscription (prevents double-activation).
// Body: { planId, cycleId }

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userId = session.user.id
    const { planId, cycleId } = await req.json()

    if (!planId || !cycleId) {
      return NextResponse.json({ error: 'planId y cycleId requeridos' }, { status: 400 })
    }

    const svc = getServiceClient()

    // Check if user already has an active subscription (webhook already fired)
    const { data: existing } = await svc
      .from('venue_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['active', 'trial'])
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ status: 'already_active' })
    }

    // Fetch plan to get billing cycle details
    const { data: plan } = await svc
      .from('venue_plans')
      .select('id, billing_cycles')
      .eq('id', planId)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
    }

    const cycles = (plan.billing_cycles || []) as any[]
    const cycle = cycles.find((c: any) => c.id === cycleId)
    const intervalMonths = cycle?.interval_months || 1

    const periodEnd = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + intervalMonths)

    // Create subscription
    const { error: subError } = await svc.from('venue_subscriptions').insert({
      user_id: userId,
      plan_id: planId,
      status: 'active',
      billing_cycle: cycleId,
      start_date: new Date().toISOString().slice(0, 10),
      renewal_date: periodEnd.toISOString().slice(0, 10),
    })

    if (subError) {
      console.error('[activate-from-success]', subError)
      return NextResponse.json({ error: 'Error activando suscripción' }, { status: 500 })
    }

    // Log in history
    await svc.from('venue_payment_history').insert({
      user_id: userId,
      event_type: 'activated',
      plan_id: planId,
      billing_cycle: cycleId,
      notes: 'Suscripción activada desde página de éxito (fallback)',
    })

    return NextResponse.json({ status: 'activated' })
  } catch (err: any) {
    console.error('[activate-from-success]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

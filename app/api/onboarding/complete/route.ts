import { NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// POST /api/onboarding/complete
// Called after onboarding step 2 — creates a 14-day trial subscription on the basic plan.
export async function POST() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const userId = session.user.id
    const svc = getServiceClient()

    // Check if user already has a subscription (avoid duplicates)
    const { data: existing } = await svc
      .from('venue_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ ok: true, message: 'Ya tiene suscripción' })
    }

    // Find basic plan (first active plan sorted by creation date)
    const { data: basicPlan } = await svc
      .from('venue_plans')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!basicPlan) {
      return NextResponse.json({ error: 'No se encontró el plan básico' }, { status: 500 })
    }

    // Create trial subscription
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14)

    const { error } = await svc
      .from('venue_subscriptions')
      .insert({
        user_id: userId,
        plan_id: basicPlan.id,
        status: 'trial',
        trial_end_date: trialEnd.toISOString(),
      })

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[/api/onboarding/complete]', err)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// POST /api/onboarding/complete
// Called after onboarding step 2 — creates a trial subscription using global trial config.
export async function POST() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const userId = session.user.id
    const svc = getServiceClient()

    // Check if user already has ANY subscription across all their venues.
    // Only the very first venue ever gets an automatic trial.
    const { data: existing } = await svc
      .from('venue_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ ok: true, message: 'Ya tiene suscripción' })
    }

    // Read trial configuration
    const { data: trialConfig } = await svc
      .from('trial_config')
      .select('is_active, trial_days, trial_plan_id')
      .eq('id', 1)
      .maybeSingle()

    if (!trialConfig?.is_active) {
      return NextResponse.json({ ok: true, message: 'Trial desactivado' })
    }

    // Resolve plan: use trial config's plan, or fall back to first active plan
    let planId = trialConfig.trial_plan_id
    if (!planId) {
      const { data: basicPlan } = await svc
        .from('venue_plans')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (!basicPlan) {
        return NextResponse.json({ error: 'No se encontró ningún plan activo' }, { status: 500 })
      }
      planId = basicPlan.id
    }

    // Best-effort: find the user's primary venue to link the trial
    const { data: primaryVenue } = await svc
      .from('user_venues')
      .select('id')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .maybeSingle()

    // Create trial subscription with configured duration
    const trialDays = trialConfig.trial_days ?? 14
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + trialDays)

    const { error } = await svc
      .from('venue_subscriptions')
      .insert({
        user_id: userId,
        venue_id: primaryVenue?.id ?? null,
        plan_id: planId,
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

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

    // Check if user already has ANY subscription across all their venues.
    // This acts as the guard that prevents a second (or third) venue from
    // getting an automatic trial — only the very first venue ever gets one.
    // Admins can still manually grant a trial via the CRM for any venue.
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

    // Best-effort: find the user's primary venue to link the trial to a venue_id.
    // At onboarding time the user_venues row may not exist yet — if so, venue_id
    // stays null and will be backfilled when the admin later assigns the venue
    // via assign-venue or apply-changes.
    const { data: primaryVenue } = await svc
      .from('user_venues')
      .select('id')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .maybeSingle()

    // Create trial subscription
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14)

    const { error } = await svc
      .from('venue_subscriptions')
      .insert({
        user_id: userId,
        venue_id: primaryVenue?.id ?? null,
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

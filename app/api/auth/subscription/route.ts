import { NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// GET /api/auth/subscription
// Returns the active/trial subscription for the authenticated user.
// Uses service role to bypass RLS on venue_subscriptions.
// Auto-transitions expired trials to `trial_expired` status in the DB.

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const venueId = searchParams.get('venue_id')

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ subscription: null })
    }

    const svc = getServiceClient()
    const SELECT = 'id, status, trial_end_date, plan_id, plan:venue_plans(id, name, display_name, permissions)'

    // Priority 1: active subscription (paid)
    let activeQuery = svc
      .from('venue_subscriptions')
      .select(SELECT)
      .eq('user_id', session.user.id)
      .eq('status', 'active')
    if (venueId) activeQuery = activeQuery.eq('venue_id', venueId)
    const { data: activeSub, error: e1 } = await activeQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (e1) {
      console.error('[/api/auth/subscription] active query:', e1.message)
      return NextResponse.json({ subscription: null })
    }

    if (activeSub) {
      return NextResponse.json({ subscription: activeSub })
    }

    // Priority 2: trial or trial_expired subscription
    let trialQuery = svc
      .from('venue_subscriptions')
      .select(SELECT)
      .eq('user_id', session.user.id)
      .in('status', ['trial', 'trial_expired'])
    if (venueId) trialQuery = trialQuery.eq('venue_id', venueId)
    const { data: trialSub, error: e2 } = await trialQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (e2) {
      console.error('[/api/auth/subscription] trial query:', e2.message)
      return NextResponse.json({ subscription: null })
    }

    if (!trialSub) {
      return NextResponse.json({ subscription: null })
    }

    // Auto-transition: if trial end date has passed, mark as trial_expired in DB
    if (trialSub.status === 'trial' && trialSub.trial_end_date && new Date(trialSub.trial_end_date) <= new Date()) {
      await svc
        .from('venue_subscriptions')
        .update({ status: 'trial_expired' })
        .eq('id', trialSub.id)
      return NextResponse.json({ subscription: { ...trialSub, status: 'trial_expired' } })
    }

    return NextResponse.json({ subscription: trialSub })
  } catch (err: any) {
    console.error('[/api/auth/subscription]', err)
    return NextResponse.json({ subscription: null })
  }
}

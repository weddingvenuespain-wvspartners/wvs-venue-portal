import { NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// GET /api/auth/subscription
// Returns the active/trial subscription for the authenticated user.
// Uses service role to bypass RLS on venue_subscriptions.

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ subscription: null })
    }

    const svc = getServiceClient()
    const SELECT = 'id, status, trial_end_date, plan_id, plan:venue_plans(id, name, display_name, permissions)'

    // Priority 1: active subscription (paid)
    const { data: activeSub, error: e1 } = await svc
      .from('venue_subscriptions')
      .select(SELECT)
      .eq('user_id', session.user.id)
      .eq('status', 'active')
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

    // Priority 2: trial subscription
    const { data: trialSub, error: e2 } = await svc
      .from('venue_subscriptions')
      .select(SELECT)
      .eq('user_id', session.user.id)
      .eq('status', 'trial')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (e2) {
      console.error('[/api/auth/subscription] trial query:', e2.message)
      return NextResponse.json({ subscription: null })
    }

    return NextResponse.json({ subscription: trialSub ?? null })
  } catch (err: any) {
    console.error('[/api/auth/subscription]', err)
    return NextResponse.json({ subscription: null })
  }
}

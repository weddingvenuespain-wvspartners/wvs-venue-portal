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
    const { data, error } = await svc
      .from('venue_subscriptions')
      .select('id, status, trial_end_date, plan:venue_plans(id, name, display_name, permissions)')
      .eq('user_id', session.user.id)
      .in('status', ['active', 'trial'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[/api/auth/subscription]', error.message)
      return NextResponse.json({ subscription: null })
    }

    return NextResponse.json({ subscription: data })
  } catch (err: any) {
    console.error('[/api/auth/subscription]', err)
    return NextResponse.json({ subscription: null })
  }
}

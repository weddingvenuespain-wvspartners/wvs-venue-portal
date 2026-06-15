import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// ── GET /api/subscription/status ─────────────────────────────────────────────
// Returns whether the authenticated user has an active subscription.
// Used by checkout success page to poll for webhook activation.
export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ hasActiveSubscription: false })

    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { count } = await svc
      .from('venue_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['active', 'trial'])

    return NextResponse.json({ hasActiveSubscription: (count ?? 0) > 0 })
  } catch {
    return NextResponse.json({ hasActiveSubscription: false })
  }
}

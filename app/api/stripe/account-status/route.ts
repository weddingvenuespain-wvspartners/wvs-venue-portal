// GET /api/stripe/account-status
// Returns venue's Stripe Connect status for the settings UI.

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getSession() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return { user, supabase }
}

export async function GET() {
  try {
    const { user, supabase } = await getSession()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data } = await supabase
      .from('venue_stripe_accounts')
      .select('stripe_account_id, onboarding_complete, charges_enabled, payouts_enabled, created_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!data) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      onboarding_complete: data.onboarding_complete,
      charges_enabled: data.charges_enabled,
      payouts_enabled: data.payouts_enabled,
      created_at: data.created_at,
    })
  } catch (err: any) {
    console.error('[/api/stripe/account-status]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST /api/stripe/dashboard-link
// Returns a login link to the Stripe Express dashboard for the venue.

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getStripe } from '@/lib/stripe'

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

export async function POST() {
  try {
    const { user, supabase } = await getSession()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data } = await supabase
      .from('venue_stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!data?.stripe_account_id) {
      return NextResponse.json({ error: 'No tienes cuenta Stripe conectada' }, { status: 404 })
    }

    const stripe = getStripe()
    const loginLink = await stripe.accounts.createLoginLink(data.stripe_account_id)

    return NextResponse.json({ url: loginLink.url })
  } catch (err: any) {
    console.error('[/api/stripe/dashboard-link]', err)
    return NextResponse.json({ error: 'Error al generar enlace' }, { status: 500 })
  }
}

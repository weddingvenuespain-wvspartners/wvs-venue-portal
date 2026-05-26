// POST /api/stripe/create-account
// Creates a Stripe Express connected account for the venue and returns
// an Account Link URL for the Stripe-hosted onboarding flow.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function getSession() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const svc = getServiceClient()
    const stripe = getStripe()
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || ''

    // Check if user already has a connected account
    const { data: existing } = await svc
      .from('venue_stripe_accounts')
      .select('stripe_account_id, onboarding_complete')
      .eq('user_id', user.id)
      .maybeSingle()

    let accountId: string

    if (existing?.stripe_account_id) {
      accountId = existing.stripe_account_id
    } else {
      // Create new Express connected account
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'ES',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { user_id: user.id },
      })
      accountId = account.id

      await svc.from('venue_stripe_accounts').insert({
        user_id: user.id,
        stripe_account_id: accountId,
        onboarding_complete: false,
        charges_enabled: false,
        payouts_enabled: false,
      })
    }

    // Create Account Link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/perfil?tab=facturacion&stripe=refresh`,
      return_url: `${origin}/perfil?tab=facturacion&stripe=success`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err: any) {
    console.error('[/api/stripe/create-account]', err)
    return NextResponse.json({ error: 'Error al crear cuenta Stripe' }, { status: 500 })
  }
}

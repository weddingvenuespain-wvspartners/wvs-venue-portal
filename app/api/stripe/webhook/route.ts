// POST /api/stripe/webhook
// Handles Stripe webhook events:
// - checkout.session.completed → mark budget installment as paid
// - account.updated → update venue Stripe account status

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { handleCheckoutCompleted } from '@/lib/stripe-payment-handler'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    console.error('[stripe/webhook] Missing stripe-signature header')
    return new NextResponse('Missing signature', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err: any) {
    console.error('[stripe/webhook] Signature verification failed:', err.message)
    return new NextResponse('Invalid signature', { status: 400 })
  }

  const svc = getServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        console.log(`[stripe/webhook] checkout.session.completed — session=${session.id}`)
        await handleCheckoutCompleted(session)
        break
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        console.log(`[stripe/webhook] account.updated — ${account.id} charges=${account.charges_enabled} payouts=${account.payouts_enabled}`)

        await svc.from('venue_stripe_accounts')
          .update({
            onboarding_complete: account.details_submitted ?? false,
            charges_enabled: account.charges_enabled ?? false,
            payouts_enabled: account.payouts_enabled ?? false,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_account_id', account.id)

        break
      }

      default:
        break
    }
  } catch (err: any) {
    console.error(`[stripe/webhook] Error processing ${event.type}:`, err)
  }

  return new NextResponse('OK', { status: 200 })
}

// POST /api/stripe/webhook
// Handles Stripe webhook events:
// - checkout.session.completed → mark budget installment as paid OR activate subscription
// - account.updated → update venue Stripe account status
// - invoice.paid / invoice.payment_failed → subscription billing lifecycle
// - customer.subscription.updated / deleted → sync subscription status

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { handleCheckoutCompleted } from '@/lib/stripe-payment-handler'
import { sendPaymentFailedEmail, sendSubscriptionConfirmedEmail, sendCancellationConfirmEmail } from '@/lib/mailer'

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
      // ── Connect: Budget payments ──────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        console.log(`[stripe/webhook] checkout.session.completed — session=${session.id} type=${session.metadata?.type}`)

        if (session.metadata?.type === 'venue_subscription') {
          // ── Billing: Subscription activated via Checkout ──
          const { user_id, plan_id, cycle_id, venue_id } = session.metadata
          const stripeSubId = (session as any).subscription as string
          const stripeCustomerId = session.customer as string

          // Cancel any existing active/trial subs for this user+venue
          const cancelQuery = svc
            .from('venue_subscriptions')
            .update({ status: 'cancelled', cancel_requested_at: new Date().toISOString() })
            .eq('user_id', user_id)
            .in('status', ['active', 'trial'])
          if (venue_id) cancelQuery.eq('venue_id', venue_id)
          await cancelQuery

          // Determine status based on trial
          let status = 'active'
          let trialEndDate: string | null = null
          if (stripeSubId) {
            const stripeSub = await getStripe().subscriptions.retrieve(stripeSubId)
            if (stripeSub.status === 'trialing' && stripeSub.trial_end) {
              status = 'trial'
              trialEndDate = new Date(stripeSub.trial_end * 1000).toISOString().slice(0, 10)
            }
          }

          // Calculate renewal date
          const cycles = await svc.from('venue_plans').select('billing_cycles').eq('id', plan_id).single()
          const cycle = ((cycles.data?.billing_cycles as any[]) || []).find((c: any) => c.id === cycle_id)
          const intervalMonths = cycle?.interval_months || 12
          const startDate = new Date().toISOString().slice(0, 10)
          const renewalD = new Date()
          renewalD.setMonth(renewalD.getMonth() + intervalMonths)
          const renewalDate = renewalD.toISOString().slice(0, 10)

          await svc.from('venue_subscriptions').insert({
            user_id,
            venue_id: venue_id || null,
            plan_id,
            billing_cycle: cycle_id,
            status,
            start_date: startDate,
            renewal_date: status === 'trial' ? trialEndDate : renewalDate,
            trial_end_date: trialEndDate,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubId,
          })

          await svc.from('venue_payment_history').insert({
            user_id,
            event_type: status === 'trial' ? 'trial_started' : 'activated',
            plan_id,
            billing_cycle: cycle_id,
            notes: `Suscripción ${status === 'trial' ? 'trial iniciada' : 'activada'} via Stripe Checkout`,
          })

          console.log(`[stripe/webhook] Subscription created for user=${user_id} status=${status}`)

          // Send confirmation email (best-effort)
          try {
            const { data: profile } = await svc.from('venue_profiles').select('email, display_name, company').eq('user_id', user_id).single()
            const { data: planData } = await svc.from('venue_plans').select('display_name, name').eq('id', plan_id).single()
            if (profile?.email && planData && status === 'active') {
              await sendSubscriptionConfirmedEmail({
                to: profile.email,
                venueName: profile.company || profile.display_name || '',
                planName: planData.display_name || planData.name,
                amount: cycle?.price || 0,
                intervalLabel: cycle?.label?.toLowerCase() || 'año',
              })
            }
          } catch (emailErr) { console.error('[stripe/webhook] Confirmation email failed:', emailErr) }
        } else {
          // Budget installment payment (Connect)
          await handleCheckoutCompleted(session)
        }
        break
      }

      // ── Billing: Invoice paid (recurring charge success) ──────────────
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const invoiceSub = (invoice as any).subscription
        if (!invoiceSub) break // skip one-off invoices
        const subId = typeof invoiceSub === 'string' ? invoiceSub : invoiceSub.id

        console.log(`[stripe/webhook] invoice.paid — sub=${subId} amount=${invoice.amount_paid}`)

        const { data: sub } = await svc
          .from('venue_subscriptions')
          .select('id, user_id, plan_id, billing_cycle')
          .eq('stripe_subscription_id', subId)
          .maybeSingle()

        if (sub) {
          // Update renewal_date
          if (invoice.lines?.data?.[0]?.period?.end) {
            const newRenewal = new Date(invoice.lines.data[0].period.end * 1000).toISOString().slice(0, 10)
            await svc.from('venue_subscriptions').update({ renewal_date: newRenewal, status: 'active' }).eq('id', sub.id)
          }

          // Log payment (skip $0 trial invoices)
          if (invoice.amount_paid > 0) {
            await svc.from('venue_payment_history').insert({
              user_id: sub.user_id,
              subscription_id: sub.id,
              event_type: 'payment',
              amount: invoice.amount_paid / 100,
              reference: invoice.id,
              plan_id: sub.plan_id,
              billing_cycle: sub.billing_cycle,
              notes: `Pago recurrente Stripe — ${invoice.number || invoice.id}`,
            })
          }
        }
        break
      }

      // ── Billing: Invoice payment failed ───────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const failedSub = (invoice as any).subscription
        if (!failedSub) break
        const subId = typeof failedSub === 'string' ? failedSub : failedSub.id

        console.log(`[stripe/webhook] invoice.payment_failed — sub=${subId}`)

        const { data: sub } = await svc
          .from('venue_subscriptions')
          .select('id, user_id, plan_id')
          .eq('stripe_subscription_id', subId)
          .maybeSingle()

        if (sub) {
          // Check attempt count from Stripe invoice
          const attemptCount = (invoice as any).attempt_count || 1

          await svc.from('venue_payment_history').insert({
            user_id: sub.user_id,
            subscription_id: sub.id,
            event_type: 'payment_failed',
            amount: (invoice.amount_due || 0) / 100,
            reference: invoice.id,
            notes: `Pago fallido (intento ${attemptCount}): ${invoice.last_finalization_error?.message || 'tarjeta rechazada'}`,
          })

          // Get plan's grace period
          const { data: plan } = await svc.from('venue_plans').select('grace_period_days').eq('id', sub.plan_id).maybeSingle()
          const graceDays = plan?.grace_period_days ?? 3

          // On first failure, set grace deadline; on subsequent, check if grace expired
          if (attemptCount === 1) {
            // Mark subscription as past_due with grace deadline
            await svc.from('venue_subscriptions').update({
              status: 'past_due',
              updated_at: new Date().toISOString(),
            }).eq('id', sub.id)
            console.log(`[stripe/webhook] Subscription ${sub.id} → past_due (grace: ${graceDays}d)`)
          }

          // Send dunning email
          const { data: profile } = await svc.from('venue_profiles').select('email').eq('user_id', sub.user_id).single()
          const { data: venue } = await svc.from('venue_onboarding').select('name').eq('user_id', sub.user_id).maybeSingle()
          if (profile?.email) {
            try {
              await sendPaymentFailedEmail({
                to: profile.email,
                venueName: venue?.name || 'Tu espacio',
                amount: (invoice.amount_due || 0) / 100,
                errorMessage: invoice.last_finalization_error?.message || undefined,
              })
            } catch (emailErr) {
              console.error('[stripe/webhook] Dunning email failed:', emailErr)
            }
          }
        }
        break
      }

      // ── Billing: Subscription updated (status changes, trial end) ─────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        console.log(`[stripe/webhook] subscription.updated — ${sub.id} status=${sub.status}`)

        const statusMap: Record<string, string> = {
          active: 'active', trialing: 'trial', past_due: 'active',
          canceled: 'cancelled', unpaid: 'paused', incomplete_expired: 'trial_expired',
        }
        const newStatus = statusMap[sub.status]
        if (!newStatus) break

        const update: any = { status: newStatus }
        const periodEnd = (sub as any).current_period_end
        if (periodEnd) {
          update.renewal_date = new Date(periodEnd * 1000).toISOString().slice(0, 10)
        }
        if (sub.trial_end) {
          update.trial_end_date = new Date(sub.trial_end * 1000).toISOString().slice(0, 10)
        }

        await svc.from('venue_subscriptions').update(update).eq('stripe_subscription_id', sub.id)
        break
      }

      // ── Billing: Subscription deleted (fully cancelled) ───────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        console.log(`[stripe/webhook] subscription.deleted — ${sub.id}`)

        await svc.from('venue_subscriptions')
          .update({ status: 'cancelled' })
          .eq('stripe_subscription_id', sub.id)

        // Log
        const { data: dbSub } = await svc
          .from('venue_subscriptions')
          .select('user_id, id')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle()

        if (dbSub) {
          await svc.from('venue_payment_history').insert({
            user_id: dbSub.user_id,
            subscription_id: dbSub.id,
            event_type: 'cancelled',
            notes: 'Suscripción finalizada en Stripe',
          })

          // Send cancellation email (best-effort)
          try {
            const { data: profile } = await svc.from('venue_profiles').select('email, display_name, company').eq('user_id', dbSub.user_id).single()
            if (profile?.email) {
              const periodEnd = (sub as any).current_period_end
              const effectiveDate = periodEnd
                ? new Date(periodEnd * 1000).toISOString().slice(0, 10)
                : new Date().toISOString().slice(0, 10)
              await sendCancellationConfirmEmail({
                to: profile.email,
                venueName: profile.company || profile.display_name || 'Tu espacio',
                effectiveDate,
              })
            }
          } catch (emailErr) { console.error('[stripe/webhook] Cancellation email failed:', emailErr) }
        }
        break
      }

      // ── Connect: Account updated ──────────────────────────────────────
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

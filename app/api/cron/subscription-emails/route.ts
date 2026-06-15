import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  sendTrialExpiringEmail,
  sendPaymentFailedEmail,
  sendRenewalReminderEmail,
} from '@/lib/mailer'

// ── GET /api/cron/subscription-emails ────────────────────────────────────────
// Called by Vercel Cron (or external scheduler) once daily.
// Checks for:
//   1. Trials expiring in 3 days or 1 day → send reminder
//   2. Active subscriptions renewing in 7 days → renewal reminder
//   3. Subscriptions with failed payment status → dunning email
//
// Auth: Bearer token from CRON_SECRET env var to prevent unauthorized calls.
// ─────────────────────────────────────────────────────────────────────────────

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  // Verify cron auth
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = getServiceClient()
  const now = new Date()
  const results = { trialReminders: 0, renewalReminders: 0, dunningEmails: 0, errors: [] as string[] }

  try {
    // ── 1. Trial expiring reminders (3 days and 1 day before) ──────────────
    const in3days = new Date(now)
    in3days.setDate(in3days.getDate() + 3)
    const in1day = new Date(now)
    in1day.setDate(in1day.getDate() + 1)

    const { data: trialsExpiring } = await svc
      .from('venue_subscriptions')
      .select('*, venue_profiles!inner(email, display_name), venue_onboarding!inner(name)')
      .eq('status', 'trial')
      .not('renewal_date', 'is', null)

    if (trialsExpiring) {
      for (const sub of trialsExpiring) {
        const renewalDate = new Date(sub.renewal_date)
        const daysLeft = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        // Only send at 3 days and 1 day
        if (daysLeft !== 3 && daysLeft !== 1) continue

        const email = sub.venue_profiles?.email
        const venueName = sub.venue_onboarding?.name || 'Tu espacio'
        if (!email) continue

        // Check if already sent today (avoid duplicates)
        const todayStr = now.toISOString().slice(0, 10)
        const { count } = await svc
          .from('venue_payment_history')
          .select('id', { count: 'exact', head: true })
          .eq('subscription_id', sub.id)
          .eq('event_type', 'trial_reminder_sent')
          .gte('created_at', todayStr)

        if (count && count > 0) continue

        try {
          await sendTrialExpiringEmail({
            to: email,
            venueName,
            daysLeft,
            trialEndDate: sub.renewal_date,
          })

          await svc.from('venue_payment_history').insert({
            user_id: sub.user_id,
            subscription_id: sub.id,
            event_type: 'trial_reminder_sent',
            notes: `Recordatorio trial: ${daysLeft} día(s) restante(s)`,
          })

          results.trialReminders++
        } catch (err: any) {
          results.errors.push(`Trial reminder ${sub.id}: ${err.message}`)
        }
      }
    }

    // ── 2. Renewal reminders (7 days before renewal) ────────────────────────
    const in7days = new Date(now)
    in7days.setDate(in7days.getDate() + 7)
    const in7daysStr = in7days.toISOString().slice(0, 10)

    const { data: renewingSoon } = await svc
      .from('venue_subscriptions')
      .select('*, venue_profiles!inner(email, display_name), venue_onboarding!inner(name), venue_plans(display_name)')
      .eq('status', 'active')
      .eq('renewal_date', in7daysStr)

    if (renewingSoon) {
      for (const sub of renewingSoon) {
        const email = sub.venue_profiles?.email
        const venueName = sub.venue_onboarding?.name || 'Tu espacio'
        if (!email) continue

        // Dedup
        const todayStr = now.toISOString().slice(0, 10)
        const { count } = await svc
          .from('venue_payment_history')
          .select('id', { count: 'exact', head: true })
          .eq('subscription_id', sub.id)
          .eq('event_type', 'renewal_reminder_sent')
          .gte('created_at', todayStr)

        if (count && count > 0) continue

        try {
          await sendRenewalReminderEmail({
            to: email,
            venueName,
            renewalDate: sub.renewal_date,
            amount: sub.amount || 0,
            planName: sub.venue_plans?.display_name || 'Plan FOREVENTOS',
          })

          await svc.from('venue_payment_history').insert({
            user_id: sub.user_id,
            subscription_id: sub.id,
            event_type: 'renewal_reminder_sent',
            notes: `Recordatorio de renovación: ${in7daysStr}`,
          })

          results.renewalReminders++
        } catch (err: any) {
          results.errors.push(`Renewal reminder ${sub.id}: ${err.message}`)
        }
      }
    }

    // ── 3. Payment failed / dunning ─────────────────────────────────────────
    const { data: failedPayments } = await svc
      .from('venue_subscriptions')
      .select('*, venue_profiles!inner(email, display_name), venue_onboarding!inner(name)')
      .eq('payment_status', 'failed')
      .eq('status', 'active')

    if (failedPayments) {
      for (const sub of failedPayments) {
        const email = sub.venue_profiles?.email
        const venueName = sub.venue_onboarding?.name || 'Tu espacio'
        if (!email) continue

        // Max 1 dunning per day
        const todayStr = now.toISOString().slice(0, 10)
        const { count } = await svc
          .from('venue_payment_history')
          .select('id', { count: 'exact', head: true })
          .eq('subscription_id', sub.id)
          .eq('event_type', 'dunning_sent')
          .gte('created_at', todayStr)

        if (count && count > 0) continue

        try {
          await sendPaymentFailedEmail({
            to: email,
            venueName,
            amount: sub.amount,
            errorMessage: sub.last_payment_error || undefined,
          })

          await svc.from('venue_payment_history').insert({
            user_id: sub.user_id,
            subscription_id: sub.id,
            event_type: 'dunning_sent',
            notes: 'Email de pago fallido enviado',
          })

          results.dunningEmails++
        } catch (err: any) {
          results.errors.push(`Dunning ${sub.id}: ${err.message}`)
        }
      }
    }
  } catch (err: any) {
    console.error('[cron/subscription-emails]', err)
    return NextResponse.json({ error: err.message, results }, { status: 500 })
  }

  console.log('[cron/subscription-emails]', results)
  return NextResponse.json({ ok: true, ...results })
}

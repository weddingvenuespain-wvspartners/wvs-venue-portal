import { NextRequest, NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// POST /api/redsys/activate-from-success
// Fallback activation for the checkout success page, used when the Redsys
// webhook (the real activation path) hasn't reached us yet.
//
// Body: { order }  — the Redsys order number echoed back in the success URL.
//
// Security: this endpoint never trusts client-provided plan data. It looks up
// the server-side payment intent persisted at create-payment time (keyed by
// `order`, scoped to the authenticated user) and derives the plan/cycle from
// it. In production it additionally requires the signature-verified webhook to
// have recorded a matching `payment_received`, so a plan can never be activated
// without a real payment. In non-production (local dev, sandbox) the webhook
// can't reach localhost, so the verified intent alone is accepted.

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userId = session.user.id
    const { order } = await req.json()

    if (!order) {
      return NextResponse.json({ error: 'order requerido' }, { status: 400 })
    }

    const svc = getServiceClient()

    // Look up the server-side payment intent for this order, bound to this user.
    const { data: intent } = await svc
      .from('venue_payment_history')
      .select('plan_id, billing_cycle, amount, notes')
      .eq('reference', order)
      .eq('user_id', userId)
      .eq('event_type', 'payment_initiated')
      .maybeSingle()

    if (!intent || !intent.plan_id || !intent.billing_cycle) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
    }

    const planId = intent.plan_id
    const cycleId = intent.billing_cycle
    let venueId: string | null = null
    let intervalMonths = 1
    try {
      const meta = intent.notes ? JSON.parse(intent.notes) : {}
      venueId = meta.venueId ?? null
      intervalMonths = meta.intervalMonths || 1
    } catch { /* notes not JSON — ignore */ }

    // Already activated by the webhook? Scope to the specific venue for
    // multi-venue accounts so venue 2's purchase isn't blocked by venue 1's.
    let existingQuery = svc
      .from('venue_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
    if (venueId) existingQuery = (existingQuery as any).eq('venue_id', venueId)
    const { data: existing } = await existingQuery.maybeSingle()

    if (existing) {
      return NextResponse.json({ status: 'already_active' })
    }

    // In production, require proof that the payment actually completed. The
    // Redsys webhook records a signature-verified `payment_received` for the
    // same order; without it we must not activate (just tell the client to
    // wait for the webhook).
    if (process.env.REDSYS_ENV === 'production') {
      const { data: paid } = await svc
        .from('venue_payment_history')
        .select('id, amount')
        .eq('reference', order)
        .eq('user_id', userId)
        .eq('event_type', 'payment_received')
        .maybeSingle()

      if (!paid) {
        return NextResponse.json({ status: 'pending' })
      }
      // Defense in depth: the recorded paid amount must cover the plan price.
      if (paid.amount != null && intent.amount != null && Number(paid.amount) + 0.01 < Number(intent.amount)) {
        console.error('[activate-from-success] amount mismatch', { order, paid: paid.amount, expected: intent.amount })
        return NextResponse.json({ error: 'Importe no coincide' }, { status: 409 })
      }
    }

    const periodEnd = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + intervalMonths)

    // Cancel any existing trial/expired-trial subscriptions for this user+venue
    // (same as the webhook) so they can't shadow the new paid subscription.
    let cancelQuery = svc
      .from('venue_subscriptions')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .in('status', ['trial', 'trial_expired'])
    if (venueId) cancelQuery = (cancelQuery as any).eq('venue_id', venueId)
    await cancelQuery

    // Create subscription
    const { error: subError } = await svc.from('venue_subscriptions').insert({
      user_id: userId,
      venue_id: venueId || null,
      plan_id: planId,
      status: 'active',
      billing_cycle: cycleId,
      start_date: new Date().toISOString().slice(0, 10),
      renewal_date: periodEnd.toISOString().slice(0, 10),
    })

    if (subError) {
      console.error('[activate-from-success]', subError)
      return NextResponse.json({ error: 'Error activando suscripción' }, { status: 500 })
    }

    // Log in history
    await svc.from('venue_payment_history').insert({
      user_id: userId,
      event_type: 'activated',
      amount: intent.amount ?? null,
      reference: order,
      plan_id: planId,
      billing_cycle: cycleId,
      notes: 'Suscripción activada desde página de éxito (fallback)',
    })

    return NextResponse.json({ status: 'activated' })
  } catch (err: any) {
    console.error('[activate-from-success]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

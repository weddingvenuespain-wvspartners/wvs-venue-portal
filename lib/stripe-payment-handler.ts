// lib/stripe-payment-handler.ts
// Shared handler for completed Stripe Checkout sessions.
// Used by both webhook and server-side verification in page.tsx.

import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

/**
 * Process a completed Checkout Session: update budget_payments + payment_plan.
 * Idempotent — safe to call from both webhook and verify endpoint.
 */
export async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const meta = session.metadata || {}
  if (meta.type !== 'budget_installment') return

  const svc = getServiceClient()
  const budgetId = meta.budget_id
  if (!budgetId) return

  // Parse installment indices
  let installmentIndices: number[] = []
  if (meta.installment_indices) {
    try { installmentIndices = JSON.parse(meta.installment_indices) } catch {}
  } else if (meta.installment_index) {
    installmentIndices = [parseInt(meta.installment_index, 10)]
  }
  if (installmentIndices.length === 0) return

  const now = new Date().toISOString()
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : null

  // Extract payer info from session
  const payerName = session.customer_details?.name || null
  const payerEmail = session.customer_details?.email || null
  const billingAddress = session.customer_details?.address
  const billingAddressStr = billingAddress
    ? [billingAddress.line1, billingAddress.line2, billingAddress.postal_code, billingAddress.city, billingAddress.state, billingAddress.country].filter(Boolean).join(', ')
    : null

  // Extract custom fields (DNI/NIF + full name — may differ from cardholder)
  const customFields = (session as any).custom_fields || []
  const nifField = customFields.find((f: any) => f.key === 'nif_dni')
  const fullNameField = customFields.find((f: any) => f.key === 'full_name')
  const payerNif = nifField?.text?.value || null
  const billingFullName = fullNameField?.text?.value || payerName

  // Update budget_payments records (idempotent — only updates pending ones)
  await svc.from('budget_payments')
    .update({
      status: 'paid',
      stripe_payment_intent_id: paymentIntentId,
      paid_at: now,
      payer_name: payerName,
      payer_email: payerEmail,
    })
    .eq('stripe_checkout_session_id', session.id)
    .eq('status', 'pending')

  // Save billing info to lead (for invoice generation)
  if (meta.budget_id && (payerNif || billingAddressStr || billingFullName)) {
    const { data: bud } = await svc.from('budgets').select('lead_id').eq('id', meta.budget_id).single()
    if (bud?.lead_id) {
      const updates: Record<string, any> = {}
      if (payerNif) updates.billing_nif = payerNif
      if (billingAddressStr) updates.billing_address = billingAddressStr
      if (billingFullName) updates.billing_name = billingFullName
      await svc.from('leads').update(updates).eq('id', bud.lead_id)
    }
  }

  // Update payment_plan installment statuses based on actual paid amounts
  const { data: budget } = await svc
    .from('budgets')
    .select('payment_plan')
    .eq('id', budgetId)
    .single()

  if (budget?.payment_plan) {
    const plan = [...(budget.payment_plan as any[])]
    let changed = false

    for (const idx of installmentIndices) {
      if (!plan[idx] || plan[idx].status === 'paid') continue

      // Sum all paid payments for this installment
      const { data: payments } = await svc
        .from('budget_payments')
        .select('amount')
        .eq('budget_id', budgetId)
        .eq('installment_index', idx)
        .eq('status', 'paid')

      const paidTotal = payments?.reduce((s, p) => s + Number(p.amount), 0) || 0

      if (paidTotal >= Number(plan[idx].amount)) {
        plan[idx] = { ...plan[idx], status: 'paid', paid_at: now }
        changed = true
      }
    }

    if (changed) {
      await svc.from('budgets')
        .update({ payment_plan: plan })
        .eq('id', budgetId)
    }
  }

  // Transition budget status to accepted if needed
  await svc.from('budgets')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', budgetId)
    .in('status', ['draft', 'sent', 'viewed'])
}

// lib/stripe.ts
// Stripe client singleton, Billing helpers, and Connect commission helpers.

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY not set')
    _stripe = new Stripe(key, { apiVersion: '2025-04-30.basil' as any })
  }
  return _stripe
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ── Billing: Customer helpers ─────────────────────────────────────────────────

/**
 * Find existing Stripe customer for user, or create one.
 */
export async function getOrCreateCustomer(
  userId: string,
  email: string,
  name?: string | null,
): Promise<string> {
  const svc = getServiceClient()

  // Check existing stripe_customer_id in any subscription
  const { data: existingSub } = await svc
    .from('venue_subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .not('stripe_customer_id', 'is', null)
    .limit(1)
    .maybeSingle()

  if (existingSub?.stripe_customer_id) return existingSub.stripe_customer_id

  // Search Stripe by email
  const stripe = getStripe()
  const existing = await stripe.customers.list({ email, limit: 1 })
  if (existing.data.length > 0) return existing.data[0].id

  // Create new
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: { user_id: userId },
  })
  return customer.id
}

// ── Billing: Plan sync ────────────────────────────────────────────────────────

type BillingCycleRow = {
  id: string; label: string; price: number
  interval_months: number; commitment_months: number; cancel_notice_days: number
}

function toStripeInterval(months: number): { interval: Stripe.PriceCreateParams.Recurring.Interval; interval_count: number } {
  if (months === 12) return { interval: 'year', interval_count: 1 }
  return { interval: 'month', interval_count: months }
}

/**
 * Sync a venue_plan to Stripe Products + Prices.
 * Creates Product if needed, creates Prices per billing_cycle.
 */
export async function syncPlanToStripe(plan: {
  id: string; name: string; display_name: string | null
  billing_cycles: BillingCycleRow[]; is_active: boolean
  stripe_product_id?: string | null; stripe_price_ids?: Record<string, string> | null
}): Promise<{ stripe_product_id: string; stripe_price_ids: Record<string, string> }> {
  const stripe = getStripe()
  const svc = getServiceClient()

  let productId = plan.stripe_product_id || ''
  const priceIds: Record<string, string> = { ...(plan.stripe_price_ids || {}) }

  const productName = plan.display_name || plan.name
  if (!productId) {
    const product = await stripe.products.create({
      name: `FOREVENTOS — ${productName}`,
      metadata: { plan_id: plan.id },
    })
    productId = product.id
  } else {
    await stripe.products.update(productId, {
      name: `FOREVENTOS — ${productName}`,
      active: plan.is_active,
    })
  }

  for (const cycle of plan.billing_cycles) {
    const existingPriceId = priceIds[cycle.id]
    const amountCents = Math.round(cycle.price * 100)
    const { interval, interval_count } = toStripeInterval(cycle.interval_months)

    if (existingPriceId) {
      try {
        const ep = await stripe.prices.retrieve(existingPriceId)
        if (ep.unit_amount === amountCents && ep.recurring?.interval === interval && ep.recurring?.interval_count === interval_count) continue
      } catch {}
      try { await stripe.prices.update(existingPriceId, { active: false }) } catch {}
    }

    const price = await stripe.prices.create({
      product: productId,
      unit_amount: amountCents,
      currency: 'eur',
      recurring: { interval, interval_count },
      metadata: { plan_id: plan.id, cycle_id: cycle.id },
    })
    priceIds[cycle.id] = price.id
  }

  await svc.from('venue_plans').update({
    stripe_product_id: productId,
    stripe_price_ids: priceIds,
  }).eq('id', plan.id)

  return { stripe_product_id: productId, stripe_price_ids: priceIds }
}

// ── Commission helpers ─────────────────────────────────────────────

/** Platform takes 5% of base amount (2.5% from couple surcharge + 2.5% from venue) */
const PLATFORM_RATE = 0.05
/** Couple surcharge added on top of installment amount */
const COUPLE_SURCHARGE_RATE = 0.025

export type CheckoutAmounts = {
  /** Original installment amount in EUR (e.g. 1000) */
  baseAmount: number
  /** What couple pays = base × 1.025 */
  chargeAmount: number
  /** Platform application_fee = base × 0.05 (in cents for Stripe) */
  applicationFeeCents: number
  /** Total charge in cents for Stripe */
  chargeAmountCents: number
}

/**
 * Calculate all amounts for a budget installment payment.
 * @param baseAmount Installment amount in EUR (e.g. 1000.00)
 */
export function calculateCheckoutAmounts(baseAmount: number): CheckoutAmounts {
  const chargeAmount = Math.round(baseAmount * (1 + COUPLE_SURCHARGE_RATE) * 100) / 100
  const applicationFee = Math.round(baseAmount * PLATFORM_RATE * 100) / 100
  return {
    baseAmount,
    chargeAmount,
    applicationFeeCents: Math.round(applicationFee * 100),
    chargeAmountCents: Math.round(chargeAmount * 100),
  }
}

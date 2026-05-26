// lib/stripe.ts
// Stripe client singleton + commission calculation helpers for Stripe Connect Express.

import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY not set')
    _stripe = new Stripe(key, { apiVersion: '2025-04-30.basil' as any })
  }
  return _stripe
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

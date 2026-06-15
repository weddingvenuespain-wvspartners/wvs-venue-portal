-- Stripe Billing Integration — Database Migration
-- Run this in Supabase SQL Editor or via migration tool.
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- ── venue_plans: Stripe Product/Price mapping ────────────────────────────────
ALTER TABLE venue_plans
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_ids JSONB;

COMMENT ON COLUMN venue_plans.stripe_product_id IS 'Stripe Product ID (prod_xxx)';
COMMENT ON COLUMN venue_plans.stripe_price_ids IS 'Map of cycle_id → Stripe Price ID, e.g. {"yearly":"price_xxx","monthly":"price_yyy"}';

-- ── venue_subscriptions: Stripe Customer/Subscription IDs ────────────────────
ALTER TABLE venue_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

COMMENT ON COLUMN venue_subscriptions.stripe_customer_id IS 'Stripe Customer ID (cus_xxx)';
COMMENT ON COLUMN venue_subscriptions.stripe_subscription_id IS 'Stripe Subscription ID (sub_xxx)';

-- Index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_venue_subscriptions_stripe_sub_id
  ON venue_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_venue_subscriptions_stripe_cust_id
  ON venue_subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

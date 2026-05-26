-- ──────────────────────────────────────────────────────────────────────────────
-- Stripe Connect Express — venue accounts + budget payment columns
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. New table: venue Stripe connected accounts
CREATE TABLE IF NOT EXISTS public.venue_stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id UUID,
  stripe_account_id TEXT NOT NULL UNIQUE,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One Stripe account per user (for now)
CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_stripe_user
  ON public.venue_stripe_accounts(user_id);

-- RLS: venue owner can read own record
ALTER TABLE public.venue_stripe_accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'venue_stripe_accounts' AND policyname = 'Users can read own stripe account'
  ) THEN
    CREATE POLICY "Users can read own stripe account"
      ON public.venue_stripe_accounts FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Extend budget_payments for Stripe
ALTER TABLE public.budget_payments
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'redsys';

-- Add check constraint only if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'budget_payments_payment_provider_check'
  ) THEN
    ALTER TABLE public.budget_payments
      ADD CONSTRAINT budget_payments_payment_provider_check
      CHECK (payment_provider IN ('redsys', 'stripe'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_budget_payments_stripe_session
  ON public.budget_payments(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

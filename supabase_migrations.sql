-- ============================================================
-- WVS Venue Portal — Settings page migrations
-- Run in: Supabase → SQL Editor → New Query
-- ============================================================

-- ── 1. New columns for venue_profiles ────────────────────────
--    Required by the Configuración / Perfil page

ALTER TABLE venue_profiles
  ADD COLUMN IF NOT EXISTS display_name   TEXT,
  ADD COLUMN IF NOT EXISTS first_name     TEXT,
  ADD COLUMN IF NOT EXISTS last_name      TEXT,
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS website        TEXT,
  ADD COLUMN IF NOT EXISTS venue_website  TEXT,
  ADD COLUMN IF NOT EXISTS company        TEXT,
  ADD COLUMN IF NOT EXISTS address        TEXT,
  ADD COLUMN IF NOT EXISTS role           TEXT    NOT NULL DEFAULT 'venue_owner',
  ADD COLUMN IF NOT EXISTS status         TEXT    NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS admin_notes    TEXT,
  ADD COLUMN IF NOT EXISTS wp_username    TEXT,
  ADD COLUMN IF NOT EXISTS notif_settings    TEXT,
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS timezone          TEXT    NOT NULL DEFAULT 'Europe/Madrid',
  ADD COLUMN IF NOT EXISTS language       TEXT    NOT NULL DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS date_format    TEXT    NOT NULL DEFAULT 'DD/MM/YYYY',
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT now();

-- ── 2. trial_end_date on venue_subscriptions ─────────────────
--    Required by the trial countdown banner

ALTER TABLE venue_subscriptions
  ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT now();

-- Allow 'paused' status in addition to existing values
ALTER TABLE venue_subscriptions
  DROP CONSTRAINT IF EXISTS venue_subscriptions_status_check;

ALTER TABLE venue_subscriptions
  ADD CONSTRAINT venue_subscriptions_status_check
    CHECK (status IN ('trial', 'active', 'paused', 'cancelled', 'expired'));

-- ── 3. venue_payment_history table ───────────────────────────
--    Required by the Facturación tab

CREATE TABLE IF NOT EXISTS venue_payment_history (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type    TEXT        NOT NULL DEFAULT 'payment'
                              CHECK (event_type IN ('payment','trial_started','activated','plan_changed','cancelled','reactivated','note')),
  amount        NUMERIC(10,2),
  reference     TEXT,
  notes         TEXT,
  plan_id       UUID        REFERENCES venue_plans(id),
  billing_cycle TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. RLS for venue_payment_history ─────────────────────────

ALTER TABLE venue_payment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own payment history" ON venue_payment_history;
CREATE POLICY "Users can read own payment history"
  ON venue_payment_history FOR SELECT
  USING (auth.uid() = user_id);

-- Admins insert/update via service role (bypasses RLS) — no extra policy needed.

-- ── 5. auto-update updated_at trigger ────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_venue_profiles_updated_at ON venue_profiles;
CREATE TRIGGER set_venue_profiles_updated_at
  BEFORE UPDATE ON venue_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_venue_subscriptions_updated_at ON venue_subscriptions;
CREATE TRIGGER set_venue_subscriptions_updated_at
  BEFORE UPDATE ON venue_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

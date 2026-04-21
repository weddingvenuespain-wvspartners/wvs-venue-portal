-- ============================================================
-- WVS — wp_clients extended fields for WP couple creation
-- Run in: Supabase → SQL Editor → New Query
-- ============================================================

ALTER TABLE wp_clients
  ADD COLUMN IF NOT EXISTS whatsapp            TEXT,
  ADD COLUMN IF NOT EXISTS source              TEXT,
  ADD COLUMN IF NOT EXISTS date_flexibility    TEXT DEFAULT 'exact',
  ADD COLUMN IF NOT EXISTS wedding_date_to     DATE,
  ADD COLUMN IF NOT EXISTS wedding_date_ranges JSONB,
  ADD COLUMN IF NOT EXISTS wedding_year        INTEGER,
  ADD COLUMN IF NOT EXISTS wedding_month       INTEGER,
  ADD COLUMN IF NOT EXISTS wedding_season      TEXT,
  ADD COLUMN IF NOT EXISTS ceremony_type       TEXT,
  ADD COLUMN IF NOT EXISTS language            TEXT;

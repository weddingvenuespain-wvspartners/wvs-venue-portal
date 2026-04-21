-- ============================================================
-- WVS — Branding columns for wedding planner proposals
-- Run in: Supabase → SQL Editor → New Query
-- ============================================================

ALTER TABLE venue_profiles
  ADD COLUMN IF NOT EXISTS proposal_title  TEXT,
  ADD COLUMN IF NOT EXISTS brand_color     TEXT DEFAULT '#c4975a',
  ADD COLUMN IF NOT EXISTS brand_color2    TEXT DEFAULT '#f5f0ea',
  ADD COLUMN IF NOT EXISTS brand_logo_url  TEXT;

-- Unique constraint needed for upsert in client detail catering assignment
ALTER TABLE wp_client_caterings
  DROP CONSTRAINT IF EXISTS wp_client_caterings_client_catering_unique;

ALTER TABLE wp_client_caterings
  ADD CONSTRAINT wp_client_caterings_client_catering_unique
  UNIQUE (client_id, catering_user_id);

-- Same for venues (may already exist from original migration)
ALTER TABLE wp_client_venues
  DROP CONSTRAINT IF EXISTS wp_client_venues_client_venue_unique;

ALTER TABLE wp_client_venues
  ADD CONSTRAINT wp_client_venues_client_venue_unique
  UNIQUE (client_id, venue_user_id);

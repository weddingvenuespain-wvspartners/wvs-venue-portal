-- ============================================================
-- WVS — Add venue_quote_url to wp_client_venues and wp_client_caterings
-- Run in: Supabase → SQL Editor → New Query
-- ============================================================

ALTER TABLE wp_client_venues
  ADD COLUMN IF NOT EXISTS venue_quote_url TEXT;

ALTER TABLE wp_client_caterings
  ADD COLUMN IF NOT EXISTS venue_quote_url TEXT;

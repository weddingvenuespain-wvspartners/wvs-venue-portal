-- ============================================================
-- WVS — Proposal expiry date for couple landing page
-- Run in: Supabase → SQL Editor → New Query
-- ============================================================

ALTER TABLE wp_clients
  ADD COLUMN IF NOT EXISTS proposal_expires_at TIMESTAMPTZ;

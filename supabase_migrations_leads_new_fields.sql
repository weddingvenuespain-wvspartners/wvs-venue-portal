-- ============================================================
-- WVS — New lead fields: country, guests breakdown, catering, tags
-- Run in: Supabase → SQL Editor → New Query
-- ============================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS country         TEXT,
  ADD COLUMN IF NOT EXISTS guests_adults   INTEGER,
  ADD COLUMN IF NOT EXISTS guests_children INTEGER,
  ADD COLUMN IF NOT EXISTS catering_needed TEXT,
  ADD COLUMN IF NOT EXISTS tags            TEXT[];

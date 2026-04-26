-- ── proposal_menu_selections: add menu_allocations + wedding_date ──────────
-- Adds support for multi-menu proposals (each menu can have a different
-- guest count) and for client-selected wedding date on flexible-date proposals.
-- Run in Supabase → SQL Editor.

ALTER TABLE proposal_menu_selections
  ADD COLUMN IF NOT EXISTS menu_allocations JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS wedding_date     DATE;

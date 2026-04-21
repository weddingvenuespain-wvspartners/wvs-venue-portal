-- ============================================================
-- WVS — Planner venue favorites
-- Run in: Supabase → SQL Editor → New Query
-- ============================================================

CREATE TABLE IF NOT EXISTS wp_planner_favorites (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  planner_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_user_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (planner_id, venue_user_id)
);

CREATE INDEX IF NOT EXISTS idx_wp_planner_favorites_planner ON wp_planner_favorites(planner_id);

-- RLS: each planner manages only their own favorites
ALTER TABLE wp_planner_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_manages_favorites" ON wp_planner_favorites
  USING (planner_id = auth.uid())
  WITH CHECK (planner_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────────
-- WP Commission tracking for proposals and budgets
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. clients: rename/repurpose wp_commission_type → wp_commission_mode
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS wp_commission_mode TEXT
    CHECK (wp_commission_mode IN ('comisionable', 'neto'));

-- Migrate existing wp_commission_type values (if any) into wp_commission_mode
UPDATE public.clients
  SET wp_commission_mode = COALESCE(wp_commission_mode,
    CASE
      WHEN wp_commission_type = 'neto' THEN 'neto'
      WHEN wp_commission_type = 'comisionable' THEN 'comisionable'
      WHEN wp_commission_percent IS NOT NULL THEN 'comisionable'
      ELSE NULL
    END);

-- 2. proposals: commission snapshot columns
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS commission_planner_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS commission_mode TEXT CHECK (commission_mode IN ('comisionable', 'neto')),
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC;

CREATE INDEX IF NOT EXISTS idx_proposals_commission_planner ON public.proposals(commission_planner_id);

-- 3. budgets: commission snapshot columns
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS commission_planner_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS commission_mode TEXT CHECK (commission_mode IN ('comisionable', 'neto')),
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC;

CREATE INDEX IF NOT EXISTS idx_budgets_commission_planner ON public.budgets(commission_planner_id);

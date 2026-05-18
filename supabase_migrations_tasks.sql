-- ============================================================
-- WVS Venue Portal — Venue Tasks
-- Tabla: venue_tasks
-- ============================================================

CREATE TABLE IF NOT EXISTS public.venue_tasks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  description   TEXT,
  due_date      DATE        NOT NULL,
  type          TEXT        NOT NULL DEFAULT 'internal'
                              CHECK (type IN ('internal', 'lead')),
  lead_id       UUID        REFERENCES public.leads(id) ON DELETE SET NULL,
  completed     BOOLEAN     NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS venue_tasks_venue_id_idx  ON public.venue_tasks (venue_id);
CREATE INDEX IF NOT EXISTS venue_tasks_due_date_idx  ON public.venue_tasks (due_date);
CREATE INDEX IF NOT EXISTS venue_tasks_lead_id_idx   ON public.venue_tasks (lead_id);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.venue_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venue_tasks_owner ON public.venue_tasks;
CREATE POLICY venue_tasks_owner ON public.venue_tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── updated_at trigger ────────────────────────────────────────

-- Reuse existing set_updated_at() if it exists, otherwise create
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS venue_tasks_updated_at ON public.venue_tasks;
CREATE TRIGGER venue_tasks_updated_at
  BEFORE UPDATE ON public.venue_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

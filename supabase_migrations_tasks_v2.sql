-- ============================================================
-- WVS Venue Portal — Venue Tasks v2
-- Adds: priority, category columns
-- ============================================================

-- Priority: alta, media, normal (default)
ALTER TABLE public.venue_tasks
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('alta', 'media', 'normal'));

-- Category: llamar, enviar_dossier, seguimiento, visita, otro (default)
ALTER TABLE public.venue_tasks
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'otro'
    CHECK (category IN ('llamar', 'enviar_dossier', 'seguimiento', 'visita', 'otro'));

-- Index for filtering by priority
CREATE INDEX IF NOT EXISTS venue_tasks_priority_idx ON public.venue_tasks (priority);

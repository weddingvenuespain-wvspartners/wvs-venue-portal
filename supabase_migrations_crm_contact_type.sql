-- ============================================================
-- CRM: contact_type field on leads
-- Values: pareja | wedding_planner | event_organizer | empresa | otro
-- ============================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS contact_type TEXT NOT NULL DEFAULT 'pareja'
    CHECK (contact_type IN ('pareja', 'wedding_planner', 'event_organizer', 'empresa', 'otro'));

-- Backfill: leads from wedding_planner source → type wedding_planner
UPDATE public.leads SET contact_type = 'wedding_planner'
  WHERE source = 'wedding_planner' AND contact_type = 'pareja';

-- ============================================================
-- Fix venue_tasks: drop wrong FK on venue_id (auth.users)
-- venue_id stores the user_venues.id, not auth.users.id
-- ============================================================

-- Drop the incorrect FK constraint on venue_id
ALTER TABLE public.venue_tasks
  DROP CONSTRAINT IF EXISTS venue_tasks_venue_id_fkey;

-- venue_id is now a plain UUID (no FK) pointing to user_venues.id
-- user_id still references auth.users and drives RLS

-- ============================================================
-- WVS Venue Portal — Plan-based RLS gating (propuestas + comunicación)
-- Run in: Supabase → SQL Editor → New Query
--
-- Goal: deny writes to premium tables when the authenticated user
-- is NOT on a premium plan. Service role bypasses RLS (admin backend
-- ops keep working). Admins (role='admin' in venue_profiles) always pass.
--
-- Implementation: RESTRICTIVE policies on INSERT/UPDATE/DELETE for the
-- `authenticated` role. They stack with AND on top of existing owner
-- policies (proposals_owner, branding_owner, etc.), so the effective
-- rule becomes:  (owner check) AND (has_feature check).
-- Anon reads (e.g. public proposal link) are untouched.
-- SELECT is intentionally NOT gated — a user that downgrades can still
-- see their historical data, but cannot create/modify/delete anything.
-- ============================================================

-- ── 1. Helper: has_feature(feature_key) ──────────────────────
--    Returns true if the current authenticated user has access to
--    the given plan feature. Handles:
--      - admins (always true)
--      - active/trial subscriptions (with trial_end_date check)
--      - plan.permissions JSONB (per-plan overrides)
--      - profile.features_override JSONB (per-user overrides)
--      - fallbacks: basic plan → basic features, premium → all

CREATE OR REPLACE FUNCTION public.has_feature(feature_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_role         text;
  v_overrides    jsonb;
  v_plan_name    text;
  v_plan_perms   jsonb;
  v_sub_status   text;
  v_trial_end    timestamptz;
  v_is_premium   boolean;
  v_basic_keys   text[] := ARRAY['ficha','leads','leads_date_filter','calendario','estadisticas'];
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Admins always pass
  SELECT role, COALESCE(features_override, '{}'::jsonb)
    INTO v_role, v_overrides
    FROM public.venue_profiles
   WHERE user_id = v_uid
   LIMIT 1;

  IF v_role = 'admin' THEN
    RETURN true;
  END IF;

  -- Per-user override wins if present
  IF v_overrides ? feature_key THEN
    RETURN COALESCE((v_overrides ->> feature_key)::boolean, false);
  END IF;

  -- Resolve active subscription → plan (fall back to trial)
  SELECT s.status, s.trial_end_date, p.name, COALESCE(p.permissions, '{}'::jsonb)
    INTO v_sub_status, v_trial_end, v_plan_name, v_plan_perms
    FROM public.venue_subscriptions s
    LEFT JOIN public.venue_plans p ON p.id = s.plan_id
   WHERE s.user_id = v_uid
     AND s.status = 'active'
   ORDER BY s.created_at DESC
   LIMIT 1;

  IF v_plan_name IS NULL THEN
    SELECT s.status, s.trial_end_date, p.name, COALESCE(p.permissions, '{}'::jsonb)
      INTO v_sub_status, v_trial_end, v_plan_name, v_plan_perms
      FROM public.venue_subscriptions s
      LEFT JOIN public.venue_plans p ON p.id = s.plan_id
     WHERE s.user_id = v_uid
       AND s.status = 'trial'
     ORDER BY s.created_at DESC
     LIMIT 1;
  END IF;

  -- No subscription at all → no features
  IF v_plan_name IS NULL THEN
    RETURN false;
  END IF;

  -- Expired trial → no features
  IF v_sub_status = 'trial' AND v_trial_end IS NOT NULL AND v_trial_end <= now() THEN
    RETURN false;
  END IF;

  -- Explicit permission stored on the plan wins over fallback
  IF v_plan_perms ? feature_key THEN
    RETURN COALESCE((v_plan_perms ->> feature_key)::boolean, false);
  END IF;

  -- Fallback: premium = everything, basic = only basic keys
  v_is_premium := v_plan_name IS NOT NULL AND v_plan_name <> 'basic';
  IF v_is_premium THEN
    RETURN true;
  END IF;

  RETURN feature_key = ANY(v_basic_keys);
END;
$$;

REVOKE ALL ON FUNCTION public.has_feature(text) FROM public;
GRANT EXECUTE ON FUNCTION public.has_feature(text) TO authenticated, anon;

-- ── 2. RLS policies — proposals (RESTRICTIVE, AND'd to owner) ─

DROP POLICY IF EXISTS "plan_gate_insert_proposals" ON public.proposals;
CREATE POLICY "plan_gate_insert_proposals"
  ON public.proposals
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_feature('propuestas'));

DROP POLICY IF EXISTS "plan_gate_update_proposals" ON public.proposals;
CREATE POLICY "plan_gate_update_proposals"
  ON public.proposals
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING      (public.has_feature('propuestas'))
  WITH CHECK (public.has_feature('propuestas'));

DROP POLICY IF EXISTS "plan_gate_delete_proposals" ON public.proposals;
CREATE POLICY "plan_gate_delete_proposals"
  ON public.proposals
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.has_feature('propuestas'));

-- ── 3. RLS policies — proposal_branding ─────────────────────

DROP POLICY IF EXISTS "plan_gate_insert_proposal_branding" ON public.proposal_branding;
CREATE POLICY "plan_gate_insert_proposal_branding"
  ON public.proposal_branding
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_feature('propuestas'));

DROP POLICY IF EXISTS "plan_gate_update_proposal_branding" ON public.proposal_branding;
CREATE POLICY "plan_gate_update_proposal_branding"
  ON public.proposal_branding
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING      (public.has_feature('propuestas'))
  WITH CHECK (public.has_feature('propuestas'));

DROP POLICY IF EXISTS "plan_gate_delete_proposal_branding" ON public.proposal_branding;
CREATE POLICY "plan_gate_delete_proposal_branding"
  ON public.proposal_branding
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.has_feature('propuestas'));

-- ── 4. RLS policies — proposal_web_templates ────────────────

DROP POLICY IF EXISTS "plan_gate_insert_proposal_web_templates" ON public.proposal_web_templates;
CREATE POLICY "plan_gate_insert_proposal_web_templates"
  ON public.proposal_web_templates
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_feature('propuestas'));

DROP POLICY IF EXISTS "plan_gate_update_proposal_web_templates" ON public.proposal_web_templates;
CREATE POLICY "plan_gate_update_proposal_web_templates"
  ON public.proposal_web_templates
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING      (public.has_feature('propuestas'))
  WITH CHECK (public.has_feature('propuestas'));

DROP POLICY IF EXISTS "plan_gate_delete_proposal_web_templates" ON public.proposal_web_templates;
CREATE POLICY "plan_gate_delete_proposal_web_templates"
  ON public.proposal_web_templates
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.has_feature('propuestas'));

-- ── 5. RLS policies — message_templates (Comunicación) ──────

DROP POLICY IF EXISTS "plan_gate_insert_message_templates" ON public.message_templates;
CREATE POLICY "plan_gate_insert_message_templates"
  ON public.message_templates
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_feature('comunicacion'));

DROP POLICY IF EXISTS "plan_gate_update_message_templates" ON public.message_templates;
CREATE POLICY "plan_gate_update_message_templates"
  ON public.message_templates
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING      (public.has_feature('comunicacion'))
  WITH CHECK (public.has_feature('comunicacion'));

DROP POLICY IF EXISTS "plan_gate_delete_message_templates" ON public.message_templates;
CREATE POLICY "plan_gate_delete_message_templates"
  ON public.message_templates
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.has_feature('comunicacion'));

-- ── 6. RLS policies — dossiers (Comunicación) ───────────────

DROP POLICY IF EXISTS "plan_gate_insert_dossiers" ON public.dossiers;
CREATE POLICY "plan_gate_insert_dossiers"
  ON public.dossiers
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_feature('comunicacion'));

DROP POLICY IF EXISTS "plan_gate_update_dossiers" ON public.dossiers;
CREATE POLICY "plan_gate_update_dossiers"
  ON public.dossiers
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING      (public.has_feature('comunicacion'))
  WITH CHECK (public.has_feature('comunicacion'));

DROP POLICY IF EXISTS "plan_gate_delete_dossiers" ON public.dossiers;
CREATE POLICY "plan_gate_delete_dossiers"
  ON public.dossiers
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.has_feature('comunicacion'));

-- ── 7. Smoke test (optional) ─────────────────────────────────
-- SELECT public.has_feature('propuestas');   -- run as the logged-in user
-- SELECT public.has_feature('comunicacion'); -- run as the logged-in user

-- ============================================================
-- WVS Venue Portal — Multiple commercial configurations per venue
-- New table: venue_commercial_configs
-- New FK columns on: venue_modalities, proposal_content_templates, proposals
-- Migration of existing data
-- ============================================================

-- ── 1. venue_commercial_configs ──────────────────────────────
--    Named commercial configurations per venue

CREATE TABLE IF NOT EXISTS public.venue_commercial_configs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id       uuid        NOT NULL,
  name           text        NOT NULL,             -- e.g. "Boda clásica", "Evento corporativo"
  config         jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- same shape as venue_settings.commercial_config
  is_default     boolean     NOT NULL DEFAULT false,
  sort_order     integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS venue_commercial_configs_user_venue_idx
  ON public.venue_commercial_configs (user_id, venue_id);

ALTER TABLE public.venue_commercial_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_configs_owner ON public.venue_commercial_configs;
CREATE POLICY commercial_configs_owner ON public.venue_commercial_configs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS venue_commercial_configs_updated_at ON public.venue_commercial_configs;
CREATE TRIGGER venue_commercial_configs_updated_at
  BEFORE UPDATE ON public.venue_commercial_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. Add commercial_config_id to venue_modalities ──────────

ALTER TABLE public.venue_modalities
  ADD COLUMN IF NOT EXISTS commercial_config_id uuid
    REFERENCES public.venue_commercial_configs(id) ON DELETE SET NULL;

-- ── 3. Add commercial_config_id to proposal_content_templates ─

ALTER TABLE public.proposal_content_templates
  ADD COLUMN IF NOT EXISTS commercial_config_id uuid
    REFERENCES public.venue_commercial_configs(id) ON DELETE SET NULL;

-- ── 4. Add commercial_config_id to proposals ─────────────────

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS commercial_config_id uuid
    REFERENCES public.venue_commercial_configs(id) ON DELETE SET NULL;

-- ── 5. Migrate existing data ─────────────────────────────────
--    For each venue_settings row that has a commercial_config,
--    create a venue_commercial_configs row and link existing modalities.

-- Step 5a: Create default commercial config from existing venue_settings
INSERT INTO public.venue_commercial_configs (user_id, venue_id, name, config, is_default)
SELECT
  vs.user_id,
  vs.venue_id,
  'Configuración principal',
  vs.commercial_config,
  true
FROM public.venue_settings vs
WHERE vs.commercial_config IS NOT NULL
  AND vs.commercial_config != '{}'::jsonb
ON CONFLICT DO NOTHING;

-- Step 5b: Link existing modalities to their venue's default config
UPDATE public.venue_modalities vm
SET commercial_config_id = vcc.id
FROM public.venue_commercial_configs vcc
WHERE vcc.user_id = vm.user_id
  AND vcc.venue_id = vm.venue_id
  AND vcc.is_default = true
  AND vm.commercial_config_id IS NULL;

-- Step 5c: Link existing content templates to their venue's default config
-- (templates don't have venue_id directly, so we match via user_id + default config)
-- We'll link them in the app layer instead since templates may need manual assignment.

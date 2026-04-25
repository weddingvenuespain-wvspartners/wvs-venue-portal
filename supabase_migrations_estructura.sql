-- ============================================================
-- WVS Venue Portal — Estructura comercial
-- Tablas: venue_modalities, venue_modality_prices
-- Columna adicional: proposals.modality_id
-- ============================================================

-- ── 1. venue_modalities ──────────────────────────────────────
--    Modalidades comerciales del venue (ej: "Fin de semana", "Día completo")

CREATE TABLE IF NOT EXISTS public.venue_modalities (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  description    text,
  duration_label text,                    -- ej: "Viernes tarde a domingo mediodía"
  sort_order     integer     NOT NULL DEFAULT 0,
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS venue_modalities_user_id_idx ON public.venue_modalities (user_id);

ALTER TABLE public.venue_modalities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS modalities_owner ON public.venue_modalities;
CREATE POLICY modalities_owner ON public.venue_modalities
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 2. venue_modality_prices ─────────────────────────────────
--    Precios por rango de fechas para cada modalidad

CREATE TABLE IF NOT EXISTS public.venue_modality_prices (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  modality_id  uuid        NOT NULL REFERENCES public.venue_modalities(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date_from    date        NOT NULL,
  date_to      date        NOT NULL,
  price        numeric(10,2) NOT NULL CHECK (price >= 0),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT date_range_valid CHECK (date_to >= date_from)
);

CREATE INDEX IF NOT EXISTS venue_modality_prices_modality_idx ON public.venue_modality_prices (modality_id);
CREATE INDEX IF NOT EXISTS venue_modality_prices_user_idx     ON public.venue_modality_prices (user_id);

ALTER TABLE public.venue_modality_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS modality_prices_owner ON public.venue_modality_prices;
CREATE POLICY modality_prices_owner ON public.venue_modality_prices
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 3. proposals.modality_id ─────────────────────────────────
--    Referencia opcional a la modalidad usada en la propuesta

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS modality_id uuid REFERENCES public.venue_modalities(id) ON DELETE SET NULL;

-- ── 4. updated_at triggers ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS venue_modalities_updated_at       ON public.venue_modalities;
CREATE TRIGGER venue_modalities_updated_at
  BEFORE UPDATE ON public.venue_modalities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS venue_modality_prices_updated_at  ON public.venue_modality_prices;
CREATE TRIGGER venue_modality_prices_updated_at
  BEFORE UPDATE ON public.venue_modality_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

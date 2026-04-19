-- ============================================================
-- WVS Venue Portal — Settings page migrations
-- Run in: Supabase → SQL Editor → New Query
-- ============================================================

-- ── 1. New columns for venue_profiles ────────────────────────
--    Required by the Configuración / Perfil page

ALTER TABLE venue_profiles
  ADD COLUMN IF NOT EXISTS display_name   TEXT,
  ADD COLUMN IF NOT EXISTS first_name     TEXT,
  ADD COLUMN IF NOT EXISTS last_name      TEXT,
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS website        TEXT,
  ADD COLUMN IF NOT EXISTS venue_website  TEXT,
  ADD COLUMN IF NOT EXISTS company        TEXT,
  ADD COLUMN IF NOT EXISTS address        TEXT,
  ADD COLUMN IF NOT EXISTS role           TEXT    NOT NULL DEFAULT 'venue_owner',
  ADD COLUMN IF NOT EXISTS status         TEXT    NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS admin_notes    TEXT,
  ADD COLUMN IF NOT EXISTS wp_username    TEXT,
  ADD COLUMN IF NOT EXISTS notif_settings    TEXT,
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS timezone          TEXT    NOT NULL DEFAULT 'Europe/Madrid',
  ADD COLUMN IF NOT EXISTS language       TEXT    NOT NULL DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS date_format    TEXT    NOT NULL DEFAULT 'DD/MM/YYYY',
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT now();

-- ── 2. trial_end_date on venue_subscriptions ─────────────────
--    Required by the trial countdown banner

ALTER TABLE venue_subscriptions
  ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT now();

-- Allow 'paused' status in addition to existing values
ALTER TABLE venue_subscriptions
  DROP CONSTRAINT IF EXISTS venue_subscriptions_status_check;

ALTER TABLE venue_subscriptions
  ADD CONSTRAINT venue_subscriptions_status_check
    CHECK (status IN ('trial', 'active', 'paused', 'cancelled', 'expired'));

-- ── 3. venue_payment_history table ───────────────────────────
--    Required by the Facturación tab

CREATE TABLE IF NOT EXISTS venue_payment_history (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type    TEXT        NOT NULL DEFAULT 'payment'
                              CHECK (event_type IN ('payment','trial_started','activated','plan_changed','cancelled','reactivated','note')),
  amount        NUMERIC(10,2),
  reference     TEXT,
  notes         TEXT,
  plan_id       UUID        REFERENCES venue_plans(id),
  billing_cycle TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. RLS for venue_payment_history ─────────────────────────

ALTER TABLE venue_payment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own payment history" ON venue_payment_history;
CREATE POLICY "Users can read own payment history"
  ON venue_payment_history FOR SELECT
  USING (auth.uid() = user_id);

-- Admins insert/update via service role (bypasses RLS) — no extra policy needed.

-- ── 5. auto-update updated_at trigger ────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_venue_profiles_updated_at ON venue_profiles;
CREATE TRIGGER set_venue_profiles_updated_at
  BEFORE UPDATE ON venue_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_venue_subscriptions_updated_at ON venue_subscriptions;
CREATE TRIGGER set_venue_subscriptions_updated_at
  BEFORE UPDATE ON venue_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 6. Feature overrides per venue (admin can override plan features individually) ──

ALTER TABLE venue_profiles
  ADD COLUMN IF NOT EXISTS features_override JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── 7. Add post_visit to leads status check constraint ────────
--    The pipeline now includes: new → contacted → proposal_sent
--    → visit_scheduled → post_visit → budget_sent → won → lost

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE leads
  ADD CONSTRAINT leads_status_check
    CHECK (status IN ('new','contacted','proposal_sent','visit_scheduled','post_visit','budget_sent','won','lost'));

-- ── 8. Demo leads in post_visit (5 examples) ─────────────────
--    Corre este bloque en Supabase → SQL Editor.
--    Primero ejecuta la siguiente línea para ver tu user_id:
--      SELECT user_id FROM venue_profiles LIMIT 1;
--    Luego reemplaza 'TU-USER-ID-AQUI' con el UUID que aparezca.

INSERT INTO leads (user_id, name, email, phone, status, date_flexibility, wedding_date, guests, source, budget, ceremony_type, notes, created_at)
VALUES
  ('TU-USER-ID-AQUI', 'Laura & Marcos',    'laura.marcos@gmail.com',   '+34 612 345 678', 'post_visit', 'exact',    (now() + interval '8 months')::date,  80,  'web',       '35k_50k',    'civil',     'Les gustó mucho la finca. Esperando propuesta.',      now() - interval '5 days'),
  ('TU-USER-ID-AQUI', 'Sofía & Daniel',    'sofia.daniel@hotmail.com', '+34 623 456 789', 'post_visit', 'exact',    (now() + interval '14 months')::date, 120, 'instagram', 'mas_50k',    'religiosa', 'Visita muy positiva. Quieren presupuesto detallado.', now() - interval '9 days'),
  ('TU-USER-ID-AQUI', 'Elena & Pablo',     'elena.pablo@gmail.com',    '+34 634 567 890', 'post_visit', 'exact',    (now() + interval '10 months')::date, 60,  'referral',  '20k_35k',    'simbolica', 'Interesados. Tienen otra visita pendiente.',          now() - interval '3 days'),
  ('TU-USER-ID-AQUI', 'Marta & Alejandro', 'marta.ale@outlook.com',    '+34 645 678 901', 'post_visit', 'exact',    (now() + interval '6 months')::date,  100, 'web',       '35k_50k',    'civil',     'Muy interesados. Piden ver opciones de catering.',    now() - interval '12 days'),
  ('TU-USER-ID-AQUI', 'Carmen & Javier',   'carmen.javi@gmail.com',    '+34 656 789 012', 'post_visit', 'flexible', NULL,                                  90,  'email',     'sin_definir', 'simbolica', 'Primera visita hecha. Aún sin fecha cerrada.',        now() - interval '7 days');

-- ── 9. wedding_date_history column on leads ───────────────────
--    Required for tracking date changes when leads move between statuses.
--    Run in Supabase → SQL Editor.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS wedding_date_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── 10. Update venue_profiles status check constraint ─────────
--    Add 'trial_expired' to allowed statuses.
--    Run in Supabase → SQL Editor.

ALTER TABLE venue_profiles
  DROP CONSTRAINT IF EXISTS venue_profiles_status_check;

ALTER TABLE venue_profiles
  ADD CONSTRAINT venue_profiles_status_check
    CHECK (status IN ('active', 'inactive', 'pending', 'trial_expired'));

-- ── 11. proposal_menu_selections ──────────────────────────────
--    Stores what invitees picked from the WeddingProposal block
--    (menu + course picks + extras + comments).
--    Run in Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS proposal_menu_selections (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id          UUID        NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  selected_menu_id     TEXT,
  selected_menu_name   TEXT,
  guest_count          INT,
  original_guest_count INT,
  guest_count_changed  BOOLEAN     NOT NULL DEFAULT false,
  course_choices       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  selected_extras      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  comments             TEXT,
  estimated_total      NUMERIC,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proposal_menu_selections_proposal_id_idx
  ON proposal_menu_selections(proposal_id);

ALTER TABLE proposal_menu_selections ENABLE ROW LEVEL SECURITY;

-- Public insert (el invitado envía sin autenticarse)
DROP POLICY IF EXISTS "public_insert_menu_selections" ON proposal_menu_selections;
CREATE POLICY "public_insert_menu_selections"
  ON proposal_menu_selections
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- El venue dueño de la propuesta puede leer sus selecciones
DROP POLICY IF EXISTS "owner_select_menu_selections" ON proposal_menu_selections;
CREATE POLICY "owner_select_menu_selections"
  ON proposal_menu_selections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_menu_selections.proposal_id
        AND p.user_id = auth.uid()
    )
  );

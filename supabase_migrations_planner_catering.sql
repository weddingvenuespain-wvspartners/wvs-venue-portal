-- ============================================================
-- WVS — Wedding Planner & Catering Portals Migration
-- Run in: Supabase → SQL Editor → New Query
-- ============================================================

-- ── 1. Leads: add planner_id ─────────────────────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS planner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for planner queries
CREATE INDEX IF NOT EXISTS idx_leads_planner_id ON leads(planner_id);

-- ── 2. wp_clients — parejas del planner ──────────────────────
CREATE TABLE IF NOT EXISTS wp_clients (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  planner_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  email             TEXT,
  phone             TEXT,
  wedding_date      DATE,
  wedding_date_flex BOOLEAN     NOT NULL DEFAULT false,
  guest_count       INTEGER,
  budget            TEXT,
  notes             TEXT,
  slug              TEXT        NOT NULL UNIQUE DEFAULT lower(replace(gen_random_uuid()::text, '-', '')),
  proposal_password TEXT,
  proposal_status   TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (proposal_status IN ('draft','sent','viewed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wp_clients_planner ON wp_clients(planner_id);

-- ── 3. wp_client_venues — venues asignados a una pareja ──────
CREATE TABLE IF NOT EXISTS wp_client_venues (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID        NOT NULL REFERENCES wp_clients(id) ON DELETE CASCADE,
  planner_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id             UUID        REFERENCES leads(id) ON DELETE SET NULL,
  availability_status TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (availability_status IN ('pending','requested','available','unavailable')),
  planner_notes       TEXT,
  venue_response_note TEXT,
  sort_order          INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wp_client_venues_client ON wp_client_venues(client_id);
CREATE INDEX IF NOT EXISTS idx_wp_client_venues_venue  ON wp_client_venues(venue_user_id);

-- ── 4. wp_client_caterings — caterings asignados a una pareja ─
CREATE TABLE IF NOT EXISTS wp_client_caterings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID        NOT NULL REFERENCES wp_clients(id) ON DELETE CASCADE,
  planner_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catering_user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  availability_status TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (availability_status IN ('pending','requested','available','unavailable')),
  planner_notes       TEXT,
  sort_order          INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wp_client_caterings_client ON wp_client_caterings(client_id);

-- ── 5. wp_couple_feedback — lo que la pareja hace en su landing ─
CREATE TABLE IF NOT EXISTS wp_couple_feedback (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID        NOT NULL REFERENCES wp_clients(id) ON DELETE CASCADE,
  venue_user_id   UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  catering_user_id UUID       REFERENCES auth.users(id) ON DELETE CASCADE,
  type            TEXT        NOT NULL CHECK (type IN ('favorite','unfavorite','comment')),
  comment_text    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wp_couple_feedback_client ON wp_couple_feedback(client_id);

-- ── 6. venue_catering_whitelist — caterings permitidos por venue ─
CREATE TABLE IF NOT EXISTS venue_catering_whitelist (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catering_user_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (venue_user_id, catering_user_id)
);

-- ── 7. RLS Policies ──────────────────────────────────────────

-- wp_clients: planners solo ven sus propias parejas
ALTER TABLE wp_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_owns_clients" ON wp_clients
  USING (planner_id = auth.uid());

-- wp_client_venues
ALTER TABLE wp_client_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_owns_client_venues" ON wp_client_venues
  USING (planner_id = auth.uid());

CREATE POLICY "venue_sees_assigned" ON wp_client_venues
  FOR SELECT USING (venue_user_id = auth.uid());

-- wp_client_caterings
ALTER TABLE wp_client_caterings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_owns_client_caterings" ON wp_client_caterings
  USING (planner_id = auth.uid());

-- wp_couple_feedback: público (sin auth) via service role
ALTER TABLE wp_couple_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_insert_feedback" ON wp_couple_feedback
  FOR INSERT WITH CHECK (true);

CREATE POLICY "planner_sees_feedback" ON wp_couple_feedback
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM wp_clients WHERE planner_id = auth.uid()
    )
  );

-- venue_catering_whitelist: venue owner gestiona su propia lista
ALTER TABLE venue_catering_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue_manages_whitelist" ON venue_catering_whitelist
  USING (venue_user_id = auth.uid());

CREATE POLICY "catering_sees_own_whitelist" ON venue_catering_whitelist
  FOR SELECT USING (catering_user_id = auth.uid());

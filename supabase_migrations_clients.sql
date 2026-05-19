-- ============================================================
-- WVS — Clients directory: table + leads FK + data migration
-- Run in: Supabase → SQL Editor → New Query
-- ============================================================

-- 1. Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  email       TEXT,
  phone       TEXT,
  whatsapp    TEXT,
  client_type TEXT NOT NULL DEFAULT 'pareja'
    CHECK (client_type IN ('pareja','wedding_planner','organizador','empresa','cliente','otro')),
  tags        JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes       TEXT NOT NULL DEFAULT '',
  language    TEXT,
  country     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clients_venue_id ON clients(venue_id);
CREATE INDEX IF NOT EXISTS idx_clients_email    ON clients(venue_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_phone    ON clients(venue_id, phone) WHERE phone IS NOT NULL;

-- RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY clients_select ON clients FOR SELECT
  USING (venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid()));

CREATE POLICY clients_insert ON clients FOR INSERT
  WITH CHECK (venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid()));

CREATE POLICY clients_update ON clients FOR UPDATE
  USING (venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid()));

CREATE POLICY clients_delete ON clients FOR DELETE
  USING (venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid()));

-- 2. Add client_id FK to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_leads_client_id ON leads(client_id) WHERE client_id IS NOT NULL;

-- 3. Migrate existing leads → create clients grouped by email/phone
-- Step 3a: Create clients from leads grouped by COALESCE(email, phone)
INSERT INTO clients (venue_id, name, email, phone, whatsapp, language, country, created_at)
SELECT DISTINCT ON (venue_id, COALESCE(NULLIF(email,''), '__no_email__') || '::' || COALESCE(NULLIF(phone,''), '__no_phone__'))
  venue_id,
  name,
  NULLIF(email, ''),
  NULLIF(phone, ''),
  NULLIF(whatsapp, ''),
  language,
  country,
  MIN(created_at) OVER (PARTITION BY venue_id, COALESCE(NULLIF(email,''), '__no_email__') || '::' || COALESCE(NULLIF(phone,''), '__no_phone__'))
FROM leads
WHERE client_id IS NULL
ORDER BY venue_id,
  COALESCE(NULLIF(email,''), '__no_email__') || '::' || COALESCE(NULLIF(phone,''), '__no_phone__'),
  created_at DESC;

-- Step 3b: Link leads to their newly created clients (match by email first, then phone)
UPDATE leads l
SET client_id = c.id
FROM clients c
WHERE l.client_id IS NULL
  AND l.venue_id = c.venue_id
  AND (
    (l.email IS NOT NULL AND l.email != '' AND c.email = l.email)
    OR (l.phone IS NOT NULL AND l.phone != '' AND c.phone = l.phone AND (l.email IS NULL OR l.email = ''))
  );

-- Step 3c: Any remaining leads without a match (edge case) → create individual clients
INSERT INTO clients (venue_id, name, email, phone, whatsapp, language, country, created_at)
SELECT venue_id, name, NULLIF(email,''), NULLIF(phone,''), NULLIF(whatsapp,''), language, country, created_at
FROM leads
WHERE client_id IS NULL;

UPDATE leads l
SET client_id = c.id
FROM clients c
WHERE l.client_id IS NULL
  AND l.venue_id = c.venue_id
  AND l.name = c.name
  AND l.created_at = c.created_at;

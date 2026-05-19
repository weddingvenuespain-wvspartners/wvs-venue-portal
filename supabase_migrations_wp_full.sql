-- ============================================================
-- WVS — Wedding Planner: Full commercial relationship
-- Run in: Supabase → SQL Editor → New Query
-- ============================================================

-- 1. Parent client link (already run if you ran wp_couples migration)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS parent_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_clients_parent ON clients(parent_client_id) WHERE parent_client_id IS NOT NULL;

-- 2. WP agreement fields on clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS wp_commission_percent NUMERIC(5,2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS wp_commission_type TEXT DEFAULT 'percentage';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS wp_agreement_notes TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS wp_agreement_start DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS wp_agreement_end DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS wp_documents JSONB DEFAULT '[]'::jsonb;

-- 3. WP invoices table
CREATE TABLE IF NOT EXISTS wp_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES user_venues(id) ON DELETE CASCADE,
  wp_client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  couple_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  invoice_number TEXT,
  concept TEXT NOT NULL DEFAULT '',
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  date DATE,
  due_date DATE,
  paid_date DATE,
  file_url TEXT,
  file_name TEXT,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wp_invoices_venue ON wp_invoices(venue_id);
CREATE INDEX IF NOT EXISTS idx_wp_invoices_wp ON wp_invoices(wp_client_id);

-- 4. RLS for wp_invoices
ALTER TABLE wp_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view wp_invoices for their venues"
  ON wp_invoices FOR SELECT
  USING (venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert wp_invoices for their venues"
  ON wp_invoices FOR INSERT
  WITH CHECK (venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid()));

CREATE POLICY "Users can update wp_invoices for their venues"
  ON wp_invoices FOR UPDATE
  USING (venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete wp_invoices for their venues"
  ON wp_invoices FOR DELETE
  USING (venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid()));

-- ============================================================
-- WVS — Wedding Planner → Couples relationship
-- Run in: Supabase → SQL Editor → New Query
-- ============================================================

-- Add parent_client_id to link couples to their wedding planner
ALTER TABLE clients ADD COLUMN IF NOT EXISTS parent_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_clients_parent ON clients(parent_client_id) WHERE parent_client_id IS NOT NULL;

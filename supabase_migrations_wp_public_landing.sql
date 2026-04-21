-- ============================================================
-- WVS — Public read access for couple landing page (/para/slug)
-- Run in: Supabase → SQL Editor → New Query
-- ============================================================

-- Allow public (unauthenticated) read of wp_clients by slug
-- Only when the proposal has been sent or viewed
CREATE POLICY "public_read_client_by_slug" ON wp_clients
  FOR SELECT
  USING (proposal_status IN ('sent', 'viewed'));

-- Allow public read of wp_client_venues for those public clients
CREATE POLICY "public_read_client_venues" ON wp_client_venues
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM wp_clients
      WHERE proposal_status IN ('sent', 'viewed')
    )
  );

-- Allow public read of wp_client_caterings for those public clients
CREATE POLICY "public_read_client_caterings" ON wp_client_caterings
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM wp_clients
      WHERE proposal_status IN ('sent', 'viewed')
    )
  );

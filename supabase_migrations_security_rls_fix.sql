-- ============================================================
-- WVS — Security fix: remove over-broad anonymous read policies
-- Run in: Supabase → SQL Editor → New Query
-- Borrar este fichero tras aplicarlo.
-- ============================================================
--
-- Estas políticas daban al rol anónimo (anon key, pública en el bundle del
-- navegador) acceso de lectura a TODOS los wp_clients con proposal_status
-- 'sent'/'viewed' SIN filtrar por slug. Cualquiera con la anon key podía
-- volcar nombre, email, teléfono, presupuesto, fecha de boda y
-- proposal_password de todas las parejas.
--
-- La landing pública (app/for/[slug]/page.tsx) NO las necesita: lee con la
-- service-role key en el servidor filtrando por slug. Por eso se eliminan.

DROP POLICY IF EXISTS "public_read_client_by_slug"   ON wp_clients;
DROP POLICY IF EXISTS "public_read_client_venues"     ON wp_client_venues;
DROP POLICY IF EXISTS "public_read_client_caterings"  ON wp_client_caterings;

-- Verificación: tras ejecutar, estas tablas no deben tener ninguna política
-- cuyo `roles` incluya `anon`. Comprobar con:
--   SELECT tablename, policyname, roles, cmd, qual
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('wp_clients','wp_client_venues','wp_client_caterings');

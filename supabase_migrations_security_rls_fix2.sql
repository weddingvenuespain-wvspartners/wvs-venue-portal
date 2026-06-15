-- ============================================================
-- WVS — Security fix #2: close direct-anon-key holes found in pg_policies
-- Run in: Supabase → SQL Editor → New Query
-- Borrar este fichero tras aplicarlo.
-- Requiere que el código ya use service-role para leer budgets en las páginas
-- públicas (commit de esta misma tanda).
-- ============================================================

-- 1) CRÍTICO — Auto-promoción a admin.
-- "Users can update own profile" es UPDATE con USING (auth.uid()=user_id) y sin
-- WITH CHECK, así que un usuario puede `UPDATE venue_profiles SET role='admin'`
-- con la anon key. Un trigger bloquea que un no-admin cambie columnas
-- privilegiadas. El service role (auth.uid() IS NULL) y los admins sí pueden.
CREATE OR REPLACE FUNCTION prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_admin() AND (
        NEW.role                IS DISTINCT FROM OLD.role
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.trial_end_date      IS DISTINCT FROM OLD.trial_end_date
     OR NEW.features_override   IS DISTINCT FROM OLD.features_override
  ) THEN
    RAISE EXCEPTION 'No autorizado a modificar rol/estado de plan';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON venue_profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
  BEFORE UPDATE ON venue_profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_profile_privilege_escalation();

-- 2) CRÍTICO — La anon key podía leer TODOS los presupuestos (PII + importes).
-- Las páginas/endpoints públicos ya leen budgets con service-role; quitamos el
-- read público abierto.
DROP POLICY IF EXISTS "budgets_public_read" ON budgets;

-- 3) ALTO — La anon key podía leer TODAS las propuestas, incluidos borradores.
-- Queda 'proposals_public_by_slug' (status <> 'draft') para la landing pública.
DROP POLICY IF EXISTS "public_read_proposals" ON proposals;

-- 4) CRÍTICO — proposal_room_selections con write/update/delete = true para anon:
-- cualquiera podía borrar/reescribir las selecciones de cualquier propuesta
-- directamente. Las escrituras legítimas van por la API con service-role.
-- Se conserva room_selections_public_read (lo necesita la landing del dossier).
DROP POLICY IF EXISTS "room_selections_public_write"  ON proposal_room_selections;
DROP POLICY IF EXISTS "room_selections_public_update"  ON proposal_room_selections;
DROP POLICY IF EXISTS "room_selections_public_delete"  ON proposal_room_selections;

-- 5) ALTO — wp_invoices: las 4 políticas usan una subconsulta correlacionada
-- rota: `venue_id IN (SELECT wp_invoices.venue_id FROM user_venues WHERE ...)`.
-- Eso devuelve el venue_id de la propia fila para cualquier usuario con alguna
-- entrada en user_venues => acceso efectivo a TODAS las facturas (cross-tenant).
-- Se recrean apuntando a user_venues.id (la FK real de wp_invoices.venue_id).
DROP POLICY IF EXISTS "Users can view wp_invoices for their venues"   ON wp_invoices;
DROP POLICY IF EXISTS "Users can insert wp_invoices for their venues" ON wp_invoices;
DROP POLICY IF EXISTS "Users can update wp_invoices for their venues" ON wp_invoices;
DROP POLICY IF EXISTS "Users can delete wp_invoices for their venues" ON wp_invoices;

CREATE POLICY "Users can view wp_invoices for their venues" ON wp_invoices FOR SELECT USING (venue_id IN (SELECT id FROM user_venues WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert wp_invoices for their venues" ON wp_invoices FOR INSERT WITH CHECK (venue_id IN (SELECT id FROM user_venues WHERE user_id = auth.uid()));
CREATE POLICY "Users can update wp_invoices for their venues" ON wp_invoices FOR UPDATE USING (venue_id IN (SELECT id FROM user_venues WHERE user_id = auth.uid())) WITH CHECK (venue_id IN (SELECT id FROM user_venues WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete wp_invoices for their venues" ON wp_invoices FOR DELETE USING (venue_id IN (SELECT id FROM user_venues WHERE user_id = auth.uid()));

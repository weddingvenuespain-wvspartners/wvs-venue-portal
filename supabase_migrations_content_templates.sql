-- ── proposal_content_templates ────────────────────────────────────────────
-- Plantillas de contenido reutilizables: cada venue puede tener varias
-- (boda clásica, evento íntimo, corporativo…) con secciones y menús
-- preconfigurados. Al crear una propuesta se puede elegir una plantilla
-- como punto de partida — la propuesta hereda su sections_data pero
-- puede sobreescribir cualquier campo.
-- Run in Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS proposal_content_templates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  description  TEXT,
  sections_data JSONB      NOT NULL DEFAULT '{}'::jsonb,
  is_default   BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proposal_content_templates_user_id_idx
  ON proposal_content_templates(user_id);

ALTER TABLE proposal_content_templates ENABLE ROW LEVEL SECURITY;

-- Solo el owner puede leer/escribir sus plantillas
CREATE POLICY "owner_all_content_templates"
  ON proposal_content_templates
  FOR ALL
  TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Añadir content_template_id a proposals (nullable)
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS content_template_id UUID
    REFERENCES proposal_content_templates(id) ON DELETE SET NULL;

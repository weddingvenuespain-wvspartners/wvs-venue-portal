-- ============================================================
-- WVS — Budget files: soporte para múltiples documentos adjuntos
-- Añade columna JSONB para almacenar varios presupuestos PDF
-- Run in: Supabase → SQL Editor → New Query
-- ============================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS budget_files JSONB DEFAULT NULL;

-- Migración de datos existentes: mover budget_file_url/name a budget_files[]
UPDATE leads
SET budget_files = jsonb_build_array(
      jsonb_build_object('url', budget_file_url, 'name', COALESCE(budget_file_name, 'Documento adjunto'))
    )
WHERE budget_file_url IS NOT NULL
  AND budget_file_url != ''
  AND (budget_files IS NULL OR jsonb_array_length(budget_files) = 0);

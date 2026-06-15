-- ============================================================
-- WVS — Security: DB-backed rate limiting for public password gates
-- Run in: Supabase → SQL Editor → New Query
-- Borrar este fichero tras aplicarlo.
-- ============================================================
--
-- Usada por lib/rate-limit.ts para frenar la fuerza bruta en
-- /api/dossier/unlock y /api/budgets/check-password. Solo la escribe/lee el
-- service role (RLS activado sin políticas => anon/authenticated no acceden).

CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket      text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_bucket_time
  ON rate_limit_attempts (bucket, created_at);

ALTER TABLE rate_limit_attempts ENABLE ROW LEVEL SECURITY;

-- Limpieza opcional de registros antiguos (ejecutar periódicamente o vía cron):
--   DELETE FROM rate_limit_attempts WHERE created_at < now() - interval '1 day';

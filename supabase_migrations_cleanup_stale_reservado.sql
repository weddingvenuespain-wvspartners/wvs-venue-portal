-- ============================================================
-- WVS — Limpieza de calendar_entries 'reservado' obsoletas
-- Libera fechas cuyo lead vinculado ya está en 'lost'
-- Run in: Supabase → SQL Editor → New Query
-- ============================================================

UPDATE calendar_entries ce
SET    status  = 'libre',
       lead_id = NULL,
       note    = NULL
WHERE  ce.status = 'reservado'
  AND  ce.lead_id IS NOT NULL
  AND  EXISTS (
         SELECT 1 FROM leads l
         WHERE  l.id = ce.lead_id
           AND  l.status = 'lost'
       );

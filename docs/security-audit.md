# Auditoría de seguridad — ForEventos / wvs-venue-portal

Fecha: 2026-06-11 · Stack: Next.js 15 (App Router) + Supabase, pagos Redsys + Stripe Connect.

Estado de cada hallazgo: ✅ corregido en código · ⏳ pendiente · 🔎 requiere verificación en Supabase.

> Limitación: las políticas RLS reales no están versionadas en el repo (las
> migraciones se borran tras aplicarse). Los hallazgos marcados 🔎 necesitan
> ejecutar las consultas del final en el proyecto Supabase.

## Críticos

| # | Hallazgo | Estado |
|---|----------|--------|
| 1 | **Activación de plan sin pago** — `redsys/activate-from-success` confiaba en `planId` de `localStorage`. | ✅ Ahora deriva el plan de un intento de pago persistido en servidor (`create-payment`) y en producción exige el `payment_received` firmado del webhook. |
| 2 | **IDOR público en `proposals/[id]/room-selections`** — POST/GET sin auth permitían reescribir selecciones de cualquier propuesta. | ✅ Se valida que la propuesta exista y esté en estado público (`sent/viewed/preview`). |
| 3 | **IDOR en `dossier/inquiries/[id]`** — PATCH/DELETE sin comprobar propiedad. | ✅ Filtrado explícito por `user_id`; 404 si no pertenece al usuario. |
| 4 | **Anon key lee todos los `wp_clients` + contraseñas** — políticas `public_read_*` sin filtrar por slug. | ✅ SQL de corrección en `supabase_migrations_security_rls_fix.sql` — **aplicar en Supabase**. |
| 5 | **Tokens de Google Calendar en claro enviados al navegador** — el cliente seleccionaba `venue_settings.google_calendar` con la anon key. | ✅ El cliente ya no lee tokens; usa `/api/calendar/status` (solo nombre + last_sync). ⏳ Cifrado en reposo pendiente (defensa en profundidad). |
| 6 | **Middleware usaba `getSession()`** (no valida el JWT). | ✅ Cambiado a `getUser()`. |

## Altos

| Hallazgo | Estado |
|----------|--------|
| **Gating de planes solo en cliente** — rutas premium no comprueban el plan en servidor. | ✅ `estructura/*` (37 handlers) con `requireFeature('estructura')`; mutaciones de `proposals/*` (confirm-lodging, room-inventory-limits POST) con `requireFeature('propuestas')`. `export-data` se deja sin gatear a propósito (es exportación de datos personales RGPD, no la feature premium); bajo `budgets/*` las rutas API son solo públicas. |
| **OAuth Google sin protección CSRF** en el `state`. | ✅ Nonce aleatorio en cookie HttpOnly + verificación de sesión (`session.user.id === state.user_id`) en el callback. |
| **Redsys: webhook no valida importe ni es idempotente** — `redsys/notification` y `budget-payment/notification`. | ✅ Ambos comparan `Ds_Amount` con el precio del plan/cuota y deduplican por `order`. |
| **Inyección de leads en cualquier venue** — `wp/request-venue` confía en `venue_user_id` del body. | ✅ Valida que el `client_id` pertenece al planner y que el venue es un `venue_owner` real. |
| **Contraseñas de dossier/presupuesto en texto plano, sin rate-limit** — `dossier/unlock`, `budgets/check-password`. | ✅ Rate-limit por slug+IP (tabla `rate_limit_attempts`), comparación en tiempo constante, y la cookie de unlock ya no guarda la contraseña (token HMAC derivado). ⏳ Hash en reposo pendiente: requiere trigger pgcrypto + dejar de precargar la contraseña en los editores (ProposalEditor / budgets edit). SQL preparado abajo. |
| **Inyección de CSS almacenada en dossiers públicos** — `app/dossier/[slug]/tpl/*` interpola colores/fuentes sin validar. | ✅ Saneado con `safeCssColor`/`safeFontFamily` (lib/utils.ts) en los 6 templates y en ProposalLanding. |
| **`venue_profiles` RLS sin verificar** — riesgo de auto-promoción a admin. | 🔎 Verificar en Supabase que UPDATE no permita cambiar `role`. |
| **Dependencias con CVEs** — `xlsx@0.18.5` (sin fix), `next@15.5.14`. | ⏳ `npm audit fix` para next/dompurify/postcss/ws; migrar `xlsx` a `exceljs` o CDN oficial. |

## Medios (pendientes)

- Fallback de `MERCHANT_CODE` a sandbox si falta la env var (`lib/redsys.ts`).
- `admin/backup`: comparar la API key en tiempo constante.
- Falta CSP en `next.config.js`.
- Inyección de HTML en emails (`lib/mailer.ts`) — escapar valores interpolados.
- `stripDangerousHtml` por regex (evadible) en `apply-changes` → usar DOMPurify server-side.
- Webhook Stripe devuelve 200 ante errores de proceso (se pierden reintentos).
- Políticas RLS sin `WITH CHECK` que permiten reasignar filas a otro tenant.

## Correcto (verificado)

`upload` valida MIME por magic bytes y nombra el fichero server-side; firmas Redsys/Stripe verificadas; importes Stripe recalculados en servidor; IDOR en refund/dashboard-link bloqueado; `estructura/*` filtra por `user_id`; `.env.local` no commiteado; sin secretos en `NEXT_PUBLIC_`; endpoints `/api/admin/*` reverifican rol admin.

## Verificación pendiente en Supabase

```sql
-- ¿Qué tablas tienen RLS activado?
SELECT relname, relrowsecurity FROM pg_class
WHERE relkind='r' AND relnamespace='public'::regnamespace ORDER BY relrowsecurity, relname;

-- Todas las políticas y sus condiciones
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE schemaname='public' ORDER BY tablename;
```

Confirmar especialmente: `proposal_inquiries`, `venue_profiles` (columna `role`),
`leads`, `budgets`, `budget_payments`, `venue_settings` tienen RLS activo y
políticas que filtran por owner.

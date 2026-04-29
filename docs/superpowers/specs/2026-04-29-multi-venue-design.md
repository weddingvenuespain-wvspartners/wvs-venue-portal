# Multi-Venue Account Model — Design Spec
**Date:** 2026-04-29  
**Status:** Approved  

---

## Contexto

Un mismo propietario o empresa puede tener varias fincas (venues). Actualmente el modelo es 1 usuario = 1 venue = 1 suscripción. Este spec define cómo escalar a N venues por cuenta manteniendo datos, suscripciones y acceso completamente separados por venue, con un switcher en el dashboard para cambiar entre ellas.

---

## Decisiones de diseño

| Pregunta | Decisión |
|---|---|
| ¿Precio por venue? | Sí — cada venue tiene su propia suscripción independiente |
| ¿Datos separados por venue? | Sí — leads, propuestas y calendario son per-venue |
| ¿Un plan por venue? | Pueden tener planes distintos, pero lo habitual es el mismo |
| ¿Cómo accede el dueño? | Venue switcher en el sidebar, un único login |
| ¿Cuentas separadas? | No — misma cuenta, N venues |

---

## Sección 1 — Modelo de datos

### `user_venues` (entidad central, ya existe)

Pasa a ser la entidad principal de cada venue. Añadir `is_primary`.

```sql
ALTER TABLE user_venues ADD COLUMN is_primary boolean NOT NULL DEFAULT false;
```

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | Identificador del venue en esta plataforma |
| `user_id` | uuid FK → auth.users | Propietario |
| `wp_venue_id` | int | ID en WordPress |
| `subscription_id` | uuid FK → venue_subscriptions | Suscripción activa (ya existe, sin usar) |
| `is_primary` | bool | Venue que se carga por defecto al login |

### `venue_subscriptions` — añadir `venue_id`

```sql
ALTER TABLE venue_subscriptions ADD COLUMN venue_id uuid REFERENCES user_venues(id);
```

`user_id` se mantiene para no romper queries existentes. La lógica de acceso pasa a chequearse por `venue_id`.

### `leads` — añadir `venue_id`

```sql
ALTER TABLE leads ADD COLUMN venue_id uuid REFERENCES user_venues(id);
```

### `proposals` — añadir `venue_id`

```sql
ALTER TABLE proposals ADD COLUMN venue_id uuid REFERENCES user_venues(id);
-- (o la tabla equivalente que use el sistema de propuestas)
```

### `calendar` / disponibilidad — añadir `venue_id`

```sql
-- Aplicar a la(s) tabla(s) de disponibilidad/bloqueos de calendario
ALTER TABLE <calendar_table> ADD COLUMN venue_id uuid REFERENCES user_venues(id);
```

### `venue_profiles` — sin cambios

Sigue siendo el perfil del usuario (datos personales, rol, estado). No es per-venue.

---

## Sección 2 — Contexto de auth y venue switcher

### `AuthContext` — cambios

```typescript
// Añadir al contexto existente:
activeVenue: UserVenue | null
switchVenue: (venueId: string) => void
```

**Comportamiento al login:**
1. Se carga la lista de `userVenues` del usuario (ya se hace).
2. Se busca el venue con `is_primary = true`. Si no hay ninguno marcado, se usa el primero.
3. `activeVenue` se persiste en `localStorage` con clave `wvs_active_venue_id`.
4. Al refrescar, se restaura desde `localStorage` (validando que el venue siga perteneciendo al usuario).

**`switchVenue(venueId)`:**
- Actualiza `activeVenue` en estado React.
- Escribe en `localStorage`.
- No hace reload de página; los componentes reaccionan al cambio de contexto.

### Venue switcher — Sidebar

- Se muestra debajo del logo / arriba del menú de navegación.
- **1 venue:** texto plano con el nombre de la finca, sin interacción.
- **2+ venues:** dropdown con lista de fincas. La activa aparece marcada con un check. Al seleccionar otra, llama a `switchVenue`.
- Mostrar badge de estado de suscripción por venue en el dropdown (ej. "Trial", "Activo", "Expirado").

### Protección de rutas

Las páginas protegidas (leads, propuestas, calendario, ficha, estadísticas) comprueban:
1. Sesión activa (ya se hace con `useRequireSubscription`).
2. **Nuevo:** `activeVenue?.subscription` tiene plan activo. Si no, redirige a `/pricing?venue=<venue_id>`.

---

## Sección 3 — Suscripciones por venue

### Pricing page

- Si el usuario tiene 2+ venues, la página `/pricing` muestra un selector para elegir a qué venue contratar el plan.
- URL param `?venue=<venue_id>` pre-selecciona el venue.
- El flujo de pago asocia el plan al `venue_id`, no solo al `user_id`.

### Lógica de acceso (`plan-server.ts` y `use-plan-features.ts`)

- `getUserPlan()` pasa a aceptar un `venueId` opcional. Cuando se pasa, chequea la suscripción de ese venue específico.
- `requireFeature(feature, venueId)` chequea contra la suscripción del venue activo.
- Los API routes que reciben datos de un venue deben validar que el venue tiene acceso a esa feature.

### Admin CRM — panel de usuario

- La pestaña "Suscripción" se expande para mostrar **una suscripción por venue**.
- Cada venue tiene su propio bloque: nombre de la finca, estado, plan, fechas, botón "Actualizar suscripción".
- Registrar pago también es por venue.

---

## Sección 4 — Migración de datos existentes

Migración no destructiva en 4 pasos:

### Paso 1 — Columnas nullable
Añadir `venue_id` como nullable a todas las tablas afectadas (sin romper nada).

### Paso 2 — Backfill
Script SQL que rellena `venue_id` en registros existentes:

```sql
-- Para cada tabla, usar el venue primario (o único) del usuario
UPDATE leads l
SET venue_id = uv.id
FROM user_venues uv
WHERE uv.user_id = l.user_id
  AND uv.is_primary = true
  AND l.venue_id IS NULL;

-- Repetir para proposals, calendar, venue_subscriptions
```

### Paso 3 — Marcar venues primarios
```sql
-- Marcar el primer venue de cada usuario como primario
UPDATE user_venues uv
SET is_primary = true
WHERE uv.id IN (
  SELECT DISTINCT ON (user_id) id
  FROM user_venues
  ORDER BY user_id, created_at ASC
);
```

### Paso 4 — NOT NULL (tras validación)
Una vez verificado el backfill, añadir constraint NOT NULL en `venue_id` en las tablas correspondientes.

---

## Sección 5 — Scope de cambios por capa

| Capa | Cambio |
|---|---|
| **DB** | Añadir `venue_id` a `leads`, `proposals`, `calendar`, `venue_subscriptions`. Añadir `is_primary` a `user_venues`. Migración de datos. |
| **API routes** | Filtrar leads, proposals, calendar por `venue_id`. `requireFeature` acepta `venueId`. |
| **Auth context** | `activeVenue`, `switchVenue`, persistencia en localStorage. |
| **Sidebar** | Venue switcher component. |
| **Pricing page** | Selector de venue, asociar pago a venue. |
| **Admin CRM** | Suscripción por venue en panel de usuario. |
| **plan-server.ts** | `getUserPlan(venueId?)`, `requireFeature(feature, venueId?)`. |

---

## Fuera de scope (v1)

- Dashboard unificado multi-venue (ver leads de todas las fincas a la vez)
- Descuentos por volumen de venues
- Transferencia de un venue entre cuentas
- Roles por venue (ej. un empleado solo accede a Finca A)

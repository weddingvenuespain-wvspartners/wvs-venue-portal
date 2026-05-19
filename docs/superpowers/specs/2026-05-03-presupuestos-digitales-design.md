# Presupuestos Digitales — Fase 1 Design Spec

## Goal

New "Presupuestos" section where venues create personalized digital quotes for couples. Hybrid approach: pre-loads from existing venue structure (modalities, packages, prices) and allows free-form line items. Generates a branded, non-indexed page with unique URL. Includes visual payment plan with installment dates. No real payments in Phase 1.

## Architecture

- **Editor page** (`app/budgets/[id]/edit/page.tsx`) — budget builder with line items, payment plan, preview
- **Public page** (`app/presupuesto/[slug]/page.tsx`) — couple-facing branded view with tracking
- **List page** (`app/budgets/page.tsx`) — budget management with filters, actions, payment template tab
- **API routes** — budget CRUD, send, tracking
- **Sidebar** — new "Presupuestos" item below "Dosieres" with `Receipt` icon

## Data Model

### `budgets` table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| user_id | uuid FK | references auth.users |
| venue_id | uuid FK | references venues |
| lead_id | uuid FK nullable | references leads |
| slug | text unique | 10-char random, URL-safe |
| couple_name | text | |
| couple_email | text nullable | |
| wedding_date | date nullable | |
| guest_count | int nullable | |
| status | text | draft, sent, viewed, accepted, expired |
| notes | text nullable | personal message from venue |
| valid_until | date nullable | quote expiry |
| line_items | jsonb | grouped line items (see below) |
| payment_plan | jsonb | array of installments (see below) |
| total_amount | numeric | cached total for queries |
| sent_at | timestamptz nullable | |
| first_viewed_at | timestamptz nullable | |
| last_viewed_at | timestamptz nullable | |
| open_count | int default 0 | |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | |

RLS: user_id = auth.uid() for all operations. Public read via slug (no auth) for the couple-facing page.

### `budget_payment_templates` table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| user_id | uuid FK | references auth.users |
| venue_id | uuid FK | references venues |
| name | text | e.g. "Estándar 3 cuotas" |
| is_default | boolean default false | |
| installments | jsonb | array of installment rules |
| created_at | timestamptz default now() | |

### line_items JSONB structure

```json
{
  "groups": [
    {
      "id": "g1",
      "name": "Espacio y catering",
      "items": [
        { "id": "i1", "concept": "Alquiler finca", "qty": 1, "unit_price": 8000, "subtotal": 8000 },
        { "id": "i2", "concept": "Menú adulto", "qty": 120, "unit_price": 95, "subtotal": 11400 },
        { "id": "i3", "concept": "Menú infantil", "qty": 15, "unit_price": 45, "subtotal": 675 }
      ]
    },
    {
      "id": "g2",
      "name": "Extras",
      "items": [
        { "id": "i4", "concept": "Barra libre premium", "qty": 135, "unit_price": 25, "subtotal": 3375 }
      ]
    }
  ],
  "discount": { "type": "fixed", "amount": 500, "label": "Descuento reserva anticipada" },
  "tax_rate": 21,
  "tax_included": true,
  "notes_footer": "IVA incluido en todos los precios"
}
```

Each group and item has a stable `id` (nanoid) for React keys and reordering.

### payment_plan JSONB structure (on budget)

```json
[
  { "label": "Depósito", "amount": 7035, "due_date": "2026-01-15", "status": "pending" },
  { "label": "2ª cuota", "amount": 9380, "due_date": "2026-02-15", "status": "pending" },
  { "label": "Pago final", "amount": 7035, "due_date": "2026-04-15", "status": "pending" }
]
```

Status values: `pending` | `paid` (manually marked by venue in Phase 1).

### installments JSONB structure (on payment template)

```json
[
  { "label": "Depósito", "percent": 30, "due_rule": "on_confirmation" },
  { "label": "2ª cuota", "percent": 40, "due_rule": "months_before", "months": 3 },
  { "label": "Pago final", "percent": 30, "due_rule": "months_before", "months": 1 }
]
```

`due_rule` values:
- `on_confirmation` — due immediately / on acceptance
- `months_before` — N months before wedding_date
- `days_before` — N days before wedding_date
- `fixed_date` — specific date (stored in `fixed_date` field)

## Editor Page (`app/budgets/[id]/edit/page.tsx`)

### Layout

Top bar with: couple name, status badge, "Guardar" + "Vista previa" + "Enviar" buttons.

Below, vertical sections:

1. **Datos de la pareja** — couple_name, couple_email, wedding_date, guest_count. Pre-filled from lead if linked.

2. **Líneas del presupuesto** — grouped line items
   - Each group: header with editable name, drag handle for reorder
   - Each item: concept (text), qty (number), unit price (number), subtotal (auto-calculated)
   - "+ Añadir concepto" button per group
   - "+ Añadir grupo" button
   - "Importar desde mis paquetes" button — opens modal listing venue_modalities → packages → prices; selecting one populates a group with its items
   - Delete group / delete item buttons

3. **Descuento** — optional toggle. Type: fixed € or %. Label editable.

4. **IVA** — toggle on/off, rate editable (default 21%), "IVA incluido" checkbox.

5. **Total** — auto-calculated: sum of all subtotals − discount + tax (if not included).

6. **Plan de pagos** — loads default payment template. Shows installments with:
   - Label (editable)
   - Amount (auto-calculated from percent × total, editable for override)
   - Due date (auto-calculated from due_rule + wedding_date, editable)
   - Sum validation: installments must equal total (warning if mismatch)
   - "+ Añadir cuota" / delete cuota
   - Dropdown to switch payment template

7. **Mensaje personalizado** — textarea for venue note shown at top of public page.

8. **Validez** — date picker for quote expiry.

### Import from structure

Modal flow:
1. Lists venue modalities (from `venue_modalities` table)
2. User picks one → shows its packages with prices
3. User selects package → items are added as a new group in the budget
4. Menu items from `proposal_menus` or pricing data also importable

If no structure configured, this button is disabled with tooltip "Configura tus paquetes en Estructura".

### Auto-save

Debounced save (1.5s after last edit) while in draft status. Same pattern as proposal editor.

## Public Page (`app/presupuesto/[slug]/page.tsx`)

### Meta tags

```html
<meta name="robots" content="noindex, nofollow" />
```

### Layout

Clean, single-column, mobile-responsive.

1. **Header** — venue logo (from venue branding), venue name, primary color accent
2. **Couple info** — "Presupuesto para [couple_name]", wedding date, guest count
3. **Personal message** — if `notes` exists, shown in a styled quote block
4. **Validity** — "Válido hasta [date]" with warning styling if near expiry or expired
5. **Line items table** — grouped, with subtotals per group
   - Columns: Concepto | Cantidad | Precio/ud | Subtotal
   - Group headers as section dividers
6. **Discount row** — if applicable
7. **Tax row** — if applicable
8. **Total** — large, prominent, with primary color background
9. **Payment plan** — timeline/card layout:
   - Each installment: label, amount, due date
   - Visual indicator: upcoming / overdue / paid
   - "Próximo pago" highlighted
10. **Footer** — "Creado con Wedding Venues Spain" + link

### Tracking

On page load, increment `open_count`. Set `first_viewed_at` on first visit, update `last_viewed_at` on every visit. Update `status` from `sent` → `viewed` on first open. Uses a server action or API route (not client-side update to avoid RLS issues).

### Expired state

If `valid_until` < today and status is not `accepted`:
- Show "Este presupuesto ha expirado" banner
- Content still visible but grayed out
- Auto-set status to `expired` on view

## List Page (`app/budgets/page.tsx`)

### Tabs

1. **Presupuestos** — main list
2. **Plantillas de pago** — manage payment templates

### Presupuestos tab

Table/card list with columns:
- Pareja (couple_name)
- Fecha boda
- Total (formatted €)
- Estado (badge: draft=gray, sent=blue, viewed=gold, accepted=green, expired=red)
- Visto (open_count or "—")
- Enviado (relative date or "—")
- Actions: edit, send, duplicate, delete

Filters: status dropdown, search by couple name.

"+ Nuevo presupuesto" button → creates draft, redirects to editor.

Quick-create from lead: "Crear presupuesto" button on lead cards/detail → creates budget pre-filled with lead data, redirects to editor.

### Plantillas de pago tab

List of payment templates. Each shows:
- Name
- Installments summary (e.g., "3 cuotas: 30% / 40% / 30%")
- Default badge
- Edit / delete / set as default

Inline editor or modal for creating/editing templates.

## Sidebar Integration

New item in `components/Sidebar.tsx`:
- Label: "Presupuestos"
- Icon: `Receipt` from lucide-react
- Position: below "Dosieres", above "Comunicación"
- Feature-gated: `features.presupuestos`

## Feature Gate

Add `presupuestos: boolean` to `usePlanFeatures()`. Gated to premium plan, same as dosieres.

## Slug Generation

Same pattern as proposals: 10-char alphanumeric random string. Collision check on insert (retry once if duplicate).

```ts
function generateBudgetSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let slug = ''
  for (let i = 0; i < 10; i++) slug += chars[Math.floor(Math.random() * chars.length)]
  return slug
}
```

## API Routes

### `app/api/budgets/track/route.ts`
POST with `{ slug }`. Increments open_count, sets viewed timestamps, updates status. No auth required (public page calls this).

### `app/api/budgets/send/route.ts`
POST with `{ budget_id, method }`. Updates `sent_at`, sets status to `sent`. Returns share URL.

## Send Flow

Same pattern as dossier send: modal with lead selector, WhatsApp link, email link, copy URL button.

URL format: `https://[domain]/presupuesto/[slug]`

## Files to Create

- `app/budgets/page.tsx` — list + payment templates tabs
- `app/budgets/new/page.tsx` — create draft + redirect to editor
- `app/budgets/[id]/edit/page.tsx` — budget editor
- `app/presupuesto/[slug]/page.tsx` — public couple-facing page
- `app/api/budgets/track/route.ts` — view tracking
- `app/api/budgets/send/route.ts` — send status update
- Modify: `components/Sidebar.tsx` — add Presupuestos item
- Modify: `lib/use-plan-features.ts` — add presupuestos flag
- Modify: `app/leads/page.tsx` — add "Crear presupuesto" action button
- Supabase migration: create `budgets` and `budget_payment_templates` tables + RLS

## Out of Scope (Phase 2+)

- Stripe Connect integration
- Real payment processing
- Split payments across multiple payers
- Automated payment reminders (email/WhatsApp)
- PDF export/download
- Budget versioning / revision history
- Couple acceptance flow (digital signature)

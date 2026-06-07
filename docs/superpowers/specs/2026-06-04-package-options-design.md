# Package Option Groups — Selección de opciones en paquetes

## Goal

Allow venues to define structured option groups within packages (e.g., "Choose 3 starters from these 6") with fixed included items, selectable choices, and optional per-item supplements. Couples interact with these options in the dossier visual, and the total price updates in real time.

## Problem

Current packages only have: name, price, guest range, `includes TEXT[]` (plain text), `linked_menu_ids`. There's no way to define selectable choices within a package — a core feature for wedding/event venues where couples pick from menus, drink packages, etc.

## Architecture

### Data Model — 2 new tables

```
package_option_groups
├── id              UUID PK
├── package_id      UUID FK → venue_modality_packages.id ON DELETE CASCADE
├── user_id         UUID FK → auth.users
├── venue_id        UUID FK → venues (nullable)
├── name            TEXT NOT NULL          -- "Entrantes", "Principal", "Barra libre"
├── min_selections  INT NOT NULL DEFAULT 1 -- min items couple must pick
├── max_selections  INT NOT NULL DEFAULT 1 -- max items couple can pick (min=max → exact)
├── source_type     TEXT NOT NULL DEFAULT 'manual'  -- 'manual' | 'menu_section'
├── source_menu_id  UUID nullable          -- FK when source_type='menu_section'
├── source_section  TEXT nullable           -- section name within menu (e.g., "Entrantes")
├── sort_order      INT DEFAULT 0
├── created_at      TIMESTAMPTZ DEFAULT now()

package_option_items
├── id                UUID PK
├── group_id          UUID FK → package_option_groups.id ON DELETE CASCADE
├── user_id           UUID FK → auth.users
├── name              TEXT NOT NULL          -- "Ensalada César", "Tartar de atún"
├── description       TEXT nullable          -- optional detail
├── supplement_price  NUMERIC(10,2) nullable -- null = no supplement, >0 = extra €/pers
├── is_default        BOOLEAN DEFAULT false  -- pre-selected when couple opens dossier
├── sort_order        INT DEFAULT 0
├── created_at        TIMESTAMPTZ DEFAULT now()
```

**Key constraints:**
- `min_selections <= max_selections` (enforced by CHECK)
- `source_menu_id` required when `source_type = 'menu_section'`
- CASCADE delete: package deleted → groups deleted → items deleted
- RLS: `user_id = auth.uid()` on both tables

### Relationship diagram

```
venue_modality_packages (existing)
  └── package_option_groups (NEW)
        └── package_option_items (NEW)
```

### Source types

**`manual`** — venue types items directly in the UI. Most flexible, no dependency on menus.

**`menu_section`** — items are synced/imported from an existing menu section. When venue picks this source:
1. UI shows dropdown of available menus + sections
2. Items are **copied** (not linked) into `package_option_items` at creation time
3. After import, items are independent — editing menu doesn't change package options
4. Venue can add/remove/edit imported items after import

Why copy-not-link: menus change often (seasonal updates). Package options for a specific lead/event should stay stable. Importing creates a snapshot.

## Venue Configuration UI (venue-settings)

### Location

Configuración Comercial → Modality → Package → (existing form expands)

### Current package form fields (unchanged)
- Name, Description, Min/Max guests, Linked menus, Includes (text list)

### New section: "Opciones del paquete"

Added below existing fields in the named package edit/add form:

```
────────────────────────────────────────────
Opciones del paquete
────────────────────────────────────────────

[+ Añadir grupo de opciones]

┌─ Grupo: Entrantes ──────────── [✏️] [🗑️]
│  Regla: Escoge exactamente 3
│  Origen: Manual
│  Items:
│  • Ensalada César
│  • Tartar de atún (+3,00€/pers)
│  • Croquetas caseras
│  • Gazpacho andaluz
│  • Carpaccio de ternera
│  • Bruschetta de tomate
│  [+ Añadir item]
└──────────────────────────────────────────

┌─ Grupo: Principal ──────────── [✏️] [🗑️]
│  Regla: Escoge 1
│  Origen: Importado de "Menú Verano 2026" → Principales
│  Items:
│  • Solomillo al Pedro Ximénez
│  • Lubina a la espalda (+5,00€/pers)
│  • Cordero lechal
│  [+ Añadir item]
└──────────────────────────────────────────
```

### Add group modal/inline form

Fields:
- **Nombre** (text) — "Entrantes", "Principal", "Bebidas"
- **Mínimo selecciones** (number, default 1)
- **Máximo selecciones** (number, default 1)
- **Origen** (radio): "Manual" | "Importar de menú"
  - If "Importar de menú": dropdown select menu → dropdown select section → import items

### Add/edit item inline

Fields:
- **Nombre** (text) — "Ensalada César"
- **Descripción** (text, optional) — brief detail
- **Suplemento €/pers** (number, optional) — blank = included in base price
- **Preseleccionado** (checkbox) — default selection for couple

## Dossier Visual (WeddingProposal)

### Package card/table display

When a package has option groups, they render below the package info:

```
┌─────────────────────────────────────────┐
│  PAQUETE GOLD           150€/pers       │
│  80-150 invitados                       │
│                                         │
│  Incluye: Cóctel · DJ 3h · Tarta       │
│                                         │
│  ─── Entrantes (escoge 3) ───           │
│  ☑ Ensalada César                       │
│  ☑ Croquetas caseras                    │
│  ☑ Gazpacho andaluz                     │
│  ☐ Tartar de atún (+3€/pers)           │
│  ☐ Carpaccio                            │
│  ☐ Bruschetta                           │
│                                         │
│  ─── Principal (escoge 1) ───           │
│  ☐ Solomillo al Pedro Ximénez          │
│  ☑ Lubina a la espalda (+5€/pers)      │
│                                         │
│  ─────────────────────────────────       │
│  Base: 150€/pers                        │
│  Suplementos: +5€/pers                  │
│  Total: 155€/pers × 80 inv = 12.400€   │
└─────────────────────────────────────────┘
```

### Interaction rules

1. Checkboxes respect min/max selections per group
2. When min=max (e.g., "escoge exactamente 3"), disable further checks after max reached, show "(3/3 seleccionados)"
3. When min<max (e.g., "escoge entre 1 y 3"), show "(1/3 seleccionados)" counter
4. Items with `is_default: true` start checked
5. Supplement prices add to base package price per person
6. Total recalculates in real time: `(base_price + sum_supplements) × guests`
7. Validation: couple can't confirm/proceed without meeting min selections per group

### State management

Selections stored in WeddingProposal component state:

```typescript
type PackageSelections = Record<string, {           // keyed by package_id
  groups: Record<string, string[]>                   // keyed by group_id → item_ids[]
}>
const [packageSelections, setPackageSelections] = useState<PackageSelections>({})
```

Supplement calculation:

```typescript
function calcSupplements(packageId: string, groups: PackageOptionGroup[]): number {
  const sel = packageSelections[packageId]?.groups ?? {}
  let total = 0
  for (const group of groups) {
    for (const item of group.items) {
      if (sel[group.id]?.includes(item.id) && item.supplement_price) {
        total += item.supplement_price
      }
    }
  }
  return total  // €/person
}
```

## Data Flow

### Venue settings → DB

1. Venue adds/edits option group → `POST/PATCH /api/estructura/packages/[id]/option-groups`
2. Venue adds/edits items → `POST/PATCH /api/estructura/option-groups/[id]/items`
3. Import from menu → `POST /api/estructura/option-groups/[id]/import-from-menu` (copies items)

### DB → Dossier visual

1. Dossier page fetches packages with nested groups + items:
   ```
   venue_modality_packages(
     *, 
     prices:venue_modality_prices(*),
     option_groups:package_option_groups(
       *,
       items:package_option_items(*)
     )
   )
   ```
2. `extractData()` in shared.tsx adds `option_groups` to each package in `packagesShow`
3. Templates render option groups when present

### Template preview (TemplateEditor)

1. `buildPatch()` includes option groups data from modalities fetch
2. postMessage sends to iframe
3. ProposalLanding receives and merges

## API Endpoints (new)

### Option Groups CRUD

```
GET    /api/estructura/packages/[id]/option-groups
POST   /api/estructura/packages/[id]/option-groups
PATCH  /api/estructura/option-groups/[id]
DELETE /api/estructura/option-groups/[id]
```

### Option Items CRUD

```
GET    /api/estructura/option-groups/[id]/items
POST   /api/estructura/option-groups/[id]/items
PATCH  /api/estructura/option-items/[id]
DELETE /api/estructura/option-items/[id]
```

### Import from menu

```
POST   /api/estructura/option-groups/[id]/import-from-menu
Body:  { menu_id: string, section_name: string }
```

Copies all items from that menu section into option items for the group.

## Migration SQL

```sql
-- Option groups within packages
CREATE TABLE package_option_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id      UUID NOT NULL REFERENCES venue_modality_packages(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  venue_id        UUID REFERENCES venues(id),
  name            TEXT NOT NULL,
  min_selections  INT NOT NULL DEFAULT 1,
  max_selections  INT NOT NULL DEFAULT 1,
  source_type     TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'menu_section')),
  source_menu_id  UUID,
  source_section  TEXT,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_selections CHECK (min_selections >= 0 AND max_selections >= min_selections),
  CONSTRAINT source_menu_required CHECK (
    source_type != 'menu_section' OR (source_menu_id IS NOT NULL AND source_section IS NOT NULL)
  )
);

-- Individual items within option groups
CREATE TABLE package_option_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id          UUID NOT NULL REFERENCES package_option_groups(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id),
  name              TEXT NOT NULL,
  description       TEXT,
  supplement_price  NUMERIC(10,2),
  is_default        BOOLEAN DEFAULT false,
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_option_groups_package ON package_option_groups(package_id);
CREATE INDEX idx_option_groups_user    ON package_option_groups(user_id);
CREATE INDEX idx_option_items_group    ON package_option_items(group_id);
CREATE INDEX idx_option_items_user     ON package_option_items(user_id);

-- RLS
ALTER TABLE package_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_option_items  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own option groups" ON package_option_groups
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users manage own option items" ON package_option_items
  FOR ALL USING (user_id = auth.uid());
```

## Files affected

### New files
- `app/api/estructura/packages/[id]/option-groups/route.ts` — CRUD for groups
- `app/api/estructura/option-groups/[id]/route.ts` — PATCH/DELETE single group
- `app/api/estructura/option-groups/[id]/items/route.ts` — CRUD for items
- `app/api/estructura/option-items/[id]/route.ts` — PATCH/DELETE single item
- `app/api/estructura/option-groups/[id]/import-from-menu/route.ts` — import items from menu section

### Modified files
- `app/venue-settings/page.tsx` — option groups UI in package form
- `app/dossier/[slug]/tpl/shared.tsx` — `extractData` includes option_groups in packagesShow
- `app/dossier/[slug]/tpl/WeddingProposal.tsx` — interactive option selection + supplement calc
- `app/dossier/[slug]/tpl/T1Impacto.tsx` — render option groups in package cards
- `app/dossier/[slug]/tpl/T2Emocion.tsx` — render option groups in package cards
- `app/dossier/[slug]/tpl/T5Minimalista.tsx` — render option groups in package cards
- `app/dossier/[slug]/tpl/T6Alojamiento.tsx` — render option groups in package cards
- `app/dossier/[slug]/page.tsx` — fetch includes option_groups nested query
- `app/dossier/templates/[id]/preview/page.tsx` — same nested fetch for preview
- `components/TemplateEditor.tsx` — show option groups in pricing panel preview

## Out of scope

- Saving couple selections to DB (future: when lead management tracks chosen options)
- PDF export with selections
- Option groups on modalities without packages (modality-level groups)
- Drag-and-drop reordering of items/groups (use sort_order manually for now)
- Option images/photos

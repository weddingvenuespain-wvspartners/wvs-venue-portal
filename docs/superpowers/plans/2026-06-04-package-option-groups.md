# Package Option Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured option groups to packages so venues can define "choose X from Y" selections with supplements, and couples interact with them in the dossier visual.

**Architecture:** Two new DB tables (`package_option_groups`, `package_option_items`) with CASCADE from existing `venue_modality_packages`. CRUD API routes follow existing patterns in `app/api/estructura/`. Venue configures in `venue-settings`, data flows through `extractData()` in `shared.tsx`, templates render option groups inside PricingCards. Import-from-menu copies menu course items as a snapshot.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL + RLS), React (inline styles matching existing patterns), TypeScript

---

## File Structure

### New files
| File | Responsibility |
|------|----------------|
| `app/api/estructura/packages/[id]/option-groups/route.ts` | GET + POST option groups for a package |
| `app/api/estructura/option-groups/[id]/route.ts` | PATCH + DELETE a single option group |
| `app/api/estructura/option-groups/[id]/items/route.ts` | GET + POST items for an option group |
| `app/api/estructura/option-items/[id]/route.ts` | PATCH + DELETE a single option item |
| `app/api/estructura/option-groups/[id]/import-from-menu/route.ts` | POST to import items from a menu course |

### Modified files
| File | What changes |
|------|-------------|
| `app/venue-settings/page.tsx` (~3981 lines) | Add `ModalityPackage.option_groups` type, option group CRUD state + handlers, UI section in named pkg edit/add forms |
| `app/dossier/[slug]/tpl/shared.tsx` (~1710 lines) | Extend `PackageItem` type with `option_groups`, pass through in `extractData()` |
| `app/dossier/[slug]/tpl/shared.tsx` | New `PackageOptionSelector` component for interactive checkboxes with min/max/supplement logic |
| `app/dossier/[slug]/tpl/T1Impacto.tsx` | Pass `option_groups` through PricingCards usage, render `PackageOptionSelector` below selected package |
| `app/dossier/[slug]/tpl/T2Emocion.tsx` | Same as T1 |
| `app/dossier/[slug]/tpl/T5Minimalista.tsx` | Same as T1 |
| `app/dossier/[slug]/page.tsx` | Extend Supabase nested select to include `option_groups:package_option_groups(*, items:package_option_items(*))` |
| `app/dossier/templates/[id]/preview/page.tsx` | Same nested select extension |

---

### Task 1: SQL Migration — Create tables

**Files:**
- SQL to run in Supabase dashboard (no file created)

- [ ] **Step 1: Run migration SQL in Supabase**

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

CREATE INDEX idx_option_groups_package ON package_option_groups(package_id);
CREATE INDEX idx_option_groups_user    ON package_option_groups(user_id);
CREATE INDEX idx_option_items_group    ON package_option_items(group_id);
CREATE INDEX idx_option_items_user     ON package_option_items(user_id);

ALTER TABLE package_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_option_items  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own option groups" ON package_option_groups
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users manage own option items" ON package_option_items
  FOR ALL USING (user_id = auth.uid());
```

- [ ] **Step 2: Verify tables exist**

Run in Supabase SQL editor:
```sql
SELECT table_name FROM information_schema.tables WHERE table_name IN ('package_option_groups', 'package_option_items');
```
Expected: 2 rows returned.

- [ ] **Step 3: Commit** (nothing to commit — SQL was run in Supabase directly)

---

### Task 2: API — Option Groups CRUD

**Files:**
- Create: `app/api/estructura/packages/[id]/option-groups/route.ts`
- Create: `app/api/estructura/option-groups/[id]/route.ts`

- [ ] **Step 1: Create option groups GET + POST route**

Create `app/api/estructura/packages/[id]/option-groups/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// GET  /api/estructura/packages/[id]/option-groups — list groups for a package
// POST /api/estructura/packages/[id]/option-groups — create a group

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('package_option_groups')
      .select('*, items:package_option_items(*)')
      .eq('package_id', id)
      .eq('user_id', session.user.id)
      .order('sort_order')

    if (error) {
      console.error('[option-groups GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ groups: data ?? [] })
  } catch (err: any) {
    console.error('[option-groups GET]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { name, min_selections, max_selections, source_type, source_menu_id, source_section, sort_order, venue_id } = body

    if (!name?.trim()) return NextResponse.json({ error: 'Nombre obligatorio' }, { status: 400 })

    const minSel = min_selections ?? 1
    const maxSel = max_selections ?? 1
    if (minSel < 0 || maxSel < minSel) return NextResponse.json({ error: 'Selecciones inválidas' }, { status: 400 })

    const svc = getServiceClient()

    // Verify package belongs to user
    const { data: pkg } = await svc
      .from('venue_modality_packages')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (!pkg) return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 })

    const { data, error } = await svc
      .from('package_option_groups')
      .insert({
        package_id:     id,
        user_id:        session.user.id,
        venue_id:       venue_id ?? null,
        name:           name.trim(),
        min_selections: minSel,
        max_selections: maxSel,
        source_type:    source_type ?? 'manual',
        source_menu_id: source_menu_id ?? null,
        source_section: source_section ?? null,
        sort_order:     sort_order ?? 0,
      })
      .select()
      .single()

    if (error) {
      console.error('[option-groups POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ group: { ...data, items: [] } })
  } catch (err: any) {
    console.error('[option-groups POST]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create option group PATCH + DELETE route**

Create `app/api/estructura/option-groups/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// PATCH  /api/estructura/option-groups/[id] — update a group
// DELETE /api/estructura/option-groups/[id] — delete a group (cascade deletes items)

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { name, min_selections, max_selections, source_type, source_menu_id, source_section, sort_order } = body

    const update: Record<string, any> = {}
    if (name           !== undefined) update.name           = name?.trim() || null
    if (min_selections !== undefined) update.min_selections = min_selections
    if (max_selections !== undefined) update.max_selections = max_selections
    if (source_type    !== undefined) update.source_type    = source_type
    if (source_menu_id !== undefined) update.source_menu_id = source_menu_id
    if (source_section !== undefined) update.source_section = source_section
    if (sort_order     !== undefined) update.sort_order     = sort_order

    if (Object.keys(update).length === 0)
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('package_option_groups')
      .update(update)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('[option-groups PATCH]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ group: data })
  } catch (err: any) {
    console.error('[option-groups PATCH]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const svc = getServiceClient()
    const { error } = await svc
      .from('package_option_groups')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('[option-groups DELETE]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[option-groups DELETE]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify build**

Run: `npx next build --no-lint 2>&1 | head -20`
Expected: No errors related to new route files.

- [ ] **Step 4: Commit**

```bash
git add app/api/estructura/packages/[id]/option-groups/route.ts app/api/estructura/option-groups/[id]/route.ts
git commit -m "feat: add API CRUD for package option groups

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: API — Option Items CRUD

**Files:**
- Create: `app/api/estructura/option-groups/[id]/items/route.ts`
- Create: `app/api/estructura/option-items/[id]/route.ts`

- [ ] **Step 1: Create option items GET + POST route**

Create `app/api/estructura/option-groups/[id]/items/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// GET  /api/estructura/option-groups/[id]/items — list items for a group
// POST /api/estructura/option-groups/[id]/items — create an item

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('package_option_items')
      .select('*')
      .eq('group_id', id)
      .eq('user_id', session.user.id)
      .order('sort_order')

    if (error) {
      console.error('[option-items GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ items: data ?? [] })
  } catch (err: any) {
    console.error('[option-items GET]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { name, description, supplement_price, is_default, sort_order } = body

    if (!name?.trim()) return NextResponse.json({ error: 'Nombre obligatorio' }, { status: 400 })

    const svc = getServiceClient()

    // Verify group belongs to user
    const { data: group } = await svc
      .from('package_option_groups')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })

    const { data, error } = await svc
      .from('package_option_items')
      .insert({
        group_id:         id,
        user_id:          session.user.id,
        name:             name.trim(),
        description:      description?.trim() || null,
        supplement_price: supplement_price != null ? parseFloat(supplement_price) : null,
        is_default:       is_default ?? false,
        sort_order:       sort_order ?? 0,
      })
      .select()
      .single()

    if (error) {
      console.error('[option-items POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ item: data })
  } catch (err: any) {
    console.error('[option-items POST]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create option item PATCH + DELETE route**

Create `app/api/estructura/option-items/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// PATCH  /api/estructura/option-items/[id] — update an item
// DELETE /api/estructura/option-items/[id] — delete an item

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { name, description, supplement_price, is_default, sort_order } = body

    const update: Record<string, any> = {}
    if (name             !== undefined) update.name             = name?.trim() || null
    if (description      !== undefined) update.description      = description?.trim() || null
    if (supplement_price !== undefined) update.supplement_price = supplement_price != null ? parseFloat(supplement_price) : null
    if (is_default       !== undefined) update.is_default       = is_default
    if (sort_order       !== undefined) update.sort_order       = sort_order

    if (Object.keys(update).length === 0)
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('package_option_items')
      .update(update)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('[option-items PATCH]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ item: data })
  } catch (err: any) {
    console.error('[option-items PATCH]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const svc = getServiceClient()
    const { error } = await svc
      .from('package_option_items')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('[option-items DELETE]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[option-items DELETE]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/estructura/option-groups/[id]/items/route.ts app/api/estructura/option-items/[id]/route.ts
git commit -m "feat: add API CRUD for package option items

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: API — Import from menu

**Files:**
- Create: `app/api/estructura/option-groups/[id]/import-from-menu/route.ts`

- [ ] **Step 1: Create import endpoint**

Create `app/api/estructura/option-groups/[id]/import-from-menu/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// POST /api/estructura/option-groups/[id]/import-from-menu
// Body: { menu_id: string, course_label: string }
// Copies items from a menu course into option items for this group (snapshot, not linked)

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { menu_id, course_label } = body

    if (!menu_id || !course_label) return NextResponse.json({ error: 'menu_id y course_label obligatorios' }, { status: 400 })

    const svc = getServiceClient()

    // Verify group belongs to user
    const { data: group } = await svc
      .from('package_option_groups')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })

    // Fetch menu data from templates — menus are stored in sections_data.menus_override
    const { data: templates } = await svc
      .from('dossier_templates')
      .select('sections_data')
      .eq('user_id', session.user.id)

    if (!templates) return NextResponse.json({ error: 'No se encontraron plantillas' }, { status: 404 })

    // Find the menu by ID across all templates
    let targetMenu: any = null
    for (const tpl of templates) {
      const menus: any[] = (tpl.sections_data as any)?.menus_override ?? []
      const found = menus.find((m: any) => m.id === menu_id)
      if (found) { targetMenu = found; break }
    }

    if (!targetMenu) return NextResponse.json({ error: 'Menú no encontrado' }, { status: 404 })

    // Find the course by label
    const courses: any[] = targetMenu.courses ?? []
    const targetCourse = courses.find((c: any) => c.label === course_label)

    if (!targetCourse) return NextResponse.json({ error: `Sección "${course_label}" no encontrada en el menú` }, { status: 404 })

    const items: any[] = targetCourse.items ?? []
    if (items.length === 0) return NextResponse.json({ error: 'La sección del menú no tiene items' }, { status: 400 })

    // Get current max sort_order for existing items in this group
    const { data: existingItems } = await svc
      .from('package_option_items')
      .select('sort_order')
      .eq('group_id', id)
      .order('sort_order', { ascending: false })
      .limit(1)

    const startOrder = (existingItems?.[0]?.sort_order ?? -1) + 1

    // Insert all menu items as option items (snapshot copy)
    const inserts = items.map((item: any, idx: number) => ({
      group_id:         id,
      user_id:          session.user.id,
      name:             item.name?.trim() || 'Sin nombre',
      description:      item.description?.trim() || null,
      supplement_price: item.extra_price ? parseFloat(item.extra_price.replace(/[^\d.,]/g, '').replace(',', '.')) || null : null,
      is_default:       false,
      sort_order:       startOrder + idx,
    }))

    const { data: inserted, error } = await svc
      .from('package_option_items')
      .insert(inserts)
      .select()

    if (error) {
      console.error('[import-from-menu POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update group source metadata
    await svc
      .from('package_option_groups')
      .update({
        source_type:    'menu_section',
        source_menu_id: menu_id,
        source_section: course_label,
      })
      .eq('id', id)
      .eq('user_id', session.user.id)

    return NextResponse.json({ items: inserted ?? [], count: inserted?.length ?? 0 })
  } catch (err: any) {
    console.error('[import-from-menu POST]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/estructura/option-groups/[id]/import-from-menu/route.ts
git commit -m "feat: add import-from-menu endpoint for option groups

Copies items from a menu course section into option items (snapshot).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Venue Settings — Types + State + Handlers

**Files:**
- Modify: `app/venue-settings/page.tsx`

This task adds the TypeScript types, state variables, and CRUD handler functions for option groups/items. No UI yet — that's the next task.

- [ ] **Step 1: Extend ModalityPackage type to include option_groups**

In `app/venue-settings/page.tsx`, find the `ModalityPackage` type at line ~75:

```typescript
type ModalityPackage = {
  id: string; modality_id: string
  day_from: number | null; day_to: number | null; label: string | null; sort_order: number
  name: string | null; description: string | null
  includes: string[] | null; min_guests: number | null; max_guests: number | null
  linked_menu_ids: string[] | null
  prices: ModalityPrice[]
}
```

Replace with:

```typescript
type OptionItem = {
  id: string; group_id: string; name: string; description: string | null
  supplement_price: number | null; is_default: boolean; sort_order: number
}

type OptionGroup = {
  id: string; package_id: string; name: string
  min_selections: number; max_selections: number
  source_type: 'manual' | 'menu_section'
  source_menu_id: string | null; source_section: string | null
  sort_order: number; items: OptionItem[]
}

type ModalityPackage = {
  id: string; modality_id: string
  day_from: number | null; day_to: number | null; label: string | null; sort_order: number
  name: string | null; description: string | null
  includes: string[] | null; min_guests: number | null; max_guests: number | null
  linked_menu_ids: string[] | null
  prices: ModalityPrice[]
  option_groups: OptionGroup[]
}
```

- [ ] **Step 2: Add state variables for option group management**

After the existing `namedPkgError` state (line ~512), add:

```typescript
  // Option group state
  type OptionGroupForm = { name: string; min_selections: number; max_selections: number; source_type: 'manual' | 'menu_section' }
  const emptyGroupForm: OptionGroupForm = { name: '', min_selections: 1, max_selections: 1, source_type: 'manual' }
  const [addingGroupForPkg, setAddingGroupForPkg] = useState<string | null>(null) // package id
  const [groupForm, setGroupForm] = useState<OptionGroupForm>(emptyGroupForm)
  const [groupSaving, setGroupSaving] = useState(false)
  const [groupError, setGroupError] = useState('')
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)

  // Option item state
  type OptionItemForm = { name: string; description: string; supplement_price: string; is_default: boolean }
  const emptyItemForm: OptionItemForm = { name: '', description: '', supplement_price: '', is_default: false }
  const [addingItemForGroup, setAddingItemForGroup] = useState<string | null>(null) // group id
  const [itemForm, setItemForm] = useState<OptionItemForm>(emptyItemForm)
  const [itemSaving, setItemSaving] = useState(false)
  const [itemError, setItemError] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Import from menu state
  const [importingGroupId, setImportingGroupId] = useState<string | null>(null)
  const [importMenuId, setImportMenuId] = useState<string>('')
  const [importCourseLabel, setImportCourseLabel] = useState<string>('')
  const [importSaving, setImportSaving] = useState(false)

  // Full menu data (with courses) for import feature
  const [availableMenusFull, setAvailableMenusFull] = useState<any[]>([])
```

- [ ] **Step 3: Extend availableMenus fetch to also store full menu data**

Find the existing `useEffect` that fetches menus (line ~530). Change the inner logic to also save full menu objects:

```typescript
  useEffect(() => {
    if (!user) return
    fetch('/api/dossier-templates').then(r => r.ok ? r.json() : null).then(d => {
      if (!Array.isArray(d)) return
      const menus: Array<{ id: string; name: string }> = []
      const menusFull: any[] = []
      const seen = new Set<string>()
      for (const tpl of d) {
        const arr = (tpl?.sections_data as any)?.menus_override ?? []
        for (const m of arr) {
          if (m?.id && !seen.has(m.id)) {
            seen.add(m.id)
            menus.push({ id: m.id, name: m.name || 'Sin nombre' })
            menusFull.push(m)
          }
        }
      }
      setAvailableMenus(menus)
      setAvailableMenusFull(menusFull)
    }).catch(() => {})
  }, [user?.id])
```

- [ ] **Step 4: Extend modalities fetch to include option_groups**

Find where modalities are fetched. Search for the `.select(` call that includes `venue_modality_packages`. It will be in the `load()` function. The current select string looks like:

```
*, packages:venue_modality_packages(*, prices:venue_modality_prices(*)), prices:venue_modality_prices(*)
```

Change it to:

```
*, packages:venue_modality_packages(*, prices:venue_modality_prices(*), option_groups:package_option_groups(*, items:package_option_items(*))), prices:venue_modality_prices(*)
```

Also, wherever the modalities data is processed after fetching, ensure `option_groups` defaults to `[]` on each package. Find the mapping that constructs packages and add:

```typescript
option_groups: pkg.option_groups ?? []
```

- [ ] **Step 5: Add CRUD handler functions**

After `deleteNamedPkg` (line ~1015), add these handler functions:

```typescript
  // ── Option Group CRUD ──────────────────────────────────────────────────────

  const startAddGroup = (pkgId: string) => {
    setAddingGroupForPkg(pkgId); setGroupForm(emptyGroupForm); setGroupError('')
  }

  const saveGroup = async (modalityId: string, pkgId: string) => {
    if (!groupForm.name.trim()) { setGroupError('Nombre obligatorio'); return }
    if (groupForm.max_selections < groupForm.min_selections) { setGroupError('Máx debe ser ≥ Mín'); return }
    setGroupSaving(true); setGroupError('')
    try {
      const existingGroups = modalities
        .find(m => m.id === modalityId)?.packages
        .find(p => p.id === pkgId)?.option_groups ?? []
      const res = await fetch(`/api/estructura/packages/${pkgId}/option-groups`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...groupForm, sort_order: existingGroups.length, venue_id: activeVenue?.id ?? null }),
      })
      const json = await res.json()
      if (!res.ok) { setGroupError(json.error ?? 'Error'); setGroupSaving(false); return }
      updateModalities(prev => prev.map(m => m.id === modalityId
        ? { ...m, packages: m.packages.map(p => p.id === pkgId
            ? { ...p, option_groups: [...p.option_groups, json.group] }
            : p
          )}
        : m
      ))
      setAddingGroupForPkg(null)
    } catch { setGroupError('Error de red') }
    setGroupSaving(false)
  }

  const startEditGroup = (group: OptionGroup) => {
    setEditingGroupId(group.id)
    setGroupForm({ name: group.name, min_selections: group.min_selections, max_selections: group.max_selections, source_type: group.source_type })
    setGroupError('')
  }

  const saveEditGroup = async (modalityId: string, pkgId: string, groupId: string) => {
    if (!groupForm.name.trim()) { setGroupError('Nombre obligatorio'); return }
    setGroupSaving(true); setGroupError('')
    try {
      const res = await fetch(`/api/estructura/option-groups/${groupId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupForm.name, min_selections: groupForm.min_selections, max_selections: groupForm.max_selections }),
      })
      const json = await res.json()
      if (!res.ok) { setGroupError(json.error ?? 'Error'); setGroupSaving(false); return }
      updateModalities(prev => prev.map(m => m.id === modalityId
        ? { ...m, packages: m.packages.map(p => p.id === pkgId
            ? { ...p, option_groups: p.option_groups.map(g => g.id === groupId ? { ...g, ...json.group } : g) }
            : p
          )}
        : m
      ))
      setEditingGroupId(null)
    } catch { setGroupError('Error de red') }
    setGroupSaving(false)
  }

  const deleteGroup = async (modalityId: string, pkgId: string, groupId: string) => {
    if (!confirm('¿Eliminar este grupo y todos sus items?')) return
    const res = await fetch(`/api/estructura/option-groups/${groupId}`, { method: 'DELETE' })
    if (res.ok) updateModalities(prev => prev.map(m => m.id === modalityId
      ? { ...m, packages: m.packages.map(p => p.id === pkgId
          ? { ...p, option_groups: p.option_groups.filter(g => g.id !== groupId) }
          : p
        )}
      : m
    ))
  }

  // ── Option Item CRUD ───────────────────────────────────────────────────────

  const startAddItem = (groupId: string) => {
    setAddingItemForGroup(groupId); setItemForm(emptyItemForm); setItemError('')
  }

  const saveItem = async (modalityId: string, pkgId: string, groupId: string) => {
    if (!itemForm.name.trim()) { setItemError('Nombre obligatorio'); return }
    setItemSaving(true); setItemError('')
    try {
      const group = modalities
        .find(m => m.id === modalityId)?.packages
        .find(p => p.id === pkgId)?.option_groups
        .find(g => g.id === groupId)
      const res = await fetch(`/api/estructura/option-groups/${groupId}/items`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: itemForm.name,
          description: itemForm.description || null,
          supplement_price: itemForm.supplement_price ? parseFloat(itemForm.supplement_price) : null,
          is_default: itemForm.is_default,
          sort_order: group?.items.length ?? 0,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setItemError(json.error ?? 'Error'); setItemSaving(false); return }
      updateModalities(prev => prev.map(m => m.id === modalityId
        ? { ...m, packages: m.packages.map(p => p.id === pkgId
            ? { ...p, option_groups: p.option_groups.map(g => g.id === groupId
                ? { ...g, items: [...g.items, json.item] }
                : g
              )}
            : p
          )}
        : m
      ))
      setAddingItemForGroup(null)
    } catch { setItemError('Error de red') }
    setItemSaving(false)
  }

  const deleteItem = async (modalityId: string, pkgId: string, groupId: string, itemId: string) => {
    const res = await fetch(`/api/estructura/option-items/${itemId}`, { method: 'DELETE' })
    if (res.ok) updateModalities(prev => prev.map(m => m.id === modalityId
      ? { ...m, packages: m.packages.map(p => p.id === pkgId
          ? { ...p, option_groups: p.option_groups.map(g => g.id === groupId
              ? { ...g, items: g.items.filter(i => i.id !== itemId) }
              : g
            )}
          : p
        )}
      : m
    ))
  }

  // ── Import from menu ───────────────────────────────────────────────────────

  const startImport = (groupId: string) => {
    setImportingGroupId(groupId); setImportMenuId(''); setImportCourseLabel('')
  }

  const doImport = async (modalityId: string, pkgId: string, groupId: string) => {
    if (!importMenuId || !importCourseLabel) return
    setImportSaving(true)
    try {
      const res = await fetch(`/api/estructura/option-groups/${groupId}/import-from-menu`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu_id: importMenuId, course_label: importCourseLabel }),
      })
      const json = await res.json()
      if (res.ok && json.items) {
        updateModalities(prev => prev.map(m => m.id === modalityId
          ? { ...m, packages: m.packages.map(p => p.id === pkgId
              ? { ...p, option_groups: p.option_groups.map(g => g.id === groupId
                  ? { ...g, items: [...g.items, ...json.items], source_type: 'menu_section' as const, source_menu_id: importMenuId, source_section: importCourseLabel }
                  : g
                )}
              : p
            )}
          : m
        ))
      }
      setImportingGroupId(null)
    } catch {}
    setImportSaving(false)
  }
```

- [ ] **Step 6: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add app/venue-settings/page.tsx
git commit -m "feat: add option group types, state, and CRUD handlers to venue-settings

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Venue Settings — Option Groups UI

**Files:**
- Modify: `app/venue-settings/page.tsx`

This task adds the visible UI for option groups within the named package edit and add forms. The UI goes after the "Menús asociados" section in both the edit form (line ~2202) and the add form (line ~2386).

- [ ] **Step 1: Add option groups section to the EDIT named package form**

In the edit form for named packages, after the "Menús asociados" `</div>` (around line 2202, right before the error display `{namedPkgError && ...}`), insert this JSX block:

```tsx
                                    {/* Option groups section (only in edit mode — need saved pkg.id for API) */}
                                    <div style={{ marginBottom: 10, marginTop: 14, borderTop: '1px solid var(--ivory)', paddingTop: 12 }}>
                                      <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8, display: 'block' }}>Opciones del paquete</label>

                                      {/* Existing groups */}
                                      {(pkg.option_groups ?? []).map((grp: OptionGroup) => (
                                        <div key={grp.id} style={{ marginBottom: 8, border: '1px solid var(--ivory)', borderRadius: 8, padding: '10px 12px', background: '#fff' }}>
                                          {editingGroupId === grp.id ? (
                                            <div>
                                              <input className="form-input" value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del grupo" style={{ fontSize: 12, marginBottom: 6 }} autoFocus />
                                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                                                <div>
                                                  <label style={{ fontSize: 9, color: 'var(--warm-gray)' }}>Mín. selecciones</label>
                                                  <input className="form-input" type="number" min={0} value={groupForm.min_selections} onChange={e => setGroupForm(f => ({ ...f, min_selections: parseInt(e.target.value) || 0 }))} style={{ fontSize: 12 }} />
                                                </div>
                                                <div>
                                                  <label style={{ fontSize: 9, color: 'var(--warm-gray)' }}>Máx. selecciones</label>
                                                  <input className="form-input" type="number" min={1} value={groupForm.max_selections} onChange={e => setGroupForm(f => ({ ...f, max_selections: parseInt(e.target.value) || 1 }))} style={{ fontSize: 12 }} />
                                                </div>
                                              </div>
                                              {groupError && <div style={{ fontSize: 10, color: 'var(--rose)', marginBottom: 4 }}>{groupError}</div>}
                                              <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn btn-primary btn-sm" style={{ fontSize: 10 }} disabled={groupSaving} onClick={() => saveEditGroup(m.id, pkg.id, grp.id)}>Guardar</button>
                                                <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => setEditingGroupId(null)}>Cancelar</button>
                                              </div>
                                            </div>
                                          ) : (
                                            <div>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                <div>
                                                  <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--charcoal)' }}>{grp.name}</span>
                                                  <span style={{ fontSize: 10, color: 'var(--warm-gray)', marginLeft: 8 }}>
                                                    {grp.min_selections === grp.max_selections ? `Escoge ${grp.min_selections}` : `${grp.min_selections}–${grp.max_selections}`}
                                                  </span>
                                                  {grp.source_type === 'menu_section' && (
                                                    <span style={{ fontSize: 9, color: 'var(--gold)', marginLeft: 6 }}>📋 Importado</span>
                                                  )}
                                                </div>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 2 }} onClick={() => startEditGroup(grp)} title="Editar grupo"><Pencil size={11} /></button>
                                                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: 2 }} onClick={() => deleteGroup(m.id, pkg.id, grp.id)} title="Eliminar grupo"><Trash2 size={11} /></button>
                                                </div>
                                              </div>

                                              {/* Items list */}
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
                                                {grp.items.map(item => (
                                                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--charcoal)' }}>
                                                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
                                                    <span style={{ flex: 1 }}>{item.name}{item.supplement_price ? ` (+${item.supplement_price}€/pers)` : ''}{item.is_default ? ' ⭐' : ''}</span>
                                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BC5249', padding: 1, flexShrink: 0 }} onClick={() => deleteItem(m.id, pkg.id, grp.id, item.id)}><X size={10} /></button>
                                                  </div>
                                                ))}
                                              </div>

                                              {/* Add item inline form */}
                                              {addingItemForGroup === grp.id ? (
                                                <div style={{ background: 'var(--cream)', padding: 8, borderRadius: 6, marginBottom: 4 }}>
                                                  <input className="form-input" value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del item" style={{ fontSize: 11, marginBottom: 4 }} autoFocus />
                                                  <input className="form-input" value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción (opcional)" style={{ fontSize: 11, marginBottom: 4 }} />
                                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                                                    <input className="form-input" type="number" step="0.01" min="0" value={itemForm.supplement_price} onChange={e => setItemForm(f => ({ ...f, supplement_price: e.target.value }))} placeholder="Suplemento €/pers" style={{ fontSize: 11, width: 130 }} />
                                                    <label style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, color: 'var(--warm-gray)', cursor: 'pointer' }}>
                                                      <input type="checkbox" checked={itemForm.is_default} onChange={e => setItemForm(f => ({ ...f, is_default: e.target.checked }))} />
                                                      Preseleccionado
                                                    </label>
                                                  </div>
                                                  {itemError && <div style={{ fontSize: 10, color: 'var(--rose)', marginBottom: 4 }}>{itemError}</div>}
                                                  <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-primary btn-sm" style={{ fontSize: 10 }} disabled={itemSaving} onClick={() => saveItem(m.id, pkg.id, grp.id)}>Añadir</button>
                                                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => setAddingItemForGroup(null)}>Cancelar</button>
                                                  </div>
                                                </div>
                                              ) : (
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                  <button type="button" onClick={() => startAddItem(grp.id)}
                                                    style={{ background: 'none', border: '1px dashed var(--ivory)', borderRadius: 6, cursor: 'pointer', fontSize: 10, color: 'var(--gold)', padding: '2px 6px', fontWeight: 600 }}>+ Item</button>
                                                  {availableMenusFull.length > 0 && (
                                                    <button type="button" onClick={() => startImport(grp.id)}
                                                      style={{ background: 'none', border: '1px dashed var(--ivory)', borderRadius: 6, cursor: 'pointer', fontSize: 10, color: 'var(--warm-gray)', padding: '2px 6px' }}>📋 Importar de menú</button>
                                                  )}
                                                </div>
                                              )}

                                              {/* Import from menu flow */}
                                              {importingGroupId === grp.id && (
                                                <div style={{ background: '#F8F6F0', padding: 8, borderRadius: 6, marginTop: 6 }}>
                                                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Importar de menú</div>
                                                  <select className="form-input" value={importMenuId} onChange={e => { setImportMenuId(e.target.value); setImportCourseLabel('') }} style={{ fontSize: 11, marginBottom: 4 }}>
                                                    <option value="">Selecciona menú...</option>
                                                    {availableMenusFull.map((menu: any) => (
                                                      <option key={menu.id} value={menu.id}>{menu.name || 'Sin nombre'}</option>
                                                    ))}
                                                  </select>
                                                  {importMenuId && (() => {
                                                    const menu = availableMenusFull.find((m: any) => m.id === importMenuId)
                                                    const courses: any[] = menu?.courses ?? []
                                                    return courses.length > 0 ? (
                                                      <select className="form-input" value={importCourseLabel} onChange={e => setImportCourseLabel(e.target.value)} style={{ fontSize: 11, marginBottom: 4 }}>
                                                        <option value="">Selecciona sección...</option>
                                                        {courses.map((c: any, ci: number) => (
                                                          <option key={ci} value={c.label}>{c.label} ({c.items?.length ?? 0} items)</option>
                                                        ))}
                                                      </select>
                                                    ) : (
                                                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Este menú no tiene secciones</div>
                                                    )
                                                  })()}
                                                  <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-primary btn-sm" style={{ fontSize: 10 }} disabled={!importMenuId || !importCourseLabel || importSaving} onClick={() => doImport(m.id, pkg.id, grp.id)}>
                                                      {importSaving ? 'Importando…' : 'Importar'}
                                                    </button>
                                                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => setImportingGroupId(null)}>Cancelar</button>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ))}

                                      {/* Add group button or form */}
                                      {addingGroupForPkg === pkg.id ? (
                                        <div style={{ border: '1px dashed var(--ivory)', borderRadius: 8, padding: '10px 12px', background: '#FAFAF9' }}>
                                          <input className="form-input" value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del grupo (ej: Entrantes)" style={{ fontSize: 12, marginBottom: 6 }} autoFocus />
                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                                            <div>
                                              <label style={{ fontSize: 9, color: 'var(--warm-gray)' }}>Mín. selecciones</label>
                                              <input className="form-input" type="number" min={0} value={groupForm.min_selections} onChange={e => setGroupForm(f => ({ ...f, min_selections: parseInt(e.target.value) || 0 }))} style={{ fontSize: 12 }} />
                                            </div>
                                            <div>
                                              <label style={{ fontSize: 9, color: 'var(--warm-gray)' }}>Máx. selecciones</label>
                                              <input className="form-input" type="number" min={1} value={groupForm.max_selections} onChange={e => setGroupForm(f => ({ ...f, max_selections: parseInt(e.target.value) || 1 }))} style={{ fontSize: 12 }} />
                                            </div>
                                          </div>
                                          {groupError && <div style={{ fontSize: 10, color: 'var(--rose)', marginBottom: 4 }}>{groupError}</div>}
                                          <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn btn-primary btn-sm" style={{ fontSize: 10 }} disabled={groupSaving} onClick={() => saveGroup(m.id, pkg.id)}>Crear grupo</button>
                                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => setAddingGroupForPkg(null)}>Cancelar</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <button type="button" onClick={() => startAddGroup(pkg.id)}
                                          style={{ background: 'none', border: '1px dashed var(--ivory)', borderRadius: 6, cursor: 'pointer', fontSize: 10, color: 'var(--gold)', padding: '3px 8px', fontWeight: 600 }}>
                                          + Añadir grupo de opciones
                                        </button>
                                      )}
                                    </div>
```

- [ ] **Step 2: Add option groups badge to the package header (read-only view)**

In the package header row (around line 2230-2244), where badges show for includes, menus, and prices, add after the `linked_menu_ids` badge:

```tsx
                                          {(pkg.option_groups ?? []).length > 0 && (
                                            <span style={{ fontSize: 10, background: '#E8F0FE', padding: '1px 6px', borderRadius: 8, color: '#1A56DB', fontWeight: 500 }}>
                                              {(pkg.option_groups ?? []).length} grupo{(pkg.option_groups ?? []).length !== 1 ? 's' : ''} opciones
                                            </span>
                                          )}
```

- [ ] **Step 3: Add note in the ADD form that groups are configured after saving**

In the add named package form (around line 2386, right before the error display `{namedPkgError && ...}`), add:

```tsx
                                  <div style={{ fontSize: 10, color: 'var(--warm-gray)', fontStyle: 'italic', marginBottom: 6 }}>
                                    💡 Para añadir grupos de opciones (ej: "Escoge 3 entrantes"), guarda el paquete primero y luego edítalo.
                                  </div>
```

- [ ] **Step 4: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/venue-settings/page.tsx
git commit -m "feat: add option groups UI in venue-settings package form

Shows groups with items, inline add/edit/delete, import from menu.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Data Flow — Extend dossier fetches + extractData

**Files:**
- Modify: `app/dossier/[slug]/page.tsx`
- Modify: `app/dossier/templates/[id]/preview/page.tsx`
- Modify: `app/dossier/[slug]/tpl/shared.tsx`

- [ ] **Step 1: Extend dossier page nested select to include option_groups**

In `app/dossier/[slug]/page.tsx`, find the modalities select query (around line 219):

```typescript
packages:venue_modality_packages(*, prices:venue_modality_prices(*)),
```

Replace with:

```typescript
packages:venue_modality_packages(*, prices:venue_modality_prices(*), option_groups:package_option_groups(*, items:package_option_items(*))),
```

- [ ] **Step 2: Extend template preview page nested select**

In `app/dossier/templates/[id]/preview/page.tsx`, find the modalities select query (around line 182):

```typescript
.select('*, packages:venue_modality_packages(*, prices:venue_modality_prices(*)), prices:venue_modality_prices(*)')
```

Replace with:

```typescript
.select('*, packages:venue_modality_packages(*, prices:venue_modality_prices(*), option_groups:package_option_groups(*, items:package_option_items(*))), prices:venue_modality_prices(*)')
```

- [ ] **Step 3: Extend PackageItem type in shared.tsx**

In `app/dossier/[slug]/tpl/shared.tsx`, find the `PackageItem` type (line ~1097):

```typescript
export type PackageItem = {
  name?: string
  subtitle?: string
  price?: string
  description?: string
  includes?: string[]
  is_recommended?: boolean
  min_guests?: number
  max_guests?: number
}
```

Replace with:

```typescript
export type OptionItemDisplay = {
  id: string
  name: string
  description?: string | null
  supplement_price?: number | null
  is_default?: boolean
  sort_order?: number
}

export type OptionGroupDisplay = {
  id: string
  name: string
  min_selections: number
  max_selections: number
  source_type?: string
  items: OptionItemDisplay[]
}

export type PackageItem = {
  id?: string
  name?: string
  subtitle?: string
  price?: string
  description?: string
  includes?: string[]
  is_recommended?: boolean
  min_guests?: number
  max_guests?: number
  option_groups?: OptionGroupDisplay[]
}
```

- [ ] **Step 4: Pass option_groups through extractData**

In `app/dossier/[slug]/tpl/shared.tsx`, inside the `extractData` function's `packagesShow` builder, find the block that pushes sub-packages (around line 1294):

```typescript
allPkgs.push({
  id:             pkg.id,
  modality_id:    m.id,
  modality_name:  m.name,
  name:           pkg.name || pkg.label || m.name,
  subtitle:       m.duration_label || '',
  description:    pkg.description ?? m.description ?? '',
  price:          minPrice ? `Desde ${minPrice.toLocaleString('es-ES')}€${hasPP ? '/pers.' : ''}` : '',
  min_guests:     pkg.min_guests ?? m.min_guests ?? null,
  max_guests:     pkg.max_guests ?? m.max_guests ?? null,
  includes:       Array.isArray(pkg.includes) ? pkg.includes : (Array.isArray(m.includes) ? m.includes : []),
  is_active:      m.is_active !== false,
  linked_menu_ids: pkg.linked_menu_ids ?? m.linked_menu_ids ?? [],
  days_of_week:   Array.isArray(m.days_of_week) ? m.days_of_week : [],
  sort_order:     pkg.sort_order ?? 0,
})
```

Add `option_groups` to this object:

```typescript
  option_groups:  Array.isArray(pkg.option_groups) ? pkg.option_groups.map((g: any) => ({
    id: g.id, name: g.name, min_selections: g.min_selections, max_selections: g.max_selections,
    source_type: g.source_type,
    items: (g.items ?? []).map((i: any) => ({
      id: i.id, name: i.name, description: i.description,
      supplement_price: i.supplement_price ? Number(i.supplement_price) : null,
      is_default: i.is_default ?? false, sort_order: i.sort_order ?? 0,
    })).sort((a: any, b: any) => a.sort_order - b.sort_order),
  })).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) : [],
```

Also add to the fallback block (modality as single package, around line 1317):

```typescript
  option_groups: [],
```

- [ ] **Step 5: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/dossier/[slug]/page.tsx app/dossier/templates/[id]/preview/page.tsx app/dossier/[slug]/tpl/shared.tsx
git commit -m "feat: extend data flow to pass option_groups through to templates

Nested Supabase select, extractData mapping, updated PackageItem type.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Dossier Visual — PackageOptionSelector component

**Files:**
- Modify: `app/dossier/[slug]/tpl/shared.tsx`

This creates the reusable interactive component that all templates will use to render option group checkboxes.

- [ ] **Step 1: Add PackageOptionSelector component to shared.tsx**

At the end of `shared.tsx` (after the `PricingTable` component, which ends around line ~1250), add:

```typescript
// ── PackageOptionSelector ─────────────────────────────────────────────────
// Interactive checkboxes for package option groups with min/max enforcement and supplement display.

export function PackageOptionSelector({
  groups,
  selections,
  onToggle,
  primary,
  dark = false,
  guests = 0,
  basePrice = 0,
}: {
  groups: OptionGroupDisplay[]
  selections: Record<string, string[]>  // group_id → item_ids[]
  onToggle: (groupId: string, itemId: string) => void
  primary: string
  dark?: boolean
  guests?: number
  basePrice?: number  // base price per person (number, not formatted string)
}) {
  if (!groups.length) return null

  const text = dark ? 'rgba(255,255,255,.88)' : '#181410'
  const sub = dark ? 'rgba(255,255,255,.50)' : '#6a6560'
  const border = dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.08)'
  const rgb = toRgb(primary)

  // Calculate total supplements
  let totalSupp = 0
  for (const g of groups) {
    const sel = selections[g.id] ?? []
    for (const item of g.items) {
      if (sel.includes(item.id) && item.supplement_price) {
        totalSupp += item.supplement_price
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 16 }}>
      {groups.map(g => {
        const sel = selections[g.id] ?? []
        const count = sel.length
        const atMax = count >= g.max_selections
        const ruleText = g.min_selections === g.max_selections
          ? `Escoge ${g.min_selections}`
          : `Escoge ${g.min_selections}–${g.max_selections}`

        return (
          <div key={g.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: '.78rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: primary }}>{g.name}</div>
              <div style={{ fontSize: '.72rem', color: sub }}>
                {ruleText} · <span style={{ fontWeight: 600, color: count >= g.min_selections ? primary : sub }}>{count}/{g.max_selections}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {g.items.map(item => {
                const checked = sel.includes(item.id)
                const disabled = !checked && atMax
                return (
                  <div
                    key={item.id}
                    onClick={disabled ? undefined : () => onToggle(g.id, item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
                      border: `1px solid ${checked ? primary : border}`,
                      background: checked ? `rgba(${rgb},.06)` : 'transparent',
                      opacity: disabled ? 0.45 : 1,
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${checked ? primary : (dark ? 'rgba(255,255,255,.25)' : '#ccc')}`,
                      background: checked ? primary : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .15s',
                    }}>
                      {checked && <span style={{ color: dark ? '#000' : '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '.84rem', color: text, fontWeight: checked ? 600 : 400 }}>{item.name}</div>
                      {item.description && <div style={{ fontSize: '.72rem', color: sub, marginTop: 2 }}>{item.description}</div>}
                    </div>
                    {item.supplement_price != null && item.supplement_price > 0 && (
                      <div style={{ fontSize: '.72rem', fontWeight: 600, color: primary, whiteSpace: 'nowrap' }}>
                        +{item.supplement_price.toLocaleString('es-ES')}€/pers
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Price summary with supplements */}
      {totalSupp > 0 && basePrice > 0 && (
        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', color: sub }}>
            <span>Base</span>
            <span>{basePrice.toLocaleString('es-ES')}€/pers</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', color: primary, fontWeight: 600 }}>
            <span>Suplementos</span>
            <span>+{totalSupp.toLocaleString('es-ES')}€/pers</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.88rem', fontWeight: 700, color: text, marginTop: 4, paddingTop: 8, borderTop: `1px solid ${border}` }}>
            <span>Total</span>
            <span>{(basePrice + totalSupp).toLocaleString('es-ES')}€/pers{guests > 0 ? ` × ${guests} = ${((basePrice + totalSupp) * guests).toLocaleString('es-ES')}€` : ''}</span>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/dossier/[slug]/tpl/shared.tsx
git commit -m "feat: add PackageOptionSelector component for dossier

Interactive checkboxes with min/max enforcement, supplement prices, totals.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Template Integration — T5 Minimalista

**Files:**
- Modify: `app/dossier/[slug]/tpl/T5Minimalista.tsx`

T5 is the most complete template — it has package selection + WeddingProposal. We implement here first, then replicate to other templates.

- [ ] **Step 1: Add imports and state**

At the top of T5Minimalista.tsx, add `PackageOptionSelector` to the imports from `./shared`:

Find the existing import line:
```typescript
  PricingCards, PricingTable,
```

Add `PackageOptionSelector` to that import.

Then inside the component function, after the `selectedPackageId` state, add:

```typescript
  const [pkgSelections, setPkgSelections] = useState<Record<string, Record<string, string[]>>>({})
  // pkgSelections[packageId][groupId] = itemId[]

  // Initialize defaults when package is selected
  useEffect(() => {
    if (!selectedPackageId) return
    const pkg = activePkgs.find((p: any) => p.id === selectedPackageId) as any
    if (!pkg?.option_groups?.length) return
    if (pkgSelections[selectedPackageId]) return  // already initialized
    const defaults: Record<string, string[]> = {}
    for (const g of pkg.option_groups) {
      defaults[g.id] = g.items.filter((i: any) => i.is_default).map((i: any) => i.id)
    }
    setPkgSelections(prev => ({ ...prev, [selectedPackageId]: defaults }))
  }, [selectedPackageId]) // eslint-disable-line

  const toggleOption = (groupId: string, itemId: string) => {
    if (!selectedPackageId) return
    setPkgSelections(prev => {
      const pkgSel = { ...(prev[selectedPackageId] ?? {}) }
      const current = pkgSel[groupId] ?? []
      pkgSel[groupId] = current.includes(itemId) ? current.filter(id => id !== itemId) : [...current, itemId]
      return { ...prev, [selectedPackageId]: pkgSel }
    })
  }
```

- [ ] **Step 2: Render PackageOptionSelector below PricingCards**

In the packages section, find where PricingCards is rendered (around line 889):

```tsx
<PricingCards packages={activePkgs as any} primary={primary} dark={false} font={font}
  selectedId={selectedPackageId} onSelect={(id) => setSelectedPackageId(id)} />
```

After this line (but still inside the same `<div>` wrapper), add:

```tsx
{selectedPackageId && (() => {
  const pkg = activePkgs.find((p: any) => p.id === selectedPackageId) as any
  const groups = pkg?.option_groups ?? []
  if (!groups.length) return null
  const basePriceNum = (() => {
    const prices = (pkg.prices ?? []).map((p: any) => p.price_per_person ?? p.price).filter(Boolean).map(Number).filter((n: number) => !isNaN(n) && n > 0)
    return prices.length > 0 ? Math.min(...prices) : 0
  })()
  return (
    <div style={{ marginTop: 20, padding: '24px 28px', background: OFF, borderRadius: 10, border: `1px solid ${LINE}` }}>
      <PackageOptionSelector
        groups={groups}
        selections={pkgSelections[selectedPackageId] ?? {}}
        onToggle={toggleOption}
        primary={primary}
        dark={false}
        guests={(data as any).guests ?? 0}
        basePrice={basePriceNum}
      />
    </div>
  )
})()}
```

- [ ] **Step 3: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/dossier/[slug]/tpl/T5Minimalista.tsx
git commit -m "feat: integrate PackageOptionSelector in T5 Minimalista template

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Template Integration — T1 Impacto

**Files:**
- Modify: `app/dossier/[slug]/tpl/T1Impacto.tsx`

- [ ] **Step 1: Add imports, state, and toggle handler**

Add `PackageOptionSelector` to the shared import.

Inside the component, find the `selectedPackageId` state. After it add:

```typescript
  const [pkgSelections, setPkgSelections] = useState<Record<string, Record<string, string[]>>>({})

  useEffect(() => {
    if (!selectedPackageId) return
    const pkg = pkgs.find((p: any) => p.id === selectedPackageId) as any
    if (!pkg?.option_groups?.length) return
    if (pkgSelections[selectedPackageId]) return
    const defaults: Record<string, string[]> = {}
    for (const g of pkg.option_groups) {
      defaults[g.id] = g.items.filter((i: any) => i.is_default).map((i: any) => i.id)
    }
    setPkgSelections(prev => ({ ...prev, [selectedPackageId]: defaults }))
  }, [selectedPackageId]) // eslint-disable-line

  const toggleOption = (groupId: string, itemId: string) => {
    if (!selectedPackageId) return
    setPkgSelections(prev => {
      const pkgSel = { ...(prev[selectedPackageId] ?? {}) }
      const current = pkgSel[groupId] ?? []
      pkgSel[groupId] = current.includes(itemId) ? current.filter(id => id !== itemId) : [...current, itemId]
      return { ...prev, [selectedPackageId]: pkgSel }
    })
  }
```

- [ ] **Step 2: Render PackageOptionSelector below PricingCards**

Find where PricingCards is used in T1 (around line 1283). After the `<PricingCards>` call, add the same option selector block as T5 but using T1's color variables:

```tsx
{selectedPackageId && (() => {
  const pkg = pkgs.find((p: any) => p.id === selectedPackageId) as any
  const groups = pkg?.option_groups ?? []
  if (!groups.length) return null
  const basePriceNum = (() => {
    const prices = (pkg.prices ?? []).map((p: any) => p.price_per_person ?? p.price).filter(Boolean).map(Number).filter((n: number) => !isNaN(n) && n > 0)
    return prices.length > 0 ? Math.min(...prices) : 0
  })()
  return (
    <div style={{ marginTop: 20, padding: '24px 28px', borderRadius: 10, border: `1px solid ${lightMode ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.08)'}` }}>
      <PackageOptionSelector
        groups={groups}
        selections={pkgSelections[selectedPackageId] ?? {}}
        onToggle={toggleOption}
        primary={primary}
        dark={!lightMode}
        guests={(data as any).guests ?? 0}
        basePrice={basePriceNum}
      />
    </div>
  )
})()}
```

- [ ] **Step 3: Commit**

```bash
git add app/dossier/[slug]/tpl/T1Impacto.tsx
git commit -m "feat: integrate PackageOptionSelector in T1 Impacto template

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 11: Template Integration — T2 Emocion

**Files:**
- Modify: `app/dossier/[slug]/tpl/T2Emocion.tsx`

- [ ] **Step 1: Add imports, state, and toggle handler**

Same pattern as T1/T5 — add `PackageOptionSelector` to import, add state + effect + toggle handler inside the component using `pkgs` variable (T2 uses `pkgs` defined at line ~78).

```typescript
  const [pkgSelections, setPkgSelections] = useState<Record<string, Record<string, string[]>>>({})

  useEffect(() => {
    if (!selectedPackageId) return
    const pkg = pkgs.find((p: any) => p.id === selectedPackageId) as any
    if (!pkg?.option_groups?.length) return
    if (pkgSelections[selectedPackageId]) return
    const defaults: Record<string, string[]> = {}
    for (const g of pkg.option_groups) {
      defaults[g.id] = g.items.filter((i: any) => i.is_default).map((i: any) => i.id)
    }
    setPkgSelections(prev => ({ ...prev, [selectedPackageId]: defaults }))
  }, [selectedPackageId]) // eslint-disable-line

  const toggleOption = (groupId: string, itemId: string) => {
    if (!selectedPackageId) return
    setPkgSelections(prev => {
      const pkgSel = { ...(prev[selectedPackageId] ?? {}) }
      const current = pkgSel[groupId] ?? []
      pkgSel[groupId] = current.includes(itemId) ? current.filter(id => id !== itemId) : [...current, itemId]
      return { ...prev, [selectedPackageId]: pkgSel }
    })
  }
```

- [ ] **Step 2: Render below PricingCards**

Find where PricingCards is used in T2 (line ~535). After it, add:

```tsx
{selectedPackageId && (() => {
  const pkg = pkgs.find((p: any) => p.id === selectedPackageId) as any
  const groups = pkg?.option_groups ?? []
  if (!groups.length) return null
  const basePriceNum = (() => {
    const prices = (pkg.prices ?? []).map((p: any) => p.price_per_person ?? p.price).filter(Boolean).map(Number).filter((n: number) => !isNaN(n) && n > 0)
    return prices.length > 0 ? Math.min(...prices) : 0
  })()
  return (
    <div style={{ marginTop: 20, padding: '24px 28px', borderRadius: 10, border: '1px solid rgba(0,0,0,.08)' }}>
      <PackageOptionSelector
        groups={groups}
        selections={pkgSelections[selectedPackageId] ?? {}}
        onToggle={toggleOption}
        primary={primary}
        dark={false}
        guests={(data as any).guests ?? 0}
        basePrice={basePriceNum}
      />
    </div>
  )
})()}
```

- [ ] **Step 3: Commit**

```bash
git add app/dossier/[slug]/tpl/T2Emocion.tsx
git commit -m "feat: integrate PackageOptionSelector in T2 Emocion template

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 12: TemplateEditor — Show option groups in pricing panel

**Files:**
- Modify: `components/TemplateEditor.tsx`

- [ ] **Step 1: Show option groups info in the pricing panel**

In `TemplateEditor.tsx`, find where packages are displayed in the pricing panel. The pricing section already shows package names, guest ranges, and prices. After the existing package info display, add a summary of option groups:

Find the block that renders each package in the pricing panel. After the price display for each package, add:

```tsx
{(pkg.option_groups ?? []).length > 0 && (
  <div style={{ marginTop: 6 }}>
    {(pkg.option_groups ?? []).map((g: any) => (
      <div key={g.id} style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
        📋 {g.name}: {g.min_selections === g.max_selections ? `escoge ${g.min_selections}` : `${g.min_selections}–${g.max_selections}`}
        {' · '}{g.items?.length ?? 0} opciones
        {g.items?.some((i: any) => i.supplement_price > 0) && ' · con suplementos'}
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 2: Extend buildPatch to pass option_groups**

In `buildPatch()` inside TemplateEditor, the modalities data already flows through. Since option_groups are nested within packages in the Supabase response, they should already be included. Verify that the modalities fetch in TemplateEditor uses the extended select. If it fetches from the same `/api/estructura/modalities` endpoint, check that endpoint includes option_groups.

If the TemplateEditor fetches modalities directly, update the select to match:

```
*, packages:venue_modality_packages(*, prices:venue_modality_prices(*), option_groups:package_option_groups(*, items:package_option_items(*))), prices:venue_modality_prices(*)
```

- [ ] **Step 3: Commit**

```bash
git add components/TemplateEditor.tsx
git commit -m "feat: show option groups summary in TemplateEditor pricing panel

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 13: End-to-End Verification

**Files:** None (manual testing)

- [ ] **Step 1: Verify the full flow works**

Test sequence:
1. Go to Configuración Comercial → a modality with packages
2. Edit a named package → scroll to "Opciones del paquete"
3. Click "+ Añadir grupo de opciones" → enter "Entrantes", min 3, max 3 → Create
4. Inside the group, click "+ Item" → enter "Ensalada César" → Add
5. Add more items: "Tartar de atún" with supplement 3€/pers, "Croquetas", "Gazpacho", "Carpaccio"
6. Create another group: "Principal", min 1, max 1
7. Add items with one having a supplement
8. If menus exist, test import: "+ Importar de menú" → select menu → select course → Import
9. Save the package
10. Go to the dossier preview → select the package
11. Verify option groups render with checkboxes
12. Check min/max enforcement (can't select more than max, counter shows)
13. Check supplement prices display and total calculation

- [ ] **Step 2: Verify build compiles cleanly**

Run: `npx next build --no-lint 2>&1 | tail -10`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Final commit (if any remaining changes)**

```bash
git status
# If there are uncommitted changes:
git add -A
git commit -m "fix: final adjustments for package option groups

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

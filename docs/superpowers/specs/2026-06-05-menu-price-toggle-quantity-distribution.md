# Menu Price Toggle + Guest Quantity Distribution

## Goal

Two related improvements to the package/menu system:

1. **Menu Price Toggle**: When `price_model === 'package'`, venue controls whether menu prices and supplements are visible in the dossier and editor.
2. **Guest Quantity Distribution**: When courses (menus) or option groups (packages) have "choose N" selections, couples distribute exact guest counts per dish instead of just picking items.

## Architecture

Both features modify existing components — no new tables or API routes needed.

### Feature A: Menu Price Toggle

**Current state:**
- `show_menu_prices` already exists in `sections_data` (per-proposal toggle in ProposalMenuEditor, line 450)
- `WeddingProposal` reads it: `const showMenuPrices = sd?.show_menu_prices !== false`
- When false, menu base prices are hidden but supplements (`extra_price`) still show

**Changes needed:**

1. **Add `show_menu_supplements` to `SectionsData`** (`lib/proposal-types.ts`)
   - New optional boolean, default `true`
   - When `false`, `extra_price` on menu items is hidden in dossier

2. **Auto-default when `price_model === 'package'`**
   - In `ProposalEditor.tsx` autoPatch (line ~328): when modality is package-based, set `show_menu_prices: false` and `show_menu_supplements: false` as defaults
   - Venue can override per-proposal in ProposalMenuEditor

3. **Add toggle in ProposalMenuEditor** for supplements
   - Next to existing `show_menu_prices` toggle, add `show_menu_supplements` toggle
   - Only visible when `show_menu_prices === false` (if prices shown, supplements always shown)

4. **WeddingProposal respects `show_menu_supplements`**
   - Read `sd?.show_menu_supplements !== false`
   - When false: hide `extra_price` labels on items (line 884, 900), hide supplement lines in summary (line 802-807)

5. **TemplateEditor sidebar**: When `price_model === 'package'` in commercial_config, show info badge "Precios ocultos (modo paquete)" in the menu section config

**Files touched:**
- `lib/proposal-types.ts` — add `show_menu_supplements` to SectionsData
- `components/ProposalMenuEditor.tsx` — add toggle UI
- `components/ProposalEditor.tsx` — auto-default in autoPatch
- `app/proposal/[slug]/tpl/WeddingProposal.tsx` — respect flag, hide supplements
- `components/TemplateEditor.tsx` — info badge (optional)

---

### Feature B: Guest Quantity Distribution

**Current state:**
- Menu courses support `pick_one` (radio) and `pick_n` (checkboxes with `pick_count`)
- `courseChoices` state: `Record<string, string[]>` — stores selected item names per course
- Package option groups: `PackageOptionSelector` uses checkboxes with min/max enforcement
- `pkgSelections` state: `Record<string, Record<string, string[]>>` — stores selected item IDs per group

**New behavior:**
After selecting dishes (checkboxes), a quantity distribution step appears. The couple assigns exact guest counts to each selected dish. Sum must equal total guests.

**Data model change:**
- New state alongside existing selections: `guestDistribution: Record<string, Record<string, number>>`
  - Key: course/group identifier → item name/id → guest count
- No DB changes — this is client-side state that gets submitted with the proposal form

#### Menu courses (WeddingProposal)

1. **New state**: `courseDistribution: Record<string, Record<string, number>>`
   - Key: `courseKey` (e.g., `"menu-0-c1"`) → `{ "Ensalada César": 30, "Tartar": 25 }`

2. **UI flow**:
   - Course with `pick_n`: after selecting N dishes via checkboxes, show distribution inputs below
   - Each selected dish gets a number input
   - Progress bar: "45/80 asignados" with color feedback (green when complete)
   - Validation: sum of quantities must equal allocated guests for that menu
   - Course with `pick_one`: no distribution needed (everyone gets same dish)

3. **Distribution component**: `CourseDistribution`
   - Props: `items: string[]`, `totalGuests: number`, `distribution: Record<string, number>`, `onChange`
   - Renders number inputs per item, progress bar, remaining count
   - Auto-fills last item when others sum to (total - remainder)

4. **Validation**: Add to `missingChoices` check — if `pick_n` course has selections but distribution doesn't sum to guests, flag it

5. **Submit data**: Include `courseDistribution` in the submission payload alongside `courseChoices`

#### Package option groups (PackageOptionSelector)

1. **New prop**: `guestCount: number` (already passed as `guests`)
2. **New state in templates**: `pkgDistribution: Record<string, Record<string, Record<string, number>>>`
   - `pkgId → groupId → itemId → guestCount`

3. **UI flow**:
   - After selecting items via checkboxes (existing), show distribution inputs below selected items
   - Same progress bar pattern as menu courses
   - Only show distribution when `max_selections > 1` (single selection = all guests)

4. **Component**: Add distribution section inside `PackageOptionSelector` after each group's checkboxes
   - Reuse same `GuestDistribution` sub-component from menu feature

#### Shared sub-component: `GuestDistribution`

Lives in `app/proposal/[slug]/tpl/shared.tsx`. Used by both WeddingProposal and PackageOptionSelector.

```typescript
export function GuestDistribution({
  items,           // [{ id: string, label: string }]
  totalGuests,     // number
  distribution,    // Record<string, number>
  onChange,         // (itemId: string, count: number) => void
  primary,         // color
  dark?,           // boolean
}: GuestDistributionProps)
```

**UI:**
- Horizontal row per item: `[label] ____[input]____ comensales`
- Input: `type="number"`, min 0, max `totalGuests`
- Progress bar below: filled portion = `sum / totalGuests`, color = primary when complete, warning when over
- Text: `"45 / 80 comensales asignados"` or `"✓ 80 / 80 — Completo"`
- When only 1 item remaining unassigned, auto-calculate remainder

---

## Edge Cases

1. **0 guests**: If `guest_count` is 0 or undefined, skip distribution entirely — just show checkboxes
2. **Single selection** (`pick_one` or `max_selections === 1`): No distribution needed, all guests get same dish
3. **Guest count changes**: If couple changes guest count mid-flow, reset distributions that no longer sum correctly (show warning)
4. **Menu allocation**: WeddingProposal already splits guests across menus (`effectiveAllocations`). Distribution per course uses that menu's allocated count, not total guests
5. **No price impact**: Distribution doesn't affect pricing — it's informational for the venue's kitchen planning

## Files Summary

| File | Changes |
|------|---------|
| `lib/proposal-types.ts` | Add `show_menu_supplements` to SectionsData |
| `components/ProposalMenuEditor.tsx` | Add supplements toggle |
| `components/ProposalEditor.tsx` | Auto-default prices off for package mode |
| `app/proposal/[slug]/tpl/WeddingProposal.tsx` | Respect supplements flag, add `courseDistribution` state + UI, use `GuestDistribution` |
| `app/proposal/[slug]/tpl/shared.tsx` | Add `GuestDistribution` shared component |
| `app/proposal/[slug]/tpl/T1Impacto.tsx` | Add `pkgDistribution` state, pass to `PackageOptionSelector` |
| `app/proposal/[slug]/tpl/T2Emocion.tsx` | Same as T1 |
| `app/proposal/[slug]/tpl/T5Minimalista.tsx` | Same as T1 |
| `components/TemplateEditor.tsx` | Info badge for package mode |

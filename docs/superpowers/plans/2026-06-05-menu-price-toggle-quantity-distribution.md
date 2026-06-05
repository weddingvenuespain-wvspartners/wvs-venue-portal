# Menu Price Toggle + Guest Quantity Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add venue-controlled menu price/supplement visibility and guest-per-dish quantity distribution to both menu courses and package option groups.

**Architecture:** Feature A adds `show_menu_supplements` flag to SectionsData, respected by WeddingProposal and toggled in ProposalMenuEditor. Feature B adds a shared `GuestDistribution` component used by both WeddingProposal (courses) and PackageOptionSelector (option groups), with state managed in each consumer.

**Tech Stack:** Next.js 15, React, TypeScript, inline styles, Supabase (no DB changes needed)

---

### Task 1: Add `show_menu_supplements` to SectionsData type

**Files:**
- Modify: `lib/proposal-types.ts:200`

- [ ] **Step 1: Add the type field**

In `lib/proposal-types.ts`, find line 200:

```typescript
  show_menu_prices?: boolean        // default true; false = menus shown without price (price comes from proposal estimate)
```

Add after it:

```typescript
  show_menu_supplements?: boolean   // default true; false = hide extra_price on menu items (used with show_menu_prices=false in package mode)
```

- [ ] **Step 2: Commit**

```bash
git add lib/proposal-types.ts
git commit -m "feat: add show_menu_supplements to SectionsData type

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Add supplements toggle in ProposalMenuEditor

**Files:**
- Modify: `components/ProposalMenuEditor.tsx:455`

- [ ] **Step 1: Add toggle UI after the existing show_menu_prices toggle**

In `components/ProposalMenuEditor.tsx`, find the closing `</div>` of the `show_menu_prices` toggle block (line 455). After it, add:

```tsx
            {/* Show supplements toggle — only when prices hidden */}
            {sections.show_menu_prices === false && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>Mostrar suplementos</div>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>
                    Muestra suplementos por plato (+X€/pers) aunque el precio base esté oculto
                  </div>
                </div>
                <button
                  type="button" role="switch" aria-checked={sections.show_menu_supplements !== false}
                  onClick={() => setSections(s => ({ ...s, show_menu_supplements: s.show_menu_supplements === false ? true : false }))}
                  style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0, background: sections.show_menu_supplements !== false ? 'var(--gold)' : 'var(--warm-gray)', position: 'relative', transition: 'background .2s' }}>
                  <span style={{ position: 'absolute', top: 3, left: sections.show_menu_supplements !== false ? 21 : 3, width: 16, height: 16, borderRadius: 8, background: '#fff', transition: 'left .2s' }} />
                </button>
              </div>
            )}
```

- [ ] **Step 2: Commit**

```bash
git add components/ProposalMenuEditor.tsx
git commit -m "feat: add show_menu_supplements toggle in ProposalMenuEditor

Only visible when show_menu_prices is off. Lets venue control
whether supplement prices show even when base price is hidden.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Auto-default prices off for package mode in ProposalEditor

**Files:**
- Modify: `components/ProposalEditor.tsx:327-337`

- [ ] **Step 1: Add auto-defaults in autoPatch**

In `components/ProposalEditor.tsx`, find the comment `// Task 4: Auto-populate packages from modality packages` (line 327). Right BEFORE that block, add:

```typescript
        // Auto-hide menu prices when price_model is package
        if (!fromTemplate && cfg.price_model === 'package') {
          if (autoPatch.show_menu_prices === undefined) autoPatch.show_menu_prices = false
          if (autoPatch.show_menu_supplements === undefined) autoPatch.show_menu_supplements = false
        }
```

- [ ] **Step 2: Commit**

```bash
git add components/ProposalEditor.tsx
git commit -m "feat: auto-hide menu prices when price_model is package

New proposals in package mode default to hidden prices and supplements.
Venue can override per-proposal via ProposalMenuEditor toggles.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: WeddingProposal respects `show_menu_supplements`

**Files:**
- Modify: `app/proposal/[slug]/tpl/WeddingProposal.tsx`

- [ ] **Step 1: Read the flag**

In `WeddingProposal.tsx`, find line 91:

```typescript
  const showMenuPrices = sd?.show_menu_prices !== false
```

Add after it:

```typescript
  const showMenuSupplements = sd?.show_menu_supplements !== false
```

- [ ] **Step 2: Hide supplement labels on menu items**

In `CourseBlock` component (line 858), the component receives no knowledge of `showMenuSupplements`. Pass it as a prop.

Change the `CourseBlock` function signature from:

```typescript
function CourseBlock({ course, courseKey, selected, onToggle }: {
  course: MenuCourse; courseKey: string; selected: string[]
  onToggle: (key: string, name: string, mode: 'pick_one' | 'pick_n', count: number) => void
}) {
```

To:

```typescript
function CourseBlock({ course, courseKey, selected, onToggle, showSupplements = true }: {
  course: MenuCourse; courseKey: string; selected: string[]
  onToggle: (key: string, name: string, mode: 'pick_one' | 'pick_n', count: number) => void
  showSupplements?: boolean
}) {
```

Then on line 884 (fixed item extra_price), change:

```tsx
                {item.extra_price && <span className={styles.wpItemExtra}>+{item.extra_price}/pers.</span>}
```

To:

```tsx
                {showSupplements && item.extra_price && <span className={styles.wpItemExtra}>+{item.extra_price}/pers.</span>}
```

And on line 900 (pick item extra_price), change:

```tsx
              {item.extra_price && <span className={styles.wpItemExtra}>+{item.extra_price}/pers.</span>}
```

To:

```tsx
              {showSupplements && item.extra_price && <span className={styles.wpItemExtra}>+{item.extra_price}/pers.</span>}
```

- [ ] **Step 3: Pass showSupplements to all CourseBlock usages**

Find all `<CourseBlock` usages in WeddingProposal and add `showSupplements={showMenuSupplements}` prop. There should be one usage in the menu card rendering.

- [ ] **Step 4: Hide supplement lines in the price summary**

In the price summary section (line 795-809), wrap the supplements block in a `showMenuSupplements` guard:

Find:
```tsx
              {menus.flatMap(m => {
                const i = menus.indexOf(m); const id = menuId(m, i)
                const count = effectiveAllocations[id] || 0
                if (!count) return []
                return (m.courses ?? []).flatMap((c, ci) =>
                  (courseChoices[`${id}-c${ci}`] || []).map(name => {
                    const item = c.items.find(it => it.name === name)
                    if (!item?.extra_price) return null
```

Add `if (!showMenuSupplements) return []` right after `if (!count) return []`:

```tsx
              {menus.flatMap(m => {
                const i = menus.indexOf(m); const id = menuId(m, i)
                const count = effectiveAllocations[id] || 0
                if (!count) return []
                if (!showMenuSupplements) return []
                return (m.courses ?? []).flatMap((c, ci) =>
```

- [ ] **Step 5: Exclude supplement costs from total when hidden**

In the `total` calculation (line 157-192), find the inner loop (line 165-168):

```typescript
      m.courses?.forEach((c, ci) => {
        ;(courseChoices[`${id}-c${ci}`] || []).forEach(name => {
          const item = c.items.find(it => it.name === name)
          if (item?.extra_price) menuTotal += parsePrice(item.extra_price) * count
        })
      })
```

Wrap the supplement addition in a guard:

```typescript
      if (showMenuSupplements) {
        m.courses?.forEach((c, ci) => {
          ;(courseChoices[`${id}-c${ci}`] || []).forEach(name => {
            const item = c.items.find(it => it.name === name)
            if (item?.extra_price) menuTotal += parsePrice(item.extra_price) * count
          })
        })
      }
```

- [ ] **Step 6: Commit**

```bash
git add app/proposal/[slug]/tpl/WeddingProposal.tsx
git commit -m "feat: WeddingProposal respects show_menu_supplements flag

Hides supplement labels on items, supplement lines in summary,
and excludes supplement costs from total when flag is false.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: GuestDistribution shared component

**Files:**
- Modify: `app/proposal/[slug]/tpl/shared.tsx` (add at end)

- [ ] **Step 1: Add GuestDistribution component**

At the end of `app/proposal/[slug]/tpl/shared.tsx` (after `PackageOptionSelector`), add:

```typescript
// ── GuestDistribution ─────────────────────────────────────────────────────
// Number inputs to distribute exact guest counts across selected dishes.
// Used by both WeddingProposal (menu courses) and PackageOptionSelector (option groups).

export function GuestDistribution({
  items,
  totalGuests,
  distribution,
  onChange,
  primary,
  dark = false,
}: {
  items: Array<{ id: string; label: string }>
  totalGuests: number
  distribution: Record<string, number>
  onChange: (itemId: string, count: number) => void
  primary: string
  dark?: boolean
}) {
  if (!items.length || totalGuests <= 0) return null

  const text = dark ? 'rgba(255,255,255,.88)' : '#181410'
  const sub = dark ? 'rgba(255,255,255,.50)' : '#6a6560'
  const border = dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.08)'
  const rgb = toRgb(primary)

  const assigned = items.reduce((sum, it) => sum + (distribution[it.id] || 0), 0)
  const remaining = totalGuests - assigned
  const complete = assigned === totalGuests
  const over = assigned > totalGuests

  // Auto-fill last empty item
  const emptyItems = items.filter(it => !distribution[it.id])
  const autoFillId = emptyItems.length === 1 && remaining > 0 ? emptyItems[0].id : null

  return (
    <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 8, border: `1px solid ${border}`, background: dark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)' }}>
      <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: sub, marginBottom: 10 }}>
        Reparto por comensal
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(it => {
          const val = distribution[it.id] || 0
          const isAutoFill = it.id === autoFillId
          return (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, fontSize: '.82rem', color: text }}>{it.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  min={0}
                  max={totalGuests}
                  value={isAutoFill && val === 0 ? remaining : val}
                  onChange={e => {
                    const n = Math.max(0, Math.min(totalGuests, parseInt(e.target.value) || 0))
                    onChange(it.id, n)
                  }}
                  onFocus={e => {
                    if (isAutoFill && val === 0) onChange(it.id, remaining)
                  }}
                  style={{
                    width: 70, textAlign: 'center', fontSize: '.84rem', fontWeight: 600,
                    padding: '6px 8px', borderRadius: 6,
                    border: `1.5px solid ${isAutoFill && val === 0 ? primary : border}`,
                    background: dark ? 'rgba(255,255,255,.06)' : '#fff',
                    color: text, outline: 'none',
                  }}
                />
                <span style={{ fontSize: '.72rem', color: sub, whiteSpace: 'nowrap' }}>pers.</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 12 }}>
        <div style={{ height: 4, borderRadius: 2, background: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2, transition: 'width .2s, background .2s',
            width: `${Math.min(100, (assigned / totalGuests) * 100)}%`,
            background: over ? '#e53e3e' : complete ? primary : `rgba(${rgb},.5)`,
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '.72rem' }}>
          <span style={{ color: over ? '#e53e3e' : complete ? primary : sub, fontWeight: complete || over ? 600 : 400 }}>
            {complete ? `✓ ${assigned} / ${totalGuests} — Completo` : over ? `⚠ ${assigned} / ${totalGuests} — Excedido` : `${assigned} / ${totalGuests} comensales asignados`}
          </span>
          {!complete && !over && remaining > 0 && (
            <span style={{ color: sub }}>{remaining} restantes</span>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/proposal/[slug]/tpl/shared.tsx
git commit -m "feat: add GuestDistribution shared component

Number inputs with progress bar for distributing guests across dishes.
Supports auto-fill of last remaining item and over/complete states.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Integrate GuestDistribution into WeddingProposal

**Files:**
- Modify: `app/proposal/[slug]/tpl/WeddingProposal.tsx`

- [ ] **Step 1: Import GuestDistribution**

Add `GuestDistribution` to the imports from shared. Find the existing import line that imports from `./shared` and add `GuestDistribution`.

- [ ] **Step 2: Add courseDistribution state**

After the `courseChoices` state (around line 128), add:

```typescript
  const [courseDistribution, setCourseDistribution] = useState<Record<string, Record<string, number>>>({})
  // courseDistribution[courseKey][itemName] = guestCount
```

- [ ] **Step 3: Add distribution validation to missingChoices**

In the `missingChoices` memo (line 194-207), after the existing `if (picks.length < expected)` check, add a distribution check. Replace the entire memo:

```typescript
  const missingChoices = useMemo<string[]>(() => {
    const missing: string[] = []
    menus.forEach((m, i) => {
      const id = menuId(m, i)
      const menuGuests = effectiveAllocations[id] || 0
      if (!menuGuests) return
      m.courses?.forEach((c, ci) => {
        if (!c.mode || c.mode === 'fixed') return
        const courseKey = `${id}-c${ci}`
        const picks = courseChoices[courseKey] || []
        const expected = c.mode === 'pick_one' ? 1 : (c.pick_count || 1)
        if (picks.length < expected) { missing.push(`${m.name}: ${c.label}`); return }
        // Distribution check: pick_n with >1 selection needs guest distribution summing to menu guests
        if (c.mode === 'pick_n' && picks.length > 1 && menuGuests > 0) {
          const dist = courseDistribution[courseKey] ?? {}
          const total = picks.reduce((sum, name) => sum + (dist[name] || 0), 0)
          if (total !== menuGuests) missing.push(`${m.name}: ${c.label} (reparto)`)
        }
      })
    })
    return missing
  }, [menus, effectiveAllocations, courseChoices, courseDistribution])
```

- [ ] **Step 4: Include courseDistribution in submit payload**

In `handleSubmit` (line 261-267), find the `course_choices` line in the payload:

```typescript
            course_choices: Object.fromEntries((m.courses ?? []).map((c, ci) => [c.label, courseChoices[`${id}-c${ci}`] || []]))
```

Change to include distribution:

```typescript
            course_choices: Object.fromEntries((m.courses ?? []).map((c, ci) => {
              const courseKey = `${id}-c${ci}`
              return [c.label, { selected: courseChoices[courseKey] || [], distribution: courseDistribution[courseKey] ?? {} }]
            }))
```

- [ ] **Step 5: Pass courseDistribution to CourseBlock and render GuestDistribution**

Extend `CourseBlock` signature to accept distribution props. Change the function signature to:

```typescript
function CourseBlock({ course, courseKey, selected, onToggle, showSupplements = true, menuGuests = 0, distribution, onDistributionChange }: {
  course: MenuCourse; courseKey: string; selected: string[]
  onToggle: (key: string, name: string, mode: 'pick_one' | 'pick_n', count: number) => void
  showSupplements?: boolean
  menuGuests?: number
  distribution?: Record<string, number>
  onDistributionChange?: (itemName: string, count: number) => void
}) {
```

At the end of `CourseBlock`, before the closing `</div>` of `wpCourse`, add:

```tsx
      {/* Guest distribution for pick_n with multiple selections */}
      {mode === 'pick_n' && selected.length > 1 && menuGuests > 0 && onDistributionChange && (
        <GuestDistribution
          items={selected.map(name => ({ id: name, label: name }))}
          totalGuests={menuGuests}
          distribution={distribution ?? {}}
          onChange={(itemName, count) => onDistributionChange(itemName, count)}
          primary="var(--gold, #C4975A)"
          dark={false}
        />
      )}
```

- [ ] **Step 6: Pass distribution props at CourseBlock call site**

Find where `CourseBlock` is rendered (in the menu card section). Add the new props:

```tsx
<CourseBlock
  course={c}
  courseKey={courseKey}
  selected={courseChoices[courseKey] || []}
  onToggle={togglePick}
  showSupplements={showMenuSupplements}
  menuGuests={effectiveAllocations[id] || 0}
  distribution={courseDistribution[courseKey]}
  onDistributionChange={(itemName, count) => {
    setCourseDistribution(prev => ({
      ...prev,
      [courseKey]: { ...(prev[courseKey] ?? {}), [itemName]: count }
    }))
  }}
/>
```

Note: `CourseBlock` needs the `GuestDistribution` import. Since `CourseBlock` is defined in the same file as `WeddingProposal`, and `GuestDistribution` is imported at the top, it's available.

- [ ] **Step 7: Commit**

```bash
git add app/proposal/[slug]/tpl/WeddingProposal.tsx
git commit -m "feat: integrate GuestDistribution into WeddingProposal courses

Courses with pick_n and multiple selections show quantity inputs
for distributing guests per dish. Validated before submit.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Integrate GuestDistribution into PackageOptionSelector

**Files:**
- Modify: `app/proposal/[slug]/tpl/shared.tsx`

- [ ] **Step 1: Extend PackageOptionSelector props**

Change the `PackageOptionSelector` props to accept distribution state:

```typescript
export function PackageOptionSelector({
  groups,
  selections,
  onToggle,
  primary,
  dark = false,
  guests = 0,
  basePrice = 0,
  distribution,
  onDistributionChange,
}: {
  groups: OptionGroupDisplay[]
  selections: Record<string, string[]>
  onToggle: (groupId: string, itemId: string) => void
  primary: string
  dark?: boolean
  guests?: number
  basePrice?: number
  distribution?: Record<string, Record<string, number>>  // groupId → itemId → guestCount
  onDistributionChange?: (groupId: string, itemId: string, count: number) => void
}) {
```

- [ ] **Step 2: Render GuestDistribution after each group's checkboxes**

Inside the `groups.map(g => ...)` block, after the items `</div>` (the flex column with checkboxes), add:

```tsx
            {/* Guest distribution when multiple items selected */}
            {g.max_selections > 1 && sel.length > 1 && guests > 0 && onDistributionChange && (
              <GuestDistribution
                items={sel.map(itemId => {
                  const item = g.items.find(it => it.id === itemId)
                  return { id: itemId, label: item?.name ?? itemId }
                })}
                totalGuests={guests}
                distribution={distribution?.[g.id] ?? {}}
                onChange={(itemId, count) => onDistributionChange(g.id, itemId, count)}
                primary={primary}
                dark={dark}
              />
            )}
```

- [ ] **Step 3: Commit**

```bash
git add app/proposal/[slug]/tpl/shared.tsx
git commit -m "feat: integrate GuestDistribution into PackageOptionSelector

Shows quantity inputs when multiple items selected in a group.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Wire distribution state in templates (T5, T1, T2)

**Files:**
- Modify: `app/proposal/[slug]/tpl/T5Minimalista.tsx`
- Modify: `app/proposal/[slug]/tpl/T1Impacto.tsx`
- Modify: `app/proposal/[slug]/tpl/T2Emocion.tsx`

- [ ] **Step 1: Add pkgDistribution state to T5Minimalista**

In `T5Minimalista.tsx`, find the `pkgSelections` state. After it, add:

```typescript
  const [pkgDistribution, setPkgDistribution] = useState<Record<string, Record<string, Record<string, number>>>>({})
  // pkgDistribution[packageId][groupId][itemId] = guestCount
```

Then find where `<PackageOptionSelector` is rendered and add the new props:

```tsx
<PackageOptionSelector
  groups={groups}
  selections={pkgSelections[selectedPackageId] ?? {}}
  onToggle={toggleOption}
  primary={primary}
  dark={false}
  guests={(data as any).guest_count ?? 0}
  basePrice={parseFloat(String(pkg.price ?? '').replace(/[^\d.]/g, '')) || 0}
  distribution={pkgDistribution[selectedPackageId] ?? {}}
  onDistributionChange={(groupId, itemId, count) => {
    if (!selectedPackageId) return
    setPkgDistribution(prev => ({
      ...prev,
      [selectedPackageId]: {
        ...(prev[selectedPackageId] ?? {}),
        [groupId]: { ...((prev[selectedPackageId] ?? {})[groupId] ?? {}), [itemId]: count }
      }
    }))
  }}
/>
```

- [ ] **Step 2: Same changes in T1Impacto**

In `T1Impacto.tsx`, add `pkgDistribution` state after `pkgSelections`. Then find `<PackageOptionSelector` and add the same `distribution` and `onDistributionChange` props. Use `dark={!lightMode}` as the template already does.

- [ ] **Step 3: Same changes in T2Emocion**

In `T2Emocion.tsx`, add `pkgDistribution` state after `pkgSelections`. Then find `<PackageOptionSelector` and add the same props. Use `dark={false}`.

- [ ] **Step 4: Commit all three**

```bash
git add app/proposal/[slug]/tpl/T5Minimalista.tsx app/proposal/[slug]/tpl/T1Impacto.tsx app/proposal/[slug]/tpl/T2Emocion.tsx
git commit -m "feat: wire pkgDistribution state into T1, T2, T5 templates

Pass distribution and onDistributionChange to PackageOptionSelector.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Verification

- [ ] **Step 1: Verify full flow**

Test checklist:
1. Create new proposal with `price_model === 'package'` → verify `show_menu_prices` and `show_menu_supplements` auto-default to false
2. In ProposalMenuEditor → verify prices hidden, supplements toggle visible and works
3. In dossier → verify menu prices hidden, supplements hidden/shown per flag
4. In dossier menu → select 3 dishes in pick_n course → verify distribution inputs appear
5. Enter guest counts → verify progress bar, auto-fill last item, sum validation
6. In dossier packages → select items in option group → verify distribution inputs appear
7. Submit form → verify courseDistribution included in payload

- [ ] **Step 2: Final commit if needed**

```bash
git status
# If uncommitted changes:
git add <changed-files>
git commit -m "fix: final adjustments for menu price toggle + quantity distribution

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

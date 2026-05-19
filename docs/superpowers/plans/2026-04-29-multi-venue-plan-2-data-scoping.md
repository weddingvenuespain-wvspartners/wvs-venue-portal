# Multi-Venue Data Scoping — Implementation Plan (Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope all operational data (leads, proposals, calendar, modalities) to the active venue. Each venue gets its own subscription, enforced in the API and in the admin CRM.

**Architecture:** Add `venue_id` (FK → `user_venues.id`) to five tables, backfill all existing rows to their primary venue, then replace all `.eq('user_id', …)` data filters with `.eq('venue_id', activeVenue.id)`. Subscription API accepts `?venue_id` param; auth context re-fetches the subscription whenever the active venue changes. Admin CRM loops over venues to show one subscription block each.

**Tech Stack:** Next.js 15 App Router, Supabase SSR (service-role for migrations), TypeScript

---

## File Map

| File | Action | What changes |
|---|---|---|
| Supabase DB | Migration | `venue_id` column on 5 tables + backfill |
| `app/leads/page.tsx` | Modify | destructure `activeVenue`; replace `user_id` filter with `venue_id` in all leads + calendar_entries queries |
| `app/calendario/page.tsx` | Modify | same — calendar_entries, leads, venue_modalities |
| `app/proposals/page.tsx` | Modify | same — proposals, leads queries |
| `app/api/leads/create/route.ts` | Modify | look up `venue_id` from `user_venues`, insert it into lead |
| `app/api/auth/subscription/route.ts` | Modify | accept `?venue_id` query param, add `.eq('venue_id', venueId)` when present |
| `lib/auth-context.tsx` | Modify | useEffect re-fetches subscription for `activeVenue.id` on venue switch |
| `app/admin/page.tsx` | Modify | `Subscription` type gains `venue_id`; `UserVenue` type gains `name`; subscription tab loops over venues |

---

## Task 1: DB migrations — add venue_id to 5 tables

**Files:**
- Supabase SQL migration (apply via MCP `apply_migration`)

- [ ] **Step 1: Apply the DDL migration**

```sql
-- leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES user_venues(id) ON DELETE SET NULL;

-- proposals
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES user_venues(id) ON DELETE SET NULL;

-- calendar_entries
ALTER TABLE calendar_entries
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES user_venues(id) ON DELETE SET NULL;

-- venue_modalities
ALTER TABLE venue_modalities
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES user_venues(id) ON DELETE SET NULL;

-- venue_subscriptions
ALTER TABLE venue_subscriptions
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES user_venues(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Backfill all 5 tables to primary venue**

```sql
-- leads → primary venue of their owner
UPDATE leads l
SET venue_id = uv.id
FROM user_venues uv
WHERE uv.user_id = l.user_id
  AND uv.is_primary = true
  AND l.venue_id IS NULL;

-- proposals → primary venue of their owner
UPDATE proposals p
SET venue_id = uv.id
FROM user_venues uv
WHERE uv.user_id = p.user_id
  AND uv.is_primary = true
  AND p.venue_id IS NULL;

-- calendar_entries → primary venue of their owner
UPDATE calendar_entries ce
SET venue_id = uv.id
FROM user_venues uv
WHERE uv.user_id = ce.user_id
  AND uv.is_primary = true
  AND ce.venue_id IS NULL;

-- venue_modalities → primary venue of their owner
UPDATE venue_modalities vm
SET venue_id = uv.id
FROM user_venues uv
WHERE uv.user_id = vm.user_id
  AND uv.is_primary = true
  AND vm.venue_id IS NULL;

-- venue_subscriptions → primary venue of their owner
UPDATE venue_subscriptions vs
SET venue_id = uv.id
FROM user_venues uv
WHERE uv.user_id = vs.user_id
  AND uv.is_primary = true
  AND vs.venue_id IS NULL;
```

- [ ] **Step 3: Verify backfill**

Run via `execute_sql`:
```sql
SELECT
  (SELECT count(*) FROM leads             WHERE venue_id IS NULL) AS leads_null,
  (SELECT count(*) FROM proposals         WHERE venue_id IS NULL) AS proposals_null,
  (SELECT count(*) FROM calendar_entries  WHERE venue_id IS NULL) AS calendar_null,
  (SELECT count(*) FROM venue_modalities  WHERE venue_id IS NULL) AS modalities_null,
  (SELECT count(*) FROM venue_subscriptions WHERE venue_id IS NULL) AS subs_null;
```

All counts should be 0 (or close to 0 — rows with no user_venues entry will remain null, which is fine).

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "db: add venue_id to leads, proposals, calendar_entries, venue_modalities, venue_subscriptions; backfill to primary venue"
```

---

## Task 2: Leads page — scope queries to active venue

**Files:**
- Modify: `app/leads/page.tsx`

The file uses two patterns: `.eq('user_id', user!.id)` (direct) and `.eq('user_id', userId)` (via a local variable). Both need to change for leads and calendar_entries table queries. Queries on `venue_settings`, `venue_plans`, or other non-venue tables stay on `user_id`.

- [ ] **Step 1: Add `activeVenue` to the `useAuth()` destructure**

Find (near top of the leads page component function, around where `user` is destructured):
```typescript
const { user } = useAuth()
```
or
```typescript
const { user, profile } = useAuth()
```

Replace to add `activeVenue`:
```typescript
const { user, profile, activeVenue } = useAuth()
```

- [ ] **Step 2: Add guard — bail if no active venue**

In the main `load` async function (around line 443), find the opening lines:
```typescript
const load = async () => {
  setLoading(true)
  const supabase = createClient()
  const { data } = await supabase.from('leads').select('*')
    .eq('user_id', user!.id).order('created_at', { ascending: false })
```

Replace with:
```typescript
const load = async () => {
  if (!activeVenue) return
  setLoading(true)
  const supabase = createClient()
  const { data } = await supabase.from('leads').select('*')
    .eq('venue_id', activeVenue.id).order('created_at', { ascending: false })
```

- [ ] **Step 3: Replace remaining `.eq('user_id', user!.id)` for leads + calendar_entries tables**

For every query on `leads` or `calendar_entries` that uses `.eq('user_id', user!.id)`, replace with `.eq('venue_id', activeVenue!.id)`.

Leave `.eq('user_id', user!.id)` or `.eq('user_id', userId)` unchanged on other tables (`venue_settings`, `venue_plans`, `venue_payment_history`, etc.).

Key occurrences to change (use grep to find all, verify the table name on the line or nearby lines):
- Line 550: `supabase.from('leads')...eq('user_id', user!.id)` → `venue_id`
- Line 609: `supabase.from('leads')...eq('user_id', user!.id)` → `venue_id`
- Line 644: `supabase.from('leads')...eq('user_id', user!.id)` → `venue_id`
- Line 780: `supabase.from('calendar_entries')...eq('user_id', user!.id)` → `venue_id`
- Lines 797, 810, 823: `calendar_entries`/`leads` → `venue_id`
- Line 880: check table, replace if leads/calendar
- Line 1403: `calendar_entries` → `venue_id`

For the `userId` variable pattern (lines 4593–6854), find where `userId` is declared in that function scope and replace the value:

Search for:
```typescript
const userId = user!.id
```
or
```typescript
const userId = user?.id
```

Replace with:
```typescript
const userId = activeVenue?.id ?? user!.id
```

This makes all queries in that scope use venue_id automatically without changing every individual line.

- [ ] **Step 4: Update the new-leads count badge dep (Sidebar.tsx is separate — skip)**

The badge in Sidebar.tsx still uses `user_id` — that's fine for now, it's the aggregate count. Leave it.

- [ ] **Step 5: Reload effect deps — add `activeVenue?.id`**

Find the main `useEffect` that calls `load()` or `loadLeads()`. Its dep array likely has `[user?.id]`. Add `activeVenue?.id`:

```typescript
useEffect(() => { if (user && activeVenue) load() }, [user?.id, activeVenue?.id]) // eslint-disable-line
```

- [ ] **Step 6: Commit**

```bash
git add app/leads/page.tsx
git commit -m "feat: scope leads + calendar_entries queries to activeVenue.id"
```

---

## Task 3: Calendar page — scope queries to active venue

**Files:**
- Modify: `app/calendario/page.tsx`

- [ ] **Step 1: Add `activeVenue` to `useAuth()` destructure**

Find:
```typescript
const { user } = useAuth()
```

Replace:
```typescript
const { user, activeVenue } = useAuth()
```

- [ ] **Step 2: Update the 3 main queries at load time (around lines 203–205)**

Find:
```typescript
supabase.from('calendar_entries').select('*').eq('user_id', user!.id).gte('date', from).lte('date', to),
supabase.from('leads').select('id,name,email,phone,whatsapp,wedding_date,wedding_date_to,wedding_date_ranges,date_flexibility,wedding_year,wedding_month,guests,status,budget,ceremony_type,visit_date,visit_time,visit_duration,notes,budget_date,budget_date_to,budget_date_ranges,budget_date_flexibility').eq('user_id', user!.id).order('wedding_date', { ascending: true }),
supabase.from('venue_modalities').select('id,name,duration_type,packages:venue_modality_packages(id,day_from,day_to,label,sort_order)').eq('user_id', user!.id).order('sort_order'),
```

Replace with:
```typescript
supabase.from('calendar_entries').select('*').eq('venue_id', activeVenue!.id).gte('date', from).lte('date', to),
supabase.from('leads').select('id,name,email,phone,whatsapp,wedding_date,wedding_date_to,wedding_date_ranges,date_flexibility,wedding_year,wedding_month,guests,status,budget,ceremony_type,visit_date,visit_time,visit_duration,notes,budget_date,budget_date_to,budget_date_ranges,budget_date_flexibility').eq('venue_id', activeVenue!.id).order('wedding_date', { ascending: true }),
supabase.from('venue_modalities').select('id,name,duration_type,packages:venue_modality_packages(id,day_from,day_to,label,sort_order)').eq('venue_id', activeVenue!.id).order('sort_order'),
```

- [ ] **Step 3: Replace remaining `user_id` filters on calendar_entries and leads**

Lines 1048, 1269, 1319, 1325 — check each one's table name and replace `user_id` with `venue_id` if on `calendar_entries` or `leads`.

For the `userId` variable pattern (same as leads page):

Find:
```typescript
const userId = user!.id
```
or
```typescript
const userId = user?.id
```

Replace with:
```typescript
const userId = activeVenue?.id ?? user!.id
```

- [ ] **Step 4: Guard + reload dep**

In the load function, add a guard:
```typescript
if (!activeVenue) return
```

Update the useEffect dep array to include `activeVenue?.id`.

- [ ] **Step 5: Commit**

```bash
git add app/calendario/page.tsx
git commit -m "feat: scope calendar_entries, leads, venue_modalities queries to activeVenue.id"
```

---

## Task 4: Proposals page — scope queries to active venue

**Files:**
- Modify: `app/proposals/page.tsx`

- [ ] **Step 1: Add `activeVenue` to `useAuth()` destructure**

Find:
```typescript
const { user } = useAuth()
```
or
```typescript
const { user, profile } = useAuth()
```

Add `activeVenue`:
```typescript
const { user, profile, activeVenue } = useAuth()
```

- [ ] **Step 2: Update the proposals + leads queries (around lines 105–107)**

Find:
```typescript
supabase.from('proposals').select('*, branding:proposal_branding(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
supabase.from('leads').select('id, name, email').eq('user_id', user.id).order('created_at', { ascending: false }),
supabase.from('venue_onboarding').select('smtp_from_email').eq('user_id', user.id).maybeSingle(),
```

Replace:
```typescript
supabase.from('proposals').select('*, branding:proposal_branding(*)').eq('venue_id', activeVenue!.id).order('created_at', { ascending: false }),
supabase.from('leads').select('id, name, email').eq('venue_id', activeVenue!.id).order('created_at', { ascending: false }),
supabase.from('venue_onboarding').select('smtp_from_email').eq('user_id', user.id).maybeSingle(),
```

Note: `venue_onboarding` stays `user_id` — it's account-level, not venue-level.

- [ ] **Step 3: Guard + reload dep**

Add guard at start of load function:
```typescript
if (!activeVenue) return
```

Update useEffect dep to include `activeVenue?.id`.

- [ ] **Step 4: New proposal creation — pass venue_id**

In `app/proposals/new/page.tsx`, find the `insert` payload and add `venue_id`:

Find the insert call (around where `user_id` is set in the payload):
```typescript
const payload: any = {
  user_id: user.id,
  // ... other fields
}
```

Add:
```typescript
const payload: any = {
  user_id: user.id,
  venue_id: activeVenue?.id ?? null,
  // ... other fields
}
```

Also add `activeVenue` to the `useAuth()` destructure in that file.

- [ ] **Step 5: Commit**

```bash
git add app/proposals/page.tsx app/proposals/new/page.tsx
git commit -m "feat: scope proposals + leads queries to activeVenue.id"
```

---

## Task 5: Leads create API — set venue_id on insert

**Files:**
- Modify: `app/api/leads/create/route.ts`

- [ ] **Step 1: Look up venue_id from user_venues after finding user_id**

Find (after the `venue_profiles` lookup):
```typescript
    if (!profile?.user_id) {
      return NextResponse.json({ error: 'Venue not found', wp_venue_id }, { status: 404 })
    }
```

Replace with:
```typescript
    if (!profile?.user_id) {
      return NextResponse.json({ error: 'Venue not found', wp_venue_id }, { status: 404 })
    }

    // Look up the user_venues row so we can store venue_id on the lead
    const { data: venueRow } = await svc
      .from('user_venues')
      .select('id')
      .eq('user_id', profile.user_id)
      .eq('wp_venue_id', wp_venue_id)
      .maybeSingle()
```

- [ ] **Step 2: Add venue_id to the leads insert**

Find:
```typescript
    const { data, error } = await svc.from('leads').insert({
      user_id:      profile.user_id,
      status:       'new',
      source:       'web',
      name:         name  || '',
      email:        email || '',
      phone:        phone || '',
      guests:       guests ? String(guests) : '',
      wedding_date: wedding_date,
      notes:        notes || '',
    }).select().single()
```

Replace:
```typescript
    const { data, error } = await svc.from('leads').insert({
      user_id:      profile.user_id,
      venue_id:     venueRow?.id ?? null,
      status:       'new',
      source:       'web',
      name:         name  || '',
      email:        email || '',
      phone:        phone || '',
      guests:       guests ? String(guests) : '',
      wedding_date: wedding_date,
      notes:        notes || '',
    }).select().single()
```

- [ ] **Step 3: Commit**

```bash
git add app/api/leads/create/route.ts
git commit -m "feat: set venue_id on incoming leads from WordPress"
```

---

## Task 6: Subscription API + auth context — venue-aware

**Files:**
- Modify: `app/api/auth/subscription/route.ts`
- Modify: `lib/auth-context.tsx`

### Part A — Subscription API accepts `?venue_id`

- [ ] **Step 1: Read `app/api/auth/subscription/route.ts` and update GET handler**

Find the function signature:
```typescript
export async function GET() {
```

Replace with:
```typescript
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const venueId = searchParams.get('venue_id')
```

Then find the active subscription query:
```typescript
    const { data: activeSub, error: e1 } = await svc
      .from('venue_subscriptions')
      .select(SELECT)
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
```

Replace with:
```typescript
    let activeQuery = svc
      .from('venue_subscriptions')
      .select(SELECT)
      .eq('user_id', session.user.id)
      .eq('status', 'active')
    if (venueId) activeQuery = activeQuery.eq('venue_id', venueId)
    const { data: activeSub, error: e1 } = await activeQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
```

Then find the trial subscription query:
```typescript
    const { data: trialSub, error: e2 } = await svc
      .from('venue_subscriptions')
      .select(SELECT)
      .eq('user_id', session.user.id)
      .in('status', ['trial', 'trial_expired'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
```

Replace with:
```typescript
    let trialQuery = svc
      .from('venue_subscriptions')
      .select(SELECT)
      .eq('user_id', session.user.id)
      .in('status', ['trial', 'trial_expired'])
    if (venueId) trialQuery = trialQuery.eq('venue_id', venueId)
    const { data: trialSub, error: e2 } = await trialQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
```

### Part B — Auth context re-fetches subscription on venue switch

- [ ] **Step 2: Add venue-switch subscription re-fetch to `lib/auth-context.tsx`**

In `AuthProvider`, find the `switchVenue` function:
```typescript
  const switchVenue = (venueId: string) => {
    const venue = userVenues.find(v => v.id === venueId)
    if (!venue) return
    setActiveVenue(venue)
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_VENUE_KEY, venueId)
    }
  }
```

Replace with:
```typescript
  const switchVenue = (venueId: string) => {
    const venue = userVenues.find(v => v.id === venueId)
    if (!venue) return
    setActiveVenue(venue)
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_VENUE_KEY, venueId)
    }
    // Re-fetch subscription for the new venue (only matters for multi-venue accounts)
    if (userVenues.length > 1) {
      fetch(`/api/auth/subscription?venue_id=${venueId}`)
        .then(r => r.json())
        .then(({ subscription }) => {
          setProfile(prev => {
            if (!prev) return prev
            return {
              ...prev,
              plan:                subscription?.plan               ?? null,
              subscription_status: subscription?.status            ?? null,
              trial_end_date:      subscription?.trial_end_date    ?? null,
            }
          })
        })
        .catch(err => console.warn('[auth] Could not fetch venue subscription:', err))
    }
  }
```

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/subscription/route.ts lib/auth-context.tsx
git commit -m "feat: subscription API accepts venue_id param; auth context re-fetches on venue switch"
```

---

## Task 7: Admin CRM — subscription per venue

**Files:**
- Modify: `app/admin/page.tsx`

The goal: when a user has 2+ venues, the "Suscripción" tab shows one subscription block per venue instead of one combined block. The admin can set/update each venue's subscription independently.

### Part A — Update the Subscription type

- [ ] **Step 1: Add `venue_id` to the `Subscription` type**

Find:
```typescript
type Subscription = {
  id: string
  user_id: string
  plan_id: string
```

Add `venue_id`:
```typescript
type Subscription = {
  id: string
  user_id: string
  venue_id: string | null
  plan_id: string
```

### Part B — Update the local `UserVenue` type to include `name`

In `app/admin/page.tsx`, the local `UserVenue` type is defined separately from `lib/auth-context.tsx`. Find it:

```typescript
type UserVenue = {
  id: string
  user_id: string
  wp_venue_id: number
```

Add `name`:
```typescript
type UserVenue = {
  id: string
  user_id: string
  wp_venue_id: number
  name: string | null
```

### Part C — Fetch `name` in the userVenues query

In `loadData` (around line 1566), find the `user_venues` query:
```typescript
      supabase.from('user_venues').select('*'),
```

This already uses `*`, so `name` and `is_primary` are included automatically. No change needed.

### Part D — Subscription tab: one block per venue

In `UserPanel`, the subscription tab currently shows a single block based on `activeSub`. Replace it with a multi-venue aware version.

- [ ] **Step 2: Add `selectedVenueId` state for the subscription tab venue selector**

Find (in `UserPanel`, after existing useState declarations):
```typescript
  const [subFeedback, setSubFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
```

Add after it:
```typescript
  const [subVenueId, setSubVenueId] = useState<string>(
    userVenues.find(v => v.user_id === profile.user_id)?.id ?? ''
  )
```

- [ ] **Step 3: Add venue selector above the subscription form (only if multi-venue)**

In the subscription tab, find the opening of the subscription content section. Look for the div that wraps the subscription form (it appears after the tab condition `{tab === 'suscripcion' && (`). Add a venue selector at the very top:

After:
```typescript
          {tab === 'suscripcion' && (
            <div>
```

Add:
```typescript
          {tab === 'suscripcion' && (
            <div>
              {/* Venue selector — only shown for multi-venue users */}
              {userVenues.filter(v => v.user_id === profile.user_id).length > 1 && (
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Venue</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {userVenues.filter(v => v.user_id === profile.user_id).map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSubVenueId(v.id)}
                        style={{
                          padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                          fontFamily: 'Manrope, sans-serif', fontWeight: 600,
                          border: v.id === subVenueId ? '1.5px solid var(--gold)' : '1px solid var(--ivory)',
                          background: v.id === subVenueId ? 'var(--gold-light)' : 'transparent',
                          color: v.id === subVenueId ? 'var(--espresso)' : 'var(--warm-gray)',
                        }}
                      >
                        {v.name ?? `Venue ${v.wp_venue_id}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
```

- [ ] **Step 4: Scope `activeSub` to the selected venue**

Find (in `UserPanel`):
```typescript
  const activeSub = subscriptions
    .filter(s => s.user_id === profile.user_id)
    .sort((a, b) => (STATUS_PRIO[a.status] ?? 9) - (STATUS_PRIO[b.status] ?? 9))[0]
```

Replace with:
```typescript
  const profileVenues = userVenues.filter(v => v.user_id === profile.user_id)
  const effectiveVenueId = subVenueId || profileVenues[0]?.id
  const activeSub = subscriptions
    .filter(s => s.user_id === profile.user_id && (
      profileVenues.length <= 1 || s.venue_id === effectiveVenueId || s.venue_id == null
    ))
    .sort((a, b) => (STATUS_PRIO[a.status] ?? 9) - (STATUS_PRIO[b.status] ?? 9))[0]
```

- [ ] **Step 5: Pass `venue_id` when saving subscription**

In the save button's `onSaveSubscription` call, add `venue_id` to the payload:

Find (in the save button onClick):
```typescript
                    ...(activeSub?.id ? { id: activeSub.id } : {}),
                    user_id:              profile.user_id,
                    plan_id:              subForm.plan_id,
```

Replace:
```typescript
                    ...(activeSub?.id ? { id: activeSub.id } : {}),
                    user_id:              profile.user_id,
                    venue_id:             effectiveVenueId || null,
                    plan_id:              subForm.plan_id,
```

- [ ] **Step 6: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: admin CRM subscription tab is venue-aware for multi-venue users"
```

---

## Task 8: TypeScript check + push

- [ ] **Step 1: Full type-check**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | head -30
```

Fix any errors found. Common ones:
- `venue_id` not in `Subscription` type used in `handleSaveSubscription` payload → already fixed in Task 7 Step 1
- `activeVenue` not imported in a page → add to `useAuth()` destructure

- [ ] **Step 2: Push to main**

```bash
git push origin HEAD:main
```

---

## What's left for future work

- `venue_onboarding` / SMTP settings per venue (currently account-level)
- `estructura` page (`venue_modalities` writes) — scope create/update to `activeVenue.id`
- Pricing page venue selector (select which venue to subscribe when buying a plan)
- `venue_settings` (date rules, etc.) per venue
- New leads count badge in Sidebar scoped to active venue

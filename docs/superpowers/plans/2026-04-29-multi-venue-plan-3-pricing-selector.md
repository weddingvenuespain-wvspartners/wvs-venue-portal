# Multi-Venue Pricing Selector & Subscription Fixes — Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let multi-venue owners choose which venue they're paying for on the pricing page, and ensure the subscription is correctly linked to that venue throughout the Redsys payment flow — while confirming that second venues never receive an automatic trial.

**Architecture:** Add a `selectedVenueId` state to the pricing page (defaults to `activeVenue.id`; shows a pill selector only when `userVenues.length > 1`). Thread `venueId` from the pricing page → `localStorage` → `create-payment` body → Redsys merchantData → `notification` webhook → `venue_subscriptions.venue_id`. Fix the `activate-from-success` fallback to scope its "already active" guard per venue. Confirm `onboarding/complete` already guards correctly; improve it by setting `venue_id`. Fix `assign-venue` and `apply-changes` to set `is_primary = true` for a user's first venue row.

**Tech Stack:** Next.js 15 App Router, Supabase SSR (service-role for server routes), TypeScript, Redsys TPV (hosted redirect)

---

## File Map

| File | Action | What changes |
|---|---|---|
| `app/pricing/page.tsx` | Modify | `userVenues` + `activeVenue` from useAuth; `selectedVenueId` state; venue pill selector UI; `venueId` in localStorage + API body |
| `app/api/redsys/create-payment/route.ts` | Modify | Accept optional `venueId` in body; add to merchantData JSON |
| `app/api/redsys/notification/route.ts` | Modify | Extract `venueId` from merchantData; scope cancel to that venue; add `venue_id` to subscription insert |
| `app/api/redsys/activate-from-success/route.ts` | Modify | Accept `venueId` in body; scope "already active" check to venue; add `venue_id` to insert |
| `app/api/onboarding/complete/route.ts` | Modify | Look up primary `user_venues` row; set `venue_id` on trial; add comment about multi-venue guard |
| `app/api/admin/assign-venue/route.ts` | Modify | Set `is_primary = true` when inserting the user's first venue row |
| `app/api/venues/apply-changes/route.ts` | Modify | Set `is_primary = true` when inserting the user's first venue row |

---

## Task 1: Pricing page — venue selector UI

**Files:**
- Modify: `app/pricing/page.tsx`

### Background
Currently line 46 is:
```typescript
const { user, profile, loading: authLoading } = useAuth()
```
There is no `activeVenue` or `userVenues` on the page. `handleSelectPlan` stores `{ planId, cycleId }` in localStorage and calls `/api/redsys/create-payment` with just those two fields — no `venueId`.

### What to add
A `selectedVenueId` state (default: `activeVenue?.id ?? ''`). A venue pill row shown only when the user is logged in and has 2+ venues, placed immediately below the main `<h1>` heading. The selected venue flows into `localStorage` and the API call.

- [ ] **Step 1: Add `userVenues` and `activeVenue` to the useAuth destructure**

Find (line 46):
```typescript
  const { user, profile, loading: authLoading } = useAuth()
```

Replace with:
```typescript
  const { user, profile, loading: authLoading, userVenues, activeVenue } = useAuth()
```

- [ ] **Step 2: Add `selectedVenueId` state below the other useState declarations**

Find:
```typescript
  const formRef = useRef<HTMLFormElement>(null)
```

Add above it:
```typescript
  const [selectedVenueId, setSelectedVenueId] = useState<string>('')

  // Sync selectedVenueId when activeVenue loads (auth context is async)
  useEffect(() => {
    if (activeVenue && !selectedVenueId) {
      setSelectedVenueId(activeVenue.id)
    }
  }, [activeVenue?.id]) // eslint-disable-line

```

- [ ] **Step 3: Update `handleSelectPlan` to pass `venueId`**

Find:
```typescript
  const handleSelectPlan = async (planId: string, cycleId: string) => {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/pricing&plan=${planId}&cycle=${cycleId}`)
      return
    }

    setSubmitting(`${planId}-${cycleId}`)
    setError('')

    localStorage.setItem('wvs_pending_plan', JSON.stringify({ planId, cycleId }))

    try {
      const res = await fetch('/api/redsys/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, cycleId }),
      })
```

Replace with:
```typescript
  const handleSelectPlan = async (planId: string, cycleId: string) => {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/pricing&plan=${planId}&cycle=${cycleId}`)
      return
    }

    setSubmitting(`${planId}-${cycleId}`)
    setError('')

    const venueId = selectedVenueId || activeVenue?.id || null
    localStorage.setItem('wvs_pending_plan', JSON.stringify({ planId, cycleId, venueId }))

    try {
      const res = await fetch('/api/redsys/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, cycleId, venueId }),
      })
```

- [ ] **Step 4: Insert the venue selector UI below the `<h1>` heading**

Find:
```typescript
          <p style={{ color: 'var(--warm-gray)', fontSize: 14, maxWidth: 500, margin: '0 auto' }}>
            Potencia tu venue con las herramientas que necesitas para gestionar bodas de forma profesional.
          </p>
```

Replace with:
```typescript
          <p style={{ color: 'var(--warm-gray)', fontSize: 14, maxWidth: 500, margin: '0 auto' }}>
            Potencia tu venue con las herramientas que necesitas para gestionar bodas de forma profesional.
          </p>

          {/* Venue selector — only for multi-venue accounts */}
          {isLoggedIn && userVenues.length > 1 && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--warm-gray)', fontFamily: 'Manrope, sans-serif' }}>
                Contratar para:
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {userVenues.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVenueId(v.id)}
                    style={{
                      padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                      fontFamily: 'Manrope, sans-serif', fontWeight: 600,
                      border: v.id === selectedVenueId ? '1.5px solid var(--gold)' : '1px solid rgba(0,0,0,0.15)',
                      background: v.id === selectedVenueId ? 'rgba(196,151,90,0.12)' : 'transparent',
                      color: v.id === selectedVenueId ? 'var(--espresso)' : 'var(--warm-gray)',
                      transition: 'all 120ms',
                    }}
                  >
                    {v.name ?? `Venue ${v.wp_venue_id}`}
                  </button>
                ))}
              </div>
            </div>
          )}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "pricing" | head -10
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add app/pricing/page.tsx
git commit -m "feat: venue selector on pricing page for multi-venue owners"
```

---

## Task 2: `create-payment` API — thread venueId into merchantData

**Files:**
- Modify: `app/api/redsys/create-payment/route.ts`

- [ ] **Step 1: Accept `venueId` in body and add to merchantData**

Find:
```typescript
    const { planId, cycleId } = await req.json()
    if (!planId || !cycleId) {
      return NextResponse.json({ error: 'planId y cycleId requeridos' }, { status: 400 })
    }
```

Replace with:
```typescript
    const { planId, cycleId, venueId } = await req.json()
    if (!planId || !cycleId) {
      return NextResponse.json({ error: 'planId y cycleId requeridos' }, { status: 400 })
    }
```

Then find:
```typescript
    // Merchant data: encode userId + plan + cycle so webhook can process it
    const merchantData = JSON.stringify({
      userId: session.user.id,
      planId: plan.id,
      cycleId: cycle.id,
      intervalMonths: cycle.interval_months,
    })
```

Replace with:
```typescript
    // Merchant data: encode userId + plan + cycle + venue so webhook can process it
    const merchantData = JSON.stringify({
      userId: session.user.id,
      planId: plan.id,
      cycleId: cycle.id,
      intervalMonths: cycle.interval_months,
      venueId: venueId || null,
    })
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "create-payment" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/redsys/create-payment/route.ts
git commit -m "feat: thread venueId through Redsys create-payment merchantData"
```

---

## Task 3: Notification webhook — venue-scoped cancel + venue_id on insert

**Files:**
- Modify: `app/api/redsys/notification/route.ts`

### Background
Line 55 currently parses `{ userId, planId, cycleId, intervalMonths }` from merchantData. It needs to also extract `venueId`. Line 92-96 cancels **all** active/trial subscriptions for the user — with multi-venue this would wrongly cancel venue 1's subscription when venue 2 pays. The fix scopes the cancel to the paying venue.

- [ ] **Step 1: Extract `venueId` from merchantData and scope cancel**

Find:
```typescript
    let merchantData: { userId?: string; planId?: string; cycleId?: string; intervalMonths?: number } = {}
    try {
      const raw = params.Ds_MerchantData
      if (raw) merchantData = JSON.parse(raw)
    } catch { /* ignore parse errors */ }

    const { userId, planId, cycleId, intervalMonths } = merchantData
```

Replace with:
```typescript
    let merchantData: { userId?: string; planId?: string; cycleId?: string; intervalMonths?: number; venueId?: string | null } = {}
    try {
      const raw = params.Ds_MerchantData
      if (raw) merchantData = JSON.parse(raw)
    } catch { /* ignore parse errors */ }

    const { userId, planId, cycleId, intervalMonths, venueId } = merchantData
```

Then find:
```typescript
    // Cancel any existing active/trial subscriptions for this user
    await svc
      .from('venue_subscriptions')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .in('status', ['active', 'trial'])
```

Replace with:
```typescript
    // Cancel existing active/trial subscription for this user + venue
    // If venueId is set (multi-venue), only cancel that venue's subscription —
    // never touch subscriptions belonging to the user's other venues.
    let cancelQuery = svc
      .from('venue_subscriptions')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .in('status', ['active', 'trial'])
    if (venueId) cancelQuery = (cancelQuery as any).eq('venue_id', venueId)
    await cancelQuery
```

- [ ] **Step 2: Add `venue_id` to the subscription insert**

Find:
```typescript
    const subscriptionData: Record<string, any> = {
      user_id: userId,
      plan_id: planId,
      status: 'active',
      billing_cycle: cycleId || 'monthly',
      start_date: new Date().toISOString().slice(0, 10),
      renewal_date: periodEnd.toISOString().slice(0, 10),
    }
```

Replace with:
```typescript
    const subscriptionData: Record<string, any> = {
      user_id: userId,
      venue_id: venueId || null,
      plan_id: planId,
      status: 'active',
      billing_cycle: cycleId || 'monthly',
      start_date: new Date().toISOString().slice(0, 10),
      renewal_date: periodEnd.toISOString().slice(0, 10),
    }
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "notification" | head -10
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/api/redsys/notification/route.ts
git commit -m "feat: notification webhook scopes subscription cancel+create to venueId"
```

---

## Task 4: `activate-from-success` — venue-scoped guard + venue_id

**Files:**
- Modify: `app/api/redsys/activate-from-success/route.ts`

### Background
This fallback creates a subscription if the Redsys webhook hasn't fired yet. Currently it checks `.eq('user_id', userId).in('status', ['active', 'trial'])`. For a multi-venue user (venue 1 already active), this finds venue 1's subscription and returns `already_active` — **incorrectly** blocking venue 2's subscription from being created.

Fix: when `venueId` is provided, scope the "already active" check to that venue only.

- [ ] **Step 1: Accept `venueId` from body and scope the guard**

Find:
```typescript
    const userId = session.user.id
    const { planId, cycleId } = await req.json()

    if (!planId || !cycleId) {
      return NextResponse.json({ error: 'planId y cycleId requeridos' }, { status: 400 })
    }

    const svc = getServiceClient()

    // Check if user already has an active subscription (webhook already fired)
    const { data: existing } = await svc
      .from('venue_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['active', 'trial'])
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ status: 'already_active' })
    }
```

Replace with:
```typescript
    const userId = session.user.id
    const { planId, cycleId, venueId } = await req.json()

    if (!planId || !cycleId) {
      return NextResponse.json({ error: 'planId y cycleId requeridos' }, { status: 400 })
    }

    const svc = getServiceClient()

    // Check if this venue already has an active subscription (webhook already fired).
    // When venueId is provided (multi-venue), scope to that venue so we don't
    // accidentally block a second venue from getting its subscription.
    let existingQuery = svc
      .from('venue_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['active', 'trial'])
    if (venueId) existingQuery = (existingQuery as any).eq('venue_id', venueId)
    const { data: existing } = await existingQuery.limit(1).maybeSingle()

    if (existing) {
      return NextResponse.json({ status: 'already_active' })
    }
```

- [ ] **Step 2: Add `venue_id` to the subscription insert**

Find:
```typescript
    // Create subscription
    const { error: subError } = await svc.from('venue_subscriptions').insert({
      user_id: userId,
      plan_id: planId,
      status: 'active',
      billing_cycle: cycleId,
      start_date: new Date().toISOString().slice(0, 10),
      renewal_date: periodEnd.toISOString().slice(0, 10),
    })
```

Replace with:
```typescript
    // Create subscription
    const { error: subError } = await svc.from('venue_subscriptions').insert({
      user_id: userId,
      venue_id: venueId || null,
      plan_id: planId,
      status: 'active',
      billing_cycle: cycleId,
      start_date: new Date().toISOString().slice(0, 10),
      renewal_date: periodEnd.toISOString().slice(0, 10),
    })
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "activate-from-success" | head -10
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/api/redsys/activate-from-success/route.ts
git commit -m "feat: activate-from-success scopes guard and insert to venueId"
```

---

## Task 5: `onboarding/complete` — set venue_id on trial + document multi-venue guard

**Files:**
- Modify: `app/api/onboarding/complete/route.ts`

### Background
This route auto-creates a 14-day trial after a new user completes onboarding. The existing guard (`existing && existing.length > 0`) already prevents second venues from receiving an auto-trial — if the user already has a subscription (for venue 1), the route returns early. This is correct.

Two improvements:
1. Try to look up the user's primary `user_venues` row and set `venue_id` on the trial (so it shows up in venue-scoped queries from day 1).
2. Add a comment explaining why the guard is sufficient for multi-venue.

Note: at onboarding time, `user_venues` may not yet exist (admin approves the venue later). The lookup is best-effort; if nothing is found, `venue_id` stays `null` (will be backfilled when admin assigns the venue).

- [ ] **Step 1: Replace the route with the improved version**

Replace the entire file contents with:

```typescript
import { NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// POST /api/onboarding/complete
// Called after onboarding step 2 — creates a 14-day trial subscription on the basic plan.
//
// Multi-venue note: The "already has subscription" guard below ensures that if this user
// somehow triggers onboarding again (e.g., a second venue), no duplicate trial is created.
// Admin can manually grant a trial to any venue via the Admin CRM.
export async function POST() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const userId = session.user.id
    const svc = getServiceClient()

    // Guard: if user already has ANY subscription (for any venue), skip.
    // This correctly prevents auto-trial for second/third venues.
    const { data: existing } = await svc
      .from('venue_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ ok: true, message: 'Ya tiene suscripción' })
    }

    // Find basic plan (first active plan sorted by creation date)
    const { data: basicPlan } = await svc
      .from('venue_plans')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!basicPlan) {
      return NextResponse.json({ error: 'No se encontró el plan básico' }, { status: 500 })
    }

    // Best-effort: look up primary venue so trial gets a venue_id from day 1.
    // At onboarding time the user_venues row may not exist yet (admin approves later),
    // in which case venue_id stays null and is backfilled on approval.
    const { data: primaryVenue } = await svc
      .from('user_venues')
      .select('id')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .maybeSingle()

    // Create trial subscription
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14)

    const { error } = await svc
      .from('venue_subscriptions')
      .insert({
        user_id: userId,
        venue_id: primaryVenue?.id ?? null,
        plan_id: basicPlan.id,
        status: 'trial',
        trial_end_date: trialEnd.toISOString(),
      })

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[/api/onboarding/complete]', err)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "onboarding" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/onboarding/complete/route.ts
git commit -m "fix: set venue_id on trial subscription at onboarding; document multi-venue guard"
```

---

## Task 6: Fix `assign-venue` and `apply-changes` to set `is_primary` correctly

**Files:**
- Modify: `app/api/admin/assign-venue/route.ts`
- Modify: `app/api/venues/apply-changes/route.ts`

### Background
The Plan 1 migration backfilled `is_primary = true` for all existing first venues. But both `assign-venue` and `apply-changes` create/upsert `user_venues` rows without setting `is_primary`. For new users created after the migration, their first venue will have `is_primary = false` (the column default), breaking the `resolveActiveVenue` logic in the auth context.

**Fix for `assign-venue`:** The route already computes `isFirst` (line 89). Use it to set `is_primary = true` on the upsert.

**Fix for `apply-changes`:** After the upsert, check if this is the user's only venue and update `is_primary` accordingly.

### `assign-venue` fix

- [ ] **Step 1: Read lines 74-100 of `app/api/admin/assign-venue/route.ts`**

The upsert at line 76-77 is:
```typescript
    const { error: uvErr } = await svc
      .from('user_venues')
      .upsert({ user_id, wp_venue_id, subscription_id: subId }, { onConflict: 'user_id,wp_venue_id' })
```

And lines 83-89:
```typescript
    const { count } = await svc
      .from('user_venues')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)

    const isFirst = (count ?? 0) <= 1   // just inserted, so <=1 means it's the first
```

- [ ] **Step 2: Move the `isFirst` count check BEFORE the upsert, then include `is_primary` in the payload**

Find:
```typescript
    // 2. Upsert user_venues (conflict on user_id + wp_venue_id)
    const { error: uvErr } = await svc
      .from('user_venues')
      .upsert({ user_id, wp_venue_id, subscription_id: subId }, { onConflict: 'user_id,wp_venue_id' })
    if (uvErr) {
      console.error('[assign-venue] user_venues upsert error', uvErr)
      return NextResponse.json({ error: uvErr.message }, { status: 500 })
    }

    // 3. Count existing venues BEFORE this assignment to decide if it's the first
    const { count } = await svc
      .from('user_venues')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)

    const isFirst = (count ?? 0) <= 1   // just inserted, so <=1 means it's the first
```

Replace with:
```typescript
    // 2. Count existing venues BEFORE upsert to decide if this is the first
    const { count: existingCount } = await svc
      .from('user_venues')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)

    const isFirst = (existingCount ?? 0) === 0  // 0 before insert = first venue

    // Upsert user_venues — set is_primary=true only for the first venue
    const { error: uvErr } = await svc
      .from('user_venues')
      .upsert(
        { user_id, wp_venue_id, subscription_id: subId, is_primary: isFirst },
        { onConflict: 'user_id,wp_venue_id' }
      )
    if (uvErr) {
      console.error('[assign-venue] user_venues upsert error', uvErr)
      return NextResponse.json({ error: uvErr.message }, { status: 500 })
    }
```

- [ ] **Step 3: Also backfill `venue_id` on any null subscription for this user when it's their first venue**

After the upsert block (after the `if (uvErr)` check), find:

```typescript
    if (isFirst) {
      // Upsert venue_profiles (handles users who have no row yet)
```

Add a backfill step for subscriptions inside the `if (isFirst)` block:

```typescript
    if (isFirst) {
      // Backfill venue_id on any existing subscription that was created without one
      // (trial created at onboarding before user_venues existed)
      const { data: newVenue } = await svc
        .from('user_venues')
        .select('id')
        .eq('user_id', user_id)
        .eq('wp_venue_id', wp_venue_id)
        .maybeSingle()
      if (newVenue?.id) {
        await svc
          .from('venue_subscriptions')
          .update({ venue_id: newVenue.id })
          .eq('user_id', user_id)
          .is('venue_id', null)
      }

      // Upsert venue_profiles (handles users who have no row yet)
```

- [ ] **Step 4: Fix `apply-changes` — set `is_primary` on first venue**

In `app/api/venues/apply-changes/route.ts`, find:
```typescript
      // Insert into user_venues so the CRM shows the assigned venue
      await svc.from('user_venues').upsert(
        { user_id: target_user_id, wp_venue_id: resolvedWpId },
        { onConflict: 'user_id,wp_venue_id' }
      )
```

Replace with:
```typescript
      // Insert into user_venues so the CRM shows the assigned venue.
      // Set is_primary=true if this is the user's first venue.
      const { count: uvCount } = await svc
        .from('user_venues')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', target_user_id)
      const isFirstVenue = (uvCount ?? 0) === 0

      await svc.from('user_venues').upsert(
        { user_id: target_user_id, wp_venue_id: resolvedWpId, is_primary: isFirstVenue },
        { onConflict: 'user_id,wp_venue_id' }
      )

      // Backfill venue_id on any subscription created without one (trial at onboarding)
      if (isFirstVenue) {
        const { data: newVenueRow } = await svc
          .from('user_venues')
          .select('id')
          .eq('user_id', target_user_id)
          .eq('wp_venue_id', resolvedWpId)
          .maybeSingle()
        if (newVenueRow?.id) {
          await svc
            .from('venue_subscriptions')
            .update({ venue_id: newVenueRow.id })
            .eq('user_id', target_user_id)
            .is('venue_id', null)
        }
      }
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "assign-venue\|apply-changes" | head -10
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/assign-venue/route.ts app/api/venues/apply-changes/route.ts
git commit -m "fix: set is_primary correctly on first user_venue; backfill venue_id on null subscriptions"
```

---

## Task 7: TypeScript full check + push

- [ ] **Step 1: Full type-check**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | head -30
```

Expected: no output (zero errors).

- [ ] **Step 2: Push to main**

```bash
git push origin HEAD:main
```

---

## Summary — what this plan closes

| Scenario | Before | After |
|---|---|---|
| Multi-venue user on pricing page | No venue selector — subscription has no `venue_id` | Venue pill selector appears; selected venue flows through entire payment |
| Redsys webhook fires for venue 2 | Cancels BOTH venues' subscriptions | Only cancels the paying venue's subscription |
| `activate-from-success` fallback for venue 2 | Returns `already_active` (finds venue 1's sub) | Scoped to `venue_id`; creates venue 2's sub correctly |
| New user completes onboarding | Trial has no `venue_id` | Trial gets `venue_id` if primary venue already exists |
| Admin assigns second venue | `is_primary` stays `false` (correct) | `is_primary = false` (unchanged, correct) |
| Admin assigns first venue to new user | `is_primary` stays `false` (bug) | `is_primary = true` (fixed) + backfills `venue_id` on existing trial |
| Auto-trial for second venue | Blocked by "already has sub" guard (correct) | Same guard; now also documented |
| Admin manually gives trial to any venue | Works via Admin CRM | Unchanged — always manual, always possible |

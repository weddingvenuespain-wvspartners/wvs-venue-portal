# Multi-Venue Foundation — Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the database columns and auth infrastructure needed for multi-venue accounts, plus a venue switcher in the sidebar — without breaking any existing single-venue users.

**Architecture:** Extend `user_venues` with `name` and `is_primary` columns. Add `activeVenue` + `switchVenue` to `AuthContext` with localStorage persistence. Insert a VenueSwitcher UI into the Sidebar for venue owners with 2+ venues. No data-scoping or subscription changes yet (Plan 2).

**Tech Stack:** Next.js 15 App Router, Supabase SSR, TypeScript, Tailwind/inline styles

---

## File Map

| File | Action | What changes |
|---|---|---|
| Supabase DB | Migration | Add `name`, `is_primary` to `user_venues` + backfill |
| `lib/auth-context.tsx` | Modify | `UserVenue` type, `activeVenue` state, `switchVenue`, localStorage |
| `components/Sidebar.tsx` | Modify | Import `activeVenue`/`switchVenue`, add VenueSwitcher block |

---

## Task 1: DB migration — extend user_venues

**Files:**
- Supabase SQL migration (apply via MCP `execute_sql` or Supabase dashboard)

- [ ] **Step 1: Apply the migration**

Run via Supabase MCP (`execute_sql`) or paste in the SQL editor in the Supabase dashboard:

```sql
-- 1. Add new columns
ALTER TABLE user_venues
  ADD COLUMN IF NOT EXISTS name        text,
  ADD COLUMN IF NOT EXISTS is_primary  boolean NOT NULL DEFAULT false;

-- 2. Mark the first venue of each user as primary
--    (uses created_at to pick the earliest; safe to re-run — only sets true, never un-sets)
UPDATE user_venues uv
SET is_primary = true
WHERE uv.id IN (
  SELECT DISTINCT ON (user_id) id
  FROM user_venues
  ORDER BY user_id, created_at ASC
)
AND uv.is_primary = false;
```

- [ ] **Step 2: Verify in Supabase Table Editor**

Open `user_venues` in the Supabase Table Editor. Confirm:
- Columns `name` (text, nullable) and `is_primary` (bool) are present.
- Every user that has at least one row has exactly one row with `is_primary = true`.

- [ ] **Step 3: Commit note**

```bash
git commit --allow-empty -m "db: add name + is_primary to user_venues, backfill primary flag"
```

---

## Task 2: Update UserVenue type + auth context

**Files:**
- Modify: `lib/auth-context.tsx`

- [ ] **Step 1: Replace the file with the updated version**

Replace the entire contents of `lib/auth-context.tsx` with:

```typescript
'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

export type UserVenue = {
  id:         string
  wp_venue_id: number
  name:       string | null
  is_primary: boolean
}

type AuthContextType = {
  user:          any
  profile:       any
  userVenues:    UserVenue[]
  activeVenue:   UserVenue | null
  switchVenue:   (venueId: string) => void
  loading:       boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null, profile: null, userVenues: [], activeVenue: null,
  switchVenue: () => {}, loading: true,
  refreshProfile: async () => {},
})

const ACTIVE_VENUE_KEY = 'wvs_active_venue_id'

function resolveActiveVenue(venues: UserVenue[]): UserVenue | null {
  if (!venues.length) return null
  // Try to restore from localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(ACTIVE_VENUE_KEY)
    if (stored) {
      const match = venues.find(v => v.id === stored)
      if (match) return match
    }
  }
  // Default: primary venue, or first
  return venues.find(v => v.is_primary) ?? venues[0]
}

async function fetchProfileAndVenues(userId: string) {
  const supabase = createClient()

  // Fetch venues via browser client (RLS: user sees own venues)
  const venuesResult = await supabase
    .from('user_venues')
    .select('id, wp_venue_id, name, is_primary')
    .eq('user_id', userId)

  // Fetch profile via service-role API to bypass RLS.
  let profile: any = null
  try {
    const profileRes = await fetch('/api/auth/profile')
    const { profile: p } = await profileRes.json()
    profile = p ?? null
  } catch {
    // Fallback: direct browser client
    const { data } = await supabase
      .from('venue_profiles').select('*').eq('user_id', userId).maybeSingle()
    profile = data ?? null
  }

  // Attach subscription data
  if (profile) {
    try {
      const subRes = await fetch('/api/auth/subscription')
      const { subscription } = await subRes.json()
      if (subscription) {
        ;(profile as any).plan               = subscription.plan
        ;(profile as any).subscription_status = subscription.status
        ;(profile as any).trial_end_date      = subscription.trial_end_date
      }
    } catch (err) {
      console.warn('[auth] Could not fetch subscription:', err)
    }
  }

  return {
    profile,
    userVenues: (venuesResult.data ?? []) as UserVenue[],
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]             = useState<any>(null)
  const [profile, setProfile]       = useState<any>(null)
  const [userVenues, setUserVenues] = useState<UserVenue[]>([])
  const [activeVenue, setActiveVenue] = useState<UserVenue | null>(null)
  const [loading, setLoading]       = useState(true)

  const loadedUserIdRef = useRef<string | null>(null)

  const switchVenue = (venueId: string) => {
    const venue = userVenues.find(v => v.id === venueId)
    if (!venue) return
    setActiveVenue(venue)
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_VENUE_KEY, venueId)
    }
  }

  const loadForUser = async (u: any) => {
    // Check session duration preference
    const expiry = typeof window !== 'undefined' ? localStorage.getItem('wvs_session_expiry') : null
    if (expiry && Date.now() > parseInt(expiry)) {
      const supabase = createClient()
      localStorage.removeItem('wvs_session_expiry')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (u.id === loadedUserIdRef.current) return
    loadedUserIdRef.current = u.id
    setUser(u)
    const { profile: p, userVenues: v } = await fetchProfileAndVenues(u.id)
    setProfile(p)
    setUserVenues(v)
    setActiveVenue(resolveActiveVenue(v))
    setLoading(false)
  }

  const refreshProfile = async () => {
    if (!loadedUserIdRef.current) return
    const { profile: p, userVenues: v } = await fetchProfileAndVenues(loadedUserIdRef.current)
    setProfile(p)
    setUserVenues(v)
    setActiveVenue(prev => {
      // Keep the same venue if still available, otherwise re-resolve
      if (prev) {
        const still = v.find(x => x.id === prev.id)
        if (still) return still
      }
      return resolveActiveVenue(v)
    })
  }

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        loadedUserIdRef.current = null
        setUser(null); setProfile(null); setUserVenues([]); setActiveVenue(null); setLoading(false)
        return
      }
      if (session?.user && (
        event === 'INITIAL_SESSION' ||
        event === 'SIGNED_IN' ||
        event === 'USER_UPDATED'
      )) {
        loadForUser(session.user)
        return
      }
      if (event === 'INITIAL_SESSION' && !session) {
        setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line

  return (
    <AuthContext.Provider value={{ user, profile, userVenues, activeVenue, switchVenue, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
```

- [ ] **Step 2: Fix any TypeScript errors from the type change**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "auth-context\|UserVenue" | head -20
```

If there are errors in other files that import `UserVenue`, they'll reference the old type `{ id: string; wp_venue_id: number }`. The new type is a superset (added optional-ish `name` and `is_primary`) so most usages will still be valid. Fix any that aren't.

- [ ] **Step 3: Commit**

```bash
git add lib/auth-context.tsx
git commit -m "feat: add activeVenue + switchVenue to AuthContext, export UserVenue type"
```

---

## Task 3: Venue switcher in Sidebar

**Files:**
- Modify: `components/Sidebar.tsx`

The switcher appears at the top of the "Mi Venue" section for venue owners with 2+ venues. It's a compact dropdown showing the current venue name with a chevron; clicking it opens an inline list of other venues to switch to.

- [ ] **Step 1: Add ChevronDown import to Sidebar.tsx**

Find the line:
```typescript
import { Hourglass } from 'lucide-react'
```

Replace with:
```typescript
import { Hourglass, ChevronDown, Check } from 'lucide-react'
```

- [ ] **Step 2: Add activeVenue + switchVenue to the useAuth destructure**

Find:
```typescript
const { user, profile, userVenues } = useAuth()
```

Replace with:
```typescript
const { user, profile, userVenues, activeVenue, switchVenue } = useAuth()
```

- [ ] **Step 3: Add venueOpen state for the switcher dropdown**

Find the line:
```typescript
const [newLeadsCount, setNewLeadsCount] = useState(0)
```

Add above it:
```typescript
const [venueOpen, setVenueOpen] = useState(false)
```

- [ ] **Step 4: Insert the VenueSwitcher block in the Venue Owner section**

Find this exact block in the Sidebar:
```typescript
        {/* ── VENUE OWNER ── */}
        {isVenueOwner && (
          <>
            <div className="nav-section" style={{ marginTop: 8 }}>Mi Venue</div>
```

Replace with:
```typescript
        {/* ── VENUE OWNER ── */}
        {isVenueOwner && (
          <>
            <div className="nav-section" style={{ marginTop: 8 }}>Mi Venue</div>

            {/* Venue switcher — only shown when user has 2+ venues */}
            {userVenues.length > 1 && activeVenue && (
              <div style={{ margin: '0 0 6px 0', position: 'relative' }}>
                <button
                  onClick={() => setVenueOpen(o => !o)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 600,
                    fontFamily: 'Manrope, sans-serif', textAlign: 'left',
                  }}
                >
                  <span style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: 'var(--gold)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff',
                  }}>
                    {(activeVenue.name ?? `V${activeVenue.wp_venue_id}`).slice(0, 1).toUpperCase()}
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeVenue.name ?? `Venue ${activeVenue.wp_venue_id}`}
                  </span>
                  <ChevronDown size={12} style={{
                    flexShrink: 0, opacity: 0.6,
                    transform: venueOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 150ms',
                  }} />
                </button>

                {venueOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                    background: '#1e1a17', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8, overflow: 'hidden', zIndex: 50,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}>
                    {userVenues.map(v => (
                      <button
                        key={v.id}
                        onClick={() => { switchVenue(v.id); setVenueOpen(false) }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', background: 'none', border: 'none',
                          color: v.id === activeVenue.id ? 'var(--gold)' : 'rgba(255,255,255,0.8)',
                          fontSize: 12, fontWeight: v.id === activeVenue.id ? 600 : 400,
                          cursor: 'pointer', fontFamily: 'Manrope, sans-serif', textAlign: 'left',
                        }}
                      >
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.name ?? `Venue ${v.wp_venue_id}`}
                        </span>
                        {v.id === activeVenue.id && <Check size={11} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
```

- [ ] **Step 5: Close the dropdown when clicking outside**

Find the `handleLogout` function:
```typescript
  const handleLogout = async () => {
```

Add just above it:
```typescript
  // Close venue dropdown on outside click
  useEffect(() => {
    if (!venueOpen) return
    const close = () => setVenueOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [venueOpen])

```

- [ ] **Step 6: Check the page compiles**

```bash
npx tsc --noEmit 2>&1 | grep "Sidebar" | head -10
```

Expected: no output (no errors).

- [ ] **Step 7: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: venue switcher in sidebar for multi-venue owners"
```

---

## Task 4: Manual verification

- [ ] **Step 1: Start the dev server and open the app**

Log in with a single-venue account. Confirm:
- No venue switcher is visible in the sidebar.
- Everything looks and works exactly as before.

- [ ] **Step 2: Simulate a multi-venue account (via Supabase)**

In the Supabase Table Editor, add a second row to `user_venues` for your admin/test account with a different `wp_venue_id` (e.g., 99) and `is_primary = false`. Give it a `name` like "Finca Test B".

- [ ] **Step 3: Verify switcher appears**

Refresh the app. In the "Mi Venue" section of the sidebar, confirm:
- Venue switcher is visible showing "Finca Test B" or the current active venue.
- Clicking the switcher opens a dropdown with both venues.
- Selecting the other venue updates the displayed name and persists on page refresh.

- [ ] **Step 4: Clean up test row**

Delete the test row from `user_venues` in Supabase.

- [ ] **Final commit**

```bash
git add -A
git commit -m "chore: plan 1 complete — multi-venue foundation ready"
```

---

## What Plan 2 will cover

- `leads`, `proposals`, `calendar` tables get `venue_id` column → all queries filter by `activeVenue.id`
- `venue_subscriptions` gets `venue_id` → each venue has independent subscription
- `plan-server.ts` + `use-plan-features.ts` accept `venueId`
- Admin CRM: subscription tab per venue
- Pricing page: venue selector when contracting a plan

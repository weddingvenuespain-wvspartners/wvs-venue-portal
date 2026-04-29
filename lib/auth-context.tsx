'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

export type UserVenue = {
  id:          string
  wp_venue_id: number
  name:        string | null
  is_primary:  boolean
}

type AuthContextType = {
  user:           any
  profile:        any
  userVenues:     UserVenue[]
  activeVenue:    UserVenue | null
  switchVenue:    (venueId: string) => void
  loading:        boolean
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
  // This is required for admin users whose venue_profiles rows
  // may not be readable via the anon/user-scoped Supabase client.
  let profile: any = null
  try {
    const profileRes = await fetch('/api/auth/profile')
    const { profile: p } = await profileRes.json()
    profile = p ?? null
  } catch {
    // Fallback: try direct browser client (works for most venue owners)
    const { data } = await supabase
      .from('venue_profiles').select('*').eq('user_id', userId).maybeSingle()
    profile = data ?? null
  }

  // Fetch active/trial subscription via API (bypasses RLS on venue_subscriptions)
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
    // No subscription found → profile.plan stays undefined → basic/restricted access
  }

  return {
    profile,
    userVenues: (venuesResult.data ?? []) as UserVenue[],
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<any>(null)
  const [profile, setProfile]         = useState<any>(null)
  const [userVenues, setUserVenues]   = useState<UserVenue[]>([])
  const [activeVenue, setActiveVenue] = useState<UserVenue | null>(null)
  const [loading, setLoading]         = useState(true)

  // Track which user ID we already loaded to prevent duplicate fetches
  const loadedUserIdRef = useRef<string | null>(null)

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
          setProfile((prev: any) => {
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

  const loadForUser = async (u: any) => {
    // Check session duration preference — sign out if expired
    const expiry = typeof window !== 'undefined' ? localStorage.getItem('wvs_session_expiry') : null
    if (expiry && Date.now() > parseInt(expiry)) {
      const supabase = createClient()
      localStorage.removeItem('wvs_session_expiry')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    // Skip if we already loaded for this exact user
    if (u.id === loadedUserIdRef.current) return
    loadedUserIdRef.current = u.id
    setUser(u)
    const { profile: p, userVenues: v } = await fetchProfileAndVenues(u.id)
    setProfile(p)
    setUserVenues(v)
    setActiveVenue(resolveActiveVenue(v))
    setLoading(false)
  }

  // Manual refresh — call after admin changes a venue's plan
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

    // Single source of truth: onAuthStateChange
    // INITIAL_SESSION fires on startup (replaces the manual getSession() call)
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
      // INITIAL_SESSION with no session = not logged in
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

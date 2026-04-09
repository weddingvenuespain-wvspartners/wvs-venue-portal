'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

type UserVenue = { id: string; wp_venue_id: number }

type AuthContextType = {
  user: any
  profile: any
  userVenues: UserVenue[]
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null, profile: null, userVenues: [], loading: true,
  refreshProfile: async () => {},
})

async function fetchProfileAndVenues(userId: string) {
  const supabase = createClient()

  const [venuesResult, profileResult] = await Promise.all([
    supabase.from('user_venues').select('id, wp_venue_id').eq('user_id', userId),
    supabase.from('venue_profiles').select('*').eq('user_id', userId).maybeSingle(),
  ])

  let profile = profileResult.data ?? null

  // Auto-create profile for self-registered users (admin-created users already have one)
  if (!profile) {
    try {
      await fetch('/api/auth/ensure-profile', { method: 'POST' })
      const retry = await supabase.from('venue_profiles').select('*').eq('user_id', userId).maybeSingle()
      profile = retry.data ?? null
    } catch { /* ignore — will retry on next load */ }
  }

  // Fetch active/trial subscription via API (bypasses RLS on venue_subscriptions)
  if (profile) {
    try {
      const subRes = await fetch('/api/auth/subscription')
      const { subscription } = await subRes.json()
      if (subscription) {
        ;(profile as any).plan               = subscription.plan
        ;(profile as any).subscription_status = subscription.status          // 'active' | 'trial'
        ;(profile as any).trial_end_date      = subscription.trial_end_date  // string | null
      }
    } catch (err) {
      console.warn('[auth] Could not fetch subscription:', err)
    }
    // No subscription found → profile.plan stays undefined → basic/restricted access
  }

  return {
    profile,
    userVenues: venuesResult.data ?? [],
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]             = useState<any>(null)
  const [profile, setProfile]       = useState<any>(null)
  const [userVenues, setUserVenues] = useState<UserVenue[]>([])
  const [loading, setLoading]       = useState(true)

  // Track which user ID we already loaded to prevent duplicate fetches
  const loadedUserIdRef = useRef<string | null>(null)

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
    setLoading(false)
  }

  // Manual refresh — call after admin changes a venue's plan
  const refreshProfile = async () => {
    if (!loadedUserIdRef.current) return
    const { profile: p, userVenues: v } = await fetchProfileAndVenues(loadedUserIdRef.current)
    setProfile(p)
    setUserVenues(v)
  }

  useEffect(() => {
    const supabase = createClient()

    // Single source of truth: onAuthStateChange
    // INITIAL_SESSION fires on startup (replaces the manual getSession() call)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        loadedUserIdRef.current = null
        setUser(null); setProfile(null); setUserVenues([]); setLoading(false)
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
    <AuthContext.Provider value={{ user, profile, userVenues, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

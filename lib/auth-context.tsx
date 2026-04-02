'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type UserVenue = { id: string; wp_venue_id: number }

type AuthContextType = {
  user: any
  profile: any
  userVenues: UserVenue[]
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null, profile: null, userVenues: [], loading: true,
})

async function fetchProfileAndVenues(userId: string) {
  const supabase = createClient()

  const [venuesResult, profileResult] = await Promise.all([
    supabase.from('user_venues').select('id, wp_venue_id').eq('user_id', userId),
    supabase.from('venue_profiles').select('*').eq('user_id', userId).maybeSingle(),
  ])

  const profile = profileResult.data ?? null

  // Fetch active/trial subscription separately so errors don't block auth
  if (profile) {
    const subRes = await supabase
      .from('venue_subscriptions')
      .select('id, status, plan:venue_plans(id, name, display_name, permissions)')
      .eq('user_id', userId)
      .in('status', ['active', 'trial'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subRes.error) {
      // Log but don't block — user will get full access as fallback
      console.warn('[auth] Could not fetch subscription:', subRes.error.message)
    } else if (subRes.data) {
      ;(profile as any).plan = subRes.data.plan
    }
    // If no subscription found, profile.plan stays undefined → usePlanFeatures returns FULL_ACCESS
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

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfileAndVenues(session.user.id).then(({ profile: p, userVenues: v }) => {
          setProfile(p)
          setUserVenues(v)
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null); setProfile(null); setUserVenues([]); setLoading(false); return
      }
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        setUser(session.user)
        setTimeout(() => {
          fetchProfileAndVenues(session.user.id).then(({ profile: p, userVenues: v }) => {
            setProfile(p); setUserVenues(v); setLoading(false)
          })
        }, 0)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, userVenues, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

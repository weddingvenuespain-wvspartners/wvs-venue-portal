'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type AuthContextType = {
  user: any
  profile: any
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    // Cargar sesión inicial
    supabase.auth.getSession()
      .then(async ({ data: { session }, error }) => {
        if (!mounted) return
        if (error) {
          console.error('Supabase getSession error:', error.message)
          if (mounted) setLoading(false)
          return
        }
        if (session?.user) {
          setUser(session.user)
          const { data: prof } = await supabase
            .from('venue_profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .single()
          if (mounted) setProfile(prof)
        }
        if (mounted) setLoading(false)
      })
      .catch((err) => {
        console.error('Auth context initialization error:', err)
        if (mounted) setLoading(false)
      })

    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (session?.user) {
        setUser(session.user)
        const { data: prof } = await supabase
          .from('venue_profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single()
        if (mounted) setProfile(prof)
      } else {
        setUser(null)
        setProfile(null)
      }
      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

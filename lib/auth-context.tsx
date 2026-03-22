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
    // Usar siempre el mismo singleton
    const supabase = createClient()

    // Escuchar cambios de sesión — esto ya dispara al inicio con la sesión actual
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        const { data: prof } = await supabase
          .from('venue_profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single()
        setProfile(prof ?? null)
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
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

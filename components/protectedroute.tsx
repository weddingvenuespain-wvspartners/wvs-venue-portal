'use client'
import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      window.location.replace('/login')
    }
  }, [user, loading])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A1512' }}>
        <div style={{ color: '#C4975A', fontFamily: 'serif', fontSize: '18px', letterSpacing: '0.1em' }}>Cargando...</div>
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}

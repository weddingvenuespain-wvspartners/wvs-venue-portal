'use client'
import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import Spinner from '@/components/Spinner'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      window.location.replace('/login')
    }
  }, [user, loading])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A1628' }}>
        <Spinner color="#5EAEF7" />
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}

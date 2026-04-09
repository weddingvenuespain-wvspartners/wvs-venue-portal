'use client'
import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { usePlanFeatures } from '@/lib/use-plan-features'
import LandingPage from '@/app/landing/page'

export default function Home() {
  const { user, profile, loading } = useAuth()
  const { hasPlan } = usePlanFeatures()
  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (!loading && user) {
      if (isAdmin || hasPlan) {
        window.location.replace('/dashboard')
      } else {
        window.location.replace('/pricing')
      }
    }
  }, [user, loading, isAdmin, hasPlan])

  // Not logged in: show the landing page
  if (!loading && !user) {
    return <LandingPage />
  }

  // Loading or logged in (redirecting)
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A1512' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ color: '#C4975A', fontSize: '18px', letterSpacing: '0.1em' }}>
          WVS Partners
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: '50%', background: '#C4975A',
              animation: 'fade 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`
            }}/>
          ))}
        </div>
        <style>{`@keyframes fade{0%,100%{opacity:.2}50%{opacity:.9}}`}</style>
      </div>
    </div>
  )
}

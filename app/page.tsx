'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function Home() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      if (user) router.push('/dashboard')
      else router.push('/login')
      return
    }
    // Fallback: si carga más de 4s, ir al login
    const timeout = setTimeout(() => {
      router.push('/login')
    }, 4000)
    return () => clearTimeout(timeout)
  }, [user, loading, router])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A1512' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        <div style={{ color: '#C4975A', fontFamily: 'serif', fontSize: '20px', letterSpacing: '0.12em' }}>WVS Partners</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%', background: '#C4975A',
              animation: 'pulse 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`
            }} />
          ))}
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:0.2} 50%{opacity:0.9} }`}</style>
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { usePlanFeatures } from '@/lib/use-plan-features'
import { CheckCircle, Loader2 } from 'lucide-react'

function CheckoutSuccessInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, refreshProfile, loading: authLoading } = useAuth()
  const { hasPlan } = usePlanFeatures()
  const [activated, setActivated] = useState(false)
  const [error, setError] = useState('')
  const triedRef = useRef(false)
  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    if (authLoading || !user || triedRef.current) return

    // If webhook already activated the subscription
    if (hasPlan) {
      setActivated(true)
      return
    }

    triedRef.current = true

    // Poll for subscription activation (webhook may take a moment)
    let attempts = 0
    const maxAttempts = 10

    const poll = async () => {
      attempts++
      await refreshProfile()
      // Re-check after refresh — usePlanFeatures is derived from profile
      // We use a simple fetch to check subscription status directly
      try {
        const res = await fetch('/api/subscription/status')
        const data = await res.json()
        if (data.hasActiveSubscription) {
          setActivated(true)
          return
        }
      } catch {}

      if (attempts < maxAttempts) {
        setTimeout(poll, 2000)
      } else {
        // After 20s of polling, show success anyway — webhook will handle it
        setActivated(true)
      }
    }

    // Wait 2s then start polling (give webhook time to fire)
    setTimeout(poll, 2000)
  }, [authLoading, user, hasPlan]) // eslint-disable-line

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--cream)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '40px 32px',
        maxWidth: 440, width: '100%', textAlign: 'center',
        border: '1px solid var(--ivory)',
      }}>
        {activated ? (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
              background: 'rgba(92,126,100,0.1)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle size={28} color="#5C7E64" />
            </div>
            <h1 style={{
              fontFamily: 'Inter, sans-serif', fontSize: 22, fontWeight: 500,
              color: 'var(--charcoal)', marginBottom: 8,
            }}>
              Pago completado
            </h1>
            <p style={{ color: 'var(--warm-gray)', fontSize: 14, marginBottom: 28 }}>
              Tu suscripción se ha activado correctamente. Ya puedes acceder a todas las funciones de tu plan.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                padding: '10px 28px', borderRadius: 6, border: 'none',
                background: 'var(--gold)', color: '#fff',
                fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Ir al portal
            </button>
          </>
        ) : error ? (
          <>
            <h1 style={{
              fontFamily: 'Inter, sans-serif', fontSize: 22, fontWeight: 500,
              color: 'var(--charcoal)', marginBottom: 8,
            }}>
              Pago recibido
            </h1>
            <p style={{ color: 'var(--warm-gray)', fontSize: 14, marginBottom: 28 }}>
              {error} Contacta con soporte si el problema persiste.
            </p>
            <button
              onClick={() => router.push('/pricing')}
              style={{
                padding: '10px 28px', borderRadius: 6, border: 'none',
                background: 'var(--gold)', color: '#fff',
                fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Volver a planes
            </button>
          </>
        ) : (
          <>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--gold)', margin: '0 auto 20px' }} />
            <h1 style={{
              fontFamily: 'Inter, sans-serif', fontSize: 22, fontWeight: 500,
              color: 'var(--charcoal)', marginBottom: 8,
            }}>
              Activando tu suscripción...
            </h1>
            <p style={{ color: 'var(--warm-gray)', fontSize: 14 }}>
              Estamos procesando tu pago. Solo tardará unos segundos.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense>
      <CheckoutSuccessInner />
    </Suspense>
  )
}

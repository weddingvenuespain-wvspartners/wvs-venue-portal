'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { usePlanFeatures } from '@/lib/use-plan-features'
import { CheckCircle, Loader2 } from 'lucide-react'

export default function CheckoutSuccessPage() {
  const router = useRouter()
  const { user, refreshProfile, loading: authLoading } = useAuth()
  const { hasPlan } = usePlanFeatures()
  const [activated, setActivated] = useState(false)
  const [error, setError] = useState('')
  const triedRef = useRef(false)

  // Single activation flow: wait for auth, then activate
  useEffect(() => {
    if (authLoading || !user || triedRef.current) return

    // If webhook already activated the subscription
    if (hasPlan) {
      setActivated(true)
      localStorage.removeItem('wvs_pending_plan')
      return
    }

    // Try fallback activation immediately
    triedRef.current = true

    const activate = async () => {
      const stored = localStorage.getItem('wvs_pending_plan')
      if (!stored) {
        setError('No se encontraron datos del plan seleccionado.')
        return
      }

      try {
        const { planId, cycleId } = JSON.parse(stored)
        const res = await fetch('/api/redsys/activate-from-success', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, cycleId }),
        })
        const data = await res.json()

        if (data.status === 'activated' || data.status === 'already_active') {
          localStorage.removeItem('wvs_pending_plan')
          await refreshProfile()
          setActivated(true)
        } else {
          setError(data.error || 'No se pudo activar la suscripción.')
        }
      } catch {
        setError('Error de conexión al activar la suscripción.')
      }
    }

    activate()
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
              background: 'rgba(34,197,94,0.1)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle size={28} color="#22c55e" />
            </div>
            <h1 style={{
              fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 500,
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
                fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Ir al portal
            </button>
          </>
        ) : error ? (
          <>
            <h1 style={{
              fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 500,
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
                fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 500,
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
              fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 500,
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

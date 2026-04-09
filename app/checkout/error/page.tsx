'use client'
import { useRouter } from 'next/navigation'
import { XCircle } from 'lucide-react'

export default function CheckoutErrorPage() {
  const router = useRouter()

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
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
          background: 'rgba(239,68,68,0.1)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <XCircle size={28} color="#ef4444" />
        </div>

        <h1 style={{
          fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 500,
          color: 'var(--charcoal)', marginBottom: 8,
        }}>
          Pago no completado
        </h1>

        <p style={{ color: 'var(--warm-gray)', fontSize: 14, marginBottom: 28 }}>
          El pago no se ha podido procesar. No se ha realizado ningún cargo.
          Puedes volver a intentarlo o contactarnos si el problema persiste.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={() => router.push('/pricing')}
            style={{
              padding: '10px 24px', borderRadius: 6, border: 'none',
              background: 'var(--gold)', color: '#fff',
              fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              padding: '10px 24px', borderRadius: 6,
              border: '1px solid var(--ivory)', background: '#fff',
              color: 'var(--charcoal)',
              fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Volver al portal
          </button>
        </div>
      </div>
    </div>
  )
}

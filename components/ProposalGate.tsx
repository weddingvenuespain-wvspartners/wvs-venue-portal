'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import Spinner from '@/components/Spinner'

export default function ProposalGate({ slug, coupleName }: { slug: string; coupleName?: string | null }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/proposals/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'No hemos podido validar la contraseña.')
        setLoading(false)
        return
      }
      window.location.reload()
    } catch {
      setError('Error de red. Vuelve a intentarlo.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'linear-gradient(160deg, #1A1512 0%, #2c2420 50%, #3d3530 100%)',
      fontFamily: 'Manrope, sans-serif',
      color: '#fff',
    }}>
      <form onSubmit={onSubmit} style={{
        width: '100%',
        maxWidth: 420,
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 16,
        padding: 36,
        textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(196,151,90,0.16)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#C4975A', marginBottom: 20,
        }}>
          <Lock size={24} strokeWidth={1.6} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, letterSpacing: '0.01em' }}>
          Propuesta privada
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginBottom: 24 }}>
          {coupleName
            ? `Esta propuesta para ${coupleName} requiere contraseña para acceder.`
            : 'Esta propuesta requiere contraseña para acceder.'}
        </p>
        <input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); if (error) setError(null) }}
          placeholder="Introduce la contraseña"
          autoFocus
          autoComplete="current-password"
          style={{
            width: '100%',
            padding: '12px 14px',
            fontSize: 14,
            color: '#fff',
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${error ? 'rgba(220,38,38,0.6)' : 'rgba(255,255,255,0.14)'}`,
            borderRadius: 8,
            outline: 'none',
            marginBottom: 14,
            boxSizing: 'border-box',
          }}
        />
        {error && (
          <div style={{ fontSize: 12, color: '#fca5a5', marginBottom: 14 }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={loading || !password.trim()}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: '#C4975A',
            color: '#1A1512',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor: loading || !password.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !password.trim() ? 0.6 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {loading ? <Spinner size={14} thickness={2} color="#1A1512" /> : 'Acceder'}
        </button>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 18, lineHeight: 1.6 }}>
          Si no tienes la contraseña, contacta con el venue que te envió esta propuesta.
        </p>
      </form>
    </div>
  )
}

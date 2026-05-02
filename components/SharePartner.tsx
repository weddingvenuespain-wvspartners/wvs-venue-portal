'use client'

import { useState } from 'react'
import { Heart, Send, X, Check } from 'lucide-react'
import Spinner from '@/components/Spinner'

export default function SharePartner({
  slug,
  primary = '#C4975A',
  onPrimary = '#fff',
  dark = false,
}: {
  slug: string
  primary?: string
  onPrimary?: string
  dark?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [partnerEmail, setPartnerEmail] = useState('')
  const [fromName, setFromName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const text = dark ? 'rgba(255,255,255,.92)' : '#181410'
  const sub = dark ? 'rgba(255,255,255,.55)' : '#6a6560'
  const border = dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.14)'
  const fieldBg = dark ? 'rgba(255,255,255,.04)' : '#fff'

  const reset = () => {
    setOpen(false)
    setError(null)
    setDone(false)
    setLoading(false)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partnerEmail.trim())) {
      setError('Email no válido')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/proposals/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, partner_email: partnerEmail.trim(), from_name: fromName.trim() || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(data.error || 'No hemos podido enviar el email.')
        setLoading(false)
        return
      }
      setDone(true)
      setLoading(false)
      setTimeout(reset, 2400)
    } catch {
      setError('Error de red. Vuelve a intentarlo.')
      setLoading(false)
    }
  }

  return (
    <div style={{ textAlign: 'center', marginTop: 20 }}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'transparent', color: primary,
            border: `1px solid ${primary}66`, borderRadius: 999,
            padding: '10px 22px',
            fontSize: 13, fontWeight: 600, letterSpacing: '0.02em',
            cursor: 'pointer',
          }}
        >
          <Heart size={14} strokeWidth={1.8} /> Compartir con mi pareja
        </button>
      ) : (
        <form onSubmit={onSubmit} style={{
          maxWidth: 460, margin: '0 auto',
          padding: 20, border: `1px solid ${border}`, borderRadius: 12, background: fieldBg,
          textAlign: 'left',
          display: 'flex', flexDirection: 'column', gap: 10,
          position: 'relative',
        }}>
          <button type="button" onClick={reset} aria-label="Cerrar"
            style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: sub, padding: 4, display: 'inline-flex' }}>
            <X size={14} />
          </button>
          {done ? (
            <div style={{ textAlign: 'center', padding: '12px 4px' }}>
              <div style={{ display: 'inline-flex', width: 40, height: 40, borderRadius: '50%', background: `${primary}22`, color: primary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Check size={20} strokeWidth={2} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: text, marginBottom: 4 }}>¡Email enviado!</div>
              <div style={{ fontSize: 12, color: sub }}>Tu pareja recibirá el enlace en breve.</div>
            </div>
          ) : (
            <>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: text, marginBottom: 2 }}>Compartir con mi pareja</div>
                <div style={{ fontSize: 12, color: sub, lineHeight: 1.5 }}>Le mandaremos el enlace por email para que pueda verla también.</div>
              </div>
              <input
                type="text"
                value={fromName}
                onChange={e => setFromName(e.target.value)}
                placeholder="Tu nombre (opcional)"
                style={{ width: '100%', padding: '9px 12px', fontSize: 13, color: text, background: 'transparent', border: `1px solid ${border}`, borderRadius: 7, outline: 'none', boxSizing: 'border-box' }}
              />
              <input
                type="email"
                autoFocus
                value={partnerEmail}
                onChange={e => { setPartnerEmail(e.target.value); if (error) setError(null) }}
                placeholder="Email de tu pareja"
                style={{ width: '100%', padding: '9px 12px', fontSize: 13, color: text, background: 'transparent', border: `1px solid ${error ? 'rgba(220,38,38,0.6)' : border}`, borderRadius: 7, outline: 'none', boxSizing: 'border-box' }}
              />
              {error && <div style={{ fontSize: 11, color: '#dc2626' }}>{error}</div>}
              <button
                type="submit"
                disabled={loading || !partnerEmail.trim()}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 18px',
                  background: primary, color: onPrimary,
                  border: 'none', borderRadius: 8,
                  fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                  cursor: loading || !partnerEmail.trim() ? 'not-allowed' : 'pointer',
                  opacity: loading || !partnerEmail.trim() ? 0.6 : 1,
                  alignSelf: 'flex-start',
                }}
              >
                {loading ? <Spinner size={12} thickness={2} color={onPrimary} /> : <Send size={12} />}
                Enviar enlace
              </button>
            </>
          )}
        </form>
      )}
    </div>
  )
}

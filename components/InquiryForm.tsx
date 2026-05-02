'use client'

import { useState } from 'react'
import { Calendar, Phone, Video, UtensilsCrossed, MessageCircle, Check, type LucideIcon } from 'lucide-react'
import Spinner from '@/components/Spinner'
import VisitBookingModal from '@/components/VisitBookingModal'

type Kind = 'visit' | 'call' | 'video' | 'menu' | 'other'

const KINDS: Array<{ id: Kind; label: string; icon: LucideIcon }> = [
  { id: 'visit', label: 'Visitar el venue',      icon: Calendar },
  { id: 'call',  label: 'Llamada telefónica',    icon: Phone },
  { id: 'video', label: 'Videollamada',          icon: Video },
  { id: 'menu',  label: 'Pregunta sobre menú',   icon: UtensilsCrossed },
  { id: 'other', label: 'Otro',                  icon: MessageCircle },
]

export default function InquiryForm({
  slug,
  proposalId,
  coupleName,
  primary = '#C4975A',
  onPrimary = '#fff',
  dark = false,
}: {
  slug: string
  proposalId?: string
  coupleName?: string
  primary?: string
  onPrimary?: string
  dark?: boolean
}) {
  const [kind, setKind] = useState<Kind>('call')
  const [visitModalOpen, setVisitModalOpen] = useState(false)
  const [visitDone, setVisitDone] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [date1, setDate1] = useState('')
  const [date2, setDate2] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const text = dark ? 'rgba(255,255,255,.92)' : '#181410'
  const sub = dark ? 'rgba(255,255,255,.55)' : '#6a6560'
  const border = dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.14)'
  const fieldBg = dark ? 'rgba(255,255,255,.04)' : '#fff'

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (kind === 'visit') {
      // Visit kind goes through the calendar modal so the venue gets a real
      // slot pick + the booking flows into proposal.visit_request + lead update.
      if (!proposalId) { setError('No se puede agendar visita en este momento'); return }
      setError(null)
      setVisitModalOpen(true)
      return
    }
    if (!name.trim()) { setError('Indica tu nombre'); return }
    if (!email.trim() && !phone.trim()) { setError('Indica al menos email o teléfono'); return }

    setError(null); setLoading(true)
    try {
      const res = await fetch('/api/proposals/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, kind,
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          preferred_dates: [date1, date2].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)),
          message: message.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(data.error || 'No hemos podido enviar la consulta.')
        setLoading(false)
        return
      }
      setDone(true)
    } catch {
      setError('Error de red. Vuelve a intentarlo.')
      setLoading(false)
    }
  }

  if (done || visitDone) {
    return (
      <div style={{
        padding: 32, textAlign: 'center',
        border: `1px solid ${border}`, borderRadius: 12, background: fieldBg,
      }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: `${primary}22`, color: primary, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Check size={26} strokeWidth={2} />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: text, marginBottom: 6 }}>
          {visitDone ? '¡Visita solicitada!' : '¡Mensaje enviado!'}
        </h3>
        <p style={{ fontSize: 14, color: sub, lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
          {visitDone
            ? 'Hemos enviado tu solicitud al venue. Te confirmarán la fecha en breve.'
            : 'Hemos recibido tu consulta. El venue te contactará en breve.'}
        </p>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: 14,
    color: text, background: fieldBg,
    border: `1px solid ${border}`, borderRadius: 8,
    outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: sub, letterSpacing: '.08em', textTransform: 'uppercase',
    marginBottom: 6,
  }

  const isVisit = kind === 'visit'

  return (
    <>
      <form onSubmit={onSubmit} style={{
        maxWidth: 560, margin: '0 auto',
        padding: 24, border: `1px solid ${border}`, borderRadius: 12, background: fieldBg,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div>
          <label style={labelStyle}>¿Qué prefieres?</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {KINDS.map(k => {
              const sel = kind === k.id
              const Icon = k.icon
              return (
                <button key={k.id} type="button" onClick={() => { setKind(k.id); setError(null) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 12px', fontSize: 13, fontWeight: 500,
                    borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    border: `1.5px solid ${sel ? primary : border}`,
                    background: sel ? `${primary}14` : 'transparent',
                    color: sel ? primary : text,
                    transition: 'all .15s',
                  }}>
                  <Icon size={14} strokeWidth={1.8} /> {k.label}
                </button>
              )
            })}
          </div>
        </div>

        {isVisit ? (
          <p style={{ fontSize: 13, color: sub, lineHeight: 1.6, margin: 0 }}>
            En el siguiente paso elegirás una fecha y hora disponible en nuestro calendario.
          </p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              <div>
                <label style={labelStyle}>Nombre *</label>
                <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre y el de tu pareja" />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="vosotros@email.com" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              <div>
                <label style={labelStyle}>Teléfono</label>
                <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+34 600 000 000" />
              </div>
              <div>
                <label style={labelStyle}>Fecha preferida</label>
                <input type="date" style={inputStyle} value={date1} onChange={e => setDate1(e.target.value)} />
              </div>
            </div>

            {date1 && (
              <div>
                <label style={labelStyle}>Segunda opción (opcional)</label>
                <input type="date" style={inputStyle} value={date2} onChange={e => setDate2(e.target.value)} />
              </div>
            )}

            <div>
              <label style={labelStyle}>Mensaje (opcional)</label>
              <textarea
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }}
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={2000}
                placeholder="Cuéntanos lo que necesitas o preguntas que tengas…"
              />
            </div>
          </>
        )}

        {error && (
          <div style={{ fontSize: 12, color: '#dc2626', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '14px 28px',
            background: primary, color: onPrimary,
            border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            alignSelf: 'flex-start',
          }}
        >
          {loading ? <Spinner size={14} thickness={2} color={onPrimary} /> : null}
          {isVisit ? 'Elegir fecha disponible' : 'Enviar consulta'}
        </button>

        <p style={{ fontSize: 11, color: sub, lineHeight: 1.5, marginTop: 4 }}>
          {isVisit
            ? 'Te confirmaremos la visita al email que dejes en el siguiente paso.'
            : 'Te responderá el venue directamente al email o teléfono que indiques.'}
        </p>
      </form>

      {visitModalOpen && proposalId && (
        <VisitBookingModal
          proposalId={proposalId}
          coupleName={coupleName || 'Pareja'}
          primaryColor={primary}
          onClose={() => setVisitModalOpen(false)}
          onSuccess={() => { setVisitModalOpen(false); setVisitDone(true) }}
        />
      )}
    </>
  )
}

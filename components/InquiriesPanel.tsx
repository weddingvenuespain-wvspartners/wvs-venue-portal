'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, Phone, Video, UtensilsCrossed, MessageCircle, Mail, ExternalLink, Inbox, CheckCircle2, Archive, Trash2, RotateCcw, type LucideIcon } from 'lucide-react'
import Spinner from '@/components/Spinner'

type Kind = 'visit' | 'call' | 'video' | 'menu' | 'other'
type Status = 'new' | 'replied' | 'closed'

type Inquiry = {
  id: string
  proposal_id: string
  kind: Kind
  name: string
  email: string | null
  phone: string | null
  preferred_dates: string[] | null
  message: string | null
  status: Status
  created_at: string
  proposals?: { id: string; slug: string; couple_name: string | null } | null
}

const KIND_LABEL: Record<Kind, string> = {
  visit: 'Visita',
  call:  'Llamada',
  video: 'Videollamada',
  menu:  'Menú',
  other: 'Consulta',
}
const KIND_ICON: Record<Kind, LucideIcon> = {
  visit: Calendar,
  call:  Phone,
  video: Video,
  menu:  UtensilsCrossed,
  other: MessageCircle,
}

export type InquiriesPanelProps = {
  onCountChange?: (count: number) => void
}

export default function InquiriesPanel({ onCountChange }: InquiriesPanelProps) {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | Status>('all')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/proposals/inquiries', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (data.ok) {
        setInquiries(data.inquiries as Inquiry[])
        onCountChange?.((data.inquiries as Inquiry[]).filter(i => i.status === 'new').length)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const updateStatus = async (id: string, status: Status) => {
    const previous = inquiries
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    onCountChange?.(inquiries.filter(i => i.id !== id ? i.status === 'new' : status === 'new').length)
    const res = await fetch(`/api/proposals/inquiries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) setInquiries(previous)
  }

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar esta consulta?')) return
    const previous = inquiries
    setInquiries(prev => prev.filter(i => i.id !== id))
    onCountChange?.(previous.filter(i => i.id !== id && i.status === 'new').length)
    const res = await fetch(`/api/proposals/inquiries/${id}`, { method: 'DELETE' })
    if (!res.ok) setInquiries(previous)
  }

  const filtered = filter === 'all' ? inquiries : inquiries.filter(i => i.status === filter)
  const counts = {
    all:     inquiries.length,
    new:     inquiries.filter(i => i.status === 'new').length,
    replied: inquiries.filter(i => i.status === 'replied').length,
    closed:  inquiries.filter(i => i.status === 'closed').length,
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Spinner />
      </div>
    )
  }

  if (!inquiries.length) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12 }}>
        <Inbox size={28} style={{ color: 'var(--warm-gray)', marginBottom: 12 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>Aún no has recibido consultas</div>
        <div style={{ fontSize: 13, color: 'var(--warm-gray)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
          Cuando una pareja rellene el formulario de tu propuesta pública, aparecerá aquí.
        </div>
      </div>
    )
  }

  const filterBtn = (id: 'all' | Status, label: string, count: number) => (
    <button
      key={id}
      onClick={() => setFilter(id)}
      style={{
        padding: '6px 12px', fontSize: 12, fontWeight: 500,
        borderRadius: 999, cursor: 'pointer',
        border: `1px solid ${filter === id ? 'var(--gold)' : 'var(--ivory)'}`,
        background: filter === id ? 'rgba(196,151,90,0.12)' : 'transparent',
        color: filter === id ? 'var(--gold)' : 'var(--charcoal)',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}
    >
      {label}
      {count > 0 && (
        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: filter === id ? 'var(--gold)' : 'var(--ivory)', color: filter === id ? '#fff' : 'var(--warm-gray)', fontWeight: 700 }}>{count}</span>
      )}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {filterBtn('all', 'Todas', counts.all)}
        {filterBtn('new', 'Nuevas', counts.new)}
        {filterBtn('replied', 'Contestadas', counts.replied)}
        {filterBtn('closed', 'Cerradas', counts.closed)}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(inq => {
          const Icon = KIND_ICON[inq.kind]
          const date = new Date(inq.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
          const time = new Date(inq.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
          const dates = (inq.preferred_dates ?? []).map(d => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }))
          return (
            <div key={inq.id} style={{
              background: '#fff', border: '1px solid var(--ivory)', borderRadius: 10,
              padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
              borderLeft: inq.status === 'new' ? '3px solid var(--gold)' : '3px solid transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--gold)', padding: '3px 8px', background: 'rgba(196,151,90,0.12)', borderRadius: 99 }}>
                    <Icon size={11} strokeWidth={2} /> {KIND_LABEL[inq.kind]}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)' }}>{inq.name}</span>
                  {inq.proposals?.couple_name && inq.proposals.couple_name !== inq.name && (
                    <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>· propuesta de {inq.proposals.couple_name}</span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{date} · {time}</span>
              </div>

              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--charcoal)' }}>
                {inq.email && (
                  <a href={`mailto:${inq.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'inherit', textDecoration: 'none' }}>
                    <Mail size={11} /> {inq.email}
                  </a>
                )}
                {inq.phone && (
                  <a href={`tel:${inq.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'inherit', textDecoration: 'none' }}>
                    <Phone size={11} /> {inq.phone}
                  </a>
                )}
                {dates.length > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--warm-gray)' }}>
                    <Calendar size={11} /> {dates.join(' · ')}
                  </span>
                )}
              </div>

              {inq.message && (
                <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0, fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                  {inq.message}
                </p>
              )}

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {inq.proposals?.id && (
                  <Link href={`/proposals/${inq.proposals.id}/edit`} className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <ExternalLink size={11} /> Ver propuesta
                  </Link>
                )}
                {inq.status === 'new' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(inq.id, 'replied')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <CheckCircle2 size={11} /> Marcar como contestada
                  </button>
                )}
                {inq.status === 'replied' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(inq.id, 'closed')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Archive size={11} /> Cerrar
                  </button>
                )}
                {inq.status === 'closed' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(inq.id, 'new')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <RotateCcw size={11} /> Reabrir
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => remove(inq.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--rose)', marginLeft: 'auto' }}>
                  <Trash2 size={11} /> Eliminar
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

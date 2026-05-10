'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Calendar, Phone, Video, UtensilsCrossed, MessageCircle, Mail, ExternalLink, Inbox, CheckCircle2, Archive, Trash2, RotateCcw, CalendarCheck, Users, User, ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react'
import Spinner from '@/components/Spinner'

type Status = 'new' | 'replied' | 'closed'

type Inquiry = {
  id: string
  proposal_id: string
  kind: string
  kind_label: string | null
  name: string
  email: string | null
  phone: string | null
  preferred_dates: string[] | null
  message: string | null
  status: Status
  created_at: string
  event_at: string | null
  payload: Record<string, any> | null
  proposals?: {
    id: string
    slug: string
    couple_name: string | null
    lead_id: string | null
    leads?: { id: string; name: string | null } | null
  } | null
}

const FALLBACK_LABEL: Record<string, string> = {
  visit:           'Visita solicitada',
  call:            'Llamada',
  video:           'Videollamada',
  menu:            'Pregunta sobre menú',
  menu_selection:  'Selección de menú',
  date_pick:       'Fecha confirmada',
  other:           'Consulta',
}
const ICON_BY_KIND: Record<string, LucideIcon> = {
  visit:           Calendar,
  call:            Phone,
  video:           Video,
  menu:            UtensilsCrossed,
  menu_selection:  UtensilsCrossed,
  date_pick:       CalendarCheck,
  other:           MessageCircle,
}

const fmtDateLong = (iso: string) =>
  new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

const fmtMoney = (n: number | null | undefined) =>
  typeof n === 'number'
    ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
    : null

function PayloadField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--charcoal)', lineHeight: 1.5 }}>{value}</div>
    </div>
  )
}

export function renderPayload(inq: { kind: string; payload: Record<string, any> | null }) {
  const p = inq.payload || {}

  if (inq.kind === 'visit') {
    const date = typeof p.date === 'string' ? fmtDateLong(p.date) : null
    const time = typeof p.time === 'string' ? p.time : null
    const spaces: Array<{ group_name?: string; space_name?: string }> = Array.isArray(p.selected_spaces) ? p.selected_spaces : []
    const menus: string[] = Array.isArray(p.selected_menus) ? p.selected_menus : []
    return (
      <div style={{ background: 'var(--surface, #faf8f5)', border: '1px solid var(--ivory)', borderRadius: 8, padding: '10px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        {(date || time) && (
          <PayloadField
            label="Fecha y hora"
            value={<><CalendarCheck size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: -2 }} />{[date, time && `${time}h`].filter(Boolean).join(' · ')}</>}
          />
        )}
        {spaces.length > 0 && (
          <PayloadField
            label="Espacios elegidos"
            value={spaces.map(s => [s.group_name, s.space_name].filter(Boolean).join(': ')).join(' · ')}
          />
        )}
        {menus.length > 0 && (
          <PayloadField label="Menús preseleccionados" value={menus.join(' · ')} />
        )}
      </div>
    )
  }

  if (inq.kind === 'menu_selection') {
    const guests = p.guest_count as number | null
    const originalGuests = p.original_guest_count as number | null
    const guestChanged = !!p.guest_count_changed
    const total = fmtMoney(p.estimated_total)
    const weddingDate = typeof p.wedding_date === 'string' ? p.wedding_date : null
    const allocations: Array<{
      menu_id?: string
      menu_name?: string
      guest_count?: number
      course_choices?: Record<string, string[]>
    }> = Array.isArray(p.menu_allocations) ? p.menu_allocations : []
    const extrasDetail: Array<{
      id?: string
      name?: string
      category?: string
      category_label?: string
      price?: string | null
      price_type?: 'per_person' | 'flat' | null
      guest_count?: number | null
      barra_extra_hours?: number | null
      barra_extra_people?: number | null
    }> = Array.isArray(p.selected_extras_detail) ? p.selected_extras_detail : []

    // Group extras by category for readability
    const extrasByCategory = new Map<string, typeof extrasDetail>()
    extrasDetail.forEach(ex => {
      const cat = ex.category_label || ex.category || 'Otros'
      if (!extrasByCategory.has(cat)) extrasByCategory.set(cat, [])
      extrasByCategory.get(cat)!.push(ex)
    })

    return (
      <div style={{ background: 'var(--surface, #faf8f5)', border: '1px solid var(--ivory)', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Top row: summary fields */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {weddingDate && (
            <PayloadField label="Fecha de boda" value={fmtDateLong(weddingDate)} />
          )}
          {guests !== null && guests !== undefined && (
            <PayloadField
              label="Invitados"
              value={
                <>
                  <Users size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: -2 }} />
                  {guests}
                  {guestChanged && originalGuests ? <span style={{ color: 'var(--warm-gray)', fontSize: 11 }}> (antes: {originalGuests})</span> : null}
                </>
              }
            />
          )}
          {total && <PayloadField label="Total estimado" value={<strong>{total}</strong>} />}
        </div>

        {/* Per-menu breakdown with course choices */}
        {allocations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {allocations.length === 1 ? 'Menú elegido' : 'Menús elegidos'}
            </div>
            {allocations.map((alloc, i) => {
              const choices = alloc.course_choices ?? {}
              const choiceEntries = Object.entries(choices).filter(([, v]) => Array.isArray(v) && v.length > 0)
              return (
                <div key={alloc.menu_id || i} style={{ background: '#fff', border: '1px solid var(--ivory)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: choiceEntries.length > 0 ? 8 : 0, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)' }}>{alloc.menu_name || `Menú ${i + 1}`}</span>
                    {alloc.guest_count !== undefined && (
                      <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                        <Users size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
                        {alloc.guest_count} {alloc.guest_count === 1 ? 'invitado' : 'invitados'}
                      </span>
                    )}
                  </div>
                  {choiceEntries.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {choiceEntries.map(([course, items]) => (
                        <div key={course} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.05em', minWidth: 80 }}>{course}</span>
                          <span style={{ fontSize: 12, color: 'var(--charcoal)' }}>{(items as string[]).join(' · ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Extras grouped by category */}
        {extrasByCategory.size > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Extras seleccionados</div>
            {Array.from(extrasByCategory.entries()).map(([cat, items]) => (
              <div key={cat} style={{ background: '#fff', border: '1px solid var(--ivory)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{cat}</div>
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {items.map((ex, i) => {
                    const priceLabel = ex.price ? `${ex.price}${ex.price_type === 'per_person' ? '/pax' : ''}` : null
                    const detail: string[] = []
                    if (priceLabel) detail.push(priceLabel)
                    if (ex.guest_count) detail.push(`${ex.guest_count} pax`)
                    if (ex.barra_extra_hours) detail.push(`+${ex.barra_extra_hours} h extra${ex.barra_extra_people ? ` · ${ex.barra_extra_people} pax` : ''}`)
                    return (
                      <li key={ex.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13, color: 'var(--charcoal)' }}>
                        <span>{ex.name || 'Extra'}</span>
                        {detail.length > 0 && <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{detail.join(' · ')}</span>}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (inq.kind === 'date_pick') {
    const slot = p.slot ?? {}
    const slotDates: string[] = Array.isArray(slot.dates) ? slot.dates : []
    const datesLabel = slotDates.length
      ? slotDates.map(fmtDateLong).join(' · ')
      : null
    const fallback = slot.label || slot.title || datesLabel
    const price = [slot.price_per_person, slot.price_rental].filter(Boolean).join(' · ')
    return (
      <div style={{ background: 'var(--surface, #faf8f5)', border: '1px solid var(--ivory)', borderRadius: 8, padding: '10px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <PayloadField
          label="Fecha de boda confirmada"
          value={<><CalendarCheck size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: -2 }} />{fallback || '—'}</>}
        />
        {slot.label && datesLabel && slot.label !== datesLabel && (
          <PayloadField label="Fechas del slot" value={datesLabel} />
        )}
        {price && <PayloadField label="Precio" value={price} />}
      </div>
    )
  }

  return null
}

type LeadGrouping = {
  key: string
  leadId: string | null
  leadName: string | null
  coupleNames: string[]
  proposalIds: string[]
  inquiries: Inquiry[]
  newCount: number
  latestAt: string
}

function groupByLead(inquiries: Inquiry[]): LeadGrouping[] {
  const map = new Map<string, LeadGrouping>()
  for (const inq of inquiries) {
    const leadId = inq.proposals?.lead_id ?? null
    // Group by lead_id when present, otherwise fall back to proposal_id
    // (one couple per proposal, so still semantically "the same lead").
    const key = leadId ? `lead:${leadId}` : `proposal:${inq.proposal_id}`
    const existing = map.get(key)
    const coupleName = inq.proposals?.couple_name ?? null
    const leadName = inq.proposals?.leads?.name ?? null
    if (existing) {
      existing.inquiries.push(inq)
      if (inq.status === 'new') existing.newCount += 1
      if (inq.created_at > existing.latestAt) existing.latestAt = inq.created_at
      if (coupleName && !existing.coupleNames.includes(coupleName)) existing.coupleNames.push(coupleName)
      if (!existing.proposalIds.includes(inq.proposal_id)) existing.proposalIds.push(inq.proposal_id)
      if (!existing.leadName && leadName) existing.leadName = leadName
    } else {
      map.set(key, {
        key,
        leadId,
        leadName,
        coupleNames: coupleName ? [coupleName] : [],
        proposalIds: [inq.proposal_id],
        inquiries: [inq],
        newCount: inq.status === 'new' ? 1 : 0,
        latestAt: inq.created_at,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.latestAt.localeCompare(a.latestAt))
}

function LeadGroup({
  group,
  onUpdateStatus,
  onRemove,
}: {
  group: LeadGrouping
  onUpdateStatus: (id: string, status: Status) => void
  onRemove: (id: string) => void
}) {
  const headerName = group.leadName || group.coupleNames[0] || 'Sin nombre'
  const otherCouples = group.coupleNames.filter(n => n !== headerName)
  const latestDate = new Date(group.latestAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  const ordered = useMemo(
    () => [...group.inquiries].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [group.inquiries],
  )
  // Default state: expanded when there are unread / new responses, otherwise
  // collapsed so the inbox stays tidy when there's a lot of historical noise.
  const [expanded, setExpanded] = useState(group.newCount > 0)

  return (
    <div style={{
      background: '#fff', border: '1px solid var(--ivory)', borderRadius: 12,
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          borderBottomStyle: 'solid',
          borderBottomWidth: expanded ? 1 : 0,
          borderBottomColor: 'var(--ivory)',
          background: group.newCount > 0 ? 'rgba(196,151,90,0.06)' : 'var(--surface, #faf8f5)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          borderBottomLeftRadius: expanded ? 0 : 12, borderBottomRightRadius: expanded ? 0 : 12,
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {expanded
            ? <ChevronDown size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
            : <ChevronRight size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
          }
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)' }}>{headerName}</span>
          {otherCouples.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>· {otherCouples.join(' · ')}</span>
          )}
          <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
            · {group.inquiries.length} {group.inquiries.length === 1 ? 'respuesta' : 'respuestas'}
          </span>
          {group.newCount > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'var(--gold)', color: '#fff' }}>
              {group.newCount} {group.newCount === 1 ? 'nueva' : 'nuevas'}
            </span>
          )}
          {group.proposalIds.length > 1 && (
            <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
              · {group.proposalIds.length} propuestas
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Última: {latestDate}</span>
          {group.leadId && (
            <Link
              href={`/leads?openLead=${group.leadId}`}
              className="btn btn-ghost btn-sm"
              onClick={e => e.stopPropagation()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <User size={11} /> Ver lead
            </Link>
          )}
        </div>
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {ordered.map((inq, idx) => (
            <InquiryRow
              key={inq.id}
              inq={inq}
              isLast={idx === ordered.length - 1}
              onUpdateStatus={onUpdateStatus}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function InquiryRow({
  inq,
  isLast,
  onUpdateStatus,
  onRemove,
}: {
  inq: Inquiry
  isLast: boolean
  onUpdateStatus: (id: string, status: Status) => void
  onRemove: (id: string) => void
}) {
  const Icon = ICON_BY_KIND[inq.kind] ?? MessageCircle
  const kindLabel = inq.kind_label || FALLBACK_LABEL[inq.kind] || inq.kind
  const date = new Date(inq.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = new Date(inq.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const dates = (inq.preferred_dates ?? []).map(d => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }))

  return (
    <div style={{
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
      borderBottom: isLast ? 'none' : '1px solid var(--ivory)',
      borderLeft: inq.status === 'new' ? '3px solid var(--gold)' : '3px solid transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--gold)', padding: '3px 8px', background: 'rgba(196,151,90,0.12)', borderRadius: 99 }}>
            <Icon size={11} strokeWidth={2} /> {kindLabel}
          </span>
          {inq.name && inq.name !== inq.proposals?.couple_name && (
            <span style={{ fontSize: 13, color: 'var(--charcoal)' }}>{inq.name}</span>
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
        {inq.kind !== 'visit' && inq.kind !== 'date_pick' && dates.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--warm-gray)' }}>
            <Calendar size={11} /> {dates.join(' · ')}
          </span>
        )}
      </div>

      {renderPayload(inq)}

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
          <button className="btn btn-ghost btn-sm" onClick={() => onUpdateStatus(inq.id, 'replied')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <CheckCircle2 size={11} /> Marcar como contestada
          </button>
        )}
        {inq.status === 'replied' && (
          <button className="btn btn-ghost btn-sm" onClick={() => onUpdateStatus(inq.id, 'closed')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Archive size={11} /> Cerrar
          </button>
        )}
        {inq.status === 'closed' && (
          <button className="btn btn-ghost btn-sm" onClick={() => onUpdateStatus(inq.id, 'new')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <RotateCcw size={11} /> Reabrir
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => onRemove(inq.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--rose)', marginLeft: 'auto' }}>
          <Trash2 size={11} /> Eliminar
        </button>
      </div>
    </div>
  )
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
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>Aún no has recibido respuestas</div>
        <div style={{ fontSize: 13, color: 'var(--warm-gray)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
          Cuando una pareja interactúe con tu propuesta (pida visita, elija menú, confirme fecha o te escriba), aparecerá aquí.
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {groupByLead(filtered).map(group => (
          <LeadGroup
            key={group.key}
            group={group}
            onUpdateStatus={updateStatus}
            onRemove={remove}
          />
        ))}
      </div>
    </div>
  )
}

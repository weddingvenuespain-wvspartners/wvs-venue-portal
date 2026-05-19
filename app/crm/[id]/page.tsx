'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import Spinner from '@/components/Spinner'
import {
  ChevronLeft, Phone, Mail, MessageCircle, Users, Calendar,
  Banknote, Tag, MapPin, Clock, FileText, ExternalLink, Edit2, Save, X,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type Lead = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  source?: string | null
  status: string
  contact_type: string
  wedding_date?: string | null
  wedding_date_to?: string | null
  wedding_year?: number | null
  wedding_month?: number | null
  guests?: number | null
  guests_adults?: number | null
  guests_children?: number | null
  budget?: string | null
  ceremony_type?: string | null
  notes?: string | null
  country?: string | null
  tags?: string[] | null
  created_at: string
  updated_at?: string | null
}

// ── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  new:             { label: 'Nuevo',             bg: '#eff6ff', color: '#1d4ed8' },
  contacted:       { label: 'Contactado',        bg: '#f5f3ff', color: '#6d28d9' },
  proposal_sent:   { label: 'Propuesta enviada', bg: '#fefce8', color: '#a16207' },
  visit_scheduled: { label: 'Visita agendada',   bg: '#f0fdf4', color: '#15803d' },
  post_visit:      { label: 'Post-visita',       bg: '#ecfdf5', color: '#059669' },
  budget_sent:     { label: 'Presupuesto',       bg: '#fff7ed', color: '#c2410c' },
  won:             { label: 'Confirmado',        bg: '#d1fae5', color: '#065f46' },
  lost:            { label: 'Perdido',           bg: '#fef2f2', color: '#b91c1c' },
}

const CONTACT_TYPE_CFG: Record<string, { label: string; bg: string; color: string; emoji: string }> = {
  pareja:           { label: 'Pareja',            bg: '#fdf4ff', color: '#7e22ce', emoji: '💑' },
  wedding_planner:  { label: 'Wedding Planner',   bg: '#f0f9ff', color: '#0369a1', emoji: '📋' },
  event_organizer:  { label: 'Event Organizer',   bg: '#fff7ed', color: '#c2410c', emoji: '🎪' },
  empresa:          { label: 'Empresa',            bg: '#f8fafc', color: '#334155', emoji: '🏢' },
  otro:             { label: 'Otro',               bg: '#f3f4f6', color: '#6b7280', emoji: '👤' },
}

const SOURCE_LABEL: Record<string, string> = {
  web: 'Web', whatsapp: 'WhatsApp', instagram: 'Instagram',
  email: 'Email', referral: 'Referido', manual: 'Manual',
  other: 'Otro', wedding_planner: 'Wedding Planner',
  wedding_venues_spain: 'Wedding Venues Spain', bodas_net: 'Bodas.net',
}

const BUDGET_LABEL: Record<string, string> = {
  sin_definir: '—', menos_10k: '< 10k€', '10k_15k': '10–15k€',
  '15k_20k': '15–20k€', '20k_25k': '20–25k€', '25k_30k': '25–30k€',
  '30k_40k': '30–40k€', '40k_50k': '40–50k€', '50k_75k': '50–75k€',
  '75k_100k': '75–100k€', mas_100k: '> 100k€',
  menos_20k: '< 20k€', '20k_35k': '20–35k€', mas_50k: '> 50k€',
  wvs_menos_20k: '< 20k€', wvs_20k_35k: '20–35k€', wvs_35k_40k: '35–40k€',
  wvs_40k_51k: '40–51k€', wvs_51k_60k: '51–60k€', wvs_mas_60k: '> 60k€',
}

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmtDate(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

function weddingLabel(lead: Lead) {
  if (lead.wedding_date) {
    const from = fmtDate(lead.wedding_date)
    const to   = lead.wedding_date_to ? ` → ${fmtDate(lead.wedding_date_to)}` : ''
    return from + to
  }
  if (lead.wedding_year && lead.wedding_month) return `${MONTHS_SHORT[lead.wedding_month - 1]} ${lead.wedding_year}`
  if (lead.wedding_year) return `${lead.wedding_year}`
  return '—'
}

// ── Row helper ────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, href, isAction }: {
  icon: React.ReactNode; label: string; value: string | React.ReactNode; href?: string; isAction?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--ivory)', alignItems: 'flex-start' }}>
      <div style={{ color: 'var(--warm-gray)', flexShrink: 0, marginTop: 1 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: 2 }}>{label}</div>
        {href ? (
          <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
            style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none', wordBreak: 'break-all' }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
            {value}
          </a>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--charcoal)', wordBreak: 'break-word' }}>{value}</div>
        )}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CrmContactPage() {
  const router   = useRouter()
  const params   = useParams()
  const id       = params.id as string
  const { user, loading: authLoading, activeVenue } = useAuth()
  const { isBlocked } = useRequireSubscription()

  const [lead,    setLead]    = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [form,    setForm]    = useState<Partial<Lead>>({})

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    load()
  }, [user, authLoading, id]) // eslint-disable-line

  const load = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('leads')
      .select('id,name,email,phone,whatsapp,source,status,contact_type,wedding_date,wedding_date_to,wedding_year,wedding_month,guests,guests_adults,guests_children,budget,ceremony_type,notes,country,tags,created_at,updated_at')
      .eq('id', id)
      .maybeSingle()
    if (data) { setLead(data as Lead); setForm(data as Lead) }
    setLoading(false)
  }

  const save = async () => {
    if (!lead) return
    setSaving(true)
    const supabase = createClient()
    const updates = {
      name:         form.name,
      email:        form.email || null,
      phone:        form.phone || null,
      whatsapp:     form.whatsapp || null,
      contact_type: form.contact_type || 'pareja',
      status:       form.status,
      notes:        form.notes || null,
    }
    const { data } = await supabase.from('leads').update(updates).eq('id', id).select().maybeSingle()
    if (data) setLead(data as Lead)
    setEditing(false)
    setSaving(false)
  }

  if (isBlocked) return null
  if (loading || authLoading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </div>
  )
  if (!lead) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div style={{ padding: 40, color: 'var(--warm-gray)', fontSize: 14 }}>Contacto no encontrado.</div>
      </div>
    </div>
  )

  const sc  = STATUS_CFG[lead.status]   || { label: lead.status,       bg: '#f3f4f6', color: '#6b7280' }
  const ctc = CONTACT_TYPE_CFG[lead.contact_type] || CONTACT_TYPE_CFG.otro

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        {/* Topbar */}
        <div className="topbar" style={{ gap: 12 }}>
          <button onClick={() => router.push('/crm')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', fontSize: 13, padding: 0, fontFamily: 'Inter, sans-serif' }}>
            <ChevronLeft size={15} /> CRM
          </button>
          <span style={{ color: '#d1cac3' }}>·</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)' }}>{lead.name}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {editing ? (
              <>
                <button onClick={() => { setEditing(false); setForm(lead) }} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <X size={13} /> Cancelar
                </button>
                <button onClick={save} disabled={saving} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Save size={13} /> {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Edit2 size={13} /> Editar
                </button>
                <button onClick={() => router.push('/leads')} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ExternalLink size={13} /> Ver en Leads
                </button>
              </>
            )}
          </div>
        </div>

        <div className="page-content">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

            {/* Left: main info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Header card */}
              <div className="card" style={{ padding: '24px 28px' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: ctc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                    {ctc.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {editing ? (
                      <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="form-input" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }} />
                    ) : (
                      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--charcoal)', margin: '0 0 8px' }}>{lead.name}</h1>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* Contact type badge */}
                      {editing ? (
                        <select value={form.contact_type || 'pareja'} onChange={e => setForm(f => ({ ...f, contact_type: e.target.value }))}
                          style={{ fontSize: 12, padding: '3px 8px', border: '1px solid var(--ivory)', borderRadius: 6, background: ctc.bg, color: ctc.color, fontFamily: 'Inter, sans-serif' }}>
                          {Object.entries(CONTACT_TYPE_CFG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 600, background: ctc.bg, color: ctc.color, borderRadius: 6, padding: '3px 10px' }}>
                          {ctc.emoji} {ctc.label}
                        </span>
                      )}
                      {/* Status badge */}
                      {editing ? (
                        <select value={form.status || lead.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                          style={{ fontSize: 12, padding: '3px 8px', border: '1px solid var(--ivory)', borderRadius: 6, background: sc.bg, color: sc.color, fontFamily: 'Inter, sans-serif' }}>
                          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.color, borderRadius: 6, padding: '3px 10px' }}>
                          {sc.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact info card */}
              <div className="card" style={{ padding: '20px 28px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: 4 }}>Datos de contacto</div>
                {editing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                    {[
                      { key: 'email',    label: 'Email',     type: 'email' },
                      { key: 'phone',    label: 'Teléfono',  type: 'tel'   },
                      { key: 'whatsapp', label: 'WhatsApp',  type: 'tel'   },
                    ].map(({ key, label, type }) => (
                      <div key={key} className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: 11 }}>{label}</label>
                        <input type={type} className="form-input"
                          value={(form as any)[key] || ''}
                          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {lead.email && <InfoRow icon={<Mail size={15} />} label="Email" value={lead.email} href={`mailto:${lead.email}`} />}
                    {lead.phone && <InfoRow icon={<Phone size={15} />} label="Teléfono" value={lead.phone} href={`tel:${lead.phone}`} />}
                    {lead.whatsapp && <InfoRow icon={<MessageCircle size={15} />} label="WhatsApp" value={lead.whatsapp} href={`https://wa.me/${lead.whatsapp.replace(/\D/g,'')}`} />}
                    {!lead.email && !lead.phone && !lead.whatsapp && (
                      <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', marginTop: 12 }}>Sin datos de contacto</p>
                    )}
                  </>
                )}
              </div>

              {/* Wedding / event info — only for parejas */}
              {(lead.contact_type === 'pareja' || !lead.contact_type) && (
                <div className="card" style={{ padding: '20px 28px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: 4 }}>Detalles de la boda</div>
                  <InfoRow icon={<Calendar size={15} />}    label="Fecha"       value={weddingLabel(lead)} />
                  {lead.guests      && <InfoRow icon={<Users size={15} />}     label="Invitados"    value={`${lead.guests}${lead.guests_adults ? ` (${lead.guests_adults} adultos, ${lead.guests_children || 0} niños)` : ''}`} />}
                  {lead.budget && lead.budget !== 'sin_definir' && <InfoRow icon={<Banknote size={15} />}  label="Presupuesto"  value={BUDGET_LABEL[lead.budget] || lead.budget} />}
                  {lead.ceremony_type && lead.ceremony_type !== 'sin_definir' && (
                    <InfoRow icon={<Tag size={15} />} label="Ceremonia" value={{ civil: 'Civil', religiosa: 'Religiosa', simbolica: 'Simbólica', mixta: 'Mixta' }[lead.ceremony_type] || lead.ceremony_type} />
                  )}
                  {lead.country && <InfoRow icon={<MapPin size={15} />} label="País" value={lead.country} />}
                </div>
              )}

              {/* Notes */}
              <div className="card" style={{ padding: '20px 28px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: 12 }}>Notas</div>
                {editing ? (
                  <textarea className="form-input" rows={5} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Añade notas sobre este contacto…" style={{ resize: 'vertical', fontSize: 13 }} />
                ) : lead.notes ? (
                  <p style={{ fontSize: 13, color: 'var(--charcoal)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{lead.notes}</p>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', margin: 0 }}>Sin notas</p>
                )}
              </div>
            </div>

            {/* Right: metadata sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="card" style={{ padding: '18px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: 12 }}>Origen</div>
                <InfoRow icon={<MapPin size={14} />} label="Canal" value={SOURCE_LABEL[lead.source || ''] || lead.source || '—'} />
                <InfoRow icon={<Clock size={14} />}  label="Entrada" value={fmtDate(lead.created_at)} />
                {lead.updated_at && <InfoRow icon={<Clock size={14} />} label="Actualizado" value={fmtDate(lead.updated_at)} />}
              </div>

              {lead.tags && lead.tags.length > 0 && (
                <div className="card" style={{ padding: '18px 20px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: 10 }}>Etiquetas</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {lead.tags.map(t => (
                      <span key={t} style={{ fontSize: 11, background: 'var(--ivory)', color: 'var(--warm-gray)', borderRadius: 5, padding: '3px 8px' }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div className="card" style={{ padding: '18px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: 10 }}>Acciones rápidas</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {lead.email && (
                    <a href={`mailto:${lead.email}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#f0f9ff', color: '#0369a1', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
                      <Mail size={13} /> Enviar email
                    </a>
                  )}
                  {lead.whatsapp && (
                    <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#f0fdf4', color: '#15803d', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
                      <MessageCircle size={13} /> WhatsApp
                    </a>
                  )}
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#faf8f5', color: 'var(--charcoal)', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
                      <Phone size={13} /> Llamar
                    </a>
                  )}
                  <button onClick={() => router.push('/leads')}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--ivory)', color: 'var(--charcoal)', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left' }}>
                    <ExternalLink size={13} /> Ver pipeline en Leads
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

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
  Landmark, UtensilsCrossed, Globe, Palette, Sparkles, CheckCircle2,
  MessageSquare, Heart, Paperclip, Link2, CalendarCheck,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type Lead = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  whatsapp_consent?: boolean | null
  source?: string | null
  status: string
  contact_type: string
  wedding_date?: string | null
  wedding_date_to?: string | null
  wedding_year?: number | null
  wedding_month?: number | null
  date_flexibility?: string | null
  guests?: number | null
  guests_adults?: number | null
  guests_children?: number | null
  budget?: string | null
  ceremony_type?: string | null
  catering_needed?: string | null
  language?: string | null
  style?: string | null
  notes?: string | null
  country?: string | null
  tags?: string[] | null
  visit_date?: string | null
  visit_time?: string | null
  visit_duration?: number | null
  initial_message?: string | null
  wedding_duration_days?: number | null
  // Budget/confirmed dates (budget_sent, won)
  budget_date?: string | null
  budget_date_to?: string | null
  budget_date_flexibility?: string | null
  budget_date_ranges?: { from: string; to: string }[] | null
  // Attached documents
  budget_file_url?: string | null
  budget_file_name?: string | null
  budget_files?: { url: string; name: string }[] | null
  // Original desired dates
  original_wedding_date?: string | null
  original_wedding_date_to?: string | null
  original_date_flexibility?: string | null
  created_at: string
  updated_at?: string | null
}

// ── Config ───────────────────────────────────────────────────────────────────

const PIPELINE: { key: string; label: string }[] = [
  { key: 'new',             label: 'Nuevo'      },
  { key: 'contacted',       label: 'Seguimiento' },
  { key: 'proposal_sent',   label: 'Propuesta'  },
  { key: 'visit_scheduled', label: 'Visita'     },
  { key: 'post_visit',      label: 'Post-visita' },
  { key: 'budget_sent',     label: 'Presupuesto' },
  { key: 'won',             label: 'Confirmado' },
]

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  new:             { label: 'Nuevo',              bg: '#eff6ff', color: '#1d4ed8' },
  contacted:       { label: 'En seguimiento',     bg: '#f5f3ff', color: '#6d28d9' },
  proposal_sent:   { label: 'Propuesta enviada',  bg: '#fefce8', color: '#a16207' },
  visit_scheduled: { label: 'Visita agendada',    bg: '#f0fdf4', color: '#15803d' },
  post_visit:      { label: 'Post-visita',        bg: '#ecfdf5', color: '#059669' },
  budget_sent:     { label: 'Presupuesto enviado',bg: '#fff7ed', color: '#c2410c' },
  won:             { label: 'Confirmado',         bg: '#d1fae5', color: '#065f46' },
  lost:            { label: 'Perdido',            bg: '#fef2f2', color: '#b91c1c' },
}

const CONTACT_TYPE_CFG: Record<string, { label: string; bg: string; color: string; emoji: string }> = {
  pareja:           { label: 'Pareja',          bg: '#fdf4ff', color: '#7e22ce', emoji: '💑' },
  wedding_planner:  { label: 'Wedding Planner', bg: '#f0f9ff', color: '#0369a1', emoji: '📋' },
  event_organizer:  { label: 'Event Organizer', bg: '#fff7ed', color: '#c2410c', emoji: '🎪' },
  empresa:          { label: 'Empresa',          bg: '#f8fafc', color: '#334155', emoji: '🏢' },
  otro:             { label: 'Otro',             bg: '#f3f4f6', color: '#6b7280', emoji: '👤' },
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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

function weddingLabel(lead: Lead): string {
  if (lead.wedding_date) {
    const from = fmtDate(lead.wedding_date)
    const to   = lead.wedding_date_to ? ` → ${fmtDate(lead.wedding_date_to)}` : ''
    return from + to
  }
  if (lead.wedding_year && lead.wedding_month) return `${MONTHS_SHORT[lead.wedding_month - 1]} ${lead.wedding_year}`
  if (lead.wedding_year) return String(lead.wedding_year)
  const flex = lead.date_flexibility
  if (flex === 'flexible') return 'Flexible (sin fecha definida)'
  if (flex === 'season')   return 'Por estación'
  return '—'
}

function budgetDatesLabel(lead: Lead): string {
  if (lead.budget_date) {
    const from = fmtDate(lead.budget_date)
    const to   = lead.budget_date_to ? ` → ${fmtDate(lead.budget_date_to)}` : ''
    return from + to
  }
  if (lead.budget_date_ranges && lead.budget_date_ranges.length > 0) {
    return lead.budget_date_ranges.map(r => `${fmtDate(r.from)}${r.to && r.to !== r.from ? ` → ${fmtDate(r.to)}` : ''}`).join(', ')
  }
  return '—'
}

function originalDatesLabel(lead: Lead): string {
  if (lead.original_wedding_date) {
    const from = fmtDate(lead.original_wedding_date)
    const to   = lead.original_wedding_date_to ? ` → ${fmtDate(lead.original_wedding_date_to)}` : ''
    return from + to
  }
  return '—'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: 14 }}>
      {children}
    </div>
  )
}

function InfoRow({ icon, label, value, href, mono }: {
  icon: React.ReactNode; label: string; value: string | React.ReactNode; href?: string; mono?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--ivory)', alignItems: 'flex-start' }}>
      <div style={{ color: 'var(--warm-gray)', flexShrink: 0, marginTop: 1 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: 2 }}>{label}</div>
        {href ? (
          <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
            style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none', wordBreak: 'break-all', fontFamily: mono ? 'monospace' : undefined }}>
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

  const [lead,         setLead]         = useState<Lead | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [editing,      setEditing]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [form,         setForm]         = useState<Partial<Lead>>({})
  const [relatedLeads, setRelatedLeads] = useState<Lead[]>([])

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
      .select('id,name,email,phone,whatsapp,whatsapp_consent,source,status,contact_type,wedding_date,wedding_date_to,wedding_year,wedding_month,date_flexibility,wedding_duration_days,guests,guests_adults,guests_children,budget,ceremony_type,catering_needed,language,style,notes,country,tags,visit_date,visit_time,visit_duration,initial_message,budget_date,budget_date_to,budget_date_flexibility,budget_date_ranges,budget_file_url,budget_file_name,budget_files,original_wedding_date,original_wedding_date_to,original_date_flexibility,created_at,updated_at')
      .eq('id', id)
      .maybeSingle()
    if (data) {
      const loadedLead = data as Lead
      setLead(loadedLead)
      setForm(loadedLead)
      // For wedding planners: load other leads from same WP (matched by email)
      if (loadedLead.contact_type === 'wedding_planner' && loadedLead.email) {
        const { data: rel } = await supabase
          .from('leads')
          .select('id,name,status,wedding_date,wedding_year,wedding_month,date_flexibility,budget_date,created_at')
          .eq('email', loadedLead.email)
          .neq('id', loadedLead.id)
          .order('created_at', { ascending: false })
          .limit(20)
        setRelatedLeads((rel || []) as Lead[])
      }
    }
    setLoading(false)
  }

  const save = async () => {
    if (!lead) return
    setSaving(true)
    const supabase = createClient()
    const updates = {
      name:         form.name,
      email:        form.email         || null,
      phone:        form.phone         || null,
      whatsapp:     form.whatsapp      || null,
      contact_type: form.contact_type  || 'pareja',
      status:       form.status,
      notes:        form.notes         || null,
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

  const sc  = STATUS_CFG[lead.status]              || { label: lead.status,       bg: '#f3f4f6', color: '#6b7280' }
  const ctc = CONTACT_TYPE_CFG[lead.contact_type]  || CONTACT_TYPE_CFG.otro

  // Pipeline index
  const pipelineIdx  = PIPELINE.findIndex(p => p.key === lead.status)
  const isLost       = lead.status === 'lost'

  const isPareja    = lead.contact_type === 'pareja' || !lead.contact_type
  const isWP        = lead.contact_type === 'wedding_planner'
  const hasVisit    = !!lead.visit_date
  const isNewPhase  = lead.status === 'new'  || lead.status === 'lost'
  const isBudget    = lead.status === 'budget_sent' || lead.status === 'won'
  const isActive    = !isNewPhase && !isBudget  // contacted / proposal_sent / visit_*

  // Documents list
  const docFiles: { url: string; name: string }[] = (() => {
    const files = lead.budget_files || []
    if (files.length) return files
    if (lead.budget_file_url) return [{ url: lead.budget_file_url, name: lead.budget_file_name || 'Documento adjunto' }]
    return []
  })()

  // Visit time display
  const visitTimeLabel = (() => {
    if (!lead.visit_time) return ''
    if (!lead.visit_duration) return lead.visit_time
    const [h, m] = lead.visit_time.split(':').map(Number)
    const tot = h * 60 + m + lead.visit_duration
    const eh  = Math.floor(tot / 60) % 24
    const em  = tot % 60
    return `${lead.visit_time} – ${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')} (${lead.visit_duration} min)`
  })()

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
                <button onClick={() => router.push(`/leads?open=${lead.id}`)} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ExternalLink size={13} /> Ver en Leads
                </button>
              </>
            )}
          </div>
        </div>

        <div className="page-content">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

            {/* ── Left column ──────────────────────────────────────────────── */}
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

                {/* Pipeline progress bar */}
                {!isLost && (
                  <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--ivory)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative' }}>
                      {/* Connecting line */}
                      <div style={{ position: 'absolute', top: 10, left: 10, right: 10, height: 2, background: 'var(--ivory)', zIndex: 0 }} />
                      <div style={{ position: 'absolute', top: 10, left: 10, height: 2, background: 'var(--gold)', zIndex: 1,
                        width: pipelineIdx < 0 ? '0%' : `${(pipelineIdx / (PIPELINE.length - 1)) * (100 - 20 / PIPELINE.length)}%`,
                        transition: 'width 0.3s',
                      }} />
                      {PIPELINE.map((step, i) => {
                        const done    = i < pipelineIdx
                        const current = i === pipelineIdx
                        return (
                          <div key={step.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, position: 'relative', zIndex: 2 }}>
                            <div style={{
                              width: 20, height: 20, borderRadius: '50%',
                              background: done ? 'var(--gold)' : current ? 'var(--espresso)' : '#fff',
                              border: `2px solid ${done || current ? (done ? 'var(--gold)' : 'var(--espresso)') : 'var(--ivory)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {done && <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>✓</span>}
                              {current && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'block' }} />}
                            </div>
                            <span style={{ fontSize: 9.5, fontWeight: current ? 700 : 500, color: current ? 'var(--espresso)' : done ? 'var(--gold)' : 'var(--warm-gray)', textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                              {step.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {isLost && (
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#b91c1c', fontWeight: 500 }}>Lead perdido — ya no está activo en el pipeline</span>
                  </div>
                )}
              </div>

              {/* Visit banner — shown prominently when visit exists */}
              {hasVisit && (
                <div style={{ padding: '16px 20px', borderRadius: 12, background: 'linear-gradient(135deg,#ecfdf5,#f0fdf4)', border: '1.5px solid #6ee7b7', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Landmark size={18} style={{ color: '#fff' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                      {lead.status === 'post_visit' ? 'Visita realizada' : 'Visita agendada'}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#047857' }}>
                      {fmtDate(lead.visit_date)}
                      {visitTimeLabel && <span style={{ fontWeight: 400, fontSize: 13, color: '#059669' }}> · {visitTimeLabel}</span>}
                    </div>
                  </div>
                  <button onClick={() => router.push(`/leads?open=${lead.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.7)', border: '1px solid #a7f3d0', color: '#047857', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    <ExternalLink size={11} /> Gestionar
                  </button>
                </div>
              )}

              {/* Contact info card */}
              <div className="card" style={{ padding: '20px 28px' }}>
                <SectionLabel>Datos de contacto</SectionLabel>
                {editing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { key: 'email',    label: 'Email',    type: 'email' },
                      { key: 'phone',    label: 'Teléfono', type: 'tel'   },
                      { key: 'whatsapp', label: 'WhatsApp', type: 'tel'   },
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
                    {lead.email    && <InfoRow icon={<Mail           size={14} />} label="Email"     value={lead.email}    href={`mailto:${lead.email}`} />}
                    {lead.phone    && <InfoRow icon={<Phone          size={14} />} label="Teléfono"  value={lead.phone}    href={`tel:${lead.phone}`} />}
                    {lead.whatsapp && <InfoRow icon={<MessageCircle  size={14} />} label="WhatsApp"  value={lead.whatsapp} href={`https://wa.me/${lead.whatsapp.replace(/\D/g,'')}`} />}
                    {lead.whatsapp_consent !== null && lead.whatsapp_consent !== undefined && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', borderBottom: '1px solid var(--ivory)' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: lead.whatsapp_consent ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {lead.whatsapp_consent
                            ? <CheckCircle2 size={12} style={{ color: '#16a34a' }} />
                            : <X size={12} style={{ color: '#dc2626' }} />}
                        </div>
                        <span style={{ fontSize: 12, color: lead.whatsapp_consent ? '#15803d' : '#b91c1c', fontWeight: 500 }}>
                          {lead.whatsapp_consent ? 'Acepta contacto por WhatsApp' : 'No acepta contacto por WhatsApp'}
                        </span>
                      </div>
                    )}
                    {!lead.email && !lead.phone && !lead.whatsapp && (
                      <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', margin: '8px 0 0' }}>Sin datos de contacto</p>
                    )}
                  </>
                )}
              </div>

              {/* Event / wedding details — parejas only */}
              {isPareja && (
                <div className="card" style={{ padding: '20px 28px' }}>
                  <SectionLabel>Detalles del evento</SectionLabel>

                  {/* ── Confirmed / budget dates ── */}
                  {isBudget && (
                    <InfoRow icon={<CalendarCheck size={14} />} label="Fechas confirmadas" value={budgetDatesLabel(lead)} />
                  )}

                  {/* ── Proposed / negotiated dates (active non-budget leads) ── */}
                  {isActive && (
                    <InfoRow icon={<Calendar size={14} />} label="Fechas propuestas" value={weddingLabel(lead)} />
                  )}

                  {/* ── Wedding duration ── */}
                  {lead.wedding_duration_days && lead.wedding_duration_days > 1 && (
                    <InfoRow icon={<Clock size={14} />} label="Duración" value={`${lead.wedding_duration_days} días`} />
                  )}

                  {/* ── Original desired dates (for non-new-phase leads) ── */}
                  {!isNewPhase && originalDatesLabel(lead) !== '—' && (
                    <InfoRow icon={<FileText size={14} />} label="Fecha solicitada originalmente" value={originalDatesLabel(lead)} />
                  )}

                  {/* ── New/lost: just show desired dates ── */}
                  {isNewPhase && (
                    <InfoRow icon={<Calendar size={14} />} label="Fecha deseada" value={weddingLabel(lead)} />
                  )}

                  {/* ── Guests ── */}
                  {(lead.guests || lead.guests_adults) && (
                    <InfoRow icon={<Users size={14} />} label="Invitados" value={
                      lead.guests_adults
                        ? `${(lead.guests_adults || 0) + (lead.guests_children || 0)} total · ${lead.guests_adults} adultos${lead.guests_children ? `, ${lead.guests_children} niños` : ''}`
                        : `${lead.guests}`
                    } />
                  )}

                  {/* ── Budget ── */}
                  {lead.budget && lead.budget !== 'sin_definir' && (
                    <InfoRow icon={<Banknote size={14} />} label="Presupuesto orientativo" value={BUDGET_LABEL[lead.budget] || lead.budget} />
                  )}

                  {/* ── Ceremony ── */}
                  {lead.ceremony_type && lead.ceremony_type !== 'sin_definir' && (
                    <InfoRow icon={<Heart size={14} />} label="Ceremonia" value={{ civil: 'Civil', religiosa: 'Religiosa', simbolica: 'Simbólica', mixta: 'Mixta' }[lead.ceremony_type] || lead.ceremony_type} />
                  )}

                  {/* ── Catering ── */}
                  {lead.catering_needed && lead.catering_needed !== 'sin_definir' && (
                    <InfoRow icon={<UtensilsCrossed size={14} />} label="Catering" value={{ incluido: 'Incluido en el venue', externo: 'Traen catering externo', por_definir: 'Por definir' }[lead.catering_needed] || lead.catering_needed} />
                  )}

                  {/* ── Country / Language / Style ── */}
                  {lead.country  && <InfoRow icon={<MapPin  size={14} />} label="País"           value={lead.country} />}
                  {lead.language && <InfoRow icon={<Globe   size={14} />} label="Idioma"          value={lead.language} />}
                  {lead.style    && <InfoRow icon={<Palette size={14} />} label="Estilo buscado"  value={lead.style} />}

                  {/* ── Tags ── */}
                  {lead.tags && lead.tags.length > 0 && (
                    <div style={{ padding: '9px 0', borderBottom: '1px solid var(--ivory)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ color: 'var(--warm-gray)', flexShrink: 0, marginTop: 1 }}><Tag size={14} /></div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: 5 }}>Etiquetas</div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {lead.tags.map(t => (
                            <span key={t} style={{ fontSize: 11, background: 'var(--cream)', color: 'var(--warm-gray)', border: '1px solid var(--ivory)', borderRadius: 5, padding: '2px 8px' }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Initial message — if exists */}
              {lead.initial_message && (
                <div className="card" style={{ padding: '20px 28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <SectionLabel>Mensaje inicial</SectionLabel>
                    <span style={{ fontSize: 10, color: 'var(--warm-gray)', fontWeight: 400, marginBottom: 14, marginLeft: 4 }}>desde foreventos.com</span>
                  </div>
                  <div style={{ padding: '12px 16px', borderRadius: 10, background: '#faf8f5', border: '1px solid var(--ivory)', fontSize: 13, color: 'var(--charcoal)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {lead.initial_message}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="card" style={{ padding: '20px 28px' }}>
                <SectionLabel>Notas internas</SectionLabel>
                {editing ? (
                  <textarea className="form-input" rows={5} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Añade notas sobre este contacto…" style={{ resize: 'vertical', fontSize: 13 }} />
                ) : lead.notes ? (
                  <p style={{ fontSize: 13, color: 'var(--charcoal)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{lead.notes}</p>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', margin: 0 }}>Sin notas</p>
                )}
              </div>
              {/* Documents (budget files) */}
              {docFiles.length > 0 && (
                <div className="card" style={{ padding: '20px 28px' }}>
                  <SectionLabel>Documentos adjuntos</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {docFiles.map((f, i) => (
                      <a key={i} href={f.url} target="_blank" rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#f9fafb', border: '1.5px solid var(--ivory)', textDecoration: 'none', color: 'var(--charcoal)' }}>
                        <Paperclip size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Presupuesto adjunto</div>
                        </div>
                        <ExternalLink size={12} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Related leads — for wedding planners */}
              {isWP && relatedLeads.length > 0 && (
                <div className="card" style={{ padding: '20px 28px' }}>
                  <SectionLabel>Otras parejas de este WP</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {relatedLeads.map(rl => {
                      const sc2 = STATUS_CFG[rl.status] || { label: rl.status, bg: '#f3f4f6', color: '#6b7280' }
                      const dateLabel = rl.budget_date ? fmtDate(rl.budget_date)
                        : rl.wedding_date ? fmtDate(rl.wedding_date)
                        : rl.wedding_year ? String(rl.wedding_year)
                        : '—'
                      return (
                        <button key={rl.id} onClick={() => router.push(`/crm/${rl.id}`)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#fafaf8', border: '1px solid var(--ivory)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left', width: '100%' }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: sc2.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>💑</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rl.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{dateLabel}</div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 600, background: sc2.bg, color: sc2.color, borderRadius: 5, padding: '2px 7px', flexShrink: 0 }}>{sc2.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* ── Right sidebar ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Quick actions */}
              <div className="card" style={{ padding: '18px 20px' }}>
                <SectionLabel>Acciones rápidas</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {lead.email && (
                    <a href={`mailto:${lead.email}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: '#f0f9ff', color: '#0369a1', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                      <Mail size={13} /> Enviar email
                    </a>
                  )}
                  {lead.whatsapp && (
                    <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: '#f0fdf4', color: '#15803d', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                      <MessageCircle size={13} /> WhatsApp
                    </a>
                  )}
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: '#faf8f5', color: 'var(--charcoal)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                      <Phone size={13} /> Llamar
                    </a>
                  )}
                  <button onClick={() => router.push(`/leads?open=${lead.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: 'var(--ivory)', color: 'var(--charcoal)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left' }}>
                    <ExternalLink size={13} /> Ver pipeline en Leads
                  </button>
                </div>
              </div>

              {/* Origin + dates */}
              <div className="card" style={{ padding: '18px 20px' }}>
                <SectionLabel>Origen</SectionLabel>
                <InfoRow icon={<Sparkles size={13} />} label="Canal" value={SOURCE_LABEL[lead.source || ''] || lead.source || '—'} />
                <InfoRow icon={<Clock    size={13} />} label="Entrada"     value={fmtDate(lead.created_at)} />
                {lead.updated_at && <InfoRow icon={<Clock size={13} />} label="Actualizado" value={fmtDate(lead.updated_at)} />}
              </div>

              {/* Tags — for non-parejas */}
              {!isPareja && lead.tags && lead.tags.length > 0 && (
                <div className="card" style={{ padding: '18px 20px' }}>
                  <SectionLabel>Etiquetas</SectionLabel>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {lead.tags.map(t => (
                      <span key={t} style={{ fontSize: 11, background: 'var(--ivory)', color: 'var(--warm-gray)', borderRadius: 5, padding: '3px 8px' }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import Spinner from '@/components/Spinner'
import {
  ChevronLeft, ChevronDown, Phone, Mail, MessageCircle, Users, Calendar,
  Banknote, Tag, MapPin, Clock, FileText, ExternalLink, Edit2, Save, X,
  Landmark, UtensilsCrossed, Globe, Palette, Sparkles, CheckCircle2,
  Heart, Paperclip, CalendarCheck, Trash2,
} from 'lucide-react'
import type { Client, ClientType } from '@/lib/clients'
import { CLIENT_TYPE_LABELS, CLIENT_TYPE_COLORS } from '@/lib/clients'

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
  budget_date?: string | null
  budget_date_to?: string | null
  budget_date_flexibility?: string | null
  budget_date_ranges?: { from: string; to: string }[] | null
  budget_file_url?: string | null
  budget_file_name?: string | null
  budget_files?: { url: string; name: string }[] | null
  original_wedding_date?: string | null
  original_wedding_date_to?: string | null
  original_date_flexibility?: string | null
  planner_id?: string | null
  created_at: string
  updated_at?: string | null
}

type Tab = 'info' | 'peticiones' | 'oferta' | 'notas' | 'colaboracion'

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
  menos_20k: '< 20k€', '20k_35k': '20–35k€', '35k_50k': '35–50k€', mas_50k: '> 50k€',
  wvs_menos_20k: '< 20k€', wvs_20k_35k: '20–35k€', wvs_35k_40k: '35–40k€',
  wvs_40k_51k: '40–51k€', wvs_51k_60k: '51–60k€', wvs_mas_60k: '> 60k€',
}

const PROPOSAL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: 'Borrador',  color: '#92400e', bg: '#fef3c7' },
  sent:     { label: 'Enviado',   color: '#1e40af', bg: '#dbeafe' },
  viewed:   { label: 'Visto',     color: '#047857', bg: '#d1fae5' },
  accepted: { label: 'Aceptado',  color: '#15803d', bg: '#dcfce7' },
  rejected: { label: 'Rechazado', color: '#b91c1c', bg: '#fee2e2' },
}

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ── Helpers ──────────────────────────────────────────────────────────────────

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

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  fontSize: 12,
  fontWeight: active ? 600 : 500,
  color: active ? 'var(--charcoal)' : 'var(--warm-gray)',
  background: active ? '#fff' : 'transparent',
  border: active ? '1px solid var(--ivory)' : '1px solid transparent',
  borderBottom: active ? '1px solid #fff' : '1px solid var(--ivory)',
  borderRadius: '6px 6px 0 0',
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
  position: 'relative',
  zIndex: active ? 1 : 0,
  marginBottom: -1,
})

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CrmClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router  = useRouter()
  const { user, loading: authLoading, activeVenue } = useAuth()
  const { isBlocked } = useRequireSubscription()
  const supabase = createClient()

  const [client,       setClient]       = useState<Client | null>(null)
  const [clientLeads,  setClientLeads]  = useState<Lead[]>([])
  const [proposals,    setProposals]    = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState<Tab>('info')
  const [editing,      setEditing]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [editForm,     setEditForm]     = useState({ name: '', email: '', phone: '', whatsapp: '', client_type: 'pareja' as ClientType, language: '', country: '' })

  // Notes auto-save
  const [notes, setNotes]       = useState('')
  const notesTimer              = useRef<ReturnType<typeof setTimeout> | null>(null)

  // WP couples
  const [couples,      setCouples]      = useState<(Client & { leadCount: number; latestStatus: string | null })[]>([])
  const [wpExpanded,   setWpExpanded]   = useState(false)

  // WP collaboration
  const [agreementForm, setAgreementForm] = useState({ commission_percent: '', commission_type: 'percentage', agreement_notes: '', agreement_start: '', agreement_end: '' })
  const [savingAgreement, setSavingAgreement] = useState(false)

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    if (!activeVenue) return
    loadData()
  }, [user, authLoading, activeVenue?.id, id]) // eslint-disable-line

  const loadData = async () => {
    if (!activeVenue) return
    setLoading(true)

    const [clientRes, leadsRes, proposalsRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).eq('venue_id', activeVenue.id).single(),
      supabase.from('leads').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('proposals').select('id, slug, couple_name, status, created_at, lead_id').eq('venue_id', activeVenue.id),
    ])

    if (!clientRes.data) {
      // Fallback: maybe the URL has a lead ID instead of client ID
      const { data: leadById } = await supabase.from('leads').select('client_id').eq('id', id).maybeSingle()
      if (leadById?.client_id) {
        router.replace(`/crm/${leadById.client_id}`)
        return
      }
      router.push('/crm')
      return
    }
    const c = clientRes.data as Client
    setClient(c)
    setNotes(c.notes ?? '')
    setEditForm({
      name: c.name ?? '', email: c.email ?? '', phone: c.phone ?? '', whatsapp: c.whatsapp ?? '',
      client_type: c.client_type ?? 'pareja', language: c.language ?? '', country: c.country ?? '',
    })

    // WP agreement
    if (c.client_type === 'wedding_planner') {
      setAgreementForm({
        commission_percent: c.wp_commission_percent?.toString() ?? '',
        commission_type: c.wp_commission_type ?? 'percentage',
        agreement_notes: c.wp_agreement_notes ?? '',
        agreement_start: c.wp_agreement_start ?? '',
        agreement_end: c.wp_agreement_end ?? '',
      })
    }

    let leads = (leadsRes.data ?? []) as Lead[]

    // Fallback: if no leads linked by client_id, try other matching strategies
    if (leads.length === 0) {
      // Try by email
      if (c.email) {
        const { data } = await supabase.from('leads').select('*').eq('venue_id', activeVenue.id).eq('email', c.email).order('created_at', { ascending: false })
        leads = (data ?? []) as Lead[]
      }
      // Try by phone
      if (leads.length === 0 && c.phone) {
        const { data } = await supabase.from('leads').select('*').eq('venue_id', activeVenue.id).eq('phone', c.phone).order('created_at', { ascending: false })
        leads = (data ?? []) as Lead[]
      }
      // For WP: also try by contact_type + name match
      if (leads.length === 0 && c.client_type === 'wedding_planner' && c.name) {
        const { data } = await supabase.from('leads').select('*').eq('venue_id', activeVenue.id).eq('contact_type', 'wedding_planner').ilike('name', c.name).order('created_at', { ascending: false })
        leads = (data ?? []) as Lead[]
      }
    }

    setClientLeads(leads)

    const leadIds = new Set(leads.map(l => l.id))
    setProposals((proposalsRes.data ?? []).filter((p: any) => p.lead_id && leadIds.has(p.lead_id)))

    // WP: load couples
    if (c.client_type === 'wedding_planner') {
      const { data: coupleData } = await supabase.from('clients').select('*').eq('parent_client_id', id).order('created_at', { ascending: false })
      if (coupleData && coupleData.length > 0) {
        const coupleIds = coupleData.map((cp: any) => cp.id)
        const { data: coupleLeadsData } = await supabase.from('leads').select('id, client_id, status, created_at').in('client_id', coupleIds).order('created_at', { ascending: false })
        const clMap: Record<string, { count: number; latestStatus: string | null }> = {}
        for (const cl of (coupleLeadsData ?? [])) {
          if (!clMap[cl.client_id]) clMap[cl.client_id] = { count: 0, latestStatus: cl.status }
          clMap[cl.client_id].count++
        }
        setCouples(coupleData.map((cp: any) => ({ ...cp, leadCount: clMap[cp.id]?.count ?? 0, latestStatus: clMap[cp.id]?.latestStatus ?? null })))
      } else {
        setCouples([])
      }
    }

    setLoading(false)
  }

  // ── Notes auto-save ──────────────────────────────────────────────────────────
  const updateNotes = (val: string) => {
    setNotes(val)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      await supabase.from('clients').update({ notes: val }).eq('id', id)
    }, 1000)
  }

  // ── Save edit ────────────────────────────────────────────────────────────────
  const saveEdit = async () => {
    setSaving(true)
    await supabase.from('clients').update({
      name: editForm.name.trim(),
      email: editForm.email.trim() || null,
      phone: editForm.phone.trim() || null,
      whatsapp: editForm.whatsapp.trim() || null,
      client_type: editForm.client_type,
      language: editForm.language.trim() || null,
      country: editForm.country.trim() || null,
    }).eq('id', id)
    setSaving(false)
    setEditing(false)
    loadData()
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  // ── Save WP agreement ─────────────────────────────────────────────────────
  const saveAgreement = async () => {
    setSavingAgreement(true)
    await supabase.from('clients').update({
      wp_commission_percent: agreementForm.commission_percent ? parseFloat(agreementForm.commission_percent) : null,
      wp_commission_type: agreementForm.commission_type,
      wp_agreement_notes: agreementForm.agreement_notes || null,
      wp_agreement_start: agreementForm.agreement_start || null,
      wp_agreement_end: agreementForm.agreement_end || null,
    }).eq('id', id)
    setSavingAgreement(false)
    loadData()
  }

  const handleDelete = async () => {
    if (!confirm('Se eliminará este cliente. Sus peticiones se desvincularán pero no se borrarán.')) return
    await supabase.from('leads').update({ client_id: null }).eq('client_id', id)
    await supabase.from('clients').delete().eq('id', id)
    router.push('/crm')
  }

  // ── Guards ───────────────────────────────────────────────────────────────────
  if (isBlocked) return null
  if (loading || authLoading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </div>
  )
  if (!client) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div style={{ padding: 40, color: 'var(--warm-gray)', fontSize: 14 }}>Cliente no encontrado.</div>
      </div>
    </div>
  )

  // ── Derived data ─────────────────────────────────────────────────────────────
  const tc = CLIENT_TYPE_COLORS[client.client_type] ?? CLIENT_TYPE_COLORS.otro
  const isWP = client.client_type === 'wedding_planner'
  const latestLead = clientLeads[0] ?? null
  const activeLead = clientLeads.find(l => l.status !== 'lost' && l.status !== 'won') ?? latestLead
  const sc  = latestLead ? (STATUS_CFG[latestLead.status] || { label: latestLead.status, bg: '#f3f4f6', color: '#6b7280' }) : null
  const pipelineIdx = activeLead ? PIPELINE.findIndex(p => p.key === activeLead.status) : -1
  const isLost = latestLead?.status === 'lost' && !clientLeads.some(l => l.status !== 'lost')

  // Use activeLead for event details display
  const lead = activeLead ?? latestLead
  const isNewPhase  = lead ? (lead.status === 'new' || lead.status === 'lost') : true
  const isBudget    = lead ? (lead.status === 'budget_sent' || lead.status === 'won') : false
  const isActive    = lead ? (!isNewPhase && !isBudget) : false
  const hasVisit    = !!lead?.visit_date

  // Visit time display
  const visitTimeLabel = (() => {
    if (!lead?.visit_time) return ''
    if (!lead.visit_duration) return lead.visit_time
    const [h, m] = lead.visit_time.split(':').map(Number)
    const tot = h * 60 + m + lead.visit_duration
    const eh  = Math.floor(tot / 60) % 24
    const em  = tot % 60
    return `${lead.visit_time} – ${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')} (${lead.visit_duration} min)`
  })()

  // Documents from all leads
  const docFiles = clientLeads.flatMap(l => {
    const files: { url: string; name: string }[] = l.budget_files || []
    if (!files.length && l.budget_file_url) files.push({ url: l.budget_file_url, name: l.budget_file_name || 'Documento adjunto' })
    return files
  })

  // Contact info (prefer client, fallback to lead, for WP also check couples)
  const email    = client.email    || lead?.email    || (isWP ? clientLeads.find(l => l.email)?.email : undefined)
  const phone    = client.phone    || lead?.phone    || (isWP ? clientLeads.find(l => l.phone)?.phone : undefined)
  const whatsapp = client.whatsapp || lead?.whatsapp || (isWP ? clientLeads.find(l => l.whatsapp)?.whatsapp : undefined)
  const hasContactData = !!(email || phone || whatsapp)

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
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)' }}>{client.name}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <X size={13} /> Cancelar
                </button>
                <button onClick={saveEdit} disabled={saving} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Save size={13} /> {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </>
            ) : (
              <button onClick={handleDelete} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#b91c1c' }}>
                <Trash2 size={13} /> Eliminar
              </button>
            )}
          </div>
        </div>

        <div className="page-content">
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 320px)', gap: 20, alignItems: 'start' }}>

            {/* ── Left column ──────────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Header card */}
              <div className="card" style={{ padding: '24px 28px' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: tc.bg, border: `2px solid ${tc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: tc.color, flexShrink: 0 }}>
                    {(client.name || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {editing ? (
                      <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="form-input" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }} />
                    ) : (
                      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--charcoal)', margin: '0 0 8px' }}>{client.name}</h1>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {editing ? (
                        <select value={editForm.client_type} onChange={e => setEditForm(f => ({ ...f, client_type: e.target.value as ClientType }))}
                          style={{ fontSize: 12, padding: '3px 8px', border: '1px solid var(--ivory)', borderRadius: 6, background: tc.bg, color: tc.color, fontFamily: 'Inter, sans-serif' }}>
                          {Object.entries(CLIENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 600, background: tc.bg, color: tc.color, borderRadius: 6, padding: '3px 10px', border: `1px solid ${tc.border}` }}>
                          {CLIENT_TYPE_LABELS[client.client_type] ?? client.client_type}
                        </span>
                      )}
                      {sc && (
                        <span style={{ fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.color, borderRadius: 6, padding: '3px 10px' }}>
                          {sc.label}
                        </span>
                      )}
                      {(client.country || client.language) && (
                        <span style={{ fontSize: 10, color: 'var(--warm-gray)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Globe size={9} /> {[client.country, client.language].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pipeline progress bar — from latest active lead */}
                {lead && !isLost && !isWP && (
                  <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--ivory)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative' }}>
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
                    <span style={{ fontSize: 12, color: '#b91c1c', fontWeight: 500 }}>Todos los leads perdidos</span>
                  </div>
                )}
              </div>

              {/* Visit banner */}
              {hasVisit && lead && (
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

              {/* ── Tabs ──────────────────────────────────────────────────── */}
              <div>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--ivory)', gap: 0 }}>
                  {([...(['info', 'peticiones', 'oferta', 'notas'] as Tab[]), ...(isWP ? ['colaboracion' as Tab] : [])]).map(t => (
                    <button key={t} onClick={() => setTab(t)} style={tabStyle(tab === t)}>
                      {{ info: 'Info', peticiones: `Peticiones (${clientLeads.length})`, oferta: `Oferta (${proposals.length + docFiles.length})`, notas: 'Notas', colaboracion: 'Colaboración' }[t]}
                    </button>
                  ))}
                </div>

                <div className="card" style={{ padding: '20px 28px', borderTopLeftRadius: 0 }}>

                  {/* ── Tab: Info ───────────────────────────────────── */}
                  {tab === 'info' && (
                    <>
                      {/* Contact details */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <SectionLabel>Datos de contacto</SectionLabel>
                        {!editing && (
                          <button onClick={() => setEditing(true)} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '4px 10px' }}>
                            <Edit2 size={12} /> Editar
                          </button>
                        )}
                      </div>
                      {editing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                          {[
                            { key: 'email',    label: 'Email',    type: 'email' },
                            { key: 'phone',    label: 'Teléfono', type: 'tel'   },
                            { key: 'whatsapp', label: 'WhatsApp', type: 'tel'   },
                          ].map(({ key, label, type }) => (
                            <div key={key} className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: 11 }}>{label}</label>
                              <input type={type} className="form-input"
                                value={(editForm as any)[key] || ''}
                                onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} />
                            </div>
                          ))}
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Idioma</label>
                            <input className="form-input" value={editForm.language} onChange={e => setEditForm(f => ({ ...f, language: e.target.value }))} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>País</label>
                            <input className="form-input" value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))} />
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginBottom: 20 }}>
                          {email    && <InfoRow icon={<Mail          size={14} />} label="Email"     value={email}    href={`mailto:${email}`} />}
                          {phone    && <InfoRow icon={<Phone         size={14} />} label="Teléfono"  value={phone}    href={`tel:${phone}`} />}
                          {whatsapp && <InfoRow icon={<MessageCircle size={14} />} label="WhatsApp"  value={whatsapp} href={`https://wa.me/${whatsapp.replace(/\D/g,'')}`} />}
                          {!email && !phone && !whatsapp && (
                            <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', margin: '8px 0 0' }}>Sin datos de contacto</p>
                          )}
                        </div>
                      )}

                      {/* Event details — from active/latest lead */}
                      {lead && (
                        <>
                          <SectionLabel>Detalles del evento</SectionLabel>
                          {isBudget && <InfoRow icon={<CalendarCheck size={14} />} label="Fechas confirmadas" value={budgetDatesLabel(lead)} />}
                          {isActive && <InfoRow icon={<Calendar size={14} />} label="Fechas propuestas" value={weddingLabel(lead)} />}
                          {lead.wedding_duration_days && lead.wedding_duration_days > 1 && (
                            <InfoRow icon={<Clock size={14} />} label="Duración" value={`${lead.wedding_duration_days} días`} />
                          )}
                          {!isNewPhase && originalDatesLabel(lead) !== '—' && (
                            <InfoRow icon={<FileText size={14} />} label="Fecha solicitada originalmente" value={originalDatesLabel(lead)} />
                          )}
                          {isNewPhase && <InfoRow icon={<Calendar size={14} />} label="Fecha deseada" value={weddingLabel(lead)} />}
                          {(lead.guests || lead.guests_adults) && (
                            <InfoRow icon={<Users size={14} />} label="Invitados" value={
                              lead.guests_adults
                                ? `${(lead.guests_adults || 0) + (lead.guests_children || 0)} total · ${lead.guests_adults} adultos${lead.guests_children ? `, ${lead.guests_children} niños` : ''}`
                                : `${lead.guests}`
                            } />
                          )}
                          {lead.budget && lead.budget !== 'sin_definir' && (
                            <InfoRow icon={<Banknote size={14} />} label="Presupuesto orientativo" value={BUDGET_LABEL[lead.budget] || lead.budget} />
                          )}
                          {lead.ceremony_type && lead.ceremony_type !== 'sin_definir' && (
                            <InfoRow icon={<Heart size={14} />} label="Ceremonia" value={{ civil: 'Civil', religiosa: 'Religiosa', simbolica: 'Simbólica', mixta: 'Mixta' }[lead.ceremony_type] || lead.ceremony_type} />
                          )}
                          {lead.catering_needed && lead.catering_needed !== 'sin_definir' && (
                            <InfoRow icon={<UtensilsCrossed size={14} />} label="Catering" value={{ incluido: 'Incluido en el venue', externo: 'Traen catering externo', por_definir: 'Por definir' }[lead.catering_needed] || lead.catering_needed} />
                          )}
                          {lead.country  && <InfoRow icon={<MapPin  size={14} />} label="País"           value={lead.country} />}
                          {lead.language && <InfoRow icon={<Globe   size={14} />} label="Idioma"          value={lead.language} />}
                          {lead.style    && <InfoRow icon={<Palette size={14} />} label="Estilo buscado"  value={lead.style} />}
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
                        </>
                      )}

                      {/* Initial message */}
                      {lead?.initial_message && (
                        <div style={{ marginTop: 20 }}>
                          <SectionLabel>Mensaje inicial</SectionLabel>
                          <div style={{ padding: '12px 16px', borderRadius: 10, background: '#faf8f5', border: '1px solid var(--ivory)', fontSize: 13, color: 'var(--charcoal)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {lead.initial_message}
                          </div>
                        </div>
                      )}

                      {/* Documents */}
                      {docFiles.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                          <SectionLabel>Documentos adjuntos</SectionLabel>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {docFiles.map((f, i) => (
                              <a key={i} href={f.url} target="_blank" rel="noreferrer"
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#f9fafb', border: '1.5px solid var(--ivory)', textDecoration: 'none', color: 'var(--charcoal)' }}>
                                <Paperclip size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                                </div>
                                <ExternalLink size={12} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {!lead && (
                        <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', marginTop: 8 }}>
                          Sin peticiones registradas
                        </p>
                      )}
                    </>
                  )}

                  {/* ── Tab: Peticiones ─────────────────────────────── */}
                  {tab === 'peticiones' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <SectionLabel>Peticiones ({clientLeads.length})</SectionLabel>
                        {clientLeads.length > 0 && (
                          <span style={{ fontSize: 10, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Click en una petición para editarla</span>
                        )}
                      </div>
                      {clientLeads.length === 0 && (
                        <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Sin peticiones registradas</p>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {clientLeads.map(l => {
                          const ls = STATUS_CFG[l.status] || { label: l.status, bg: '#f3f4f6', color: '#6b7280' }
                          const dateLabel = l.budget_date ? fmtDate(l.budget_date) : l.wedding_date ? fmtDate(l.wedding_date) : l.wedding_year ? String(l.wedding_year) : '—'
                          return (
                            <button key={l.id} onClick={() => router.push(`/leads?open=${l.id}`)}
                              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: '#fafaf8', border: '1px solid var(--ivory)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left', width: '100%' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 3 }}>{l.name || 'Sin nombre'}</div>
                                <div style={{ fontSize: 11, color: 'var(--warm-gray)', display: 'flex', gap: 10 }}>
                                  <span>{dateLabel}</span>
                                  {l.guests && <span><Users size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />{l.guests} inv.</span>}
                                </div>
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 600, background: ls.bg, color: ls.color, borderRadius: 5, padding: '3px 8px', flexShrink: 0 }}>{ls.label}</span>
                              <ExternalLink size={12} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* ── Tab: Oferta ─────────────────────────────────── */}
                  {tab === 'oferta' && (
                    <>
                      {/* Proposals */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <SectionLabel>Dosieres y propuestas ({proposals.length})</SectionLabel>
                        {proposals.length > 0 && (
                          <span style={{ fontSize: 10, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Click en un dosier para editarlo</span>
                        )}
                      </div>
                      {proposals.length === 0 && docFiles.length === 0 && (
                        <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Sin dosieres ni documentos</p>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {proposals.map(p => {
                          const ps = PROPOSAL_STATUS[p.status] || { label: p.status, color: '#6b7280', bg: '#f3f4f6' }
                          return (
                            <button key={p.id} onClick={() => router.push(`/proposals/${p.id}`)}
                              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: '#fafaf8', border: '1px solid var(--ivory)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left', width: '100%' }}>
                              <FileText size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>{p.couple_name || 'Sin nombre'}</div>
                                <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{fmtDate(p.created_at)}</div>
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 600, background: ps.bg, color: ps.color, borderRadius: 5, padding: '3px 8px', flexShrink: 0 }}>{ps.label}</span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Budget files */}
                      {docFiles.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                          <SectionLabel>Documentos adjuntos ({docFiles.length})</SectionLabel>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {docFiles.map((f, i) => (
                              <a key={i} href={f.url} target="_blank" rel="noreferrer"
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#f9fafb', border: '1.5px solid var(--ivory)', textDecoration: 'none', color: 'var(--charcoal)' }}>
                                <Paperclip size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                                </div>
                                <ExternalLink size={12} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Tab: Notas ──────────────────────────────────── */}
                  {tab === 'notas' && (
                    <>
                      <SectionLabel>Notas internas</SectionLabel>
                      <textarea
                        className="form-input"
                        rows={8}
                        value={notes}
                        onChange={e => updateNotes(e.target.value)}
                        placeholder="Añade notas sobre este cliente…"
                        style={{ resize: 'vertical', fontSize: 13 }}
                      />
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 6 }}>
                        Guardado automático
                      </div>
                    </>
                  )}

                  {/* ── Tab: Colaboración (WP only) ────────────────── */}
                  {tab === 'colaboracion' && isWP && (
                    <>
                      {/* Comisión */}
                      <SectionLabel>Acuerdo de comisión</SectionLabel>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Comisión</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
                              <input type="number" className="form-input"
                                value={agreementForm.commission_percent}
                                onChange={e => setAgreementForm(f => ({ ...f, commission_percent: e.target.value }))}
                                placeholder="Ej: 10"
                                style={{ border: 'none', flex: 1, fontSize: 13 }} />
                              <span style={{ fontSize: 12, color: '#999', padding: '6px 10px', background: '#f9f8f6', borderLeft: '1px solid var(--border)', fontWeight: 600 }}>
                                {agreementForm.commission_type === 'percentage' ? '%' : '€'}
                              </span>
                            </div>
                          </div>
                          <div className="form-group" style={{ width: 140, marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Tipo</label>
                            <select className="form-input" value={agreementForm.commission_type}
                              onChange={e => setAgreementForm(f => ({ ...f, commission_type: e.target.value }))}
                              style={{ fontSize: 13 }}>
                              <option value="percentage">Porcentaje</option>
                              <option value="fixed">Fijo (€)</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12 }}>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Inicio acuerdo</label>
                            <input type="date" className="form-input" value={agreementForm.agreement_start}
                              onChange={e => setAgreementForm(f => ({ ...f, agreement_start: e.target.value }))}
                              style={{ fontSize: 13 }} />
                          </div>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Fin acuerdo</label>
                            <input type="date" className="form-input" value={agreementForm.agreement_end}
                              onChange={e => setAgreementForm(f => ({ ...f, agreement_end: e.target.value }))}
                              style={{ fontSize: 13 }} />
                          </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: 11 }}>Notas del acuerdo</label>
                          <textarea className="form-input" rows={4}
                            value={agreementForm.agreement_notes}
                            onChange={e => setAgreementForm(f => ({ ...f, agreement_notes: e.target.value }))}
                            placeholder="Condiciones, acuerdos especiales…"
                            style={{ resize: 'vertical', fontSize: 13 }} />
                        </div>

                        <button onClick={saveAgreement} disabled={savingAgreement}
                          className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Save size={13} /> {savingAgreement ? 'Guardando…' : 'Guardar acuerdo'}
                        </button>
                      </div>

                      {/* Documentos WP */}
                      <SectionLabel>Documentos de colaboración</SectionLabel>
                      {(client.wp_documents ?? []).length === 0 ? (
                        <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Sin documentos</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {(client.wp_documents ?? []).map((doc, i) => (
                            <a key={i} href={doc.url} target="_blank" rel="noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#f9fafb', border: '1.5px solid var(--ivory)', textDecoration: 'none', color: 'var(--charcoal)' }}>
                              <Paperclip size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                                {doc.type && <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{doc.type}</div>}
                              </div>
                              <ExternalLink size={12} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* ── WP: Parejas section (collapsible) ─────────────────── */}
              {isWP && (
                <div className="card" style={{ padding: '20px 28px' }}>
                  <button onClick={() => setWpExpanded(!wpExpanded)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', padding: 0, textAlign: 'left' }}>
                    <SectionLabel>Parejas de este WP</SectionLabel>
                    <span style={{ fontSize: 11, color: 'var(--warm-gray)', fontWeight: 500, marginBottom: 14, marginLeft: 'auto' }}>
                      {couples.length} {couples.length === 1 ? 'pareja' : 'parejas'}
                    </span>
                    <ChevronDown size={14} style={{ color: 'var(--warm-gray)', marginBottom: 14, transform: wpExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                  </button>
                  {wpExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {couples.length === 0 && (
                        <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', margin: 0 }}>Sin parejas asociadas</p>
                      )}
                      {couples.map(cp => {
                        const cpSc = cp.latestStatus ? (STATUS_CFG[cp.latestStatus] || { label: cp.latestStatus, bg: '#f3f4f6', color: '#6b7280' }) : null
                        return (
                          <button key={cp.id} onClick={() => router.push(`/crm/${cp.id}`)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#fafaf8', border: '1px solid var(--ivory)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left', width: '100%' }}>
                            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 700, color: '#92400e' }}>
                              {(cp.name || '?')[0].toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cp.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{cp.leadCount} {cp.leadCount === 1 ? 'petición' : 'peticiones'}</div>
                            </div>
                            {cpSc && (
                              <span style={{ fontSize: 10, fontWeight: 600, background: cpSc.bg, color: cpSc.color, borderRadius: 5, padding: '2px 7px', flexShrink: 0 }}>{cpSc.label}</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* ── Right sidebar ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Quick actions */}
              <div className="card" style={{ padding: '18px 20px' }}>
                <SectionLabel>Acciones rápidas</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {email && (
                    <a href={`mailto:${email}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: '#f0f9ff', color: '#0369a1', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                      <Mail size={13} /> Enviar email
                    </a>
                  )}
                  {whatsapp && (
                    <a href={`https://wa.me/${whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: '#f0fdf4', color: '#15803d', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                      <MessageCircle size={13} /> WhatsApp
                    </a>
                  )}
                  {phone && (
                    <a href={`tel:${phone}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: '#faf8f5', color: 'var(--charcoal)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                      <Phone size={13} /> Llamar
                    </a>
                  )}
                  {latestLead && (
                    <button onClick={() => router.push(`/leads?open=${latestLead.id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: 'var(--ivory)', color: 'var(--charcoal)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left' }}>
                      <ExternalLink size={13} /> Ver pipeline en Leads
                    </button>
                  )}
                  {!hasContactData && !latestLead && (
                    <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', margin: 0 }}>Sin datos de contacto. Edita el cliente para añadirlos.</p>
                  )}
                  {!hasContactData && latestLead && (
                    <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', margin: '0 0 4px 0' }}>Sin datos de contacto directo.</p>
                  )}
                </div>
              </div>

              {/* Origen */}
              <div className="card" style={{ padding: '18px 20px' }}>
                <SectionLabel>Origen</SectionLabel>
                {latestLead?.source && <InfoRow icon={<Sparkles size={13} />} label="Canal" value={SOURCE_LABEL[latestLead.source] || latestLead.source} />}
                <InfoRow icon={<Clock size={13} />} label="Cliente desde" value={fmtDate(client.created_at)} />
                {latestLead && <InfoRow icon={<Clock size={13} />} label="Última petición" value={fmtDate(latestLead.created_at)} />}
              </div>

              {/* Client tags */}
              {client.tags && client.tags.length > 0 && (
                <div className="card" style={{ padding: '18px 20px' }}>
                  <SectionLabel>Etiquetas</SectionLabel>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {client.tags.map(t => (
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

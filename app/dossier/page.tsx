'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Tabs from '@/components/Tabs'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import NoVenueState from '@/components/NoVenueState'
import { Plus, Copy, ExternalLink, X, Check, Eye, Send, Pencil, Trash2, AlertCircle, AlertTriangle, Loader2, FileText, LayoutTemplate, ChevronLeft, ChevronRight, Search, Inbox } from 'lucide-react'
import { renderPayload } from '@/components/InquiriesPanel'
import FeatureGate from '@/components/FeatureGate'
import { usePlanFeatures } from '@/lib/use-plan-features'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { DateRangeFilter, type DateRangeValue } from '@/components/ui/date-range-filter'

const MAX_PROPOSALS_PER_LEAD = 6
const PAGE_SIZE = 10

// Module-level cache so re-entering this tab is instant (stale-while-revalidate).
// Cleared on full page reload.
let cachedProposals: Proposal[] | null = null
let cachedLeads: any[] | null = null
let cachedSmtpConfigured: boolean | null = null

type Proposal = {
  id: string
  slug: string
  couple_name: string
  guest_count: number | null
  wedding_date: string | null
  price_estimate: number | null
  couple_email: string | null
  status: 'draft' | 'sent' | 'viewed' | 'expired'
  views: number
  open_count?: number | null
  unique_open_count?: number | null
  sent_at?: string | null
  first_viewed_at?: string | null
  last_viewed_at?: string | null
  lead_id: string | null
  created_at: string
  branding?: { logo_url: string | null; primary_color: string } | null
  sections_data?: { content_template_id?: string } | null
}

const S_BADGE: Record<string, string> = {
  draft: 'badge-inactive',
  sent: 'badge-contacted',
  viewed: 'badge-active',
  expired: 'badge-pending',
}
const S_LABEL: Record<string, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  viewed: 'Vista',
  expired: 'Expirada',
}

function PropuestasPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading, activeVenue } = useAuth()
  const { isBlocked } = useRequireSubscription()
  const features = usePlanFeatures()

  const [proposals, setProposals] = useState<Proposal[]>(cachedProposals ?? [])
  const [leads, setLeads] = useState<any[]>(cachedLeads ?? [])
  const [loading, setLoading] = useState(cachedProposals === null)
  const [copied, setCopied] = useState<string | null>(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [limitWarn, setLimitWarn] = useState('')
  const [sendModal, setSendModal] = useState<Proposal | null>(null)
  const [sendEmail, setSendEmail] = useState('')
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sendErrAlert, setSendErrAlert] = useState(false)
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(cachedSmtpConfigured)
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [contentTemplates, setContentTemplates] = useState<{ id: string; name: string; description: string | null; is_default: boolean }[]>([])
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentTab, setCurrentTab] = useState<'proposals'>('proposals')
  const [inquiries, setInquiries] = useState<any[]>([])
  const [responseModalProposal, setResponseModalProposal] = useState<Proposal | null>(null)
  const [detailModalProposal, setDetailModalProposal] = useState<Proposal | null>(null)
  const [sectionCounts, setSectionCounts] = useState<Record<string, number>>({})
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent' | 'viewed' | 'expired'>('all')
  const [dateRange, setDateRange] = useState<DateRangeValue>(null)
  const [sortBy, setSortBy] = useState<'recent' | 'views' | 'name'>('recent')

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    load()
  }, [user, authLoading, activeVenue?.id])

  // Legacy entry: /dossier?lead_id=xxx&create=1 → redirect to /dossier/new
  useEffect(() => {
    const urlLeadId = searchParams.get('lead_id')
    const autoCreate = searchParams.get('create') === '1'
    if (autoCreate) {
      router.replace(urlLeadId ? `/dossier/new?lead_id=${urlLeadId}` : '/dossier/new')
    }
  }, [searchParams, router])

  const load = async () => {
    if (!activeVenue) { setLoading(false); return }
    const supabase = createClient()
    const [{ data: props }, { data: leadsData }, { data: venueRow }, { data: inqData }] = await Promise.all([
      supabase.from('proposals').select('*, branding:proposal_branding(*), sections_data').eq('venue_id', activeVenue.id).order('created_at', { ascending: false }),
      supabase.from('leads').select('id, name, email').eq('venue_id', activeVenue.id).order('created_at', { ascending: false }),
      supabase.from('venue_onboarding').select('smtp_from_email').eq('user_id', user.id).maybeSingle(),
      supabase.from('proposal_inquiries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    cachedSmtpConfigured = !!(venueRow as any)?.smtp_from_email
    setSmtpConfigured(cachedSmtpConfigured)
    if (props) { cachedProposals = props as Proposal[]; setProposals(cachedProposals) }
    if (leadsData) { cachedLeads = leadsData; setLeads(leadsData) }
    if (inqData) setInquiries(inqData)
    setLoading(false)

    // Fetch user content templates for "new proposal" modal
    fetch('/api/dossier-templates').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setContentTemplates(data)
    }).catch(() => {})

    // Section view counts (best-effort; venue scope handled by RPC SECURITY DEFINER)
    supabase.rpc('get_proposal_section_counts').then(({ data }) => {
      if (Array.isArray(data)) {
        const map: Record<string, number> = {}
        for (const row of data) map[(row as any).proposal_id] = Number((row as any).sections_seen) || 0
        setSectionCounts(map)
      }
    })
  }

  const notify = (msg: string, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => { setSuccess(''); setError('') }, 3500)
  }
  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

  const handleNew = () => {
    setNewModalOpen(true)
  }

  const handleEdit = (p: Proposal) => {
    router.push(`/dossier/${p.id}/edit`)
  }

  const handleDuplicate = async (p: Proposal) => {
    const supabase = createClient()
    const { data: original } = await supabase.from('proposals').select('*').eq('id', p.id).single()
    if (!original) { notify('No se pudo duplicar', true); return }
    const { id: _id, created_at: _c, slug: _s, branding: _b, views: _v, open_count: _o, unique_open_count: _u, sent_at: _sa, first_viewed_at: _f, last_viewed_at: _l, ...rest } = original as any
    const newSlug = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    const { data: dup, error: dupErr } = await supabase.from('proposals').insert({ ...rest, slug: newSlug, couple_name: `${p.couple_name} (copia)`, status: 'draft' }).select().single()
    if (dupErr || !dup) { notify('Error al duplicar', true); return }
    setProposals(prev => { const next = [dup as Proposal, ...prev]; cachedProposals = next; return next })
    notify('Propuesta duplicada')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta propuesta? La URL dejará de funcionar.')) return
    const supabase = createClient()
    await supabase.from('proposals').delete().eq('id', id)
    setProposals(prev => {
      const next = prev.filter(p => p.id !== id)
      cachedProposals = next
      return next
    })
  }

  const resolveLeadEmail = (proposal: Proposal) => leads.find(l => l.id === proposal.lead_id)?.email ?? ''

  const markSent = (proposal: Proposal) => {
    const email = proposal.couple_email || resolveLeadEmail(proposal)
    if (!email) {
      setSendEmail('')
      setSendModal(proposal)
      return
    }
    doSend(proposal.id, email)
  }

  const doSend = async (id: string, emailOverride?: string) => {
    setSendingId(id)
    setSendErrAlert(false)
    const ctrl = new AbortController()
    const tid = setTimeout(() => ctrl.abort(), 5000)
    try {
      const res = await fetch(`/api/dossier/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailOverride ?? null }),
        signal: ctrl.signal,
      })
      clearTimeout(tid)
      const json = await res.json()
      setSendModal(null)
      if (!res.ok) { notify(json.error ?? 'Error al enviar', true); return }
      setProposals(prev => {
        const next = prev.map(p => p.id === id ? { ...p, status: 'sent' as const, sent_at: p.sent_at ?? new Date().toISOString() } : p)
        cachedProposals = next
        return next
      })
      if (json.emailSent) notify(`Email enviado a ${json.recipientEmail}`)
      else if (json.emailError) notify(`Error al enviar: ${json.emailError}`, true)
      else notify('Marcada como enviada — copia la URL y envíasela')
    } catch (err: any) {
      clearTimeout(tid)
      if (err?.name === 'AbortError') setSendErrAlert(true)
      else notify('Error de red al enviar la propuesta', true)
    } finally {
      setSendingId(null)
    }
  }

  const copyUrl = (slug: string) => {
    const url = `${window.location.origin}/dossier/${slug}`
    navigator.clipboard.writeText(url)
    setCopied(slug)
    setTimeout(() => setCopied(null), 2000)
  }

  const counts = {
    total: proposals.length,
    sent: proposals.filter(p => p.sent_at != null).length,
    viewed: proposals.filter(p => p.first_viewed_at != null).length,
    views: proposals.reduce((a, p) => a + (p.open_count ?? p.views ?? 0), 0),
  }

  const filteredProposals = useMemo(() => {
    let arr = proposals
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      const leadNameById = new Map(leads.map(l => [l.id, (l.name ?? '').toLowerCase()]))
      arr = arr.filter(p =>
        p.couple_name.toLowerCase().includes(q) ||
        (p.lead_id && leadNameById.get(p.lead_id)?.includes(q))
      )
    }
    if (statusFilter !== 'all') {
      arr = arr.filter(p => p.status === statusFilter)
    }
    if (dateRange) {
      const fromTs = dateRange.from.getTime()
      const toTs = dateRange.to.getTime()
      arr = arr.filter(p => { const t = new Date(p.created_at).getTime(); return t >= fromTs && t <= toTs })
    }
    if (sortBy === 'views') arr = [...arr].sort((a, b) => ((b.open_count ?? b.views) || 0) - ((a.open_count ?? a.views) || 0))
    else if (sortBy === 'name') arr = [...arr].sort((a, b) => a.couple_name.localeCompare(b.couple_name))
    // 'recent' is the default order from the query
    return arr
  }, [proposals, leads, searchQuery, statusFilter, dateRange, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredProposals.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visibleProposals = filteredProposals.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])
  useEffect(() => {
    setPage(1)
  }, [searchQuery, statusFilter, dateRange, sortBy])

  if (isBlocked) return null

  if (!authLoading && !activeVenue) {
    return <><Sidebar /><div className="main-layout" style={{ padding: '24px 28px' }}><NoVenueState /></div></>
  }

  if (features.loading || !features.propuestas) return (
    <FeatureGate
      feature="propuestas"
      title="Propuestas — Plan Premium"
      description="Crea landings únicas para cada pareja con tu branding, precios y secciones personalizadas."
    />
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Dosieres</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={handleNew}>
              <Plus size={13} /> Nueva propuesta
            </button>
          </div>
        </div>

        {(success || error) && (
          <div style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
            background: error ? '#FAF3F2' : '#EEF2EC',
            border: `1px solid ${error ? '#E0C2BD' : '#C3D4C5'}`,
            color: error ? '#7E332D' : '#3C5945',
            padding: '12px 16px', borderRadius: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,.13)',
            fontSize: 13, maxWidth: 380, minWidth: 240,
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            {error ? <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> : <Check size={15} style={{ flexShrink: 0, marginTop: 1 }} />}
            <span style={{ flex: 1, lineHeight: 1.5 }}>{error || success}</span>
            <button onClick={() => { setError(''); setSuccess('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: .5, padding: 0, lineHeight: 1 }}>
              <X size={13} />
            </button>
          </div>
        )}

        {sendErrAlert && (
          <div className="modal-overlay" onClick={() => setSendErrAlert(false)}>
            <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header" style={{ position: 'relative', paddingRight: 48 }}>
                <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#7A5A2E' }}>
                  <AlertTriangle size={17} /> No se pudo enviar el email
                </div>
                <button onClick={() => setSendErrAlert(false)} style={{ position: 'absolute', top: '50%', right: 16, transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 6, display: 'flex', alignItems: 'center', borderRadius: 6 }}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text)' }}>No hemos podido enviar el email. Posibles causas:</p>
                <ul style={{ fontSize: 13, lineHeight: 1.85, paddingLeft: 20, color: 'var(--warm-gray)', margin: 0, listStyleType: 'disc' }}>
                  <li>Las credenciales SMTP son incorrectas</li>
                  <li>El puerto o el host no coinciden con los de tu hosting</li>
                  <li>El email de la pareja no es válido</li>
                </ul>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setSendErrAlert(false)}>Cerrar</button>
                <a href="/profile" className="btn btn-primary">Revisar configuración</a>
              </div>
            </div>
          </div>
        )}

        <Tabs
          activeKey={currentTab}
          onChange={() => {}}
          tabs={[
            { key: 'proposals', label: 'Propuestas', icon: FileText },
            { key: 'templates', label: 'Plantillas', icon: LayoutTemplate, href: '/dossier/templates' },
          ]}
        />

        <div className="page-content">
          <>

          {limitWarn && (
            <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Límite de propuestas alcanzado</strong><br />
                <span style={{ fontSize: 12 }}>{limitWarn}</span>
                <button onClick={() => setLimitWarn('')} style={{ marginLeft: 12, fontSize: 11, color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Cerrar</button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
              <div style={{ width: 24, height: 24, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : (
          <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'Total creadas', value: counts.total, sub: 'historial', color: '#4A6B52', border: '#c8d9cc' },
              { label: 'Enviadas', value: counts.sent, sub: 'activas', color: '#4F6D8C', border: '#c5d2e0' },
              { label: 'Vistas', value: counts.viewed, sub: 'por parejas', color: '#AC8B4C', border: '#ddd2b8' },
              { label: 'Aperturas', value: counts.views, sub: `${counts.total > 0 ? (counts.views / counts.total).toFixed(1) : 0} de media`, color: '#8B7355', border: '#d5cfc5' },
            ].map((k, i) => (
              <div key={i} style={{ background: '#fff', border: `1.5px solid ${k.border}`, borderRadius: 12, padding: '18px 20px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--warm-gray)', marginBottom: 10 }}>{k.label}</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: k.color, lineHeight: 1, marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
                <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Filters row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
            <div style={{ flexShrink: 0 }}>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger style={{ background: '#fff', height: 36, whiteSpace: 'nowrap', fontSize: 12 }}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Estado: Todos</SelectItem>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="sent">Enviada</SelectItem>
                  <SelectItem value="viewed">Vista</SelectItem>
                  <SelectItem value="expired">Expirada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DateRangeFilter value={dateRange} onChange={setDateRange} style={{ flexShrink: 0 }} />
            <div style={{ flexShrink: 0 }}>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger style={{ background: '#fff', height: 36, whiteSpace: 'nowrap', fontSize: 12 }}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Más recientes</SelectItem>
                  <SelectItem value="views">Más vistas</SelectItem>
                  <SelectItem value="name">Nombre A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)', pointerEvents: 'none' }} />
              <input
                type="search"
                placeholder="Buscar…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ height: 36, paddingLeft: 32, width: '100%', background: '#fff', fontSize: 12 }}
              />
            </div>
          </div>
          {(searchQuery || statusFilter !== 'all' || dateRange !== null || sortBy !== 'recent') && (
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); setDateRange(null); setSortBy('recent') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--warm-gray)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0 }}
              >
                <X size={12} /> Limpiar filtros
              </button>
            </div>
          )}

          <div className="card">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pareja</th>
                    <th>Boda</th>
                    <th>Estado</th>
                    <th>Vistas</th>
                    <th>Plantilla</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--warm-gray)' }}>
                        <Send size={28} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                        <div style={{ marginBottom: 4 }}>Aún no has creado ninguna propuesta.</div>
                        <div style={{ fontSize: 12, marginBottom: 16 }}>Crea una landing personalizada para cada pareja.</div>
                        <button className="btn btn-primary btn-sm" onClick={handleNew}>Crear primera propuesta →</button>
                      </td>
                    </tr>
                  )}
                  {proposals.length > 0 && filteredProposals.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--warm-gray)', fontSize: 13 }}>
                        Sin resultados con esos filtros.
                      </td>
                    </tr>
                  )}
                  {visibleProposals.map(p => {
                    const leadProposalCount = p.lead_id ? proposals.filter(x => x.lead_id === p.lead_id).length : null
                    const atLimit = leadProposalCount !== null && leadProposalCount >= MAX_PROPOSALS_PER_LEAD
                    const linkedLeadName = leads.find(l => l.id === p.lead_id)?.name
                    return (
                      <tr key={p.id} onClick={() => setDetailModalProposal(p)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {p.couple_name}
                            {leadProposalCount !== null && (
                              <span title={`${leadProposalCount}/${MAX_PROPOSALS_PER_LEAD} propuestas para este lead`} style={{
                                fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 600,
                                background: atLimit ? '#F2E2E0' : 'var(--ivory)',
                                color: atLimit ? '#B0473E' : 'var(--warm-gray)',
                              }}>
                                {leadProposalCount}/{MAX_PROPOSALS_PER_LEAD}
                              </span>
                            )}
                          </div>
                          {p.guest_count && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{p.guest_count} invitados</div>}
                          {linkedLeadName && (
                            <div onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: 'var(--gold)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <a href={`/leads?open=${p.lead_id}`} style={{ color: 'var(--gold)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                                Lead: {linkedLeadName} <ExternalLink size={9} />
                              </a>
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>
                          {p.wedding_date ? new Date(p.wedding_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td><span className={`badge ${S_BADGE[p.status] || ''}`}>{S_LABEL[p.status] || p.status}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Eye size={11} style={{ color: 'var(--warm-gray)' }} />
                            <span style={{ fontSize: 12 }}>{p.open_count ?? p.views ?? 0}</span>
                          </div>
                          {sectionCounts[p.id] > 0 && (
                            <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 2, whiteSpace: 'nowrap' }}>
                              {sectionCounts[p.id]} {sectionCounts[p.id] === 1 ? 'sección leída' : 'secciones leídas'}
                            </div>
                          )}
                        </td>
                        <td>
                          {(() => {
                            const tplId = (p.sections_data as any)?.content_template_id
                            const tpl = tplId ? contentTemplates.find(t => t.id === tplId) : null
                            return tpl
                              ? <span style={{ fontSize: 11, color: 'var(--charcoal)' }}>{tpl.name}</span>
                              : <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>—</span>
                          })()}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleDuplicate(p)} title="Duplicar"
                              style={{ height: 28, width: 28, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Copy size={12} />
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => copyUrl(p.slug)} title="Copiar URL"
                              style={{ height: 28, width: 28, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              {copied === p.slug ? <Check size={12} style={{ color: 'var(--sage)' }} /> : <ExternalLink size={12} />}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(p)} title="Editar"
                              style={{ height: 28, width: 28, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Pencil size={12} />
                            </button>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => { if (sendingId !== p.id) markSent(p) }}
                              title={p.status === 'draft' ? 'Enviar' : 'Reenviar'}
                              style={{ height: 28, fontSize: 11, padding: '0 10px', ...(sendingId === p.id ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }}
                            >
                              {sendingId === p.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} {sendingId === p.id ? '…' : p.status === 'draft' ? 'Enviar' : 'Reenviar'}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(p.id)} title="Eliminar"
                              style={{ height: 28, width: 28, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#B0473E' }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '20px 0 4px' }}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={safePage === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={safePage === 1 ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
              >
                <ChevronLeft size={13} /> Anterior
              </button>
              <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>
                Página {safePage} de {totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={safePage === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                style={safePage === totalPages ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
              >
                Siguiente <ChevronRight size={13} />
              </button>
            </div>
          )}
          </>
          )}
          </>
        </div>
      </div>

      {/* Response detail modal */}
      {responseModalProposal && (() => {
        const rp = responseModalProposal
        const pInq = inquiries.filter(i => i.proposal_id === rp.id).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))
        const KIND_LABEL: Record<string, string> = { visit: 'Visita solicitada', call: 'Llamada', video: 'Videollamada', menu: 'Pregunta sobre menú', menu_selection: 'Selección de menú', date_pick: 'Fecha confirmada', provider_selection: 'Proveedores propios', other: 'Consulta' }
        const KIND_EMOJI: Record<string, string> = { visit: '📍', call: '📞', video: '🎥', menu: '🍽️', menu_selection: '✅', date_pick: '📅', provider_selection: '🤝', other: '💬' }
        return (
          <div className="modal-overlay" onClick={() => setResponseModalProposal(null)}>
            <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">Respuestas de {rp.couple_name}</div>
                <div className="modal-sub">{pInq.length} {pInq.length === 1 ? 'respuesta' : 'respuestas'}</div>
              </div>
              <div className="modal-body" style={{ maxHeight: 450, overflowY: 'auto' }}>
                {pInq.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--warm-gray)', fontSize: 13 }}>Sin respuestas aún.</div>}
                {pInq.map((inq: any) => (
                  <div key={inq.id} style={{ padding: '12px 14px', background: inq.status === 'new' ? '#F7F3E8' : 'var(--cream)', border: `1px solid ${inq.status === 'new' ? '#E2D4AE' : 'var(--ivory)'}`, borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 14 }}>{KIND_EMOJI[inq.kind] ?? '💬'}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>{inq.kind_label || KIND_LABEL[inq.kind] || inq.kind}</span>
                      {inq.status === 'new' && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 99, background: 'var(--gold)', color: '#fff', fontWeight: 700 }}>Nuevo</span>}
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--warm-gray)' }}>{new Date(inq.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {inq.name && <div style={{ fontSize: 12, color: 'var(--charcoal)' }}>{inq.name}{inq.email ? ` · ${inq.email}` : ''}{inq.phone ? ` · ${inq.phone}` : ''}</div>}
                    {inq.message && <div style={{ fontSize: 12, color: 'var(--charcoal)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{inq.message}</div>}
                    {inq.preferred_dates?.length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>
                        Fechas preferidas: {inq.preferred_dates.map((d: string) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })).join(', ')}
                      </div>
                    )}
                    {inq.payload && Object.keys(inq.payload).length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        {renderPayload(inq)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost btn-sm" onClick={() => setResponseModalProposal(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Proposal detail modal */}
      {detailModalProposal && (() => {
        const dp = detailModalProposal
        const dpInq = inquiries.filter(i => i.proposal_id === dp.id).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))
        const linkedLeadName = leads.find(l => l.id === dp.lead_id)?.name
        const KIND_LABEL: Record<string, string> = { visit: 'Visita solicitada', call: 'Llamada', video: 'Videollamada', menu: 'Pregunta sobre menú', menu_selection: 'Selección de menú', date_pick: 'Fecha confirmada', provider_selection: 'Proveedores propios', other: 'Consulta' }
        const KIND_EMOJI: Record<string, string> = { visit: '📍', call: '📞', video: '🎥', menu: '🍽️', menu_selection: '✅', date_pick: '📅', provider_selection: '🤝', other: '💬' }
        return (
          <div className="modal-overlay" onClick={() => setDetailModalProposal(null)}>
            <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header" style={{ position: 'relative', paddingRight: 48 }}>
                <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={16} style={{ color: 'var(--gold)' }} />
                  {dp.couple_name}
                </div>
                <div className="modal-sub" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className={`badge ${S_BADGE[dp.status] || ''}`}>{S_LABEL[dp.status] || dp.status}</span>
                  {dp.wedding_date && <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{new Date(dp.wedding_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
                  {dp.guest_count && <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{dp.guest_count} invitados</span>}
                </div>
                <button onClick={() => setDetailModalProposal(null)} style={{ position: 'absolute', top: '50%', right: 16, transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 6, display: 'flex', alignItems: 'center', borderRadius: 6 }}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: 450, overflowY: 'auto' }}>
                {/* Stats */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'var(--cream)', border: '1px solid var(--ivory)', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--espresso)' }}>{dp.open_count ?? dp.views ?? 0}</div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Visualizaciones</div>
                  </div>
                  <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'var(--cream)', border: '1px solid var(--ivory)', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--espresso)' }}>{dpInq.length}</div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Respuestas</div>
                  </div>
                  {sectionCounts[dp.id] > 0 && (
                    <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'var(--cream)', border: '1px solid var(--ivory)', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--espresso)' }}>{sectionCounts[dp.id]}</div>
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Secciones leídas</div>
                    </div>
                  )}
                </div>

                {/* Dates info */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, fontSize: 11, color: 'var(--warm-gray)' }}>
                  <div>Creado: {new Date(dp.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  {dp.sent_at && <div>Enviado: {new Date(dp.sent_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
                  {dp.first_viewed_at && <div>1ª vista: {new Date(dp.first_viewed_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
                </div>

                {/* Responses */}
                {dpInq.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Respuestas de la pareja</div>
                    {dpInq.map((inq: any) => (
                      <div key={inq.id} style={{ padding: '10px 12px', background: inq.status === 'new' ? '#F7F3E8' : 'var(--cream)', border: `1px solid ${inq.status === 'new' ? '#E2D4AE' : 'var(--ivory)'}`, borderRadius: 8, marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: 13 }}>{KIND_EMOJI[inq.kind] ?? '💬'}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>{inq.kind_label || KIND_LABEL[inq.kind] || inq.kind}</span>
                          {inq.status === 'new' && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 99, background: 'var(--gold)', color: '#fff', fontWeight: 700 }}>Nuevo</span>}
                          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--warm-gray)' }}>{new Date(inq.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {inq.name && <div style={{ fontSize: 11, color: 'var(--charcoal)' }}>{inq.name}{inq.email ? ` · ${inq.email}` : ''}</div>}
                        {inq.message && <div style={{ fontSize: 11, color: 'var(--charcoal)', marginTop: 3, whiteSpace: 'pre-wrap' }}>{inq.message}</div>}
                        {inq.payload && Object.keys(inq.payload).length > 0 && (
                          <div style={{ marginTop: 4 }}>{renderPayload(inq)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {dpInq.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--warm-gray)' }}>
                    <Inbox size={20} style={{ opacity: 0.3, marginBottom: 6 }} />
                    <div style={{ fontSize: 12 }}>La pareja aún no ha respondido</div>
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 8 }}>
                {linkedLeadName && dp.lead_id && (
                  <button className="btn btn-ghost btn-sm" onClick={() => { setDetailModalProposal(null); router.push(`/leads?open=${dp.lead_id}`) }}>
                    <ExternalLink size={11} /> Ver lead
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button className="btn btn-ghost btn-sm" onClick={() => setDetailModalProposal(null)}>Cerrar</button>
                <button className="btn btn-primary btn-sm" onClick={() => { setDetailModalProposal(null); handleEdit(dp) }}>
                  <Pencil size={11} /> Editar dosier
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {newModalOpen && (
        <div className="modal-overlay" onClick={() => setNewModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ position: 'relative', paddingRight: 48 }}>
              <div className="modal-title">Nueva propuesta</div>
              <div className="modal-sub">Elige una plantilla para empezar</div>
              <button onClick={() => setNewModalOpen(false)} style={{ position: 'absolute', top: '50%', right: 16, transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 6, display: 'flex', alignItems: 'center', borderRadius: 6 }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {contentTemplates.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 13, lineHeight: 1.6 }}>
                  <LayoutTemplate size={28} style={{ margin: '0 auto 10px', opacity: 0.3, display: 'block' }} />
                  No tienes plantillas creadas aún.
                  <div style={{ marginTop: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setNewModalOpen(false); router.push('/dossier/templates') }}>
                      Ir a Plantillas →
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {contentTemplates.map(tpl => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => { setNewModalOpen(false); router.push(`/dossier/new?content_template_id=${tpl.id}`) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                        borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%',
                        border: `1.5px solid ${tpl.is_default ? 'var(--gold)' : 'var(--border)'}`,
                        background: tpl.is_default ? 'rgba(196,151,90,0.06)' : 'var(--surface)',
                      }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: tpl.is_default ? 'rgba(196,151,90,0.15)' : 'var(--cream)', border: `1px solid ${tpl.is_default ? 'var(--gold)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <LayoutTemplate size={15} style={{ color: tpl.is_default ? 'var(--gold)' : 'var(--warm-gray)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {tpl.name}
                          {tpl.is_default && <span style={{ fontSize: 9, background: 'var(--gold)', color: '#fff', padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>POR DEFECTO</span>}
                        </div>
                        {tpl.description && <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{tpl.description}</div>}
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setNewModalOpen(false); router.push('/dossier/new') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%',
                      border: '1.5px dashed var(--border)', background: 'transparent',
                    }}
                  >
                    <FileText size={15} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>En blanco (sin plantilla)</div>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {sendModal && (
        <div className="modal-overlay" onClick={() => setSendModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Enviar propuesta</div>
              <div className="modal-sub">La propuesta de <strong>{sendModal.couple_name}</strong> no tiene email guardado.</div>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email de la pareja</label>
                <input
                  className="form-input"
                  type="email"
                  autoFocus
                  value={sendEmail}
                  onChange={e => setSendEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && isValidEmail(sendEmail) && doSend(sendModal.id, sendEmail)}
                  placeholder="pareja@email.com"
                  style={sendEmail && !isValidEmail(sendEmail) ? { borderColor: '#e53e3e' } : {}}
                />
                {sendEmail && !isValidEmail(sendEmail) && <div style={{ fontSize: 11, color: '#e53e3e', marginTop: 4 }}>Email no válido</div>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setSendModal(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={!isValidEmail(sendEmail) || sendingId === sendModal.id} onClick={() => doSend(sendModal.id, sendEmail)}>
                {sendingId === sendModal.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {sendingId === sendModal.id ? 'Enviando…' : 'Enviar propuesta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PropuestasPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <PropuestasPageContent />
    </Suspense>
  )
}

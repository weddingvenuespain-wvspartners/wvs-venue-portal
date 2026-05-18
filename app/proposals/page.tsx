'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Tabs from '@/components/Tabs'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { Plus, Copy, ExternalLink, X, Check, Eye, Send, Pencil, Trash2, AlertCircle, AlertTriangle, Loader2, FileText, LayoutTemplate, ChevronLeft, ChevronRight, Search, Inbox } from 'lucide-react'
import { renderPayload } from '@/components/InquiriesPanel'
import FeatureGate from '@/components/FeatureGate'
import { usePlanFeatures } from '@/lib/use-plan-features'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

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
  const [sectionCounts, setSectionCounts] = useState<Record<string, number>>({})
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent' | 'viewed' | 'expired'>('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'last_7d' | 'last_30d'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'views' | 'name'>('recent')

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    load()
  }, [user, authLoading, activeVenue?.id])

  // Legacy entry: /proposals?lead_id=xxx&create=1 → redirect to /proposals/new
  useEffect(() => {
    const urlLeadId = searchParams.get('lead_id')
    const autoCreate = searchParams.get('create') === '1'
    if (autoCreate) {
      router.replace(urlLeadId ? `/proposals/new?lead_id=${urlLeadId}` : '/proposals/new')
    }
  }, [searchParams, router])

  const load = async () => {
    if (!activeVenue) { setLoading(false); return }
    const supabase = createClient()
    const [{ data: props }, { data: leadsData }, { data: venueRow }, { data: inqData }] = await Promise.all([
      supabase.from('proposals').select('*, branding:proposal_branding(*)').eq('venue_id', activeVenue.id).order('created_at', { ascending: false }),
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
    fetch('/api/proposal-templates').then(r => r.json()).then(data => {
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
    router.push(`/proposals/${p.id}/edit`)
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
      const res = await fetch(`/api/proposals/${id}/send`, {
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
    const url = `${window.location.origin}/proposal/${slug}`
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
    if (dateFilter !== 'all') {
      const now = Date.now()
      const dayMs = 86400000
      const cutoffs = { today: dayMs, last_7d: 7 * dayMs, last_30d: 30 * dayMs }
      const cutoff = now - cutoffs[dateFilter]
      arr = arr.filter(p => new Date(p.created_at).getTime() > cutoff)
    }
    if (sortBy === 'views') arr = [...arr].sort((a, b) => ((b.open_count ?? b.views) || 0) - ((a.open_count ?? a.views) || 0))
    else if (sortBy === 'name') arr = [...arr].sort((a, b) => a.couple_name.localeCompare(b.couple_name))
    // 'recent' is the default order from the query
    return arr
  }, [proposals, leads, searchQuery, statusFilter, dateFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredProposals.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visibleProposals = filteredProposals.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])
  useEffect(() => {
    setPage(1)
  }, [searchQuery, statusFilter, dateFilter, sortBy])

  if (isBlocked) return null

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
          <div className="topbar-title">Propuestas</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={handleNew}>
              <Plus size={13} /> Nueva propuesta
            </button>
          </div>
        </div>

        {(success || error) && (
          <div style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
            background: error ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${error ? '#fca5a5' : '#86efac'}`,
            color: error ? '#991b1b' : '#15803d',
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
                <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#92400e' }}>
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
                <a href="/perfil" className="btn btn-primary">Revisar configuración</a>
              </div>
            </div>
          </div>
        )}

        <Tabs
          activeKey={currentTab}
          onChange={() => {}}
          tabs={[
            { key: 'proposals', label: 'Propuestas', icon: FileText },
            { key: 'templates', label: 'Plantillas', icon: LayoutTemplate, href: '/proposals/templates' },
          ]}
        />

        <div className="page-content">
          <>

          {smtpConfigured === false && (
            <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>
                No tienes configurado el correo de envío. Los emails de propuestas saldrán desde el servidor de FOREVENTOS.{' '}
                <a href="/perfil" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>Configurar ahora →</a>
              </span>
            </div>
          )}
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
          <div className="stats-grid">
            <div className="stat-card accent">
              <div className="stat-label">Total creadas</div>
              <div className="stat-value">{counts.total}</div>
              <div className="stat-sub">Historial completo</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Enviadas</div>
              <div className="stat-value">{counts.sent}</div>
              <div className="stat-sub">Activas ahora</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Vistas por parejas</div>
              <div className="stat-value">{counts.viewed}</div>
              <div className="stat-sub">Han abierto el enlace</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total aperturas</div>
              <div className="stat-value">{counts.views}</div>
              <div className="stat-sub">{counts.total > 0 ? (counts.views / counts.total).toFixed(1) : 0} de media</div>
            </div>
          </div>

          {/* Filters row — 4 equal columns (25% each), search on the right with magnifier icon */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="sent">Enviada</SelectItem>
                  <SelectItem value="viewed">Vista</SelectItem>
                  <SelectItem value="expired">Expirada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Cualquier fecha</SelectItem>
                  <SelectItem value="today">Creada hoy</SelectItem>
                  <SelectItem value="last_7d">Últimos 7 días</SelectItem>
                  <SelectItem value="last_30d">Últimos 30 días</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Más recientes</SelectItem>
                  <SelectItem value="views">Más vistas</SelectItem>
                  <SelectItem value="name">Nombre A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)', pointerEvents: 'none' }} />
              <input
                type="search"
                placeholder="Buscar por pareja o lead…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ height: 34, paddingLeft: 32, width: '100%' }}
              />
            </div>
          </div>
          {(searchQuery || statusFilter !== 'all' || dateFilter !== 'all' || sortBy !== 'recent') && (
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); setDateFilter('all'); setSortBy('recent') }}
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
                    <th>Respuestas</th>
                    <th>Branding</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--warm-gray)' }}>
                        <Send size={28} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                        <div style={{ marginBottom: 4 }}>Aún no has creado ninguna propuesta.</div>
                        <div style={{ fontSize: 12, marginBottom: 16 }}>Crea una landing personalizada para cada pareja.</div>
                        <button className="btn btn-primary btn-sm" onClick={handleNew}>Crear primera propuesta →</button>
                      </td>
                    </tr>
                  )}
                  {proposals.length > 0 && filteredProposals.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--warm-gray)', fontSize: 13 }}>
                        Sin resultados con esos filtros.
                      </td>
                    </tr>
                  )}
                  {visibleProposals.map(p => {
                    const leadProposalCount = p.lead_id ? proposals.filter(x => x.lead_id === p.lead_id).length : null
                    const atLimit = leadProposalCount !== null && leadProposalCount >= MAX_PROPOSALS_PER_LEAD
                    const linkedLeadName = leads.find(l => l.id === p.lead_id)?.name
                    return (
                      <tr key={p.id} onClick={() => handleEdit(p)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {p.couple_name}
                            {leadProposalCount !== null && (
                              <span title={`${leadProposalCount}/${MAX_PROPOSALS_PER_LEAD} propuestas para este lead`} style={{
                                fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 600,
                                background: atLimit ? '#fee2e2' : 'var(--ivory)',
                                color: atLimit ? '#dc2626' : 'var(--warm-gray)',
                              }}>
                                {leadProposalCount}/{MAX_PROPOSALS_PER_LEAD}
                              </span>
                            )}
                          </div>
                          {p.guest_count && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{p.guest_count} invitados</div>}
                          {linkedLeadName && (
                            <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 1 }}>Lead: {linkedLeadName}</div>
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
                        <td onClick={e => e.stopPropagation()}>
                          {(() => {
                            const pInq = inquiries.filter(i => i.proposal_id === p.id)
                            const newCount = pInq.filter(i => i.status === 'new').length
                            if (pInq.length === 0) return <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>—</span>
                            return (
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setResponseModalProposal(p)}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 8px', position: 'relative' }}
                              >
                                <Inbox size={12} />
                                {pInq.length}
                                {newCount > 0 && (
                                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 99, background: 'var(--gold)', color: '#fff', fontWeight: 700 }}>{newCount} new</span>
                                )}
                              </button>
                            )
                          })()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 16, height: 16, borderRadius: 4, background: p.branding?.primary_color ?? '#2d4a7a', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
                            {p.branding?.logo_url ? <img src={p.branding.logo_url} alt="logo" style={{ height: 16, maxWidth: 40, objectFit: 'contain', opacity: 0.8 }} /> : <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>sin logo</span>}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 3 }}>
                            {new Date(p.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          </div>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => copyUrl(p.slug)} title="Copiar URL" style={{ height: 32, width: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              {copied === p.slug ? <Check size={12} style={{ color: 'var(--sage)' }} /> : <Copy size={12} />}
                            </button>
                            <a href={`/proposal/${p.slug}`} target="_blank" rel="noopener" className="btn btn-ghost btn-sm" title="Ver landing" style={{ height: 32, width: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <ExternalLink size={11} />
                            </a>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(p)} title="Editar" style={{ height: 32, width: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Pencil size={11} />
                            </button>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => { if (smtpConfigured !== false && sendingId !== p.id) markSent(p) }}
                              title={smtpConfigured === false ? 'Configura el correo de envío' : p.status === 'draft' ? 'Enviar propuesta' : 'Reenviar propuesta'}
                              style={{ height: 32, ...(smtpConfigured === false || sendingId === p.id ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }}
                            >
                              {sendingId === p.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} {sendingId === p.id ? '…' : p.status === 'draft' ? 'Enviar' : 'Reenviar'}
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)} title="Eliminar" style={{ height: 32, width: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
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
        const KIND_LABEL: Record<string, string> = { visit: 'Visita solicitada', call: 'Llamada', video: 'Videollamada', menu: 'Pregunta sobre menú', menu_selection: 'Selección de menú', date_pick: 'Fecha confirmada', other: 'Consulta' }
        const KIND_EMOJI: Record<string, string> = { visit: '📍', call: '📞', video: '🎥', menu: '🍽️', menu_selection: '✅', date_pick: '📅', other: '💬' }
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
                  <div key={inq.id} style={{ padding: '12px 14px', background: inq.status === 'new' ? '#FFFBEB' : 'var(--cream)', border: `1px solid ${inq.status === 'new' ? '#FDE68A' : 'var(--ivory)'}`, borderRadius: 8, marginBottom: 8 }}>
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
                    <button className="btn btn-ghost btn-sm" onClick={() => { setNewModalOpen(false); router.push('/proposals/templates') }}>
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
                      onClick={() => { setNewModalOpen(false); router.push(`/proposals/new?content_template_id=${tpl.id}`) }}
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
                    onClick={() => { setNewModalOpen(false); router.push('/proposals/new') }}
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

'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { Plus, Copy, ExternalLink, X, Check, Eye, Send, Pencil, Trash2, AlertCircle, AlertTriangle, Lock, Loader2, FileText, Building2, UtensilsCrossed, LayoutTemplate, type LucideIcon } from 'lucide-react'
import { usePlanFeatures } from '@/lib/use-plan-features'
import { STARTER_TEMPLATES, type StarterTemplateId, type StarterTemplateIcon } from '@/lib/proposal-starter-templates'

const STARTER_ICON: Record<StarterTemplateIcon, LucideIcon> = {
  'building-2': Building2,
  'utensils-crossed': UtensilsCrossed,
}

const MAX_PROPOSALS_PER_LEAD = 6

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
  const { user, loading: authLoading } = useAuth()
  const { isBlocked } = useRequireSubscription()
  const features = usePlanFeatures()

  const [proposals, setProposals] = useState<Proposal[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [limitWarn, setLimitWarn] = useState('')
  const [sendModal, setSendModal] = useState<Proposal | null>(null)
  const [sendEmail, setSendEmail] = useState('')
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sendErrAlert, setSendErrAlert] = useState(false)
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null)
  const [newModalOpen, setNewModalOpen] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    load()
  }, [user, authLoading])

  // Legacy entry: /proposals?lead_id=xxx&create=1 → redirect to /proposals/new
  useEffect(() => {
    const urlLeadId = searchParams.get('lead_id')
    const autoCreate = searchParams.get('create') === '1'
    if (autoCreate) {
      router.replace(urlLeadId ? `/proposals/new?lead_id=${urlLeadId}` : '/proposals/new')
    }
  }, [searchParams, router])

  const load = async () => {
    const supabase = createClient()
    const [{ data: props }, { data: leadsData }, { data: venueRow }] = await Promise.all([
      supabase.from('proposals').select('*, branding:proposal_branding(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('leads').select('id, name, email').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('venue_onboarding').select('smtp_from_email').eq('user_id', user.id).maybeSingle(),
    ])
    setSmtpConfigured(!!(venueRow as any)?.smtp_from_email)
    if (props) setProposals(props as Proposal[])
    if (leadsData) setLeads(leadsData)
    setLoading(false)
  }

  const notify = (msg: string, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => { setSuccess(''); setError('') }, 3500)
  }
  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

  const handleNew = () => {
    setNewModalOpen(true)
  }

  const createFromStarter = (tpl: StarterTemplateId | null) => {
    setNewModalOpen(false)
    router.push(tpl ? `/proposals/new?template=${tpl}` : '/proposals/new')
  }

  const handleEdit = (p: Proposal) => {
    router.push(`/proposals/${p.id}/edit`)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta propuesta? La URL dejará de funcionar.')) return
    const supabase = createClient()
    await supabase.from('proposals').delete().eq('id', id)
    setProposals(prev => prev.filter(p => p.id !== id))
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
      setProposals(prev => prev.map(p => p.id === id ? { ...p, status: 'sent' } : p))
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
    sent: proposals.filter(p => ['sent', 'viewed'].includes(p.status)).length,
    viewed: proposals.filter(p => p.status === 'viewed').length,
    views: proposals.reduce((a, p) => a + (p.views || 0), 0),
  }

  if (isBlocked) return null

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold)' }}>Cargando...</div>
    </div>
  )

  if (!features.propuestas) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cream)' }}>
      <Sidebar />
      <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <div style={{ textAlign: 'center', maxWidth: 480, padding: '40px 24px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Lock size={32} style={{ color: 'var(--gold)', opacity: 0.7 }} />
          </div>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 500, letterSpacing: '0.01em', color: 'var(--espresso)', marginBottom: 12 }}>Propuestas personalizadas</div>
          <div style={{ fontSize: 14, color: 'var(--warm-gray)', lineHeight: 1.7, marginBottom: 28 }}>
            Crea landings únicas para cada pareja con tu branding, precios y secciones personalizadas.<br />
            Disponible en el plan <strong>Premium</strong>.
          </div>
          <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Contacta con tu gestor de cuenta para actualizar tu plan</div>
        </div>
      </main>
    </div>
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

        <div className="page-content">

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--ivory)', marginBottom: 24 }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px',
              background: 'none', border: 'none', cursor: 'default',
              borderBottom: '2px solid var(--gold)', marginBottom: -2,
              color: 'var(--espresso)', transition: 'all 0.15s',
            }}>
              <FileText size={15} color="var(--gold)" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Propuestas</span>
            </button>
            <a href="/proposals/templates" style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px',
              textDecoration: 'none',
              borderBottom: '2px solid transparent', marginBottom: -2,
              color: 'var(--warm-gray)', transition: 'all 0.15s',
            }}>
              <LayoutTemplate size={15} color="var(--warm-gray)" />
              <span style={{ fontSize: 13 }}>Plantillas</span>
            </a>
          </div>

          {smtpConfigured === false && (
            <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>
                No tienes configurado el correo de envío. Los emails de propuestas saldrán desde el servidor de Wedding Venues Spain.{' '}
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

          <div className="card">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pareja</th>
                    <th>Boda</th>
                    <th>Estado</th>
                    <th>Vistas</th>
                    <th>Branding</th>
                    <th>Creada</th>
                    <th>Compartir</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--warm-gray)' }}>
                        <Send size={28} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                        <div style={{ marginBottom: 4 }}>Aún no has creado ninguna propuesta.</div>
                        <div style={{ fontSize: 12, marginBottom: 16 }}>Crea una landing personalizada para cada pareja.</div>
                        <button className="btn btn-primary btn-sm" onClick={handleNew}>Crear primera propuesta →</button>
                      </td>
                    </tr>
                  )}
                  {proposals.map(p => {
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
                            <span style={{ fontSize: 12 }}>{p.views || 0}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 16, height: 16, borderRadius: 4, background: p.branding?.primary_color ?? '#2d4a7a', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
                            {p.branding?.logo_url ? <img src={p.branding.logo_url} alt="logo" style={{ height: 16, maxWidth: 40, objectFit: 'contain', opacity: 0.8 }} /> : <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>sin logo</span>}
                          </div>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--warm-gray)' }}>
                          {new Date(p.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => copyUrl(p.slug)} style={{ height: 34 }}>
                              {copied === p.slug ? <><Check size={12} style={{ color: 'var(--sage)' }} /> Copiado</> : <><Copy size={12} /> Copiar URL</>}
                            </button>
                            <a href={`/proposal/${p.slug}`} target="_blank" rel="noopener" className="btn btn-ghost btn-sm" title="Ver landing" style={{ height: 34, width: 34, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <ExternalLink size={11} />
                            </a>
                          </div>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => { if (smtpConfigured !== false && sendingId !== p.id) markSent(p) }}
                              title={smtpConfigured === false ? 'Configura el correo de envío' : p.status === 'draft' ? 'Enviar propuesta' : 'Reenviar propuesta'}
                              style={{ height: 34, minWidth: 100, ...(smtpConfigured === false || sendingId === p.id ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }}
                            >
                              {sendingId === p.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} {sendingId === p.id ? 'Enviando' : p.status === 'draft' ? 'Enviar' : 'Reenviar'}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(p)} title="Editar" style={{ height: 34, width: 34, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Pencil size={11} />
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)} title="Eliminar" style={{ height: 34, width: 34, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
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
        </div>
      </div>

      {newModalOpen && (
        <div className="modal-overlay" onClick={() => setNewModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ position: 'relative', paddingRight: 48 }}>
              <div className="modal-title">Nueva propuesta</div>
              <div className="modal-sub">Elige cómo quieres empezar</div>
              <button onClick={() => setNewModalOpen(false)} style={{ position: 'absolute', top: '50%', right: 16, transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 6, display: 'flex', alignItems: 'center', borderRadius: 6 }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => createFromStarter(null)}
                className="starter-card"
              >
                <div className="starter-card-icon">
                  <FileText size={20} strokeWidth={1.6} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>En blanco</div>
                  <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.5 }}>Propuesta vacía para rellenar desde cero.</div>
                </div>
                <div className="starter-card-arrow" aria-hidden="true">→</div>
              </button>
              {STARTER_TEMPLATES.map(tpl => {
                const Icon = STARTER_ICON[tpl.icon]
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => createFromStarter(tpl.id)}
                    className="starter-card"
                  >
                    <div className="starter-card-icon">
                      <Icon size={20} strokeWidth={1.6} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                        Plantilla · {tpl.label}
                        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--gold)', background: 'rgba(196,151,90,.1)', padding: '2px 7px', borderRadius: 100 }}>Ejemplo</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.5 }}>{tpl.description} Incluye secciones, zonas, inclusiones, testimonios y más — todo editable.</div>
                    </div>
                    <div className="starter-card-arrow" aria-hidden="true">→</div>
                  </button>
                )
              })}
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

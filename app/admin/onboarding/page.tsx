'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { ArrowLeft, Check, X, ExternalLink, ImageIcon } from 'lucide-react'

type Onboarding = {
  id: string
  user_id: string
  name: string | null
  status: string
  changes_status: string | null
  admin_notes: string | null
  submitted_at: string | null
  reviewed_at: string | null
  wp_post_id: number | null
  ficha_data: Record<string, any> | null
  changes_data: Record<string, any> | null
  contact_email: string | null
  contact_name: string | null
  city: string | null
  region: string | null
}

// ─── Full-info modal ───────────────────────────────────────────────────────────

function VenueModal({
  onb,
  adminNotes,
  setAdminNotes,
  saving,
  onClose,
  onApprove,
  onReject,
  onApproveChanges,
  onRejectChanges,
}: {
  onb: Onboarding
  adminNotes: string
  setAdminNotes: (v: string) => void
  saving: string | null
  onClose: () => void
  onApprove: (o: Onboarding) => void
  onReject: (o: Onboarding) => void
  onApproveChanges: (o: Onboarding) => void
  onRejectChanges: (o: Onboarding) => void
}) {
  const data = onb.status === 'submitted'
    ? onb.ficha_data
    : onb.changes_status === 'submitted'
      ? onb.changes_data
      : onb.ficha_data

  const isInitial  = onb.status === 'submitted'
  const isChanges  = onb.status === 'approved' && onb.changes_status === 'submitted'
  const isApproved = onb.status === 'approved' && (!onb.changes_status || ['approved','draft'].includes(onb.changes_status))

  // For changes review: compare changes_data field vs ficha_data (published) field
  const published = onb.ficha_data ?? {}
  const hasChanged = (key: string): boolean => {
    if (!isChanges) return false
    const newVal = onb.changes_data?.[key]
    const oldVal = published[key]
    if (newVal === undefined && oldVal === undefined) return false
    return JSON.stringify(newVal) !== JSON.stringify(oldVal)
  }

  const FieldRow = ({ label, value, fieldKey }: { label: string; value?: string | number | boolean | null; fieldKey?: string }) => {
    if (value === null || value === undefined || value === '') return null
    const changed = fieldKey ? hasChanged(fieldKey) : false
    return (
      <div style={{
        marginBottom: 14,
        ...(changed ? { background: '#fef3c7', borderLeft: '3px solid #f59e0b', padding: '6px 8px', borderRadius: 4, marginLeft: -8 } : {})
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', color: changed ? '#92400e' : 'var(--warm-gray)', textTransform: 'uppercase', marginBottom: 3 }}>
          {label}{changed && <span style={{ marginLeft: 6, fontSize: 9, background: '#f59e0b', color: '#fff', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>CAMBIO</span>}
        </div>
        <div style={{ fontSize: 13, color: changed ? '#78350f' : 'var(--charcoal)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{String(value)}</div>
        {changed && published[fieldKey!] !== undefined && published[fieldKey!] !== null && published[fieldKey!] !== '' && (
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, textDecoration: 'line-through', opacity: 0.7 }}>
            Antes: {String(published[fieldKey!])}
          </div>
        )}
      </div>
    )
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--espresso)', letterSpacing: '.1em', textTransform: 'uppercase', paddingBottom: 8, borderBottom: '1px solid var(--ivory)', marginBottom: 14 }}>
        {title}
      </div>
      {children}
    </div>
  )

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ alignItems: 'flex-start', paddingTop: 40, paddingBottom: 40, overflowY: 'auto' }}
    >
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 860, maxHeight: 'none', overflow: 'visible' }}
      >
        <div style={{ padding: '24px 28px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 20, fontFamily: 'Manrope, sans-serif', fontWeight: 600, color: 'var(--espresso)' }}>
              {data?.H1_Venue || onb.name || 'Sin nombre'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 3 }}>
              {data?.location || onb.region || onb.city || '—'}
              {onb.contact_email && <span style={{ marginLeft: 12 }}>✉ {onb.contact_email}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {onb.wp_post_id && (
              <a
                href={`https://weddingvenuesspain.com/wp-admin/post.php?post=${onb.wp_post_id}&action=edit`}
                target="_blank" rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
              >
                <ExternalLink size={12} /> Ver en WP
              </a>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Status badge */}
        {isChanges && (
          <div className="alert alert-info" style={{ fontSize: 12, marginBottom: 20 }}>
            <strong>Solicitud de cambios</strong> — Venue publicado (WP #{onb.wp_post_id}).
            Los campos <span style={{ background: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>resaltados en amarillo</span> han cambiado respecto a la versión publicada.
          </div>
        )}

        {data ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>

            {/* LEFT COLUMN */}
            <div>
              <Section title="Información principal">
                <FieldRow label="Nombre H1" value={data.H1_Venue} fieldKey="H1_Venue" />
                <FieldRow label="Región" value={data.location} fieldKey="location" />
                <FieldRow label="Descripción corta" value={data.shortDesc} fieldKey="shortDesc" />
                <FieldRow label="Capacidad" value={data.capacity} fieldKey="capacity" />
              </Section>

              <Section title="Descripción">
                <FieldRow label="Mini título (H2)" value={data.miniDesc} fieldKey="miniDesc" />
                <FieldRow label="Mini párrafo" value={data.miniParagraph} fieldKey="miniParagraph" />
                {data.postContent && (() => {
                  const chg = hasChanged('postContent')
                  return (
                    <div style={{
                      marginBottom: 14,
                      ...(chg ? { background: '#fef3c7', borderLeft: '3px solid #f59e0b', padding: '6px 8px', borderRadius: 4, marginLeft: -8 } : {})
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', color: chg ? '#92400e' : 'var(--warm-gray)', textTransform: 'uppercase', marginBottom: 3 }}>
                        Descripción completa{chg && <span style={{ marginLeft: 6, fontSize: 9, background: '#f59e0b', color: '#fff', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>CAMBIO</span>}
                      </div>
                      <div style={{ fontSize: 11, color: chg ? '#78350f' : 'var(--charcoal)', fontFamily: 'monospace', background: chg ? '#fde68a' : 'var(--cream)', padding: '8px 10px', borderRadius: 6, maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {data.postContent}
                      </div>
                    </div>
                  )
                })()}
              </Section>

              <Section title="Ubicación">
                <FieldRow label="Ubicación específica" value={data.specificLocation} fieldKey="specificLocation" />
                <FieldRow label="Lugares cercanos" value={data.placesNearby} fieldKey="placesNearby" />
                <FieldRow label="Aeropuerto más cercano" value={data.closestAirport} fieldKey="closestAirport" />
              </Section>
            </div>

            {/* RIGHT COLUMN */}
            <div>
              <Section title="Precios">
                <FieldRow label="Precio símbolo" value={data.venuePrice} fieldKey="venuePrice" />
                <FieldRow label="Menú desde" value={data.menuPrice} fieldKey="menuPrice" />
                <FieldRow label="Venue fee" value={data.breakdown1} fieldKey="breakdown1" />
                <FieldRow label="Venue fee — detalle" value={data.breakdown1text} fieldKey="breakdown1text" />
                <FieldRow label="Catering" value={data.breakdown3} fieldKey="breakdown3" />
                <FieldRow label="Catering — detalle" value={data.breakdown3text} fieldKey="breakdown3text" />
                <FieldRow label="Alojamiento" value={data.accommodation} fieldKey="accommodation" />
                <FieldRow label="WVS ayuda alojamiento" value={data.wvsAccomHelp ? 'Sí' : null} fieldKey="wvsAccomHelp" />
              </Section>

              <Section title="Imágenes">
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  {data.heroImageUrl && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 4 }}>HERO</div>
                      <img src={data.heroImageUrl} alt="hero" style={{ width: 140, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--ivory)' }} />
                    </div>
                  )}
                  {data.verticalPhotoUrl && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 4 }}>VERTICAL</div>
                      <img src={data.verticalPhotoUrl} alt="vertical" style={{ width: 60, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--ivory)' }} />
                    </div>
                  )}
                </div>
                {Array.isArray(data.gallery) && data.gallery.some(Boolean) && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 6 }}>GALERÍA ({data.gallery.filter(Boolean).length} fotos)</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {data.gallery.filter(Boolean).map((img: any, i: number) =>
                        img?.url
                          ? <img key={i} src={img.url} alt="" style={{ width: 64, height: 46, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--ivory)' }} />
                          : <div key={i} style={{ width: 64, height: 46, background: 'var(--cream)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImageIcon size={16} color="var(--warm-gray)" /></div>
                      )}
                    </div>
                  </div>
                )}
              </Section>

              {/* Reseñas */}
              {Array.isArray(data.reviews) && data.reviews.some((r: any) => r?.couple_name) && (
                <Section title={`Reseñas ${data.reviewsEnabled === false ? '(desactivadas)' : ''}`}>
                  {data.reviews.filter((r: any) => r?.couple_name).map((r: any, i: number) => (
                    <div key={i} style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--cream)', borderRadius: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{r.couple_name} <span style={{ color: 'var(--warm-gray)', fontWeight: 400 }}>{r.country}</span></div>
                      {r.text && <div style={{ fontSize: 11, color: 'var(--charcoal)', marginTop: 3, fontStyle: 'italic' }}>"{r.text}"</div>}
                    </div>
                  ))}
                </Section>
              )}
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--warm-gray)', fontSize: 13, padding: '20px 0' }}>Sin datos de ficha disponibles.</div>
        )}

        {/* Admin notes + action buttons */}
        <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 20, marginTop: 8 }}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Nota para el venue (obligatoria si rechazas)</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 70 }}
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              placeholder="Nota interna o motivo de rechazo..."
            />
          </div>

          {isInitial && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={saving === onb.id}
                onClick={() => onApprove(onb)}
              >
                <Check size={14} /> {saving === onb.id ? 'Publicando en WordPress...' : 'Aprobar y publicar en WordPress'}
              </button>
              <button
                className="btn btn-danger"
                disabled={saving === onb.id + '-reject'}
                onClick={() => onReject(onb)}
              >
                <X size={14} /> Rechazar
              </button>
            </div>
          )}

          {isChanges && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={saving === onb.id + '-changes'}
                onClick={() => onApproveChanges(onb)}
              >
                <Check size={14} /> {saving === onb.id + '-changes' ? 'Publicando cambios...' : 'Aprobar y publicar cambios'}
              </button>
              <button
                className="btn btn-danger"
                disabled={saving === onb.id + '-changes-reject'}
                onClick={() => onRejectChanges(onb)}
              >
                <X size={14} /> Rechazar cambios
              </button>
            </div>
          )}

          {isApproved && (
            <div className="alert alert-success" style={{ fontSize: 12 }}>
              Publicado en WordPress (ID {onb.wp_post_id}) — sin cambios pendientes.
            </div>
          )}
          {onb.status === 'rejected' && (
            <div className="alert alert-error" style={{ fontSize: 12 }}>
              Rechazado. {onb.admin_notes && `Motivo: ${onb.admin_notes}`}
            </div>
          )}
        </div>
        </div>{/* end padding wrapper */}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOnboardingPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [loading, setLoading]         = useState(true)
  const [onboardings, setOnboardings] = useState<Onboarding[]>([])
  const [saving, setSaving]           = useState<string | null>(null)
  const [success, setSuccess]         = useState('')
  const [error, setError]             = useState('')
  const [selected, setSelected]       = useState<Onboarding | null>(null)
  const [adminNotes, setAdminNotes]   = useState('')
  const [filterStatus, setFilterStatus] = useState('pending')

  const fetchOnboardings = async () => {
    const supabase = createClient()
    const { data: onbs } = await supabase
      .from('venue_onboarding').select('*').order('submitted_at', { ascending: false })
    if (onbs) setOnboardings(onbs)
  }

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: me } = await supabase
        .from('venue_profiles').select('role').eq('user_id', session.user.id).single()
      if (me?.role !== 'admin') { router.push('/dashboard'); return }

      await fetchOnboardings()
      setLoading(false)
    }
    init()
  }, [authLoading]) // eslint-disable-line

  // Auto-refresh every 30s to catch new submissions from venues
  useEffect(() => {
    const interval = setInterval(fetchOnboardings, 30_000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line

  const notify = (msg: string, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => { setSuccess(''); setError('') }, 5000)
  }

  const openVenue = (onb: Onboarding) => {
    setSelected(onb)
    setAdminNotes(onb.admin_notes || '')
  }

  const handleApprove = async (onb: Onboarding) => {
    setSaving(onb.id)
    try {
      const res = await fetch('/api/venues/apply-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: onb.user_id, is_initial: true }),
      })
      const data = await res.json()
      if (res.ok) {
        notify('Venue aprobado y publicado en WordPress ✓')
        setOnboardings(prev => prev.map(o => o.id === onb.id ? { ...o, status: 'approved', wp_post_id: data.wp_venue_id } : o))
        setSelected(null)
        window.dispatchEvent(new CustomEvent('wvs-pending-refresh'))
      } else {
        notify(data.error || 'Error al publicar', true)
      }
    } catch { notify('Error de conexión', true) }
    setSaving(null)
  }

  const handleReject = async (onb: Onboarding) => {
    if (!adminNotes.trim()) { notify('Añade una nota explicando el motivo del rechazo', true); return }
    setSaving(onb.id + '-reject')
    const supabase = createClient()
    await supabase.from('venue_onboarding').update({
      status: 'rejected', admin_notes: adminNotes, reviewed_at: new Date().toISOString(),
    }).eq('id', onb.id)
    setOnboardings(prev => prev.map(o => o.id === onb.id ? { ...o, status: 'rejected', admin_notes: adminNotes } : o))
    notify('Solicitud rechazada')
    setSelected(null); setAdminNotes('')
    setSaving(null)
    window.dispatchEvent(new CustomEvent('wvs-pending-refresh'))
  }

  const handleApproveChanges = async (onb: Onboarding) => {
    setSaving(onb.id + '-changes')
    try {
      const res = await fetch('/api/venues/apply-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: onb.user_id, is_initial: false }),
      })
      const data = await res.json()
      if (res.ok) {
        notify('Cambios aprobados y publicados ✓')
        setOnboardings(prev => prev.map(o => o.id === onb.id ? { ...o, changes_status: 'approved' } : o))
        setSelected(null)
        window.dispatchEvent(new CustomEvent('wvs-pending-refresh'))
      } else {
        notify(data.error || 'Error al publicar cambios', true)
      }
    } catch { notify('Error de conexión', true) }
    setSaving(null)
  }

  const handleRejectChanges = async (onb: Onboarding) => {
    if (!adminNotes.trim()) { notify('Añade una nota explicando el motivo del rechazo', true); return }
    setSaving(onb.id + '-changes-reject')
    const supabase = createClient()
    await supabase.from('venue_onboarding').update({
      changes_status: 'rejected', admin_notes: adminNotes, reviewed_at: new Date().toISOString(),
    }).eq('id', onb.id)
    setOnboardings(prev => prev.map(o => o.id === onb.id ? { ...o, changes_status: 'rejected', admin_notes: adminNotes } : o))
    notify('Cambios rechazados')
    setSelected(null); setAdminNotes('')
    setSaving(null)
    window.dispatchEvent(new CustomEvent('wvs-pending-refresh'))
  }

  const pendingInitial = onboardings.filter(o => o.status === 'submitted')
  const pendingChanges = onboardings.filter(o => o.status === 'approved' && o.changes_status === 'submitted')
  const allPending     = [...pendingInitial, ...pendingChanges]
  const drafts         = onboardings.filter(o => o.status === 'draft' || !o.status)
  const approved       = onboardings.filter(o => o.status === 'approved')
  const rejected       = onboardings.filter(o => o.status === 'rejected')

  const filtered =
    filterStatus === 'pending'  ? allPending :
    filterStatus === 'draft'    ? drafts :
    filterStatus === 'approved' ? approved :
    filterStatus === 'rejected' ? rejected :
    onboardings

  const getRowBadge = (onb: Onboarding) => {
    if (onb.status === 'submitted') return { cls: 'badge-pending', label: 'Nueva solicitud' }
    if (onb.status === 'approved' && onb.changes_status === 'submitted') return { cls: 'badge-pending', label: 'Cambios pendientes' }
    if (onb.status === 'approved') return { cls: 'badge-active', label: 'Aprobado' }
    if (onb.status === 'rejected') return { cls: 'badge-inactive', label: 'Rechazado' }
    return { cls: 'badge-inactive', label: 'Borrador' }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1A1512', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C4975A' }}>Cargando...</div>
    </div>
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/admin" className="btn btn-ghost btn-sm"><ArrowLeft size={13} /> CRM</a>
            <div className="topbar-title">Solicitudes de venues</div>
          </div>
        </div>

        <div className="page-content">
          {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}
          {error   && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{error}</div>}

          {/* Stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
            <div className="stat-card accent">
              <div className="stat-label">Pendientes revisión</div>
              <div className="stat-value" style={{ color: allPending.length > 0 ? 'var(--gold)' : undefined }}>{allPending.length}</div>
              <div className={`stat-sub ${allPending.length > 0 ? 'warn' : ''}`}>{allPending.length > 0 ? 'Requieren acción' : 'Al día ✓'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">En borrador</div>
              <div className="stat-value">{drafts.length}</div>
              <div className="stat-sub">Rellenando ficha</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Aprobados</div>
              <div className="stat-value">{approved.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Rechazados</div>
              <div className="stat-value">{rejected.length}</div>
            </div>
          </div>

          {/* Table */}
          <div className="card">
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--ivory)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([
                ['pending',  `Pendientes (${allPending.length})`],
                ['draft',    'Borradores'],
                ['approved', 'Aprobados'],
                ['rejected', 'Rechazados'],
                ['all',      'Todos'],
              ] as [string, string][]).map(([k, label]) => (
                <button
                  key={k}
                  className={`btn btn-sm ${filterStatus === k ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setFilterStatus(k)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Venue</th>
                    <th>Contacto</th>
                    <th>WP ID</th>
                    <th>Enviado</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--warm-gray)' }}>
                        {filterStatus === 'pending' ? 'No hay solicitudes pendientes ✓' : 'No hay registros'}
                      </td>
                    </tr>
                  )}
                  {filtered.map(onb => {
                    const badge  = getRowBadge(onb)
                    const name   = onb.ficha_data?.H1_Venue || onb.name || '—'
                    const region = onb.ficha_data?.location || onb.region || onb.city || '—'
                    return (
                      <tr
                        key={onb.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => openVenue(onb)}
                      >
                        <td>
                          <div style={{ fontWeight: 500 }}>{name}</div>
                          <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{region}</div>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          <div>{onb.contact_name || '—'}</div>
                          {onb.contact_email && (
                            <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{onb.contact_email}</div>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--warm-gray)' }}>
                          {onb.wp_post_id ? `#${onb.wp_post_id}` : '—'}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>
                          {onb.submitted_at ? new Date(onb.submitted_at).toLocaleDateString('es-ES') : '—'}
                        </td>
                        <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Full modal */}
      {selected && (
        <VenueModal
          onb={selected}
          adminNotes={adminNotes}
          setAdminNotes={setAdminNotes}
          saving={saving}
          onClose={() => { setSelected(null); setAdminNotes('') }}
          onApprove={handleApprove}
          onReject={handleReject}
          onApproveChanges={handleApproveChanges}
          onRejectChanges={handleRejectChanges}
        />
      )}
    </div>
  )
}

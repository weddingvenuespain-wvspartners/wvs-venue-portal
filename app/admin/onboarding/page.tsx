'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { ArrowLeft, Check, X, Building2, Plus } from 'lucide-react'

type Onboarding = {
  id: string
  user_id: string
  name: string | null
  description: string | null
  short_bio: string | null
  city: string | null
  region: string | null
  country: string | null
  address: string | null
  capacity_min: number | null
  capacity_max: number | null
  price_min: number | null
  price_max: number | null
  price_notes: string | null
  accommodation: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  photo_urls: string[] | null
  status: string
  admin_notes: string | null
  wp_post_id: number | null
  submitted_at: string | null
  created_at: string
}

// Modal para crear venue desde cero (sin onboarding del cliente)
function CreateVenueModal({ wpVenues, onClose, onCreated }: {
  wpVenues: any[]
  onClose: () => void
  onCreated: (msg: string) => void
}) {
  const [mode, setMode] = useState<'new' | 'assign'>('new')
  const [saving, setSaving] = useState(false)
  const [targetUserId, setTargetUserId] = useState('')
  const [selectedVenueId, setSelectedVenueId] = useState('')
  const [form, setForm] = useState({
    name: '', description: '', short_bio: '', city: '', region: '',
    country: 'Spain', address: '', capacity_max: '', price_min: '',
    accommodation: '', contact_email: '', contact_phone: ''
  })

  const handleCreate = async () => {
    if (!form.name) return
    setSaving(true)
    try {
      const res = await fetch('/api/venues/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          target_user_id: targetUserId || undefined,
          Capacity_of_Venue: form.capacity_max,
          venue_starting_price: form.price_min,
        })
      })
      const data = await res.json()
      if (res.ok) {
        onCreated(`Venue "${form.name}" creado en WordPress con ID ${data.wp_venue_id}`)
        onClose()
      } else {
        onCreated(data.message || 'Error al crear el venue')
      }
    } catch { onCreated('Error de conexión') }
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">Crear venue nuevo</div>
        <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
          <button className={`btn btn-sm ${mode === 'new' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('new')}>
            <Plus size={12} /> Crear en WordPress
          </button>
          <button className={`btn btn-sm ${mode === 'assign' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('assign')}>
            <Building2 size={12} /> Asignar existente
          </button>
        </div>

        {mode === 'new' && (
          <>
            <div className="two-col">
              <div className="form-group">
                <label className="form-label">Nombre del venue *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Finca Son Term" />
              </div>
              <div className="form-group">
                <label className="form-label">Ciudad</label>
                <input className="form-input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Ej: Mallorca" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Descripción corta</label>
              <textarea className="form-textarea" style={{ minHeight: 60 }} value={form.short_bio} onChange={e => setForm(f => ({ ...f, short_bio: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Descripción completa</label>
              <textarea className="form-textarea" style={{ minHeight: 100 }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="two-col">
              <div className="form-group">
                <label className="form-label">Capacidad máx.</label>
                <input className="form-input" type="number" value={form.capacity_max} onChange={e => setForm(f => ({ ...f, capacity_max: e.target.value }))} placeholder="200" />
              </div>
              <div className="form-group">
                <label className="form-label">Precio menú desde</label>
                <input className="form-input" value={form.price_min} onChange={e => setForm(f => ({ ...f, price_min: e.target.value }))} placeholder="Ej: desde 120€/persona" />
              </div>
            </div>
            <div className="two-col">
              <div className="form-group">
                <label className="form-label">Email contacto</label>
                <input className="form-input" type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input className="form-input" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Asignar a usuario (opcional — user_id de Supabase)</label>
              <input className="form-input" value={targetUserId} onChange={e => setTargetUserId(e.target.value)} placeholder="uuid del usuario en Supabase" />
              <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>Si lo dejas vacío, el venue se crea en WP sin asignar a ningún usuario del portal.</div>
            </div>
          </>
        )}

        {mode === 'assign' && (
          <div className="alert alert-info">
            Para asignar un venue existente a un usuario, usa el dropdown de la tabla principal del Panel Admin.
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          {mode === 'new' && (
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !form.name}>
              {saving ? 'Creando...' : 'Crear en WordPress'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminOnboardingPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [loading, setLoading]         = useState(true)
  const [onboardings, setOnboardings] = useState<Onboarding[]>([])
  const [wpVenues, setWpVenues]       = useState<any[]>([])
  const [userEmail, setUserEmail]     = useState('')
  const [saving, setSaving]           = useState<string | null>(null)
  const [success, setSuccess]         = useState('')
  const [error, setError]             = useState('')
  const [selected, setSelected]       = useState<Onboarding | null>(null)
  const [adminNotes, setAdminNotes]   = useState('')
  const [filterStatus, setFilterStatus] = useState('submitted')
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: me } = await supabase
        .from('venue_profiles').select('role').eq('user_id', session.user.id).single()
      if (me?.role !== 'admin') { router.push('/dashboard'); return }

      const { data: onbs } = await supabase
        .from('venue_onboarding').select('*').order('submitted_at', { ascending: false })
      if (onbs) setOnboardings(onbs)

      try {
        const res = await fetch('https://weddingvenuesspain.com/wp-json/wp/v2/venues?per_page=100&_fields=id,title,acf', { cache: 'no-store' })
        if (res.ok) setWpVenues(await res.json())
      } catch {}

      setLoading(false)
    }
    init()
  }, [user, profile, authLoading, router])

  const notify = (msg: string, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => { setSuccess(''); setError('') }, 5000)
  }

  const handleApprove = async (onb: Onboarding) => {
    setSaving(onb.id)
    try {
      const res = await fetch('/api/venues/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_user_id: onb.user_id })
      })
      const data = await res.json()
      if (res.ok) {
        notify(`Venue creado en WordPress — ID ${data.wp_venue_id}`)
        setOnboardings(prev => prev.map(o => o.id === onb.id ? { ...o, status: 'approved', wp_post_id: data.wp_venue_id } : o))
        setSelected(null)
      } else {
        notify(data.message || 'Error al crear el venue', true)
      }
    } catch { notify('Error de conexión', true) }
    setSaving(null)
  }

  const handleReject = async (onb: Onboarding) => {
    if (!adminNotes) { notify('Añade una nota explicando el motivo del rechazo', true); return }
    setSaving(onb.id + '-reject')
    const supabase = createClient()
    await supabase.from('venue_onboarding').update({
      status: 'rejected',
      admin_notes: adminNotes,
      reviewed_at: new Date().toISOString()
    }).eq('id', onb.id)
    setOnboardings(prev => prev.map(o => o.id === onb.id ? { ...o, status: 'rejected', admin_notes: adminNotes } : o))
    notify('Solicitud rechazada')
    setSelected(null)
    setAdminNotes('')
    setSaving(null)
  }

  const filtered = onboardings.filter(o => filterStatus === 'all' || o.status === filterStatus)

  const statusBadge: Record<string, { cls: string; label: string }> = {
    draft:     { cls: 'badge-inactive', label: 'Borrador' },
    submitted: { cls: 'badge-pending',  label: 'Pendiente revisión' },
    approved:  { cls: 'badge-active',   label: 'Aprobado' },
    rejected:  { cls: 'badge-inactive', label: 'Rechazado' },
  }

  const counts = {
    submitted: onboardings.filter(o => o.status === 'submitted').length,
    draft:     onboardings.filter(o => o.status === 'draft').length,
    approved:  onboardings.filter(o => o.status === 'approved').length,
    rejected:  onboardings.filter(o => o.status === 'rejected').length,
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1A1512', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C4975A', fontFamily: 'serif' }}>Cargando...</div>
    </div>
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/admin" className="btn btn-ghost btn-sm"><ArrowLeft size={13} /> Admin</a>
            <div className="topbar-title">Nuevos venues</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={13} /> Crear venue
          </button>
        </div>

        <div className="page-content">
          {success && <div className="alert alert-success">{success}</div>}
          {error   && <div className="alert alert-error">{error}</div>}

          {/* Stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
            <div className="stat-card accent">
              <div className="stat-label">Pendientes revisión</div>
              <div className="stat-value" style={{ color: counts.submitted > 0 ? 'var(--gold)' : undefined }}>{counts.submitted}</div>
              <div className={`stat-sub ${counts.submitted > 0 ? 'warn' : ''}`}>{counts.submitted > 0 ? 'Requieren acción' : 'Al día ✓'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">En borrador</div>
              <div className="stat-value">{counts.draft}</div>
              <div className="stat-sub">Rellenando formulario</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Aprobados</div>
              <div className="stat-value">{counts.approved}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Rechazados</div>
              <div className="stat-value">{counts.rejected}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16 }}>
            {/* Lista */}
            <div className="card">
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--ivory)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[['all','Todos'], ['submitted','Pendientes'], ['draft','Borradores'], ['approved','Aprobados'], ['rejected','Rechazados']].map(([k, label]) => (
                  <button key={k} className={`btn btn-sm ${filterStatus === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilterStatus(k)}>
                    {label}{k !== 'all' && ` (${counts[k as keyof typeof counts] ?? onboardings.length})`}
                  </button>
                ))}
              </div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Venue</th>
                      <th>Ubicación</th>
                      <th>Contacto</th>
                      <th>Enviado</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--warm-gray)' }}>
                        {filterStatus === 'submitted' ? 'No hay solicitudes pendientes ✓' : 'No hay registros'}
                      </td></tr>
                    )}
                    {filtered.map(onb => {
                      const sb = statusBadge[onb.status] || { cls: 'badge-inactive', label: onb.status }
                      return (
                        <tr key={onb.id} style={{ cursor: 'pointer', background: selected?.id === onb.id ? 'var(--cream)' : undefined }}
                          onClick={() => { setSelected(onb); setAdminNotes(onb.admin_notes || '') }}>
                          <td>
                            <div style={{ fontWeight: 500 }}>{onb.name || '—'}</div>
                            {onb.short_bio && <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{onb.short_bio.slice(0, 50)}...</div>}
                          </td>
                          <td style={{ fontSize: 12 }}>{[onb.city, onb.region].filter(Boolean).join(', ') || '—'}</td>
                          <td style={{ fontSize: 12 }}>
                            <div>{onb.contact_name || '—'}</div>
                            {onb.contact_email && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{onb.contact_email}</div>}
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>
                            {onb.submitted_at ? new Date(onb.submitted_at).toLocaleDateString('es-ES') : 'Sin enviar'}
                          </td>
                          <td><span className={`badge ${sb.cls}`}>{sb.label}</span></td>
                          <td>
                            {onb.wp_post_id && (
                              <a href={`https://weddingvenuesspain.com/wp-admin/post.php?post=${onb.wp_post_id}&action=edit`}
                                target="_blank" rel="noopener noreferrer"
                                className="btn btn-ghost btn-sm" onClick={e => e.stopPropagation()}>
                                Ver en WP →
                              </a>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Panel de detalle */}
            {selected && (
              <div className="card" style={{ height: 'fit-content', position: 'sticky', top: 70 }}>
                <div className="card-header">
                  <div className="card-title">{selected.name || 'Sin nombre'}</div>
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}>
                    <X size={16} />
                  </button>
                </div>
                <div className="card-body" style={{ fontSize: 13 }}>

                  {/* Info del venue */}
                  <div style={{ marginBottom: 16 }}>
                    {selected.city && <div style={{ marginBottom: 6 }}><span style={{ color: 'var(--warm-gray)', fontSize: 11 }}>UBICACIÓN</span><br />{[selected.city, selected.region, selected.country].filter(Boolean).join(', ')}</div>}
                    {selected.capacity_max && <div style={{ marginBottom: 6 }}><span style={{ color: 'var(--warm-gray)', fontSize: 11 }}>CAPACIDAD</span><br />{selected.capacity_min ? `${selected.capacity_min}–` : ''}{selected.capacity_max} personas</div>}
                    {(selected.price_min || selected.price_max) && <div style={{ marginBottom: 6 }}><span style={{ color: 'var(--warm-gray)', fontSize: 11 }}>PRECIO</span><br />{selected.price_min ? `desde ${selected.price_min}€` : ''}{selected.price_max ? ` hasta ${selected.price_max}€` : ''}</div>}
                    {selected.contact_email && <div style={{ marginBottom: 6 }}><span style={{ color: 'var(--warm-gray)', fontSize: 11 }}>CONTACTO</span><br />{selected.contact_name}<br /><a href={`mailto:${selected.contact_email}`} style={{ color: 'var(--gold)' }}>{selected.contact_email}</a>{selected.contact_phone && <><br />{selected.contact_phone}</>}</div>}
                    {selected.short_bio && <div style={{ marginBottom: 6 }}><span style={{ color: 'var(--warm-gray)', fontSize: 11 }}>DESCRIPCIÓN CORTA</span><br />{selected.short_bio}</div>}
                    {selected.description && <div style={{ marginBottom: 6 }}><span style={{ color: 'var(--warm-gray)', fontSize: 11 }}>DESCRIPCIÓN</span><br /><div style={{ maxHeight: 100, overflowY: 'auto', fontSize: 12, color: 'var(--warm-gray)' }}>{selected.description}</div></div>}
                  </div>

                  {/* Notas admin */}
                  <div className="form-group">
                    <label className="form-label">Notas internas</label>
                    <textarea className="form-textarea" style={{ minHeight: 60 }} value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Notas para el equipo o motivo de rechazo..." />
                  </div>

                  {/* Acciones */}
                  {selected.status === 'submitted' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1 }}
                        disabled={saving === selected.id}
                        onClick={() => handleApprove(selected)}
                      >
                        <Check size={13} /> {saving === selected.id ? 'Creando...' : 'Aprobar y crear en WP'}
                      </button>
                      <button
                        className="btn btn-danger"
                        disabled={saving === selected.id + '-reject'}
                        onClick={() => handleReject(selected)}
                      >
                        <X size={13} /> Rechazar
                      </button>
                    </div>
                  )}

                  {selected.status === 'approved' && selected.wp_post_id && (
                    <div className="alert alert-success" style={{ fontSize: 12 }}>
                      Venue creado en WordPress con ID {selected.wp_post_id}
                    </div>
                  )}

                  {selected.status === 'rejected' && (
                    <div className="alert alert-error" style={{ fontSize: 12 }}>
                      Rechazado. {selected.admin_notes && `Motivo: ${selected.admin_notes}`}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateVenueModal
          wpVenues={wpVenues}
          onClose={() => setShowCreateModal(false)}
          onCreated={msg => { notify(msg); setShowCreateModal(false) }}
        />
      )}
    </div>
  )
}
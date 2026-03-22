'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { Search, UserPlus, Building2, CheckCircle, Clock, XCircle } from 'lucide-react'

type Profile = {
  id: string
  user_id: string
  role: string
  status: string
  wp_venue_id: number | null
  wp_username: string | null
  created_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading]     = useState(true)
  const [profiles, setProfiles]   = useState<Profile[]>([])
  const [wpVenues, setWpVenues]   = useState<any[]>([])
  const [userEmail, setUserEmail] = useState('')
  const [saving, setSaving]       = useState<string | null>(null)
  const [success, setSuccess]     = useState('')
  const [error, setError]         = useState('')
  const [search, setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [assignVenue, setAssignVenue]   = useState<Record<string, string>>({})

  // Modal crear usuario
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newEmail, setNewEmail]       = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [creatingUser, setCreatingUser] = useState(false)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUserEmail(session.user.email || '')

      const { data: myProfile } = await supabase
        .from('venue_profiles').select('role').eq('user_id', session.user.id).single()
      if (myProfile?.role !== 'admin') { router.push('/dashboard'); return }

      const { data: allProfiles } = await supabase
        .from('venue_profiles').select('*').order('created_at', { ascending: false })
      if (allProfiles) setProfiles(allProfiles)

      try {
        const res = await fetch(
          'https://weddingvenuesspain.com/wp-json/wp/v2/wedding-venues?per_page=100&acf_format=standard',
          { cache: 'no-store' }
        )
        if (res.ok) setWpVenues(await res.json())
      } catch {}

      setLoading(false)
    }
    init()
  }, [router])

  const notify = (msg: string, isError = false) => {
    if (isError) setError(msg)
    else setSuccess(msg)
    setTimeout(() => { setSuccess(''); setError('') }, 4000)
  }

  const handleAssignVenue = async (userId: string) => {
    const wpVenueId = assignVenue[userId]
    if (!wpVenueId) { notify('Selecciona un venue primero', true); return }
    setSaving(userId)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('venue_profiles')
      .update({ wp_venue_id: parseInt(wpVenueId), status: 'active' })
      .eq('user_id', userId)
    if (err) notify('Error al asignar el venue', true)
    else {
      notify('Venue asignado correctamente')
      setProfiles(prev => prev.map(p =>
        p.user_id === userId ? { ...p, wp_venue_id: parseInt(wpVenueId), status: 'active' } : p
      ))
    }
    setSaving(null)
  }

  const handleCreateVenue = async (userId: string) => {
    setSaving(userId)
    try {
      const res = await fetch('/api/venues/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_user_id: userId })
      })
      const data = await res.json()
      if (!res.ok) notify(data.message || data.error || 'Error al crear el venue', true)
      else {
        notify(`Venue creado en WordPress — ID ${data.wp_venue_id}`)
        setProfiles(prev => prev.map(p =>
          p.user_id === userId ? { ...p, wp_venue_id: data.wp_venue_id, status: 'active' } : p
        ))
      }
    } catch { notify('Error de conexión', true) }
    setSaving(null)
  }

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    setSaving(userId + '-status')
    const supabase = createClient()
    await supabase.from('venue_profiles').update({ status: newStatus }).eq('user_id', userId)
    setProfiles(prev => prev.map(p => p.user_id === userId ? { ...p, status: newStatus } : p))
    setSaving(null)
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingUser(true)
    const supabase = createClient()
    const { error } = await supabase.auth.admin?.createUser
      ? await (supabase.auth as any).admin.createUser({ email: newEmail, password: newPassword, email_confirm: true })
      : { error: { message: 'No disponible desde cliente' } }

    if (error) {
      notify('Para crear usuarios ve a Supabase → Authentication → Users → Add user', true)
    } else {
      notify(`Usuario ${newEmail} creado correctamente`)
      setShowCreateModal(false)
      setNewEmail('')
      setNewPassword('')
    }
    setCreatingUser(false)
  }

  const getVenueName = (wpId: number | null) => {
    if (!wpId) return null
    const v = wpVenues.find(v => v.id === wpId)
    return v ? (v.acf?.H1_Venue || v.title?.rendered) : `WP #${wpId}`
  }

  const venueOwners = profiles.filter(p => p.role !== 'admin')
  const filtered = venueOwners.filter(p => {
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    const matchSearch = !search || p.user_id.includes(search) || p.wp_username?.includes(search)
    return matchStatus && matchSearch
  })

  const stats = {
    total: venueOwners.length,
    pending: venueOwners.filter(p => p.status === 'pending').length,
    active: venueOwners.filter(p => p.status === 'active').length,
    inactive: venueOwners.filter(p => p.status === 'inactive').length,
  }

  if (loading) return (
    <div className="min-h-screen bg-espresso flex items-center justify-center">
      <div className="text-gold font-serif text-lg">Cargando...</div>
    </div>
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar venueName="Admin" userEmail={userEmail} />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Panel de administración</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="/admin/onboarding" className="btn btn-ghost" style={{ fontSize: 12 }}>
              Ver onboardings →
            </a>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <UserPlus size={14} /> Nuevo usuario
            </button>
          </div>
        </div>

        <div className="page-content">
          {success && <div className="alert alert-success">{success}</div>}
          {error   && <div className="alert alert-error">{error}</div>}

          {/* Stats */}
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card accent">
              <div className="stat-label">Total venues</div>
              <div className="stat-value">{stats.total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pendientes</div>
              <div className="stat-value" style={{ color: stats.pending > 0 ? 'var(--gold)' : undefined }}>{stats.pending}</div>
              <div className={`stat-sub ${stats.pending > 0 ? 'warn' : ''}`}>{stats.pending > 0 ? 'Requieren acción' : 'Al día ✓'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Activos</div>
              <div className="stat-value">{stats.active}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Venues en WP</div>
              <div className="stat-value">{wpVenues.length}</div>
            </div>
          </div>

          {/* Tabla */}
          <div className="card">
            {/* Barra de búsqueda y filtros */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ivory)', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                <input
                  className="form-input"
                  style={{ paddingLeft: 30, fontSize: 12 }}
                  placeholder="Buscar por usuario o WP username..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['all', 'pending', 'active', 'inactive'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`btn ${filterStatus === s ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontSize: 11, padding: '5px 12px' }}
                  >
                    {s === 'all' ? 'Todos' : s === 'pending' ? 'Pendientes' : s === 'active' ? 'Activos' : 'Inactivos'}
                    {s !== 'all' && <span style={{ marginLeft: 4, opacity: 0.7 }}>({stats[s]})</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Estado</th>
                    <th>Venue asignado</th>
                    <th>Asignar venue</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--warm-gray)' }}>
                      {search || filterStatus !== 'all' ? 'No hay resultados para este filtro' : 'No hay venue owners registrados todavía'}
                    </td></tr>
                  )}
                  {filtered.map(profile => {
                    const venueName = getVenueName(profile.wp_venue_id)
                    const isSaving = saving === profile.user_id
                    const badgeClass = profile.status === 'active' ? 'badge-active' : profile.status === 'pending' ? 'badge-pending' : 'badge-inactive'
                    const statusLabel = profile.status === 'active' ? 'Activo' : profile.status === 'pending' ? 'Pendiente' : 'Inactivo'
                    return (
                      <tr key={profile.user_id}>
                        <td>
                          <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--warm-gray)' }}>{profile.user_id.slice(0, 8)}...</div>
                          {profile.wp_username && <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>WP: {profile.wp_username}</div>}
                          <div style={{ fontSize: 10, color: 'var(--stone)', marginTop: 2 }}>{new Date(profile.created_at).toLocaleDateString('es-ES')}</div>
                        </td>
                        <td><span className={`badge ${badgeClass}`}>{statusLabel}</span></td>
                        <td>
                          {venueName ? (
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 13 }}>{venueName}</div>
                              <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>ID: {profile.wp_venue_id}</div>
                            </div>
                          ) : <span style={{ color: 'var(--warm-gray)', fontSize: 12 }}>Sin asignar</span>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <select
                              className="form-input"
                              style={{ fontSize: 12, padding: '5px 28px 5px 8px', maxWidth: 180 }}
                              value={assignVenue[profile.user_id] || ''}
                              onChange={e => setAssignVenue(prev => ({ ...prev, [profile.user_id]: e.target.value }))}
                            >
                              <option value="">Selecciona venue...</option>
                              {wpVenues.map(v => (
                                <option key={v.id} value={v.id}>
                                  {v.acf?.H1_Venue || v.title?.rendered} (#{v.id})
                                </option>
                              ))}
                            </select>
                            <button
                              className="btn btn-primary"
                              style={{ fontSize: 11, padding: '5px 10px', whiteSpace: 'nowrap' }}
                              disabled={isSaving || !assignVenue[profile.user_id]}
                              onClick={() => handleAssignVenue(profile.user_id)}
                            >
                              {isSaving ? '...' : 'Asignar'}
                            </button>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className={`btn ${profile.status === 'active' ? 'btn-danger' : 'btn-ghost'}`}
                              style={{ fontSize: 11, padding: '4px 10px' }}
                              disabled={saving === profile.user_id + '-status'}
                              onClick={() => handleToggleStatus(profile.user_id, profile.status)}
                            >
                              {profile.status === 'active' ? 'Desactivar' : 'Activar'}
                            </button>
                            {profile.status === 'pending' && (
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
                                disabled={isSaving}
                                onClick={() => handleCreateVenue(profile.user_id)}
                              >
                                {isSaving ? '...' : 'Crear venue en WP'}
                              </button>
                            )}
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

      {/* Modal crear usuario */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, marginBottom: 4 }}>Crear venue owner</div>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 24 }}>
              También puedes crear usuarios desde <strong>Supabase → Authentication → Users → Add user</strong>
            </div>
            <div className="alert alert-info" style={{ fontSize: 12, marginBottom: 16 }}>
              Tras crear el usuario tendrás que asignarle un venue desde la tabla.
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@venue.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Contraseña temporal</label>
              <input className="form-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreateUser as any} disabled={creatingUser}>
                {creatingUser ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

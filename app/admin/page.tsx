'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { Search, UserPlus } from 'lucide-react'

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
  const [filterStatus, setFilterStatus] = useState('all')
  const [assignVenue, setAssignVenue]   = useState<Record<string, string>>({})
  const [showModal, setShowModal] = useState(false)
  const [newEmail, setNewEmail]   = useState('')
  const [newPass, setNewPass]     = useState('')

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUserEmail(session.user.email || '')

      const { data: me } = await supabase
        .from('venue_profiles').select('role').eq('user_id', session.user.id).single()
      if (me?.role !== 'admin') { router.push('/dashboard'); return }

      const { data: all } = await supabase
        .from('venue_profiles').select('*').order('created_at', { ascending: false })
      if (all) setProfiles(all)

      // Cargar venues de WP — post type correcto: wedding-venues
      try {
        const res = await fetch(
          'https://weddingvenuesspain.com/wp-json/wp/v2/venues?per_page=100&acf_format=standard&_fields=id,title,acf,link',
          { cache: 'no-store' }
        )
        if (res.ok) {
          const data = await res.json()
          setWpVenues(Array.isArray(data) ? data : [])
        }
      } catch (e) {
        console.error('Error cargando venues WP:', e)
      }

      setLoading(false)
    }
    init()
  }, [router])

  const notify = (msg: string, isError = false) => {
    isError ? setError(msg) : setSuccess(msg)
    setTimeout(() => { setSuccess(''); setError('') }, 4000)
  }

  const handleAssign = async (userId: string) => {
    const wpId = assignVenue[userId]
    if (!wpId) { notify('Selecciona un venue primero', true); return }
    setSaving(userId)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('venue_profiles')
      .update({ wp_venue_id: parseInt(wpId), status: 'active' })
      .eq('user_id', userId)
    if (err) notify('Error al asignar', true)
    else {
      notify('Venue asignado correctamente')
      setProfiles(p => p.map(x => x.user_id === userId ? { ...x, wp_venue_id: parseInt(wpId), status: 'active' } : x))
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
      if (!res.ok) notify(data.message || 'Error al crear venue', true)
      else {
        notify(`Venue creado — WP ID ${data.wp_venue_id}`)
        setProfiles(p => p.map(x => x.user_id === userId ? { ...x, wp_venue_id: data.wp_venue_id, status: 'active' } : x))
      }
    } catch { notify('Error de conexión', true) }
    setSaving(null)
  }

  const handleToggle = async (userId: string, status: string) => {
    const next = status === 'active' ? 'inactive' : 'active'
    setSaving(userId + '-s')
    const supabase = createClient()
    await supabase.from('venue_profiles').update({ status: next }).eq('user_id', userId)
    setProfiles(p => p.map(x => x.user_id === userId ? { ...x, status: next } : x))
    setSaving(null)
  }

  const getVenueName = (id: number | null) => {
    if (!id) return null
    const v = wpVenues.find(v => v.id === id)
    return v ? (v.acf?.H1_Venue || v.title?.rendered || `WP #${id}`) : `WP #${id}`
  }

  const owners = profiles.filter(p => p.role !== 'admin')
  const filtered = owners.filter(p => {
    const matchS = filterStatus === 'all' || p.status === filterStatus
    const matchQ = !search || p.user_id.includes(search.toLowerCase()) || (p.wp_username || '').toLowerCase().includes(search.toLowerCase())
    return matchS && matchQ
  })

  const counts = {
    pending:  owners.filter(p => p.status === 'pending').length,
    active:   owners.filter(p => p.status === 'active').length,
    inactive: owners.filter(p => p.status === 'inactive').length,
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1A1512', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C4975A', fontFamily: 'serif', fontSize: 16 }}>Cargando...</div>
    </div>
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar venueName="Admin" userEmail={userEmail} />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Panel de administración</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="/admin/onboarding" className="btn btn-ghost btn-sm">Ver onboardings →</a>
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
              <UserPlus size={13} /> Nuevo usuario
            </button>
          </div>
        </div>

        <div className="page-content">
          {success && <div className="alert alert-success">{success}</div>}
          {error   && <div className="alert alert-error">{error}</div>}

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card accent">
              <div className="stat-label">Total venue owners</div>
              <div className="stat-value">{owners.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pendientes</div>
              <div className="stat-value" style={{ color: counts.pending > 0 ? 'var(--gold)' : undefined }}>{counts.pending}</div>
              <div className={`stat-sub ${counts.pending > 0 ? 'warn' : ''}`}>{counts.pending > 0 ? 'Requieren acción' : 'Al día ✓'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Activos</div>
              <div className="stat-value">{counts.active}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Venues en WP</div>
              <div className="stat-value">{wpVenues.length}</div>
              <div className="stat-sub">{wpVenues.length > 0 ? 'Cargados correctamente' : 'Sin cargar'}</div>
            </div>
          </div>

          {/* Tabla */}
          <div className="card">
            {/* Toolbar */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--ivory)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                <input
                  className="form-input"
                  style={{ paddingLeft: 28, fontSize: 12, padding: '7px 12px 7px 28px' }}
                  placeholder="Buscar por ID o usuario WP..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['all','Todos'], ['pending','Pendientes'], ['active','Activos'], ['inactive','Inactivos']].map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setFilterStatus(k)}
                    className={`btn btn-sm ${filterStatus === k ? 'btn-primary' : 'btn-ghost'}`}
                  >
                    {label}{k !== 'all' && ` (${counts[k as keyof typeof counts] ?? 0})`}
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
                      {search || filterStatus !== 'all' ? 'Sin resultados para este filtro' : 'No hay venue owners registrados todavía'}
                    </td></tr>
                  )}
                  {filtered.map(p => {
                    const vName = getVenueName(p.wp_venue_id)
                    const isSav = saving === p.user_id
                    const badgeMap: Record<string, string> = { active: 'badge-active', pending: 'badge-pending', inactive: 'badge-inactive' }
                    const labelMap: Record<string, string> = { active: 'Activo', pending: 'Pendiente', inactive: 'Inactivo' }
                    return (
                      <tr key={p.user_id}>
                        <td>
                          <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--charcoal)' }}>{p.user_id.slice(0, 8)}...</div>
                          {p.wp_username && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>WP: {p.wp_username}</div>}
                          <div style={{ fontSize: 10, color: 'var(--stone)', marginTop: 2 }}>{new Date(p.created_at).toLocaleDateString('es-ES')}</div>
                        </td>
                        <td><span className={`badge ${badgeMap[p.status] || ''}`}>{labelMap[p.status] || p.status}</span></td>
                        <td>
                          {vName
                            ? <div><div style={{ fontSize: 13, fontWeight: 500 }}>{vName}</div><div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>ID: {p.wp_venue_id}</div></div>
                            : <span style={{ color: 'var(--warm-gray)', fontSize: 12 }}>Sin asignar</span>
                          }
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <select
                              className="form-input"
                              style={{ fontSize: 12, padding: '5px 28px 5px 8px', maxWidth: 200, width: 'auto' }}
                              value={assignVenue[p.user_id] || ''}
                              onChange={e => setAssignVenue(prev => ({ ...prev, [p.user_id]: e.target.value }))}
                            >
                              <option value="">
                                {wpVenues.length === 0 ? 'Cargando venues...' : 'Selecciona venue...'}
                              </option>
                              {wpVenues.map(v => (
                                <option key={v.id} value={v.id}>
                                  {v.acf?.H1_Venue || v.title?.rendered} (#{v.id})
                                </option>
                              ))}
                            </select>
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={isSav || !assignVenue[p.user_id]}
                              onClick={() => handleAssign(p.user_id)}
                            >
                              {isSav ? '...' : 'Asignar'}
                            </button>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className={`btn btn-sm ${p.status === 'active' ? 'btn-danger' : 'btn-ghost'}`}
                              disabled={saving === p.user_id + '-s'}
                              onClick={() => handleToggle(p.user_id, p.status)}
                            >
                              {p.status === 'active' ? 'Desactivar' : 'Activar'}
                            </button>
                            {p.status === 'pending' && (
                              <button
                                className="btn btn-primary btn-sm"
                                disabled={isSav}
                                onClick={() => handleCreateVenue(p.user_id)}
                              >
                                {isSav ? '...' : 'Crear en WP'}
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

      {/* Modal nuevo usuario */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Crear venue owner</div>
            <div className="modal-sub">O créalo directamente en <strong>Supabase → Authentication → Users → Add user</strong></div>
            <div className="alert alert-info" style={{ fontSize: 12, marginBottom: 16 }}>
              Tras crear el usuario, asígnale un venue desde la tabla principal.
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@venue.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Contraseña temporal</label>
              <input className="form-input" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 8 caracteres" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => { notify('Crea el usuario desde Supabase → Authentication → Add user', true); setShowModal(false) }}>
                Ir a Supabase →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

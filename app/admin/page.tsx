'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

type Profile = {
  id: string
  user_id: string
  role: string
  status: string
  wp_venue_id: number | null
  wp_username: string | null
  created_at: string
  email?: string
}

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading]       = useState(true)
  const [profiles, setProfiles]     = useState<Profile[]>([])
  const [wpVenues, setWpVenues]     = useState<any[]>([])
  const [userEmail, setUserEmail]   = useState('')
  const [saving, setSaving]         = useState<string | null>(null)
  const [success, setSuccess]       = useState('')
  const [error, setError]           = useState('')

  // Estado para asignar venue manualmente
  const [assignVenue, setAssignVenue] = useState<Record<string, string>>({})

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUserEmail(session.user.email || '')

      // Verificar que es admin
      const { data: myProfile } = await supabase
        .from('venue_profiles')
        .select('role')
        .eq('user_id', session.user.id)
        .single()

      if (myProfile?.role !== 'admin') { router.push('/dashboard'); return }

      // Cargar todos los perfiles
      const { data: allProfiles } = await supabase
        .from('venue_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (allProfiles) {
        // Enriquecer con emails desde auth.users no es posible desde cliente,
        // usamos user_id como identificador
        setProfiles(allProfiles)
      }

      // Cargar venues de WordPress
      try {
        const res = await fetch(
          'https://weddingvenuesspain.com/wp-json/wp/v2/wedding-venues?per_page=100&acf_format=standard',
          { cache: 'no-store' }
        )
        if (res.ok) {
          const venues = await res.json()
          setWpVenues(venues)
        }
      } catch {}

      setLoading(false)
    }
    init()
  }, [router])

  // ── Asignar venue existente a un usuario ───────────────────────────────────
  const handleAssignVenue = async (userId: string) => {
    const wpVenueId = assignVenue[userId]
    if (!wpVenueId) { setError('Selecciona un venue primero'); return }

    setSaving(userId)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('venue_profiles')
      .update({ wp_venue_id: parseInt(wpVenueId), status: 'active' })
      .eq('user_id', userId)

    if (err) {
      setError('Error al asignar el venue')
    } else {
      setSuccess('Venue asignado correctamente')
      setProfiles(prev => prev.map(p =>
        p.user_id === userId ? { ...p, wp_venue_id: parseInt(wpVenueId), status: 'active' } : p
      ))
      setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(null)
  }

  // ── Crear venue nuevo en WP desde onboarding ──────────────────────────────
  const handleCreateVenue = async (userId: string) => {
    setSaving(userId)
    setError('')
    try {
      const res = await fetch('/api/venues/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_user_id: userId })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || data.error || 'Error al crear el venue')
      } else {
        setSuccess(`Venue creado en WordPress con ID ${data.wp_venue_id}`)
        setProfiles(prev => prev.map(p =>
          p.user_id === userId ? { ...p, wp_venue_id: data.wp_venue_id, status: 'active' } : p
        ))
        setTimeout(() => setSuccess(''), 4000)
      }
    } catch {
      setError('Error de conexión')
    }
    setSaving(null)
  }

  // ── Cambiar status de cuenta ───────────────────────────────────────────────
  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    setSaving(userId + '-status')
    const supabase = createClient()
    await supabase.from('venue_profiles').update({ status: newStatus }).eq('user_id', userId)
    setProfiles(prev => prev.map(p => p.user_id === userId ? { ...p, status: newStatus } : p))
    setSaving(null)
  }

  const getVenueName = (wpId: number | null) => {
    if (!wpId) return null
    const v = wpVenues.find(v => v.id === wpId)
    return v ? (v.acf?.H1_Venue || v.title?.rendered) : `WP #${wpId}`
  }

  const statusBadge = (status: string) => ({
    pending:  { bg: '#fef3c7', color: '#92400e', label: 'Pendiente' },
    active:   { bg: '#d1fae5', color: '#065f46', label: 'Activo' },
    inactive: { bg: '#fee2e2', color: '#991b1b', label: 'Inactivo' },
  }[status] || { bg: '#f3f4f6', color: '#374151', label: status })

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1A1512', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C4975A', fontFamily: 'serif' }}>Cargando...</div>
    </div>
  )

  const venueOwners = profiles.filter(p => p.role !== 'admin')
  const pending     = venueOwners.filter(p => p.status === 'pending')
  const active      = venueOwners.filter(p => p.status === 'active')
  const inactive    = venueOwners.filter(p => p.status === 'inactive')

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar venueName="Admin" userEmail={userEmail} />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Panel de administración</div>
          <a href="/admin/onboarding" className="btn btn-primary">Ver onboardings →</a>
        </div>
        <div className="page-content">

          {success && <div className="alert-success" style={{ marginBottom: 16 }}>{success}</div>}
          {error   && <div className="alert-error"   style={{ marginBottom: 16 }}>{error}</div>}

          {/* Stats rápidas */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-label">Total venues</div>
              <div className="stat-value">{venueOwners.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pendientes</div>
              <div className="stat-value" style={{ color: pending.length > 0 ? 'var(--gold)' : undefined }}>{pending.length}</div>
              <div className="stat-sub">{pending.length > 0 ? 'Requieren acción' : 'Al día ✓'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Activos</div>
              <div className="stat-value">{active.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Venues en WP</div>
              <div className="stat-value">{wpVenues.length}</div>
            </div>
          </div>

          {/* Tabla de usuarios */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Todos los venue owners</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--ivory)', background: 'var(--cream)' }}>
                    <th style={th}>Usuario</th>
                    <th style={th}>Estado</th>
                    <th style={th}>Venue asignado</th>
                    <th style={th}>Asignar venue existente</th>
                    <th style={th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {venueOwners.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--warm-gray)' }}>No hay venue owners registrados todavía</td></tr>
                  )}
                  {venueOwners.map(profile => {
                    const badge = statusBadge(profile.status)
                    const venueName = getVenueName(profile.wp_venue_id)
                    const isSaving = saving === profile.user_id
                    return (
                      <tr key={profile.user_id} style={{ borderBottom: '1px solid var(--ivory)' }}>
                        <td style={td}>
                          <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--warm-gray)' }}>
                            {profile.user_id.slice(0, 8)}...
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>
                            {profile.wp_username || 'Sin WP conectado'}
                          </div>
                        </td>
                        <td style={td}>
                          <span style={{ background: badge.bg, color: badge.color, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500 }}>
                            {badge.label}
                          </span>
                        </td>
                        <td style={td}>
                          {venueName ? (
                            <div>
                              <div style={{ fontWeight: 500 }}>{venueName}</div>
                              <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>WP ID: {profile.wp_venue_id}</div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--warm-gray)', fontSize: 12 }}>Sin asignar</span>
                          )}
                        </td>
                        <td style={td}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <select
                              className="form-input"
                              style={{ fontSize: 12, padding: '4px 8px', maxWidth: 180 }}
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
                              style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
                              disabled={isSaving || !assignVenue[profile.user_id]}
                              onClick={() => handleAssignVenue(profile.user_id)}
                            >
                              {isSaving ? '...' : 'Asignar'}
                            </button>
                          </div>
                        </td>
                        <td style={td}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-ghost"
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
    </div>
  )
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '10px 16px', fontSize: 11,
  fontWeight: 500, color: 'var(--warm-gray)', letterSpacing: '0.05em', textTransform: 'uppercase'
}
const td: React.CSSProperties = { padding: '12px 16px', verticalAlign: 'middle' }

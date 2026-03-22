'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { User, Lock, Bell } from 'lucide-react'

export default function PerfilPage() {
  const router = useRouter()
  const [user, setUser]       = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError]     = useState('')
  const [activeTab, setActiveTab] = useState('cuenta')

  // Cambiar contraseña
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass]         = useState('')
  const [confirmPass, setConfirmPass] = useState('')

  // WP credentials
  const [wpUser, setWpUser]   = useState('')
  const [wpPass, setWpPass]   = useState('')
  const [hasWpCreds, setHasWpCreds] = useState(false)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)

      const { data: prof } = await supabase
        .from('venue_profiles').select('*').eq('user_id', session.user.id).single()
      if (prof) { setProfile(prof); setHasWpCreds(!!prof.wp_username) }
      setLoading(false)
    }
    init()
  }, [router])

  const notify = (msg: string, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => { setSuccess(''); setError('') }, 4000)
  }

  const handleChangePassword = async () => {
    if (!newPass || newPass !== confirmPass) { notify('Las contraseñas no coinciden', true); return }
    if (newPass.length < 8) { notify('Mínimo 8 caracteres', true); return }
    setSaving(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password: newPass })
    if (err) notify('Error al cambiar la contraseña', true)
    else { notify('Contraseña actualizada correctamente'); setCurrentPass(''); setNewPass(''); setConfirmPass('') }
    setSaving(false)
  }

  const handleConnectWP = async () => {
    setSaving(true)
    try {
      const res = await fetch('https://weddingvenuesspain.com/wp-json/jwt-auth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: wpUser, password: wpPass })
      })
      const data = await res.json()
      if (data.token) {
        const supabase = createClient()
        await supabase.from('venue_profiles').update({ wp_username: wpUser, wp_token: data.token }).eq('user_id', user.id)
        setHasWpCreds(true)
        notify('Cuenta de WordPress conectada correctamente')
      } else {
        notify('Usuario o contraseña de WordPress incorrectos', true)
      }
    } catch { notify('Error al conectar con WordPress', true) }
    setSaving(false)
  }

  const handleDisconnectWP = async () => {
    if (!confirm('¿Desconectar tu cuenta de WordPress?')) return
    const supabase = createClient()
    await supabase.from('venue_profiles').update({ wp_username: null, wp_token: null }).eq('user_id', user.id)
    setHasWpCreds(false)
    setWpUser('')
    setWpPass('')
    notify('Cuenta de WordPress desconectada')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1A1512', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C4975A', fontFamily: 'serif' }}>Cargando...</div>
    </div>
  )

  const tabs = [
    { key: 'cuenta', label: 'Mi cuenta', icon: <User size={13} /> },
    { key: 'seguridad', label: 'Seguridad', icon: <Lock size={13} /> },
    { key: 'integraciones', label: 'Integraciones', icon: <Bell size={13} /> },
  ]

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar venueName="Mi Venue" userEmail={user?.email} />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Mi perfil</div>
        </div>
        <div className="page-content" style={{ maxWidth: 680 }}>
          {success && <div className="alert alert-success">{success}</div>}
          {error   && <div className="alert alert-error">{error}</div>}

          <div className="tabs">
            {tabs.map(t => (
              <div key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {t.icon} {t.label}
              </div>
            ))}
          </div>

          {/* Tab: Cuenta */}
          {activeTab === 'cuenta' && (
            <div className="card">
              <div className="card-header"><div className="card-title">Información de la cuenta</div></div>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '16px 0', borderBottom: '1px solid var(--ivory)' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cormorant Garamond, serif', fontSize: 20, color: '#fff' }}>
                    {user?.email?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--espresso)' }}>{user?.email}</div>
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>
                      {profile?.role === 'admin' ? 'Administrador' : 'Venue Owner'} · {profile?.status === 'active' ? 'Cuenta activa' : 'Cuenta pendiente'}
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" value={user?.email || ''} disabled style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>El email no se puede cambiar desde aquí.</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Venue asignado</label>
                  <input className="form-input" value={profile?.wp_venue_id ? `WordPress ID: ${profile.wp_venue_id}` : 'Sin venue asignado'} disabled style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Miembro desde</label>
                  <input className="form-input" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'} disabled style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                </div>
              </div>
            </div>
          )}

          {/* Tab: Seguridad */}
          {activeTab === 'seguridad' && (
            <div className="card">
              <div className="card-header"><div className="card-title">Cambiar contraseña</div></div>
              <div className="card-body">
                <div className="alert alert-info" style={{ marginBottom: 20 }}>
                  Por seguridad, te recomendamos usar una contraseña de al menos 12 caracteres con letras y números.
                </div>
                <div className="form-group">
                  <label className="form-label">Nueva contraseña</label>
                  <input className="form-input" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 8 caracteres" />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirmar nueva contraseña</label>
                  <input className="form-input" type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Repite la contraseña" />
                </div>
                <button className="btn btn-primary" onClick={handleChangePassword} disabled={saving || !newPass || !confirmPass}>
                  {saving ? 'Guardando...' : 'Cambiar contraseña'}
                </button>
              </div>
            </div>
          )}

          {/* Tab: Integraciones */}
          {activeTab === 'integraciones' && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">WordPress</div>
                {hasWpCreds && <span className="badge badge-active">Conectado</span>}
              </div>
              <div className="card-body">
                {hasWpCreds ? (
                  <>
                    <div className="alert alert-success" style={{ marginBottom: 16 }}>
                      Tu cuenta de WordPress está conectada como <strong>{profile?.wp_username}</strong>. Puedes editar tu ficha desde el portal.
                    </div>
                    <button className="btn btn-danger" onClick={handleDisconnectWP}>Desconectar WordPress</button>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 16 }}>
                      Conecta tu cuenta de WordPress para poder editar tu ficha directamente desde el portal.
                    </p>
                    <div className="two-col">
                      <div className="form-group">
                        <label className="form-label">Usuario WordPress</label>
                        <input className="form-input" value={wpUser} onChange={e => setWpUser(e.target.value)} placeholder="Tu usuario de WP" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Contraseña WordPress</label>
                        <input className="form-input" type="password" value={wpPass} onChange={e => setWpPass(e.target.value)} placeholder="Tu contraseña" />
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={handleConnectWP} disabled={saving || !wpUser || !wpPass}>
                      {saving ? 'Conectando...' : 'Conectar cuenta'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
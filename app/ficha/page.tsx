'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

export default function FichaPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [venue, setVenue] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('info')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Form state
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [wpPassword, setWpPassword] = useState('')
  const [wpUsername, setWpUsername] = useState('')
  const [hasWpCreds, setHasWpCreds] = useState(false)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)

      const { data: prof } = await supabase
        .from('venue_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (prof) {
        setProfile(prof)
        setHasWpCreds(!!prof.wp_username)
        if (prof.wp_venue_id) {
          const res = await fetch(`https://weddingvenuesspain.com/wp-json/wp/v2/venues/${prof.wp_venue_id}?acf_format=standard`)
          if (res.ok) {
            const data = await res.json()
            setVenue(data)
            setTitle(data.title?.rendered || '')
            setContent(data.content?.rendered?.replace(/<[^>]*>/g, '') || '')
          }
        }
      }
      setLoading(false)
    }
    init()
  }, [router])

  const saveWpCreds = async () => {
    setSaving(true)
    // Get JWT token from WordPress
    try {
      const res = await fetch('https://weddingvenuesspain.com/wp-json/jwt-auth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: wpUsername, password: wpPassword })
      })
      const data = await res.json()
      if (data.token) {
        const supabase = createClient()
        await supabase.from('venue_profiles').update({
          wp_username: wpUsername,
          wp_token: data.token
        }).eq('user_id', user.id)
        setHasWpCreds(true)
        setSuccess('Credenciales guardadas correctamente')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError('Usuario o contraseña de WordPress incorrectos')
      }
    } catch {
      setError('Error al conectar con WordPress')
    }
    setSaving(false)
  }

  const saveContent = async () => {
    if (!profile?.wp_venue_id) {
      setError('No tienes un venue asignado. Contacta con el administrador.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: prof } = await supabase
        .from('venue_profiles')
        .select('wp_token')
        .eq('user_id', user.id)
        .single()

      if (!prof?.wp_token) {
        setError('Necesitas configurar tus credenciales de WordPress primero.')
        setSaving(false)
        return
      }

      const res = await fetch(`https://weddingvenuesspain.com/wp-json/wp/v2/venues/${profile.wp_venue_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${prof.wp_token}`
        },
        body: JSON.stringify({ title, content })
      })

      if (res.ok) {
        setSuccess('¡Ficha actualizada en la web!')
        setTimeout(() => setSuccess(''), 4000)
      } else {
        const errData = await res.json()
        if (errData.code === 'jwt_auth_invalid_token') {
          setError('Tu sesión de WordPress ha expirado. Vuelve a introducir tus credenciales.')
          setHasWpCreds(false)
        } else {
          setError('Error al guardar. Verifica tus credenciales.')
        }
      }
    } catch {
      setError('Error de conexión con WordPress')
    }
    setSaving(false)
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#1A1512', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#C4975A', fontFamily: 'serif' }}>Cargando...</div></div>

  const photos = venue?.acf?.photo_gallery?.section_2_image?.[0] || []

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar venueName={venue?.title?.rendered} userEmail={user?.email} />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Mi ficha</div>
          {venue && (
            <a href={venue.link} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              Ver en la web ↗
            </a>
          )}
        </div>
        <div className="page-content">
          {success && <div className="alert-success">{success}</div>}
          {error && <div className="alert-error">{error}</div>}

          {/* WordPress credentials setup */}
          {!hasWpCreds && (
            <div className="card" style={{ marginBottom: '20px', borderColor: '#fde68a' }}>
              <div className="card-header" style={{ background: '#fffbeb' }}>
                <div className="card-title" style={{ fontSize: '15px' }}>⚡ Conecta tu cuenta de WordPress</div>
              </div>
              <div className="card-body">
                <p style={{ fontSize: '13px', color: 'var(--warm-gray)', marginBottom: '16px' }}>
                  Para poder editar tu ficha necesitas introducir tu usuario y contraseña de WordPress una sola vez.
                </p>
                <div className="two-col">
                  <div className="form-group">
                    <label className="form-label">Usuario WordPress</label>
                    <input className="form-input" value={wpUsername} onChange={e => setWpUsername(e.target.value)} placeholder="Tu usuario de WP" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contraseña WordPress</label>
                    <input className="form-input" type="password" value={wpPassword} onChange={e => setWpPassword(e.target.value)} placeholder="Tu contraseña de WP" />
                  </div>
                </div>
                <button className="btn btn-primary" onClick={saveWpCreds} disabled={saving}>
                  {saving ? 'Verificando...' : 'Conectar cuenta'}
                </button>
              </div>
            </div>
          )}

          {!profile?.wp_venue_id && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-body" style={{ textAlign: 'center', padding: '30px', color: 'var(--warm-gray)' }}>
                <div style={{ fontSize: '15px', marginBottom: '8px' }}>No tienes una ficha asignada</div>
                <div style={{ fontSize: '13px' }}>Contacta con el administrador de Wedding Venues Spain para vincular tu cuenta con tu ficha.</div>
              </div>
            </div>
          )}

          {profile?.wp_venue_id && (
            <>
              <div className="tabs">
                {['info', 'fotos'].map(tab => (
                  <div key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                    {tab === 'info' ? 'Información' : 'Fotos'}
                  </div>
                ))}
              </div>

              {activeTab === 'info' && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Información de tu venue</div>
                  </div>
                  <div className="card-body">
                    <div className="form-group">
                      <label className="form-label">Nombre del venue</label>
                      <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Descripción</label>
                      <textarea
                        className="form-textarea"
                        style={{ minHeight: '200px' }}
                        value={content}
                        onChange={e => setContent(e.target.value)}
                      />
                      <div style={{ fontSize: '11px', color: 'var(--warm-gray)', marginTop: '4px' }}>
                        Esta descripción aparece en tu ficha pública en weddingvenuesspain.com
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={saveContent} disabled={saving || !hasWpCreds}>
                      {saving ? 'Guardando...' : 'Guardar y publicar en la web'}
                    </button>
                    {!hasWpCreds && (
                      <span style={{ marginLeft: '12px', fontSize: '12px', color: 'var(--rose)' }}>
                        Conecta tu cuenta de WordPress primero
                      </span>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'fotos' && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Galería de fotos</div>
                    <span style={{ fontSize: '12px', color: 'var(--warm-gray)' }}>
                      Para añadir o cambiar fotos, hazlo desde el panel de WordPress
                    </span>
                  </div>
                  <div className="card-body">
                    {photos.length > 0 ? (
                      <div className="photo-grid">
                        {photos.map((photo: any, i: number) => (
                          <div key={i} className="photo-thumb">
                            <img src={photo.thumbnail_image_url || photo.full_image_url} alt={photo.alt_text || ''} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '30px', color: 'var(--warm-gray)', fontSize: '13px' }}>
                        No hay fotos en tu ficha todavía.
                      </div>
                    )}
                    <div style={{ marginTop: '16px', padding: '14px', background: 'var(--ivory)', borderRadius: '6px', fontSize: '12.5px', color: 'var(--warm-gray)' }}>
                      💡 Para gestionar las fotos de tu galería, accede al panel de administración de WordPress y edita tu ficha directamente. Pronto podrás hacerlo desde aquí.
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

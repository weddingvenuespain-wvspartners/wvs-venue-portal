'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { ACCOMMODATION_OPTIONS, VENUE_PRICE_OPTIONS } from '@/lib/wordpress'

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Tab = 'info' | 'descripcion' | 'precios' | 'ubicacion' | 'fotos'

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FichaPage() {
  const router = useRouter()
  const [user, setUser]       = useState<any>(null)
  const [venue, setVenue]     = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('info')
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError]     = useState('')

  // WP credentials
  const [wpUsername, setWpUsername] = useState('')
  const [wpPassword, setWpPassword] = useState('')
  const [hasWpCreds, setHasWpCreds] = useState(false)

  // ── Campos ACF ──────────────────────────────────────────────────────────────

  // Tab: Info principal
  const [H1_Venue, setH1_Venue]               = useState('')
  const [location, setLocation]               = useState('')
  const [Short_Description, setShort_Description] = useState('')
  const [accommodation, setAccommodation]     = useState('')
  const [Min_Nights_of_Venue, setVenuePrice]  = useState('')

  // Tab: Descripción
  const [miniDescription, setMiniDescription] = useState('')
  const [postContent, setPostContent]         = useState('')

  // Tab: Precios
  const [venue_starting_price, setMenuPrice]  = useState('')
  const [Capacity_of_Venue, setCapacity]      = useState('')
  const [breakdown1, setBreakdown1]           = useState('')
  const [breakdown1text, setBreakdown1text]   = useState('')
  const [breakdown3, setBreakdown3]           = useState('')
  const [breakdown3text, setBreakdown3text]   = useState('')
  const [breakdown3lunch, setBreakdown3lunch] = useState('')
  const [breakdown3social, setBreakdown3social] = useState('')
  const [breakdown4, setBreakdown4]           = useState('')
  const [breakdown4text, setBreakdown4text]   = useState('')

  // Tab: Ubicación
  const [specificLocation, setSpecificLocation] = useState('')
  const [placesNearby, setPlacesNearby]         = useState('')
  const [closestAirport, setClosestAirport]     = useState('')

  // Tab: Fotos
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoSlot, setPhotoSlot]           = useState<string | null>(null)
  // Galerías horizontales: array de 8 posiciones con {id, url} o null
  const [hGallery, setHGallery] = useState<(null | { id: number; url: string })[]>(Array(8).fill(null))
  // Galería vertical (section_2_image) — solo visualización por ahora
  const [verticalGallery, setVerticalGallery] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Carga inicial ────────────────────────────────────────────────────────────
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
          const res = await fetch(
            `https://weddingvenuesspain.com/wp-json/wp/v2/wedding-venues/${prof.wp_venue_id}?acf_format=standard`,
            { cache: 'no-store' }
          )
          if (res.ok) {
            const data = await res.json()
            setVenue(data)
            populateFields(data)
          }
        }
      }
      setLoading(false)
    }
    init()
  }, [router])

  function populateFields(data: any) {
    const acf = data.acf || {}

    // Info
    setH1_Venue(acf.H1_Venue || data.title?.rendered || '')
    setLocation(acf.location || '')
    setShort_Description(acf.Short_Description_of_Venue || '')
    setAccommodation(acf.accommodation || '')
    setVenuePrice(acf.Min_Nights_of_Venue || '')

    // Descripción
    setMiniDescription(acf['h2-Venue_and_mini_description'] || '')
    setPostContent(acf.start_of_post_content || '')

    // Precios
    setMenuPrice(acf.venue_starting_price || '')
    setCapacity(acf.Capacity_of_Venue || '')
    setBreakdown1(acf.starting_price_breakdown1 || '')
    setBreakdown1text(acf.starting_price_breakdown_text_area_1 || '')
    setBreakdown3(acf.starting_price_breakdown_3 || '')
    setBreakdown3text(acf.starting_price_breakdown_text_area_3 || '')
    setBreakdown3lunch(acf.Starting_Price_Breakdown_3_LunchDinner_text_area || '')
    setBreakdown3social(acf.starting_price_breakdown_text_area_5 || '')
    setBreakdown4(acf.starting_price_breakdown_4 || '')
    setBreakdown4text(acf.starting_price_breakdown_text_area_4 || '')

    // Ubicación
    setSpecificLocation(acf.Specific_Location || '')
    setPlacesNearby(acf.Places_Nearby || '')
    setClosestAirport(acf.Closest_Airport_to_Venue || '')

    // Fotos — galería horizontal (8 imágenes individuales)
    const hFields = [
      'h2_gallery','h2_gallery_copy','h2_gallery_copy2','h2_gallery_copy3',
      'h2_gallery_copy4','h2_gallery_copy5','h2_gallery_copy6','h2_gallery_copy7'
    ]
    const loaded = hFields.map(f => {
      const img = acf[f]
      if (!img) return null
      if (typeof img === 'number') return { id: img, url: '' }
      if (img.url) return { id: img.id, url: img.url }
      if (img.sizes?.large) return { id: img.id, url: img.sizes.large }
      return null
    })
    setHGallery(loaded)

    // Galería vertical
    const vg = acf.photo_gallery?.section_2_image?.[0] || acf.section_2_image || []
    setVerticalGallery(Array.isArray(vg) ? vg : [])
  }

  // ── Conectar credenciales WP ─────────────────────────────────────────────────
  const saveWpCreds = async () => {
    setSaving(true)
    setError('')
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
        setSuccess('Cuenta de WordPress conectada correctamente')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError('Usuario o contraseña de WordPress incorrectos')
      }
    } catch {
      setError('Error al conectar con WordPress')
    }
    setSaving(false)
  }

  // ── Guardar campos via API Route ─────────────────────────────────────────────
  const save = async (fields: Record<string, any>) => {
    if (!profile?.wp_venue_id) {
      setError('No tienes un venue asignado.')
      return false
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/venues/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'token_expired') {
          setError('Tu sesión de WordPress ha expirado. Vuelve a conectar tu cuenta.')
          setHasWpCreds(false)
        } else {
          setError(data.message || 'Error al guardar')
        }
        setSaving(false)
        return false
      }
      setSuccess('¡Cambios guardados y publicados en la web!')
      setTimeout(() => setSuccess(''), 4000)
      setSaving(false)
      return true
    } catch {
      setError('Error de conexión')
      setSaving(false)
      return false
    }
  }

  const saveInfo        = () => save({ H1_Venue, title: H1_Venue, location, Short_Description_of_Venue: Short_Description, accommodation, Min_Nights_of_Venue })
  const saveDescripcion = () => save({ 'h2-Venue_and_mini_description': miniDescription, start_of_post_content: postContent, content: postContent })
  const savePrecios     = () => save({
    venue_starting_price, Capacity_of_Venue,
    starting_price_breakdown1: breakdown1, starting_price_breakdown_text_area_1: breakdown1text,
    starting_price_breakdown_3: breakdown3, starting_price_breakdown_text_area_3: breakdown3text,
    Starting_Price_Breakdown_3_LunchDinner_text_area: breakdown3lunch,
    starting_price_breakdown_text_area_5: breakdown3social,
    starting_price_breakdown_4: breakdown4, starting_price_breakdown_text_area_4: breakdown4text,
  })
  const saveUbicacion   = () => save({ Specific_Location: specificLocation, Places_Nearby: placesNearby, Closest_Airport_to_Venue: closestAirport })

  const saveHGallery = () => {
    const hFields = [
      'h2_gallery','h2_gallery_copy','h2_gallery_copy2','h2_gallery_copy3',
      'h2_gallery_copy4','h2_gallery_copy5','h2_gallery_copy6','h2_gallery_copy7'
    ]
    const fields: Record<string, any> = {}
    hFields.forEach((f, i) => { fields[f] = hGallery[i]?.id || '' })
    save(fields)
  }

  // ── Subir foto ───────────────────────────────────────────────────────────────
  const uploadPhoto = async (file: File, slotIndex: number) => {
    setUploadingPhoto(true)
    setPhotoSlot(`Subiendo foto ${slotIndex + 1}...`)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || data.error || 'Error al subir la imagen')
        return
      }
      const newGallery = [...hGallery]
      newGallery[slotIndex] = { id: data.id, url: data.url }
      setHGallery(newGallery)
      setSuccess(`Foto ${slotIndex + 1} subida. Recuerda guardar la galería.`)
      setTimeout(() => setSuccess(''), 4000)
    } catch {
      setError('Error al subir la imagen')
    } finally {
      setUploadingPhoto(false)
      setPhotoSlot(null)
    }
  }

  const removeHGallerySlot = (i: number) => {
    const newGallery = [...hGallery]
    newGallery[i] = null
    setHGallery(newGallery)
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1A1512', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C4975A', fontFamily: 'serif' }}>Cargando...</div>
    </div>
  )

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info',        label: 'Info principal' },
    { key: 'descripcion', label: 'Descripción' },
    { key: 'precios',     label: 'Precios' },
    { key: 'ubicacion',   label: 'Ubicación' },
    { key: 'fotos',       label: 'Fotos' },
  ]

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar venueName={venue?.acf?.H1_Venue || venue?.title?.rendered} userEmail={user?.email} />
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

          {success && <div className="alert-success" style={{ marginBottom: 16 }}>{success}</div>}
          {error   && <div className="alert-error"   style={{ marginBottom: 16 }}>{error}</div>}

          {/* Conectar WP */}
          {!hasWpCreds && (
            <div className="card" style={{ marginBottom: 20, borderColor: '#fde68a' }}>
              <div className="card-header" style={{ background: '#fffbeb' }}>
                <div className="card-title" style={{ fontSize: 15 }}>Conecta tu cuenta de WordPress</div>
              </div>
              <div className="card-body">
                <p style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 16 }}>
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

          {/* Sin venue asignado */}
          {!profile?.wp_venue_id && (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--warm-gray)' }}>
                <div style={{ fontSize: 15, marginBottom: 8 }}>No tienes una ficha asignada</div>
                <div style={{ fontSize: 13 }}>El administrador de Wedding Venues Spain vinculará tu cuenta con tu venue.</div>
              </div>
            </div>
          )}

          {/* Contenido principal */}
          {profile?.wp_venue_id && (
            <>
              <div className="tabs">
                {tabs.map(t => (
                  <div key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
                    {t.label}
                  </div>
                ))}
              </div>

              {/* ── TAB: Info principal ── */}
              {activeTab === 'info' && (
                <div className="card">
                  <div className="card-header"><div className="card-title">Información principal</div></div>
                  <div className="card-body">
                    <div className="form-group">
                      <label className="form-label">Nombre del venue</label>
                      <input className="form-input" value={H1_Venue} onChange={e => setH1_Venue(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Ubicación (ciudad o región)</label>
                      <input className="form-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="Ej: Mallorca, Ibiza..." />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Descripción corta</label>
                      <textarea className="form-textarea" style={{ minHeight: 120 }} value={Short_Description} onChange={e => setShort_Description(e.target.value)} placeholder="Breve descripción que aparece en el encabezado de la ficha" />
                    </div>
                    <div className="two-col">
                      <div className="form-group">
                        <label className="form-label">Alojamiento</label>
                        <select className="form-input" value={accommodation} onChange={e => setAccommodation(e.target.value)}>
                          <option value="">Selecciona...</option>
                          {ACCOMMODATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Rango de precio del venue</label>
                        <select className="form-input" value={Min_Nights_of_Venue} onChange={e => setVenuePrice(e.target.value)}>
                          <option value="">Selecciona...</option>
                          {VENUE_PRICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <SaveButton onClick={saveInfo} saving={saving} hasWpCreds={hasWpCreds} />
                  </div>
                </div>
              )}

              {/* ── TAB: Descripción ── */}
              {activeTab === 'descripcion' && (
                <div className="card">
                  <div className="card-header"><div className="card-title">Descripción del venue</div></div>
                  <div className="card-body">
                    <div className="form-group">
                      <label className="form-label">Mini descripción (sección 2)</label>
                      <textarea className="form-textarea" style={{ minHeight: 100 }} value={miniDescription} onChange={e => setMiniDescription(e.target.value)} placeholder="Texto corto que aparece junto a la galería vertical" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Descripción completa</label>
                      <textarea className="form-textarea" style={{ minHeight: 300 }} value={postContent} onChange={e => setPostContent(e.target.value)} placeholder="Descripción completa del venue. Puedes usar HTML básico." />
                      <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>
                        Esta es la descripción principal que aparece en la ficha pública.
                      </div>
                    </div>
                    <SaveButton onClick={saveDescripcion} saving={saving} hasWpCreds={hasWpCreds} />
                  </div>
                </div>
              )}

              {/* ── TAB: Precios ── */}
              {activeTab === 'precios' && (
                <div className="card">
                  <div className="card-header"><div className="card-title">Precios y capacidad</div></div>
                  <div className="card-body">
                    <div className="two-col">
                      <div className="form-group">
                        <label className="form-label">Precio de menú desde</label>
                        <input className="form-input" value={venue_starting_price} onChange={e => setMenuPrice(e.target.value)} placeholder="Ej: 120€ por persona" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Capacidad</label>
                        <input className="form-input" value={Capacity_of_Venue} onChange={e => setCapacity(e.target.value)} placeholder="Ej: hasta 200 invitados" />
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--ivory)', margin: '20px 0', paddingTop: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14, color: 'var(--charcoal)' }}>Desglose 1 — Venue + Wedding Planner</div>
                      <div className="form-group">
                        <label className="form-label">Título / precio</label>
                        <input className="form-input" value={breakdown1} onChange={e => setBreakdown1(e.target.value)} placeholder="Ej: Desde 5.000€" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Descripción</label>
                        <textarea className="form-textarea" style={{ minHeight: 80 }} value={breakdown1text} onChange={e => setBreakdown1text(e.target.value)} />
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--ivory)', margin: '20px 0', paddingTop: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14, color: 'var(--charcoal)' }}>Desglose 3 — Catering y bebidas</div>
                      <div className="form-group">
                        <label className="form-label">Título / precio recepción</label>
                        <input className="form-input" value={breakdown3} onChange={e => setBreakdown3(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Texto recepción</label>
                        <textarea className="form-textarea" style={{ minHeight: 80 }} value={breakdown3text} onChange={e => setBreakdown3text(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Texto comida / cena</label>
                        <textarea className="form-textarea" style={{ minHeight: 80 }} value={breakdown3lunch} onChange={e => setBreakdown3lunch(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Opciones sociales</label>
                        <textarea className="form-textarea" style={{ minHeight: 80 }} value={breakdown3social} onChange={e => setBreakdown3social(e.target.value)} />
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--ivory)', margin: '20px 0', paddingTop: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14, color: 'var(--charcoal)' }}>Desglose 4 — Alojamiento</div>
                      <div className="form-group">
                        <label className="form-label">Título / precio alojamiento</label>
                        <input className="form-input" value={breakdown4} onChange={e => setBreakdown4(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Descripción alojamiento</label>
                        <textarea className="form-textarea" style={{ minHeight: 80 }} value={breakdown4text} onChange={e => setBreakdown4text(e.target.value)} />
                      </div>
                    </div>

                    <SaveButton onClick={savePrecios} saving={saving} hasWpCreds={hasWpCreds} />
                  </div>
                </div>
              )}

              {/* ── TAB: Ubicación ── */}
              {activeTab === 'ubicacion' && (
                <div className="card">
                  <div className="card-header"><div className="card-title">Ubicación y acceso</div></div>
                  <div className="card-body">
                    <div className="form-group">
                      <label className="form-label">Ubicación específica</label>
                      <textarea className="form-textarea" style={{ minHeight: 100 }} value={specificLocation} onChange={e => setSpecificLocation(e.target.value)} placeholder="Dirección o descripción de la ubicación" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Lugares cercanos</label>
                      <textarea className="form-textarea" style={{ minHeight: 100 }} value={placesNearby} onChange={e => setPlacesNearby(e.target.value)} placeholder="Pueblos, atracciones o puntos de interés cercanos" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Aeropuerto más cercano</label>
                      <textarea className="form-textarea" style={{ minHeight: 80 }} value={closestAirport} onChange={e => setClosestAirport(e.target.value)} placeholder="Ej: Aeropuerto de Palma de Mallorca, 45 min" />
                    </div>
                    <SaveButton onClick={saveUbicacion} saving={saving} hasWpCreds={hasWpCreds} />
                  </div>
                </div>
              )}

              {/* ── TAB: Fotos ── */}
              {activeTab === 'fotos' && (
                <>
                  {/* Galería horizontal (editable) */}
                  <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header">
                      <div className="card-title">Galería horizontal (hasta 8 fotos)</div>
                      <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Slider que aparece en la sección 3 de tu ficha</span>
                    </div>
                    <div className="card-body">
                      {uploadingPhoto && (
                        <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--gold)' }}>{photoSlot}</div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                        {hGallery.map((photo, i) => (
                          <div key={i} style={{ aspectRatio: '4/3', borderRadius: 8, overflow: 'hidden', border: '2px dashed var(--ivory)', position: 'relative', background: 'var(--cream)', cursor: 'pointer' }}>
                            {photo ? (
                              <>
                                <img src={photo.url} alt={`Foto ${i+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <button
                                  onClick={() => removeHGallerySlot(i)}
                                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 4, width: 24, height: 24, cursor: 'pointer', fontSize: 12 }}
                                >✕</button>
                              </>
                            ) : (
                              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', cursor: 'pointer', gap: 6 }}>
                                <span style={{ fontSize: 22, color: 'var(--stone)' }}>+</span>
                                <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Foto {i+1}</span>
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                                  const f = e.target.files?.[0]
                                  if (f) uploadPhoto(f, i)
                                }} />
                              </label>
                            )}
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 16 }}>
                        Haz clic en una casilla vacía para subir una foto. Máximo 10MB por imagen (JPG, PNG, WEBP).
                      </div>
                      <SaveButton onClick={saveHGallery} saving={saving} hasWpCreds={hasWpCreds} label="Guardar galería" />
                    </div>
                  </div>

                  {/* Galería vertical — solo visualización */}
                  <div className="card">
                    <div className="card-header">
                      <div className="card-title">Galería vertical y galería final</div>
                      <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Gestiona estas galerías desde WordPress</span>
                    </div>
                    <div className="card-body">
                      {verticalGallery.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                          {verticalGallery.map((photo: any, i: number) => (
                            <div key={i} style={{ aspectRatio: '4/3', borderRadius: 8, overflow: 'hidden' }}>
                              <img src={photo.thumbnail_image_url || photo.full_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--warm-gray)', fontSize: 13 }}>No hay fotos en esta galería todavía.</div>
                      )}
                      <div style={{ marginTop: 16, padding: 14, background: 'var(--ivory)', borderRadius: 6, fontSize: 12.5, color: 'var(--warm-gray)' }}>
                        Para gestionar la galería vertical y la galería final accede al panel de WordPress. Pronto podrás hacerlo desde aquí.
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Botón guardar reutilizable ───────────────────────────────────────────────
function SaveButton({ onClick, saving, hasWpCreds, label = 'Guardar y publicar en la web' }: {
  onClick: () => void
  saving: boolean
  hasWpCreds: boolean
  label?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
      <button className="btn btn-primary" onClick={onClick} disabled={saving || !hasWpCreds}>
        {saving ? 'Guardando...' : label}
      </button>
      {!hasWpCreds && (
        <span style={{ fontSize: 12, color: 'var(--rose)' }}>Conecta tu cuenta de WordPress primero</span>
      )}
    </div>
  )
}

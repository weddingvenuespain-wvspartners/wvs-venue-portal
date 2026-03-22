'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

type Step = 1 | 2 | 3 | 4

export default function OnboardingPage() {
  const router = useRouter()
  const [user, setUser]       = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep]       = useState<Step>(1)
  const [saving, setSaving]   = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError]     = useState('')

  // Paso 1 — Info básica
  const [name, setName]           = useState('')
  const [shortBio, setShortBio]   = useState('')
  const [description, setDescription] = useState('')

  // Paso 2 — Ubicación
  const [city, setCity]       = useState('')
  const [region, setRegion]   = useState('')
  const [country, setCountry] = useState('Spain')
  const [address, setAddress] = useState('')

  // Paso 3 — Detalles
  const [capacityMin, setCapacityMin] = useState('')
  const [capacityMax, setCapacityMax] = useState('')
  const [priceMin, setPriceMin]       = useState('')
  const [priceMax, setPriceMax]       = useState('')
  const [priceNotes, setPriceNotes]   = useState('')
  const [accommodation, setAccommodation] = useState('')

  // Paso 4 — Contacto
  const [contactName, setContactName]   = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [website, setWebsite]           = useState('')

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

      setProfile(prof)

      // Si ya tiene venue asignado, redirigir a ficha
      if (prof?.wp_venue_id) { router.push('/ficha'); return }

      // Cargar borrador existente si lo hay
      const { data: onb } = await supabase
        .from('venue_onboarding')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (onb) {
        setName(onb.name || '')
        setShortBio(onb.short_bio || '')
        setDescription(onb.description || '')
        setCity(onb.city || '')
        setRegion(onb.region || '')
        setCountry(onb.country || 'Spain')
        setAddress(onb.address || '')
        setCapacityMin(onb.capacity_min?.toString() || '')
        setCapacityMax(onb.capacity_max?.toString() || '')
        setPriceMin(onb.price_min?.toString() || '')
        setPriceMax(onb.price_max?.toString() || '')
        setPriceNotes(onb.price_notes || '')
        setAccommodation(onb.accommodation || '')
        setContactName(onb.contact_name || '')
        setContactEmail(onb.contact_email || '')
        setContactPhone(onb.contact_phone || '')
        setWebsite(onb.website || '')
        if (onb.status === 'submitted') setSubmitted(true)
      }

      setLoading(false)
    }
    init()
  }, [router])

  const saveStep = async (status: 'draft' | 'submitted' = 'draft') => {
    setSaving(true)
    setError('')
    const supabase = createClient()
    const data = {
      user_id: user.id,
      name, short_bio: shortBio, description,
      city, region, country, address,
      capacity_min: capacityMin ? parseInt(capacityMin) : null,
      capacity_max: capacityMax ? parseInt(capacityMax) : null,
      price_min: priceMin ? parseInt(priceMin) : null,
      price_max: priceMax ? parseInt(priceMax) : null,
      price_notes: priceNotes, accommodation,
      contact_name: contactName, contact_email: contactEmail,
      contact_phone: contactPhone, website,
      status,
      ...(status === 'submitted' ? { submitted_at: new Date().toISOString() } : {}),
    }

    const { error: err } = await supabase
      .from('venue_onboarding')
      .upsert(data, { onConflict: 'user_id' })

    if (err) {
      setError('Error al guardar. Inténtalo de nuevo.')
    } else if (status === 'submitted') {
      setSubmitted(true)
    }
    setSaving(false)
  }

  const nextStep = async () => {
    await saveStep('draft')
    if (step < 4) setStep((step + 1) as Step)
  }

  const handleSubmit = async () => {
    if (!name || !city || !contactEmail) {
      setError('Por favor rellena al menos el nombre del venue, la ciudad y tu email de contacto.')
      return
    }
    await saveStep('submitted')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1A1512', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C4975A', fontFamily: 'serif' }}>Cargando...</div>
    </div>
  )

  if (submitted) return (
    <div style={{ display: 'flex' }}>
      <Sidebar venueName="Mi Venue" userEmail={user?.email} />
      <div className="main-layout">
        <div className="topbar"><div className="topbar-title">Bienvenido</div></div>
        <div className="page-content">
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, marginBottom: 12, color: 'var(--espresso)' }}>
                Solicitud enviada
              </div>
              <div style={{ fontSize: 14, color: 'var(--warm-gray)', maxWidth: 400, margin: '0 auto' }}>
                Hemos recibido la información de tu venue. El equipo de Wedding Venues Spain la revisará y te avisará cuando esté lista tu ficha.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const steps = [
    { n: 1, label: 'Tu venue' },
    { n: 2, label: 'Ubicación' },
    { n: 3, label: 'Detalles' },
    { n: 4, label: 'Contacto' },
  ]

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar venueName="Mi Venue" userEmail={user?.email} />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Registra tu venue</div>
        </div>
        <div className="page-content">

          {error && <div className="alert-error" style={{ marginBottom: 16 }}>{error}</div>}

          {/* Stepper */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 28, alignItems: 'center' }}>
            {steps.map((s, i) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 500,
                  background: step === s.n ? 'var(--gold)' : step > s.n ? 'var(--sage)' : 'var(--ivory)',
                  color: step >= s.n ? '#fff' : 'var(--warm-gray)',
                }}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span style={{ fontSize: 12, color: step === s.n ? 'var(--charcoal)' : 'var(--warm-gray)' }}>{s.label}</span>
                {i < steps.length - 1 && <div style={{ width: 24, height: 1, background: 'var(--ivory)', margin: '0 4px' }} />}
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-body">

              {/* Paso 1 */}
              {step === 1 && (
                <>
                  <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 20 }}>Cuéntanos sobre tu venue</div>
                  <div className="form-group">
                    <label className="form-label">Nombre del venue *</label>
                    <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Finca Son Term" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descripción corta</label>
                    <textarea className="form-textarea" style={{ minHeight: 80 }} value={shortBio} onChange={e => setShortBio(e.target.value)} placeholder="Una frase que capture la esencia de tu venue" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descripción completa</label>
                    <textarea className="form-textarea" style={{ minHeight: 180 }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe tu venue: espacios, estilo, qué lo hace único..." />
                  </div>
                </>
              )}

              {/* Paso 2 */}
              {step === 2 && (
                <>
                  <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 20 }}>¿Dónde está tu venue?</div>
                  <div className="two-col">
                    <div className="form-group">
                      <label className="form-label">Ciudad *</label>
                      <input className="form-input" value={city} onChange={e => setCity(e.target.value)} placeholder="Ej: Palma de Mallorca" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Región / Isla</label>
                      <input className="form-input" value={region} onChange={e => setRegion(e.target.value)} placeholder="Ej: Mallorca, Ibiza, Andalucía..." />
                    </div>
                  </div>
                  <div className="two-col">
                    <div className="form-group">
                      <label className="form-label">País</label>
                      <input className="form-input" value={country} onChange={e => setCountry(e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dirección o descripción de acceso</label>
                    <textarea className="form-textarea" style={{ minHeight: 80 }} value={address} onChange={e => setAddress(e.target.value)} placeholder="Dirección completa o indicaciones de cómo llegar" />
                  </div>
                </>
              )}

              {/* Paso 3 */}
              {step === 3 && (
                <>
                  <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 20 }}>Capacidad y precios</div>
                  <div className="two-col">
                    <div className="form-group">
                      <label className="form-label">Capacidad mínima</label>
                      <input className="form-input" type="number" value={capacityMin} onChange={e => setCapacityMin(e.target.value)} placeholder="Ej: 50" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Capacidad máxima</label>
                      <input className="form-input" type="number" value={capacityMax} onChange={e => setCapacityMax(e.target.value)} placeholder="Ej: 300" />
                    </div>
                  </div>
                  <div className="two-col">
                    <div className="form-group">
                      <label className="form-label">Precio desde (€)</label>
                      <input className="form-input" type="number" value={priceMin} onChange={e => setPriceMin(e.target.value)} placeholder="Ej: 5000" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Precio hasta (€)</label>
                      <input className="form-input" type="number" value={priceMax} onChange={e => setPriceMax(e.target.value)} placeholder="Ej: 30000" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notas sobre precios</label>
                    <textarea className="form-textarea" style={{ minHeight: 80 }} value={priceNotes} onChange={e => setPriceNotes(e.target.value)} placeholder="Ej: precio incluye catering, mínimo de noches, etc." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alojamiento</label>
                    <select className="form-input" value={accommodation} onChange={e => setAccommodation(e.target.value)}>
                      <option value="">Selecciona...</option>
                      <option value="yes">Sí, incluye alojamiento</option>
                      <option value="no">No incluye alojamiento</option>
                      <option value="optional">Alojamiento opcional</option>
                    </select>
                  </div>
                </>
              )}

              {/* Paso 4 */}
              {step === 4 && (
                <>
                  <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 20 }}>Datos de contacto</div>
                  <div className="two-col">
                    <div className="form-group">
                      <label className="form-label">Nombre de contacto</label>
                      <input className="form-input" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Tu nombre" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email de contacto *</label>
                      <input className="form-input" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="email@tuvenue.com" />
                    </div>
                  </div>
                  <div className="two-col">
                    <div className="form-group">
                      <label className="form-label">Teléfono</label>
                      <input className="form-input" type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+34 600 000 000" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Web actual (si tienes)</label>
                      <input className="form-input" type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://tuvenue.com" />
                    </div>
                  </div>
                  <div style={{ marginTop: 8, padding: 14, background: 'var(--ivory)', borderRadius: 6, fontSize: 12.5, color: 'var(--warm-gray)' }}>
                    Al enviar esta información, el equipo de Wedding Venues Spain revisará tu venue y creará tu ficha en la web. Te avisaremos por email cuando esté lista.
                  </div>
                </>
              )}

              {/* Navegación */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--ivory)' }}>
                {step > 1 ? (
                  <button className="btn btn-ghost" onClick={() => setStep((step - 1) as Step)} disabled={saving}>
                    ← Anterior
                  </button>
                ) : <div />}

                {step < 4 ? (
                  <button className="btn btn-primary" onClick={nextStep} disabled={saving}>
                    {saving ? 'Guardando...' : 'Siguiente →'}
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                    {saving ? 'Enviando...' : 'Enviar solicitud'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

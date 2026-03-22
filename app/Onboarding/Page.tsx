'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

type Step = 1 | 2 | 3 | 4

const emptyForm = {
  name: '', short_bio: '', description: '',
  city: '', region: '', country: 'Spain', address: '',
  capacity_min: '', capacity_max: '',
  price_min: '', price_max: '', price_notes: '',
  accommodation: '',
  contact_name: '', contact_email: '', contact_phone: '', website: '',
}

export default function OnboardingPage() {
  const router = useRouter()
  const [user, setUser]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep]       = useState<Step>(1)
  const [saving, setSaving]   = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError]     = useState('')
  const [form, setForm]       = useState(emptyForm)
  const [venueName, setVenueName] = useState('')

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)

      const { data: prof } = await supabase
        .from('venue_profiles').select('*').eq('user_id', session.user.id).single()

      if (prof?.wp_venue_id) { router.push('/dashboard'); return }

      const { data: onb } = await supabase
        .from('venue_onboarding').select('*').eq('user_id', session.user.id).single()

      if (onb) {
        if (onb.status === 'submitted' || onb.status === 'approved') { router.push('/dashboard'); return }
        setForm({
          name: onb.name || '', short_bio: onb.short_bio || '', description: onb.description || '',
          city: onb.city || '', region: onb.region || '', country: onb.country || 'Spain', address: onb.address || '',
          capacity_min: onb.capacity_min?.toString() || '', capacity_max: onb.capacity_max?.toString() || '',
          price_min: onb.price_min?.toString() || '', price_max: onb.price_max?.toString() || '',
          price_notes: onb.price_notes || '', accommodation: onb.accommodation || '',
          contact_name: onb.contact_name || '', contact_email: onb.contact_email || '',
          contact_phone: onb.contact_phone || '', website: onb.website || '',
        })
      }
      setLoading(false)
    }
    init()
  }, [router])

  const saveToSupabase = async (status: 'draft' | 'submitted') => {
    const supabase = createClient()
    const data = {
      user_id: user.id,
      name: form.name, short_bio: form.short_bio, description: form.description,
      city: form.city, region: form.region, country: form.country, address: form.address,
      capacity_min: form.capacity_min ? parseInt(form.capacity_min) : null,
      capacity_max: form.capacity_max ? parseInt(form.capacity_max) : null,
      price_min: form.price_min ? parseInt(form.price_min) : null,
      price_max: form.price_max ? parseInt(form.price_max) : null,
      price_notes: form.price_notes, accommodation: form.accommodation,
      contact_name: form.contact_name, contact_email: form.contact_email,
      contact_phone: form.contact_phone, website: form.website,
      status,
      ...(status === 'submitted' ? { submitted_at: new Date().toISOString() } : {}),
    }
    const { error } = await supabase.from('venue_onboarding').upsert(data, { onConflict: 'user_id' })
    return !error
  }

  const nextStep = async () => {
    setSaving(true)
    await saveToSupabase('draft')
    setStep(s => Math.min(s + 1, 4) as Step)
    setSaving(false)
  }

  const prevStep = () => setStep(s => Math.max(s - 1, 1) as Step)

  const handleSubmit = async () => {
    if (!form.name || !form.city || !form.contact_email) {
      setError('Por favor rellena al menos el nombre del venue, la ciudad y tu email de contacto.')
      return
    }
    setSaving(true)
    setError('')
    const ok = await saveToSupabase('submitted')
    if (ok) {
      setVenueName(form.name)
      setSubmitted(true)
    } else {
      setError('Error al enviar. Inténtalo de nuevo.')
    }
    setSaving(false)
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
        <div className="topbar"><div className="topbar-title">Registro completado</div></div>
        <div className="page-content" style={{ maxWidth: 540, margin: '48px auto' }}>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 22 }}>✓</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, marginBottom: 12 }}>Solicitud enviada</div>
              <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.8 }}>
                Hemos recibido la información de <strong>{venueName}</strong>. Nuestro equipo la revisará y te avisará cuando tu ficha esté lista en Wedding Venues Spain.
              </div>
              <div style={{ marginTop: 24, fontSize: 12, color: 'var(--stone)' }}>Tiempo estimado: 24–48 horas</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const steps = [
    { n: 1, label: 'Tu venue' },
    { n: 2, label: 'Ubicación' },
    { n: 3, label: 'Precios' },
    { n: 4, label: 'Contacto' },
  ]

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar venueName="Mi Venue" userEmail={user?.email} />
      <div className="main-layout">
        <div className="topbar"><div className="topbar-title">Registra tu venue</div></div>
        <div className="page-content" style={{ maxWidth: 640, margin: '0 auto' }}>

          {error && <div className="alert alert-error">{error}</div>}

          {/* Stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
            {steps.map((s, i) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 500, flexShrink: 0,
                  background: step === s.n ? 'var(--gold)' : step > s.n ? '#d1fae5' : 'var(--ivory)',
                  color: step === s.n ? '#fff' : step > s.n ? '#065f46' : 'var(--warm-gray)',
                }}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span style={{ fontSize: 12, color: step === s.n ? 'var(--charcoal)' : 'var(--warm-gray)', fontWeight: step === s.n ? 500 : 400 }}>
                  {s.label}
                </span>
                {i < steps.length - 1 && <div style={{ width: 32, height: 1, background: 'var(--ivory)', margin: '0 4px' }} />}
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-body">

              {/* Paso 1 — Info del venue */}
              {step === 1 && (
                <>
                  <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 20, color: 'var(--espresso)' }}>Cuéntanos sobre tu venue</div>
                  <div className="form-group">
                    <label className="form-label">Nombre del venue *</label>
                    <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Finca Son Term" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descripción corta</label>
                    <textarea className="form-textarea" style={{ minHeight: 80 }} value={form.short_bio} onChange={e => set('short_bio', e.target.value)} placeholder="Una frase que capture la esencia de tu venue" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descripción completa</label>
                    <textarea className="form-textarea" style={{ minHeight: 180 }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe tu venue: espacios, estilo, qué lo hace único, servicios incluidos..." />
                  </div>
                </>
              )}

              {/* Paso 2 — Ubicación */}
              {step === 2 && (
                <>
                  <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 20 }}>¿Dónde está tu venue?</div>
                  <div className="two-col">
                    <div className="form-group">
                      <label className="form-label">Ciudad / Municipio *</label>
                      <input className="form-input" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Ej: Palma de Mallorca" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Región / Isla</label>
                      <input className="form-input" value={form.region} onChange={e => set('region', e.target.value)} placeholder="Ej: Mallorca, Ibiza, Andalucía..." />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dirección o descripción de acceso</label>
                    <textarea className="form-textarea" style={{ minHeight: 80 }} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Dirección completa o cómo llegar al venue" />
                  </div>
                </>
              )}

              {/* Paso 3 — Precios y capacidad */}
              {step === 3 && (
                <>
                  <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 20 }}>Capacidad y precios</div>
                  <div className="two-col">
                    <div className="form-group">
                      <label className="form-label">Capacidad mínima</label>
                      <input className="form-input" type="number" value={form.capacity_min} onChange={e => set('capacity_min', e.target.value)} placeholder="Ej: 50" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Capacidad máxima</label>
                      <input className="form-input" type="number" value={form.capacity_max} onChange={e => set('capacity_max', e.target.value)} placeholder="Ej: 300" />
                    </div>
                  </div>
                  <div className="two-col">
                    <div className="form-group">
                      <label className="form-label">Precio desde (€)</label>
                      <input className="form-input" type="number" value={form.price_min} onChange={e => set('price_min', e.target.value)} placeholder="5000" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Precio hasta (€)</label>
                      <input className="form-input" type="number" value={form.price_max} onChange={e => set('price_max', e.target.value)} placeholder="30000" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notas sobre precios</label>
                    <textarea className="form-textarea" style={{ minHeight: 80 }} value={form.price_notes} onChange={e => set('price_notes', e.target.value)} placeholder="Ej: precio incluye catering, mínimo 2 noches, etc." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alojamiento</label>
                    <select className="form-input" value={form.accommodation} onChange={e => set('accommodation', e.target.value)}>
                      <option value="">Selecciona...</option>
                      <option value="yes">Sí, incluye alojamiento</option>
                      <option value="no">No incluye alojamiento</option>
                      <option value="optional">Alojamiento opcional</option>
                    </select>
                  </div>
                </>
              )}

              {/* Paso 4 — Contacto */}
              {step === 4 && (
                <>
                  <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 20 }}>Datos de contacto</div>
                  <div className="two-col">
                    <div className="form-group">
                      <label className="form-label">Nombre de contacto</label>
                      <input className="form-input" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="Tu nombre" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email de contacto *</label>
                      <input className="form-input" type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="email@tuvenue.com" />
                    </div>
                  </div>
                  <div className="two-col">
                    <div className="form-group">
                      <label className="form-label">Teléfono</label>
                      <input className="form-input" type="tel" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="+34 600 000 000" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Web actual (si tienes)</label>
                      <input className="form-input" type="url" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://tuvenue.com" />
                    </div>
                  </div>
                  <div className="alert alert-info" style={{ marginTop: 8 }}>
                    Al enviar, el equipo de Wedding Venues Spain revisará tu venue y creará tu ficha. Te avisaremos por email cuando esté lista.
                  </div>
                </>
              )}

              {/* Navegación */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--ivory)' }}>
                {step > 1
                  ? <button className="btn btn-ghost" onClick={prevStep} disabled={saving}>← Anterior</button>
                  : <div />
                }
                {step < 4
                  ? <button className="btn btn-primary" onClick={nextStep} disabled={saving}>{saving ? 'Guardando...' : 'Siguiente →'}</button>
                  : <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Enviando...' : 'Enviar solicitud'}</button>
                }
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'var(--warm-gray)' }}>
            Tu progreso se guarda automáticamente. Puedes cerrar y continuar más tarde.
          </div>
        </div>
      </div>
    </div>
  )
}

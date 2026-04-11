'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase'
import { Check, ArrowRight, Building2, MapPin, Globe, FileText, Users, CalendarDays, BarChart2, ChevronRight } from 'lucide-react'

const REGIONS = [
  'Andalucía', 'Aragón', 'Asturias', 'Baleares', 'Canarias', 'Cantabria',
  'Castilla-La Mancha', 'Castilla y León', 'Cataluña', 'Ceuta', 'Comunidad de Madrid',
  'Comunidad Valenciana', 'Extremadura', 'Galicia', 'La Rioja', 'Melilla', 'Murcia',
  'Navarra', 'País Vasco',
]

const VENUE_TYPES = ['Finca', 'Hotel', 'Castillo / Palacio', 'Jardín / Exterior', 'Masía', 'Otro']

export default function OnboardingPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [step, setStep]       = useState(1)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  // Step 1
  const [venueName, setVenueName] = useState('')
  const [region, setRegion]       = useState('')

  // Step 2
  const [venueType, setVenueType] = useState('')
  const [capacity, setCapacity]   = useState('')
  const [venueWeb, setVenueWeb]   = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!authLoading && profile && profile.display_name) router.replace('/dashboard')
  }, [authLoading, profile, router])

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!venueName.trim()) { setError('Escribe el nombre de tu venue'); return }
    if (!region) { setError('Selecciona una comunidad autónoma'); return }
    setError('')
    setSaving(true)
    try {
      const supabase = createClient()
      const { error: err } = await supabase
        .from('venue_profiles')
        .upsert(
          {
            user_id:           user!.id,
            display_name:      venueName.trim(),
            company:           venueName.trim(),
            region,
            role:              'partner',
            status:            'active',
            timezone:          'Europe/Madrid',
            language:          'es',
            date_format:       'DD/MM/YYYY',
            marketing_consent: false,
            features_override: {},
            updated_at:        new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
      if (err) throw err
      setStep(2)
    } catch (e: any) {
      setError(e?.message || 'Error al guardar. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const supabase = createClient()
      const updates: Record<string, unknown> = {
        user_id:    user!.id,
        updated_at: new Date().toISOString(),
      }
      if (venueType)        updates.venue_type    = venueType
      if (capacity)         updates.capacity      = parseInt(capacity, 10)
      if (venueWeb.trim())  updates.venue_website = venueWeb.trim()
      await supabase.from('venue_profiles').upsert(updates, { onConflict: 'user_id' })
    } catch {
      // Non-critical, continue anyway
    } finally {
      setSaving(false)
      setStep(3)
    }
  }

  if (authLoading || !user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--cream)' }}>
        <div style={{ width: 24, height: 24, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, color: 'var(--gold)', letterSpacing: '0.06em', fontWeight: 500 }}>
            Wedding Venues Spain
          </div>
          <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>Partner Portal</div>
        </div>

        {/* Step indicator */}
        {step < 3 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
            {[1, 2].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 600, fontFamily: 'Manrope, sans-serif',
                  background: s < step ? 'var(--gold)' : s === step ? 'var(--charcoal)' : 'var(--ivory)',
                  color: s < step ? '#fff' : s === step ? '#fff' : 'var(--warm-gray)',
                  border: s === step ? '2px solid var(--charcoal)' : '2px solid transparent',
                }}>
                  {s < step ? <Check size={13} strokeWidth={2.5} /> : s}
                </div>
                {s < 2 && <div style={{ width: 32, height: 1, background: s < step ? 'var(--gold)' : 'var(--ivory)' }} />}
              </div>
            ))}
          </div>
        )}

        {/* ── Step 1: Nombre + región ── */}
        {step === 1 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>
              ¡Bienvenido/a! 👋
            </h1>
            <p style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 28 }}>
              Cuéntanos lo básico sobre tu venue para empezar.
            </p>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleStep1}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 6 }}>
                Nombre del venue
              </label>
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <Building2 size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                <input
                  type="text" placeholder="Ej: Hacienda El Olivar"
                  value={venueName} onChange={e => setVenueName(e.target.value)} required
                  style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 8, border: '1px solid var(--ivory)', background: 'var(--cream)', fontSize: 14, color: 'var(--charcoal)', outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }}
                />
              </div>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 6 }}>
                Comunidad autónoma
              </label>
              <div style={{ position: 'relative', marginBottom: 28 }}>
                <MapPin size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)', pointerEvents: 'none' }} />
                <select value={region} onChange={e => setRegion(e.target.value)} required
                  style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 8, border: '1px solid var(--ivory)', background: 'var(--cream)', fontSize: 14, color: region ? 'var(--charcoal)' : 'var(--warm-gray)', outline: 'none', fontFamily: 'Manrope, sans-serif', cursor: 'pointer', appearance: 'none', boxSizing: 'border-box' }}
                >
                  <option value="" disabled>Selecciona una región</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <ChevronRight size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%) rotate(90deg)', color: 'var(--warm-gray)', pointerEvents: 'none' }} />
              </div>

              <button type="submit" disabled={saving}
                style={{ width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', background: 'var(--charcoal)', color: '#fff', fontSize: 14, fontWeight: 500, fontFamily: 'Manrope, sans-serif', cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s' }}
              >
                {saving ? 'Guardando...' : <>Continuar <ArrowRight size={15} /></>}
              </button>
            </form>
          </div>
        )}

        {/* ── Step 2: Tipo + aforo + web ── */}
        {step === 2 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>
              Un poco más sobre tu espacio
            </h1>
            <p style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 28 }}>
              Opcional — puedes completarlo después desde tu perfil.
            </p>

            <form onSubmit={handleStep2}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 8 }}>
                Tipo de venue
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                {VENUE_TYPES.map(type => (
                  <button key={type} type="button" onClick={() => setVenueType(venueType === type ? '' : type)}
                    style={{ padding: '9px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', transition: 'all 0.15s', border: venueType === type ? '2px solid var(--gold)' : '1px solid var(--ivory)', background: venueType === type ? 'rgba(196,151,90,0.08)' : 'var(--cream)', color: venueType === type ? 'var(--gold)' : 'var(--charcoal)', fontWeight: venueType === type ? 500 : 400 }}
                  >{type}</button>
                ))}
              </div>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 6 }}>
                Aforo máximo de invitados
              </label>
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <Users size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                <input
                  type="number" placeholder="Ej: 200" value={capacity}
                  onChange={e => setCapacity(e.target.value)} min="1" max="5000"
                  style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 8, border: '1px solid var(--ivory)', background: 'var(--cream)', fontSize: 14, color: 'var(--charcoal)', outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }}
                />
              </div>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 6 }}>
                Web del venue
              </label>
              <div style={{ position: 'relative', marginBottom: 28 }}>
                <Globe size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                <input
                  type="url" placeholder="Ej: https://tuvenue.com" value={venueWeb}
                  onChange={e => setVenueWeb(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 8, border: '1px solid var(--ivory)', background: 'var(--cream)', fontSize: 14, color: 'var(--charcoal)', outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }}
                />
              </div>

              <button type="submit" disabled={saving}
                style={{ width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', background: 'var(--charcoal)', color: '#fff', fontSize: 14, fontWeight: 500, fontFamily: 'Manrope, sans-serif', cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s' }}
              >
                {saving ? 'Guardando...' : <>Continuar <ArrowRight size={15} /></>}
              </button>
              <button type="button" onClick={() => setStep(3)}
                style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', background: 'none', color: 'var(--warm-gray)', fontSize: 13, cursor: 'pointer', marginTop: 8, fontFamily: 'Manrope, sans-serif' }}
              >
                Omitir por ahora
              </button>
            </form>
          </div>
        )}

        {/* ── Step 3: ¡Todo listo! ── */}
        {step === 3 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '40px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(196,151,90,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Check size={28} color="var(--gold)" strokeWidth={2.5} />
            </div>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 8 }}>
              ¡Todo listo! 🎉
            </h1>
            <p style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 32, lineHeight: 1.6 }}>
              Tu espacio está configurado. Ahora puedes completar tu ficha, gestionar leads y mucho más.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {[
                { icon: <FileText size={16} />, label: 'Completar mi ficha', sub: 'Añade fotos, descripción y precios', href: '/ficha' },
                { icon: <Users size={16} />, label: 'Ver mis leads', sub: 'Gestiona solicitudes de bodas', href: '/leads' },
                { icon: <CalendarDays size={16} />, label: 'Calendario', sub: 'Marca disponibilidad y fechas', href: '/calendario' },
                { icon: <BarChart2 size={16} />, label: 'Estadísticas', sub: 'Métricas de tu venue', href: '/estadisticas' },
              ].map(item => (
                <button key={item.href} onClick={() => router.push(item.href)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, border: '1px solid var(--ivory)', background: 'var(--cream)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: 'Manrope, sans-serif' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(196,151,90,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)' }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{item.sub}</div>
                  </div>
                  <ChevronRight size={14} color="var(--warm-gray)" />
                </button>
              ))}
            </div>

            <button onClick={() => router.push('/dashboard')}
              style={{ width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', background: 'var(--gold)', color: '#fff', fontSize: 14, fontWeight: 500, fontFamily: 'Manrope, sans-serif', cursor: 'pointer' }}
            >
              Ir al dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

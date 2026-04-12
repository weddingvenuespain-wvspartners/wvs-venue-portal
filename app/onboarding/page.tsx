'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase'
import { Check, ArrowRight, Building2, MapPin, Globe, Phone, User } from 'lucide-react'

const VENUE_TYPES = ['Finca', 'Hotel', 'Castillo / Palacio', 'Jardín / Exterior', 'Masía', 'Otro']

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px 10px 34px', borderRadius: 8,
  border: '1px solid var(--ivory)', background: 'var(--cream)',
  fontSize: 14, color: 'var(--charcoal)', outline: 'none',
  fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500,
  color: 'var(--charcoal)', marginBottom: 6,
}

export default function OnboardingPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [step, setStep]     = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Step 1 — El venue
  const [venueName, setVenueName] = useState('')
  const [venueType, setVenueType] = useState('')
  const [city, setCity]           = useState('')

  // Step 2 — El contacto
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [phone, setPhone]         = useState('')
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
    if (!venueType)        { setError('Selecciona el tipo de venue'); return }
    if (!city.trim())      { setError('Escribe la ciudad donde está tu venue'); return }
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
            venue_type:        venueType,
            city:              city.trim(),
            role:              'venue_owner',
            status:            'pending_verification',
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

  const normalizeUrl = (url: string) => {
    const u = url.trim()
    if (!u) return ''
    if (/^https?:\/\//i.test(u)) return u
    return 'https://' + u
  }

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim()) { setError('Escribe tu nombre'); return }
    if (!lastName.trim())  { setError('Escribe tus apellidos'); return }
    if (!phone.trim())     { setError('Escribe un teléfono de contacto'); return }
    if (!venueWeb.trim())  { setError('Escribe la web de tu venue'); return }
    setError('')
    setSaving(true)
    try {
      const supabase = createClient()
      const { error: err } = await supabase
        .from('venue_profiles')
        .upsert(
          {
            user_id:      user!.id,
            first_name:   firstName.trim(),
            last_name:    lastName.trim(),
            phone:        phone.trim(),
            venue_website: normalizeUrl(venueWeb),
            updated_at:   new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
      if (err) throw err
      router.replace('/pricing')
    } catch (e: any) {
      setError(e?.message || 'Error al guardar. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
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

        {/* ── Step 1: El venue ── */}
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
              {/* Nombre del venue */}
              <label style={labelStyle}>Nombre del venue</label>
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <Building2 size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                <input type="text" placeholder="Ej: Hacienda El Olivar"
                  value={venueName} onChange={e => setVenueName(e.target.value)}
                  style={inputStyle} />
              </div>

              {/* Tipo de venue */}
              <label style={labelStyle}>Tipo de venue</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                {VENUE_TYPES.map(type => (
                  <button key={type} type="button" onClick={() => setVenueType(type)}
                    style={{
                      padding: '9px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                      fontFamily: 'Manrope, sans-serif', transition: 'all 0.15s', textAlign: 'left',
                      border: venueType === type ? '2px solid var(--gold)' : '1px solid var(--ivory)',
                      background: venueType === type ? 'rgba(196,151,90,0.08)' : 'var(--cream)',
                      color: venueType === type ? 'var(--gold)' : 'var(--charcoal)',
                      fontWeight: venueType === type ? 600 : 400,
                    }}
                  >{type}</button>
                ))}
              </div>

              {/* Ciudad */}
              <label style={labelStyle}>Ciudad</label>
              <div style={{ position: 'relative', marginBottom: 28 }}>
                <MapPin size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                <input type="text" placeholder="Ej: Sevilla"
                  value={city} onChange={e => setCity(e.target.value)}
                  style={inputStyle} />
              </div>

              <button type="submit" disabled={saving}
                style={{ width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', background: 'var(--charcoal)', color: '#fff', fontSize: 14, fontWeight: 500, fontFamily: 'Manrope, sans-serif', cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s' }}
              >
                {saving ? 'Guardando...' : <>Continuar <ArrowRight size={15} /></>}
              </button>
            </form>
          </div>
        )}

        {/* ── Step 2: El contacto ── */}
        {step === 2 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>
              Datos de contacto
            </h1>
            <p style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 28 }}>
              Necesitamos estos datos para verificar tu venue en 24–48h.
            </p>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleStep2}>
              {/* Nombre + Apellidos en grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle}>Nombre</label>
                  <div style={{ position: 'relative' }}>
                    <User size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                    <input type="text" placeholder="María"
                      value={firstName} onChange={e => setFirstName(e.target.value)}
                      style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Apellidos</label>
                  <div style={{ position: 'relative' }}>
                    <User size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                    <input type="text" placeholder="García López"
                      value={lastName} onChange={e => setLastName(e.target.value)}
                      style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* Teléfono */}
              <label style={labelStyle}>Teléfono de contacto</label>
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <Phone size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                <input type="tel" placeholder="+34 612 345 678"
                  value={phone} onChange={e => setPhone(e.target.value)}
                  style={inputStyle} />
              </div>

              {/* Web */}
              <label style={labelStyle}>Web del venue</label>
              <div style={{ position: 'relative', marginBottom: 28 }}>
                <Globe size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                <input type="text" placeholder="www.tuvenue.com"
                  value={venueWeb} onChange={e => setVenueWeb(e.target.value)}
                  style={inputStyle} />
              </div>

              <button type="submit" disabled={saving}
                style={{ width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', background: 'var(--charcoal)', color: '#fff', fontSize: 14, fontWeight: 500, fontFamily: 'Manrope, sans-serif', cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s' }}
              >
                {saving ? 'Guardando...' : <>Finalizar <Check size={15} /></>}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}

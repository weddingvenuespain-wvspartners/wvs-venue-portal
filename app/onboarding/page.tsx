'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase'
import { Check, ArrowRight, Building2, MapPin, Globe, Phone, User, Loader2, CalendarHeart, UtensilsCrossed } from 'lucide-react'

type AccountType = 'venue_owner' | 'wedding_planner' | 'catering'

const VENUE_TYPES    = ['Finca', 'Hotel', 'Castillo / Palacio', 'Jardín / Exterior', 'Masía', 'Otro']
const CATERING_TYPES = ['Cocina española', 'Cocina mediterránea', 'Cocina internacional', 'Alta cocina', 'Food truck', 'Otro']

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

function resolveAccountType(user: any): AccountType {
  const meta = user?.user_metadata?.account_type as AccountType | undefined
  if (meta && ['venue_owner', 'wedding_planner', 'catering'].includes(meta)) return meta
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('wvs_account_type') as AccountType | null
    if (stored && ['venue_owner', 'wedding_planner', 'catering'].includes(stored)) {
      localStorage.removeItem('wvs_account_type')
      return stored
    }
  }
  return 'venue_owner'
}

function dashboardForRole(role: AccountType) {
  if (role === 'wedding_planner') return '/wp'
  if (role === 'catering') return '/catering'
  return '/dashboard'
}

export default function OnboardingPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [step, setStep]         = useState(1)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [accountType, setAccountType] = useState<AccountType>('venue_owner')

  // Step 1 fields
  const [companyName, setCompanyName] = useState('')
  const [typeSelection, setTypeSelection] = useState('')
  const [city, setCity] = useState('')

  // Step 2 fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [phone, setPhone]         = useState('')
  const [website, setWebsite]     = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    const type = resolveAccountType(user)
    setAccountType(type)
    // Planners and caterings skip onboarding — redirect straight to their portal
    if (type === 'wedding_planner' || type === 'catering') {
      router.replace(dashboardForRole(type))
    }
  }, [user]) // eslint-disable-line

  useEffect(() => {
    if (!authLoading && profile) {
      // Also redirect by saved role (e.g. returning user already has profile)
      if (profile.role === 'wedding_planner' || profile.role === 'catering') {
        router.replace(dashboardForRole(profile.role as AccountType))
        return
      }
      if (profile.display_name && profile.first_name) {
        router.replace(dashboardForRole(profile.role as AccountType))
      }
      if (profile.display_name && !profile.first_name) {
        setStep(2)
      }
    }
  }, [authLoading, profile, router])

  const normalizeUrl = (url: string) => {
    const u = url.trim()
    if (!u) return ''
    if (/^https?:\/\//i.test(u)) return u
    return 'https://' + u
  }

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim()) { setError('Escribe el nombre'); return }
    if (!typeSelection)      { setError('Selecciona el tipo'); return }
    if (!city.trim())        { setError('Escribe la ciudad'); return }
    setError('')
    setSaving(true)
    try {
      const supabase = createClient()
      const { error: err } = await supabase.from('venue_profiles').upsert(
        {
          user_id:           user!.id,
          display_name:      companyName.trim(),
          company:           companyName.trim(),
          venue_type:        typeSelection,
          city:              city.trim(),
          role:              accountType,
          status:            'pending',
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
    if (!firstName.trim()) { setError('Escribe tu nombre'); return }
    if (!lastName.trim())  { setError('Escribe tus apellidos'); return }
    if (!phone.trim())     { setError('Escribe un teléfono de contacto'); return }
    setError('')
    setSaving(true)
    try {
      const supabase = createClient()
      const { error: err } = await supabase.from('venue_profiles').upsert(
        {
          user_id:       user!.id,
          first_name:    firstName.trim(),
          last_name:     lastName.trim(),
          phone:         phone.trim(),
          venue_website: normalizeUrl(website),
          updated_at:    new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      if (err) throw err

      // Only venue_owner gets auto-trial for now; planners/caterings go through manual approval
      if (accountType === 'venue_owner') {
        const trialRes = await fetch('/api/onboarding/complete', { method: 'POST' })
        if (!trialRes.ok) {
          const { error: trialErr } = await trialRes.json()
          throw new Error(trialErr || 'Error al activar el período de prueba')
        }
      }

      router.replace(dashboardForRole(accountType))
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

  const roleLabel = accountType === 'wedding_planner' ? 'Wedding Planner'
    : accountType === 'catering' ? 'Catering'
    : 'Venue'

  const RoleIcon = accountType === 'wedding_planner' ? CalendarHeart
    : accountType === 'catering' ? UtensilsCrossed
    : Building2

  const typeOptions = accountType === 'catering' ? CATERING_TYPES : VENUE_TYPES

  const step1Title = accountType === 'wedding_planner' ? 'Tu agencia o nombre profesional'
    : accountType === 'catering' ? 'Tu empresa de catering'
    : '¡Bienvenido/a! 👋'

  const step1Sub = accountType === 'wedding_planner'
    ? 'Cuéntanos lo básico sobre tu actividad.'
    : accountType === 'catering'
    ? 'Cuéntanos lo básico sobre tu empresa.'
    : 'Cuéntanos lo básico sobre tu venue para empezar.'

  const namePlaceholder = accountType === 'wedding_planner' ? 'Ej: Bodas con Alma'
    : accountType === 'catering' ? 'Ej: Catering El Olivo'
    : 'Ej: Hacienda El Olivar'

  const typeLabel = accountType === 'catering' ? 'Tipo de cocina' : 'Tipo de venue'

  const websiteLabel = accountType === 'wedding_planner' ? 'Tu web profesional (opcional)'
    : accountType === 'catering' ? 'Web de tu empresa (opcional)'
    : 'Web del venue'

  const websitePlaceholder = accountType === 'venue_owner' ? 'www.tuvenue.com' : 'www.tuempresa.com'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, color: 'var(--gold)', letterSpacing: '0.06em', fontWeight: 500 }}>
            Wedding Venues Spain
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 4 }}>
            <RoleIcon size={13} style={{ color: 'var(--warm-gray)' }} />
            <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{roleLabel} Portal</span>
          </div>
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

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>
              {step1Title}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 28 }}>{step1Sub}</p>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleStep1}>
              <label style={labelStyle}>Nombre</label>
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <RoleIcon size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                <input type="text" placeholder={namePlaceholder}
                  value={companyName} onChange={e => setCompanyName(e.target.value)}
                  style={inputStyle} />
              </div>

              <label style={labelStyle}>{typeLabel}</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                {typeOptions.map(type => {
                  const selected = typeSelection === type
                  return (
                    <button key={type} type="button" onClick={() => setTypeSelection(type)}
                      onMouseOver={e => { if (!selected) { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.background = 'rgba(196,151,90,0.04)' } }}
                      onMouseOut={e => { if (!selected) { e.currentTarget.style.borderColor = 'var(--ivory)'; e.currentTarget.style.background = 'var(--cream)' } }}
                      style={{
                        padding: '9px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                        fontFamily: 'Manrope, sans-serif', transition: 'all 0.15s', textAlign: 'left',
                        border: selected ? '2px solid var(--gold)' : '2px solid var(--ivory)',
                        background: selected ? 'rgba(196,151,90,0.08)' : 'var(--cream)',
                        color: selected ? 'var(--gold)' : 'var(--charcoal)',
                        fontWeight: selected ? 600 : 400,
                      }}
                    >{type}</button>
                  )
                })}
              </div>

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
                {saving ? <><Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Guardando...</> : <>Continuar <ArrowRight size={15} /></>}
              </button>
            </form>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>
              Datos de contacto
            </h1>
            <p style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 28 }}>
              {accountType === 'venue_owner'
                ? 'Necesitamos estos datos para verificar tu venue en 24–48h.'
                : 'Necesitamos estos datos para verificar tu cuenta en 24–48h.'}
            </p>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleStep2}>
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

              <label style={labelStyle}>Teléfono de contacto</label>
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <Phone size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                <input type="tel" placeholder="+34 612 345 678"
                  value={phone} onChange={e => setPhone(e.target.value)}
                  style={inputStyle} />
              </div>

              <label style={labelStyle}>{websiteLabel}</label>
              <div style={{ position: 'relative', marginBottom: 28 }}>
                <Globe size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                <input type="text" placeholder={websitePlaceholder}
                  value={website} onChange={e => setWebsite(e.target.value)}
                  style={inputStyle}
                  required={accountType === 'venue_owner'}
                />
              </div>

              {(accountType === 'wedding_planner' || accountType === 'catering') && (
                <div style={{ background: 'rgba(196,151,90,0.06)', border: '1px solid rgba(196,151,90,0.15)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 20, lineHeight: 1.5 }}>
                  Tu solicitud será revisada en 24–48h. Recibirás un email cuando tu cuenta esté activa.
                </div>
              )}

              <button type="submit" disabled={saving}
                style={{ width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', background: 'var(--charcoal)', color: '#fff', fontSize: 14, fontWeight: 500, fontFamily: 'Manrope, sans-serif', cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s' }}
              >
                {saving ? <><Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Guardando...</> : <>Finalizar <Check size={15} /></>}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}

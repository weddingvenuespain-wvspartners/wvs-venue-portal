'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Check, Building2, CalendarHeart, UtensilsCrossed, Inbox, FileText, CalendarCheck } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { AuthHero, AuthBrand, GradientWord } from '@/components/auth/AuthHero'
import { AuthField, PasswordField, AuthCheckbox, AuthCta, AuthDivider, GoogleButton, TrustBadges, AuthBanner } from '@/components/auth/fields'
import { MailIcon, LockIcon } from '@/components/auth/icons'
import { translateAuthError, isDuplicateUserError } from '@/components/auth/errors'
import { GOLD_TEXT } from '@/components/auth/theme'

type AccountType = 'venue_owner' | 'wedding_planner' | 'catering'

const ACCOUNT_TYPES: { type: AccountType; label: string; sub: string; icon: React.ReactNode }[] = [
  { type: 'venue_owner',     label: 'Venue / Finca',   sub: 'Gestionas bodas en tu espacio',       icon: <Building2 size={18} /> },
  { type: 'wedding_planner', label: 'Wedding Planner', sub: 'Organizas bodas para tus clientes',   icon: <CalendarHeart size={18} /> },
  { type: 'catering',        label: 'Catering',        sub: 'Ofreces servicio de comida y bebida', icon: <UtensilsCrossed size={18} /> },
]

// 0 = under minimum, 1-3 = weak/ok/strong
function passwordScore(pw: string): number {
  if (pw.length < 8) return 0
  let score = 1
  if (pw.length >= 11 && /\d/.test(pw)) score++
  if (/[A-Z]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
  return score
}

const STRENGTH = [
  { label: 'Mínimo 8 caracteres', color: '#79857B' },
  { label: 'Débil',               color: '#C94F44' },
  { label: 'Bien',                color: '#A9853B' },
  { label: 'Fuerte',              color: '#4A7A56' },
]

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  const score = passwordScore(password)
  const { label, color } = STRENGTH[score]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 7 }}>
      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height: 3, flex: 1, borderRadius: 2,
            background: i <= score ? color : 'rgba(20,30,22,0.10)',
            transition: 'background .3s',
          }} />
        ))}
      </div>
      <span style={{ fontSize: 11, color, flexShrink: 0 }}>{label}</span>
    </div>
  )
}

// Mini product preview for the hero: a tidy pipeline timeline — three aligned
// steps (request → dossier → accepted budget) joined by a vertical connector.
const ICON_COL = 24 // icon square size; the connector aligns to its center

function HeroPreview() {
  return (
    <div style={{ width: '100%', maxWidth: 312, margin: '4px auto 0', textAlign: 'left', fontFamily: "'Inter', sans-serif" }}>
      {/* Step 1 — new request */}
      <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '12px 14px', boxShadow: '0 10px 28px rgba(20,30,22,0.22)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ width: ICON_COL, height: ICON_COL, borderRadius: 7, background: 'rgba(216,179,106,0.20)', color: '#8C6D2C', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Inbox size={13} />
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#141E16' }}>Nueva petición</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9AA89E' }}>hace 2 min</span>
        </div>
        <div style={{ fontSize: 12.5, color: '#5F6B61', marginBottom: 8, paddingLeft: ICON_COL + 8 }}>Boda · 120 invitados · 14 jun 2027</div>
        <span style={{ marginLeft: ICON_COL + 8, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500, color: '#8C6D2C', background: 'rgba(216,179,106,0.16)', border: '1px solid rgba(178,141,74,0.25)', borderRadius: 999, padding: '3px 9px' }}>
          <CalendarCheck size={11} /> Visita propuesta
        </span>
      </div>

      {/* Connector */}
      <div style={{ width: 2, height: 12, marginLeft: 14 + ICON_COL / 2, background: 'rgba(255,255,255,0.30)' }} />

      {/* Step 2 — dossier sent (lighter, in-between step) */}
      <div style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.20)', borderRadius: 12, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: ICON_COL, height: ICON_COL, borderRadius: 7, background: 'rgba(255,255,255,0.18)', color: '#F0DCAC', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileText size={13} />
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#F5F4EE' }}>Dossier enviado</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(245,244,238,0.65)' }}>ayer</span>
      </div>

      {/* Connector */}
      <div style={{ width: 2, height: 12, marginLeft: 14 + ICON_COL / 2, background: 'rgba(255,255,255,0.30)' }} />

      {/* Step 3 — accepted budget */}
      <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '12px 14px', boxShadow: '0 10px 28px rgba(20,30,22,0.22)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: ICON_COL, height: ICON_COL, borderRadius: '50%', background: 'rgba(74,122,86,0.15)', color: '#4A7A56', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Check size={13} strokeWidth={2.5} />
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#141E16' }}>Presupuesto aceptado</span>
          <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: '#141E16', fontVariantNumeric: 'tabular-nums' }}>18.400 €</span>
        </div>
        <div style={{ fontSize: 12, color: '#5F6B61', marginTop: 5, paddingLeft: ICON_COL + 8 }}>Menú degustación + espacios · firma online</div>
      </div>
    </div>
  )
}

function SignupPageInner() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [accountType, setAccountType]         = useState<AccountType>('venue_owner')
  const [email, setEmail]                     = useState('')
  const [password, setPassword]               = useState('')
  const [acceptTerms, setAcceptTerms]         = useState(false)
  const [acceptMarketing, setAcceptMarketing] = useState(false)
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState('')
  const [done, setDone]                       = useState(false)
  const [termsFlash, setTermsFlash]           = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!authLoading && user) router.push('/dashboard')
  }, [user, authLoading, router])

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current) }, [])

  const requireTerms = () => {
    if (acceptTerms) return true
    setError('Debes aceptar los términos de servicio para continuar')
    setTermsFlash(true)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setTermsFlash(false), 700)
    return false
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requireTerms()) return
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    setLoading(true); setError('')
    if (typeof window !== 'undefined') localStorage.setItem('wvs_account_type', accountType)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
        data: { marketing_consent: acceptMarketing, account_type: accountType }
      }
    })
    if (error) {
      setError(isDuplicateUserError(error.message) ? '__duplicate__' : translateAuthError(error.message))
      setLoading(false)
    } else { setDone(true); setLoading(false) }
  }

  const handleGoogle = async () => {
    if (!requireTerms()) return
    setError('')
    if (typeof window !== 'undefined') localStorage.setItem('wvs_account_type', accountType)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/onboarding` }
    })
  }

  return (
    <AuthShell
      topLeft={
        <a href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, fontWeight: 500, color: '#3C4A40', textDecoration: 'none',
          padding: '6px 13px 6px 10px', borderRadius: 999,
          background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(20,30,22,0.12)',
          boxShadow: '0 1px 2px rgba(20,30,22,0.05)',
          transition: 'background .2s, border-color .2s',
        }}
          onMouseOver={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = 'rgba(20,30,22,0.25)' }}
          onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.75)'; e.currentTarget.style.borderColor = 'rgba(20,30,22,0.12)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Volver
        </a>
      }
      hero={
        <AuthHero
          chip="14 días de prueba · Sin tarjeta de crédito"
          title={<>Convierte más peticiones en <GradientWord>eventos</GradientWord></>}
          subtitle="El CRM comercial para venues, wedding planners y caterings."
        >
          <HeroPreview />
        </AuthHero>
      }
    >
      <style>{`
        .su-type {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 11px 6px; border-radius: 12px; cursor: pointer;
          border: 1.5px solid rgba(20,30,22,0.12);
          background: rgba(255,255,255,0.75);
          box-shadow: 0 1px 2px rgba(20,30,22,0.04);
          transition: all .18s; text-align: center;
          font-family: 'Inter', sans-serif;
        }
        .su-type:hover { border-color: rgba(178,141,74,0.45); background: #FFFFFF; }
        .su-type.selected { border-color: #C9A35C; background: rgba(232,204,143,0.18); }
      `}</style>

      {!done ? (
        <>
          {/* Card head */}
          <div style={{ marginBottom: 14 }}>
            <div className="fe-form-brand" style={{ marginBottom: 12 }}>
              <AuthBrand size={26} tone="dark" />
            </div>
            <h1 style={{ fontFamily: "'Satoshi','Inter',sans-serif", fontWeight: 700, fontSize: 28, lineHeight: 1.06, letterSpacing: -1.0, margin: '0 0 4px', color: '#141E16' }}>
              Crea tu cuenta gratis
            </h1>
            <p style={{ margin: 0, color: '#5F6B61', fontSize: 14, lineHeight: 1.5 }}>
              Empieza en menos de un minuto. Sin tarjeta de crédito.
            </p>
          </div>

          {/* Account type — compact 3-up grid, the selected type's description below */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#5F6B61', marginBottom: 6, fontWeight: 500, letterSpacing: '0.02em' }}>
              Tipo de cuenta
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }} role="radiogroup" aria-label="Tipo de cuenta">
              {ACCOUNT_TYPES.map(({ type, label, icon }) => {
                const selected = accountType === type
                return (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setAccountType(type)}
                    className={`su-type${selected ? ' selected' : ''}`}
                  >
                    <span style={{
                      width: 30, height: 30, borderRadius: 9,
                      background: selected ? 'rgba(216,179,106,0.22)' : 'rgba(20,30,22,0.05)',
                      color: selected ? GOLD_TEXT : 'rgba(20,30,22,0.45)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .18s',
                    }}>
                      {icon}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: selected ? '#141E16' : 'rgba(20,30,22,0.70)', lineHeight: 1.2 }}>
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
            <p style={{ fontSize: 12, color: '#6B7569', margin: '7px 2px 0', lineHeight: 1.4 }}>
              {ACCOUNT_TYPES.find(t => t.type === accountType)?.sub}
            </p>
          </div>

          {/* Errors */}
          {error && error !== '__duplicate__' && <AuthBanner variant="error">{error}</AuthBanner>}
          {error === '__duplicate__' && (
            <AuthBanner variant="info">
              Ya existe una cuenta con este email.{' '}
              <button type="button" onClick={() => router.push(`/?hint=${encodeURIComponent(email)}`)}
                style={{ background: 'none', border: 'none', color: GOLD_TEXT, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif', padding: 0 }}>
                Iniciar sesión →
              </button>
            </AuthBanner>
          )}

          {/* Form */}
          <form onSubmit={handleSignup} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              <AuthField
                label="Email corporativo"
                icon={<MailIcon />}
                type="email"
                autoComplete="email"
                placeholder="tu@venue.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <div>
                <PasswordField
                  label="Contraseña"
                  icon={<LockIcon />}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <PasswordStrength password={password} />
              </div>
            </div>

            {/* Consents */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              <AuthCheckbox checked={acceptTerms} onChange={setAcceptTerms} flash={termsFlash}>
                He leído y acepto los{' '}
                <a href="/terminos" target="_blank" rel="noopener noreferrer" style={{ color: GOLD_TEXT, textDecoration: 'underline' }}>términos de servicio</a>{' '}y la{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: GOLD_TEXT, textDecoration: 'underline' }}>política de privacidad</a>
                {' '}<span style={{ color: 'rgba(188,82,73,0.8)' }}>*</span>
              </AuthCheckbox>
              <AuthCheckbox checked={acceptMarketing} onChange={setAcceptMarketing}>
                Acepto recibir comunicaciones comerciales. Puedo darme de baja en cualquier momento.
              </AuthCheckbox>
            </div>

            <AuthCta loading={loading} loadingLabel="Creando cuenta…">Crear cuenta gratis</AuthCta>
          </form>

          <AuthDivider />
          <GoogleButton onClick={handleGoogle} />

          <div style={{ marginTop: 12, textAlign: 'center', paddingTop: 12, borderTop: '1px solid rgba(20,30,22,0.08)', fontSize: 13, color: '#5F6B61' }}>
            ¿Ya tienes cuenta?{' '}
            <button type="button" className="fe-btn-ghost" onClick={() => router.push('/')}
              style={{ color: GOLD_TEXT, fontWeight: 500, fontSize: 13 }}>
              Iniciar sesión
            </button>
          </div>

          <TrustBadges />
        </>
      ) : (
        /* Success state */
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(92,126,100,0.12)', border: '1px solid rgba(92,126,100,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
          }}>
            <Check size={24} color="#6E9478" strokeWidth={2.5} />
          </div>
          <h2 style={{ fontFamily: "'Satoshi','Inter',sans-serif", fontSize: 22, fontWeight: 700, color: '#141E16', margin: '0 0 8px', letterSpacing: -0.5 }}>
            ¡Cuenta creada!
          </h2>
          <p style={{ fontSize: 14, color: '#5F6B61', lineHeight: 1.6, margin: '0 0 20px' }}>
            Revisa tu email <strong style={{ color: '#141E16' }}>{email}</strong> y haz clic en el enlace de confirmación para activar tu cuenta.
          </p>
          <button type="button" className="fe-btn-ghost" onClick={() => router.push('/')}
            style={{ color: GOLD_TEXT, fontSize: 14, fontWeight: 500 }}>
            Ir a iniciar sesión →
          </button>
        </div>
      )}
    </AuthShell>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupPageInner />
    </Suspense>
  )
}

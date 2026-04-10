'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Check } from 'lucide-react'
import { Suspense } from 'react'

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

// Custom checkbox component for dark background
function Checkbox({
  checked, onChange, id, children
}: {
  checked: boolean
  onChange: (v: boolean) => void
  id: string
  children: React.ReactNode
}) {
  return (
    <label
      htmlFor={id}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', userSelect: 'none' }}
    >
      <div
        id={id}
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && onChange(!checked)}
        style={{
          width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
          border: `2px solid ${checked ? '#C4975A' : 'rgba(255,255,255,0.2)'}`,
          background: checked ? '#C4975A' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s', cursor: 'pointer',
        }}
      >
        {checked && <Check size={11} color="#fff" strokeWidth={3} />}
      </div>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
        {children}
      </span>
    </label>
  )
}

function RegistroPageInner() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [email, setEmail]                     = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptTerms, setAcceptTerms]         = useState(false)
  const [acceptMarketing, setAcceptMarketing] = useState(false)
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState('')
  const [done, setDone]                       = useState(false)

  // Already logged in → go to dashboard
  useEffect(() => {
    if (!authLoading && user) router.push('/dashboard')
  }, [user, authLoading, router])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!acceptTerms) { setError('Debes aceptar los términos de servicio para continuar'); return }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
        data: { marketing_consent: acceptMarketing }
      }
    })
    if (error) { setError(error.message); setLoading(false) }
    else { setDone(true); setLoading(false) }
  }

  const handleGoogle = async () => {
    if (!acceptTerms) { setError('Debes aceptar los términos de servicio para continuar'); return }
    setError('')
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/onboarding` }
    })
  }

  return (
    <div className="login-page" style={{ alignItems: 'flex-start', paddingTop: 24, paddingBottom: 24 }}>
      {/* Logo horizontal fijo arriba a la izquierda → vuelve a la landing */}
      <a href="/" style={{ position: 'fixed', top: 20, left: 24, textDecoration: 'none', zIndex: 10 }}>
        <img
          src="https://weddingvenuesspain.com/wp-content/uploads/2024/10/logo-wedding-venues-spain-white-e1732122540714.png"
          alt="Wedding Venues Spain"
          style={{ height: 30, width: 'auto', opacity: 0.75, transition: 'opacity 0.2s' }}
          onMouseOver={e => (e.currentTarget.style.opacity = '1')}
          onMouseOut={e => (e.currentTarget.style.opacity = '0.75')}
        />
      </a>

      <div className="login-box" style={{ padding: '28px 32px' }}>
        {/* Logo circular centrado + enlace a landing */}
        <a href="/" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 16 }}>
          <img
            src="/logo-icon.png"
            alt="Wedding Venues Spain"
            style={{ width: 72, height: 72, objectFit: 'contain', display: 'inline-block' }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </a>
        <div className="login-logo" style={{ fontSize: 16, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
          Wedding Venues Spain
        </div>
        <div className="login-subtitle" style={{ marginBottom: 14 }}>Partner Portal</div>

        {!done ? (
          <>
            {/* Value prop — pills en una sola fila */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16, flexWrap: 'nowrap' }}>
              {['14 días gratis', 'Sin tarjeta', 'Propuestas web'].map(item => (
                <span key={item} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'rgba(196,151,90,0.1)', border: '1px solid rgba(196,151,90,0.2)',
                  borderRadius: 20, padding: '3px 9px', fontSize: 11, color: '#C4975A',
                  whiteSpace: 'nowrap',
                }}>
                  <Check size={9} strokeWidth={3} /> {item}
                </span>
              ))}
            </div>

            {error && <div className="login-error">{error}</div>}

            <form onSubmit={handleSignup}>
              <input
                className="login-input" type="email" placeholder="Email"
                value={email} onChange={e => setEmail(e.target.value)} required
              />
              <input
                className="login-input" type="password" placeholder="Contraseña (mín. 8 caracteres)"
                value={password} onChange={e => setPassword(e.target.value)} required
              />
              <input
                className="login-input" type="password" placeholder="Confirmar contraseña"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
              />

              {/* GDPR checkboxes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '12px 0 16px' }}>
                <Checkbox id="terms" checked={acceptTerms} onChange={setAcceptTerms}>
                  He leído y acepto los{' '}
                  <a href="/terminos" target="_blank" rel="noopener noreferrer"
                    style={{ color: '#C4975A', textDecoration: 'underline' }}>
                    términos de servicio
                  </a>{' '}y la{' '}
                  <a href="/privacidad" target="_blank" rel="noopener noreferrer"
                    style={{ color: '#C4975A', textDecoration: 'underline' }}>
                    política de privacidad
                  </a>
                  {' '}<span style={{ color: 'rgba(239,68,68,0.8)' }}>*</span>
                </Checkbox>

                <Checkbox id="marketing" checked={acceptMarketing} onChange={setAcceptMarketing}>
                  Acepto recibir comunicaciones comerciales. Puedo darme de baja en cualquier momento.
                </Checkbox>
              </div>

              <button
                className="login-btn"
                type="submit"
                disabled={loading || !acceptTerms}
                style={{ opacity: !acceptTerms ? 0.5 : 1, cursor: !acceptTerms ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
              </button>
            </form>

            <div className="login-divider">o</div>

            <button
              type="button"
              className="login-google"
              onClick={handleGoogle}
              style={{ opacity: !acceptTerms ? 0.5 : 1 }}
            >
              <GoogleIcon /> Continuar con Google
            </button>

            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
              Responsable: WVS Partners SL · Finalidad: gestión del portal ·{' '}
              <a href="mailto:info@weddingvenuesspain.com" style={{ color: 'rgba(255,255,255,0.2)', textDecoration: 'underline' }}>
                info@weddingvenuesspain.com
              </a>
            </p>
          </>
        ) : (
          /* Success state */
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'rgba(34,197,94,0.15)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <Check size={24} color="#4ade80" strokeWidth={2.5} />
            </div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
              ¡Cuenta creada!
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
              Revisa tu email{' '}
              <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{email}</strong>{' '}
              y haz clic en el enlace de confirmación para activar tu cuenta.
            </p>
          </div>
        )}

        {/* Bottom link to login */}
        {!done && (
          <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>¿Ya tienes cuenta? </span>
            <button
              type="button"
              onClick={() => router.push('/login')}
              style={{ background: 'none', border: 'none', color: '#C4975A', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}
            >
              Iniciar sesión →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function RegistroPage() {
  return (
    <Suspense>
      <RegistroPageInner />
    </Suspense>
  )
}

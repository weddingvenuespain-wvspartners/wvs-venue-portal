'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Check, Building2, CalendarHeart, UtensilsCrossed } from 'lucide-react'
import { Suspense } from 'react'

// ── Icons ──────────────────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.3l-6.3-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.5l6.3 5.2c-.4.4 7.4-5.3 7.4-14.7 0-1.3-.1-2.4-.4-3.5z"/>
  </svg>
)
const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6"/>
  </svg>
)
const SpinnerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ animation: 'fe-spin .9s linear infinite' }}>
    <path d="M12 3a9 9 0 1 0 9 9"/>
  </svg>
)
const ShieldIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
)

// ── Stars ──────────────────────────────────────────────────────────────────────
function Stars({ count = 50 }: { count?: number }) {
  const stars = Array.from({ length: count }, (_, i) => {
    let s = i + 7
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
    return {
      dim: rand() > 0.7,
      blue: rand() > 0.85,
      left: (rand() * 100).toFixed(2),
      top: (rand() * 100).toFixed(2),
      delay: (rand() * 5.5).toFixed(2),
      op: (0.25 + rand() * 0.45).toFixed(2),
    }
  })
  return (
    <>
      {stars.map((st, i) => (
        <span key={i} style={{
          position: 'absolute',
          left: st.left + '%', top: st.top + '%',
          width: st.dim ? '1.5px' : '2px', height: st.dim ? '1.5px' : '2px',
          borderRadius: '50%',
          background: st.blue ? '#5EAEF7' : '#fff',
          opacity: parseFloat(st.op),
          boxShadow: st.blue ? '0 0 8px #5EAEF7' : '0 0 6px rgba(255,255,255,0.5)',
          animation: `fe-twinkle 5.5s ease-in-out ${st.delay}s infinite`,
          pointerEvents: 'none',
        }} />
      ))}
    </>
  )
}

type AccountType = 'venue_owner' | 'wedding_planner' | 'catering'

const ACCOUNT_TYPES: { type: AccountType; label: string; sub: string; icon: React.ReactNode }[] = [
  { type: 'venue_owner',     label: 'Venue / Finca',   sub: 'Gestionas bodas en tu espacio',       icon: <Building2 size={20} /> },
  { type: 'wedding_planner', label: 'Wedding Planner', sub: 'Organizas bodas para tus clientes',   icon: <CalendarHeart size={20} /> },
  { type: 'catering',        label: 'Catering',        sub: 'Ofreces servicio de comida y bebida', icon: <UtensilsCrossed size={20} /> },
]

// ── Main component ─────────────────────────────────────────────────────────────
function SignupPageInner() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [accountType, setAccountType]         = useState<AccountType>('venue_owner')
  const [email, setEmail]                     = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptTerms, setAcceptTerms]         = useState(false)
  const [acceptMarketing, setAcceptMarketing] = useState(false)
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState('')
  const [done, setDone]                       = useState(false)

  useEffect(() => {
    if (!authLoading && user) router.push('/dashboard')
  }, [user, authLoading, router])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!acceptTerms) { setError('Debes aceptar los términos de servicio para continuar'); return }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }
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
      const msg = error.message?.toLowerCase() || ''
      const isDup = msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already exists')
      setError(isDup ? '__duplicate__' : error.message)
      setLoading(false)
    } else { setDone(true); setLoading(false) }
  }

  const handleGoogle = async () => {
    if (!acceptTerms) { setError('Debes aceptar los términos de servicio para continuar'); return }
    setError('')
    if (typeof window !== 'undefined') localStorage.setItem('wvs_account_type', accountType)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/onboarding` }
    })
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @import url('https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&display=swap');

        @keyframes fe-twinkle {
          0%,100% { opacity: var(--fe-op, 0.5); transform: scale(1); }
          50% { opacity: 0.1; transform: scale(0.6); }
        }
        @keyframes fe-spin { to { transform: rotate(360deg); } }
        @keyframes fe-rise {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: none; }
        }

        .su-input {
          width: 100%; height: 42px;
          padding: 0 14px;
          border-radius: 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          color: #E8ECF1; font-size: 14px; font-family: 'Inter', sans-serif;
          transition: border-color .2s, box-shadow .2s, background .2s;
          outline: none; box-sizing: border-box;
        }
        .su-input::placeholder { color: #5a6878; }
        .su-input:hover { border-color: rgba(255,255,255,0.16); }
        .su-input:focus {
          border-color: #2E6DB4;
          background: rgba(255,255,255,0.06);
          box-shadow: 0 0 0 3px rgba(94,174,247,0.18);
        }

        .su-cta {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          padding: 8px 8px 8px 20px; border-radius: 999px;
          background: rgba(46,109,180,0.95);
          border: 1px solid rgba(255,255,255,0.18);
          box-shadow: inset 0 4px 4px rgba(255,255,255,0.28), 0 10px 28px rgba(46,109,180,0.38);
          color: #fff; font-weight: 600; font-size: 14px; font-family: 'Inter', sans-serif;
          cursor: pointer; height: 46px;
          transition: transform .25s, filter .25s;
        }
        .su-cta:hover:not(:disabled) { transform: scale(1.015); filter: brightness(1.06); }
        .su-cta:disabled { opacity: 0.5; cursor: not-allowed; }
        .su-cta .su-arrow {
          width: 30px; height: 30px; border-radius: 50%;
          background: #fff; color: #2E6DB4;
          display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
        }

        .su-social {
          width: 100%; height: 42px; display: flex; align-items: center; justify-content: center; gap: 10px;
          border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10);
          color: #E8ECF1; font-size: 14px; font-weight: 500; font-family: 'Inter', sans-serif;
          cursor: pointer; transition: background .2s, border-color .2s;
        }
        .su-social:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.18); }

        .su-check {
          width: 16px; height: 16px; border-radius: 4px; flex-shrink: 0; margin-top: 1px;
          border: 1.5px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.04);
          display: inline-flex; align-items: center; justify-content: center;
          transition: all .2s; cursor: pointer;
        }
        .su-check.on { background: #2E6DB4; border-color: #2E6DB4; box-shadow: 0 0 0 3px rgba(46,109,180,0.18); }
        .su-check.on::after {
          content: ''; width: 8px; height: 4px;
          border-left: 1.8px solid #fff; border-bottom: 1.8px solid #fff;
          transform: rotate(-45deg) translate(0,-1px);
        }

        .su-type-btn {
          display: flex; flex-direction: column; align-items: center;
          gap: 6px; padding: 12px 8px; border-radius: 10px; cursor: pointer;
          border: 1.5px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.03);
          transition: all .18s; text-align: center;
        }
        .su-type-btn:hover { border-color: rgba(94,174,247,0.30); background: rgba(94,174,247,0.04); }
        .su-type-btn.selected {
          border-color: #2E6DB4;
          background: rgba(46,109,180,0.12);
        }
      `}</style>

      {/* Background */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden',
        background: `
          radial-gradient(ellipse 800px 600px at 20% 15%, rgba(46,109,180,0.16), transparent 60%),
          radial-gradient(ellipse 600px 500px at 80% 85%, rgba(94,174,247,0.09), transparent 60%),
          #0A1628
        `,
      }}>
        <Stars count={50} />
      </div>

      {/* Page */}
      <div style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
        padding: '24px 16px',
      }}>
        {/* Back to login */}
        <a href="/" style={{
          position: 'fixed', top: 20, left: 24, zIndex: 50,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: '#8899AA', textDecoration: 'none',
          transition: 'color .2s',
        }}
          onMouseOver={e => (e.currentTarget.style.color = '#E8ECF1')}
          onMouseOut={e => (e.currentTarget.style.color = '#8899AA')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Volver
        </a>

        {/* ES badge */}
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 50 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', fontSize: 12, fontWeight: 500, color: '#8899AA' }}>
            ES · €
          </span>
        </div>

        {/* Card */}
        <div style={{
          width: '100%', maxWidth: 460,
          animation: 'fe-rise .8s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, justifyContent: 'center' }}>
            <img src="/foreventos-assets/favicon.png" alt="FE" style={{ height: 26, width: 'auto', borderRadius: 6 }} />
            <span style={{ fontFamily: "'Satoshi','Inter',sans-serif", fontWeight: 700, letterSpacing: 0.5, fontSize: 18, color: '#E8ECF1' }}>
              FOREVENTOS
            </span>
          </div>

          {!done ? (
            <>
              {/* Heading */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <h1 style={{ fontFamily: "'Satoshi','Inter',sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: -0.8, margin: '0 0 4px', color: '#E8ECF1' }}>
                  Crea tu cuenta gratis
                </h1>
                <p style={{ margin: 0, color: '#8899AA', fontSize: 14 }}>14 días de prueba · Sin tarjeta de crédito</p>
              </div>

              {/* Account type */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#8899AA', marginBottom: 8, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Tipo de cuenta
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {ACCOUNT_TYPES.map(({ type, label, icon }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAccountType(type)}
                      className={`su-type-btn${accountType === type ? ' selected' : ''}`}
                    >
                      <span style={{ color: accountType === type ? '#5EAEF7' : 'rgba(255,255,255,0.35)' }}>
                        {icon}
                      </span>
                      <div style={{ fontSize: 12, fontWeight: 600, color: accountType === type ? '#5EAEF7' : 'rgba(255,255,255,0.55)', lineHeight: 1.2 }}>
                        {label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && error !== '__duplicate__' && (
                <div style={{ background: 'rgba(255,139,139,0.10)', border: '1px solid rgba(255,139,139,0.25)', color: '#FF8B8B', borderRadius: 10, padding: '9px 14px', fontSize: 13, marginBottom: 12 }}>
                  {error}
                </div>
              )}
              {error === '__duplicate__' && (
                <div style={{ background: 'rgba(46,109,180,0.10)', border: '1px solid rgba(46,109,180,0.25)', borderRadius: 10, padding: '9px 14px', fontSize: 13, marginBottom: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                  Ya existe una cuenta con este email.{' '}
                  <button type="button" onClick={() => router.push(`/?hint=${encodeURIComponent(email)}`)}
                    style={{ background: 'none', border: 'none', color: '#5EAEF7', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif', padding: 0 }}>
                    Iniciar sesión →
                  </button>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSignup}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  <input className="su-input" type="email" placeholder="Email corporativo" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                  <input className="su-input" type="password" placeholder="Contraseña (mín. 8 caracteres)" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
                  <input className="su-input" type="password" placeholder="Confirmar contraseña" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
                </div>

                {/* Checkboxes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                    <span className={`su-check${acceptTerms ? ' on' : ''}`} onClick={() => setAcceptTerms(v => !v)} role="checkbox" aria-checked={acceptTerms} tabIndex={0} onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && setAcceptTerms(v => !v)} />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                      He leído y acepto los{' '}
                      <a href="/terminos" target="_blank" rel="noopener noreferrer" style={{ color: '#5EAEF7', textDecoration: 'underline' }}>términos de servicio</a>{' '}y la{' '}
                      <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: '#5EAEF7', textDecoration: 'underline' }}>política de privacidad</a>
                      {' '}<span style={{ color: 'rgba(239,68,68,0.8)' }}>*</span>
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                    <span className={`su-check${acceptMarketing ? ' on' : ''}`} onClick={() => setAcceptMarketing(v => !v)} role="checkbox" aria-checked={acceptMarketing} tabIndex={0} onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && setAcceptMarketing(v => !v)} />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                      Acepto recibir comunicaciones comerciales. Puedo darme de baja en cualquier momento.
                    </span>
                  </label>
                </div>

                <button className="su-cta" type="submit" disabled={loading || !acceptTerms}>
                  <span>{loading ? 'Creando cuenta…' : 'Crear cuenta gratis'}</span>
                  <span className="su-arrow">{loading ? <SpinnerIcon /> : <ArrowIcon />}</span>
                </button>
              </form>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0', color: '#5a6878', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 500 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                o continúa con
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              </div>

              <button type="button" className="su-social" onClick={handleGoogle} style={{ opacity: !acceptTerms ? 0.5 : 1 }}>
                <GoogleIcon /> <span>Google</span>
              </button>

              {/* Trust */}
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 11, color: '#5a6878' }}>
                <ShieldIcon /> <span>Cifrado RGPD</span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'currentColor', opacity: 0.5, display: 'inline-block' }} />
                <span>Servidores en la UE</span>
              </div>

              {/* Footer */}
              <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: 13, color: '#8899AA' }}>
                ¿Ya tienes cuenta?{' '}
                <button type="button" onClick={() => router.push('/')}
                  style={{ background: 'none', border: 'none', color: '#5EAEF7', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  Iniciar sesión →
                </button>
              </div>
            </>
          ) : (
            /* Success state */
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
              }}>
                <Check size={24} color="#4ade80" strokeWidth={2.5} />
              </div>
              <h2 style={{ fontFamily: "'Satoshi','Inter',sans-serif", fontSize: 22, fontWeight: 700, color: '#E8ECF1', margin: '0 0 8px', letterSpacing: -0.5 }}>
                ¡Cuenta creada!
              </h2>
              <p style={{ fontSize: 14, color: '#8899AA', lineHeight: 1.6, margin: '0 0 20px' }}>
                Revisa tu email <strong style={{ color: '#E8ECF1' }}>{email}</strong> y haz clic en el enlace de confirmación para activar tu cuenta.
              </p>
              <button type="button" onClick={() => router.push('/')}
                style={{ background: 'none', border: 'none', color: '#5EAEF7', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Ir a iniciar sesión →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupPageInner />
    </Suspense>
  )
}

'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Suspense } from 'react'

type Mode = 'login' | 'reset' | 'new_password'

// ── Icons ──────────────────────────────────────────────────────────────────────
const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2.5"/>
    <path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>
  </svg>
)
const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/>
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>
  </svg>
)
const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)
const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3l18 18"/>
    <path d="M10.6 6.1A11 11 0 0 1 12 6c6.5 0 10 6 10 6a18.6 18.6 0 0 1-3.1 3.8"/>
    <path d="M6.3 7.6A18.6 18.6 0 0 0 2 12s3.5 6 10 6c1.4 0 2.7-.2 3.9-.7"/>
    <path d="M9.9 10.1a3 3 0 0 0 4 4"/>
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
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.3l-6.3-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.5l6.3 5.2c-.4.4 7.4-5.3 7.4-14.7 0-1.3-.1-2.4-.4-3.5z"/>
  </svg>
)
const ShieldIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
)
const EuIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 6.5l.6 1.8h1.9l-1.5 1.1.5 1.8L12 10.1l-1.5 1.1.5-1.8-1.5-1.1h1.9z" fill="currentColor" stroke="none"/>
  </svg>
)

// ── Stars (deterministic) ──────────────────────────────────────────────────────
function Stars({ count = 56 }: { count?: number }) {
  const stars = Array.from({ length: count }, (_, i) => {
    let s = i + 1
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
    return {
      dim: rand() > 0.7,
      blue: rand() > 0.85,
      left: (rand() * 100).toFixed(2),
      top: (rand() * 100).toFixed(2),
      delay: (rand() * 5.5).toFixed(2),
      op: (0.3 + rand() * 0.5).toFixed(2),
    }
  })
  return (
    <>
      {stars.map((st, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: st.left + '%',
            top: st.top + '%',
            width: st.dim ? '1.5px' : '2px',
            height: st.dim ? '1.5px' : '2px',
            borderRadius: '50%',
            background: st.blue ? '#5EAEF7' : '#fff',
            opacity: parseFloat(st.op),
            boxShadow: st.blue ? '0 0 8px #5EAEF7' : '0 0 6px rgba(255,255,255,0.6)',
            animation: `fe-twinkle 5.5s ease-in-out ${st.delay}s infinite`,
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
  )
}

// ── Hero panel ─────────────────────────────────────────────────────────────────
function Hero() {
  const steps = [
    'Accede a tu CRM',
    'Revisa peticiones del día',
    'Envía dossieres y presupuestos',
  ]
  return (
    <div style={{
      position: 'relative',
      flex: 1,
      minWidth: 0,
      padding: '48px 56px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      borderRadius: 24,
      overflow: 'hidden',
      background: `
        radial-gradient(ellipse 70% 55% at 50% 30%, rgba(94,174,247,0.55), transparent 65%),
        radial-gradient(ellipse 80% 60% at 50% 20%, rgba(46,109,180,0.55), transparent 70%),
        linear-gradient(180deg, #0D1B2A 0%, #070F1B 100%)
      `,
      border: '1px solid rgba(255,255,255,0.06)',
      boxShadow: '0 20px 60px rgba(10,22,40,0.45)',
    }}>
      {/* bg stars */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <Stars count={36} />
      </div>

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 340 }}>
        {/* Brand */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 28, justifyContent: 'center' }}>
          <img src="/foreventos-assets/favicon.png" alt="FE" style={{ height: 28, width: 'auto', borderRadius: 6 }} />
          <span style={{ fontFamily: "'Satoshi', 'Inter', sans-serif", fontWeight: 700, letterSpacing: 0.5, fontSize: 18, color: '#E8ECF1' }}>
            FOREVENTOS
          </span>
        </div>

        <h2 style={{
          fontFamily: "'Satoshi', 'Inter', sans-serif",
          fontWeight: 700,
          fontSize: 38,
          lineHeight: 1.06,
          letterSpacing: -1.4,
          margin: '0 0 12px',
        }}>
          Vuelve a tu{' '}
          <span style={{
            background: 'linear-gradient(180deg, #fff 30%, #5EAEF7 120%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}>
            plataforma
          </span>
        </h2>

        <p style={{ color: '#8899AA', fontSize: 14, lineHeight: 1.6, margin: '0 auto 36px', maxWidth: 280 }}>
          Tu CRM, dossieres y presupuestos te están esperando.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320, margin: '0 auto' }}>
          {steps.map((lbl, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 14,
              background: i === 0 ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.04)',
              border: i === 0 ? '1px solid rgba(255,255,255,1)' : '1px solid rgba(255,255,255,0.08)',
              boxShadow: i === 0 ? '0 12px 30px rgba(10,22,40,0.45), inset 0 1px 0 rgba(255,255,255,0.6)' : undefined,
              textAlign: 'left',
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: '50%',
                background: i === 0 ? '#0A1628' : 'rgba(255,255,255,0.08)',
                color: i === 0 ? '#fff' : '#5a6878',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600, flexShrink: 0,
              }}>{i + 1}</span>
              <span style={{ fontSize: 13.5, color: i === 0 ? '#0A1628' : '#E8ECF1', fontWeight: 500, letterSpacing: -0.1 }}>{lbl}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main login component ───────────────────────────────────────────────────────
function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()

  // Prevent page scroll — login must fit in one screen
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = ''
      body.style.overflow = ''
    }
  }, [])

  const rawRedirect = searchParams.get('redirect') || ''
  const redirectPath = rawRedirect.startsWith('/') ? rawRedirect : '/dashboard'
  const redirectQuery = new URLSearchParams()
  const plan = searchParams.get('plan')
  const cycle = searchParams.get('cycle')
  if (plan) redirectQuery.set('plan', plan)
  if (cycle) redirectQuery.set('cycle', cycle)
  const redirectUrl = redirectQuery.toString()
    ? `${redirectPath}${redirectPath.includes('?') ? '&' : '?'}${redirectQuery}`
    : redirectPath

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!authLoading && user) router.push(redirectUrl)
  }, [user, authLoading, router, redirectUrl])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash.includes('type=recovery')) setMode('new_password')
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    if (!data.session) { setError('No se pudo iniciar sesión. Inténtalo de nuevo.'); setLoading(false) }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`
    })
    setSuccess('Te hemos enviado un enlace para restablecer tu contraseña.')
    setLoading(false)
  }

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) { setError('Mínimo 8 caracteres'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setError(error.message); setLoading(false) }
    else { router.push('/dashboard') }
  }

  const handleGoogle = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${redirectUrl}` }
    })
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @import url('https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&display=swap');

        @keyframes fe-twinkle {
          0%,100% { opacity: var(--fe-op, 0.6); transform: scale(1); }
          50% { opacity: 0.15; transform: scale(0.6); }
        }
        @keyframes fe-spin { to { transform: rotate(360deg); } }
        @keyframes fe-cardRise {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes fe-pulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.35; }
        }

        .fe-input {
          width: 100%;
          height: 42px;
          padding: 0 14px;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          color: #E8ECF1;
          font-size: 14.5px;
          font-weight: 400;
          font-family: 'Inter', sans-serif;
          transition: border-color .2s, box-shadow .2s, background .2s;
          outline: none;
        }
        .fe-input::placeholder { color: #5a6878; }
        .fe-input:hover { border-color: rgba(255,255,255,0.16); }
        .fe-input:focus {
          border-color: #2E6DB4;
          background: rgba(255,255,255,0.06);
          box-shadow: 0 0 0 3px rgba(94,174,247,0.20);
        }
        .fe-input.has-icon { padding-left: 42px; }
        .fe-input.has-right { padding-right: 42px; }

        .fe-cta {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 8px 8px 22px;
          border-radius: 999px;
          background: rgba(46,109,180,0.95);
          border: 1px solid rgba(255,255,255,0.18);
          box-shadow: inset 0 4px 4px rgba(255,255,255,0.30), 0 12px 30px rgba(46,109,180,0.40);
          color: #fff;
          font-weight: 600;
          font-size: 15px;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          height: 46px;
          transition: transform .25s, filter .25s, box-shadow .25s;
        }
        .fe-cta:hover:not(:disabled) { transform: scale(1.015); filter: brightness(1.06); }
        .fe-cta:active:not(:disabled) { transform: scale(0.99); }
        .fe-cta:disabled { opacity: 0.7; cursor: wait; }
        .fe-cta .fe-arrow {
          width: 34px; height: 34px; border-radius: 50%;
          background: #fff; color: #2E6DB4;
          display: inline-flex; align-items: center; justify-content: center;
          transition: transform .3s cubic-bezier(0.16,1,0.3,1);
          flex-shrink: 0;
        }
        .fe-cta:hover:not(:disabled) .fe-arrow { transform: translateX(3px); }

        .fe-social {
          flex: 1;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 0 14px;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          color: #E8ECF1;
          font-size: 14px;
          font-weight: 500;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: background .2s, border-color .2s, transform .2s;
        }
        .fe-social:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.16); transform: translateY(-1px); }

        .fe-check {
          width: 16px; height: 16px; border-radius: 5px;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.04);
          display: inline-flex; align-items: center; justify-content: center;
          transition: all .2s; cursor: pointer; flex-shrink: 0;
        }
        .fe-check.on {
          background: #2E6DB4;
          border-color: #2E6DB4;
          box-shadow: 0 0 0 3px rgba(46,109,180,0.18);
        }
        .fe-check.on::after {
          content: '';
          width: 8px; height: 4px;
          border-left: 1.8px solid #fff;
          border-bottom: 1.8px solid #fff;
          transform: rotate(-45deg) translate(0px,-1px);
        }

        .fe-btn-ghost {
          background: none; border: none; cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: color .2s;
        }

        .fe-eye-btn {
          position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
          width: 32px; height: 32px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          background: transparent; border: none; color: #5a6878; cursor: pointer;
          transition: color .2s, background .2s;
        }
        .fe-eye-btn:hover { color: #5EAEF7; background: rgba(255,255,255,0.04); }

        /* Hero panel sizing — flex: 1 so it matches the form panel */
        .fe-hero { flex: 1; display: flex; min-width: 0; }

        /* Lock page scroll — login must fit in one screen */
        html, body { overflow: hidden; height: 100%; }

        /* Hide right-panel brand on desktop (hero already shows it) */
        .fe-form-brand { display: none; }

        @media (max-width: 900px) {
          .fe-form-brand { display: inline-flex; }
        }

        @media (max-width: 900px) {
          .fe-hero { display: none !important; }
          .fe-split { flex-direction: column; }
          .fe-form-panel { padding: 24px 20px !important; }
        }
      `}</style>

      {/* Night sky */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden',
        background: `
          radial-gradient(ellipse 800px 600px at 15% 20%, rgba(46,109,180,0.18), transparent 60%),
          radial-gradient(ellipse 700px 500px at 85% 85%, rgba(94,174,247,0.10), transparent 60%),
          #0A1628
        `,
      }}>
        <Stars count={56} />
      </div>

      {/* App shell */}
      <div style={{ position: 'relative', zIndex: 1, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
        {/* Util bar */}
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 50, display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, color: '#8899AA' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', fontSize: 12, fontWeight: 500 }}>
            ES · €
          </span>
        </div>

        {/* Split layout */}
        <div className="fe-split" style={{ flex: 1, display: 'flex', alignItems: 'stretch', padding: 16, gap: 16, minHeight: 0 }}>
          {/* Hero (left) */}
          <div className="fe-hero">
            <Hero />
          </div>

          {/* Form panel (right) */}
          <div className="fe-form-panel" style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'clamp(20px, 4vh, 48px) clamp(20px, 4vw, 48px)',
            overflowY: 'auto',
          }}>
            <div style={{
              width: '100%',
              maxWidth: 420,
              animation: 'fe-cardRise .9s cubic-bezier(0.16,1,0.3,1) both',
            }}>
              {/* Card head */}
              <div style={{ marginBottom: 16 }}>
                <div className="fe-form-brand" style={{ alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <img src="/foreventos-assets/favicon.png" alt="FE" style={{ height: 28, width: 'auto', borderRadius: 6 }} />
                  <span style={{ fontFamily: "'Satoshi','Inter',sans-serif", fontWeight: 700, letterSpacing: 0.5, fontSize: 20, color: '#E8ECF1' }}>
                    FOREVENTOS
                  </span>
                </div>
                <h1 style={{ fontFamily: "'Satoshi','Inter',sans-serif", fontWeight: 700, fontSize: 28, lineHeight: 1.06, letterSpacing: -1.0, margin: '0 0 4px', color: '#E8ECF1' }}>
                  {mode === 'login' ? 'Iniciar sesión' : mode === 'reset' ? 'Recuperar contraseña' : 'Nueva contraseña'}
                </h1>
                <p style={{ margin: 0, color: '#8899AA', fontSize: 14, lineHeight: 1.5 }}>
                  {mode === 'login'
                    ? 'Gestiona peticiones, dossieres y presupuestos.'
                    : mode === 'reset'
                    ? 'Te enviaremos un enlace a tu email.'
                    : 'Introduce tu nueva contraseña.'}
                </p>
              </div>

              {/* Error / success banners */}
              {error && (
                <div style={{ background: 'rgba(255,139,139,0.10)', border: '1px solid rgba(255,139,139,0.25)', color: '#FF8B8B', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}
              {success && (
                <div style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
                  {success}
                </div>
              )}

              {/* ── LOGIN form ── */}
              {mode === 'login' && (
                <form onSubmit={handleLogin} noValidate>
                  {/* Email */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: '#8899AA', letterSpacing: '0.02em' }}>
                      Email corporativo
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="fe-input has-icon"
                        type="email"
                        autoComplete="email"
                        placeholder="tu@venue.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                      />
                      <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#5a6878', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                        <MailIcon />
                      </span>
                    </div>
                  </div>

                  {/* Password */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 0 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: '#8899AA', letterSpacing: '0.02em' }}>
                      Contraseña
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="fe-input has-icon has-right"
                        type={showPwd ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                      />
                      <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#5a6878', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                        <LockIcon />
                      </span>
                      <button type="button" className="fe-eye-btn" onClick={() => setShowPwd(s => !s)} aria-label={showPwd ? 'Ocultar' : 'Mostrar'}>
                        {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>

                  {/* Remember + forgot */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '10px 0 14px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#8899AA', cursor: 'pointer', userSelect: 'none' }}>
                      <span
                        className={'fe-check' + (remember ? ' on' : '')}
                        onClick={() => setRemember(r => !r)}
                        role="checkbox"
                        aria-checked={remember}
                      />
                      <span>Mantener sesión iniciada</span>
                    </label>
                    <button
                      type="button"
                      className="fe-btn-ghost"
                      style={{ fontSize: 13, color: '#5EAEF7', fontWeight: 500 }}
                      onClick={() => { setMode('reset'); setError(''); setSuccess('') }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  {/* CTA */}
                  <button className="fe-cta" type="submit" disabled={loading}>
                    <span>{loading ? 'Verificando…' : 'Iniciar sesión'}</span>
                    <span className="fe-arrow">
                      {loading ? <SpinnerIcon /> : <ArrowIcon />}
                    </span>
                  </button>

                  {/* Social */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '16px 0 12px', color: '#5a6878', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 500 }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.10)' }} />
                    o continúa con
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.10)' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="fe-social" onClick={handleGoogle}>
                      <GoogleIcon /> <span>Google</span>
                    </button>
                  </div>

                  {/* Footer */}
                  <div style={{ marginTop: 16, textAlign: 'center', paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: 13, color: '#8899AA' }}>
                    ¿Aún no tienes cuenta?{' '}
                    <button
                      type="button"
                      className="fe-btn-ghost"
                      style={{ color: '#5EAEF7', fontWeight: 500, fontSize: 13 }}
                      onClick={() => router.push('/signup')}
                    >
                      Crear cuenta gratis
                    </button>
                  </div>

                  {/* Trust */}
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 11, color: '#5a6878' }}>
                    <ShieldIcon /> <span>Cifrado RGPD</span>
                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'currentColor', opacity: 0.5, display: 'inline-block' }} />
                    <EuIcon /> <span>Servidores en la UE</span>
                  </div>
                </form>
              )}

              {/* ── RESET form ── */}
              {mode === 'reset' && (
                <form onSubmit={handleReset}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: '#8899AA', letterSpacing: '0.02em' }}>Email</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="fe-input has-icon"
                        type="email"
                        autoComplete="email"
                        placeholder="tu@venue.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                      />
                      <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#5a6878', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                        <MailIcon />
                      </span>
                    </div>
                  </div>
                  <button className="fe-cta" type="submit" disabled={loading}>
                    <span>{loading ? 'Enviando…' : 'Enviar enlace'}</span>
                    <span className="fe-arrow">
                      {loading ? <SpinnerIcon /> : <ArrowIcon />}
                    </span>
                  </button>
                  <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <button
                      type="button"
                      className="fe-btn-ghost"
                      style={{ color: '#8899AA', fontSize: 13 }}
                      onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                    >
                      ← Volver al login
                    </button>
                  </div>
                </form>
              )}

              {/* ── NEW PASSWORD form ── */}
              {mode === 'new_password' && (
                <form onSubmit={handleNewPassword}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: '#8899AA', letterSpacing: '0.02em' }}>Nueva contraseña</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="fe-input has-icon has-right"
                        type={showPwd ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Mínimo 8 caracteres"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        required
                      />
                      <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#5a6878', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                        <LockIcon />
                      </span>
                      <button type="button" className="fe-eye-btn" onClick={() => setShowPwd(s => !s)} aria-label={showPwd ? 'Ocultar' : 'Mostrar'}>
                        {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>
                  <button className="fe-cta" type="submit" disabled={loading}>
                    <span>{loading ? 'Guardando…' : 'Guardar contraseña'}</span>
                    <span className="fe-arrow">
                      {loading ? <SpinnerIcon /> : <ArrowIcon />}
                    </span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function Home() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}

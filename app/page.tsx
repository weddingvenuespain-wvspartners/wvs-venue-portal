'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Inbox, FileText, FileSignature } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { AuthHero, AuthBrand, GradientWord } from '@/components/auth/AuthHero'
import { AuthField, PasswordField, AuthCta, AuthDivider, GoogleButton, TrustBadges, AuthBanner } from '@/components/auth/fields'
import { MailIcon, LockIcon } from '@/components/auth/icons'
import { translateAuthError } from '@/components/auth/errors'
import { GOLD_TEXT } from '@/components/auth/theme'

type Mode = 'login' | 'reset' | 'new_password'

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()

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

  // Signup redirects here with ?hint=<email> when it detects a duplicate account.
  const emailHint = searchParams.get('hint') || ''

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState(emailHint)
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
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
    if (error) { setError(translateAuthError(error.message)); setLoading(false); return }
    if (!data.session) { setError('No se pudo iniciar sesión. Inténtalo de nuevo.'); setLoading(false) }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`
    })
    if (error) { setError(translateAuthError(error.message)); setLoading(false); return }
    setSuccess('Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña.')
    setLoading(false)
  }

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) { setError('Mínimo 8 caracteres'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setError(translateAuthError(error.message)); setLoading(false) }
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
    <AuthShell
      lockScroll
      hero={
        <AuthHero
          title={<>Vuelve a tu <GradientWord>plataforma</GradientWord></>}
          subtitle="Tu CRM, dossieres y presupuestos te están esperando."
          items={[
            { icon: <Inbox size={16} />, label: 'CRM de peticiones', sub: 'Leads y seguimiento en un solo sitio' },
            { icon: <FileText size={16} />, label: 'Dossieres', sub: 'Listos para enviar en minutos' },
            { icon: <FileSignature size={16} />, label: 'Presupuestos y contratos', sub: 'Con firma y cobro online' },
          ]}
        />
      }
    >
      {/* Card head */}
      <div style={{ marginBottom: 16 }}>
        <div className="fe-form-brand" style={{ marginBottom: 12 }}>
          <AuthBrand size={26} tone="dark" />
        </div>
        <h1 style={{ fontFamily: "'Satoshi','Inter',sans-serif", fontWeight: 700, fontSize: 28, lineHeight: 1.06, letterSpacing: -1.0, margin: '0 0 4px', color: '#141E16' }}>
          {mode === 'login' ? 'Iniciar sesión' : mode === 'reset' ? 'Recuperar contraseña' : 'Nueva contraseña'}
        </h1>
        <p style={{ margin: 0, color: '#5F6B61', fontSize: 14, lineHeight: 1.5 }}>
          {mode === 'login'
            ? 'Gestiona peticiones, dossieres y presupuestos.'
            : mode === 'reset'
            ? 'Te enviaremos un enlace a tu email.'
            : 'Introduce tu nueva contraseña.'}
        </p>
      </div>

      {error && <AuthBanner variant="error">{error}</AuthBanner>}
      {success && <AuthBanner variant="success">{success}</AuthBanner>}

      {/* ── LOGIN form ── */}
      {mode === 'login' && (
        <form onSubmit={handleLogin} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AuthField
              label="Email corporativo"
              icon={<MailIcon />}
              type="email"
              autoComplete="email"
              placeholder="tu@venue.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus={!emailHint}
              required
            />
            <PasswordField
              label="Contraseña"
              icon={<LockIcon />}
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus={!!emailHint}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '10px 0 14px' }}>
            <button
              type="button"
              className="fe-btn-ghost"
              style={{ fontSize: 13, color: GOLD_TEXT, fontWeight: 500 }}
              onClick={() => { setMode('reset'); setError(''); setSuccess('') }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <AuthCta loading={loading} loadingLabel="Verificando…">Iniciar sesión</AuthCta>

          <AuthDivider />
          <GoogleButton onClick={handleGoogle} />

          <div style={{ marginTop: 16, textAlign: 'center', paddingTop: 14, borderTop: '1px solid rgba(20,30,22,0.08)', fontSize: 13, color: '#5F6B61' }}>
            ¿Aún no tienes cuenta?{' '}
            <button
              type="button"
              className="fe-btn-ghost"
              style={{ color: GOLD_TEXT, fontWeight: 500, fontSize: 13 }}
              onClick={() => router.push('/signup')}
            >
              Crear cuenta gratis
            </button>
          </div>

          <TrustBadges />
        </form>
      )}

      {/* ── RESET form ── */}
      {mode === 'reset' && (
        <form onSubmit={handleReset}>
          <div style={{ marginBottom: 20 }}>
            <AuthField
              label="Email"
              icon={<MailIcon />}
              type="email"
              autoComplete="email"
              placeholder="tu@venue.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>
          <AuthCta loading={loading} loadingLabel="Enviando…">Enviar enlace</AuthCta>
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button
              type="button"
              className="fe-btn-ghost"
              style={{ color: '#79857B', fontSize: 13 }}
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
          <div style={{ marginBottom: 20 }}>
            <PasswordField
              label="Nueva contraseña"
              icon={<LockIcon />}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoFocus
              required
            />
          </div>
          <AuthCta loading={loading} loadingLabel="Guardando…">Guardar contraseña</AuthCta>
        </form>
      )}
    </AuthShell>
  )
}

export default function Home() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}

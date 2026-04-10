'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Suspense } from 'react'

type Mode = 'login' | 'reset' | 'new_password'

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()

  // Support redirect back after login (e.g. /login?redirect=/pricing&plan=X&cycle=Y)
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

  const [mode, setMode]     = useState<Mode>('login')
  const [email, setEmail]   = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
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
      redirectTo: `${window.location.origin}/login`
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
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">Wedding Venues Spain</div>
        <div className="login-subtitle">Partner Portal</div>

        {error && <div className="login-error">{error}</div>}
        {success && (
          <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 16 }}>
            {success}
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <input className="login-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <input className="login-input" type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required />
            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar al portal'}
            </button>
            <div className="login-divider">o</div>
            <button type="button" className="login-google" onClick={handleGoogle}>
              <GoogleIcon /> Continuar con Google
            </button>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button type="button" onClick={() => { setMode('reset'); setError(''); setSuccess('') }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Manrope, sans-serif' }}>
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleReset}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 16, textAlign: 'center' }}>
              Introduce tu email y te enviaremos un enlace.
            </p>
            <input className="login-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Manrope, sans-serif' }}>
                ← Volver al login
              </button>
            </div>
          </form>
        )}

        {mode === 'new_password' && (
          <form onSubmit={handleNewPassword}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 16, textAlign: 'center' }}>
              Introduce tu nueva contraseña.
            </p>
            <input className="login-input" type="password" placeholder="Nueva contraseña (mín. 8 caracteres)" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </form>
        )}

        {/* Bottom link to signup */}
        {mode === 'login' && (
          <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>¿No tienes cuenta? </span>
            <button
              type="button"
              onClick={() => router.push('/registro')}
              style={{ background: 'none', border: 'none', color: '#C4975A', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}
            >
              Regístrate gratis →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}

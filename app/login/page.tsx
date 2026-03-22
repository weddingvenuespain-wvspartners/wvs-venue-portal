'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [mode, setMode]         = useState<'login' | 'reset' | 'new_password'>('login')
  const [resetSent, setResetSent] = useState(false)

  // Detectar token de recuperación en la URL
  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.includes('type=recovery')) {
      setMode('new_password')
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  const handleGoogle = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    })
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`
    })
    setResetSent(true)
    setLoading(false)
  }

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setError('Error al actualizar la contraseña. El enlace puede haber expirado.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">Wedding Venues Spain</div>
        <div className="login-subtitle">PARTNER PORTAL</div>

        {error && <div className="login-error">{error}</div>}

        {/* Modo: establecer nueva contraseña */}
        {mode === 'new_password' && (
          <form onSubmit={handleNewPassword}>
            <p style={{ color: 'var(--stone)', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>
              Introduce tu nueva contraseña.
            </p>
            <input
              className="login-input"
              type="password"
              placeholder="Nueva contraseña (mín. 8 caracteres)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
            />
            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </form>
        )}

        {/* Modo: login normal */}
        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <input
              className="login-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <input
              className="login-input"
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar al portal'}
            </button>

            <div className="login-divider">o</div>

            <button type="button" className="login-google" onClick={handleGoogle}>
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar con Google
            </button>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setMode('reset')}
                style={{ background: 'none', border: 'none', color: 'var(--stone)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </form>
        )}

        {/* Modo: pedir reset por email */}
        {mode === 'reset' && (
          <form onSubmit={handleReset}>
            {resetSent ? (
              <div style={{ color: 'var(--stone)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                ✓ Te hemos enviado un email para restablecer tu contraseña.
              </div>
            ) : (
              <>
                <p style={{ color: 'var(--stone)', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>
                  Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
                </p>
                <input
                  className="login-input"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                <button className="login-btn" type="submit" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar enlace'}
                </button>
              </>
            )}
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setMode('login')}
                style={{ background: 'none', border: 'none', color: 'var(--stone)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
              >
                ← Volver al login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
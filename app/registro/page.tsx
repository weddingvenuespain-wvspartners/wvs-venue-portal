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

function RegistroPageInner() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [done, setDone]               = useState(false)

  // Already logged in → go to dashboard
  useEffect(() => {
    if (!authLoading && user) router.push('/dashboard')
  }, [user, authLoading, router])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/onboarding` }
    })
    if (error) { setError(error.message); setLoading(false) }
    else { setDone(true); setLoading(false) }
  }

  const handleGoogle = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/onboarding` }
    })
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">Wedding Venues Spain</div>
        <div className="login-subtitle">Partner Portal</div>

        {!done ? (
          <>
            {/* Value prop */}
            <div style={{
              background: 'rgba(196,151,90,0.1)', border: '1px solid rgba(196,151,90,0.2)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 20,
            }}>
              {[
                '14 días gratis, sin tarjeta',
                'Gestión de leads y propuestas',
                'Calendario de disponibilidad',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12, color: '#C4975A' }}>
                  <Check size={12} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  {item}
                </div>
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
              <button className="login-btn" type="submit" disabled={loading}>
                {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
              </button>
            </form>

            <div className="login-divider">o</div>

            <button type="button" className="login-google" onClick={handleGoogle}>
              <GoogleIcon /> Continuar con Google
            </button>

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
              Al registrarte aceptas nuestros términos de servicio y política de privacidad.
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
              Revisa tu email <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{email}</strong> y haz clic en el enlace de confirmación para activar tu cuenta.
            </p>
          </div>
        )}

        {/* Bottom link to login */}
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

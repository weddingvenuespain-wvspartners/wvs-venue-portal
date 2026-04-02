'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import {
  User, Lock, Bell, CreditCard, Link2, ShieldAlert,
  CheckCircle2, XCircle, Eye, EyeOff, Smartphone
} from 'lucide-react'

type Tab = 'perfil' | 'seguridad' | 'notificaciones' | 'suscripcion' | 'integraciones' | 'cuenta'

// ─── Componente de sección con título ─────────────────────────────────────────
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        <div className="card-title">{title}</div>
        {description && <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontWeight: 400 }}>{description}</div>}
      </div>
      <div className="card-body">{children}</div>
    </div>
  )
}

// ─── Row para toggles de notificaciones ───────────────────────────────────────
function NotifRow({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--ivory)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)' }}>{label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--warm-gray)', marginTop: 2 }}>{description}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: value ? 'var(--gold)' : 'var(--stone)',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: value ? 23 : 3,
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }} />
      </button>
    </div>
  )
}

export default function PerfilPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [success, setSuccess]     = useState('')
  const [error, setError]         = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('perfil')

  // Perfil
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone]             = useState('')
  const [venueWebsite, setVenueWebsite] = useState('')

  // Seguridad
  const [newPass, setNewPass]         = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showNewPass, setShowNewPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passStrength, setPassStrength] = useState(0)

  // Notificaciones
  const [notif, setNotif] = useState({
    new_lead:       true,
    proposal_view:  true,
    proposal_cta:   true,
    chat_message:   true,
    weekly_summary: false,
    marketing:      false,
  })

  // WP credentials
  const [wpUser, setWpUser]     = useState('')
  const [wpPass, setWpPass]     = useState('')
  const [hasWpCreds, setHasWpCreds] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    if (profile) {
      setHasWpCreds(!!profile.wp_username)
      setDisplayName(profile.display_name || '')
      setPhone(profile.phone || '')
      setVenueWebsite(profile.venue_website || '')
      if (profile.notif_settings) {
        try { setNotif({ ...notif, ...JSON.parse(profile.notif_settings) }) } catch {}
      }
    }
    setLoading(false)
  }, [user, profile, authLoading, router])

  const notify = (msg: string, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => { setSuccess(''); setError('') }, 4000)
  }

  // ─── Calcular fuerza contraseña ────────────────────────────────────────────
  const calcStrength = (p: string) => {
    let s = 0
    if (p.length >= 8)  s++
    if (p.length >= 12) s++
    if (/[A-Z]/.test(p)) s++
    if (/[0-9]/.test(p)) s++
    if (/[^A-Za-z0-9]/.test(p)) s++
    return s
  }

  const strengthLabel = ['', 'Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Muy fuerte']
  const strengthColor = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a']

  // ─── Guardar perfil ────────────────────────────────────────────────────────
  const handleSavePerfil = async () => {
    setSaving(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('venue_profiles')
      .update({ display_name: displayName, phone, venue_website: venueWebsite })
      .eq('user_id', user.id)
    if (err) notify('Error al guardar el perfil', true)
    else notify('Perfil actualizado correctamente')
    setSaving(false)
  }

  // ─── Cambiar contraseña ────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!newPass || newPass !== confirmPass) { notify('Las contraseñas no coinciden', true); return }
    if (newPass.length < 8) { notify('Mínimo 8 caracteres', true); return }
    setSaving(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password: newPass })
    if (err) notify('Error al cambiar la contraseña', true)
    else {
      notify('Contraseña actualizada correctamente')
      setNewPass(''); setConfirmPass('')
    }
    setSaving(false)
  }

  // ─── Guardar notificaciones ────────────────────────────────────────────────
  const handleSaveNotif = async () => {
    setSaving(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('venue_profiles')
      .update({ notif_settings: JSON.stringify(notif) })
      .eq('user_id', user.id)
    if (err) notify('Error al guardar las preferencias', true)
    else notify('Preferencias de notificación guardadas')
    setSaving(false)
  }

  // ─── WordPress ────────────────────────────────────────────────────────────
  const handleConnectWP = async () => {
    setSaving(true)
    try {
      const res = await fetch('https://weddingvenuesspain.com/wp-json/jwt-auth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: wpUser, password: wpPass })
      })
      const data = await res.json()
      if (data.token) {
        const supabase = createClient()
        await supabase.from('venue_profiles')
          .update({ wp_username: wpUser, wp_token: data.token })
          .eq('user_id', user.id)
        setHasWpCreds(true)
        notify('Cuenta de WordPress conectada correctamente')
      } else {
        notify('Usuario o contraseña de WordPress incorrectos', true)
      }
    } catch { notify('Error al conectar con WordPress', true) }
    setSaving(false)
  }

  const handleDisconnectWP = async () => {
    if (!confirm('¿Desconectar tu cuenta de WordPress?')) return
    const supabase = createClient()
    await supabase.from('venue_profiles')
      .update({ wp_username: null, wp_token: null })
      .eq('user_id', user.id)
    setHasWpCreds(false)
    setWpUser(''); setWpPass('')
    notify('Cuenta de WordPress desconectada')
  }

  // ─── Eliminar cuenta ───────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    const confirmed = prompt('Escribe ELIMINAR para confirmar que quieres borrar tu cuenta permanentemente:')
    if (confirmed !== 'ELIMINAR') return
    notify('Solicitud enviada. Nuestro equipo procesará la eliminación en 48h.', false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1A1512', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C4975A', fontFamily: 'serif' }}>Cargando...</div>
    </div>
  )

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'perfil',         label: 'Perfil',          icon: <User size={13} /> },
    { key: 'seguridad',      label: 'Seguridad',        icon: <Lock size={13} /> },
    { key: 'notificaciones', label: 'Notificaciones',   icon: <Bell size={13} /> },
    { key: 'suscripcion',    label: 'Suscripción',      icon: <CreditCard size={13} /> },
    { key: 'integraciones',  label: 'Integraciones',    icon: <Link2 size={13} /> },
    { key: 'cuenta',         label: 'Cuenta',           icon: <ShieldAlert size={13} /> },
  ]

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Configuración</div>
        </div>
        <div className="page-content" style={{ maxWidth: 720 }}>

          {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}
          {error   && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{error}</div>}

          {/* ── Header perfil ── */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--gold), #a07835)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: '#fff', flexShrink: 0
                }}>
                  {(displayName || user?.email || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--espresso)', fontFamily: 'Cormorant Garamond, serif' }}>
                    {displayName || user?.email}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>
                    {profile?.role === 'admin' ? 'Administrador' : 'Venue Owner'} · Miembro desde {memberSince}
                  </div>
                </div>
                <span className={`badge ${profile?.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                  {profile?.status === 'active' ? 'Activo' : 'Pendiente'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="tabs" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
            {tabs.map(t => (
              <div
                key={t.key}
                className={`tab ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => setActiveTab(t.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}
              >
                {t.icon} {t.label}
              </div>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              TAB: PERFIL
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'perfil' && (
            <Section title="Información personal" description="Datos visibles en tu panel y en las propuestas que envías.">
              <div className="form-group">
                <label className="form-label">Nombre completo</label>
                <input
                  className="form-input"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Tu nombre o el del responsable del venue"
                />
              </div>
              <div className="two-col">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    className="form-input"
                    value={user?.email || ''}
                    disabled
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>
                    Para cambiar el email contacta con soporte.
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono de contacto</label>
                  <input
                    className="form-input"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+34 600 000 000"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Web del venue</label>
                <input
                  className="form-input"
                  value={venueWebsite}
                  onChange={e => setVenueWebsite(e.target.value)}
                  placeholder="https://tuvenue.com"
                />
              </div>
              <div style={{ paddingTop: 8, borderTop: '1px solid var(--ivory)', marginTop: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 12 }}>
                  <strong style={{ color: 'var(--charcoal)' }}>Venue asignado:</strong>{' '}
                  {profile?.wp_venue_id ? `WordPress ID #${profile.wp_venue_id}` : 'Sin venue asignado aún'}
                </div>
                <button className="btn btn-primary" onClick={handleSavePerfil} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </Section>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: SEGURIDAD
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'seguridad' && (
            <>
              <Section title="Cambiar contraseña" description="Usa una contraseña larga con mayúsculas, números y símbolos.">
                <div className="form-group">
                  <label className="form-label">Nueva contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-input"
                      type={showNewPass ? 'text' : 'password'}
                      value={newPass}
                      onChange={e => { setNewPass(e.target.value); setPassStrength(calcStrength(e.target.value)) }}
                      placeholder="Mínimo 8 caracteres"
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 0 }}
                    >
                      {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {newPass && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                        {[1,2,3,4,5].map(i => (
                          <div key={i} style={{
                            flex: 1, height: 3, borderRadius: 2,
                            background: i <= passStrength ? strengthColor[passStrength] : 'var(--ivory)',
                            transition: 'background 0.2s'
                          }} />
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: strengthColor[passStrength] }}>
                        {strengthLabel[passStrength]}
                      </div>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Confirmar nueva contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-input"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPass}
                      onChange={e => setConfirmPass(e.target.value)}
                      placeholder="Repite la contraseña"
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 0 }}
                    >
                      {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {confirmPass && newPass && (
                    <div style={{ fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4,
                      color: newPass === confirmPass ? '#22c55e' : '#ef4444' }}>
                      {newPass === confirmPass
                        ? <><CheckCircle2 size={11} /> Las contraseñas coinciden</>
                        : <><XCircle size={11} /> Las contraseñas no coinciden</>
                      }
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleChangePassword}
                  disabled={saving || !newPass || !confirmPass || newPass !== confirmPass}
                >
                  {saving ? 'Guardando...' : 'Actualizar contraseña'}
                </button>
              </Section>

              <Section title="Sesiones activas" description="Dispositivos donde tienes la sesión iniciada.">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Smartphone size={16} style={{ color: 'var(--gold)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Sesión actual</div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Navegador web · Activo ahora</div>
                  </div>
                  <span className="badge badge-active">Esta sesión</span>
                </div>
                <div style={{ marginTop: 12 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      const supabase = createClient()
                      await supabase.auth.signOut({ scope: 'others' })
                      notify('Todas las demás sesiones han sido cerradas')
                    }}
                  >
                    Cerrar todas las demás sesiones
                  </button>
                </div>
              </Section>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: NOTIFICACIONES
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'notificaciones' && (
            <Section title="Preferencias de email" description="Elige qué emails quieres recibir y cuándo.">
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Actividad
                </div>
                <NotifRow
                  label="Nuevo lead recibido"
                  description="Cuando una pareja te contacta desde tu ficha o propuesta"
                  value={notif.new_lead}
                  onChange={v => setNotif(n => ({ ...n, new_lead: v }))}
                />
                <NotifRow
                  label="Propuesta vista"
                  description="Cuando una pareja abre por primera vez tu propuesta personalizada"
                  value={notif.proposal_view}
                  onChange={v => setNotif(n => ({ ...n, proposal_view: v }))}
                />
                <NotifRow
                  label="CTA en propuesta"
                  description="Cuando solicitan visita, presupuesto u otra acción desde la propuesta"
                  value={notif.proposal_cta}
                  onChange={v => setNotif(n => ({ ...n, proposal_cta: v }))}
                />
                <NotifRow
                  label="Mensaje en el chat"
                  description="Cuando una pareja escribe una pregunta en el chat de la propuesta"
                  value={notif.chat_message}
                  onChange={v => setNotif(n => ({ ...n, chat_message: v }))}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Resúmenes
                </div>
                <NotifRow
                  label="Resumen semanal"
                  description="Un email cada lunes con el resumen de actividad de la semana anterior"
                  value={notif.weekly_summary}
                  onChange={v => setNotif(n => ({ ...n, weekly_summary: v }))}
                />
                <NotifRow
                  label="Novedades y consejos"
                  description="Nuevas funcionalidades, mejores prácticas y actualizaciones de la plataforma"
                  value={notif.marketing}
                  onChange={v => setNotif(n => ({ ...n, marketing: v }))}
                />
              </div>
              <div style={{ marginTop: 20 }}>
                <button className="btn btn-primary" onClick={handleSaveNotif} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar preferencias'}
                </button>
              </div>
            </Section>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: SUSCRIPCIÓN
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'suscripcion' && (
            <>
              <Section title="Plan actual" description="Tu suscripción a Wedding Venues Spain Partner Portal.">
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 16, background: 'var(--cream)', borderRadius: 8, marginBottom: 20, flexWrap: 'wrap', gap: 12
                }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--espresso)', fontFamily: 'Cormorant Garamond, serif' }}>
                      Plan Venue Pro
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>
                      Facturación mensual · Próxima renovación: próximamente
                    </div>
                  </div>
                  <span className="badge badge-active">Activo</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Propuestas', value: 'Ilimitadas' },
                    { label: 'Leads', value: 'Ilimitados' },
                    { label: 'Soporte', value: 'Email + Chat' },
                  ].map(item => (
                    <div key={item.label} style={{ padding: 12, background: 'var(--ivory)', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>{item.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={() => notify('Redirigiendo al portal de facturación...')}>
                    Gestionar suscripción
                  </button>
                  <button className="btn btn-ghost" onClick={() => notify('Historial de facturas próximamente disponible')}>
                    Ver facturas
                  </button>
                </div>
              </Section>

              <Section title="Método de pago" description="Tarjeta asociada a tu suscripción.">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                  <div style={{ width: 40, height: 28, borderRadius: 4, background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CreditCard size={16} style={{ color: '#fff' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>•••• •••• •••• 4242</div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Expira 12/26</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => notify('Redirigiendo al portal de Stripe...')}>
                    Cambiar
                  </button>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--warm-gray)', padding: '10px 12px', background: 'var(--ivory)', borderRadius: 6 }}>
                  Los pagos se procesan de forma segura a través de Stripe. Wedding Venues Spain no almacena datos de tu tarjeta.
                </div>
              </Section>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: INTEGRACIONES
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'integraciones' && (
            <>
              <Section
                title="WordPress"
                description="Conecta tu cuenta para editar tu ficha directamente desde el portal."
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: '#21759b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#fff', fontSize: 18, fontWeight: 700, fontFamily: 'serif' }}>W</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>weddingvenuesspain.com</div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>WordPress · JWT Auth</div>
                  </div>
                  <span className={`badge ${hasWpCreds ? 'badge-active' : 'badge-inactive'}`}>
                    {hasWpCreds ? 'Conectado' : 'No conectado'}
                  </span>
                </div>

                {hasWpCreds ? (
                  <div>
                    <div className="alert alert-success" style={{ marginBottom: 16 }}>
                      Conectado como <strong>{profile?.wp_username}</strong>. Puedes editar tu ficha desde el portal.
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={handleDisconnectWP}>
                      Desconectar WordPress
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="two-col">
                      <div className="form-group">
                        <label className="form-label">Usuario WordPress</label>
                        <input className="form-input" value={wpUser} onChange={e => setWpUser(e.target.value)} placeholder="Tu usuario de WP" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Contraseña WordPress</label>
                        <input className="form-input" type="password" value={wpPass} onChange={e => setWpPass(e.target.value)} placeholder="Tu contraseña" />
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={handleConnectWP} disabled={saving || !wpUser || !wpPass}>
                      {saving ? 'Conectando...' : 'Conectar cuenta'}
                    </button>
                  </div>
                )}
              </Section>

              <Section title="Próximamente" description="Integraciones en desarrollo.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { name: 'WhatsApp Business', desc: 'Recibe leads directamente en WhatsApp', soon: true },
                    { name: 'Google Calendar', desc: 'Sincroniza tu disponibilidad con Google Calendar', soon: true },
                    { name: 'Stripe Billing', desc: 'Gestiona tu suscripción y facturas', soon: false },
                  ].map(item => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--ivory)', borderRadius: 8, opacity: item.soon ? 0.6 : 1 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{item.desc}</div>
                      </div>
                      <span className="badge badge-inactive">{item.soon ? 'Próximamente' : 'Disponible'}</span>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: CUENTA (PELIGRO)
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'cuenta' && (
            <>
              <Section title="Información de cuenta">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Email', value: user?.email },
                    { label: 'ID de cuenta', value: user?.id?.slice(0, 8) + '...' },
                    { label: 'Venue ID (WordPress)', value: profile?.wp_venue_id ? `#${profile.wp_venue_id}` : 'Sin asignar' },
                    { label: 'Rol', value: profile?.role === 'admin' ? 'Administrador' : 'Venue Owner' },
                    { label: 'Estado', value: profile?.status === 'active' ? 'Activo' : 'Pendiente' },
                    { label: 'Miembro desde', value: memberSince },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--ivory)' }}>
                      <span style={{ color: 'var(--warm-gray)' }}>{row.label}</span>
                      <span style={{ fontWeight: 500, color: 'var(--charcoal)' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </Section>

              <div className="card" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
                <div className="card-header" style={{ background: 'rgba(239,68,68,0.04)' }}>
                  <div className="card-title" style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldAlert size={14} /> Zona de peligro
                  </div>
                </div>
                <div className="card-body">
                  <div style={{ marginBottom: 20, padding: 14, background: 'rgba(239,68,68,0.05)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.15)' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#dc2626', marginBottom: 4 }}>Eliminar cuenta permanentemente</div>
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.6 }}>
                      Esta acción es irreversible. Se borrarán todos tus leads, propuestas, configuración y datos del portal.
                      Tu ficha en WordPress <strong>no se verá afectada</strong>.
                    </div>
                  </div>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleDeleteAccount}
                  >
                    Solicitar eliminación de cuenta
                  </button>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
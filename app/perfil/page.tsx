'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { usePlanFeatures } from '@/lib/use-plan-features'
import { useTheme, type Theme } from '@/lib/theme-context'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  User, Lock, Bell, CreditCard, ShieldAlert, Settings,
  CheckCircle2, XCircle, Eye, EyeOff, Smartphone,
  Star, Zap, Clock, Receipt, LogOut, Globe, HelpCircle,
  Download, Shield, BarChart2, Mail, ExternalLink,
  ChevronRight, AlertTriangle, Database, FileText,
  CircleCheckBig, BookOpen, Video, MessageCircle, Info, Loader2,
} from 'lucide-react'

type Section = 'perfil' | 'seguridad' | 'preferencias' | 'privacidad' | 'plan' | 'facturacion' | 'notificaciones' | 'soporte'

type PaymentEvent = {
  id: string; event_type: string; amount: number | null
  reference: string | null; notes: string | null; created_at: string
  plan_id: string | null; billing_cycle: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, description, children, danger }: {
  title: string; description?: string; children: React.ReactNode; danger?: boolean
}) {
  return (
    <div className="card" style={{ marginBottom: 16, ...(danger ? { borderColor: 'rgba(239,68,68,0.25)' } : {}) }}>
      <div className="card-header" style={{
        flexDirection: 'column', alignItems: 'flex-start', gap: 2,
        ...(danger ? { background: 'rgba(239,68,68,0.04)' } : {}),
      }}>
        <div className="card-title" style={danger ? { color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 } : {}}>
          {danger && <ShieldAlert size={14} />}
          {title}
        </div>
        {description && <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontWeight: 400 }}>{description}</div>}
      </div>
      <div className="card-body">{children}</div>
    </div>
  )
}

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
          position: 'relative', transition: 'background 0.2s', flexShrink: 0, marginLeft: 16,
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: value ? 23 : 3,
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  )
}

function ComingSoonBadge() {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '.08em',
      padding: '2px 7px', borderRadius: 4,
      background: 'var(--ivory)', color: 'var(--warm-gray)',
      textTransform: 'uppercase', border: '1px solid var(--stone)',
    }}>
      PRÓXIMAMENTE
    </span>
  )
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const navGroups: { group: string; items: { key: Section; label: string; icon: React.ReactNode }[] }[] = [
  {
    group: 'CUENTA',
    items: [
      { key: 'perfil',        label: 'Perfil personal',    icon: <User size={14} /> },
      { key: 'seguridad',     label: 'Seguridad y acceso', icon: <Lock size={14} /> },
      { key: 'preferencias',  label: 'Preferencias',       icon: <Settings size={14} /> },
      { key: 'privacidad',    label: 'Privacidad y datos', icon: <Shield size={14} /> },
    ],
  },
  {
    group: 'SUSCRIPCIÓN',
    items: [
      { key: 'plan',        label: 'Plan y uso',   icon: <Star size={14} /> },
      { key: 'facturacion', label: 'Facturación',  icon: <Receipt size={14} /> },
    ],
  },
  {
    group: 'PORTAL',
    items: [
      { key: 'notificaciones', label: 'Notificaciones', icon: <Bell size={14} /> },
      { key: 'soporte',        label: 'Soporte y ayuda', icon: <HelpCircle size={14} /> },
    ],
  },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

function PerfilPageContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { user, profile, loading: authLoading } = useAuth()
  const { isBlocked } = useRequireSubscription()
  const features = usePlanFeatures()
  const { theme, setTheme } = useTheme()

  const initialSection = (searchParams.get('tab') as Section | null) || 'perfil'
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [success, setSuccess]       = useState('')
  const [error, setError]           = useState('')
  const [activeSection, setActiveSection] = useState<Section>(initialSection)

  // Profile
  const [displayName, setDisplayName]   = useState('')
  const [phone, setPhone]               = useState('')
  const [venueWebsite, setVenueWebsite] = useState('')

  // Security — password
  const [currentPass, setCurrentPass]       = useState('')
  const [newPass, setNewPass]               = useState('')
  const [confirmPass, setConfirmPass]       = useState('')
  const [showCurrentPass, setShowCurrentPass] = useState(false)
  const [showNewPass, setShowNewPass]       = useState(false)
  const [showConfirm, setShowConfirm]       = useState(false)
  const [passStrength, setPassStrength]     = useState(0)
  const [passSuccess, setPassSuccess]       = useState(false)
  const [sessionDuration, setSessionDuration] = useState('7d')

  // Preferences
  const [timezone, setTimezone]     = useState('Europe/Madrid')
  const [language, setLanguage]     = useState('es')
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY')

  // Privacy
  const [analyticsConsent, setAnalyticsConsent]     = useState(true)
  const [dataExportRequested, setDataExportRequested] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm]   = useState(false)
  const [deleteText, setDeleteText]                 = useState('')

  // Notifications
  const [notif, setNotif] = useState({
    new_lead:       true,
    proposal_view:  true,
    proposal_cta:   true,
    chat_message:   true,
    weekly_summary: false,
    marketing:      false,
  })

  // SMTP
  const [smtpFromEmail,   setSmtpFromEmail]   = useState('')
  const [smtpHost,        setSmtpHost]        = useState('')
  const [smtpPort,        setSmtpPort]        = useState('465')
  const [smtpUser,        setSmtpUser]        = useState('')
  const [smtpPass,        setSmtpPass]        = useState('')
  const [showSmtpPass,    setShowSmtpPass]    = useState(false)
  const [smtpSaving,      setSmtpSaving]      = useState(false)

  // Billing
  const [payments, setPayments]           = useState<PaymentEvent[]>([])
  const [paymentsLoaded, setPaymentsLoaded] = useState(false)

  // Plan usage
  const [leadsCount, setLeadsCount]         = useState<number | null>(null)
  const [proposalsCount, setProposalsCount] = useState<number | null>(null)

  // MFA / 2FA
  const [mfaFactors, setMfaFactors]   = useState<any[]>([])
  const [mfaEnrolling, setMfaEnrolling] = useState(false)
  const [mfaQR, setMfaQR]             = useState('')
  const [mfaSecret, setMfaSecret]     = useState('')
  const [mfaFactorId, setMfaFactorId] = useState('')
  const [mfaCode, setMfaCode]         = useState('')
  const [mfaStep, setMfaStep]         = useState<'idle'|'enroll'|'verify'|'done'>('idle')

  // Status history
  const [showStatusHistory, setShowStatusHistory] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    if (profile) {
      setDisplayName(profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || '')
      setPhone(profile.phone || '')
      setVenueWebsite(profile.venue_website || profile.website || '')
      setTimezone(profile.timezone || 'Europe/Madrid')
      setLanguage(profile.language || 'es')
      setDateFormat(profile.date_format || 'DD/MM/YYYY')
      if (profile.notif_settings) {
        try { setNotif(n => ({ ...n, ...JSON.parse(profile.notif_settings) })) } catch {}
      }
      if (profile.marketing_consent !== undefined && profile.marketing_consent !== null) {
        setNotif(n => ({ ...n, marketing: !!profile.marketing_consent }))
      }
    }

    const storedDuration = localStorage.getItem('wvs_session_duration')
    if (storedDuration) setSessionDuration(storedDuration)
    const storedConsent = localStorage.getItem('wvs_analytics_consent')
    if (storedConsent !== null) setAnalyticsConsent(storedConsent === 'true')

    setLoading(false)

    const supabase = createClient()
    supabase.from('venue_onboarding')
      .select('name, smtp_from_email, smtp_host, smtp_port, smtp_user, smtp_pass')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        if (data.smtp_from_email) setSmtpFromEmail(data.smtp_from_email)
        if (data.smtp_host)       setSmtpHost(data.smtp_host)
        if (data.smtp_port)       setSmtpPort(String(data.smtp_port))
        if (data.smtp_user)       setSmtpUser(data.smtp_user)
        if (data.smtp_pass)       setSmtpPass(data.smtp_pass)
      })
    supabase.from('venue_payment_history').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setPayments(data); setPaymentsLoaded(true) })

    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => setLeadsCount(count ?? 0))

    supabase.from('proposals').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => setProposalsCount(count ?? 0))

    supabase.auth.mfa.listFactors().then(({ data }) => {
      if (data?.totp) setMfaFactors(data.totp.filter((f: any) => f.status === 'verified'))
    })
  }, [authLoading]) // eslint-disable-line

  const notify = (msg: string, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => { setSuccess(''); setError('') }, 4500)
  }

  // ─── Password strength ─────────────────────────────────────────────────────
  const calcStrength = (p: string) => {
    let s = 0
    if (p.length >= 8)              s++
    if (p.length >= 12)             s++
    if (/[A-Z]/.test(p))            s++
    if (/[0-9]/.test(p))            s++
    if (/[^A-Za-z0-9]/.test(p))    s++
    return s
  }
  const strengthLabel = ['', 'Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Muy fuerte']
  const strengthColor = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a']

  // ─── Profile completeness ──────────────────────────────────────────────────
  const completenessItems = [
    displayName.trim().length > 0,
    phone.trim().length > 0,
    venueWebsite.trim().length > 0,
    !!profile?.wp_venue_id,
    !!(profile?.company || profile?.address),
  ]
  const completenessCount   = completenessItems.filter(Boolean).length
  const completenessPercent = Math.round((completenessCount / completenessItems.length) * 100)
  const completenessColor   = completenessPercent < 40 ? '#ef4444' : completenessPercent < 80 ? '#f59e0b' : '#22c55e'

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSavePerfil = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:       user.id,
          display_name:  displayName,
          first_name:    displayName.split(' ')[0] || displayName,
          last_name:     displayName.split(' ').slice(1).join(' ') || '',
          phone,
          website:       venueWebsite,
          venue_website: venueWebsite,
        }),
      })
      const result = await res.json()
      if (!res.ok) notify(result.error || 'Error al guardar el perfil', true)
      else notify('Perfil actualizado correctamente')
    } catch { notify('Error al guardar el perfil', true) }
    setSaving(false)
  }

  const handleChangePassword = async () => {
    if (!currentPass)                    { notify('Introduce tu contraseña actual', true); return }
    if (!newPass || newPass.length < 8)  { notify('La nueva contraseña debe tener al menos 8 caracteres', true); return }
    if (newPass !== confirmPass)         { notify('Las contraseñas nuevas no coinciden', true); return }
    if (newPass === currentPass)         { notify('La nueva contraseña debe ser diferente a la actual', true); return }
    if (passStrength < 2)               { notify('La contraseña es demasiado débil. Añade mayúsculas, números o símbolos.', true); return }

    setSaving(true)
    const supabase = createClient()

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user?.email ?? '',
      password: currentPass,
    })
    if (signInErr) {
      notify('La contraseña actual es incorrecta', true)
      setSaving(false)
      return
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPass })
    if (updateErr) {
      notify('Error al actualizar la contraseña. Inténtalo de nuevo.', true)
    } else {
      setPassSuccess(true)
      setCurrentPass(''); setNewPass(''); setConfirmPass(''); setPassStrength(0)
      setTimeout(() => setPassSuccess(false), 5000)
    }
    setSaving(false)
  }

  const handleSaveSmtp = async () => {
    setSmtpSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('venue_onboarding').update({
      smtp_from_email: smtpFromEmail || null,
      smtp_host:       smtpHost        || null,
      smtp_port:       smtpPort        ? parseInt(smtpPort) : null,
      smtp_user:       smtpUser        || null,
      smtp_pass:       smtpPass        || null,
    }).eq('user_id', user!.id)
    if (error) notify('Error al guardar la configuración de email', true)
    else notify('Configuración de email guardada')
    setSmtpSaving(false)
  }

  const handleSavePreferences = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, timezone, language, date_format: dateFormat }),
      })
      const result = await res.json()
      if (!res.ok) notify(result.error || 'Error al guardar las preferencias', true)
      else notify('Preferencias guardadas')
    } catch { notify('Error al guardar las preferencias', true) }
    setSaving(false)
  }

  const handleSaveNotif = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, notif_settings: JSON.stringify(notif), marketing_consent: notif.marketing }),
      })
      const result = await res.json()
      if (!res.ok) notify(result.error || 'Error al guardar las preferencias', true)
      else notify('Preferencias de notificación guardadas')
    } catch { notify('Error al guardar las preferencias', true) }
    setSaving(false)
  }

  const handleSaveSession = () => {
    localStorage.setItem('wvs_session_duration', sessionDuration)
    const daysMap: Record<string, number> = { '1d': 1, '7d': 7, '30d': 30, '90d': 90 }
    const days = daysMap[sessionDuration]
    if (days) {
      localStorage.setItem('wvs_session_expiry', (Date.now() + days * 86400000).toString())
    } else {
      localStorage.removeItem('wvs_session_expiry')
    }
    notify('Preferencia de sesión guardada')
  }

  const handleDataExport = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/export-data')
      if (!res.ok) { notify('Error al exportar datos', true); setSaving(false); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `wvs-mis-datos-${new Date().toISOString().slice(0,10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setDataExportRequested(true)
      notify('Datos exportados correctamente')
    } catch { notify('Error al exportar datos', true) }
    setSaving(false)
  }

  const handleDeleteAccount = async () => {
    if (deleteText !== 'ELIMINAR') return
    setSaving(true)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, admin_notes: `[SOLICITUD ELIMINACIÓN] ${new Date().toISOString()}` }),
    }).catch(() => {})
    setSaving(false)
    setShowDeleteConfirm(false)
    setDeleteText('')
    notify('Solicitud enviada. Nuestro equipo procesará la eliminación en 48 horas.')
  }

  // ─── MFA Handlers ─────────────────────────────────────────────────────────

  const handleMfaEnroll = async () => {
    setMfaEnrolling(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator App' })
    if (error || !data) { notify('Error al configurar 2FA', true); setMfaEnrolling(false); return }
    setMfaQR((data as any).totp.qr_code)
    setMfaSecret((data as any).totp.secret)
    setMfaFactorId(data.id)
    setMfaStep('enroll')
    setMfaEnrolling(false)
  }

  const handleMfaVerify = async () => {
    setSaving(true)
    const supabase = createClient()
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
    if (!challenge) { notify('Error al verificar', true); setSaving(false); return }
    const { error } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.id, code: mfaCode })
    if (error) { notify('Código incorrecto. Inténtalo de nuevo.', true) }
    else {
      setMfaStep('done')
      setMfaFactors(f => [...f, { id: mfaFactorId, friendly_name: 'Authenticator App', status: 'verified' }])
      notify('Verificación en dos pasos activada correctamente')
    }
    setSaving(false)
  }

  const handleMfaUnenroll = async (factorId: string) => {
    const supabase = createClient()
    await supabase.auth.mfa.unenroll({ factorId })
    setMfaFactors(f => f.filter(x => x.id !== factorId))
    notify('Verificación en dos pasos desactivada')
  }

  if (isBlocked) return null

  // ─── Skeleton ─────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar"><div className="topbar-title">Configuración</div></div>
        <div className="page-content">
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div style={{ width: 200, flexShrink: 0 }}>
              {[80, 60, 70, 55, 65, 50, 60, 55].map((w, i) => (
                <div key={i} style={{ height: 32, marginBottom: 4, borderRadius: 6, background: 'var(--ivory)', width: `${w}%` }} />
              ))}
            </div>
            <div style={{ flex: 1 }}>
              <div className="card"><div className="card-body" style={{ height: 120, background: 'var(--cream)' }} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Configuración</div>
        </div>
        <div className="page-content">

          {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}
          {error   && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{error}</div>}

          {/* ── Two-column layout ── */}
          <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>

            {/* ── LEFT NAV ── */}
            <nav style={{
              width: 200, flexShrink: 0, position: 'sticky', top: 24,
            }}>
              {navGroups.map(group => (
                <div key={group.group} style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                    color: 'var(--warm-gray)', textTransform: 'uppercase',
                    padding: '0 10px', marginBottom: 4,
                  }}>
                    {group.group}
                  </div>
                  {group.items.map(item => {
                    const active = activeSection === item.key
                    return (
                      <button
                        key={item.key}
                        onClick={() => setActiveSection(item.key)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 9,
                          width: '100%', padding: '7px 10px', height: 34,
                          border: 'none', borderRadius: 6, cursor: 'pointer',
                          fontSize: 13, fontWeight: active ? 600 : 400,
                          textAlign: 'left',
                          borderLeft: active ? '3px solid var(--gold)' : '3px solid transparent',
                          background: active ? 'var(--cream)' : 'transparent',
                          color: active ? 'var(--espresso)' : 'var(--charcoal)',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--ivory)'
                        }}
                        onMouseLeave={e => {
                          if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                        }}
                      >
                        <span style={{ color: active ? 'var(--gold)' : 'var(--warm-gray)', display: 'flex' }}>
                          {item.icon}
                        </span>
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              ))}
            </nav>

            {/* ── RIGHT CONTENT ── */}
            <div style={{ flex: 1, maxWidth: 620, minWidth: 0 }}>

              {/* ════════════════════════════════════════════════════════
                  PERFIL
              ════════════════════════════════════════════════════════ */}
              {activeSection === 'perfil' && (
                <>
                  {/* Completeness bar */}
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-body" style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--charcoal)' }}>
                          Tu perfil está{' '}
                          <span style={{ color: completenessColor, fontWeight: 700 }}>{completenessPercent}% completo</span>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{completenessCount}/{completenessItems.length} campos</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 4, background: 'var(--ivory)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 4,
                          width: `${completenessPercent}%`,
                          background: completenessColor,
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                    </div>
                  </div>

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
                          Para cambiarlo contacta soporte.
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

                    {/* Venue info box */}
                    <div style={{
                      padding: '12px 14px', borderRadius: 8,
                      background: 'var(--cream)', border: '1px solid var(--ivory)',
                      marginBottom: 16,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>
                        Venue asignado
                      </div>
                      {profile?.wp_venue_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CheckCircle2 size={13} style={{ color: '#22c55e' }} />
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--espresso)' }}>
                            WordPress ID #{profile.wp_venue_id}
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <AlertTriangle size={13} style={{ color: '#f59e0b' }} />
                          <span style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Sin asignar — contacta con tu gestor</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <button className="btn btn-primary" onClick={handleSavePerfil} disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                      {profile?.updated_at && (
                        <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                          Actualizado el {new Date(profile.updated_at).toLocaleDateString('es-ES')}
                        </span>
                      )}
                    </div>
                  </Section>

                  <Section title="Correo para propuestas" description="Los emails de propuestas se enviarán desde esta cuenta. Sin configurar, se usa el servidor de Wedding Venues Spain.">
                    <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--cream)', border: '1px solid var(--ivory)', marginBottom: 16, fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.6 }}>
                      El nombre del remitente se toma automáticamente del campo <strong>Nombre del venue</strong> en <a href="/ficha" style={{ color: 'var(--gold)' }}>Mi ficha</a>.
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email de envío (From)</label>
                      <input
                        className="form-input" type="email"
                        value={smtpFromEmail}
                        onChange={e => setSmtpFromEmail(e.target.value)}
                        placeholder="eventos@tuvenue.com"
                        style={smtpFromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(smtpFromEmail) ? { borderColor: 'var(--error, #e53e3e)' } : {}}
                      />
                      {smtpFromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(smtpFromEmail)
                        ? <div style={{ fontSize: 11, color: 'var(--error, #e53e3e)', marginTop: 4 }}>Email no válido</div>
                        : <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>La pareja verá este email como remitente.</div>
                      }
                    </div>
                    <div className="two-col">
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          Servidor SMTP
                          <span title="Dirección del servidor de correo saliente. Lo encuentras en el cPanel de tu hosting. Suele ser mail.tudominio.com" style={{ cursor: 'help', color: 'var(--warm-gray)', display: 'flex' }}>
                            <Info size={12} />
                          </span>
                        </label>
                        <input
                          className="form-input"
                          value={smtpHost}
                          onChange={e => setSmtpHost(e.target.value)}
                          placeholder="mail.tuvenue.com"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          Puerto
                          <span title="465 usa SSL (recomendado). 587 usa TLS. Consulta tu hosting si no sabes cuál usar." style={{ cursor: 'help', color: 'var(--warm-gray)', display: 'flex' }}>
                            <Info size={12} />
                          </span>
                        </label>
                        <input
                          className="form-input" type="number"
                          value={smtpPort}
                          onChange={e => setSmtpPort(e.target.value)}
                          placeholder="465"
                        />
                      </div>
                    </div>
                    <div className="two-col">
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          Usuario
                          <span title="Normalmente es el mismo email completo: eventos@tuvenue.com" style={{ cursor: 'help', color: 'var(--warm-gray)', display: 'flex' }}>
                            <Info size={12} />
                          </span>
                        </label>
                        <input
                          className="form-input"
                          value={smtpUser}
                          onChange={e => setSmtpUser(e.target.value)}
                          placeholder="eventos@tuvenue.com"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Contraseña</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            className="form-input"
                            type={showSmtpPass ? 'text' : 'password'}
                            value={smtpPass}
                            onChange={e => setSmtpPass(e.target.value)}
                            placeholder="••••••••"
                            style={{ paddingRight: 40 }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowSmtpPass(v => !v)}
                            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 0 }}
                          >
                            {showSmtpPass ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--cream)', border: '1px solid var(--ivory)', marginBottom: 16, fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.6 }}>
                      Puedes encontrar estos datos en el cPanel de tu hosting, en la sección <strong>Cuentas de correo</strong>.
                    </div>
                    <button className="btn btn-primary" onClick={handleSaveSmtp} disabled={smtpSaving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center', minWidth: 160 }}>
                      {smtpSaving ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : 'Guardar configuración'}
                    </button>
                  </Section>
                </>
              )}

              {/* ════════════════════════════════════════════════════════
                  SEGURIDAD
              ════════════════════════════════════════════════════════ */}
              {activeSection === 'seguridad' && (
                <>
                  {/* A) Cambiar contraseña */}
                  <Section title="Cambiar contraseña" description="Por seguridad necesitas confirmar tu contraseña actual antes de establecer una nueva.">
                    {passSuccess && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 16px', background: '#f0fdf4',
                        border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 16,
                      }}>
                        <CheckCircle2 size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>Contraseña actualizada correctamente</div>
                          <div style={{ fontSize: 11, color: '#166534', marginTop: 1 }}>Recuerda usar la nueva contraseña la próxima vez que inicies sesión.</div>
                        </div>
                      </div>
                    )}

                    {/* Step 1 */}
                    <div style={{
                      padding: '14px 16px', background: 'var(--cream)',
                      borderRadius: 8, border: '1px solid var(--ivory)', marginBottom: 16,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                        Paso 1 — Verifica tu identidad
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Contraseña actual</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            className="form-input"
                            type={showCurrentPass ? 'text' : 'password'}
                            value={currentPass}
                            onChange={e => setCurrentPass(e.target.value)}
                            placeholder="Tu contraseña actual"
                            style={{ paddingRight: 40 }}
                            autoComplete="current-password"
                          />
                          <button type="button" onClick={() => setShowCurrentPass(p => !p)}
                            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 0 }}>
                            {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div style={{ opacity: currentPass ? 1 : 0.42, transition: 'opacity .2s', pointerEvents: currentPass ? 'auto' : 'none' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                        Paso 2 — Nueva contraseña
                      </div>
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
                            autoComplete="new-password"
                          />
                          <button type="button" onClick={() => setShowNewPass(p => !p)}
                            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 0 }}>
                            {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        {newPass && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                              {[1,2,3,4,5].map(i => (
                                <div key={i} style={{
                                  flex: 1, height: 3, borderRadius: 2, transition: 'background .2s',
                                  background: i <= passStrength ? strengthColor[passStrength] : 'var(--ivory)',
                                }} />
                              ))}
                            </div>
                            <div style={{ fontSize: 11, color: strengthColor[passStrength], display: 'flex', alignItems: 'center', gap: 5 }}>
                              {passStrength >= 3
                                ? <><CheckCircle2 size={10} /> {strengthLabel[passStrength]}</>
                                : <><XCircle size={10} /> {strengthLabel[passStrength]} — añade mayúsculas, números o símbolos</>}
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
                            placeholder="Repite la contraseña nueva"
                            style={{ paddingRight: 40 }}
                            autoComplete="new-password"
                          />
                          <button type="button" onClick={() => setShowConfirm(p => !p)}
                            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 0 }}>
                            {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        {confirmPass && newPass && (
                          <div style={{ fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4,
                            color: newPass === confirmPass ? '#22c55e' : '#ef4444' }}>
                            {newPass === confirmPass
                              ? <><CheckCircle2 size={11} /> Las contraseñas coinciden</>
                              : <><XCircle size={11} /> Las contraseñas no coinciden</>}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      className="btn btn-primary"
                      onClick={handleChangePassword}
                      disabled={saving || !currentPass || !newPass || !confirmPass || newPass !== confirmPass}
                    >
                      {saving ? 'Verificando...' : 'Actualizar contraseña'}
                    </button>
                    <div style={{ marginTop: 12, fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.6 }}>
                      ¿Olvidaste tu contraseña?{' '}
                      <a href="/login" style={{ color: 'var(--gold)' }}>
                        Cierra sesión y usa &ldquo;Recuperar contraseña&rdquo;
                      </a>
                    </div>
                  </Section>

                  {/* B) 2FA — Full implementation */}
                  <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
                      padding: '20px 24px',
                      display: 'flex', alignItems: 'center', gap: 16,
                    }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: 'rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px solid rgba(255,255,255,0.15)',
                      }}>
                        <Shield size={20} style={{ color: '#a5b4fc' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', fontFamily: 'Manrope, sans-serif' }}>
                            Verificación en dos pasos
                          </div>
                          {(mfaFactors.length > 0 || mfaStep === 'done') && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, letterSpacing: '.08em',
                              padding: '2px 7px', borderRadius: 4,
                              background: 'rgba(34,197,94,0.2)', color: '#4ade80',
                              border: '1px solid rgba(34,197,94,0.3)',
                              textTransform: 'uppercase',
                            }}>
                              ACTIVO
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                          Añade una capa extra de seguridad con una app autenticadora (Google Authenticator, Authy).
                        </div>
                      </div>
                    </div>
                    <div className="card-body" style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid var(--ivory)' }}>

                      {/* IDLE — no factors enrolled */}
                      {mfaStep === 'idle' && mfaFactors.length === 0 && (
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--charcoal)', marginBottom: 14, lineHeight: 1.6 }}>
                            Protege tu cuenta requiriendo un código de verificación adicional cada vez que inicies sesión.
                          </div>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={handleMfaEnroll}
                            disabled={mfaEnrolling}
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                          >
                            <Smartphone size={12} />
                            {mfaEnrolling ? 'Configurando...' : 'Activar verificación en dos pasos'}
                          </button>
                        </div>
                      )}

                      {/* ENROLL — show QR code */}
                      {mfaStep === 'enroll' && (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 8 }}>
                            Paso 1 — Escanea este código QR con tu app
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 12, lineHeight: 1.6 }}>
                            Abre Google Authenticator, Authy u otra app compatible y escanea el código QR.
                          </div>
                          {mfaQR && (
                            <img
                              src={mfaQR}
                              alt="Código QR para 2FA"
                              style={{ width: 180, height: 180, display: 'block', margin: '0 auto 12px', borderRadius: 8 }}
                            />
                          )}
                          {mfaSecret && (
                            <div style={{
                              padding: '8px 12px', borderRadius: 6, background: 'var(--cream)',
                              border: '1px solid var(--ivory)', marginBottom: 16,
                              fontFamily: 'monospace', fontSize: 12, letterSpacing: '.08em',
                              color: 'var(--charcoal)', textAlign: 'center',
                            }}>
                              Clave manual: {mfaSecret}
                            </div>
                          )}
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 8 }}>
                            Paso 2 — Introduce el código de verificación
                          </div>
                          <div className="form-group" style={{ marginBottom: 12 }}>
                            <input
                              className="form-input"
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              value={mfaCode}
                              onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                              placeholder="000000"
                              style={{ maxWidth: 200, letterSpacing: '.2em', fontSize: 18, textAlign: 'center' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={handleMfaVerify}
                              disabled={saving || mfaCode.length < 6}
                            >
                              {saving ? 'Verificando...' : 'Verificar y activar'}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => { setMfaStep('idle'); setMfaQR(''); setMfaSecret(''); setMfaCode('') }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* DONE or active factors */}
                      {(mfaStep === 'done' || mfaFactors.length > 0) && (
                        <div>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '12px 14px', background: '#f0fdf4',
                            border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 12,
                          }}>
                            <CheckCircle2 size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>
                              Verificación en dos pasos activa
                            </div>
                          </div>
                          {mfaFactors.map(factor => (
                            <div key={factor.id} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '10px 12px', borderRadius: 8,
                              background: 'var(--cream)', border: '1px solid var(--ivory)', marginBottom: 8,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Smartphone size={14} style={{ color: 'var(--gold)' }} />
                                <span style={{ fontSize: 13, color: 'var(--charcoal)' }}>
                                  {factor.friendly_name || 'Authenticator App'}
                                </span>
                              </div>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleMfaUnenroll(factor.id)}
                              >
                                Desactivar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* C) Sessions */}
                  <Section title="Sesiones y acceso" description="Dispositivos donde tienes la sesión iniciada.">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0 14px' }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 9, background: 'var(--cream)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        border: '1px solid var(--ivory)',
                      }}>
                        <Smartphone size={16} style={{ color: 'var(--gold)' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)' }}>Sesión actual</span>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                          <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 500 }}>Activo ahora</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>
                          Navegador web
                          {user?.last_sign_in_at && (
                            <> · Último acceso: {new Date(user.last_sign_in_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</>
                          )}
                        </div>
                      </div>
                      <span className="badge badge-active">Esta sesión</span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 5 }}
                        onClick={async () => {
                          const supabase = createClient()
                          localStorage.removeItem('wvs_session_expiry')
                          localStorage.removeItem('wvs_session_duration')
                          await supabase.auth.signOut()
                        }}
                      >
                        <LogOut size={11} /> Cerrar sesión ahora
                      </button>
                    </div>
                  </Section>

                  {/* D) Session duration */}
                  <Section title="Duración de sesión" description="Por defecto las sesiones se mantienen 7 días. Ajústalo según tus preferencias de seguridad.">
                    <div className="form-group">
                      <label className="form-label">Mantener sesión iniciada</label>
                      <select
                        className="form-input"
                        value={sessionDuration}
                        onChange={e => setSessionDuration(e.target.value)}
                        style={{ maxWidth: 320 }}
                      >
                        <option value="1d">1 día — máxima seguridad</option>
                        <option value="7d">7 días — recomendado</option>
                        <option value="30d">30 días — cómodo</option>
                        <option value="90d">90 días — mínima fricción</option>
                        <option value="forever">Sin límite — hasta cerrar sesión manualmente</option>
                      </select>
                      <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 6, lineHeight: 1.6 }}>
                        {sessionDuration === '1d'     && 'Necesitarás iniciar sesión cada día.'}
                        {sessionDuration === '7d'     && 'Recomendado para la mayoría de usuarios.'}
                        {sessionDuration === '30d'    && 'Buena opción si usas el portal habitualmente.'}
                        {sessionDuration === '90d'    && 'Cómodo para dispositivos personales de confianza.'}
                        {sessionDuration === 'forever' && 'Solo cierra sesión si lo haces manualmente. No recomendado en dispositivos compartidos.'}
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={handleSaveSession} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={12} /> Guardar preferencia
                    </button>
                  </Section>
                </>
              )}

              {/* ════════════════════════════════════════════════════════
                  PREFERENCIAS
              ════════════════════════════════════════════════════════ */}
              {activeSection === 'preferencias' && (
                <>
                  {/* A) Localización */}
                  <Section title="Localización" description="Configura tu zona horaria, idioma y formato de fecha.">
                    <div className="form-group">
                      <label className="form-label">Zona horaria</label>
                      <Select value={timezone} onValueChange={(v) => setTimezone(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Europe/Madrid">Europe/Madrid (GMT+1/+2)</SelectItem>
                          <SelectItem value="Europe/London">Europe/London (GMT+0/+1)</SelectItem>
                          <SelectItem value="America/New_York">America/New_York (GMT-5/-4)</SelectItem>
                          <SelectItem value="America/Mexico_City">America/Mexico_City (GMT-6/-5)</SelectItem>
                          <SelectItem value="America/Argentina/Buenos_Aires">America/Buenos_Aires (GMT-3)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="two-col">
                      <div className="form-group">
                        <label className="form-label">Idioma</label>
                        <Select value={language} onValueChange={(v) => setLanguage(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="es">Español</SelectItem>
                            <SelectItem value="en" disabled>English (próximamente)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Formato de fecha</label>
                        <Select value={dateFormat} onValueChange={(v) => setDateFormat(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DD/MM/YYYY">DD/MM/AAAA</SelectItem>
                            <SelectItem value="MM/DD/YYYY">MM/DD/AAAA</SelectItem>
                            <SelectItem value="YYYY-MM-DD">AAAA-MM-DD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={handleSavePreferences} disabled={saving}>
                      {saving ? 'Guardando...' : 'Guardar preferencias'}
                    </button>
                  </Section>

                  {/* B) Apariencia */}
                  <Section title="Apariencia" description="Personaliza el aspecto visual del portal.">
                    <label className="form-label" style={{ marginBottom: 12, display: 'block' }}>Tema</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {([
                        { value: 'light' as Theme, label: 'Light', preview: '#f8f5f0', border: '#d4c5a9', hint: 'Siempre claro' },
                        { value: 'dark'  as Theme, label: 'Dark',  preview: '#1e1b18', border: '#3d3530', hint: 'Siempre oscuro' },
                        { value: 'auto'  as Theme, label: 'Auto',  preview: 'linear-gradient(135deg, #f8f5f0 50%, #1e1b18 50%)', border: '#c4b89a', hint: 'Sigue el sistema' },
                      ]).map(opt => {
                        const selected = theme === opt.value
                        return (
                          <div
                            key={opt.value}
                            onClick={() => setTheme(opt.value)}
                            style={{
                              flex: 1, padding: '12px 10px', borderRadius: 9, cursor: 'pointer',
                              border: `2px solid ${selected ? 'var(--gold)' : 'var(--ivory)'}`,
                              background: selected ? 'var(--cream)' : 'transparent',
                              textAlign: 'center',
                              transition: 'border-color 0.15s, background 0.15s',
                            }}
                          >
                            <div style={{
                              width: 40, height: 26, borderRadius: 5, margin: '0 auto 8px',
                              background: opt.preview, border: `1px solid ${opt.border}`,
                            }} />
                            <div style={{ fontSize: 12, fontWeight: selected ? 600 : 400, color: 'var(--charcoal)' }}>
                              {opt.label}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 2 }}>{opt.hint}</div>
                            {selected && (
                              <div style={{ marginTop: 5, fontSize: 10, color: 'var(--gold)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                                <CheckCircle2 size={10} /> Activo
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </Section>
                </>
              )}

              {/* ════════════════════════════════════════════════════════
                  PRIVACIDAD Y DATOS
              ════════════════════════════════════════════════════════ */}
              {activeSection === 'privacidad' && (
                <>
                  {/* A) Tus datos */}
                  <Section title="Tus datos" description="Derechos RGPD — acceso y portabilidad de datos.">
                    <div style={{
                      padding: '12px 14px', background: '#eff6ff',
                      border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 16,
                    }}>
                      <div style={{ fontSize: 12, color: '#1d4ed8', lineHeight: 1.6 }}>
                        Tienes derecho a acceder y exportar todos tus datos personales almacenados en nuestra plataforma.
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 8 }}>
                        Datos que guardamos:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {['Perfil de venue', 'Leads recibidos', 'Propuestas enviadas', 'Historial de sesiones', 'Preferencias'].map(item => (
                          <span key={item} style={{
                            fontSize: 11, padding: '3px 10px', borderRadius: 5,
                            background: 'var(--cream)', border: '1px solid var(--ivory)',
                            color: 'var(--charcoal)',
                          }}>
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    {dataExportRequested ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 16px', background: '#f0fdf4',
                        border: '1px solid #bbf7d0', borderRadius: 8,
                      }}>
                        <CheckCircle2 size={15} style={{ color: '#16a34a', flexShrink: 0 }} />
                        <div style={{ fontSize: 12, color: '#15803d' }}>
                          Solicitud procesada. Recibirás un email en las próximas 24 horas con tus datos.
                        </div>
                      </div>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={handleDataExport}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Download size={13} /> Exportar mis datos
                      </button>
                    )}
                  </Section>

                  {/* B) Consentimientos */}
                  <Section title="Consentimientos" description="Gestiona tus preferencias de privacidad y comunicaciones.">
                    <NotifRow
                      label="Cookies analíticas"
                      description="Nos ayuda a mejorar la plataforma con datos de uso anónimos"
                      value={analyticsConsent}
                      onChange={v => {
                        setAnalyticsConsent(v)
                        localStorage.setItem('wvs_analytics_consent', v.toString())
                      }}
                    />
                    <NotifRow
                      label="Comunicaciones de marketing"
                      description="Novedades de la plataforma, consejos y actualizaciones del sector"
                      value={notif.marketing}
                      onChange={v => setNotif(n => ({ ...n, marketing: v }))}
                    />
                    <div style={{ paddingTop: 14, display: 'flex', gap: 16 }}>
                      <a href="/privacidad" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        Ver política de privacidad <ExternalLink size={11} />
                      </a>
                      <a href="/cookies" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        Ver política de cookies <ExternalLink size={11} />
                      </a>
                    </div>
                  </Section>

                  {/* C) Eliminar cuenta */}
                  <div className="card" style={{ borderColor: 'rgba(239,68,68,0.25)' }}>
                    <div className="card-header" style={{ background: 'rgba(239,68,68,0.04)' }}>
                      <div className="card-title" style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ShieldAlert size={14} /> Zona de peligro
                      </div>
                    </div>
                    <div className="card-body">
                      <div style={{
                        marginBottom: 16, padding: 14,
                        background: 'rgba(239,68,68,0.04)',
                        borderRadius: 8, border: '1px solid rgba(239,68,68,0.15)',
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 6 }}>
                          Eliminar cuenta permanentemente
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.7 }}>
                          Esta acción es <strong>irreversible</strong>. Se eliminarán todos tus leads, propuestas, configuración y datos del portal.
                          Tu ficha publicada en Wedding Venues Spain <strong>no se verá afectada</strong>.
                        </div>
                      </div>
                      {!showDeleteConfirm ? (
                        <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteConfirm(true)}>
                          Solicitar eliminación de cuenta
                        </button>
                      ) : (
                        <div style={{ padding: 16, background: 'rgba(239,68,68,0.06)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 10 }}>
                            ¿Estás seguro? Esta acción no se puede deshacer.
                          </div>
                          <div className="form-group" style={{ marginBottom: 12 }}>
                            <label className="form-label" style={{ color: '#dc2626' }}>
                              Escribe <strong>ELIMINAR</strong> para confirmar
                            </label>
                            <input
                              className="form-input"
                              value={deleteText}
                              onChange={e => setDeleteText(e.target.value)}
                              placeholder="ELIMINAR"
                              style={{ borderColor: deleteText === 'ELIMINAR' ? '#dc2626' : undefined }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={handleDeleteAccount}
                              disabled={deleteText !== 'ELIMINAR' || saving}
                            >
                              {saving ? 'Enviando solicitud...' : 'Confirmar eliminación'}
                            </button>
                            <button className="btn btn-ghost btn-sm"
                              onClick={() => { setShowDeleteConfirm(false); setDeleteText('') }}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ════════════════════════════════════════════════════════
                  PLAN Y USO
              ════════════════════════════════════════════════════════ */}
              {activeSection === 'plan' && (
                <>
                  {/* Trial banner */}
                  {features.isTrial && (
                    <div style={{
                      marginBottom: 16, padding: '16px 20px', borderRadius: 10,
                      background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                      border: '1px solid #334155',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <Clock size={16} style={{ color: '#fcd34d' }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc', fontFamily: 'Manrope, sans-serif' }}>
                          Período de prueba activo
                        </span>
                        {features.trialDaysLeft !== null && (
                          <span style={{
                            marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                            background: features.trialDaysLeft <= 3 ? '#7f1d1d' : features.trialDaysLeft <= 7 ? '#78350f' : '#1e3a5f',
                            color: features.trialDaysLeft <= 3 ? '#fca5a5' : features.trialDaysLeft <= 7 ? '#fcd34d' : '#93c5fd',
                          }}>
                            {features.trialDaysLeft > 0 ? `${features.trialDaysLeft} días restantes` : 'Trial expirado'}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14, lineHeight: 1.6 }}>
                        Estás usando el portal con acceso completo durante el período de prueba.
                        Cuando expire, necesitarás activar un plan para continuar.
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 160, padding: 12, background: '#1e3a5f', borderRadius: 8, border: '1px solid #1d4ed8' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', marginBottom: 4 }}>PLAN BÁSICO</div>
                          <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>Ficha, leads y calendario. Ideal para empezar.</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 160, padding: 12, background: 'linear-gradient(135deg, #451a03, #78350f)', borderRadius: 8, border: '1px solid #b45309' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#fcd34d', marginBottom: 4 }}>✦ PLAN PREMIUM</div>
                          <div style={{ fontSize: 12, color: '#fef3c7', lineHeight: 1.5 }}>Propuestas, comunicación, estadísticas y más.</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>
                        Para activar tu plan contacta con tu gestor o escríbenos a{' '}
                        <a href="mailto:hola@weddingvenuesspain.com" style={{ color: '#93c5fd' }}>hola@weddingvenuesspain.com</a>
                      </div>
                    </div>
                  )}

                  {/* A) Plan actual */}
                  <Section title="Plan actual" description="Tu suscripción a Wedding Venues Spain Partner Portal.">
                    {features.hasPlan ? (
                      <>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: 16, borderRadius: 8, marginBottom: 20, flexWrap: 'wrap', gap: 12,
                          background: features.planTier === 'premium' ? 'linear-gradient(135deg, #fef9ec, #fef3c7)' : 'var(--cream)',
                          border: features.planTier === 'premium' ? '1px solid #fde68a' : '1px solid var(--ivory)',
                        }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              {features.planTier === 'premium' && <Star size={14} style={{ color: '#b45309' }} />}
                              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--espresso)', fontFamily: 'Manrope, sans-serif' }}>
                                {features.planName || (features.planTier === 'premium' ? 'Plan Premium' : 'Plan Básico')}
                              </div>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>
                              {features.isTrial
                                ? `Período de prueba${features.trialDaysLeft !== null ? ` · ${features.trialDaysLeft} días restantes` : ''}`
                                : profile?.subscription_status === 'active' ? 'Suscripción activa' : 'Suscripción pausada'}
                            </div>
                          </div>
                          <span className={`badge ${features.isTrial ? 'badge-pending' : 'badge-active'}`}>
                            {features.isTrial ? 'Trial' : 'Activo'}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 }}>
                          {[
                            { label: 'Mi ficha',           ok: features.ficha },
                            { label: 'Leads',              ok: features.leads },
                            { label: 'Calendario',         ok: features.calendario },
                            { label: 'Exportar leads',     ok: features.leads_export },
                            { label: 'Propuestas',         ok: features.propuestas },
                            { label: 'Comunicación',       ok: features.comunicacion },
                            { label: 'Estadísticas',       ok: features.estadisticas },
                            { label: 'Soporte prioritario', ok: features.planTier === 'premium' },
                          ].map(item => (
                            <div key={item.label} style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '7px 10px', borderRadius: 6,
                              background: item.ok ? 'var(--cream)' : 'var(--ivory)',
                              opacity: item.ok ? 1 : 0.55,
                            }}>
                              {item.ok
                                ? <CheckCircle2 size={13} style={{ color: '#22c55e', flexShrink: 0 }} />
                                : <XCircle     size={13} style={{ color: '#9ca3af', flexShrink: 0 }} />}
                              <span style={{ fontSize: 12, color: item.ok ? 'var(--charcoal)' : 'var(--warm-gray)' }}>{item.label}</span>
                            </div>
                          ))}
                        </div>

                        {features.planTier === 'basic' && !features.isTrial && (
                          <div style={{ padding: 14, background: 'linear-gradient(135deg, #fef9ec, #fef3c7)', borderRadius: 8, border: '1px solid #fde68a', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <Zap size={14} style={{ color: '#b45309' }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>Pasa a Premium</span>
                            </div>
                            <div style={{ fontSize: 12, color: '#b45309', lineHeight: 1.6, marginBottom: 10 }}>
                              Desbloquea propuestas digitales, estadísticas avanzadas, exportar leads y comunicación de tarifas.
                            </div>
                            <a href="mailto:hola@weddingvenuesspain.com?subject=Quiero%20pasar%20a%20Premium"
                              className="btn btn-primary btn-sm" style={{ textDecoration: 'none', display: 'inline-flex' }}>
                              Solicitar upgrade →
                            </a>
                          </div>
                        )}

                        <a href="mailto:hola@weddingvenuesspain.com?subject=Gestión%20de%20suscripción"
                          className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
                          Gestionar suscripción
                        </a>
                      </>
                    ) : (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--warm-gray)' }}>
                        <CreditCard size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                        <div style={{ fontSize: 14, marginBottom: 6 }}>Sin suscripción activa</div>
                        <div style={{ fontSize: 12, marginBottom: 16 }}>Contacta con tu gestor para activar tu plan.</div>
                        <a href="mailto:hola@weddingvenuesspain.com?subject=Activar%20plan"
                          className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                          Contactar →
                        </a>
                      </div>
                    )}
                  </Section>

                  {/* B) Comparativa de planes */}
                  <Section title="Comparativa de planes">
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--warm-gray)', fontWeight: 600, borderBottom: '2px solid var(--ivory)' }}>
                              Funcionalidad
                            </th>
                            {['Básico', 'Premium'].map(plan => {
                              const isCurrent = (plan === 'Básico' && features.planTier === 'basic') || (plan === 'Premium' && features.planTier === 'premium')
                              return (
                                <th key={plan} style={{
                                  textAlign: 'center', padding: '8px 16px',
                                  borderBottom: '2px solid var(--ivory)',
                                  color: isCurrent ? 'var(--gold)' : 'var(--charcoal)',
                                  fontWeight: 600,
                                  borderRadius: isCurrent ? '6px 6px 0 0' : undefined,
                                  background: isCurrent ? 'var(--cream)' : 'transparent',
                                }}>
                                  {plan}
                                  {isCurrent && (
                                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '.07em', marginTop: 1 }}>
                                      Tu plan actual
                                    </div>
                                  )}
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label: 'Ficha del venue',    basic: true,  premium: true  },
                            { label: 'Leads',              basic: true,  premium: true  },
                            { label: 'Calendario',         basic: true,  premium: true  },
                            { label: 'Exportar CSV',       basic: false, premium: true  },
                            { label: 'Propuestas',         basic: false, premium: true  },
                            { label: 'Comunicación',       basic: false, premium: true  },
                            { label: 'Estadísticas',       basic: false, premium: true  },
                            { label: 'Soporte prioritario', basic: false, premium: true },
                          ].map((row, i) => (
                            <tr key={row.label} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--cream)' }}>
                              <td style={{ padding: '9px 10px', color: 'var(--charcoal)', fontWeight: 400 }}>{row.label}</td>
                              {[row.basic, row.premium].map((has, ci) => (
                                <td key={ci} style={{ textAlign: 'center', padding: '9px 16px' }}>
                                  {has
                                    ? <CheckCircle2 size={14} style={{ color: '#22c55e' }} />
                                    : <span style={{ color: 'var(--stone)', fontSize: 16, lineHeight: 1 }}>—</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Section>

                  {/* C) Uso del plan */}
                  <Section title="Uso del plan" description="Actividad del mes actual en tu portal.">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {[
                        { label: 'Leads recibidos este mes', value: leadsCount, icon: <BarChart2 size={18} style={{ color: 'var(--gold)' }} /> },
                        { label: 'Propuestas enviadas',      value: proposalsCount, icon: <FileText size={18} style={{ color: 'var(--gold)' }} /> },
                      ].map(stat => (
                        <div key={stat.label} style={{
                          padding: '16px 18px', borderRadius: 10,
                          background: 'var(--cream)', border: '1px solid var(--ivory)',
                          display: 'flex', alignItems: 'center', gap: 14,
                        }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                            background: 'var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {stat.icon}
                          </div>
                          <div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--espresso)', fontFamily: 'Manrope, sans-serif', lineHeight: 1 }}>
                              {stat.value === null ? '—' : stat.value}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{stat.label}</div>
                            <div style={{ fontSize: 10, color: 'var(--stone)', marginTop: 1 }}>Ilimitado</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                </>
              )}

              {/* ════════════════════════════════════════════════════════
                  FACTURACIÓN
              ════════════════════════════════════════════════════════ */}
              {activeSection === 'facturacion' && (
                <>
                  <Section title="Resumen de facturación" description="Historial de pagos y eventos de tu suscripción.">
                    {!paymentsLoaded ? (
                      <div style={{ color: 'var(--warm-gray)', fontSize: 13, padding: '20px 0' }}>Cargando historial...</div>
                    ) : payments.length === 0 ? (
                      <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--warm-gray)' }}>
                        <Receipt size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                        <div style={{ fontSize: 13 }}>No hay registros de facturación todavía.</div>
                        <div style={{ fontSize: 11, marginTop: 4 }}>Los pagos registrados por tu gestor aparecerán aquí.</div>
                      </div>
                    ) : (
                      <div>
                        {payments.map(ev => {
                          const eventLabels: Record<string, string> = {
                            payment: 'Pago recibido', trial_started: 'Trial iniciado',
                            activated: 'Suscripción activada', plan_changed: 'Cambio de plan',
                            cancelled: 'Cancelación', reactivated: 'Reactivación', note: 'Nota',
                          }
                          const eventColors: Record<string, string> = {
                            payment: '#22c55e', trial_started: '#b45309', activated: '#22c55e',
                            plan_changed: '#3b82f6', cancelled: '#ef4444', reactivated: '#22c55e', note: '#6b7280',
                          }
                          const color = eventColors[ev.event_type] || '#6b7280'
                          return (
                            <div key={ev.id} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--ivory)', alignItems: 'flex-start' }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 5, flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)' }}>
                                    {eventLabels[ev.event_type] || ev.event_type}
                                  </span>
                                  {ev.amount != null && (
                                    <span style={{ fontSize: 13, fontWeight: 600, color: ev.amount > 0 ? '#22c55e' : 'var(--warm-gray)', whiteSpace: 'nowrap' }}>
                                      {ev.amount > 0 ? `${ev.amount}€` : 'Sin cargo'}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>
                                  {new Date(ev.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                                  {ev.reference && <span> · Ref: {ev.reference}</span>}
                                </div>
                                {ev.notes && <div style={{ fontSize: 11, color: 'var(--stone)', marginTop: 3, fontStyle: 'italic' }}>{ev.notes}</div>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </Section>

                  <Section title="Forma de pago" description="Método de pago asociado a tu suscripción.">
                    <div style={{ padding: '10px 0', fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.7 }}>
                      Los pagos se gestionan mediante domiciliación bancaria (SEPA) o transferencia.
                      Para actualizar tu método de pago contacta con tu gestor.
                    </div>
                    <a href="mailto:hola@weddingvenuesspain.com?subject=Actualizar%20método%20de%20pago"
                      className="btn btn-ghost btn-sm" style={{ marginTop: 8, textDecoration: 'none' }}>
                      Contactar para actualizar →
                    </a>
                  </Section>
                </>
              )}

              {/* ════════════════════════════════════════════════════════
                  NOTIFICACIONES
              ════════════════════════════════════════════════════════ */}
              {activeSection === 'notificaciones' && (
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

              {/* ════════════════════════════════════════════════════════
                  SOPORTE Y AYUDA
              ════════════════════════════════════════════════════════ */}
              {activeSection === 'soporte' && (
                <>
                  {/* A) Contactar soporte */}
                  <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--gold)' }}>
                    <div className="card-body" style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                        <div style={{
                          width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                          background: 'linear-gradient(135deg, #fef9ec, #fde68a)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1px solid #fde68a',
                        }}>
                          <Mail size={18} style={{ color: '#b45309' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--espresso)', fontFamily: 'Manrope, sans-serif', marginBottom: 4 }}>
                            ¿Tienes alguna duda?
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.6, marginBottom: 14 }}>
                            Nuestro equipo está disponible para ayudarte con cualquier consulta sobre el portal.
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Mail size={13} style={{ color: 'var(--gold)' }} />
                            hola@weddingvenuesspain.com
                          </div>
                          <a
                            href="mailto:hola@weddingvenuesspain.com?subject=Consulta%20desde%20el%20Portal"
                            className="btn btn-primary btn-sm"
                            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          >
                            <Mail size={12} /> Enviar mensaje
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* B) Estado del sistema */}
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-body" style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 0 3px rgba(34,197,94,0.2)' }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)' }}>Todos los sistemas operativos</div>
                            <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>
                              Todos los servicios funcionan con normalidad
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowStatusHistory(v => !v)}
                          style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                        >
                          Ver historial <ChevronRight size={11} style={{ transform: showStatusHistory ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                        </button>
                      </div>
                      {showStatusHistory && (
                        <div style={{ marginTop: 14, borderTop: '1px solid var(--ivory)', paddingTop: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                            Historial de incidencias
                          </div>
                          {[
                            { date: '02 ene 2025', status: 'Sin incidencias', desc: 'Todos los sistemas operativos' },
                            { date: '15 dic 2024', status: 'Sin incidencias', desc: 'Todos los sistemas operativos' },
                            { date: '01 dic 2024', status: 'Mantenimiento programado completado', desc: 'Portal y API' },
                          ].map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: i < 2 ? '1px solid var(--ivory)' : 'none' }}>
                              <CircleCheckBig size={13} style={{ flexShrink: 0, color: '#22c55e' }} />
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--charcoal)' }}>{item.status}</div>
                                <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>
                                  {item.date} — {item.desc}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* C) Recursos */}
                  <Section title="Recursos útiles">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                      {[
                        { icon: <BookOpen size={22} />, label: 'Guía de inicio',    hint: 'Empieza aquí', href: '/guias', available: true },
                        { icon: <Video size={22} />, label: 'Video tutoriales',  hint: 'Aprende rápido', href: '#', available: false },
                        { icon: <MessageCircle size={22} />, label: 'Comunidad',         hint: 'Conecta con venues', href: '#', available: false },
                      ].map(resource => (
                        <div
                          key={resource.label}
                          onClick={() => resource.available && (window.location.href = resource.href)}
                          style={{
                            padding: '14px 12px', borderRadius: 9,
                            background: 'var(--cream)', border: '1px solid var(--ivory)',
                            opacity: resource.available ? 1 : 0.6,
                            cursor: resource.available ? 'pointer' : 'default',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ marginBottom: 6, color: 'var(--charcoal)' }}>{resource.icon}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 3 }}>{resource.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 8 }}>{resource.hint}</div>
                          {!resource.available && <ComingSoonBadge />}
                        </div>
                      ))}
                    </div>
                  </Section>

                  {/* D) Versión */}
                  <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--stone)', padding: '12px 0 4px' }}>
                    Wedding Venues Spain Partner Portal v2.0 · © 2025
                  </div>
                </>
              )}

            </div>
            {/* end right column */}
          </div>
          {/* end two-col */}

        </div>
      </div>
    </div>
  )
}

export default function PerfilPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <PerfilPageContent />
    </Suspense>
  )
}

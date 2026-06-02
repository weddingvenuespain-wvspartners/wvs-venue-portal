'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { usePlanFeatures } from '@/lib/use-plan-features'
import { Users, TrendingUp, CheckCircle, ExternalLink, AlertCircle, ClipboardList, Building2, CreditCard, Clock, UserPlus, BarChart2, Hourglass, UserRoundPlus, CalendarDays, Sparkles, PartyPopper, Bell, PlusCircle, Heart } from 'lucide-react'

function Skeleton({ w, h, radius = 4 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{
      width: w || '100%', height: h || 14, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--ivory) 25%, var(--cream) 50%, var(--ivory) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard() {
  const [stats, setStats]   = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [wpStats, setWpStats] = useState<{ total: number; new: number; contacted: number; accepted: number }>({ total: 0, new: 0, contacted: 0, accepted: 0 })

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => { setError('No se pudieron cargar las estadísticas'); setLoading(false) })

    // Fetch WP peticiones stats
    const supabase = createClient()
    supabase.from('leads').select('planner_status', { count: 'exact' })
      .eq('wants_wedding_planner', true)
      .then(({ data }) => {
        if (data) {
          setWpStats({
            total: data.length,
            new: data.filter((l: any) => !l.planner_status || l.planner_status === 'new').length,
            contacted: data.filter((l: any) => l.planner_status === 'contacted').length,
            accepted: data.filter((l: any) => l.planner_status === 'accepted').length,
          })
        }
      })
  }, [])

  const kpis = stats ? [
    { label: 'Venues registrados', value: stats.total,   sub: 'Total en la plataforma',  color: 'var(--gold)',    icon: <Building2 size={18} /> },
    { label: 'Suscripciones activas', value: stats.active, sub: 'Pagando actualmente',   color: '#5C7E64',        icon: <CheckCircle size={18} /> },
    { label: 'En período de trial',   value: stats.trial,  sub: stats.expiringSoon?.length > 0 ? `${stats.expiringSoon.length} expiran en 7d` : 'Probando la plataforma', color: '#AC8B4C', icon: <Clock size={18} /> },
    { label: 'Sin plan activo',       value: stats.noPlan, sub: 'Pendientes de activar', color: stats.noPlan > 0 ? '#BC5249' : 'var(--warm-gray)', icon: <AlertCircle size={18} /> },
  ] : []

  const SUB_BADGE: Record<string, string> = {
    active: 'badge-active', trial: 'badge-pending', paused: 'badge-inactive',
    cancelled: 'badge-inactive', expired: 'badge-inactive',
  }
  const SUB_LABEL: Record<string, string> = {
    active: 'Activo', trial: 'Trial', paused: 'Pausado',
    cancelled: 'Cancelado', expired: 'Expirado',
  }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div>
            <div className="topbar-title">Panel de Control</div>
            <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>FOREVENTOS — Visión general</div>
          </div>
          <Link href="/admin" className="btn btn-primary btn-sm">
            <UserPlus size={13} /> Nuevo venue
          </Link>
        </div>

        <div className="page-content">
          {error && (
            <div className="alert alert-warning" style={{ marginBottom: 16 }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* KPI Cards */}
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            {loading ? [1,2,3,4].map(i => (
              <div key={i} className="stat-card">
                <Skeleton w="60%" h={10} /><Skeleton w="40%" h={28} radius={6} /><Skeleton w="70%" h={9} />
              </div>
            )) : kpis.map((k, i) => (
              <div key={i} className={`stat-card ${i === 0 ? 'accent' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="stat-label">{k.label}</div>
                  <div style={{ color: k.color, opacity: 0.7 }}>{k.icon}</div>
                </div>
                <div className="stat-value" style={{ color: k.color }}>{k.value}</div>
                <div className="stat-sub" style={{ color: k.color === '#BC5249' && (k.value as number) > 0 ? '#BC5249' : undefined }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {[
                  { href: '/admin',            icon: <Users size={15} />,     label: 'CRM',            sub: 'Gestionar usuarios'    },
                  { href: '/admin/plans',       icon: <CreditCard size={15} />, label: 'Planes',        sub: 'Precios y funciones'   },
                  { href: '/admin/onboarding',  icon: <ClipboardList size={15} />, label: 'Solicitudes', sub: 'Revisar registros'    },
                  { href: '/admin/wedding-planners', icon: <Heart size={15} />, label: 'Peticiones WP', sub: `${wpStats.new} nuevas` },
                ].map((item, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <Link href={item.href}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, padding: '4px 0', textDecoration: 'none' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', flexShrink: 0 }}>
                        {item.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--charcoal)' }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{item.sub}</div>
                      </div>
                    </Link>
                    {i < arr.length - 1 && <div style={{ width: 1, height: 36, background: 'var(--ivory)', margin: '0 12px', flexShrink: 0 }} />}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="two-col" style={{ marginBottom: 16 }}>
            {/* Trials expirando */}
            <div className="card">
              <div className="card-header">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Hourglass size={14} /> Trials expirando</div>
                <Link href="/admin" style={{ fontSize: 11, color: 'var(--gold)' }}>Ver todos →</Link>
              </div>
              {loading ? (
                <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1,2,3].map(i => <Skeleton key={i} h={36} radius={6} />)}
                </div>
              ) : !stats?.expiringSoon?.length ? (
                <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 13 }}>
                  <CheckCircle size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                  <div>Sin trials que expiren en los próximos 7 días</div>
                </div>
              ) : stats.expiringSoon.map((v: any) => (
                <div key={v.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--ivory)' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: v.daysLeft <= 2 ? '#F2E2E0' : '#fef9c3',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    color: v.daysLeft <= 2 ? '#B0473E' : '#7A5A2E',
                  }}>
                    {v.daysLeft}d
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.email}</div>
                  </div>
                  <Link href="/admin" style={{ fontSize: 11, color: 'var(--gold)', whiteSpace: 'nowrap' }}>Activar →</Link>
                </div>
              ))}
            </div>

            {/* Últimas altas */}
            <div className="card">
              <div className="card-header">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><UserRoundPlus size={14} /> Últimas altas</div>
                <Link href="/admin" style={{ fontSize: 11, color: 'var(--gold)' }}>Ver todos →</Link>
              </div>
              {loading ? (
                <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1,2,3].map(i => <Skeleton key={i} h={36} radius={6} />)}
                </div>
              ) : !stats?.recentSignups?.length ? (
                <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 13 }}>
                  Aún no hay venues registrados
                </div>
              ) : stats.recentSignups.map((v: any) => (
                <div key={v.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--ivory)' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: 'var(--gold)',
                  }}>
                    {(v.name?.[0] || v.email?.[0] || '?').toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                      {new Date(v.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  {v.sub_status ? (
                    <span className={`badge ${SUB_BADGE[v.sub_status] || 'badge-inactive'}`} style={{ fontSize: 10 }}>
                      {SUB_LABEL[v.sub_status] || v.sub_status}
                    </span>
                  ) : (
                    <span className="badge badge-inactive" style={{ fontSize: 10 }}>Sin plan</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Peticiones WP */}
          {wpStats.total > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Heart size={14} /> Peticiones Wedding Planner</div>
                <Link href="/admin/wedding-planners" style={{ fontSize: 11, color: 'var(--gold)' }}>Ver todas →</Link>
              </div>
              <div className="card-body" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Total', value: wpStats.total, color: '#a21caf', bg: '#F6EEF2' },
                    { label: 'Nuevas', value: wpStats.new,  color: '#4A6B52', bg: '#fdf8f4' },
                    { label: 'Contactadas', value: wpStats.contacted, color: '#4F6D8C', bg: '#EEF2F7' },
                    { label: 'Aceptadas', value: wpStats.accepted, color: '#5C7E64', bg: '#EEF2EC' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: item.bg, borderRadius: 8, flex: '1 1 120px' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: 12, color: item.color, fontWeight: 500 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Resumen de suscripciones */}
          {stats && (stats.active > 0 || stats.trial > 0) && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BarChart2 size={14} /> Resumen de suscripciones</div>
              </div>
              <div className="card-body" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Activas', value: stats.active,  color: '#5C7E64', bg: '#EEF2EC' },
                    { label: 'Trial',   value: stats.trial,   color: '#AC8B4C', bg: '#F7F3E8' },
                    { label: 'Pausadas', value: stats.paused, color: '#6b7280', bg: '#f9fafb' },
                    { label: 'Sin plan', value: stats.noPlan, color: '#BC5249', bg: '#FAF3F2' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: item.bg, borderRadius: 8, flex: '1 1 120px' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: 12, color: item.color, fontWeight: 500 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  )
}

// ─── Venue Dashboard ──────────────────────────────────────────────────────────
function VenueDashboard() {
  const router = useRouter()
  const { user, profile, activeVenue, loading: authLoading } = useAuth()
  const { hasPlan, isTrial } = usePlanFeatures()
  const [venue, setVenue]         = useState<any>(null)
  const [venueLoading, setVenueLoading] = useState(false)
  const [leads, setLeads]         = useState<any[]>([])
  const [leadsMonthCount, setLeadsMonthCount] = useState<number | null>(null)
  const [leadsLoaded, setLeadsLoaded] = useState(false)
  const [kpiNew, setKpiNew]         = useState<number | null>(null)
  const [kpiActive, setKpiActive]   = useState<number | null>(null)
  const [kpiBooked, setKpiBooked]   = useState<number | null>(null)
  const [onboarding, setOnboarding] = useState<any>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    // New user (Google OAuth or email): no profile row yet → go to onboarding
    if (profile === null) {
      router.replace('/onboarding')
      return
    }
    // First login: profile exists but display_name is not set → go to onboarding
    if (!profile.display_name) {
      router.replace('/onboarding')
      return
    }

    if (!activeVenue) return

    const supabase = createClient()
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    // Use venue_id for all lead queries so shared venue data is included
    const vid = activeVenue.id

    // Fetch last 5 leads for the list
    supabase.from('leads').select('*').eq('venue_id', vid)
      .order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => { if (data) setLeads(data); setLeadsLoaded(true) })

    // KPI counts (independent queries — must NOT be derived from the limit(5) list above)
    supabase.from('leads').select('id', { count: 'exact', head: true })
      .eq('venue_id', vid).gte('created_at', monthStart)
      .then(({ count }) => { setLeadsMonthCount(count ?? 0) })

    supabase.from('leads').select('id', { count: 'exact', head: true })
      .eq('venue_id', vid).eq('status', 'new')
      .then(({ count }) => { setKpiNew(count ?? 0) })

    supabase.from('leads').select('id', { count: 'exact', head: true })
      .eq('venue_id', vid)
      .in('status', ['contacted', 'proposal_sent', 'visit_scheduled', 'post_visit', 'budget_sent', 'qualified', 'proposal'])
      .then(({ count }) => { setKpiActive(count ?? 0) })

    supabase.from('leads').select('id', { count: 'exact', head: true })
      .eq('venue_id', vid)
      .in('status', ['won', 'booked'])
      .then(({ count }) => { setKpiBooked(count ?? 0) })

    // Use activeVenue's wp_venue_id so switching venues updates the dashboard
    const wpVenueId = activeVenue?.wp_venue_id ?? profile?.wp_venue_id
    if (wpVenueId) {
      const cacheKey = `wvs_venue_${wpVenueId}`
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) { try { setVenue(JSON.parse(cached)) } catch {} }
      else { setVenueLoading(true) }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 6000)
      fetch(
        `https://weddingvenuesspain.com/wp-json/wp/v2/venues/${wpVenueId}?acf_format=standard`,
        { cache: 'no-store', signal: controller.signal }
      )
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) { setVenue(d); sessionStorage.setItem(cacheKey, JSON.stringify(d)) } })
        .catch(() => {})
        .finally(() => { clearTimeout(timeout); setVenueLoading(false) })
    } else {
      supabase.from('venue_onboarding').select('*').eq('user_id', user.id).single()
        .then(({ data }) => { if (data) setOnboarding(data) })
    }
  }, [authLoading, activeVenue?.id]) // eslint-disable-line

  const venueName = venue?.acf?.H1_Venue || venue?.title?.rendered || 'Mi Venue'

  const statusColors: Record<string, string> = {
    new: 'badge-new', contacted: 'badge-contacted',
    proposal_sent: 'badge-quote', visit_scheduled: 'badge-visit',
    budget_sent: 'badge-pending', won: 'badge-booked', lost: 'badge-inactive',
    qualified: 'badge-active', proposal: 'badge-quote', booked: 'badge-booked',
  }
  const statusLabels: Record<string, string> = {
    new: 'Nuevo', contacted: 'En seguimiento',
    proposal_sent: 'Propuesta enviada', visit_scheduled: 'Visita agendada',
    post_visit: 'Post-visita',
    budget_sent: 'Presupuesto enviado', won: 'Ganado', lost: 'Perdido',
    qualified: 'Cualificado', proposal: 'Propuesta', booked: 'Reservado',
  }

  if (authLoading) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar"><div className="topbar-title">Dashboard</div></div>
        <div className="page-content">
          <div className="stats-grid" style={{ marginBottom: 16 }}>
            {[1,2,3,4].map(i => (
              <div key={i} className="stat-card">
                <Skeleton w="60%" h={10} /><Skeleton w="40%" h={28} radius={6} /><Skeleton w="70%" h={9} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  )

  if (!user) return null

  // No venue assigned yet
  if (!profile?.wp_venue_id) {
    const onbStatus = onboarding?.status
    return (
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-layout">
          <div className="topbar"><div className="topbar-title">Bienvenido</div></div>
          <div className="page-content" style={{ maxWidth: 600, margin: '0 auto', paddingTop: 48 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 22, fontWeight: 500, letterSpacing: '0.01em', color: 'var(--espresso)', marginBottom: 8 }}>FOREVENTOS</div>
              <div style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Venue Portal</div>
            </div>
            {!onboarding || onbStatus === 'draft' ? (
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
                  <ClipboardList size={36} style={{ color: 'var(--gold)', margin: '0 auto 16px' }} />
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Registra tu venue</div>
                  <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 24, lineHeight: 1.7 }}>
                    Para aparecer en FOREVENTOS necesitamos la información de tu venue.
                  </div>
                  <Link href="/onboarding" className="btn btn-primary">Empezar registro →</Link>
                </div>
              </div>
            ) : onbStatus === 'submitted' ? (
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
                  <AlertCircle size={22} style={{ color: '#7A5A2E', margin: '0 auto 16px' }} />
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Solicitud en revisión</div>
                  <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.7 }}>
                    Hemos recibido la información de <strong>{onboarding.name}</strong>. Te avisaremos en 24-48 horas.
                  </div>
                </div>
              </div>
            ) : onbStatus === 'rejected' ? (
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--rose)' }}>Solicitud no aprobada</div>
                  {onboarding.admin_notes && <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 20 }}>{onboarding.admin_notes}</div>}
                  <Link href="/onboarding" className="btn btn-primary">Volver a intentarlo →</Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div>
            <div className="topbar-title">Dashboard</div>
            <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{venueName !== 'Mi Venue' ? venueName : 'Bienvenido de nuevo'}</div>
          </div>
          <Link href="/leads?new=1" className="btn btn-primary btn-sm">
            <UserPlus size={13} /> Nuevo lead
          </Link>
        </div>
        <div className="page-content">
          {kpiNew !== null && kpiNew > 0 && (
            <div className="alert alert-warning">
              <Bell size={15} style={{ flexShrink: 0 }} />
              <span><strong>{kpiNew} {kpiNew === 1 ? 'lead sin responder' : 'leads sin responder'}.</strong> <Link href="/leads?tab=new" style={{ textDecoration: 'underline' }}>Ver ahora →</Link></span>
            </div>
          )}

          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Leads este mes',    value: leadsMonthCount, href: '/leads',                   sub: new Date().toLocaleDateString('es-ES', { month: 'long' }),  alert: false, color: '#4A6B52', border: '#c8d9cc', bg: '#fff', icon: <TrendingUp size={18} /> },
              { label: 'En seguimiento',    value: kpiActive,       href: '/leads?tab=en_seguimiento', sub: 'en proceso',    alert: false, color: '#4F6D8C', border: '#c5d2e0', bg: '#fff', icon: <Users size={18} /> },
              { label: 'Sin responder',     value: kpiNew,          href: '/leads?tab=new',            sub: (kpiNew ?? 0) > 0 ? 'pendientes' : 'todo al día', alert: (kpiNew ?? 0) > 0, color: (kpiNew ?? 0) > 0 ? '#9A3530' : '#8B7355', border: (kpiNew ?? 0) > 0 ? '#e0b8b5' : '#d5cfc5', bg: '#fff', icon: <Bell size={18} /> },
              { label: 'Confirmadas',       value: kpiBooked,       href: '/leads?tab=confirmed',      sub: 'bodas cerradas',      alert: false, color: '#AC8B4C', border: '#ddd2b8', bg: '#fff', icon: <PartyPopper size={18} /> },
            ].map((k, i) => (
              <Link key={i} href={k.href}
                style={{
                  display: 'flex', flexDirection: 'column',
                  textDecoration: 'none', padding: '20px 20px 18px',
                  background: k.bg, border: `1.5px solid ${k.border}`,
                  borderRadius: 12, transition: 'transform 0.15s, box-shadow 0.15s',
                  position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>

                {/* Top row: label + icon */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: k.color,
                    letterSpacing: '0.02em', opacity: 0.8,
                  }}>{k.label}</div>
                  <div style={{ color: k.color, opacity: 0.25 }}>{k.icon}</div>
                </div>

                {/* Number */}
                <div style={{
                  fontSize: 36, fontWeight: 800, lineHeight: 1,
                  color: k.color,
                  fontVariantNumeric: 'tabular-nums',
                  marginBottom: 6,
                }}>
                  {k.value !== null ? k.value : <Skeleton w={36} h={28} radius={2} />}
                </div>

                {/* Sub */}
                <div style={{
                  fontSize: 11, color: k.color, opacity: 0.6,
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontWeight: 500,
                }}>
                  {k.alert && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9A3530', display: 'inline-block', animation: 'pulse-dot 2s infinite' }} />}
                  {k.sub}
                </div>
              </Link>
            ))}
          </div>

          {/* Quick actions */}
          {(() => {
            const actions = [
              { href: '/leads?new=1', icon: <UserPlus size={16} />,    label: 'Nuevo lead',   sub: 'Añadir manualmente'   },
              { href: '/calendar',    icon: <CalendarDays size={16} />, label: 'Calendario',   sub: 'Ver disponibilidad'   },
              { href: '/leads',       icon: <Users size={16} />,        label: 'Leads',        sub: 'Gestionar pipeline'   },
              { href: '/ficha',       icon: <TrendingUp size={16} />,   label: 'Editar ficha', sub: 'Info, fotos y precios'},
            ]
            // Show "Añadir otro venue" only when user has an active paid plan (not trial)
            if (hasPlan && !isTrial) {
              actions.push({ href: '/pricing?new_venue=1', icon: <PlusCircle size={16} />, label: 'Añadir venue', sub: 'Contratar otro venue' })
            }
            return (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${actions.length}, 1fr)`, gap: 10, marginBottom: 20 }}>
                {actions.map((item, i) => (
                  <Link key={i} href={item.href}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 15px', background: '#fff', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', transition: 'box-shadow 0.15s, border-color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{item.sub}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          })()}

          <div className="two-col" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Últimos leads</div>
                <Link href="/leads" style={{ fontSize: 11, color: 'var(--gold)' }}>Ver todos →</Link>
              </div>
              {!leadsLoaded ? (
                <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[1,2,3].map(i => <Skeleton key={i} h={36} radius={6} />)}
                </div>
              ) : leads.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 13 }}>
                  <Users size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                  <div>Aún no tienes leads.</div>
                </div>
              ) : leads.map(lead => (
                <div key={lead.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: '1px solid var(--ivory)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: lead.status === 'new' ? 'var(--gold)' : lead.status === 'booked' ? '#5C7E64' : 'var(--stone)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{lead.wedding_date ? new Date(lead.wedding_date).toLocaleDateString('es-ES') : 'Sin fecha'}{lead.guests ? ` · ${lead.guests} invitados` : ''}</div>
                  </div>
                  <span className={`badge ${statusColors[lead.status] || 'badge-inactive'}`}>{statusLabels[lead.status] || lead.status}</span>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Tu ficha en la web</div>
                <Link href="/ficha" style={{ fontSize: 11, color: 'var(--gold)' }}>Editar →</Link>
              </div>
              <div className="card-body">
                {venueLoading && !venue ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Skeleton h={140} radius={6} /><Skeleton w="70%" h={18} radius={4} /><Skeleton w="50%" h={12} radius={4} />
                  </div>
                ) : venue ? (
                  <>
                    {venue?.acf?.photo_gallery?.section_2_image?.[0]?.[0]?.full_image_url && (
                      <img src={venue.acf.photo_gallery.section_2_image[0][0].full_image_url} alt={venueName}
                        style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 6, marginBottom: 14 }} />
                    )}
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{venueName}</div>
                    {venue?.acf?.location && <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 10 }}>{venue.acf.location}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge badge-active">Publicada</span>
                      <a href={venue?.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        Ver en la web <ExternalLink size={10} />
                      </a>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 12 }}>
                    Venue #{profile?.wp_venue_id} — sin datos de WordPress
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.3)} }
      `}</style>
    </div>
  )
}

// ─── Page router ──────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, profile, loading } = useAuth()
  const { ready } = useRequireSubscription()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user]) // eslint-disable-line

  if (!ready) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--cream)' }}>
      <div style={{ width: 24, height: 24, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (profile?.role === 'admin')          return <AdminDashboard />
  if (profile?.role === 'wedding_planner') { router.replace('/wp');       return null }
  if (profile?.role === 'catering')        { router.replace('/catering'); return null }
  return <VenueDashboard />
}

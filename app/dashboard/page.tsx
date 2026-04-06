'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Users, TrendingUp, CheckCircle, ExternalLink, AlertCircle, ClipboardList, Building2, CreditCard, Clock, UserPlus, BarChart2 } from 'lucide-react'

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

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => { setError('No se pudieron cargar las estadísticas'); setLoading(false) })
  }, [])

  const kpis = stats ? [
    { label: 'Venues registrados', value: stats.total,   sub: 'Total en la plataforma',  color: 'var(--gold)',    icon: <Building2 size={18} /> },
    { label: 'Suscripciones activas', value: stats.active, sub: 'Pagando actualmente',   color: '#22c55e',        icon: <CheckCircle size={18} /> },
    { label: 'En período de trial',   value: stats.trial,  sub: stats.expiringSoon?.length > 0 ? `${stats.expiringSoon.length} expiran en 7d` : 'Probando la plataforma', color: '#f59e0b', icon: <Clock size={18} /> },
    { label: 'Sin plan activo',       value: stats.noPlan, sub: 'Pendientes de activar', color: stats.noPlan > 0 ? '#ef4444' : 'var(--warm-gray)', icon: <AlertCircle size={18} /> },
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
            <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>Wedding Venues Spain — Visión general</div>
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
                <div className="stat-sub" style={{ color: k.color === '#ef4444' && (k.value as number) > 0 ? '#ef4444' : undefined }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {[
                  { href: '/admin',            icon: <Users size={15} />,     label: 'CRM de venues',  sub: 'Gestionar usuarios'    },
                  { href: '/admin/planes',      icon: <CreditCard size={15} />, label: 'Planes',        sub: 'Precios y funciones'   },
                  { href: '/admin/onboarding',  icon: <ClipboardList size={15} />, label: 'Solicitudes', sub: 'Revisar registros'    },
                  { href: '/estadisticas',      icon: <BarChart2 size={15} />, label: 'Estadísticas',   sub: 'Métricas globales'     },
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
                <div className="card-title">⏳ Trials expirando</div>
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
                    background: v.daysLeft <= 2 ? '#fee2e2' : '#fef9c3',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    color: v.daysLeft <= 2 ? '#dc2626' : '#92400e',
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
                <div className="card-title">🆕 Últimas altas</div>
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

          {/* Revenue summary */}
          {stats && (stats.active > 0 || stats.trial > 0) && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div className="card-title">📊 Resumen de suscripciones</div>
              </div>
              <div className="card-body" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Activas', value: stats.active,  color: '#22c55e', bg: '#f0fdf4' },
                    { label: 'Trial',   value: stats.trial,   color: '#f59e0b', bg: '#fffbeb' },
                    { label: 'Pausadas', value: stats.paused, color: '#6b7280', bg: '#f9fafb' },
                    { label: 'Sin plan', value: stats.noPlan, color: '#ef4444', bg: '#fef2f2' },
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
  const { user, profile, loading: authLoading } = useAuth()
  const [venue, setVenue]         = useState<any>(null)
  const [venueLoading, setVenueLoading] = useState(false)
  const [leads, setLeads]         = useState<any[]>([])
  const [leadsLoaded, setLeadsLoaded] = useState(false)
  const [onboarding, setOnboarding] = useState<any>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    const supabase = createClient()

    supabase.from('leads').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => { if (data) setLeads(data); setLeadsLoaded(true) })

    if (profile?.wp_venue_id) {
      const cacheKey = `wvs_venue_${profile.wp_venue_id}`
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) { try { setVenue(JSON.parse(cached)) } catch {} }
      else { setVenueLoading(true) }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 6000)
      fetch(
        `https://weddingvenuesspain.com/wp-json/wp/v2/venues/${profile.wp_venue_id}?acf_format=standard`,
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
  }, [authLoading]) // eslint-disable-line

  const venueName   = venue?.acf?.H1_Venue || venue?.title?.rendered || 'Mi Venue'
  const newLeads    = leads.filter(l => l.status === 'new').length
  const activeLeads = leads.filter(l => !['won','lost','booked'].includes(l.status)).length
  const bookedLeads = leads.filter(l => l.status === 'won' || l.status === 'booked').length

  const statusColors: Record<string, string> = {
    new: 'badge-new', contacted: 'badge-contacted',
    proposal_sent: 'badge-quote', visit_scheduled: 'badge-visit',
    budget_sent: 'badge-pending', won: 'badge-booked', lost: 'badge-inactive',
    qualified: 'badge-active', proposal: 'badge-quote', booked: 'badge-booked',
  }
  const statusLabels: Record<string, string> = {
    new: 'Nuevo', contacted: 'Contactado',
    proposal_sent: 'Propuesta enviada', visit_scheduled: 'Visita agendada',
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
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: 'var(--espresso)', marginBottom: 8 }}>Wedding Venues Spain</div>
              <div style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Partner Portal</div>
            </div>
            {!onboarding || onbStatus === 'draft' ? (
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
                  <ClipboardList size={36} style={{ color: 'var(--gold)', margin: '0 auto 16px' }} />
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, marginBottom: 8 }}>Registra tu venue</div>
                  <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 24, lineHeight: 1.7 }}>
                    Para aparecer en Wedding Venues Spain necesitamos la información de tu venue.
                  </div>
                  <Link href="/onboarding" className="btn btn-primary">Empezar registro →</Link>
                </div>
              </div>
            ) : onbStatus === 'submitted' ? (
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
                  <AlertCircle size={22} style={{ color: '#92400e', margin: '0 auto 16px' }} />
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, marginBottom: 8 }}>Solicitud en revisión</div>
                  <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.7 }}>
                    Hemos recibido la información de <strong>{onboarding.name}</strong>. Te avisaremos en 24-48 horas.
                  </div>
                </div>
              </div>
            ) : onbStatus === 'rejected' ? (
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, marginBottom: 8, color: 'var(--rose)' }}>Solicitud no aprobada</div>
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
          <div className="topbar-title">Dashboard</div>
          <Link href="/leads" className="btn btn-primary btn-sm">+ Nuevo lead</Link>
        </div>
        <div className="page-content">
          {newLeads > 0 && leadsLoaded && (
            <div className="alert alert-warning">
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span><strong>{newLeads} {newLeads === 1 ? 'lead sin responder' : 'leads sin responder'}.</strong> <Link href="/leads" style={{ textDecoration: 'underline' }}>Ver ahora →</Link></span>
            </div>
          )}

          <div className="stats-grid">
            <div className="stat-card accent">
              <div className="stat-label">Leads este mes</div>
              <div className="stat-value">{leadsLoaded ? leads.length : <Skeleton w={40} h={28} radius={4} />}</div>
              <div className="stat-sub">Desde tu ficha y canales</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">En seguimiento</div>
              <div className="stat-value">{leadsLoaded ? activeLeads : <Skeleton w={30} h={28} radius={4} />}</div>
              <div className="stat-sub">Leads activos</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Sin responder</div>
              <div className="stat-value" style={{ color: newLeads > 0 ? 'var(--gold)' : undefined }}>
                {leadsLoaded ? newLeads : <Skeleton w={30} h={28} radius={4} />}
              </div>
              <div className={`stat-sub ${newLeads > 0 ? 'warn' : ''}`}>{leadsLoaded ? (newLeads > 0 ? 'Requieren atención' : 'Al día ✓') : ''}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Confirmadas</div>
              <div className="stat-value">{leadsLoaded ? bookedLeads : <Skeleton w={30} h={28} radius={4} />}</div>
              <div className="stat-sub">Bodas reservadas</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16, marginTop: 16 }}>
            <div className="card-body" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {[
                  { href: '/leads',      icon: <Users size={15} />,       label: 'Añadir lead',  sub: 'Registro manual' },
                  { href: '/calendario', icon: <CheckCircle size={15} />, label: 'Calendario',   sub: 'Visitas y bodas' },
                  { href: '/ficha',      icon: <TrendingUp size={15} />,  label: 'Editar ficha', sub: 'Info, fotos, precios' },
                  ...(venue ? [{ href: venue.link, icon: <ExternalLink size={15} />, label: 'Ficha pública', sub: 'weddingvenuesspain.com', external: true }] : []),
                ].map((item, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <Link href={item.href} target={(item as any).external ? '_blank' : undefined}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, padding: '4px 0', textDecoration: 'none' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', flexShrink: 0 }}>
                        {item.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--charcoal)' }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{item.sub}</div>
                      </div>
                    </Link>
                    {i < arr.length - 1 && <div style={{ width: 1, height: 36, background: 'var(--ivory)', margin: '0 16px', flexShrink: 0 }} />}
                  </div>
                ))}
              </div>
            </div>
          </div>

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
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: lead.status === 'new' ? 'var(--gold)' : lead.status === 'booked' ? '#22c55e' : 'var(--stone)' }} />
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
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 19, marginBottom: 4 }}>{venueName}</div>
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
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  )
}

// ─── Page router ──────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user]) // eslint-disable-line

  if (loading) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar"><div className="topbar-title">Dashboard</div></div>
        <div className="page-content">
          <div className="stats-grid">
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

  if (profile?.role === 'admin') return <AdminDashboard />
  return <VenueDashboard />
}

'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { usePlanFeatures, type PlanFeatures } from '@/lib/use-plan-features'
import { Hourglass, ChevronDown, Check } from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, profile, userVenues, activeVenue, switchVenue, refreshProfile } = useAuth()

  const features      = usePlanFeatures()
  const isAdmin       = profile?.role === 'admin'
  const isPlanner     = profile?.role === 'wedding_planner'
  const isCatering    = profile?.role === 'catering'
  const isVenueOwner  = !isAdmin && !isPlanner && !isCatering
  const isMultiVenue  = userVenues.length > 1
  const userEmail     = user?.email || ''
  const initials      = userEmail.slice(0, 2).toUpperCase()

  // Badge: new leads count (venue + catering users)
  const [venueOpen, setVenueOpen] = useState(false)

  // Silently refresh venues once on mount so switcher always has the latest list
  useEffect(() => {
    if (!user || !isVenueOwner) return
    refreshProfile()
  }, [user?.id]) // eslint-disable-line

  const handleVenueButtonClick = () => {
    setVenueOpen(o => !o)
  }
  const [newLeadsCount, setNewLeadsCount] = useState(0)
  const fetchNewLeads = () => {
    if (!user || isAdmin || isPlanner) return
    const supabase = createClient()
    let q = supabase.from('leads').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('status', 'new')
    // Multi-venue: only count leads for the active venue
    if (activeVenue?.id) q = q.eq('venue_id', activeVenue.id)
    q.then(({ count }) => setNewLeadsCount(count ?? 0))
  }
  useEffect(() => { fetchNewLeads() }, [user?.id, activeVenue?.id]) // eslint-disable-line
  // Realtime: update badge when new lead arrives
  useEffect(() => {
    if (!user || isAdmin || isPlanner) return
    const supabase = createClient()
    const channel = supabase
      .channel('sidebar-new-leads')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads', filter: `user_id=eq.${user.id}` }, () => {
        fetchNewLeads()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads', filter: `user_id=eq.${user.id}` }, () => {
        fetchNewLeads()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id]) // eslint-disable-line

  // Badge: new clients count (planner)
  const [newClientsCount, setNewClientsCount] = useState(0)
  useEffect(() => {
    if (!user || !isPlanner) return
    const supabase = createClient()
    supabase.from('wp_clients').select('id', { count: 'exact', head: true })
      .eq('planner_id', user.id)
      .then(({ count }) => { if (count) setNewClientsCount(count) })
  }, [user?.id]) // eslint-disable-line

  // Badge: pending onboarding requests (admin only)
  const [pendingOnboardingCount, setPendingOnboardingCount] = useState(0)
  const fetchPendingOnboarding = () => {
    if (!user || !isAdmin) return
    const supabase = createClient()
    supabase.from('venue_onboarding').select('id', { count: 'exact', head: true })
      .or('status.eq.submitted,changes_status.eq.submitted')
      .then(({ count }) => setPendingOnboardingCount(count ?? 0))
  }
  useEffect(() => { fetchPendingOnboarding() }, [user?.id, isAdmin]) // eslint-disable-line
  useEffect(() => {
    window.addEventListener('wvs-pending-refresh', fetchPendingOnboarding)
    return () => window.removeEventListener('wvs-pending-refresh', fetchPendingOnboarding)
  }, [user?.id, isAdmin]) // eslint-disable-line

  // Badge: new pending users count (admin CRM)
  const [pendingUsersCount, setPendingUsersCount] = useState(0)
  useEffect(() => {
    if (!user || !isAdmin) return
    const supabase = createClient()
    supabase.from('venue_profiles').select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count }) => setPendingUsersCount(count ?? 0))
  }, [user?.id, isAdmin]) // eslint-disable-line

  // Badge: new wedding planner requests (admin)
  const [wpNewCount, setWpNewCount] = useState(0)
  const fetchWpCount = () => {
    if (!user || !isAdmin) return
    const supabase = createClient()
    supabase.from('leads').select('id', { count: 'exact', head: true })
      .eq('wants_wedding_planner', true)
      .eq('planner_status', 'new')
      .then(({ count }) => setWpNewCount(count ?? 0))
  }
  useEffect(() => { fetchWpCount() }, [user?.id, isAdmin]) // eslint-disable-line
  useEffect(() => {
    window.addEventListener('wvs-wp-badge-refresh', fetchWpCount)
    return () => window.removeEventListener('wvs-wp-badge-refresh', fetchWpCount)
  }, [user?.id, isAdmin]) // eslint-disable-line

  // Close venue dropdown on outside click
  useEffect(() => {
    if (!venueOpen) return
    const close = () => setVenueOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [venueOpen])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.replace('/login')
  }

  const Icon = ({ d }: { d: string }) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d={d} />
    </svg>
  )

  // ── Nav item definitions ──────────────────────────────────────────────────────

  const venueItems: { href: string; label: string; icon: string; feature: keyof PlanFeatures }[] = [
    { href: '/canales',      label: 'Canales de venta',                               icon: 'M2 2h12v12H2zM5 6h6M5 9h4',                         feature: 'ficha'        },
    { href: '/calendario',   label: isMultiVenue ? 'Calendarios'    : 'Calendario',  icon: 'M1 4h14v10H1zM1 4V2M4 1v3M12 1v3M1 8h14',           feature: 'calendario'   },
    { href: '/leads',        label: 'Leads',                                          icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zM2 14s1-4 6-4 6 4 6 4', feature: 'leads'        },
    { href: '/proposals',    label: isMultiVenue ? 'Mis dosieres'   : 'Dosieres',    icon: 'M2 2h12v10H2zM14 8l2 4M5 6h6M5 9h4',                feature: 'propuestas'   },
    { href: '/budgets',      label: 'Presupuestos',                                     icon: 'M2 3h12v11H2zM5 1v3M11 1v3M5 7h6M5 10h3',             feature: 'presupuestos' },
    { href: '/estructura', label: 'Configuración',                                     icon: 'M1 3h14M1 7h9M1 11h5M11 9l2 2 4-4',                  feature: 'estructura'   },
    { href: '/comunicacion', label: 'Comunicación',                                   icon: 'M14 2H2v9h5l1 3 1-3h5V2zM5 6h6M5 9h3',              feature: 'comunicacion' },
  ]
  const estadisticasItem = { href: '/estadisticas', label: 'Estadísticas', icon: 'M1 13h2V7H1zM5 13h2V3H5zM9 13h2V9H9zM13 13h2V5h-2z', feature: 'estadisticas' as keyof PlanFeatures }
  const facturasItem = { href: '/facturas', label: 'Facturas', icon: 'M3 1h10v14l-2-1-2 1-2-1-2 1-2-1V1zM5 5h6M5 8h6M5 11h4' }

  const plannerItems = [
    { href: '/wp',           label: 'Dashboard',        icon: 'M1 1h6v6H1zM9 1h6v6H9zM1 9h6v6H1zM9 9h6v6H9z' },
    { href: '/wp/clients',   label: 'Mis parejas',      icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zM2 14s1-4 6-4 6 4 6 4' },
    { href: '/wp/venues',    label: 'Buscar venues',    icon: 'M2 2h12v12H2zM5 6h6M5 9h4' },
    { href: '/wp/catering',  label: 'Buscar catering',  icon: 'M5 2h6l1 4H4zM4 6c0 5 4 8 4 8s4-3 4-8' },
    { href: '/wp/branding',  label: 'Branding',         icon: 'M12 2l2 4-7 7-4-1-1-4 7-7zM2 14l2-2M9 3l2 2' },
  ]

  const cateringItems = [
    { href: '/catering',              label: 'Dashboard',     icon: 'M1 1h6v6H1zM9 1h6v6H9zM1 9h6v6H1zM9 9h6v6H9z' },
    { href: '/catering/ficha',        label: 'Mi ficha',      icon: 'M2 2h12v12H2zM5 6h6M5 9h4' },
    { href: '/catering/leads',        label: 'Solicitudes',   icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zM2 14s1-4 6-4 6 4 6 4' },
    { href: '/catering/calendario',   label: 'Calendario',    icon: 'M1 4h14v10H1zM1 4V2M4 1v3M12 1v3M1 8h14' },
    { href: '/catering/propuestas',   label: 'Propuestas',    icon: 'M2 2h12v10H2zM5 6h6M5 9h4' },
    { href: '/catering/estadisticas', label: 'Estadísticas',  icon: 'M1 13h2V7H1zM5 13h2V3H5zM9 13h2V9H9zM13 13h2V5h-2z' },
  ]

  const adminItems: { href: string; label: string; icon: string; badge?: number }[] = [
    { href: '/admin',                    label: 'CRM',             icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zM2 14s1-4 6-4 6 4 6 4', badge: pendingUsersCount },
    { href: '/admin/planes',             label: 'Planes',          icon: 'M1 4h14v8H1zM4 4V2M12 4V2M1 8h14' },
    { href: '/admin/onboarding',         label: 'Solicitudes',     icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zM2 14s1-4 6-4 6 4 6 4M12 5v4M10 7h4', badge: pendingOnboardingCount },
    { href: '/admin/wedding-planners',   label: 'Peticiones WP', icon: 'M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z', badge: wpNewCount },
  ]

  const helpItems = [
    { href: '/guias', label: 'Centro de ayuda', icon: 'M8 1a7 7 0 100 14A7 7 0 008 1zM8 6v.5M8 9.5V11' },
  ]

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && href !== '/wp' && href !== '/catering' && pathname.startsWith(href))

  const roleLabel = isAdmin ? 'Administrador WVS'
    : isPlanner ? 'Wedding Planner'
    : isCatering ? 'Catering'
    : 'Venue Owner'

  const portalLabel = isAdmin ? 'Admin Portal'
    : isPlanner ? 'Planner Portal'
    : isCatering ? 'Catering Portal'
    : 'Venue Portal'

  const dashboardHref = isPlanner ? '/wp' : isCatering ? '/catering' : '/dashboard'

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <span className="brand">Wedding Venues Spain</span>
        <span className="venue-name">{portalLabel}</span>

        {/* Venue switcher — only for venue owners with an active venue */}
        {isVenueOwner && activeVenue && (
          <div style={{ marginTop: 10, position: 'relative', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 10 }}>
            <button
              onMouseDown={e => { e.stopPropagation(); setVenueOpen(o => !o) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                cursor: 'pointer', background: 'none',
                border: 'none', borderRadius: 8,
                padding: '4px 2px',
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: 'var(--gold)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff',
                letterSpacing: '-0.01em',
              }}>
                {(activeVenue.name ?? 'V').slice(0, 1).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff', lineHeight: 1.2 }}>
                  {activeVenue.name ?? `Venue ${activeVenue.wp_venue_id}`}
                </div>
                {userVenues.length > 1 && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>Cambiar venue</div>
                )}
              </div>
              <ChevronDown size={11} style={{
                flexShrink: 0, color: 'rgba(255,255,255,0.3)',
                transform: venueOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 150ms',
              }} />
            </button>

            {venueOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0,
                background: '#1e1a17', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8, overflow: 'hidden', zIndex: 50,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {userVenues.map(v => (
                  <button
                    key={v.id}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      switchVenue(v.id)
                      setVenueOpen(false)
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 12px', background: 'none', border: 'none',
                      color: v.id === activeVenue.id ? 'var(--gold)' : 'rgba(255,255,255,0.8)',
                      fontSize: 12, fontWeight: v.id === activeVenue.id ? 600 : 400,
                      cursor: 'pointer', fontFamily: 'Manrope, sans-serif', textAlign: 'left',
                    }}
                  >
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.name ?? `Venue ${v.wp_venue_id}`}
                    </span>
                    {v.id === activeVenue.id && <Check size={11} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <nav className="sidebar-nav">

        {/* Dashboard — visible for non-planners (planners have it in their section) */}
        {!isPlanner && (
          <>
            <div className="nav-section">General</div>
            <Link href={dashboardHref} className={`nav-item ${isActive(dashboardHref) || pathname === dashboardHref ? 'active' : ''}`}>
              <Icon d="M1 1h6v6H1zM9 1h6v6H9zM1 9h6v6H1zM9 9h6v6H9z" /> Dashboard
            </Link>
          </>
        )}

        {/* ── ADMIN ── */}
        {isAdmin && (
          <>
            <div className="nav-section" style={{ marginTop: 8 }}>Gestión</div>
            {adminItems.map(item => (
              <Link key={item.href} href={item.href}
                className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
              >
                <Icon d={item.icon} /> {item.label}
                {item.badge != null && item.badge > 0 && (
                  <span style={{
                    marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9,
                    background: '#ef4444', color: '#fff',
                    fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 5px',
                  }}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </Link>
            ))}
          </>
        )}

        {/* ── WEDDING PLANNER ── */}
        {isPlanner && (
          <>
            <div className="nav-section" style={{ marginTop: 8 }}>Mi gestión</div>
            {plannerItems.map(item => (
              <Link key={item.href} href={item.href}
                className={`nav-item ${pathname === item.href || (item.href !== '/wp' && pathname.startsWith(item.href)) ? 'active' : ''}`}
                style={{ paddingLeft: 20 }}
              >
                <Icon d={item.icon} /> {item.label}
                {item.href === '/wp' && newClientsCount > 0 && (
                  <span style={{
                    marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9,
                    background: 'var(--gold)', color: '#fff',
                    fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 5px',
                  }}>
                    {newClientsCount > 99 ? '99+' : newClientsCount}
                  </span>
                )}
              </Link>
            ))}
            <div className="nav-section" style={{ marginTop: 8 }}>Ayuda</div>
            {helpItems.map(item => (
              <Link key={item.href} href={item.href} className={`nav-item ${isActive(item.href) ? 'active' : ''}`}>
                <Icon d={item.icon} /> {item.label}
              </Link>
            ))}
          </>
        )}

        {/* ── CATERING ── */}
        {isCatering && (
          <>
            <div className="nav-section" style={{ marginTop: 8 }}>Mi negocio</div>
            {cateringItems.slice(1).map(item => (
              <Link key={item.href} href={item.href}
                className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                style={{ paddingLeft: 20 }}
              >
                <Icon d={item.icon} /> {item.label}
                {item.href === '/catering/leads' && newLeadsCount > 0 && (
                  <span style={{
                    marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9,
                    background: '#ef4444', color: '#fff',
                    fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 5px',
                  }}>
                    {newLeadsCount > 99 ? '99+' : newLeadsCount}
                  </span>
                )}
              </Link>
            ))}
            <div className="nav-section" style={{ marginTop: 8 }}>Ayuda</div>
            {helpItems.map(item => (
              <Link key={item.href} href={item.href} className={`nav-item ${isActive(item.href) ? 'active' : ''}`}>
                <Icon d={item.icon} /> {item.label}
              </Link>
            ))}
          </>
        )}

        {/* ── VENUE OWNER ── */}
        {isVenueOwner && (
          <>
            <div className="nav-section" style={{ marginTop: 8 }}>Mi Venue</div>

            {venueItems.map(item => {
              const locked = !features.loading && !features[item.feature]
              if (locked) return (
                <div key={item.href} className="nav-item"
                  title="Funcionalidad no disponible en tu plan actual"
                  style={{ paddingLeft: 20, opacity: 0.38, cursor: 'not-allowed', userSelect: 'none' }}
                >
                  <Icon d={item.icon} /> {item.label}
                  <span style={{ marginLeft: 'auto', fontSize: 9 }}>PRO</span>
                </div>
              )
              return (
                <Link key={item.href} href={item.href}
                  className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                  style={{ paddingLeft: 20 }}
                >
                  <Icon d={item.icon} /> {item.label}
                  {item.href === '/leads' && newLeadsCount > 0 && (
                    <span style={{
                      marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9,
                      background: '#ef4444', color: '#fff',
                      fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 5px',
                    }}>
                      {newLeadsCount > 99 ? '99+' : newLeadsCount}
                    </span>
                  )}
                </Link>
              )
            })}

            <div className="nav-section" style={{ marginTop: 8 }}>Datos</div>
            {(() => {
              const locked = !features.loading && !features[estadisticasItem.feature]
              if (locked) return (
                <div className="nav-item"
                  title="Funcionalidad no disponible en tu plan actual"
                  style={{ opacity: 0.38, cursor: 'not-allowed', userSelect: 'none' }}
                >
                  <Icon d={estadisticasItem.icon} /> {estadisticasItem.label}
                  <span style={{ marginLeft: 'auto', fontSize: 9 }}>PRO</span>
                </div>
              )
              return (
                <Link href={estadisticasItem.href}
                  className={`nav-item ${isActive(estadisticasItem.href) ? 'active' : ''}`}
                >
                  <Icon d={estadisticasItem.icon} /> {estadisticasItem.label}
                </Link>
              )
            })()}
            <Link href={facturasItem.href}
              className={`nav-item ${isActive(facturasItem.href) ? 'active' : ''}`}
            >
              <Icon d={facturasItem.icon} /> {facturasItem.label}
            </Link>

            <div className="nav-section" style={{ marginTop: 8 }}>Ayuda</div>
            {helpItems.map(item => (
              <Link key={item.href} href={item.href} className={`nav-item ${isActive(item.href) ? 'active' : ''}`}>
                <Icon d={item.icon} /> {item.label}
              </Link>
            ))}
          </>
        )}

      </nav>

      <div className="sidebar-footer">
        {/* Trial / plan banners — solo venue owner */}
        {isVenueOwner && !features.loading && features.isTrialExpired && (
          <Link href="/pricing" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', textDecoration: 'none' }}>
            <Hourglass size={11} style={{ color: '#f87171', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#f87171', letterSpacing: '0.04em' }}>TRIAL EXPIRADO</div>
              <div style={{ fontSize: 10, color: 'var(--stone)' }}>Activa tu plan</div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 600, color: '#f87171', whiteSpace: 'nowrap' }}>Activar →</span>
          </Link>
        )}

        {isVenueOwner && !features.loading && features.isTrial && !features.isTrialExpired && (
          <Link href="/pricing" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(196,151,90,0.08)', border: '1px solid rgba(196,151,90,0.15)', textDecoration: 'none' }}>
            <Hourglass size={11} style={{ color: 'var(--gold)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.04em' }}>TRIAL</div>
              {features.trialDaysLeft !== null && (
                <div style={{ fontSize: 10, color: features.trialDaysLeft <= 3 ? '#fca5a5' : 'var(--stone)' }}>
                  {features.trialDaysLeft} días restantes
                </div>
              )}
            </div>
            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--gold)', whiteSpace: 'nowrap' }}>Activar →</span>
          </Link>
        )}

        {isVenueOwner && !features.loading && !features.isTrial && !features.isTrialExpired && features.hasPlan && features.planTier === 'basic' && (
          <Link href="/pricing" style={{ display: 'block', marginBottom: 10, padding: '14px 14px', borderRadius: 10, background: 'rgba(196,151,90,0.08)', border: '1px solid rgba(196,151,90,0.15)', textDecoration: 'none' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.08em', marginBottom: 4 }}>PASA A PREMIUM</div>
            <div style={{ fontSize: 11, color: 'var(--stone)', lineHeight: 1.5 }}>Propuestas, exportar leads y más.</div>
          </Link>
        )}

        {isVenueOwner && !features.loading && !features.isTrial && !features.isTrialExpired && !features.hasPlan && (
          <Link href="/pricing" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 10px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', textDecoration: 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f87171' }}>Sin suscripción</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>Activa tu plan</div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 600, color: '#f87171', whiteSpace: 'nowrap' }}>Ver planes →</span>
          </Link>
        )}

        <Link href="/perfil" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, textDecoration: 'none' }}>
          <div className="avatar">{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              color: pathname === '/perfil' ? 'var(--gold)' : '#fff',
              fontSize: 12, fontWeight: 400,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>
              {userEmail}
            </div>
            <div style={{ fontSize: 10, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {roleLabel}
              {isVenueOwner && !features.loading && (
                <span style={{
                  background: !features.hasPlan ? '#1e293b' : features.isTrial ? '#78350f' : features.planTier === 'basic' ? '#1e3a5f' : '#451a03',
                  color: !features.hasPlan ? '#94a3b8' : features.isTrial ? '#fcd34d' : features.planTier === 'basic' ? '#93c5fd' : '#fde68a',
                  padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em'
                }}>
                  {features.isTrial ? 'TRIAL' : !features.hasPlan ? 'SIN PLAN' : features.planName ? features.planName.toUpperCase() : features.planTier === 'basic' ? 'BÁSICO' : 'PREMIUM'}
                </span>
              )}
            </div>
          </div>
        </Link>
        <button
          onClick={handleLogout}
          style={{ background: 'none', border: 'none', color: 'var(--warm-gray)', fontSize: 11, cursor: 'pointer', padding: 0 }}
        >
          Cerrar sesión →
        </button>
      </div>
    </div>
  )
}

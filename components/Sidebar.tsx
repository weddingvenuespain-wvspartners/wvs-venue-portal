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
  const { user, profile, userVenues, activeVenue, switchVenue } = useAuth()

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
  const [newLeadsCount, setNewLeadsCount] = useState(0)
  useEffect(() => {
    if (!user || isAdmin || isPlanner) return
    const supabase = createClient()
    supabase.from('leads').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('status', 'new')
      .then(({ count }) => { if (count) setNewLeadsCount(count) })
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
    { href: '/ficha',        label: isMultiVenue ? 'Mis fichas'     : 'Mi ficha',    icon: 'M2 2h12v12H2zM5 6h6M5 9h4',                         feature: 'ficha'        },
    { href: '/calendario',   label: isMultiVenue ? 'Calendarios'    : 'Calendario',  icon: 'M1 4h14v10H1zM1 4V2M4 1v3M12 1v3M1 8h14',           feature: 'calendario'   },
    { href: '/leads',        label: 'Leads',                                          icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zM2 14s1-4 6-4 6 4 6 4', feature: 'leads'        },
    { href: '/proposals',    label: isMultiVenue ? 'Mis propuestas' : 'Propuestas',  icon: 'M2 2h12v10H2zM14 8l2 4M5 6h6M5 9h4',                feature: 'propuestas'   },
    { href: '/estructura',   label: 'Configuración',                                     icon: 'M1 3h14M1 7h9M1 11h5M11 9l2 2 4-4',                  feature: 'estructura'   },
    { href: '/comunicacion', label: 'Comunicación',                                   icon: 'M14 2H2v9h5l1 3 1-3h5V2zM5 6h6M5 9h3',              feature: 'comunicacion' },
  ]
  const estadisticasItem = { href: '/estadisticas', label: 'Estadísticas', icon: 'M1 13h2V7H1zM5 13h2V3H5zM9 13h2V9H9zM13 13h2V5h-2z', feature: 'estadisticas' as keyof PlanFeatures }

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
    { href: '/admin',            label: 'CRM',             icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zM2 14s1-4 6-4 6 4 6 4' },
    { href: '/admin/planes',     label: 'Planes',          icon: 'M1 4h14v8H1zM4 4V2M12 4V2M1 8h14' },
    { href: '/admin/onboarding', label: 'Solicitudes',     icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zM2 14s1-4 6-4 6 4 6 4M12 5v4M10 7h4', badge: pendingOnboardingCount },
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

  const portalLabel = isAdmin ? 'Panel de Control'
    : isPlanner ? 'Planner Portal'
    : isCatering ? 'Catering Portal'
    : 'Partner Portal'

  const dashboardHref = isPlanner ? '/wp' : isCatering ? '/catering' : '/dashboard'

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <span className="brand">Wedding Venues Spain</span>
        <span className="venue-name">{portalLabel}</span>
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

            {/* Venue switcher — only shown when user has 2+ venues */}
            {userVenues.length > 1 && activeVenue && (
              <div style={{ margin: '0 0 6px 0', position: 'relative' }}>
                <button
                  onClick={() => setVenueOpen(o => !o)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 600,
                    fontFamily: 'Manrope, sans-serif', textAlign: 'left',
                  }}
                >
                  <span style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: 'var(--gold)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff',
                  }}>
                    {(activeVenue.name ?? `V${activeVenue.wp_venue_id}`).slice(0, 1).toUpperCase()}
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeVenue.name ?? `Venue ${activeVenue.wp_venue_id}`}
                  </span>
                  <ChevronDown size={12} style={{
                    flexShrink: 0, opacity: 0.6,
                    transform: venueOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 150ms',
                  }} />
                </button>

                {venueOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                    background: '#1e1a17', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8, overflow: 'hidden', zIndex: 50,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}>
                    {userVenues.map(v => (
                      <button
                        key={v.id}
                        onClick={() => { switchVenue(v.id); setVenueOpen(false) }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', background: 'none', border: 'none',
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
          <div style={{ marginBottom: 10, padding: '14px 14px', borderRadius: 10, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <Hourglass size={12} style={{ color: '#f87171', flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: '#f87171', letterSpacing: '0.08em' }}>PERIODO DE PRUEBA EXPIRADO</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--stone)', marginBottom: 10, lineHeight: 1.5 }}>
              Tu periodo de prueba ha terminado. Activa tu plan para seguir usando el portal.
            </div>
            <Link href="/pricing" style={{ display: 'block', padding: '8px 12px', borderRadius: 8, background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 600, textAlign: 'center', textDecoration: 'none', letterSpacing: '0.02em' }}>
              Activar plan ahora
            </Link>
          </div>
        )}

        {isVenueOwner && !features.loading && features.isTrial && !features.isTrialExpired && (
          <div style={{ marginBottom: 10, padding: '14px 14px', borderRadius: 10, background: 'rgba(196,151,90,0.08)', border: '1px solid rgba(196,151,90,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <Hourglass size={12} style={{ color: 'var(--gold)', flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.08em' }}>PERIODO DE PRUEBA</span>
            </div>
            {features.trialDaysLeft !== null && (
              <div style={{ marginBottom: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                  background: features.trialDaysLeft <= 3 ? 'rgba(220,38,38,0.15)' : 'rgba(196,151,90,0.12)',
                  color: features.trialDaysLeft <= 3 ? '#fca5a5' : 'var(--gold)',
                }}>
                  {features.trialDaysLeft} días restantes
                </span>
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--stone)', marginBottom: 10, lineHeight: 1.5 }}>Activa tu plan para seguir usando el portal.</div>
            <Link href="/pricing" style={{ display: 'block', padding: '8px 12px', borderRadius: 8, background: 'var(--gold)', color: '#fff', fontSize: 11, fontWeight: 600, textAlign: 'center', textDecoration: 'none', letterSpacing: '0.02em' }}>
              Activar plan
            </Link>
          </div>
        )}

        {isVenueOwner && !features.loading && !features.isTrial && !features.isTrialExpired && features.hasPlan && features.planTier === 'basic' && (
          <Link href="/pricing" style={{ display: 'block', marginBottom: 10, padding: '14px 14px', borderRadius: 10, background: 'rgba(196,151,90,0.08)', border: '1px solid rgba(196,151,90,0.15)', textDecoration: 'none' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.08em', marginBottom: 4 }}>PASA A PREMIUM</div>
            <div style={{ fontSize: 11, color: 'var(--stone)', lineHeight: 1.5 }}>Propuestas, exportar leads y más.</div>
          </Link>
        )}

        {isVenueOwner && !features.loading && !features.isTrial && !features.isTrialExpired && !features.hasPlan && (
          <div style={{ marginBottom: 10, padding: '9px 12px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#f87171', marginBottom: 2 }}>Sin suscripción activa</div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4, marginBottom: 8 }}>Activa tu plan para acceder al portal.</div>
            <Link href="/pricing" style={{ display: 'block', padding: '7px 12px', borderRadius: 7, background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 600, textAlign: 'center', textDecoration: 'none' }}>
              Ver planes
            </Link>
          </div>
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

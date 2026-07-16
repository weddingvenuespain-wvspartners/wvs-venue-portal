'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { usePlanFeatures, type PlanFeatures } from '@/lib/use-plan-features'
import {
  Hourglass, ChevronDown, Check, User, LogOut, ArrowRight,
  LayoutDashboard, Inbox, Users, Calendar, BookOpen, Calculator,
  Store, MessageSquare, BarChart3, Receipt, FileSignature, Settings,
  LifeBuoy, Heart, UtensilsCrossed, Palette, Building2, Layers, UserPlus,
  FileText, TrendingUp, Ticket, Mail, type LucideIcon,
} from 'lucide-react'

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
  const [userMenuOpen, setUserMenuOpen] = useState(false)

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
      .eq('status', 'new')
    // Filter by venue_id (canonical) — shared venue data included
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

  // Badge: orphan leads (admin) — leads sin venue vinculado en el portal
  const [orphanNewCount, setOrphanNewCount] = useState(0)
  useEffect(() => {
    if (!user || !isAdmin) return
    const supabase = createClient()
    supabase.from('orphan_leads').select('id', { count: 'exact', head: true })
      .eq('status', 'new')
      .then(({ count }) => setOrphanNewCount(count ?? 0))
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

  // Close dropdowns on outside click
  useEffect(() => {
    if (!venueOpen) return
    const close = () => setVenueOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [venueOpen])

  useEffect(() => {
    if (!userMenuOpen) return
    const close = () => setUserMenuOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [userMenuOpen])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.replace('/login')
  }

  // Renders a lucide nav icon at the sidebar's standard size/weight
  const Icon = ({ glyph: Glyph }: { glyph: LucideIcon }) => (
    <Glyph size={15} strokeWidth={1.6} style={{ flexShrink: 0 }} />
  )

  // ── Nav item definitions ──────────────────────────────────────────────────────

  // ── Venue owner nav groups ──────────────────────────────────────────────────
  const comercialItems: { href: string; label: string; icon: LucideIcon; feature: keyof PlanFeatures }[] = [
    { href: '/leads',        label: 'Leads',                                          icon: Inbox,    feature: 'leads'        },
    { href: '/crm',          label: 'Contactos',                                     icon: Users,    feature: 'leads'        },
    { href: '/calendar',   label: isMultiVenue ? 'Calendarios'    : 'Calendario',  icon: Calendar, feature: 'calendario'   },
  ]
  const propuestasItems: { href: string; label: string; icon: LucideIcon; feature: keyof PlanFeatures }[] = [
    { href: '/dossier',      label: 'Dosieres',                                      icon: BookOpen,   feature: 'propuestas'   },
    { href: '/budgets',      label: 'Presupuestos',                                     icon: Calculator, feature: 'presupuestos' },
  ]
  const canalesItems: { href: string; label: string; icon: LucideIcon; feature: keyof PlanFeatures }[] = [
    { href: '/channels',      label: 'Canales de venta',                               icon: Store,         feature: 'ficha'        },
    { href: '/communication', label: 'Comunicación',                                   icon: MessageSquare, feature: 'comunicacion' },
  ]
  const datosItems: { href: string; label: string; icon: LucideIcon; feature: keyof PlanFeatures }[] = [
    { href: '/stats', label: 'Estadísticas', icon: BarChart3, feature: 'estadisticas' },
  ]
  const facturasItem = { href: '/invoices', label: 'Facturas', icon: Receipt }
  const contratosItem = { href: '/contratos', label: 'Contratos', icon: FileSignature }
  const configItems: { href: string; label: string; icon: LucideIcon; feature: keyof PlanFeatures }[] = [
    { href: '/venue-settings', label: 'Mi espacio', icon: Settings, feature: 'estructura' },
  ]

  const plannerItems: { href: string; label: string; icon: LucideIcon }[] = [
    { href: '/wp',           label: 'Dashboard',        icon: LayoutDashboard },
    { href: '/wp/clients',   label: 'Mis parejas',      icon: Heart },
    { href: '/wp/venues',    label: 'Buscar venues',    icon: Building2 },
    { href: '/wp/catering',  label: 'Buscar catering',  icon: UtensilsCrossed },
    { href: '/wp/branding',  label: 'Branding',         icon: Palette },
  ]

  const cateringItems: { href: string; label: string; icon: LucideIcon }[] = [
    { href: '/catering',                label: 'Dashboard',     icon: LayoutDashboard },
    { href: '/catering/venue-profile',  label: 'Mi ficha',      icon: Store },
    { href: '/catering/leads',          label: 'Solicitudes',   icon: Inbox },
    { href: '/catering/calendar',       label: 'Calendario',    icon: Calendar },
    { href: '/catering/proposals',      label: 'Propuestas',    icon: FileText },
    { href: '/catering/stats',          label: 'Estadísticas',  icon: BarChart3 },
  ]

  const adminItems: { href: string; label: string; icon: LucideIcon; badge?: number }[] = [
    { href: '/admin',                    label: 'CRM',             icon: Users,    badge: pendingUsersCount },
    { href: '/admin/plans',             label: 'Planes',          icon: Layers },
    { href: '/admin/onboarding',         label: 'Solicitudes',     icon: UserPlus, badge: pendingOnboardingCount },
    { href: '/admin/wedding-planners',   label: 'Peticiones WP', icon: Heart,    badge: wpNewCount },
    { href: '/admin/orphan-leads',       label: 'Leads WVS',       icon: Mail,     badge: orphanNewCount },
    { href: '/admin/coupons',           label: 'Cupones',          icon: Ticket },
    { href: '/admin/stats',             label: 'Estadísticas',    icon: TrendingUp },
  ]

  const helpItems: { href: string; label: string; icon: LucideIcon }[] = [
    { href: '/guides', label: 'Centro de ayuda', icon: LifeBuoy },
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
          <img src="/foreventos-assets/foreventos-icon-cream.svg" alt="ForEventos" style={{ height: 22, width: 'auto', display: 'block' }} />
          <span className="brand" style={{ color: '#F5F4EE' }}>FOREVENTOS</span>
        </div>
        <span className="venue-name" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4A6B52', display: 'inline-block', flexShrink: 0 }} />
          {portalLabel}
        </span>

        {/* Venue switcher — only for venue owners with an active venue */}
        {isVenueOwner && activeVenue && (
          <div style={{ marginTop: 10, position: 'relative', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 10 }}>
            <button
              onMouseDown={e => { e.stopPropagation(); setVenueOpen(o => !o) }}
              onMouseEnter={e => { if (!venueOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { if (!venueOpen) e.currentTarget.style.background = 'none' }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                cursor: 'pointer', background: venueOpen ? 'rgba(255,255,255,0.05)' : 'none',
                border: 'none', borderRadius: 8,
                padding: '6px 8px', transition: 'background 0.15s',
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: 'var(--gold)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff',
                letterSpacing: '-0.01em',
              }}>
                {(activeVenue?.name ?? 'V').slice(0, 1).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff', lineHeight: 1.2 }}>
                  {activeVenue?.name ?? `Venue ${activeVenue?.wp_venue_id}`}
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
                position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 12, overflow: 'hidden', zIndex: 50, padding: 6,
                boxShadow: '0 16px 40px rgba(10,15,11,0.45)',
              }}>
                {userVenues.map(v => {
                  const isCurrent = v.row_id === activeVenue?.row_id
                  return (
                  <button
                    key={v.row_id}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      switchVenue(v.row_id)
                      setVenueOpen(false)
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = isCurrent ? 'rgba(74,107,82,0.12)' : '#f3f5f2'}
                    onMouseLeave={e => e.currentTarget.style.background = isCurrent ? 'rgba(74,107,82,0.08)' : 'none'}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 10px', border: 'none', borderRadius: 8,
                      background: isCurrent ? 'rgba(74,107,82,0.08)' : 'none',
                      color: isCurrent ? '#4A6B52' : 'var(--fe-text-dark)',
                      fontSize: 13, fontWeight: isCurrent ? 700 : 500,
                      cursor: 'pointer', fontFamily: 'Manrope, sans-serif', textAlign: 'left',
                      transition: 'background 0.12s',
                    }}
                  >
                    <span style={{
                      width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, letterSpacing: '-0.01em',
                      background: isCurrent ? '#4A6B52' : 'rgba(74,107,82,0.12)',
                      color: isCurrent ? '#fff' : '#4A6B52',
                    }}>
                      {(v.name ?? 'V').slice(0, 1).toUpperCase()}
                    </span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.name ?? `Venue ${v.wp_venue_id}`}
                    </span>
                    {isCurrent && <Check size={15} style={{ flexShrink: 0, color: '#4A6B52' }} />}
                  </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <nav className="sidebar-nav">

        {/* Dashboard — visible for non-planners (planners have it in their section) */}
        {!isPlanner && (
          <Link href={dashboardHref} className={`nav-item ${isActive(dashboardHref) || pathname === dashboardHref ? 'active' : ''}`}>
            <Icon glyph={LayoutDashboard} /> Dashboard
          </Link>
        )}

        {/* ── ADMIN ── */}
        {isAdmin && (
          <>
            <div className="nav-section" style={{ marginTop: 8 }}>Gestión</div>
            {adminItems.map(item => (
              <Link key={item.href} href={item.href}
                className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
              >
                <Icon glyph={item.icon} /> {item.label}
                {item.badge != null && item.badge > 0 && (
                  <span style={{
                    marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9,
                    background: '#BC5249', color: '#fff',
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
                <Icon glyph={item.icon} /> {item.label}
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
                <Icon glyph={item.icon} /> {item.label}
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
                <Icon glyph={item.icon} /> {item.label}
                {item.href === '/catering/leads' && newLeadsCount > 0 && (
                  <span style={{
                    marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9,
                    background: '#BC5249', color: '#fff',
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
                <Icon glyph={item.icon} /> {item.label}
              </Link>
            ))}
          </>
        )}

        {/* ── VENUE OWNER ── */}
        {isVenueOwner && (
          <>
            {[
              { label: 'Comercial',      items: comercialItems },
              { label: 'Propuestas',     items: propuestasItems },
              { label: 'Canales',        items: canalesItems },
            ].map(group => (
              <div key={group.label}>
                <div className="nav-section" style={{ marginTop: 8 }}>{group.label}</div>
                {group.items.map(item => {
                  const locked = !features.loading && !features[item.feature]
                  if (locked) return (
                    <div key={item.href} className="nav-item"
                      title="Funcionalidad no disponible en tu plan actual"
                      style={{ paddingLeft: 20, opacity: 0.38, cursor: 'not-allowed', userSelect: 'none' }}
                    >
                      <Icon glyph={item.icon} /> {item.label}
                      <span style={{ marginLeft: 'auto', fontSize: 9 }}>PRO</span>
                    </div>
                  )
                  return (
                    <Link key={item.href} href={item.href}
                      className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                      style={{ paddingLeft: 20 }}
                    >
                      <Icon glyph={item.icon} /> {item.label}
                      {item.href === '/leads' && newLeadsCount > 0 && (
                        <span style={{
                          marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9,
                          background: '#BC5249', color: '#fff',
                          fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '0 5px',
                        }}>
                          {newLeadsCount > 99 ? '99+' : newLeadsCount}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            ))}

            <div className="nav-section" style={{ marginTop: 8 }}>Datos</div>
            {datosItems.map(item => {
              const locked = !features.loading && !features[item.feature]
              if (locked) return (
                <div key={item.href} className="nav-item"
                  title="Funcionalidad no disponible en tu plan actual"
                  style={{ paddingLeft: 20, opacity: 0.38, cursor: 'not-allowed', userSelect: 'none' }}
                >
                  <Icon glyph={item.icon} /> {item.label}
                  <span style={{ marginLeft: 'auto', fontSize: 9 }}>PRO</span>
                </div>
              )
              return (
                <Link key={item.href} href={item.href}
                  className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                  style={{ paddingLeft: 20 }}
                >
                  <Icon glyph={item.icon} /> {item.label}
                </Link>
              )
            })}
            <Link href={facturasItem.href}
              className={`nav-item ${isActive(facturasItem.href) ? 'active' : ''}`}
              style={{ paddingLeft: 20 }}
            >
              <Icon glyph={facturasItem.icon} /> {facturasItem.label}
            </Link>
            <Link href={contratosItem.href}
              className={`nav-item ${isActive(contratosItem.href) ? 'active' : ''}`}
              style={{ paddingLeft: 20 }}
            >
              <Icon glyph={contratosItem.icon} /> {contratosItem.label}
            </Link>

            <div className="nav-section" style={{ marginTop: 8 }}>Configuración</div>
            {configItems.map(item => {
              const locked = !features.loading && !features[item.feature]
              if (locked) return (
                <div key={item.href} className="nav-item"
                  title="Funcionalidad no disponible en tu plan actual"
                  style={{ paddingLeft: 20, opacity: 0.38, cursor: 'not-allowed', userSelect: 'none' }}
                >
                  <Icon glyph={item.icon} /> {item.label}
                  <span style={{ marginLeft: 'auto', fontSize: 9 }}>PRO</span>
                </div>
              )
              return (
                <Link key={item.href} href={item.href}
                  className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                  style={{ paddingLeft: 20 }}
                >
                  <Icon glyph={item.icon} /> {item.label}
                </Link>
              )
            })}
            {helpItems.map(item => (
              <Link key={item.href} href={item.href}
                className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                style={{ paddingLeft: 20 }}
              >
                <Icon glyph={item.icon} /> {item.label}
              </Link>
            ))}
          </>
        )}

      </nav>

      <div className="sidebar-footer">
        {/* Trial / plan banners — solo venue owner */}
        {isVenueOwner && !features.loading && features.isTrialExpired && (
          <Link href="/pricing" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(176,71,62,0.10)', borderBottom: '1px solid rgba(255,255,255,0.07)', textDecoration: 'none' }}>
            <Hourglass size={13} style={{ color: '#C97D75', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#C97D75', letterSpacing: '0.08em' }}>PRUEBA FINALIZADA</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>Activa tu plan para continuar</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, background: '#B0473E', color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>
              Activar <ArrowRight size={11} />
            </div>
          </Link>
        )}

        {isVenueOwner && !features.loading && features.isTrial && !features.isTrialExpired && (
          <Link href="/pricing" style={{ display: 'block', padding: '14px 16px', background: 'linear-gradient(135deg, rgba(196,151,90,0.14), rgba(196,151,90,0.04))', borderBottom: '1px solid rgba(255,255,255,0.07)', textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Hourglass size={12} style={{ color: '#D4A867' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#D4A867', letterSpacing: '0.08em' }}>PRUEBA GRATIS</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{features.trialDaysLeft ?? 0} días</span>
            </div>
            <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #C4975A, #E0B978)', width: `${Math.max(6, Math.min(100, ((features.trialDaysLeft ?? 0) / 14) * 100))}%`, transition: 'width .3s' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, height: 30, borderRadius: 7, background: '#C4975A', color: '#1A1208', fontSize: 11, fontWeight: 700 }}>
              Activar plan <ArrowRight size={12} />
            </div>
          </Link>
        )}

        {isVenueOwner && !features.loading && !features.isTrial && !features.isTrialExpired && features.hasPlan && features.planTier === 'basic' && (
          <Link href="/pricing" style={{ display: 'block', padding: '14px 20px', background: 'rgba(196,151,90,0.08)', borderBottom: '1px solid rgba(255,255,255,0.07)', textDecoration: 'none' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#D4A867', letterSpacing: '0.08em', marginBottom: 4 }}>PASA A PREMIUM</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>Propuestas, exportar leads y más.</div>
          </Link>
        )}

        {isVenueOwner && !features.loading && !features.isTrial && !features.isTrialExpired && !features.hasPlan && (
          <Link href="/pricing" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)', textDecoration: 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#C97D75' }}>Sin suscripción</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Activa tu plan</div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 600, color: '#C97D75', whiteSpace: 'nowrap' }}>Ver planes →</span>
          </Link>
        )}

        {/* User menu */}
        <div style={{ position: 'relative' }} onMouseDown={e => e.stopPropagation()}>
          <button
            onMouseDown={e => { e.stopPropagation(); setUserMenuOpen(o => !o) }}
            onMouseEnter={e => { if (!userMenuOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { if (!userMenuOpen) e.currentTarget.style.background = 'none' }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: userMenuOpen ? 'rgba(255,255,255,0.06)' : 'none', border: 'none', cursor: 'pointer', padding: '12px 20px', textAlign: 'left', transition: 'background 0.15s' }}
          >
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div className="avatar" style={{ boxShadow: '0 0 0 2px rgba(143,170,148,0.4)' }}>{initials}</div>
              <span style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%', background: '#7BD89B', border: '2px solid var(--fe-deep)' }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                color: pathname === '/profile' ? 'var(--fe-accent)' : '#fff',
                fontSize: 12.5, fontWeight: 500,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
              }}>
                {userEmail}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                {roleLabel}
                {isVenueOwner && !features.loading && (
                  <span style={{
                    background: !features.hasPlan ? 'rgba(255,255,255,0.08)' : features.isTrial ? 'rgba(196,151,90,0.18)' : features.planTier === 'basic' ? 'rgba(143,170,148,0.20)' : 'rgba(196,151,90,0.18)',
                    color: !features.hasPlan ? 'rgba(255,255,255,0.6)' : features.isTrial ? '#E0B978' : features.planTier === 'basic' ? '#B8C9B9' : '#E0B978',
                    padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em'
                  }}>
                    {features.isTrial ? 'TRIAL' : !features.hasPlan ? 'SIN PLAN' : features.planName ? features.planName.toUpperCase() : features.planTier === 'basic' ? 'BÁSICO' : 'PREMIUM'}
                  </span>
                )}
              </div>
            </div>
            <ChevronDown size={13} style={{ flexShrink: 0, color: 'rgba(255,255,255,0.45)', transform: userMenuOpen ? 'rotate(-90deg)' : 'none', transition: 'transform 150ms' }} />
          </button>

          {userMenuOpen && (
            <div style={{
              position: 'fixed', bottom: 0, left: 'var(--sidebar-w)',
              width: 210,
              background: 'var(--fe-dark)', borderTop: '1px solid rgba(255,255,255,0.10)', borderRight: '1px solid rgba(255,255,255,0.10)',
              overflow: 'hidden', zIndex: 200, padding: 4,
              boxShadow: '12px 0 36px rgba(0,0,0,0.45)',
            }}>
              <button onMouseDown={() => { setUserMenuOpen(false); router.push('/profile') }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'none', border: 'none', borderRadius: 7, color: 'rgba(255,255,255,0.88)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', textAlign: 'left', transition: 'background 0.12s' }}>
                <User size={14} style={{ opacity: 0.85, flexShrink: 0 }} />
                Mi perfil
              </button>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 8px' }} />
              <button onMouseDown={() => { setUserMenuOpen(false); handleLogout() }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.10)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'none', border: 'none', borderRadius: 7, color: '#C97D75', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', textAlign: 'left', transition: 'background 0.12s' }}>
                <LogOut size={14} style={{ flexShrink: 0 }} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

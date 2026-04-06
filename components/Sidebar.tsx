'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { usePlanFeatures, type PlanFeatures } from '@/lib/use-plan-features'

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, profile, userVenues } = useAuth()

  const features     = usePlanFeatures()
  const isAdmin      = profile?.role === 'admin'
  const isMultiVenue = userVenues.length > 1
  const userEmail    = user?.email || ''
  const initials     = userEmail.slice(0, 2).toUpperCase()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const Icon = ({ d }: { d: string }) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d={d} />
    </svg>
  )

  const Chevron = ({ open }: { open: boolean }) => (
    <svg
      width="12" height="12" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="2"
      style={{ marginLeft: 'auto', transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  )

  // ── Nav items ────────────────────────────────────────────────────────────────

  const venueItems: { href: string; label: string; icon: string; feature: keyof PlanFeatures }[] = [
    { href: '/ficha',        label: isMultiVenue ? 'Mis fichas'    : 'Mi ficha',    icon: 'M2 2h12v12H2zM5 6h6M5 9h4',                        feature: 'ficha'        },
    { href: '/calendario',   label: isMultiVenue ? 'Calendarios'   : 'Calendario',  icon: 'M1 4h14v10H1zM1 4V2M4 1v3M12 1v3M1 8h14',          feature: 'calendario'   },
    { href: '/leads',        label: 'Leads',                                         icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zM2 14s1-4 6-4 6 4 6 4', feature: 'leads'       },
    { href: '/propuestas',   label: isMultiVenue ? 'Mis propuestas': 'Propuestas',  icon: 'M2 2h12v10H2zM14 8l2 4M5 6h6M5 9h4',               feature: 'propuestas'   },
    { href: '/comunicacion', label: 'Comunicación',                                  icon: 'M14 2H2v9h5l1 3 1-3h5V2zM5 6h6M5 9h3',             feature: 'comunicacion' },
  ]

  const generalItems: { href: string; label: string; icon: string; feature: keyof PlanFeatures }[] = [
    { href: '/estadisticas', label: 'Estadísticas', icon: 'M1 13h2V7H1zM5 13h2V3H5zM9 13h2V9H9zM13 13h2V5h-2z', feature: 'estadisticas' },
    { href: '/facturas',     label: 'Facturas',     icon: 'M2 2h8l4 4v8H2V2zM10 2v4h4M5 8h6M5 11h4',            feature: 'ficha'        },
  ]

  const helpItems = [
    { href: '/guias', label: 'Centro de ayuda', icon: 'M8 1a7 7 0 100 14A7 7 0 008 1zM8 6v.5M8 9.5V11' },
  ]

  const adminVenueItems = [
    { href: '/admin',            label: 'CRM de venues',   icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zM8 1v2M8 13v2M1 8h2M13 8h2' },
    { href: '/admin/planes',     label: 'Planes',          icon: 'M1 4h14v8H1zM4 4V2M12 4V2M1 8h14' },
    { href: '/admin/onboarding', label: 'Solicitudes',     icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zM2 14s1-4 6-4 6 4 6 4M12 5v4M10 7h4' },
  ]

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  const venueActive      = venueItems.some(i => isActive(i.href))
  const adminVenueActive = adminVenueItems.some(i => isActive(i.href))

  const [adminVenueOpen, setAdminVenueOpen] = useState(adminVenueActive)

  useEffect(() => {
    if (adminVenueActive) setAdminVenueOpen(true)
  }, [pathname]) // eslint-disable-line

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <span className="brand">Wedding Venues Spain</span>
        <span className="venue-name">Partner Portal</span>
      </div>

      <nav className="sidebar-nav">

        {/* Dashboard */}
        <div className="nav-section">General</div>
        <Link href="/dashboard" className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}>
          <Icon d="M1 1h6v6H1zM9 1h6v6H9zM1 9h6v6H1zM9 9h6v6H9z" /> Dashboard
        </Link>

        {/* Mi Venue — always expanded (hidden for admins) */}
        {!isAdmin && (
          <>
            <div className="nav-section" style={{ marginTop: 8 }}>
              Mi Venue
            </div>
            {venueItems.map(item => {
              const locked = !features[item.feature]
              if (locked) return (
                <div
                  key={item.href}
                  className="nav-item"
                  title="Funcionalidad Premium — actualiza tu plan para acceder"
                  style={{ paddingLeft: 20, opacity: 0.38, cursor: 'not-allowed', userSelect: 'none' }}
                >
                  <Icon d={item.icon} />
                  {item.label}
                  <span style={{ marginLeft: 'auto', fontSize: 9 }}>PRO</span>
                </div>
              )
              return (
                <Link key={item.href} href={item.href}
                  className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                  style={{ paddingLeft: 20 }}
                >
                  <Icon d={item.icon} /> {item.label}
                </Link>
              )
            })}
          </>
        )}

        {/* Estadísticas + Facturas */}
        <div className="nav-section" style={{ marginTop: 8 }}>Datos</div>
        {generalItems.map(item => {
          const locked = !features[item.feature]
          if (locked) return (
            <div
              key={item.href}
              className="nav-item"
              title="Funcionalidad Premium — actualiza tu plan para acceder"
              style={{ opacity: 0.38, cursor: 'not-allowed', userSelect: 'none' }}
            >
              <Icon d={item.icon} /> {item.label}
              <span style={{ marginLeft: 'auto', fontSize: 9 }}>PRO</span>
            </div>
          )
          return (
            <Link key={item.href} href={item.href}
              className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
            >
              <Icon d={item.icon} /> {item.label}
            </Link>
          )
        })}

        {/* Admin — Venues collapsible */}
        {isAdmin && (
          <>
            <div className="nav-section" style={{ marginTop: 8 }}>
              <button
                onClick={() => setAdminVenueOpen(o => !o)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: adminVenueActive ? 'var(--gold)' : 'var(--warm-gray)',
                  fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
                  textTransform: 'uppercase', padding: 0,
                }}
              >
                Venues
                <Chevron open={adminVenueOpen} />
              </button>
            </div>
            {adminVenueOpen && adminVenueItems.map(item => (
              <Link key={item.href} href={item.href}
                className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                style={{ paddingLeft: 20 }}
              >
                <Icon d={item.icon} /> {item.label}
              </Link>
            ))}
          </>
        )}

        {/* Ayuda */}
        <div className="nav-section" style={{ marginTop: 8 }}>Ayuda</div>
        {helpItems.map(item => (
          <Link key={item.href} href={item.href}
            className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
          >
            <Icon d={item.icon} /> {item.label}
          </Link>
        ))}

      </nav>

      <div className="sidebar-footer">
        {/* ── Trial banner ── */}
        {!isAdmin && features.isTrial && (
          <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#fcd34d', letterSpacing: '0.06em' }}>⏳ TRIAL</span>
              {features.trialDaysLeft !== null && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                  background: features.trialDaysLeft <= 3 ? '#7f1d1d' : features.trialDaysLeft <= 7 ? '#78350f' : '#1e3a5f',
                  color: features.trialDaysLeft <= 3 ? '#fca5a5' : features.trialDaysLeft <= 7 ? '#fcd34d' : '#93c5fd',
                }}>
                  {features.trialDaysLeft > 0 ? `${features.trialDaysLeft}d restantes` : 'Expirado'}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, lineHeight: 1.4 }}>
              Activa tu plan para continuar usando el portal.
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <Link href="/perfil?tab=suscripcion"
                style={{ flex: 1, padding: '5px 8px', borderRadius: 5, background: '#1d4ed8', color: '#fff', fontSize: 10, fontWeight: 600, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                Básico
              </Link>
              <Link href="/perfil?tab=suscripcion"
                style={{ flex: 1, padding: '5px 8px', borderRadius: 5, background: 'linear-gradient(135deg, #92400e, #b45309)', color: '#fef3c7', fontSize: 10, fontWeight: 600, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                ✦ Premium
              </Link>
            </div>
          </div>
        )}

        {/* ── Basic → Premium upgrade banner ── */}
        {!isAdmin && !features.isTrial && features.hasPlan && features.planTier === 'basic' && (
          <Link href="/perfil?tab=suscripcion"
            style={{ display: 'block', marginBottom: 10, padding: '9px 12px', borderRadius: 8, background: 'linear-gradient(135deg, #92400e 0%, #b45309 100%)', textDecoration: 'none' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#fcd34d', letterSpacing: '0.06em', marginBottom: 2 }}>✦ PASA A PREMIUM</div>
            <div style={{ fontSize: 11, color: '#fef3c7', lineHeight: 1.4 }}>Propuestas, estadísticas, exportar leads y más.</div>
          </Link>
        )}

        {/* ── Sin plan ── */}
        {!isAdmin && !features.isTrial && !features.hasPlan && (
          <div style={{ marginBottom: 10, padding: '9px 12px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#f87171', marginBottom: 2 }}>Sin suscripción activa</div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>Contacta con tu gestor para activar tu plan.</div>
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
              {isAdmin ? 'Administrador' : 'Venue Owner'}
              {!isAdmin && (
                <span style={{
                  background: !features.hasPlan
                    ? '#1e293b'
                    : features.isTrial
                      ? '#78350f'
                      : features.planTier === 'basic' ? '#1e3a5f' : '#451a03',
                  color: !features.hasPlan
                    ? '#94a3b8'
                    : features.isTrial
                      ? '#fcd34d'
                      : features.planTier === 'basic' ? '#93c5fd' : '#fde68a',
                  padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em'
                }}>
                  {features.isTrial
                    ? 'TRIAL'
                    : !features.hasPlan
                      ? 'SIN PLAN'
                      : features.planName
                        ? features.planName.toUpperCase()
                        : features.planTier === 'basic' ? 'BÁSICO' : 'PREMIUM'}
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

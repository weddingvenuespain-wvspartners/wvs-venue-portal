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

  const adminVenueItems = [
    { href: '/admin',            label: 'CRM de venues',   icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zM8 1v2M8 13v2M1 8h2M13 8h2' },
    { href: '/admin/planes',     label: 'Planes',          icon: 'M1 4h14v8H1zM4 4V2M12 4V2M1 8h14' },
    { href: '/admin/onboarding', label: 'Solicitudes',     icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zM2 14s1-4 6-4 6 4 6 4M12 5v4M10 7h4' },
  ]

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  const venueActive      = venueItems.some(i => isActive(i.href))
  const adminVenueActive = adminVenueItems.some(i => isActive(i.href))

  const [venueOpen,      setVenueOpen]      = useState(venueActive)
  const [adminVenueOpen, setAdminVenueOpen] = useState(adminVenueActive)

  useEffect(() => {
    if (venueActive)      setVenueOpen(true)
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

        {/* Mi Venue — collapsible (hidden for admins) */}
        {!isAdmin && (
          <>
            <div className="nav-section" style={{ marginTop: 8 }}>
              <button
                onClick={() => setVenueOpen(o => !o)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: venueActive ? 'var(--gold)' : 'var(--warm-gray)',
                  fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
                  textTransform: 'uppercase', padding: 0,
                }}
              >
                Mi Venue
                <Chevron open={venueOpen} />
              </button>
            </div>
            {venueOpen && venueItems.map(item => {
              const locked = !features[item.feature]
              if (locked) return (
                <div
                  key={item.href}
                  className="nav-item"
                  title="Actualiza tu plan para acceder a este módulo"
                  style={{ paddingLeft: 20, opacity: 0.4, cursor: 'not-allowed', userSelect: 'none' }}
                >
                  <Icon d={item.icon} />
                  {item.label}
                  <span style={{ marginLeft: 'auto', fontSize: 10 }}>🔒</span>
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
              title="Actualiza tu plan"
              style={{ opacity: 0.4, cursor: 'not-allowed', userSelect: 'none' }}
            >
              <Icon d={item.icon} /> {item.label}
              <span style={{ marginLeft: 'auto', fontSize: 10 }}>🔒</span>
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

      </nav>

      <div className="sidebar-footer">
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
                <span style={{ background: features.planId === 'basic' ? '#f0f9ff' : '#fef9ec', color: features.planId === 'basic' ? '#0369a1' : '#92400e', padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em' }}>
                  {features.planName.split('—')[0].trim().toUpperCase()}
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

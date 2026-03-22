'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, profile } = useAuth()

  const isAdmin = profile?.role === 'admin'
  const venueName = profile?.wp_venue_id ? 'Mi Venue' : 'Partner Portal'
  const userEmail = user?.email || ''
  const initials = userEmail.slice(0, 2).toUpperCase()

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

  const navItems = [
    { href: '/dashboard', label: 'Dashboard',  icon: 'M1 1h6v6H1zM9 1h6v6H9zM1 9h6v6H1zM9 9h6v6H9z' },
    { href: '/ficha',     label: 'Mi ficha',   icon: 'M2 2h12v12H2zM5 6h6M5 9h4' },
  ]
  const crmItems = [
    { href: '/leads',    label: 'Leads',     icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zM2 14s1-4 6-4 6 4 6 4' },
    { href: '/pipeline', label: 'Pipeline',  icon: 'M1 3h3v10H1zM6 5h3v8H6zM11 1h3v12h-3z' },
    { href: '/crm',      label: 'Contactos', icon: 'M1 4h14v9H1zM5 4V3a3 3 0 016 0v1M1 8h14' },
  ]
  const adminItems = [
    { href: '/admin',            label: 'Panel admin',   icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zM8 1v2M8 13v2M1 8h2M13 8h2' },
    { href: '/admin/onboarding', label: 'Nuevos venues', icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zM2 14s1-4 6-4 6 4 6 4M12 5v4M10 7h4' },
  ]

  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <span className="brand">Wedding Venues Spain</span>
        <span className="venue-name">Partner Portal</span>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">General</div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${isActive(item.href) ? 'active' : ''}`}>
            <Icon d={item.icon} /> {item.label}
          </Link>
        ))}

        <div className="nav-section" style={{ marginTop: 8 }}>Clientes</div>
        {crmItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${isActive(item.href) ? 'active' : ''}`}>
            <Icon d={item.icon} /> {item.label}
          </Link>
        ))}

        {isAdmin && (
          <>
            <div className="nav-section" style={{ marginTop: 8 }}>Administración</div>
            {adminItems.map(item => (
              <Link key={item.href} href={item.href} className={`nav-item ${isActive(item.href) ? 'active' : ''}`}>
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
            <div style={{ color: pathname === '/perfil' ? 'var(--gold)' : '#fff', fontSize: 12, fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userEmail}
            </div>
            <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>
              {isAdmin ? 'Administrador' : 'Venue Owner'}
            </div>
          </div>
        </Link>
        <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--warm-gray)', fontSize: 11, cursor: 'pointer', padding: 0 }}>
          Cerrar sesión →
        </button>
      </div>
    </div>
  )
}

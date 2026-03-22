'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface SidebarProps {
  venueName?: string
  userEmail?: string
}

export default function Sidebar({ venueName = 'Mi Venue', userEmail = '' }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const checkRole = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase
        .from('venue_profiles')
        .select('role')
        .eq('user_id', session.user.id)
        .single()
      setIsAdmin(data?.role === 'admin')
    }
    checkRole()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = venueName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
        <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
      </svg>
    )},
    { href: '/ficha', label: 'Mi ficha', icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="12" height="12" rx="1.5"/>
        <line x1="5" y1="6" x2="11" y2="6"/><line x1="5" y1="9" x2="8" y2="9"/>
      </svg>
    )},
  ]

  const crmItems = [
    { href: '/leads', label: 'Leads', icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 8a3 3 0 100-6 3 3 0 000 6z"/><path d="M2 14s1-4 6-4 6 4 6 4"/>
      </svg>
    )},
    { href: '/pipeline', label: 'Pipeline', icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="3" width="3" height="10" rx="1"/><rect x="6" y="5" width="3" height="8" rx="1"/>
        <rect x="11" y="1" width="3" height="12" rx="1"/>
      </svg>
    )},
    { href: '/crm', label: 'Todos los contactos', icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="4" width="14" height="9" rx="1.5"/>
        <path d="M5 4V3a3 3 0 016 0v1"/><line x1="1" y1="8" x2="15" y2="8"/>
      </svg>
    )},
  ]

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <span className="brand">Wedding Venues Spain</span>
        <span className="venue-name">Portal de Venue</span>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">General</div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${pathname === item.href ? 'active' : ''}`}>
            {item.icon}
            {item.label}
          </Link>
        ))}

        <div className="nav-section" style={{ marginTop: '8px' }}>Clientes</div>
        {crmItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${pathname === item.href ? 'active' : ''}`}>
            {item.icon}
            {item.label}
          </Link>
        ))}

        {isAdmin && (
          <>
            <div className="nav-section" style={{ marginTop: '8px' }}>Administración</div>
            <Link href="/admin" className={`nav-item ${pathname === '/admin' ? 'active' : ''}`}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M3.2 12.8l1.4-1.4M11.4 4.6l1.4-1.4"/>
              </svg>
              Panel admin
            </Link>
            <Link href="/admin/onboarding" className={`nav-item ${pathname === '/admin/onboarding' ? 'active' : ''}`}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 8a3 3 0 100-6 3 3 0 000 6z"/><path d="M2 14s1-4 6-4 6 4 6 4"/>
                <line x1="12" y1="5" x2="12" y2="9"/><line x1="10" y1="7" x2="14" y2="7"/>
              </svg>
              Nuevos venues
            </Link>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div className="avatar">{initials}</div>
          <div>
            <div style={{ color: '#fff', fontSize: '12px', fontWeight: 400 }}>{venueName}</div>
            <div style={{ fontSize: '10px', color: 'var(--warm-gray)' }}>{userEmail}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{ background: 'none', border: 'none', color: 'var(--warm-gray)', fontSize: '11px', cursor: 'pointer', padding: 0 }}
        >
          Cerrar sesión →
        </button>
      </div>
    </div>
  )
}

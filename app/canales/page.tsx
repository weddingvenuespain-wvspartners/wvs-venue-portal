'use client'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { ArrowRight } from 'lucide-react'

type ChannelStatus = 'active' | 'soon'

interface Channel {
  name: string
  tagline: string
  description: string
  href?: string
  status: ChannelStatus
  logoLetter: string
  accentColor: string
  category: string
}

const channels: Channel[] = [
  {
    name: 'WeddingVenuesSpain.com',
    tagline: 'Bodas · España',
    description: 'Portal líder en España para venues de bodas. Gestiona tu ficha, fotos, precios y descripción. Revisión editorial incluida.',
    href: '/canales/weddingvenuesspain',
    status: 'active',
    logoLetter: 'W',
    accentColor: '#C4975A',
    category: 'Bodas',
  },
  {
    name: 'Bodas.net',
    tagline: 'Bodas · España & LATAM',
    description: 'Directorio de bodas con presencia en más de 15 países hispanohablantes.',
    status: 'soon',
    logoLetter: 'B',
    accentColor: '#d97bb6',
    category: 'Bodas',
  },
  {
    name: 'Zankyou',
    tagline: 'Bodas · Internacional',
    description: 'Plataforma global de bodas con alcance en Europa, América y Asia.',
    status: 'soon',
    logoLetter: 'Z',
    accentColor: '#7b8fd9',
    category: 'Bodas',
  },
  {
    name: 'Tagvenue',
    tagline: 'Eventos · Internacional',
    description: 'Marketplace para alquiler de espacios para eventos corporativos, fiestas y reuniones.',
    status: 'soon',
    logoLetter: 'T',
    accentColor: '#5ab8a8',
    category: 'Eventos',
  },
]

export default function CanalesPage() {
  const active = channels.filter(c => c.status === 'active')
  const soon   = channels.filter(c => c.status === 'soon')

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Canales de venta</div>
        </div>
        <div className="page-content">

          {/* Active channels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14, marginBottom: 32 }}>
            {active.map(ch => (
              <Link key={ch.name} href={ch.href!} style={{ textDecoration: 'none', display: 'block' }}>
                <div
                  style={{
                    background: '#fff',
                    border: '1px solid var(--ivory)',
                    borderTop: `3px solid ${ch.accentColor}`,
                    borderRadius: 14,
                    padding: '20px 22px',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.15s, transform 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 10, background: ch.accentColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 20, color: '#fff', flexShrink: 0,
                      }}>
                        {ch.logoLetter}
                      </div>
                      <div>
                        <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600, fontSize: 15, color: 'var(--espresso)', lineHeight: 1.2 }}>
                          {ch.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 3 }}>
                          {ch.tagline}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: 'rgba(143,166,139,0.15)', color: '#5a8a55', border: '1px solid rgba(143,166,139,0.4)', flexShrink: 0 }}>
                      Activo
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.55, margin: '0 0 16px' }}>
                    {ch.description}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 500, color: ch.accentColor }}>
                    Gestionar ficha <ArrowRight size={13} />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Coming soon */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Próximamente
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {soon.map(ch => (
              <div
                key={ch.name}
                style={{
                  background: '#fff',
                  border: '1px solid var(--ivory)',
                  borderTop: `3px solid ${ch.accentColor}`,
                  borderRadius: 14,
                  padding: '18px 20px',
                  opacity: 0.6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, background: ch.accentColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 16, color: '#fff', flexShrink: 0,
                  }}>
                    {ch.logoLetter}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600, fontSize: 13.5, color: 'var(--espresso)' }}>
                      {ch.name}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--warm-gray)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>
                      {ch.tagline}
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--warm-gray)', lineHeight: 1.5, margin: 0 }}>
                  {ch.description}
                </p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}

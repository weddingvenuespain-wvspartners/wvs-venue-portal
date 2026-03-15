'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [venue, setVenue] = useState<any>(null)
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      setUser(session.user)

      // Load venue profile linked to this user
      const { data: profile } = await supabase
        .from('venue_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (profile) {
        // Fetch venue data from WordPress
        const res = await fetch(`https://weddingvenuesspain.com/wp-json/wp/v2/venues/${profile.wp_venue_id}?acf_format=standard`)
        if (res.ok) setVenue(await res.json())
      }

      // Load leads from Supabase
      const { data: leadsData } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (leadsData) setLeads(leadsData)
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A1512' }}>
      <div style={{ color: '#C4975A', fontFamily: 'serif', fontSize: '16px' }}>Cargando...</div>
    </div>
  )

  const venueName = venue?.title?.rendered || 'Mi Venue'

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar venueName={venueName} userEmail={user?.email} />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Dashboard</div>
          <Link href="/leads">
            <button className="btn btn-primary">+ Nuevo contacto</button>
          </Link>
        </div>
        <div className="page-content">

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Leads este mes</div>
              <div className="stat-value">{leads.length}</div>
              <div className="stat-sub">Desde tu ficha y otros canales</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">En pipeline</div>
              <div className="stat-value">{leads.filter(l => l.status !== 'done').length}</div>
              <div className="stat-sub">Activos ahora</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Sin responder</div>
              <div className="stat-value">{leads.filter(l => l.status === 'new').length}</div>
              <div className={leads.filter(l => l.status === 'new').length > 0 ? 'stat-sub warn' : 'stat-sub'}>
                {leads.filter(l => l.status === 'new').length > 0 ? 'Pendientes' : 'Al día ✓'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Confirmadas</div>
              <div className="stat-value">{leads.filter(l => l.status === 'booked').length}</div>
              <div className="stat-sub">Bodas reservadas</div>
            </div>
          </div>

          <div className="two-col">
            {/* Recent leads */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Últimos leads</div>
                <Link href="/leads" style={{ fontSize: '11px', color: 'var(--gold)' }}>Ver todos →</Link>
              </div>
              {leads.length === 0 ? (
                <div className="card-body" style={{ color: 'var(--warm-gray)', fontSize: '13px', textAlign: 'center', padding: '30px' }}>
                  Aún no tienes leads.<br/>
                  <span style={{ fontSize: '11px' }}>Los leads de tu ficha aparecerán aquí automáticamente.</span>
                </div>
              ) : (
                <div style={{ padding: '6px 0' }}>
                  {leads.map((lead: any) => (
                    <div key={lead.id} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 20px', borderBottom: '1px solid var(--ivory)'
                    }}>
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50', flexShrink: 0,
                        background: lead.status === 'new' ? 'var(--gold)' : lead.status === 'contacted' ? 'var(--sage)' : 'var(--stone)'
                      }}/>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', color: 'var(--charcoal)' }}>{lead.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--warm-gray)' }}>{lead.wedding_date || 'Sin fecha'}</div>
                      </div>
                      <div style={{ fontSize: '10px', padding: '2px 8px', background: 'var(--ivory)', borderRadius: '10px', color: 'var(--warm-gray)' }}>
                        {lead.source || 'Web'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Venue preview */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Tu ficha en la web</div>
                <Link href="/ficha" style={{ fontSize: '11px', color: 'var(--gold)' }}>Editar →</Link>
              </div>
              <div className="card-body">
                {venue ? (
                  <>
                    {venue.acf?.photo_gallery?.section_2_image?.[0]?.[0]?.full_image_url && (
                      <img
                        src={venue.acf.photo_gallery.section_2_image[0][0].full_image_url}
                        alt={venueName}
                        style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '6px', marginBottom: '14px' }}
                      />
                    )}
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', marginBottom: '8px' }}>{venueName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--warm-gray)', lineHeight: 1.6 }}
                      dangerouslySetInnerHTML={{ __html: venue.excerpt?.rendered?.replace(/<[^>]*>/g, '').substring(0, 120) + '...' }}
                    />
                    <a
                      href={venue.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-block', marginTop: '12px', fontSize: '11px', color: 'var(--gold)', textDecoration: 'underline' }}
                    >
                      Ver en la web →
                    </a>
                  </>
                ) : (
                  <div style={{ color: 'var(--warm-gray)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                    Conecta tu ficha para verla aquí.<br />
                    <Link href="/ficha" style={{ color: 'var(--gold)', fontSize: '12px' }}>Ir a Mi ficha →</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

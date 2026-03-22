'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { Users, TrendingUp, CheckCircle, ExternalLink, AlertCircle, ClipboardList } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser]       = useState<any>(null)
  const [venue, setVenue]     = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [leads, setLeads]     = useState<any[]>([])
  const [onboarding, setOnboarding] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)

      const { data: prof } = await supabase
        .from('venue_profiles').select('*').eq('user_id', session.user.id).single()

      if (prof) {
        setProfile(prof)
        if (prof.wp_venue_id) {
          const res = await fetch(
            `https://weddingvenuesspain.com/wp-json/wp/v2/venues/${prof.wp_venue_id}?acf_format=standard`,
            { cache: 'no-store' }
          )
          if (res.ok) setVenue(await res.json())
        } else {
          // Cargar estado del onboarding
          const { data: onb } = await supabase
            .from('venue_onboarding').select('*').eq('user_id', session.user.id).single()
          if (onb) setOnboarding(onb)
        }
      }

      const { data: leadsData } = await supabase
        .from('leads').select('*').eq('user_id', session.user.id)
        .order('created_at', { ascending: false }).limit(5)
      if (leadsData) setLeads(leadsData)
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1A1512', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C4975A', fontFamily: 'serif', fontSize: 16 }}>Cargando...</div>
    </div>
  )

  const venueName = venue?.acf?.H1_Venue || venue?.title?.rendered || 'Mi Venue'
  const newLeads = leads.filter(l => l.status === 'new').length
  const activeLeads = leads.filter(l => !['booked','lost'].includes(l.status)).length
  const bookedLeads = leads.filter(l => l.status === 'booked').length

  const statusColors: Record<string, string> = {
    new: 'badge-new', contacted: 'badge-contacted', qualified: 'badge-active',
    proposal: 'badge-quote', booked: 'badge-booked', lost: 'badge-inactive',
  }
  const statusLabels: Record<string, string> = {
    new: 'Nuevo', contacted: 'Contactado', qualified: 'Cualificado',
    proposal: 'Propuesta', booked: 'Reservado', lost: 'Perdido',
  }

  // Si no tiene venue — mostrar estado del onboarding
  if (!profile?.wp_venue_id) {
    const onbStatus = onboarding?.status

    return (
      <div style={{ display: 'flex' }}>
        <Sidebar venueName="Mi Venue" userEmail={user?.email} />
        <div className="main-layout">
          <div className="topbar"><div className="topbar-title">Bienvenido</div></div>
          <div className="page-content" style={{ maxWidth: 600, margin: '0 auto', paddingTop: 48 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: 'var(--espresso)', marginBottom: 8 }}>
                Wedding Venues Spain
              </div>
              <div style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Partner Portal</div>
            </div>

            {!onboarding || onbStatus === 'draft' ? (
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
                  <ClipboardList size={36} style={{ color: 'var(--gold)', margin: '0 auto 16px' }} />
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, marginBottom: 8 }}>
                    Registra tu venue
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 24, lineHeight: 1.7 }}>
                    Para aparecer en Wedding Venues Spain necesitamos la información de tu venue. Rellena el formulario y nuestro equipo lo revisará en 24-48 horas.
                  </div>
                  <Link href="/onboarding" className="btn btn-primary">
                    Empezar registro →
                  </Link>
                  {onboarding?.status === 'draft' && (
                    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--warm-gray)' }}>
                      Tienes un borrador guardado. Puedes continuar donde lo dejaste.
                    </div>
                  )}
                </div>
              </div>
            ) : onbStatus === 'submitted' ? (
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <AlertCircle size={22} style={{ color: '#92400e' }} />
                  </div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, marginBottom: 8 }}>
                    Solicitud en revisión
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.7 }}>
                    Hemos recibido la información de <strong>{onboarding.name}</strong>. Nuestro equipo la está revisando y te avisará en 24-48 horas cuando tu ficha esté lista.
                  </div>
                  <div style={{ marginTop: 20, fontSize: 11, color: 'var(--stone)' }}>
                    Enviado el {new Date(onboarding.submitted_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
            ) : onbStatus === 'rejected' ? (
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, marginBottom: 8, color: 'var(--rose)' }}>
                    Solicitud no aprobada
                  </div>
                  {onboarding.admin_notes && (
                    <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 20 }}>
                      {onboarding.admin_notes}
                    </div>
                  )}
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
      <Sidebar venueName={venueName} userEmail={user?.email} />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Dashboard</div>
          <Link href="/leads" className="btn btn-primary btn-sm">+ Nuevo lead</Link>
        </div>
        <div className="page-content">

          {newLeads > 0 && (
            <div className="alert alert-warning">
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span><strong>{newLeads} {newLeads === 1 ? 'lead sin responder' : 'leads sin responder'}.</strong> <Link href="/leads" style={{ textDecoration: 'underline' }}>Ver ahora →</Link></span>
            </div>
          )}

          <div className="stats-grid">
            <div className="stat-card accent">
              <div className="stat-label">Leads este mes</div>
              <div className="stat-value">{leads.length}</div>
              <div className="stat-sub">Desde tu ficha y canales</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">En pipeline</div>
              <div className="stat-value">{activeLeads}</div>
              <div className="stat-sub">Activos ahora</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Sin responder</div>
              <div className="stat-value" style={{ color: newLeads > 0 ? 'var(--gold)' : undefined }}>{newLeads}</div>
              <div className={`stat-sub ${newLeads > 0 ? 'warn' : ''}`}>{newLeads > 0 ? 'Requieren atención' : 'Al día ✓'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Confirmadas</div>
              <div className="stat-value">{bookedLeads}</div>
              <div className="stat-sub">Bodas reservadas</div>
            </div>
          </div>

          <div className="two-col" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Últimos leads</div>
                <Link href="/leads" style={{ fontSize: 11, color: 'var(--gold)' }}>Ver todos →</Link>
              </div>
              {leads.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 13 }}>
                  <Users size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                  <div>Aún no tienes leads.</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>Aparecerán aquí automáticamente desde tu ficha.</div>
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
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {[
                  { href: '/leads', icon: <Users size={15} />, label: 'Añadir lead', sub: 'Registro manual' },
                  { href: '/ficha', icon: <TrendingUp size={15} />, label: 'Editar ficha', sub: 'Info, fotos, precios' },
                  { href: '/pipeline', icon: <CheckCircle size={15} />, label: 'Ver pipeline', sub: 'Gestionar estados' },
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
        </div>
      </div>
    </div>
  )
}

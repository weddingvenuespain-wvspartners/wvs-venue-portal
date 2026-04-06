'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Users, TrendingUp, CheckCircle, ExternalLink, AlertCircle, ClipboardList } from 'lucide-react'

function Skeleton({ w, h, radius = 4 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{
      width: w || '100%', height: h || 14, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--ivory) 25%, var(--cream) 50%, var(--ivory) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [venue, setVenue]         = useState<any>(null)
  const [venueLoading, setVenueLoading] = useState(false)
  const [leads, setLeads]         = useState<any[]>([])
  const [leadsLoaded, setLeadsLoaded] = useState(false)
  const [onboarding, setOnboarding] = useState<any>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    const supabase = createClient()

    // Load leads immediately (fast — Supabase)
    supabase.from('leads').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => { if (data) setLeads(data); setLeadsLoaded(true) })

    if (profile?.wp_venue_id) {
      // Check sessionStorage cache for instant render
      const cacheKey = `wvs_venue_${profile.wp_venue_id}`
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) { try { setVenue(JSON.parse(cached)) } catch {} }
      else { setVenueLoading(true) }

      // Always fetch fresh in background
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 6000)
      fetch(
        `https://weddingvenuesspain.com/wp-json/wp/v2/venues/${profile.wp_venue_id}?acf_format=standard`,
        { cache: 'no-store', signal: controller.signal }
      )
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) { setVenue(d); sessionStorage.setItem(cacheKey, JSON.stringify(d)) } })
        .catch(() => {})
        .finally(() => { clearTimeout(timeout); setVenueLoading(false) })
    } else {
      supabase.from('venue_onboarding').select('*').eq('user_id', user.id).single()
        .then(({ data }) => { if (data) setOnboarding(data) })
    }
  }, [authLoading]) // eslint-disable-line

  const venueName  = venue?.acf?.H1_Venue || venue?.title?.rendered || 'Mi Venue'
  const newLeads   = leads.filter(l => l.status === 'new').length
  const activeLeads = leads.filter(l => !['won','lost','booked'].includes(l.status)).length
  const bookedLeads = leads.filter(l => l.status === 'won' || l.status === 'booked').length

  const statusColors: Record<string, string> = {
    new: 'badge-new', contacted: 'badge-contacted',
    proposal_sent: 'badge-quote', visit_scheduled: 'badge-visit',
    budget_sent: 'badge-pending', won: 'badge-booked', lost: 'badge-inactive',
    qualified: 'badge-active', proposal: 'badge-quote', booked: 'badge-booked',
  }
  const statusLabels: Record<string, string> = {
    new: 'Nuevo', contacted: 'Contactado',
    proposal_sent: 'Propuesta enviada', visit_scheduled: 'Visita agendada',
    budget_sent: 'Presupuesto enviado', won: 'Ganado', lost: 'Perdido',
    qualified: 'Cualificado', proposal: 'Propuesta', booked: 'Reservado',
  }

  // Show page structure immediately — no full loading screen
  // Auth loading: show sidebar + skeleton content
  if (authLoading) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar"><div className="topbar-title">Dashboard</div></div>
        <div className="page-content">
          <div className="stats-grid" style={{ marginBottom: 16 }}>
            {[1,2,3,4].map(i => (
              <div key={i} className="stat-card">
                <Skeleton w="60%" h={10} />
                <Skeleton w="40%" h={28} radius={6} />
                <Skeleton w="70%" h={9} />
              </div>
            ))}
          </div>
          <div className="two-col">
            <div className="card"><div className="card-body" style={{ padding: 20 }}><Skeleton h={120} radius={6} /></div></div>
            <div className="card"><div className="card-body" style={{ padding: 20 }}><Skeleton h={120} radius={6} /></div></div>
          </div>
        </div>
      </div>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  )

  // Not logged in
  if (!user) return null

  // No venue assigned yet
  if (!profile?.wp_venue_id) {
    const onbStatus = onboarding?.status
    return (
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-layout">
          <div className="topbar"><div className="topbar-title">Bienvenido</div></div>
          <div className="page-content" style={{ maxWidth: 600, margin: '0 auto', paddingTop: 48 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: 'var(--espresso)', marginBottom: 8 }}>Wedding Venues Spain</div>
              <div style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Partner Portal</div>
            </div>
            {!onboarding || onbStatus === 'draft' ? (
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
                  <ClipboardList size={36} style={{ color: 'var(--gold)', margin: '0 auto 16px' }} />
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, marginBottom: 8 }}>Registra tu venue</div>
                  <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 24, lineHeight: 1.7 }}>
                    Para aparecer en Wedding Venues Spain necesitamos la información de tu venue. Rellena el formulario y nuestro equipo lo revisará en 24-48 horas.
                  </div>
                  <Link href="/onboarding" className="btn btn-primary">Empezar registro →</Link>
                  {onboarding?.status === 'draft' && (
                    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--warm-gray)' }}>Tienes un borrador guardado. Puedes continuar donde lo dejaste.</div>
                  )}
                </div>
              </div>
            ) : onbStatus === 'submitted' ? (
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <AlertCircle size={22} style={{ color: '#92400e' }} />
                  </div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, marginBottom: 8 }}>Solicitud en revisión</div>
                  <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.7 }}>
                    Hemos recibido la información de <strong>{onboarding.name}</strong>. Nuestro equipo la está revisando y te avisará en 24-48 horas.
                  </div>
                  <div style={{ marginTop: 20, fontSize: 11, color: 'var(--stone)' }}>
                    Enviado el {new Date(onboarding.submitted_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
            ) : onbStatus === 'rejected' ? (
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, marginBottom: 8, color: 'var(--rose)' }}>Solicitud no aprobada</div>
                  {onboarding.admin_notes && <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 20 }}>{onboarding.admin_notes}</div>}
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
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Dashboard</div>
          <Link href="/leads" className="btn btn-primary btn-sm">+ Nuevo lead</Link>
        </div>
        <div className="page-content">
          {newLeads > 0 && leadsLoaded && (
            <div className="alert alert-warning">
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span><strong>{newLeads} {newLeads === 1 ? 'lead sin responder' : 'leads sin responder'}.</strong> <Link href="/leads" style={{ textDecoration: 'underline' }}>Ver ahora →</Link></span>
            </div>
          )}

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card accent">
              <div className="stat-label">Leads este mes</div>
              <div className="stat-value">{leadsLoaded ? leads.length : <Skeleton w={40} h={28} radius={4} />}</div>
              <div className="stat-sub">Desde tu ficha y canales</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">En seguimiento</div>
              <div className="stat-value">{leadsLoaded ? activeLeads : <Skeleton w={30} h={28} radius={4} />}</div>
              <div className="stat-sub">Leads activos</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Sin responder</div>
              <div className="stat-value" style={{ color: newLeads > 0 ? 'var(--gold)' : undefined }}>
                {leadsLoaded ? newLeads : <Skeleton w={30} h={28} radius={4} />}
              </div>
              <div className={`stat-sub ${newLeads > 0 ? 'warn' : ''}`}>{leadsLoaded ? (newLeads > 0 ? 'Requieren atención' : 'Al día ✓') : ''}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Confirmadas</div>
              <div className="stat-value">{leadsLoaded ? bookedLeads : <Skeleton w={30} h={28} radius={4} />}</div>
              <div className="stat-sub">Bodas reservadas</div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {[
                  { href: '/leads',      icon: <Users size={15} />,       label: 'Añadir lead',  sub: 'Registro manual' },
                  { href: '/calendario', icon: <CheckCircle size={15} />, label: 'Calendario',   sub: 'Visitas y bodas' },
                  { href: '/ficha',      icon: <TrendingUp size={15} />,  label: 'Editar ficha', sub: 'Info, fotos, precios' },
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

          <div className="two-col" style={{ marginBottom: 16 }}>
            {/* Leads list */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Últimos leads</div>
                <Link href="/leads" style={{ fontSize: 11, color: 'var(--gold)' }}>Ver todos →</Link>
              </div>
              {!leadsLoaded ? (
                <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[1,2,3].map(i => <Skeleton key={i} h={36} radius={6} />)}
                </div>
              ) : leads.length === 0 ? (
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

            {/* Venue card */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Tu ficha en la web</div>
                <Link href="/ficha" style={{ fontSize: 11, color: 'var(--gold)' }}>Editar →</Link>
              </div>
              <div className="card-body">
                {venueLoading && !venue ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Skeleton h={140} radius={6} />
                    <Skeleton w="70%" h={18} radius={4} />
                    <Skeleton w="50%" h={12} radius={4} />
                  </div>
                ) : venue ? (
                  <>
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
                  </>
                ) : (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 12 }}>
                    Venue #{profile?.wp_venue_id} — sin datos de WordPress
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  )
}

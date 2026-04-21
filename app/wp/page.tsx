'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Heart, Building2, Clock, Plus, ArrowRight, Send, Eye, Palette, CheckCircle, Users } from 'lucide-react'

function Skeleton({ w, h = 14, radius = 4 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{ width: w || '100%', height: h, borderRadius: radius, background: 'linear-gradient(90deg, var(--ivory) 25%, var(--cream) 50%, var(--ivory) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
  )
}

const AVAIL_COLOR: Record<string, string> = { pending: 'var(--warm-gray)', requested: '#3b82f6', available: '#22c55e', unavailable: '#ef4444' }
const AVAIL_LABEL: Record<string, string> = { pending: 'Sin solicitar', requested: 'Pendiente', available: 'Disponible', unavailable: 'No disponible' }

export default function PlannerDashboard() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()

  const [stats, setStats]           = useState({ total: 0, sent: 0, viewed: 0, pending: 0 })
  const [recentClients, setRecentClients] = useState<any[]>([])
  const [pendingVenues, setPendingVenues] = useState<any[]>([])
  const [dataLoading, setDataLoading]     = useState(true)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && profile && profile.role !== 'wedding_planner') router.replace('/dashboard')
  }, [loading, user, profile]) // eslint-disable-line

  useEffect(() => {
    if (!user || profile?.role !== 'wedding_planner') return
    const supabase = createClient()

    Promise.all([
      supabase
        .from('wp_clients')
        .select('id, name, proposal_status, wedding_date, guest_count, created_at, wp_client_venues(id, availability_status, venue_user_id)')
        .eq('planner_id', user.id)
        .order('created_at', { ascending: false }),
    ]).then(([clientsRes]) => {
      const list = clientsRes.data || []
      setStats({
        total:   list.length,
        sent:    list.filter((c: any) => c.proposal_status === 'sent').length,
        viewed:  list.filter((c: any) => c.proposal_status === 'viewed').length,
        pending: list.reduce((acc: number, c: any) => acc + (c.wp_client_venues?.filter((v: any) => v.availability_status === 'requested').length || 0), 0),
      })
      setRecentClients(list.slice(0, 5))

      // Build pending venue list across all clients
      const pending: any[] = []
      for (const c of list) {
        for (const v of (c.wp_client_venues || [])) {
          if (v.availability_status === 'requested') {
            pending.push({ ...v, clientName: c.name, clientId: c.id })
          }
        }
      }
      setPendingVenues(pending.slice(0, 6))
      setDataLoading(false)
    })
  }, [user?.id, profile?.role]) // eslint-disable-line

  const kpis = [
    { label: 'Parejas activas',           value: stats.total,   color: 'var(--gold)',  icon: <Heart size={16} />,    href: '/wp/clients' },
    { label: 'Propuestas enviadas',       value: stats.sent,    color: '#f59e0b',      icon: <Send size={16} />,     href: '/wp/clients' },
    { label: 'Propuestas vistas',         value: stats.viewed,  color: '#22c55e',      icon: <Eye size={16} />,      href: '/wp/clients' },
    { label: 'Disponibilidades pendientes', value: stats.pending, color: '#3b82f6',   icon: <Clock size={16} />,    href: '/wp/clients' },
  ]

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div style={{ padding: '32px 40px', maxWidth: 1100 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <div>
              <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 4 }}>
                Bienvenido/a{profile?.first_name ? `, ${profile.first_name}` : ''}
              </h1>
              <p style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Aquí tienes un resumen de tu actividad como wedding planner.</p>
            </div>
            <Link href="/wp/clients" onClick={e => { e.preventDefault(); document.dispatchEvent(new CustomEvent('wp-open-new-client')) }}
              style={{ display: 'none' }} />
            <Link href="/wp/clients?new=1" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px',
              borderRadius: 8, background: 'var(--charcoal)', color: '#fff',
              fontSize: 13, fontWeight: 500, textDecoration: 'none', fontFamily: 'Manrope, sans-serif',
            }}>
              <Plus size={14} /> Nueva pareja
            </Link>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
            {kpis.map(k => (
              <Link key={k.label} href={k.href} style={{ textDecoration: 'none' }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 8px rgba(0,0,0,0.05)', transition: 'box-shadow 0.15s' }}
                  onMouseOver={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.09)')}
                  onMouseOut={e => (e.currentTarget.style.boxShadow = '0 1px 8px rgba(0,0,0,0.05)')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: k.color }}>
                    {k.icon}
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{k.label}</span>
                  </div>
                  {dataLoading
                    ? <Skeleton w={40} h={28} />
                    : <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--charcoal)', fontFamily: 'Manrope, sans-serif' }}>{k.value}</div>
                  }
                </div>
              </Link>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, marginBottom: 24 }}>

            {/* Recent couples */}
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--charcoal)', fontFamily: 'Manrope, sans-serif' }}>Parejas recientes</span>
                <Link href="/wp/clients" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Ver todas <ArrowRight size={12} />
                </Link>
              </div>

              {dataLoading ? (
                <div style={{ padding: '20px 22px' }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                      <Skeleton w={36} h={36} radius={18} />
                      <div style={{ flex: 1 }}><Skeleton w="55%" h={13} /><div style={{ marginTop: 6 }}><Skeleton w="35%" h={11} /></div></div>
                    </div>
                  ))}
                </div>
              ) : recentClients.length === 0 ? (
                <div style={{ padding: '40px 22px', textAlign: 'center' }}>
                  <Heart size={28} style={{ color: 'var(--ivory)', marginBottom: 10 }} />
                  <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 14 }}>Sin parejas todavía</div>
                  <Link href="/wp/clients" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none' }}>Añade tu primera pareja →</Link>
                </div>
              ) : (
                recentClients.map((c: any) => {
                  const pendingCount = (c.wp_client_venues || []).filter((v: any) => v.availability_status === 'requested').length
                  return (
                    <Link key={c.id} href={`/wp/clients/${c.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 22px', borderBottom: '1px solid var(--ivory)', transition: 'background 0.12s' }}
                        onMouseOver={e => (e.currentTarget.style.background = 'rgba(196,151,90,0.03)')}
                        onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(196,151,90,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Heart size={14} color="var(--gold)" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 1 }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                            {c.wedding_date ? new Date(c.wedding_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha'}
                            {c.guest_count ? ` · ${c.guest_count} inv.` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                          {pendingCount > 0 && (
                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontWeight: 700 }}>
                              {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Pending venues */}
              <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--ivory)' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--charcoal)', fontFamily: 'Manrope, sans-serif' }}>
                    <Clock size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5, color: '#3b82f6' }} />
                    Respuestas pendientes
                  </span>
                </div>
                {dataLoading ? (
                  <div style={{ padding: '14px 18px' }}><Skeleton /><div style={{ marginTop: 8 }}><Skeleton w="70%" /></div></div>
                ) : pendingVenues.length === 0 ? (
                  <div style={{ padding: '24px 18px', textAlign: 'center' }}>
                    <CheckCircle size={22} style={{ color: '#22c55e', marginBottom: 8 }} />
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Sin respuestas pendientes</div>
                  </div>
                ) : (
                  pendingVenues.map((v: any, i: number) => (
                    <Link key={i} href={`/wp/clients/${v.clientId}`} style={{ textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid var(--ivory)', transition: 'background 0.12s' }}
                        onMouseOver={e => (e.currentTarget.style.background = 'rgba(196,151,90,0.03)')}
                        onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Building2 size={12} color="#3b82f6" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.clientName}</div>
                          <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 600 }}>Esperando respuesta del venue</div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>

              {/* Quick actions */}
              <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--ivory)' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--charcoal)', fontFamily: 'Manrope, sans-serif' }}>Acciones rápidas</span>
                </div>
                {[
                  { href: '/wp/clients', icon: <Users size={14} />, label: 'Ver todas las parejas', color: 'var(--gold)' },
                  { href: '/wp/venues',  icon: <Building2 size={14} />, label: 'Explorar venues', color: '#6366f1' },
                  { href: '/wp/branding', icon: <Palette size={14} />, label: 'Branding de propuesta', color: '#ec4899' },
                ].map(item => (
                  <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: '1px solid var(--ivory)', transition: 'background 0.12s' }}
                      onMouseOver={e => (e.currentTarget.style.background = 'rgba(196,151,90,0.03)')}
                      onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ color: item.color }}>{item.icon}</div>
                      <span style={{ fontSize: 13, color: 'var(--charcoal)', fontWeight: 500 }}>{item.label}</span>
                      <ArrowRight size={12} style={{ marginLeft: 'auto', color: 'var(--warm-gray)' }} />
                    </div>
                  </Link>
                ))}
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

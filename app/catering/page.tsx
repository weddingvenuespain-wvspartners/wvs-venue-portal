'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { UtensilsCrossed, Users, TrendingUp, CheckCircle, ArrowRight, Clock } from 'lucide-react'

function Skeleton({ w, h = 14, radius = 4 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{
      width: w || '100%', height: h, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--ivory) 25%, var(--cream) 50%, var(--ivory) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }} />
  )
}

export default function CateringDashboard() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()

  const [stats, setStats] = useState({ total: 0, new: 0, won: 0, pending: 0 })
  const [recentLeads, setRecentLeads] = useState<any[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && profile && profile.role !== 'catering') router.replace('/dashboard')
  }, [loading, user, profile]) // eslint-disable-line

  useEffect(() => {
    if (!user || profile?.role !== 'catering') return
    const supabase = createClient()
    supabase
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        const all = data || []
        setRecentLeads(all)
        setStats({
          total:   all.length,
          new:     all.filter((l: any) => l.status === 'new').length,
          won:     all.filter((l: any) => l.status === 'won').length,
          pending: all.filter((l: any) => !['won','lost'].includes(l.status)).length,
        })
        setDataLoading(false)
      })
  }, [user?.id, profile?.role]) // eslint-disable-line

  const kpis = [
    { label: 'Solicitudes recibidas', value: stats.total,   color: 'var(--gold)',  icon: <Users size={18} /> },
    { label: 'Nuevas solicitudes',    value: stats.new,     color: '#ef4444',      icon: <Clock size={18} /> },
    { label: 'En proceso',            value: stats.pending, color: '#3b82f6',      icon: <TrendingUp size={18} /> },
    { label: 'Confirmadas',           value: stats.won,     color: '#22c55e',      icon: <CheckCircle size={18} /> },
  ]

  const STATUS_LABEL: Record<string, string> = { new: 'Nuevo', contacted: 'Contactado', won: 'Confirmado', lost: 'Perdido' }
  const STATUS_COLOR: Record<string, string>  = { new: '#ef4444', contacted: '#3b82f6', won: '#22c55e', lost: 'var(--warm-gray)' }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout"><main style={{ padding: '32px 40px', overflowY: 'auto', flex: 1 }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 13, color: 'var(--warm-gray)' }}>
            Bienvenido/a{profile?.display_name ? `, ${profile.display_name}` : ''}. Aquí tienes el resumen de tu actividad.
          </p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: '#fff', borderRadius: 12, padding: '20px', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: k.color }}>
                {k.icon}
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.06em' }}>{k.label.toUpperCase()}</span>
              </div>
              {dataLoading
                ? <Skeleton w={40} h={28} />
                : <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--charcoal)', fontFamily: 'Manrope, sans-serif' }}>{k.value}</div>
              }
            </div>
          ))}
        </div>

        {/* Recent leads */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 8px rgba(0,0,0,0.05)', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--charcoal)', fontFamily: 'Manrope, sans-serif' }}>Solicitudes recientes</span>
            <Link href="/catering/leads" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              Ver todas <ArrowRight size={12} />
            </Link>
          </div>
          {dataLoading ? (
            <div style={{ padding: 24 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                  <Skeleton w={36} h={36} radius={18} />
                  <div style={{ flex: 1 }}><Skeleton w="60%" h={13} /><div style={{ marginTop: 6 }}><Skeleton w="40%" h={11} /></div></div>
                </div>
              ))}
            </div>
          ) : recentLeads.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <UtensilsCrossed size={32} style={{ color: 'var(--ivory)', marginBottom: 12 }} />
              <div style={{ fontSize: 14, color: 'var(--warm-gray)' }}>Aún no has recibido solicitudes</div>
            </div>
          ) : recentLeads.map((l: any) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderBottom: '1px solid var(--ivory)' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(34,197,94,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={15} color="#16a34a" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)' }}>{l.name}</div>
                <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                  {l.wedding_date ? new Date(l.wedding_date).toLocaleDateString('es-ES') : 'Sin fecha'}
                  {l.guests ? ` · ${l.guests} inv.` : ''}
                  {l.source === 'wedding_planner' ? ' · Planner' : ''}
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLOR[l.status] || 'var(--warm-gray)', padding: '3px 8px', borderRadius: 8, background: `${STATUS_COLOR[l.status] || '#999'}15` }}>
                {STATUS_LABEL[l.status] || l.status}
              </span>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { href: '/catering/ficha',        label: 'Mi ficha',    sub: 'Actualiza tu perfil y menús' },
            { href: '/catering/leads',         label: 'Solicitudes', sub: 'Gestiona tus peticiones' },
            { href: '/catering/propuestas',    label: 'Propuestas',  sub: 'Crea propuestas digitales' },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '18px 20px', background: '#fff', borderRadius: 12, textDecoration: 'none', boxShadow: '0 1px 8px rgba(0,0,0,0.05)', transition: 'box-shadow 0.15s' }}
              onMouseOver={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)')}
              onMouseOut={e => (e.currentTarget.style.boxShadow = '0 1px 8px rgba(0,0,0,0.05)')}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)' }}>{item.label}</div>
              <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{item.sub}</div>
            </Link>
          ))}
        </div>

      </main>
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { TrendingUp, Users, CheckCircle, XCircle, BarChart2 } from 'lucide-react'

export default function CateringEstadisticasPage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()

  const [stats, setStats] = useState<any>(null)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && profile && profile.role !== 'catering') router.replace('/dashboard')
  }, [loading, user, profile]) // eslint-disable-line

  useEffect(() => {
    if (!user || profile?.role !== 'catering') return
    const supabase = createClient()
    supabase.from('leads').select('status, source, created_at').eq('user_id', user.id)
      .then(({ data }) => {
        const all = data || []
        const bySource = all.reduce((acc: any, l: any) => {
          const src = l.source || 'direct'
          acc[src] = (acc[src] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        const byMonth: Record<string, number> = {}
        all.forEach((l: any) => {
          const m = l.created_at?.slice(0, 7)
          if (m) byMonth[m] = (byMonth[m] || 0) + 1
        })
        setStats({
          total:      all.length,
          won:        all.filter((l: any) => l.status === 'won').length,
          lost:       all.filter((l: any) => l.status === 'lost').length,
          active:     all.filter((l: any) => !['won','lost'].includes(l.status)).length,
          conversion: all.length ? Math.round(all.filter((l: any) => l.status === 'won').length / all.length * 100) : 0,
          bySource,
          byMonth: Object.entries(byMonth).sort(([a],[b]) => a.localeCompare(b)).slice(-6),
        })
        setDataLoading(false)
      })
  }, [user?.id, profile?.role]) // eslint-disable-line

  const SOURCE_LABEL: Record<string, string> = { wedding_planner: 'Wedding Planner', direct: 'Directo', web: 'Web', otros: 'Otros' }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout"><main style={{ padding: '32px 40px', overflowY: 'auto', flex: 1 }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>Estadísticas</h1>
          <p style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Análisis de tus solicitudes y conversiones.</p>
        </div>

        {dataLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <div style={{ width: 20, height: 20, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : !stats || stats.total === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <BarChart2 size={40} style={{ color: 'var(--ivory)', marginBottom: 14 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>Sin datos todavía</div>
            <div style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Las estadísticas aparecerán cuando recibas solicitudes</div>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
              {[
                { label: 'Total solicitudes', value: stats.total,      color: 'var(--gold)',  icon: <Users size={18} /> },
                { label: 'En proceso',        value: stats.active,     color: '#3b82f6',      icon: <TrendingUp size={18} /> },
                { label: 'Confirmadas',        value: stats.won,        color: '#22c55e',      icon: <CheckCircle size={18} /> },
                { label: 'Conversión',         value: `${stats.conversion}%`, color: '#8b5cf6', icon: <BarChart2 size={18} /> },
              ].map(k => (
                <div key={k.label} style={{ background: '#fff', borderRadius: 12, padding: '20px', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: k.color }}>
                    {k.icon}
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.06em' }}>{k.label.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--charcoal)', fontFamily: 'Manrope, sans-serif' }}>{k.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Por origen */}
              <div style={{ background: '#fff', borderRadius: 12, padding: '24px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 20 }}>Solicitudes por origen</h3>
                {Object.entries(stats.bySource).map(([src, count]: any) => {
                  const pct = stats.total ? Math.round(count / stats.total * 100) : 0
                  return (
                    <div key={src} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: 'var(--charcoal)' }}>{SOURCE_LABEL[src] || src}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--ivory)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: src === 'wedding_planner' ? '#8b5cf6' : 'var(--gold)', borderRadius: 3, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Por mes */}
              <div style={{ background: '#fff', borderRadius: 12, padding: '24px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 20 }}>Solicitudes mensuales</h3>
                {stats.byMonth.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Sin datos</p>
                ) : (() => {
                  const max = Math.max(...stats.byMonth.map(([, n]: any) => n as number))
                  return stats.byMonth.map(([month, count]: any) => {
                    const pct = max ? Math.round(count / max * 100) : 0
                    const [y, m] = month.split('-')
                    const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
                    return (
                      <div key={month} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 11, color: 'var(--warm-gray)', width: 40, flexShrink: 0 }}>{label}</span>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--ivory)' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--charcoal)', width: 20, textAlign: 'right' }}>{count}</span>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          </>
        )}
      </main>
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import {
  DollarSign, TrendingUp, TrendingDown, ArrowLeftRight,
  Landmark, RefreshCw, Loader2, Zap,
} from 'lucide-react'

export default function AdminStatsPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [syncingPlans, setSyncingPlans] = useState(false)
  const [plans, setPlans] = useState<any[]>([])
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)

  const notify = (msg: string, isErr = false) => {
    setToast(msg); setToastError(isErr)
    setTimeout(() => setToast(''), 4000)
  }

  const loadMetrics = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/metrics')
      const data = await res.json()
      if (res.ok) setMetrics(data)
    } catch {} finally { setLoading(false) }
  }

  const loadPlans = async () => {
    try {
      const { createClient } = await import('@/lib/supabase')
      const supabase = createClient()
      const { data } = await supabase.from('venue_plans').select('id, name, display_name, is_active, stripe_product_id')
      if (data) setPlans(data)
    } catch {}
  }

  const syncAllPlansToStripe = async () => {
    setSyncingPlans(true)
    try {
      let synced = 0
      for (const plan of plans) {
        const res = await fetch('/api/stripe/sync-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: plan.id }),
        })
        if (res.ok) synced++
      }
      notify(`${synced} plan(es) sincronizado(s) con Stripe`)
      loadPlans()
    } catch {
      notify('Error al sincronizar', true)
    } finally {
      setSyncingPlans(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    if (profile?.role !== 'admin') { router.push('/dashboard'); return }
    loadMetrics()
    loadPlans()
  }, [authLoading]) // eslint-disable-line

  return (
    <>
      <Sidebar />
      <main className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Estadísticas</div>
          <div className="topbar-subtitle">Métricas SaaS y gestión de Stripe</div>
        </div>

        <div className="page-content">
          {toast && (
            <div className={toastError ? 'alert alert-error' : 'alert alert-success'} style={{ marginBottom: 16 }}>
              {toast}
            </div>
          )}

          {loading || !metrics ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--warm-gray)' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 13 }}>Calculando métricas...</div>
            </div>
          ) : (
            <>
              {/* KPIs — 3 columns top row, 2 columns bottom row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                {[
                  { label: 'MRR', value: `${metrics.mrr.toLocaleString('es-ES')}€`, sub: `ARR: ${metrics.arr.toLocaleString('es-ES')}€`, icon: DollarSign, color: '#4A6B52' },
                  { label: 'Suscripciones activas', value: metrics.activeSubs, sub: `${metrics.totalSubs} totales`, icon: TrendingUp, color: '#4F6D8C' },
                  { label: 'Churn (30d)', value: `${metrics.churnRate}%`, sub: `${metrics.churnCount} canceladas`, icon: TrendingDown, color: metrics.churnRate > 5 ? '#BC5249' : '#8A6A38' },
                ].map(kpi => (
                  <div key={kpi.label} className="card" style={{ padding: '16px 18px', marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <kpi.icon size={14} style={{ color: kpi.color }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{kpi.label}</span>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: kpi.color, lineHeight: 1.1 }}>{kpi.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>{kpi.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Trial → Pago', value: `${metrics.trialConversion}%`, sub: `${metrics.trialsActive} en trial · ${metrics.trialsConverted} convertidos`, icon: ArrowLeftRight, color: '#8A6A38' },
                  { label: 'LTV', value: `${metrics.ltv.toLocaleString('es-ES')}€`, sub: `ARPU: ${metrics.arpu.toLocaleString('es-ES')}€/mes`, icon: Landmark, color: '#5A4878' },
                ].map(kpi => (
                  <div key={kpi.label} className="card" style={{ padding: '16px 18px', marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <kpi.icon size={14} style={{ color: kpi.color }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{kpi.label}</span>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: kpi.color, lineHeight: 1.1 }}>{kpi.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>{kpi.sub}</div>
                  </div>
                ))}
              </div>

              {/* Charts row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* Revenue chart */}
                <div className="card" style={{ padding: '20px', marginBottom: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 14 }}>
                    Ingresos últimos 12 meses
                  </div>
                  {(() => {
                    const maxRev = Math.max(...metrics.revenueByMonth.map((r: any) => r.revenue), 1)
                    const hasAnyRevenue = metrics.revenueByMonth.some((m: any) => m.revenue > 0)
                    return (
                      <div style={{ position: 'relative' }}>
                        {!hasAnyRevenue && (
                          <div style={{
                            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, color: 'var(--warm-gray)', zIndex: 1,
                          }}>
                            Sin ingresos registrados
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, opacity: hasAnyRevenue ? 1 : 0.3 }}>
                          {metrics.revenueByMonth.map((m: any) => {
                            const h = m.revenue > 0 ? Math.max(12, (m.revenue / maxRev) * 100) : 6
                            return (
                              <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                {m.revenue > 0 && (
                                  <div style={{ fontSize: 9, color: '#4A6B52', fontWeight: 700 }}>
                                    {m.revenue}€
                                  </div>
                                )}
                                <div
                                  title={`${m.month}: ${m.revenue}€ (${m.count} pagos)`}
                                  style={{
                                    width: '100%', height: h, minWidth: 10, borderRadius: 4,
                                    background: m.revenue > 0
                                      ? 'linear-gradient(180deg, #4A6B52 0%, #5C8A66 100%)'
                                      : 'var(--ivory)',
                                    transition: 'height 0.3s',
                                  }}
                                />
                                <span style={{ fontSize: 9, color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>
                                  {m.month.split('-')[1] || m.month}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Plan breakdown — enhanced with per-plan metrics */}
                <div className="card" style={{ padding: '20px', marginBottom: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 14 }}>
                    Desglose por plan
                  </div>
                  {metrics.planBreakdown.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--warm-gray)', padding: '30px 0', textAlign: 'center' }}>
                      Sin suscripciones activas
                    </div>
                  ) : (
                    <div>
                      {metrics.planBreakdown.map((pb: any, i: number) => (
                        <div key={pb.plan} style={{
                          padding: '12px 0',
                          borderBottom: i < metrics.planBreakdown.length - 1 ? '1px solid var(--ivory)' : 'none',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div>
                              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)' }}>{pb.plan}</span>
                              <span style={{ fontSize: 12, color: 'var(--warm-gray)', marginLeft: 8 }}>
                                {pb.count} activa{pb.count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#4A6B52' }}>{pb.revenue.toFixed(0)}€/mes</span>
                          </div>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {pb.trialCount > 0 && (
                              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(196,151,90,0.1)', color: '#8A6A38', fontWeight: 500 }}>
                                {pb.trialCount} en trial
                              </span>
                            )}
                            {pb.churnCount > 0 && (
                              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(188,82,73,0.08)', color: '#BC5249', fontWeight: 500 }}>
                                {pb.churnCount} cancelada{pb.churnCount !== 1 ? 's' : ''}
                              </span>
                            )}
                            {pb.conversionRate > 0 && (
                              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(74,107,82,0.1)', color: '#4A6B52', fontWeight: 500 }}>
                                {pb.conversionRate}% conversión
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{
                    marginTop: 14, padding: '10px 12px', borderRadius: 6,
                    background: 'var(--cream)', fontSize: 11, color: 'var(--warm-gray)',
                  }}>
                    {Object.entries(metrics.statusBreakdown).map(([k, v]) => (
                      <span key={k} style={{ marginRight: 12 }}>
                        <strong style={{ color: 'var(--charcoal)' }}>{String(v)}</strong> {k}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stripe section */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" fill="#635BFF"/></svg>
                      Stripe Billing
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 4, maxWidth: 500 }}>
                      Los planes se sincronizan automáticamente cuando un venue contrata. También puedes forzar la sincronización manualmente.
                    </div>
                  </div>
                  <button
                    onClick={syncAllPlansToStripe}
                    disabled={syncingPlans || plans.length === 0}
                    className="btn btn-sm"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                      background: syncingPlans ? 'var(--warm-gray)' : '#635BFF',
                      color: '#fff', border: 'none',
                    }}
                  >
                    {syncingPlans ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={12} />}
                    {syncingPlans ? 'Sincronizando...' : 'Sync planes → Stripe'}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                  {plans.map(p => (
                    <div key={p.id} style={{
                      padding: '12px 16px', borderRadius: 8,
                      background: 'var(--cream)', border: '1px solid var(--ivory)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)' }}>
                          {p.display_name || p.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>
                          {p.is_active ? '● Activo' : '○ Inactivo'}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                        background: p.stripe_product_id ? 'rgba(74,107,82,0.1)' : 'rgba(188,82,73,0.08)',
                        color: p.stripe_product_id ? '#4A6B52' : '#BC5249',
                      }}>
                        {p.stripe_product_id ? '✓ Sincronizado' : '✗ No sincronizado'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Refresh */}
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <button onClick={() => { loadMetrics(); loadPlans() }} className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <RefreshCw size={12} /> Actualizar
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  )
}

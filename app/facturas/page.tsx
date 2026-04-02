'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Download, FileText, ExternalLink, RefreshCw } from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Invoice = {
  id: string
  stripe_invoice_id: string | null
  stripe_payment_intent: string | null
  plan_name: string
  period_start: string | null
  period_end: string | null
  amount_subtotal: number
  amount_tax: number
  amount_total: number
  currency: string
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void'
  payment_method_brand: string | null
  payment_method_last4: string | null
  pdf_url: string | null
  hosted_invoice_url: string | null
  billing_name: string | null
  created_at: string
}

type VenueProfile = {
  status: string
  role: string
  wp_venue_id: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  paid:           { label: 'Pagada',      badge: 'badge-active' },
  open:           { label: 'Pendiente',   badge: 'badge-pending' },
  draft:          { label: 'Borrador',    badge: 'badge-inactive' },
  uncollectible:  { label: 'Impagada',    badge: 'badge-danger' },
  void:           { label: 'Anulada',     badge: 'badge-inactive' },
}

function formatEuros(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

function formatPeriod(start: string | null, end: string | null) {
  if (!start || !end) return '—'
  const s = new Date(start).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  const e = new Date(end).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${s} – ${e}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getPlanBadge(plan: string) {
  const map: Record<string, string> = {
    Starter: 'badge-inactive',
    Premium: 'badge-active',
    Enterprise: 'badge-contacted',
  }
  return map[plan] ?? 'badge-inactive'
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FacturasPage() {
  const router  = useRouter()
  const { user, profile, loading: authLoading } = useAuth()

  const [invoices,      setInvoices]      = useState<Invoice[]>([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [selectedInv,   setSelectedInv]   = useState<Invoice | null>(null)
  const [filterStatus,  setFilterStatus]  = useState<string>('all')
  const [error,         setError]         = useState('')

  // ── Auth guard
  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadInvoices()
  }, [user, authLoading])

  // ── Carga facturas
  const loadInvoices = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (err) setError('Error al cargar las facturas')
    else setInvoices(data ?? [])

    setLoading(false)
    setRefreshing(false)
  }

  // ── Métricas
  const totalPaid  = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount_total, 0)
  const pending    = invoices.filter(i => i.status === 'open')
  const pendingAmt = pending.reduce((s, i) => s + i.amount_total, 0)
  const thisYear   = new Date().getFullYear()
  const paidYear   = invoices
    .filter(i => i.status === 'paid' && new Date(i.created_at).getFullYear() === thisYear)
    .reduce((s, i) => s + i.amount_total, 0)

  // ── Suscripción activa (última factura pagada)
  const lastPaid = invoices.find(i => i.status === 'paid')

  // ── Filtrado
  const filtered = filterStatus === 'all'
    ? invoices
    : invoices.filter(i => i.status === filterStatus)

  // ── Loading skeleton
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1A1512', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C4975A', fontFamily: 'serif' }}>Cargando facturas...</div>
    </div>
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">

        {/* ── Topbar */}
        <div className="topbar">
          <div className="topbar-title">Mis facturas</div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => loadInvoices(true)}
            disabled={refreshing}
            title="Sincronizar con Stripe"
          >
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Sincronizando...' : 'Actualizar'}
          </button>
        </div>

        <div className="page-content">
          {error && <div className="alert alert-error">{error}</div>}

          {/* ── Banner suscripción activa */}
          {lastPaid && (
            <div className="card" style={{ marginBottom: 20, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>Plan {lastPaid.plan_name}</span>
                  <span className="badge badge-active">Activo</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 3 }}>
                  {lastPaid.payment_method_brand && lastPaid.payment_method_last4
                    ? `${lastPaid.payment_method_brand.charAt(0).toUpperCase() + lastPaid.payment_method_brand.slice(1)} ···· ${lastPaid.payment_method_last4}`
                    : 'Método de pago registrado'
                  }
                  {lastPaid.period_end && ` · Período activo hasta ${formatDate(lastPaid.period_end)}`}
                </div>
              </div>
              <a
                href="https://billing.stripe.com/p/login/test_xxx"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
              >
                <ExternalLink size={12} /> Portal de pagos
              </a>
            </div>
          )}

          {/* ── Stats */}
          <div className="stats-grid">
            <div className="stat-card accent">
              <div className="stat-label">Pagado en {thisYear}</div>
              <div className="stat-value">{formatEuros(paidYear)}</div>
              <div className="stat-sub">{invoices.filter(i => i.status === 'paid' && new Date(i.created_at).getFullYear() === thisYear).length} facturas</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total histórico</div>
              <div className="stat-value">{formatEuros(totalPaid)}</div>
              <div className="stat-sub">{invoices.filter(i => i.status === 'paid').length} pagadas</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pendiente de pago</div>
              <div className="stat-value">{formatEuros(pendingAmt)}</div>
              <div className="stat-sub">{pending.length} {pending.length === 1 ? 'factura' : 'facturas'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Plan actual</div>
              <div className="stat-value" style={{ fontSize: 18 }}>{lastPaid?.plan_name ?? '—'}</div>
              <div className="stat-sub">Suscripción mensual</div>
            </div>
          </div>

          {/* ── Tabla */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <FileText size={14} style={{ color: 'var(--warm-gray)' }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Historial de facturas</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <select
                  className="form-input"
                  style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                >
                  <option value="all">Todos los estados</option>
                  <option value="paid">Pagadas</option>
                  <option value="open">Pendientes</option>
                  <option value="void">Anuladas</option>
                </select>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nº Factura</th>
                    <th>Plan</th>
                    <th>Período</th>
                    <th>Base imp.</th>
                    <th>IVA 21%</th>
                    <th>Total</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--warm-gray)' }}>
                        <FileText size={28} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                        <div>No hay facturas aún.</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>Aparecerán aquí cuando se genere tu primera factura mensual.</div>
                      </td>
                    </tr>
                  )}
                  {filtered.map(inv => {
                    const sc = STATUS_CONFIG[inv.status] ?? { label: inv.status, badge: 'badge-inactive' }
                    return (
                      <tr key={inv.id}>
                        <td>
                          <div
                            style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--warm-gray)', cursor: 'pointer' }}
                            onClick={() => setSelectedInv(inv)}
                          >
                            {inv.stripe_invoice_id
                              ? inv.stripe_invoice_id.replace('in_', '#').slice(0, 14)
                              : `#${inv.id.slice(0, 8).toUpperCase()}`
                            }
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${getPlanBadge(inv.plan_name)}`}>{inv.plan_name}</span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>
                          {formatPeriod(inv.period_start, inv.period_end)}
                        </td>
                        <td style={{ fontSize: 13 }}>{formatEuros(inv.amount_subtotal)}</td>
                        <td style={{ fontSize: 13, color: 'var(--warm-gray)' }}>{formatEuros(inv.amount_tax)}</td>
                        <td style={{ fontSize: 14, fontWeight: 500 }}>{formatEuros(inv.amount_total)}</td>
                        <td style={{ fontSize: 12, color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>
                          {formatDate(inv.created_at)}
                        </td>
                        <td>
                          <span className={`badge ${sc.badge}`}>{sc.label}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setSelectedInv(inv)}
                              title="Ver detalle"
                            >
                              <FileText size={11} />
                            </button>
                            {inv.pdf_url && (
                              <a
                                href={inv.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-ghost btn-sm"
                                title="Descargar PDF"
                              >
                                <Download size={11} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal detalle factura */}
      {selectedInv && (
        <div className="modal-overlay" onClick={() => setSelectedInv(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {selectedInv.stripe_invoice_id
                  ? selectedInv.stripe_invoice_id.replace('in_', 'Factura #').slice(0, 18)
                  : `Factura #${selectedInv.id.slice(0, 8).toUpperCase()}`
                }
              </div>
              <div className="modal-sub">{formatDate(selectedInv.created_at)}</div>
            </div>

            <div className="modal-body">
              {/* Venue */}
              {selectedInv.billing_name && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 2 }}>FACTURADO A</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{selectedInv.billing_name}</div>
                </div>
              )}

              {/* Desglose */}
              <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--warm-gray)' }}>Plan</span>
                  <span>{selectedInv.plan_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--warm-gray)' }}>Período</span>
                  <span>{formatPeriod(selectedInv.period_start, selectedInv.period_end)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--warm-gray)' }}>Base imponible</span>
                  <span>{formatEuros(selectedInv.amount_subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--warm-gray)' }}>IVA (21%)</span>
                  <span>{formatEuros(selectedInv.amount_tax)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 600, padding: '8px 0 4px' }}>
                  <span>Total</span>
                  <span>{formatEuros(selectedInv.amount_total)}</span>
                </div>
              </div>

              {/* Pago */}
              {selectedInv.payment_method_last4 && (
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 4 }}>
                  Cobrado con {selectedInv.payment_method_brand} ···· {selectedInv.payment_method_last4}
                </div>
              )}
              {selectedInv.stripe_payment_intent && (
                <div style={{ fontSize: 11, color: 'var(--warm-gray)', fontFamily: 'monospace' }}>
                  Ref: {selectedInv.stripe_payment_intent}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setSelectedInv(null)}>Cerrar</button>
              {selectedInv.hosted_invoice_url && (
                <a
                  href={selectedInv.hosted_invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                >
                  <ExternalLink size={12} /> Ver en Stripe
                </a>
              )}
              {selectedInv.pdf_url && (
                <a
                  href={selectedInv.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  <Download size={12} /> Descargar PDF
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

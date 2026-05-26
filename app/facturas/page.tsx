'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { Download, FileText, ExternalLink, RefreshCw, Plus, Send, Eye, MoreHorizontal, Search, Receipt, CreditCard } from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type StripeInvoice = {
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

type VenueInvoice = {
  id: string
  invoice_number: string
  client_name: string
  client_email: string | null
  budget_id: string | null
  lead_id: string | null
  issue_date: string
  due_date: string | null
  wedding_date: string | null
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount_amount: number
  total: number
  amount_paid: number
  template: string
  status: string
  notes: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STRIPE: Record<string, { label: string; badge: string }> = {
  paid:          { label: 'Pagada',    badge: 'badge-active' },
  open:          { label: 'Pendiente', badge: 'badge-pending' },
  draft:         { label: 'Borrador',  badge: 'badge-inactive' },
  uncollectible: { label: 'Impagada',  badge: 'badge-danger' },
  void:          { label: 'Anulada',   badge: 'badge-inactive' },
}

const STATUS_VENUE: Record<string, { label: string; badge: string }> = {
  draft:     { label: 'Borrador',   badge: 'badge-inactive' },
  sent:      { label: 'Enviada',    badge: 'badge-pending' },
  paid:      { label: 'Pagada',     badge: 'badge-active' },
  partial:   { label: 'Parcial',    badge: 'badge-contacted' },
  overdue:   { label: 'Vencida',    badge: 'badge-danger' },
  cancelled: { label: 'Anulada',    badge: 'badge-inactive' },
}

function fmtEur(n: number, cents = false) {
  const val = cents ? n / 100 : n
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtPeriod(start: string | null, end: string | null) {
  if (!start || !end) return '—'
  const s = new Date(start).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  const e = new Date(end).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${s} – ${e}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FacturasPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const { isBlocked } = useRequireSubscription()

  const [tab, setTab] = useState<'venue' | 'stripe'>('venue')

  // Stripe invoices
  const [stripeInvoices, setStripeInvoices] = useState<StripeInvoice[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [selectedStripe, setSelectedStripe] = useState<StripeInvoice | null>(null)
  const [stripeFilter, setStripeFilter] = useState('all')

  // Venue invoices
  const [venueInvoices, setVenueInvoices] = useState<VenueInvoice[]>([])
  const [venueFilter, setVenueFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadAll()
  }, [user, authLoading])

  const loadAll = async () => {
    setLoading(true)
    const supabase = createClient()

    const venueRes = await supabase.from('venue_invoices').select('*').eq('user_id', user!.id).order('created_at', { ascending: false })

    // Stripe invoices table may not exist — handle gracefully
    const stripeRes = await supabase.from('invoices').select('*').eq('user_id', user!.id).order('created_at', { ascending: false })
    if (!stripeRes.error) setStripeInvoices(stripeRes.data ?? [])

    if (!venueRes.error) setVenueInvoices(venueRes.data ?? [])

    setLoading(false)
  }

  const refreshStripe = async () => {
    setRefreshing(true)
    const supabase = createClient()
    const { data } = await supabase.from('invoices').select('*').eq('user_id', user!.id).order('created_at', { ascending: false })
    if (data) setStripeInvoices(data)
    setRefreshing(false)
  }

  // ── Venue invoice stats
  const vTotalPaid = venueInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0)
  const vPending = venueInvoices.filter(i => i.status === 'sent' || i.status === 'partial' || i.status === 'overdue')
  const vPendingAmt = vPending.reduce((s, i) => s + (Number(i.total) - Number(i.amount_paid)), 0)
  const vThisYear = new Date().getFullYear()
  const vPaidYear = venueInvoices
    .filter(i => i.status === 'paid' && new Date(i.created_at).getFullYear() === vThisYear)
    .reduce((s, i) => s + Number(i.total), 0)

  // ── Filtered venue invoices
  const filteredVenue = venueInvoices
    .filter(i => venueFilter === 'all' || i.status === venueFilter)
    .filter(i => !searchQuery || i.client_name.toLowerCase().includes(searchQuery.toLowerCase()) || i.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()))

  // ── Stripe stats
  const sTotalPaid = stripeInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount_total, 0)
  const sPending = stripeInvoices.filter(i => i.status === 'open')
  const lastPaid = stripeInvoices.find(i => i.status === 'paid')
  const filteredStripe = stripeFilter === 'all' ? stripeInvoices : stripeInvoices.filter(i => i.status === stripeFilter)

  if (isBlocked) return null

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold)' }}>Cargando facturas...</div>
    </div>
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">

        {/* ── Topbar */}
        <div className="topbar">
          <div className="topbar-title">Facturas</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {tab === 'venue' && (
              <button className="btn btn-primary btn-sm" onClick={() => router.push('/facturas/nueva')}>
                <Plus size={13} /> Nueva factura
              </button>
            )}
            {tab === 'stripe' && (
              <button className="btn btn-ghost btn-sm" onClick={refreshStripe} disabled={refreshing}>
                <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                {refreshing ? 'Sincronizando...' : 'Actualizar'}
              </button>
            )}
          </div>
        </div>

        <div className="page-content">
          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

          {/* ── Tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
            <button
              onClick={() => setTab('venue')}
              style={{
                padding: '10px 20px', fontSize: 13, fontWeight: 500, border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: tab === 'venue' ? '2px solid var(--gold)' : '2px solid transparent',
                color: tab === 'venue' ? 'var(--espresso)' : 'var(--warm-gray)',
                marginBottom: -2
              }}
            >
              <Receipt size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Facturas a clientes ({venueInvoices.length})
            </button>
            <button
              onClick={() => setTab('stripe')}
              style={{
                padding: '10px 20px', fontSize: 13, fontWeight: 500, border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: tab === 'stripe' ? '2px solid var(--gold)' : '2px solid transparent',
                color: tab === 'stripe' ? 'var(--espresso)' : 'var(--warm-gray)',
                marginBottom: -2
              }}
            >
              <CreditCard size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Mi suscripción ({stripeInvoices.length})
            </button>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              TAB: Venue Invoices
              ═══════════════════════════════════════════════════════════════════ */}
          {tab === 'venue' && (
            <>
              {/* Stats */}
              <div className="stats-grid">
                <div className="stat-card accent">
                  <div className="stat-label">Facturado en {vThisYear}</div>
                  <div className="stat-value">{fmtEur(vPaidYear)}</div>
                  <div className="stat-sub">{venueInvoices.filter(i => i.status === 'paid' && new Date(i.created_at).getFullYear() === vThisYear).length} facturas cobradas</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total cobrado</div>
                  <div className="stat-value">{fmtEur(vTotalPaid)}</div>
                  <div className="stat-sub">{venueInvoices.filter(i => i.status === 'paid').length} facturas</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Pendiente de cobro</div>
                  <div className="stat-value">{fmtEur(vPendingAmt)}</div>
                  <div className="stat-sub">{vPending.length} {vPending.length === 1 ? 'factura' : 'facturas'}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total facturas</div>
                  <div className="stat-value" style={{ fontSize: 22 }}>{venueInvoices.length}</div>
                  <div className="stat-sub">emitidas</div>
                </div>
              </div>

              {/* Table */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  <Receipt size={14} style={{ color: 'var(--warm-gray)' }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Facturas emitidas</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                      <input
                        className="form-input"
                        placeholder="Buscar cliente o nº..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ padding: '5px 8px 5px 28px', fontSize: 12, width: 180 }}
                      />
                    </div>
                    <select
                      className="form-input"
                      style={{ padding: '5px 8px', fontSize: 12, width: 'auto' }}
                      value={venueFilter}
                      onChange={e => setVenueFilter(e.target.value)}
                    >
                      <option value="all">Todos</option>
                      <option value="draft">Borrador</option>
                      <option value="sent">Enviada</option>
                      <option value="paid">Pagada</option>
                      <option value="partial">Parcial</option>
                      <option value="overdue">Vencida</option>
                      <option value="cancelled">Anulada</option>
                    </select>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nº Factura</th>
                        <th>Cliente</th>
                        <th>Fecha</th>
                        <th>Vencimiento</th>
                        <th>Subtotal</th>
                        <th>IVA</th>
                        <th>Total</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVenue.length === 0 && (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--warm-gray)' }}>
                            <Receipt size={28} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                            <div style={{ fontWeight: 500 }}>No hay facturas aún</div>
                            <div style={{ fontSize: 12, marginTop: 4 }}>Crea tu primera factura para una pareja</div>
                            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => router.push('/facturas/nueva')}>
                              <Plus size={12} /> Nueva factura
                            </button>
                          </td>
                        </tr>
                      )}
                      {filteredVenue.map(inv => {
                        const sc = STATUS_VENUE[inv.status] ?? { label: inv.status, badge: 'badge-inactive' }
                        return (
                          <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/facturas/${inv.id}`)}>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 500 }}>{inv.invoice_number}</span>
                            </td>
                            <td>
                              <div style={{ fontWeight: 500, fontSize: 13 }}>{inv.client_name}</div>
                              {inv.client_email && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{inv.client_email}</div>}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>{fmtDate(inv.issue_date)}</td>
                            <td style={{ fontSize: 12, color: inv.status === 'overdue' ? 'var(--burgundy)' : 'var(--warm-gray)', whiteSpace: 'nowrap' }}>
                              {inv.due_date ? fmtDate(inv.due_date) : '—'}
                            </td>
                            <td style={{ fontSize: 13 }}>{fmtEur(inv.subtotal)}</td>
                            <td style={{ fontSize: 12, color: 'var(--warm-gray)' }}>{fmtEur(inv.tax_amount)}</td>
                            <td style={{ fontSize: 14, fontWeight: 600 }}>{fmtEur(inv.total)}</td>
                            <td><span className={`badge ${sc.badge}`}>{sc.label}</span></td>
                            <td>
                              <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); router.push(`/facturas/${inv.id}`) }}>
                                <Eye size={12} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB: Stripe Subscription Invoices
              ═══════════════════════════════════════════════════════════════════ */}
          {tab === 'stripe' && (
            <>
              {/* Active plan banner */}
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
                      {lastPaid.period_end && ` · Período activo hasta ${fmtDate(lastPaid.period_end)}`}
                    </div>
                  </div>
                  <a href="https://billing.stripe.com/p/login/test_xxx" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                    <ExternalLink size={12} /> Portal de pagos
                  </a>
                </div>
              )}

              {/* Stats */}
              <div className="stats-grid">
                <div className="stat-card accent">
                  <div className="stat-label">Pagado en {vThisYear}</div>
                  <div className="stat-value">{fmtEur(stripeInvoices.filter(i => i.status === 'paid' && new Date(i.created_at).getFullYear() === vThisYear).reduce((s, i) => s + i.amount_total, 0), true)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total histórico</div>
                  <div className="stat-value">{fmtEur(sTotalPaid, true)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Pendiente</div>
                  <div className="stat-value">{fmtEur(sPending.reduce((s, i) => s + i.amount_total, 0), true)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Plan actual</div>
                  <div className="stat-value" style={{ fontSize: 18 }}>{lastPaid?.plan_name ?? '—'}</div>
                </div>
              </div>

              {/* Table */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <FileText size={14} style={{ color: 'var(--warm-gray)' }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Historial de facturación</span>
                  <div style={{ marginLeft: 'auto' }}>
                    <select className="form-input" style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }} value={stripeFilter} onChange={e => setStripeFilter(e.target.value)}>
                      <option value="all">Todos</option>
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
                        <th>IVA</th>
                        <th>Total</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStripe.length === 0 && (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--warm-gray)' }}>
                            <FileText size={28} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                            <div>No hay facturas de suscripción</div>
                          </td>
                        </tr>
                      )}
                      {filteredStripe.map(inv => {
                        const sc = STATUS_STRIPE[inv.status] ?? { label: inv.status, badge: 'badge-inactive' }
                        return (
                          <tr key={inv.id}>
                            <td>
                              <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--warm-gray)', cursor: 'pointer' }} onClick={() => setSelectedStripe(inv)}>
                                {inv.stripe_invoice_id ? inv.stripe_invoice_id.replace('in_', '#').slice(0, 14) : `#${inv.id.slice(0, 8).toUpperCase()}`}
                              </div>
                            </td>
                            <td><span className={`badge ${inv.plan_name === 'Premium' ? 'badge-active' : inv.plan_name === 'Enterprise' ? 'badge-contacted' : 'badge-inactive'}`}>{inv.plan_name}</span></td>
                            <td style={{ fontSize: 12, color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>{fmtPeriod(inv.period_start, inv.period_end)}</td>
                            <td style={{ fontSize: 13 }}>{fmtEur(inv.amount_subtotal, true)}</td>
                            <td style={{ fontSize: 13, color: 'var(--warm-gray)' }}>{fmtEur(inv.amount_tax, true)}</td>
                            <td style={{ fontSize: 14, fontWeight: 500 }}>{fmtEur(inv.amount_total, true)}</td>
                            <td style={{ fontSize: 12, color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>{fmtDate(inv.created_at)}</td>
                            <td><span className={`badge ${sc.badge}`}>{sc.label}</span></td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedStripe(inv)} title="Detalle"><FileText size={11} /></button>
                                {inv.pdf_url && <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" title="PDF"><Download size={11} /></a>}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Stripe invoice detail modal */}
      {selectedStripe && (
        <div className="modal-overlay" onClick={() => setSelectedStripe(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {selectedStripe.stripe_invoice_id
                  ? selectedStripe.stripe_invoice_id.replace('in_', 'Factura #').slice(0, 18)
                  : `Factura #${selectedStripe.id.slice(0, 8).toUpperCase()}`}
              </div>
              <div className="modal-sub">{fmtDate(selectedStripe.created_at)}</div>
            </div>
            <div className="modal-body">
              {selectedStripe.billing_name && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 2 }}>FACTURADO A</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{selectedStripe.billing_name}</div>
                </div>
              )}
              <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                {[
                  ['Plan', selectedStripe.plan_name],
                  ['Período', fmtPeriod(selectedStripe.period_start, selectedStripe.period_end)],
                  ['Base imponible', fmtEur(selectedStripe.amount_subtotal, true)],
                  ['IVA (21%)', fmtEur(selectedStripe.amount_tax, true)],
                ].map(([k, v], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--warm-gray)' }}>{k}</span><span>{v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 600, padding: '8px 0 4px' }}>
                  <span>Total</span><span>{fmtEur(selectedStripe.amount_total, true)}</span>
                </div>
              </div>
              {selectedStripe.payment_method_last4 && (
                <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>
                  Cobrado con {selectedStripe.payment_method_brand} ···· {selectedStripe.payment_method_last4}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setSelectedStripe(null)}>Cerrar</button>
              {selectedStripe.hosted_invoice_url && (
                <a href={selectedStripe.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                  <ExternalLink size={12} /> Ver en Stripe
                </a>
              )}
              {selectedStripe.pdf_url && (
                <a href={selectedStripe.pdf_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
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

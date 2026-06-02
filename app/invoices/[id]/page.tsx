'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { ArrowLeft, Send, Download, Edit3, Trash2, CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type VenueInvoice = {
  id: string
  invoice_number: string
  client_name: string
  client_email: string | null
  client_nif: string | null
  client_address: string | null
  budget_id: string | null
  lead_id: string | null
  venue_name: string
  venue_nif: string | null
  venue_address: string | null
  venue_email: string | null
  venue_phone: string | null
  issue_date: string
  due_date: string | null
  wedding_date: string | null
  line_items: any[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount_amount: number
  total: number
  amount_paid: number
  template: string
  status: string
  notes: string | null
  payment_terms: string | null
  sent_at: string | null
  paid_at: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; badge: string; icon: any }> = {
  draft:     { label: 'Borrador',   badge: 'badge-inactive',  icon: Edit3 },
  sent:      { label: 'Enviada',    badge: 'badge-pending',   icon: Send },
  paid:      { label: 'Pagada',     badge: 'badge-active',    icon: CheckCircle },
  partial:   { label: 'Parcial',    badge: 'badge-contacted', icon: Clock },
  overdue:   { label: 'Vencida',    badge: 'badge-danger',    icon: AlertTriangle },
  cancelled: { label: 'Anulada',    badge: 'badge-inactive',  icon: XCircle },
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n))
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InvoiceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = params.id as string
  const { user, loading: authLoading } = useAuth()
  const { isBlocked } = useRequireSubscription()

  const [invoice, setInvoice] = useState<VenueInvoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadInvoice()
  }, [user, authLoading, invoiceId])

  const loadInvoice = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('venue_invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('user_id', user!.id)
      .single()

    setInvoice(data)
    setLoading(false)
  }

  const updateStatus = async (newStatus: string) => {
    if (!invoice) return
    setUpdating(true)
    const supabase = createClient()
    const updates: any = { status: newStatus }
    if (newStatus === 'sent') updates.sent_at = new Date().toISOString()
    if (newStatus === 'paid') { updates.paid_at = new Date().toISOString(); updates.amount_paid = invoice.total }

    await supabase.from('venue_invoices').update(updates).eq('id', invoice.id)
    await loadInvoice()
    setUpdating(false)
  }

  const deleteInvoice = async () => {
    if (!invoice || !confirm('¿Eliminar esta factura? Esta acción no se puede deshacer.')) return
    const supabase = createClient()
    await supabase.from('venue_invoices').delete().eq('id', invoice.id)
    router.push('/invoices')
  }

  if (isBlocked) return null
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold)' }}>Cargando factura...</div>
    </div>
  )

  if (!invoice) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="page-content" style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 14, color: 'var(--warm-gray)' }}>Factura no encontrada</div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => router.push('/invoices')}>
            <ArrowLeft size={13} /> Volver a facturas
          </button>
        </div>
      </div>
    </div>
  )

  const st = STATUS_MAP[invoice.status] ?? STATUS_MAP.draft
  const StIcon = st.icon
  const items = Array.isArray(invoice.line_items) ? invoice.line_items : []

  // Template accent color
  const accentMap: Record<string, string> = { classic: '#8B6914', modern: '#47648A', minimal: '#111' }
  const accent = accentMap[invoice.template] || '#8B6914'

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">

        {/* Topbar */}
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/invoices')}>
              <ArrowLeft size={14} />
            </button>
            <div className="topbar-title">
              {invoice.invoice_number}
            </div>
            <span className={`badge ${st.badge}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <StIcon size={11} /> {st.label}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {invoice.status === 'draft' && (
              <button className="btn btn-primary btn-sm" onClick={() => updateStatus('sent')} disabled={updating}>
                <Send size={13} /> Marcar enviada
              </button>
            )}
            {(invoice.status === 'sent' || invoice.status === 'partial' || invoice.status === 'overdue') && (
              <button className="btn btn-primary btn-sm" onClick={() => updateStatus('paid')} disabled={updating}>
                <CheckCircle size={13} /> Marcar pagada
              </button>
            )}
            {invoice.status === 'draft' && (
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--burgundy)' }} onClick={deleteInvoice}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: 24, display: 'flex', gap: 24, alignItems: 'flex-start' }}>

          {/* Invoice preview */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              background: 'white', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
              padding: 40, border: '1px solid var(--border)', maxWidth: 700, margin: '0 auto',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28, paddingBottom: 20, borderBottom: `2px solid ${accent}` }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: accent }}>Factura</div>
                  <div style={{ fontSize: 14, color: '#666', marginTop: 4, fontFamily: 'monospace' }}>{invoice.invoice_number}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{invoice.venue_name}</div>
                  {invoice.venue_nif && <div style={{ fontSize: 12, color: '#888' }}>{invoice.venue_nif}</div>}
                  {invoice.venue_address && <div style={{ fontSize: 12, color: '#888' }}>{invoice.venue_address}</div>}
                  {invoice.venue_email && <div style={{ fontSize: 12, color: '#888' }}>{invoice.venue_email}</div>}
                  {invoice.venue_phone && <div style={{ fontSize: 12, color: '#888' }}>{invoice.venue_phone}</div>}
                </div>
              </div>

              {/* Client + dates */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Facturar a</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{invoice.client_name}</div>
                  {invoice.client_nif && <div style={{ fontSize: 12, color: '#888' }}>{invoice.client_nif}</div>}
                  {invoice.client_address && <div style={{ fontSize: 12, color: '#888' }}>{invoice.client_address}</div>}
                  {invoice.client_email && <div style={{ fontSize: 12, color: '#888' }}>{invoice.client_email}</div>}
                </div>
                <div style={{ textAlign: 'right', fontSize: 12 }}>
                  <div style={{ color: '#999' }}>Fecha emisión: <span style={{ color: '#333' }}>{fmtDate(invoice.issue_date)}</span></div>
                  {invoice.due_date && <div style={{ color: '#999' }}>Vencimiento: <span style={{ color: '#333' }}>{fmtDate(invoice.due_date)}</span></div>}
                  {invoice.wedding_date && <div style={{ color: accent, marginTop: 4, fontWeight: 500 }}>Boda: {fmtDate(invoice.wedding_date)}</div>}
                </div>
              </div>

              {/* Items */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${accent}40` }}>
                    <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#999' }}>Concepto</th>
                    <th style={{ textAlign: 'center', padding: '8px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#999' }}>Uds.</th>
                    <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#999' }}>Precio</th>
                    <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#999' }}>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '10px 4px' }}>{item.concept}</td>
                      <td style={{ padding: '10px 4px', textAlign: 'center' }}>{item.qty}</td>
                      <td style={{ padding: '10px 4px', textAlign: 'right' }}>{fmtEur(item.unit_price)}</td>
                      <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 500 }}>{fmtEur(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ marginLeft: 'auto', width: 240 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#666' }}>
                  <span>Subtotal</span><span>{fmtEur(invoice.subtotal)}</span>
                </div>
                {Number(invoice.discount_amount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#c00' }}>
                    <span>Descuento</span><span>-{fmtEur(invoice.discount_amount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#666' }}>
                  <span>IVA ({invoice.tax_rate}%)</span><span>{fmtEur(invoice.tax_amount)}</span>
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700,
                  padding: '12px 0 4px', borderTop: `2px solid ${accent}`, marginTop: 4, color: accent,
                }}>
                  <span>TOTAL</span><span>{fmtEur(invoice.total)}</span>
                </div>
                {Number(invoice.amount_paid) > 0 && Number(invoice.amount_paid) < Number(invoice.total) && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', color: 'green' }}>
                      <span>Pagado</span><span>{fmtEur(invoice.amount_paid)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', fontWeight: 600 }}>
                      <span>Pendiente</span><span>{fmtEur(Number(invoice.total) - Number(invoice.amount_paid))}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              {(invoice.payment_terms || invoice.notes) && (
                <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #eee', fontSize: 12, color: '#888' }}>
                  {invoice.payment_terms && <div style={{ marginBottom: 4 }}><strong>Condiciones de pago:</strong> {invoice.payment_terms}</div>}
                  {invoice.notes && <div><strong>Notas:</strong> {invoice.notes}</div>}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar info */}
          <div style={{ width: 280, flexShrink: 0 }}>
            {/* Status card */}
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 10, textTransform: 'uppercase' }}>Estado</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span className={`badge ${st.badge}`} style={{ fontSize: 13, padding: '4px 10px' }}>{st.label}</span>
              </div>

              {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {invoice.status === 'draft' && (
                    <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => updateStatus('sent')} disabled={updating}>
                      <Send size={12} /> Marcar como enviada
                    </button>
                  )}
                  {(invoice.status === 'sent' || invoice.status === 'partial' || invoice.status === 'overdue') && (
                    <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => updateStatus('paid')} disabled={updating}>
                      <CheckCircle size={12} /> Marcar como pagada
                    </button>
                  )}
                  {invoice.status !== 'cancelled' && (
                    <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => updateStatus('cancelled')} disabled={updating}>
                      <XCircle size={12} /> Anular factura
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Info card */}
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 10, textTransform: 'uppercase' }}>Información</div>
              {[
                ['Creada', fmtDateShort(invoice.created_at)],
                ['Emitida', fmtDateShort(invoice.issue_date)],
                invoice.due_date ? ['Vencimiento', fmtDateShort(invoice.due_date)] : null,
                invoice.sent_at ? ['Enviada', fmtDateShort(invoice.sent_at)] : null,
                invoice.paid_at ? ['Cobrada', fmtDateShort(invoice.paid_at)] : null,
                invoice.wedding_date ? ['Fecha boda', fmtDateShort(invoice.wedding_date)] : null,
              ].filter((x): x is [string, string] => x !== null).map(([k, v], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--warm-gray)' }}>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>

            {/* Links */}
            {(invoice.budget_id || invoice.lead_id) && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 10, textTransform: 'uppercase' }}>Vinculado a</div>
                {invoice.budget_id && (
                  <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 4 }} onClick={() => router.push(`/budgets/${invoice.budget_id}`)}>
                    📋 Ver presupuesto
                  </button>
                )}
                {invoice.lead_id && (
                  <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => router.push(`/leads?open=${invoice.lead_id}`)}>
                    👤 Ver lead
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

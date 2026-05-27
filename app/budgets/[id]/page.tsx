'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import Sidebar from '@/components/Sidebar'
import {
  ArrowLeft, Receipt, Pencil, ExternalLink, Copy, Check, Send,
  Users, Calendar, Eye, Clock, CheckCircle, FileText, CreditCard,
  Loader2, X, Sparkles, Inbox, Download, AlertTriangle, Plus,
  UserCircle, ScrollText,
} from 'lucide-react'
import type { Budget, PaymentInstallment, LineItemGroup } from '@/lib/budget-types'

const S_BADGE: Record<string, string> = {
  draft: 'badge-inactive', sent: 'badge-contacted', viewed: 'badge-active',
  accepted: 'badge-confirmed', expired: 'badge-pending',
}
const S_LABEL: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviado', viewed: 'Visto',
  accepted: 'Aceptado', expired: 'Expirado',
}

const INV_STATUS: Record<string, { label: string; badge: string }> = {
  draft: { label: 'Borrador', badge: 'badge-inactive' },
  sent: { label: 'Enviada', badge: 'badge-pending' },
  paid: { label: 'Pagada', badge: 'badge-active' },
  partial: { label: 'Parcial', badge: 'badge-contacted' },
  overdue: { label: 'Vencida', badge: 'badge-danger' },
  cancelled: { label: 'Anulada', badge: 'badge-inactive' },
}

type Tab = 'resumen' | 'pagos' | 'facturas' | 'contrato'
type PaySubTab = 'recibido' | 'a_pagar'

function fmtEur(n: number) {
  return Number(n).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user, loading: authLoading, activeVenue } = useAuth()
  const { isBlocked } = useRequireSubscription()

  const [budget, setBudget] = useState<Budget | null>(null)
  const [lead, setLead] = useState<{ id: string; name: string; email?: string; contact_type?: string; planner_id?: string; client_id?: string } | null>(null)
  const [linkedClient, setLinkedClient] = useState<{ id: string; name: string; client_type: string; wp_commission_percent: number | null; wp_commission_mode: string | null } | null>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('resumen')
  const [paySubTab, setPaySubTab] = useState<PaySubTab>('recibido')
  const [copied, setCopied] = useState(false)

  // Linked data
  const [dossierData, setDossierData] = useState<any>(null)
  const [venueInvoices, setVenueInvoices] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])

  // For planner commission — checks lead, linked client (contact), and budget commission fields
  const isPlanner =
    lead?.contact_type === 'wedding_planner' || lead?.contact_type === 'organizer' ||
    !!lead?.planner_id ||
    linkedClient?.client_type === 'wedding_planner' || linkedClient?.client_type === 'organizador' ||
    !!(budget as any)?.commission_planner_id ||
    !!(budget as any)?.commission_percent

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    if (!activeVenue) { setLoading(false); return }
    loadBudget()
  }, [user, authLoading, activeVenue?.id, id]) // eslint-disable-line

  const loadBudget = async () => {
    if (!activeVenue) return
    setLoading(true)
    const supabase = createClient()

    const { data: b } = await supabase.from('budgets').select('*').eq('id', id).eq('venue_id', activeVenue.id).single()
    if (!b) { router.push('/budgets'); return }
    setBudget(b as Budget)

    // Load payments
    const { data: paymentsData } = await supabase.from('budget_payments').select('*').eq('budget_id', id).eq('status', 'paid').order('paid_at', { ascending: false })
    setPayments(paymentsData || [])

    // Load venue invoices for this budget
    const { data: invData } = await supabase.from('venue_invoices').select('*').eq('budget_id', id).order('created_at', { ascending: false })
    setVenueInvoices(invData || [])

    // Load contracts for this budget
    const { data: ctrData } = await supabase.from('venue_contracts').select('*').eq('budget_id', id).order('created_at', { ascending: false })
    setContracts(ctrData || [])

    // Load lead + dossier
    if (b.lead_id) {
      const { data: leadData } = await supabase.from('leads').select('id, name, email, contact_type, planner_id, client_id').eq('id', b.lead_id).maybeSingle()
      if (leadData) {
        setLead(leadData)
        // If lead has a linked client (contact), fetch it to detect planner type + commission
        if (leadData.client_id) {
          const { data: clientData } = await supabase.from('wp_clients').select('id, name, client_type, wp_commission_percent, wp_commission_mode').eq('id', leadData.client_id).maybeSingle()
          if (clientData) setLinkedClient(clientData)
        }
      }

      const { data: proposal } = await supabase.from('proposals').select('id, slug, couple_name, status, created_at').eq('lead_id', b.lead_id).eq('venue_id', activeVenue.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (proposal) {
        const [{ data: menuSel }, { data: inqs }] = await Promise.all([
          supabase.from('proposal_menu_selections').select('*').eq('proposal_id', proposal.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('proposal_inquiries').select('*').eq('proposal_id', proposal.id).order('created_at', { ascending: false }),
        ])
        setDossierData({ proposal, menuSelection: menuSel, inquiries: inqs || [] })
      }
    }

    setLoading(false)
  }

  const copyLink = () => {
    if (!budget) return
    navigator.clipboard.writeText(`${window.location.origin}/presupuesto/${budget.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Auto-generate draft invoice for a payment
  const generateInvoice = async (pay: any) => {
    const supabase = createClient()
    const { count } = await supabase.from('venue_invoices').select('id', { count: 'exact', head: true }).eq('user_id', user!.id)
    const num = ((count ?? 0) + 1).toString().padStart(4, '0')
    const year = new Date().getFullYear()

    // Get venue info
    const { data: vp } = await supabase.from('venue_profiles').select('company, billing_nif, billing_address, billing_email, billing_phone, wp_venue_id').eq('user_id', user!.id).limit(1).single()

    await supabase.from('venue_invoices').insert({
      user_id: user!.id,
      venue_id: String(vp?.wp_venue_id || activeVenue?.id || ''),
      invoice_number: `FAC-${year}-${num}`,
      client_name: budget!.couple_name,
      client_email: budget!.couple_email || lead?.email || null,
      budget_id: id,
      lead_id: budget!.lead_id,
      venue_name: vp?.company || '',
      venue_nif: vp?.billing_nif || null,
      venue_address: vp?.billing_address || null,
      venue_email: vp?.billing_email || null,
      venue_phone: vp?.billing_phone || null,
      issue_date: new Date().toISOString().slice(0, 10),
      wedding_date: budget!.wedding_date || null,
      line_items: [{ id: '1', concept: pay.payer_name || `Pago - ${budget!.couple_name}`, qty: 1, unit_price: Number(pay.amount), subtotal: Number(pay.amount) }],
      subtotal: Number(pay.amount),
      tax_rate: budget!.tax_rate || 21,
      tax_amount: Math.round(Number(pay.amount) * ((budget!.tax_rate || 21) / 100) * 100) / 100,
      total: Math.round(Number(pay.amount) * (1 + (budget!.tax_rate || 21) / 100) * 100) / 100,
      template: 'classic',
      status: 'draft',
      payment_terms: 'Pago gestionado a través de Stripe',
    })

    // Reload invoices
    const { data: invData } = await supabase.from('venue_invoices').select('*').eq('budget_id', id).order('created_at', { ascending: false })
    setVenueInvoices(invData || [])
  }

  if (isBlocked) return null
  if (loading) return (
    <div style={{ minHeight: '100vh' }}>
      <Sidebar />
      <div className="main-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--gold)' }} />
      </div>
    </div>
  )
  if (!budget) return null

  const plan = (budget.payment_plan || []) as PaymentInstallment[]
  const groups = (budget.line_items as any)?.groups || [] as LineItemGroup[]
  const paidCount = plan.filter(p => p.status === 'paid').length
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0)
  const subtotal = groups.reduce((sum: number, g: any) => sum + (g.items || []).reduce((s: number, i: any) => s + (Number(i.unit_price) * (i.qty || i.quantity || 1)), 0), 0)

  const TABS: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'resumen', label: 'Resumen', icon: <Receipt size={13} /> },
    { key: 'pagos', label: 'Pagos', icon: <CreditCard size={13} />, count: payments.length },
    { key: 'facturas', label: 'Facturas', icon: <FileText size={13} />, count: venueInvoices.length },
    { key: 'contrato', label: 'Contrato', icon: <ScrollText size={13} />, count: contracts.length },
  ]

  // Build payment timeline
  const timelineEvents = [
    { date: budget.created_at, label: 'Presupuesto creado', type: 'info' },
    ...(budget.sent_at ? [{ date: budget.sent_at, label: 'Presupuesto enviado', type: 'info' }] : []),
    ...(budget.first_viewed_at ? [{ date: budget.first_viewed_at, label: 'Primera vista', type: 'info' }] : []),
    ...payments.map(p => ({ date: p.paid_at || p.created_at, label: `Pago recibido: ${fmtEur(p.amount)}`, type: 'payment' })),
    ...venueInvoices.map(inv => ({ date: inv.created_at, label: `Factura ${inv.invoice_number} (${INV_STATUS[inv.status]?.label || inv.status})`, type: 'invoice' })),
    ...contracts.map(c => ({ date: c.created_at, label: `Contrato ${c.contract_number}`, type: 'contract' })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8' }}>
      <Sidebar />
      <div className="main-layout" style={{ padding: '28px 36px' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <button onClick={() => router.push('/budgets')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', fontSize: 12, fontWeight: 500 }}>
            <ArrowLeft size={14} /> Presupuestos
          </button>
          <span style={{ color: 'var(--ivory)' }}>&rsaquo;</span>
          <span style={{ fontSize: 12, color: 'var(--charcoal)', fontWeight: 600 }}>{budget.couple_name}</span>
        </div>

        {/* Header card */}
        <div className="card" style={{ padding: '24px 28px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <Receipt size={22} style={{ color: 'var(--gold)' }} />
                <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--espresso)', margin: 0 }}>{budget.couple_name}</h1>
                <span className={`badge ${S_BADGE[budget.status]}`} style={{ fontSize: 11 }}>{S_LABEL[budget.status]}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--warm-gray)', flexWrap: 'wrap' }}>
                {budget.wedding_date && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {fmtDate(budget.wedding_date + 'T12:00:00')}</span>}
                {budget.guest_count && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={12} /> {budget.guest_count} invitados</span>}
                {lead && (
                  <button onClick={() => router.push(`/leads?open=${lead.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', fontWeight: 600, fontSize: 12 }}>
                    <ExternalLink size={11} /> {lead.name}
                  </button>
                )}
                {budget.open_count > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Eye size={12} /> {budget.open_count} vistas</span>}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--espresso)', lineHeight: 1 }}>{fmtEur(budget.total_amount)}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button onClick={copyLink} className="btn btn-ghost btn-sm" title="Copiar enlace">
                  {copied ? <Check size={13} style={{ color: '#4A6B52' }} /> : <Copy size={13} />}
                  {copied ? 'Copiado' : 'Enlace'}
                </button>
                <a href={`/presupuesto/${budget.slug}`} target="_blank" rel="noopener" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
                  <Eye size={13} /> Vista pública
                </a>
                <button onClick={() => router.push(`/budgets/${id}/edit`)} className="btn btn-ghost btn-sm">
                  <Pencil size={13} /> Editar
                </button>
                {lead?.client_id && (
                  <button onClick={() => router.push(`/crm/${lead.client_id}`)} className="btn btn-primary btn-sm">
                    <UserCircle size={13} /> Contacto
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Payment progress */}
          {plan.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)' }}>Progreso de pagos</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: paidCount === plan.length ? '#4A6B52' : 'var(--espresso)' }}>
                  {fmtEur(totalPaid)} / {fmtEur(budget.total_amount)}
                </span>
              </div>
              <div style={{ height: 8, background: 'var(--ivory)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${budget.total_amount > 0 ? Math.min(100, (totalPaid / budget.total_amount) * 100) : 0}%`, background: paidCount === plan.length ? '#4A6B52' : 'var(--gold)', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--ivory)', marginBottom: 20 }}>
          {TABS.map(t => {
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 18px', border: 'none', borderBottom: `2px solid ${active ? 'var(--gold)' : 'transparent'}`,
                  background: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  color: active ? 'var(--espresso)' : 'var(--warm-gray)',
                  transition: 'all 0.15s',
                }}>
                {t.icon} {t.label}
                {(t.count ?? 0) > 0 && <span style={{ fontSize: 10, background: active ? 'var(--gold)' : 'var(--ivory)', color: active ? '#fff' : 'var(--warm-gray)', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>{t.count}</span>}
              </button>
            )
          })}
        </div>

        {/* ── Tab: Resumen ─────────────────────────────────────────── */}
        {tab === 'resumen' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
            <div className="card" style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Conceptos</div>
              {groups.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 12 }}>Sin conceptos</div>
              ) : groups.map((g: any, gi: number) => (
                <div key={gi} style={{ marginBottom: 16 }}>
                  {g.name && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--espresso)', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid var(--ivory)' }}>{g.name}</div>}
                  {(g.items || []).map((item: any, ii: number) => {
                    const qty = item.qty || item.quantity || 1
                    const total = Number(item.unit_price) * qty
                    return (
                      <div key={ii} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f5f5f0' }}>
                        <div>
                          <span style={{ fontSize: 13, color: 'var(--charcoal)' }}>{item.name || item.concept}</span>
                          {qty > 1 && <span style={{ fontSize: 11, color: 'var(--warm-gray)', marginLeft: 6 }}>x{qty}</span>}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)', whiteSpace: 'nowrap' }}>{fmtEur(total)}</span>
                      </div>
                    )
                  })}
                </div>
              ))}
              <div style={{ borderTop: '2px solid var(--ivory)', marginTop: 8, paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 4 }}>
                  <span>Subtotal</span><span>{fmtEur(subtotal)}</span>
                </div>
                {budget.discount_type && budget.discount_amount && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#B0473E', marginBottom: 4 }}>
                    <span>{budget.discount_label || 'Descuento'}</span>
                    <span>-{budget.discount_type === 'percent' ? `${budget.discount_amount}%` : fmtEur(budget.discount_amount)}</span>
                  </div>
                )}
                {budget.tax_rate && !budget.tax_included && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 4 }}>
                    <span>IVA ({budget.tax_rate}%)</span><span>{fmtEur((subtotal * budget.tax_rate) / 100)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: 'var(--espresso)', marginTop: 4 }}>
                  <span>Total</span><span>{fmtEur(budget.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Información</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <InfoRow label="Creado" value={fmtDate(budget.created_at)} />
                  {budget.sent_at && <InfoRow label="Enviado" value={fmtDate(budget.sent_at)} />}
                  {budget.first_viewed_at && <InfoRow label="1a vista" value={fmtDate(budget.first_viewed_at)} />}
                  {budget.valid_until && <InfoRow label="Válido hasta" value={fmtDate(budget.valid_until + 'T12:00:00')} />}
                  {budget.couple_email && <InfoRow label="Email" value={budget.couple_email} />}
                </div>
              </div>

              {/* Payment plan summary */}
              {plan.length > 0 && (
                <div className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Plan de pagos</div>
                  {plan.map((inst, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: idx < plan.length - 1 ? '1px solid #f5f5f0' : 'none' }}>
                      {inst.status === 'paid' ? <CheckCircle size={13} style={{ color: '#4A6B52', flexShrink: 0 }} /> : <Clock size={13} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />}
                      <div style={{ flex: 1, fontSize: 12, color: 'var(--charcoal)' }}>{inst.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: inst.status === 'paid' ? '#4A6B52' : 'var(--espresso)' }}>{fmtEur(inst.amount)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Timeline */}
              {timelineEvents.length > 0 && (
                <div className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Timeline</div>
                  {timelineEvents.map((ev, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: idx < timelineEvents.length - 1 ? '1px solid #f5f5f0' : 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0, background: ev.type === 'payment' ? '#4A6B52' : ev.type === 'invoice' ? 'var(--gold)' : ev.type === 'contract' ? '#47648A' : 'var(--warm-gray)' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: 'var(--charcoal)' }}>{ev.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{fmtDateShort(ev.date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {dossierData && (
                <div className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dosier vinculado</div>
                    <a href={`/proposals/${dossierData.proposal.id}/edit`} style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                      <ExternalLink size={10} /> Ver
                    </a>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--charcoal)' }}>{dossierData.proposal.couple_name}</div>
                  {dossierData.menuSelection?.selected_menu_name && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Menu: {dossierData.menuSelection.selected_menu_name}</div>}
                  {(dossierData.inquiries?.length || 0) > 0 && <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{dossierData.inquiries.length} respuesta{dossierData.inquiries.length !== 1 ? 's' : ''}</div>}
                </div>
              )}

              {budget.notes && (
                <div className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Notas</div>
                  <div style={{ fontSize: 12, color: 'var(--charcoal)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{budget.notes}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Pagos ───────────────────────────────────────────── */}
        {tab === 'pagos' && (
          <div>
            {/* Sub-tabs if planner */}
            {isPlanner && (
              <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--ivory)' }}>
                {(['recibido', 'a_pagar'] as PaySubTab[]).map(st => (
                  <button key={st} onClick={() => setPaySubTab(st)} style={{
                    padding: '8px 16px', border: 'none', borderBottom: `2px solid ${paySubTab === st ? 'var(--gold)' : 'transparent'}`,
                    background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: paySubTab === st ? 700 : 500,
                    color: paySubTab === st ? 'var(--espresso)' : 'var(--warm-gray)',
                  }}>
                    {st === 'recibido' ? 'Recibido' : 'A pagar'}
                  </button>
                ))}
              </div>
            )}

            {/* Recibido sub-tab (always shown for non-planners) */}
            {(!isPlanner || paySubTab === 'recibido') && (
              <>
                {plan.length === 0 ? (
                  <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
                    <CreditCard size={32} style={{ color: 'var(--gold)', margin: '0 auto 12px', opacity: 0.5 }} />
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>Sin plan de pagos</div>
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 16 }}>Define un plan de pagos en el editor.</div>
                    <button onClick={() => router.push(`/budgets/${id}/edit`)} className="btn btn-primary btn-sm">
                      <Pencil size={12} /> Editar presupuesto
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {plan.map((inst, idx) => {
                      const instPayments = payments.filter(p => p.installment_index === idx)
                      const instPaid = instPayments.reduce((s, p) => s + Number(p.amount), 0)
                      const remaining = Number(inst.amount) - instPaid
                      return (
                        <div key={idx} className="card" style={{ padding: '18px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: instPayments.length > 0 ? 10 : 0 }}>
                            {inst.status === 'paid' ? <CheckCircle size={18} style={{ color: '#4A6B52', flexShrink: 0 }} /> : <Clock size={18} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--espresso)' }}>{inst.label}</div>
                              <div style={{ fontSize: 11, color: 'var(--warm-gray)', display: 'flex', gap: 10, marginTop: 2 }}>
                                {inst.due_date && <span>Vence: {fmtDate(inst.due_date + 'T12:00:00')}</span>}
                                {inst.refundable && inst.refund_deadline && <span style={{ color: '#4A6B52' }}>Reembolsable hasta {fmtDateShort(inst.refund_deadline + 'T12:00:00')}</span>}
                                {inst.refundable === false && <span style={{ color: '#B0473E' }}>No reembolsable</span>}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 18, fontWeight: 800, color: inst.status === 'paid' ? '#4A6B52' : 'var(--espresso)' }}>{fmtEur(inst.amount)}</div>
                              {inst.status === 'paid' && <div style={{ fontSize: 10, color: '#4A6B52', fontWeight: 600 }}>Pagado</div>}
                              {inst.status !== 'paid' && instPaid > 0 && <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{fmtEur(instPaid)} pagado</div>}
                            </div>
                          </div>
                          {instPayments.length > 0 && (
                            <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 10 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Pagos realizados</div>
                              {instPayments.map(pay => (
                                <div key={pay.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 12, borderBottom: '1px solid #f5f5f0' }}>
                                  <CheckCircle size={11} style={{ color: '#4A6B52', flexShrink: 0 }} />
                                  <div style={{ flex: 1, color: 'var(--charcoal)' }}>{pay.payer_name || pay.payer_email || 'Pago'}</div>
                                  <div style={{ fontWeight: 600, color: '#4A6B52' }}>{fmtEur(pay.amount)}</div>
                                  {pay.paid_at && <div style={{ fontSize: 10, color: 'var(--warm-gray)', minWidth: 80, textAlign: 'right' }}>{fmtDateShort(pay.paid_at)}</div>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* A pagar sub-tab (planner commission) */}
            {isPlanner && paySubTab === 'a_pagar' && (() => {
              const commPercent = (budget as any)?.commission_percent || linkedClient?.wp_commission_percent || 0
              const totalPaidByClient = payments.reduce((s: number, p: any) => s + Number(p.amount), 0)
              const commissionTotal = Math.round(totalPaidByClient * (commPercent / 100) * 100) / 100
              const commissionOnBudget = Math.round(Number(budget.total_amount) * (commPercent / 100) * 100) / 100
              return (
                <div>
                  {/* Commission summary */}
                  <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Comisión del organizador</div>
                        <div style={{ fontSize: 13, color: 'var(--charcoal)' }}>
                          {commPercent > 0 ? `${commPercent}% sobre el total del presupuesto` : 'Sin comisión configurada'}
                        </div>
                      </div>
                      {commPercent > 0 && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--espresso)' }}>{fmtEur(commissionOnBudget)}</div>
                          <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>total comisión</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Commission per payment */}
                  {commPercent > 0 && payments.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {payments.map((pay: any) => {
                        const payComm = Math.round(Number(pay.amount) * (commPercent / 100) * 100) / 100
                        return (
                          <div key={pay.id} className="card" style={{ padding: '16px 24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <CreditCard size={16} style={{ color: '#B0473E', flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>
                                  Comisión sobre {pay.payer_name || 'pago'}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>
                                  {commPercent}% de {fmtEur(pay.amount)} · {pay.paid_at ? fmtDateShort(pay.paid_at) : ''}
                                </div>
                              </div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: '#B0473E' }}>{fmtEur(payComm)}</div>
                            </div>
                          </div>
                        )
                      })}
                      <div style={{ padding: '12px 24px', background: 'var(--surface)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warm-gray)' }}>Total a pagar</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: '#B0473E' }}>{fmtEur(commissionTotal)}</span>
                      </div>
                    </div>
                  ) : commPercent > 0 ? (
                    <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Aún no se han recibido pagos. Las comisiones se calcularán cuando se reciban.</div>
                    </div>
                  ) : (
                    <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 8 }}>Configura el porcentaje de comisión en el editor del presupuesto.</div>
                      <button onClick={() => router.push(`/budgets/${id}/edit`)} className="btn btn-ghost btn-sm">
                        <Pencil size={12} /> Editar presupuesto
                      </button>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* ── Tab: Facturas ────────────────────────────────────────── */}
        {tab === 'facturas' && (
          <div>
            {/* Existing invoices */}
            {venueInvoices.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Facturas emitidas</div>
                  <button onClick={() => router.push('/facturas/nueva')} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
                    <Plus size={11} /> Nueva
                  </button>
                </div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Factura</th>
                        <th>Fecha</th>
                        <th>Total</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {venueInvoices.map(inv => {
                        const st = INV_STATUS[inv.status] || { label: inv.status, badge: 'badge-inactive' }
                        return (
                          <tr key={inv.id}>
                            <td><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{inv.invoice_number}</span></td>
                            <td style={{ fontSize: 12, color: 'var(--warm-gray)' }}>{fmtDateShort(inv.issue_date)}</td>
                            <td style={{ fontWeight: 600 }}>{fmtEur(inv.total)}</td>
                            <td><span className={`badge ${st.badge}`}>{st.label}</span></td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/facturas/${inv.id}`)} title="Ver"><Eye size={12} /></button>
                                {inv.status === 'draft' && <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/facturas/${inv.id}`)} title="Editar"><Pencil size={12} /></button>}
                                {inv.status === 'draft' && (
                                  <button className="btn btn-ghost btn-sm" title="Aprobar" onClick={async () => {
                                    const supabase = createClient()
                                    await supabase.from('venue_invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', inv.id)
                                    const { data } = await supabase.from('venue_invoices').select('*').eq('budget_id', id).order('created_at', { ascending: false })
                                    setVenueInvoices(data || [])
                                  }}>
                                    <CheckCircle size={12} style={{ color: '#4A6B52' }} />
                                  </button>
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
            )}

            {/* Auto-generate from payments */}
            <div className="card" style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                Pagos recibidos {payments.length > 0 && `(${payments.length})`}
              </div>

              {payments.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 12 }}>
                  <Inbox size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                  Sin pagos recibidos
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {payments.map(pay => {
                    // Check if already has an invoice
                    const hasInvoice = venueInvoices.some(inv =>
                      inv.line_items?.some?.((li: any) => Math.abs(Number(li.subtotal) - Number(pay.amount)) < 0.01)
                    )
                    return (
                      <div key={pay.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: '#EEF2EC', border: '1px solid #C3D4C5' }}>
                        <CheckCircle size={14} style={{ color: '#4A6B52', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)' }}>{pay.payer_name || pay.payer_email || 'Pago'}</div>
                          {pay.paid_at && <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{fmtDate(pay.paid_at)}</div>}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#4A6B52', marginRight: 12 }}>{fmtEur(pay.amount)}</div>
                        {hasInvoice ? (
                          <span style={{ fontSize: 10, color: 'var(--warm-gray)', fontWeight: 600 }}>Factura creada</span>
                        ) : (
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => generateInvoice(pay)}>
                            <FileText size={11} /> Generar factura
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => router.push('/facturas/nueva')} className="btn btn-primary btn-sm">
                  <Plus size={12} /> Crear factura
                </button>
                <button onClick={() => router.push('/facturas')} className="btn btn-ghost btn-sm">
                  <FileText size={12} /> Ver todas
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Contrato ────────────────────────────────────────── */}
        {tab === 'contrato' && (
          <div>
            {contracts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {contracts.map(c => {
                  const statusBadgeMap: Record<string, string> = { draft: 'badge-inactive', sent: 'badge-pending', signed: 'badge-active', active: 'badge-active', completed: 'badge-contacted', cancelled: 'badge-inactive' }
                  const statusLabelMap: Record<string, string> = { draft: 'Borrador', sent: 'Enviado', signed: 'Firmado', active: 'Activo', completed: 'Completado', cancelled: 'Cancelado' }
                  const cst = statusBadgeMap[c.status] || 'badge-inactive'
                  const cLabel = statusLabelMap[c.status] || c.status
                  return (
                    <div key={c.id} className="card" style={{ padding: '20px 24px', cursor: 'pointer' }} onClick={() => router.push(`/contratos/${c.id}`)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ScrollText size={20} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--espresso)' }}>{c.title || 'Contrato de servicios'}</div>
                          <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>
                            <span style={{ fontFamily: 'monospace' }}>{c.contract_number}</span>
                            {c.wedding_date && <span> · Boda: {fmtDateShort(c.wedding_date)}</span>}
                          </div>
                        </div>
                        <span className={`badge ${cst}`}>{cLabel}</span>
                        {Number(c.total_amount) > 0 && (
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--espresso)' }}>{fmtEur(c.total_amount)}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <button onClick={() => router.push('/contratos/nuevo')} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
                  <Plus size={12} /> Crear otro contrato
                </button>
              </div>
            ) : (
              <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
                <ScrollText size={32} style={{ color: 'var(--gold)', margin: '0 auto 12px', opacity: 0.5 }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>Sin contrato</div>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 16 }}>Crea un contrato para formalizar los servicios con esta pareja.</div>
                <button onClick={() => router.push('/contratos/nuevo')} className="btn btn-primary btn-sm">
                  <Plus size={12} /> Crear contrato
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: 'var(--warm-gray)' }}>{label}</span>
      <span style={{ color: 'var(--charcoal)', fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import DatePicker from '@/components/DatePicker'
import { ArrowLeft, Plus, Trash2, Save, Send, Eye, ChevronDown, ChevronUp, Search } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceLineItem = {
  id: string
  concept: string
  qty: number
  unit_price: number
  subtotal: number
}

type Template = 'classic' | 'modern' | 'minimal'

type LeadOption = {
  id: string
  couple_name: string
  email: string | null
  billing_name: string | null
  billing_nif: string | null
  billing_address: string | null
  budget_id?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10) }

function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function fmtDateLong(iso: string) {
  if (!iso) return ''
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NuevaFacturaPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading, activeVenue } = useAuth()
  const { isBlocked } = useRequireSubscription()

  // Template
  const [template, setTemplate] = useState<Template>('classic')

  // Client fields
  const [clientFullName, setClientFullName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientNif, setClientNif] = useState('')
  const [clientAddress, setClientAddress] = useState('')

  // Lead search
  const [leadSearch, setLeadSearch] = useState('')
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [showLeadDropdown, setShowLeadDropdown] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null)

  // Dates
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [weddingDate, setWeddingDate] = useState('')

  // Line items
  const [taxRate, setTaxRate] = useState(21)
  const [notes, setNotes] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('Pago gestionado a través de Stripe')
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { id: uid(), concept: '', qty: 1, unit_price: 0, subtotal: 0 }
  ])

  // Venue billing (collapsed)
  const [showBilling, setShowBilling] = useState(false)
  const [venueName, setVenueName] = useState('')
  const [venueNif, setVenueNif] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [venueEmail, setVenueEmail] = useState('')
  const [venuePhone, setVenuePhone] = useState('')
  const [venueId, setVenueId] = useState('')
  const [venueLogo, setVenueLogo] = useState('')

  const [invoiceCount, setInvoiceCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadData()
  }, [user, authLoading])

  const loadData = async () => {
    const supabase = createClient()

    // Venue profile with billing fields
    const { data: vp } = await supabase
      .from('venue_profiles')
      .select('venue_id:wp_venue_id, company, full_address, address, city, phone, billing_nif, billing_email, billing_phone, billing_address, brand_logo_url')
      .eq('user_id', user!.id)
      .limit(1)
      .single()

    if (vp) {
      setVenueId(String(vp.venue_id || ''))
      setVenueName(vp.company || '')
      setVenueNif(vp.billing_nif || '')
      setVenueAddress(vp.billing_address || vp.full_address || [vp.address, vp.city].filter(Boolean).join(', ') || '')
      setVenueEmail(vp.billing_email || user!.email || '')
      setVenuePhone(vp.billing_phone || vp.phone || '')
      setVenueLogo(vp.brand_logo_url || '')
    }

    // Load leads for search
    const { data: leadsData } = await supabase
      .from('leads')
      .select('id, name, email, billing_name, billing_nif, billing_address')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(200)

    // Also get budgets to link
    const { data: budgetsData } = await supabase
      .from('budgets')
      .select('id, couple_name, couple_email, lead_id')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(100)

    const budgetByLead = new Map<string, string>()
    budgetsData?.forEach(b => { if (b.lead_id) budgetByLead.set(b.lead_id, b.id) })

    const leadOptions: LeadOption[] = (leadsData || []).map(l => ({
      id: l.id,
      couple_name: l.name,
      email: l.email,
      billing_name: l.billing_name,
      billing_nif: l.billing_nif,
      billing_address: l.billing_address,
      budget_id: budgetByLead.get(l.id),
    }))
    setLeads(leadOptions)

    // Invoice count for numbering
    const { count } = await supabase
      .from('venue_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user!.id)

    setInvoiceCount(count ?? 0)
    setLoading(false)
  }

  // Invoice number
  const invoiceNumber = useMemo(() => {
    const year = new Date().getFullYear()
    const num = (invoiceCount + 1).toString().padStart(4, '0')
    return `FAC-${year}-${num}`
  }, [invoiceCount])

  // Calculations
  const subtotal = lineItems.reduce((s, i) => s + i.subtotal, 0)
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100
  const total = Math.round((subtotal + taxAmount) * 100) / 100

  // Line item handlers
  const updateItem = (id: string, field: keyof InvoiceLineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      if (field === 'qty' || field === 'unit_price') {
        updated.subtotal = Math.round(updated.qty * updated.unit_price * 100) / 100
      }
      return updated
    }))
  }

  const addItem = () => setLineItems(prev => [...prev, { id: uid(), concept: '', qty: 1, unit_price: 0, subtotal: 0 }])
  const removeItem = (id: string) => { if (lineItems.length > 1) setLineItems(prev => prev.filter(i => i.id !== id)) }

  // Lead selection
  const selectLead = (l: LeadOption) => {
    setLeadSearch(l.couple_name)
    setClientFullName(l.billing_name || l.couple_name)
    setClientEmail(l.email || '')
    setClientNif(l.billing_nif || '')
    setClientAddress(l.billing_address || '')
    setSelectedLeadId(l.id)
    setSelectedBudgetId(l.budget_id || null)
    setShowLeadDropdown(false)
  }

  const filteredLeads = leadSearch.length > 0
    ? leads.filter(l => l.couple_name.toLowerCase().includes(leadSearch.toLowerCase()))
    : leads.slice(0, 8)

  // Import from budget
  const importFromBudget = async (bId: string) => {
    const supabase = createClient()
    const { data } = await supabase.from('budgets').select('*').eq('id', bId).single()
    if (!data) return
    setWeddingDate(data.wedding_date || '')
    const budgetItems: InvoiceLineItem[] = []
    const li = data.line_items as any
    if (li?.groups) {
      li.groups.forEach((g: any) => {
        g.items?.forEach((item: any) => {
          budgetItems.push({
            id: uid(),
            concept: `${g.name}: ${item.concept}`,
            qty: item.qty || 1,
            unit_price: item.unit_price || 0,
            subtotal: item.subtotal || 0,
          })
        })
      })
    }
    if (budgetItems.length > 0) setLineItems(budgetItems)
    if (data.tax_rate) setTaxRate(data.tax_rate)
  }

  // Save
  const handleSave = async (sendAfter = false) => {
    if (!clientFullName.trim()) return alert('Introduce el nombre del cliente')
    if (lineItems.every(i => !i.concept.trim())) return alert('Añade al menos un concepto')

    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase.from('venue_invoices').insert({
      user_id: user!.id,
      venue_id: venueId,
      invoice_number: invoiceNumber,
      client_name: clientFullName,
      client_email: clientEmail || null,
      client_nif: clientNif || null,
      client_address: clientAddress || null,
      budget_id: selectedBudgetId,
      lead_id: selectedLeadId,
      venue_name: venueName,
      venue_nif: venueNif || null,
      venue_address: venueAddress || null,
      venue_email: venueEmail || null,
      venue_phone: venuePhone || null,
      venue_logo_url: venueLogo || null,
      issue_date: issueDate,
      due_date: dueDate || null,
      wedding_date: weddingDate || null,
      line_items: lineItems.filter(i => i.concept.trim()),
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      template,
      status: sendAfter ? 'sent' : 'draft',
      sent_at: sendAfter ? new Date().toISOString() : null,
      notes: notes || null,
      payment_terms: paymentTerms || null,
    })

    // Also save billing data back to venue_profiles
    await supabase.from('venue_profiles').update({
      billing_nif: venueNif || null,
      billing_email: venueEmail || null,
      billing_phone: venuePhone || null,
      billing_address: venueAddress || null,
    }).eq('user_id', user!.id)

    // Save billing data to lead if selected
    if (selectedLeadId && (clientNif || clientAddress)) {
      await supabase.from('leads').update({
        billing_name: clientFullName || null,
        billing_nif: clientNif || null,
        billing_address: clientAddress || null,
      }).eq('id', selectedLeadId)
    }

    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/facturas')
  }

  if (isBlocked) return null
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold)' }}>Cargando...</div>
    </div>
  )

  // ── Preview items
  const previewItems = lineItems.filter(i => i.concept.trim())

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">

        {/* Topbar */}
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/facturas')}>
              <ArrowLeft size={14} />
            </button>
            <div className="topbar-title">Nueva factura</div>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--warm-gray)', background: 'var(--surface)', padding: '2px 8px', borderRadius: 4 }}>
              {invoiceNumber}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => handleSave(false)} disabled={saving}>
              <Save size={13} /> Guardar borrador
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => handleSave(true)} disabled={saving}>
              <Send size={13} /> Guardar y enviar
            </button>
          </div>
        </div>

        {/* Main: form + preview */}
        <div style={{ display: 'flex', gap: 24, padding: 24, minHeight: 'calc(100vh - 56px)', alignItems: 'flex-start' }}>

          {/* ═══ LEFT: Form ═══ */}
          <div style={{ flex: '0 0 480px', maxWidth: 480 }}>

            {/* Template selector */}
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Plantilla</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {([
                  { key: 'classic' as Template, label: 'Clásica', desc: 'Con cabecera y línea separadora' },
                  { key: 'modern' as Template, label: 'Moderna', desc: 'Cabecera con fondo de color' },
                  { key: 'minimal' as Template, label: 'Minimal', desc: 'Solo texto, sin decoración' },
                ]).map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTemplate(t.key)}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 8,
                      border: template === t.key ? '2px solid var(--gold)' : '2px solid var(--border)',
                      background: template === t.key ? 'var(--cream)' : 'white', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {/* Mini preview bars */}
                    <div style={{ marginBottom: 6, height: 24, borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      {t.key === 'classic' && <>
                        <div style={{ height: 3, background: 'var(--gold)' }} />
                        <div style={{ padding: '2px 4px' }}><div style={{ height: 2, width: '60%', background: '#ddd', borderRadius: 1 }} /></div>
                      </>}
                      {t.key === 'modern' && <>
                        <div style={{ height: 10, background: '#1a1a2e' }} />
                        <div style={{ padding: '2px 4px' }}><div style={{ height: 2, width: '50%', background: '#ddd', borderRadius: 1 }} /></div>
                      </>}
                      {t.key === 'minimal' && <>
                        <div style={{ padding: '4px' }}><div style={{ height: 2, width: '40%', background: '#333', borderRadius: 1, marginBottom: 2 }} /><div style={{ height: 1, width: '70%', background: '#ddd', borderRadius: 1 }} /></div>
                      </>}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Venue billing — collapsed */}
            <div className="card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
              <button
                onClick={() => setShowBilling(!showBilling)}
                style={{
                  width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Datos del emisor {venueName && `· ${venueName}`}
                </span>
                {showBilling ? <ChevronUp size={14} color="var(--warm-gray)" /> : <ChevronDown size={14} color="var(--warm-gray)" />}
              </button>
              {showBilling && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 8, marginBottom: 10 }}>Estos datos se guardarán en tu perfil para futuras facturas</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="form-label">Nombre / Razón social</label>
                      <input className="form-input" value={venueName} onChange={e => setVenueName(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">NIF / CIF</label>
                      <input className="form-input" value={venueNif} onChange={e => setVenueNif(e.target.value)} placeholder="B12345678" />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Dirección fiscal</label>
                      <input className="form-input" value={venueAddress} onChange={e => setVenueAddress(e.target.value)} placeholder="Calle, Ciudad, CP" />
                    </div>
                    <div>
                      <label className="form-label">Email</label>
                      <input className="form-input" value={venueEmail} onChange={e => setVenueEmail(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Teléfono</label>
                      <input className="form-input" value={venuePhone} onChange={e => setVenuePhone(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Client info */}
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Datos del cliente</div>

              {/* Lead search */}
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <label className="form-label">Buscar pareja / lead</label>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                  <input
                    className="form-input"
                    value={leadSearch}
                    onChange={e => { setLeadSearch(e.target.value); setShowLeadDropdown(true) }}
                    onFocus={() => setShowLeadDropdown(true)}
                    onBlur={() => setTimeout(() => setShowLeadDropdown(false), 200)}
                    placeholder="Buscar por nombre de pareja..."
                    style={{ paddingLeft: 32 }}
                  />
                </div>
                {showLeadDropdown && filteredLeads.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: 'white', border: '1px solid var(--border)', borderRadius: 8,
                    maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}>
                    {filteredLeads.map(l => (
                      <div
                        key={l.id}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                        onMouseDown={() => selectLead(l)}
                      >
                        <div style={{ fontWeight: 500 }}>{l.couple_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                          {l.email || 'Sin email'}{l.budget_id && ' · Presupuesto vinculado'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Client detail fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Nombre completo *</label>
                  <input className="form-input" value={clientFullName} onChange={e => setClientFullName(e.target.value)} placeholder="Nombre y apellidos" />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Email</label>
                  <input className="form-input" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="email@ejemplo.com" />
                </div>
                <div>
                  <label className="form-label">DNI / NIF</label>
                  <input className="form-input" value={clientNif} onChange={e => setClientNif(e.target.value)} placeholder="12345678A" />
                </div>
                <div>
                  <label className="form-label">Dirección</label>
                  <input className="form-input" value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="Dirección de facturación" />
                </div>
              </div>

              {selectedBudgetId && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--surface)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Presupuesto vinculado</span>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => importFromBudget(selectedBudgetId)}>
                    Importar conceptos
                  </button>
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Fechas</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <DatePicker value={issueDate} onChange={setIssueDate} label="Fecha emisión" accent="var(--gold)" allowPast />
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 8px' }}
                      onClick={() => setIssueDate(new Date().toISOString().slice(0, 10))}>Hoy</button>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 8px' }}
                      onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); setIssueDate(d.toISOString().slice(0, 10)) }}>Mañana</button>
                  </div>
                </div>
                <div>
                  <DatePicker value={dueDate} onChange={v => { if (v && v < issueDate) return; setDueDate(v) }} label="Vencimiento" accent="var(--gold)" allowPast minDate={issueDate} placeholder="Sin vencimiento" />
                  {dueDate && dueDate < issueDate && <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>Debe ser igual o posterior a emisión</div>}
                </div>
                <div>
                  <DatePicker value={weddingDate} onChange={setWeddingDate} label="Fecha boda" accent="var(--gold)" allowPast placeholder="Opcional" />
                </div>
              </div>
            </div>

            {/* Line items */}
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Conceptos</div>

              {lineItems.map((item, idx) => (
                <div key={item.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    {idx === 0 && <label className="form-label" style={{ fontSize: 10 }}>Concepto</label>}
                    <input className="form-input" value={item.concept} onChange={e => updateItem(item.id, 'concept', e.target.value)} placeholder="Descripción del servicio..." />
                  </div>
                  <div style={{ width: 55 }}>
                    {idx === 0 && <label className="form-label" style={{ fontSize: 10 }}>Uds.</label>}
                    <input className="form-input" type="number" min={1} value={item.qty} onChange={e => updateItem(item.id, 'qty', Number(e.target.value))} style={{ textAlign: 'center' }} />
                  </div>
                  <div style={{ width: 90 }}>
                    {idx === 0 && <label className="form-label" style={{ fontSize: 10 }}>Precio</label>}
                    <input className="form-input" type="number" min={0} step={0.01} value={item.unit_price || ''} onChange={e => updateItem(item.id, 'unit_price', Number(e.target.value))} placeholder="0.00" />
                  </div>
                  <div style={{ width: 80, textAlign: 'right' }}>
                    {idx === 0 && <label className="form-label" style={{ fontSize: 10 }}>Subtotal</label>}
                    <div style={{ padding: '8px 0', fontSize: 13, fontWeight: 500 }}>{fmtEur(item.subtotal)}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeItem(item.id)} style={{ opacity: lineItems.length <= 1 ? 0.3 : 1, marginBottom: 2 }} disabled={lineItems.length <= 1}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}

              <button className="btn btn-ghost btn-sm" onClick={addItem} style={{ marginTop: 4 }}>
                <Plus size={12} /> Añadir concepto
              </button>

              {/* Totals */}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: 'var(--warm-gray)' }}>Subtotal</span>
                  <span>{fmtEur(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--warm-gray)' }}>IVA</span>
                    <input className="form-input" type="number" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} style={{ width: 50, padding: '2px 6px', fontSize: 12, textAlign: 'center' }} />
                    <span style={{ color: 'var(--warm-gray)', fontSize: 11 }}>%</span>
                  </div>
                  <span>{fmtEur(taxAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, paddingTop: 8, borderTop: '2px solid var(--espresso)' }}>
                  <span>TOTAL</span>
                  <span>{fmtEur(total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notas y condiciones</div>
              <div style={{ marginBottom: 10 }}>
                <label className="form-label">Condiciones de pago</label>
                <input className="form-input" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Notas adicionales</label>
                <textarea className="form-input" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notas para el cliente..." style={{ resize: 'vertical' }} />
              </div>
            </div>
          </div>

          {/* ═══ RIGHT: Live Preview ═══ */}
          <div style={{ flex: 1, minWidth: 0, position: 'sticky', top: 80 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Eye size={12} /> Vista previa
            </div>
            <div style={{
              background: 'white', borderRadius: 8, boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
              border: '1px solid var(--border)', minHeight: 600, overflow: 'hidden',
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
            }}>

              {/* ─── CLASSIC TEMPLATE ─── */}
              {template === 'classic' && (
                <div style={{ padding: 32 }}>
                  <div style={{ borderBottom: '2px solid var(--gold)', paddingBottom: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>FACTURA</div>
                      <div style={{ fontSize: 12, color: '#888', fontFamily: 'monospace', marginTop: 2 }}>{invoiceNumber}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12, color: '#444' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{venueName || 'Tu Venue'}</div>
                      {venueNif && <div style={{ color: '#888' }}>{venueNif}</div>}
                      {venueAddress && <div style={{ color: '#888' }}>{venueAddress}</div>}
                      {venueEmail && <div style={{ color: '#888' }}>{venueEmail}</div>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                    <div>
                      <div style={{ fontSize: 9, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>Facturar a</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{clientFullName || '—'}</div>
                      {clientNif && <div style={{ fontSize: 11, color: '#888' }}>{clientNif}</div>}
                      {clientAddress && <div style={{ fontSize: 11, color: '#888' }}>{clientAddress}</div>}
                      {clientEmail && <div style={{ fontSize: 11, color: '#888' }}>{clientEmail}</div>}
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 11, color: '#888' }}>
                      {issueDate && <div>Fecha: {fmtDateLong(issueDate)}</div>}
                      {dueDate && <div>Vencimiento: {fmtDateLong(dueDate)}</div>}
                      {weddingDate && <div style={{ color: 'var(--gold)', fontWeight: 500, marginTop: 3 }}>Boda: {fmtDateLong(weddingDate)}</div>}
                    </div>
                  </div>

                  {renderItemsTable('#8B6914')}
                  {renderTotals('#8B6914')}
                  {renderFooter()}
                </div>
              )}

              {/* ─── MODERN TEMPLATE ─── */}
              {template === 'modern' && (
                <div>
                  {/* Dark header block */}
                  <div style={{ background: '#1a1a2e', color: 'white', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, opacity: 0.6, marginBottom: 4 }}>Factura</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{invoiceNumber}</div>
                      {issueDate && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{fmtDateLong(issueDate)}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{venueName || 'Tu Venue'}</div>
                      {venueNif && <div style={{ fontSize: 11, opacity: 0.6 }}>{venueNif}</div>}
                      {venueEmail && <div style={{ fontSize: 11, opacity: 0.6 }}>{venueEmail}</div>}
                    </div>
                  </div>

                  <div style={{ padding: '24px 32px' }}>
                    {/* Client + dates */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                      <div>
                        <div style={{ fontSize: 9, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>Facturar a</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{clientFullName || 'Nombre del cliente'}</div>
                        {clientNif && <div style={{ fontSize: 11, color: '#888' }}>{clientNif}</div>}
                        {clientAddress && <div style={{ fontSize: 11, color: '#888' }}>{clientAddress}</div>}
                        {clientEmail && <div style={{ fontSize: 11, color: '#888' }}>{clientEmail}</div>}
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 11 }}>
                        {dueDate && <div style={{ color: '#888' }}>Vencimiento: <span style={{ color: '#333', fontWeight: 500 }}>{fmtDateLong(dueDate)}</span></div>}
                        {weddingDate && <div style={{ color: '#1a1a2e', fontWeight: 500, marginTop: 4 }}>Boda: {fmtDateLong(weddingDate)}</div>}
                      </div>
                    </div>

                    {renderItemsTable('#1a1a2e')}
                    {renderTotals('#1a1a2e')}
                    {renderFooter()}
                  </div>
                </div>
              )}

              {/* ─── MINIMAL TEMPLATE ─── */}
              {template === 'minimal' && (
                <div style={{ padding: '40px 32px' }}>
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>{venueName}</div>
                    <div style={{ fontSize: 24, fontWeight: 300, color: '#111', letterSpacing: -0.5 }}>Factura {invoiceNumber}</div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32, paddingBottom: 20, borderBottom: '1px solid #eee' }}>
                    <div style={{ fontSize: 12 }}>
                      <div style={{ color: '#aaa', marginBottom: 4, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Para</div>
                      <div style={{ fontWeight: 500 }}>{clientFullName || '—'}</div>
                      {clientNif && <div style={{ color: '#888' }}>{clientNif}</div>}
                      {clientEmail && <div style={{ color: '#888' }}>{clientEmail}</div>}
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 11, color: '#888' }}>
                      {issueDate && <div>{fmtDateLong(issueDate)}</div>}
                      {dueDate && <div>Vto: {fmtDateLong(dueDate)}</div>}
                    </div>
                  </div>

                  {/* Minimal uses simple rows instead of table */}
                  <div style={{ marginBottom: 24 }}>
                    {previewItems.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                        <div>
                          <div>{item.concept}</div>
                          {item.qty > 1 && <div style={{ fontSize: 11, color: '#aaa' }}>{item.qty} x {fmtEur(item.unit_price)}</div>}
                        </div>
                        <div style={{ fontWeight: 500 }}>{fmtEur(item.subtotal)}</div>
                      </div>
                    ))}
                    {previewItems.length === 0 && <div style={{ padding: '20px 0', color: '#ccc', fontStyle: 'italic', textAlign: 'center' }}>Añade conceptos</div>}
                  </div>

                  <div style={{ textAlign: 'right', marginBottom: 32 }}>
                    <div style={{ fontSize: 12, color: '#888' }}>Subtotal: {fmtEur(subtotal)}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>IVA ({taxRate}%): {fmtEur(taxAmount)}</div>
                    <div style={{ fontSize: 22, fontWeight: 300, marginTop: 8, color: '#111' }}>{fmtEur(total)}</div>
                  </div>

                  {renderFooter()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Shared render helpers (used by classic + modern) ──

  function renderItemsTable(accent: string) {
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 20 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${accent}30` }}>
            <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa' }}>Concepto</th>
            <th style={{ textAlign: 'center', padding: '6px 0', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', width: 40 }}>Uds</th>
            <th style={{ textAlign: 'right', padding: '6px 0', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', width: 70 }}>Precio</th>
            <th style={{ textAlign: 'right', padding: '6px 0', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', width: 80 }}>Importe</th>
          </tr>
        </thead>
        <tbody>
          {previewItems.map(item => (
            <tr key={item.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px 0' }}>{item.concept}</td>
              <td style={{ padding: '8px 0', textAlign: 'center' }}>{item.qty}</td>
              <td style={{ padding: '8px 0', textAlign: 'right' }}>{fmtEur(item.unit_price)}</td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500 }}>{fmtEur(item.subtotal)}</td>
            </tr>
          ))}
          {previewItems.length === 0 && (
            <tr><td colSpan={4} style={{ padding: '16px 0', textAlign: 'center', color: '#ccc', fontStyle: 'italic' }}>Añade conceptos</td></tr>
          )}
        </tbody>
      </table>
    )
  }

  function renderTotals(accent: string) {
    return (
      <div style={{ marginLeft: 'auto', width: 200 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', color: '#888' }}>
          <span>Subtotal</span><span>{fmtEur(subtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', color: '#888' }}>
          <span>IVA ({taxRate}%)</span><span>{fmtEur(taxAmount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, padding: '8px 0 0', borderTop: `2px solid ${accent}`, marginTop: 4, color: accent }}>
          <span>TOTAL</span><span>{fmtEur(total)}</span>
        </div>
      </div>
    )
  }

  function renderFooter() {
    return (
      <>
        {(paymentTerms || notes) && (
          <div style={{ marginTop: 24, paddingTop: 12, borderTop: '1px solid #eee', fontSize: 10, color: '#aaa' }}>
            {paymentTerms && <div><strong>Condiciones:</strong> {paymentTerms}</div>}
            {notes && <div style={{ marginTop: 2 }}><strong>Notas:</strong> {notes}</div>}
          </div>
        )}
      </>
    )
  }
}

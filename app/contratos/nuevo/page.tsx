'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import DatePicker from '@/components/DatePicker'
import { ArrowLeft, Save, Search, Plus, Trash2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Template = 'standard' | 'simple' | 'custom'

type Section = { title: string; content: string }

type LeadOption = {
  id: string
  couple_name: string
  email: string | null
  wedding_date: string | null
  budget_id?: string
  total_amount?: number
}

// ─── Default sections per template ────────────────────────────────────────────

const TEMPLATE_SECTIONS: Record<Template, Section[]> = {
  standard: [
    { title: 'Partes', content: 'De una parte, [VENUE_NAME] (en adelante, "El Prestador"), y de otra parte, [CLIENT_NAME] (en adelante, "El Cliente").' },
    { title: 'Objeto del contrato', content: 'El presente contrato tiene por objeto la prestación de servicios para la celebración de una boda en las instalaciones del Prestador, incluyendo los servicios detallados en el presupuesto adjunto.' },
    { title: 'Fecha y lugar del evento', content: 'La celebración tendrá lugar el [WEDDING_DATE] en [VENUE_NAME]. El horario del evento será desde la hora de inicio acordada hasta la finalización.' },
    { title: 'Servicios incluidos', content: 'Los servicios incluidos son los especificados en el presupuesto vinculado a este contrato. Cualquier servicio adicional deberá ser acordado por escrito.' },
    { title: 'Condiciones económicas', content: 'El precio total de los servicios es de [TOTAL_AMOUNT]. El pago se realizará según el plan de pagos acordado:\n\n- Señal de reserva: [DEPOSIT_AMOUNT] (a la firma del contrato)\n- Resto: según calendario de pagos del presupuesto' },
    { title: 'Política de cancelación', content: 'En caso de cancelación:\n- Más de 6 meses de antelación: devolución del 50% de la señal\n- Entre 3 y 6 meses: retención del 100% de la señal\n- Menos de 3 meses: retención del 50% del importe total' },
    { title: 'Responsabilidades', content: 'El Prestador se compromete a mantener las instalaciones en perfecto estado y prestar los servicios con la máxima calidad. El Cliente se compromete a respetar las normas de uso y cumplir con los pagos.' },
    { title: 'Protección de datos', content: 'Ambas partes se comprometen a cumplir con la normativa vigente en materia de protección de datos (RGPD).' },
  ],
  simple: [
    { title: 'Partes', content: 'Entre [VENUE_NAME] y [CLIENT_NAME].' },
    { title: 'Servicios', content: 'Celebración de boda el [WEDDING_DATE] con los servicios detallados en el presupuesto adjunto.' },
    { title: 'Precio y pago', content: 'Importe total: [TOTAL_AMOUNT]. Señal: [DEPOSIT_AMOUNT]. Resto según calendario de pagos.' },
    { title: 'Cancelación', content: 'Cancelación con más de 3 meses: retención de la señal. Menos de 3 meses: 50% del total.' },
  ],
  custom: [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n))
}

function fmtDateLong(iso: string) {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NuevoContratoPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { isBlocked } = useRequireSubscription()

  // Template
  const [template, setTemplate] = useState<Template>('standard')

  // Client
  const [leadSearch, setLeadSearch] = useState('')
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [showLeadDropdown, setShowLeadDropdown] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientNif, setClientNif] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientCountry, setClientCountry] = useState('España')
  const [clientZip, setClientZip] = useState('')

  // Event
  const [weddingDate, setWeddingDate] = useState('')
  const [totalAmount, setTotalAmount] = useState(0)
  const [depositAmount, setDepositAmount] = useState(0)

  // Venue info
  const [venueName, setVenueName] = useState('')
  const [venueId, setVenueId] = useState('')

  // Sections
  const [sections, setSections] = useState<Section[]>(TEMPLATE_SECTIONS.standard)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // URL params for auto-fill from budget editor
  const urlBudgetId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('budget_id') : null
  const urlLeadId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lead_id') : null

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadData()
  }, [user, authLoading])

  const loadData = async () => {
    const supabase = createClient()

    const [vpRes, leadsRes, budgetsRes] = await Promise.all([
      supabase.from('venue_profiles').select('wp_venue_id, company').eq('user_id', user!.id).limit(1).single(),
      supabase.from('leads').select('id, name, email, wedding_date, billing_nif, billing_address').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('budgets').select('id, couple_name, couple_email, lead_id, wedding_date, total_amount, payment_plan').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(100),
    ])

    if (vpRes.data) {
      setVenueId(String(vpRes.data.wp_venue_id || ''))
      setVenueName(vpRes.data.company || '')
    }

    const budgetByLead = new Map<string, { id: string; total: number }>()
    budgetsRes.data?.forEach(b => { if (b.lead_id) budgetByLead.set(b.lead_id, { id: b.id, total: b.total_amount }) })

    const opts: LeadOption[] = (leadsRes.data || []).map(l => ({
      id: l.id,
      couple_name: l.name,
      email: l.email,
      wedding_date: l.wedding_date,
      budget_id: budgetByLead.get(l.id)?.id,
      total_amount: budgetByLead.get(l.id)?.total,
    }))
    setLeads(opts)

    // Auto-fill from URL params (coming from budget editor)
    if (urlLeadId) {
      const lead = (leadsRes.data || []).find((l: any) => l.id === urlLeadId)
      if (lead) {
        setLeadSearch(lead.name)
        setClientName(lead.name)
        setClientEmail(lead.email || '')
        setSelectedLeadId(lead.id)
        if (lead.wedding_date) setWeddingDate(lead.wedding_date)
      }
    }
    if (urlBudgetId) {
      const bud = (budgetsRes.data || []).find((b: any) => b.id === urlBudgetId)
      if (bud) {
        setSelectedBudgetId(bud.id)
        if (bud.total_amount) setTotalAmount(bud.total_amount)
        if (!clientName && bud.couple_name) {
          setClientName(bud.couple_name)
          setLeadSearch(bud.couple_name)
        }
        if (bud.couple_email) setClientEmail(bud.couple_email)
        if (bud.wedding_date) setWeddingDate(bud.wedding_date)
        // Extract deposit from first payment installment
        const plan = bud.payment_plan as any[]
        if (plan?.length > 0) setDepositAmount(plan[0].amount || 0)
      }
    }

    setLoading(false)
  }

  // Template switch
  const switchTemplate = (t: Template) => {
    setTemplate(t)
    setSections([...TEMPLATE_SECTIONS[t]])
  }

  // Lead select
  const selectLead = (l: LeadOption) => {
    setLeadSearch(l.couple_name)
    setClientName(l.couple_name)
    setClientEmail(l.email || '')
    setSelectedLeadId(l.id)
    setSelectedBudgetId(l.budget_id || null)
    if (l.wedding_date) setWeddingDate(l.wedding_date)
    if (l.total_amount) setTotalAmount(l.total_amount)
    setShowLeadDropdown(false)
  }

  const filteredLeads = leadSearch.length > 0
    ? leads.filter(l => l.couple_name.toLowerCase().includes(leadSearch.toLowerCase()))
    : leads.slice(0, 8)

  // Section editing
  const updateSection = (idx: number, field: 'title' | 'content', value: string) => {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }
  const addSection = () => setSections(prev => [...prev, { title: 'Nueva cláusula', content: '' }])
  const removeSection = (idx: number) => setSections(prev => prev.filter((_, i) => i !== idx))

  // Replace placeholders in preview
  const replacePlaceholders = (text: string) => {
    return text
      .replace(/\[VENUE_NAME\]/g, venueName || '[Nombre del venue]')
      .replace(/\[CLIENT_NAME\]/g, clientName || '[Nombre del cliente]')
      .replace(/\[WEDDING_DATE\]/g, weddingDate ? fmtDateLong(weddingDate) : '[Fecha de la boda]')
      .replace(/\[TOTAL_AMOUNT\]/g, totalAmount ? fmtEur(totalAmount) : '[Importe total]')
      .replace(/\[DEPOSIT_AMOUNT\]/g, depositAmount ? fmtEur(depositAmount) : '[Señal]')
  }

  // Save
  const handleSave = async () => {
    if (!clientName.trim()) return alert('Introduce el nombre del cliente')
    setSaving(true)

    const supabase = createClient()
    const year = new Date().getFullYear()
    const { count } = await supabase.from('venue_contracts').select('id', { count: 'exact', head: true }).eq('user_id', user!.id)
    const num = ((count ?? 0) + 1).toString().padStart(3, '0')

    const { error } = await supabase.from('venue_contracts').insert({
      user_id: user!.id,
      venue_id: venueId,
      contract_number: `CON-${year}-${num}`,
      title: 'Contrato de servicios de boda',
      client_name: clientName,
      client_email: clientEmail || null,
      client_nif: clientNif || null,
      wedding_date: weddingDate || null,
      venue_name: venueName,
      budget_id: selectedBudgetId,
      lead_id: selectedLeadId,
      total_amount: totalAmount,
      deposit_amount: depositAmount,
      template,
      sections: sections.map(s => ({ title: s.title, content: replacePlaceholders(s.content) })),
      status: 'draft',
    })

    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/contratos')
  }

  if (isBlocked) return null
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold)' }}>Cargando...</div>
    </div>
  )

  const contractNumber = `CON-${new Date().getFullYear()}-XXX`

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">

        {/* Topbar */}
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/contratos')}>
              <ArrowLeft size={14} />
            </button>
            <div className="topbar-title">Nuevo contrato</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/contratos')}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              <Save size={13} /> {saving ? 'Guardando...' : 'Guardar contrato'}
            </button>
          </div>
        </div>

        {/* Main: form + preview */}
        <div style={{ display: 'flex', gap: 0, minHeight: 'calc(100vh - 56px)' }}>

          {/* ═══ LEFT: Form (dark sidebar) ═══ */}
          <div style={{ width: 420, flexShrink: 0, background: '#1e293b', color: 'white', padding: 24, overflowY: 'auto', maxHeight: 'calc(100vh - 56px)' }}>

            {/* Template */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Plantilla</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {([
                  { key: 'standard' as Template, label: 'Estándar' },
                  { key: 'simple' as Template, label: 'Simple' },
                  { key: 'custom' as Template, label: 'Personalizado' },
                ]).map(t => (
                  <button
                    key={t.key}
                    onClick={() => switchTemplate(t.key)}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      border: 'none', cursor: 'pointer',
                      background: template === t.key ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                      color: template === t.key ? 'white' : 'rgba(255,255,255,0.7)',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Client search */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Datos del cliente</div>

              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4, display: 'block' }}>Buscar pareja *</label>
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <input
                  value={leadSearch}
                  onChange={e => { setLeadSearch(e.target.value); setShowLeadDropdown(true) }}
                  onFocus={() => setShowLeadDropdown(true)}
                  onBlur={() => setTimeout(() => setShowLeadDropdown(false), 200)}
                  placeholder="Buscar por nombre..."
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 13, outline: 'none',
                  }}
                />
                {showLeadDropdown && filteredLeads.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                    maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  }}>
                    {filteredLeads.map(l => (
                      <div key={l.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }} onMouseDown={() => selectLead(l)}>
                        <div style={{ fontWeight: 500 }}>{l.couple_name}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                          {l.email || 'Sin email'}{l.budget_id && ' · Presupuesto'}{l.wedding_date && ` · ${fmtDateLong(l.wedding_date)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Client fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Dirección', value: clientAddress, set: setClientAddress, span: 2, ph: 'Calle Mayor 1' },
                  { label: 'Código postal', value: clientZip, set: setClientZip, ph: '28001' },
                  { label: 'País', value: clientCountry, set: setClientCountry, ph: 'España' },
                  { label: 'DNI / NIF', value: clientNif, set: setClientNif, ph: 'AB1234567' },
                  { label: 'Email', value: clientEmail, set: setClientEmail, ph: 'email@ejemplo.com' },
                ].map((f, i) => (
                  <div key={i} style={{ gridColumn: 'span' in f && f.span === 2 ? 'span 2' : undefined }}>
                    <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>{f.label}</label>
                    <input
                      value={f.value}
                      onChange={e => f.set(e.target.value)}
                      placeholder={f.ph}
                      style={{
                        width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 12, outline: 'none',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Event details */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Detalles del evento</div>
              <div style={{ marginBottom: 10 }}>
                <DatePicker value={weddingDate} onChange={setWeddingDate} label="Fecha de la boda" accent="#3b82f6" dark allowPast placeholder="Seleccionar fecha" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Importe total (€)</label>
                  <input
                    type="number" min={0} step={0.01} value={totalAmount || ''} onChange={e => setTotalAmount(Number(e.target.value))}
                    placeholder="0.00"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 12, outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Señal / Depósito (€)</label>
                  <input
                    type="number" min={0} step={0.01} value={depositAmount || ''} onChange={e => setDepositAmount(Number(e.target.value))}
                    placeholder="0.00"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 12, outline: 'none' }}
                  />
                </div>
              </div>
            </div>

            {/* Edit sections */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Cláusulas del contrato</div>
              {sections.map((s, idx) => (
                <div key={idx} style={{ marginBottom: 10, padding: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{idx + 1}.</span>
                    <input
                      value={s.title}
                      onChange={e => updateSection(idx, 'title', e.target.value)}
                      style={{ flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 12, fontWeight: 600, outline: 'none' }}
                    />
                    <button onClick={() => removeSection(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 2 }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <textarea
                    value={s.content}
                    onChange={e => updateSection(idx, 'content', e.target.value)}
                    rows={3}
                    style={{
                      width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.85)', fontSize: 11,
                      lineHeight: 1.5, resize: 'vertical', outline: 'none',
                    }}
                  />
                </div>
              ))}
              <button
                onClick={addSection}
                style={{
                  width: '100%', padding: '8px', borderRadius: 6, border: '1px dashed rgba(255,255,255,0.15)',
                  background: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Plus size={12} /> Añadir cláusula
              </button>
            </div>
          </div>

          {/* ═══ RIGHT: Live Preview ═══ */}
          <div style={{ flex: 1, background: '#f1f5f9', padding: 24, overflowY: 'auto', maxHeight: 'calc(100vh - 56px)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Vista previa</div>

            <div style={{
              background: 'white', maxWidth: 700, margin: '0 auto', padding: '48px 56px',
              boxShadow: '0 1px 8px rgba(0,0,0,0.06)', borderRadius: 4, minHeight: 800,
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
            }}>
              {/* Title */}
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 20, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#1e293b' }}>
                  Contrato de servicios
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                  Referencia: {contractNumber} | Fecha: {fmtDateLong(new Date().toISOString().slice(0, 10))}
                </div>
                <div style={{ width: 80, height: 2, background: '#1e293b', margin: '12px auto 0' }} />
              </div>

              {/* Sections */}
              {sections.map((s, idx) => {
                const content = replacePlaceholders(s.content)

                // Special render for "Partes" section — two-column box
                if (s.title.toLowerCase().includes('partes')) {
                  return (
                    <div key={idx} style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>{idx + 1}. {s.title}</div>
                      <div style={{ display: 'flex', gap: 0, border: '1px solid #e2e8f0', borderRadius: 4 }}>
                        <div style={{ flex: 1, padding: '14px 16px', borderRight: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>El prestador</div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{venueName || '[Nombre del venue]'}</div>
                        </div>
                        <div style={{ flex: 1, padding: '14px 16px' }}>
                          <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>El cliente</div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{clientName || '[Nombre del cliente]'}</div>
                        </div>
                      </div>
                    </div>
                  )
                }

                // Special render for "económicas" / "precio" section — table
                if (s.title.toLowerCase().includes('econ') || s.title.toLowerCase().includes('precio') || s.title.toLowerCase().includes('pago')) {
                  return (
                    <div key={idx} style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>{idx + 1}. {s.title}</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 8, border: '1px solid #e2e8f0' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>Importe total</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>{totalAmount ? fmtEur(totalAmount) : '—'}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>IVA 21%</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>{totalAmount ? fmtEur(totalAmount * 0.21) : '—'}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 700 }}>Precio total (IVA incl.)</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{totalAmount ? fmtEur(totalAmount * 1.21) : '—'}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>Señal de reserva</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>{depositAmount ? fmtEur(depositAmount) : '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{content}</div>
                    </div>
                  )
                }

                // Default text section
                return (
                  <div key={idx} style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>{idx + 1}. {s.title}</div>
                    <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{content}</div>
                  </div>
                )
              })}

              {/* Signatures */}
              <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', marginBottom: 20 }}>{sections.length + 1}. Firmas</div>
                <div style={{ display: 'flex', gap: 32 }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>El prestador</div>
                    <div style={{ height: 50, borderBottom: '1px solid #cbd5e1', margin: '12px 0 4px' }} />
                    <div style={{ height: 20, borderBottom: '1px solid #cbd5e1', marginBottom: 4 }} />
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>Fecha: _______________</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>El cliente</div>
                    <div style={{ height: 50, borderBottom: '1px solid #cbd5e1', margin: '12px 0 4px' }} />
                    <div style={{ height: 20, borderBottom: '1px solid #cbd5e1', marginBottom: 4 }} />
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>Fecha: _______________</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

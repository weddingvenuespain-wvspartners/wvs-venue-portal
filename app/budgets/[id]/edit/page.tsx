'use client'
import { useEffect, useState, useCallback, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { usePlanFeatures } from '@/lib/use-plan-features'
import {
  Plus, Trash2, X, Check, Save, ChevronDown,
  GripVertical, AlertCircle, Loader2, Package,
  Lock, FileText, Download, Calendar, Users, ArrowLeft, Link2, ExternalLink,
} from 'lucide-react'
import type {
  Budget, LineItemGroup, LineItem, PaymentInstallment,
  PaymentTemplate, PaymentTemplateRule, DossierResponse,
} from '@/lib/budget-types'
import { calcBudgetTotal, applyPaymentTemplate } from '@/lib/budget-types'
import BudgetView from '@/app/presupuesto/[slug]/BudgetView'
import ProposalDateModal from '@/components/ProposalDateModal'
import { fmtDate } from '@/components/DatePicker'

function nanoid(len = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

const S_BADGE: Record<string, string> = {
  draft: 'badge-inactive', sent: 'badge-contacted', viewed: 'badge-active',
  accepted: 'badge-confirmed', expired: 'badge-pending',
}
const S_LABEL: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviado', viewed: 'Visto',
  accepted: 'Aceptado', expired: 'Expirado',
}

export default function BudgetEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user, loading: authLoading, activeVenue } = useAuth()
  const { isBlocked } = useRequireSubscription()
  const features = usePlanFeatures()

  const [budget, setBudget] = useState<Budget | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [templates, setTemplates] = useState<PaymentTemplate[]>([])
  const [showImport, setShowImport] = useState(false)
  const [modalities, setModalities] = useState<any[]>([])
  const [venue, setVenue] = useState<{ name: string | null; logo_url: string | null; contact_email: string | null; contact_phone: string | null } | null>(null)
  const [branding, setBranding] = useState<{ primary_color: string | null; logo_url: string | null; font_family: string | null } | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [leads, setLeads] = useState<any[]>([])
  const [leadId, setLeadId] = useState<string | null>(null)
  const [leadSearch, setLeadSearch] = useState('')
  const [showLeadPicker, setShowLeadPicker] = useState(false)
  const [showDateModal, setShowDateModal] = useState(false)
  const leadPickerRef = useRef<HTMLDivElement>(null)

  // Close lead picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (leadPickerRef.current && !leadPickerRef.current.contains(e.target as Node)) setShowLeadPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Form state
  const [coupleName, setCoupleName] = useState('')
  const [coupleEmail, setCoupleEmail] = useState('')
  const [weddingDate, setWeddingDate] = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [notes, setNotes] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [groups, setGroups] = useState<LineItemGroup[]>([])
  const [discountType, setDiscountType] = useState<'fixed' | 'percent' | null>(null)
  const [discountAmount, setDiscountAmount] = useState<number>(0)
  const [discountLabel, setDiscountLabel] = useState('')
  const [taxRate, setTaxRate] = useState<number>(21)
  const [taxIncluded, setTaxIncluded] = useState(true)
  const [password, setPassword] = useState('')
  const [dossierResponses, setDossierResponses] = useState<DossierResponse[]>([])
  const [paymentPlan, setPaymentPlan] = useState<PaymentInstallment[]>([])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadBudget()
  }, [user, authLoading, activeVenue?.id])

  const loadBudget = async () => {
    if (!activeVenue) return
    const supabase = createClient()
    const [{ data: b }, { data: t }, { data: m }, { data: v }, { data: br }, { data: ld }] = await Promise.all([
      supabase.from('budgets').select('*').eq('id', id).eq('venue_id', activeVenue.id).single(),
      supabase.from('budget_payment_templates').select('*').eq('venue_id', activeVenue.id).order('created_at'),
      supabase.from('venue_modalities').select('*, packages:venue_modality_packages(*, prices:venue_modality_prices(*))').eq('user_id', user!.id).order('sort_order'),
      supabase.from('venue_onboarding').select('name, logo_url, contact_email, contact_phone').eq('user_id', user!.id).maybeSingle(),
      supabase.from('proposal_branding').select('primary_color, logo_url, font_family').eq('user_id', user!.id).maybeSingle(),
      supabase.from('leads').select('id, name, email, wedding_date, guests').eq('venue_id', activeVenue.id).neq('status', 'lost').order('created_at', { ascending: false }),
    ])
    if (!b) { setError('Presupuesto no encontrado'); setLoading(false); return }
    const bud = b as Budget
    setBudget(bud)
    setCoupleName(bud.couple_name)
    setCoupleEmail(bud.couple_email ?? '')
    setWeddingDate(bud.wedding_date ?? '')
    setGuestCount(bud.guest_count?.toString() ?? '')
    setNotes(bud.notes ?? '')
    setValidUntil(bud.valid_until ?? '')
    setGroups(bud.line_items.groups || [])
    setDiscountType(bud.discount_type)
    setDiscountAmount(bud.discount_amount ?? 0)
    setDiscountLabel(bud.discount_label ?? '')
    setTaxRate(bud.tax_rate ?? 21)
    setTaxIncluded(bud.tax_included ?? true)
    setPaymentPlan(bud.payment_plan || [])
    setPassword(bud.password ?? '')
    setLeadId(bud.lead_id)
    if (t) setTemplates(t as PaymentTemplate[])
    if (m) setModalities(m)
    if (v) setVenue(v as any)
    if (br) setBranding(br as any)
    if (ld) setLeads(ld)

    // Load dossier responses if linked to a lead
    if (bud.lead_id) {
      const { data: proposals } = await supabase
        .from('proposals')
        .select('id, couple_name, sections_data, visit_request')
        .eq('lead_id', bud.lead_id)
        .eq('venue_id', activeVenue.id)
        .order('created_at', { ascending: false })
      if (proposals && proposals.length > 0) {
        const dossiers: DossierResponse[] = []
        for (const p of proposals) {
          const { data: menuSel } = await supabase
            .from('proposal_menu_selections')
            .select('*')
            .eq('proposal_id', p.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          dossiers.push({
            proposal_id: p.id,
            proposal_name: p.couple_name ?? 'Dosier',
            menu_selection: menuSel ? {
              selected_menu_name: menuSel.selected_menu_name,
              guest_count: menuSel.guest_count,
              course_choices: menuSel.course_choices,
              selected_extras: menuSel.selected_extras,
              comments: menuSel.comments,
              estimated_total: menuSel.estimated_total ? parseFloat(menuSel.estimated_total) : null,
              menu_allocations: menuSel.menu_allocations,
            } : null,
            selected_date: (p.sections_data as any)?.selected_date_slot?.date ?? null,
            visit_request: p.visit_request,
            sections_data: p.sections_data,
          })
        }
        setDossierResponses(dossiers)
      }
    }

    setLoading(false)
  }

  const total = calcBudgetTotal(
    groups,
    { type: discountType, amount: discountAmount },
    taxRate,
    taxIncluded
  )

  const subtotal = groups.reduce((sum, g) => sum + g.items.reduce((s, i) => s + i.subtotal, 0), 0)

  const saveBudget = useCallback(async () => {
    if (!budget) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('budgets').update({
      couple_name: coupleName,
      couple_email: coupleEmail || null,
      wedding_date: weddingDate || null,
      guest_count: guestCount ? parseInt(guestCount) : null,
      notes: notes || null,
      valid_until: validUntil || null,
      line_items: { groups },
      payment_plan: paymentPlan,
      total_amount: total,
      tax_rate: taxRate,
      tax_included: taxIncluded,
      discount_type: discountType,
      discount_amount: discountAmount || null,
      discount_label: discountLabel || null,
      password: password || null,
      lead_id: leadId,
      updated_at: new Date().toISOString(),
    }).eq('id', budget.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [budget, coupleName, coupleEmail, weddingDate, guestCount, notes, validUntil, groups, paymentPlan, total, taxRate, taxIncluded, discountType, discountAmount, discountLabel, password, leadId])

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (!budget || loading) return
    const t = setTimeout(() => { saveBudget() }, 1500)
    return () => clearTimeout(t)
  }, [coupleName, coupleEmail, weddingDate, guestCount, notes, validUntil, groups, paymentPlan, taxRate, taxIncluded, discountType, discountAmount, discountLabel, password, leadId])

  // Group operations
  const addGroup = () => {
    setGroups(prev => [...prev, { id: nanoid(), name: 'Nuevo grupo', items: [] }])
  }
  const removeGroup = (gid: string) => {
    setGroups(prev => prev.filter(g => g.id !== gid))
  }
  const updateGroupName = (gid: string, name: string) => {
    setGroups(prev => prev.map(g => g.id === gid ? { ...g, name } : g))
  }

  // Item operations
  const addItem = (gid: string) => {
    setGroups(prev => prev.map(g => g.id === gid ? {
      ...g, items: [...g.items, { id: nanoid(), concept: '', qty: 1, unit_price: 0, subtotal: 0 }]
    } : g))
  }
  const removeItem = (gid: string, iid: string) => {
    setGroups(prev => prev.map(g => g.id === gid ? { ...g, items: g.items.filter(i => i.id !== iid) } : g))
  }
  const updateItem = (gid: string, iid: string, field: keyof LineItem, value: any) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== gid) return g
      return {
        ...g, items: g.items.map(i => {
          if (i.id !== iid) return i
          const updated = { ...i, [field]: value }
          if (field === 'qty' || field === 'unit_price') {
            updated.subtotal = Math.round(updated.qty * updated.unit_price * 100) / 100
          }
          return updated
        })
      }
    }))
  }

  // Payment plan
  const applyTpl = (tpl: PaymentTemplate) => {
    setPaymentPlan(applyPaymentTemplate(tpl.installments as PaymentTemplateRule[], total, weddingDate || null))
  }
  const updatePayment = (idx: number, field: keyof PaymentInstallment, value: any) => {
    setPaymentPlan(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }
  const addPayment = () => {
    setPaymentPlan(prev => [...prev, { label: '', amount: 0, due_date: '', status: 'pending' }])
  }
  const removePayment = (idx: number) => {
    setPaymentPlan(prev => prev.filter((_, i) => i !== idx))
  }

  // Import from structure
  const importModality = (mod: any) => {
    const items: LineItem[] = []
    if (mod.packages) {
      for (const pkg of mod.packages) {
        if (pkg.prices) {
          for (const price of pkg.prices) {
            items.push({
              id: nanoid(),
              concept: pkg.label ? `${mod.name} — ${pkg.label}` : mod.name,
              qty: 1,
              unit_price: parseFloat(price.price) || 0,
              subtotal: parseFloat(price.price) || 0,
            })
          }
        }
      }
    }
    if (items.length === 0 && mod.prices) {
      for (const price of mod.prices) {
        items.push({
          id: nanoid(),
          concept: mod.name,
          qty: 1,
          unit_price: parseFloat(price.price) || 0,
          subtotal: parseFloat(price.price) || 0,
        })
      }
    }
    if (items.length === 0) {
      items.push({ id: nanoid(), concept: mod.name, qty: 1, unit_price: 0, subtotal: 0 })
    }
    setGroups(prev => [...prev, { id: nanoid(), name: mod.name, items }])
    setShowImport(false)
  }

  // Link lead to budget
  const linkLead = async (lead: any) => {
    setLeadId(lead.id)
    setShowLeadPicker(false)
    setLeadSearch('')
    // Auto-fill from lead
    if (lead.name) setCoupleName(lead.name)
    if (lead.email) setCoupleEmail(lead.email)
    if (lead.wedding_date) setWeddingDate(lead.wedding_date)
    if (lead.guests) setGuestCount(lead.guests.toString())
    // Load dossier responses for this lead
    if (!activeVenue) return
    const supabase = createClient()
    const { data: proposals } = await supabase
      .from('proposals')
      .select('id, couple_name, sections_data, visit_request')
      .eq('lead_id', lead.id)
      .eq('venue_id', activeVenue.id)
      .order('created_at', { ascending: false })
    if (proposals && proposals.length > 0) {
      const dossiers: DossierResponse[] = []
      for (const p of proposals) {
        const { data: menuSel } = await supabase
          .from('proposal_menu_selections')
          .select('*')
          .eq('proposal_id', p.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        dossiers.push({
          proposal_id: p.id,
          proposal_name: p.couple_name ?? 'Dosier',
          menu_selection: menuSel ? {
            selected_menu_name: menuSel.selected_menu_name,
            guest_count: menuSel.guest_count,
            course_choices: menuSel.course_choices,
            selected_extras: menuSel.selected_extras,
            comments: menuSel.comments,
            estimated_total: menuSel.estimated_total ? parseFloat(menuSel.estimated_total) : null,
            menu_allocations: menuSel.menu_allocations,
          } : null,
          selected_date: (p.sections_data as any)?.selected_date_slot?.date ?? null,
          visit_request: p.visit_request,
          sections_data: p.sections_data,
        })
      }
      setDossierResponses(dossiers)
    } else {
      setDossierResponses([])
    }
  }

  const unlinkLead = () => {
    setLeadId(null)
    setShowLeadPicker(false)
    setDossierResponses([])
  }

  const copyUrl = () => {
    if (!budget) return
    navigator.clipboard.writeText(`${window.location.origin}/presupuesto/${budget.slug}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  if (isBlocked) return null

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', color: 'var(--warm-gray)', gap: 8 }}>
      <Loader2 size={16} className="animate-spin" /> Cargando editor…
    </div>
  )

  if (error || !budget) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: 'var(--cream)' }}>
      <AlertCircle size={18} style={{ color: 'var(--rose)' }} />
      <div style={{ fontSize: 14, color: 'var(--charcoal)' }}>{error || 'No encontrado'}</div>
      <button className="btn btn-ghost btn-sm" onClick={() => router.push('/budgets')}>← Volver</button>
    </div>
  )

  const paymentTotal = paymentPlan.reduce((s, p) => s + p.amount, 0)

  // Build a mock budget object for the inline preview
  const previewBudget: Budget = {
    ...budget,
    couple_name: coupleName,
    couple_email: coupleEmail || null,
    wedding_date: weddingDate || null,
    guest_count: guestCount ? parseInt(guestCount) : null,
    notes: notes || null,
    valid_until: validUntil || null,
    line_items: { groups },
    payment_plan: paymentPlan,
    total_amount: total,
    tax_rate: taxRate,
    tax_included: taxIncluded,
    discount_type: discountType,
    discount_amount: discountAmount || null,
    discount_label: discountLabel || null,
    password: null,
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: 'var(--cream)' }}>

      {/* ── LEFT PANEL: form ───────────────────────────────────────── */}
      <div style={{ width: 460, minWidth: 460, display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => router.push('/budgets')}
              title="Volver a presupuestos"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4, display: 'inline-flex', alignItems: 'center', borderRadius: 6 }}
            >
              <ArrowLeft size={16} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {coupleName || 'Presupuesto'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                <span className={`badge ${S_BADGE[budget.status]}`} style={{ fontSize: 10, padding: '1px 6px' }}>{S_LABEL[budget.status]}</span>
                {saving && <span style={{ color: '#b45309', marginLeft: 6 }}>· guardando…</span>}
                {saved && !saving && <span style={{ color: '#16a34a', marginLeft: 6 }}>· guardado</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={copyUrl}
              title="Copiar URL pública"
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: linkCopied ? '#16a34a' : 'var(--warm-gray)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}
            >
              {linkCopied ? <><Check size={12} /> Copiado</> : <><Link2 size={12} /> URL</>}
            </button>
            <a
              href={`/presupuesto/${budget.slug}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir en nueva pestaña"
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--warm-gray)', display: 'inline-flex', alignItems: 'center', fontSize: 11, textDecoration: 'none' }}
            >
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Scrollable form body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>

          {/* ── Lead vinculado ─────────────────────────────────── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lead vinculado</div>
            </div>
            {leadId ? (() => {
              const lead = leads.find(l => l.id === leadId)
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--cream)', borderRadius: 8, border: '1px solid var(--ivory)' }}>
                  <Users size={13} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--espresso)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lead?.name || 'Lead'}
                    </div>
                    {lead?.email && <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{lead.email}</div>}
                  </div>
                  <button onClick={unlinkLead} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: 2 }} title="Desvincular lead"><X size={13} /></button>
                </div>
              )
            })() : (
              <div ref={leadPickerRef} style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  value={leadSearch}
                  onChange={e => { setLeadSearch(e.target.value); setShowLeadPicker(true) }}
                  onFocus={() => setShowLeadPicker(true)}
                  placeholder="Buscar lead para vincular..."
                  style={{ fontSize: 12 }}
                />
                {showLeadPicker && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--ivory)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 10, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                    {leads
                      .filter(l => {
                        if (!leadSearch) return true
                        const q = leadSearch.toLowerCase()
                        return (l.name || '').toLowerCase().includes(q) || (l.email || '').toLowerCase().includes(q)
                      })
                      .slice(0, 15)
                      .map(l => (
                        <div
                          key={l.id}
                          onClick={() => linkLead(l)}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--ivory)', fontSize: 12 }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream)')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                        >
                          <div style={{ fontWeight: 600, color: 'var(--espresso)' }}>{l.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--warm-gray)', display: 'flex', gap: 8 }}>
                            {l.email && <span>{l.email}</span>}
                            {l.wedding_date && <span>{new Date(l.wedding_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                          </div>
                        </div>
                      ))
                    }
                    {leads.filter(l => {
                      if (!leadSearch) return true
                      const q = leadSearch.toLowerCase()
                      return (l.name || '').toLowerCase().includes(q) || (l.email || '').toLowerCase().includes(q)
                    }).length === 0 && (
                      <div style={{ padding: '12px', fontSize: 12, color: 'var(--warm-gray)', textAlign: 'center' }}>Sin resultados</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Datos de la pareja ─────────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Datos de la pareja</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nombre</label>
                <input className="form-input" value={coupleName} onChange={e => setCoupleName(e.target.value)} placeholder="Laura y Carlos" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={coupleEmail} onChange={e => setCoupleEmail(e.target.value)} placeholder="email@..." />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Fecha boda</label>
                <button
                  type="button"
                  onClick={() => setShowDateModal(true)}
                  className="form-input"
                  style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: weddingDate ? 'var(--espresso)' : 'var(--warm-gray)', background: '#fff' }}
                >
                  <Calendar size={12} style={{ flexShrink: 0, color: 'var(--warm-gray)' }} />
                  {weddingDate ? fmtDate(weddingDate) : 'Seleccionar...'}
                </button>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Invitados</label>
                <input className="form-input" type="number" min={0} value={guestCount} onChange={e => setGuestCount(e.target.value)} placeholder="150" />
              </div>
            </div>
          </div>

          {/* ── Conceptos ───────────────────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conceptos</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {modalities.length > 0 && (
                  <button onClick={() => setShowImport(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 3 }}><Package size={11} /> Importar</button>
                )}
                <button onClick={addGroup} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 3 }}><Plus size={11} /> Grupo</button>
              </div>
            </div>

            {groups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--warm-gray)', fontSize: 12, background: 'var(--cream)', borderRadius: 8 }}>
                Añade un grupo de conceptos
              </div>
            ) : groups.map(g => (
              <div key={g.id} style={{ marginBottom: 10, border: '1px solid var(--ivory)', borderRadius: 8, overflow: 'hidden' }}>
                {/* Group header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'var(--cream)' }}>
                  <GripVertical size={12} style={{ color: 'var(--stone)', cursor: 'grab', flexShrink: 0 }} />
                  <input
                    value={g.name}
                    onChange={e => updateGroupName(g.id, e.target.value)}
                    style={{ flex: 1, background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: 'var(--espresso)', outline: 'none', minWidth: 0 }}
                  />
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--charcoal)', flexShrink: 0 }}>
                    {g.items.reduce((s, i) => s + i.subtotal, 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </div>
                  <button onClick={() => removeGroup(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: 2, flexShrink: 0 }}><Trash2 size={12} /></button>
                </div>
                {/* Column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 80px 80px 24px', gap: 0, padding: '4px 10px', fontSize: 9, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--ivory)' }}>
                  <span>Concepto</span><span style={{ textAlign: 'center' }}>Uds</span><span style={{ textAlign: 'right' }}>€/ud</span><span style={{ textAlign: 'right' }}>Total</span><span />
                </div>
                {/* Items */}
                {g.items.map(item => (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 50px 80px 80px 24px', gap: 0, padding: '4px 10px', alignItems: 'center', borderBottom: '1px solid var(--ivory)' }}>
                    <input value={item.concept} onChange={e => updateItem(g.id, item.id, 'concept', e.target.value)} className="form-input" style={{ border: 'none', padding: '3px 0', fontSize: 12 }} placeholder="Concepto" />
                    <input type="number" min={0} value={item.qty} onChange={e => updateItem(g.id, item.id, 'qty', Number(e.target.value))} className="form-input" style={{ border: 'none', padding: '3px', fontSize: 12, textAlign: 'center' }} />
                    <input type="number" min={0} step={0.01} value={item.unit_price} onChange={e => updateItem(g.id, item.id, 'unit_price', Number(e.target.value))} className="form-input" style={{ border: 'none', padding: '3px', fontSize: 12, textAlign: 'right' }} />
                    <div style={{ fontSize: 12, fontWeight: 500, textAlign: 'right', color: 'var(--charcoal)' }}>{item.subtotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
                    <button onClick={() => removeItem(g.id, item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: 1 }}><X size={11} /></button>
                  </div>
                ))}
                <button onClick={() => addItem(g.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--gold)' }}>
                  <Plus size={11} /> Concepto
                </button>
              </div>
            ))}
          </div>

          {/* ── Descuento + IVA ──────────────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Descuento e IVA</div>
            {/* Discount */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <select className="form-input" style={{ width: 110, fontSize: 12 }} value={discountType ?? ''} onChange={e => setDiscountType(e.target.value as any || null)}>
                  <option value="">Sin descuento</option>
                  <option value="fixed">Fijo (€)</option>
                  <option value="percent">Porcentaje (%)</option>
                </select>
                {discountType && (
                  <>
                    <input className="form-input" type="number" min={0} step={0.01} style={{ width: 80, fontSize: 12 }} value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value))} />
                    <input className="form-input" style={{ flex: 1, fontSize: 12, minWidth: 100 }} value={discountLabel} onChange={e => setDiscountLabel(e.target.value)} placeholder="Descripción" />
                  </>
                )}
              </div>
            </div>
            {/* Tax */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--charcoal)' }}>IVA</span>
              <input className="form-input" type="number" min={0} max={100} style={{ width: 60, fontSize: 12 }} value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} />
              <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>%</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--charcoal)', cursor: 'pointer' }}>
                <input type="checkbox" checked={taxIncluded} onChange={e => setTaxIncluded(e.target.checked)} /> Incluido
              </label>
            </div>
            {/* Total summary */}
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--cream)', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--charcoal)', marginBottom: 4 }}>
                <span>Subtotal</span>
                <span>{subtotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
              </div>
              {discountType && discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#16a34a', marginBottom: 4 }}>
                  <span>Descuento</span>
                  <span>-{discountType === 'percent' ? `${discountAmount}%` : discountAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
              )}
              {!taxIncluded && taxRate > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--charcoal)', marginBottom: 4 }}>
                  <span>IVA ({taxRate}%)</span>
                  <span>{((total - subtotal + (discountType === 'fixed' ? discountAmount : discountType === 'percent' ? subtotal * discountAmount / 100 : 0))).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: 'var(--espresso)', paddingTop: 6, borderTop: '1px solid var(--ivory)' }}>
                <span>Total</span>
                <span>{total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
              </div>
            </div>
          </div>

          {/* ── Plan de pagos ──────────────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plan de pagos</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {templates.length > 0 && (
                  <select className="form-input" style={{ width: 150, fontSize: 11 }} defaultValue="" onChange={e => {
                    const t = templates.find(t => t.id === e.target.value)
                    if (t) applyTpl(t)
                    e.target.value = ''
                  }}>
                    <option value="" disabled>Plantilla...</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
                <button onClick={addPayment} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 3 }}><Plus size={11} /> Cuota</button>
              </div>
            </div>
            {paymentPlan.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--warm-gray)', fontSize: 12, background: 'var(--cream)', borderRadius: 8 }}>
                Sin plan de pagos
              </div>
            ) : (
              <>
                {paymentPlan.map((p, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 70px 24px', gap: 0, padding: '6px 0', alignItems: 'center', borderBottom: '1px solid var(--ivory)' }}>
                    <input value={p.label} onChange={e => updatePayment(i, 'label', e.target.value)} className="form-input" style={{ border: 'none', padding: '3px 0', fontSize: 12 }} placeholder="Cuota" />
                    <input type="number" min={0} step={0.01} value={p.amount} onChange={e => updatePayment(i, 'amount', Number(e.target.value))} className="form-input" style={{ border: 'none', padding: '3px', fontSize: 12, textAlign: 'right' }} />
                    <input type="date" value={p.due_date} onChange={e => updatePayment(i, 'due_date', e.target.value)} className="form-input" style={{ border: 'none', padding: '3px', fontSize: 11, textAlign: 'center' }} />
                    <select value={p.status} onChange={e => updatePayment(i, 'status', e.target.value)} className="form-input" style={{ border: 'none', padding: '3px', fontSize: 10 }}>
                      <option value="pending">Pend.</option>
                      <option value="paid">Pagado</option>
                    </select>
                    <button onClick={() => removePayment(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: 1 }}><X size={11} /></button>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6, fontSize: 11, fontWeight: 600, color: Math.abs(paymentTotal - total) < 0.01 ? '#16a34a' : 'var(--rose)' }}>
                  Suma: {paymentTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} {Math.abs(paymentTotal - total) >= 0.01 && `(dif: ${(paymentTotal - total).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })})`}
                </div>
              </>
            )}
          </div>

          {/* ── Respuestas del dosier ──────────────────────────── */}
          {dossierResponses.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <FileText size={12} style={{ color: 'var(--gold)' }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Respuestas del dosier</div>
              </div>
              {dossierResponses.map((d, di) => (
                <div key={di} style={{ border: '1px solid var(--ivory)', borderRadius: 8, overflow: 'hidden', marginBottom: di < dossierResponses.length - 1 ? 8 : 0 }}>
                  <div style={{ padding: '8px 10px', background: 'var(--cream)', fontSize: 11, fontWeight: 600, color: 'var(--espresso)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{d.proposal_name}</span>
                    {d.menu_selection && (
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 3 }}
                        onClick={() => {
                          const ms = d.menu_selection!
                          const items: LineItem[] = []
                          if (ms.selected_menu_name) {
                            items.push({
                              id: nanoid(), concept: `Menú: ${ms.selected_menu_name}`,
                              qty: ms.guest_count ?? (parseInt(guestCount) || 1),
                              unit_price: ms.estimated_total && ms.guest_count ? Math.round((ms.estimated_total / ms.guest_count) * 100) / 100 : 0,
                              subtotal: ms.estimated_total ?? 0,
                            })
                          }
                          if (ms.selected_extras && Array.isArray(ms.selected_extras)) {
                            for (const extra of ms.selected_extras) {
                              const extraName = typeof extra === 'string' ? extra : (extra?.name || extra?.label || 'Extra')
                              const extraPrice = typeof extra === 'object' ? (extra?.price ?? extra?.unit_price ?? 0) : 0
                              items.push({
                                id: nanoid(), concept: extraName,
                                qty: ms.guest_count ?? (parseInt(guestCount) || 1),
                                unit_price: extraPrice,
                                subtotal: extraPrice * (ms.guest_count ?? (parseInt(guestCount) || 1)),
                              })
                            }
                          }
                          if (items.length > 0) {
                            setGroups(prev => [...prev, { id: nanoid(), name: `Dosier — ${ms.selected_menu_name || d.proposal_name}`, items }])
                          }
                        }}
                      >
                        <Download size={10} /> Importar
                      </button>
                    )}
                  </div>
                  <div style={{ padding: '10px', fontSize: 12, color: 'var(--charcoal)' }}>
                    {d.menu_selection ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {d.menu_selection.selected_menu_name && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 65 }}>Menú</span>
                            <span style={{ fontWeight: 600, fontSize: 12 }}>{d.menu_selection.selected_menu_name}</span>
                          </div>
                        )}
                        {d.menu_selection.guest_count && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 65 }}>Invitados</span>
                            <span style={{ fontSize: 12 }}><Users size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{d.menu_selection.guest_count}</span>
                          </div>
                        )}
                        {d.menu_selection.estimated_total != null && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 65 }}>Estimado</span>
                            <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 12 }}>{d.menu_selection.estimated_total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                          </div>
                        )}
                        {d.menu_selection.selected_extras && Array.isArray(d.menu_selection.selected_extras) && d.menu_selection.selected_extras.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 65 }}>Extras</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                              {d.menu_selection.selected_extras.map((e: any, i: number) => (
                                <span key={i} style={{ fontSize: 10, background: 'var(--ivory)', padding: '1px 6px', borderRadius: 4 }}>
                                  {typeof e === 'string' ? e : (e?.name || e?.label || 'Extra')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {d.menu_selection.course_choices && typeof d.menu_selection.course_choices === 'object' && Object.keys(d.menu_selection.course_choices).length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 65 }}>Platos</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                              {Object.entries(d.menu_selection.course_choices).map(([course, choice]: [string, any]) => (
                                <span key={course} style={{ fontSize: 10, background: 'var(--ivory)', padding: '1px 6px', borderRadius: 4 }}>
                                  {typeof choice === 'string' ? choice : (choice?.name || course)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {d.menu_selection.comments && (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 65 }}>Notas</span>
                            <span style={{ fontStyle: 'italic', color: 'var(--warm-gray)', fontSize: 11 }}>{d.menu_selection.comments}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Sin selección de menú</div>
                    )}
                    {d.selected_date && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--ivory)' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 65 }}>Fecha</span>
                        <span style={{ fontSize: 11 }}><Calendar size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{new Date(d.selected_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                    )}
                    {d.visit_request && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--ivory)' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 65 }}>Visita</span>
                        <span style={{ fontSize: 11 }}>
                          {(d.visit_request as any)?.date ? new Date((d.visit_request as any).date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}
                          {(d.visit_request as any)?.time ? ` a las ${(d.visit_request as any).time}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Mensaje + validez + contraseña ─────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Opciones</div>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label">Mensaje personalizado</label>
              <textarea className="form-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Hola Laura y Carlos, aquí tenéis vuestro presupuesto detallado..." style={{ resize: 'vertical', fontSize: 12 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Válido hasta</label>
                <input className="form-input" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Lock size={10} /> Contraseña
                </label>
                <input className="form-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Sin contraseña" style={{ fontSize: 12 }} />
              </div>
            </div>
            {password && <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 6 }}>La pareja necesitará esta contraseña para ver el presupuesto.</div>}
          </div>

        </div>

        {/* Footer — save button */}
        <div style={{ flexShrink: 0, padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          <button
            onClick={saveBudget}
            disabled={saving}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {saving ? <><Loader2 size={13} className="animate-spin" /> Guardando…</> : saved ? <><Check size={13} /> Guardado</> : <><Save size={13} /> Guardar cambios</>}
          </button>
        </div>
      </div>

      {/* ── RIGHT PANEL: live preview ──────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto' }}>
        <BudgetView
          budget={previewBudget as any}
          venue={venue}
          branding={branding}
          isPreview={true}
          hasPassword={false}
        />
      </div>

      {/* Import modal */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setShowImport(false)}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '70vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 17, color: 'var(--espresso)' }}>Importar desde estructura</div>
              <button onClick={() => setShowImport(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '16px 24px' }}>
              {modalities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--warm-gray)', fontSize: 13 }}>No tienes modalidades configuradas en Estructura.</div>
              ) : modalities.map((m: any) => (
                <div key={m.id} onClick={() => importModality(m)}
                  style={{ padding: '12px 16px', border: '1px solid var(--ivory)', borderRadius: 8, marginBottom: 8, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--ivory)')}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>{m.name}</div>
                  {m.description && <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{m.description}</div>}
                  <div style={{ fontSize: 11, color: 'var(--stone)', marginTop: 4 }}>
                    {m.packages?.length || 0} paquete{m.packages?.length !== 1 ? 's' : ''} · {m.prices?.length || 0} precio{m.prices?.length !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Date modal */}
      {showDateModal && user && (
        <ProposalDateModal
          userId={user.id}
          currentDate={weddingDate || null}
          onClose={() => setShowDateModal(false)}
          onConfirm={(dates) => {
            setWeddingDate(dates[0] ?? '')
            setShowDateModal(false)
          }}
        />
      )}
    </div>
  )
}

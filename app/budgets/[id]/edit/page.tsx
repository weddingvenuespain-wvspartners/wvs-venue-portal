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
  Lock, FileText, Download, Calendar, Users, ArrowLeft, Link2, ExternalLink, ScrollText,
} from 'lucide-react'
import type {
  Budget, LineItemGroup, LineItem, PaymentInstallment,
  PaymentTemplate, PaymentTemplateRule, DossierResponse,
} from '@/lib/budget-types'
import { calcBudgetTotal, applyPaymentTemplate } from '@/lib/budget-types'
import BudgetView from '@/app/budget/[slug]/BudgetView'
import ProposalDateModal from '@/components/ProposalDateModal'
import DatePicker, { fmtDate } from '@/components/DatePicker'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { applyCommissionToBudget } from '@/lib/budget-commission'

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
  // Contracts state
  const [budgetContracts, setBudgetContracts] = useState<Array<{ id: string; contract_number: string; title: string; status: string }>>([])
  const [allContracts, setAllContracts] = useState<Array<{ id: string; contract_number: string; client_name: string; status: string }>>([])
  const [showContractPicker, setShowContractPicker] = useState(false)
  // Commission state
  const [commissionPlannerId, setCommissionPlannerId] = useState<string | null>(null)
  const [commissionPercent, setCommissionPercent] = useState<number | null>(null)
  const [commissionMode, setCommissionMode] = useState<'comisionable' | 'neto' | null>(null)
  const [showCommissionAsClient, setShowCommissionAsClient] = useState(false)
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
  const [includesText, setIncludesText] = useState('')
  const [dossierResponses, setDossierResponses] = useState<DossierResponse[]>([])
  const [paymentPlan, setPaymentPlan] = useState<PaymentInstallment[]>([])
  // Imported from proposal / editable in sidebar
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null)
  const [selectedModalityId, setSelectedModalityId] = useState<string | null>(null)
  const [selectedLodgingId, setSelectedLodgingId] = useState<string | null>(null)
  const [allConfigs, setAllConfigs] = useState<any[]>([])
  // New extra fields
  const [budgetName, setBudgetName] = useState('')
  const [budgetDescription, setBudgetDescription] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [message, setMessage] = useState('')
  // Sidebar tab nav
  const [sidebarTab, setSidebarTab] = useState<'general' | 'config' | 'conceptos' | 'pagos' | 'detalles'>('general')
  // Source proposal selection (when lead has multiple proposals)
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null)
  const [leadProposals, setLeadProposals] = useState<any[]>([])
  // Concept picker modal (from proposal)
  const [showConceptPicker, setShowConceptPicker] = useState<string | null>(null)  // group_id or null
  const [proposalConcepts, setProposalConcepts] = useState<any[]>([])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadBudget()
  }, [user, authLoading, activeVenue?.id])

  // Load proposals for currently linked lead (so user can pick which one feeds this budget)
  useEffect(() => {
    if (!leadId || !activeVenue) { setLeadProposals([]); return }
    const supabase = createClient()
    supabase.from('proposals')
      .select('id, couple_name, created_at, commercial_config_id, modality_id, lodging_config_id, sections_data')
      .eq('lead_id', leadId)
      .eq('venue_id', activeVenue.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = data ?? []
        setLeadProposals(list)
        // Auto-select if only one and none picked yet
        if (list.length === 1 && !selectedProposalId) setSelectedProposalId(list[0].id)
      })
  }, [leadId, activeVenue?.id])  // eslint-disable-line

  // Fetch concepts from selected proposal (modality price, menu selection, extras, rooms)
  useEffect(() => {
    if (!selectedProposalId) { setProposalConcepts([]); return }
    const supabase = createClient()
    ;(async () => {
      const concepts: any[] = []
      const p = leadProposals.find(x => x.id === selectedProposalId)

      // Modality price
      const modId = p?.modality_id ?? p?.sections_data?.default_modality_id ?? null
      if (modId) {
        const { data: mod } = await supabase
          .from('venue_modalities')
          .select('id, name, duration_label, prices:venue_modality_prices(*), packages:venue_modality_packages(*, prices:venue_modality_prices(*))')
          .eq('id', modId)
          .maybeSingle()
        if (mod) {
          const basePrice = ((mod.prices ?? [])[0]?.price as number) ?? 0
          if (basePrice > 0) {
            concepts.push({ kind: 'modality', label: 'Alquiler · ' + mod.name + (mod.duration_label ? ` (${mod.duration_label})` : ''), qty: 1, unit_price: basePrice })
          }
          for (const pkg of (mod.packages ?? [])) {
            for (const pr of (pkg.prices ?? [])) {
              const v = parseFloat((pr as any).price) || 0
              if (v > 0) concepts.push({ kind: 'package', label: `${mod.name} — ${pkg.label || 'Paquete'}`, qty: 1, unit_price: v })
            }
          }
        }
      }

      // Menu selection
      const { data: menuSel } = await supabase
        .from('proposal_menu_selections')
        .select('*')
        .eq('proposal_id', selectedProposalId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (menuSel) {
        if (menuSel.selected_menu_name) {
          const perPerson = menuSel.estimated_total && menuSel.guest_count ? menuSel.estimated_total / menuSel.guest_count : 0
          concepts.push({ kind: 'menu', label: 'Menú · ' + menuSel.selected_menu_name, qty: menuSel.guest_count || 1, unit_price: Math.round(perPerson * 100) / 100 })
        }
        if (Array.isArray(menuSel.selected_extras)) {
          for (const ex of menuSel.selected_extras) {
            concepts.push({ kind: 'extra', label: 'Extra · ' + (ex.name || 'Sin nombre'), qty: ex.quantity || 1, unit_price: ex.price || 0 })
          }
        }
      }

      // Room selections (lodging)
      const { data: rooms } = await supabase
        .from('proposal_room_selections')
        .select('*, room:venue_room_types(name)')
        .eq('proposal_id', selectedProposalId)
      for (const r of (rooms ?? [])) {
        const nights = r.check_in && r.check_out
          ? Math.max(1, Math.round((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000))
          : 1
        const perUnit = r.computed_total && r.quantity ? r.computed_total / r.quantity / nights : 0
        concepts.push({
          kind: 'room',
          label: `Hab. · ${(r as any).room?.name || 'habitación'} × ${nights} noche(s)`,
          qty: r.quantity, unit_price: Math.round(perUnit * 100) / 100,
        })
      }

      setProposalConcepts(concepts)
    })()
  }, [selectedProposalId, leadProposals])

  // When selected proposal changes, sync config_id + modality_id + lodging_config_id from it
  useEffect(() => {
    if (!selectedProposalId) return
    const p = leadProposals.find(x => x.id === selectedProposalId)
    if (!p) return
    const modId = (p.modality_id ?? p.sections_data?.default_modality_id) ?? null
    if (p.commercial_config_id) setSelectedConfigId(p.commercial_config_id)
    if (modId) setSelectedModalityId(modId)
    if (p.lodging_config_id) setSelectedLodgingId(p.lodging_config_id)
  }, [selectedProposalId, leadProposals])

  const loadBudget = async () => {
    if (!activeVenue) return
    const supabase = createClient()
    const [{ data: b }, { data: t }, { data: m }, { data: v }, { data: br }, { data: ld }] = await Promise.all([
      supabase.from('budgets').select('*').eq('id', id).eq('venue_id', activeVenue.id).single(),
      supabase.from('budget_payment_templates').select('*').eq('venue_id', activeVenue.id).order('created_at'),
      supabase.from('venue_modalities').select('*, packages:venue_modality_packages(*, prices:venue_modality_prices(*))').eq('user_id', user!.id).order('sort_order'),
      supabase.from('venue_onboarding').select('name, logo_url, contact_email, contact_phone').eq('user_id', user!.id).maybeSingle(),
      supabase.from('proposal_branding').select('primary_color, logo_url, font_family').eq('user_id', user!.id).maybeSingle(),
      supabase.from('leads').select('id, name, email, phone, contact_type, client_id, wedding_date, guests').eq('venue_id', activeVenue.id).neq('status', 'lost').order('created_at', { ascending: false }),
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
    setSelectedConfigId((bud as any).commercial_config_id ?? null)
    setSelectedModalityId((bud as any).modality_id ?? null)
    setSelectedLodgingId((bud as any).lodging_config_id ?? null)
    setSelectedProposalId((bud as any).proposal_id ?? null)
    setBudgetName((bud as any).name ?? '')
    setBudgetDescription((bud as any).description ?? '')
    setDocumentNumber((bud as any).document_number ?? '')
    setIssueDate((bud as any).issue_date ?? '')
    setMessage((bud as any).message ?? '')
    setPassword(bud.password ?? '')
    setIncludesText(bud.includes_text ?? '')
    setLeadId(bud.lead_id)
    setCommissionPlannerId((bud as any).commission_planner_id ?? null)
    setCommissionPercent((bud as any).commission_percent ?? null)
    setCommissionMode(((bud as any).commission_mode as 'comisionable' | 'neto' | null) ?? null)
    if (t) setTemplates(t as PaymentTemplate[])
    if (m) setModalities(m)
    if (v) setVenue(v as any)
    if (br) setBranding(br as any)
    if (ld) setLeads(ld)

    // Load commercial configs (for sidebar picker)
    const { data: ccs } = await supabase
      .from('venue_commercial_configs')
      .select('*')
      .eq('venue_id', activeVenue.id)
      .order('sort_order')
    if (ccs) setAllConfigs(ccs)

    // Load contracts: those for this budget + all unlinked ones (for picker)
    const { data: linkedCtr } = await supabase.from('venue_contracts').select('id, contract_number, title, status').eq('budget_id', id).order('created_at', { ascending: false })
    setBudgetContracts(linkedCtr || [])
    const { data: allCtr } = await supabase.from('venue_contracts').select('id, contract_number, client_name, status').eq('user_id', user!.id).is('budget_id', null).order('created_at', { ascending: false }).limit(100)
    setAllContracts(allCtr || [])

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
    // Compute commission snapshot
    const commAmount = (commissionPercent && commissionMode && total)
      ? (commissionMode === 'neto'
          ? Math.round(total * (commissionPercent / 100) * 100) / 100
          : Math.round((total - total * (100 / (100 + commissionPercent))) * 100) / 100)
      : null
    const updatePayload: any = {
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
      includes_text: includesText || null,
      lead_id: leadId,
      commission_planner_id: commissionPlannerId,
      commission_percent: commissionPercent,
      commission_mode: commissionMode,
      commission_amount: commAmount,
      commercial_config_id: selectedConfigId,
      modality_id: selectedModalityId,
      lodging_config_id: selectedLodgingId,
      proposal_id: selectedProposalId,
      name: budgetName || null,
      description: budgetDescription || null,
      document_number: documentNumber || null,
      issue_date: issueDate || null,
      message: message || null,
      updated_at: new Date().toISOString(),
    }
    let { error: upErr } = await supabase.from('budgets').update(updatePayload).eq('id', budget.id)
    if (upErr && upErr.code === '42703') {
      // Strip unknown columns and retry (in case migration not applied)
      const { commercial_config_id: _c, modality_id: _m, lodging_config_id: _l, name: _n, description: _d, document_number: _dn, issue_date: _id, message: _msg, proposal_id: _p, ...rest } = updatePayload
      await supabase.from('budgets').update(rest).eq('id', budget.id)
    }
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [budget, coupleName, coupleEmail, weddingDate, guestCount, notes, validUntil, groups, paymentPlan, total, taxRate, taxIncluded, discountType, discountAmount, discountLabel, password, includesText, leadId, commissionPlannerId, commissionPercent, commissionMode, selectedConfigId, selectedModalityId, selectedLodgingId, budgetName, budgetDescription, documentNumber, issueDate, message, selectedProposalId])

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (!budget || loading) return
    const t = setTimeout(() => { saveBudget() }, 1500)
    return () => clearTimeout(t)
  }, [coupleName, coupleEmail, weddingDate, guestCount, notes, validUntil, groups, paymentPlan, taxRate, taxIncluded, discountType, discountAmount, discountLabel, password, includesText, leadId, commissionPlannerId, commissionPercent, commissionMode])

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
    // Auto-fill commission if linked client is wedding planner/organizer
    if (lead.client_id) {
      const supabase2 = createClient()
      const { data: c } = await supabase2
        .from('clients')
        .select('id, client_type, wp_commission_percent, wp_commission_mode')
        .eq('id', lead.client_id)
        .maybeSingle()
      if (c && (c.client_type === 'wedding_planner' || c.client_type === 'organizador') && c.wp_commission_percent != null) {
        setCommissionPlannerId(c.id)
        setCommissionPercent(c.wp_commission_percent)
        setCommissionMode((c.wp_commission_mode as 'comisionable' | 'neto' | null) || 'comisionable')
      } else {
        setCommissionPlannerId(null); setCommissionPercent(null); setCommissionMode(null)
      }
    } else {
      setCommissionPlannerId(null); setCommissionPercent(null); setCommissionMode(null)
    }
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
    navigator.clipboard.writeText(`${window.location.origin}/budget/${budget.slug}`)
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
                {saving && <span style={{ color: '#8A6A38', marginLeft: 6 }}>· guardando…</span>}
                {saved && !saving && <span style={{ color: '#4A6B52', marginLeft: 6 }}>· guardado</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={copyUrl}
              title="Copiar URL pública"
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: linkCopied ? '#4A6B52' : 'var(--warm-gray)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}
            >
              {linkCopied ? <><Check size={12} /> Copiado</> : <><Link2 size={12} /> URL</>}
            </button>
            <a
              href={`/budget/${budget.slug}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir en nueva pestaña"
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--warm-gray)', display: 'inline-flex', alignItems: 'center', fontSize: 11, textDecoration: 'none' }}
            >
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Sidebar tabs */}
        <div style={{ flexShrink: 0, display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          {([
            { key: 'general',   label: 'General' },
            { key: 'config',    label: 'Config' },
            { key: 'conceptos', label: 'Conceptos' },
            { key: 'pagos',     label: 'Pagos' },
            { key: 'detalles',  label: 'Detalles' },
          ] as const).map(t => {
            const active = sidebarTab === t.key
            return (
              <button key={t.key} type="button" onClick={() => setSidebarTab(t.key)}
                style={{
                  flex: 1, padding: '9px 6px', background: 'none', border: 'none',
                  borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
                  marginBottom: -1, cursor: 'pointer',
                  fontSize: 11.5, fontWeight: active ? 700 : 500,
                  color: active ? 'var(--espresso)' : 'var(--warm-gray)',
                  textTransform: 'capitalize', letterSpacing: '0.02em',
                  transition: 'color .15s, border-color .15s',
                  fontFamily: 'Inter, sans-serif',
                }}>
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Scrollable form body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>

          {/* ── GENERAL tab ────────────────────────────────────── */}
          {sidebarTab === 'general' && <>
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

          {/* ── Propuesta vinculada (cuando lead tiene varias) ── */}
          {leadId && leadProposals.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Propuesta vinculada {leadProposals.length > 1 && <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--gold)' }}>· {leadProposals.length} propuestas</span>}
              </div>
              <Select value={selectedProposalId ?? '__none'} onValueChange={(v) => setSelectedProposalId(v === '__none' ? null : v)}>
                <SelectTrigger style={{ fontSize: 12 }}><SelectValue placeholder="Sin propuesta vinculada" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sin propuesta vinculada</SelectItem>
                  {leadProposals.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.couple_name || 'Propuesta'} · {new Date(p.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProposalId && (
                <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 4, lineHeight: 1.4 }}>
                  Esta propuesta se usa para importar conceptos y heredar configuración comercial.
                </div>
              )}
            </div>
          )}

          </>}
          {/* ── CONFIG tab ─────────────────────────────────────── */}
          {sidebarTab === 'config' && <>
          {/* ── Configuración comercial heredada de la propuesta ── */}
          {(() => {
            const spaceConfigs   = allConfigs.filter(c => (c.config_type ?? 'space') === 'space')
            const lodgingConfigs = allConfigs.filter(c => c.config_type === 'lodging')
            const configMods = modalities.filter((m: any) => m.commercial_config_id === selectedConfigId)
            return (
              <div style={{ marginBottom: 18, padding: '12px 14px', background: '#fff', border: '1.5px solid rgba(74,107,82,0.20)', borderRadius: 10, boxShadow: '0 1px 3px rgba(20,30,22,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <FileText size={13} style={{ color: 'var(--gold)' }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--espresso)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Config. del presupuesto</div>
                </div>
                {allConfigs.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', padding: '8px 0', lineHeight: 1.5 }}>
                    Sin configuraciones comerciales todavía. Crea una en <a href="/venue-settings" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>Configuración</a> para vincularla a este presupuesto.
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: allConfigs.length === 0 ? 0.5 : 1, pointerEvents: allConfigs.length === 0 ? 'none' : 'auto' }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600, display: 'block', marginBottom: 3 }}>Configuración comercial</label>
                    <Select value={selectedConfigId ?? '__none'} onValueChange={(v) => { setSelectedConfigId(v === '__none' ? null : v); setSelectedModalityId(null) }}>
                      <SelectTrigger style={{ fontSize: 12 }}><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Sin asignar</SelectItem>
                        {spaceConfigs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedConfigId && (
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600, display: 'block', marginBottom: 3 }}>Modalidad</label>
                      <Select value={selectedModalityId ?? '__none'} onValueChange={(v) => setSelectedModalityId(v === '__none' ? null : v)}>
                        <SelectTrigger style={{ fontSize: 12 }}><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Sin asignar</SelectItem>
                          {configMods.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}{m.duration_label ? ` · ${m.duration_label}` : ''}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {lodgingConfigs.length > 0 && (
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600, display: 'block', marginBottom: 3 }}>Alojamiento</label>
                      <Select value={selectedLodgingId ?? '__none'} onValueChange={(v) => setSelectedLodgingId(v === '__none' ? null : v)}>
                        <SelectTrigger style={{ fontSize: 12 }}><SelectValue placeholder="Sin alojamiento" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Sin alojamiento</SelectItem>
                          {lodgingConfigs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          </>}
          {/* ── GENERAL tab (cont. — comisión + datos pareja) ─── */}
          {sidebarTab === 'general' && <>
          {/* ── Comisión wedding planner / organizador ────────── */}
          {(commissionPlannerId || (leadId && (() => {
            const l = leads.find(x => x.id === leadId)
            return l?.contact_type === 'wedding_planner' || l?.contact_type === 'event_organizer'
          })())) && (
            <div style={{ marginBottom: 16, padding: 12, border: '1px solid var(--ivory)', borderRadius: 8, background: 'var(--cream)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comisión planner / organizador</div>
                <button type="button" onClick={() => setShowCommissionAsClient(v => !v)} style={{ fontSize: 10, padding: '3px 8px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 5, background: '#fff', cursor: 'pointer', color: 'var(--warm-gray)' }}>
                  {showCommissionAsClient ? 'Ver neto' : 'Ver con comisión'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>% Comisión</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={commissionPercent ?? ''}
                    onChange={e => setCommissionPercent(e.target.value === '' ? null : Number(e.target.value))}
                    placeholder="10"
                    style={{ fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Modo</label>
                  <Select
                    value={commissionMode ?? 'none'}
                    onValueChange={(v) => setCommissionMode((v === 'none' ? null : v) as 'comisionable' | 'neto' | null)}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="comisionable">Comisionable</SelectItem>
                      <SelectItem value="neto">Neto (suma encima)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {commissionPercent && commissionMode && (
                <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 8, lineHeight: 1.5 }}>
                  {commissionMode === 'neto'
                    ? `Precios al cliente = neto × ${(1 + commissionPercent / 100).toFixed(4)}. Comisión añadida automáticamente.`
                    : `Precios al cliente ya incluyen el ${commissionPercent}% de comisión.`}
                </div>
              )}
            </div>
          )}

          {/* ── Datos de la pareja ─────────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Datos del cliente</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Titulo / Nombre del cliente</label>
                <input className="form-input" value={coupleName} onChange={e => setCoupleName(e.target.value)} placeholder="Ej: Laura y Carlos, Boda Laura, Cena corporativa..." />
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

          </>}
          {/* ── CONCEPTOS tab ──────────────────────────────────── */}
          {sidebarTab === 'conceptos' && <>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 72px 50px 80px 24px', gap: 4, padding: '4px 10px', fontSize: 9, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--ivory)' }}>
                  <span>Concepto</span><span style={{ textAlign: 'center' }}>Uds</span><span style={{ textAlign: 'right' }}>€/ud</span><span style={{ textAlign: 'center' }}>IVA</span><span style={{ textAlign: 'right' }}>Total</span><span />
                </div>
                {/* Items */}
                {g.items.map(item => (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 44px 72px 50px 80px 24px', gap: 4, padding: '4px 10px', alignItems: 'center', borderBottom: '1px solid var(--ivory)' }}>
                    <input value={item.concept} onChange={e => updateItem(g.id, item.id, 'concept', e.target.value)} className="form-input" style={{ border: 'none', padding: '3px 0', fontSize: 12 }} placeholder="Concepto" />
                    <input type="number" min={0} value={item.qty} onChange={e => updateItem(g.id, item.id, 'qty', Number(e.target.value))} className="form-input" style={{ border: 'none', padding: '3px', fontSize: 12, textAlign: 'center' }} />
                    <input type="number" min={0} step={0.01} value={item.unit_price} onChange={e => updateItem(g.id, item.id, 'unit_price', Number(e.target.value))} className="form-input" style={{ border: 'none', padding: '3px', fontSize: 12, textAlign: 'right' }} />
                    <input
                      type="number" min={0} max={100} step={1}
                      value={item.tax_rate ?? ''}
                      onChange={e => updateItem(g.id, item.id, 'tax_rate' as any, e.target.value === '' ? null : Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                      placeholder={taxRate?.toString() ?? '21'}
                      title={`Si vacío → usa IVA global (${taxRate}%)`}
                      className="form-input"
                      style={{ border: 'none', padding: '3px', fontSize: 11, textAlign: 'center', color: item.tax_rate != null ? 'var(--gold)' : 'var(--warm-gray)' }}
                    />
                    <div style={{ fontSize: 12, fontWeight: 500, textAlign: 'right', color: 'var(--charcoal)' }}>{item.subtotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
                    <button onClick={() => removeItem(g.id, item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: 1 }}><X size={11} /></button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, padding: '6px 10px' }}>
                  <button onClick={() => addItem(g.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--gold)' }}>
                    <Plus size={11} /> Concepto manual
                  </button>
                  {selectedProposalId && (
                    <button onClick={() => setShowConceptPicker(g.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--gold)' }}>
                      <FileText size={11} /> Desde propuesta
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── Descuento + IVA ──────────────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Descuento e IVA</div>
            {/* Discount */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <div style={{ width: 110 }}>
                  <Select value={discountType ?? 'none'} onValueChange={(v) => setDiscountType(v === 'none' ? null : (v as any))}>
                    <SelectTrigger><SelectValue placeholder="Sin descuento" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin descuento</SelectItem>
                      <SelectItem value="fixed">Fijo (€)</SelectItem>
                      <SelectItem value="percent">Porcentaje (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#4A6B52', marginBottom: 4 }}>
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

          </>}
          {/* ── PAGOS tab ──────────────────────────────────────── */}
          {sidebarTab === 'pagos' && <>
          {/* ── Plan de pagos ──────────────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plan de pagos</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {templates.length > 0 && (
                  <div style={{ width: 150 }}>
                    <Select value="" onValueChange={(v) => {
                      const t = templates.find(t => t.id === v)
                      if (t) applyTpl(t)
                    }}>
                      <SelectTrigger><SelectValue placeholder="Plantilla..." /></SelectTrigger>
                      <SelectContent>
                        {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
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
                  <div key={i} style={{ borderBottom: '1px solid var(--ivory)', padding: '6px 0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 70px 24px', gap: 0, alignItems: 'center' }}>
                      <input value={p.label} onChange={e => updatePayment(i, 'label', e.target.value)} className="form-input" style={{ border: 'none', padding: '3px 0', fontSize: 12 }} placeholder="Cuota" />
                      <input type="number" min={0} step={0.01} value={p.amount} onChange={e => updatePayment(i, 'amount', Number(e.target.value))} className="form-input" style={{ border: 'none', padding: '3px', fontSize: 12, textAlign: 'right' }} />
                      <DatePicker value={p.due_date} onChange={(v) => updatePayment(i, 'due_date', v)} placeholder="dd/mm/aaaa" />
                      <Select value={p.status} onValueChange={(v) => updatePayment(i, 'status', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pend.</SelectItem>
                          <SelectItem value="paid">Pagado</SelectItem>
                        </SelectContent>
                      </Select>
                      <button onClick={() => removePayment(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: 1 }}><X size={11} /></button>
                    </div>
                    {/* Refundable toggle + deadline */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2, marginTop: 3 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--warm-gray)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={p.refundable ?? false}
                          onChange={e => updatePayment(i, 'refundable', e.target.checked)}
                          style={{ width: 12, height: 12 }}
                        />
                        Reembolsable
                      </label>
                      {p.refundable && (
                        <>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--warm-gray)' }}>
                            hasta
                            <DatePicker
                              value={p.refund_deadline || ''}
                              onChange={(v) => updatePayment(i, 'refund_deadline', v)}
                              placeholder="dd/mm/aaaa"
                            />
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--warm-gray)' }}>
                            hasta
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={p.refund_percent ?? ''}
                              onChange={(e) => updatePayment(i, 'refund_percent', e.target.value === '' ? undefined : Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                              placeholder="100"
                              style={{
                                width: 48, padding: '3px 5px', fontSize: 10, border: '1px solid var(--ivory)',
                                borderRadius: 4, textAlign: 'right', outline: 'none',
                              }}
                              title="Porcentaje máximo reembolsable (0-100)"
                            />
                            %
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6, fontSize: 11, fontWeight: 600, color: Math.abs(paymentTotal - total) < 0.01 ? '#4A6B52' : 'var(--rose)' }}>
                  Suma: {paymentTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} {Math.abs(paymentTotal - total) >= 0.01 && `(dif: ${(paymentTotal - total).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })})`}
                </div>
              </>
            )}
          </div>

          </>}
          {/* ── CONCEPTOS tab (cont. — respuestas dosier) ─────── */}
          {sidebarTab === 'conceptos' && <>
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
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--ivory)' }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 65 }}>Visita</span>
                          <span style={{ fontSize: 11 }}>
                            {(d.visit_request as any)?.date ? new Date((d.visit_request as any).date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}
                            {(d.visit_request as any)?.time ? ` a las ${(d.visit_request as any).time}` : ''}
                          </span>
                        </div>
                        {Array.isArray((d.visit_request as any)?.selected_spaces) && (d.visit_request as any).selected_spaces.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 65 }}>Espacios</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                              {(d.visit_request as any).selected_spaces.map((s: any, i: number) => (
                                <span key={i} style={{ fontSize: 10, background: 'var(--ivory)', padding: '1px 6px', borderRadius: 4 }}>
                                  {[s.group_name, s.space_name].filter(Boolean).join(': ')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {Array.isArray((d.visit_request as any)?.selected_menus) && (d.visit_request as any).selected_menus.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 65 }}>Menús</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                              {(d.visit_request as any).selected_menus.map((m: string, i: number) => (
                                <span key={i} style={{ fontSize: 10, background: 'var(--ivory)', padding: '1px 6px', borderRadius: 4 }}>{m}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(d.visit_request as any)?.message && (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 65 }}>Mensaje</span>
                            <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)' }}>{(d.visit_request as any).message}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          </>}
          {/* ── DETALLES tab ───────────────────────────────────── */}
          {sidebarTab === 'detalles' && <>
          {/* ── Nombre + nº documento + fecha emisión ─────────── */}
          <div style={{ marginBottom: 18, padding: '12px 14px', background: '#fff', border: '1px solid var(--ivory)', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <FileText size={12} style={{ color: 'var(--gold)' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datos del presupuesto</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600, display: 'block', marginBottom: 3 }}>Nombre del presupuesto</label>
                <input value={budgetName} onChange={e => setBudgetName(e.target.value)} placeholder="Ej: Boda finca 12 jun 2026" className="form-input" style={{ fontSize: 12, padding: '6px 10px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600, display: 'block', marginBottom: 3 }}>Nº documento</label>
                  <input value={documentNumber} onChange={e => setDocumentNumber(e.target.value)} placeholder="PRE-2025-001" className="form-input" style={{ fontSize: 12, padding: '6px 10px' }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600, display: 'block', marginBottom: 3 }}>Fecha emisión</label>
                  <DatePicker value={issueDate} onChange={setIssueDate} placeholder="dd/mm/aaaa" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600, display: 'block', marginBottom: 3 }}>Descripción interna</label>
                <textarea value={budgetDescription} onChange={e => setBudgetDescription(e.target.value)} rows={2} placeholder="Notas internas no visibles al cliente" className="form-input" style={{ fontSize: 12, padding: '6px 10px', resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600, display: 'block', marginBottom: 3 }}>Mensaje al cliente</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Mensaje personalizado que verá el cliente en el presupuesto" className="form-input" style={{ fontSize: 12, padding: '6px 10px', resize: 'vertical' }} />
              </div>
            </div>
          </div>

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
                <DatePicker value={validUntil} onChange={(v) => setValidUntil(v)} placeholder="dd/mm/aaaa" />
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

          {/* ── Qué incluye ─────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">¿Qué incluye tu presupuesto?</label>
              <textarea
                className="form-input"
                rows={4}
                value={includesText}
                onChange={e => setIncludesText(e.target.value)}
                placeholder="Ej: Cocktail de bienvenida, menú degustación, barra libre 5h, coordinador del evento, montaje y desmontaje..."
                style={{ resize: 'vertical', fontSize: 12 }}
              />
              <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 4 }}>Visible en la pestaña "Espacio" del presupuesto público.</div>
            </div>
          </div>

          {/* ── Contrato ─────────────────── */}
          <div style={{ marginBottom: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Contrato</div>

            {/* Linked contracts */}
            {budgetContracts.length > 0 && (
              <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {budgetContracts.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <ScrollText size={13} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--espresso)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || c.contract_number}</div>
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{c.contract_number} · {c.status}</div>
                    </div>
                    <button onClick={() => router.push(`/contratos/${c.id}`)} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 10 }}>Ver</button>
                    <button
                      onClick={async () => {
                        if (!confirm('¿Desvincular este contrato del presupuesto?')) return
                        const supabase = createClient()
                        await supabase.from('venue_contracts').update({ budget_id: null }).eq('id', c.id)
                        setBudgetContracts(prev => prev.filter(x => x.id !== c.id))
                      }}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '4px 6px', fontSize: 10, color: 'var(--burgundy)' }}
                      title="Desvincular"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                onClick={async () => {
                  await saveBudget()
                  router.push(`/contratos/nuevo?budget_id=${id}&lead_id=${leadId || ''}`)
                }}
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', border: '1px dashed var(--border)', borderRadius: 8 }}
              >
                <Plus size={13} /> Crear contrato
              </button>

              {allContracts.length > 0 && (
                <>
                  <button
                    onClick={() => setShowContractPicker(s => !s)}
                    className="btn btn-ghost btn-sm"
                    style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 11 }}
                  >
                    <Link2 size={12} /> Asociar contrato existente
                  </button>
                  {showContractPicker && (
                    <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, background: 'white' }}>
                      {allContracts.map(c => (
                        <button
                          key={c.id}
                          onClick={async () => {
                            const supabase = createClient()
                            await supabase.from('venue_contracts').update({ budget_id: id, lead_id: leadId || null }).eq('id', c.id)
                            setBudgetContracts(prev => [{ id: c.id, contract_number: c.contract_number, title: c.client_name, status: c.status }, ...prev])
                            setAllContracts(prev => prev.filter(x => x.id !== c.id))
                            setShowContractPicker(false)
                          }}
                          style={{ width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid var(--ivory)', fontSize: 11 }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ fontWeight: 600, color: 'var(--espresso)' }}>{c.client_name}</div>
                          <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{c.contract_number} · {c.status}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          </>}

        </div>

        {/* Concept picker modal — import items from selected proposal */}
        {showConceptPicker && (
          <div onClick={() => setShowConceptPicker(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,22,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(20,30,22,0.25)' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--espresso)' }}>Importar concepto de propuesta</div>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>Selecciona uno o varios items de la propuesta</div>
                </div>
                <button onClick={() => setShowConceptPicker(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}><X size={16} /></button>
              </div>
              <div style={{ overflowY: 'auto', padding: 12, flex: 1 }}>
                {proposalConcepts.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 12 }}>
                    La propuesta no tiene conceptos importables. Añade manualmente o configura la propuesta.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {proposalConcepts.map((c, i) => (
                      <button key={i}
                        onClick={() => {
                          setGroups(prev => prev.map(gr => gr.id === showConceptPicker
                            ? { ...gr, items: [...gr.items, { id: nanoid(), concept: c.label, qty: c.qty, unit_price: c.unit_price, subtotal: c.qty * c.unit_price }] }
                            : gr))
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--ivory)', borderRadius: 8, background: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all .12s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.background = 'var(--cream)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ivory)'; e.currentTarget.style.background = '#fff' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'var(--cream)', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '.05em', flexShrink: 0 }}>{c.kind}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--espresso)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{c.qty} × {c.unit_price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--espresso)', flexShrink: 0 }}>
                          {(c.qty * c.unit_price).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: '10px 18px', borderTop: '1px solid var(--ivory)', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowConceptPicker(null)} className="btn btn-ghost btn-sm">Cerrar</button>
              </div>
            </div>
          </div>
        )}

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
          budget={(showCommissionAsClient && commissionPercent && commissionMode === 'neto'
            ? applyCommissionToBudget({ ...previewBudget, commission_percent: commissionPercent, commission_mode: commissionMode } as any)
            : previewBudget) as any}
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

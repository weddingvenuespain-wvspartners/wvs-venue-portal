'use client'
import { useEffect, useState, useMemo, useRef } from 'react'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { usePlanFeatures } from '@/lib/use-plan-features'
import {
  Plus, Search, X, Phone, Mail, MessageCircle,
  Calendar, Users, ChevronLeft, ChevronRight, RotateCcw, CheckCircle,
  ExternalLink, Edit2, Trash2, Clock, Filter, FileText, Download,
  AlertTriangle, PartyPopper, Snowflake, Sparkles, Eye, Landmark, XCircle,
  Sprout, Sun, Leaf, Zap, LockKeyhole, OctagonAlert, Flower2, Info,
  List, LayoutGrid, Receipt, ChevronDown, ChevronUp, Paperclip, Upload, CheckCircle2, CalendarDays,
} from 'lucide-react'

// ── Types & config ─────────────────────────────────────────────────────────────
type DbStatus = 'new' | 'contacted' | 'proposal_sent' | 'visit_scheduled' | 'post_visit' | 'budget_sent' | 'won' | 'lost'
type Tab      = 'new' | 'en_seguimiento' | 'visit' | 'budget' | 'confirmed' | 'lost'

const TAB_STATUSES: Record<Tab, DbStatus[]> = {
  new:            ['new'],
  en_seguimiento: ['contacted', 'proposal_sent'],
  visit:          ['visit_scheduled', 'post_visit'],  // merged
  budget:         ['budget_sent'],
  confirmed:      ['won'],
  lost:           ['lost'],
}

const TABS: { key: Tab; label: string; emoji: React.ReactNode }[] = [
  { key: 'new',            label: 'Nuevos',         emoji: <Sparkles size={13} /> },
  { key: 'en_seguimiento', label: 'En seguimiento', emoji: <Eye size={13} /> },
  { key: 'visit',          label: 'Visita',         emoji: <Landmark size={13} /> },
  { key: 'budget',         label: 'Presupuesto',    emoji: <FileText size={13} /> },
  { key: 'confirmed',      label: 'Confirmados',    emoji: <PartyPopper size={13} /> },
  { key: 'lost',           label: 'Perdidos',       emoji: <XCircle size={13} /> },
]

const SUB_STATUS_LABEL: Record<DbStatus, string> = {
  new: 'Nuevo', contacted: 'Contactado', proposal_sent: 'Propuesta enviada',
  visit_scheduled: 'Visita agendada', post_visit: 'Post-visita',
  budget_sent: 'Presupuesto enviado', won: 'Confirmado', lost: 'Perdido',
}
const SOURCE_LABEL: Record<string, string> = {
  web: 'Web', whatsapp: 'WhatsApp', instagram: 'Instagram',
  email: 'Email', referral: 'Referido', manual: 'Manual', other: 'Otro',
  wedding_planner: 'Planner',
}
const BUDGET_LABEL: Record<string, string> = {
  sin_definir: '—',
  menos_10k:   '< 10k€',
  '10k_15k':   '10–15k€',
  '15k_20k':   '15–20k€',
  '20k_25k':   '20–25k€',
  '25k_30k':   '25–30k€',
  '30k_40k':   '30–40k€',
  '40k_50k':   '40–50k€',
  '50k_75k':   '50–75k€',
  '75k_100k':  '75–100k€',
  mas_100k:    '> 100k€',
  // legacy values — keep for backwards compat
  menos_20k: '< 20k€', '20k_35k': '20–35k€', '35k_50k': '35–50k€', mas_50k: '> 50k€',
}
const BUDGET_OPTS = [
  'sin_definir',
  'menos_10k', '10k_15k', '15k_20k', '20k_25k', '25k_30k',
  '30k_40k', '40k_50k', '50k_75k', '75k_100k', 'mas_100k',
]
const CEREMONY_LABEL: Record<string, string> = {
  sin_definir: '—', civil: 'Civil', religiosa: 'Religiosa', simbolica: 'Simbólica',
}
const MONTHS     = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_SHORT = ['L','M','X','J','V','S','D']

const DATE_FLEX_OPTS = [
  { value: 'exact',        label: 'Fecha exacta'   },
  { value: 'range',        label: 'Rango'           },
  { value: 'multi_range',  label: 'Varios rangos'   },
  { value: 'month',        label: 'Mes'             },
  { value: 'season',       label: 'Estación'        },
  { value: 'flexible',     label: 'Flexible'        },
]
const SEASONS: { value: string; label: string; emoji: React.ReactNode }[] = [
  { value: 'spring', label: 'Primavera', emoji: <Sprout size={13} /> },
  { value: 'summer', label: 'Verano',    emoji: <Sun size={13} /> },
  { value: 'autumn', label: 'Otoño',     emoji: <Leaf size={13} /> },
  { value: 'winter', label: 'Invierno',  emoji: <Snowflake size={13} /> },
]
const YEAR_OPTS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + i)

function pad(n: number) { return String(n).padStart(2,'0') }
function toIso(y: number, m: number, d: number) { return `${y}-${pad(m+1)}-${pad(d)}` }
function todayIso() {
  const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`
}
function shiftDateBy(d: string, days: number) {
  const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + days)
  return dt.toISOString().slice(0, 10)
}
// Expand anchor dates with venue rules to get the full set of dates to block
function expandAnchorsWithRules(anchors: string[], rules: any): string[] {
  const all = new Set<string>(anchors)
  if (!rules) return Array.from(all).sort()
  if (rules.type === 'overnight') {
    const db = Math.ceil(rules.days_before || 0)
    const da = Math.ceil(rules.days_after  || 0)
    anchors.forEach(a => {
      for (let i = db; i >= 1; i--) all.add(shiftDateBy(a, -i))
      const d2 = shiftDateBy(a, 1)
      all.add(d2)
      for (let i = 1; i <= da; i++) all.add(shiftDateBy(d2, i))
    })
  } else if (rules.type === 'simple') {
    const db = Math.ceil(rules.days_before || 0)
    const da = Math.ceil(rules.days_after  || 0)
    anchors.forEach(a => {
      for (let i = db; i >= 1; i--) all.add(shiftDateBy(a, -i))
      for (let i = 1; i <= da; i++) all.add(shiftDateBy(a, i))
    })
  } else if (rules.type === 'packages') {
    anchors.forEach(a => {
      const dow = new Date(a + 'T12:00:00').getDay()
      const pkg = rules.packages?.find((p: any) => p.anchor_dow === dow)
      if (pkg) {
        const db = Math.ceil(pkg.days_before || 0)
        const da = Math.ceil(pkg.days_after  || 0)
        for (let i = db; i >= 1; i--) all.add(shiftDateBy(a, -i))
        for (let i = 1; i < pkg.span_days; i++) all.add(shiftDateBy(a, i))
        for (let i = 0; i < da; i++) all.add(shiftDateBy(a, pkg.span_days + i))
      }
    })
  }
  return Array.from(all).sort()
}

// Returns the set of dates that are HALF-DAY buffers (days_before/after with .5 fractional)
// These need special visual treatment in the calendar
function computeHalfDayBuffers(anchors: string[], rules: any): Set<string> {
  const halfs = new Set<string>()
  if (!rules || anchors.length === 0) return halfs
  const addHalf = (base: string, offset: number) => halfs.add(shiftDateBy(base, offset))
  if (rules.type === 'overnight') {
    const anchor = rules.overnight_anchor ?? 'first'
    const da = rules.days_after  || 0
    const db = rules.days_before || 0
    const da_full = Math.floor(da); const da_half = (da * 2) % 2 !== 0
    const db_full = Math.floor(db); const db_half = (db * 2) % 2 !== 0
    anchors.forEach(a => {
      if (anchor === 'first') {
        // d2 = a+1; desmontaje after d2; preparación before a
        if (da_half) addHalf(a, 1 + da_full + 1)   // d2 + full days + 1
        if (db_half) addHalf(a, -(db_full + 1))
      } else {
        // d1 = a-1; desmontaje after a; preparación before d1
        if (da_half) addHalf(a, da_full + 1)
        if (db_half) addHalf(a, -(1 + db_full + 1))
      }
    })
  } else if (rules.type === 'simple') {
    const da = rules.days_after  || 0
    const db = rules.days_before || 0
    const da_full = Math.floor(da); const da_half = (da * 2) % 2 !== 0
    const db_full = Math.floor(db); const db_half = (db * 2) % 2 !== 0
    anchors.forEach(a => {
      if (da_half) addHalf(a, da_full + 1)
      if (db_half) addHalf(a, -(db_full + 1))
    })
  } else if (rules.type === 'packages') {
    anchors.forEach(a => {
      const dow = new Date(a + 'T12:00:00').getDay()
      const pkg = rules.packages?.find((p: any) => p.anchor_dow === dow)
      if (pkg) {
        const da = pkg.days_after  || 0
        const db = pkg.days_before || 0
        const da_full = Math.floor(da); const da_half = (da * 2) % 2 !== 0
        const db_full = Math.floor(db); const db_half = (db * 2) % 2 !== 0
        if (da_half) addHalf(a, pkg.span_days + da_full)
        if (db_half) addHalf(a, -(db_full + 1))
      }
    })
  }
  return halfs
}

// Format the lead date for display
function formatLeadDate(lead: any): { line1: string; line2?: React.ReactNode; color?: string } {
  // For budget_sent leads, show confirmed budget dates if available
  if (lead.status === 'budget_sent' && (lead.budget_date || lead.budget_date_ranges?.length)) {
    lead = {
      ...lead,
      date_flexibility: lead.budget_date_flexibility || 'exact',
      wedding_date: lead.budget_date,
      wedding_date_to: lead.budget_date_to,
      wedding_date_ranges: lead.budget_date_ranges,
    }
  }
  const flex = lead.date_flexibility || 'exact'
  const fmtShort = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  const fmtNoYear = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '?'
  switch (flex) {
    case 'range':
      return { line1: `${fmtNoYear(lead.wedding_date)} – ${fmtShort(lead.wedding_date_to)}` }
    case 'multi_range': {
      const ranges: { from: string; to: string }[] = lead.wedding_date_ranges || []
      if (!ranges.length) return { line1: 'Varios rangos', color: 'var(--warm-gray)' }
      const first = ranges[0]
      const rest  = ranges.length > 1 ? ` +${ranges.length - 1} más` : ''
      return { line1: `${fmtNoYear(first.from)} – ${fmtNoYear(first.to)}${rest}` }
    }
    case 'month':
      return { line1: `${MONTHS[(lead.wedding_month || 1) - 1]} ${lead.wedding_year || ''}` }
    case 'season': {
      const s = SEASONS.find(x => x.value === lead.wedding_season)
      return { line1: `${s?.emoji || ''} ${s?.label || ''} ${lead.wedding_year || ''}` }
    }
    case 'flexible':
      return { line1: 'Fecha flexible', color: 'var(--warm-gray)' }
    default: // exact
      if (!lead.wedding_date) return { line1: 'Sin fecha', color: 'var(--stone)' }
      const days = Math.ceil((new Date(lead.wedding_date + 'T12:00:00').getTime() - Date.now()) / 86400000)
      const color = days < 0 ? 'var(--warm-gray)' : days < 60 ? 'var(--rose)' : days < 120 ? 'var(--gold)' : 'var(--sage)'
      return { line1: fmtShort(lead.wedding_date), line2: days > 0 ? <>{days < 60 ? <><Zap size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}</> : ''}{days} días</> : undefined, color }
  }
}

// Is this lead's date in the past?
function isLeadDatePast(lead: any): boolean {
  const today = todayIso()
  const flex  = lead.date_flexibility || 'exact'
  switch (flex) {
    case 'exact':
      return !!lead.wedding_date && lead.wedding_date < today
    case 'range':
      return !!(lead.wedding_date_to || lead.wedding_date) && (lead.wedding_date_to || lead.wedding_date) < today
    case 'multi_range': {
      const ranges: { from: string; to: string }[] = lead.wedding_date_ranges || []
      if (!ranges.length) return false
      // past only if ALL ranges are in the past
      return ranges.every(r => (r.to || r.from) < today)
    }
    case 'month':
      if (!lead.wedding_year || !lead.wedding_month) return false
      return `${lead.wedding_year}-${pad(lead.wedding_month)}-28` < today
    case 'season': {
      if (!lead.wedding_year || !lead.wedding_season) return false
      const ends: Record<string, string> = {
        spring: `${lead.wedding_year}-06-21`,
        summer: `${lead.wedding_year}-09-22`,
        autumn: `${lead.wedding_year}-12-21`,
        winter: `${lead.wedding_year + 1}-03-20`,
      }
      return (ends[lead.wedding_season] || '') < today
    }
    default: return false
  }
}

function urgencyColor(days: number | null) {
  if (days === null || days < 0) return 'var(--warm-gray)'
  if (days < 60) return 'var(--rose)'
  if (days < 120) return 'var(--gold)'
  return 'var(--sage)'
}

function formatDateLabel(ds: string): string {
  if (!ds) return '—'
  return new Date(ds + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getLeadFirstDate(lead: any): string | null {
  const flex = lead.date_flexibility || 'exact'
  if (flex === 'exact' || flex === 'range') return lead.wedding_date || null
  if (flex === 'multi_range') return lead.wedding_date_ranges?.[0]?.from || null
  if (flex === 'month' && lead.wedding_year && lead.wedding_month)
    return `${lead.wedding_year}-${pad(lead.wedding_month)}-01`
  return null
}

function expandLeadDates(lead: any): string[] {
  const flex = lead.date_flexibility || 'exact'
  const addRange = (from: string, to: string): string[] => {
    const result: string[] = []
    const d = new Date(from + 'T12:00:00')
    const end = new Date((to || from) + 'T12:00:00')
    while (d <= end) { result.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1) }
    return result
  }
  if (flex === 'exact') return lead.wedding_date ? [lead.wedding_date] : []
  if (flex === 'range' && lead.wedding_date)
    return addRange(lead.wedding_date, lead.wedding_date_to || lead.wedding_date)
  if (flex === 'multi_range')
    return (lead.wedding_date_ranges || []).flatMap((r: any) => r.from ? addRange(r.from, r.to || r.from) : [])
  return []
}

function expandBudgetDates(lead: any): string[] {
  const flex = lead.budget_date_flexibility || 'exact'
  const addRange = (from: string, to: string): string[] => {
    const result: string[] = []
    const d = new Date(from + 'T12:00:00')
    const end = new Date((to || from) + 'T12:00:00')
    while (d <= end) { result.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1) }
    return result
  }
  if (flex === 'exact') return lead.budget_date ? [lead.budget_date] : []
  if (flex === 'range' && lead.budget_date)
    return addRange(lead.budget_date, lead.budget_date_to || lead.budget_date)
  if (flex === 'multi_range')
    return (lead.budget_date_ranges || []).flatMap((r: any) => r.from ? addRange(r.from, r.to || r.from) : [])
  return []
}

const CAL_AVAIL_CFG: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  libre:       { bg: '#fff',    border: '#e5e7eb', dot: '#d1fae5', label: 'Libre' },
  negociacion: { bg: '#fef9ec', border: '#fde68a', dot: '#f59e0b', label: 'En negociación' },
  reservado:   { bg: '#fee2e2', border: '#fca5a5', dot: '#ef4444', label: 'Reservado' },
  bloqueado:   { bg: '#e5e7eb', border: '#9ca3af', dot: '#6b7280', label: 'Bloqueado' },
}

const emptyForm = {
  name: '', email: '', phone: '', whatsapp: '',
  // flexible date fields (proposed / main)
  date_flexibility: 'exact',
  wedding_date: '', wedding_date_to: '',
  wedding_date_ranges: [] as { from: string; to: string }[],
  wedding_year: String(new Date().getFullYear() + 1),
  wedding_month: '6',
  wedding_season: 'summer',
  wedding_duration_days: '1',
  // original request fields (frozen when lead first enters en_seguimiento)
  original_date_flexibility: '',
  original_wedding_date: '', original_wedding_date_to: '',
  original_wedding_date_ranges: [] as { from: string; to: string }[],
  original_wedding_year: String(new Date().getFullYear() + 1),
  original_wedding_month: '6',
  original_wedding_season: 'summer',
  // other
  visit_date: '', guests: '', source: 'web',
  notes: '', ceremony_type: 'sin_definir', budget: 'sin_definir',
  language: 'es', style: '',
  // budget attachment (set when passing to presupuesto)
  budget_file_url: '', budget_file_name: '',
  // confirmed budget dates (separate from proposal/negotiation dates)
  budget_date_flexibility: 'exact',
  budget_date: '', budget_date_to: '',
  budget_date_ranges: [] as { from: string; to: string }[],
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const router   = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { isBlocked } = useRequireSubscription()
  const features = usePlanFeatures()

  const [leads,     setLeads]     = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('new')
  const [search,    setSearch]    = useState('')

  // Filters
  const [hidePast,    setHidePast]    = useState(false)
  const [filterSrc,   setFilterSrc]   = useState('all')
  const [filterBudget,setFilterBudget]= useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo,   setFilterDateTo]   = useState<string>('')
  const [viewMode,    setViewMode]    = useState<'list' | 'kanban'>('list')

  // Modals
  const [showForm,   setShowForm]   = useState(false)
  const [editLead,   setEditLead]   = useState<any|null>(null)
  const [detailLead, setDetailLead] = useState<any|null>(null)
  const [form,       setForm]       = useState(emptyForm)
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState('')
  const [flashedTab, setFlashedTab] = useState<string | null>(null)
  const [lostBanner, setLostBanner] = useState<{ name: string } | null>(null)
  const [returnToEditAfterDates, setReturnToEditAfterDates] = useState(false)
  const [visitSubFilter, setVisitSubFilter] = useState<'all' | 'scheduled' | 'post'>('all')
  const [dateConfirmLead,   setDateConfirmLead]   = useState<any | null>(null)
  const [dateConfirmStatus, setDateConfirmStatus] = useState<DbStatus | null>(null)
  const [dateConfirmKey,    setDateConfirmKey]    = useState(0)
  const [cancelVisitConfirm, setCancelVisitConfirm] = useState<{
    lead: any; targetStatus: DbStatus; requiresDateModal: boolean
  } | null>(null)
  const [cancelWeddingLead,   setCancelWeddingLead]   = useState<any | null>(null)
  const [cancelWeddingReason, setCancelWeddingReason] = useState('')
  const [deleteConfirmId,     setDeleteConfirmId]     = useState<string | null>(null)
  const [clearDatesConfirm,   setClearDatesConfirm]   = useState<any | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    load()
    // Open new lead modal if navigated from dashboard with ?new=1
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('new') === '1') {
        setForm(emptyForm); setEditLead(null); setShowForm(true)
        window.history.replaceState({}, '', '/leads')
      }
    }
  }, [user, authLoading])

  // Deep-link: open the visit-edit modal when arriving with ?openVisit=<leadId>
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (leads.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const id = params.get('openVisit')
    if (!id) return
    const lead = leads.find(l => l.id === id)
    if (lead) {
      setActiveTab('visit')
      setDateConfirmLead(lead)
      setDateConfirmStatus('visit_scheduled')
      setDateConfirmKey(k => k + 1)
    }
    window.history.replaceState({}, '', '/leads')
  }, [leads])

  const load = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('leads').select('*')
      .eq('user_id', user!.id).order('created_at', { ascending: false })
    if (data) {
      // Auto-move visit_scheduled leads whose visit_date has passed → post_visit
      const today = todayIso()
      const toAutoMove = data.filter(l => l.status === 'visit_scheduled' && l.visit_date && l.visit_date < today)
      if (toAutoMove.length > 0) {
        await supabase.from('leads')
          .update({ status: 'post_visit' })
          .in('id', toAutoMove.map((l: any) => l.id))
        toAutoMove.forEach((l: any) => { l.status = 'post_visit' })
      }
      setLeads(data)
    }
    setLoading(false)
  }

  const showToast = (msg: string, flashTab?: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3200)
    if (flashTab) {
      setFlashedTab(flashTab)
      setTimeout(() => setFlashedTab(null), 1800)
    }
    if (flashTab === 'lost' || msg.includes('Perdido')) {
      // For "lost" moves, also show the in-content banner with lead name
      const nameMatch = msg.match(/^(.+?) movido/)
      if (nameMatch) setLostBanner({ name: nameMatch[1] })
      else setLostBanner({ name: '' })
      setTimeout(() => setLostBanner(null), 4000)
    }
  }

  // Tab counts (ignoring filters so counts are always real)
  const tabCounts = useMemo(() => {
    const c: Record<string, number> = {}
    leads.forEach(l => {
      const t = (Object.entries(TAB_STATUSES) as [Tab, DbStatus[]][])
        .find(([, ss]) => ss.includes(l.status))?.[0]
      if (t) c[t] = (c[t] || 0) + 1
    })
    return c
  }, [leads])

  // Tabs visible based on plan (leads_new_only → only 'Nuevos' tab)
  const visibleTabs = features.leads_new_only
    ? TABS.filter(t => t.key === 'new')
    : TABS

  // Apply filters + search to current tab
  const visibleLeads = useMemo(() => {
    const statuses = features.leads_new_only
      ? (['new'] as DbStatus[])
      : TAB_STATUSES[activeTab]
    return leads.filter(l => {
      if (!statuses.includes(l.status)) return false
      if (features.leads_date_filter && hidePast && isLeadDatePast(l)) return false
      if (filterSrc !== 'all' && l.source !== filterSrc) return false
      if (filterBudget !== 'all' && l.budget !== filterBudget) return false
      if (filterDateFrom || filterDateTo) {
        const dates = expandLeadDates(l)
        if (dates.length === 0) return false
        const minD = dates[0]
        const maxD = dates[dates.length - 1]
        if (filterDateFrom && maxD < filterDateFrom) return false
        if (filterDateTo   && minD > filterDateTo)   return false
      }
      if (search && !l.name?.toLowerCase().includes(search.toLowerCase()) &&
          !l.email?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [leads, activeTab, hidePast, filterSrc, filterBudget, filterDateFrom, filterDateTo, search, features.leads_new_only, features.leads_date_filter])

  // CSV export
  const exportCSV = () => {
    const header = ['Nombre','Email','Teléfono','WhatsApp','Fecha boda','Invitados','Estado','Origen','Presupuesto','Notas']
    const rows = visibleLeads.map(l => [
      l.name, l.email, l.phone, l.whatsapp, l.wedding_date || '',
      l.guests || '', SUB_STATUS_LABEL[l.status as DbStatus] || l.status,
      SOURCE_LABEL[l.source] || l.source, BUDGET_LABEL[l.budget] || l.budget, l.notes || '',
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`))
    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['\uFEFF' + csv, ''], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'leads.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const moveToStatus = async (id: string, status: DbStatus, cleanCalendar = false) => {
    const supabase = createClient()
    await supabase.from('leads').update({ status }).eq('id', id)

    // Free calendar entries when losing a wedding or explicitly cleaning up (e.g. back to nuevo)
    if (status === 'lost' || cleanCalendar) {
      await supabase.from('calendar_entries')
        .update({ status: 'libre', lead_id: null, note: null })
        .eq('user_id', user!.id)
        .eq('lead_id', id)
    }

    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    const newTab = (Object.entries(TAB_STATUSES) as [Tab, DbStatus[]][])
      .find(([, ss]) => ss.includes(status))?.[0]
    if (newTab && newTab !== activeTab) {
      setActiveTab(newTab)
      showToast(`Lead movido a "${TABS.find(t => t.key === newTab)?.label}"`, newTab)
    }
  }

  const triggerStatusChange = (lead: any, status: DbStatus) => {
    if (['contacted', 'proposal_sent', 'budget_sent', 'visit_scheduled', 'won'].includes(status)) {
      setDateConfirmLead(lead)
      setDateConfirmStatus(status)
      setDateConfirmKey(k => k + 1)
    } else {
      moveToStatus(lead.id, status)
    }
  }

  // Wrappers that intercept status changes from visit_scheduled + show cancel-visit confirmation
  const moveToStatusWithVisitCheck = (id: string, newStatus: DbStatus) => {
    const lead = leads.find(l => l.id === id)
    if (lead && lead.status === 'won' && newStatus === 'lost') {
      setCancelWeddingLead(lead); setCancelWeddingReason('')
    } else if (lead && lead.status === 'visit_scheduled' && lead.visit_date && newStatus !== 'visit_scheduled') {
      setCancelVisitConfirm({ lead, targetStatus: newStatus, requiresDateModal: false })
    } else if (lead?.status === 'lost' && newStatus === 'new') {
      // Reactivar lead perdido — conservar todos sus datos sin preguntar
      moveToStatus(id, newStatus)
    } else if (newStatus === 'new' && lead && (lead.wedding_date || lead.wedding_date_ranges?.length)) {
      setClearDatesConfirm(lead)
    } else if (newStatus === 'new' && lead && ['contacted', 'proposal_sent', 'budget_sent', 'post_visit'].includes(lead.status)) {
      // Lead was in a status that creates calendar entries but has no wedding_date — clean up silently
      moveToStatus(id, newStatus, true)
    } else {
      moveToStatus(id, newStatus)
    }
  }

  const handleCancelWedding = async () => {
    if (!cancelWeddingLead) return
    const supabase = createClient()
    const notes = cancelWeddingReason.trim()
      ? `[Boda cancelada] ${cancelWeddingReason.trim()}${cancelWeddingLead.notes ? '\n' + cancelWeddingLead.notes : ''}`
      : cancelWeddingLead.notes
    await supabase.from('leads').update({ status: 'lost', notes }).eq('id', cancelWeddingLead.id)

    // Free ALL calendar entries linked to this lead (reservado, negociacion, etc.)
    await supabase.from('calendar_entries')
      .update({ status: 'libre', lead_id: null, note: null })
      .eq('user_id', user!.id)
      .eq('lead_id', cancelWeddingLead.id)

    setLeads(prev => prev.map(l => l.id === cancelWeddingLead.id ? { ...l, status: 'lost', notes } : l))
    setActiveTab('lost')
    showToast('Boda cancelada — lead movido a Perdidos', 'lost')
    setCancelWeddingLead(null); setCancelWeddingReason('')
  }

  const triggerStatusChangeWithVisitCheck = (lead: any, newStatus: DbStatus) => {
    if (lead.status === 'visit_scheduled' && lead.visit_date && newStatus !== 'visit_scheduled') {
      const requiresDateModal = ['contacted', 'visit_scheduled', 'won'].includes(newStatus)
      setCancelVisitConfirm({ lead, targetStatus: newStatus, requiresDateModal })
    } else {
      triggerStatusChange(lead, newStatus)
    }
  }

  const confirmVisitCancel = async (clearVisit: boolean) => {
    if (!cancelVisitConfirm) return
    const { lead, targetStatus, requiresDateModal } = cancelVisitConfirm
    setCancelVisitConfirm(null)

    let updatedLead = lead
    if (clearVisit) {
      const supabase = createClient()
      // Clear visit_date (+ optional visit_time/visit_duration if columns exist)
      const { error: clearErr } = await supabase.from('leads').update({ visit_date: null, visit_time: null, visit_duration: null }).eq('id', lead.id)
      if (clearErr) await supabase.from('leads').update({ visit_date: null }).eq('id', lead.id)

      // Also clean up the calendar entry created for the visit date
      if (lead.visit_date) {
        const { data: visitEntry } = await supabase
          .from('calendar_entries')
          .select('id, status')
          .eq('user_id', user!.id)
          .eq('date', lead.visit_date)
          .eq('lead_id', lead.id)
          .maybeSingle()

        if (visitEntry?.id) {
          if (visitEntry.status === 'negociacion') {
            // Entry was created just for the visit — delete it entirely
            await supabase.from('calendar_entries').delete().eq('id', visitEntry.id)
          } else {
            // Entry has a higher status (reservado, etc.) — keep status but unlink the lead
            await supabase.from('calendar_entries').update({ lead_id: null, note: null }).eq('id', visitEntry.id)
          }
        }
      }

      updatedLead = { ...lead, visit_date: null, visit_time: null, visit_duration: null }
      setLeads(prev => prev.map(l => l.id === lead.id ? updatedLead : l))
      if (detailLead?.id === lead.id) setDetailLead(updatedLead)
    }

    if (requiresDateModal) {
      setDateConfirmLead(updatedLead)
      setDateConfirmStatus(targetStatus)
      setDateConfirmKey(k => k + 1)
    } else {
      moveToStatus(lead.id, targetStatus)
    }
  }

  // Note: requires ALTER TABLE leads ADD COLUMN IF NOT EXISTS wedding_date_history JSONB DEFAULT '[]';
  const handleDateConfirm = async (leadUpdates: any, calendarDates: string[], calendarStatus: 'negociacion' | 'reservado', isVisit: boolean, halfDayMap?: Record<string, 'medio_dia_manana' | 'medio_dia_tarde'>, visitTime?: string, visitDuration?: number) => {
    if (!dateConfirmLead || !dateConfirmStatus) return
    const supabase = createClient()

    const finalUpdates: any = { status: dateConfirmStatus, ...leadUpdates }
    if (isVisit && calendarDates.length > 0) {
      finalUpdates.visit_date = calendarDates[0]
      finalUpdates.visit_time = visitTime ?? null
      finalUpdates.visit_duration = visitDuration ?? null
    }

    // Cuando se confirman fechas de presupuesto, mapear wedding_date* → budget_date*
    // Si el lead ya tiene fechas propuestas (viene de en_seguimiento/visita), no sobreescribir wedding_date*
    // Si viene de nuevo directamente, copiar también a wedding_date* (propuesta = presupuesto)
    if (!isVisit && dateConfirmStatus === 'budget_sent') {
      finalUpdates.budget_date             = leadUpdates.wedding_date       ?? null
      finalUpdates.budget_date_to          = leadUpdates.wedding_date_to    ?? null
      finalUpdates.budget_date_flexibility = leadUpdates.date_flexibility   ?? 'exact'
      finalUpdates.budget_date_ranges      = leadUpdates.wedding_date_ranges ?? null
      if (dateConfirmLead.status !== 'new') {
        // lead ya tiene fechas propuestas — conservarlas, no sobrescribir con las del presupuesto
        delete finalUpdates.wedding_date
        delete finalUpdates.wedding_date_to
        delete finalUpdates.date_flexibility
        delete finalUpdates.wedding_date_ranges
      }
      // si viene de 'new': wedding_date* también se guarda (auto-copia propuesta = presupuesto)
    }

    // Si aún no hay fechas originales guardadas, fijarlas ahora antes de cualquier cambio
    // (se hace siempre al primer cambio de estado, cambien o no las fechas)
    if (!isVisit && !dateConfirmLead.original_date_flexibility) {
      finalUpdates.original_date_flexibility    = dateConfirmLead.date_flexibility    ?? 'exact'
      finalUpdates.original_wedding_date        = dateConfirmLead.wedding_date        ?? null
      finalUpdates.original_wedding_date_to     = dateConfirmLead.wedding_date_to     ?? null
      finalUpdates.original_wedding_date_ranges = dateConfirmLead.wedding_date_ranges ?? null
    }

    // Nuevo → presupuesto: las fechas seleccionadas son la primera propuesta formal.
    // Actualizar original_* para que refleje lo que realmente se le está proponiendo.
    if (!isVisit && dateConfirmStatus === 'budget_sent' && dateConfirmLead.status === 'new' && calendarDates.length > 0) {
      const sorted = [...calendarDates].sort()
      if (sorted.length === 1) {
        finalUpdates.original_date_flexibility    = 'exact'
        finalUpdates.original_wedding_date        = sorted[0]
        finalUpdates.original_wedding_date_to     = null
        finalUpdates.original_wedding_date_ranges = null
      } else {
        const isContiguous = sorted.every((d, i) => {
          if (i === 0) return true
          const prev = new Date(sorted[i - 1] + 'T12:00:00')
          const curr = new Date(d + 'T12:00:00')
          return (curr.getTime() - prev.getTime()) / 86400000 === 1
        })
        if (isContiguous) {
          finalUpdates.original_date_flexibility    = 'range'
          finalUpdates.original_wedding_date        = sorted[0]
          finalUpdates.original_wedding_date_to     = sorted[sorted.length - 1]
          finalUpdates.original_wedding_date_ranges = null
        } else {
          finalUpdates.original_date_flexibility    = 'multi_range'
          finalUpdates.original_wedding_date        = null
          finalUpdates.original_wedding_date_to     = null
          finalUpdates.original_wedding_date_ranges = sorted.map(d => ({ from: d, to: d }))
        }
      }
    }

    const { data: updatedLead, error: updateErr } = await supabase.from('leads')
      .update(finalUpdates).eq('id', dateConfirmLead.id).select().single()

    // Cascading fallbacks for missing optional columns (original_*, wedding_duration_days, visit_time, visit_duration, budget_file_*, etc.)
    let resolvedLead = updatedLead
    if (updateErr || !updatedLead) {
      // 2nd try: drop budget_file_* (columns may not exist yet)
      if (updateErr?.message && /budget_file_(url|name)/.test(updateErr.message)) {
        const { budget_file_url: _u, budget_file_name: _n, ...noFile } = finalUpdates
        const { data: fb, error: fbErr } = await supabase.from('leads')
          .update(noFile).eq('id', dateConfirmLead.id).select().single()
        if (!fbErr && fb) { resolvedLead = fb }
        else {
          // still failing — fall through to the rest of the cascade below
          const { wedding_duration_days: _dur, ...coreLeadUpdates } = leadUpdates
          const fallback2Payload: any = { status: dateConfirmStatus, ...coreLeadUpdates }
          if (isVisit && calendarDates.length > 0) fallback2Payload.visit_date = calendarDates[0]
          const { data: fallback2, error: err2 } = await supabase.from('leads')
            .update(fallback2Payload).eq('id', dateConfirmLead.id).select().single()
          if (!err2 && fallback2) { resolvedLead = fallback2 }
          else {
            const safeFields: any = { status: dateConfirmStatus }
            if (isVisit && calendarDates.length > 0) safeFields.visit_date = calendarDates[0]
            if (leadUpdates.wedding_date       !== undefined) safeFields.wedding_date       = leadUpdates.wedding_date
            if (leadUpdates.wedding_date_to    !== undefined) safeFields.wedding_date_to    = leadUpdates.wedding_date_to
            if (leadUpdates.date_flexibility   !== undefined) safeFields.date_flexibility   = leadUpdates.date_flexibility
            if (leadUpdates.wedding_date_ranges !== undefined) safeFields.wedding_date_ranges = leadUpdates.wedding_date_ranges
            const { data: fallback3 } = await supabase.from('leads')
              .update(safeFields).eq('id', dateConfirmLead.id).select().single()
            resolvedLead = fallback3 ?? null
          }
        }
      } else {
        // 2nd try: drop visit_time/visit_duration + duration but keep core date fields + status
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { wedding_duration_days: _dur, ...coreLeadUpdates } = leadUpdates
        const fallback2Payload: any = { status: dateConfirmStatus, ...coreLeadUpdates }
        // Always re-include visit_date in fallback — it's critical for the cancel-visit check
        if (isVisit && calendarDates.length > 0) fallback2Payload.visit_date = calendarDates[0]
        const { data: fallback2, error: err2 } = await supabase.from('leads')
          .update(fallback2Payload).eq('id', dateConfirmLead.id).select().single()
        if (!err2 && fallback2) {
          resolvedLead = fallback2
        } else {
          // 3rd try: just core date fields without duration, without original_*
          const safeFields: any = { status: dateConfirmStatus }
          if (isVisit && calendarDates.length > 0) safeFields.visit_date = calendarDates[0]
          if (leadUpdates.wedding_date     !== undefined) safeFields.wedding_date     = leadUpdates.wedding_date
          if (leadUpdates.wedding_date_to  !== undefined) safeFields.wedding_date_to  = leadUpdates.wedding_date_to
          if (leadUpdates.date_flexibility !== undefined) safeFields.date_flexibility = leadUpdates.date_flexibility
          if (leadUpdates.wedding_date_ranges !== undefined) safeFields.wedding_date_ranges = leadUpdates.wedding_date_ranges
          const { data: fallback3 } = await supabase.from('leads')
            .update(safeFields).eq('id', dateConfirmLead.id).select().single()
          resolvedLead = fallback3 ?? null
        }
      }
    }

    // Visits only update visit_date on the lead — they do NOT touch calendar_entries
    // (availability of the day must not change just because someone is visiting)
    if (!isVisit) {
      // Save full-day calendar entries (dates NOT marked as half-day)
      const fullDayDates = calendarDates.filter(d => !halfDayMap?.[d])
      for (const d of fullDayDates) {
        const { data: existing } = await supabase.from('calendar_entries')
          .select('id').eq('user_id', user!.id).eq('date', d).maybeSingle()
        const entryPayload: any = { status: calendarStatus, lead_id: dateConfirmLead.id }
        if (existing?.id) {
          await supabase.from('calendar_entries').update(entryPayload).eq('id', existing.id)
        } else {
          await supabase.from('calendar_entries').insert({ user_id: user!.id, date: d, ...entryPayload })
        }
      }
      // Save half-day entries — note encodes manana/tarde
      if (halfDayMap) {
        for (const [d, halfType] of Object.entries(halfDayMap)) {
          if (!calendarDates.includes(d)) continue
          const { data: existing } = await supabase.from('calendar_entries')
            .select('id').eq('user_id', user!.id).eq('date', d).maybeSingle()
          const entryPayload: any = { status: calendarStatus, lead_id: dateConfirmLead.id, note: halfType }
          if (existing?.id) {
            await supabase.from('calendar_entries').update(entryPayload).eq('id', existing.id)
          } else {
            await supabase.from('calendar_entries').insert({ user_id: user!.id, date: d, ...entryPayload })
          }
        }
      }
    }

    if (resolvedLead) setLeads(prev => prev.map(l => l.id === dateConfirmLead.id ? resolvedLead! : l))
    const newTab = (Object.entries(TAB_STATUSES) as [Tab, DbStatus[]][])
      .find(([, ss]) => ss.includes(dateConfirmStatus))?.[0]
    if (newTab && newTab !== activeTab) {
      setActiveTab(newTab)
      showToast(`Lead movido a "${TABS.find(t => t.key === newTab)?.label}"`, newTab)
    } else showToast('Lead actualizado')
    const shouldReturnToEdit = returnToEditAfterDates
    setReturnToEditAfterDates(false)
    setDateConfirmLead(null)
    setDateConfirmStatus(null)
    // Re-open edit modal if the user came from "Cambiar fechas" inside the edit modal
    if (shouldReturnToEdit && resolvedLead) {
      openEdit(resolvedLead)
    }
  }

  const requestDeleteLead = (id: string) => { setDeleteConfirmId(id) }

  const confirmDeleteLead = async () => {
    if (!deleteConfirmId) return
    const lead = leads.find(l => l.id === deleteConfirmId)
    const supabase = createClient()

    if (lead?.status === 'won') {
      // Soft delete: move to lost + free calendar
      await supabase.from('leads').update({ status: 'lost' }).eq('id', deleteConfirmId)
      const { data: reservedEntry } = await supabase
        .from('calendar_entries')
        .select('id')
        .eq('user_id', user!.id)
        .eq('lead_id', deleteConfirmId)
        .eq('status', 'reservado')
        .maybeSingle()
      if (reservedEntry?.id) {
        await supabase.from('calendar_entries').update({ status: 'libre', lead_id: null, note: null }).eq('id', reservedEntry.id)
      }
      setLeads(prev => prev.map(l => l.id === deleteConfirmId ? { ...l, status: 'lost' } : l))
      setActiveTab('lost')
      showToast('Lead movido a Perdidos', 'lost')
    } else {
      // Hard delete (only from "lost" tab)
      await supabase.from('leads').delete().eq('id', deleteConfirmId)
      setLeads(prev => prev.filter(l => l.id !== deleteConfirmId))
      showToast('Lead eliminado definitivamente')
    }

    if (detailLead?.id === deleteConfirmId) setDetailLead(null)
    setDeleteConfirmId(null)
  }

  const openCreate = () => { setForm(emptyForm); setEditLead(null); setShowForm(true) }
  const openEdit   = (lead: any) => {
    setForm({
      name: lead.name || '', email: lead.email || '', phone: lead.phone || '',
      whatsapp: lead.whatsapp || '',
      date_flexibility: lead.date_flexibility || 'exact',
      wedding_date: lead.wedding_date || '', wedding_date_to: lead.wedding_date_to || '',
      wedding_date_ranges: lead.wedding_date_ranges || [],
      wedding_year: lead.wedding_year ? String(lead.wedding_year) : String(new Date().getFullYear() + 1),
      wedding_month: lead.wedding_month ? String(lead.wedding_month) : '6',
      wedding_season: lead.wedding_season || 'summer',
      wedding_duration_days: lead.wedding_duration_days ? String(lead.wedding_duration_days) : '1',
      original_date_flexibility: lead.original_date_flexibility || '',
      original_wedding_date: lead.original_wedding_date || '',
      original_wedding_date_to: lead.original_wedding_date_to || '',
      original_wedding_date_ranges: lead.original_wedding_date_ranges || [],
      original_wedding_year: lead.original_wedding_year ? String(lead.original_wedding_year) : String(new Date().getFullYear() + 1),
      original_wedding_month: lead.original_wedding_month ? String(lead.original_wedding_month) : '6',
      original_wedding_season: lead.original_wedding_season || 'summer',
      visit_date: lead.visit_date || '', guests: lead.guests?.toString() || '',
      source: lead.source || 'web', notes: lead.notes || '',
      ceremony_type: lead.ceremony_type || 'sin_definir',
      budget: lead.budget || 'sin_definir', language: lead.language || 'es',
      style: lead.style || '',
      budget_file_url: lead.budget_file_url || '',
      budget_file_name: lead.budget_file_name || '',
      budget_date_flexibility: lead.budget_date_flexibility || 'exact',
      budget_date: lead.budget_date || '',
      budget_date_to: lead.budget_date_to || '',
      budget_date_ranges: lead.budget_date_ranges || [],
    })
    setEditLead(lead); setDetailLead(null); setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { showToast('El nombre es obligatorio'); return }
    if (!form.email?.trim() && !form.phone?.trim()) { showToast('Email o teléfono obligatorio'); return }
    if (form.date_flexibility === 'exact' && !form.wedding_date) { showToast('La fecha de boda es obligatoria'); return }
    if (form.date_flexibility === 'range' && !form.wedding_date) { showToast('La fecha de inicio del rango es obligatoria'); return }
    if (form.date_flexibility === 'multi_range' && !form.wedding_date_ranges?.some((r: any) => r.from)) { showToast('Añade al menos un rango de fechas'); return }
    setSaving(true)
    const supabase = createClient()
    const oFlex = form.original_date_flexibility
    const payload  = {
      ...form,
      guests: form.guests ? parseInt(form.guests) : null,
      visit_date: form.visit_date || null,
      wedding_date: ['exact','range'].includes(form.date_flexibility) ? (form.wedding_date || null) : null,
      // exact → siempre 1 día (sin wedding_date_to); range usa wedding_date_to del rango seleccionado
      wedding_date_to: form.date_flexibility === 'range' ? (form.wedding_date_to || null) : null,
      wedding_date_ranges: form.date_flexibility === 'multi_range' ? form.wedding_date_ranges.filter((r: any) => r.from) : null,
      wedding_year: ['month','season'].includes(form.date_flexibility) ? parseInt(form.wedding_year) : null,
      wedding_month: form.date_flexibility === 'month' ? parseInt(form.wedding_month) : null,
      wedding_season: form.date_flexibility === 'season' ? form.wedding_season : null,
      wedding_duration_days: parseInt(form.wedding_duration_days || '1') || 1,
      // original_* — null-safe conversions to prevent type errors on int DB columns
      original_date_flexibility: oFlex || null,
      original_wedding_date: oFlex && ['exact','range'].includes(oFlex) ? (form.original_wedding_date || null) : null,
      original_wedding_date_to: oFlex === 'range' ? (form.original_wedding_date_to || null) : null,
      original_wedding_date_ranges: oFlex === 'multi_range' ? (form.original_wedding_date_ranges?.filter((r: any) => r.from) ?? null) : null,
      original_wedding_year: oFlex && ['month','season'].includes(oFlex) ? (parseInt(form.original_wedding_year) || null) : null,
      original_wedding_month: oFlex === 'month' ? (parseInt(form.original_wedding_month) || null) : null,
      original_wedding_season: oFlex === 'season' ? form.original_wedding_season : null,
      // budget attachment
      budget_file_url:  form.budget_file_url  || null,
      budget_file_name: form.budget_file_name || null,
      // confirmed budget dates
      budget_date:             ['exact','range'].includes(form.budget_date_flexibility) ? (form.budget_date || null) : null,
      budget_date_to:          form.budget_date_flexibility === 'range' ? (form.budget_date_to || null) : null,
      budget_date_flexibility: form.budget_date_flexibility || null,
      budget_date_ranges:      form.budget_date_flexibility === 'multi_range' ? form.budget_date_ranges.filter((r: any) => r.from) : null,
    }
    // Helper: strip columns that don't exist in DB yet, retry once
    const safeUpdate = async (table: any, data: any, match: { id: string }) => {
      let { data: res, error } = await table.update(data).eq('id', match.id).select().single()
      if (error?.message?.includes('wedding_duration_days')) {
        const { wedding_duration_days: _d, ...d2 } = data
        ;({ data: res, error } = await table.update(d2).eq('id', match.id).select().single())
      }
      if (error?.message && /original_wedding_(month|year|season)/.test(error.message)) {
        const { original_wedding_month: _m, original_wedding_year: _y, original_wedding_season: _s, ...d3 } = data
        ;({ data: res, error } = await table.update(d3).eq('id', match.id).select().single())
      }
      if (error?.message && /budget_file_(url|name)/.test(error.message)) {
        const { budget_file_url: _u, budget_file_name: _n, ...d4 } = data
        ;({ data: res, error } = await table.update(d4).eq('id', match.id).select().single())
      }
      return { data: res, error }
    }
    const safeInsert = async (table: any, data: any) => {
      let { data: res, error } = await table.insert(data).select().single()
      if (error?.message?.includes('wedding_duration_days')) {
        const { wedding_duration_days: _d, ...d2 } = data
        ;({ data: res, error } = await table.insert(d2).select().single())
      }
      if (error?.message && /original_wedding_(month|year|season)/.test(error.message)) {
        const { original_wedding_month: _m, original_wedding_year: _y, original_wedding_season: _s, ...d3 } = data
        ;({ data: res, error } = await table.insert(d3).select().single())
      }
      if (error?.message && /budget_file_(url|name)/.test(error.message)) {
        const { budget_file_url: _u, budget_file_name: _n, ...d4 } = data
        ;({ data: res, error } = await table.insert(d4).select().single())
      }
      return { data: res, error }
    }

    if (editLead) {
      const editPayload: any = { ...payload }
      const { data, error } = await safeUpdate(supabase.from('leads'), editPayload, { id: editLead.id })
      if (error) { showToast(`Error: ${error.message}`); setSaving(false); return }
      if (data) setLeads(prev => prev.map(l => l.id === editLead.id ? data : l))
      showToast('Lead actualizado')
    } else {
      // Al crear: guardar también las fechas originales como referencia permanente (= lo que pide la pareja)
      const insertPayload = {
        ...payload,
        user_id: user!.id,
        status: 'new',
        original_date_flexibility:    payload.date_flexibility,
        original_wedding_date:        payload.wedding_date,
        original_wedding_date_to:     payload.wedding_date_to,
        original_wedding_date_ranges: payload.wedding_date_ranges,
        original_wedding_year:        payload.wedding_year,
        original_wedding_month:       payload.wedding_month,
        original_wedding_season:      payload.wedding_season,
      }
      const { data, error } = await safeInsert(supabase.from('leads'), insertPayload)
      if (error) { showToast(`Error: ${error.message}`); setSaving(false); return }
      if (data) setLeads(prev => [data, ...prev])
      showToast('Nuevo lead creado')
    }
    setShowForm(false); setEditLead(null); setSaving(false)
  }



  if (isBlocked) return null

  if (loading) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--warm-gray)', fontSize: 13 }}>Cargando leads...</div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">

        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-title">Leads</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {features.leads_export && (
              <button className="btn btn-ghost btn-sm" onClick={exportCSV} title="Exportar leads visibles a CSV">
                <Download size={13} /> Exportar CSV
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <Plus size={13} /> Nuevo lead
            </button>
          </div>
        </div>

        <div className="page-content">

          {/* Toolbar: search + filters + view toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
              <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
              <input className="form-input" style={{ paddingLeft: 32 }}
                placeholder="Buscar por nombre o email…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
              <select className="form-input" style={{ width: 'auto' }}
                value={filterSrc} onChange={e => setFilterSrc(e.target.value)}>
                <option value="all">Fuente: Todas</option>
                {Object.entries(SOURCE_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select className="form-input" style={{ width: 'auto' }}
                value={filterBudget} onChange={e => setFilterBudget(e.target.value)}>
                <option value="all">Presupuesto: Todos</option>
                {BUDGET_OPTS.filter(v => v !== 'sin_definir').map(v =>
                  <option key={v} value={v}>{BUDGET_LABEL[v]}</option>)}
              </select>
              {/* Date range filter */}
              <FilterDateRangePicker
                from={filterDateFrom} to={filterDateTo}
                onChange={(f, t) => { setFilterDateFrom(f); setFilterDateTo(t) }}
              />
              {features.leads_date_filter && (
                <button onClick={() => setHidePast(p => !p)}
                  style={{ padding: '8px 12px', border: '1px solid var(--ivory)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap',
                    background: hidePast ? 'var(--gold)' : '#fff',
                    color: hidePast ? '#fff' : 'var(--warm-gray)',
                    transition: 'all 0.15s' }}>
                  <Clock size={13} /> Ocultar pasadas
                </button>
              )}
              {(filterSrc !== 'all' || filterBudget !== 'all' || filterDateFrom || filterDateTo) && (
                <button onClick={() => { setFilterSrc('all'); setFilterBudget('all'); setFilterDateFrom(''); setFilterDateTo('') }}
                  style={{ padding: '8px 10px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--warm-gray)', fontSize: 12, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
                  Limpiar
                </button>
              )}
            </div>

            {!features.leads_new_only && (
              <div style={{ display: 'flex', border: '1px solid var(--ivory)', borderRadius: 8, overflow: 'hidden', marginLeft: 'auto' }}>
                <button onClick={() => setViewMode('list')} title="Vista lista"
                  style={{ padding: '8px 12px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 500,
                    background: viewMode === 'list' ? 'var(--gold)' : 'transparent',
                    color: viewMode === 'list' ? '#fff' : 'var(--warm-gray)',
                    transition: 'all 0.15s' }}>
                  <List size={14} /> Lista
                </button>
                <button onClick={() => setViewMode('kanban')} title="Vista kanban"
                  style={{ padding: '8px 12px', border: 'none', borderLeft: '1px solid var(--ivory)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 500,
                    background: viewMode === 'kanban' ? 'var(--gold)' : 'transparent',
                    color: viewMode === 'kanban' ? '#fff' : 'var(--warm-gray)',
                    transition: 'all 0.15s' }}>
                  <LayoutGrid size={14} /> Kanban
                </button>
              </div>
            )}
          </div>

          {/* Plan restriction notice */}
          {features.leads_new_only && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--cream)', border: '1px solid var(--gold-light)', borderRadius: 8, marginBottom: 16, fontSize: 12, color: 'var(--charcoal)' }}>
              <AlertTriangle size={12} style={{ color: 'var(--gold)' }} />
              <span>Tu plan <strong>{features.planName}</strong> muestra únicamente los leads nuevos recibidos. <a href="/perfil" style={{ color: 'var(--gold)', fontWeight: 600 }}>Actualiza tu plan</a> para acceder a todo el CRM de leads.</span>
            </div>
          )}

          {viewMode === 'list' && (<>
          {/* Tabs + filters row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '1px solid var(--ivory)', marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {visibleTabs.map(tab => {
                const count      = tabCounts[tab.key] || 0
                const isActive   = activeTab === tab.key
                const isFlashing = flashedTab === tab.key
                const isLost     = tab.key === 'lost'
                const isEmpty    = count === 0 && !isActive
                return (
                  <button key={tab.key} onClick={() => { setActiveTab(tab.key); setFlashedTab(null); setVisitSubFilter('all') }} style={{
                    padding: '10px 14px',
                    background: isFlashing && isLost ? '#dc2626'
                      : isFlashing ? '#fefce8'
                      : isLost && count > 0 && !isActive ? 'rgba(239,68,68,0.05)'
                      : 'none',
                    border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: isActive || isFlashing ? 600 : 500,
                    opacity: isEmpty ? 0.4 : 1,
                    color: isFlashing && isLost ? '#fff'
                      : isActive ? 'var(--espresso)'
                      : isLost && count > 0 ? '#ef4444'
                      : isFlashing ? 'var(--gold)'
                      : 'var(--warm-gray)',
                    borderBottom: isActive ? `2px solid ${isLost ? '#ef4444' : 'var(--gold)'}` : isFlashing ? '2px solid currentColor' : '2px solid transparent',
                    marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 0.25s', whiteSpace: 'nowrap',
                    borderRadius: isFlashing ? '6px 6px 0 0' : 0,
                    transform: isFlashing && isLost ? 'scale(1.04)' : 'scale(1)',
                  }}>
                    <span>{tab.emoji}</span>
                    <span>{tab.label}</span>
                    {count > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, minWidth: 18, height: 18,
                        borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isFlashing && isLost ? 'rgba(255,255,255,0.3)'
                          : isActive && isLost ? '#ef4444'
                          : isLost && count > 0 ? '#fee2e2'
                          : isActive ? 'var(--gold)'
                          : 'var(--ivory)',
                        color: isFlashing && isLost ? '#fff'
                          : isActive && isLost ? '#fff'
                          : isLost && count > 0 ? '#ef4444'
                          : isActive ? '#fff'
                          : 'var(--warm-gray)',
                        padding: '0 5px',
                      }}>{count}</span>
                    )}
                  </button>
                )
              })}
            </div>

          </div>

          {/* Lost banner — aparece cuando un lead se mueve a Perdidos */}
          {lostBanner && (
            <div style={{
              margin: '10px 0 4px', padding: '10px 14px', background: '#fef2f2',
              border: '1px solid #fca5a5', borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <XCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 500, flex: 1 }}>
                {lostBanner.name ? <><strong>{lostBanner.name}</strong> movido a Perdidos</> : 'Lead movido a Perdidos'}
              </span>
              <button onClick={() => setLostBanner(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2, display: 'flex' }}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* List content */}
          <div style={{ marginTop: 8 }}>
            {/* Visit sub-filter pills */}
            {activeTab === 'visit' && visibleLeads.length > 0 && (() => {
              const nScheduled = visibleLeads.filter(l => l.status === 'visit_scheduled').length
              const nPost      = visibleLeads.filter(l => l.status === 'post_visit').length
              if (nScheduled === 0 || nPost === 0) return null // only 1 type present — no need for filter
              const opts: { key: typeof visitSubFilter; label: string; count: number }[] = [
                { key: 'all',       label: 'Todas',          count: visibleLeads.length },
                { key: 'scheduled', label: 'Agendadas',      count: nScheduled },
                { key: 'post',      label: 'Post-visita',    count: nPost },
              ]
              return (
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {opts.map(o => {
                    const active = visitSubFilter === o.key
                    return (
                      <button key={o.key} onClick={() => setVisitSubFilter(o.key)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 12px', borderRadius: 20, border: '1.5px solid',
                        borderColor: active ? 'var(--gold)' : 'var(--ivory)',
                        background: active ? 'var(--gold)' : '#fff',
                        color: active ? '#fff' : 'var(--warm-gray)',
                        fontSize: 12, fontWeight: active ? 700 : 500,
                        cursor: 'pointer', outline: 'none', transition: 'all 0.15s',
                      }}>
                        {o.label}
                        <span style={{ fontSize: 10, fontWeight: 700, background: active ? 'rgba(255,255,255,0.25)' : 'var(--cream)', borderRadius: 10, padding: '1px 6px', color: active ? '#fff' : 'var(--espresso)' }}>{o.count}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })()}
            {visibleLeads.length === 0 ? (
              <EmptyState tab={activeTab} search={search} hidePast={hidePast}
                onClear={() => { setSearch(''); setHidePast(false) }} onNew={openCreate} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeTab === 'visit' ? (() => {
                  const rowProps = { tab: activeTab as Tab, onMove: moveToStatusWithVisitCheck, onEdit: openEdit, onDelete: requestDeleteLead, onDetail: openEdit, onDateConfirm: triggerStatusChangeWithVisitCheck }
                  const filtered = visibleLeads.filter(l =>
                    visitSubFilter === 'scheduled' ? l.status === 'visit_scheduled' :
                    visitSubFilter === 'post'      ? l.status === 'post_visit' : true
                  )
                  return filtered.map(lead => <LeadRow key={lead.id} lead={lead} {...rowProps} />)
                })() : visibleLeads.map(lead => (
                  <LeadRow key={lead.id} lead={lead} tab={activeTab}
                    onMove={moveToStatusWithVisitCheck} onEdit={openEdit}
                    onDelete={requestDeleteLead} onDetail={openEdit}
                    onDateConfirm={triggerStatusChangeWithVisitCheck} />
                ))}
              </div>
            )}
          </div>
          </>)}

          {viewMode === 'kanban' && (
            <KanbanBoard
              leads={leads.filter(l => {
                if (search && !l.name?.toLowerCase().includes(search.toLowerCase()) &&
                    !l.email?.toLowerCase().includes(search.toLowerCase())) return false
                if (filterSrc !== 'all' && l.source !== filterSrc) return false
                if (filterBudget !== 'all' && l.budget !== filterBudget) return false
                if (filterDateFrom || filterDateTo) {
                  const dates = expandLeadDates(l)
                  if (dates.length === 0) return false
                  const minD = dates[0]
                  const maxD = dates[dates.length - 1]
                  if (filterDateFrom && maxD < filterDateFrom) return false
                  if (filterDateTo   && minD > filterDateTo)   return false
                }
                if (features.leads_date_filter && hidePast && isLeadDatePast(l)) return false
                return true
              })}
              onMove={moveToStatusWithVisitCheck}
              onEdit={openEdit}
              onDelete={requestDeleteLead}
              onDetail={openEdit}
              onDateConfirm={triggerStatusChangeWithVisitCheck}
            />
          )}
        </div>
      </div>

      {/* Toast — se oculta para "Perdido" (el banner inline lo reemplaza) */}
      {toast && !toast.includes('Perdido') && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--espresso)', color: '#fff', padding: '10px 20px',
          borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 2000,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)', pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      {detailLead && (
        <DetailDrawer lead={detailLead}
          tab={(Object.entries(TAB_STATUSES) as [Tab, DbStatus[]][]).find(([,ss]) => ss.includes(detailLead.status))?.[0] || 'new'}
          onClose={() => setDetailLead(null)}
          onEdit={openEdit} onDelete={requestDeleteLead} onMove={moveToStatusWithVisitCheck}
          onDateConfirm={triggerStatusChangeWithVisitCheck}
          onUpdateLead={(id, updates) => setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))} />
      )}

      {showForm && (
        <LeadFormModal form={form} setForm={setForm} isEdit={!!editLead} editLead={editLead}
          saving={saving} onSubmit={handleSubmit} userId={user!.id}
          onClose={() => { setShowForm(false); setEditLead(null) }}
          onEditVisit={() => {
            if (!editLead) return
            setShowForm(false)
            setDateConfirmLead(editLead)
            setDateConfirmStatus('visit_scheduled')
            setDateConfirmKey(k => k + 1)
          }}
          onChangeDates={() => {
            if (!editLead) return
            setReturnToEditAfterDates(true)
            setShowForm(false)
            setDateConfirmLead(editLead)
            setDateConfirmStatus('contacted')
            setDateConfirmKey(k => k + 1)
          }}
          onChangeBudgetDates={() => {
            if (!editLead) return
            setReturnToEditAfterDates(true)
            setShowForm(false)
            setDateConfirmLead(editLead)
            setDateConfirmStatus('budget_sent')
            setDateConfirmKey(k => k + 1)
          }}
        />
      )}

      {dateConfirmLead && dateConfirmStatus && dateConfirmStatus === 'visit_scheduled' && (
        <VisitScheduleModal
          key={dateConfirmKey}
          lead={dateConfirmLead}
          allLeads={leads}
          userId={user!.id}
          onConfirm={handleDateConfirm}
          onClose={() => { setDateConfirmLead(null); setDateConfirmStatus(null) }}
        />
      )}

      {dateConfirmLead && dateConfirmStatus && dateConfirmStatus !== 'visit_scheduled' && (
        <DateConfirmModal
          key={dateConfirmKey}
          lead={dateConfirmLead}
          targetStatus={dateConfirmStatus}
          userId={user!.id}
          allLeads={leads}
          onConfirm={handleDateConfirm}
          onClose={() => {
            setReturnToEditAfterDates(false)
            setDateConfirmLead(null)
            setDateConfirmStatus(null)
          }}
          onBack={returnToEditAfterDates ? (() => {
            const leadToReopen = leads.find(l => l.id === dateConfirmLead?.id) ?? dateConfirmLead
            setReturnToEditAfterDates(false)
            setDateConfirmLead(null)
            setDateConfirmStatus(null)
            if (leadToReopen) openEdit(leadToReopen)
          }) : undefined}
        />
      )}

      {/* Cancel wedding modal */}
      {cancelWeddingLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}
          onClick={() => setCancelWeddingLead(null)}>
          <div style={{ background: '#fff', borderRadius: 14, maxWidth: 420, width: '100%', padding: '24px 24px 20px', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--rose-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X size={18} style={{ color: 'var(--rose)' }} />
              </div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 600, color: 'var(--espresso)' }}>
                Cancelar boda
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--charcoal)', marginBottom: 10 }}>
              ¿Cancelar la boda de <strong>{cancelWeddingLead.name}</strong>? El lead pasará a <strong>Perdidos</strong>.
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', background: '#f9fafb', border: '1px solid var(--ivory)', borderRadius: 7, padding: '8px 10px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={12} style={{ flexShrink: 0, color: '#9ca3af' }} />
              La fecha reservada en el calendario quedará liberada automáticamente.
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
                Motivo de cancelación
              </label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Ej: cambio de planes, presupuesto, otro venue..."
                value={cancelWeddingReason}
                onChange={e => setCancelWeddingReason(e.target.value)}
                style={{ resize: 'vertical', fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleCancelWedding}
                style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: 'none', background: 'var(--rose)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Confirmar cancelación
              </button>
              <button
                onClick={() => { setCancelWeddingLead(null); setCancelWeddingReason('') }}
                style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--charcoal)', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel visit confirmation */}
      {cancelVisitConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}
          onClick={() => setCancelVisitConfirm(null)}>
          <div style={{ background: '#fff', borderRadius: 14, maxWidth: 400, width: '100%', padding: '24px 24px 20px', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gold-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Calendar size={18} style={{ color: 'var(--gold)' }} />
              </div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 600, color: 'var(--espresso)' }}>
                ¿Cancelar la visita?
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--charcoal)', lineHeight: 1.6, marginBottom: 20 }}>
              <strong>{cancelVisitConfirm.lead.name}</strong> tiene una visita programada el{' '}
              <strong>{new Date(cancelVisitConfirm.lead.visit_date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
              <br />¿Quieres cancelarla?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => confirmVisitCancel(true)}
                style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: 'none', background: 'var(--rose)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Sí, cancelar visita
              </button>
              <button
                onClick={() => confirmVisitCancel(false)}
                style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--charcoal)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                No, mantenerla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmId && (() => {
        const leadToDelete = leads.find(l => l.id === deleteConfirmId)
        const isSoftDelete = leadToDelete?.status === 'won'
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}
            onClick={() => setDeleteConfirmId(null)}>
            <div style={{ background: '#fff', borderRadius: 14, maxWidth: 400, width: '100%', padding: '24px 24px 20px', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: isSoftDelete ? 'var(--gold-light)' : 'var(--rose-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isSoftDelete ? <XCircle size={18} style={{ color: 'var(--gold)' }} /> : <Trash2 size={18} style={{ color: 'var(--rose)' }} />}
                </div>
                <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 600, color: 'var(--espresso)' }}>
                  {isSoftDelete ? 'Mover a Perdidos' : 'Eliminar lead'}
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--charcoal)', lineHeight: 1.6, marginBottom: 20 }}>
                {isSoftDelete
                  ? <><strong>{leadToDelete?.name}</strong> pasará a <strong>Perdidos</strong> y la fecha reservada en el calendario quedará liberada. Podrás reactivarlo más adelante.</>
                  : <>¿Seguro que quieres eliminar a <strong>{leadToDelete?.name || 'este lead'}</strong>? Esta acción no se puede deshacer.</>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={confirmDeleteLead}
                  style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: 'none', background: isSoftDelete ? 'var(--gold)' : 'var(--rose)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {isSoftDelete ? 'Sí, mover a Perdidos' : 'Sí, eliminar'}
                </button>
                <button onClick={() => setDeleteConfirmId(null)}
                  style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--charcoal)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {clearDatesConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}
          onClick={() => setClearDatesConfirm(null)}>
          <div style={{ background: '#fff', borderRadius: 14, maxWidth: 400, width: '100%', padding: '24px 24px 20px', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef9ec', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Calendar size={18} style={{ color: 'var(--gold)' }} />
              </div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 600, color: 'var(--espresso)' }}>
                Mover a Nuevos
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--charcoal)', lineHeight: 1.6, marginBottom: 20 }}>
              <strong>{clearDatesConfirm.name}</strong> tiene fechas de boda seleccionadas. ¿Quieres deseleccionarlas al mover el lead a Nuevos?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={async () => {
                const supabase = createClient()
                const lead = clearDatesConfirm
                // Limpiar fechas al devolver a Nuevos
                const dateFields = { wedding_date: null, wedding_date_to: null, date_flexibility: 'flexible', wedding_date_ranges: null }
                // Restore date fields (without status — moveToStatus handles status + calendar cleanup)
                await supabase.from('leads').update(dateFields).eq('id', lead.id)
                setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...dateFields } : l))
                // Move to new + clean calendar entries
                await moveToStatus(lead.id, 'new', true)
                setClearDatesConfirm(null)
              }} style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: 'var(--gold)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Sí, deseleccionar fechas
              </button>
              <button onClick={() => { moveToStatus(clearDatesConfirm.id, 'new'); setClearDatesConfirm(null) }}
                style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--charcoal)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                No, mantener fechas
              </button>
              <button onClick={() => setClearDatesConfirm(null)}
                style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--warm-gray)', fontSize: 12, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Date Confirm Modal ─────────────────────────────────────────────────────────
function DateConfirmModal({
  lead, targetStatus, userId, allLeads, onConfirm, onClose, onBack,
}: {
  lead: any
  targetStatus: DbStatus
  userId: string
  allLeads: any[]
  onConfirm: (leadUpdates: any, calendarDates: string[], calendarStatus: 'negociacion' | 'reservado', isVisit: boolean, halfDayMap?: Record<string, 'medio_dia_manana' | 'medio_dia_tarde'>, visitTime?: string, visitDuration?: number) => Promise<void>
  onClose: () => void
  onBack?: () => void
}) {
  const isVisitMode    = targetStatus === 'visit_scheduled'
  const isWonMode      = targetStatus === 'won'
  const isBudgetMode   = targetStatus === 'budget_sent'
  // "Cambiar fechas" desde en-seguimiento: mismo destino que el estado actual → editar fechas propuestas
  const isEditDatesMode = targetStatus === 'contacted' && lead.status === 'contacted'
  const [dateRules,  setDateRules]  = useState<any>(null)

  // Dates confirmed during "en seguimiento" (current calendar-verified dates on the lead)
  const confirmedDates = useMemo(() => expandLeadDates(lead), [lead])

  // Dates to show in the top pills: always the current lead dates (main fields)
  const requestedDates = useMemo(() => confirmedDates, [confirmedDates])

  // Build a map of date → count of OTHER leads who have that date requested
  const dateLeadCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    allLeads.forEach(l => {
      if (l.id === lead.id) return
      expandLeadDates(l).forEach(d => {
        counts[d] = (counts[d] || 0) + 1
      })
    })
    return counts
  }, [allLeads, lead.id])
  const hasRequestedDates = requestedDates.length > 0

  // Open calendar on visit_date (if re-scheduling) or wedding_date otherwise
  const firstDate = (isVisitMode && lead.visit_date)
    ? lead.visit_date
    : lead.wedding_date || getLeadFirstDate(lead)
  const initD = firstDate ? new Date(firstDate + 'T12:00:00') : new Date()
  const [viewYear,  setViewYear]  = useState(initD.getFullYear())
  const [viewMonth, setViewMonth] = useState(initD.getMonth())
  // selectedDates = all calendar days to block (anchors + auto-added buffer/partner days)
  const [selectedDates,  setSelectedDates]  = useState<string[]>([])
  // selectedAnchors = only the dates the user explicitly clicked (the "wedding days")
  const [selectedAnchors, setSelectedAnchors] = useState<string[]>([])
  const [calEntries,    setCalEntries]    = useState<Record<string, any>>({})
  const [dateInfo,      setDateInfo]      = useState<string | null>(null) // date whose booking info is shown
  const [saving,        setSaving]        = useState(false)
  // Budget attachment (only used in isBudgetMode)
  const [budgetFile,      setBudgetFile]      = useState<File | null>(null)
  const [budgetUploading, setBudgetUploading] = useState(false)
  const [budgetFileUrl,   setBudgetFileUrl]   = useState<string>(lead.budget_file_url || '')
  const [budgetFileName,  setBudgetFileName]  = useState<string>(lead.budget_file_name || '')
  const [budgetError,     setBudgetError]     = useState<string | null>(null)
  const [budgetDragOver,  setBudgetDragOver]  = useState(false)
  const budgetInputRef = useRef<HTMLInputElement>(null)
  const [visitTime,     setVisitTime]     = useState<string>(lead.visit_time || '')
  const [visitDuration, setVisitDuration] = useState<number>(lead.visit_duration || 60)
  const [weddingDuration, setWeddingDuration] = useState<number>(lead.wedding_duration_days || 1)
  const [editingDuration, setEditingDuration] = useState(false)
  // Overnight: 1 = selected date is the wedding day (next day = check-out), 2 = selected date is check-out (prev day = wedding)
  const [overnightDay, setOvernightDay] = useState<1 | 2>(1)
  // When venue has overnight/packages rules, auto-apply them unless user clicks "Ignorar reglas"
  const [ignoreRules, setIgnoreRules] = useState(false)
  // Prevent re-initialising selectedDates on month navigation
  const isFirstLoad    = useRef(true)
  // Track when initial anchors are set so rules-expansion effect can fire
  const [initialAnchorsSet, setInitialAnchorsSet] = useState(false)
  const rulesApplied   = useRef(false)

  // Auto-sync duration with selected dates.
  // In won mode: always auto-set to match rules (no manual override).
  // In other modes: only clamp downward if user deselects dates.
  // For overnight: each anchor = 2 wedding days (check-in + check-out)
  // For packages:  each anchor contributes span_days
  // For simple:    each anchor = 1 day
  useEffect(() => {
    if (selectedAnchors.length === 0) return
    let calcDuration = selectedAnchors.length  // simple / fallback
    if (dateRules?.type === 'overnight') {
      calcDuration = selectedAnchors.length * 2
    } else if (dateRules?.type === 'packages') {
      calcDuration = selectedAnchors.reduce((sum, a) => {
        const dow = new Date(a + 'T12:00:00').getDay()
        const pkg = dateRules.packages?.find((p: any) => p.anchor_dow === dow)
        return sum + (pkg?.span_days || 1)
      }, 0)
    }
    if (isWonMode) {
      // Always auto-set exact value from rules
      setWeddingDuration(calcDuration)
    } else {
      // Only clamp downward
      if (weddingDuration > calcDuration) setWeddingDuration(calcDuration)
    }
  }, [selectedAnchors.length, dateRules?.type, isWonMode])

  // Load date rules from venue settings
  useEffect(() => {
    const supabase = createClient()
    supabase.from('venue_settings').select('date_rules').eq('user_id', userId).maybeSingle()
      .then(({ data }) => { if (data?.date_rules) setDateRules(data.date_rules) })
  }, [userId])

  // Set default duration from venue rules — rules always govern the default
  const durationInitialized = useRef(false)
  useEffect(() => {
    if (!dateRules || durationInitialized.current || ignoreRules) return
    durationInitialized.current = true
    if (dateRules.type === 'overnight') setWeddingDuration(2)
    else if (dateRules.type === 'packages' && dateRules.packages?.length) {
      setWeddingDuration(dateRules.packages[0].span_days)
    } else {
      // simple or no specific span: keep 1 (the wedding day itself)
      setWeddingDuration(1)
    }
  }, [dateRules])

  // Once BOTH initial anchors and date rules are ready, expand the pre-selection with the rules
  // Also filter out anchors whose full span has conflicts (dateRules wasn't ready during fetchEntries)
  useEffect(() => {
    if (!initialAnchorsSet || !dateRules || rulesApplied.current || ignoreRules || isVisitMode) return
    rulesApplied.current = true
    setSelectedAnchors(prev => {
      if (prev.length === 0) return prev
      const isHardBlocked = (d: string) => {
        const e = calEntries[d]
        return e?.status === 'reservado' || (e?.status === 'bloqueado' && !e?.note?.startsWith('medio_dia'))
      }
      // Filter anchors whose span has at least one hard-blocked day
      const validAnchors = prev.filter(a => {
        if (dateRules.type === 'packages') {
          const dow = new Date(a + 'T12:00:00').getDay()
          const pkg = (dateRules.packages as any[])?.find(p => p.anchor_dow === dow)
          if (pkg) {
            for (let i = 1; i < pkg.span_days; i++) {
              if (isHardBlocked(shiftDateBy(a, i))) return false
            }
          }
        }
        if (dateRules.type === 'overnight') {
          if (isHardBlocked(shiftDateBy(a, 1))) return false
        }
        return true
      })
      setSelectedDates(expandAnchorsWithRules(validAnchors, dateRules))
      return validAnchors
    })
  // calEntries intentionally included so the filter uses up-to-date entries
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAnchorsSet, dateRules])

  // Load calendar entries. On first render also fetch all months with requested dates.
  useEffect(() => {
    const fetchEntries = async () => {
      const supabase = createClient()
      const monthsToLoad: string[] = [`${viewYear}-${pad(viewMonth + 1)}`]
      if (isFirstLoad.current && !isVisitMode) {
        // Load months for the original requested dates (pills)
        requestedDates.forEach(d => {
          const ym = d.slice(0, 7)
          if (!monthsToLoad.includes(ym)) monthsToLoad.push(ym)
        })
        // Also load month for the confirmed wedding_date (may differ from requested dates)
        if (lead.wedding_date) {
          const ym = lead.wedding_date.slice(0, 7)
          if (!monthsToLoad.includes(ym)) monthsToLoad.push(ym)
        }
      }
      const newEntries: Record<string, any> = {}
      for (const ym of monthsToLoad) {
        const [y, m] = ym.split('-').map(Number)
        const lastDay = new Date(y, m, 0).getDate()
        const { data } = await supabase.from('calendar_entries')
          .select('*').eq('user_id', userId)
          .gte('date', `${ym}-01`).lte('date', `${ym}-${pad(lastDay)}`)
        if (data) {
          // Group entries by date (a date can have 2 entries for double half-day)
          const byDate: Record<string, any[]> = {}
          data.forEach((e: any) => {
            if (!byDate[e.date]) byDate[e.date] = []
            byDate[e.date].push(e)
          })
          Object.entries(byDate).forEach(([date, arr]) => {
            if (arr.length === 1) {
              newEntries[date] = arr[0]
            } else {
              // Two entries — check if both halves are taken (fully booked)
              const bothHalves = arr.filter(e => e.note?.startsWith('medio_dia')).length === 2
              if (bothHalves) {
                // Both halves taken — synthesize a fully-booked entry (removes half-day prefix so it shows as unavailable)
                const dominated = arr.find(e => e.status === 'reservado') || arr[0]
                const rawNote = dominated.note || ''
                const pipeIdx = rawNote.indexOf('|')
                const strippedNote = rawNote.startsWith('medio_dia')
                  ? (pipeIdx >= 0 ? rawNote.slice(pipeIdx + 1) || null : null)
                  : rawNote || null
                newEntries[date] = { ...dominated, note: strippedNote }
              } else {
                // Primary entry wins
                newEntries[date] = arr[0]
              }
            }
          })
        }
      }
      // On first load: seed the calendar selection
      if (isFirstLoad.current && isVisitMode) {
        isFirstLoad.current = false
        // Pre-select the existing visit_date so it appears with the same style as a fresh selection
        if (lead.visit_date) setSelectedDates([lead.visit_date])
      }
      if (isFirstLoad.current && !isVisitMode) {
        isFirstLoad.current = false
        // If the lead has a previously confirmed wedding_date, seed from that anchor
        // so the expansion re-produces the previously selected dates.
        // Otherwise fall back to the original requested dates.
        const seedDates = lead.wedding_date
          ? [lead.wedding_date]
          : requestedDates

        const isHardBlockedIn = (entries: Record<string, any>, d: string) => {
          const e = entries[d]
          return e?.status === 'reservado' || (e?.status === 'bloqueado' && !e?.note?.startsWith('medio_dia'))
        }

        // Only filter out the anchor itself here — span conflict check happens in the
        // rulesApplied effect where dateRules is guaranteed to be loaded
        const available = seedDates.filter(d => !isHardBlockedIn(newEntries, d))
        setSelectedDates(available)
        setSelectedAnchors(available)
        setInitialAnchorsSet(true)
      }
      setCalEntries(prev => ({ ...prev, ...newEntries }))
    }
    fetchEntries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth])

  // Derived
  const unavailableRequested = useMemo(
    () => requestedDates.filter(d => {
      const e = calEntries[d]
      if (!e) return false
      const isHalf = e.note?.startsWith('medio_dia')
      return !isHalf && (e.status === 'bloqueado' || e.status === 'reservado')
    }),
    [requestedDates, calEntries]
  )
  const availableRequested = useMemo(
    () => requestedDates.filter(d => !unavailableRequested.includes(d)),
    [requestedDates, unavailableRequested]
  )
  // Dates the user added that weren't originally requested
  const extraDates = useMemo(
    () => selectedDates.filter(d => !requestedDates.includes(d)),
    [selectedDates, requestedDates]
  )

  // Other leads' visit dates — shown as informational in visit mode
  const otherLeadVisitDates = useMemo(() => {
    if (!isVisitMode) return new Set<string>()
    const s = new Set<string>()
    allLeads.forEach(l => { if (l.id !== lead.id && l.visit_date) s.add(l.visit_date) })
    return s
  }, [allLeads, lead.id, isVisitMode])

  const toggleDate = (ds: string) => {
    const entry = calEntries[ds]
    const s = entry?.status
    // Half-day entries (reservado or bloqueado ½) are soft: still selectable (the other half is free)
    const isHardBlock = !(entry?.note?.startsWith('medio_dia')) && (s === 'reservado' || s === 'bloqueado')
    if (isHardBlock) return

    // ── RANGE PICK MODE ───────────────────────────────────────────────────────
    // 1st click sets the start, 2nd click adds every selectable day in between
    // (skipping reservado/bloqueado) to selectedDates + selectedAnchors.
    if (rangeMode && !isVisitMode) {
      if (!rangeStart) { setRangeStart(ds); return }
      const a = rangeStart < ds ? rangeStart : ds
      const b = rangeStart < ds ? ds : rangeStart
      const collected: string[] = []
      const cur = new Date(a + 'T12:00:00'); const end = new Date(b + 'T12:00:00')
      while (cur <= end) {
        const day = cur.toISOString().slice(0, 10)
        const e = calEntries[day]
        const isHalf = e?.note?.startsWith('medio_dia')
        const blocked = !isHalf && (e?.status === 'reservado' || e?.status === 'bloqueado')
        if (!blocked) collected.push(day)
        cur.setDate(cur.getDate() + 1)
      }
      // If every date in the collected range is already selected → deselect (toggle off)
      const allAlreadySelected = collected.length > 0 && collected.every(d => selectedDates.includes(d))
      if (allAlreadySelected) {
        setSelectedDates(prev => prev.filter(d => !collected.includes(d)))
        setSelectedAnchors(prev => prev.filter(d => !collected.includes(d)))
        collected.forEach(d => setHalfDayMap(prev => { const n = { ...prev }; delete n[d]; return n }))
      } else {
        setSelectedDates(prev => [...new Set([...prev, ...collected])].sort())
        setSelectedAnchors(prev => [...new Set([...prev, ...collected])].sort())
      }
      setRangeStart(null)
      setRangeMode(false)
      return
    }

    // Half-day mode: 4-state cycle per date
    // not-selected → ½M → ½T → full-day → deselected
    if (halfDayMode && !isVisitMode) {
      const isSelected = selectedAnchors.includes(ds)
      const current = halfDayMap[ds]
      if (!isSelected) {
        // 1st click: select as ½ Mañana
        setSelectedDates(prev => [...new Set([...prev, ds])].sort())
        setSelectedAnchors(prev => [...new Set([...prev, ds])].sort())
        setHalfDayMap(prev => ({ ...prev, [ds]: 'medio_dia_manana' }))
      } else if (current === 'medio_dia_manana') {
        // 2nd click: ½M → ½T
        setHalfDayMap(prev => ({ ...prev, [ds]: 'medio_dia_tarde' }))
      } else if (current === 'medio_dia_tarde') {
        // 3rd click: ½T → full day (remove half-day mark, keep selected)
        setHalfDayMap(prev => { const n = { ...prev }; delete n[ds]; return n })
      } else {
        // 4th click (full day selected, no half-day): deselect entirely
        setSelectedDates(prev => prev.filter(d => d !== ds))
        setSelectedAnchors(prev => prev.filter(a => a !== ds))
      }
      return
    }

    // Package mode: clicking an anchor day selects/deselects the full span
    // Only applies when rules are active (!ignoreRules); in manual mode fall through to simple toggle
    if (!isVisitMode && !ignoreRules && dateRules?.type === 'packages') {
      const dow = new Date(ds + 'T12:00:00').getDay()
      const pkg = dateRules.packages?.find((p: any) => p.anchor_dow === dow)
      if (!pkg) return  // not a valid anchor day in rules mode
      const spanDates: string[] = []
      for (let i = 0; i < pkg.span_days; i++) {
        const dt = new Date(ds + 'T12:00:00'); dt.setDate(dt.getDate() + i)
        spanDates.push(dt.toISOString().slice(0, 10))
      }
      const hasConflict = spanDates.some(sd => {
        const e2 = calEntries[sd]
        return e2?.status === 'reservado' || (e2?.status === 'bloqueado' && !(e2?.note?.startsWith('medio_dia')))
      })
      if (hasConflict) return
      const allSelected = spanDates.every(sd => selectedDates.includes(sd))
      if (allSelected) {
        setSelectedDates(prev => prev.filter(pd => !spanDates.includes(pd)))
        setSelectedAnchors(prev => prev.filter(a => a !== ds))
        // Duration drops by this package's span
        setWeddingDuration(prev => Math.max(1, prev - pkg.span_days))
      } else {
        setSelectedDates(prev => [...prev.filter(pd => !spanDates.includes(pd)), ...spanDates])
        setSelectedAnchors(prev => {
          const next = [...prev.filter(a => a !== ds), ds]
          // Recompute total duration from all selected anchors
          const total = next.reduce((sum, a) => {
            const d = new Date(a + 'T12:00:00').getDay()
            const p = dateRules.packages?.find((pk: any) => pk.anchor_dow === d)
            return sum + (p?.span_days || 1)
          }, 0)
          setWeddingDuration(total)
          return next
        })
      }
      return
    }

    // Auto-rules: overnight — select/deselect the pair + optional buffer days
    if (!isVisitMode && !ignoreRules && dateRules?.type === 'overnight') {
      const d1 = overnightDay === 1 ? ds : shiftDate(ds, -1)
      const d2 = shiftDate(d1, 1)
      const daysBefore = Math.ceil(dateRules.days_before || 0)
      const daysAfter  = Math.ceil(dateRules.days_after  || 0)
      // Full span: days_before before d1, then d1+d2, then days_after after d2
      const getSpan = (anchor: string) => {
        const pair = shiftDate(anchor, 1)
        const sp: string[] = []
        for (let i = daysBefore; i >= 1; i--) sp.push(shiftDate(anchor, -i))
        sp.push(anchor)
        sp.push(pair)
        for (let i = 1; i <= daysAfter; i++) sp.push(shiftDate(pair, i))
        return sp
      }
      const spanDates = getSpan(d1)
      const hasConflict = spanDates.some(sd => {
        const e = calEntries[sd]
        return e?.status === 'reservado' || (e?.status === 'bloqueado' && !(e?.note?.startsWith('medio_dia')))
      })
      if (hasConflict) return
      // Deselect only when d1 is already an anchor AND its full span is applied
      const isAnchor = selectedAnchors.includes(d1)
      const fullyExpanded = spanDates.every(sd => selectedDates.includes(sd))
      if (isAnchor && fullyExpanded) {
        const otherAnchors = selectedAnchors.filter(a => a !== d1)
        const keep = new Set(otherAnchors.flatMap(a => getSpan(a)))
        setSelectedDates(prev => prev.filter(d => keep.has(d) || !spanDates.includes(d)))
        setSelectedAnchors(prev => prev.filter(a => a !== d1))
      } else {
        setSelectedDates(prev => Array.from(new Set([...prev, ...spanDates])).sort())
        setSelectedAnchors(prev => [...prev.filter(a => a !== d1), d1].sort())
      }
      return
    }

    // Auto-rules: simple with buffer days — select/deselect the anchor + buffer span
    if (!isVisitMode && !ignoreRules && dateRules?.type === 'simple' && hasAutoRules) {
      const daysBefore = Math.ceil(dateRules.days_before || 0)
      const daysAfter  = Math.ceil(dateRules.days_after  || 0)
      const getSpan = (a: string) => {
        const sp: string[] = []
        for (let i = daysBefore; i >= 1; i--) sp.push(shiftDate(a, -i))
        sp.push(a)
        for (let i = 1; i <= daysAfter; i++) sp.push(shiftDate(a, i))
        return sp
      }
      const spanDates = getSpan(ds)
      const hasConflict = spanDates.some(sd => {
        const e = calEntries[sd]
        return e?.status === 'reservado' || (e?.status === 'bloqueado' && !(e?.note?.startsWith('medio_dia')))
      })
      if (hasConflict) return
      // Deselect only when ds is already an anchor AND its full span is applied
      const isAnchor = selectedAnchors.includes(ds)
      const fullyExpanded = spanDates.every(sd => selectedDates.includes(sd))
      if (isAnchor && fullyExpanded) {
        const otherAnchors = selectedAnchors.filter(a => a !== ds)
        const keep = new Set(otherAnchors.flatMap(a => getSpan(a)))
        setSelectedDates(prev => prev.filter(d => keep.has(d) || !spanDates.includes(d)))
        setSelectedAnchors(prev => prev.filter(a => a !== ds))
      } else {
        // Add or expand: new anchor, or anchor whose buffer wasn't applied yet
        setSelectedDates(prev => Array.from(new Set([...prev, ...spanDates])).sort())
        setSelectedAnchors(prev => [...prev.filter(a => a !== ds), ds].sort())
      }
      return
    }

    if (isVisitMode) {
      setSelectedDates(prev => prev[0] === ds ? [] : [ds])
    } else {
      setSelectedDates(prev => prev.includes(ds) ? prev.filter(d => d !== ds) : [...prev, ds])
      setSelectedAnchors(prev => prev.includes(ds) ? prev.filter(a => a !== ds) : [...prev, ds])
    }
  }

  const shiftDate = (d: string, days: number) => {
    const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + days)
    return dt.toISOString().slice(0, 10)
  }

  // Whether venue rules should be auto-applied (overnight, packages, or simple with buffer days)
  const hasAutoRules = !isVisitMode && (
    dateRules?.type === 'overnight' ||
    dateRules?.type === 'packages' ||
    (dateRules?.type === 'simple' && ((dateRules.days_before || 0) > 0 || (dateRules.days_after || 0) > 0))
  )

  // Per-date half-day mode: user can mark any selected date as ½M (mañana) or ½T (tarde)
  const [halfDayMap, setHalfDayMap] = useState<Record<string, 'medio_dia_manana' | 'medio_dia_tarde'>>({})
  const [halfDayMode, setHalfDayMode] = useState(false)
  // Range-pick mode: 1st click = start, 2nd = end → fills everything in between (skipping reservado/bloqueado)
  const [rangeMode,    setRangeMode]    = useState(false)
  const [rangeStart,   setRangeStart]   = useState<string | null>(null)
  // Keep halfDayMap in sync with selectedDates — clear entries for deselected dates
  useEffect(() => {
    setHalfDayMap(prev => {
      const cleaned: typeof prev = {}
      for (const key of Object.keys(prev)) {
        if (selectedDates.includes(key)) cleaned[key] = prev[key]
      }
      return cleaned
    })
  }, [selectedDates])

  // Half-day buffer dates (days_after/before with .5 fractional) — need diagonal visual
  const halfDayBufferSet = useMemo(() => {
    return (hasAutoRules && !ignoreRules) ? computeHalfDayBuffers(selectedAnchors, dateRules) : new Set<string>()
  }, [selectedAnchors, dateRules, hasAutoRules, ignoreRules])

  const uploadBudgetFile = async (file: File): Promise<{ url: string; name: string } | null> => {
    setBudgetUploading(true)
    setBudgetError(null)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() || 'pdf'
      const path = `${userId}/budgets/${lead.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
      if (upErr) { setBudgetError('Error al subir el archivo'); return null }
      const { data: pub } = supabase.storage.from('documents').getPublicUrl(path)
      return { url: pub.publicUrl, name: file.name }
    } catch {
      setBudgetError('Error al subir el archivo')
      return null
    } finally {
      setBudgetUploading(false)
    }
  }

  const handleBudgetFileSelect = async (file: File) => {
    const allowed = ['application/pdf','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp']
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|xlsx?|docx?|png|jpe?g|webp)$/i)) {
      setBudgetError('Formato no permitido. Usa PDF, Excel, Word o imagen.')
      return
    }
    if (file.size > 20 * 1024 * 1024) { setBudgetError('El archivo no puede superar 20 MB'); return }
    setBudgetFile(file)
    setBudgetError(null)
    const result = await uploadBudgetFile(file)
    if (result) { setBudgetFileUrl(result.url); setBudgetFileName(result.name) }
  }

  const handleConfirm = async () => {
    setSaving(true)
    const calStatus: 'negociacion' | 'reservado' = isWonMode ? 'reservado' : 'negociacion'
    let leadUpdates: any = {}
    // In auto mode, selectedDates already contains rule-expanded dates (pairs / spans)
    // In manual mode with overnight, expand at confirm time
    const isOvernight = !isVisitMode && dateRules?.type === 'overnight'
    let calendarDates = [...selectedDates]

    if (isOvernight && selectedDates.length > 0 && ignoreRules) {
      // Manual overnight: expand at confirm time (auto mode already expands in toggleDate)
      const expandedSet = new Set<string>()
      selectedDates.forEach(d => {
        expandedSet.add(overnightDay === 1 ? d : shiftDate(d, -1))
        expandedSet.add(overnightDay === 1 ? shiftDate(d, 1) : d)
      })
      calendarDates = Array.from(expandedSet).sort()
      leadUpdates = {
        date_flexibility: 'range',
        wedding_date: calendarDates[0],
        wedding_date_to: calendarDates[calendarDates.length - 1],
        wedding_date_ranges: null, wedding_year: null, wedding_month: null,
      }
    } else if (!isVisitMode) {
      const hasMissingRequested = availableRequested.some(d => !selectedDates.includes(d))
      // For simple-buffer auto mode, buffer days are just calendar blocks — don't update lead dates
      const skipLeadDateUpdate = hasAutoRules && !ignoreRules && dateRules?.type === 'simple'
      if (!skipLeadDateUpdate && (extraDates.length > 0 || hasMissingRequested)) {
        const sorted = [...selectedDates].sort()
        if (sorted.length === 0) {
          leadUpdates = {}
        } else if (sorted.length === 1) {
          leadUpdates = { date_flexibility: 'exact', wedding_date: sorted[0], wedding_date_to: null, wedding_date_ranges: null, wedding_year: null, wedding_month: null }
        } else {
          const isContiguous = sorted.every((d, i) => {
            if (i === 0) return true
            const prev = new Date(sorted[i - 1] + 'T12:00:00')
            const curr = new Date(d + 'T12:00:00')
            return (curr.getTime() - prev.getTime()) / 86400000 === 1
          })
          leadUpdates = isContiguous
            ? { date_flexibility: 'range', wedding_date: sorted[0], wedding_date_to: sorted[sorted.length - 1], wedding_date_ranges: null, wedding_year: null, wedding_month: null }
            : { date_flexibility: 'multi_range', wedding_date: null, wedding_date_to: null, wedding_date_ranges: sorted.map(d => ({ from: d, to: d })), wedding_year: null, wedding_month: null }
        }
      }
    }

    // Always save duration
    if (!isVisitMode) leadUpdates.wedding_duration_days = weddingDuration

    // Save budget attachment if uploaded
    if (isBudgetMode && budgetFileUrl) {
      leadUpdates.budget_file_url  = budgetFileUrl
      leadUpdates.budget_file_name = budgetFileName
    }

    await onConfirm(leadUpdates, calendarDates, calStatus, isVisitMode, Object.keys(halfDayMap).length > 0 ? halfDayMap : undefined, isVisitMode && visitTime ? visitTime : undefined, isVisitMode ? visitDuration : undefined)
    setSaving(false)
  }

  // ── Mass-select: add all available days in the current view-month ──────────
  const selectWholeMonth = () => {
    if (isVisitMode) return
    const pad = (n: number) => String(n).padStart(2, '0')
    const monthStr = `${viewYear}-${pad(viewMonth + 1)}`

    // Collect available days (not past, not hard-blocked)
    const available: string[] = []
    for (let d = 1; d <= lastDay; d++) {
      const ds = `${monthStr}-${pad(d)}`
      if (ds < todayStr) continue
      const e = calEntries[ds]
      if (e?.status === 'reservado') continue
      if (e?.status === 'bloqueado' && !(e?.note?.startsWith('medio_dia'))) continue
      available.push(ds)
    }
    if (available.length === 0) return

    // ── Determine if we're in "already all selected" state ──
    let isAllSelected = false
    if (!ignoreRules && dateRules?.type === 'packages') {
      const anchorsInMonth = available.filter(ds => {
        const dow = new Date(ds + 'T12:00:00').getDay()
        return dateRules.packages?.some((p: any) => p.anchor_dow === dow)
      })
      isAllSelected = anchorsInMonth.length > 0 && anchorsInMonth.every(ds => selectedAnchors.includes(ds))
    } else if (!ignoreRules && dateRules?.type === 'overnight') {
      const validAnchors = available.filter(ds => {
        const db = Math.ceil(dateRules.days_before || 0)
        const da = Math.ceil(dateRules.days_after  || 0)
        const d1 = ds; const d2 = shiftDate(d1, 1)
        const span: string[] = []
        for (let i = db; i >= 1; i--) span.push(shiftDate(d1, -i))
        span.push(d1, d2)
        for (let i = 1; i <= da; i++) span.push(shiftDate(d2, i))
        return !span.some(sd => { const e = calEntries[sd]; return e?.status === 'reservado' || (e?.status === 'bloqueado' && !(e?.note?.startsWith('medio_dia'))) })
      })
      isAllSelected = validAnchors.length > 0 && validAnchors.every(ds => selectedAnchors.includes(ds))
    } else {
      isAllSelected = available.length > 0 && available.every(ds => selectedDates.includes(ds))
    }

    // ── DESELECT branch ──
    if (isAllSelected) {
      if (!ignoreRules && dateRules?.type === 'packages') {
        const anchorsInMonth = available.filter(ds => {
          const dow = new Date(ds + 'T12:00:00').getDay()
          return dateRules.packages?.some((p: any) => p.anchor_dow === dow)
        })
        // Compute all span dates for those anchors
        const spanDatesToRemove = new Set<string>()
        let removedDuration = 0
        anchorsInMonth.forEach(ds => {
          const dow = new Date(ds + 'T12:00:00').getDay()
          const pkg = dateRules.packages?.find((p: any) => p.anchor_dow === dow)
          if (!pkg) return
          for (let i = 0; i < pkg.span_days; i++) {
            const dt = new Date(ds + 'T12:00:00'); dt.setDate(dt.getDate() + i)
            spanDatesToRemove.add(dt.toISOString().slice(0, 10))
          }
          removedDuration += pkg.span_days
        })
        setSelectedDates(prev => prev.filter(d => !spanDatesToRemove.has(d)))
        setSelectedAnchors(prev => prev.filter(a => !anchorsInMonth.includes(a)))
        setWeddingDuration(prev => Math.max(1, prev - removedDuration))
      } else if (!ignoreRules && dateRules?.type === 'overnight') {
        const db = Math.ceil(dateRules.days_before || 0)
        const da = Math.ceil(dateRules.days_after  || 0)
        const anchorsToRemove = available.filter(ds => selectedAnchors.includes(ds))
        const spanDatesToRemove = new Set<string>()
        anchorsToRemove.forEach(ds => {
          const d1 = ds; const d2 = shiftDate(d1, 1)
          for (let i = db; i >= 1; i--) spanDatesToRemove.add(shiftDate(d1, -i))
          spanDatesToRemove.add(d1); spanDatesToRemove.add(d2)
          for (let i = 1; i <= da; i++) spanDatesToRemove.add(shiftDate(d2, i))
        })
        setSelectedDates(prev => prev.filter(d => !spanDatesToRemove.has(d)))
        setSelectedAnchors(prev => prev.filter(a => !anchorsToRemove.includes(a)))
        setWeddingDuration(prev => {
          const remaining = selectedAnchors.filter(a => !anchorsToRemove.includes(a)).length
          return Math.max(1, remaining * 2)
        })
      } else {
        setSelectedDates(prev => prev.filter(d => !available.includes(d)))
        if (hasAutoRules && !ignoreRules) setSelectedAnchors(prev => prev.filter(a => !available.includes(a)))
      }
      return
    }

    // ── SELECT branch (original logic) ──
    if (!ignoreRules && dateRules?.type === 'packages') {
      let newDates    = [...selectedDates]
      let newAnchors  = [...selectedAnchors]
      let addedSpan   = 0
      available.forEach(ds => {
        const dow = new Date(ds + 'T12:00:00').getDay()
        const pkg = dateRules.packages?.find((p: any) => p.anchor_dow === dow)
        if (!pkg || newAnchors.includes(ds)) return
        const span: string[] = []
        for (let i = 0; i < pkg.span_days; i++) {
          const dt = new Date(ds + 'T12:00:00'); dt.setDate(dt.getDate() + i)
          span.push(dt.toISOString().slice(0, 10))
        }
        if (span.some(sd => { const e = calEntries[sd]; return e?.status === 'reservado' || (e?.status === 'bloqueado' && !(e?.note?.startsWith('medio_dia'))) })) return
        span.forEach(sd => { if (!newDates.includes(sd)) newDates.push(sd) })
        newAnchors.push(ds)
        addedSpan += pkg.span_days
      })
      setSelectedDates([...new Set(newDates)].sort())
      setSelectedAnchors([...new Set(newAnchors)].sort())
      if (addedSpan > 0) setWeddingDuration(prev => prev + addedSpan)
    } else if (!ignoreRules && dateRules?.type === 'overnight') {
      const db = Math.ceil(dateRules.days_before || 0)
      const da = Math.ceil(dateRules.days_after  || 0)
      let newDates   = [...selectedDates]
      let newAnchors = [...selectedAnchors]
      available.forEach(ds => {
        const d1 = ds; const d2 = shiftDate(d1, 1)
        const span: string[] = []
        for (let i = db; i >= 1; i--) span.push(shiftDate(d1, -i))
        span.push(d1, d2)
        for (let i = 1; i <= da; i++) span.push(shiftDate(d2, i))
        if (newAnchors.includes(d1)) return
        if (span.some(sd => { const e = calEntries[sd]; return e?.status === 'reservado' || (e?.status === 'bloqueado' && !(e?.note?.startsWith('medio_dia'))) })) return
        span.forEach(sd => { if (!newDates.includes(sd)) newDates.push(sd) })
        newAnchors.push(d1)
      })
      setSelectedDates([...new Set(newDates)].sort())
      setSelectedAnchors([...new Set(newAnchors)].sort())
      setWeddingDuration(([...new Set(newAnchors)]).length * 2)
    } else {
      setSelectedDates(prev => [...new Set([...prev, ...available])].sort())
      if (hasAutoRules && !ignoreRules) setSelectedAnchors(prev => [...new Set([...prev, ...available])].sort())
    }
  }

  const lastDay  = new Date(viewYear, viewMonth + 1, 0).getDate()
  let startDow   = new Date(viewYear, viewMonth, 1).getDay() - 1
  if (startDow < 0) startDow = 6
  const cells    = [...Array(startDow).fill(null), ...Array.from({ length: lastDay }, (_, i) => i + 1)]
  const todayStr = todayIso()
  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) } else setViewMonth(m => m - 1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) } else setViewMonth(m => m + 1) }

  // Header config per mode
  const modeConfig = isVisitMode    ? { label: 'Agendar visita',          icon: <Landmark    size={16} />, gradient: 'linear-gradient(135deg,#fef3c7 0%,#fdf6ee 100%)', accent: 'var(--gold)',      avatarBg: 'var(--gold)' }
    : isWonMode      ? { label: 'Confirmar boda',            icon: <PartyPopper size={16} />, gradient: 'linear-gradient(135deg,#f0fdf4 0%,#fafdf8 100%)', accent: '#16a34a',        avatarBg: 'var(--sage)' }
    : isBudgetMode   ? { label: 'Presupuesto',               icon: <Receipt     size={16} />, gradient: 'linear-gradient(135deg,#fef3c7 0%,#fdf6ee 100%)', accent: 'var(--gold)',      avatarBg: 'var(--gold)' }
    : isEditDatesMode ? { label: 'Editar fechas propuestas', icon: <CalendarDays size={16} />, gradient: 'linear-gradient(135deg,#f0f4ff 0%,#f8f9ff 100%)', accent: '#4f6ef7',        avatarBg: '#4f6ef7' }
    :                  { label: 'Selecciona las fechas propuestas', icon: <CalendarDays size={16} />, gradient: 'linear-gradient(135deg,#f5f0ea 0%,#fafaf8 100%)', accent: 'var(--espresso)', avatarBg: 'var(--espresso)' }

  const dcmInitials = getInitials(lead.name || '')
  const canConfirm = !saving && !budgetUploading && (!isVisitMode || selectedDates.length > 0)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,15,12,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header — compact single row */}
        <div style={{ position: 'relative', padding: '14px 20px 12px', background: modeConfig.gradient, borderTopLeftRadius: 20, borderTopRightRadius: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Back arrow — shown when opened from edit modal */}
          {onBack && (
            <button onClick={onBack} aria-label="Volver a editar"
              style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.75)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--espresso)', flexShrink: 0 }}>
              <ChevronLeft size={15} />
            </button>
          )}
          {/* Icon badge */}
          <div style={{ width: 36, height: 36, borderRadius: 10, background: modeConfig.avatarBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            {modeConfig.icon}
          </div>
          {/* Titles */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--espresso)', lineHeight: 1.2 }}>{modeConfig.label}</div>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lead.name || 'Pareja sin nombre'}
              {!isVisitMode && !isWonMode && !isBudgetMode && (
                <span style={{ marginLeft: 6, color: modeConfig.accent, fontWeight: 600 }}>
                  · {isEditDatesMode ? 'actualiza las fechas en el calendario' : 'selecciona fechas en el calendario'}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar"
            style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.75)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--espresso)', flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '14px 20px' }}>

          {/* Existing visit notice — shown when re-scheduling a visit that wasn't cancelled */}
          {isVisitMode && lead.visit_date && (
            <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: '#fffbeb', border: '1.5px solid #fde68a', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>📅</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 2 }}>Visita ya agendada</div>
                <div style={{ fontSize: 13, color: '#78350f', fontWeight: 500 }}>
                  {new Date(lead.visit_date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  {lead.visit_time && <span style={{ marginLeft: 8, fontWeight: 400 }}>· {lead.visit_time}h</span>}
                  {lead.visit_duration && <span style={{ marginLeft: 6, color: '#b45309', fontSize: 12 }}>({lead.visit_duration >= 60 ? `${Math.floor(lead.visit_duration / 60)}h${lead.visit_duration % 60 > 0 ? ` ${lead.visit_duration % 60}min` : ''}` : `${lead.visit_duration} min`})</span>}
                </div>
                <div style={{ fontSize: 11, color: '#b45309', marginTop: 3 }}>Selecciona una fecha nueva en el calendario para cambiarla</div>
              </div>
            </div>
          )}

          {/* Requested / confirmed dates — compact pills */}
          {!isVisitMode && hasRequestedDates && (
            <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: '#faf8f5', border: '1px solid var(--ivory)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={10} />
                {isWonMode ? 'Fechas propuestas a la pareja' : isBudgetMode && lead.status !== 'new' ? 'Fechas propuestas a la pareja' : 'Fecha que quiere la pareja'}
              </div>
              {unavailableRequested.length === requestedDates.length && (
                <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
                  ✕ Todas las fechas solicitadas están bloqueadas o reservadas. Selecciona otras fechas en el calendario.
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {requestedDates.filter(d => {
                  // Never show past dates in the pills (can't select them)
                  if (d < todayStr) return false
                  // Show dates that are available or half-day (or already selected)
                  const entryStatus = calEntries[d]?.status
                  const entryNote = calEntries[d]?.note
                  const isHalf = entryNote?.startsWith('medio_dia')
                  const isUnavailable = !isHalf && (entryStatus === 'reservado' || entryStatus === 'bloqueado')
                  return !isUnavailable || selectedDates.includes(d)
                }).map(d => {
                  const entryStatus = calEntries[d]?.status
                  const entryNote = calEntries[d]?.note
                  const isHalf2 = entryNote?.startsWith('medio_dia')
                  const isUnavailable = !isHalf2 && (entryStatus === 'reservado' || entryStatus === 'bloqueado')
                  const isChecked = selectedDates.includes(d)
                  // For requested dates pills: always allow DESELECTING (even if blocked/unavailable)
                  // Allow SELECTING only if not unavailable
                  const handleRequestedClick = () => {
                    if (isChecked) {
                      // Always allow deselect — direct remove from selectedDates
                      setSelectedDates(prev => prev.filter(x => x !== d))
                      setSelectedAnchors(prev => prev.filter(x => x !== d))
                      return
                    }
                    if (isUnavailable) return
                    const dow = new Date(d + 'T12:00:00').getDay()
                    const isPkgMode = !isVisitMode && !ignoreRules && dateRules?.type === 'packages'
                    const isAnchor = isPkgMode && !!dateRules?.packages?.find((p: any) => p.anchor_dow === dow)
                    if (isAnchor || !isPkgMode) {
                      toggleDate(d)
                    } else {
                      setSelectedDates(prev => [...prev, d])
                    }
                  }
                  return (
                    <button key={d} type="button"
                      onClick={handleRequestedClick}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '6px 12px', borderRadius: 20,
                        cursor: (isChecked || !isUnavailable) ? 'pointer' : 'not-allowed',
                        background: isUnavailable && !isChecked ? '#fef2f2' : isChecked ? '#fef3c7' : '#f9fafb',
                        border: `1.5px solid ${isUnavailable && !isChecked ? '#fca5a5' : isChecked ? '#f59e0b' : 'var(--ivory)'}`,
                        fontSize: 12, fontWeight: 600,
                        color: isUnavailable && !isChecked ? '#9ca3af' : isChecked ? '#92400e' : 'var(--charcoal)',
                        textDecoration: isUnavailable && !isChecked ? 'line-through' : 'none',
                        transition: 'all 0.15s', outline: 'none',
                      }}>
                      {isChecked && (
                        <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#f59e0b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1 }}>✓</span>
                        </span>
                      )}
                      {isUnavailable && !isChecked && (
                        <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>✕</span>
                      )}
                      {!isChecked && !isUnavailable && (
                        <span style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid #d1d5db', flexShrink: 0 }} />
                      )}
                      {formatDateLabel(d)}
                      {entryStatus === 'negociacion' && !isUnavailable && (
                        <span style={{ fontSize: 9, background: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: 8, fontWeight: 700, border: '1px solid #fde68a' }}>Neg.</span>
                      )}
                    </button>
                  )
                })}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={10} style={{ flexShrink: 0 }} />
                Duración solicitada:{' '}
                <strong style={{ color: 'var(--charcoal)', marginLeft: 2 }}>
                  {lead.wedding_duration_days || 1} {(lead.wedding_duration_days || 1) === 1 ? 'día' : 'días'}
                </strong>
              </div>
              {unavailableRequested.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertTriangle size={11} /> {unavailableRequested.length} fecha{unavailableRequested.length > 1 ? 's' : ''} no disponible{unavailableRequested.length > 1 ? 's' : ''} — se guardarán como referencia.
                </div>
              )}
              {/* Budget mode: show original request as subtle reference below proposed dates */}
              {isBudgetMode && lead.status !== 'new' && (() => {
                const origFlex = lead.original_date_flexibility
                const origDate1 = lead.original_wedding_date
                const origDate2 = lead.original_wedding_date_to
                const origRanges = lead.original_wedding_date_ranges
                if (!origFlex || origFlex === 'flexible' || !origDate1) return null
                const fmtShort = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                let origTxt = ''
                if (origFlex === 'exact') origTxt = fmtShort(origDate1)
                else if (origFlex === 'range') origTxt = `${fmtShort(origDate1)}${origDate2 ? ` – ${fmtShort(origDate2)}` : ''}`
                else if (origFlex === 'multi_range' && origRanges?.length) origTxt = origRanges.map((r: any, i: number) => `Op.${i+1}: ${fmtShort(r.from)}`).join(' · ')
                if (!origTxt) return null
                return (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--ivory)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--warm-gray)' }}>
                    <CalendarDays size={10} style={{ flexShrink: 0 }} />
                    <span>Solicitó originalmente: <span style={{ color: 'var(--charcoal)' }}>{origTxt}</span></span>
                  </div>
                )
              })()}
            </div>
          )}

          {!isVisitMode && !hasRequestedDates && (
            <div style={{ marginBottom: 10, fontSize: 11, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={10} style={{ flexShrink: 0 }} />
              Duración solicitada:{' '}
              <strong style={{ color: 'var(--charcoal)', marginLeft: 2 }}>
                {lead.wedding_duration_days || 1} {(lead.wedding_duration_days || 1) === 1 ? 'día' : 'días'}
              </strong>
            </div>
          )}

          {!isVisitMode && !hasRequestedDates && (
            <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fef9ec', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
              Este lead no tiene fechas exactas. Selecciona fechas disponibles en el calendario.
            </div>
          )}

          {!isVisitMode && !ignoreRules && dateRules?.type === 'packages' && (() => {
            const DOW_NAMES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
            const PKG_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6']
            const pkgs: any[] = dateRules.packages || []
            return (
              <div style={{ marginBottom: 14 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>📦</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--charcoal)' }}>Venue con paquetes</span>
                  </div>
                  {/* Calendar legend for package mode */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, lineHeight: 1 }}>+</span>
                      <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>Disponible</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 3, background: 'repeating-linear-gradient(45deg, #f3f4f6 0px, #f3f4f6 4px, #e9eaeb 4px, #e9eaeb 8px)' }} />
                      <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>No aplica</span>
                    </div>
                  </div>
                </div>
                {/* Package cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pkgs.map((pkg: any, pi: number) => {
                    const color = PKG_COLORS[pi % PKG_COLORS.length]
                    const anchorName = DOW_NAMES[pkg.anchor_dow]
                    // Build span day names
                    const spanDows: string[] = []
                    for (let i = 0; i < pkg.span_days; i++) {
                      spanDows.push(DOW_NAMES[(pkg.anchor_dow + i) % 7])
                    }
                    const lastDow = DOW_NAMES[(pkg.anchor_dow + pkg.span_days - 1) % 7]
                    const isSelected = selectedAnchors.some(a => new Date(a + 'T12:00:00').getDay() === pkg.anchor_dow)
                    return (
                      <div key={pi} style={{
                        border: `1.5px solid ${isSelected ? color : '#e5e7eb'}`,
                        borderRadius: 8,
                        overflow: 'hidden',
                        background: isSelected ? `${color}08` : '#fafafa',
                        transition: 'all 0.15s',
                      }}>
                        {/* Color bar + name */}
                        <div style={{ background: color, padding: '5px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
                            {pkg.name || `Paquete ${pi + 1}`}
                          </span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                            {pkg.span_days} {pkg.span_days === 1 ? 'día' : 'días'} · {anchorName}→{lastDow}
                          </span>
                        </div>
                        {/* Day strip */}
                        <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {spanDows.map((d, di) => (
                            <div key={di} style={{
                              padding: '2px 7px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: di === 0 ? 700 : 500,
                              background: di === 0 ? color : `${color}30`,
                              color: di === 0 ? '#fff' : color,
                            }}>
                              {d}
                            </div>
                          ))}
                          {isSelected && (
                            <span style={{ marginLeft: 6, fontSize: 10, color: color, fontWeight: 600 }}>✓ seleccionado</span>
                          )}
                          {!isSelected && (
                            <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--warm-gray)' }}>clic en {anchorName} para seleccionar</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Overnight: day 1 or day 2 selector — show in auto mode always, in manual mode only when dates selected */}
          {!isVisitMode && dateRules?.type === 'overnight' && (!ignoreRules || selectedDates.length > 0) && (
            <div style={{ marginBottom: 14, padding: '12px 14px', background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                ¿Cuándo es la boda?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { val: 1 as const, label: 'Fecha seleccionada = boda', sub: `Calendario: boda + día siguiente` },
                  { val: 2 as const, label: 'Fecha seleccionada = check-out', sub: `Calendario: día anterior + boda` },
                ].map(opt => (
                  <button key={opt.val} type="button" onClick={() => setOvernightDay(opt.val)} style={{
                    flex: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    border: `2px solid ${overnightDay === opt.val ? '#7c3aed' : 'var(--ivory)'}`,
                    background: overnightDay === opt.val ? '#faf5ff' : '#fff',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: overnightDay === opt.val ? '#7c3aed' : 'var(--charcoal)', marginBottom: 2 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Calendar section */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {isVisitMode ? 'Fecha de visita' : 'Calendario'}
                </div>
                {hasAutoRules && (
                  <button type="button" onClick={() => { setIgnoreRules(r => !r); setSelectedDates([]); setSelectedAnchors([]) }}
                    title={ignoreRules ? 'Las reglas del venue están desactivadas — haz clic para reactivarlas' : 'Las reglas del venue se aplican automáticamente al seleccionar fechas'}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 9px', borderRadius: 20, cursor: 'pointer', outline: 'none',
                      fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
                      border: ignoreRules ? '1.5px solid #d1d5db' : '1.5px solid #a78bfa',
                      background: ignoreRules ? '#f9fafb' : '#ede9fe',
                      color: ignoreRules ? '#9ca3af' : '#5b21b6',
                    }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: ignoreRules ? '#d1d5db' : '#7c3aed', flexShrink: 0 }} />
                    {ignoreRules ? 'Sin reglas' : 'Reglas activas'}
                  </button>
                )}
              </div>
              {!isVisitMode && (
                <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                  {hasRequestedDates ? '★ = fecha solicitada' : 'Clic para seleccionar'}
                </div>
              )}
            </div>

            <div style={{ border: '1px solid var(--ivory)', borderRadius: 12, overflow: 'hidden' }}>
              {/* Month nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: halfDayMode ? '#fffbeb' : 'var(--cream)', borderBottom: '1px solid var(--ivory)', transition: 'background 0.2s' }}>
                <button onClick={prevMonth} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--ivory)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--charcoal)' }}><ChevronLeft size={14} /></button>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, color: 'var(--espresso)', fontWeight: 500 }}>{MONTHS[viewMonth]} {viewYear}</span>
                  {!isVisitMode && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {!isWonMode && (<>
                        <button type="button"
                          onClick={() => { setRangeMode(m => { const next = !m; if (!next) setRangeStart(null); if (next) setHalfDayMode(false); return next }) }}
                          title={rangeMode ? 'Salir del modo rango' : 'Marca dos fechas y se seleccionará todo entre medias (saltando reservado/bloqueado)'}
                          style={{ fontSize: 10, padding: '2px 10px', borderRadius: 20, cursor: 'pointer', outline: 'none', fontWeight: 700, letterSpacing: '0.03em', transition: 'all 0.15s',
                            border: rangeMode ? '1px solid var(--gold)' : '1px solid var(--gold)',
                            background: rangeMode ? 'var(--gold)' : 'transparent',
                            color: rangeMode ? '#fff' : 'var(--gold)' }}>
                          ↔ Rango
                        </button>
                        <button type="button" onClick={selectWholeMonth}
                          title="Añade todos los días disponibles de este mes a la selección"
                          style={{ fontSize: 10, padding: '2px 10px', borderRadius: 20, cursor: 'pointer', outline: 'none', border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontWeight: 600, letterSpacing: '0.03em' }}>
                          + Todo el mes
                        </button>
                      </>)}
                      {selectedAnchors.length > 0 && (
                        <button type="button" onClick={() => { setHalfDayMode(m => !m); if (!halfDayMode) setRangeMode(false) }}
                          title={halfDayMode ? 'Salir del modo medio día' : 'Marcar fechas como medio día (mañana o tarde)'}
                          style={{ fontSize: 10, padding: '2px 10px', borderRadius: 20, cursor: 'pointer', outline: 'none', fontWeight: 700, letterSpacing: '0.03em', transition: 'all 0.15s',
                            border: halfDayMode ? '1px solid #d97706' : '1px solid #fde68a',
                            background: halfDayMode ? '#d97706' : '#fffbeb',
                            color: halfDayMode ? '#fff' : '#b45309' }}>
                          ½ día
                        </button>
                      )}
                    </div>
                  )}
                  {rangeMode && !isVisitMode && (
                    <div style={{ marginTop: 4, fontSize: 10, color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.05em' }}>
                      {rangeStart
                        ? <>Inicio: <strong style={{ textTransform: 'capitalize' }}>{new Date(rangeStart + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</strong> — clic en la fecha de fin</>
                        : 'Modo rango — clic en la fecha de inicio'
                      }
                    </div>
                  )}
                </div>
                <button onClick={nextMonth} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--ivory)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--charcoal)' }}><ChevronRight size={14} /></button>
              </div>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--ivory)' }}>
                {DAYS_SHORT.map((d, i) => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: i >= 5 ? 'var(--gold)' : 'var(--warm-gray)', letterSpacing: '0.08em', padding: '10px 0' }}>{d}</div>
                ))}
              </div>
              {/* Grid — border-based, no gap */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {cells.map((day, i) => {
                  if (!day) return <div key={`e-${i}`} style={{ minHeight: 60, borderBottom: '1px solid var(--ivory)', borderRight: i % 7 !== 6 ? '1px solid var(--ivory)' : 'none' }} />
                  const ds = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
                  const entry = calEntries[ds]
                  const entryStatus = entry?.status || 'libre'
                  const cfg = CAL_AVAIL_CFG[entryStatus] || CAL_AVAIL_CFG.libre
                  const isRequested      = requestedDates.includes(ds)
                  const isSelected       = selectedDates.includes(ds)
                  const isOtherVisit     = isVisitMode && otherLeadVisitDates.has(ds)
                  const isHalfDay        = !!(entry?.note?.startsWith('medio_dia'))
                  // Half-day entries are NOT fully unavailable — the other half is still free
                  const isUnavailable = !isHalfDay && (entryStatus === 'reservado' || entryStatus === 'bloqueado')
                  const isToday       = ds === todayStr
                  const isPast        = ds < todayStr
                  // In package mode (rules active), only anchor_dow days are clickable
                  const isPackageMode  = !isVisitMode && !ignoreRules && dateRules?.type === 'packages'
                  const dow2           = new Date(ds + 'T12:00:00').getDay()
                  const isPkgAnchorDay = isPackageMode && !!dateRules.packages?.find((p: any) => p.anchor_dow === dow2)
                  const isPartOfSpan   = isPackageMode && !isPkgAnchorDay && selectedDates.includes(ds)
                  // In package mode, requested dates that are anchor days should be clickable
                  // In pkg mode: anchor days + already-selected span days (to allow deselecting via anchor click)
                  const canClick       = !isPast && !isUnavailable && (!isPackageMode || isPkgAnchorDay)
                  const dow = (startDow + day - 1) % 7
                  const isWeekend = dow >= 5
                  // Wedding day = what the user explicitly clicked; buffer = auto-added by rule
                  const isWeddingDay     = hasAutoRules && !ignoreRules ? selectedAnchors.includes(ds) : isSelected
                  const isHalfDayBuffer  = hasAutoRules && !ignoreRules && halfDayBufferSet.has(ds)
                  const isBufferDay      = hasAutoRules && !ignoreRules && isSelected && !isWeddingDay && !isHalfDayBuffer
                  // Dual role: this wedding day is ALSO a buffer of another anchor (e.g. click 27→[27,28], click 28→[28,29]: 28 is both)
                  const isAlsoBuffer = isWeddingDay && hasAutoRules && !ignoreRules && (() => {
                    if (dateRules?.type === 'overnight') {
                      const db = Math.ceil(dateRules.days_before || 0)
                      const da = Math.ceil(dateRules.days_after  || 0)
                      return selectedAnchors.some(a => {
                        if (a === ds) return false
                        const pair = shiftDate(a, 1)
                        const diff = Math.round((new Date(ds + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)
                        const diffFromPair = Math.round((new Date(ds + 'T12:00:00').getTime() - new Date(pair + 'T12:00:00').getTime()) / 86400000)
                        // ds is the d2 of another anchor, or within days_before/after of another anchor's span
                        return diff === 1 || (diffFromPair >= 1 && diffFromPair <= da) || (diff <= -1 && diff >= -db)
                      })
                    }
                    if (dateRules?.type === 'simple') {
                      const db = Math.ceil(dateRules.days_before || 0)
                      const da = Math.ceil(dateRules.days_after  || 0)
                      return selectedAnchors.some(a => {
                        if (a === ds) return false
                        const diff = Math.round((new Date(ds + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)
                        return (diff >= 1 && diff <= da) || (diff <= -1 && diff >= -db)
                      })
                    }
                    return false
                  })()
                  const isExtra = isSelected && !isRequested && !isBufferDay
                  const otherLeadCount = dateLeadCounts[ds] || 0
                  const cellIdx = i  // for borderRight calc

                  // In package mode: non-anchor days that aren't unavailable or already part of a selected span
                  const isPkgBlocked = isPackageMode && !isPkgAnchorDay && !isPartOfSpan && !isUnavailable && !isPast
                  // Anchor day that's free, not yet selected, and available to click
                  const isPkgAvailable = isPackageMode && isPkgAnchorDay && !isUnavailable && !isPast && !isSelected && !isPartOfSpan

                  return (
                    <button key={ds} onClick={() => {
                      if (isPast) return
                      if (isUnavailable || (isHalfDay && !isSelected)) {
                        setDateInfo(prev => prev === ds ? null : ds)
                        return
                      }
                      if (canClick) toggleDate(ds)
                    }}
                      title={isUnavailable || (isHalfDay && !isSelected) ? 'Ver info de esta reserva' : isOtherVisit ? 'Otro lead tiene visita este día — puedes escoger igualmente' : isHalfDay ? '½ Mañana/Tarde — el otro medio está libre' : isPkgBlocked ? 'Este día no es inicio de ningún paquete' : isAlsoBuffer ? 'Boda + buffer del día anterior (doble rol)' : isBufferDay ? 'Día de buffer (regla del venue)' : isRequested ? 'Fecha solicitada — clic para marcar/desmarcar' : isPkgAvailable ? 'Inicio de paquete — disponible' : otherLeadCount > 0 ? `${otherLeadCount} lead(s) interesado(s)` : ''}
                      style={{
                        minHeight: 60, border: 'none',
                        borderBottom: '1px solid var(--ivory)',
                        borderRight: cellIdx % 7 !== 6 ? '1px solid var(--ivory)' : 'none',
                        background: isOtherVisit && !isSelected
                          ? '#eff6ff'
                          : isBufferDay
                          ? '#fdf6ee'
                          : isHalfDayBuffer
                          ? 'linear-gradient(135deg, #fdf6ee 50%, #ffffff 50%)'
                          : isSelected && halfDayMap[ds] === 'medio_dia_manana'
                          ? 'linear-gradient(135deg, #fef3c7 50%, #ffffff 50%)'
                          : isSelected && halfDayMap[ds] === 'medio_dia_tarde'
                          ? 'linear-gradient(135deg, #ffffff 50%, #fef3c7 50%)'
                          : isSelected
                          ? '#fef3c7'
                          : isPartOfSpan
                          ? '#fef3c7'
                          : isHalfDay
                          ? `linear-gradient(135deg, ${cfg.bg} 50%, #ffffff 50%)`
                          : isPast ? '#faf8f5'
                          : isUnavailable ? cfg.bg
                          : isPkgBlocked
                          ? 'repeating-linear-gradient(45deg, #f3f4f6 0px, #f3f4f6 4px, #e9eaeb 4px, #e9eaeb 8px)'
                          : isPkgAvailable
                          ? '#fff'
                          : entryStatus === 'negociacion' ? '#fffcf0'
                          : isWeekend ? '#faf7f4'
                          : '#fff',
                        cursor: isPast ? 'default' : isPkgBlocked ? 'not-allowed' : 'pointer',
                        opacity: isPast ? 0.35 : 1,
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                        justifyContent: 'space-between', padding: '7px 7px 5px',
                        boxShadow: rangeMode && rangeStart === ds
                          ? 'inset 0 0 0 2.5px var(--gold)'
                          : isUnavailable && entryStatus === 'reservado'
                          ? 'inset 0 0 0 2px #f87171'
                          : isUnavailable && entryStatus === 'bloqueado'
                          ? 'inset 0 0 0 2px #9ca3af'
                          : isOtherVisit && !isSelected
                          ? 'inset 0 0 0 1.5px #93c5fd'
                          : isBufferDay
                          ? 'inset 0 0 0 1.5px #f59e0b'
                          : isHalfDayBuffer
                          ? 'inset 0 0 0 1.5px #f59e0b'
                          : isSelected
                          ? 'inset 0 0 0 2px #d97706'
                          : isPartOfSpan
                          ? 'inset 0 0 0 1.5px #f59e0b'
                          : isHalfDay && !isSelected
                          ? `inset 0 0 0 1px ${cfg.border}`
                          : isPkgAvailable
                          ? 'none'
                          : isToday ? 'inset 0 0 0 2px var(--gold)'
                          : dateInfo === ds
                          ? 'inset 0 0 0 2.5px #6366f1'
                          : isRequested && !isUnavailable ? 'inset 0 0 0 1.5px #fde68a'
                          : 'none',
                        position: 'relative', transition: 'background 0.1s', outline: 'none',
                      }} disabled={isPkgBlocked || isPast}>
                      {/* Day number */}
                      <span style={{
                        fontSize: 15, fontWeight: isToday ? 700 : 500, lineHeight: 1, fontFamily: 'Manrope, sans-serif',
                        color: isPast ? 'var(--stone)'
                          : isPkgBlocked ? '#b0b7c0'
                          : isBufferDay || isHalfDayBuffer || isSelected || isPartOfSpan ? '#92400e'
                          : isPkgAvailable ? 'var(--charcoal)'
                          : isToday ? 'var(--gold)'
                          : isWeekend ? 'var(--gold)'
                          : 'var(--charcoal)',
                      }}>{day}</span>
                      {/* Bottom row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 'auto' }}>
                        {/* Requested star — solicitada por la pareja */}
                        {isRequested && !isUnavailable && !isPast && (
                          <span title="Fecha solicitada por la pareja" style={{ fontSize: 9, color: isSelected ? '#d97706' : '#ca8a04', lineHeight: 1, fontWeight: 700 }}>★</span>
                        )}
                        {/* Other leads count — orange circle badge */}
                        {otherLeadCount > 0 && !isUnavailable && !isPast && (
                          <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: isRequested ? 2 : 0, flexShrink: 0 }}>
                            <span style={{ fontSize: 8, color: '#fff', fontWeight: 700, lineHeight: 1 }}>{otherLeadCount}</span>
                          </div>
                        )}
                        {/* Status symbol — only for unavailable (×) and half-day (½) */}
                        {(isUnavailable || isHalfDay) && !isPkgBlocked && !isPartOfSpan && (
                          <span
                            title={isUnavailable ? cfg.label : 'Medio día — el otro ½ está libre'}
                            style={{ fontSize: isUnavailable ? 16 : 9, color: isUnavailable ? cfg.dot : cfg.dot, fontWeight: 900, lineHeight: 1, marginLeft: 'auto' }}>
                            {isUnavailable ? '×' : '½'}
                          </span>
                        )}
                        {/* Span day indicator (part of a selected package) */}
                        {isPartOfSpan && (
                          <span style={{ fontSize: 8, color: '#d97706', fontWeight: 700, lineHeight: 1, marginLeft: 'auto' }}>→</span>
                        )}
                        {/* Package available dot — small green pip bottom-right */}
                        {isPkgAvailable && !isRequested && (
                          <span style={{ fontSize: 8, color: '#16a34a', fontWeight: 700, lineHeight: 1, marginLeft: 'auto' }}>+</span>
                        )}
                      </div>
                      {/* Other lead visit badge — blue circle with 'V' */}
                      {isOtherVisit && !isSelected && (
                        <div style={{ position: 'absolute', top: 3, right: 3, width: 15, height: 15, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Visita de otro lead este día">
                          <span style={{ fontSize: 8, color: '#fff', fontWeight: 700, lineHeight: 1 }}>V</span>
                        </div>
                      )}
                      {/* Buffer day indicator (pure buffer, not also a wedding day) */}
                      {isBufferDay && (
                        <div style={{ position: 'absolute', top: 3, right: 3, width: 15, height: 15, borderRadius: '50%', background: '#f59e0b', opacity: 0.55, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1 }}>+</span>
                        </div>
                      )}
                      {/* Half-day buffer indicator */}
                      {isHalfDayBuffer && (
                        <div style={{ position: 'absolute', top: 3, right: 3, width: 15, height: 15, borderRadius: '50%', background: '#f59e0b', opacity: 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ color: '#fff', fontSize: 8, fontWeight: 700, lineHeight: 1 }}>½</span>
                        </div>
                      )}
                      {/* Wedding day badge — with optional [+] prefix when also a buffer of another anchor */}
                      {isSelected && !isBufferDay && !isHalfDayBuffer && (
                        <div style={{ position: 'absolute', top: 3, right: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                          {isAlsoBuffer && (
                            <div style={{ width: 13, height: 13, borderRadius: '50%', background: '#f59e0b', opacity: 0.65, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ color: '#fff', fontSize: 8, fontWeight: 700, lineHeight: 1 }}>+</span>
                            </div>
                          )}
                          <div style={{ width: 15, height: 15, borderRadius: '50%', background: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: '#fff', fontSize: halfDayMap[ds] ? 7 : 9, fontWeight: 700, lineHeight: 1 }}>
                              {halfDayMap[ds] === 'medio_dia_manana' ? '½M' : halfDayMap[ds] === 'medio_dia_tarde' ? '½T' : '✓'}
                            </span>
                          </div>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Date info panel — shown when user clicks a reserved/blocked/half-day cell */}
          {dateInfo && (() => {
            const infoEntry = calEntries[dateInfo]
            const infoStatus: string = infoEntry?.status || 'libre'
            const isInfoVisit = isVisitMode && otherLeadVisitDates.has(dateInfo)
            // Look up lead: from calEntry lead_id, or from allLeads visit_date (for otherVisit dates)
            const infoLead = infoEntry?.lead_id
              ? allLeads.find((l: any) => l.id === infoEntry.lead_id)
              : isInfoVisit
              ? allLeads.find((l: any) => l.id !== lead.id && l.visit_date === dateInfo)
              : null
            const rawNote: string = infoEntry?.note || ''
            const displayNote = rawNote.startsWith('medio_dia_')
              ? (rawNote === 'medio_dia_manana' ? 'Medio día — mañana' : 'Medio día — tarde')
              : rawNote
            const statusColor: Record<string, string> = {
              reservado: '#ef4444', bloqueado: '#6b7280', negociacion: '#f59e0b', libre: '#10b981',
            }
            const statusLabel: Record<string, string> = {
              reservado: 'Reservado', bloqueado: 'Bloqueado', negociacion: 'En negociación', libre: 'Libre',
            }
            const borderColor: Record<string, string> = {
              reservado: '#fca5a5', bloqueado: '#d1d5db', negociacion: '#fde68a', libre: '#bbf7d0',
            }
            const bgColor: Record<string, string> = {
              reservado: '#fff5f5', bloqueado: '#f9fafb', negociacion: '#fffbeb', libre: '#f0fdf4',
            }
            const panelBg    = isInfoVisit ? '#eff6ff' : (bgColor[infoStatus] || '#f9fafb')
            const panelBorder = isInfoVisit ? '#93c5fd' : (borderColor[infoStatus] || '#e5e7eb')
            const labelColor  = isInfoVisit ? '#1d4ed8' : (statusColor[infoStatus] || '#374151')
            const statusText  = isInfoVisit ? 'Visita de otro lead' : (statusLabel[infoStatus] || infoStatus)
            const parsedDate = new Date(dateInfo + 'T12:00:00')
            const dateStr = parsedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            return (
              <div style={{ margin: '8px 0 4px', padding: '12px 14px', borderRadius: 10, background: panelBg, border: `1.5px solid ${panelBorder}`, position: 'relative' }}>
                <button type="button" onClick={() => setDateInfo(null)}
                  style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#9ca3af', padding: 2, lineHeight: 1 }}
                  title="Cerrar">×</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: labelColor, background: `${labelColor}18`, padding: '2px 8px', borderRadius: 20, border: `1px solid ${labelColor}40` }}>
                    {statusText}
                  </span>
                  <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{dateStr}</span>
                </div>
                {(infoLead || isInfoVisit) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {infoLead && (
                      <>
                        <div style={{ fontSize: 12, color: '#374151' }}>
                          <span style={{ fontWeight: 600 }}>Pareja: </span>
                          {infoLead.couple_name || infoLead.name || '—'}
                        </div>
                        {infoLead.name && infoLead.couple_name && infoLead.name !== infoLead.couple_name && (
                          <div style={{ fontSize: 11, color: '#6b7280' }}>
                            <span style={{ fontWeight: 600 }}>Contacto: </span>
                            {infoLead.name}
                          </div>
                        )}
                        {infoLead.wedding_date && (
                          <div style={{ fontSize: 11, color: '#6b7280' }}>
                            <span style={{ fontWeight: 600 }}>Boda: </span>
                            {new Date(infoLead.wedding_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </div>
                        )}
                      </>
                    )}
                    {isInfoVisit && !infoLead && (
                      <div style={{ fontSize: 12, color: '#374151' }}>Visita agendada de otro cliente</div>
                    )}
                  </div>
                )}
                {displayNote && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: infoLead ? 4 : 0 }}>
                    <span style={{ fontWeight: 600 }}>Nota: </span>{displayNote}
                  </div>
                )}
                {!infoLead && !displayNote && !isInfoVisit && (
                  <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Sin información adicional</div>
                )}
              </div>
            )
          })()}

          {/* Visit time & duration — only in visit mode when a date is selected */}
          {isVisitMode && selectedDates.length > 0 && (() => {
            const timeSlots = Array.from({ length: 27 }, (_, i) => {
              const totalMin = 8 * 60 + i * 30
              const h = Math.floor(totalMin / 60)
              const m = totalMin % 60
              return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
            })
            const durationOpts: { value: number; label: string }[] = [
              { value: 30,  label: '30 min'   },
              { value: 45,  label: '45 min'   },
              { value: 60,  label: '1 hora'   },
              { value: 90,  label: '1h 30min' },
              { value: 120, label: '2 horas'  },
              { value: 150, label: '2h 30min' },
              { value: 180, label: '3 horas'  },
            ]
            return (
              <div style={{ margin: '8px 0 10px', padding: '12px 14px', borderRadius: 10, background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Detalles de la visita
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Time picker */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Hora</label>
                    <select
                      value={visitTime}
                      onChange={e => setVisitTime(e.target.value)}
                      style={{ fontSize: 13, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #86efac', background: '#fff', color: visitTime ? '#111827' : '#9ca3af', outline: 'none', cursor: 'pointer', minWidth: 110 }}>
                      <option value=''>Sin especificar</option>
                      {timeSlots.map(t => <option key={t} value={t}>{t}h</option>)}
                    </select>
                  </div>
                  {/* Duration picker */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Duración</label>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {durationOpts.map(opt => (
                        <button key={opt.value} type='button'
                          onClick={() => setVisitDuration(opt.value)}
                          style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20, border: visitDuration === opt.value ? '1.5px solid #16a34a' : '1.5px solid #d1fae5', background: visitDuration === opt.value ? '#16a34a' : '#fff', color: visitDuration === opt.value ? '#fff' : '#374151', cursor: 'pointer', fontWeight: visitDuration === opt.value ? 700 : 400, transition: 'all 0.1s', outline: 'none' }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {visitTime && (
                  <div style={{ fontSize: 11, color: '#15803d', marginTop: 8, fontWeight: 500 }}>
                    Visita programada: {visitTime}h · {durationOpts.find(o => o.value === visitDuration)?.label || `${visitDuration} min`}
                    {' · '}hasta {(() => {
                      const [hh, mm] = visitTime.split(':').map(Number)
                      const endMin = hh * 60 + mm + visitDuration
                      return `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}h`
                    })()}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, marginTop: 8 }}>
            {/* Libre */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#fff', border: '1px solid #e5e7eb' }} />
              <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Libre</span>
            </div>
            {/* Reservado — full day */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: CAL_AVAIL_CFG.reservado.bg, border: `1.5px solid ${CAL_AVAIL_CFG.reservado.border}` }} />
              <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 900 }}>×</span>
              <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Reservado</span>
            </div>
            {/* Bloqueado — full day */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: CAL_AVAIL_CFG.bloqueado.bg, border: `1.5px solid ${CAL_AVAIL_CFG.bloqueado.border}` }} />
              <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 900 }}>×</span>
              <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Bloqueado</span>
            </div>
            {/* Medio día — half available */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 14, height: 14, background: `linear-gradient(135deg, ${CAL_AVAIL_CFG.reservado.bg} 50%, #fff 50%)`, border: `1px solid ${CAL_AVAIL_CFG.reservado.border}`, borderRadius: 2 }} />
              <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700 }}>½</span>
              <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Medio día — otro ½ libre</span>
            </div>
            {!isVisitMode && hasRequestedDates && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 9, color: '#ca8a04', fontWeight: 700 }}>★</span>
                <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Solicitada</span>
              </div>
            )}
            {!isVisitMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#fef3c7', border: '1.5px solid #d97706' }} />
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>✓</span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Seleccionada</span>
              </div>
            )}
            {!isVisitMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 14, height: 14, borderRadius: 7, background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>2</span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Otros leads</span>
              </div>
            )}
            {isVisitMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 14, height: 14, borderRadius: 7, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>V</span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Visita otro lead</span>
              </div>
            )}
          </div>

          {/* ── Duration + Summary — single compact card ──────────────────────── */}
          <div style={{ padding: '10px 14px', background: 'var(--cream)', border: '1px solid var(--ivory)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {isVisitMode ? (
              selectedDates.length === 0
                ? <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Haz click en una fecha disponible para agendar la visita</span>
                : <span style={{ fontSize: 12, color: 'var(--sage)', fontWeight: 600 }}><Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Visita: {formatDateLabel(selectedDates[0])}</span>
            ) : selectedDates.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>
                Sin fechas seleccionadas — el lead pasará a {isWonMode ? 'confirmado' : 'seguimiento'} sin entradas en el calendario
              </span>
            ) : (
              <>
                {/* Selection summary */}
                <span style={{ fontSize: 12, color: 'var(--charcoal)', fontWeight: 600 }}>
                  ✓ {(() => {
                    if (hasAutoRules && !ignoreRules) {
                      const n = selectedDates.length
                      const rule = dateRules?.type === 'overnight' ? 'overnight' : dateRules?.type === 'packages' ? 'paquete' : 'fecha + buffer'
                      return `${n} día${n > 1 ? 's' : ''} · ${rule}`
                    }
                    const confirmed = availableRequested.filter(d => selectedDates.includes(d)).length
                    const extras = extraDates.length
                    const parts = []
                    if (confirmed > 0) parts.push(`${confirmed} fecha${confirmed > 1 ? 's' : ''}`)
                    if (extras > 0) parts.push(`+${extras} alternativa${extras > 1 ? 's' : ''}`)
                    return parts.join(' ') || `${selectedDates.length} fecha${selectedDates.length > 1 ? 's' : ''}`
                  })()}
                </span>

                {/* Separator */}
                <span style={{ color: 'var(--ivory)', fontSize: 14, lineHeight: 1 }}>·</span>

                {/* Duration — inline edit */}
                {!(dateRules?.type === 'packages' && !ignoreRules) && (
                  <>
                    {editingDuration ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <select style={{ fontSize: 12, padding: '2px 6px', borderRadius: 6, border: '1.5px solid var(--gold)', background: '#fff', color: 'var(--espresso)', fontFamily: 'Manrope,sans-serif', fontWeight: 700, cursor: 'pointer', outline: 'none' }}
                          value={weddingDuration} onChange={e => setWeddingDuration(Number(e.target.value))}>
                          {Array.from({ length: Math.max(1, selectedDates.length || 10) }, (_, i) => i + 1).map(d => (
                            <option key={d} value={d}>{d} {d === 1 ? 'día' : 'días'}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => setEditingDuration(false)} style={{ fontSize: 11, color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 700 }}>OK</button>
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>{weddingDuration} {weddingDuration === 1 ? 'día' : 'días'}</span>
                        <button type="button" onClick={() => setEditingDuration(true)} style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600, textDecoration: 'underline' }}>Editar</button>
                      </span>
                    )}
                    <span style={{ color: 'var(--ivory)', fontSize: 14, lineHeight: 1 }}>·</span>
                  </>
                )}

                {/* Calendar status */}
                <span style={{ fontSize: 12, fontWeight: 700, color: isWonMode ? '#16a34a' : '#d97706' }}>
                  {isWonMode ? 'Reservado' : 'En negociación'}
                </span>
              </>
            )}
          </div>


          {/* Budget attachment */}
          {isBudgetMode && (
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--ivory)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Paperclip size={11} /> Adjuntar presupuesto <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
              </div>

              {/* Already uploaded or lead already has a file */}
              {budgetFileUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1.5px solid #86efac' }}>
                  <CheckCircle2 size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#15803d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{budgetFileName}</div>
                    <div style={{ fontSize: 11, color: '#16a34a' }}>Adjunto listo para guardar</div>
                  </div>
                  <a href={budgetFileUrl} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11, color: '#16a34a', textDecoration: 'underline', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Ver
                  </a>
                  <button type="button" onClick={() => { setBudgetFileUrl(''); setBudgetFileName(''); setBudgetFile(null) }}
                    style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(22,163,74,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#16a34a' }}>
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setBudgetDragOver(true) }}
                  onDragLeave={() => setBudgetDragOver(false)}
                  onDrop={e => { e.preventDefault(); setBudgetDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleBudgetFileSelect(f) }}
                  onClick={() => budgetInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${budgetDragOver ? 'var(--gold)' : 'var(--ivory)'}`,
                    borderRadius: 10, padding: '20px 16px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    cursor: 'pointer', background: budgetDragOver ? '#fffbeb' : '#fafaf8',
                    transition: 'all 0.15s',
                  }}>
                  <input ref={budgetInputRef} type="file" style={{ display: 'none' }}
                    accept=".pdf,.xlsx,.xls,.docx,.doc,.png,.jpg,.jpeg,.webp"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleBudgetFileSelect(f) }} />
                  {budgetUploading ? (
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--gold)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                      Subiendo…
                    </div>
                  ) : (
                    <>
                      <Upload size={20} style={{ color: 'var(--gold)', opacity: 0.7 }} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--charcoal)' }}>Arrastra el archivo aquí o haz clic</div>
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>PDF, Excel, Word o imagen · máx. 20 MB</div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {budgetError && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={11} /> {budgetError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              background: isWonMode ? 'var(--sage)' : isBudgetMode ? 'var(--gold)' : isEditDatesMode ? '#4f6ef7' : undefined,
              opacity: !canConfirm ? 0.5 : 1,
            }}>
            {saving ? 'Guardando...'
              : isVisitMode    ? <><Calendar     size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Confirmar visita</>
              : isWonMode      ? <><PartyPopper  size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Confirmar boda</>
              : isBudgetMode   ? <><Receipt      size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Pasar a presupuesto</>
              : isEditDatesMode ? <><CalendarDays size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Guardar fechas propuestas</>
              : '✓ Pasar a seguimiento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Initials helper ───────────────────────────────────────────────────────────
const CONNECTOR_WORDS = new Set(['y','e','i','o','u','de','del','la','el','los','las','and','of','&','da','di','von','van','le','les'])
function getInitials(name: string): string {
  const words = (name || '').trim().split(/\s+/).filter(w => w.length > 0)
  if (words.length === 0) return '?'
  // Si hay un conector en medio → tomar el primer nombre de cada grupo
  // Ej: "Maria Lopez Y Pablo Motos" → idx=2 → ["Maria","Lopez"] + ["Pablo","Motos"] → "MP"
  // Ej: "Lara y Paco" → idx=1 → ["Lara"] + ["Paco"] → "LP"
  const connIdx = words.findIndex((w, i) => i > 0 && i < words.length - 1 && CONNECTOR_WORDS.has(w.toLowerCase()))
  if (connIdx !== -1) {
    const a = words[0]?.[0]?.toUpperCase() ?? ''
    const b = words[connIdx + 1]?.[0]?.toUpperCase() ?? ''
    return (a + b) || '?'
  }
  // Sin conector → filtrar artículos/preposiciones y coger las dos primeras palabras significativas
  const meaningful = words.filter(w => !CONNECTOR_WORDS.has(w.toLowerCase()))
  if (meaningful.length === 0) return '?'
  return meaningful.slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

// ── Time ago helper (for new leads) ───────────────────────────────────────────
function timeAgo(dateStr: string): { text: string; urgent: boolean; warning: boolean } {
  const ms = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(ms / 3600000)
  if (hours < 1) return { text: 'hace <1h', urgent: false, warning: false }
  if (hours < 24) return { text: `hace ${hours}h`, urgent: false, warning: hours >= 4 }
  const days = Math.floor(hours / 24)
  return { text: `hace ${days}d`, urgent: true, warning: false }
}

// ── Lead Row ───────────────────────────────────────────────────────────────────
function LeadRow({ lead, tab, onMove, onEdit, onDelete, onDetail, onDateConfirm }: {
  lead: any; tab: Tab
  onMove: (id: string, s: DbStatus) => void
  onEdit: (l: any) => void
  onDelete: (id: string) => void
  onDetail: (l: any) => void
  onDateConfirm: (lead: any, s: DbStatus) => void
}) {

  return (
    <div className="card" style={{ padding: 0, overflow: 'visible' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 10 }}>
        {/* Urgency stripe */}
        {(() => {
          const days = lead.date_flexibility === 'exact' || !lead.date_flexibility ? (lead.wedding_date ? Math.ceil((new Date(lead.wedding_date + 'T12:00:00').getTime() - Date.now()) / 86400000) : null) : null
          const color = days !== null && days > 0 ? urgencyColor(days) : 'var(--ivory)'
          return <div style={{ width: 4, background: color, flexShrink: 0, borderRadius: '10px 0 0 10px' }} />
        })()}

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Info row — clickable */}
          <div style={{ padding: '12px 16px 10px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', minWidth: 0 }}
            onClick={() => onEdit(lead)}>

            {/* Name + badges */}
            <div style={{ minWidth: 160, maxWidth: 200, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</div>
                {tab === 'new' && lead.created_at && (() => {
                  const ta = timeAgo(lead.created_at)
                  return (
                    <span style={{ fontSize: 10, fontWeight: 500, color: ta.urgent ? 'var(--rose)' : ta.warning ? 'var(--gold)' : 'var(--warm-gray)', whiteSpace: 'nowrap' }}>
                      {ta.text}
                    </span>
                  )
                })()}
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {lead.source === 'wedding_planner' ? (
                  <span style={{ fontSize: 10, background: 'rgba(139,92,246,0.1)', color: '#7c3aed', padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>
                    🎯 Planner
                  </span>
                ) : lead.source && (
                  <span style={{ fontSize: 10, background: 'var(--ivory)', color: 'var(--warm-gray)', padding: '1px 7px', borderRadius: 10 }}>
                    {SOURCE_LABEL[lead.source] || lead.source}
                  </span>
                )}
                {(tab === 'en_seguimiento' || tab === 'visit' || tab === 'budget') && (
                  <span style={{ fontSize: 10, background: 'var(--gold-light)', color: 'var(--espresso)', padding: '1px 7px', borderRadius: 10, fontWeight: 500 }}>
                    {SUB_STATUS_LABEL[lead.status as DbStatus]}
                  </span>
                )}
              </div>
            </div>

            {/* Date */}
            <div style={{ minWidth: 120, flexShrink: 0 }}>
              {(() => {
                const { line1, line2, color } = formatLeadDate(lead)
                return (
                  <>
                    <div style={{ fontSize: 12, color: color || 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Calendar size={11} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                      {line1}
                    </div>
                    {line2 && <div style={{ fontSize: 11, color: color || 'var(--warm-gray)', fontWeight: 600, marginTop: 2 }}>{line2}</div>}
                  </>
                )
              })()}
              {tab === 'visit' && lead.visit_date && (
                <div style={{ fontSize: 11, color: lead.status === 'post_visit' ? 'var(--warm-gray)' : 'var(--gold)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Landmark size={11} /> {lead.status === 'post_visit' ? 'Visita: ' : ''}{new Date(lead.visit_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </div>
              )}
              {tab === 'confirmed' && lead.wedding_date && (
                <div style={{ fontSize: 12, color: 'var(--sage)', fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <PartyPopper size={11} /> {new Date(lead.wedding_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
              {tab === 'confirmed' && lead.visit_date && lead.visit_date >= todayIso() && (
                <div style={{ fontSize: 11, color: 'var(--sage)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Landmark size={11} /> Visita: {new Date(lead.visit_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </div>
              )}
            </div>

            {/* Guests + budget */}
            <div style={{ minWidth: 80, flexShrink: 0 }}>
              {lead.guests && (
                <div style={{ fontSize: 12, color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Users size={11} style={{ color: 'var(--warm-gray)' }} /> {lead.guests} inv.
                </div>
              )}
              {lead.budget && lead.budget !== 'sin_definir' && (
                <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{BUDGET_LABEL[lead.budget]}</div>
              )}
              {lead.budget_file_url && (
                <div style={{ fontSize: 10, color: '#16a34a', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                  <Paperclip size={10} /> PDF
                </div>
              )}
            </div>

            {/* Email + phone */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {lead.email && (
                <div style={{ fontSize: 12, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Mail size={11} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} /> {lead.email}
                </div>
              )}
              {lead.phone && (
                <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Phone size={10} style={{ flexShrink: 0 }} /> {lead.phone}
                </div>
              )}
            </div>

            <ChevronRight size={14} style={{ color: 'var(--stone)', flexShrink: 0 }} />
          </div>

          {/* Actions row */}
          <div style={{ padding: '7px 14px 10px', background: 'var(--cream)', borderTop: '1px solid var(--ivory)' }}>
            <QuickActions lead={lead} tab={tab} onMove={onMove} onEdit={onEdit} onDelete={onDelete} onDateConfirm={onDateConfirm} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── En Seguimiento Dropdown Button ────────────────────────────────────────────
function EnSeguimientoBtn({ lead, canProposal, onDateConfirm }: {
  lead: any; canProposal: boolean; onDateConfirm: (lead: any, s: DbStatus) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />}
      <button className="qa qa-ghost" onClick={() => setOpen(o => !o)} style={{ gap: 4 }}>
        <ChevronRight size={11} /> En seguimiento <ChevronDown size={9} style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, background: '#fff', border: '1px solid #e5ddd5', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.1)', padding: 4, minWidth: 200 }}>
          <button
            className="qa qa-ghost"
            style={{ width: '100%', borderRadius: 7, border: 'none', justifyContent: 'flex-start', background: 'transparent' }}
            onClick={() => { onDateConfirm(lead, 'contacted'); setOpen(false) }}>
            <ChevronRight size={11} /> Mover a en seguimiento
          </button>
          {canProposal
            ? <a href={`/proposals/new?lead_id=${lead.id}`} className="qa qa-ghost"
                style={{ width: '100%', borderRadius: 7, border: 'none', justifyContent: 'flex-start', background: 'transparent' }}
                onClick={() => setOpen(false)}>
                <Zap size={11} /> PDF digital
              </a>
            : <span className="qa qa-ghost qa-locked"
                style={{ width: '100%', borderRadius: 7, border: 'none', justifyContent: 'flex-start', background: 'transparent' }}
                title="Disponible en plan Premium — actualiza para crear propuestas digitales">
                <Zap size={11} /> PDF digital <LockKeyhole size={10} />
              </span>
          }
        </div>
      )}
    </div>
  )
}

// ── Presupuesto Dropdown Button ────────────────────────────────────────────────
function PresupuestoBtn({ lead, canProposal, onMove, onDateConfirm }: {
  lead: any; canProposal: boolean
  onMove: (id: string, s: DbStatus) => void
  onDateConfirm: (lead: any, s: DbStatus) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />}
      <button className="qa qa-ghost" onClick={() => setOpen(o => !o)} style={{ gap: 4 }}>
        <Receipt size={11} /> Presupuesto <ChevronDown size={9} style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, background: '#fff', border: '1px solid #e5ddd5', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.1)', padding: 4, minWidth: 200 }}>
          <button
            className="qa qa-ghost"
            style={{ width: '100%', borderRadius: 7, border: 'none', justifyContent: 'flex-start', background: 'transparent' }}
            onClick={() => { onDateConfirm(lead, 'budget_sent'); setOpen(false) }}>
            <ChevronRight size={11} /> Mover a presupuesto
          </button>
          {canProposal
            ? <a href={`/proposals/new?lead_id=${lead.id}`} className="qa qa-ghost"
                style={{ width: '100%', borderRadius: 7, border: 'none', justifyContent: 'flex-start', background: 'transparent' }}
                onClick={() => setOpen(false)}>
                <Zap size={11} /> Presupuesto digital
              </a>
            : <span className="qa qa-ghost qa-locked"
                style={{ width: '100%', borderRadius: 7, border: 'none', justifyContent: 'flex-start', background: 'transparent' }}
                title="Disponible en plan Premium — actualiza para crear presupuestos digitales">
                <Zap size={11} /> Presupuesto digital <LockKeyhole size={10} />
              </span>
          }
        </div>
      )}
    </div>
  )
}

// ── Overflow menu (⋯ secondary actions) ──────────────────────────────────────
function MoreMenu({ items }: { items: { label: string; icon: React.ReactNode; danger?: boolean; locked?: boolean; lockedHint?: string; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false)
  if (!items.length) return null
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />}
      <button className="qa qa-ghost" onClick={() => setOpen(o => !o)} style={{ padding: '3px 7px', minWidth: 0 }} title="Más acciones">
        ···
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 5px)', right: 0, zIndex: 50, background: '#fff', border: '1px solid #e5ddd5', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.1)', padding: 4, minWidth: 180 }}>
          {items.map((item, i) => (
            item.locked ? (
              <div key={i} title={item.lockedHint || 'Disponible en plan Premium'}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 7, fontSize: 12, fontWeight: 500, color: 'var(--warm-gray)', opacity: 0.6, cursor: 'default', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{item.icon}{item.label}</span>
                <LockKeyhole size={10} />
              </div>
            ) : (
              <button key={i} onClick={() => { item.onClick(); setOpen(false) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: item.danger ? '#dc2626' : 'var(--charcoal)', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = item.danger ? '#fef2f2' : 'var(--cream)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {item.icon}{item.label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  )
}

// ── Quick Actions ──────────────────────────────────────────────────────────────
function QuickActions({ lead, tab, onMove, onEdit, onDelete, onDateConfirm }: {
  lead: any; tab: Tab
  onMove: (id: string, s: DbStatus) => void
  onEdit: (l: any) => void
  onDelete: (id: string) => void
  onDateConfirm: (lead: any, s: DbStatus) => void
}) {
  const { propuestas: canProposal } = usePlanFeatures()
  const isPostVisit = lead.status === 'post_visit'

  // Edit button — always pinned to the right
  const EditBtn = () => (
    <button className="qa qa-ghost" onClick={() => onEdit(lead)} style={{ marginLeft: 'auto' }}>
      <Edit2 size={11} /> Editar
    </button>
  )

  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', width: '100%' }}>

      {tab === 'new' && (<>
        {lead.source === 'wedding_planner' && (
          <>
            <button className="qa" style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.2)', fontWeight: 600 }}
              onClick={async () => {
                const supabase = (await import('@/lib/supabase')).createClient()
                await supabase.from('wp_client_venues').update({ availability_status: 'available' }).eq('lead_id', lead.id)
                onMove(lead.id, 'contacted')
              }}>
              ✓ Disponible
            </button>
            <button className="qa" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.15)' }}
              onClick={async () => {
                const supabase = (await import('@/lib/supabase')).createClient()
                await supabase.from('wp_client_venues').update({ availability_status: 'unavailable' }).eq('lead_id', lead.id)
                onMove(lead.id, 'lost')
              }}>
              No disponible
            </button>
          </>
        )}
        {lead.source !== 'wedding_planner' && <EnSeguimientoBtn lead={lead} canProposal={canProposal} onDateConfirm={onDateConfirm} />}
        <MoreMenu items={[
          { label: 'Enviar presupuesto', icon: <Receipt    size={11} />, onClick: () => onDateConfirm(lead, 'budget_sent') },
          { label: 'Agendar visita',     icon: <Calendar   size={11} />, onClick: () => onDateConfirm(lead, 'visit_scheduled') },
          { label: 'Perdido',            icon: <XCircle    size={11} />, danger: true, onClick: () => onMove(lead.id, 'lost') },
        ]} />
        <EditBtn />
      </>)}

      {tab === 'en_seguimiento' && (<>
        <button className="qa qa-success" onClick={() => onDateConfirm(lead, 'won')}><PartyPopper size={11} /> Confirmar boda</button>
        <button className="qa qa-ghost" onClick={() => onDateConfirm(lead, 'visit_scheduled')}><Calendar size={11} /> Agendar visita</button>
        <MoreMenu items={[
          { label: 'Enviar presupuesto', icon: <Receipt    size={11} />, onClick: () => onDateConfirm(lead, 'budget_sent') },
          { label: 'PDF digital',        icon: <FileText   size={11} />, locked: !canProposal, lockedHint: 'Disponible en plan Premium', onClick: () => window.location.href = '/proposals' },
          { label: 'Cambiar fechas',     icon: <Calendar   size={11} />, onClick: () => onDateConfirm(lead, 'contacted') },
          { label: 'Volver a nuevos',    icon: <RotateCcw  size={11} />, onClick: () => onMove(lead.id, 'new') },
          { label: 'Perdido',            icon: <XCircle    size={11} />, danger: true, onClick: () => onMove(lead.id, 'lost') },
        ]} />
        <EditBtn />
      </>)}

      {tab === 'visit' && !isPostVisit && (<>
        <button className="qa qa-success" onClick={() => onDateConfirm(lead, 'won')}><PartyPopper size={11} /> Confirmar boda</button>
        <button className="qa qa-ghost" onClick={() => onMove(lead.id, 'post_visit')}><CheckCircle size={11} /> Visita realizada</button>
        <MoreMenu items={[
          { label: 'Editar visita',    icon: <Calendar  size={11} />, onClick: () => onDateConfirm(lead, 'visit_scheduled') },
          { label: 'Presupuesto',      icon: <Receipt   size={11} />, onClick: () => onDateConfirm(lead, 'budget_sent') },
          { label: 'En seguimiento',   icon: <RotateCcw size={11} />, onClick: () => onMove(lead.id, 'contacted') },
          { label: 'Perdido',          icon: <XCircle   size={11} />, danger: true, onClick: () => onMove(lead.id, 'lost') },
        ]} />
        <EditBtn />
      </>)}

      {tab === 'visit' && isPostVisit && (<>
        <button className="qa qa-success" onClick={() => onDateConfirm(lead, 'won')}><PartyPopper size={11} /> Confirmar boda</button>
        <PresupuestoBtn lead={lead} canProposal={canProposal} onMove={onMove} onDateConfirm={onDateConfirm} />
        <MoreMenu items={[
          { label: 'Reagendar visita', icon: <Calendar  size={11} />, onClick: () => onDateConfirm(lead, 'visit_scheduled') },
          { label: 'En seguimiento',   icon: <RotateCcw size={11} />, onClick: () => onMove(lead.id, 'contacted') },
          { label: 'Perdido',          icon: <XCircle   size={11} />, danger: true, onClick: () => onMove(lead.id, 'lost') },
        ]} />
        <EditBtn />
      </>)}

      {tab === 'budget' && (<>
        <button className="qa qa-success" onClick={() => onDateConfirm(lead, 'won')}><PartyPopper size={11} /> Confirmar boda</button>
        <button className="qa qa-ghost" onClick={() => onDateConfirm(lead, 'visit_scheduled')}><Calendar size={11} /> Agendar visita</button>
        <MoreMenu items={[
          { label: 'Post-visita',     icon: <CheckCircle size={11} />, onClick: () => onMove(lead.id, 'post_visit') },
          { label: 'En seguimiento',  icon: <RotateCcw   size={11} />, onClick: () => onMove(lead.id, 'contacted') },
          { label: 'Perdido',         icon: <XCircle     size={11} />, danger: true, onClick: () => onMove(lead.id, 'lost') },
        ]} />
        <EditBtn />
      </>)}

      {tab === 'confirmed' && (<>
        {canProposal
          ? <a href="/proposals" className="qa qa-ghost"><ExternalLink size={11} /> Propuesta</a>
          : <span className="qa qa-ghost qa-locked" title="Disponible en plan Premium"><FileText size={11} /> Propuesta <LockKeyhole size={11} /></span>}
        <MoreMenu items={[
          { label: 'Cancelar boda', icon: <XCircle size={11} />, danger: true, onClick: () => onMove(lead.id, 'lost') },
          { label: 'Eliminar',      icon: <Trash2  size={11} />, danger: true, onClick: () => onDelete(lead.id) },
        ]} />
        <EditBtn />
      </>)}

      {tab === 'lost' && (<>
        <button className="qa qa-ghost" onClick={() => onMove(lead.id, 'contacted')}><RotateCcw size={11} /> Reactivar</button>
        <MoreMenu items={[
          { label: 'Eliminar', icon: <Trash2 size={11} />, danger: true, onClick: () => onDelete(lead.id) },
        ]} />
        <EditBtn />
      </>)}

    </div>
  )
}


// ── Detail Drawer ──────────────────────────────────────────────────────────────
const COMM_TYPES: { value: string; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'nota',      label: 'Nota',      icon: <Edit2 size={11} />,          color: 'var(--warm-gray)' },
  { value: 'llamada',   label: 'Llamada',   icon: <Phone size={11} />,          color: '#2563eb' },
  { value: 'email',     label: 'Email',     icon: <Mail size={11} />,           color: '#7c3aed' },
  { value: 'whatsapp',  label: 'WhatsApp',  icon: <MessageCircle size={11} />,  color: '#16a34a' },
]

function DetailDrawer({ lead, tab, onClose, onEdit, onDelete, onMove, onDateConfirm, onUpdateLead }: {
  lead: any; tab: Tab
  onClose: () => void; onEdit: (l: any) => void
  onDelete: (id: string) => void; onMove: (id: string, s: DbStatus) => void
  onDateConfirm: (lead: any, s: DbStatus) => void
  onUpdateLead: (id: string, updates: any) => void
}) {
  const { propuestas: canProposal } = usePlanFeatures()
  const [commText, setCommText] = useState('')
  const [commType, setCommType] = useState('nota')
  const [commSaving, setCommSaving] = useState(false)

  const communications: any[] = Array.isArray(lead.communications) ? lead.communications : []

  const addComm = async () => {
    if (!commText.trim()) return
    setCommSaving(true)
    const entry = { id: crypto.randomUUID(), text: commText.trim(), type: commType, created_at: new Date().toISOString() }
    const updated = [entry, ...communications]
    const supabase = createClient()
    const { error } = await supabase.from('leads').update({ communications: updated }).eq('id', lead.id)
    if (!error) { onUpdateLead(lead.id, { communications: updated }); setCommText('') }
    setCommSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }} onClick={onClose}>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 420, background: '#fff', boxShadow: '-8px 0 40px rgba(0,0,0,0.12)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 600, color: 'var(--espresso)' }}>{lead.name}</div>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 4 }}>
              {SUB_STATUS_LABEL[lead.status as DbStatus]} · {SOURCE_LABEL[lead.source] || lead.source}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onEdit(lead)} style={{ background: 'none', border: '1px solid var(--ivory)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--charcoal)' }}>
              <Edit2 size={12} /> Editar
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}><X size={18} /></button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '20px 24px' }}>
          {/* Confirmed: wedding date banner with change button */}
          {tab === 'confirmed' && (
            <div style={{ marginBottom: 20, padding: '16px 18px', background: 'linear-gradient(135deg, #fdf2f8, #fce7f3)', border: '1px solid #fbcfe8', borderRadius: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#be185d', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                <Flower2 size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Fecha de boda confirmada
              </div>
              {lead.wedding_date ? (
                <>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#831843', fontFamily: 'Cormorant Garamond, Georgia, serif', marginBottom: 4 }}>
                    {new Date(lead.wedding_date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  {(() => {
                    const days = Math.ceil((new Date(lead.wedding_date + 'T12:00:00').getTime() - Date.now()) / 86400000)
                    return days > 0
                      ? <div style={{ fontSize: 12, color: '#be185d', fontWeight: 500 }}>{days} días restantes</div>
                      : <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Fecha pasada</div>
                  })()}
                </>
              ) : (
                <div style={{ fontSize: 14, color: '#be185d' }}>Sin fecha asignada</div>
              )}
              <button
                onClick={() => onDateConfirm(lead, 'won')}
                style={{ marginTop: 12, fontSize: 12, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid #f9a8d4', background: '#fff', color: '#be185d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={12} /> Cambiar fecha
              </button>
            </div>
          )}

          {(() => {
            const { line1, line2, color } = formatLeadDate(lead)
            return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {tab !== 'confirmed' && (
              <InfoBlock icon={<Calendar size={13} />} label="Fecha de boda"
                value={line1} sub={line2} subColor={color} />
            )}
            {lead.visit_date && (
              <InfoBlock icon={<Landmark size={13} />} label="Fecha de visita"
                value={new Date(lead.visit_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} />
            )}
            <InfoBlock icon={<Users size={13} />} label="Invitados" value={lead.guests ? `${lead.guests} personas` : '—'} />
            <InfoBlock icon={null} label="Presupuesto" value={BUDGET_LABEL[lead.budget] || '—'} />
            <InfoBlock icon={null} label="Ceremonia" value={CEREMONY_LABEL[lead.ceremony_type] || '—'} />
            {lead.style && <InfoBlock icon={null} label="Estilo" value={lead.style} />}
          </div>
            )
          })()}

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Contacto</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lead.email && (
                <a href={`mailto:${lead.email}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--charcoal)', textDecoration: 'none', padding: '8px 12px', background: 'var(--cream)', borderRadius: 8 }}>
                  <Mail size={14} style={{ color: 'var(--warm-gray)' }} /> {lead.email}
                </a>
              )}
              {lead.phone && (
                <a href={`tel:${lead.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--charcoal)', textDecoration: 'none', padding: '8px 12px', background: 'var(--cream)', borderRadius: 8 }}>
                  <Phone size={14} style={{ color: 'var(--warm-gray)' }} /> {lead.phone}
                </a>
              )}
              {lead.whatsapp && (
                <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--sage)', textDecoration: 'none', padding: '8px 12px', background: 'var(--sage-light)', borderRadius: 8, border: '1px solid var(--sage)' }}>
                  <MessageCircle size={14} /> WhatsApp: {lead.whatsapp}
                </a>
              )}
            </div>
          </div>

          {lead.notes && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Notas</div>
              <div style={{ fontSize: 13, color: 'var(--charcoal)', background: 'var(--cream)', padding: '12px 14px', borderRadius: 8, lineHeight: 1.6, borderLeft: '3px solid var(--gold)' }}>
                {lead.notes}
              </div>
            </div>
          )}

          {/* ── Log de comunicaciones ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Comunicaciones</div>

            {/* Añadir entrada */}
            <div style={{ background: 'var(--cream)', borderRadius: 10, padding: '12px 14px', marginBottom: 12, border: '1px solid var(--ivory)' }}>
              {/* Selector de tipo */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {COMM_TYPES.map(ct => (
                  <button key={ct.value} type="button" onClick={() => setCommType(ct.value)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontWeight: 500,
                      border: `1px solid ${commType === ct.value ? ct.color : 'var(--ivory)'}`,
                      background: commType === ct.value ? ct.color : 'transparent',
                      color: commType === ct.value ? '#fff' : 'var(--warm-gray)',
                    }}>
                    {ct.icon} {ct.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <textarea
                  value={commText} onChange={e => setCommText(e.target.value)}
                  placeholder="Ej: Llamé, confirmaron que quieren ver el venue en mayo…"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComm() } }}
                  style={{ flex: 1, fontSize: 12, padding: '8px 10px', borderRadius: 7, border: '1px solid var(--ivory)', resize: 'none', minHeight: 60, lineHeight: 1.5, outline: 'none', fontFamily: 'Manrope, sans-serif', color: 'var(--charcoal)', background: '#fff' }}
                />
                <button onClick={addComm} disabled={commSaving || !commText.trim()}
                  style={{ alignSelf: 'flex-end', padding: '8px 12px', borderRadius: 7, border: 'none', background: 'var(--gold)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: commText.trim() ? 'pointer' : 'default', opacity: commText.trim() ? 1 : 0.4 }}>
                  {commSaving ? '…' : '↵'}
                </button>
              </div>
            </div>

            {/* Lista de entradas */}
            {communications.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--stone)', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                Sin comunicaciones registradas
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {communications.map((c: any) => {
                  const ct = COMM_TYPES.find(t => t.value === c.type) || COMM_TYPES[0]
                  return (
                    <div key={c.id} style={{ padding: '9px 12px', borderRadius: 8, background: '#fff', border: '1px solid var(--ivory)', borderLeft: `3px solid ${ct.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: ct.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {ct.icon} {ct.label}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--stone)', marginLeft: 'auto' }}>
                          {new Date(c.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' '}
                          {new Date(c.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--charcoal)', lineHeight: 1.5 }}>{c.text}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {lead.wedding_date_history && lead.wedding_date_history.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Fechas anteriores
              </div>
              {lead.wedding_date_history.map((h: any, idx: number) => (
                <div key={idx} style={{ padding: '8px 12px', background: 'var(--cream)', borderRadius: 8, marginBottom: 4, fontSize: 12, borderLeft: '3px solid var(--ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--charcoal)' }}>
                    {h.date_flexibility === 'exact' ? formatDateLabel(h.wedding_date || '')
                     : h.date_flexibility === 'range' ? `${formatDateLabel(h.wedding_date || '')} – ${formatDateLabel(h.wedding_date_to || '')}`
                     : h.date_flexibility === 'multi_range' ? `${(h.wedding_date_ranges || []).length} rangos`
                     : `${MONTHS[(h.wedding_month || 1) - 1]} ${h.wedding_year || ''}`}
                  </span>
                  {h.changed_at && (
                    <span style={{ fontSize: 10, color: 'var(--stone)' }}>
                      {new Date(h.changed_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}


          <div style={{ fontSize: 11, color: 'var(--stone)' }}>
            <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
            Creado el {new Date(lead.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--ivory)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Mover a</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(Object.entries(TAB_STATUSES) as [Tab, DbStatus[]][]).map(([tabKey, statuses]) => {
              if (tabKey === tab) return null
              const tabInfo = TABS.find(t => t.key === tabKey)
              return (
                <button key={tabKey} onClick={() => {
                  if (['contacted', 'visit_scheduled', 'won'].includes(statuses[0])) {
                    onDateConfirm(lead, statuses[0]); onClose()
                  } else {
                    onMove(lead.id, statuses[0]); onClose()
                  }
                }}
                  style={{ fontSize: 12, padding: '5px 11px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {tabInfo?.emoji} {tabInfo?.label}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {canProposal ? (
              <a href={`/proposals/new?lead_id=${lead.id}`}
                style={{ flex: 1, fontSize: 12, padding: '8px', borderRadius: 6, border: '1px solid var(--gold)', color: 'var(--gold)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 500 }}>
                <FileText size={12} /> Crear propuesta
              </a>
            ) : (
              <div title="Disponible en plan Premium"
                style={{ flex: 1, fontSize: 12, padding: '8px', borderRadius: 6, border: '1px solid var(--ivory)', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 500, cursor: 'not-allowed', userSelect: 'none' }}>
                <FileText size={12} /> Crear propuesta <LockKeyhole size={12} />
              </div>
            )}
            <button onClick={() => onDelete(lead.id)}
              style={{ fontSize: 12, padding: '8px 12px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--stone)', background: 'transparent', color: 'var(--rose)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Trash2 size={12} /> Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Kanban Board ──────────────────────────────────────────────────────────────
const KANBAN_ROW_1: Tab[] = ['new', 'en_seguimiento', 'visit']
const KANBAN_ROW_2: Tab[] = ['budget', 'confirmed', 'lost']

function KanbanColumn({ col, leads, isOver, draggingId, onDragOver, onDragLeave, onDrop, onDragStart, onDragEnd, onDetail }: {
  col: typeof TABS[number]; leads: any[]; isOver: boolean; draggingId: string | null
  onDragOver: (e: React.DragEvent) => void; onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void; onDragStart: (e: React.DragEvent, lead: any) => void
  onDragEnd: () => void; onDetail: (l: any) => void
}) {
  const isLost = col.key === 'lost'
  return (
    <div
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      style={{
        flex: 1, minWidth: 0,
        background: isOver ? 'var(--gold-light)' : '#fff',
        borderRadius: 10,
        border: isOver ? '2px dashed var(--gold)' : '1px solid var(--ivory)',
        transition: 'background 0.15s, border-color 0.15s',
        display: 'flex', flexDirection: 'column',
        minHeight: 180,
      }}
    >
      {/* Column header */}
      <div style={{
        padding: '9px 12px',
        borderBottom: '1px solid var(--ivory)',
        borderTop: isLost ? '2px solid var(--stone)' : '2px solid var(--gold)',
        borderRadius: '10px 10px 0 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: isLost ? 'var(--stone)' : 'var(--espresso)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span style={{ color: isLost ? 'var(--stone)' : 'var(--gold)' }}>{col.emoji}</span>
          <span>{col.label}</span>
        </div>
        {leads.length > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, minWidth: 20, height: 20,
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isLost ? 'var(--ivory)' : 'var(--gold)', color: isLost ? 'var(--warm-gray)' : '#fff', padding: '0 6px',
          }}>{leads.length}</span>
        )}
      </div>

      {/* Cards */}
      <div style={{ padding: 6, flex: 1, overflowY: 'auto', maxHeight: 'calc(50vh - 80px)' }}>
        {leads.map(lead => {
          const isDragging = draggingId === lead.id
          return (
            <div
              key={lead.id}
              draggable
              onDragStart={e => onDragStart(e, lead)}
              onDragEnd={onDragEnd}
              onClick={() => onDetail(lead)}
              style={{
                background: isDragging ? 'var(--cream)' : 'var(--cream)',
                border: '1px solid var(--ivory)',
                borderRadius: 8,
                padding: '9px 10px',
                marginBottom: 5,
                cursor: isDragging ? 'grabbing' : 'grab',
                opacity: isDragging ? 0.35 : 1,
                transition: 'box-shadow 0.15s, opacity 0.15s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
              onMouseEnter={e => { if (!isDragging) (e.currentTarget as HTMLElement).style.boxShadow = '0 3px 10px rgba(0,0,0,0.07)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)' }}
            >
              <div style={{ fontWeight: 600, color: 'var(--espresso)', fontSize: 12.5, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lead.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Calendar size={10} style={{ color: 'var(--stone)', flexShrink: 0 }} />
                <span style={{ fontSize: 10.5, color: 'var(--warm-gray)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatLeadDate(lead).line1}
                </span>
              </div>
              {col.key === 'visit' && lead.visit_date && (
                <div style={{ fontSize: 10, color: 'var(--gold)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 3, fontWeight: 500 }}>
                  <Landmark size={10} /> Visita: {new Date(lead.visit_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </div>
              )}
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {lead.source && (
                  <span style={{ fontSize: 9, background: 'var(--ivory)', color: 'var(--warm-gray)', padding: '1px 6px', borderRadius: 8 }}>
                    {SOURCE_LABEL[lead.source] || lead.source}
                  </span>
                )}
                {lead.guests && (
                  <span style={{ fontSize: 9, background: 'var(--ivory)', color: 'var(--warm-gray)', padding: '1px 6px', borderRadius: 8 }}>
                    {lead.guests} inv.
                  </span>
                )}
                {lead.budget && lead.budget !== 'sin_definir' && (
                  <span style={{ fontSize: 9, background: 'var(--ivory)', color: 'var(--warm-gray)', padding: '1px 6px', borderRadius: 8 }}>
                    {BUDGET_LABEL[lead.budget]}
                  </span>
                )}
              </div>
            </div>
          )
        })}
        {leads.length === 0 && (
          <div style={{ padding: '20px 8px', textAlign: 'center', fontSize: 11, color: 'var(--stone)' }}>
            Sin leads
          </div>
        )}
      </div>
    </div>
  )
}

function KanbanBoard({ leads, onMove, onEdit, onDelete, onDetail, onDateConfirm }: {
  leads: any[]
  onMove: (id: string, s: DbStatus) => void
  onEdit: (l: any) => void
  onDelete: (id: string) => void
  onDetail: (l: any) => void
  onDateConfirm: (lead: any, s: DbStatus) => void
}) {
  const [dragOverCol, setDragOverCol] = useState<Tab | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const leadsByTab = useMemo(() => {
    const map: Record<Tab, any[]> = { new: [], en_seguimiento: [], visit: [], budget: [], confirmed: [], lost: [] }
    leads.forEach(l => {
      const tab = (Object.entries(TAB_STATUSES) as [Tab, DbStatus[]][])
        .find(([, ss]) => ss.includes(l.status))?.[0]
      if (tab) map[tab].push(l)
    })
    return map
  }, [leads])

  const handleDragStart = (e: React.DragEvent, lead: any) => {
    e.dataTransfer.setData('text/plain', lead.id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(lead.id)
  }

  const handleDragEnd = () => { setDraggingId(null); setDragOverCol(null) }

  const handleDrop = (e: React.DragEvent, tab: Tab) => {
    e.preventDefault()
    setDragOverCol(null)
    setDraggingId(null)
    const leadId = e.dataTransfer.getData('text/plain')
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    const currentTab = (Object.entries(TAB_STATUSES) as [Tab, DbStatus[]][])
      .find(([, ss]) => ss.includes(lead.status))?.[0]
    if (currentTab === tab) return
    const targetStatus = TAB_STATUSES[tab][0]
    if (['contacted', 'visit_scheduled', 'won'].includes(targetStatus)) {
      onDateConfirm(lead, targetStatus)
    } else {
      onMove(lead.id, targetStatus)
    }
  }

  const colProps = (tab: Tab) => ({
    isOver: dragOverCol === tab,
    draggingId,
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCol(tab) },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null) },
    onDrop: (e: React.DragEvent) => handleDrop(e, tab),
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDetail,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
      {/* Row 1: Pipeline activo */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 2 }}>
          Pipeline
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {KANBAN_ROW_1.map(tabKey => {
            const col = TABS.find(t => t.key === tabKey)!
            return <KanbanColumn key={tabKey} col={col} leads={leadsByTab[tabKey] || []} {...colProps(tabKey)} />
          })}
        </div>
      </div>

      {/* Row 2: Cierre */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 2 }}>
          Cierre
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {KANBAN_ROW_2.map(tabKey => {
            const col = TABS.find(t => t.key === tabKey)!
            return <KanbanColumn key={tabKey} col={col} leads={leadsByTab[tabKey] || []} {...colProps(tabKey)} />
          })}
        </div>
      </div>
    </div>
  )
}

// ── Info Block ─────────────────────────────────────────────────────────────────
function InfoBlock({ icon, label, value, sub, subColor }: { icon: React.ReactNode; label: string; value: string; sub?: React.ReactNode; subColor?: string }) {
  return (
    <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--espresso)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: subColor || 'var(--warm-gray)', fontWeight: 600, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Empty State ────────────────────────────────────────────────────────────────
function EmptyState({ tab, search, hidePast, onClear, onNew }: {
  tab: Tab; search: string; hidePast: boolean; onClear: () => void; onNew: () => void
}) {
  const msgs: Partial<Record<Tab, { title: string; sub: string }>> = {
    new:         { title: 'Sin leads nuevos',          sub: 'Los nuevos contactos aparecerán aquí.' },
    en_seguimiento: { title: 'Nada en seguimiento',       sub: 'Marca un lead como contactado para verlo aquí.' },
    visit:       { title: 'Sin visitas agendadas',     sub: 'Cuando agendes una visita, aparecerá aquí.' },
    confirmed:   { title: 'Sin bodas confirmadas aún', sub: '¡A cerrar esa primera boda!' },
    lost:        { title: 'Sin leads perdidos',        sub: '¡Todo el mundo sigue activo!' },
  }
  const { title, sub } = msgs[tab] || { title: '', sub: '' }
  const isFiltered = search || hidePast
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--warm-gray)' }}>
      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 6 }}>
        {isFiltered ? 'Sin resultados con los filtros actuales' : title}
      </div>
      <div style={{ fontSize: 13, marginBottom: 20 }}>{isFiltered ? '' : sub}</div>
      {isFiltered
        ? <button className="btn btn-ghost btn-sm" onClick={onClear}>Limpiar filtros</button>
        : tab === 'new' && <button className="btn btn-primary btn-sm" onClick={onNew}><Plus size={13} /> Crear primer lead</button>
      }
    </div>
  )
}

// ── Filter Date Range Picker ───────────────────────────────────────────────────
function FilterDateRangePicker({ from, to, onChange }: {
  from: string; to: string
  onChange: (from: string, to: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [picking, setPicking] = useState<'from' | 'to'>('from')
  const ref = useRef<HTMLDivElement>(null)
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const DAYS_ES   = ['L','M','X','J','V','S','D']

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const offset   = firstDow === 0 ? 6 : firstDow - 1
  const daysInM  = new Date(viewYear, viewMonth + 1, 0).getDate()
  const todayDs  = new Date().toISOString().slice(0, 10)

  const prevM = () => { const d = new Date(viewYear, viewMonth - 1, 1); setViewMonth(d.getMonth()); setViewYear(d.getFullYear()) }
  const nextM = () => { const d = new Date(viewYear, viewMonth + 1, 1); setViewMonth(d.getMonth()); setViewYear(d.getFullYear()) }

  const handleDay = (ds: string) => {
    if (picking === 'from') {
      onChange(ds, to && to >= ds ? to : '')
      setPicking('to')
    } else {
      if (ds < from) { onChange(ds, from) }
      else           { onChange(from, ds) }
      setPicking('from')
      setOpen(false)
    }
  }

  const fmt = (ds: string) => {
    if (!ds) return null
    const [y, m, d] = ds.split('-').map(Number)
    return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`
  }

  const hasFilter = !!(from || to)
  const label = hasFilter
    ? [from ? fmt(from) : '…', to ? fmt(to) : '…'].join(' → ')
    : null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger pill */}
      <button type="button" onClick={() => { setOpen(o => !o); setPicking(from && !to ? 'to' : 'from') }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 12px',
          border: `1px solid ${hasFilter ? 'var(--gold)' : 'var(--ivory)'}`,
          borderRadius: 8,
          background: hasFilter ? '#fffbeb' : '#fff',
          cursor: 'pointer', fontSize: 12.5,
          color: hasFilter ? 'var(--espresso)' : 'var(--warm-gray)',
          fontFamily: 'Manrope, sans-serif',
          fontWeight: hasFilter ? 600 : 400,
          whiteSpace: 'nowrap',
          transition: 'all 0.15s',
          outline: 'none',
        }}>
        <Calendar size={13} style={{ color: hasFilter ? 'var(--gold)' : 'var(--warm-gray)', flexShrink: 0 }} />
        {label || 'Filtrar por fecha'}
        {hasFilter && (
          <span onClick={e => { e.stopPropagation(); onChange('', ''); setOpen(false) }}
            style={{ marginLeft: 2, width: 16, height: 16, borderRadius: '50%', background: 'var(--gold)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X size={9} />
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 300,
          background: '#fff', border: '1px solid var(--ivory)', borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.11)',
          padding: '16px 16px 12px',
          minWidth: 272,
        }}>
          {/* From / To chips */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(['from','to'] as const).map(side => (
              <div key={side} onClick={() => setPicking(side)}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${picking === side ? 'var(--gold)' : 'var(--ivory)'}`,
                  background: picking === side ? '#fffbeb' : '#fafaf8',
                  transition: 'all 0.15s',
                }}>
                <div style={{ fontSize: 9, color: 'var(--warm-gray)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
                  {side === 'from' ? 'Desde' : 'Hasta'}
                </div>
                <div style={{ fontSize: 13, color: (side === 'from' ? from : to) ? 'var(--espresso)' : '#c5bfb8', fontWeight: (side === 'from' ? from : to) ? 600 : 400, fontFamily: 'Manrope, sans-serif' }}>
                  {(side === 'from' ? from : to) ? fmt(side === 'from' ? from : to)! : '—'}
                </div>
              </div>
            ))}
          </div>

          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" onClick={prevM}
              style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--ivory)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--charcoal)' }}>
              <ChevronLeft size={13} />
            </button>
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 17, color: 'var(--espresso)', fontWeight: 500, textTransform: 'capitalize' }}>
              {MONTHS_ES[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextM}
              style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--ivory)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--charcoal)' }}>
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Day labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAYS_ES.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', padding: '2px 0', textTransform: 'uppercase' }}>{d}</div>
            ))}
          </div>

          {/* Days */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInM }, (_, i) => {
              const day = i + 1
              const ds  = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const isFrom  = ds === from
              const isTo    = ds === to
              const inRange = from && to && ds > from && ds < to
              const isHov   = picking === 'to' && from && !to && hovered && ds > from && ds <= hovered
              const isActive = isFrom || isTo
              const isToday  = ds === todayDs
              return (
                <button key={ds} type="button"
                  onClick={() => handleDay(ds)}
                  onMouseEnter={() => setHovered(ds)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    height: 30, width: '100%', border: 'none',
                    borderRadius: isFrom ? '6px 0 0 6px' : isTo ? '0 6px 6px 0' : 6,
                    cursor: 'pointer',
                    fontFamily: 'Manrope, sans-serif', fontSize: 12,
                    fontWeight: isActive ? 700 : 400,
                    background: isActive ? 'var(--gold)' : (inRange || isHov) ? '#fef3c7' : 'transparent',
                    color: isActive ? '#fff' : isToday ? 'var(--gold)' : 'var(--charcoal)',
                    outline: isToday && !isActive ? '1.5px solid var(--gold)' : 'none',
                    outlineOffset: '-1px',
                    transition: 'background 0.1s',
                  }}>
                  {day}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--ivory)' }}>
            <button type="button" onClick={() => { onChange('', ''); setPicking('from') }}
              style={{ fontSize: 12, color: 'var(--warm-gray)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Manrope, sans-serif' }}>
              Borrar
            </button>
            <button type="button" onClick={() => setOpen(false)}
              style={{ fontSize: 12, padding: '5px 16px', borderRadius: 8, background: 'var(--gold)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'Manrope, sans-serif' }}>
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Mini Calendar Picker ───────────────────────────────────────────────────────
function MiniCalendarPicker({
  userId, value, onChange, rangeFrom, rangeTo,
  highlights, readOnly = false,
}: {
  userId: string
  value?: string
  onChange?: (date: string) => void
  rangeFrom?: string
  rangeTo?: string
  highlights?: string[]   // extra dates to highlight (other ranges in multi_range)
  readOnly?: boolean
}) {
  const today = new Date().toISOString().slice(0, 10)
  const initStr = value || rangeFrom || (highlights && highlights.length > 0 ? highlights[0] : today)
  const initD = new Date(initStr + 'T12:00:00')
  const [year,  setYear]  = useState(initD.getFullYear())
  const [month, setMonth] = useState(initD.getMonth())
  const [entries, setEntries] = useState<Record<string, string>>({})

  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    const supabase = createClient()
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const to   = new Date(year, month + 1, 0).toISOString().slice(0, 10)
    Promise.all([
      supabase.from('calendar_entries').select('date,status')
        .eq('user_id', userId).gte('date', from).lte('date', to),
      supabase.from('leads').select('wedding_date,wedding_date_to,wedding_date_ranges,wedding_year,wedding_month,date_flexibility')
        .eq('user_id', userId).neq('status', 'lost').neq('status', 'won'),
    ]).then(([entriesRes, leadsRes]) => {
      if (entriesRes.data) {
        const m: Record<string, string> = {}
        entriesRes.data.forEach((e: any) => { m[e.date] = e.status })
        setEntries(m)
      }
      if (leadsRes.data) {
        const counts: Record<string, number> = {}
        const addCount = (d: string) => { if (d >= from && d <= to) counts[d] = (counts[d] || 0) + 1 }
        const expand = (f: string, t: string) => {
          const cur = new Date(f + 'T12:00:00'), end = new Date((t || f) + 'T12:00:00')
          while (cur <= end) { addCount(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1) }
        }
        leadsRes.data.forEach((l: any) => {
          const flex = l.date_flexibility || 'exact'
          if (flex === 'exact' && l.wedding_date) expand(l.wedding_date, l.wedding_date_to || l.wedding_date)
          else if (flex === 'range' && l.wedding_date) expand(l.wedding_date, l.wedding_date_to || l.wedding_date)
          else if (flex === 'multi_range' && l.wedding_date_ranges?.length)
            l.wedding_date_ranges.forEach((r: any) => { if (r.from) expand(r.from, r.to || r.from) })
          else if (flex === 'month' && l.wedding_year && l.wedding_month) {
            const y = l.wedding_year, mo = l.wedding_month
            const days = new Date(y, mo, 0).getDate()
            for (let d = 1; d <= days; d++) addCount(`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
          }
        })
        setLeadCounts(counts)
      }
    })
  }, [year, month, userId])

  const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const DAYS_ES   = ['L','M','X','J','V','S','D']

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDow    = ((new Date(year, month, 1).getDay() + 6) % 7)

  const ds = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const isInRange = (d: string) => {
    const from = rangeFrom || value; const to = rangeTo || value
    return !!from && !!to && d > from && d < to
  }
  const isSelected = (d: string) =>
    d === value || d === rangeFrom || d === rangeTo || !!(highlights && highlights.includes(d))

  const handleClick = (d: string) => {
    if (readOnly || d < today) return
    onChange?.(d)
  }

  const todayStr = today
  return (
    <div style={{ border: '1px solid var(--ivory)', borderRadius: 14, overflow: 'hidden', marginTop: 8, fontSize: 12, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--cream)', borderBottom: '1px solid var(--ivory)' }}>
        <button type="button" onClick={() => month === 0 ? (setYear(y => y - 1), setMonth(11)) : setMonth(m => m - 1)}
          style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--ivory)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--charcoal)' }}>
          <ChevronLeft size={13} />
        </button>
        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, color: 'var(--espresso)', fontWeight: 500, textTransform: 'capitalize' }}>{MONTHS_ES[month]} {year}</span>
        <button type="button" onClick={() => month === 11 ? (setYear(y => y + 1), setMonth(0)) : setMonth(m => m + 1)}
          style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--ivory)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--charcoal)' }}>
          <ChevronRight size={13} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--ivory)' }}>
        {DAYS_ES.map((d, i) => <div key={d} style={{ textAlign: 'center', padding: '8px 0', fontSize: 10, fontWeight: 700, color: i >= 5 ? 'var(--gold)' : 'var(--warm-gray)', letterSpacing: '0.1em' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {Array.from({ length: startDow }).map((_, i) => (
          <div key={`emp${i}`} style={{ minHeight: 40, borderBottom: '1px solid var(--ivory)', borderRight: i % 7 !== 6 ? '1px solid var(--ivory)' : 'none' }} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day  = i + 1
          const d    = ds(day)
          const eSt  = entries[d]
          const sel  = isSelected(d)
          const inR  = isInRange(d)
          const past = d < todayStr
          const isToday = d === todayStr
          const lCount = leadCounts[d] || 0
          const isRes  = eSt === 'reservado'
          const isBlk  = eSt === 'bloqueado'
          const isNeg  = eSt === 'negociacion'
          const blocked = isRes || isBlk
          const canClick = !readOnly && !past && !blocked
          const cellIdx = startDow + i
          const isLastCol = cellIdx % 7 === 6

          const bg = sel ? 'var(--gold)'
                  : inR  ? '#fef3c7'
                  : past ? '#fafaf7'
                  : isRes ? '#fef2f2'
                  : isBlk ? '#f5f5f4'
                  : isNeg ? '#fffbeb'
                  : '#fff'
          const color = sel ? '#fff'
                  : past ? '#cfcbc3'
                  : isRes ? '#b91c1c'
                  : isBlk ? '#9ca3af'
                  : isNeg ? '#b45309'
                  : 'var(--charcoal)'

          return (
            <button key={day} type="button" onClick={() => canClick && handleClick(d)}
              disabled={!canClick}
              title={isRes ? 'Reservado' : isBlk ? 'Bloqueado' : isNeg ? 'En negociación' : past ? 'Fecha pasada' : ''}
              style={{
                minHeight: 40, border: 'none',
                borderBottom: '1px solid var(--ivory)',
                borderRight: isLastCol ? 'none' : '1px solid var(--ivory)',
                background: bg, color,
                cursor: canClick ? 'pointer' : 'default',
                fontSize: 13, fontWeight: sel ? 700 : isToday ? 700 : 500,
                fontFamily: 'Manrope, sans-serif',
                boxShadow: sel
                  ? 'inset 0 0 0 2px var(--gold)'
                  : isToday ? 'inset 0 0 0 1.5px var(--gold)' : 'none',
                textDecoration: blocked ? 'line-through' : 'none',
                position: 'relative',
                outline: 'none',
                transition: 'background 0.12s, color 0.12s',
              }}>
              {day}
              {lCount > 0 && !blocked && (
                <span style={{
                  position: 'absolute', bottom: 2, right: 3,
                  minWidth: 13, height: 13, borderRadius: 7, padding: '0 3px',
                  background: sel ? 'rgba(255,255,255,0.85)' : '#fde68a',
                  color: sel ? 'var(--gold)' : '#92400e',
                  fontSize: 9, fontWeight: 700, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{lCount}</span>
              )}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, padding: '8px 14px', background: 'var(--cream)', borderTop: '1px solid var(--ivory)', fontSize: 10, color: 'var(--warm-gray)', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#fffbeb', border: '1px solid #fde68a' }} /> Negociación
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#fef2f2', border: '1px solid #fecaca' }} /> Reservado
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#f5f5f4', border: '1px solid #e7e5e4' }} /> Bloqueado
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ minWidth: 14, height: 14, borderRadius: 7, padding: '0 3px', background: '#fde68a', color: '#92400e', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
          <span>Otros leads</span>
        </div>
      </div>
    </div>
  )
}

// ── Range Calendar Picker ─────────────────────────────────────────────────────
// Un solo calendario: 1er click = desde, 2º click = hasta
// Hover preview del rango mientras se selecciona el hasta
function RangeCalendarPicker({
  userId, from, to, onChange,
}: {
  userId: string
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const initStr = from || today
  const initD   = new Date(initStr + 'T12:00:00')
  const [year,       setYear]       = useState(initD.getFullYear())
  const [month,      setMonth]      = useState(initD.getMonth())
  const [entries,    setEntries]    = useState<Record<string, string>>({})
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({})
  const [hoverDate,  setHoverDate]  = useState('')
  // 'from' = esperando 1er click, 'to' = esperando 2º click
  const [phase, setPhase] = useState<'from' | 'to'>(from && !to ? 'to' : 'from')

  useEffect(() => {
    const supabase = createClient()
    const mFrom = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const mTo   = new Date(year, month + 1, 0).toISOString().slice(0, 10)
    Promise.all([
      supabase.from('calendar_entries').select('date,status').eq('user_id', userId).gte('date', mFrom).lte('date', mTo),
      supabase.from('leads').select('wedding_date,wedding_date_to,wedding_date_ranges,wedding_year,wedding_month,date_flexibility').eq('user_id', userId).neq('status', 'lost').neq('status', 'won'),
    ]).then(([eRes, lRes]) => {
      if (eRes.data) {
        const m: Record<string, string> = {}
        eRes.data.forEach((e: any) => { m[e.date] = e.status })
        setEntries(m)
      }
      if (lRes.data) {
        const counts: Record<string, number> = {}
        const addC = (d: string) => { if (d >= mFrom && d <= mTo) counts[d] = (counts[d] || 0) + 1 }
        const exp  = (f: string, t: string) => { const c = new Date(f + 'T12:00:00'), e = new Date((t || f) + 'T12:00:00'); while (c <= e) { addC(c.toISOString().slice(0, 10)); c.setDate(c.getDate() + 1) } }
        lRes.data.forEach((l: any) => {
          const fl = l.date_flexibility || 'exact'
          if ((fl === 'exact' || fl === 'range') && l.wedding_date) exp(l.wedding_date, l.wedding_date_to || l.wedding_date)
          else if (fl === 'multi_range' && l.wedding_date_ranges?.length) l.wedding_date_ranges.forEach((r: any) => { if (r.from) exp(r.from, r.to || r.from) })
          else if (fl === 'month' && l.wedding_year && l.wedding_month) { const days = new Date(l.wedding_year, l.wedding_month, 0).getDate(); for (let d = 1; d <= days; d++) addC(`${l.wedding_year}-${String(l.wedding_month).padStart(2,'0')}-${String(d).padStart(2,'0')}`) }
        })
        setLeadCounts(counts)
      }
    })
  }, [year, month, userId])

  const handleClick = (d: string) => {
    if (d < today) return
    if (phase === 'from' || (from && to)) {
      onChange(d, '')
      setPhase('to')
    } else {
      // phase === 'to'
      if (d >= from) { onChange(from, d); setPhase('from') }
      else            { onChange(d, '') }
    }
  }

  const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const DAYS_ES   = ['L','M','X','J','V','S','D']
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDow    = (new Date(year, month, 1).getDay() + 6) % 7
  const ds = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  // El "hasta" efectivo para el highlight: el real o el hover si estamos eligiendo
  const effectiveTo = phase === 'to' && from
    ? (hoverDate && hoverDate >= from ? hoverDate : (to || ''))
    : to

  const isFrom    = (d: string) => d === from
  const isTo      = (d: string) => d === effectiveTo && !!effectiveTo
  const isInRange = (d: string) => !!from && !!effectiveTo && d > from && d < effectiveTo
  const isHover   = (d: string) => phase === 'to' && from && d === hoverDate && hoverDate >= from

  const todayStr = today
  return (
    <div style={{ border: '1px solid var(--ivory)', borderRadius: 14, overflow: 'hidden', fontSize: 12, background: '#fff' }}>
      {/* Instrucción contextual */}
      <div style={{ padding: '8px 14px', background: phase === 'to' ? '#fffbeb' : '#f0fdf4', borderBottom: '1px solid var(--ivory)', fontSize: 11, color: phase === 'to' ? '#92400e' : '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
        {phase === 'from'
          ? <><span style={{ background: '#d1fae5', color: '#15803d', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>1</span> Selecciona la fecha de inicio</>
          : <><span style={{ background: '#fef3c7', color: '#92400e', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>2</span> Selecciona la fecha de fin · inicio: <strong>{from ? new Date(from + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}</strong></>
        }
      </div>
      {/* Navegación */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--cream)', borderBottom: '1px solid var(--ivory)' }}>
        <button type="button" onClick={() => month === 0 ? (setYear(y => y - 1), setMonth(11)) : setMonth(m => m - 1)}
          style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--ivory)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--charcoal)' }}>
          <ChevronLeft size={13} />
        </button>
        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, color: 'var(--espresso)', fontWeight: 500, textTransform: 'capitalize' }}>{MONTHS_ES[month]} {year}</span>
        <button type="button" onClick={() => month === 11 ? (setYear(y => y + 1), setMonth(0)) : setMonth(m => m + 1)}
          style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--ivory)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--charcoal)' }}>
          <ChevronRight size={13} />
        </button>
      </div>
      {/* Cabecera días */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--ivory)' }}>
        {DAYS_ES.map((d, i) => <div key={d} style={{ textAlign: 'center', padding: '8px 0', fontSize: 10, fontWeight: 700, color: i >= 5 ? 'var(--gold)' : 'var(--warm-gray)', letterSpacing: '0.1em' }}>{d}</div>)}
      </div>
      {/* Días */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}
        onMouseLeave={() => setHoverDate('')}>
        {Array.from({ length: startDow }).map((_, i) => (
          <div key={`e${i}`} style={{ minHeight: 40, borderBottom: '1px solid var(--ivory)', borderRight: i % 7 !== 6 ? '1px solid var(--ivory)' : 'none' }} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day  = i + 1
          const d    = ds(day)
          const eSt  = entries[d]
          const lCnt = leadCounts[d] || 0
          const past = d < todayStr
          const isToday = d === todayStr
          const selF = isFrom(d); const selT = isTo(d); const inR = isInRange(d); const hov = isHover(d)
          const isEnd = selF || selT
          const isRes = eSt === 'reservado'; const isBlk = eSt === 'bloqueado'; const isNeg = eSt === 'negociacion'
          const blocked = isRes || isBlk
          const canClick = !past && !blocked
          const cellIdx = startDow + i
          const isLastCol = cellIdx % 7 === 6

          const bg = isEnd ? 'var(--gold)'
                  : inR  ? '#fef3c7'
                  : hov  ? '#fefce8'
                  : past ? '#fafaf7'
                  : isRes ? '#fef2f2'
                  : isBlk ? '#f5f5f4'
                  : isNeg ? '#fffbeb'
                  : '#fff'
          const color = isEnd ? '#fff'
                  : inR  ? '#92400e'
                  : past ? '#cfcbc3'
                  : isRes ? '#b91c1c'
                  : isBlk ? '#9ca3af'
                  : isNeg ? '#b45309'
                  : 'var(--charcoal)'

          return (
            <button key={day} type="button"
              onClick={() => canClick && handleClick(d)}
              onMouseEnter={() => canClick && setHoverDate(d)}
              disabled={!canClick}
              title={isRes ? 'Reservado' : isBlk ? 'Bloqueado' : isNeg ? 'En negociación' : past ? 'Fecha pasada' : ''}
              style={{
                minHeight: 40, border: 'none',
                borderBottom: '1px solid var(--ivory)',
                borderRight: isLastCol ? 'none' : '1px solid var(--ivory)',
                background: bg, color,
                cursor: canClick ? 'pointer' : 'default',
                fontSize: 13, fontWeight: isEnd ? 700 : isToday ? 700 : 500,
                fontFamily: 'Manrope, sans-serif',
                boxShadow: isEnd
                  ? 'inset 0 0 0 2px var(--gold)'
                  : isToday ? 'inset 0 0 0 1.5px var(--gold)' : 'none',
                textDecoration: blocked ? 'line-through' : 'none',
                position: 'relative',
                outline: 'none',
                transition: 'background 0.12s, color 0.12s',
              }}>
              {day}
              {lCnt > 0 && !blocked && (
                <span style={{
                  position: 'absolute', bottom: 2, right: 3,
                  minWidth: 13, height: 13, borderRadius: 7, padding: '0 3px',
                  background: isEnd ? 'rgba(255,255,255,0.85)' : '#fde68a',
                  color: isEnd ? 'var(--gold)' : '#92400e',
                  fontSize: 9, fontWeight: 700, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{lCnt}</span>
              )}
            </button>
          )
        })}
      </div>
      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 12, padding: '8px 14px', background: 'var(--cream)', borderTop: '1px solid var(--ivory)', fontSize: 10, color: 'var(--warm-gray)', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#fffbeb', border: '1px solid #fde68a' }} /> Negociación
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#fef2f2', border: '1px solid #fecaca' }} /> Reservado
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#f5f5f4', border: '1px solid #e7e5e4' }} /> Bloqueado
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ minWidth: 14, height: 14, borderRadius: 7, padding: '0 3px', background: '#fde68a', color: '#92400e', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
          <span>Otros leads</span>
        </div>
      </div>
    </div>
  )
}

// ── Multi-Range Calendar Picker ────────────────────────────────────────────────
// Un solo calendario para seleccionar varios rangos.
// 1er click = fecha inicio del rango en curso · 2º click = fecha fin → rango completado
function MultiRangeCalendarPicker({
  userId, ranges, onChange,
}: {
  userId: string
  ranges: { from: string; to: string }[]
  onChange: (ranges: { from: string; to: string }[]) => void
}) {
  const today    = new Date().toISOString().slice(0, 10)
  const firstFrom = ranges[0]?.from || today
  const initD    = new Date(firstFrom + 'T12:00:00')
  const [year,        setYear]        = useState(initD.getFullYear())
  const [month,       setMonth]       = useState(initD.getMonth())
  const [entries,     setEntries]     = useState<Record<string, string>>({})
  const [leadCounts,  setLeadCounts]  = useState<Record<string, number>>({})
  const [hoverDate,   setHoverDate]   = useState('')
  const [pendingFrom, setPendingFrom] = useState('')  // rango en curso: from ya elegido

  // Refined, brand-coherent palette — earthy & muted (not kindergarten primaries)
  const RANGE_COLORS = [
    { bg: '#fdf6ee', sel: '#c8941f', light: '#fef3c7', border: '#c8941f' }, // gold (brand)
    { bg: '#f4f1ec', sel: '#8a7a5e', light: '#ece7dd', border: '#8a7a5e' }, // taupe
    { bg: '#f1f5f0', sel: '#6b8e5a', light: '#dde8d8', border: '#6b8e5a' }, // sage
    { bg: '#f6f1ee', sel: '#a8654d', light: '#ecdcd2', border: '#a8654d' }, // terracotta
    { bg: '#f2efef', sel: '#7a5b6e', light: '#e3dce0', border: '#7a5b6e' }, // dusty plum
    { bg: '#eef1f4', sel: '#5b7090', light: '#d8e0e9', border: '#5b7090' }, // slate blue
  ]

  useEffect(() => {
    const supabase = createClient()
    const mFrom = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const mTo   = new Date(year, month + 1, 0).toISOString().slice(0, 10)
    Promise.all([
      supabase.from('calendar_entries').select('date,status').eq('user_id', userId).gte('date', mFrom).lte('date', mTo),
      supabase.from('leads').select('wedding_date,wedding_date_to,wedding_date_ranges,wedding_year,wedding_month,date_flexibility').eq('user_id', userId).neq('status', 'lost').neq('status', 'won'),
    ]).then(([eRes, lRes]) => {
      if (eRes.data) {
        const m: Record<string, string> = {}
        eRes.data.forEach((e: any) => { m[e.date] = e.status })
        setEntries(m)
      }
      if (lRes.data) {
        const counts: Record<string, number> = {}
        const addC = (d: string) => { if (d >= mFrom && d <= mTo) counts[d] = (counts[d] || 0) + 1 }
        const exp  = (f: string, t: string) => { const c = new Date(f + 'T12:00:00'), e = new Date((t || f) + 'T12:00:00'); while (c <= e) { addC(c.toISOString().slice(0, 10)); c.setDate(c.getDate() + 1) } }
        lRes.data.forEach((l: any) => {
          const fl = l.date_flexibility || 'exact'
          if ((fl === 'exact' || fl === 'range') && l.wedding_date) exp(l.wedding_date, l.wedding_date_to || l.wedding_date)
          else if (fl === 'multi_range' && l.wedding_date_ranges?.length) l.wedding_date_ranges.forEach((r: any) => { if (r.from) exp(r.from, r.to || r.from) })
          else if (fl === 'month' && l.wedding_year && l.wedding_month) { const days = new Date(l.wedding_year, l.wedding_month, 0).getDate(); for (let d = 1; d <= days; d++) addC(`${l.wedding_year}-${String(l.wedding_month).padStart(2,'0')}-${String(d).padStart(2,'0')}`) }
        })
        setLeadCounts(counts)
      }
    })
  }, [year, month, userId])

  // Qué rango (índice) contiene esta fecha (para color)
  const getRangeIdx = (d: string): number => {
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i]
      if (!r.from) continue
      if (d >= r.from && d <= (r.to || r.from)) return i
    }
    return -1
  }

  // True when [a..b] overlaps any existing range
  const overlapsExisting = (a: string, b: string) => ranges.some(r => {
    if (!r.from) return false
    const rFrom = r.from
    const rTo   = r.to || r.from
    return !(b < rFrom || a > rTo)
  })
  const [overlapWarn, setOverlapWarn] = useState(false)

  const handleClick = (d: string) => {
    if (d < today) return
    // Don't allow starting a range on a day that's already inside an existing one
    if (getRangeIdx(d) !== -1) {
      setOverlapWarn(true)
      setTimeout(() => setOverlapWarn(false), 2000)
      return
    }
    if (!pendingFrom) {
      setPendingFrom(d)
    } else {
      const f = pendingFrom < d ? pendingFrom : d
      const t = pendingFrom < d ? d : pendingFrom
      if (overlapsExisting(f, t)) {
        // Reject overlapping range — flash warning, keep selection clean
        setOverlapWarn(true)
        setTimeout(() => setOverlapWarn(false), 2000)
        setPendingFrom('')
        return
      }
      onChange([...ranges, { from: f, to: t }])
      setPendingFrom('')
    }
  }

  const removeRange = (i: number) => {
    onChange(ranges.filter((_, j) => j !== i))
  }

  const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const DAYS_ES   = ['L','M','X','J','V','S','D']
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDow    = (new Date(year, month, 1).getDay() + 6) % 7
  const ds = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const previewTo = pendingFrom && hoverDate && hoverDate >= pendingFrom ? hoverDate : ''

  const nextColorIdx = ranges.length % RANGE_COLORS.length
  const nextColor    = RANGE_COLORS[nextColorIdx]

  const todayStr = today
  return (
    <div>
      <div style={{ border: '1px solid var(--ivory)', borderRadius: 14, overflow: 'hidden', fontSize: 12, background: '#fff' }}>
        {/* Instrucción / aviso */}
        <div style={{
          padding: '8px 14px',
          background: overlapWarn ? '#fef2f2' : pendingFrom ? '#fffbeb' : '#f0fdf4',
          borderBottom: '1px solid var(--ivory)',
          fontSize: 11,
          color: overlapWarn ? '#991b1b' : pendingFrom ? '#92400e' : '#15803d',
          fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
          transition: 'background 0.2s, color 0.2s',
        }}>
          {overlapWarn
            ? <><AlertTriangle size={13} style={{ flexShrink: 0 }} /> Esa fecha ya está en otro rango — elige días libres.</>
            : !pendingFrom
              ? <><span style={{ background: '#d1fae5', color: '#15803d', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>1</span> Inicio del rango {ranges.length + 1}</>
              : <><span style={{ background: '#fef3c7', color: '#92400e', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>2</span> Selecciona la fecha de fin · inicio: <strong>{new Date(pendingFrom + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</strong></>
          }
        </div>
        {/* Navegación */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--cream)', borderBottom: '1px solid var(--ivory)' }}>
          <button type="button" onClick={() => month === 0 ? (setYear(y => y - 1), setMonth(11)) : setMonth(m => m - 1)}
            style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--ivory)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--charcoal)' }}>
            <ChevronLeft size={13} />
          </button>
          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, color: 'var(--espresso)', fontWeight: 500, textTransform: 'capitalize' }}>{MONTHS_ES[month]} {year}</span>
          <button type="button" onClick={() => month === 11 ? (setYear(y => y + 1), setMonth(0)) : setMonth(m => m + 1)}
            style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--ivory)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--charcoal)' }}>
            <ChevronRight size={13} />
          </button>
        </div>
        {/* Cabecera */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--ivory)' }}>
          {DAYS_ES.map((d, i) => <div key={d} style={{ textAlign: 'center', padding: '8px 0', fontSize: 10, fontWeight: 700, color: i >= 5 ? 'var(--gold)' : 'var(--warm-gray)', letterSpacing: '0.1em' }}>{d}</div>)}
        </div>
        {/* Días */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}
          onMouseLeave={() => setHoverDate('')}>
          {Array.from({ length: startDow }).map((_, i) => (
            <div key={`e${i}`} style={{ minHeight: 40, borderBottom: '1px solid var(--ivory)', borderRight: i % 7 !== 6 ? '1px solid var(--ivory)' : 'none' }} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day  = i + 1
            const d    = ds(day)
            const past = d < todayStr
            const isToday = d === todayStr
            const eSt  = entries[d]
            const lCnt = leadCounts[d] || 0
            const rIdx = getRangeIdx(d)
            const col  = rIdx >= 0 ? RANGE_COLORS[rIdx % RANGE_COLORS.length] : null
            const isRangeFrom = rIdx >= 0 && d === ranges[rIdx]?.from
            const isRangeTo   = rIdx >= 0 && d === (ranges[rIdx]?.to || ranges[rIdx]?.from)
            const isRangeEnd  = isRangeFrom || isRangeTo
            const isPendingFrom = d === pendingFrom
            const isPreviewTo   = d === previewTo
            const isPreviewIn   = pendingFrom && previewTo && d > pendingFrom && d < previewTo
            const isRes = eSt === 'reservado'; const isBlk = eSt === 'bloqueado'; const isNeg = eSt === 'negociacion'
            const blocked = isRes || isBlk
            const inExistingRange = rIdx !== -1
            const canClick = !past && !blocked && !inExistingRange
            const cellIdx = startDow + i
            const isLastCol = cellIdx % 7 === 6

            // If we're picking the second click and the preview range would overlap another → paint red
            const previewWouldOverlap = !!pendingFrom && !!previewTo && (() => {
              const f = pendingFrom < previewTo ? pendingFrom : previewTo
              const t = pendingFrom < previewTo ? previewTo : pendingFrom
              return overlapsExisting(f, t)
            })()

            let bg = '#fff'
            let color: string = past ? '#cfcbc3' : 'var(--charcoal)'
            let fw: number = 500
            let inset: string = 'none'

            if (col) {
              if (isRangeEnd) { bg = col.sel; color = '#fff'; fw = 700; inset = `inset 0 0 0 2px ${col.sel}` }
              else            { bg = col.light; color = col.sel; fw = 600 }
            } else if (isPendingFrom) {
              const c = previewWouldOverlap ? '#dc2626' : nextColor.sel
              bg = c; color = '#fff'; fw = 700; inset = `inset 0 0 0 2px ${c}`
            } else if (isPreviewTo) {
              const c = previewWouldOverlap ? '#dc2626' : nextColor.sel
              bg = c; color = '#fff'; fw = 700; inset = `inset 0 0 0 2px ${c}`
            } else if (isPreviewIn) {
              bg = previewWouldOverlap ? '#fee2e2' : nextColor.light
              color = previewWouldOverlap ? '#dc2626' : nextColor.sel
            } else if (isRes) { bg = '#fef2f2'; color = '#b91c1c' }
            else if (isBlk)   { bg = '#f5f5f4'; color = '#9ca3af' }
            else if (isNeg)   { bg = '#fffbeb'; color = '#b45309' }
            else if (past)    { bg = '#fafaf7' }
            if (isToday && inset === 'none') inset = 'inset 0 0 0 1.5px var(--gold)'

            return (
              <button key={day} type="button"
                onClick={() => canClick && handleClick(d)}
                onMouseEnter={() => canClick && setHoverDate(d)}
                disabled={!canClick}
                title={isRes ? 'Reservado' : isBlk ? 'Bloqueado' : isNeg ? 'En negociación' : past ? 'Fecha pasada' : ''}
                style={{
                  minHeight: 40, border: 'none',
                  borderBottom: '1px solid var(--ivory)',
                  borderRight: isLastCol ? 'none' : '1px solid var(--ivory)',
                  background: bg, color,
                  cursor: canClick ? 'pointer' : 'default',
                  fontSize: 13, fontWeight: fw,
                  fontFamily: 'Manrope, sans-serif',
                  boxShadow: inset,
                  textDecoration: blocked ? 'line-through' : 'none',
                  position: 'relative',
                  outline: 'none',
                  transition: 'background 0.12s, color 0.12s',
                }}>
                {day}
                {lCnt > 0 && !col && !isPendingFrom && !blocked && (
                  <span style={{
                    position: 'absolute', bottom: 2, right: 3,
                    minWidth: 13, height: 13, borderRadius: 7, padding: '0 3px',
                    background: '#fde68a', color: '#92400e',
                    fontSize: 9, fontWeight: 700, lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{lCnt}</span>
                )}
              </button>
            )
          })}
        </div>
        {/* Leyenda */}
        <div style={{ display: 'flex', gap: 12, padding: '8px 14px', background: 'var(--cream)', borderTop: '1px solid var(--ivory)', fontSize: 10, color: 'var(--warm-gray)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#fffbeb', border: '1px solid #fde68a' }} /> Negociación
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#fef2f2', border: '1px solid #fecaca' }} /> Reservado
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#f5f5f4', border: '1px solid #e7e5e4' }} /> Bloqueado
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ minWidth: 14, height: 14, borderRadius: 7, padding: '0 3px', background: '#fde68a', color: '#92400e', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
            <span>Otros leads</span>
          </div>
        </div>
      </div>

      {/* Lista de rangos completados */}
      {ranges.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ranges.map((r, i) => {
            const col = RANGE_COLORS[i % RANGE_COLORS.length]
            const fromD = new Date(r.from + 'T12:00:00')
            const toD   = r.to && r.to !== r.from ? new Date(r.to + 'T12:00:00') : null
            const days  = toD ? Math.round((toD.getTime() - fromD.getTime()) / 86400000) + 1 : 1
            const fmtFull = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
            const fmtShort = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'stretch',
                background: '#fff',
                border: '1px solid var(--ivory)',
                borderRadius: 10,
                overflow: 'hidden',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}>
                {/* Color stripe with index */}
                <div style={{
                  width: 38, flexShrink: 0,
                  background: col.sel, color: '#fff',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Cormorant Garamond, serif',
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', opacity: 0.85, lineHeight: 1 }}>OPC.</div>
                  <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, marginTop: 2 }}>{i + 1}</div>
                </div>
                {/* Body */}
                <div style={{ flex: 1, minWidth: 0, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {toD
                        ? `${fmtShort(fromD)} – ${fmtFull(toD)}`
                        : fmtFull(fromD)
                      }
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={10} style={{ color: col.sel, flexShrink: 0 }} />
                      {days} {days === 1 ? 'día candidato' : 'días candidatos'}
                    </div>
                  </div>
                  <button type="button" onClick={() => removeRange(i)}
                    title="Eliminar este rango"
                    style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: '#fff', border: '1px solid var(--ivory)',
                      cursor: 'pointer', color: 'var(--warm-gray)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, padding: 0,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fef2f2'; (e.currentTarget as HTMLElement).style.borderColor = '#fca5a5'; (e.currentTarget as HTMLElement).style.color = '#dc2626' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--ivory)'; (e.currentTarget as HTMLElement).style.color = 'var(--warm-gray)' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {pendingFrom && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#92400e', padding: '7px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={11} style={{ flexShrink: 0 }} />
          Inicio del nuevo rango seleccionado: <strong style={{ textTransform: 'capitalize' }}>{new Date(pendingFrom + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</strong>
        </div>
      )}
    </div>
  )
}

// ── Reusable summary card for date selection feedback ─────────────────────────
function DateSummaryCard({
  miniLabel, title, subtitle, accent = 'gold', icon, right,
}: {
  miniLabel: string
  title: string
  subtitle?: string
  accent?: 'gold' | 'cream'
  icon?: React.ReactNode
  right?: React.ReactNode
}) {
  const goldGrad = 'linear-gradient(135deg, #fef3c7 0%, #fdf6ee 100%)'
  return (
    <div style={{
      marginTop: 10,
      padding: '12px 14px',
      background: accent === 'gold' ? goldGrad : 'var(--cream)',
      border: `1px solid ${accent === 'gold' ? 'var(--gold)' : 'var(--ivory)'}`,
      borderRadius: 12,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: accent === 'gold' ? 'var(--gold)' : '#fff',
        color: accent === 'gold' ? '#fff' : 'var(--warm-gray)',
        border: accent === 'gold' ? 'none' : '1px solid var(--ivory)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon || <Calendar size={16} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: accent === 'gold' ? 'var(--gold)' : 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
          {miniLabel}
        </div>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 17, color: 'var(--espresso)', fontWeight: 500, lineHeight: 1.15, textTransform: 'capitalize' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 3 }}>{subtitle}</div>
        )}
      </div>
      {right}
    </div>
  )
}

// ── Language picker — multi-tag with free text ────────────────────────────────
const LANG_PRESETS: Array<{ code: string; label: string }> = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'Inglés' },
  { code: 'ca', label: 'Catalán' },
  { code: 'fr', label: 'Francés' },
  { code: 'it', label: 'Italiano' },
  { code: 'de', label: 'Alemán' },
  { code: 'pt', label: 'Portugués' },
]
function LanguagePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Stored as comma-separated codes/labels: "es,en,Polaco"
  const tags = (value || '').split(',').map(s => s.trim()).filter(Boolean)
  const [draft, setDraft] = useState('')
  const labelFor = (t: string) => LANG_PRESETS.find(p => p.code === t)?.label || t
  const addTag = (raw: string) => {
    const v = raw.trim()
    if (!v) return
    // Normalize: if user typed a known label, store code instead
    const preset = LANG_PRESETS.find(p => p.label.toLowerCase() === v.toLowerCase())
    const stored = preset ? preset.code : v
    if (tags.some(t => t.toLowerCase() === stored.toLowerCase() || labelFor(t).toLowerCase() === v.toLowerCase())) return
    onChange([...tags, stored].join(','))
  }
  const removeTag = (idx: number) => onChange(tags.filter((_, i) => i !== idx).join(','))
  const suggestions = LANG_PRESETS.filter(p => !tags.includes(p.code))
  return (
    <>
      <label className="form-label">Idiomas de la pareja</label>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
        padding: '8px 10px', minHeight: 44,
        border: '1px solid var(--ivory)', borderRadius: 10, background: '#fff',
        cursor: 'text',
        transition: 'border-color 0.15s',
      }}>
        {tags.map((t, i) => (
          <span key={`${t}-${i}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 4px 4px 11px', borderRadius: 999,
            background: 'var(--gold)', border: 'none',
            fontSize: 12, fontWeight: 600, color: '#fff',
            lineHeight: 1.2,
          }}>
            {labelFor(t)}
            <button type="button" onClick={() => removeTag(i)} aria-label="Quitar" style={{
              width: 17, height: 17, borderRadius: '50%', background: 'rgba(255,255,255,0.25)',
              border: 'none', cursor: 'pointer', color: '#fff', padding: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}><X size={10} /></button>
          </span>
        ))}
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              addTag(draft); setDraft('')
            } else if (e.key === 'Backspace' && !draft && tags.length > 0) {
              removeTag(tags.length - 1)
            }
          }}
          onBlur={() => { if (draft) { addTag(draft); setDraft('') } }}
          placeholder={tags.length === 0 ? 'Escribe un idioma o elige debajo…' : 'Añadir otro…'}
          style={{
            flex: 1, minWidth: 120, border: 'none', outline: 'none',
            fontSize: 13, color: 'var(--charcoal)', background: 'transparent',
            fontFamily: 'Manrope, sans-serif', padding: '4px 2px',
          }}
        />
      </div>
      {suggestions.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 2 }}>Sugerencias:</span>
          {suggestions.map((p, i) => (
            <button key={p.code} type="button" onClick={() => addTag(p.code)} style={{
              padding: 0, border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 11.5, color: 'var(--gold)', fontWeight: 500,
              textDecoration: 'none',
            }}>
              {p.label}{i < suggestions.length - 1 && <span style={{ color: 'var(--ivory)', margin: '0 5px' }}>·</span>}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

// ── Form Modal ─────────────────────────────────────────────────────────────────
function LeadFormModal({ form, setForm, isEdit, editLead, saving, onSubmit, onClose, userId, onEditVisit, onChangeDates, onChangeBudgetDates }: {
  form: any; setForm: (f: any) => void; isEdit: boolean; editLead?: any | null
  saving: boolean; onSubmit: () => void; onClose: () => void; userId: string
  onEditVisit?: () => void
  onChangeDates?: () => void
  onChangeBudgetDates?: () => void
}) {
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  const setOrig = (k: string, v: any) => setForm((f: any) => ({ ...f, [`original_${k}`]: v }))
  const [editingOriginal,  setEditingOriginal]  = useState(false)
  const [showOriginal,     setShowOriginal]     = useState(false)   // Lo que pidió — collapsed by default
  const [showMoreDetails,  setShowMoreDetails]  = useState(true)    // Ceremony/lang/style collapsible
  const [activeModalTab,   setActiveModalTab]   = useState<'boda' | 'oferta' | 'pareja'>(isEdit ? 'boda' : 'pareja')
  const { propuestas: canPropuesta } = usePlanFeatures()
  // Budget file upload (only for budget_sent leads)
  const [budgetUploading, setBudgetUploading] = useState(false)
  const [budgetError,     setBudgetError]     = useState<string | null>(null)
  const [budgetDragOver,  setBudgetDragOver]  = useState(false)
  const budgetInputRef = useRef<HTMLInputElement>(null)
  const initials = getInitials(form.name || '')
  // Lead phase — drives copy + ordering of date sections
  const leadStatus = editLead?.status as DbStatus | undefined
  const isNewPhase = !isEdit || !leadStatus || leadStatus === 'new' || leadStatus === 'lost'

  const dateSectionTitle = isNewPhase ? 'Fecha que quiere la pareja' : 'Fechas propuestas a la pareja'
  const dateSectionHint  = isNewPhase
    ? 'Es lo que el lead pide. Puede que la fecha final que acordéis no sea la misma.'
    : 'Estas son las fechas que estás trabajando con la pareja (negociación / acordadas).'
  const SectionTitle = ({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--cream)', border: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--espresso)' }}>{title}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.3 }}>{hint}</div>}
      </div>
    </div>
  )

  // Budget file upload helpers (only used in budget_sent leads)
  const handleBudgetFileSelect = async (file: File) => {
    const allowed = ['application/pdf','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp']
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|xlsx?|docx?|png|jpe?g|webp)$/i)) {
      setBudgetError('Formato no permitido. Usa PDF, Excel, Word o imagen.'); return
    }
    if (file.size > 20 * 1024 * 1024) { setBudgetError('El archivo no puede superar 20 MB'); return }
    setBudgetUploading(true); setBudgetError(null)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() || 'pdf'
      const path = `${userId}/budgets/${editLead?.id || 'draft'}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
      if (error) { setBudgetError('Error al subir el archivo'); return }
      const { data: pub } = supabase.storage.from('documents').getPublicUrl(path)
      setForm((f: any) => ({ ...f, budget_file_url: pub.publicUrl, budget_file_name: file.name }))
    } catch { setBudgetError('Error al subir el archivo') }
    finally { setBudgetUploading(false) }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 620, width: '100%' }} onClick={e => e.stopPropagation()}>

        {/* Header — gradient with avatar */}
        <div style={{ position: 'relative', padding: '20px 24px 18px', background: 'linear-gradient(135deg, #fef3c7 0%, #fdf6ee 100%)', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{ position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.75)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--espresso)' }}
          >
            <X size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: isEdit ? 'var(--gold)' : '#fff', color: isEdit ? '#fff' : 'var(--gold)', border: isEdit ? 'none' : '2px dashed var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, fontFamily: 'Manrope, sans-serif', flexShrink: 0, boxShadow: isEdit ? '0 4px 14px rgba(212,160,60,0.4)' : 'none' }}>
              {isEdit ? initials : <Plus size={20} />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>
                {isEdit ? 'Editar lead' : 'Nuevo lead'}
              </div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 500, color: 'var(--espresso)', lineHeight: 1.15, textTransform: 'capitalize' }}>
                {isEdit ? (form.name || 'Pareja sin nombre') : 'Nueva pareja interesada'}
              </div>
              {isEdit && leadStatus && (() => {
                const STATUS_INFO: Record<string, { label: string; bg: string; border: string; color: string; icon: React.ReactNode }> = {
                  new:             { label: 'Lead nuevo',          bg: 'rgba(219,234,254,0.7)', border: '#bfdbfe', color: '#1d4ed8', icon: <Sparkles size={11} /> },
                  contacted:       { label: 'En seguimiento',      bg: 'rgba(255,251,235,0.8)', border: '#fde68a', color: '#92400e', icon: <RotateCcw size={11} /> },
                  proposal_sent:   { label: 'Propuesta enviada',   bg: 'rgba(255,251,235,0.8)', border: '#fde68a', color: '#92400e', icon: <FileText size={11} /> },
                  visit_scheduled: { label: 'Visita agendada',     bg: 'rgba(209,250,229,0.7)', border: '#a7f3d0', color: '#047857', icon: <Calendar size={11} /> },
                  post_visit:      { label: 'Post-visita',         bg: 'rgba(207,250,254,0.7)', border: '#a5f3fc', color: '#0e7490', icon: <CheckCircle size={11} /> },
                  budget_sent:     { label: 'Presupuesto enviado', bg: 'rgba(255,251,235,0.8)', border: '#fde68a', color: '#92400e', icon: <Receipt size={11} /> },
                  won:             { label: 'Boda confirmada',     bg: 'rgba(220,252,231,0.7)', border: '#86efac', color: '#15803d', icon: <PartyPopper size={11} /> },
                  lost:            { label: 'Perdido',             bg: 'rgba(254,226,226,0.7)', border: '#fecaca', color: '#b91c1c', icon: <XCircle size={11} /> },
                }
                const info = STATUS_INFO[leadStatus] || STATUS_INFO.new
                const isVisit = leadStatus === 'visit_scheduled' && form.visit_date
                return (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px 3px 8px', borderRadius: 20,
                      background: info.bg, border: `1px solid ${info.border}`,
                      fontSize: 12, fontWeight: 600, color: info.color,
                      backdropFilter: 'blur(4px)',
                    }}>
                      {info.icon} {info.label}
                    </span>
                    {isVisit && (
                      <span style={{ fontSize: 11, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={10} />
                        {new Date(form.visit_date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {form.visit_time ? ` · ${form.visit_time}` : ''}
                      </span>
                    )}
                    {isVisit && onEditVisit && (
                      <button type="button" onClick={onEditVisit} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 20,
                        background: 'rgba(16,185,129,0.12)', border: '1px solid #a7f3d0',
                        color: '#047857', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}>
                        <Edit2 size={10} /> Editar visita
                      </button>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--ivory)', padding: '0 24px', background: '#fafaf8' }}>
          {((() => {
            if (!isEdit) return [
              { key: 'pareja', label: 'Pareja', icon: <Users        size={12} /> },
              { key: 'boda',   label: 'Boda',   icon: <CalendarDays size={12} /> },
            ]
            if (!isNewPhase) return [
              { key: 'boda',   label: 'Boda',   icon: <CalendarDays size={12} /> },
              { key: 'oferta', label: 'Oferta', icon: <Flower2      size={12} /> },
              { key: 'pareja', label: 'Pareja', icon: <Users        size={12} /> },
            ]
            return [
              { key: 'boda',   label: 'Boda',   icon: <CalendarDays size={12} /> },
              { key: 'pareja', label: 'Pareja', icon: <Users        size={12} /> },
            ]
          })() as { key: 'boda' | 'oferta' | 'pareja'; label: string; icon: React.ReactNode }[]).map(t => (
            <button key={t.key} type="button" onClick={() => setActiveModalTab(t.key)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 12.5, fontWeight: activeModalTab === t.key ? 700 : 500,
              color: activeModalTab === t.key ? 'var(--espresso)' : 'var(--warm-gray)',
              borderBottom: activeModalTab === t.key ? '2px solid var(--gold)' : '2px solid transparent',
              marginBottom: -1, whiteSpace: 'nowrap', transition: 'all 0.15s',
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Body — scrollable tab content */}
        <div className="modal-body" style={{ padding: '20px 24px' }}>

          {/* ── TAB: BODA ──────────────────────────────────────────────────────── */}
          {activeModalTab === 'boda' && (<>

          {/* ── Fechas acordadas: summary strip (only when dates are confirmed) ── */}
          {!isNewPhase && editLead && leadStatus !== 'contacted' && leadStatus !== 'proposal_sent' && (() => {
            const dates = expandLeadDates(editLead)
            if (!dates.length) return null
            return (
              <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: '#f0fdf4', border: '1.5px solid #86efac' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <CheckCircle2 size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>Fechas acordadas con la pareja</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {dates.map((d: string) => (
                    <span key={d} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 12,
                      background: '#fff', border: '1.5px solid #86efac',
                      fontSize: 12, fontWeight: 600, color: '#15803d',
                    }}>
                      <CalendarDays size={10} />
                      {formatDateLabel(d)}
                    </span>
                  ))}
                </div>
                {editLead.wedding_duration_days && editLead.wedding_duration_days > 1 && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={10} /> {editLead.wedding_duration_days} días
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── Documento enviado: acceso rápido desde Boda ───────────────────── */}
          {!isNewPhase && editLead && form.budget_file_url && (
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderRadius: 10, background: '#f9fafb', border: '1.5px solid var(--ivory)' }}>
              <Paperclip size={13} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {form.budget_file_name || 'Documento adjunto'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                  Presupuesto enviado ·{' '}
                  <button type="button"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--gold)', fontWeight: 600, fontSize: 11 }}
                    onClick={() => setActiveModalTab('oferta')}>
                    Ver en Oferta →
                  </button>
                </div>
              </div>
              <a href={form.budget_file_url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: 'var(--warm-gray)', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, padding: '5px 9px', background: 'var(--cream)', borderRadius: 7, border: '1px solid var(--ivory)' }}>
                <ExternalLink size={11} /> Ver
              </a>
            </div>
          )}

          {/* Section: Boda deseada / Fechas propuestas */}
          <div style={{ marginBottom: 22 }}>

            {/* ── En seguimiento+: read-only layout ─────────────────────────────── */}
            {!isNewPhase && editLead ? (
              <>
                {/* Sub-section B: Fechas propuestas — moved to Oferta tab for all edit states */}
                {false && (<>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <SectionTitle icon={<Flower2 size={14} />} title="Fechas propuestas a la pareja" hint="Negociadas con la pareja" />
                    {onChangeDates && (
                      <button type="button" onClick={onChangeDates} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '6px 12px', borderRadius: 8, flexShrink: 0, marginBottom: 12,
                        background: '#f0f4ff', border: '1.5px solid #c7d7fd',
                        color: '#4f6ef7', fontSize: 11, fontWeight: 700,
                        cursor: 'pointer', outline: 'none',
                      }}>
                        <Edit2 size={10} /> Cambiar fechas
                      </button>
                    )}
                  </div>
                  {(() => {
                    const proposed = expandLeadDates(editLead)
                    if (!proposed.length) return (
                      <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: '#f9fafb', border: '1px dashed #d1d5db', fontSize: 12, color: 'var(--warm-gray)', textAlign: 'center' }}>
                        Sin fechas propuestas — usa "Cambiar fechas" para seleccionarlas en el calendario
                      </div>
                    )
                    return (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                          {proposed.map(d => (
                            <span key={d} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '5px 10px', borderRadius: 16,
                              background: '#fef3c7', border: '1.5px solid #fde68a',
                              fontSize: 12, fontWeight: 600, color: '#92400e',
                            }}>
                              <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#f59e0b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ color: '#fff', fontSize: 8, fontWeight: 700, lineHeight: 1 }}>✓</span>
                              </span>
                              {formatDateLabel(d)}
                            </span>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={10} />
                          Duración: <strong style={{ color: 'var(--charcoal)', marginLeft: 2 }}>{editLead.wedding_duration_days || 1} {(editLead.wedding_duration_days || 1) === 1 ? 'día' : 'días'}</strong>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Divider */}
                  <div style={{ borderTop: '1px dashed var(--ivory)', marginBottom: 18 }} />
                </>)}

                {/* Sub-section A: Lo que pidió originalmente la pareja — collapsible */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: (showOriginal || editingOriginal) ? 12 : 0 }}>
                  <button type="button" onClick={() => setShowOriginal((v: boolean) => !v)} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none', flex: 1, textAlign: 'left',
                  }}>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--cream)', border: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', flexShrink: 0 }}>
                      <CalendarDays size={14} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--espresso)' }}>Lo que pidió originalmente la pareja</div>
                      <div style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.3 }}>Solicitud inicial antes de negociar fechas</div>
                    </div>
                    {(showOriginal || editingOriginal)
                      ? <ChevronUp size={13} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                      : <ChevronDown size={13} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />}
                  </button>
                  {(showOriginal || editingOriginal) && (
                    <button type="button" onClick={() => setEditingOriginal((v: boolean) => !v)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
                      padding: '5px 10px', borderRadius: 8,
                      background: editingOriginal ? '#ecfdf5' : '#f9fafb',
                      border: `1.5px solid ${editingOriginal ? '#86efac' : '#e5e7eb'}`,
                      color: editingOriginal ? '#15803d' : 'var(--warm-gray)',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none',
                    }}>
                      {editingOriginal ? <><CheckCircle2 size={10} /> Listo</> : <><Edit2 size={10} /> Editar</>}
                    </button>
                  )}
                </div>

                {(showOriginal || editingOriginal) && (editingOriginal ? (
                  /* ── Editable pickers for original request ── */
                  <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Tipo de solicitud</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                      {DATE_FLEX_OPTS.map(opt => (
                        <button key={opt.value} type="button" onClick={() => setOrig('date_flexibility', opt.value)} style={{
                          padding: '4px 11px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid', fontWeight: 500,
                          borderColor: form.original_date_flexibility === opt.value ? 'var(--gold)' : 'var(--ivory)',
                          background:  form.original_date_flexibility === opt.value ? 'var(--gold)' : 'transparent',
                          color:       form.original_date_flexibility === opt.value ? '#fff' : 'var(--warm-gray)',
                        }}>{opt.label}</button>
                      ))}
                    </div>
                    {form.original_date_flexibility === 'exact' && (
                      <MiniCalendarPicker userId={userId} value={form.original_wedding_date} onChange={d => setOrig('wedding_date', d)} />
                    )}
                    {form.original_date_flexibility === 'range' && (
                      <RangeCalendarPicker userId={userId} from={form.original_wedding_date} to={form.original_wedding_date_to} onChange={(f, t) => { setOrig('wedding_date', f); setOrig('wedding_date_to', t) }} />
                    )}
                    {form.original_date_flexibility === 'multi_range' && (
                      <MultiRangeCalendarPicker userId={userId} ranges={form.original_wedding_date_ranges || []} onChange={r => setOrig('wedding_date_ranges', r)} />
                    )}
                    {form.original_date_flexibility === 'month' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select className="form-input" value={form.original_wedding_month} onChange={e => setOrig('wedding_month', e.target.value)}>{MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}</select>
                        <select className="form-input" style={{ width: 110 }} value={form.original_wedding_year} onChange={e => setOrig('wedding_year', e.target.value)}>{YEAR_OPTS.map(y => <option key={y} value={y}>{y}</option>)}</select>
                      </div>
                    )}
                    {form.original_date_flexibility === 'season' && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {SEASONS.map(s => { const active = form.original_wedding_season === s.value; return <button key={s.value} type="button" onClick={() => setOrig('wedding_season', s.value)} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer', outline: 'none', border: `1.5px solid ${active ? 'var(--gold)' : 'var(--ivory)'}`, background: active ? 'var(--gold)' : '#fff', color: active ? '#fff' : 'var(--charcoal)', fontWeight: active ? 700 : 500, transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{s.emoji} {s.label}</button> })}
                        <select className="form-input" style={{ width: 110 }} value={form.original_wedding_year} onChange={e => setOrig('wedding_year', e.target.value)}>{YEAR_OPTS.map(y => <option key={y} value={y}>{y}</option>)}</select>
                      </div>
                    )}
                    {(form.original_date_flexibility === 'flexible' || !form.original_date_flexibility) && (
                      <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>
                        {form.original_date_flexibility === 'flexible' ? 'La pareja era flexible — sin fecha concreta' : 'Selecciona el tipo de solicitud arriba'}
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Read-only display from form.original_* ── */
                  (() => {
                    const origFlex   = form.original_date_flexibility as string
                    const origDate1  = form.original_wedding_date as string
                    const origDate2  = form.original_wedding_date_to as string
                    const origRanges = form.original_wedding_date_ranges as { from: string; to?: string }[]
                    const origYear   = parseInt(form.original_wedding_year)
                    const origMonth  = parseInt(form.original_wedding_month)
                    const origSeason = form.original_wedding_season as string
                    const fmtShort = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
                    const fmtFull  = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                    const fmtLong  = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                    let typeLabel = ''; let lines: string[] = []
                    if (origFlex === 'exact' && origDate1)                   { typeLabel = 'Fecha exacta';       lines = [fmtLong(origDate1)] }
                    else if (origFlex === 'range' && origDate1)               { typeLabel = 'Rango de fechas';    lines = [`${fmtShort(origDate1)}${origDate2 ? ` – ${fmtFull(origDate2)}` : ''}`] }
                    else if (origFlex === 'multi_range' && origRanges?.length){ typeLabel = 'Varias opciones';    lines = origRanges.map((r, i) => `Opción ${i + 1}: ${fmtShort(r.from)}${r.to ? ` – ${fmtFull(r.to)}` : ''}`) }
                    else if (origFlex === 'month' && origYear && origMonth)   { typeLabel = 'Mes concreto';       lines = [`${MONTHS[origMonth - 1]} de ${origYear}`] }
                    else if (origFlex === 'season')                           { typeLabel = 'Temporada';          lines = [`${SEASONS.find(s => s.value === origSeason)?.label ?? origSeason ?? '—'} ${origYear || ''}`] }
                    else if (origFlex === 'flexible')                         { typeLabel = 'Sin fecha definida'; lines = ['La pareja era flexible en fechas'] }
                    if (!typeLabel) return (
                      <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: '#f9fafb', border: '1px dashed #d1d5db', fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>
                        Sin datos de solicitud original — haz clic en "Editar" para añadir
                      </div>
                    )
                    return (
                      <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: '#faf8f5', border: '1px solid var(--ivory)' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{typeLabel}</div>
                        {lines.map((line, i) => <div key={i} style={{ fontSize: 13, color: 'var(--charcoal)', lineHeight: 1.6 }}>{line}</div>)}
                      </div>
                    )
                  })()
                ))}

              </>
            ) : (
              <>
                {/* ── New / lost lead: full date pickers ──────────────────────────── */}
                <SectionTitle
                  icon={<Flower2 size={14} />}
                  title={dateSectionTitle}
                  hint={dateSectionHint}
                />

                {/* ── Flexible date ── */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'none' }}>
                    Fecha deseada
                    {(['exact','range','multi_range'].includes(form.date_flexibility)) && (
                      <span style={{ color: 'var(--rose)', marginLeft: 3 }}>*</span>
                    )}
                  </label>
                  {/* Type selector */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                    {DATE_FLEX_OPTS.map(opt => (
                      <button key={opt.value} type="button" onClick={() => set('date_flexibility', opt.value)} style={{
                        padding: '4px 11px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid', fontWeight: 500,
                        borderColor: form.date_flexibility === opt.value ? 'var(--gold)' : 'var(--ivory)',
                        background:  form.date_flexibility === opt.value ? 'var(--gold)' : 'transparent',
                        color:       form.date_flexibility === opt.value ? '#fff' : 'var(--warm-gray)',
                      }}>{opt.label}</button>
                    ))}
                  </div>

                  {/* EXACT DATE */}
                  {form.date_flexibility === 'exact' && (
                    <div>
                      <MiniCalendarPicker userId={userId} value={form.wedding_date} onChange={d => set('wedding_date', d)} />
                      {form.wedding_date && (() => {
                        const dt = new Date(form.wedding_date + 'T12:00:00')
                        const wd = dt.toLocaleDateString('es-ES', { weekday: 'long' })
                        const dateStr = dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                        const days = Math.ceil((dt.getTime() - Date.now()) / 86400000)
                        return <DateSummaryCard miniLabel="Fecha elegida" title={`${wd}, ${dateStr}`} subtitle={days > 0 ? `Faltan ${days} ${days === 1 ? 'día' : 'días'}` : days === 0 ? 'Es hoy' : `Hace ${-days} ${-days === 1 ? 'día' : 'días'}`} />
                      })()}
                    </div>
                  )}

                  {/* RANGE */}
                  {form.date_flexibility === 'range' && (() => {
                    const rangeDays = form.wedding_date && form.wedding_date_to
                      ? Math.round((new Date(form.wedding_date_to + 'T12:00:00').getTime() - new Date(form.wedding_date + 'T12:00:00').getTime()) / 86400000) + 1
                      : 1
                    const maxDur = Math.max(1, rangeDays)
                    const curDur = Math.min(parseInt(form.wedding_duration_days || '1'), maxDur)
                    return (
                      <div>
                        <RangeCalendarPicker userId={userId} from={form.wedding_date} to={form.wedding_date_to} onChange={(f, t) => { set('wedding_date', f); set('wedding_date_to', t) }} />
                        {form.wedding_date && form.wedding_date_to && (
                          <DateSummaryCard
                            miniLabel="Rango disponible"
                            title={`${new Date(form.wedding_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} – ${new Date(form.wedding_date_to + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                            subtitle={`${rangeDays} ${rangeDays === 1 ? 'día' : 'días'} disponibles para celebrar`}
                            right={(
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Boda dura</span>
                                <select value={curDur} onChange={e => set('wedding_duration_days', e.target.value)} style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid var(--gold)', background: '#fff', color: 'var(--espresso)', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope, sans-serif', cursor: 'pointer', outline: 'none' }}>
                                  {Array.from({ length: maxDur }, (_, i) => i + 1).map(d => <option key={d} value={String(d)}>{d} {d === 1 ? 'día' : 'días'}</option>)}
                                </select>
                              </div>
                            )}
                          />
                        )}
                      </div>
                    )
                  })()}

                  {/* MULTI_RANGE */}
                  {form.date_flexibility === 'multi_range' && (() => {
                    const rs = form.wedding_date_ranges || []
                    const totalDays = rs.reduce((sum: number, r: any) => { if (!r.from) return sum; const a = new Date(r.from + 'T12:00:00'); const b = new Date((r.to || r.from) + 'T12:00:00'); return sum + Math.round((b.getTime() - a.getTime()) / 86400000) + 1 }, 0)
                    return (
                      <div>
                        <MultiRangeCalendarPicker userId={userId} ranges={rs} onChange={r => set('wedding_date_ranges', r)} />
                        {rs.length > 0 && <DateSummaryCard miniLabel="Opciones de fecha" title={`${rs.length} ${rs.length === 1 ? 'rango propuesto' : 'rangos propuestos'}`} subtitle={`${totalDays} ${totalDays === 1 ? 'día candidato' : 'días candidatos'} en total`} />}
                      </div>
                    )
                  })()}

                  {/* MONTH */}
                  {form.date_flexibility === 'month' && (() => {
                    const y = parseInt(form.wedding_year); const mo = parseInt(form.wedding_month)
                    const days = new Date(y, mo, 0).getDate()
                    return (
                      <div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                          <select className="form-input" value={form.wedding_month} onChange={e => set('wedding_month', e.target.value)}>{MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}</select>
                          <select className="form-input" style={{ width: 110 }} value={form.wedding_year} onChange={e => set('wedding_year', e.target.value)}>{YEAR_OPTS.map(yr => <option key={yr} value={yr}>{yr}</option>)}</select>
                        </div>
                        <MiniCalendarPicker userId={userId} readOnly value={undefined} highlights={Array.from({ length: days }, (_, i) => `${y}-${String(mo).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`)} />
                        <DateSummaryCard miniLabel="Mes deseado" title={`${MONTHS[mo - 1]} de ${y}`} subtitle={`Cualquier día del mes (${days} días disponibles)`} />
                      </div>
                    )
                  })()}

                  {/* SEASON */}
                  {form.date_flexibility === 'season' && (() => {
                    const sObj = SEASONS.find(s => s.value === form.wedding_season)
                    return (
                      <div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                          {SEASONS.map(s => {
                            const active = form.wedding_season === s.value
                            return <button key={s.value} type="button" onClick={() => set('wedding_season', s.value)} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer', outline: 'none', border: `1.5px solid ${active ? 'var(--gold)' : 'var(--ivory)'}`, background: active ? 'var(--gold)' : '#fff', color: active ? '#fff' : 'var(--charcoal)', fontWeight: active ? 700 : 500, transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: 5 }}>{s.emoji} {s.label}</button>
                          })}
                          <select className="form-input" style={{ width: 110 }} value={form.wedding_year} onChange={e => set('wedding_year', e.target.value)}>{YEAR_OPTS.map(y => <option key={y} value={y}>{y}</option>)}</select>
                        </div>
                        {sObj && <DateSummaryCard miniLabel="Estación deseada" title={`${sObj.emoji} ${sObj.label} de ${form.wedding_year}`} subtitle="La pareja prefiere casarse en esta época del año" />}
                      </div>
                    )
                  })()}

                  {form.date_flexibility === 'flexible' && <DateSummaryCard accent="cream" miniLabel="Sin fecha definida" title="La pareja es flexible" subtitle="Acordaréis la fecha más adelante según disponibilidad" />}
                </div>

                {/* Guardado: chip — reference of DB-saved date while editing */}
                {isEdit && editLead && (() => {
                  const flex = editLead.date_flexibility; const date1 = editLead.wedding_date; const date2 = editLead.wedding_date_to; const ranges = editLead.wedding_date_ranges
                  if (!flex || flex === 'flexible') return null
                  const fmtLong  = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                  const fmtShort = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
                  const fmtFull  = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                  let txt = ''
                  if (flex === 'exact' && date1) txt = fmtLong(date1)
                  else if (flex === 'range' && date1) txt = `${fmtShort(date1)}${date2 ? ` – ${fmtFull(date2)}` : ''}`
                  else if (flex === 'multi_range' && ranges?.length) txt = ranges.map((r: any, i: number) => `Op. ${i+1}: ${fmtShort(r.from)}${r.to ? ` – ${fmtFull(r.to)}` : ''}`).join('  ·  ')
                  else if (flex === 'month' && date1) txt = `${MONTHS[(parseInt(date1.slice(5,7)) || 1) - 1]} ${date1.slice(0,4)}`
                  else if (flex === 'season' && date1) txt = `${SEASONS.find(s => s.value === date1)?.label || date1} ${date2 || ''}`
                  if (!txt) return null
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 7, background: '#f5f0ea', border: '1px solid var(--ivory)', marginBottom: 4 }}>
                      <Clock size={11} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Guardado:</span>
                      <span style={{ fontSize: 12, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txt}</span>
                    </div>
                  )
                })()}
              </>
            )}

          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--ivory)', marginBottom: 18 }} />

          {/* Guests */}
          <div className="form-group">
            <label className="form-label">Nº de invitados aproximado</label>
            <div style={{ position: 'relative' }}>
              <Users size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)', pointerEvents: 'none' }} />
              <input className="form-input" type="number" min={0} value={form.guests} onChange={e => set('guests', e.target.value)} placeholder="150" style={{ paddingLeft: 34 }} />
            </div>
          </div>

          {/* Más detalles — collapsible */}
          <div style={{ marginBottom: 4 }}>
            <button type="button" onClick={() => setShowMoreDetails((v: boolean) => !v)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 8,
              background: 'transparent', border: '1px solid var(--ivory)',
              color: 'var(--warm-gray)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', outline: 'none', marginBottom: showMoreDetails ? 14 : 0,
            }}>
              {showMoreDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Más detalles
            </button>
            {showMoreDetails && (
              <>
                <div className="two-col">
                  <div className="form-group">
                    <label className="form-label">Tipo de ceremonia</label>
                    <select className="form-input" value={form.ceremony_type} onChange={e => set('ceremony_type', e.target.value)}>
                      <option value="sin_definir">Sin definir</option>
                      <option value="civil">Civil</option>
                      <option value="religiosa">Religiosa</option>
                      <option value="simbolica">Simbólica</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <LanguagePicker value={form.language} onChange={v => set('language', v)} />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Estilo buscado</label>
                  <input className="form-input" value={form.style} onChange={e => set('style', e.target.value)} placeholder="Rústico, moderno, clásico…" />
                </div>
              </>
            )}
          </div>

          {/* Presupuesto orientativo — only for new leads, shown at the bottom of Boda tab */}
          {isNewPhase && (
            <div className="form-group" style={{ marginTop: 12, marginBottom: 4 }}>
              <label className="form-label">Presupuesto orientativo</label>
              <select className="form-input" value={form.budget} onChange={e => set('budget', e.target.value)}>
                {BUDGET_OPTS.map(v => (
                  <option key={v} value={v}>{v === 'sin_definir' ? 'Sin definir' : BUDGET_LABEL[v].replace('k€', '.000 €')}</option>
                ))}
              </select>
            </div>
          )}

          </>)}

          {/* ── TAB: OFERTA ───────────────────────────────────────────────────────── */}
          {activeModalTab === 'oferta' && editLead && (<>

          {/* ════ EN SEGUIMIENTO + VISITA: Fechas propuestas → Propuesta digital ════ */}
          {(leadStatus === 'contacted' || leadStatus === 'proposal_sent' || leadStatus === 'visit_scheduled' || leadStatus === 'post_visit') && (<>

            {/* Fechas propuestas a la pareja */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <SectionTitle icon={<Flower2 size={14} />} title="Fechas propuestas a la pareja" hint="Fechas que estás negociando con la pareja" />
                {onChangeDates && (
                  <button type="button" onClick={onChangeDates} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 8, flexShrink: 0, marginBottom: 12,
                    background: '#f0f4ff', border: '1.5px solid #c7d7fd',
                    color: '#4f6ef7', fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none',
                  }}>
                    <Edit2 size={10} /> Cambiar fechas
                  </button>
                )}
              </div>
              {(() => {
                const dates = expandLeadDates(editLead)
                if (!dates.length) return (
                  <div style={{ padding: '12px 14px', borderRadius: 10, background: '#f9fafb', border: '1px dashed #d1d5db', fontSize: 12, color: 'var(--warm-gray)', textAlign: 'center' }}>
                    Sin fechas — usa "Cambiar fechas" para seleccionarlas en el calendario
                  </div>
                )
                return (
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                      {dates.map((d: string) => (
                        <span key={d} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '5px 10px', borderRadius: 16,
                          background: '#fef3c7', border: '1.5px solid #fde68a',
                          fontSize: 12, fontWeight: 600, color: '#92400e',
                        }}>
                          <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#f59e0b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ color: '#fff', fontSize: 8, fontWeight: 700, lineHeight: 1 }}>✓</span>
                          </span>
                          {formatDateLabel(d)}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={10} />
                      Duración: <strong style={{ color: 'var(--charcoal)', marginLeft: 2 }}>{editLead.wedding_duration_days || 1} {(editLead.wedding_duration_days || 1) === 1 ? 'día' : 'días'}</strong>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--ivory)', marginBottom: 22 }} />

            {/* Propuesta digital */}
            <div style={{ marginBottom: 4 }}>
              <SectionTitle icon={<Sparkles size={14} />} title="Propuesta digital" hint="Propuesta visual e interactiva para la pareja" />
              {canPropuesta ? (
                <a href="/proposals" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 10,
                  background: 'var(--espresso)', color: '#fff',
                  fontSize: 12, fontWeight: 700, textDecoration: 'none',
                }}>
                  <ExternalLink size={12} /> Crear propuesta digital
                </a>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, background: '#f9fafb', border: '1px solid var(--ivory)' }}>
                  <LockKeyhole size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>Propuesta digital</div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Disponible en plan Premium</div>
                  </div>
                </div>
              )}
            </div>

          </>)}

          {/* ════ PRESUPUESTO + GANADA: Fechas presup → Presupuesto → Pres.digital → Fechas ofertadas → Prop.digital ════ */}
          {(leadStatus === 'budget_sent' || leadStatus === 'won') && (<>

            {/* Fechas presupuestadas */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <SectionTitle icon={<Receipt size={14} />} title="Fechas presupuestadas" hint="Fechas confirmadas en el presupuesto enviado" />
                {onChangeBudgetDates && (
                  <button type="button" onClick={onChangeBudgetDates} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 8, flexShrink: 0, marginBottom: 12,
                    background: '#f0f4ff', border: '1.5px solid #c7d7fd',
                    color: '#4f6ef7', fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none',
                  }}>
                    <Edit2 size={10} /> Cambiar fechas
                  </button>
                )}
              </div>
              {(() => {
                const dates = expandBudgetDates(editLead)
                if (!dates.length) return (
                  <div style={{ padding: '12px 14px', borderRadius: 10, background: '#f9fafb', border: '1px dashed #d1d5db', fontSize: 12, color: 'var(--warm-gray)', textAlign: 'center' }}>
                    Sin fechas de presupuesto — usa "Cambiar fechas" para fijarlas
                  </div>
                )
                return (
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                      {dates.map((d: string) => (
                        <span key={d} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '5px 10px', borderRadius: 16,
                          background: '#eff6ff', border: '1.5px solid #bfdbfe',
                          fontSize: 12, fontWeight: 600, color: '#1e40af',
                        }}>
                          <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ color: '#fff', fontSize: 8, fontWeight: 700, lineHeight: 1 }}>✓</span>
                          </span>
                          {formatDateLabel(d)}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--ivory)', marginBottom: 22 }} />

            {/* Presupuesto (libre) */}
            <div style={{ marginBottom: 22 }}>
              <SectionTitle icon={<Receipt size={14} />} title="Presupuesto" hint="Presupuesto enviado a la pareja" />

              {/* Importe — solo para boda ganada */}
              {leadStatus === 'won' && (
                <div className="form-group">
                  <label className="form-label">Importe</label>
                  <select className="form-input" value={form.budget} onChange={e => set('budget', e.target.value)}>
                    {BUDGET_OPTS.map(v => (
                      <option key={v} value={v}>{v === 'sin_definir' ? 'Sin definir' : BUDGET_LABEL[v].replace('k€', '.000 €')}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Documento adjunto */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Documento adjunto</label>
                {form.budget_file_url ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1.5px solid #86efac' }}>
                    <CheckCircle2 size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#15803d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.budget_file_name || 'Documento adjunto'}</div>
                      <div style={{ fontSize: 11, color: '#16a34a' }}>Archivo guardado</div>
                    </div>
                    <a href={form.budget_file_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: '#16a34a', textDecoration: 'underline', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <ExternalLink size={11} /> Ver
                    </a>
                    <button type="button" onClick={() => setForm((f: any) => ({ ...f, budget_file_url: '', budget_file_name: '' }))}
                      style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(22,163,74,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#16a34a' }}>
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={e => { e.preventDefault(); setBudgetDragOver(true) }}
                    onDragLeave={() => setBudgetDragOver(false)}
                    onDrop={e => { e.preventDefault(); setBudgetDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleBudgetFileSelect(f) }}
                    onClick={() => budgetInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${budgetDragOver ? 'var(--gold)' : 'var(--ivory)'}`,
                      borderRadius: 10, padding: '18px 16px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                      cursor: 'pointer', background: budgetDragOver ? '#fffbeb' : '#fafaf8',
                      transition: 'all 0.15s',
                    }}>
                    <input ref={budgetInputRef} type="file" style={{ display: 'none' }}
                      accept=".pdf,.xlsx,.xls,.docx,.doc,.png,.jpg,.jpeg,.webp"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleBudgetFileSelect(f) }} />
                    {budgetUploading ? (
                      <div style={{ fontSize: 12, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--gold)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                        Subiendo…
                      </div>
                    ) : (
                      <>
                        <Upload size={18} style={{ color: 'var(--gold)', opacity: 0.7 }} />
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>Arrastra el archivo o haz clic</div>
                          <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>PDF, Excel, Word o imagen · máx. 20 MB</div>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {budgetError && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={11} /> {budgetError}
                  </div>
                )}
              </div>
            </div>

            {/* Presupuesto digital (bloqueado para básico) */}
            <div style={{ marginBottom: 22 }}>
              <SectionTitle icon={<FileText size={14} />} title="Presupuesto digital" hint="Versión interactiva del presupuesto generada automáticamente" />
              {canPropuesta ? (
                <a href="/budgets" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 10,
                  background: 'var(--espresso)', color: '#fff',
                  fontSize: 12, fontWeight: 700, textDecoration: 'none',
                }}>
                  <ExternalLink size={12} /> Crear presupuesto digital
                </a>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, background: '#f9fafb', border: '1px solid var(--ivory)' }}>
                  <LockKeyhole size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>Presupuesto digital</div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Disponible en plan Premium</div>
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--ivory)', marginBottom: 22 }} />

            {/* Fechas ofertadas (las que se propusieron/negociaron antes del presupuesto — read-only) */}
            <div style={{ marginBottom: 22 }}>
              <SectionTitle icon={<Flower2 size={14} />} title="Fechas ofertadas" hint="Fechas propuestas a la pareja durante la negociación" />
              {(() => {
                const dates = expandLeadDates(editLead)
                if (!dates.length) return (
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: '#f9fafb', border: '1px dashed #d1d5db', fontSize: 12, color: 'var(--warm-gray)', textAlign: 'center' }}>
                    Sin fechas ofertadas registradas
                  </div>
                )
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {dates.map((d: string) => (
                      <span key={d} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 12,
                        background: '#f3f4f6', border: '1.5px solid #e5e7eb',
                        fontSize: 12, fontWeight: 600, color: '#6b7280',
                      }}>
                        <CalendarDays size={10} />
                        {formatDateLabel(d)}
                      </span>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--ivory)', marginBottom: 22 }} />

            {/* Propuesta digital (bloqueada para básico) */}
            <div style={{ marginBottom: 4 }}>
              <SectionTitle icon={<Sparkles size={14} />} title="Propuesta digital" hint="Propuesta visual e interactiva para la pareja" />
              {canPropuesta ? (
                <a href="/proposals" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 10,
                  background: 'var(--espresso)', color: '#fff',
                  fontSize: 12, fontWeight: 700, textDecoration: 'none',
                }}>
                  <ExternalLink size={12} /> Crear propuesta digital
                </a>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, background: '#f9fafb', border: '1px solid var(--ivory)' }}>
                  <LockKeyhole size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>Propuesta digital</div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Disponible en plan Premium</div>
                  </div>
                </div>
              )}
            </div>

          </>)}

          </>)}

          {/* ── TAB: PAREJA ───────────────────────────────────────────────────────── */}
          {activeModalTab === 'pareja' && (<>

          {/* Section: Contacto */}
          <div style={{ marginBottom: 22 }}>
            <SectionTitle icon={<Users size={14} />} title="Contacto de la pareja" />

            <div className="form-group">
              <label className="form-label">Nombre de la pareja <span style={{ color: 'var(--rose)' }}>*</span></label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Laura & Carlos" />
            </div>

            <div className="two-col">
              <div className="form-group">
                <label className="form-label">Email <span style={{ color: 'var(--rose)' }}>*</span> <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--warm-gray)' }}>(o tel.)</span></label>
                <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="pareja@email.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input className="form-input" value={form.phone} onChange={e => {
                  const val = e.target.value
                  set('phone', val)
                  if (!form.whatsapp || form.whatsapp === form.phone) set('whatsapp', val)
                }} placeholder="+34 600 000 000" />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">WhatsApp <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--warm-gray)' }}>(si distinto del teléfono)</span></label>
              <input className="form-input" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="+34 600 000 000" />
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--ivory)', marginBottom: 22 }} />

          {/* Section: Origen + Notas */}
          <div style={{ marginBottom: 22 }}>
            <SectionTitle icon={<Info size={14} />} title="Origen y notas internas" />

            <div className="form-group">
              <label className="form-label">¿Cómo nos ha conocido?</label>
              <select className="form-input" value={form.source} onChange={e => set('source', e.target.value)}>
                {Object.entries(SOURCE_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Notas internas <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--warm-gray)' }}>(solo tú las verás)</span></label>
              <textarea className="form-textarea" style={{ minHeight: 80 }} value={form.notes}
                onChange={e => set('notes', e.target.value)} placeholder="Ej: nos contactaron tras la feria de bodas, prefieren llamada en horario de tarde…" />
            </div>
          </div>

          </>)}

        </div>

        {/* Footer — sticky */}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={saving}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear lead'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Visit Schedule Modal — clean, modern UI dedicated to scheduling a venue visit ──
function VisitScheduleModal({
  lead, allLeads = [], userId, onConfirm, onClose,
}: {
  lead: any
  allLeads?: any[]
  userId: string
  onConfirm: (
    leadUpdates: any,
    calendarDates: string[],
    calendarStatus: 'negociacion' | 'reservado',
    isVisit: boolean,
    halfDayMap?: Record<string, 'medio_dia_manana' | 'medio_dia_tarde'>,
    visitTime?: string,
    visitDuration?: number,
  ) => Promise<void>
  onClose: () => void
}) {
  const isEditing = !!lead.visit_date
  // Build map of other leads' visits indexed by date (ignoring this lead + past dates)
  const otherVisitsByDate = useMemo(() => {
    const todayS = todayIso()
    const map: Record<string, any[]> = {}
    for (const l of allLeads) {
      if (!l || l.id === lead.id) continue
      if (l.status !== 'visit_scheduled') continue
      if (!l.visit_date || l.visit_date < todayS) continue
      if (!map[l.visit_date]) map[l.visit_date] = []
      map[l.visit_date].push(l)
    }
    return map
  }, [allLeads, lead.id])
  const todayStr = todayIso()
  const initD = lead.visit_date ? new Date(lead.visit_date + 'T12:00:00')
    : lead.wedding_date ? new Date(lead.wedding_date + 'T12:00:00')
    : new Date()
  const [viewYear,  setViewYear]  = useState(initD.getFullYear())
  const [viewMonth, setViewMonth] = useState(initD.getMonth())
  const [selected,  setSelected]  = useState<string | null>(lead.visit_date || null)
  const [calEntries, setCalEntries] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [visitTime,     setVisitTime]     = useState<string>(lead.visit_time || '')
  const [visitDuration, setVisitDuration] = useState<number>(lead.visit_duration || 60)

  useEffect(() => {
    const supabase = createClient()
    const ym = `${viewYear}-${pad(viewMonth + 1)}`
    const last = new Date(viewYear, viewMonth + 1, 0).getDate()
    supabase.from('calendar_entries').select('date,status,note').eq('user_id', userId)
      .gte('date', `${ym}-01`).lte('date', `${ym}-${pad(last)}`)
      .then(({ data }) => {
        const map: Record<string, any> = {}
        ;(data || []).forEach((e: any) => { if (!map[e.date]) map[e.date] = e })
        setCalEntries(prev => ({ ...prev, ...map }))
      })
  }, [viewYear, viewMonth, userId])

  const isBlocked = (ds: string) => {
    const e = calEntries[ds]
    if (!e) return false
    const isHalf = e.note?.startsWith('medio_dia')
    return !isHalf && (e.status === 'reservado' || e.status === 'bloqueado')
  }

  const quickPicks = useMemo(() => {
    const now = new Date(); now.setHours(12, 0, 0, 0)
    const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const add = (n: number) => { const d = new Date(now); d.setDate(d.getDate() + n); return iso(d) }
    const thisSat = (() => {
      const d = new Date(now)
      const diff = (6 - d.getDay() + 7) % 7
      d.setDate(d.getDate() + diff)
      return iso(d)
    })()
    const nextSat = (() => {
      const d = new Date(now)
      let diff = (6 - d.getDay() + 7) % 7
      if (diff === 0) diff = 7
      d.setDate(d.getDate() + diff + 7)
      return iso(d)
    })()
    return [
      { label: 'Hoy',          value: add(0) },
      { label: 'Mañana',       value: add(1) },
      { label: 'Este sábado',  value: thisSat },
      { label: 'Próx. sábado', value: nextSat },
    ]
  }, [])

  const timePresets = ['10:00', '11:00', '12:00', '16:00', '17:00', '18:00']
  const durations   = [
    { v: 30,  label: '30 min' },
    { v: 45,  label: '45 min' },
    { v: 60,  label: '1 h' },
    { v: 90,  label: '1h 30' },
    { v: 120, label: '2 h' },
  ]

  const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate()
  let startDow = new Date(viewYear, viewMonth, 1).getDay() - 1
  if (startDow < 0) startDow = 6
  const cells = [...Array(startDow).fill(null), ...Array.from({ length: lastDay }, (_, i) => i + 1)]
  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) } else setViewMonth(m => m - 1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) } else setViewMonth(m => m + 1) }

  const initials = getInitials(lead.name || '')

  const jumpTo = (ds: string) => {
    if (isBlocked(ds) || ds < todayStr) return
    const d = new Date(ds + 'T12:00:00')
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
    setSelected(ds)
  }

  const formatLong = (ds: string) =>
    new Date(ds + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const handleConfirm = async () => {
    if (!selected || saving) return
    setSaving(true)
    try {
      await onConfirm({}, [selected], 'negociacion', true, undefined, visitTime || undefined, visitDuration)
    } finally { setSaving(false) }
  }

  const weddingInfo = (() => {
    const flex = lead.date_flexibility || 'exact'
    if (flex === 'exact' && lead.wedding_date) return formatLong(lead.wedding_date)
    if (flex === 'range' && lead.wedding_date)
      return lead.wedding_date_to ? `${formatDateLabel(lead.wedding_date)} – ${formatDateLabel(lead.wedding_date_to)}` : formatDateLabel(lead.wedding_date)
    if (flex === 'month' && lead.wedding_year && lead.wedding_month) return `${MONTHS[lead.wedding_month - 1]} ${lead.wedding_year}`
    if (flex === 'season' && lead.wedding_season) return `${lead.wedding_season} ${lead.wedding_year || ''}`.trim()
    if (flex === 'multi_range' && lead.wedding_date_ranges?.length) return `${lead.wedding_date_ranges.length} opciones`
    return 'Sin fecha definida'
  })()

  const phoneDigits = (lead.whatsapp || lead.phone || '').replace(/\D/g, '')
  const waLink = phoneDigits ? `https://wa.me/${phoneDigits}` : null

  const endTime = (() => {
    if (!visitTime) return null
    const [h, m] = visitTime.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return null
    const total = h * 60 + m + visitDuration
    const eh = Math.floor(total / 60) % 24
    const em = total % 60
    return `${pad(eh)}:${pad(em)}`
  })()

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,15,12,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 580, maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 30px 80px rgba(0,0,0,0.35)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ position: 'relative', padding: '22px 24px 20px', background: 'linear-gradient(135deg, #fef3c7 0%, #fdf6ee 100%)', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{ position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.75)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--espresso)' }}
          >
            <X size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--gold)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, fontFamily: 'Manrope, sans-serif', flexShrink: 0, boxShadow: '0 4px 14px rgba(212,160,60,0.4)' }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Landmark size={11} /> {isEditing ? 'Editar visita' : 'Agendar visita'}
              </div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, fontWeight: 500, color: 'var(--espresso)', lineHeight: 1.1, textTransform: 'capitalize' }}>
                {lead.name || 'Pareja sin nombre'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 24px' }}>

          {/* Lead details */}
          <div style={{ background: 'var(--cream)', border: '1px solid var(--ivory)', borderRadius: 12, padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Calendar size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Boda</div>
                <div style={{ fontSize: 12, color: 'var(--charcoal)', fontWeight: 500, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{weddingInfo}</div>
              </div>
            </div>
            {lead.guests != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Users size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Invitados</div>
                  <div style={{ fontSize: 12, color: 'var(--charcoal)', fontWeight: 500 }}>{lead.guests || '—'}</div>
                </div>
              </div>
            )}
            {(lead.phone || lead.whatsapp) && (
              <a
                href={waLink || `tel:${lead.phone}`}
                target={waLink ? '_blank' : undefined}
                rel="noopener"
                style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
              >
                {waLink ? <MessageCircle size={14} style={{ color: '#25D366', flexShrink: 0 }} /> : <Phone size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{waLink ? 'WhatsApp' : 'Teléfono'}</div>
                  <div style={{ fontSize: 12, color: 'var(--charcoal)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.whatsapp || lead.phone}</div>
                </div>
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                <Mail size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</div>
                  <div style={{ fontSize: 12, color: 'var(--charcoal)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.email}</div>
                </div>
              </a>
            )}
          </div>

          {/* Step 1 · Date */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--gold)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>1</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>Elige el día</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {quickPicks.map(q => {
                const blocked = isBlocked(q.value)
                const active  = selected === q.value
                return (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => !blocked && jumpTo(q.value)}
                    disabled={blocked}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 999,
                      cursor: blocked ? 'not-allowed' : 'pointer',
                      outline: 'none',
                      fontSize: 12, fontWeight: 600,
                      border: `1.5px solid ${active ? 'var(--gold)' : 'var(--ivory)'}`,
                      background: active ? 'var(--gold)' : '#fff',
                      color: active ? '#fff' : blocked ? '#cbc8c2' : 'var(--charcoal)',
                      textDecoration: blocked ? 'line-through' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    {q.label}
                  </button>
                )
              })}
            </div>

            <div style={{ border: '1px solid var(--ivory)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--cream)', borderBottom: '1px solid var(--ivory)' }}>
                <button onClick={prevMonth} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--ivory)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--charcoal)' }}>
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, color: 'var(--espresso)', fontWeight: 500, textTransform: 'capitalize' }}>
                  {MONTHS[viewMonth]} {viewYear}
                </span>
                <button onClick={nextMonth} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--ivory)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--charcoal)' }}>
                  <ChevronRight size={14} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--ivory)' }}>
                {DAYS_SHORT.map((d, i) => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: i >= 5 ? 'var(--gold)' : 'var(--warm-gray)', letterSpacing: '0.1em', padding: '10px 0' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {cells.map((day, i) => {
                  if (!day) return <div key={`e-${i}`} style={{ minHeight: 46, borderBottom: '1px solid var(--ivory)', borderRight: i % 7 !== 6 ? '1px solid var(--ivory)' : 'none' }} />
                  const ds = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
                  const isPast       = ds < todayStr
                  const blocked      = isBlocked(ds)
                  const isToday      = ds === todayStr
                  const isSelected   = selected === ds
                  const canClick     = !isPast && !blocked
                  const otherVisits  = otherVisitsByDate[ds] || []
                  const hasOtherVisit = otherVisits.length > 0
                  // Earliest time among visits (to show on cell when not selected)
                  const firstTime = hasOtherVisit
                    ? otherVisits.map(v => v.visit_time).filter(Boolean).sort()[0]
                    : null

                  return (
                    <button
                      key={ds}
                      onClick={() => canClick && setSelected(ds)}
                      disabled={!canClick}
                      title={blocked ? 'Día reservado o bloqueado' : isPast ? 'Fecha pasada' : hasOtherVisit ? `Visita ya agendada: ${otherVisits.map(v => `${v.name}${v.visit_time ? ' · ' + v.visit_time : ''}`).join(' · ')}` : ''}
                      style={{
                        minHeight: 52,
                        border: 'none',
                        borderBottom: '1px solid var(--ivory)',
                        borderRight: i % 7 !== 6 ? '1px solid var(--ivory)' : 'none',
                        background: isSelected ? 'var(--gold)' : isPast ? '#fafaf7' : blocked ? '#f9f7f3' : '#fff',
                        color: isSelected ? '#fff' : isPast ? '#cfcbc3' : blocked ? '#b8b3aa' : 'var(--charcoal)',
                        cursor: canClick ? 'pointer' : 'default',
                        fontSize: 14,
                        fontWeight: isSelected ? 700 : isToday ? 700 : 500,
                        fontFamily: 'Manrope, sans-serif',
                        boxShadow: isSelected
                          ? 'inset 0 0 0 2px var(--gold)'
                          : isToday ? 'inset 0 0 0 1.5px var(--gold)' : 'none',
                        textDecoration: blocked ? 'line-through' : 'none',
                        transition: 'background 0.12s, color 0.12s',
                        outline: 'none',
                        position: 'relative',
                        padding: 0,
                        overflow: 'hidden',
                      }}
                    >
                      <span style={{ display: 'block', paddingTop: 6 }}>{day}</span>
                      {hasOtherVisit && (
                        <span
                          aria-label="Otra visita ya agendada"
                          style={{
                            position: 'absolute',
                            left: 0, right: 0, bottom: 0,
                            background: isSelected ? 'rgba(255,255,255,0.85)' : '#ecfdf5',
                            color: isSelected ? '#047857' : '#047857',
                            fontSize: 9, fontWeight: 700,
                            letterSpacing: '0.04em',
                            fontVariantNumeric: 'tabular-nums',
                            lineHeight: 1,
                            padding: '3px 0 4px',
                            borderTop: `2px solid ${isSelected ? '#fff' : '#10b981'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {firstTime || 'visita'}
                          {otherVisits.length > 1 && (
                            <span style={{ marginLeft: 3, fontSize: 8, opacity: 0.75 }}>+{otherVisits.length - 1}</span>
                          )}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Step 2 · Time & duration */}
          <div style={{ marginBottom: 16, opacity: selected ? 1 : 0.5, pointerEvents: selected ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: selected ? 'var(--gold)' : 'var(--ivory)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>2</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>Hora y duración <span style={{ fontWeight: 400, color: 'var(--warm-gray)' }}>(opcional)</span></div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, alignItems: 'center' }}>
              <Clock size={13} style={{ color: 'var(--warm-gray)', marginRight: 2 }} />
              {timePresets.map(t => {
                const active = visitTime === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setVisitTime(active ? '' : t)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      cursor: 'pointer',
                      outline: 'none',
                      fontSize: 12, fontWeight: 600,
                      border: `1.5px solid ${active ? 'var(--gold)' : 'var(--ivory)'}`,
                      background: active ? 'var(--gold)' : '#fff',
                      color: active ? '#fff' : 'var(--charcoal)',
                      transition: 'all 0.15s',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {t}
                  </button>
                )
              })}
              <input
                type="time"
                value={visitTime}
                onChange={e => setVisitTime(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1.5px solid var(--ivory)',
                  fontSize: 12,
                  color: 'var(--charcoal)',
                  fontFamily: 'Manrope, sans-serif',
                  outline: 'none',
                  width: 110,
                }}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {durations.map(d => {
                const active = visitDuration === d.v
                return (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => setVisitDuration(d.v)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      cursor: 'pointer',
                      outline: 'none',
                      fontSize: 12, fontWeight: 600,
                      border: `1.5px solid ${active ? 'var(--espresso)' : 'var(--ivory)'}`,
                      background: active ? 'var(--espresso)' : '#fff',
                      color: active ? '#fff' : 'var(--charcoal)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Summary */}
          <div
            style={{
              borderRadius: 14,
              padding: '16px 18px',
              background: selected ? 'linear-gradient(135deg, #fef3c7 0%, #fdf6ee 100%)' : 'var(--cream)',
              border: `1.5px solid ${selected ? 'var(--gold)' : 'var(--ivory)'}`,
              display: 'flex', alignItems: 'center', gap: 14,
              transition: 'all 0.2s',
            }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 12, background: selected ? 'var(--gold)' : '#fff', border: selected ? 'none' : '1px solid var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Calendar size={20} style={{ color: selected ? '#fff' : 'var(--warm-gray)' }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              {selected ? (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>
                    Resumen de la visita
                  </div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, color: 'var(--espresso)', fontWeight: 500, textTransform: 'capitalize', lineHeight: 1.2 }}>
                    {formatLong(selected)}
                  </div>
                  {visitTime && (
                    <div style={{ fontSize: 12, color: 'var(--charcoal)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
                      <Clock size={12} style={{ color: 'var(--gold)' }} />
                      {visitTime}{endTime ? ` – ${endTime}` : ''} <span style={{ color: 'var(--warm-gray)' }}>· {durations.find(d => d.v === visitDuration)?.label}</span>
                    </div>
                  )}
                  {selected && (otherVisitsByDate[selected]?.length || 0) > 0 && (() => {
                    const dayVisits = [...otherVisitsByDate[selected]].sort((a, b) => (a.visit_time || 'zz').localeCompare(b.visit_time || 'zz'))
                    // Compute overlap with the time being chosen now
                    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
                    const myStart = visitTime ? toMin(visitTime) : null
                    const myEnd   = myStart != null ? myStart + visitDuration : null
                    const overlapsMine = (v: any) => {
                      if (myStart == null || myEnd == null || !v.visit_time) return false
                      const s = toMin(v.visit_time)
                      const e = s + (v.visit_duration || 60)
                      return s < myEnd && e > myStart
                    }
                    const anyOverlap = dayVisits.some(overlapsMine)
                    return (
                      <div style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden', border: `1px solid ${anyOverlap ? '#fca5a5' : '#fed7aa'}` }}>
                        <div style={{ padding: '7px 10px', background: anyOverlap ? '#fef2f2' : '#fff7ed', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <AlertTriangle size={12} style={{ color: anyOverlap ? '#dc2626' : '#ea580c', flexShrink: 0 }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: anyOverlap ? '#991b1b' : '#9a3412', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {anyOverlap ? 'Conflicto de horario' : `Ya hay ${dayVisits.length === 1 ? 'otra visita' : `${dayVisits.length} visitas`} este día`}
                          </span>
                        </div>
                        <div style={{ background: '#fff', display: 'flex', flexDirection: 'column' }}>
                          {dayVisits.map((v, vi) => {
                            const overlap = overlapsMine(v)
                            const vEnd = v.visit_time ? (() => {
                              const s = toMin(v.visit_time); const e = s + (v.visit_duration || 60)
                              return `${pad(Math.floor(e / 60) % 24)}:${pad(e % 60)}`
                            })() : null
                            const ini = getInitials(v.name || '')
                            return (
                              <div key={v.id} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 10px',
                                borderTop: vi === 0 ? 'none' : '1px solid var(--ivory)',
                                background: overlap ? '#fef2f2' : '#fff',
                              }}>
                                <div style={{
                                  width: 28, height: 28, borderRadius: '50%',
                                  background: overlap ? '#fee2e2' : '#ecfdf5',
                                  color: overlap ? '#b91c1c' : '#047857',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                                }}>{ini}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {v.name || 'Lead sin nombre'}
                                  </div>
                                  <div style={{ fontSize: 10, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 5, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                                    <Clock size={10} style={{ color: overlap ? '#dc2626' : '#10b981' }} />
                                    {v.visit_time ? `${v.visit_time}${vEnd ? ` – ${vEnd}` : ''}` : 'Sin hora'}
                                    {v.visit_duration ? <span style={{ opacity: 0.7 }}>· {v.visit_duration} min</span> : null}
                                  </div>
                                </div>
                                {overlap && (
                                  <span style={{ fontSize: 9, fontWeight: 700, color: '#991b1b', background: '#fee2e2', padding: '3px 7px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    Solapa
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>
                    Sin fecha
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--warm-gray)' }}>
                    Elige una fecha en el calendario para agendar la visita.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px 18px', borderTop: '1px solid var(--ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!selected || saving}
            style={{ opacity: !selected || saving ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Calendar size={13} />
            {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Confirmar visita'}
          </button>
        </div>
      </div>
    </div>
  )
}

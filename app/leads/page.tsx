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
  Sprout, Sun, Leaf, Zap, LockKeyhole, OctagonAlert, Flower2,
  List, LayoutGrid, Receipt, ChevronDown,
} from 'lucide-react'

// ── Types & config ─────────────────────────────────────────────────────────────
type DbStatus = 'new' | 'contacted' | 'proposal_sent' | 'visit_scheduled' | 'post_visit' | 'budget_sent' | 'won' | 'lost'
type Tab      = 'new' | 'in_progress' | 'visit' | 'post_visit' | 'budget' | 'confirmed' | 'lost'

const TAB_STATUSES: Record<Tab, DbStatus[]> = {
  new:         ['new'],
  in_progress: ['contacted', 'proposal_sent'],
  visit:       ['visit_scheduled'],
  post_visit:  ['post_visit'],
  budget:      ['budget_sent'],
  confirmed:   ['won'],
  lost:        ['lost'],
}

const TABS: { key: Tab; label: string; emoji: React.ReactNode }[] = [
  { key: 'new',         label: 'Nuevos',           emoji: <Sparkles size={13} /> },
  { key: 'in_progress', label: 'En seguimiento',   emoji: <Eye size={13} /> },
  { key: 'visit',       label: 'Visita agendada',  emoji: <Landmark size={13} /> },
  { key: 'post_visit',  label: 'Post-visita',      emoji: <CheckCircle size={13} /> },
  { key: 'budget',      label: 'Presupuesto',      emoji: <FileText size={13} /> },
  { key: 'confirmed',   label: 'Confirmados',      emoji: <PartyPopper size={13} /> },
  { key: 'lost',        label: 'Perdidos',         emoji: <XCircle size={13} /> },
]

const SUB_STATUS_LABEL: Record<DbStatus, string> = {
  new: 'Nuevo', contacted: 'Contactado', proposal_sent: 'Propuesta enviada',
  visit_scheduled: 'Visita agendada', post_visit: 'Post-visita',
  budget_sent: 'Presupuesto enviado', won: 'Confirmado', lost: 'Perdido',
}
const SOURCE_LABEL: Record<string, string> = {
  web: 'Web', whatsapp: 'WhatsApp', instagram: 'Instagram',
  email: 'Email', referral: 'Referido', manual: 'Manual', other: 'Otro',
}
const BUDGET_LABEL: Record<string, string> = {
  sin_definir: '—', menos_20k: '< 20k€', '20k_35k': '20–35k€',
  '35k_50k': '35–50k€', mas_50k: '> 50k€',
}
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

const CAL_AVAIL_CFG: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  libre:       { bg: '#fff',    border: '#e5e7eb', dot: '#d1fae5', label: 'Libre' },
  negociacion: { bg: '#fef9ec', border: '#fde68a', dot: '#f59e0b', label: 'En negociación' },
  reservado:   { bg: '#fdf2f8', border: '#fbcfe8', dot: '#ec4899', label: 'Reservado' },
  bloqueado:   { bg: '#f3f4f6', border: 'var(--stone)', dot: '#9ca3af', label: 'Bloqueado' },
}

const emptyForm = {
  name: '', email: '', phone: '', whatsapp: '',
  // flexible date fields
  date_flexibility: 'exact',
  wedding_date: '', wedding_date_to: '',
  wedding_date_ranges: [] as { from: string; to: string }[],
  wedding_year: String(new Date().getFullYear() + 1),
  wedding_month: '6',
  wedding_season: 'summer',
  wedding_duration_days: '1',
  // original date fields (editable)
  original_date_flexibility: '' as string,
  original_wedding_date: '' as string,
  original_wedding_date_to: '' as string,
  original_wedding_date_ranges: [] as { from: string; to: string }[],
  // other
  visit_date: '', guests: '', source: 'web',
  notes: '', ceremony_type: 'sin_definir', budget: 'sin_definir',
  language: 'es', style: '',
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
      if (search && !l.name?.toLowerCase().includes(search.toLowerCase()) &&
          !l.email?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [leads, activeTab, hidePast, filterSrc, filterBudget, search, features.leads_new_only, features.leads_date_filter])

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
      // Clear visit_date on the lead
      await supabase.from('leads').update({ visit_date: null }).eq('id', lead.id)

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

      updatedLead = { ...lead, visit_date: null }
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
  const handleDateConfirm = async (leadUpdates: any, calendarDates: string[], calendarStatus: 'negociacion' | 'reservado', isVisit: boolean, halfDayMap?: Record<string, 'medio_dia_manana' | 'medio_dia_tarde'>) => {
    if (!dateConfirmLead || !dateConfirmStatus) return
    const supabase = createClient()

    const finalUpdates: any = { status: dateConfirmStatus, ...leadUpdates }
    if (isVisit && calendarDates.length > 0) finalUpdates.visit_date = calendarDates[0]

    // Si aún no hay fechas originales guardadas, fijarlas ahora antes de cualquier cambio
    // (se hace siempre al primer cambio de estado, cambien o no las fechas)
    if (!isVisit && !dateConfirmLead.original_date_flexibility) {
      finalUpdates.original_date_flexibility    = dateConfirmLead.date_flexibility    ?? 'exact'
      finalUpdates.original_wedding_date        = dateConfirmLead.wedding_date        ?? null
      finalUpdates.original_wedding_date_to     = dateConfirmLead.wedding_date_to     ?? null
      finalUpdates.original_wedding_date_ranges = dateConfirmLead.wedding_date_ranges ?? null
    }

    const { data: updatedLead, error: updateErr } = await supabase.from('leads')
      .update(finalUpdates).eq('id', dateConfirmLead.id).select().single()

    // Cascading fallbacks for missing optional columns (original_*, wedding_duration_days, etc.)
    let resolvedLead = updatedLead
    if (updateErr || !updatedLead) {
      // 2nd try: drop original_* fields but keep core date fields + status
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { wedding_duration_days: _dur, ...coreLeadUpdates } = leadUpdates
      const { data: fallback2, error: err2 } = await supabase.from('leads')
        .update({ status: dateConfirmStatus, ...coreLeadUpdates }).eq('id', dateConfirmLead.id).select().single()
      if (!err2 && fallback2) {
        resolvedLead = fallback2
      } else {
        // 3rd try: just core date fields without duration, without original_*
        const safeFields: any = { status: dateConfirmStatus }
        if (leadUpdates.wedding_date     !== undefined) safeFields.wedding_date     = leadUpdates.wedding_date
        if (leadUpdates.wedding_date_to  !== undefined) safeFields.wedding_date_to  = leadUpdates.wedding_date_to
        if (leadUpdates.date_flexibility !== undefined) safeFields.date_flexibility = leadUpdates.date_flexibility
        if (leadUpdates.wedding_date_ranges !== undefined) safeFields.wedding_date_ranges = leadUpdates.wedding_date_ranges
        const { data: fallback3 } = await supabase.from('leads')
          .update(safeFields).eq('id', dateConfirmLead.id).select().single()
        resolvedLead = fallback3 ?? null
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
    setDateConfirmLead(null)
    setDateConfirmStatus(null)
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
      original_date_flexibility:    lead.original_date_flexibility    || '',
      original_wedding_date:        lead.original_wedding_date        || '',
      original_wedding_date_to:     lead.original_wedding_date_to     || '',
      original_wedding_date_ranges: lead.original_wedding_date_ranges || [],
      visit_date: lead.visit_date || '', guests: lead.guests?.toString() || '',
      source: lead.source || 'web', notes: lead.notes || '',
      ceremony_type: lead.ceremony_type || 'sin_definir',
      budget: lead.budget || 'sin_definir', language: lead.language || 'es',
      style: lead.style || '',
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
    // Excluir campos del formulario que no existen en la BD o se manejan por separado
    const { wedding_duration_days: _dur,
      original_date_flexibility: _oFlex, original_wedding_date: _oDate,
      original_wedding_date_to: _oDateTo, original_wedding_date_ranges: _oRanges,
      ...formData } = form
    const payload  = {
      ...formData,
      guests: form.guests ? parseInt(form.guests) : null,
      visit_date: form.visit_date || null,
      wedding_date: ['exact','range'].includes(form.date_flexibility) ? (form.wedding_date || null) : null,
      // exact → siempre 1 día (sin wedding_date_to); range usa wedding_date_to del rango seleccionado
      wedding_date_to: form.date_flexibility === 'range' ? (form.wedding_date_to || null) : null,
      wedding_date_ranges: form.date_flexibility === 'multi_range' ? form.wedding_date_ranges.filter(r => r.from) : null,
      wedding_year: ['month','season'].includes(form.date_flexibility) ? parseInt(form.wedding_year) : null,
      wedding_month: form.date_flexibility === 'month' ? parseInt(form.wedding_month) : null,
      wedding_season: form.date_flexibility === 'season' ? form.wedding_season : null,
    }
    if (editLead) {
      const editPayload: any = { ...payload }
      // Guardar los campos originales editados por el usuario
      // Si el usuario no los ha tocado (vacíos) y tampoco había originales → fijar los actuales pre-edición
      if (form.original_date_flexibility) {
        editPayload.original_date_flexibility    = form.original_date_flexibility
        editPayload.original_wedding_date        = form.original_date_flexibility === 'exact' || form.original_date_flexibility === 'range' ? (form.original_wedding_date || null) : null
        editPayload.original_wedding_date_to     = form.original_date_flexibility === 'range' ? (form.original_wedding_date_to || null) : null
        editPayload.original_wedding_date_ranges = form.original_date_flexibility === 'multi_range' ? (form.original_wedding_date_ranges?.filter((r: any) => r.from) || null) : null
      } else if (!editLead.original_date_flexibility) {
        editPayload.original_date_flexibility    = editLead.date_flexibility    ?? 'exact'
        editPayload.original_wedding_date        = editLead.wedding_date        ?? null
        editPayload.original_wedding_date_to     = editLead.wedding_date_to     ?? null
        editPayload.original_wedding_date_ranges = editLead.wedding_date_ranges ?? null
      }
      const { data, error } = await supabase.from('leads').update(editPayload).eq('id', editLead.id).select().single()
      if (error) { showToast(`Error: ${error.message}`); setSaving(false); return }
      if (data) setLeads(prev => prev.map(l => l.id === editLead.id ? data : l))
      showToast('Lead actualizado')
    } else {
      // Al crear: guardar también las fechas originales como referencia permanente
      const { data, error } = await supabase.from('leads').insert({
        ...payload,
        user_id: user!.id,
        status: 'new',
        original_wedding_date:        payload.wedding_date,
        original_wedding_date_to:     payload.wedding_date_to,
        original_wedding_date_ranges: payload.wedding_date_ranges,
        original_date_flexibility:    payload.date_flexibility,
      }).select().single()
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
                {Object.entries(BUDGET_LABEL).filter(([v]) => v !== 'sin_definir').map(([v,l]) =>
                  <option key={v} value={v}>{l}</option>)}
              </select>
              {features.leads_date_filter && (
                <button onClick={() => setHidePast(p => !p)}
                  style={{ padding: '8px 12px', border: '1px solid var(--ivory)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap',
                    background: hidePast ? 'var(--gold)' : '#fff',
                    color: hidePast ? '#fff' : 'var(--warm-gray)',
                    transition: 'all 0.15s' }}>
                  <Clock size={13} /> Ocultar pasadas
                </button>
              )}
              {(filterSrc !== 'all' || filterBudget !== 'all') && (
                <button onClick={() => { setFilterSrc('all'); setFilterBudget('all') }}
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
                const count   = tabCounts[tab.key] || 0
                const isActive = activeTab === tab.key
                const isFlashing = flashedTab === tab.key
                const isLost = tab.key === 'lost'
                return (
                  <button key={tab.key} onClick={() => { setActiveTab(tab.key); setFlashedTab(null) }} style={{
                    padding: '10px 16px',
                    background: isFlashing && isLost ? '#dc2626'
                      : isFlashing ? '#fefce8'
                      : isLost && count > 0 && !isActive ? 'rgba(239,68,68,0.05)'
                      : 'none',
                    border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: isActive || isFlashing ? 600 : 500,
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
                    {count !== null && count > 0 && (
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
            {visibleLeads.length === 0 ? (
              <EmptyState tab={activeTab} search={search} hidePast={hidePast}
                onClear={() => { setSearch(''); setHidePast(false) }} onNew={openCreate} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeTab === 'visit' ? (() => {
                  const today = todayIso()
                  const upcoming = visibleLeads.filter(l => !l.visit_date || l.visit_date >= today)
                  const past     = visibleLeads.filter(l => l.visit_date && l.visit_date < today)
                  const rowProps = { tab: activeTab as Tab, onMove: moveToStatusWithVisitCheck, onEdit: openEdit, onDelete: requestDeleteLead, onDetail: setDetailLead, onDateConfirm: triggerStatusChangeWithVisitCheck }
                  return (
                    <>
                      {upcoming.map(lead => <LeadRow key={lead.id} lead={lead} {...rowProps} />)}
                      {past.length > 0 && (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '8px 0 2px', borderTop: '1px solid var(--ivory)', marginTop: 4 }}>
                            Visitas realizadas
                          </div>
                          {past.map(lead => (
                            <div key={lead.id} style={{ opacity: 0.75 }}>
                              <LeadRow lead={lead} {...rowProps} />
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )
                })() : visibleLeads.map(lead => (
                  <LeadRow key={lead.id} lead={lead} tab={activeTab}
                    onMove={moveToStatusWithVisitCheck} onEdit={openEdit}
                    onDelete={requestDeleteLead} onDetail={setDetailLead}
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
                if (features.leads_date_filter && hidePast && isLeadDatePast(l)) return false
                return true
              })}
              onMove={moveToStatusWithVisitCheck}
              onEdit={openEdit}
              onDelete={requestDeleteLead}
              onDetail={setDetailLead}
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
          onDateConfirm={triggerStatusChangeWithVisitCheck} />
      )}

      {showForm && (
        <LeadFormModal form={form} setForm={setForm} isEdit={!!editLead} editLead={editLead}
          saving={saving} onSubmit={handleSubmit} userId={user!.id}
          onClose={() => { setShowForm(false); setEditLead(null) }} />
      )}

      {dateConfirmLead && dateConfirmStatus && (
        <DateConfirmModal
          key={dateConfirmKey}
          lead={dateConfirmLead}
          targetStatus={dateConfirmStatus}
          userId={user!.id}
          allLeads={leads}
          onConfirm={handleDateConfirm}
          onClose={() => { setDateConfirmLead(null); setDateConfirmStatus(null) }}
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
                // Si hay fechas originales guardadas, restaurarlas; si no, limpiar a flexible
                const dateFields = lead.original_date_flexibility
                  ? {
                      date_flexibility:    lead.original_date_flexibility,
                      wedding_date:        lead.original_wedding_date        ?? null,
                      wedding_date_to:     lead.original_wedding_date_to     ?? null,
                      wedding_date_ranges: lead.original_wedding_date_ranges ?? null,
                      wedding_year:        lead.wedding_year  ?? null,
                      wedding_month:       lead.wedding_month ?? null,
                      wedding_season:      lead.wedding_season ?? null,
                    }
                  : { wedding_date: null, wedding_date_to: null, date_flexibility: 'flexible', wedding_date_ranges: null }
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
  lead, targetStatus, userId, allLeads, onConfirm, onClose,
}: {
  lead: any
  targetStatus: DbStatus
  userId: string
  allLeads: any[]
  onConfirm: (leadUpdates: any, calendarDates: string[], calendarStatus: 'negociacion' | 'reservado', isVisit: boolean, halfDayMap?: Record<string, 'medio_dia_manana' | 'medio_dia_tarde'>) => Promise<void>
  onClose: () => void
}) {
  const isVisitMode = targetStatus === 'visit_scheduled'
  const isWonMode   = targetStatus === 'won'
  const [dateRules,  setDateRules]  = useState<any>(null)

  // Use original requested dates (before any en-seguimiento confirmation) for pills + initial selection
  // If no originals saved, fall back to current dates
  const requestedDates = useMemo(() => {
    if (lead.original_date_flexibility) {
      return expandLeadDates({
        date_flexibility:    lead.original_date_flexibility,
        wedding_date:        lead.original_wedding_date        ?? null,
        wedding_date_to:     lead.original_wedding_date_to     ?? null,
        wedding_date_ranges: lead.original_wedding_date_ranges ?? null,
      })
    }
    return expandLeadDates(lead)
  }, [lead])

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

  // Open calendar on wedding_date (confirmed or original) if available
  const firstDate = lead.wedding_date || getLeadFirstDate(lead)
  const initD = firstDate ? new Date(firstDate + 'T12:00:00') : new Date()
  const [viewYear,  setViewYear]  = useState(initD.getFullYear())
  const [viewMonth, setViewMonth] = useState(initD.getMonth())
  // selectedDates = all calendar days to block (anchors + auto-added buffer/partner days)
  const [selectedDates,  setSelectedDates]  = useState<string[]>([])
  // selectedAnchors = only the dates the user explicitly clicked (the "wedding days")
  const [selectedAnchors, setSelectedAnchors] = useState<string[]>([])
  const [calEntries,    setCalEntries]    = useState<Record<string, any>>({})
  const [saving,        setSaving]        = useState(false)
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

  // Clamp duration when user deselects dates.
  // For overnight: each anchor = 2 wedding days (check-in + check-out)
  // For packages:  each anchor contributes span_days
  // For simple:    each anchor = 1 day
  useEffect(() => {
    if (selectedAnchors.length === 0) return
    let maxDuration = selectedAnchors.length  // simple / fallback
    if (dateRules?.type === 'overnight') {
      maxDuration = selectedAnchors.length * 2
    } else if (dateRules?.type === 'packages') {
      maxDuration = selectedAnchors.reduce((sum, a) => {
        const dow = new Date(a + 'T12:00:00').getDay()
        const pkg = dateRules.packages?.find((p: any) => p.anchor_dow === dow)
        return sum + (pkg?.span_days || 1)
      }, 0)
    }
    if (weddingDuration > maxDuration) setWeddingDuration(maxDuration)
  }, [selectedAnchors.length, dateRules?.type])

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

  const toggleDate = (ds: string) => {
    const entry = calEntries[ds]
    const s = entry?.status
    // Half-day entries (reservado or bloqueado ½) are soft: still selectable (the other half is free)
    const isHardBlock = !(entry?.note?.startsWith('medio_dia')) && (s === 'reservado' || s === 'bloqueado')
    if (isHardBlock) return

    // Half-day mode: clicking a selected anchor cycles ½M → ½T → deseleccionar
    // Full-day state never appears while this mode is active
    if (halfDayMode && !isVisitMode && selectedAnchors.includes(ds)) {
      const current = halfDayMap[ds]
      if (current !== 'medio_dia_tarde') {
        // ½M (o sin estado por si acaso) → ½T
        setHalfDayMap(prev => ({ ...prev, [ds]: 'medio_dia_tarde' }))
      } else {
        // ½T → deseleccionar del todo
        setHalfDayMap(prev => { const n = { ...prev }; delete n[ds]; return n })
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
  const prevAnchorsRef = useRef<string[]>([])

  // When half-day mode is activated, immediately convert all existing full-day anchors to ½M
  useEffect(() => {
    if (halfDayMode) {
      setHalfDayMap(prev => {
        const next = { ...prev }
        selectedAnchors.forEach(a => { if (!next[a]) next[a] = 'medio_dia_manana' })
        return next
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [halfDayMode])

  // When a NEW anchor is added while half-day mode is on, auto-set it to ½M
  useEffect(() => {
    if (halfDayMode) {
      const newAnchors = selectedAnchors.filter(a => !prevAnchorsRef.current.includes(a))
      if (newAnchors.length > 0) {
        setHalfDayMap(prev => {
          const next = { ...prev }
          newAnchors.forEach(a => { if (!next[a]) next[a] = 'medio_dia_manana' })
          return next
        })
      }
    }
    prevAnchorsRef.current = [...selectedAnchors]
  }, [selectedAnchors, halfDayMode])

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

    await onConfirm(leadUpdates, calendarDates, calStatus, isVisitMode, Object.keys(halfDayMap).length > 0 ? halfDayMap : undefined)
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

  const title = isVisitMode ? <><Landmark size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> Agendar visita al venue</>
    : isWonMode ? <><PartyPopper size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> Confirmar boda · Reservar fechas</>
    : <><Eye size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> Verificar disponibilidad</>
  const canConfirm = !saving && (!isVisitMode || selectedDates.length > 0)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 600, color: 'var(--espresso)' }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 4 }}>{lead.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: '16px 24px' }}>

          {/* Requested dates — compact pills */}
          {!isVisitMode && hasRequestedDates && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Fechas solicitadas por la pareja
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
                      <button type="button" onClick={selectWholeMonth}
                        title="Añade todos los días disponibles de este mes a la selección"
                        style={{ fontSize: 10, padding: '2px 10px', borderRadius: 20, cursor: 'pointer', outline: 'none', border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontWeight: 600, letterSpacing: '0.03em' }}>
                        + Todo el mes
                      </button>
                      {selectedAnchors.length > 0 && (
                        <button type="button" onClick={() => setHalfDayMode(m => !m)}
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
                  const isRequested   = requestedDates.includes(ds)
                  const isSelected    = selectedDates.includes(ds)
                  const isHalfDay     = !!(entry?.note?.startsWith('medio_dia'))
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
                    <button key={ds} onClick={() => canClick && toggleDate(ds)}
                      title={isHalfDay ? (entryStatus === 'reservado' ? '½ Mañana/Tarde reservado — el otro medio está libre' : entryStatus === 'negociacion' ? '½ en negociación — el otro medio está libre' : '½ bloqueado — el otro medio está libre') : isUnavailable ? cfg.label : isPkgBlocked ? 'Este día no es inicio de ningún paquete' : isAlsoBuffer ? 'Boda + buffer del día anterior (doble rol)' : isBufferDay ? 'Día de buffer (regla del venue)' : isRequested ? 'Fecha solicitada — clic para marcar/desmarcar' : isPkgAvailable ? 'Inicio de paquete — disponible' : otherLeadCount > 0 ? `${otherLeadCount} lead(s) interesado(s)` : ''}
                      style={{
                        minHeight: 60, border: 'none',
                        borderBottom: '1px solid var(--ivory)',
                        borderRight: cellIdx % 7 !== 6 ? '1px solid var(--ivory)' : 'none',
                        background: isBufferDay
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
                        cursor: canClick ? 'pointer' : isPast ? 'default' : 'not-allowed',
                        opacity: isPast ? 0.35 : 1,
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                        justifyContent: 'space-between', padding: '7px 7px 5px',
                        boxShadow: isBufferDay
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
                          : isRequested && !isUnavailable ? 'inset 0 0 0 1.5px #fde68a'
                          : 'none',
                        position: 'relative', transition: 'background 0.1s', outline: 'none',
                      }} disabled={!canClick || isPast}>
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
                            style={{ fontSize: isUnavailable ? 15 : 9, color: isUnavailable ? (entryStatus === 'reservado' ? '#dc2626' : '#9ca3af') : cfg.dot, fontWeight: 700, lineHeight: 1, marginLeft: 'auto' }}>
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
                              {halfDayMap[ds] === 'medio_dia_manana' ? '½M' : halfDayMap[ds] === 'medio_dia_tarde' ? '½T' : isExtra ? '+' : '✓'}
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

          {/* Legend */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, marginTop: 8 }}>
            {/* Libre */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#fff', border: '1px solid #e5e7eb' }} />
              <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Libre</span>
            </div>
            {/* Reservado — full day */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: CAL_AVAIL_CFG.reservado.bg, border: `1px solid ${CAL_AVAIL_CFG.reservado.border}` }} />
              <span style={{ fontSize: 9, color: '#dc2626', fontWeight: 700 }}>×</span>
              <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Reservado</span>
            </div>
            {/* Bloqueado — full day */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: CAL_AVAIL_CFG.bloqueado.bg, border: `1px solid ${CAL_AVAIL_CFG.bloqueado.border}` }} />
              <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700 }}>×</span>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 14, height: 14, borderRadius: 7, background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>2</span>
              </div>
              <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Otros leads</span>
            </div>
          </div>

          {/* Duration — hidden in packages-rules mode (span is fixed by package); shown in manual mode */}
          {!isVisitMode && !(dateRules?.type === 'packages' && !ignoreRules) && (
            <div style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--cream)', border: '1px solid var(--ivory)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', whiteSpace: 'nowrap' }}>Duración de la boda:</span>
              {editingDuration ? (
                <>
                  <select className="form-input" style={{ width: 'auto' }}
                    value={weddingDuration} onChange={e => setWeddingDuration(Number(e.target.value))}>
                    {Array.from({ length: Math.max(1, selectedDates.length || 10) }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d} {d === 1 ? 'día' : 'días'}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setEditingDuration(false)} style={{ fontSize: 11, color: 'var(--warm-gray)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                    OK
                  </button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)' }}>
                    {weddingDuration} {weddingDuration === 1 ? 'día' : 'días'}
                  </span>
                  <button type="button" onClick={() => setEditingDuration(true)} style={{ fontSize: 11, color: 'var(--warm-gray)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                    Editar
                  </button>
                </>
              )}
            </div>
          )}

          {/* Summary box */}
          <div style={{ padding: '12px 14px', background: 'var(--cream)', border: '1px solid var(--ivory)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            {isVisitMode ? (
              selectedDates.length === 0
                ? <span style={{ color: 'var(--warm-gray)' }}>Haz click en una fecha disponible para agendar la visita</span>
                : <span style={{ color: 'var(--sage)', fontWeight: 500 }}><Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Visita: {formatDateLabel(selectedDates[0])}</span>
            ) : (
              <>
                {selectedDates.length > 0 ? (
                  <div style={{ color: 'var(--charcoal)', fontWeight: 500 }}>
                    ✓{' '}
                    {(() => {
                      if (hasAutoRules && !ignoreRules) {
                        const n = selectedDates.length
                        const rule = dateRules?.type === 'overnight' ? 'overnight' : dateRules?.type === 'packages' ? 'paquete' : 'fecha + buffer'
                        return `${n} día${n > 1 ? 's' : ''} · ${rule}`
                      }
                      const confirmed = availableRequested.filter(d => selectedDates.includes(d)).length
                      const extras = extraDates.length
                      const parts = []
                      if (confirmed > 0) parts.push(`${confirmed} fecha${confirmed > 1 ? 's' : ''} confirmada${confirmed > 1 ? 's' : ''}`)
                      if (extras > 0) parts.push(`${extras} alternativa${extras > 1 ? 's' : ''}`)
                      return parts.join(' + ') || `${selectedDates.length} fecha${selectedDates.length > 1 ? 's' : ''}`
                    })()}
                    {' · '}<strong>{weddingDuration} {weddingDuration === 1 ? 'día' : 'días'}</strong>
                    {' · '}
                    <strong style={{ color: isWonMode ? '#16a34a' : '#d97706' }}>
                      {isWonMode ? 'Reservado' : 'En negociación'}
                    </strong>
                  </div>
                ) : (
                  <div style={{ color: 'var(--warm-gray)' }}>
                    Sin fechas seleccionadas — el lead pasará a {isWonMode ? 'confirmado' : 'seguimiento'} sin entradas en el calendario
                  </div>
                )}
              </>
            )}
          </div>

          {/* Fechas de interés original — solo si está explícitamente guardado Y difiere de las actuales */}
          {lead.original_date_flexibility && (() => {
            const origFlex   = lead.original_date_flexibility
            const origDate1  = lead.original_wedding_date
            const origDate2  = lead.original_wedding_date_to
            const origRanges = lead.original_wedding_date_ranges
            // No mostrar si es idéntico a las fechas actuales (evitar duplicado con "Fechas solicitadas")
            const isSameAsCurrent = origFlex === lead.date_flexibility &&
              origDate1 === lead.wedding_date && origDate2 === lead.wedding_date_to
            if (isSameAsCurrent) return null

            const hasData = (origFlex === 'exact' && origDate1) || (origFlex === 'range' && origDate1) ||
              (origFlex === 'multi_range' && origRanges?.length) || origFlex === 'month' || origFlex === 'season'
            if (!hasData) return null

            const fmtLong  = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            const fmtShort = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
            const fmtFull  = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

            let dateText = 'Sin fecha definida'
            if (origFlex === 'exact' && origDate1)          dateText = fmtLong(origDate1)
            else if (origFlex === 'range' && origDate1)      dateText = `${fmtShort(origDate1)}${origDate2 ? ` – ${fmtFull(origDate2)}` : ''}`
            else if (origFlex === 'multi_range' && origRanges?.length)
              dateText = origRanges.map((r: any, i: number) =>
                `Opción ${i + 1}: ${fmtShort(r.from)}${r.to ? ` – ${fmtFull(r.to)}` : ''}`
              ).join(' · ')
            else if (origFlex === 'month')  dateText = `${MONTHS[(lead.wedding_month || 1) - 1]} ${lead.wedding_year || ''}`
            else if (origFlex === 'season') dateText = `${lead.wedding_season || ''} ${lead.wedding_year || ''}`

            return (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--ivory)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={10} /> Fecha de interés original del lead
                </div>
                <div style={{ fontSize: 13, color: 'var(--charcoal)', fontWeight: 500 }}>{dateText}</div>
              </div>
            )
          })()}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleConfirm}
            disabled={!canConfirm}
            style={{ background: isWonMode ? 'var(--sage)' : undefined, opacity: !canConfirm ? 0.5 : 1 }}>
            {saving ? 'Guardando...' : isVisitMode ? <><Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Confirmar visita</> : isWonMode ? <><PartyPopper size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Confirmar boda</> : '✓ Pasar a seguimiento'}
          </button>
        </div>
      </div>
    </div>
  )
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
            onClick={() => onDetail(lead)}>

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
                {lead.source && (
                  <span style={{ fontSize: 10, background: 'var(--ivory)', color: 'var(--warm-gray)', padding: '1px 7px', borderRadius: 10 }}>
                    {SOURCE_LABEL[lead.source] || lead.source}
                  </span>
                )}
                {(tab === 'in_progress' || tab === 'post_visit' || tab === 'budget') && (
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
                <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Landmark size={11} /> {new Date(lead.visit_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
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
          <div style={{ padding: '7px 14px 10px', background: 'var(--cream)', borderTop: '1px solid var(--ivory)', display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
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
            ? <a href={`/propuestas?lead_id=${lead.id}&create=1`} className="qa qa-ghost"
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
function PresupuestoBtn({ lead, canProposal, onMove }: {
  lead: any; canProposal: boolean; onMove: (id: string, s: DbStatus) => void
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
            onClick={() => { onMove(lead.id, 'budget_sent'); setOpen(false) }}>
            <ChevronRight size={11} /> Mover a presupuesto
          </button>
          {canProposal
            ? <a href={`/propuestas?lead_id=${lead.id}&create=1`} className="qa qa-ghost"
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

// ── Quick Actions ──────────────────────────────────────────────────────────────
function QuickActions({ lead, tab, onMove, onEdit, onDelete, onDateConfirm }: {
  lead: any; tab: Tab
  onMove: (id: string, s: DbStatus) => void
  onEdit: (l: any) => void
  onDelete: (id: string) => void
  onDateConfirm: (lead: any, s: DbStatus) => void
}) {
  const { propuestas: canProposal } = usePlanFeatures()

  const LockedProposalBtn = ({ label }: { label: string }) => (
    <span className="qa qa-ghost qa-locked" title="Disponible en plan Premium — actualiza para crear propuestas digitales">
      <FileText size={11} /> {label} <LockKeyhole size={11} />
    </span>
  )

  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
      {tab === 'new' && (<>
        <EnSeguimientoBtn lead={lead} canProposal={canProposal} onDateConfirm={onDateConfirm} />
        <button className="qa qa-ghost" onClick={() => onDateConfirm(lead, 'visit_scheduled')}><Calendar size={11} /> Agendar visita</button>
        <PresupuestoBtn lead={lead} canProposal={canProposal} onMove={onMove} />
        <button className="qa qa-ghost" onClick={() => onEdit(lead)}><Edit2 size={11} /> Editar</button>
        <button className="qa qa-danger" onClick={() => onMove(lead.id, 'lost')}>Perdido</button>
      </>)}

      {tab === 'in_progress' && (<>
        <button className="qa qa-success" onClick={() => onDateConfirm(lead, 'won')}><PartyPopper size={11} /> Confirmar boda</button>
        <button className="qa qa-ghost" onClick={() => onDateConfirm(lead, 'contacted')}><Calendar size={11} /> Cambiar fechas</button>
        <button className="qa qa-ghost" onClick={() => onDateConfirm(lead, 'visit_scheduled')}><Calendar size={11} /> Agendar visita</button>
        <PresupuestoBtn lead={lead} canProposal={canProposal} onMove={onMove} />
        <button className="qa qa-ghost" onClick={() => onMove(lead.id, 'new')}><RotateCcw size={11} /> Nuevo</button>
        <button className="qa qa-ghost" onClick={() => onEdit(lead)}><Edit2 size={11} /> Editar</button>
        <button className="qa qa-danger" onClick={() => onMove(lead.id, 'lost')}>Perdido</button>
      </>)}

      {tab === 'visit' && (<>
        <button className="qa qa-success" onClick={() => onDateConfirm(lead, 'won')}><PartyPopper size={11} /> Confirmar boda</button>
        <button className="qa qa-ghost" onClick={() => onMove(lead.id, 'post_visit')}><CheckCircle size={11} /> Visita realizada</button>
        <PresupuestoBtn lead={lead} canProposal={canProposal} onMove={onMove} />
        <button className="qa qa-ghost" onClick={() => onMove(lead.id, 'contacted')}><RotateCcw size={11} /> En seguimiento</button>
        <button className="qa qa-ghost" onClick={() => onEdit(lead)}><Edit2 size={11} /> Editar</button>
        <button className="qa qa-danger" onClick={() => onMove(lead.id, 'lost')}>Perdido</button>
      </>)}

      {tab === 'post_visit' && (<>
        <button className="qa qa-success" onClick={() => onDateConfirm(lead, 'won')}><PartyPopper size={11} /> Confirmar boda</button>
        <button className="qa qa-ghost" onClick={() => onDateConfirm(lead, 'contacted')}><Calendar size={11} /> Cambiar fechas</button>
        <PresupuestoBtn lead={lead} canProposal={canProposal} onMove={onMove} />
        <button className="qa qa-ghost" onClick={() => onMove(lead.id, 'contacted')}><RotateCcw size={11} /> En seguimiento</button>
        <button className="qa qa-ghost" onClick={() => onEdit(lead)}><Edit2 size={11} /> Editar</button>
        <button className="qa qa-danger" onClick={() => onMove(lead.id, 'lost')}>Perdido</button>
      </>)}

      {tab === 'budget' && (<>
        <button className="qa qa-success" onClick={() => onDateConfirm(lead, 'won')}><PartyPopper size={11} /> Confirmar boda</button>
        <button className="qa qa-ghost" onClick={() => onMove(lead.id, 'post_visit')}><RotateCcw size={11} /> Post-visita</button>
        <button className="qa qa-ghost" onClick={() => onMove(lead.id, 'contacted')}><RotateCcw size={11} /> En seguimiento</button>
        <button className="qa qa-ghost" onClick={() => onDateConfirm(lead, 'visit_scheduled')}><Calendar size={11} /> Agendar visita</button>
        <button className="qa qa-ghost" onClick={() => onEdit(lead)}><Edit2 size={11} /> Editar</button>
        <button className="qa qa-danger" onClick={() => onMove(lead.id, 'lost')}>Perdido</button>
      </>)}

      {tab === 'confirmed' && (<>
        {canProposal
          ? <a href="/propuestas" className="qa qa-ghost"><ExternalLink size={11} /> Propuesta</a>
          : <LockedProposalBtn label="Propuesta" />}
        <button className="qa qa-ghost" onClick={() => onEdit(lead)}><Edit2 size={11} /> Editar</button>
        <button className="qa qa-danger" onClick={() => onMove(lead.id, 'lost')}>Cancelar boda</button>
        <button className="qa qa-danger" onClick={() => onDelete(lead.id)}><Trash2 size={11} /></button>
      </>)}

      {tab === 'lost' && (<>
        <button className="qa qa-ghost" onClick={() => onMove(lead.id, 'contacted')}><RotateCcw size={11} /> Reactivar</button>
        <button className="qa qa-ghost" onClick={() => onEdit(lead)}><Edit2 size={11} /> Editar</button>
        <button className="qa qa-danger" onClick={() => onDelete(lead.id)}><Trash2 size={11} /></button>
      </>)}
    </div>
  )
}


// ── Detail Drawer ──────────────────────────────────────────────────────────────
function DetailDrawer({ lead, tab, onClose, onEdit, onDelete, onMove, onDateConfirm }: {
  lead: any; tab: Tab
  onClose: () => void; onEdit: (l: any) => void
  onDelete: (id: string) => void; onMove: (id: string, s: DbStatus) => void
  onDateConfirm: (lead: any, s: DbStatus) => void
}) {
  const { propuestas: canProposal } = usePlanFeatures()
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

          {/* Fechas de interés original — solo si están guardadas explícitamente */}
          {(() => {
            if (!lead.original_date_flexibility) return null

            const flex   = lead.original_date_flexibility
            const date1  = lead.original_wedding_date
            const date2  = lead.original_wedding_date_to
            const ranges = lead.original_wedding_date_ranges

            const hasData = (flex === 'exact' && date1) || (flex === 'range' && date1) ||
              (flex === 'multi_range' && ranges?.length) || flex === 'month' || flex === 'season'
            if (!hasData) return null

            const fmtLong  = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            const fmtShort = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
            const fmtFull  = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

            let dateText = 'Sin fecha definida'
            if (flex === 'exact' && date1)                dateText = fmtLong(date1)
            else if (flex === 'range' && date1)            dateText = `${fmtShort(date1)}${date2 ? ` – ${fmtFull(date2)}` : ''}`
            else if (flex === 'multi_range' && ranges?.length)
              dateText = ranges.map((r: any, i: number) =>
                `Opción ${i + 1}: ${fmtShort(r.from)}${r.to ? ` – ${fmtFull(r.to)}` : ''}`
              ).join(' · ')
            else if (flex === 'month')  dateText = `${MONTHS[(lead.wedding_month || 1) - 1]} ${lead.wedding_year || ''}`
            else if (flex === 'season') dateText = `${lead.wedding_season || ''} ${lead.wedding_year || ''}`

            const datesChanged = lead.original_wedding_date && lead.wedding_date &&
              lead.original_wedding_date !== lead.wedding_date

            return (
              <div style={{ marginBottom: 16, padding: '12px 14px', background: '#faf8f5', borderRadius: 10, border: '1px solid var(--ivory)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={10} /> Fecha de interés original
                </div>
                <div style={{ fontSize: 13, color: 'var(--charcoal)' }}>{dateText}</div>
                {datesChanged && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#b45309', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={10} /> La fecha activa ha cambiado respecto al interés original
                  </div>
                )}
              </div>
            )
          })()}

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
              <a href={`/propuestas?lead_id=${lead.id}&create=1`}
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
const KANBAN_ROW_1: Tab[] = ['new', 'in_progress', 'visit', 'post_visit']
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
    const map: Record<Tab, any[]> = { new: [], in_progress: [], visit: [], post_visit: [], budget: [], confirmed: [], lost: [] }
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
    in_progress: { title: 'Nada en seguimiento',       sub: 'Marca un lead como contactado para verlo aquí.' },
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

  return (
    <div style={{ border: '1px solid var(--ivory)', borderRadius: 10, overflow: 'hidden', marginTop: 8, fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', background: '#faf8f5', borderBottom: '1px solid var(--ivory)' }}>
        <button type="button" onClick={() => month === 0 ? (setYear(y => y - 1), setMonth(11)) : setMonth(m => m - 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--charcoal)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>‹</button>
        <span style={{ fontWeight: 600, color: 'var(--charcoal)', fontSize: 13 }}>{MONTHS_ES[month]} {year}</span>
        <button type="button" onClick={() => month === 11 ? (setYear(y => y + 1), setMonth(0)) : setMonth(m => m + 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--charcoal)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#faf8f5', borderBottom: '1px solid var(--ivory)' }}>
        {DAYS_ES.map(d => <div key={d} style={{ textAlign: 'center', padding: '4px 0', fontSize: 9, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '0.06em' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: 4, gap: 1 }}>
        {Array.from({ length: startDow }).map((_, i) => <div key={`emp${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const d   = ds(day)
          const eSt = entries[d]
          const sel = isSelected(d)
          const inR = isInRange(d)
          const past = d < today
          const lCount = leadCounts[d] || 0
          const isRes  = eSt === 'reservado'
          const isBlk  = eSt === 'bloqueado'
          const isNeg  = eSt === 'negociacion'
          const bg    = sel ? '#fde68a' : inR ? '#fde68a'
                      : isRes ? '#fee2e2' : isBlk ? '#f3f4f6' : isNeg ? '#fefce8' : '#fff'
          const clr   = sel ? '#78350f' : past ? '#d1d5db'
                      : isRes ? '#dc2626' : isBlk ? '#9ca3af' : isNeg ? '#ca8a04' : 'var(--charcoal)'
          return (
            <button key={day} type="button" onClick={() => handleClick(d)}
              disabled={readOnly || past}
              title={eSt ? eSt : ''}
              style={{ padding: '4px 2px', textAlign: 'center', border: 'none', borderRadius: 5, cursor: readOnly || past ? 'default' : 'pointer', background: bg, color: clr, fontWeight: sel ? 600 : 400, position: 'relative' }}>
              <div style={{ fontSize: 12, lineHeight: 1.2 }}>{day}</div>
              {(isRes || isBlk) && <div style={{ fontSize: 16, lineHeight: 1, fontWeight: 700, marginTop: -2 }}>×</div>}
              {lCount > 0 && !isRes && !isBlk && (
                <div style={{ fontSize: 8, fontWeight: 700, lineHeight: 1, color: sel ? '#78350f' : '#b45309', marginTop: 1 }}>{lCount}L</div>
              )}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, padding: '5px 12px', background: '#faf8f5', borderTop: '1px solid var(--ivory)', fontSize: 10, color: 'var(--warm-gray)', flexWrap: 'wrap' }}>
        <span>⬜ Libre</span>
        <span style={{ color: '#ca8a04' }}>🟡 Negociación</span>
        <span style={{ color: '#dc2626' }}>× Reservado</span>
        <span style={{ color: '#9ca3af' }}>× Bloqueado</span>
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

  return (
    <div style={{ border: '1px solid var(--ivory)', borderRadius: 10, overflow: 'hidden', fontSize: 12 }}>
      {/* Instrucción contextual */}
      <div style={{ padding: '6px 12px', background: phase === 'to' ? '#fffbeb' : '#f0fdf4', borderBottom: '1px solid var(--ivory)', fontSize: 11, color: phase === 'to' ? '#92400e' : '#15803d', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
        {phase === 'from'
          ? <><span style={{ background: '#d1fae5', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>1</span> Haz clic en la fecha de inicio</>
          : <><span style={{ background: '#fef3c7', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>2</span> Haz clic en la fecha de fin · <strong>{from ? new Date(from + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}</strong> seleccionado</>
        }
      </div>
      {/* Navegación */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', background: '#faf8f5', borderBottom: '1px solid var(--ivory)' }}>
        <button type="button" onClick={() => month === 0 ? (setYear(y => y - 1), setMonth(11)) : setMonth(m => m - 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--charcoal)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>‹</button>
        <span style={{ fontWeight: 600, color: 'var(--charcoal)', fontSize: 13 }}>{MONTHS_ES[month]} {year}</span>
        <button type="button" onClick={() => month === 11 ? (setYear(y => y + 1), setMonth(0)) : setMonth(m => m + 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--charcoal)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>›</button>
      </div>
      {/* Cabecera días */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#faf8f5', borderBottom: '1px solid var(--ivory)' }}>
        {DAYS_ES.map(d => <div key={d} style={{ textAlign: 'center', padding: '4px 0', fontSize: 9, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '0.06em' }}>{d}</div>)}
      </div>
      {/* Días */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: 4, gap: 1 }}
        onMouseLeave={() => setHoverDate('')}>
        {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day  = i + 1
          const d    = ds(day)
          const eSt  = entries[d]
          const lCnt = leadCounts[d] || 0
          const past = d < today
          const selF = isFrom(d); const selT = isTo(d); const inR = isInRange(d); const hov = isHover(d)
          const sel  = selF || selT || inR
          const isRes = eSt === 'reservado'; const isBlk = eSt === 'bloqueado'; const isNeg = eSt === 'negociacion'
          const bg  = sel ? '#fde68a' : hov ? '#fef9c3'
                    : isRes ? '#fee2e2' : isBlk ? '#f3f4f6' : isNeg ? '#fefce8' : '#fff'
          const clr = sel ? '#78350f' : past ? '#d1d5db'
                    : isRes ? '#dc2626' : isBlk ? '#9ca3af' : isNeg ? '#ca8a04' : 'var(--charcoal)'
          const br  = selF ? '5px 0 0 5px' : selT ? '0 5px 5px 0' : inR ? '0' : '5px'
          return (
            <button key={day} type="button"
              onClick={() => handleClick(d)}
              onMouseEnter={() => !past && setHoverDate(d)}
              disabled={past}
              style={{ padding: '4px 2px', textAlign: 'center', border: 'none', borderRadius: br, cursor: past ? 'default' : 'pointer', background: bg, color: clr, fontWeight: sel ? 600 : 400 }}>
              <div style={{ fontSize: 12, lineHeight: 1.2 }}>{day}</div>
              {(isRes || isBlk) && <div style={{ fontSize: 16, lineHeight: 1, fontWeight: 700, marginTop: -2 }}>×</div>}
              {lCnt > 0 && !isRes && !isBlk && <div style={{ fontSize: 8, fontWeight: 700, color: sel ? '#78350f' : '#b45309' }}>{lCnt}L</div>}
            </button>
          )
        })}
      </div>
      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 10, padding: '5px 12px', background: '#faf8f5', borderTop: '1px solid var(--ivory)', fontSize: 10, color: 'var(--warm-gray)', flexWrap: 'wrap' }}>
        <span>⬜ Libre</span>
        <span style={{ color: '#ca8a04' }}>🟡 Negociación</span>
        <span style={{ color: '#dc2626' }}>× Reservado</span>
        <span style={{ color: '#9ca3af' }}>× Bloqueado</span>
        <span style={{ color: '#b45309', marginLeft: 'auto' }}>L = leads interesados</span>
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

  const RANGE_COLORS = [
    { bg: '#fffbeb', sel: '#f59e0b', light: '#fef9c3', border: '#f59e0b' }, // gold
    { bg: '#f0fdf4', sel: '#22c55e', light: '#dcfce7', border: '#22c55e' }, // green
    { bg: '#eff6ff', sel: '#3b82f6', light: '#dbeafe', border: '#3b82f6' }, // blue
    { bg: '#faf5ff', sel: '#a855f7', light: '#f3e8ff', border: '#a855f7' }, // purple
    { bg: '#fff1f2', sel: '#f43f5e', light: '#ffe4e6', border: '#f43f5e' }, // rose
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

  const handleClick = (d: string) => {
    if (d < today) return
    if (!pendingFrom) {
      setPendingFrom(d)
    } else {
      if (d >= pendingFrom) {
        onChange([...ranges, { from: pendingFrom, to: d }])
        setPendingFrom('')
      } else {
        setPendingFrom(d)
      }
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

  return (
    <div>
      <div style={{ border: '1px solid var(--ivory)', borderRadius: 10, overflow: 'hidden', fontSize: 12 }}>
        {/* Instrucción */}
        <div style={{ padding: '6px 12px', background: pendingFrom ? '#fffbeb' : '#f0fdf4', borderBottom: '1px solid var(--ivory)', fontSize: 11, color: pendingFrom ? '#92400e' : '#15803d', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          {!pendingFrom
            ? <><span style={{ background: '#d1fae5', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>1</span> Haz clic en la fecha de inicio del rango {ranges.length + 1}</>
            : <><span style={{ background: '#fef3c7', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>2</span> Haz clic en la fecha de fin · <strong>{new Date(pendingFrom + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</strong> seleccionado</>
          }
        </div>
        {/* Navegación */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', background: '#faf8f5', borderBottom: '1px solid var(--ivory)' }}>
          <button type="button" onClick={() => month === 0 ? (setYear(y => y - 1), setMonth(11)) : setMonth(m => m - 1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--charcoal)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>‹</button>
          <span style={{ fontWeight: 600, color: 'var(--charcoal)', fontSize: 13 }}>{MONTHS_ES[month]} {year}</span>
          <button type="button" onClick={() => month === 11 ? (setYear(y => y + 1), setMonth(0)) : setMonth(m => m + 1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--charcoal)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>›</button>
        </div>
        {/* Cabecera */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#faf8f5', borderBottom: '1px solid var(--ivory)' }}>
          {DAYS_ES.map(d => <div key={d} style={{ textAlign: 'center', padding: '4px 0', fontSize: 9, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '0.06em' }}>{d}</div>)}
        </div>
        {/* Días */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: 4, gap: 1 }}
          onMouseLeave={() => setHoverDate('')}>
          {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day  = i + 1
            const d    = ds(day)
            const past = d < today
            const eSt  = entries[d]
            const lCnt = leadCounts[d] || 0
            const rIdx = getRangeIdx(d)
            const col  = rIdx >= 0 ? RANGE_COLORS[rIdx % RANGE_COLORS.length] : null
            const isRangeFrom = rIdx >= 0 && d === ranges[rIdx]?.from
            const isRangeTo   = rIdx >= 0 && d === (ranges[rIdx]?.to || ranges[rIdx]?.from)
            const isRangeIn   = rIdx >= 0 && !isRangeFrom && !isRangeTo
            // Pending range preview
            const isPendingFrom = d === pendingFrom
            const isPreviewTo   = d === previewTo
            const isPreviewIn   = pendingFrom && previewTo && d > pendingFrom && d < previewTo

            const isRes = eSt === 'reservado'; const isBlk = eSt === 'bloqueado'; const isNeg = eSt === 'negociacion'
            let bg = '#fff', color = past ? '#d1d5db' : 'var(--charcoal)', br = '5px', fw = 400
            if (col) {
              bg = col.light; color = col.sel; fw = 600
              br = isRangeFrom ? '5px 0 0 5px' : isRangeTo ? '0 5px 5px 0' : isRangeIn ? '0' : '5px'
            } else if (isPendingFrom) { bg = nextColor.light; color = nextColor.sel; fw = 700; br = previewTo ? '5px 0 0 5px' : '5px' }
            else if (isPreviewTo)     { bg = nextColor.light; color = nextColor.sel; fw = 700; br = '0 5px 5px 0' }
            else if (isPreviewIn)     { bg = nextColor.light; color = nextColor.sel; br = '0' }
            else if (isRes)           { bg = '#fee2e2'; color = '#dc2626' }
            else if (isBlk)           { bg = '#f3f4f6'; color = '#9ca3af' }
            else if (isNeg)           { bg = '#fefce8'; color = '#ca8a04' }

            return (
              <button key={day} type="button"
                onClick={() => handleClick(d)}
                onMouseEnter={() => !past && setHoverDate(d)}
                disabled={past}
                style={{ padding: '4px 2px', textAlign: 'center', border: 'none', borderRadius: br, cursor: past ? 'default' : 'pointer', background: bg, color, fontWeight: fw, position: 'relative' }}>
                <div style={{ fontSize: 12, lineHeight: 1.2 }}>{day}</div>
                {(isRes || isBlk) && <div style={{ fontSize: 16, lineHeight: 1, fontWeight: 700, marginTop: -2 }}>×</div>}
                {lCnt > 0 && !col && !isPendingFrom && !isRes && !isBlk && <div style={{ fontSize: 8, fontWeight: 700, color: '#b45309' }}>{lCnt}L</div>}
              </button>
            )
          })}
        </div>
        {/* Leyenda */}
        <div style={{ display: 'flex', gap: 10, padding: '5px 12px', background: '#faf8f5', borderTop: '1px solid var(--ivory)', fontSize: 10, color: 'var(--warm-gray)', flexWrap: 'wrap' }}>
          <span>⬜ Libre</span><span style={{ color: '#92400e' }}>🟡 Negociación</span>
          <span style={{ color: '#be185d' }}>🩷 Reservado</span>
          <span style={{ color: '#6b7280' }}>⬜ Bloqueado</span>
          <span style={{ color: '#b45309', marginLeft: 'auto' }}>L = leads interesados</span>
        </div>
      </div>

      {/* Lista de rangos completados */}
      {ranges.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ranges.map((r, i) => {
            const col = RANGE_COLORS[i % RANGE_COLORS.length]
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: col.light, border: `1px solid ${col.border}`, borderRadius: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: col.sel, flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>Rango {i + 1}</span>
                  <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>
                    {new Date(r.from + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                    {r.to && r.to !== r.from ? ` – ${new Date(r.to + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}` : ` (${new Date(r.from + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })})`}
                  </span>
                </div>
                <button type="button" onClick={() => removeRange(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
              </div>
            )
          })}
        </div>
      )}
      {pendingFrom && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#92400e', padding: '5px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6 }}>
          Inicio seleccionado: <strong>{new Date(pendingFrom + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</strong> — haz clic en la fecha de fin
        </div>
      )}
    </div>
  )
}

// ── Form Modal ─────────────────────────────────────────────────────────────────
function LeadFormModal({ form, setForm, isEdit, editLead, saving, onSubmit, onClose, userId }: {
  form: any; setForm: (f: any) => void; isEdit: boolean; editLead?: any | null
  saving: boolean; onSubmit: () => void; onClose: () => void; userId: string
}) {
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  const [originalEditing, setOriginalEditing] = useState(false)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600, width: '100%' }} onClick={e => e.stopPropagation()}>

        {/* Header — sticky */}
        <div className="modal-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="modal-title">{isEdit ? 'Editar lead' : 'Nuevo lead'}</div>
              <div className="modal-sub">{isEdit ? 'Actualiza los datos del lead' : 'Añade una pareja interesada'}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}><X size={18} /></button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="modal-body">

          {/* Section: La pareja */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>La pareja</div>

            <div className="form-group">
              <label className="form-label">Nombre de la pareja *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Laura & Carlos" />
            </div>

            {/* ── Flexible date ── */}
            <div className="form-group">
              <label className="form-label">
                Fecha de boda
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

              {/* EXACT DATE — siempre 1 día */}
              {form.date_flexibility === 'exact' && (
                <div>
                  <MiniCalendarPicker
                    userId={userId}
                    value={form.wedding_date}
                    onChange={d => set('wedding_date', d)}
                  />
                  {form.wedding_date && (
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--warm-gray)' }}>
                      📅 {new Date(form.wedding_date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  )}
                </div>
              )}

              {/* RANGE — un solo calendario, 1er click = desde, 2º click = hasta */}
              {form.date_flexibility === 'range' && (() => {
                const rangeDays = form.wedding_date && form.wedding_date_to
                  ? Math.round((new Date(form.wedding_date_to + 'T12:00:00').getTime() - new Date(form.wedding_date + 'T12:00:00').getTime()) / 86400000) + 1
                  : 1
                const maxDur = Math.max(1, rangeDays)
                const curDur = Math.min(parseInt(form.wedding_duration_days || '1'), maxDur)
                return (
                  <div>
                    <RangeCalendarPicker
                      userId={userId}
                      from={form.wedding_date}
                      to={form.wedding_date_to}
                      onChange={(f, t) => { set('wedding_date', f); set('wedding_date_to', t) }}
                    />
                    {form.wedding_date && form.wedding_date_to && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <label style={{ fontSize: 12, color: 'var(--charcoal)', fontWeight: 500, whiteSpace: 'nowrap' }}>Duración de la boda:</label>
                        <select className="form-input" style={{ width: 'auto' }}
                          value={curDur}
                          onChange={e => set('wedding_duration_days', e.target.value)}>
                          {Array.from({ length: maxDur }, (_, i) => i + 1).map(d => (
                            <option key={d} value={String(d)}>{d} {d === 1 ? 'día' : 'días'}</option>
                          ))}
                        </select>
                        <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                          📅 {new Date(form.wedding_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} – {new Date(form.wedding_date_to + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* MULTI_RANGE — un solo calendario para todos los rangos */}
              {form.date_flexibility === 'multi_range' && (
                <MultiRangeCalendarPicker
                  userId={userId}
                  ranges={form.wedding_date_ranges || []}
                  onChange={r => set('wedding_date_ranges', r)}
                />
              )}

              {/* MONTH */}
              {form.date_flexibility === 'month' && (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <select className="form-input" value={form.wedding_month} onChange={e => set('wedding_month', e.target.value)}>
                      {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                    </select>
                    <select className="form-input" style={{ width: 110 }} value={form.wedding_year} onChange={e => set('wedding_year', e.target.value)}>
                      {YEAR_OPTS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <MiniCalendarPicker
                    userId={userId}
                    readOnly
                    value={undefined}
                    highlights={(() => {
                      const y = parseInt(form.wedding_year), mo = parseInt(form.wedding_month)
                      const days = new Date(y, mo, 0).getDate()
                      return Array.from({ length: days }, (_, i) => `${y}-${String(mo).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`)
                    })()}
                  />
                </div>
              )}

              {/* SEASON */}
              {form.date_flexibility === 'season' && (
                <div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                    {SEASONS.map(s => (
                      <button key={s.value} type="button" onClick={() => set('wedding_season', s.value)} style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid',
                        borderColor: form.wedding_season === s.value ? 'var(--gold)' : 'var(--ivory)',
                        background:  form.wedding_season === s.value ? '#fef9ec' : 'transparent',
                        color:       form.wedding_season === s.value ? '#92400e' : 'var(--warm-gray)',
                        fontWeight:  form.wedding_season === s.value ? 600 : 400,
                      }}>{s.emoji} {s.label}</button>
                    ))}
                    <select className="form-input" style={{ width: 110 }} value={form.wedding_year} onChange={e => set('wedding_year', e.target.value)}>
                      {YEAR_OPTS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {form.date_flexibility === 'flexible' && (
                <div style={{ padding: '10px 14px', background: 'var(--cream)', borderRadius: 8, fontSize: 13, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={16} /> Sin fecha definida — la pareja es flexible
                </div>
              )}
            </div>

            {/* Contact in 2-col */}
            <div className="two-col">
              <div className="form-group">
                <label className="form-label">Email <span style={{ color: 'var(--rose)' }}>*</span> <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--warm-gray)' }}>o tel.</span></label>
                <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="pareja@email.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--warm-gray)' }}>(o email)</span></label>
                <input className="form-input" value={form.phone} onChange={e => {
                  const val = e.target.value
                  set('phone', val)
                  if (!form.whatsapp || form.whatsapp === form.phone) set('whatsapp', val)
                }} placeholder="+34 600 000 000" />
              </div>
            </div>

            <div className="two-col">
              <div className="form-group">
                <label className="form-label">WhatsApp</label>
                <input className="form-input" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="+34 600 000 000" />
              </div>
              <div className="form-group">
                <label className="form-label">Nº invitados</label>
                <input className="form-input" type="number" value={form.guests} onChange={e => set('guests', e.target.value)} placeholder="150" />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--ivory)', marginBottom: 20 }} />

          {/* Section: Detalles */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Detalles</div>

            <div className="two-col">
              <div className="form-group">
                <label className="form-label">Fuente</label>
                <select className="form-input" value={form.source} onChange={e => set('source', e.target.value)}>
                  {Object.entries(SOURCE_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Presupuesto</label>
                <select className="form-input" value={form.budget} onChange={e => set('budget', e.target.value)}>
                  <option value="sin_definir">Sin definir</option>
                  <option value="menos_20k">&lt; 20.000 €</option>
                  <option value="20k_35k">20.000 – 35.000 €</option>
                  <option value="35k_50k">35.000 – 50.000 €</option>
                  <option value="mas_50k">&gt; 50.000 €</option>
                </select>
              </div>
            </div>

            <div className="two-col">
              <div className="form-group">
                <label className="form-label">Ceremonia</label>
                <select className="form-input" value={form.ceremony_type} onChange={e => set('ceremony_type', e.target.value)}>
                  <option value="sin_definir">Sin definir</option>
                  <option value="civil">Civil</option>
                  <option value="religiosa">Religiosa</option>
                  <option value="simbolica">Simbólica</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Idioma</label>
                <select className="form-input" value={form.language} onChange={e => set('language', e.target.value)}>
                  <option value="es">Español</option>
                  <option value="en">Inglés</option>
                  <option value="fr">Francés</option>
                  <option value="other">Otro</option>
                </select>
              </div>
            </div>

            <div className="two-col">
              <div className="form-group">
                <label className="form-label">Fecha de visita</label>
                <input className="form-input" type="date" value={form.visit_date} onChange={e => set('visit_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Estilo buscado</label>
                <input className="form-input" value={form.style} onChange={e => set('style', e.target.value)} placeholder="Rústico, moderno, clásico…" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notas internas</label>
              <textarea className="form-textarea" style={{ minHeight: 72 }} value={form.notes}
                onChange={e => set('notes', e.target.value)} placeholder="Observaciones privadas…" />
            </div>
          </div>

          {/* Fechas de interés original — bloqueado por defecto, editable con botón */}
          {isEdit && (
            <div style={{ marginTop: 4, marginBottom: 8, padding: '14px 16px', background: '#faf8f5', borderRadius: 10, border: `1px solid ${originalEditing ? 'var(--gold)' : 'var(--ivory)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: originalEditing ? 12 : 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={10} /> Fecha de interés original
                </div>
                <button type="button" onClick={() => setOriginalEditing(e => !e)}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${originalEditing ? 'var(--gold)' : 'var(--ivory)'}`, background: originalEditing ? '#fffbeb' : 'transparent', color: originalEditing ? '#92400e' : 'var(--warm-gray)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Edit2 size={10} /> {originalEditing ? 'Cerrar' : 'Editar'}
                </button>
              </div>

              {/* Vista bloqueada — muestra texto formateado */}
              {!originalEditing && (() => {
                const flex   = form.original_date_flexibility
                const date1  = form.original_wedding_date
                const date2  = form.original_wedding_date_to
                const ranges = form.original_wedding_date_ranges
                if (!flex) return <div style={{ fontSize: 12, color: 'var(--stone)', fontStyle: 'italic' }}>Sin fecha original registrada</div>
                const fmtLong  = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                const fmtShort = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
                const fmtFull  = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                let txt = ''
                if (flex === 'exact' && date1)          txt = fmtLong(date1)
                else if (flex === 'range' && date1)      txt = `${fmtShort(date1)}${date2 ? ` – ${fmtFull(date2)}` : ''}`
                else if (flex === 'multi_range' && ranges?.length)
                  txt = ranges.map((r: any, i: number) => `Opción ${i+1}: ${fmtShort(r.from)}${r.to ? ` – ${fmtFull(r.to)}` : ''}`).join(' · ')
                else if (flex === 'month')  txt = `${MONTHS[(parseInt(form.original_wedding_date?.slice(5,7) || '6') || 1) - 1]} ${form.original_wedding_date?.slice(0,4) || ''}`
                else if (flex === 'season') txt = `${SEASONS.find(s => s.value === date1)?.label || date1} ${date2 || ''}`
                return <div style={{ fontSize: 13, color: 'var(--charcoal)', fontWeight: 500 }}>{txt || '—'}</div>
              })()}

              {/* Vista editable */}
              {originalEditing && (<>
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={form.original_date_flexibility}
                    onChange={e => set('original_date_flexibility', e.target.value)}>
                    <option value="">Sin definir</option>
                    {DATE_FLEX_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {form.original_date_flexibility === 'exact' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Fecha</label>
                    <input className="form-input" type="date" value={form.original_wedding_date} onChange={e => set('original_wedding_date', e.target.value)} />
                  </div>
                )}
                {form.original_date_flexibility === 'range' && (
                  <div className="two-col" style={{ marginBottom: 0 }}>
                    <div className="form-group"><label className="form-label">Desde</label>
                      <input className="form-input" type="date" value={form.original_wedding_date} onChange={e => set('original_wedding_date', e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">Hasta</label>
                      <input className="form-input" type="date" value={form.original_wedding_date_to} onChange={e => set('original_wedding_date_to', e.target.value)} /></div>
                  </div>
                )}
                {form.original_date_flexibility === 'multi_range' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(form.original_wedding_date_ranges?.length ? form.original_wedding_date_ranges : [{ from: '', to: '' }]).map((r: any, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          {i === 0 && <label className="form-label">Desde</label>}
                          <input className="form-input" type="date" value={r.from} onChange={e => { const rr = [...(form.original_wedding_date_ranges || [])]; rr[i] = { ...rr[i], from: e.target.value }; set('original_wedding_date_ranges', rr) }} />
                        </div>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          {i === 0 && <label className="form-label">Hasta</label>}
                          <input className="form-input" type="date" value={r.to} onChange={e => { const rr = [...(form.original_wedding_date_ranges || [])]; rr[i] = { ...rr[i], to: e.target.value }; set('original_wedding_date_ranges', rr) }} />
                        </div>
                        {i > 0 && <button type="button" onClick={() => set('original_wedding_date_ranges', form.original_wedding_date_ranges.filter((_: any, j: number) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: '0 4px' }}><X size={14} /></button>}
                      </div>
                    ))}
                    <button type="button" onClick={() => set('original_wedding_date_ranges', [...(form.original_wedding_date_ranges || []), { from: '', to: '' }])}
                      style={{ fontSize: 12, color: 'var(--warm-gray)', background: 'none', border: '1px dashed var(--ivory)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', alignSelf: 'flex-start' }}>+ Añadir opción</button>
                  </div>
                )}
                {form.original_date_flexibility === 'month' && (
                  <div className="two-col" style={{ marginBottom: 0 }}>
                    <div className="form-group"><label className="form-label">Mes</label>
                      <select className="form-input" value={form.original_wedding_date?.slice(5,7) || '06'} onChange={e => set('original_wedding_date', `${form.original_wedding_date?.slice(0,4) || new Date().getFullYear()+1}-${e.target.value}-01`)}>
                        {MONTHS.map((m, i) => <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
                      </select></div>
                    <div className="form-group"><label className="form-label">Año</label>
                      <select className="form-input" value={form.original_wedding_date?.slice(0,4) || String(new Date().getFullYear()+1)} onChange={e => set('original_wedding_date', `${e.target.value}-${form.original_wedding_date?.slice(5,7) || '06'}-01`)}>
                        {YEAR_OPTS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select></div>
                  </div>
                )}
                {form.original_date_flexibility === 'season' && (
                  <div className="two-col" style={{ marginBottom: 0 }}>
                    <div className="form-group"><label className="form-label">Estación</label>
                      <select className="form-input" value={form.original_wedding_date || 'summer'} onChange={e => set('original_wedding_date', e.target.value)}>
                        {SEASONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select></div>
                    <div className="form-group"><label className="form-label">Año</label>
                      <select className="form-input" value={form.original_wedding_date_to || String(new Date().getFullYear()+1)} onChange={e => set('original_wedding_date_to', e.target.value)}>
                        {YEAR_OPTS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select></div>
                  </div>
                )}
              </>)}
            </div>
          )}

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

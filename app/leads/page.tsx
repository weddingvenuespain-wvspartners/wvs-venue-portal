'use client'
import { useEffect, useState, useMemo } from 'react'
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
  const [dateConfirmLead,   setDateConfirmLead]   = useState<any | null>(null)
  const [dateConfirmStatus, setDateConfirmStatus] = useState<DbStatus | null>(null)
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

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

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

  const moveToStatus = async (id: string, status: DbStatus) => {
    const supabase = createClient()
    await supabase.from('leads').update({ status }).eq('id', id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    const newTab = (Object.entries(TAB_STATUSES) as [Tab, DbStatus[]][])
      .find(([, ss]) => ss.includes(status))?.[0]
    if (newTab && newTab !== activeTab) {
      setActiveTab(newTab)
      showToast(`Lead movido a "${TABS.find(t => t.key === newTab)?.label}"`)
    }
  }

  const triggerStatusChange = (lead: any, status: DbStatus) => {
    if (['contacted', 'visit_scheduled', 'won'].includes(status)) {
      setDateConfirmLead(lead)
      setDateConfirmStatus(status)
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

    // Free the reserved calendar entry linked to this lead
    const { data: reservedEntry } = await supabase
      .from('calendar_entries')
      .select('id, status')
      .eq('user_id', user!.id)
      .eq('lead_id', cancelWeddingLead.id)
      .eq('status', 'reservado')
      .maybeSingle()
    if (reservedEntry?.id) {
      await supabase.from('calendar_entries').update({ status: 'libre', lead_id: null, note: null }).eq('id', reservedEntry.id)
    }

    setLeads(prev => prev.map(l => l.id === cancelWeddingLead.id ? { ...l, status: 'lost', notes } : l))
    setActiveTab('lost')
    showToast('Boda cancelada — lead movido a Perdidos')
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
    } else {
      moveToStatus(lead.id, targetStatus)
    }
  }

  // Note: requires ALTER TABLE leads ADD COLUMN IF NOT EXISTS wedding_date_history JSONB DEFAULT '[]';
  const handleDateConfirm = async (leadUpdates: any, calendarDates: string[], calendarStatus: 'negociacion' | 'reservado', isVisit: boolean) => {
    if (!dateConfirmLead || !dateConfirmStatus) return
    const supabase = createClient()

    const finalUpdates: any = { status: dateConfirmStatus, ...leadUpdates }
    if (isVisit && calendarDates.length > 0) finalUpdates.visit_date = calendarDates[0]

    const { data: updatedLead } = await supabase.from('leads')
      .update(finalUpdates).eq('id', dateConfirmLead.id).select().single()

    // Visits only update visit_date on the lead — they do NOT touch calendar_entries
    // (availability of the day must not change just because someone is visiting)
    if (!isVisit) {
      for (const d of calendarDates) {
        const { data: existing } = await supabase.from('calendar_entries')
          .select('id').eq('user_id', user!.id).eq('date', d).maybeSingle()
        const entryPayload: any = { status: calendarStatus, lead_id: dateConfirmLead.id }
        if (existing?.id) {
          await supabase.from('calendar_entries').update(entryPayload).eq('id', existing.id)
        } else {
          await supabase.from('calendar_entries').insert({ user_id: user!.id, date: d, ...entryPayload })
        }
      }
    }

    if (updatedLead) setLeads(prev => prev.map(l => l.id === dateConfirmLead.id ? updatedLead : l))
    const newTab = (Object.entries(TAB_STATUSES) as [Tab, DbStatus[]][])
      .find(([, ss]) => ss.includes(dateConfirmStatus))?.[0]
    if (newTab && newTab !== activeTab) {
      setActiveTab(newTab)
      showToast(`Lead movido a "${TABS.find(t => t.key === newTab)?.label}"`)
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
      showToast('Lead movido a Perdidos')
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
    setSaving(true)
    const supabase = createClient()
    const payload  = {
      ...form,
      guests: form.guests ? parseInt(form.guests) : null,
      visit_date: form.visit_date || null,
      wedding_date: ['exact','range'].includes(form.date_flexibility) ? (form.wedding_date || null) : null,
      wedding_date_to: form.date_flexibility === 'range' ? (form.wedding_date_to || null) : null,
      wedding_date_ranges: form.date_flexibility === 'multi_range' ? form.wedding_date_ranges.filter(r => r.from) : null,
      wedding_year: ['month','season'].includes(form.date_flexibility) ? parseInt(form.wedding_year) : null,
      wedding_month: form.date_flexibility === 'month' ? parseInt(form.wedding_month) : null,
      wedding_season: form.date_flexibility === 'season' ? form.wedding_season : null,
    }
    if (editLead) {
      const { data, error } = await supabase.from('leads').update(payload).eq('id', editLead.id).select().single()
      if (error) { showToast(`Error: ${error.message}`); setSaving(false); return }
      if (data) setLeads(prev => prev.map(l => l.id === editLead.id ? data : l))
      showToast('Lead actualizado')
    } else {
      const { data, error } = await supabase.from('leads')
        .insert({ ...payload, user_id: user!.id, status: 'new' }).select().single()
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
                return (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                    padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 500,
                    color: isActive ? 'var(--espresso)' : 'var(--warm-gray)',
                    borderBottom: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                    marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'color 0.15s, border-color 0.15s', whiteSpace: 'nowrap',
                  }}>
                    <span>{tab.emoji}</span>
                    <span>{tab.label}</span>
                    {count !== null && count > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, minWidth: 18, height: 18,
                        borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isActive ? 'var(--gold)' : 'var(--ivory)',
                        color: isActive ? '#fff' : 'var(--warm-gray)', padding: '0 5px',
                      }}>{count}</span>
                    )}
                  </button>
                )
              })}
            </div>

          </div>

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

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--espresso)', color: '#fff', padding: '10px 20px',
          borderRadius: 8, fontSize: 13, zIndex: 2000, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          pointerEvents: 'none',
        }}>{toast}</div>
      )}

      {detailLead && (
        <DetailDrawer lead={detailLead}
          tab={(Object.entries(TAB_STATUSES) as [Tab, DbStatus[]][]).find(([,ss]) => ss.includes(detailLead.status))?.[0] || 'new'}
          onClose={() => setDetailLead(null)}
          onEdit={openEdit} onDelete={requestDeleteLead} onMove={moveToStatusWithVisitCheck}
          onDateConfirm={triggerStatusChangeWithVisitCheck} />
      )}

      {showForm && (
        <LeadFormModal form={form} setForm={setForm} isEdit={!!editLead}
          saving={saving} onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditLead(null) }} />
      )}

      {dateConfirmLead && dateConfirmStatus && (
        <DateConfirmModal
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
                await supabase.from('leads').update({ status: 'new', wedding_date: null, wedding_date_to: null, date_flexibility: 'flexible', wedding_date_ranges: null }).eq('id', clearDatesConfirm.id)
                setLeads(prev => prev.map(l => l.id === clearDatesConfirm.id ? { ...l, status: 'new', wedding_date: null, wedding_date_to: null, date_flexibility: 'flexible', wedding_date_ranges: null } : l))
                setActiveTab('new')
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
  onConfirm: (leadUpdates: any, calendarDates: string[], calendarStatus: 'negociacion' | 'reservado', isVisit: boolean) => Promise<void>
  onClose: () => void
}) {
  const isVisitMode = targetStatus === 'visit_scheduled'
  const isWonMode   = targetStatus === 'won'

  const requestedDates = useMemo(() => expandLeadDates(lead), [lead])

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

  const firstDate = getLeadFirstDate(lead)
  const initD = firstDate ? new Date(firstDate + 'T12:00:00') : new Date()
  const [viewYear,  setViewYear]  = useState(initD.getFullYear())
  const [viewMonth, setViewMonth] = useState(initD.getMonth())
  // selectedDates = couple's confirmed dates (deselectable) + user-added alternatives
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [calEntries,    setCalEntries]    = useState<Record<string, any>>({})
  const [saving,        setSaving]        = useState(false)
  // Prevent re-initialising selectedDates on month navigation
  const isFirstLoad = { current: true }

  // Load calendar entries. On first render also fetch all months with requested dates.
  useEffect(() => {
    const fetchEntries = async () => {
      const supabase = createClient()
      const monthsToLoad: string[] = [`${viewYear}-${pad(viewMonth + 1)}`]
      if (isFirstLoad.current && !isVisitMode) {
        requestedDates.forEach(d => {
          const ym = d.slice(0, 7)
          if (!monthsToLoad.includes(ym)) monthsToLoad.push(ym)
        })
      }
      const newEntries: Record<string, any> = {}
      for (const ym of monthsToLoad) {
        const [y, m] = ym.split('-').map(Number)
        const lastDay = new Date(y, m, 0).getDate()
        const { data } = await supabase.from('calendar_entries')
          .select('*').eq('user_id', userId)
          .gte('date', `${ym}-01`).lte('date', `${ym}-${pad(lastDay)}`)
        if (data) data.forEach((e: any) => { newEntries[e.date] = e })
      }
      // On first load: pre-select the couple's available requested dates
      if (isFirstLoad.current && !isVisitMode) {
        isFirstLoad.current = false
        const available = requestedDates.filter(d => {
          const s = newEntries[d]?.status
          return s !== 'bloqueado' && s !== 'reservado'
        })
        setSelectedDates(available)
      }
      setCalEntries(prev => ({ ...prev, ...newEntries }))
    }
    fetchEntries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth])

  // Derived
  const unavailableRequested = useMemo(
    () => requestedDates.filter(d => calEntries[d]?.status === 'bloqueado' || calEntries[d]?.status === 'reservado'),
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
    const s = calEntries[ds]?.status
    if (s === 'bloqueado' || s === 'reservado') return
    if (isVisitMode) {
      setSelectedDates(prev => prev[0] === ds ? [] : [ds])
    } else {
      setSelectedDates(prev => prev.includes(ds) ? prev.filter(d => d !== ds) : [...prev, ds])
    }
  }

  const handleConfirm = async () => {
    setSaving(true)
    const calStatus: 'negociacion' | 'reservado' = isWonMode ? 'reservado' : 'negociacion'
    let leadUpdates: any = {}

    if (!isVisitMode) {
      const hasMissingRequested = availableRequested.some(d => !selectedDates.includes(d))
      const hasChanges = extraDates.length > 0 || hasMissingRequested || unavailableRequested.length > 0

      if (extraDates.length > 0 || hasMissingRequested) {
        // Date fields changed — update them based on selection
        const sorted = [...selectedDates].sort()
        if (sorted.length === 0) {
          leadUpdates = {}
        } else if (sorted.length === 1) {
          leadUpdates = { date_flexibility: 'exact', wedding_date: sorted[0], wedding_date_to: null, wedding_date_ranges: null, wedding_year: null, wedding_month: null }
        } else {
          // Detect if dates are contiguous → range, otherwise → multi_range
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

    await onConfirm(leadUpdates, selectedDates, calStatus, isVisitMode)
    setSaving(false)
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

          {/* Requested dates list (checkboxes) */}
          {!isVisitMode && hasRequestedDates && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Fechas solicitadas por la pareja
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {requestedDates.map(d => {
                  const entryStatus = calEntries[d]?.status
                  const isUnavailable = entryStatus === 'bloqueado' || entryStatus === 'reservado'
                  const isChecked = selectedDates.includes(d)
                  return (
                    <div key={d}
                      onClick={() => !isUnavailable && toggleDate(d)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                        background: isUnavailable ? 'var(--rose-light)' : isChecked ? 'var(--sage-light)' : 'var(--cream)',
                        border: `1px solid ${isUnavailable ? 'var(--stone)' : isChecked ? 'var(--sage)' : 'var(--ivory)'}`,
                        borderRadius: 8, cursor: isUnavailable ? 'not-allowed' : 'pointer',
                      }}>
                      {/* Checkbox */}
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                        border: `2px solid ${isUnavailable ? 'var(--stone)' : isChecked ? 'var(--sage)' : 'var(--stone)'}`,
                        background: isChecked && !isUnavailable ? 'var(--sage)' : isUnavailable ? 'var(--rose-light)' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isChecked && !isUnavailable && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1, fontWeight: 700 }}>✓</span>}
                        {isUnavailable && <span style={{ color: 'var(--rose)', fontSize: 9, lineHeight: 1, fontWeight: 700 }}>✕</span>}
                      </div>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: isUnavailable ? '#9ca3af' : 'var(--charcoal)', textDecoration: isUnavailable ? 'line-through' : 'none' }}>
                        {formatDateLabel(d)}
                      </span>
                      {isUnavailable ? (
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--rose)', background: 'var(--rose-light)', padding: '2px 8px', borderRadius: 10 }}>
                          {entryStatus === 'reservado' ? <><LockKeyhole size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> Reservado</> : <><OctagonAlert size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> Bloqueado</>}
                        </span>
                      ) : entryStatus === 'negociacion' ? (
                        <span style={{ fontSize: 11, fontWeight: 500, color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: 10 }}>
                          <AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> En negociación
                        </span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
              {unavailableRequested.length > 0 && (
                <div style={{ marginTop: 7, fontSize: 11, color: '#6b7280', padding: '6px 10px', background: '#f9fafb', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertTriangle size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> Las fechas no disponibles quedarán guardadas como opciones solicitadas sin confirmar.
                </div>
              )}
            </div>
          )}

          {!isVisitMode && !hasRequestedDates && (
            <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fef9ec', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
              Este lead no tiene fechas exactas. Selecciona fechas disponibles en el calendario.
            </div>
          )}

          {/* Calendar section */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              {isVisitMode ? 'Seleccionar fecha de visita' : hasRequestedDates ? 'Añadir fechas alternativas' : 'Seleccionar fechas disponibles'}
            </div>
            {!isVisitMode && hasRequestedDates && (
              <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 8 }}>
                Haz click en cualquier fecha libre o en negociación para añadirla como alternativa adicional.
              </div>
            )}

            <div style={{ border: '1px solid var(--ivory)', borderRadius: 12, overflow: 'hidden' }}>
              {/* Month nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'var(--cream)', borderBottom: '1px solid var(--ivory)' }}>
                <button onClick={prevMonth} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--ivory)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--charcoal)' }}><ChevronLeft size={14} /></button>
                <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, color: 'var(--espresso)', fontWeight: 500 }}>{MONTHS[viewMonth]} {viewYear}</span>
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
                  if (!day) return <div key={`e-${i}`} style={{ minHeight: 68, borderBottom: '1px solid var(--ivory)', borderRight: i % 7 !== 6 ? '1px solid var(--ivory)' : 'none' }} />
                  const ds = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
                  const entry = calEntries[ds]
                  const entryStatus = entry?.status || 'libre'
                  const cfg = CAL_AVAIL_CFG[entryStatus] || CAL_AVAIL_CFG.libre
                  const isRequested   = requestedDates.includes(ds)
                  const isSelected    = selectedDates.includes(ds)
                  const isUnavailable = entryStatus === 'bloqueado' || entryStatus === 'reservado'
                  const isToday       = ds === todayStr
                  const isPast        = ds < todayStr
                  const canClick      = !isPast && !isUnavailable
                  const dow = (startDow + day - 1) % 7
                  const isWeekend = dow >= 5
                  const isExtra = isSelected && !isRequested
                  const otherLeadCount = dateLeadCounts[ds] || 0
                  const cellIdx = i  // for borderRight calc

                  return (
                    <button key={ds} onClick={() => canClick && toggleDate(ds)}
                      title={isUnavailable ? cfg.label : isRequested ? 'Fecha solicitada por la pareja' : otherLeadCount > 0 ? `${otherLeadCount} lead(s) interesado(s)` : ''}
                      style={{
                        minHeight: 68, border: 'none',
                        borderBottom: '1px solid var(--ivory)',
                        borderRight: cellIdx % 7 !== 6 ? '1px solid var(--ivory)' : 'none',
                        background: isSelected
                          ? (isExtra ? '#eff6ff' : '#fffbeb')
                          : isPast ? '#faf8f5'
                          : isWeekend && !isUnavailable ? '#faf7f4'
                          : cfg.bg,
                        cursor: canClick ? 'pointer' : isPast ? 'default' : 'not-allowed',
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                        justifyContent: 'space-between', padding: '8px 9px',
                        boxShadow: isToday ? 'inset 0 0 0 2px var(--gold)' : isSelected ? `inset 0 0 0 2px ${isExtra ? '#3b82f6' : '#f59e0b'}` : 'none',
                        opacity: isPast ? 0.35 : 1,
                        position: 'relative', transition: 'background 0.1s', outline: 'none',
                      }} disabled={!canClick || isPast}>
                      {/* Day number */}
                      <span style={{ fontSize: 14, fontWeight: isToday ? 700 : 500, color: isPast ? 'var(--stone)' : isToday ? 'var(--gold)' : isWeekend ? 'var(--gold)' : 'var(--charcoal)', lineHeight: 1, fontFamily: 'Manrope, sans-serif' }}>{day}</span>
                      {/* Bottom status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 'auto', width: '100%' }}>
                        {entryStatus !== 'libre' && (
                          <>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                              color: entryStatus === 'negociacion' ? '#92400e' : entryStatus === 'reservado' ? '#9d174d' : '#6b7280' }}>
                              {entryStatus === 'negociacion' ? 'Neg.' : entryStatus === 'reservado' ? 'Reserv.' : 'Bloq.'}
                            </span>
                          </>
                        )}
                      </div>
                      {/* Other leads badge */}
                      {otherLeadCount > 0 && !isUnavailable && !isPast && (
                        <div style={{ position: 'absolute', top: 4, right: 4, background: '#f97316', color: '#fff', fontSize: 8, fontWeight: 700, minWidth: 14, height: 14, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }}>
                          {otherLeadCount > 9 ? '9+' : otherLeadCount}
                        </div>
                      )}
                      {/* Selected dot */}
                      {isSelected && !otherLeadCount && (
                        <div style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: isExtra ? '#3b82f6' : 'var(--gold)' }} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            {Object.entries(CAL_AVAIL_CFG).map(([key, cfg]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: cfg.bg, border: `1px solid ${cfg.border}` }} />
                <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{cfg.label}</span>
              </div>
            ))}
            {!isVisitMode && hasRequestedDates && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#fef3c7', border: '1.5px solid #f59e0b' }} />
                <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Solicitada pareja</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)' }} />
              <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Alternativa añadida</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 13, height: 13, borderRadius: 7, background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>2</span>
              </div>
              <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Otros leads interesados</span>
            </div>
          </div>

          {/* Summary box */}
          <div style={{ padding: '12px 14px', background: 'var(--cream)', border: '1px solid var(--ivory)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            {isVisitMode ? (
              selectedDates.length === 0
                ? <span style={{ color: 'var(--warm-gray)' }}>Haz click en una fecha disponible para agendar la visita</span>
                : <span style={{ color: 'var(--sage)', fontWeight: 500 }}><Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Visita: {formatDateLabel(selectedDates[0])}</span>
            ) : (
              <>
                {selectedDates.length > 0 ? (
                  <div style={{ color: 'var(--sage)', fontWeight: 500 }}>
                    ✓ {selectedDates.length} fecha{selectedDates.length > 1 ? 's' : ''} confirmada{selectedDates.length > 1 ? 's' : ''}
                    {' · '}se marcarán como <strong>{isWonMode ? 'Reservado' : 'En negociación'}</strong> en el calendario
                  </div>
                ) : (
                  <div style={{ color: 'var(--warm-gray)' }}>Sin fechas seleccionadas — el lead pasará a {isWonMode ? 'confirmado' : 'seguimiento'} sin entradas en el calendario</div>
                )}
                {unavailableRequested.length > 0 && (
                  <div style={{ color: '#6b7280' }}>
                    <AlertTriangle size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {unavailableRequested.length} fecha{unavailableRequested.length > 1 ? 's' : ''} no disponible{unavailableRequested.length > 1 ? 's' : ''} (guardadas como info): {unavailableRequested.map(d => formatDateLabel(d)).join(', ')}
                  </div>
                )}
                {extraDates.length > 0 && (
                  <div style={{ color: 'var(--gold)' }}>
                    + {extraDates.length} fecha{extraDates.length > 1 ? 's' : ''} alternativa{extraDates.length > 1 ? 's' : ''} añadida{extraDates.length > 1 ? 's' : ''}
                  </div>
                )}
              </>
            )}
          </div>
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

// ── Form Modal ─────────────────────────────────────────────────────────────────
function LeadFormModal({ form, setForm, isEdit, saving, onSubmit, onClose }: {
  form: any; setForm: (f: any) => void; isEdit: boolean
  saving: boolean; onSubmit: () => void; onClose: () => void
}) {
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
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
              <label className="form-label">Fecha de boda</label>
              {/* Type selector */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                {DATE_FLEX_OPTS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => set('date_flexibility', opt.value)} style={{
                    padding: '4px 11px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid', fontWeight: 500,
                    borderColor: form.date_flexibility === opt.value ? 'var(--gold)' : 'var(--ivory)',
                    background:  form.date_flexibility === opt.value ? 'var(--gold)' : 'transparent',
                    color:       form.date_flexibility === opt.value ? '#fff' : 'var(--warm-gray)',
                    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                  }}>{opt.label}</button>
                ))}
              </div>

              {form.date_flexibility === 'exact' && (
                <input className="form-input" type="date" value={form.wedding_date}
                  onChange={e => set('wedding_date', e.target.value)} />
              )}

              {form.date_flexibility === 'range' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="form-input" type="date" value={form.wedding_date}
                    onChange={e => set('wedding_date', e.target.value)} />
                  <span style={{ color: 'var(--warm-gray)', fontSize: 13, whiteSpace: 'nowrap' }}>hasta</span>
                  <input className="form-input" type="date" value={form.wedding_date_to}
                    onChange={e => set('wedding_date_to', e.target.value)} />
                </div>
              )}

              {form.date_flexibility === 'multi_range' && (
                <div>
                  {(form.wedding_date_ranges as { from: string; to: string }[]).map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--warm-gray)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
                      <input className="form-input" type="date" value={r.from}
                        onChange={e => { const ranges = [...form.wedding_date_ranges]; ranges[i] = { ...r, from: e.target.value }; set('wedding_date_ranges', ranges) }} />
                      <span style={{ color: 'var(--warm-gray)', fontSize: 13, whiteSpace: 'nowrap' }}>hasta</span>
                      <input className="form-input" type="date" value={r.to}
                        onChange={e => { const ranges = [...form.wedding_date_ranges]; ranges[i] = { ...r, to: e.target.value }; set('wedding_date_ranges', ranges) }} />
                      <button type="button" onClick={() => set('wedding_date_ranges', (form.wedding_date_ranges as { from: string; to: string }[]).filter((_: { from: string; to: string }, j: number) => j !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                  <button type="button"
                    onClick={() => set('wedding_date_ranges', [...form.wedding_date_ranges, { from: '', to: '' }])}
                    style={{ fontSize: 12, color: 'var(--gold)', background: 'none', border: '1px dashed var(--gold)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', marginTop: 2 }}>
                    + Añadir rango
                  </button>
                </div>
              )}

              {form.date_flexibility === 'month' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="form-input" value={form.wedding_month} onChange={e => set('wedding_month', e.target.value)}>
                    {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                  <select className="form-input" style={{ width: 110 }} value={form.wedding_year} onChange={e => set('wedding_year', e.target.value)}>
                    {YEAR_OPTS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}

              {form.date_flexibility === 'season' && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
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
                <label className="form-label">Email</label>
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

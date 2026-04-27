'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import {
  ChevronLeft, ChevronRight, X, Plus, User, ExternalLink,
  FileText, Calendar, Search, AlertCircle, Trash2, Flower2, Edit2,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type Status = 'libre' | 'negociacion' | 'reservado' | 'bloqueado'

type Entry = {
  id?: string
  date: string
  status: Status
  note?: string
  lead_id?: string | null
}

type Lead = {
  id: string
  name: string
  email?: string
  phone?: string
  whatsapp?: string
  wedding_date?: string
  wedding_date_to?: string
  wedding_date_ranges?: { from: string; to: string }[]
  date_flexibility?: string
  wedding_year?: number
  wedding_month?: number
  guests?: number
  status: string
  budget?: string
  ceremony_type?: string
  visit_date?: string
  visit_time?: string
  visit_duration?: number
  notes?: string
  budget_date?: string
  budget_date_to?: string
  budget_date_ranges?: { from: string; to: string }[]
  budget_date_flexibility?: string
}

type ModalityPackage = {
  id: string
  day_from: number  // Mon=0 … Sun=6
  day_to: number
  label: string | null
  sort_order: number
}

type Modality = {
  id: string
  name: string
  duration_type: string
  packages: ModalityPackage[]
}

const DOW_NAMES_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']  // Mon=0 … Sun=6

// ── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<Status, { label: string; bg: string; border: string; color: string; dot: string; badge: string }> = {
  libre:       { label: 'Libre',          bg: '#fff',     border: '#e8ddd3', color: 'var(--charcoal)', dot: '#c5b9aa', badge: '#f5f0eb' },
  negociacion: { label: 'En negociación', bg: '#fef7ec',  border: '#f5deb3', color: '#8a6d2b',         dot: '#d4a24c', badge: '#fef7ec' },
  reservado:   { label: 'Reservado',      bg: '#d1fae5',  border: '#059669', color: '#064e3b',         dot: '#047857', badge: '#d1fae5' },
  bloqueado:   { label: 'Bloqueado',      bg: '#f0eeec',  border: '#d6d2ce', color: '#8b8580',         dot: '#a8a3a0', badge: '#f0eeec' },
}

const LEAD_STATUS: Record<string, { label: string; color: string }> = {
  new:            { label: 'Nuevo',            color: '#3b82f6' },
  contacted:      { label: 'Contactado',       color: '#8b5cf6' },
  proposal_sent:  { label: 'Propuesta enviada', color: '#f59e0b' },
  visit_scheduled:{ label: 'Visita agendada',  color: '#10b981' },
  post_visit:     { label: 'Post-visita',      color: '#06b6d4' },
  budget_sent:    { label: 'Presupuesto',      color: '#6366f1' },
  won:            { label: 'Reservado',         color: '#16a34a' },
  lost:           { label: 'Perdido',          color: '#dc2626' },
}

const BUDGET_LABEL: Record<string, string> = {
  sin_definir: 'Sin definir', menos_5k: '< 5.000 €', '5k_10k': '5.000–10.000 €',
  '10k_20k': '10.000–20.000 €', '20k_40k': '20.000–40.000 €', mas_40k: '> 40.000 €',
}
const CEREMONY_LABEL: Record<string, string> = {
  sin_definir: 'Sin definir', civil: 'Civil', religiosa: 'Religiosa', simbolica: 'Simbólica', mixta: 'Mixta',
}

const MONTHS     = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_SHORT = ['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM']
const HIGH_SEASON = [4,5,6,7,8,9]

const SEASON_NAME: Record<number, string> = {
  0: 'Invierno', 1: 'Invierno', 2: 'Primavera', 3: 'Primavera', 4: 'Primavera',
  5: 'Verano', 6: 'Verano', 7: 'Verano', 8: 'Otoño', 9: 'Otoño', 10: 'Otoño', 11: 'Invierno',
}

function pad(n: number) { return String(n).padStart(2, '0') }
function dateStr(y: number, m: number, d: number) { return `${y}-${pad(m+1)}-${pad(d)}` }

function offsetDate(base: string, offset: number): string {
  const d = new Date(base + 'T12:00:00')
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

// Returns span length (days) for a modality package (Mon=0 convention, supports cross-week)
function pkgSpanDays(day_from: number, day_to: number): number {
  if (day_from === day_to) return 1
  let count = 1, d = day_from
  while (d !== day_to) { d = (d + 1) % 7; count++ }
  return count
}

function formatDateEs(ds: string): string {
  const d = new Date(ds + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CalendarioPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { isBlocked } = useRequireSubscription()

  const [entries,      setEntries]      = useState<Record<string, Entry>>({})
  const [entries2,     setEntries2]     = useState<Record<string, Entry>>({}) // secondary half-day slot per date
  const [leads,        setLeads]        = useState<Lead[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [modalities,   setModalities]   = useState<Modality[]>([])

  const today  = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  // Modal state
  const [modalDate, setModalDate] = useState<string | null>(null)

  // Bulk mode
  const [bulkMode,   setBulkMode]   = useState(false)
  const [bulkDates,  setBulkDates]  = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<Status>('reservado')
  const [bulkStart,  setBulkStart]  = useState<string | null>(null)

  const [dragStart, setDragStart]   = useState<string | null>(null)
  const wasDraggingRef = useRef(false)
  const wasDragBulkRef = useRef(false)  // true when bulkMode was activated by drag

  // Calendar filter — multi-select; empty Set means "all"
  const [calendarFilters, setCalendarFilters] = useState<Set<string>>(new Set())
  const toggleCalendarFilter = (f: string) => {
    setCalendarFilters(prev => {
      if (f === 'all') return new Set()
      const next = new Set(prev)
      if (next.has(f)) { next.delete(f) } else { next.add(f) }
      // If all three specific filters are active → reset to "Todos"
      if (next.has('visitas') && next.has('bodas') && next.has('leads')) return new Set()
      return next
    })
  }
  const filterAll = calendarFilters.size === 0

  // Lead search
  const [leadSearch,        setLeadSearch]        = useState('')
  const [leadSearchResults, setLeadSearchResults] = useState<Lead[]>([])
  const [searchOpen,        setSearchOpen]        = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    load()
  }, [user, authLoading, year, month])

  // Deep-link: reabrir modal de fecha al volver desde ?openDate=YYYY-MM-DD
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const openDate = params.get('openDate')
    if (!openDate) return
    setModalDate(openDate)
    window.history.replaceState({}, '', '/calendario')
  }, [])

  const load = async () => {
    setLoading(true)
    const supabase = createClient()
    const lastDay  = new Date(year, month + 1, 0).getDate()
    const from     = dateStr(year, month, 1)
    const to       = dateStr(year, month, lastDay)

    const [entriesRes, leadsRes, modalitiesRes] = await Promise.all([
      supabase.from('calendar_entries').select('*').eq('user_id', user!.id).gte('date', from).lte('date', to),
      supabase.from('leads').select('id,name,email,phone,whatsapp,wedding_date,wedding_date_to,wedding_date_ranges,date_flexibility,wedding_year,wedding_month,guests,status,budget,ceremony_type,visit_date,visit_time,visit_duration,notes,budget_date,budget_date_to,budget_date_ranges,budget_date_flexibility').eq('user_id', user!.id).order('wedding_date', { ascending: true }),
      supabase.from('venue_modalities').select('id,name,duration_type,packages:venue_modality_packages(id,day_from,day_to,label,sort_order)').eq('user_id', user!.id).order('sort_order'),
    ])

    const map: Record<string, Entry> = {}
    const map2: Record<string, Entry> = {}
    if (entriesRes.data) {
      entriesRes.data.forEach((e: Entry) => {
        if (!map[e.date]) {
          map[e.date] = e
        } else {
          // Second entry on same date — secondary half-day slot (different lead/half)
          map2[e.date] = e
        }
      })
    }
    setEntries(map)
    setEntries2(map2)
    if (leadsRes.data) setLeads(leadsRes.data)
    if (modalitiesRes.data) setModalities(modalitiesRes.data as Modality[])
    setLoading(false)
  }

  // Expand a date range into all ISO dates within it
  function expandRange(from: string, to: string): string[] {
    const result: string[] = []
    const d = new Date(from + 'T12:00:00')
    const end = new Date((to || from) + 'T12:00:00')
    while (d <= end) {
      result.push(d.toISOString().slice(0, 10))
      d.setDate(d.getDate() + 1)
    }
    return result
  }

  // Leads indexed by date for fast calendar lookup — handles all flexibility types
  const leadsByDate = useMemo(() => {
    const m: Record<string, Lead[]> = {}
    const add = (date: string, lead: Lead) => {
      if (!m[date]) m[date] = []
      if (!m[date].some(x => x.id === lead.id)) m[date].push(lead)
    }
    leads.filter(l => l.status !== 'lost').forEach(l => {
      // Index by wedding_date (what the couple originally requested)
      const flex = l.date_flexibility || 'exact'
      if (flex === 'exact' && l.wedding_date) {
        if (l.wedding_date_to) {
          expandRange(l.wedding_date, l.wedding_date_to).forEach(d => add(d, l))
        } else {
          add(l.wedding_date, l)
        }
      } else if (flex === 'range' && l.wedding_date) {
        expandRange(l.wedding_date, l.wedding_date_to || l.wedding_date).forEach(d => add(d, l))
      } else if (flex === 'multi_range' && l.wedding_date_ranges?.length) {
        l.wedding_date_ranges.forEach(r => {
          if (r.from) expandRange(r.from, r.to || r.from).forEach(d => add(d, l))
        })
      } else if (flex === 'month' && l.wedding_year && l.wedding_month) {
        const y = l.wedding_year, mo = l.wedding_month
        const days = new Date(y, mo, 0).getDate()
        for (let d = 1; d <= days; d++) {
          add(`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`, l)
        }
      }

      // Also index by budget_date* for budget_sent / won leads
      if ((l.status === 'budget_sent' || l.status === 'won') && l.budget_date) {
        const bflex = l.budget_date_flexibility || 'exact'
        if (bflex === 'exact') {
          if (l.budget_date_to) {
            expandRange(l.budget_date, l.budget_date_to).forEach(d => add(d, l))
          } else {
            add(l.budget_date, l)
          }
        } else if (bflex === 'range') {
          expandRange(l.budget_date, l.budget_date_to || l.budget_date).forEach(d => add(d, l))
        } else if (bflex === 'multi_range' && l.budget_date_ranges?.length) {
          l.budget_date_ranges.forEach(r => {
            if (r.from) expandRange(r.from, r.to || r.from).forEach(d => add(d, l))
          })
        }
      }
    })
    return m
  }, [leads])

  // Leads whose lead_id is linked in an entry (for display names on cells)
  const leadsById = useMemo(() => {
    const m: Record<string, Lead> = {}
    leads.forEach(l => { m[l.id] = l })
    return m
  }, [leads])

  // Leads with a scheduled visit indexed by visit_date
  const visitsByDate = useMemo(() => {
    const m: Record<string, Lead[]> = {}
    leads.forEach(l => {
      if (l.visit_date) {
        if (!m[l.visit_date]) m[l.visit_date] = []
        m[l.visit_date].push(l)
      }
    })
    return m
  }, [leads])

  const saveEntry = async (entry: Partial<Entry> & { date: string }, extraBlocks?: { date: string; isHalf: boolean }[]) => {
    setSaving(true)
    const supabase = createClient()

    const upsertOne = async (e: Partial<Entry> & { date: string }) => {
      // Only delete if there's no lead_id, no meaningful status AND no note
      if ((!e.status || e.status === 'libre') && !e.lead_id && !e.note?.trim()) {
        const existing = entries[e.date]
        if (existing?.id) await supabase.from('calendar_entries').delete().eq('id', existing.id)
        setEntries(prev => { const n = { ...prev }; delete n[e.date]; return n })
      } else {
        const statusToSave = (!e.status || e.status === 'libre') && e.lead_id ? 'negociacion' : e.status!
        const existing = entries[e.date]
        let result
        if (existing?.id) {
          const { data } = await supabase.from('calendar_entries')
            .update({ status: statusToSave, note: e.note ?? null, lead_id: e.lead_id ?? null })
            .eq('id', existing.id).select().single()
          result = data
        } else {
          const { data } = await supabase.from('calendar_entries')
            .insert({ user_id: user!.id, date: e.date, status: statusToSave, note: e.note ?? null, lead_id: e.lead_id ?? null })
            .select().single()
          result = data
        }
        if (result) setEntries(prev => ({ ...prev, [e.date]: result }))
      }
    }

    await upsertOne(entry)
    if (extraBlocks && extraBlocks.length > 0) {
      for (const b of extraBlocks) {
        await upsertOne({ date: b.date, status: 'bloqueado', note: b.isHalf ? 'medio_dia' : 'Auto-bloqueado por reglas de venue' })
      }
    }
    setSaving(false)
  }

  const applyBulk = async () => {
    if (bulkDates.size === 0) return
    setSaving(true)
    const supabase = createClient()
    const todayStr = dateStr(today.getFullYear(), today.getMonth(), today.getDate())
    for (const d of bulkDates) {
      if (d >= todayStr) await saveEntry({ date: d, status: bulkStatus })
    }
    setBulkDates(new Set()); setBulkMode(false); setBulkStart(null)
    wasDragBulkRef.current = false
    setSaving(false)
  }

  const handleDayClick = (d: string, isPast: boolean) => {
    if (bulkMode) {
      if (wasDragBulkRef.current) {
        // Bulk mode was entered via drag — a single click exits it and opens the DayModal
        setBulkMode(false)
        setBulkDates(new Set())
        setBulkStart(null)
        wasDragBulkRef.current = false
        if (!isPast) setModalDate(d)
        return
      }
      // Button-triggered bulk mode: click-click range selection
      if (!bulkStart) {
        setBulkStart(d)
        setBulkDates(new Set([d]))
      } else {
        // Fill range from bulkStart to d
        const start = bulkStart < d ? bulkStart : d
        const end   = bulkStart < d ? d : bulkStart
        const range = new Set<string>()
        const lastDay = new Date(year, month + 1, 0).getDate()
        for (let i = 1; i <= lastDay; i++) {
          const ds = dateStr(year, month, i)
          if (ds >= start && ds <= end) range.add(ds)
        }
        setBulkDates(range)
        setBulkStart(null)
      }
      return
    }
    setModalDate(d)
  }

  // Lead search logic
  useEffect(() => {
    if (!leadSearch.trim()) { setLeadSearchResults([]); return }
    const q = leadSearch.toLowerCase()
    setLeadSearchResults(
      leads.filter(l => l.status !== 'lost' && (
        l.name.toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q)
      )).slice(0, 6)
    )
  }, [leadSearch, leads])

  // Drag to select range
  useEffect(() => {
    const onMouseUp = () => {
      if (dragStart) {
        setDragStart(null)
        // Reset bulkStart after drag so next single click doesn't extend the range
        if (wasDraggingRef.current) {
          setBulkStart(null)
        }
      }
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [dragStart])

  const navigateToLead = (lead: Lead) => {
    const flex = lead.date_flexibility || 'exact'
    let targetDate: string | null = null
    if (flex === 'exact' || flex === 'range') targetDate = lead.wedding_date || null
    else if (flex === 'multi_range') targetDate = lead.wedding_date_ranges?.[0]?.from || null
    else if (flex === 'month' && lead.wedding_year && lead.wedding_month)
      targetDate = `${lead.wedding_year}-${String(lead.wedding_month).padStart(2,'0')}-01`
    if (targetDate) {
      const d = new Date(targetDate + 'T12:00:00')
      setYear(d.getFullYear())
      setMonth(d.getMonth())
    }
    setLeadSearch('')
    setLeadSearchResults([])
    setSearchOpen(false)
  }

  // Calendar grid
  const lastDay    = new Date(year, month + 1, 0).getDate()
  let   startDow   = new Date(year, month, 1).getDay() - 1
  if (startDow < 0) startDow = 6
  const cells      = [...Array(startDow).fill(null), ...Array.from({ length: lastDay }, (_, i) => i + 1)]
  const todayIso   = dateStr(today.getFullYear(), today.getMonth(), today.getDate())
  const isHighSeason = HIGH_SEASON.includes(month)

  const countByStatus = (s: Status) => Object.values(entries).filter(e => e.status === s).length

  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11) } else setMonth(m => m-1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0) } else setMonth(m => m+1) }

  // Upcoming events for sidebar (next 60 days)
  const upcomingEntries = useMemo(() => {
    const all: (Entry & { leadName?: string })[] = []
    Object.values(entries).forEach(e => {
      if (e.date >= todayIso && e.status !== 'libre') {
        all.push({ ...e, leadName: e.lead_id ? leadsById[e.lead_id]?.name : undefined })
      }
    })
    return all.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8)
  }, [entries, leadsById, todayIso])

  // Leads with future wedding dates (for sidebar)
  const upcomingLeads = useMemo(() => {
    return leads
      .filter(l => l.status !== 'won' && l.status !== 'lost')
      .filter(l => {
        const flex = l.date_flexibility || 'exact'
        if (flex === 'exact') return l.wedding_date && l.wedding_date >= todayIso
        if (flex === 'range') return (l.wedding_date_to || l.wedding_date || '') >= todayIso
        if (flex === 'multi_range') return (l.wedding_date_ranges || []).some(r => (r.to || r.from) >= todayIso)
        if (flex === 'month') return l.wedding_year && l.wedding_month
          ? `${l.wedding_year}-${String(l.wedding_month).padStart(2,'0')}-28` >= todayIso
          : false
        return false // flexible/season not shown in sidebar
      })
      .sort((a, b) => {
        const getDate = (l: Lead) => {
          const flex = l.date_flexibility || 'exact'
          if (flex === 'exact' || flex === 'range') return l.wedding_date || '9999'
          if (flex === 'multi_range') return l.wedding_date_ranges?.[0]?.from || '9999'
          if (flex === 'month') return `${l.wedding_year}-${String(l.wedding_month).padStart(2,'0')}-01`
          return '9999'
        }
        return getDate(a).localeCompare(getDate(b))
      })
      .slice(0, 6)
  }, [leads, todayIso])

  if (isBlocked) return null

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Calendario</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>

            {/* Lead search */}
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#faf8f5', border: '1px solid var(--ivory)', borderRadius: 6, padding: '0 12px', minHeight: 40, boxSizing: 'border-box' }}>
                <Search size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                <input
                  value={leadSearch}
                  onChange={e => { setLeadSearch(e.target.value); setSearchOpen(true) }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                  placeholder="Buscar pareja…"
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: 160, color: 'var(--charcoal)', height: '100%' }}
                />
                {leadSearch && (
                  <button type="button" onClick={() => { setLeadSearch(''); setLeadSearchResults([]) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 0, display: 'flex' }}>
                    <X size={13} />
                  </button>
                )}
              </div>
              {searchOpen && leadSearchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
                  border: '1px solid var(--ivory)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                  zIndex: 100, marginTop: 4, overflow: 'hidden', minWidth: 240,
                }}>
                  {leadSearchResults.map(l => {
                    const flex = l.date_flexibility || 'exact'
                    const dateLabel = flex === 'exact' && l.wedding_date
                      ? new Date(l.wedding_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                      : flex === 'range' && l.wedding_date
                      ? `${new Date(l.wedding_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${l.wedding_date_to ? new Date(l.wedding_date_to + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '?'}`
                      : flex === 'month' && l.wedding_year && l.wedding_month
                      ? `${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][l.wedding_month - 1]} ${l.wedding_year}`
                      : 'Fecha flexible'
                    return (
                      <button key={l.id} type="button"
                        onMouseDown={() => navigateToLead(l)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '9px 14px', border: 'none', background: 'none',
                          cursor: 'pointer', textAlign: 'left', gap: 10,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#faf8f5')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)' }}>{l.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>{dateLabel}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              {searchOpen && leadSearch.trim() && leadSearchResults.length === 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, background: '#fff',
                  border: '1px solid var(--ivory)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                  zIndex: 100, marginTop: 4, padding: '10px 14px', fontSize: 12, color: 'var(--warm-gray)', whiteSpace: 'nowrap',
                }}>Sin resultados</div>
              )}
            </div>

            {bulkMode ? (
              <>
                <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>
                  {bulkStart ? 'Haz click en otra fecha para seleccionar el rango' : `${bulkDates.size} fechas seleccionadas`}
                </span>
                <div style={{ minWidth: 180 }}>
                  <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as Status)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="negociacion">En negociación</SelectItem>
                      <SelectItem value="reservado">Reservado</SelectItem>
                      <SelectItem value="bloqueado">Bloqueado</SelectItem>
                      <SelectItem value="libre">Libre (desbloquear)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <button className="btn btn-primary" onClick={applyBulk} disabled={saving || bulkDates.size === 0}>
                  {saving ? 'Guardando...' : 'Aplicar al rango'}
                </button>
                <button className="btn btn-ghost" onClick={() => { setBulkMode(false); setBulkDates(new Set()); setBulkStart(null); wasDragBulkRef.current = false }}>
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => setBulkMode(true)}>
                  <Calendar size={13} /> Seleccionar rango
                </button>
              </>
            )}
          </div>
        </div>

        <div className="page-content">
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { value: lastDay - countByStatus('negociacion') - countByStatus('reservado') - countByStatus('bloqueado'), label: 'Fechas libres', color: 'var(--espresso)' },
              { value: countByStatus('negociacion'), label: 'En negociación', color: 'var(--gold)' },
              { value: countByStatus('reservado'), label: 'Reservados', color: '#5c4033' },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid var(--ivory)', borderRadius: 12, padding: '20px 22px' }}>
                <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 36, fontWeight: 500, color: s.color, lineHeight: 1, marginBottom: 8 }}>
                  {String(s.value).padStart(2, '0')}
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--warm-gray)' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, alignItems: 'start' }}>
            {/* Calendar */}
            <div className="card" style={{ overflow: 'hidden', gridColumn: 'span 3' }}>
              {/* Calendar header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, color: 'var(--espresso)', fontWeight: 500, letterSpacing: '0.01em' }}>
                    {MONTHS[month]} {year}
                  </span>
                  <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()) }}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
                    Hoy
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={prevMonth}
                    style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--ivory)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--charcoal)' }}>
                    <ChevronLeft size={15} />
                  </button>
                  <button onClick={nextMonth}
                    style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--ivory)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--charcoal)' }}>
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>

              {/* Filter buttons — multi-select */}
              <div style={{ padding: '8px 16px 10px', borderBottom: '1px solid var(--ivory)', display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                {([
                  { key: 'all',    label: 'Todos',             color: 'var(--gold)' },
                  { key: 'visitas', label: 'Visitas',           color: '#10b981' },
                  { key: 'bodas',  label: 'Bodas confirmadas', color: '#059669' },
                  { key: 'leads',  label: 'Leads',             color: '#3b82f6' },
                ] as const).map(({ key, label, color }) => {
                  const isActive = key === 'all' ? filterAll : calendarFilters.has(key)
                  return (
                    <button key={key} onClick={() => toggleCalendarFilter(key)} style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 20, border: '1.5px solid',
                      borderColor: isActive ? color : 'var(--ivory)',
                      background: isActive ? color : 'transparent',
                      color: isActive ? '#fff' : 'var(--warm-gray)',
                      cursor: 'pointer', fontWeight: isActive ? 600 : 400, transition: 'all 0.15s',
                    }}>
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--ivory)' }}>
                {DAYS_SHORT.map((d, i) => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: i >= 5 ? 'var(--gold)' : 'var(--warm-gray)', letterSpacing: '0.08em', padding: '12px 0' }}>
                    {d}
                  </div>
                ))}
              </div>

                {loading ? (
                  <div style={{ textAlign: 'center', padding: 60, color: 'var(--warm-gray)', fontSize: 13 }}>Cargando...</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
                    {cells.map((day, i) => {
                      if (!day) return <div key={`e-${i}`} style={{ minHeight: 90, borderBottom: '1px solid var(--ivory)', borderRight: i % 7 !== 6 ? '1px solid var(--ivory)' : 'none' }} />
                      const dow       = (startDow + day - 1) % 7
                      const isWeekend = dow >= 5
                      const ds        = dateStr(year, month, day)
                      const entry     = entries[ds]
                      const entry2nd  = entries2[ds]
                      const status    = entry?.status as Status | undefined
                      const cfg       = STATUS_CFG[status || 'libre']
                      const isHalfDayBlock = !!(entry?.note?.startsWith('medio_dia'))
                      // Double half-day: two separate bookings share the day
                      const isDoubleHalf = isHalfDayBlock && !!entry2nd?.note?.startsWith('medio_dia')
                      const cfg2nd = STATUS_CFG[(entry2nd?.status as Status) || 'libre']
                      const isToday   = ds === todayIso
                      const isPast    = ds < todayIso
                      const isBulkSel = bulkDates.has(ds)
                      const isBulkStart = bulkStart === ds
                      const dayLeads   = leadsByDate[ds] || []
                      const linkedLead = entry?.lead_id ? leadsById[entry.lead_id] : null
                      const visitLeads = visitsByDate[ds] || []
                      const hasVisits  = visitLeads.length > 0

                      // Effective status — derived from actual lead statuses (bloqueado stays from DB)
                      const NEG_LEAD_STATUSES = ['contacted', 'post_visit', 'proposal_sent', 'budget_sent']
                      const effectiveStatus: Status | undefined = status === 'bloqueado' ? 'bloqueado'
                        : dayLeads.some((l: any) => l.status === 'won') ? 'reservado'
                        : dayLeads.some((l: any) => NEG_LEAD_STATUSES.includes(l.status)) ? 'negociacion'
                        : undefined

                      // Filter: does this cell match the active filter?
                      const filterIncludesVisitas = !filterAll && calendarFilters.has('visitas')
                      // Show cross only when visitas filter active + bodas filter NOT active + cell is reservado/bloqueado
                      const showCross = filterIncludesVisitas && !calendarFilters.has('bodas') && (effectiveStatus === 'reservado' || status === 'bloqueado')
                      const hideStatusLabel = filterIncludesVisitas && !(calendarFilters.has('bodas') && effectiveStatus === 'reservado')
                      const matchesFilter =
                        filterAll ||
                        (calendarFilters.has('visitas') && hasVisits) ||
                        (calendarFilters.has('bodas') && effectiveStatus === 'reservado') ||
                        (calendarFilters.has('leads') && dayLeads.length > 0)
                      const effectiveCfg = STATUS_CFG[effectiveStatus || 'libre']

                      // Name to show on cell — status takes priority; visit only wins if no status
                      const visitOnly = hasVisits && !effectiveStatus
                      const displayName = !matchesFilter ? null
                        : visitOnly ? visitLeads[0].name
                        : linkedLead?.name || (dayLeads.length === 1 ? dayLeads[0].name : null)
                      // True when the displayed lead also has a visit that day
                      const displayLeadHasVisit = hasVisits && (visitOnly || visitLeads.some((v: any) => v.id === linkedLead?.id))
                      const hasUnlinkedLeads = matchesFilter && dayLeads.length > 0 && !linkedLead && !visitOnly

                      // Duration suffix for exact leads with multi-day weddings
                      const singleLead = !hasVisits && dayLeads.length === 1 ? dayLeads[0] : null
                      const durationSuffix = singleLead && singleLead.date_flexibility === 'exact' && singleLead.wedding_date && singleLead.wedding_date_to
                        ? (() => {
                            const from = new Date(singleLead.wedding_date + 'T12:00:00')
                            const to   = new Date(singleLead.wedding_date_to + 'T12:00:00')
                            const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1
                            return days > 1 ? `·${days}d` : ''
                          })()
                        : ''

                      // Half-day split: use actual status color + white (or second booking's color)
                      const statusColor  = (status && status !== 'libre') ? cfg.bg : '#f3f4f6'
                      const statusColor2 = (entry2nd?.status && entry2nd.status !== 'libre') ? cfg2nd.bg : '#f3f4f6'
                      const isTarde = entry?.note?.startsWith('medio_dia_tarde')
                      const halfDayBg = isDoubleHalf
                        ? `linear-gradient(135deg, ${statusColor} 50%, ${statusColor2} 50%)`
                        : isTarde
                          ? `linear-gradient(135deg, #ffffff 50%, ${statusColor} 50%)`
                          : `linear-gradient(135deg, ${statusColor} 50%, #ffffff 50%)`
                      const cellBg = isBulkSel ? '#fef3c7' : isPast ? '#faf8f5' : hasVisits && !effectiveStatus ? 'rgba(16,185,129,0.06)' : isHalfDayBlock ? halfDayBg : effectiveStatus ? effectiveCfg.bg : '#fff'
                      const colIndex = (startDow + day - 1 + startDow === 0 ? 0 : i) % 7

                      return (
                        <button
                          key={ds}
                          onMouseDown={(e) => {
                            if (e.button !== 0) return
                            wasDraggingRef.current = false
                            setDragStart(ds)
                          }}
                          onMouseEnter={() => {
                            if (!dragStart || ds === dragStart) return
                            // Start or extend drag selection
                            if (!wasDraggingRef.current) {
                              wasDraggingRef.current = true
                              wasDragBulkRef.current = true
                              setBulkMode(true)
                              setBulkStart(dragStart)
                            }
                            // Compute range
                            const start = dragStart < ds ? dragStart : ds
                            const end   = dragStart < ds ? ds : dragStart
                            const range = new Set<string>()
                            for (let i = 1; i <= lastDay; i++) {
                              const d2 = dateStr(year, month, i)
                              if (d2 >= start && d2 <= end) range.add(d2)
                            }
                            setBulkDates(range)
                          }}
                          onClick={() => {
                            if (wasDraggingRef.current) {
                              wasDraggingRef.current = false
                              return
                            }
                            handleDayClick(ds, isPast && !bulkMode)
                          }}
                          style={{
                            width: '100%', minHeight: 90, border: 'none',
                            borderBottom: '1px solid var(--ivory)',
                            borderRight: i % 7 !== 6 ? '1px solid var(--ivory)' : 'none',
                            background: cellBg,
                            cursor: isPast && !bulkMode ? 'default' : 'pointer',
                            transition: 'background 0.15s',
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                            justifyContent: 'space-between', padding: '8px 10px', outline: 'none',
                            boxShadow: isToday ? 'inset 0 0 0 2px var(--gold)' : isBulkStart ? 'inset 0 0 0 2px var(--gold)' : 'none',
                            opacity: saving ? 0.7 : 1,
                            position: 'relative',
                          }}
                        >
                          {/* Day number */}
                          <span style={{
                            fontSize: 15, fontWeight: isToday ? 700 : 500, lineHeight: 1,
                            color: isPast ? 'var(--stone)' : isToday ? 'var(--gold)' : 'var(--charcoal)',
                            fontFamily: 'Manrope, sans-serif',
                            position: 'relative', zIndex: 1,
                          }}>
                            {day}
                          </span>

                          {/* Big ✕ overlay for reservado/bloqueado when visitas filter active but bodas filter not */}
                          {showCross && (
                            <div style={{
                              position: 'absolute', inset: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              pointerEvents: 'none', zIndex: 0,
                            }}>
                              <svg viewBox="0 0 24 24" style={{ width: '65%', height: '65%', opacity: 0.22 }} fill="none" stroke={cfg.dot} strokeWidth={2.5} strokeLinecap="round">
                                <line x1="4" y1="4" x2="20" y2="20" />
                                <line x1="20" y1="4" x2="4" y2="20" />
                              </svg>
                            </div>
                          )}

                          {/* Lead name / visit name — hidden when cross is shown */}
                          {displayName && !isPast && !showCross && (
                            <span style={{
                              fontSize: 9, lineHeight: 1.3,
                              color: visitOnly && matchesFilter ? '#059669' : effectiveCfg.color,
                              fontWeight: 600, maxWidth: '100%', overflow: 'hidden',
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                              textAlign: 'left', wordBreak: 'break-word', marginTop: 2,
                            }}>
                              {displayLeadHasVisit && matchesFilter ? `${displayName} - visita` : `${displayName}${durationSuffix}`}
                            </span>
                          )}

                          {/* Bottom: status label or indicators — stacked column */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', marginTop: 'auto', overflow: 'hidden' }}>
                            {/* Row 1: calendar status — hidden when visitas filter active (except reservado+bodas) */}
                            {matchesFilter && !hideStatusLabel && effectiveStatus && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: effectiveCfg.dot, flexShrink: 0 }} />
                                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: effectiveCfg.color, whiteSpace: 'nowrap' }}>
                                  {isHalfDayBlock ? (entry?.note?.startsWith('medio_dia_manana') ? '½ Mañ' : entry?.note?.startsWith('medio_dia_tarde') ? '½ Tar' : '½ Día') : effectiveStatus === 'negociacion' ? 'Negociación' : effectiveCfg.label}
                                </span>
                                {isDoubleHalf && entry2nd?.status && entry2nd.status !== 'libre' && (
                                  <>
                                    <span style={{ fontSize: 7, color: 'var(--stone)' }}>·</span>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg2nd.dot, flexShrink: 0 }} />
                                    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: cfg2nd.color, whiteSpace: 'nowrap' }}>
                                      {entry2nd.note?.startsWith('medio_dia_manana') ? '½ Mañ' : '½ Tar'}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                            {/* Row 2: visit indicator (always its own line, below status) */}
                            {matchesFilter && hasVisits && (() => {
                              const sorted = [...visitLeads].sort((a: any, b: any) => ((a as any).visit_time || 'zz').localeCompare((b as any).visit_time || 'zz'))
                              const first = sorted[0] as any
                              const firstTime = first.visit_time as string | undefined
                              const tipParts = sorted.map((v: any) => `${v.name}${v.visit_time ? ' · ' + v.visit_time : ''}`).join(' · ')
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} title={`Visita: ${tipParts}`}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                                  <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#059669', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                    {firstTime ? firstTime : 'Visita'}
                                  </span>
                                  {visitLeads.length > 1 && (
                                    <span style={{ fontSize: 8, color: '#10b981', fontWeight: 700 }}>+{visitLeads.length - 1}</span>
                                  )}
                                </div>
                              )
                            })()}
                            {/* Dots for libre dates with leads/notes */}
                            {(!status || status === 'libre') && !hasVisits ? (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                {hasUnlinkedLeads && (
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} title={`${dayLeads.length} lead(s)`} />
                                )}
                                {matchesFilter && entry?.note && (
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--stone)', flexShrink: 0 }} />
                                )}
                              </div>
                            ) : null}
                            {!visitOnly && matchesFilter && (() => {
                              const nonVisitLeadCount = dayLeads.filter((l: any) => !visitLeads.some((v: any) => v.id === l.id)).length
                              // If a name is shown already (displayName), count = extras beyond that one
                              const extraCount = displayName ? nonVisitLeadCount - 1 : nonVisitLeadCount
                              return extraCount > 0 ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 7, fontWeight: 700, background: '#fef3c7', color: '#92400e', borderRadius: 5, padding: '1px 5px', letterSpacing: '0.03em' }}>
                                  +{extraCount} {extraCount === 1 ? 'lead' : 'leads'}
                                </span>
                              ) : null
                            })()}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

              {/* Legend */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--ivory)', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                {Object.entries(STATUS_CFG).map(([key, cfg]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 11, height: 11, borderRadius: 3, background: cfg.bg, border: `1px solid ${cfg.border}` }} />
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--warm-gray)' }}>{cfg.label}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#10b981' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--warm-gray)' }}>Visita agendada</span>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'stretch' }}>
              {/* Upcoming booked */}
              <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <div className="card-title" style={{ fontSize: 13 }}>Próximas fechas</div>
                </div>
                <div style={{ padding: '0 0 8px', flex: 1, overflowY: 'auto' }}>
                  {upcomingEntries.length === 0 ? (
                    <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--warm-gray)' }}>Sin fechas marcadas</div>
                  ) : upcomingEntries.map(e => {
                    const cfg = STATUS_CFG[e.status]
                    const dt  = new Date(e.date + 'T12:00:00')
                    return (
                      <div key={e.date}
                        onClick={() => setModalDate(e.date)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', cursor: 'pointer', borderBottom: '1px solid var(--ivory)' }}
                      >
                        <div style={{ textAlign: 'center', minWidth: 36 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--espresso)', lineHeight: 1 }}>{dt.getDate()}</div>
                          <div style={{ fontSize: 9, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{MONTHS[dt.getMonth()].slice(0,3)}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {(() => {
                              // Decode compound note: "medio_dia_manana|texto libre" or plain text
                              const raw = e.note || ''
                              const pipeIdx = raw.indexOf('|')
                              const prefix = pipeIdx >= 0 ? raw.slice(0, pipeIdx) : raw
                              const freeText = pipeIdx >= 0 ? raw.slice(pipeIdx + 1) : ''
                              if (prefix === 'medio_dia_manana') return e.leadName || freeText || '½ Mañana'
                              if (prefix === 'medio_dia_tarde')  return e.leadName || freeText || '½ Tarde'
                              if (prefix === 'medio_dia')        return e.leadName || freeText || '½ Día'
                              return e.leadName || raw || cfg.label
                            })()}
                          </div>
                          <span style={{ fontSize: 10, background: cfg.badge, color: cfg.color, padding: '1px 6px', borderRadius: 10, fontWeight: 500 }}>
                            {e.note?.startsWith('medio_dia_manana') ? `${cfg.label} · ½ Mañ` : e.note?.startsWith('medio_dia_tarde') ? `${cfg.label} · ½ Tar` : e.note?.startsWith('medio_dia') ? `${cfg.label} · ½ Día` : cfg.label}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Leads with upcoming dates */}
              <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className="card-header" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="card-title" style={{ fontSize: 13 }}>Leads con fecha</div>
                  <a href="/leads" style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none' }}>Ver todos →</a>
                </div>
                <div style={{ padding: '0 0 8px', flex: 1, overflowY: 'auto' }}>
                  {upcomingLeads.length === 0 ? (
                    <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--warm-gray)' }}>Sin leads con fecha</div>
                  ) : upcomingLeads.map(l => {
                    const st  = LEAD_STATUS[l.status] || { label: l.status, color: '#6b7280' }
                    const flex = l.date_flexibility || 'exact'
                    const dateLabel = flex === 'range' ? `${l.wedding_date} – ${l.wedding_date_to || '?'}`
                      : flex === 'multi_range' ? `${l.wedding_date_ranges?.[0]?.from || '?'}${(l.wedding_date_ranges?.length || 0) > 1 ? ` +${(l.wedding_date_ranges?.length || 0) - 1}` : ''}`
                      : flex === 'month' ? `${MONTHS[(l.wedding_month || 1) - 1]} ${l.wedding_year || ''}`
                      : l.wedding_date ? new Date(l.wedding_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha'
                    const durationLabel = flex === 'exact' && l.wedding_date && l.wedding_date_to
                      ? (() => {
                          const from = new Date(l.wedding_date + 'T12:00:00')
                          const to   = new Date(l.wedding_date_to + 'T12:00:00')
                          const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1
                          return days > 1 ? ` · Boda ${days} días` : ''
                        })()
                      : ''
                    const dt  = l.wedding_date ? new Date(l.wedding_date + 'T12:00:00') : null
                    return (
                      <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: '1px solid var(--ivory)' }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <User size={13} style={{ color: 'var(--warm-gray)' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>
                            {dateLabel}{durationLabel}{l.guests ? ` · ${l.guests} inv.` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: 10, color: st.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{st.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Day Modal */}
      {modalDate && (
        <DayModal
          date={modalDate}
          entry={entries[modalDate] || null}
          entry2={entries2[modalDate] || null}
          leadsOnDate={leadsByDate[modalDate] || []}
          visitsOnDate={visitsByDate[modalDate] || []}
          allLeads={leads}
          leadsById={leadsById}
          saving={saving}
          modalities={modalities}
          onSave={async (updated, extraBlocks) => { await saveEntry(updated, extraBlocks); setModalDate(null); await load() }}
          onSave2={async (updated) => {
            const supabase = createClient()
            const existing = entries2[modalDate]
            if ((!updated.status || updated.status === 'libre') && !updated.lead_id && !updated.note?.trim()) {
              if (existing?.id) await supabase.from('calendar_entries').delete().eq('id', existing.id)
              setEntries2(prev => { const n = { ...prev }; delete n[modalDate]; return n })
            } else {
              const statusToSave = (!updated.status || updated.status === 'libre') && updated.lead_id ? 'negociacion' : updated.status!
              let result
              if (existing?.id) {
                const { data } = await supabase.from('calendar_entries')
                  .update({ status: statusToSave, note: updated.note ?? null, lead_id: updated.lead_id ?? null })
                  .eq('id', existing.id).select().single()
                result = data
              } else {
                const { data } = await supabase.from('calendar_entries')
                  .insert({ user_id: user!.id, date: modalDate, status: statusToSave, note: updated.note ?? null, lead_id: updated.lead_id ?? null })
                  .select().single()
                result = data
              }
              if (result) setEntries2(prev => ({ ...prev, [modalDate]: result }))
            }
            await load()
          }}
          onDelete={async () => { await saveEntry({ date: modalDate, status: 'libre' }); setModalDate(null) }}
          onClose={() => setModalDate(null)}
          onLeadCreated={async (lead) => { setLeads(prev => [lead, ...prev]) }}
          onUpdateLead={async (leadId, fields) => {
            const supabase = createClient()
            await supabase.from('leads').update(fields).eq('id', leadId)
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...fields } : l))
          }}
          onCancelWedding={async (lead, reason) => {
            const supabase = createClient()
            const notes = [lead.notes, reason ? `Boda cancelada: ${reason}` : 'Boda cancelada'].filter(Boolean).join('\n')
            await supabase.from('leads').update({ status: 'lost', notes }).eq('id', lead.id)
            await supabase.from('calendar_entries')
              .update({ status: 'libre', lead_id: null, note: null })
              .eq('user_id', user!.id).eq('lead_id', lead.id).eq('status', 'reservado')
            setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'lost', notes } : l))
            setModalDate(null)
            await load()
          }}
          userId={user!.id}
        />
      )}

    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function getSpanDates(startDate: string, spanDays: number): string[] {
  return Array.from({ length: spanDays }, (_, i) => addDays(startDate, i))
}

// ── Day Modal ─────────────────────────────────────────────────────────────────

function DayModal({
  date, entry, entry2, leadsOnDate, visitsOnDate, allLeads, leadsById, saving, modalities,
  onSave, onSave2, onDelete, onClose, onLeadCreated, onUpdateLead, onCancelWedding, userId
}: {
  date: string
  entry: Entry | null
  entry2: Entry | null
  leadsOnDate: Lead[]
  visitsOnDate: Lead[]
  allLeads: Lead[]
  leadsById: Record<string, Lead>
  saving: boolean
  modalities: Modality[]
  onSave: (e: Entry, extraBlocks?: { date: string; isHalf: boolean }[]) => Promise<void>
  onSave2: (e: Partial<Entry> & { date: string }) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
  onLeadCreated: (l: Lead) => Promise<void>
  onUpdateLead: (leadId: string, fields: Partial<Lead>) => Promise<void>
  onCancelWedding: (lead: Lead, reason: string) => Promise<void>
  userId: string
}) {
  const [status,      setStatus]      = useState<Status>(entry?.status || 'libre')
  // Separate half-day state from free-text note.
  // DB stores compound format: "medio_dia_manana|Texto libre" or just "medio_dia_manana"
  const _rawNote = entry?.note || ''
  const _HALF = ['medio_dia', 'medio_dia_manana', 'medio_dia_tarde']
  const _pipeIdx = _rawNote.indexOf('|')
  const _notePrefix = _pipeIdx >= 0 ? _rawNote.slice(0, _pipeIdx) : _rawNote
  const _noteSuffix = _pipeIdx >= 0 ? _rawNote.slice(_pipeIdx + 1) : ''
  const [halfDay,     setHalfDay]     = useState<'' | 'medio_dia_manana' | 'medio_dia_tarde'>(
    _HALF.includes(_notePrefix) ? (_notePrefix === 'medio_dia' ? 'medio_dia_manana' : _notePrefix as 'medio_dia_manana' | 'medio_dia_tarde') : ''
  )
  const [note,        setNote]        = useState(_HALF.includes(_notePrefix) ? _noteSuffix : _rawNote)
  // Derived: medio día active when halfDay is set
  const isMedioDia = halfDay !== ''
  const [leadId,      setLeadId]      = useState<string | null>(entry?.lead_id || null)

  // ── Secondary half-day slot (otro medio día del mismo día) ─────────────────
  const _raw2 = entry2?.note || ''
  const _pipe2 = _raw2.indexOf('|')
  const _pref2 = _pipe2 >= 0 ? _raw2.slice(0, _pipe2) : _raw2
  const _suf2  = _pipe2 >= 0 ? _raw2.slice(_pipe2 + 1) : ''
  const initHalf2: '' | 'medio_dia_manana' | 'medio_dia_tarde' = _HALF.includes(_pref2)
    ? (_pref2 === 'medio_dia' ? 'medio_dia_manana' : _pref2 as 'medio_dia_manana' | 'medio_dia_tarde')
    : ''
  const [status2,  setStatus2]  = useState<Status>(entry2?.status || 'libre')
  const [halfDay2, setHalfDay2] = useState<'' | 'medio_dia_manana' | 'medio_dia_tarde'>(initHalf2)
  const [note2,    setNote2]    = useState(_HALF.includes(_pref2) ? _suf2 : _raw2)
  const [leadId2,  setLeadId2]  = useState<string | null>(entry2?.lead_id || null)
  const [search2,  setSearch2]  = useState('')
  const [showSecondSlot, setShowSecondSlot] = useState(!!entry2)
  const [slot2Saving, setSlot2Saving] = useState(false)
  const [search,      setSearch]      = useState('')
  const [showCreate,  setShowCreate]  = useState(false)
  const [localSaving, setLocalSaving] = useState(false)
  const [showQuickLink, setShowQuickLink] = useState(false)
  const [showAllLeads, setShowAllLeads] = useState(false)
  const LEADS_PREVIEW = 3

  // Post-save: leads afectados por fecha bloqueada/reservada
  const [affectedLeads, setAffectedLeads] = useState<Lead[]>([])
  const [showAffected,  setShowAffected]  = useState(false)
  const [newDateFor,    setNewDateFor]    = useState<Record<string, string>>({})
  const [affectedSaving, setAffectedSaving] = useState<Record<string, boolean>>({})

  const [removeLeadConfirmId, setRemoveLeadConfirmId] = useState<string | null>(null)
  const [removingSaving, setRemovingSaving] = useState(false)
  // Local ordering for the "En negociación" section in the day modal
  const [negOrderIds, setNegOrderIds] = useState<string[]>([])
  const [deleteVisitConfirmId, setDeleteVisitConfirmId] = useState<string | null>(null)
  const [deletingVisit, setDeletingVisit] = useState(false)
  const [removedLeadForCrm, setRemovedLeadForCrm] = useState<Lead | null>(null)

  // Modality picker: which modality applies when linking a lead to this date
  const estructuraDow = (new Date(date + 'T12:00:00').getDay() + 6) % 7
  const modalityOptions = modalities
    .map(m => {
      const pkg = m.packages?.find(p => p.day_from === estructuraDow)
      if (!pkg) return null
      const span = pkgSpanDays(pkg.day_from, pkg.day_to)
      const endDate = addDays(date, span - 1)
      const pkgLabel = pkg.label || `${DOW_NAMES_ES[pkg.day_from]}→${DOW_NAMES_ES[pkg.day_to]}`
      return { modality: m, pkg, span, endDate, pkgLabel }
    })
    .filter(Boolean) as { modality: Modality; pkg: ModalityPackage; span: number; endDate: string; pkgLabel: string }[]
  const [selectedModalityId, setSelectedModalityId] = useState<string>('')
  const selectedOption = modalityOptions.find(o => o.modality.id === selectedModalityId) ?? null

  // Cancel wedding confirmation
  const [showCancelWedding,   setShowCancelWedding]   = useState(false)
  const [cancelWeddingReason, setCancelWeddingReason] = useState('')
  const [cancelWeddingSaving, setCancelWeddingSaving] = useState(false)

  const dt = new Date(date + 'T12:00:00')
  const isPast = date < new Date().toISOString().split('T')[0]
  const selectedLead = leadId ? leadsById[leadId] : null

  // ── Affected leads helpers ────────────────────────────────────────────────
  const fmtShort = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

  const getOtherDatesLabel = (l: Lead): string | null => {
    let others: string[] = []
    if ((l.status === 'budget_sent') && l.budget_date) {
      const bflex = l.budget_date_flexibility || 'exact'
      if (bflex === 'multi_range' && l.budget_date_ranges) {
        others = l.budget_date_ranges.filter(r => r.from !== date).map(r => r.from)
      } else if (l.budget_date !== date) {
        others = [l.budget_date]
      }
    } else {
      const flex = l.date_flexibility || 'exact'
      if (flex === 'multi_range' && l.wedding_date_ranges) {
        others = l.wedding_date_ranges.filter(r => r.from !== date).map(r => r.from)
      } else if (flex === 'exact' && l.wedding_date && l.wedding_date !== date) {
        others = [l.wedding_date]
      } else if (flex === 'range' && l.wedding_date) {
        if (l.wedding_date !== date) others.push(l.wedding_date)
        if (l.wedding_date_to && l.wedding_date_to !== date) others.push(l.wedding_date_to)
      }
    }
    if (others.length === 0) return null
    return others.slice(0, 2).map(fmtShort).join(', ') + (others.length > 2 ? ` +${others.length - 2}` : '')
  }

  const handleRemoveFromDate = async (l: Lead) => {
    setAffectedSaving(s => ({ ...s, [l.id]: true }))
    const updates: any = {}
    if ((l.status === 'budget_sent') && l.budget_date) {
      const bflex = l.budget_date_flexibility || 'exact'
      if (bflex === 'multi_range' && l.budget_date_ranges) {
        const filtered = l.budget_date_ranges.filter(r => r.from !== date)
        if (filtered.length === 0) { updates.budget_date = null; updates.budget_date_to = null; updates.budget_date_ranges = null }
        else if (filtered.length === 1) { updates.budget_date = filtered[0].from; updates.budget_date_to = filtered[0].to || null; updates.budget_date_ranges = null; updates.budget_date_flexibility = 'exact' }
        else { updates.budget_date_ranges = filtered }
      } else { updates.budget_date = null; updates.budget_date_to = null; updates.budget_date_ranges = null }
    } else {
      const flex = l.date_flexibility || 'exact'
      if (flex === 'multi_range' && l.wedding_date_ranges) {
        const filtered = l.wedding_date_ranges.filter(r => r.from !== date)
        if (filtered.length === 0) { updates.wedding_date = null; updates.wedding_date_to = null; updates.date_flexibility = 'flexible'; updates.wedding_date_ranges = null }
        else if (filtered.length === 1) { updates.wedding_date = filtered[0].from; updates.wedding_date_to = filtered[0].to || null; updates.wedding_date_ranges = null; updates.date_flexibility = 'exact' }
        else { updates.wedding_date_ranges = filtered }
      } else { updates.wedding_date = null; updates.wedding_date_to = null; updates.date_flexibility = 'flexible'; updates.wedding_date_ranges = null }
    }
    await onUpdateLead(l.id, updates)
    setAffectedLeads(prev => prev.filter(x => x.id !== l.id))
    setAffectedSaving(s => ({ ...s, [l.id]: false }))
  }

  // Auto-upgrade calendar status when lead changes
  useEffect(() => {
    if (leadId) {
      setStatus(prev => prev === 'libre' ? 'negociacion' : prev)
    } else {
      setStatus(prev => { if (prev === 'libre') setHalfDay(''); return prev })
    }
  }, [leadId])

  // Al abrir el modal: si la fecha ya está reservada/bloqueada, mostrar panel de afectados
  useEffect(() => {
    const entryStatus = entry?.status
    if (entryStatus !== 'reservado' && entryStatus !== 'bloqueado') return
    const linked = entry?.lead_id
    const others = leadsOnDate.filter(l => l.id !== linked && l.status !== 'lost' && l.status !== 'won')
    if (others.length > 0) {
      setAffectedLeads(others)
      setShowAffected(true)
    }
  }, [date])

  const filteredLeads = allLeads
    .filter(l => l.status !== 'lost' && (
      !search || l.name.toLowerCase().includes(search.toLowerCase()) || (l.email || '').toLowerCase().includes(search.toLowerCase())
    ))
    .sort((a, b) => {
      if (a.status === 'new' && b.status !== 'new') return -1
      if (a.status !== 'new' && b.status === 'new') return 1
      return 0
    })
    .slice(0, 8)

  const handleSave = async () => {
    setLocalSaving(true)

    const supabaseExtra = createClient()
    const calStatus = status === 'libre' && leadId ? 'negociacion' : status

    // If a modality with a package is selected, expand calendar entries across the span
    if (selectedOption && leadId && calStatus === 'negociacion') {
      const spanDates = getSpanDates(date, selectedOption.span)
      for (const spanDate of spanDates) {
        if (spanDate === date) continue
        const { data: existingSpan } = await supabaseExtra.from('calendar_entries')
          .select('id').eq('user_id', userId).eq('date', spanDate).maybeSingle()
        if (existingSpan?.id) {
          await supabaseExtra.from('calendar_entries').update({ status: calStatus, lead_id: leadId }).eq('id', existingSpan.id)
        } else {
          await supabaseExtra.from('calendar_entries').insert({ user_id: userId, date: spanDate, status: calStatus, lead_id: leadId })
        }
      }
      await onUpdateLead(leadId, {
        date_flexibility: 'range',
        wedding_date: date,
        wedding_date_to: selectedOption.endDate,
      })
    }

    // Combine halfDay variant + free-text note into a single note field
    // halfDay only applies when status is not libre
    const freeNote = note.trim()
    const effectiveHalfDay = status !== 'libre' ? halfDay : ''
    const savedNote = effectiveHalfDay
      ? (freeNote ? `${effectiveHalfDay}|${freeNote}` : effectiveHalfDay)
      : freeNote || undefined
    await onSave({ date, status, note: savedNote, lead_id: leadId })

    // Detectar leads afectados (otros leads con esta fecha que NO son el vinculado)
    if (status === 'reservado' || status === 'bloqueado') {
      const others = leadsOnDate.filter(l => l.id !== leadId && l.status !== 'lost' && l.status !== 'won')
      if (others.length > 0) {
        setAffectedLeads(others)
        setShowAffected(true)
        setLocalSaving(false)
        return // no cierres el modal todavía
      }
    }
    setLocalSaving(false)
  }

  const handleDelete = async () => {
    setLocalSaving(true)
    await onDelete()
    setLocalSaving(false)
  }

  const isSaving = saving || localSaving

  const handleRemoveLeadFromDate = async (leadToRemove: Lead) => {
    setRemovingSaving(true)
    const supabase = createClient()
    // Remove calendar entry on this date linked to this lead
    await supabase.from('calendar_entries')
      .update({ lead_id: null })
      .eq('user_id', userId)
      .eq('lead_id', leadToRemove.id)
      .eq('date', date)
    // Check if lead has other calendar entries linked to it
    const { data: otherEntries } = await supabase.from('calendar_entries')
      .select('id')
      .eq('user_id', userId)
      .eq('lead_id', leadToRemove.id)
      .limit(1)
    // Clear all lead date fields
    await supabase.from('leads').update({
      wedding_date: null, wedding_date_to: null, wedding_date_ranges: null,
      date_flexibility: 'flexible', wedding_year: null, wedding_month: null,
    }).eq('id', leadToRemove.id)
    if (leadId === leadToRemove.id) setLeadId(null)
    await onUpdateLead(leadToRemove.id, {
      wedding_date: undefined, wedding_date_to: undefined, wedding_date_ranges: undefined,
      date_flexibility: 'flexible', wedding_year: undefined, wedding_month: undefined,
    })
    setRemoveLeadConfirmId(null)
    setRemovingSaving(false)
    // If no other entries exist, prompt to delete from CRM
    if (!otherEntries || otherEntries.length === 0) {
      setRemovedLeadForCrm(leadToRemove)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 600, color: 'var(--espresso)', textTransform: 'capitalize' }}>
              {dt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            {isPast && <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 3 }}>Fecha pasada · solo lectura</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px 24px' }}>

          {showCreate ? (
            <QuickCreateLead
              defaultDate={date}
              userId={userId}
              onCreated={async (lead) => { await onLeadCreated(lead); setLeadId(lead.id); setShowCreate(false) }}
              onCancel={() => setShowCreate(false)}
            />
          ) : (
            <>

              {/* ══ ① BODA CONFIRMADA ══ */}
              {status === 'reservado' && selectedLead?.status === 'won' && (
                <div style={{ marginBottom: 16, borderRadius: 10, overflow: 'hidden', border: '1.5px solid #a7d9b5' }}>
                  <div style={{ background: 'linear-gradient(135deg, #2d6a4f 0%, #40916c 100%)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Flower2 size={14} style={{ color: '#d8f3dc', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#d8f3dc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Boda confirmada</span>
                  </div>
                  <div style={{ background: '#f0faf4', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#1b4332', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLead.name}</div>
                      <div style={{ fontSize: 11, color: '#40916c', marginTop: 2 }}>
                        {selectedLead.guests ? `${selectedLead.guests} inv.` : ''}
                        {selectedLead.guests && selectedLead.budget && selectedLead.budget !== 'sin_definir' ? ' · ' : ''}
                        {selectedLead.budget && selectedLead.budget !== 'sin_definir' ? BUDGET_LABEL[selectedLead.budget] || selectedLead.budget : ''}
                      </div>
                    </div>
                    <a href={`/leads?open=${selectedLead.id}&returnDate=${date}`}
                      style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, background: '#40916c', color: '#fff', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      Ver lead
                    </a>
                  </div>
                </div>
              )}

              {/* ══ ② VISITAS PROGRAMADAS ══ */}
              {visitsOnDate.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> Visitas programadas
                  </div>
                  {[...visitsOnDate].sort((a, b) => (a.visit_time || 'zz').localeCompare(b.visit_time || 'zz')).map(l => {
                    const st = LEAD_STATUS[l.status] || { label: l.status, color: '#6b7280' }
                    const dur = l.visit_duration || 60
                    let endTime: string | null = null
                    if (l.visit_time) {
                      const [h, m] = l.visit_time.split(':').map(Number)
                      if (!isNaN(h) && !isNaN(m)) {
                        const total = h * 60 + m + dur
                        endTime = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
                      }
                    }
                    return (
                      <div key={l.id} style={{ display: 'flex', alignItems: 'stretch', gap: 0, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, marginBottom: 6, overflow: 'hidden' }}>
                        <div style={{ width: 64, flexShrink: 0, background: l.visit_time ? '#10b981' : 'rgba(16,185,129,0.18)', color: l.visit_time ? '#fff' : '#047857', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px', fontVariantNumeric: 'tabular-nums' }}>
                          {l.visit_time ? (
                            <>
                              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1, fontFamily: 'Manrope, sans-serif' }}>{l.visit_time}</div>
                              {endTime && <div style={{ fontSize: 9, fontWeight: 500, opacity: 0.85, marginTop: 3, lineHeight: 1 }}>– {endTime}</div>}
                              <div style={{ fontSize: 8, fontWeight: 600, opacity: 0.85, marginTop: 4, letterSpacing: '0.05em' }}>{dur} MIN</div>
                            </>
                          ) : (
                            <>
                              <Calendar size={16} />
                              <div style={{ fontSize: 8, fontWeight: 700, marginTop: 4, letterSpacing: '0.05em' }}>SIN HORA</div>
                            </>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#065f46' }}>{l.name}</div>
                            <div style={{ fontSize: 11, color: '#059669' }}>
                              {l.guests ? `${l.guests} inv.` : ''}
                              {l.guests && (l.budget && l.budget !== 'sin_definir') ? ' · ' : ''}
                              {l.budget && l.budget !== 'sin_definir' ? BUDGET_LABEL[l.budget] || l.budget : ''}
                              {l.wedding_date ? ` · Boda: ${new Date(l.wedding_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: st.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{st.label}</span>
                          {deleteVisitConfirmId === l.id ? (
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                              <button disabled={deletingVisit} onClick={async () => {
                                setDeletingVisit(true)
                                const { createClient } = await import('@/lib/supabase')
                                const sb = createClient()
                                const updates: any = { visit_date: null, visit_time: null, visit_duration: null }
                                if (l.status === 'visit_scheduled') updates.status = 'post_visit'
                                await sb.from('leads').update(updates).eq('id', l.id)
                                onUpdateLead(l.id, updates)
                                setDeleteVisitConfirmId(null)
                                setDeletingVisit(false)
                              }} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                {deletingVisit ? '...' : '¿Eliminar?'}
                              </button>
                              <button onClick={() => setDeleteVisitConfirmId(null)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 11, cursor: 'pointer' }}>
                                No
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                              <a href={`/leads?openVisit=${l.id}`} title="Editar visita" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, background: '#10b981', color: '#fff', textDecoration: 'none', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                <Edit2 size={11} /> Editar
                              </a>
                              <button onClick={() => setDeleteVisitConfirmId(l.id)} title="Eliminar visita" style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ══ ② PAREJAS ══ */}
              {(() => {
                const NEG_STATUSES  = ['contacted', 'post_visit']
                const PROP_STATUSES = ['proposal_sent', 'budget_sent']
                // won y visit_scheduled tienen su propia sección — no aparecen en las listas de leads
                const HIDDEN_STATUSES = ['visit_scheduled', 'won']

                // Exclude leads already shown in "Visitas programadas" to avoid duplication
                const visitIds = new Set(visitsOnDate.map(v => v.id))
                const leadsForSections = leadsOnDate.filter(l => !visitIds.has(l.id) && !HIDDEN_STATUSES.includes(l.status))

                const newLeads  = leadsForSections.filter(l => l.status === 'new')
                const extraLead = selectedLead && !leadsForSections.some(l => l.id === leadId) && !HIDDEN_STATUSES.includes(selectedLead.status) ? [selectedLead] : []
                const allNonNew = [...leadsForSections.filter(l => l.status !== 'new'), ...extraLead]
                const negLeads  = allNonNew.filter(l => NEG_STATUSES.includes(l.status))
                const propLeads = allNonNew.filter(l => PROP_STATUSES.includes(l.status))
                // cualquier estado no contemplado cae en negociación
                const otherLeads = allNonNew.filter(l => !NEG_STATUSES.includes(l.status) && !PROP_STATUSES.includes(l.status))
                const negAllBase = [...negLeads, ...otherLeads]
                // Apply local ordering if available (user reordered via arrows)
                const negAll = negOrderIds.length
                  ? [...negAllBase].sort((a, b) => {
                      const ai = negOrderIds.indexOf(a.id)
                      const bi = negOrderIds.indexOf(b.id)
                      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
                    })
                  : negAllBase

                if (newLeads.length === 0 && negAll.length === 0 && propLeads.length === 0) return null

                const SC = { new: '#3b82f6', neg: '#d97706', prop: '#059669' }

                const SectionLabel = ({ label, count, color }: { label: string; count: number; color: string }) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#9c8f88', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: color, background: color + '1a', borderRadius: 20, padding: '1px 7px' }}>{count}</span>
                    <div style={{ flex: 1, height: 1, background: '#ede8e3' }} />
                  </div>
                )

                const LeadRow = (l: Lead, sectionColor: string) => {
                  const st = LEAD_STATUS[l.status] || { label: l.status, color: '#6b7280' }
                  return (
                    <div key={l.id} style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '7px 10px 7px 11px',
                      background: 'white',
                      borderRadius: 8,
                      borderLeft: `3px solid ${sectionColor}`,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--espresso)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: st.color + '1a', color: st.color, fontWeight: 600 }}>{st.label}</span>
                          {l.guests ? <span style={{ fontSize: 10, color: '#9c8f88' }}>{l.guests} inv.</span> : null}
                          {l.budget && l.budget !== 'sin_definir' ? <span style={{ fontSize: 10, color: '#9c8f88' }}>{BUDGET_LABEL[l.budget] || l.budget}</span> : null}
                        </div>
                      </div>
                      {removeLeadConfirmId === l.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 500 }}>¿Quitar?</span>
                          <button onClick={() => handleRemoveLeadFromDate(l)} disabled={removingSaving}
                            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, cursor: 'pointer', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600 }}>
                            {removingSaving ? '...' : 'Sí'}
                          </button>
                          <button onClick={() => setRemoveLeadConfirmId(null)}
                            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--warm-gray)' }}>
                            No
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <a href={`/leads?open=${l.id}&returnDate=${date}`}
                            style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--charcoal)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <FileText size={10} /> Ver
                          </a>
                          {!isPast && l.status !== 'won' && (
                            <button onClick={() => setRemoveLeadConfirmId(l.id)}
                              style={{ fontSize: 10, padding: '3px 6px', borderRadius: 6, cursor: 'pointer', border: '1px solid #fca5a5', background: 'transparent', color: '#dc2626', display: 'flex', alignItems: 'center' }}>
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                }

                return (
                  <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>

                    {propLeads.length > 0 && (
                      <div>
                        <SectionLabel label="Propuesta enviada" count={propLeads.length} color={SC.prop} />
                        {propLeads.map(l => LeadRow(l, SC.prop))}
                      </div>
                    )}

                    {negAll.length > 0 && (() => {
                      const isReorderMode = negOrderIds.length > 0 && negAll.length > 1
                      return (
                        <div>
                          {/* Section header with optional pencil toggle */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: SC.neg, flexShrink: 0 }} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#9c8f88', textTransform: 'uppercase', letterSpacing: '0.08em' }}>En negociación</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: SC.neg, background: SC.neg + '1a', borderRadius: 20, padding: '1px 7px' }}>{negAll.length}</span>
                            {negAll.length > 1 && (
                              <button
                                onClick={() => setNegOrderIds(ids => ids.length ? [] : negAll.map(l => l.id))}
                                title={isReorderMode ? 'Salir del modo orden' : 'Cambiar orden de prioridad'}
                                style={{
                                  width: 20, height: 20, borderRadius: 5, border: `1px solid ${isReorderMode ? SC.neg : 'var(--ivory)'}`,
                                  background: isReorderMode ? SC.neg + '18' : '#fff',
                                  color: isReorderMode ? SC.neg : 'var(--warm-gray)',
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, marginLeft: 2,
                                }}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                            )}
                            <div style={{ flex: 1, height: 1, background: '#ede8e3' }} />
                          </div>
                          {negAll.map((l, idx) => (
                            <div key={l.id} style={{ display: 'flex', alignItems: 'stretch', gap: 4, marginBottom: 4 }}>
                              {/* Reorder arrows — only in reorder mode */}
                              {isReorderMode && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'center', flexShrink: 0 }}>
                                  <button
                                    disabled={idx === 0}
                                    onClick={() => { const ids = negAll.map(x => x.id); [ids[idx-1], ids[idx]] = [ids[idx], ids[idx-1]]; setNegOrderIds(ids) }}
                                    style={{ width: 18, height: 18, borderRadius: 4, border: '1px solid var(--ivory)', background: idx === 0 ? 'transparent' : '#fff', cursor: idx === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: idx === 0 ? '#d1d5db' : SC.neg, padding: 0, fontSize: 10 }}
                                  >▴</button>
                                  <button
                                    disabled={idx === negAll.length - 1}
                                    onClick={() => { const ids = negAll.map(x => x.id); [ids[idx], ids[idx+1]] = [ids[idx+1], ids[idx]]; setNegOrderIds(ids) }}
                                    style={{ width: 18, height: 18, borderRadius: 4, border: '1px solid var(--ivory)', background: idx === negAll.length-1 ? 'transparent' : '#fff', cursor: idx === negAll.length-1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: idx === negAll.length-1 ? '#d1d5db' : SC.neg, padding: 0, fontSize: 10 }}
                                  >▾</button>
                                </div>
                              )}
                              <div style={{ flex: 1 }}>{LeadRow(l, SC.neg)}</div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}

                    {newLeads.length > 0 && (
                      <div>
                        <SectionLabel label="Leads nuevos" count={newLeads.length} color={SC.new} />
                        {(showAllLeads ? newLeads : newLeads.slice(0, LEADS_PREVIEW)).map(l => LeadRow(l, SC.new))}
                        {newLeads.length > LEADS_PREVIEW && (
                          <button onClick={() => setShowAllLeads(v => !v)}
                            style={{ width: '100%', marginTop: 2, padding: '4px', borderRadius: 6, border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--warm-gray)', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                            {showAllLeads ? 'Ver menos ↑' : `+ Ver ${newLeads.length - LEADS_PREVIEW} más`}
                          </button>
                        )}
                      </div>
                    )}

                  </div>
                )
              })()}

              {/* ══ ③ DETALLES SEGÚN ESTADO ══ */}

              {/* RESERVADO: boda card */}
              {!isPast && status === 'reservado' && (
                <div style={{ marginBottom: 20, padding: '14px 16px', background: '#fdf2f8', border: '1px solid #fbcfe8', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#9d174d', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                    <Flower2 size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> Boda reservada
                  </div>
                  {selectedLead ? (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                        {[
                          { label: 'Pareja', value: selectedLead.name },
                          { label: 'Invitados', value: selectedLead.guests ? `${selectedLead.guests} personas` : '—' },
                          { label: 'Presupuesto', value: BUDGET_LABEL[selectedLead.budget || ''] || selectedLead.budget || '—' },
                          { label: 'Ceremonia', value: CEREMONY_LABEL[selectedLead.ceremony_type || ''] || selectedLead.ceremony_type || '—' },
                          { label: 'Teléfono', value: selectedLead.phone || selectedLead.whatsapp || '—' },
                          { label: 'Email', value: selectedLead.email || '—' },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div style={{ fontSize: 10, color: '#be185d', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: 12, color: '#831843', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
                          </div>
                        ))}
                      </div>
                      {!showCancelWedding ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <a href={`/leads?open=${selectedLead.id}&returnDate=${date}`} style={{ flex: 1, fontSize: 12, padding: '6px', borderRadius: 6, border: '1px solid #fbcfe8', color: '#be185d', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <User size={12} /> Ver lead
                          </a>
                          <a href="/proposals" style={{ flex: 1, fontSize: 12, padding: '6px', borderRadius: 6, border: '1px solid #fbcfe8', color: '#be185d', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <FileText size={12} /> Propuesta
                          </a>
                          <button onClick={() => setShowCancelWedding(true)}
                            style={{ flex: 1, fontSize: 12, color: '#dc2626', background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '6px', cursor: 'pointer' }}>
                            Cancelar boda
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 11, color: '#9d174d', marginBottom: 8, lineHeight: 1.5 }}>Esta acción liberará la fecha y moverá el lead a Perdidos.</div>
                          <textarea value={cancelWeddingReason} onChange={e => setCancelWeddingReason(e.target.value)}
                            placeholder="Motivo de la cancelación (opcional)..." className="form-input" rows={2}
                            style={{ fontSize: 12, marginBottom: 8, resize: 'none', width: '100%', boxSizing: 'border-box' }} />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => { setShowCancelWedding(false); setCancelWeddingReason('') }}
                              style={{ flex: 1, fontSize: 12, background: 'none', border: '1px solid var(--ivory)', borderRadius: 8, padding: '7px 0', cursor: 'pointer', color: 'var(--warm-gray)' }}>
                              Volver
                            </button>
                            <button disabled={cancelWeddingSaving}
                              onClick={async () => { setCancelWeddingSaving(true); await onCancelWedding(selectedLead, cancelWeddingReason); setCancelWeddingSaving(false); onClose() }}
                              style={{ flex: 2, fontSize: 12, color: '#fff', background: '#dc2626', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 600 }}>
                              {cancelWeddingSaving ? 'Cancelando...' : 'Confirmar cancelación'}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    /* No lead linked: show lead search */
                    <div>
                      <div style={{ fontSize: 12, color: '#be185d', marginBottom: 10 }}>Vincula la pareja que reservó esta boda.</div>
                      {!showQuickLink ? (
                        <button onClick={() => setShowQuickLink(true)} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: '1px solid #fbcfe8', color: '#be185d', background: 'transparent', cursor: 'pointer', fontWeight: 500 }}>🔗 Vincular lead</button>
                      ) : (
                        <div>
                          <div style={{ position: 'relative', marginBottom: 8 }}>
                            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                            <input className="form-input" style={{ paddingLeft: 32 }} value={search}
                              onChange={e => setSearch(e.target.value)} placeholder="Buscar lead por nombre o email..." autoFocus />
                          </div>
                          {search && (
                            <div style={{ border: '1px solid var(--ivory)', borderRadius: 8, overflow: 'hidden' }}>
                              {filteredLeads.length === 0 ? (
                                <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--warm-gray)' }}>Sin resultados</div>
                              ) : filteredLeads.map(l => (
                                <div key={l.id} onClick={() => { setLeadId(l.id); setSearch(''); setShowQuickLink(false) }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--ivory)', background: '#fff' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                                  <User size={13} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 500 }}>{l.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{l.guests ? `${l.guests} inv.` : ''}</div>
                                  </div>
                                  <span style={{ fontSize: 11, color: (LEAD_STATUS[l.status] || {}).color || '#6b7280', fontWeight: 500 }}>{(LEAD_STATUS[l.status] || { label: l.status }).label}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ══ BLOQUEAR FECHA — compact pills ══ */}
              {!isPast && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>Bloquear:</span>
                    {([
                      { noteVal: '' as const,                 label: 'Día completo' },
                      { noteVal: 'medio_dia_manana' as const, label: '½ Mañana'     },
                      { noteVal: 'medio_dia_tarde'  as const, label: '½ Tarde'      },
                    ]).map(opt => {
                      const isActive = status === 'bloqueado' && halfDay === opt.noteVal
                      return (
                        <button key={opt.noteVal || 'full'} onClick={() => {
                          if (isActive) { setStatus('libre'); setHalfDay('') }
                          else          { setStatus('bloqueado'); setHalfDay(opt.noteVal) }
                        }} style={{
                          padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12,
                          border: `1.5px solid ${isActive ? '#6b7280' : 'var(--ivory)'}`,
                          background: isActive ? '#6b7280' : 'transparent',
                          color: isActive ? '#fff' : 'var(--warm-gray)',
                          fontWeight: isActive ? 600 : 400, transition: 'all 0.12s',
                        }}>
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                  {status === 'bloqueado' && (
                    <div style={{ marginTop: 10 }}>
                      <textarea className="form-textarea" style={{ minHeight: 60 }} value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder={isMedioDia ? 'Nota interna (opcional)...' : 'Motivo del bloqueo (opcional)...'} />
                    </div>
                  )}
                </div>
              )}

              {/* NEGOCIACIÓN: pareja vinculada + detalles */}
              {!isPast && status === 'negociacion' && (
                <div style={{ marginBottom: 20 }}>
                  {selectedLead ? (
                    <>

                      {/* Modality picker — only shown when modalities with matching packages exist */}
                      {modalityOptions.length > 0 && (
                        <div style={{ padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#15803d', marginBottom: 8 }}>Modalidad</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {[{ modality: { id: '', name: 'Sin modalidad (1 día)' }, pkgLabel: '', span: 1, endDate: date } as any,
                              ...modalityOptions].map(opt => (
                              <button key={opt.modality.id} type="button"
                                onClick={() => setSelectedModalityId(opt.modality.id)}
                                style={{
                                  padding: '7px 10px', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                                  border: `2px solid ${selectedModalityId === opt.modality.id ? '#16a34a' : 'var(--ivory)'}`,
                                  background: selectedModalityId === opt.modality.id ? '#f0fdf4' : '#fff',
                                  fontSize: 12, fontWeight: 500,
                                  color: selectedModalityId === opt.modality.id ? '#15803d' : 'var(--charcoal)',
                                }}>
                                {opt.modality.name}
                                {opt.span > 1 && (
                                  <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--warm-gray)', fontWeight: 400 }}>
                                    · {opt.pkgLabel} ({opt.span} días, hasta {opt.endDate})
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Nota */}
                      <div>
                        <label className="form-label">Nota interna (opcional)</label>
                        <textarea className="form-textarea" style={{ minHeight: 60 }} value={note}
                          onChange={e => setNote(e.target.value)}
                          placeholder="Ej: Esperando confirmación, visita el lunes..." />
                      </div>
                    </>
                  ) : (
                    /* No lead linked */
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                        Pareja en negociación
                      </div>
                      {!showQuickLink ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: 'var(--cream)', border: '1px solid var(--ivory)', borderRadius: 8, marginBottom: 12 }}>
                          <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Sin pareja vinculada</span>
                          <button onClick={() => setShowQuickLink(true)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontWeight: 600 }}>
                            🔗 Vincular lead
                          </button>
                        </div>
                      ) : (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--charcoal)' }}>Buscar lead existente</span>
                            <button onClick={() => { setShowQuickLink(false); setSearch('') }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 2 }}><X size={13} /></button>
                          </div>
                          <div style={{ position: 'relative', marginBottom: 8 }}>
                            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                            <input className="form-input" style={{ paddingLeft: 32 }} value={search}
                              onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o email..." autoFocus />
                          </div>
                          {search && (
                            <div style={{ border: '1px solid var(--ivory)', borderRadius: 8, overflow: 'hidden' }}>
                              {filteredLeads.length === 0 ? (
                                <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--warm-gray)' }}>Sin resultados</div>
                              ) : filteredLeads.map(l => (
                                <div key={l.id} onClick={() => { setLeadId(l.id); setSearch(''); setShowQuickLink(false) }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--ivory)', background: '#fff' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                                  <User size={13} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 500 }}>{l.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                                      {l.wedding_date ? new Date(l.wedding_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha'}
                                      {l.guests ? ` · ${l.guests} inv.` : ''}
                                    </div>
                                  </div>
                                  <span style={{ fontSize: 11, color: (LEAD_STATUS[l.status] || {}).color || '#6b7280', fontWeight: 500 }}>{(LEAD_STATUS[l.status] || { label: l.status }).label}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Note when no lead */}
                      <div>
                        <label className="form-label">Nota interna (opcional)</label>
                        <textarea className="form-textarea" style={{ minHeight: 60 }} value={note}
                          onChange={e => setNote(e.target.value)}
                          placeholder="Ej: Pareja por confirmar, esperando señal..." />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* LIBRE: nota */}
              {!isPast && status === 'libre' && (
                <div style={{ marginBottom: 20 }}>
                  <label className="form-label">Nota interna (opcional)</label>
                  <textarea className="form-textarea" style={{ minHeight: 60 }} value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Ej: Festivo, pendiente de confirmar..." />
                </div>
              )}

              {/* Past date message */}
              {isPast && !entry && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px', background: 'var(--cream)', borderRadius: 8, fontSize: 12, color: 'var(--warm-gray)' }}>
                  <AlertCircle size={14} /> Esta fecha ya ha pasado.
                </div>
              )}

              {/* Affected leads overlay — rendered via portal below */}

            </>
          )}
        </div>

        {/* ── Overlay: leads afectados por fecha reservada/bloqueada ── */}
        {showAffected && affectedLeads.length > 0 && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => setShowAffected(false)}>
            <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', maxHeight: '80vh', overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #fde68a', background: '#fffbeb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <AlertCircle size={15} style={{ color: '#d97706', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>
                    {affectedLeads.length === 1 ? '1 lead pendiente de gestionar' : `${affectedLeads.length} leads pendientes de gestionar`}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: '#78350f', margin: 0, lineHeight: 1.4 }}>
                  Esta fecha está {entry?.status === 'reservado' ? 'reservada' : 'bloqueada'}. Los siguientes leads tienen esta fecha en su propuesta.
                </p>
              </div>

              {/* Lead list */}
              <div style={{ overflowY: 'auto', padding: '14px 20px', flex: 1 }}>
                {affectedLeads.map(l => {
                  const st = LEAD_STATUS[l.status] || { label: l.status, color: '#6b7280' }
                  const otherDates = getOtherDatesLabel(l)
                  const isSav = affectedSaving[l.id]
                  return (
                    <div key={l.id} style={{ border: '1px solid var(--ivory)', borderRadius: 10, padding: '12px 14px', marginBottom: 10, background: 'var(--cream)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <User size={13} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                        <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: st.color + '1a', color: st.color, fontWeight: 600, flexShrink: 0 }}>{st.label}</span>
                      </div>
                      {otherDates ? (
                        <div style={{ fontSize: 11, color: '#059669', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                          ✓ Tiene otras fechas propuestas: <strong>{otherDates}</strong>
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: '#d97706', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                          ⚠ Esta es su única fecha propuesta
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <a href={`/leads?changeDates=${l.id}&returnDate=${date}`}
                          style={{ flex: 1, textAlign: 'center', fontSize: 11, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--ivory)', color: 'var(--charcoal)', textDecoration: 'none', fontWeight: 500, fontFamily: 'Manrope, sans-serif' }}>
                          + Añadir otra fecha
                        </a>
                        <button onClick={() => handleRemoveFromDate(l)} disabled={isSav}
                          style={{ flex: 1, fontSize: 11, padding: '6px 8px', borderRadius: 7, border: '1px solid #fca5a5', color: '#dc2626', background: 'transparent', cursor: 'pointer', fontWeight: 500, fontFamily: 'Manrope, sans-serif' }}>
                          {isSav ? '...' : '✗ Quitar de esta fecha'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Footer */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--ivory)', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAffected(false)}
                  style={{ fontSize: 12, padding: '7px 16px', borderRadius: 8, border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
                  Gestionar más tarde
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete from CRM popup */}
        {removedLeadForCrm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 14, maxWidth: 380, width: '100%', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <User size={18} style={{ color: '#ef4444' }} />
                </div>
                <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 600, color: 'var(--espresso)' }}>Lead sin fechas asignadas</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--charcoal)', lineHeight: 1.6, marginBottom: 20 }}>
                <strong>{removedLeadForCrm.name}</strong> ya no tiene ninguna fecha de boda asignada en el calendario. ¿Qué quieres hacer?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={async () => {
                    const supabase = createClient()
                    await supabase.from('leads').update({ status: 'lost' }).eq('id', removedLeadForCrm.id)
                    await onUpdateLead(removedLeadForCrm.id, { status: 'lost' })
                    setRemovedLeadForCrm(null)
                  }}
                  style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Mover a Perdidos
                </button>
                <button onClick={() => setRemovedLeadForCrm(null)}
                  style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--charcoal)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  Mantener en CRM
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Footer */}
        {!isPast && !showCreate && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              {entry && (
                <button onClick={handleDelete} disabled={isSaving}
                  style={{ fontSize: 12, color: '#dc2626', background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>
                  Eliminar entrada
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── (DateRulesModal removed — prep/teardown chosen per booking in leads) ──────

// ── Quick Create Lead ──────────────────────────────────────────────────────────

function QuickCreateLead({
  defaultDate, userId, onCreated, onCancel
}: {
  defaultDate: string
  userId: string
  onCreated: (lead: Lead) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', guests: '', wedding_date: defaultDate, ceremony_type: 'sin_definir', budget: 'sin_definir'
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')
    const supabase = createClient()
    const { data, error: err } = await supabase.from('leads').insert({
      user_id: userId,
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      guests: form.guests ? parseInt(form.guests) : null,
      wedding_date: form.wedding_date || null,
      ceremony_type: form.ceremony_type,
      budget: form.budget,
      status: 'contacted',
      date_flexibility: 'exact',
      source: 'manual',
    }).select().single()
    if (err) { setError('Error al crear el lead'); setSaving(false); return }
    await onCreated(data as Lead)
    setSaving(false)
  }

  return (
    <div style={{ marginBottom: 20, padding: '16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Nuevo lead
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a' }}><X size={14} /></button>
      </div>
      {error && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>{error}</div>}
      <div className="form-group" style={{ marginBottom: 10 }}>
        <label className="form-label" style={{ fontSize: 11 }}>Nombre de la pareja *</label>
        <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Laura & Carlos" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: 11 }}>Email</label>
          <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@..." />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: 11 }}>Teléfono</label>
          <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+34..." />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: 11 }}>Nº invitados</label>
          <input className="form-input" type="number" value={form.guests} onChange={e => set('guests', e.target.value)} placeholder="150" />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: 11 }}>Fecha de boda</label>
          <DatePicker value={form.wedding_date} onChange={(v) => set('wedding_date', v)} placeholder="Fecha de boda" />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={saving}>
          {saving ? 'Creando...' : <><Plus size={12} /> Crear lead</>}
        </button>
      </div>
    </div>
  )
}

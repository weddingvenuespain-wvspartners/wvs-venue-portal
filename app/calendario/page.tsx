'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import {
  ChevronLeft, ChevronRight, X, Plus, User, ExternalLink,
  FileText, Calendar, Search, AlertCircle, Settings, Info, Trash2, RotateCcw
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
  notes?: string
}

type DateRulePackage = {
  name: string
  anchor_dow: number   // 0=Dom 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb
  span_days: number    // días que ocupa el paquete (ej. 3 para Vie-Dom)
  days_before: number  // días de preparación previos
  days_after: number   // días de desmontaje posteriores
}

type DateRule = {
  type: 'simple' | 'overnight' | 'packages'
  days_before: number
  days_after: number
  packages?: DateRulePackage[]
}

const DEFAULT_RULES: DateRule = { type: 'simple', days_before: 0, days_after: 0, packages: [] }

const DOW_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// ── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<Status, { label: string; bg: string; border: string; color: string; dot: string; badge: string }> = {
  libre:       { label: 'Libre',          bg: '#fff',     border: '#e8ddd3', color: 'var(--charcoal)', dot: '#c5b9aa', badge: '#f5f0eb' },
  negociacion: { label: 'En negociación', bg: '#fef7ec',  border: '#f5deb3', color: '#8a6d2b',         dot: '#d4a24c', badge: '#fef7ec' },
  reservado:   { label: 'Reservado',      bg: '#eef6f0',  border: '#c3dfc9', color: '#3d6b4a',         dot: '#5a9e6b', badge: '#eef6f0' },
  bloqueado:   { label: 'Bloqueado',      bg: '#f0eeec',  border: '#d6d2ce', color: '#8b8580',         dot: '#a8a3a0', badge: '#f0eeec' },
}

const LEAD_STATUS: Record<string, { label: string; color: string }> = {
  new:            { label: 'Nuevo',            color: '#3b82f6' },
  contacted:      { label: 'Contactado',       color: '#8b5cf6' },
  proposal_sent:  { label: 'Propuesta enviada', color: '#f59e0b' },
  visit_scheduled:{ label: 'Visita agendada',  color: '#10b981' },
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

// Returns dates that should be auto-blocked (as 'bloqueado') when marking `date` as 'reservado'
function computeAffectedDates(date: string, rules: DateRule): { date: string; reason: string }[] {
  const result: { date: string; reason: string }[] = []
  const addDay = (offset: number, reason: string) => {
    const ds = offsetDate(date, offset)
    if (!result.find(r => r.date === ds)) result.push({ date: ds, reason })
  }

  if (rules.type === 'simple') {
    for (let i = 1; i <= rules.days_before; i++) addDay(-i, `Preparación (${i}d antes)`)
    for (let i = 1; i <= rules.days_after; i++) addDay(i, `Desmontaje (${i}d después)`)
  } else if (rules.type === 'overnight') {
    addDay(1, 'Check-out')
    for (let i = 1; i <= rules.days_before; i++) addDay(-i, `Preparación (${i}d antes)`)
    for (let i = 2; i <= rules.days_after + 1; i++) addDay(i, `Desmontaje (${i-1}d después del check-out)`)
  } else if (rules.type === 'packages') {
    const dow = new Date(date + 'T12:00:00').getDay()
    const pkg = rules.packages?.find(p => p.anchor_dow === dow)
    if (pkg) {
      for (let i = 1; i < pkg.span_days; i++) addDay(i, `${pkg.name} (día ${i+1})`)
      for (let i = 1; i <= pkg.days_before; i++) addDay(-i, `Preparación (${i}d antes)`)
      for (let i = pkg.span_days; i < pkg.span_days + pkg.days_after; i++) addDay(i, `Desmontaje`)
    }
  }
  return result
}

function formatDateEs(ds: string): string {
  const d = new Date(ds + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CalendarioPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [entries,      setEntries]      = useState<Record<string, Entry>>({})
  const [leads,        setLeads]        = useState<Lead[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [dateRules,    setDateRules]    = useState<DateRule>(DEFAULT_RULES)
  const [showSettings, setShowSettings] = useState(false)

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

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    load()
  }, [user, authLoading, year, month])

  const load = async () => {
    setLoading(true)
    const supabase = createClient()
    const lastDay  = new Date(year, month + 1, 0).getDate()
    const from     = dateStr(year, month, 1)
    const to       = dateStr(year, month, lastDay)

    const [entriesRes, leadsRes, settingsRes] = await Promise.all([
      supabase.from('calendar_entries').select('*').eq('user_id', user!.id).gte('date', from).lte('date', to),
      supabase.from('leads').select('id,name,email,phone,whatsapp,wedding_date,wedding_date_to,wedding_date_ranges,date_flexibility,wedding_year,wedding_month,guests,status,budget,ceremony_type,visit_date,notes').eq('user_id', user!.id).order('wedding_date', { ascending: true }),
      supabase.from('venue_settings').select('date_rules').eq('user_id', user!.id).maybeSingle(),
    ])

    const map: Record<string, Entry> = {}
    if (entriesRes.data) entriesRes.data.forEach((e: Entry) => { map[e.date] = e })
    setEntries(map)
    if (leadsRes.data) setLeads(leadsRes.data)
    if (settingsRes.data?.date_rules) setDateRules(settingsRes.data.date_rules)
    setLoading(false)
  }

  const saveDateRules = async (rules: DateRule) => {
    const supabase = createClient()
    await supabase.from('venue_settings').upsert({ user_id: user!.id, date_rules: rules }, { onConflict: 'user_id' })
    setDateRules(rules)
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
    const add = (date: string, lead: Lead) => { if (!m[date]) m[date] = []; m[date].push(lead) }
    leads.forEach(l => {
      const flex = l.date_flexibility || 'exact'
      if (flex === 'exact' && l.wedding_date) {
        add(l.wedding_date, l)
      } else if (flex === 'range' && l.wedding_date) {
        expandRange(l.wedding_date, l.wedding_date_to || l.wedding_date).forEach(d => add(d, l))
      } else if (flex === 'multi_range' && l.wedding_date_ranges?.length) {
        l.wedding_date_ranges.forEach(r => {
          if (r.from) expandRange(r.from, r.to || r.from).forEach(d => add(d, l))
        })
      } else if (flex === 'month' && l.wedding_year && l.wedding_month) {
        // Mark entire month
        const y = l.wedding_year, mo = l.wedding_month
        const days = new Date(y, mo, 0).getDate()
        for (let d = 1; d <= days; d++) {
          add(`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`, l)
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

  const saveEntry = async (entry: Partial<Entry> & { date: string }, extraBlocks?: string[]) => {
    setSaving(true)
    const supabase = createClient()

    const upsertOne = async (e: Partial<Entry> & { date: string }) => {
      if (!e.status || e.status === 'libre') {
        const existing = entries[e.date]
        if (existing?.id) await supabase.from('calendar_entries').delete().eq('id', existing.id)
        setEntries(prev => { const n = { ...prev }; delete n[e.date]; return n })
      } else {
        const existing = entries[e.date]
        let result
        if (existing?.id) {
          const { data } = await supabase.from('calendar_entries')
            .update({ status: e.status, note: e.note ?? null, lead_id: e.lead_id ?? null })
            .eq('id', existing.id).select().single()
          result = data
        } else {
          const { data } = await supabase.from('calendar_entries')
            .insert({ user_id: user!.id, date: e.date, status: e.status, note: e.note ?? null, lead_id: e.lead_id ?? null })
            .select().single()
          result = data
        }
        if (result) setEntries(prev => ({ ...prev, [e.date]: result }))
      }
    }

    await upsertOne(entry)
    if (extraBlocks && extraBlocks.length > 0) {
      for (const d of extraBlocks) {
        await upsertOne({ date: d, status: 'bloqueado', note: 'Auto-bloqueado por reglas de venue' })
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
    setSaving(false)
  }

  const handleDayClick = (d: string, isPast: boolean) => {
    if (bulkMode) {
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

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Calendario</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {bulkMode ? (
              <>
                <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>
                  {bulkStart ? 'Haz click en otra fecha para seleccionar el rango' : `${bulkDates.size} fechas seleccionadas`}
                </span>
                <select className="form-input" style={{ padding: '5px 8px', fontSize: 12, width: 'auto' }}
                  value={bulkStatus} onChange={e => setBulkStatus(e.target.value as Status)}>
                  <option value="negociacion">En negociación</option>
                  <option value="reservado">Reservado</option>
                  <option value="bloqueado">Bloqueado</option>
                  <option value="libre">Libre (desbloquear)</option>
                </select>
                <button className="btn btn-primary btn-sm" onClick={applyBulk} disabled={saving || bulkDates.size === 0}>
                  {saving ? 'Guardando...' : 'Aplicar al rango'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setBulkMode(false); setBulkDates(new Set()); setBulkStart(null) }}>
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => setBulkMode(true)}>
                  <Calendar size={13} /> Seleccionar rango
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(true)} title="Reglas de fechas">
                  <Settings size={13} /> Reglas
                </button>
              </>
            )}
          </div>
        </div>

        <div className="page-content">
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { value: lastDay - countByStatus('negociacion') - countByStatus('reservado') - countByStatus('bloqueado'), label: 'Fechas libres', color: 'var(--espresso)' },
              { value: countByStatus('negociacion'), label: 'En negociación', color: 'var(--gold)' },
              { value: countByStatus('reservado'), label: 'Reservados', color: '#5c4033' },
              { value: null, label: isHighSeason ? 'Alta temporada' : 'Temporada baja', color: 'var(--warm-gray)', text: isHighSeason ? 'May – Oct' : 'Nov – Abr' },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid var(--ivory)', borderRadius: 12, padding: '20px 22px' }}>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 36, fontWeight: 500, color: s.color, lineHeight: 1, marginBottom: 8 }}>
                  {s.value !== null ? String(s.value).padStart(2, '0') : s.text}
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
                  <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, color: 'var(--espresso)', fontWeight: 400 }}>
                    {MONTHS[month]} {year}
                  </span>
                  <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()) }}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
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
                      const status    = entry?.status as Status | undefined
                      const cfg       = STATUS_CFG[status || 'libre']
                      const isToday   = ds === todayIso
                      const isPast    = ds < todayIso
                      const isBulkSel = bulkDates.has(ds)
                      const isBulkStart = bulkStart === ds
                      const dayLeads  = leadsByDate[ds] || []
                      const linkedLead = entry?.lead_id ? leadsById[entry.lead_id] : null

                      const displayName = linkedLead?.name || (dayLeads.length === 1 ? dayLeads[0].name : null)
                      const hasUnlinkedLeads = dayLeads.length > 0 && !linkedLead

                      const cellBg = isBulkSel ? '#fef3c7' : isPast ? '#faf8f5' : status && status !== 'libre' ? cfg.bg : '#fff'
                      const colIndex = (startDow + day - 1 + startDow === 0 ? 0 : i) % 7

                      return (
                        <button
                          key={ds}
                          onClick={() => handleDayClick(ds, isPast && !bulkMode)}
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
                            fontFamily: 'DM Sans, sans-serif',
                          }}>
                            {day}
                          </span>

                          {/* Lead name */}
                          {displayName && !isPast && (
                            <span style={{
                              fontSize: 9, lineHeight: 1.3, color: cfg.color,
                              fontWeight: 600, maxWidth: '100%', overflow: 'hidden',
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                              textAlign: 'left', wordBreak: 'break-word', marginTop: 2,
                            }}>
                              {displayName}
                            </span>
                          )}

                          {/* Bottom: status label or indicators */}
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', width: '100%', marginTop: 'auto' }}>
                            {status && status !== 'libre' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: cfg.color, whiteSpace: 'nowrap' }}>
                                  {status === 'negociacion' ? 'Negociación' : cfg.label}
                                </span>
                              </div>
                            )}
                            {!status || status === 'libre' ? (
                              <>
                                {hasUnlinkedLeads && (
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} title={`${dayLeads.length} lead(s)`} />
                                )}
                                {entry?.note && (
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--stone)', flexShrink: 0 }} />
                                )}
                              </>
                            ) : null}
                            {dayLeads.length > 1 && (
                              <span style={{ fontSize: 8, color: 'var(--warm-gray)', fontWeight: 700, marginLeft: 2 }}>+{dayLeads.length}</span>
                            )}
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
                            {e.leadName || e.note || cfg.label}
                          </div>
                          <span style={{ fontSize: 10, background: cfg.badge, color: cfg.color, padding: '1px 6px', borderRadius: 10, fontWeight: 500 }}>
                            {cfg.label}
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
                    const dt  = l.wedding_date ? new Date(l.wedding_date + 'T12:00:00') : null
                    return (
                      <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: '1px solid var(--ivory)' }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <User size={13} style={{ color: 'var(--warm-gray)' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>
                            {dateLabel}{l.guests ? ` · ${l.guests} inv.` : ''}
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
          leadsOnDate={leadsByDate[modalDate] || []}
          allLeads={leads}
          leadsById={leadsById}
          saving={saving}
          dateRules={dateRules}
          onSave={async (updated, extraBlocks) => { await saveEntry(updated, extraBlocks); setModalDate(null); await load() }}
          onDelete={async () => { await saveEntry({ date: modalDate, status: 'libre' }); setModalDate(null) }}
          onClose={() => setModalDate(null)}
          onLeadCreated={async (lead) => { setLeads(prev => [lead, ...prev]) }}
          onUpdateLead={async (leadId, fields) => {
            const supabase = createClient()
            await supabase.from('leads').update(fields).eq('id', leadId)
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...fields } : l))
          }}
          userId={user!.id}
        />
      )}

      {showSettings && (
        <DateRulesModal
          rules={dateRules}
          onSave={async (rules) => { await saveDateRules(rules); setShowSettings(false) }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

// ── Day Modal ─────────────────────────────────────────────────────────────────

function DayModal({
  date, entry, leadsOnDate, allLeads, leadsById, saving, dateRules,
  onSave, onDelete, onClose, onLeadCreated, onUpdateLead, userId
}: {
  date: string
  entry: Entry | null
  leadsOnDate: Lead[]
  allLeads: Lead[]
  leadsById: Record<string, Lead>
  saving: boolean
  dateRules: DateRule
  onSave: (e: Entry, extraBlocks?: string[]) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
  onLeadCreated: (l: Lead) => Promise<void>
  onUpdateLead: (leadId: string, fields: Partial<Lead>) => Promise<void>
  userId: string
}) {
  const [status,      setStatus]      = useState<Status>(entry?.status || 'libre')
  const [note,        setNote]        = useState(entry?.note || '')
  const [leadId,      setLeadId]      = useState<string | null>(entry?.lead_id || null)
  const [search,      setSearch]      = useState('')
  const [showCreate,  setShowCreate]  = useState(false)
  const [localSaving, setLocalSaving] = useState(false)

  // Post-save: leads afectados por fecha bloqueada/reservada
  const [affectedLeads, setAffectedLeads] = useState<Lead[]>([])
  const [showAffected,  setShowAffected]  = useState(false)
  const [newDateFor,    setNewDateFor]    = useState<Record<string, string>>({})
  const [affectedSaving, setAffectedSaving] = useState<Record<string, boolean>>({})

  // Lead pipeline status + visit date editing
  const [leadPipelineStatus, setLeadPipelineStatus] = useState<string>('')
  const [visitDate,          setVisitDate]          = useState<string>('')
  // Scope: apply calendar entry status to just this date or all linked dates
  const [scope, setScope] = useState<'this' | 'all'>('this')
  // All calendar entries linked to this lead
  const [leadEntries,        setLeadEntries]        = useState<Entry[]>([])
  const [loadingLeadEntries, setLoadingLeadEntries] = useState(false)
  // Dates to unlink the lead from
  const [datesToUnlink, setDatesToUnlink] = useState<Set<string>>(new Set())
  // Inline lead editing (in "Leads con esta fecha" list)
  const [expandedLeadId,  setExpandedLeadId]  = useState<string | null>(null)
  const [inlineEditForm,  setInlineEditForm]  = useState({ name: '', email: '', phone: '', guests: '', status: '' })
  const [inlineEditSaving, setInlineEditSaving] = useState(false)

  const dt = new Date(date + 'T12:00:00')
  const isPast = date < new Date().toISOString().split('T')[0]
  const selectedLead = leadId ? leadsById[leadId] : null

  // Sync pipeline status + visit date when lead changes
  useEffect(() => {
    setLeadPipelineStatus(selectedLead?.status || '')
    setVisitDate(selectedLead?.visit_date || '')
    setScope('this')
    setDatesToUnlink(new Set())
  }, [leadId])

  // Fetch all calendar entries linked to this lead
  useEffect(() => {
    if (!leadId) { setLeadEntries([]); return }
    setLoadingLeadEntries(true)
    const supabase = createClient()
    supabase.from('calendar_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('lead_id', leadId)
      .order('date', { ascending: true })
      .then(({ data }) => {
        setLeadEntries(data || [])
        setLoadingLeadEntries(false)
      })
  }, [leadId])

  const filteredLeads = allLeads.filter(l =>
    !search || l.name.toLowerCase().includes(search.toLowerCase()) || (l.email || '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8)

  // Compute which extra dates will be blocked when status = reservado
  const affected = status === 'reservado' ? computeAffectedDates(date, dateRules) : []

  const handleSave = async () => {
    setLocalSaving(true)
    const supabase = createClient()

    // Update lead fields if changed (status, visit_date)
    if (selectedLead) {
      const fields: Partial<Lead> = {}
      if (leadPipelineStatus && leadPipelineStatus !== selectedLead.status) fields.status = leadPipelineStatus
      if (visitDate !== (selectedLead.visit_date || '')) fields.visit_date = visitDate || undefined
      if (Object.keys(fields).length > 0) await onUpdateLead(selectedLead.id, fields)
    }

    // Unlink lead from selected dates
    if (datesToUnlink.size > 0) {
      for (const d of datesToUnlink) {
        const entryToUpdate = leadEntries.find(e => e.date === d)
        if (entryToUpdate?.id) {
          await supabase.from('calendar_entries').update({ lead_id: null }).eq('id', entryToUpdate.id)
        }
      }
    }

    // Apply calendar status to all linked dates if scope === 'all'
    if (scope === 'all' && leadId && leadEntries.length > 0) {
      for (const e of leadEntries) {
        if (e.date !== date && e.id && !datesToUnlink.has(e.date)) {
          await supabase.from('calendar_entries').update({ status }).eq('id', e.id)
        }
      }
    }

    const extraBlocks = affected.map(a => a.date)
    await onSave({ date, status, note: note.trim() || undefined, lead_id: leadId }, extraBlocks.length > 0 ? extraBlocks : undefined)

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

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, color: 'var(--espresso)', textTransform: 'capitalize' }}>
              {dt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            {isPast && <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 3 }}>Fecha pasada · solo lectura</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Leads on this date */}
          {leadsOnDate.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Leads con esta fecha de boda
              </div>
              {leadsOnDate.map(l => {
                const st = LEAD_STATUS[l.status] || { label: l.status, color: '#6b7280' }
                const isLinked = leadId === l.id
                const isExpanded = expandedLeadId === l.id
                return (
                  <div key={l.id} style={{ marginBottom: 6 }}>
                    {/* Lead row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      background: isLinked ? '#f0fdf4' : 'var(--cream)',
                      border: `1px solid ${isLinked ? '#86efac' : 'var(--ivory)'}`,
                      borderRadius: isExpanded ? '8px 8px 0 0' : 8 }}>
                      <User size={14} style={{ color: isLinked ? '#16a34a' : 'var(--warm-gray)', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{l.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                          {l.guests ? `${l.guests} inv.` : ''}
                          {l.guests && l.budget && l.budget !== 'sin_definir' ? ' · ' : ''}
                          {l.budget && l.budget !== 'sin_definir' ? BUDGET_LABEL[l.budget] || l.budget : ''}
                          {l.visit_date ? ` · Visita: ${new Date(l.visit_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: st.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{st.label}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {/* Vincular — visible para todos los leads; reemplaza el vinculado actual */}
                        {!isPast && (
                          <button
                            onClick={() => { setLeadId(isLinked ? null : l.id); setExpandedLeadId(null) }}
                            title={!isLinked && leadId ? 'Sustituirá al lead vinculado actual' : ''}
                            style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', border: '1px solid', fontWeight: 500,
                              borderColor: isLinked ? '#86efac' : leadId ? '#fde68a' : 'var(--ivory)',
                              background: isLinked ? '#dcfce7' : leadId ? '#fffbeb' : 'transparent',
                              color: isLinked ? '#16a34a' : leadId ? '#92400e' : 'var(--charcoal)' }}>
                            {isLinked ? '✓ Vinculado' : leadId ? '⇄ Cambiar' : 'Vincular'}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (isExpanded) { setExpandedLeadId(null); return }
                            setExpandedLeadId(l.id)
                            setInlineEditForm({ name: l.name, email: l.email || '', phone: l.phone || '', guests: l.guests ? String(l.guests) : '', status: l.status })
                          }}
                          title="Editar lead"
                          style={{ fontSize: 10, padding: '3px 7px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--ivory)', background: isExpanded ? 'var(--ivory)' : 'transparent', color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <FileText size={10} /> Editar
                        </button>
                      </div>
                    </div>

                    {/* Inline edit panel */}
                    {isExpanded && (
                      <div style={{ padding: '14px 14px', background: '#fafafa', border: '1px solid var(--ivory)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Nombre</div>
                            <input className="form-input" style={{ fontSize: 12 }} value={inlineEditForm.name}
                              onChange={e => setInlineEditForm(f => ({ ...f, name: e.target.value }))} />
                          </div>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Invitados</div>
                            <input className="form-input" style={{ fontSize: 12 }} type="number" value={inlineEditForm.guests}
                              onChange={e => setInlineEditForm(f => ({ ...f, guests: e.target.value }))} placeholder="Nº" />
                          </div>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Teléfono</div>
                            <input className="form-input" style={{ fontSize: 12 }} value={inlineEditForm.phone}
                              onChange={e => setInlineEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="+34 600 000 000" />
                          </div>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Email</div>
                            <input className="form-input" style={{ fontSize: 12 }} type="email" value={inlineEditForm.email}
                              onChange={e => setInlineEditForm(f => ({ ...f, email: e.target.value }))} />
                          </div>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Estado del lead</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {Object.entries(LEAD_STATUS).map(([s, cfg]) => (
                              <button key={s} onClick={() => setInlineEditForm(f => ({ ...f, status: s }))} style={{
                                fontSize: 11, padding: '3px 9px', borderRadius: 20, cursor: 'pointer',
                                border: `1px solid ${inlineEditForm.status === s ? cfg.color : 'var(--ivory)'}`,
                                background: inlineEditForm.status === s ? `${cfg.color}18` : 'transparent',
                                color: inlineEditForm.status === s ? cfg.color : 'var(--warm-gray)',
                                fontWeight: inlineEditForm.status === s ? 600 : 400,
                              }}>
                                {cfg.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 12px' }}
                            onClick={() => setExpandedLeadId(null)}>Cancelar</button>
                          <button className="btn btn-primary" style={{ fontSize: 11, padding: '5px 12px' }}
                            disabled={inlineEditSaving}
                            onClick={async () => {
                              setInlineEditSaving(true)
                              const supabase = createClient()
                              const fields: Partial<Lead> = {
                                name: inlineEditForm.name,
                                phone: inlineEditForm.phone || undefined,
                                email: inlineEditForm.email || undefined,
                                guests: inlineEditForm.guests ? Number(inlineEditForm.guests) : undefined,
                                status: inlineEditForm.status,
                              }
                              await supabase.from('leads').update(fields).eq('id', l.id)
                              await onUpdateLead(l.id, fields)
                              setInlineEditSaving(false)
                              setExpandedLeadId(null)
                            }}>
                            {inlineEditSaving ? 'Guardando...' : 'Guardar cambios'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Status selector */}
          {!isPast && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Estado</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                {(Object.entries(STATUS_CFG) as [Status, typeof STATUS_CFG[Status]][]).map(([s, cfg]) => (
                  <button key={s} onClick={() => setStatus(s)} style={{
                    padding: '8px 4px', borderRadius: 8, cursor: 'pointer', border: '2px solid',
                    borderColor: status === s ? cfg.dot : 'var(--ivory)',
                    background: status === s ? cfg.bg : 'transparent',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.1s',
                  }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.dot }} />
                    <span style={{ fontSize: 11, fontWeight: status === s ? 700 : 400, color: status === s ? cfg.color : 'var(--warm-gray)' }}>
                      {cfg.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Link existing lead */}
          {!isPast && !showCreate && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Lead vinculado
              </div>
              {selectedLead ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8 }}>
                  <User size={15} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>{selectedLead.name}</div>
                    <div style={{ fontSize: 11, color: '#16a34a' }}>
                      {selectedLead.guests ? `${selectedLead.guests} inv.` : ''}{selectedLead.email ? ` · ${selectedLead.email}` : ''}
                    </div>
                  </div>
                  <button onClick={() => { setLeadId(null); setSearch('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a' }}><X size={14} /></button>
                </div>
              ) : (
                <div>
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                    <input className="form-input" style={{ paddingLeft: 32 }} value={search}
                      onChange={e => setSearch(e.target.value)} placeholder="Buscar lead por nombre o email..." />
                  </div>
                  {search && (
                    <div style={{ border: '1px solid var(--ivory)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
                      {filteredLeads.length === 0 ? (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--warm-gray)' }}>Sin resultados</div>
                      ) : filteredLeads.map(l => (
                        <div key={l.id} onClick={() => { setLeadId(l.id); setSearch('') }}
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
                          <span style={{ fontSize: 11, color: (LEAD_STATUS[l.status] || {}).color || '#6b7280', fontWeight: 500 }}>
                            {(LEAD_STATUS[l.status] || { label: l.status }).label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setShowCreate(true)}
                    style={{ fontSize: 12, color: 'var(--gold)', background: 'none', border: '1px dashed var(--gold)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center' }}>
                    <Plus size={13} /> Crear nuevo lead para esta fecha
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Lead pipeline status editor */}
          {selectedLead && !isPast && !showCreate && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Estado del lead</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {Object.entries(LEAD_STATUS).map(([s, cfg]) => (
                  <button key={s} onClick={() => setLeadPipelineStatus(s)} style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                    border: `1px solid ${leadPipelineStatus === s ? cfg.color : 'var(--ivory)'}`,
                    background: leadPipelineStatus === s ? `${cfg.color}18` : 'transparent',
                    color: leadPipelineStatus === s ? cfg.color : 'var(--warm-gray)',
                    fontWeight: leadPipelineStatus === s ? 600 : 400,
                    transition: 'all 0.1s',
                  }}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Scope selector: apply calendar entry status to just this date or all linked dates */}
          {selectedLead && !isPast && !showCreate && status !== 'libre' && leadEntries.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Aplicar estado del calendario a
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {([['this', 'Solo esta fecha'], ['all', 'Todas las fechas del lead']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setScope(val)} style={{
                    flex: 1, padding: '7px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 11,
                    border: `1px solid ${scope === val ? 'var(--gold)' : 'var(--ivory)'}`,
                    background: scope === val ? '#fef9ec' : 'transparent',
                    color: scope === val ? '#92400e' : 'var(--warm-gray)',
                    fontWeight: scope === val ? 600 : 400,
                    transition: 'all 0.1s',
                  }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Visita programada */}
          {selectedLead && !isPast && !showCreate && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Visita programada
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <input
                    className="form-input"
                    type="date"
                    value={visitDate}
                    onChange={e => setVisitDate(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>
                {visitDate && (
                  <button onClick={() => setVisitDate('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}>
                    <X size={14} />
                  </button>
                )}
              </div>
              {visitDate && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#10b981', fontWeight: 500 }}>
                  📅 {new Date(visitDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              )}
            </div>
          )}

          {/* Boda reservada */}
          {status === 'reservado' && !isPast && !showCreate && (
            <div style={{ marginBottom: 20, padding: '14px 16px', background: '#fdf2f8', border: '1px solid #fbcfe8', borderRadius: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9d174d', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                🌸 Boda reservada
              </div>
              {selectedLead ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
              ) : (
                <div style={{ fontSize: 12, color: '#be185d' }}>
                  Vincula un lead para ver los detalles de la boda.
                </div>
              )}
            </div>
          )}

          {/* Linked dates manager */}
          {selectedLead && !isPast && !showCreate && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Fechas en el calendario
              </div>
              {loadingLeadEntries ? (
                <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Cargando...</div>
              ) : leadEntries.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', padding: '4px 0' }}>Solo esta fecha vinculada</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {leadEntries.map(e => {
                    const isThisDate = e.date === date
                    const isUnlinking = datesToUnlink.has(e.date)
                    const eCfg = STATUS_CFG[e.status as Status] || STATUS_CFG.libre
                    return (
                      <div key={e.date} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                        background: isUnlinking ? '#fef2f2' : isThisDate ? '#f0fdf4' : 'var(--cream)',
                        border: `1px solid ${isUnlinking ? '#fca5a5' : isThisDate ? '#86efac' : 'var(--ivory)'}`,
                        borderRadius: 8, opacity: isUnlinking ? 0.75 : 1,
                      }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: isUnlinking ? '#9ca3af' : 'var(--charcoal)', textDecoration: isUnlinking ? 'line-through' : 'none' }}>
                            {formatDateEs(e.date)}
                          </span>
                          {isThisDate && <span style={{ fontSize: 10, color: '#16a34a', marginLeft: 6, fontWeight: 500 }}>← esta fecha</span>}
                        </div>
                        <span style={{ fontSize: 10, background: eCfg.badge, color: eCfg.color, padding: '1px 6px', borderRadius: 10, fontWeight: 500 }}>
                          {eCfg.label}
                        </span>
                        {!isThisDate && (
                          <button
                            onClick={() => setDatesToUnlink(prev => {
                              const n = new Set(prev)
                              if (n.has(e.date)) n.delete(e.date); else n.add(e.date)
                              return n
                            })}
                            title={isUnlinking ? 'Restaurar' : 'Quitar lead de esta fecha'}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isUnlinking ? '#16a34a' : '#dc2626', padding: 2, display: 'flex', alignItems: 'center' }}>
                            {isUnlinking ? <RotateCcw size={12} /> : <Trash2 size={12} />}
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {datesToUnlink.size > 0 && (
                    <div style={{ fontSize: 11, color: '#dc2626', padding: '2px 0' }}>
                      Se quitará el lead de {datesToUnlink.size} fecha{datesToUnlink.size > 1 ? 's' : ''} al guardar.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Quick create lead */}
          {showCreate && (
            <QuickCreateLead
              defaultDate={date}
              userId={userId}
              onCreated={async (lead) => {
                await onLeadCreated(lead)
                setLeadId(lead.id)
                setShowCreate(false)
              }}
              onCancel={() => setShowCreate(false)}
            />
          )}

          {/* Auto-block preview (only when status = reservado + rules active) */}
          {!isPast && !showCreate && affected.length > 0 && (
            <div style={{ marginBottom: 20, padding: '12px 14px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                <Info size={13} style={{ color: '#c2410c', flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#c2410c' }}>
                  Fechas que se bloquearán automáticamente
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {affected.map(a => (
                  <div key={a.date} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#7c2d12', fontWeight: 500 }}>{formatDateEs(a.date)}</span>
                    <span style={{ fontSize: 11, color: '#92400e', background: '#fed7aa', padding: '1px 7px', borderRadius: 10 }}>{a.reason}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#92400e' }}>
                Puedes cambiar estas reglas en ⚙️ Reglas del topbar.
              </div>
            </div>
          )}

          {/* Notes */}
          {!isPast && !showCreate && (
            <div style={{ marginBottom: 20 }}>
              <label className="form-label">Nota interna</label>
              <textarea className="form-textarea" style={{ minHeight: 70 }} value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Ej: Pendiente de señal, contactar el lunes..." />
            </div>
          )}

          {/* Quick actions if lead linked */}
          {selectedLead && !isPast && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, padding: '10px 12px', background: 'var(--cream)', borderRadius: 8 }}>
              <a href="/leads" style={{ flex: 1, fontSize: 12, padding: '6px', borderRadius: 6, border: '1px solid var(--ivory)', color: 'var(--charcoal)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <User size={12} /> Ver lead completo
              </a>
              <a href="/propuestas" style={{ flex: 1, fontSize: 12, padding: '6px', borderRadius: 6, border: '1px solid var(--ivory)', color: 'var(--charcoal)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <FileText size={12} /> Crear propuesta
              </a>
            </div>
          )}

          {isPast && !entry && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px', background: 'var(--cream)', borderRadius: 8, fontSize: 12, color: 'var(--warm-gray)' }}>
              <AlertCircle size={14} /> Esta fecha ya ha pasado.
            </div>
          )}

          {/* Panel leads afectados tras reservar/bloquear */}
          {showAffected && affectedLeads.length > 0 && (
            <div style={{ marginTop: 8, padding: '16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={14} /> {affectedLeads.length === 1 ? 'Hay 1 lead' : `Hay ${affectedLeads.length} leads`} más con esta fecha
              </div>
              <div style={{ fontSize: 12, color: '#78350f', marginBottom: 12 }}>
                La fecha acaba de quedar {status}. ¿Qué quieres hacer con estos leads?
              </div>
              {affectedLeads.map(l => {
                const st = LEAD_STATUS[l.status] || { label: l.status, color: '#6b7280' }
                const isSav = affectedSaving[l.id]
                return (
                  <div key={l.id} style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 8, padding: '12px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <User size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{l.name}</div>
                        {l.email && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{l.email}{l.phone ? ` · ${l.phone}` : ''}</div>}
                      </div>
                      <span style={{ fontSize: 11, color: st.color, fontWeight: 600 }}>{st.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <a href="/leads" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--ivory)', color: 'var(--charcoal)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <User size={10} /> Ver lead
                      </a>
                      <a href="/propuestas" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--ivory)', color: 'var(--charcoal)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <FileText size={10} /> Nueva propuesta
                      </a>
                      <button
                        disabled={isSav}
                        onClick={async () => {
                          setAffectedSaving(s => ({ ...s, [l.id]: true }))
                          await onUpdateLead(l.id, { status: 'lost' })
                          setAffectedLeads(prev => prev.filter(x => x.id !== l.id))
                          setAffectedSaving(s => ({ ...s, [l.id]: false }))
                        }}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #fca5a5', color: '#dc2626', background: 'transparent', cursor: 'pointer' }}>
                        {isSav ? '...' : '✗ Marcar perdido'}
                      </button>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flex: '1 1 160px' }}>
                        <input type="date" className="form-input" style={{ fontSize: 11, padding: '4px 8px', flex: 1 }}
                          value={newDateFor[l.id] || ''}
                          onChange={e => setNewDateFor(d => ({ ...d, [l.id]: e.target.value }))}
                          placeholder="Nueva fecha" />
                        {newDateFor[l.id] && (
                          <button
                            disabled={isSav}
                            onClick={async () => {
                              setAffectedSaving(s => ({ ...s, [l.id]: true }))
                              await onUpdateLead(l.id, { wedding_date: newDateFor[l.id] })
                              setAffectedLeads(prev => prev.filter(x => x.id !== l.id))
                              setAffectedSaving(s => ({ ...s, [l.id]: false }))
                            }}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #86efac', color: '#16a34a', background: '#f0fdf4', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {isSav ? '...' : '✓ Guardar fecha'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {affectedLeads.length === 0 && (
                <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 500 }}>✓ Todos los leads gestionados</div>
              )}
              <button
                onClick={() => { setShowAffected(false); onClose() }}
                style={{ marginTop: 8, fontSize: 12, padding: '6px 16px', borderRadius: 6, background: 'var(--gold)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Cerrar
              </button>
            </div>
          )}
        </div>

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

// ── Date Rules Modal ──────────────────────────────────────────────────────────

function DateRulesModal({ rules, onSave, onClose }: {
  rules: DateRule
  onSave: (r: DateRule) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<DateRule>(() => ({
    ...DEFAULT_RULES,
    ...rules,
    packages: rules.packages ? rules.packages.map(p => ({ ...p })) : [],
  }))
  const [saving, setSaving] = useState(false)

  const setField = (k: keyof DateRule, v: any) => setForm(f => ({ ...f, [k]: v }))

  const addPackage = () => {
    setForm(f => ({
      ...f,
      packages: [...(f.packages || []), { name: '', anchor_dow: 5, span_days: 3, days_before: 0, days_after: 0 }]
    }))
  }

  const updatePkg = (i: number, k: keyof DateRulePackage, v: any) => {
    setForm(f => {
      const pkgs = [...(f.packages || [])]
      pkgs[i] = { ...pkgs[i], [k]: v }
      return { ...f, packages: pkgs }
    })
  }

  const removePkg = (i: number) => {
    setForm(f => ({ ...f, packages: (f.packages || []).filter((_, j) => j !== i) }))
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const RULE_TYPES = [
    { value: 'simple',    label: 'Un día',        desc: 'La boda ocupa un solo día' },
    { value: 'overnight', label: 'Con noche',      desc: 'Check-in + check-out (2 días)' },
    { value: 'packages',  label: 'Paquetes',       desc: 'Lun-Mié, Mié-Vie, Vie-Dom…' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, color: 'var(--espresso)' }}>Reglas de fechas</div>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>Cómo se bloquean los días al reservar una fecha</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px 24px' }}>

          {/* Type selector */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Tipo de reserva</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {RULE_TYPES.map(rt => (
                <button key={rt.value} type="button" onClick={() => setField('type', rt.value)} style={{
                  padding: '12px 8px', borderRadius: 10, cursor: 'pointer', border: '2px solid',
                  borderColor: form.type === rt.value ? 'var(--gold)' : 'var(--ivory)',
                  background: form.type === rt.value ? '#fef9ec' : '#fff',
                  textAlign: 'center', transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: form.type === rt.value ? 'var(--espresso)' : 'var(--charcoal)', marginBottom: 4 }}>{rt.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.4 }}>{rt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Simple / Overnight: days before + after */}
          {(form.type === 'simple' || form.type === 'overnight') && (
            <div style={{ marginBottom: 24, padding: '16px', background: 'var(--cream)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 14 }}>
                {form.type === 'overnight' ? 'Bloqueo adicional (además del check-in y check-out)' : 'Bloqueo adicional por preparación y desmontaje'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="form-label">Días bloqueados antes</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="range" min={0} max={3} value={form.days_before}
                      onChange={e => setField('days_before', parseInt(e.target.value))}
                      style={{ flex: 1, accentColor: 'var(--gold)' }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--espresso)', minWidth: 20, textAlign: 'center' }}>{form.days_before}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>
                    {form.days_before === 0 ? 'Sin bloqueo previo' : `${form.days_before} día${form.days_before > 1 ? 's' : ''} de preparación`}
                  </div>
                </div>
                <div>
                  <label className="form-label">Días bloqueados después</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="range" min={0} max={3} value={form.days_after}
                      onChange={e => setField('days_after', parseInt(e.target.value))}
                      style={{ flex: 1, accentColor: 'var(--gold)' }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--espresso)', minWidth: 20, textAlign: 'center' }}>{form.days_after}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>
                    {form.days_after === 0 ? 'Sin bloqueo posterior' : `${form.days_after} día${form.days_after > 1 ? 's' : ''} de desmontaje`}
                  </div>
                </div>
              </div>
              {/* Preview */}
              {(form.days_before > 0 || form.days_after > 0 || form.type === 'overnight') && (
                <div style={{ marginTop: 14, padding: '10px 12px', background: '#fff', borderRadius: 8, border: '1px solid var(--ivory)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 8 }}>Vista previa de bloqueo</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {Array.from({ length: form.days_before }).map((_, i) => (
                      <span key={`b${i}`} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#fed7aa', color: '#92400e' }}>
                        -{form.days_before - i}d
                      </span>
                    ))}
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#fce7f3', color: '#9d174d', fontWeight: 700 }}>
                      📅 Boda
                    </span>
                    {form.type === 'overnight' && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#fce7f3', color: '#9d174d' }}>
                        Check-out
                      </span>
                    )}
                    {Array.from({ length: form.days_after }).map((_, i) => (
                      <span key={`a${i}`} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#fed7aa', color: '#92400e' }}>
                        +{i+1}d
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Packages */}
          {form.type === 'packages' && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>Paquetes de fechas</div>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Define en qué días puede empezar una boda y cuántos días ocupa</div>
                </div>
                <button type="button" onClick={addPackage}
                  style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', border: '1px dashed var(--gold)', background: 'transparent', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Plus size={12} /> Añadir paquete
                </button>
              </div>

              {(!form.packages || form.packages.length === 0) && (
                <div style={{ padding: '20px', textAlign: 'center', background: 'var(--cream)', borderRadius: 10, fontSize: 12, color: 'var(--warm-gray)' }}>
                  Añade al menos un paquete. Ej: Viernes–Domingo (3 días)
                </div>
              )}

              {form.packages?.map((pkg, i) => (
                <div key={i} style={{ marginBottom: 10, padding: '14px', background: 'var(--cream)', borderRadius: 10, border: '1px solid var(--ivory)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <input className="form-input" style={{ flex: 1, marginRight: 8, fontSize: 12 }}
                      value={pkg.name} onChange={e => updatePkg(i, 'name', e.target.value)}
                      placeholder="Nombre del paquete (ej: Viernes-Domingo)" />
                    <button type="button" onClick={() => removePkg(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 2 }}>
                      <X size={14} />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Día inicio</label>
                      <select className="form-input" style={{ fontSize: 12, padding: '5px 8px' }}
                        value={pkg.anchor_dow} onChange={e => updatePkg(i, 'anchor_dow', parseInt(e.target.value))}>
                        {DOW_NAMES.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Nº días</label>
                      <select className="form-input" style={{ fontSize: 12, padding: '5px 8px' }}
                        value={pkg.span_days} onChange={e => updatePkg(i, 'span_days', parseInt(e.target.value))}>
                        {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Días antes</label>
                      <select className="form-input" style={{ fontSize: 12, padding: '5px 8px' }}
                        value={pkg.days_before} onChange={e => updatePkg(i, 'days_before', parseInt(e.target.value))}>
                        {[0,1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Días después</label>
                      <select className="form-input" style={{ fontSize: 12, padding: '5px 8px' }}
                        value={pkg.days_after} onChange={e => updatePkg(i, 'days_after', parseInt(e.target.value))}>
                        {[0,1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Package preview */}
                  <div style={{ marginTop: 8, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {Array.from({ length: pkg.days_before }).map((_, j) => (
                      <span key={`pb${j}`} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#fed7aa', color: '#92400e' }}>-{pkg.days_before-j}d</span>
                    ))}
                    {Array.from({ length: pkg.span_days }).map((_, j) => {
                      const dow = (pkg.anchor_dow + j) % 7
                      return <span key={`ps${j}`} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#fce7f3', color: '#9d174d', fontWeight: 600 }}>{DOW_NAMES[dow]}</span>
                    })}
                    {Array.from({ length: pkg.days_after }).map((_, j) => (
                      <span key={`pa${j}`} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#fed7aa', color: '#92400e' }}>+{j+1}d</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info note */}
          <div style={{ padding: '10px 12px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', fontSize: 12, color: '#0369a1', lineHeight: 1.6 }}>
            <strong>¿Cómo funciona?</strong> Al marcar una fecha como <em>Reservado</em> en el calendario, las fechas adyacentes se bloquearán automáticamente según estas reglas.
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--ivory)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar reglas'}
          </button>
        </div>
      </div>
    </div>
  )
}

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
      status: 'new',
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
          <input className="form-input" type="date" value={form.wedding_date} onChange={e => set('wedding_date', e.target.value)} />
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

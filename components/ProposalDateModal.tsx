'use client'
import { useEffect, useRef, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'

// ── helpers (same logic as leads/page.tsx) ─────────────────────────────────
const MONTHS     = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_SHORT = ['L','M','X','J','V','S','D']
function pad(n: number) { return String(n).padStart(2, '0') }
function todayIso() { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}` }
function shiftDateBy(d: string, days: number) {
  const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + days)
  return dt.toISOString().slice(0, 10)
}
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

const CAL_AVAIL_CFG: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  libre:       { bg: '#fff',    border: '#e5e7eb', dot: '#d1fae5', label: 'Libre' },
  negociacion: { bg: '#fef9ec', border: '#fde68a', dot: '#f59e0b', label: 'En negociación' },
  reservado:   { bg: '#fee2e2', border: '#fca5a5', dot: '#ef4444', label: 'Reservado' },
  bloqueado:   { bg: '#e5e7eb', border: '#9ca3af', dot: '#6b7280', label: 'Bloqueado' },
}

// ── Component ──────────────────────────────────────────────────────────────
export default function ProposalDateModal({
  userId,
  currentDate,
  onClose,
  onConfirm,
}: {
  userId: string
  currentDate?: string | null
  onClose: () => void
  onConfirm: (dates: string[]) => void
}) {
  const initD = currentDate ? new Date(currentDate + 'T12:00:00') : new Date()
  const [viewYear,  setViewYear]  = useState(initD.getFullYear())
  const [viewMonth, setViewMonth] = useState(initD.getMonth())
  const [selectedDates,  setSelectedDates]  = useState<string[]>(currentDate ? [currentDate] : [])
  const [selectedAnchors, setSelectedAnchors] = useState<string[]>(currentDate ? [currentDate] : [])
  const [calEntries, setCalEntries] = useState<Record<string, any>>({})
  const [dateRules,  setDateRules]  = useState<any>(null)
  const [rangeMode,  setRangeMode]  = useState(false)
  const [rangeStart, setRangeStart] = useState<string | null>(null)
  const loadedMonths = useRef<Set<string>>(new Set())

  const todayStr = todayIso()

  // Load date rules once
  useEffect(() => {
    const supabase = createClient()
    supabase.from('venue_settings').select('date_rules').eq('user_id', userId).maybeSingle()
      .then(({ data }) => { if (data?.date_rules) setDateRules(data.date_rules) })
  }, [userId])

  // Load calendar entries for the current month
  useEffect(() => {
    const ym = `${viewYear}-${pad(viewMonth + 1)}`
    if (loadedMonths.current.has(ym)) return
    loadedMonths.current.add(ym)
    const supabase = createClient()
    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate()
    supabase.from('calendar_entries').select('*').eq('user_id', userId)
      .gte('date', `${ym}-01`).lte('date', `${ym}-${pad(lastDay)}`)
      .then(({ data }) => {
        if (!data) return
        const newEntries: Record<string, any> = {}
        const byDate: Record<string, any[]> = {}
        data.forEach((e: any) => { if (!byDate[e.date]) byDate[e.date] = []; byDate[e.date].push(e) })
        Object.entries(byDate).forEach(([date, arr]) => {
          if (arr.length === 1) { newEntries[date] = arr[0]; return }
          const bothHalves = arr.filter(e => e.note?.startsWith('medio_dia')).length === 2
          if (bothHalves) {
            const dom = arr.find(e => e.status === 'reservado') || arr[0]
            const raw = dom.note || ''
            const stripped = raw.startsWith('medio_dia') ? (raw.includes('|') ? raw.slice(raw.indexOf('|') + 1) || null : null) : raw || null
            newEntries[date] = { ...dom, note: stripped }
          } else { newEntries[date] = arr[0] }
        })
        setCalEntries(prev => ({ ...prev, ...newEntries }))
      })
  }, [viewYear, viewMonth, userId])

  // Re-expand selected dates when rules load
  useEffect(() => {
    if (!dateRules || selectedAnchors.length === 0) return
    setSelectedDates(expandAnchorsWithRules(selectedAnchors, dateRules))
  }, [dateRules])

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) } else setViewMonth(m => m - 1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) } else setViewMonth(m => m + 1) }

  const hasAutoRules = !!(dateRules && dateRules.type && dateRules.type !== 'none')

  const toggleDate = (ds: string) => {
    setSelectedAnchors(prev => {
      const next = prev.includes(ds) ? prev.filter(d => d !== ds) : [...prev, ds].sort()
      setSelectedDates(hasAutoRules ? expandAnchorsWithRules(next, dateRules) : next)
      return next
    })
  }

  const handleRangeClick = (ds: string) => {
    if (!rangeStart) { setRangeStart(ds); return }
    const [a, b] = [rangeStart, ds].sort()
    // Expand all dates for calendar highlighting
    const allDates: string[] = []
    let cur = a
    while (cur <= b) { allDates.push(cur); cur = shiftDateBy(cur, 1) }
    // Store only boundaries as anchors (avoids saving 31 individual dates for a full month)
    const boundaries = a === b ? [a] : [a, b]
    setSelectedAnchors(prev => {
      const next = [...new Set([...prev, ...boundaries])].sort()
      return next
    })
    setSelectedDates(prev => [...new Set([...prev, ...allDates])].sort())
    setRangeStart(null)
    setRangeMode(false)
  }

  // Calendar grid
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay()
  const startDow = (firstDayOfMonth + 6) % 7 // Monday-based
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const fmtSelected = useMemo(() => {
    if (selectedAnchors.length === 0) return 'Sin fechas seleccionadas'
    return selectedAnchors.map(d => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })).join(' · ')
  }, [selectedAnchors])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#f0f4ff,#e8eeff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CalendarDays size={17} style={{ color: '#4f6ef7' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--espresso)' }}>Seleccionar fecha de boda</div>
              <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Puedes seleccionar varias fechas</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4, borderRadius: 6 }}>
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ padding: '14px 16px' }}>

            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: 'var(--warm-gray)' }}><ChevronLeft size={16} /></button>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>{MONTHS[viewMonth]} {viewYear}</span>
              <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: 'var(--warm-gray)' }}><ChevronRight size={16} /></button>
            </div>

            {/* Range mode toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setRangeMode(r => !r); setRangeStart(null) }}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `1px solid ${rangeMode ? 'var(--gold)' : 'var(--border)'}`, background: rangeMode ? 'rgba(196,151,90,.1)' : 'transparent', color: rangeMode ? 'var(--gold)' : 'var(--warm-gray)', cursor: 'pointer', fontWeight: 500 }}>
                {rangeMode ? (rangeStart ? '← Elige fin del rango' : '← Elige inicio') : '↔ Rango'}
              </button>
              {selectedAnchors.length > 0 && (
                <button onClick={() => { setSelectedDates([]); setSelectedAnchors([]) }}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)', background: 'transparent', color: 'var(--warm-gray)', cursor: 'pointer' }}>
                  Limpiar
                </button>
              )}
            </div>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 0 }}>
              {DAYS_SHORT.map((d, i) => (
                <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: i >= 5 ? 'var(--gold)' : 'var(--warm-gray)', letterSpacing: '0.08em', padding: '8px 0' }}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} style={{ minHeight: 52, borderBottom: '1px solid var(--ivory)', borderRight: i % 7 !== 6 ? '1px solid var(--ivory)' : 'none' }} />
                const ds = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
                const entry = calEntries[ds]
                const entryStatus = entry?.status || 'libre'
                const cfg = CAL_AVAIL_CFG[entryStatus] || CAL_AVAIL_CFG.libre
                const isSelected    = selectedDates.includes(ds)
                const isAnchor      = selectedAnchors.includes(ds)
                const isBufferDay   = isSelected && !isAnchor
                const isHalfDay     = !!(entry?.note?.startsWith('medio_dia'))
                const isUnavailable = !isHalfDay && (entryStatus === 'reservado' || entryStatus === 'bloqueado')
                const isToday       = ds === todayStr
                const isPast        = ds < todayStr
                const dow           = (startDow + day - 1) % 7
                const isWeekend     = dow >= 5
                const canClick      = !isPast && !isUnavailable

                const bg = isBufferDay ? '#fdf6ee'
                  : isSelected ? '#fef3c7'
                  : isHalfDay ? `linear-gradient(135deg, ${cfg.bg} 50%, #ffffff 50%)`
                  : isPast ? '#faf8f5'
                  : isUnavailable ? cfg.bg
                  : entryStatus === 'negociacion' ? '#fffcf0'
                  : isWeekend ? '#faf7f4'
                  : '#fff'

                const shadow = isUnavailable && entryStatus === 'reservado' ? 'inset 0 0 0 2px #f87171'
                  : isUnavailable && entryStatus === 'bloqueado' ? 'inset 0 0 0 2px #9ca3af'
                  : isBufferDay ? 'inset 0 0 0 1.5px #f59e0b'
                  : isAnchor ? 'inset 0 0 0 2px #d97706'
                  : rangeMode && rangeStart === ds ? 'inset 0 0 0 2.5px var(--gold)'
                  : isToday ? 'inset 0 0 0 2px var(--gold)'
                  : 'none'

                return (
                  <button key={ds}
                    onClick={() => {
                      if (isPast) return
                      if (isUnavailable) return
                      if (rangeMode) { handleRangeClick(ds); return }
                      toggleDate(ds)
                    }}
                    style={{
                      minHeight: 52, border: 'none',
                      borderBottom: '1px solid var(--ivory)',
                      borderRight: i % 7 !== 6 ? '1px solid var(--ivory)' : 'none',
                      background: bg,
                      cursor: isPast || isUnavailable ? 'default' : 'pointer',
                      opacity: isPast ? 0.35 : 1,
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      justifyContent: 'space-between', padding: '6px 6px 4px',
                      boxShadow: shadow,
                      position: 'relative', transition: 'background 0.1s', outline: 'none',
                    }}
                    disabled={isPast}>
                    <span style={{
                      fontSize: 14, fontWeight: isToday ? 700 : 500, lineHeight: 1,
                      color: isPast ? 'var(--stone)'
                        : isBufferDay || isAnchor ? '#92400e'
                        : isToday ? 'var(--gold)'
                        : isWeekend ? 'var(--gold)'
                        : 'var(--charcoal)',
                    }}>{day}</span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%', marginTop: 'auto' }}>
                      {(isUnavailable || isHalfDay) && (
                        <span style={{ fontSize: isUnavailable ? 14 : 8, color: cfg.dot, fontWeight: 900, lineHeight: 1, marginLeft: 'auto' }}>
                          {isUnavailable ? '×' : isHalfDay && entry?.note?.startsWith('medio_dia_tarde') ? '½T' : '½M'}
                        </span>
                      )}
                    </div>
                    {isBufferDay && (
                      <div style={{ position: 'absolute', top: 2, right: 2, width: 13, height: 13, borderRadius: '50%', background: '#f59e0b', opacity: 0.55, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontSize: 8, fontWeight: 700, lineHeight: 1 }}>+</span>
                      </div>
                    )}
                    {isAnchor && (
                      <div style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1 }}>✓</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 12, fontSize: 10, color: 'var(--warm-gray)' }}>
              {[
                { color: '#fff', border: '1px solid #e5e7eb', label: 'Libre' },
                { color: '#fee2e2', border: '1px solid #fca5a5', label: 'Reservado' },
                { color: '#e5e7eb', border: '1px solid #9ca3af', label: 'Bloqueado' },
                { color: '#fef9ec', border: '1px solid #fde68a', label: 'Negociación' },
                { color: '#fef3c7', border: '1px solid #d97706', label: 'Seleccionada' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: item.color, border: item.border }} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--ivory)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, color: selectedAnchors.length > 0 ? 'var(--charcoal)' : 'var(--warm-gray)', background: 'var(--cream)', borderRadius: 8, padding: '8px 12px', lineHeight: 1.5 }}>
            {fmtSelected}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => onConfirm(selectedAnchors)}
              style={{ background: '#4f6ef7' }}>
              <CalendarDays size={13} /> Guardar fecha{selectedAnchors.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

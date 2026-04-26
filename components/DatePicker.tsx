'use client'
import { useEffect, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'

const MONTHS_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAY_SHORT   = ['L','M','X','J','V','S','D']

export function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${parseInt(day)} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][parseInt(m)-1]} ${y.slice(2)}`
}

export default function DatePicker({ value, onChange, label, accent = '#C4975A', minDate, allowPast = false }: {
  value: string
  onChange: (v: string) => void
  label?: string
  accent?: string
  minDate?: string
  allowPast?: boolean
}) {
  const [open, setOpen]         = useState(false)
  const [pos, setPos]           = useState({ top: 0, left: 0, width: 260 })
  const [viewYear, setViewYear] = useState(() => value ? parseInt(value.slice(0,4)) : new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.slice(5,7))-1 : new Date().getMonth())
  const btnRef = useRef<HTMLButtonElement>(null)
  const calRef = useRef<HTMLDivElement>(null)
  const today  = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!open) return
    const onMouse  = (e: MouseEvent) => {
      if (!calRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('scroll', onScroll, true)
    return () => { document.removeEventListener('mousedown', onMouse); document.removeEventListener('scroll', onScroll, true) }
  }, [open])

  const toggle = () => {
    if (!btnRef.current) return
    const r   = btnRef.current.getBoundingClientRect()
    const top = window.innerHeight - r.bottom < 310 ? r.top - 310 - 6 : r.bottom + 6
    setPos({ top, left: r.left, width: Math.max(r.width, 260) })
    const anchor = value || minDate
    if (anchor) { setViewYear(parseInt(anchor.slice(0,4))); setViewMonth(parseInt(anchor.slice(5,7))-1) }
    setOpen(o => !o)
  }

  const daysInMonth = (y: number, m: number) => new Date(y, m+1, 0).getDate()
  const firstDow    = (y: number, m: number) => { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d-1 }
  const prevMonth   = () => viewMonth === 0  ? (setViewMonth(11), setViewYear(y => y-1)) : setViewMonth(m => m-1)
  const nextMonth   = () => viewMonth === 11 ? (setViewMonth(0),  setViewYear(y => y+1)) : setViewMonth(m => m+1)

  const selectDay = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    if (!allowPast && iso < today) return
    if (minDate && iso < minDate) return
    onChange(iso)
    setOpen(false)
  }

  return (
    <div>
      {label && <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>}
      <button ref={btnRef} type="button" onClick={toggle}
        style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--ivory)', borderRadius: 8, background: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 12, color: value ? 'var(--charcoal)' : '#AAA', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, outline: 'none' }}>
        <span style={{ flex: 1 }}>{value ? fmtDate(value) : 'Seleccionar fecha'}</span>
        <CalendarDays size={12} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
      </button>

      {open && (
        <div ref={calRef} style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, background: '#fff', border: '1px solid var(--ivory)', borderRadius: 12, boxShadow: '0 8px 36px rgba(0,0,0,0.16)', padding: '14px 14px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 10px', borderRadius: 6, fontSize: 18, color: 'var(--charcoal)', lineHeight: 1, fontFamily: 'serif' }}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--charcoal)', textTransform: 'capitalize' }}>{MONTHS_FULL[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 10px', borderRadius: 6, fontSize: 18, color: 'var(--charcoal)', lineHeight: 1, fontFamily: 'serif' }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {DAY_SHORT.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', padding: '2px 0' }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
            {Array.from({ length: firstDow(viewYear, viewMonth) }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth(viewYear, viewMonth) }).map((_, i) => {
              const day = i + 1
              const iso = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const isSel = iso === value
              const isToday = iso === today
              const isDisabled = (!allowPast && iso < today) || (!!minDate && iso < minDate)
              return (
                <button key={day} type="button" onClick={() => selectDay(day)} disabled={isDisabled}
                  style={{ padding: '6px 0', textAlign: 'center', fontSize: 12, border: 'none', borderRadius: 7, cursor: isDisabled ? 'default' : 'pointer', fontFamily: 'Manrope, sans-serif', background: isSel ? accent : 'transparent', color: isSel ? '#fff' : isDisabled ? '#ccc' : isToday ? accent : 'var(--charcoal)', fontWeight: isSel || isToday ? 700 : 400, outline: isToday && !isSel ? `1.5px solid ${accent}` : 'none', outlineOffset: -2 }}>
                  {day}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--ivory)' }}>
            <button type="button" onClick={() => { onChange(''); setOpen(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--warm-gray)', fontFamily: 'Manrope, sans-serif' }}>Borrar</button>
            {!allowPast && <button type="button" onClick={() => { onChange(today); setOpen(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: accent, fontWeight: 700, fontFamily: 'Manrope, sans-serif' }}>Hoy</button>}
          </div>
        </div>
      )}
    </div>
  )
}

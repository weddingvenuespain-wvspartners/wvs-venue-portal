'use client'

import * as React from 'react'
import { useState, useRef, useEffect } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon, X } from 'lucide-react'
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'

export type DateRangeValue = { from: Date; to: Date } | null

type Preset = { label: string; getRange: () => { from: Date; to: Date } }

const PRESETS: Preset[] = [
  { label: 'Hoy', getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: 'Ayer', getRange: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
  { label: 'Últimos 7 días', getRange: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
  { label: 'Últimos 30 días', getRange: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }) },
  { label: 'Este mes', getRange: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }) },
  { label: 'Mes anterior', getRange: () => {
    const prev = subMonths(new Date(), 1)
    return { from: startOfMonth(prev), to: endOfDay(new Date(prev.getFullYear(), prev.getMonth() + 1, 0)) }
  }},
]

interface DateRangeFilterProps {
  value: DateRangeValue
  onChange: (v: DateRangeValue) => void
  placeholder?: string
  style?: React.CSSProperties
}

export function DateRangeFilter({ value, onChange, placeholder = 'Fecha: Todas', style }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const [selecting, setSelecting] = useState<DateRange | undefined>(
    value ? { from: value.from, to: value.to } : undefined
  )
  const ref = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Sync selecting state when value changes externally
  useEffect(() => {
    setSelecting(value ? { from: value.from, to: value.to } : undefined)
  }, [value])

  const applyPreset = (preset: Preset) => {
    const range = preset.getRange()
    onChange(range)
    setSelecting({ from: range.from, to: range.to })
    setOpen(false)
  }

  const handleSelect = (range: DateRange | undefined) => {
    setSelecting(range)
    if (range?.from && range?.to) {
      onChange({ from: startOfDay(range.from), to: endOfDay(range.to) })
    }
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
    setSelecting(undefined)
  }

  const displayLabel = value
    ? `${format(value.from, 'd MMM', { locale: es })} – ${format(value.to, 'd MMM', { locale: es })}`
    : placeholder

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          height: 36, padding: '0 10px', borderRadius: 8,
          border: '1px solid var(--border)', background: '#fff',
          fontSize: 12, color: value ? 'var(--charcoal)' : 'var(--warm-gray)',
          cursor: 'pointer', whiteSpace: 'nowrap',
          transition: 'border-color .15s',
        }}
      >
        <CalendarIcon size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
        {displayLabel}
        {value && (
          <span onClick={clear} style={{ marginLeft: 2, display: 'inline-flex', alignItems: 'center', opacity: 0.5, cursor: 'pointer' }}>
            <X size={12} />
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
          background: '#fff', borderRadius: 12, border: '1px solid var(--border)',
          boxShadow: '0 12px 36px rgba(0,0,0,.12)', display: 'flex', overflow: 'hidden',
        }}>
          {/* Presets sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 8px', borderRight: '1px solid var(--border)', minWidth: 130 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.04em', padding: '2px 8px', marginBottom: 2 }}>RANGO RÁPIDO</div>
            {PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  padding: '6px 8px', borderRadius: 6, fontSize: 11.5, color: 'var(--charcoal)',
                  fontWeight: 500, transition: 'background .1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                {p.label}
              </button>
            ))}
            {value && (
              <>
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <button
                  type="button"
                  onClick={() => { onChange(null); setSelecting(undefined); setOpen(false) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                    padding: '6px 8px', borderRadius: 6, fontSize: 11.5, color: 'var(--warm-gray)',
                    fontWeight: 500,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  Limpiar
                </button>
              </>
            )}
          </div>

          {/* Calendar */}
          <div style={{ padding: '8px 12px 12px' }}>
            <Calendar
              mode="range"
              selected={selecting}
              onSelect={handleSelect}
              numberOfMonths={2}
              defaultMonth={value?.from ? subMonths(value.from, 0) : subMonths(new Date(), 1)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

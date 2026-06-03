'use client'
import { useState, useMemo } from 'react'
import type { DateSlot } from '@/lib/proposal-types'

type Props = {
  slots: DateSlot[]
  primary: string
  onPrimary: string
  dark?: boolean
  font?: string
  proposalId?: string
  onSelect?: (slotIndex: number | null) => void
  guestCount?: number
}

/* ── helpers ────────────────────────────────────── */

function fmtShort(d: string) {
  const dt = new Date(d + 'T12:00:00')
  return dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

/** "Sáb 9 sept" */
function fmtWithDay(d: string) {
  const dt = new Date(d + 'T12:00:00')
  const weekday = dt.toLocaleDateString('es-ES', { weekday: 'short' })
  const day = dt.getDate()
  const month = dt.toLocaleDateString('es-ES', { month: 'short' })
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${day} ${month}`
}

function fmtDatesAsOptions(dates: string[]): string {
  if (!dates.length) return ''
  const labels = dates.map(fmtWithDay)
  if (labels.length === 1) return labels[0]
  return labels.slice(0, -1).join(', ') + ' o ' + labels[labels.length - 1]
}

function allSamePrice(slots: DateSlot[]) {
  const prices = slots.map(s => (s.price_per_person ?? '') + '|' + (s.price_rental ?? ''))
  return prices.every(p => p === prices[0])
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}

/** Get all unique months from slots for calendar view */
function getMonths(slots: DateSlot[]) {
  const all = slots.flatMap(s => s.dates).sort()
  const months = new Map<string, Date>()
  for (const d of all) {
    const dt = new Date(d + 'T12:00:00')
    const key = `${dt.getFullYear()}-${dt.getMonth()}`
    if (!months.has(key)) months.set(key, new Date(dt.getFullYear(), dt.getMonth(), 1))
  }
  return Array.from(months.values())
}

/** Build calendar grid for a month */
function buildCalendarDays(monthStart: Date) {
  const year = monthStart.getFullYear()
  const month = monthStart.getMonth()
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7 // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/* ── component ──────────────────────────────────── */

export default function DateSelector({ slots, primary, onPrimary, dark = false, font, proposalId: _pid, onSelect, guestCount: _gc }: Props) {
  const [selected, setSelected] = useState<number | null>(null)

  const textColor  = dark ? '#fff' : '#1a1a1a'
  const subColor   = dark ? 'rgba(255,255,255,.5)' : '#888'
  const cardBg     = dark ? '#111' : '#fff'
  const cardBorder = dark ? 'rgba(255,255,255,.08)' : '#e8e2d8'
  const secBg      = dark ? '#080808' : '#faf8f5'

  const samePrice   = allSamePrice(slots)
  const interactive = slots.length > 1
  const useCalendar = slots.length > 6

  const { r, g, b } = hexToRgb(primary.length === 7 ? primary : '#8b7355')

  // Map date string → slot index for calendar mode
  const dateToSlot = useMemo(() => {
    const map = new Map<string, number>()
    slots.forEach((slot, i) => { slot.dates.forEach(d => map.set(d, i)) })
    return map
  }, [slots])

  const months = useMemo(() => getMonths(slots), [slots])

  const handleSelect = (i: number) => {
    const next = selected === i ? null : i
    setSelected(next)
    onSelect?.(next)
  }

  /* ── render ── */
  return (
    <div>
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <h3 style={{
            fontFamily: "'Inter',sans-serif", fontSize: '.85rem', fontWeight: 600, letterSpacing: '.01em',
            color: textColor, lineHeight: 1.3, margin: 0,
          }}>
            {interactive
              ? (samePrice ? 'Elegid vuestra fecha' : 'Fecha y precio')
              : 'Vuestra fecha'}
          </h3>
          {interactive && !samePrice && (
            <span style={{ fontFamily: "'Inter',sans-serif", fontSize: '.75rem', color: subColor, fontWeight: 400 }}>
              Cada opción tiene un precio distinto
            </span>
          )}
        </div>

        {/* ── Interactive: chips or calendar ── */}
        {interactive ? (
          useCalendar ? (
            /* ── Calendar mode (>5 slots) ── */
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {months.map((monthStart, mi) => {
                const cells = buildCalendarDays(monthStart)
                const year = monthStart.getFullYear()
                const month = monthStart.getMonth()
                return (
                  <div key={mi} style={{ flex: '0 0 auto' }}>
                    <div style={{ fontSize: '.75rem', fontWeight: 600, color: textColor, marginBottom: 8, textTransform: 'capitalize' }}>
                      {monthStart.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 36px)', gap: 2 }}>
                      {WEEKDAYS.map(w => (
                        <div key={w} style={{ fontSize: '.6rem', fontWeight: 600, color: subColor, textAlign: 'center', padding: '4px 0' }}>{w}</div>
                      ))}
                      {cells.map((day, ci) => {
                        if (day === null) return <div key={`e${ci}`} />
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                        const slotIdx = dateToSlot.get(dateStr)
                        const available = slotIdx !== undefined
                        const isSel = available && selected === slotIdx
                        const slot = available ? slots[slotIdx] : null
                        const price = slot?.price_rental || slot?.price_per_person || ''

                        return (
                          <button
                            key={ci}
                            type="button"
                            disabled={!available}
                            onClick={() => available && handleSelect(slotIdx)}
                            title={available ? `${fmtShort(dateStr)}${price ? ` — ${price}` : ''}` : ''}
                            style={{
                              width: 36, height: 36, borderRadius: 8,
                              fontSize: '.78rem', fontWeight: available ? 600 : 400,
                              border: isSel ? `2px solid ${primary}` : available ? `1.5px solid ${cardBorder}` : '1px solid transparent',
                              background: isSel ? `rgba(${r},${g},${b},.12)` : available ? cardBg : 'transparent',
                              color: isSel ? primary : available ? textColor : `${dark ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.2)'}`,
                              cursor: available ? 'pointer' : 'default',
                              transition: 'all .15s',
                              padding: 0,
                            }}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Selected slot detail */}
              {selected !== null && slots[selected] && (
                <div style={{
                  flex: '1 1 200px', padding: '16px 20px', borderRadius: 10,
                  background: `rgba(${r},${g},${b},.05)`, border: `1.5px solid ${primary}`,
                  alignSelf: 'flex-start',
                }}>
                  <div style={{ fontSize: '.85rem', fontWeight: 600, color: textColor, marginBottom: 4 }}>
                    {fmtDatesAsOptions(slots[selected].dates)}
                  </div>
                  {(slots[selected].price_rental || slots[selected].price_per_person) && (
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: font, color: primary, marginBottom: 4 }}>
                      {slots[selected].price_rental || slots[selected].price_per_person}
                    </div>
                  )}
                  {slots[selected].notes && (
                    <div style={{ fontSize: '.72rem', color: subColor, fontStyle: 'italic' }}>{slots[selected].notes}</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ── Chip mode (≤6 slots) — horizontal, full width ── */
            <div style={{ display: 'flex', gap: 8 }}>
              {slots.map((slot, i) => {
                const isSel = selected === i
                const price = slot.price_rental || slot.price_per_person || ''
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelect(i)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      padding: '10px 16px', flex: 1, minWidth: 0,
                      background: isSel ? `rgba(${r},${g},${b},.08)` : cardBg,
                      border: `1.5px solid ${isSel ? primary : cardBorder}`,
                      borderRadius: 10, cursor: 'pointer',
                      transition: 'all .15s ease',
                      boxShadow: isSel ? `0 0 0 2px rgba(${r},${g},${b},.1)` : 'none',
                    }}
                  >
                    {/* Radio dot */}
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${isSel ? primary : cardBorder}`,
                      background: isSel ? primary : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .15s',
                    }}>
                      {isSel && <div style={{ width: 6, height: 6, borderRadius: '50%', background: onPrimary }} />}
                    </div>
                    <span style={{ fontSize: '.82rem', fontWeight: 500, color: isSel ? primary : textColor, whiteSpace: 'nowrap' }}>
                      {fmtDatesAsOptions(slot.dates)}
                    </span>
                    {price && (
                      <>
                        <span style={{ width: 1, height: 14, background: cardBorder, flexShrink: 0 }} />
                        <span style={{ fontSize: '.82rem', fontWeight: 700, color: isSel ? primary : textColor, whiteSpace: 'nowrap' }}>
                          {price}
                        </span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          )
        ) : (
          /* ── Non-interactive: single slot ── */
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {slots[0]?.price_per_person && (
              <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, padding: '8px 18px', borderRadius: 10, background: `rgba(${r},${g},${b},.06)` }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: font, color: primary }}>{slots[0].price_per_person}</span>
                {slots[0].price_rental && <span style={{ fontSize: '.72rem', color: subColor }}>· {slots[0].price_rental} total</span>}
              </div>
            )}
            {!slots[0]?.price_per_person && slots[0]?.price_rental && (
              <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, padding: '8px 18px', borderRadius: 10, background: `rgba(${r},${g},${b},.06)` }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: font, color: primary }}>{slots[0].price_rental}</span>
              </div>
            )}
            {slots.flatMap(s => s.dates).length > 0 && (
              <span style={{ fontSize: '.82rem', color: subColor }}>{fmtDatesAsOptions(slots.flatMap(s => s.dates))}</span>
            )}
            {slots[0]?.notes && (
              <span style={{ fontSize: '.75rem', color: subColor, fontStyle: 'italic' }}>{slots[0].notes}</span>
            )}
          </div>
        )}

    </div>
  )
}

'use client'
import { useState } from 'react'
import type { DateSlot } from '@/lib/proposal-types'

type Props = {
  slots: DateSlot[]
  primary: string
  onPrimary: string
  dark?: boolean
  font?: string
  proposalId?: string
  onSelect?: (slotIndex: number | null) => void
}

/* ── helpers ────────────────────────────────────── */

/** Show dates as individual options: "15 may, 16 may o 17 may" */
function fmtDatesAsOptions(dates: string[]): string {
  if (!dates.length) return ''
  const labels = dates.map(d => {
    const dt = new Date(d + 'T12:00:00')
    return dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  })
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

/* ── component ──────────────────────────────────── */

export default function DateSelector({ slots, primary, onPrimary, dark = false, font, proposalId: _pid, onSelect }: Props) {
  const [selected, setSelected] = useState<number | null>(null)

  const textColor  = dark ? '#fff' : '#1a1a1a'
  const subColor   = dark ? 'rgba(255,255,255,.5)' : '#888'
  const cardBg     = dark ? '#111' : '#fff'
  const cardBorder = dark ? 'rgba(255,255,255,.08)' : '#e8e2d8'
  const secBg      = dark ? '#080808' : '#faf8f5'

  const samePrice   = allSamePrice(slots)
  const interactive = slots.length > 1

  const { r, g, b } = hexToRgb(primary.length === 7 ? primary : '#8b7355')

  const handleSelect = (i: number) => {
    const next = selected === i ? null : i
    setSelected(next)
    onSelect?.(next)
  }

  /* ── render ── */
  return (
    <section style={{ padding: '80px 0', background: secBg }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 32px' }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 999,
            background: `rgba(${r},${g},${b},.08)`, marginBottom: 16,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span style={{ fontSize: '.68rem', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: primary }}>
              {interactive ? 'Elegid vuestra fecha' : 'Fechas disponibles'}
            </span>
          </div>
          <h2 style={{
            fontFamily: font, fontSize: 'clamp(1.4rem,2.2vw,2rem)', fontWeight: 300,
            color: textColor, lineHeight: 1.25, margin: 0,
          }}>
            {interactive
              ? (samePrice ? 'Seleccionad vuestra fecha preferida' : 'Cada fecha tiene condiciones distintas')
              : 'Tenemos disponibilidad para vosotros'}
          </h2>
          {interactive && (
            <p style={{ fontSize: '.82rem', color: subColor, marginTop: 10, lineHeight: 1.6, maxWidth: 440, margin: '10px auto 0' }}>
              {samePrice ? 'Indicadnos cuándo os gustaría celebrar vuestra boda' : 'Seleccionad la opción que mejor se adapte'}
            </p>
          )}
        </div>

        {/* ── Interactive: horizontal cards with radio ── */}
        {interactive ? (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 10,
            maxWidth: 540, margin: '0 auto',
          }}>
            {slots.map((slot, i) => {
              const isSel = selected === i
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelect(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '16px 20px', textAlign: 'left', width: '100%',
                    background: isSel ? `rgba(${r},${g},${b},.05)` : cardBg,
                    border: `2px solid ${isSel ? primary : cardBorder}`,
                    borderRadius: 12, cursor: 'pointer',
                    transition: 'all .2s ease',
                    boxShadow: isSel ? `0 0 0 3px rgba(${r},${g},${b},.1)` : 'none',
                  }}
                >
                  {/* Radio circle */}
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${isSel ? primary : cardBorder}`,
                    background: isSel ? primary : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .2s',
                  }}>
                    {isSel && <div style={{ width: 7, height: 7, borderRadius: '50%', background: onPrimary }} />}
                  </div>

                  {/* Dates text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.88rem', fontWeight: 600, color: textColor }}>
                      {fmtDatesAsOptions(slot.dates)}
                    </div>
                    {slot.label && (
                      <div style={{ fontSize: '.72rem', color: subColor, marginTop: 2 }}>{slot.label}</div>
                    )}
                    {slot.notes && (
                      <div style={{ fontSize: '.7rem', color: subColor, fontStyle: 'italic', marginTop: 3 }}>{slot.notes}</div>
                    )}
                  </div>

                  {/* Price on right */}
                  {(slot.price_rental || slot.price_per_person) && (
                    <div style={{
                      fontSize: '1.1rem', fontWeight: 700, fontFamily: font,
                      color: isSel ? primary : textColor, flexShrink: 0,
                      transition: 'color .2s',
                    }}>
                      {slot.price_rental || slot.price_per_person}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          /* ── Non-interactive: single slot display ── */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
          }}>
            {slots[0]?.price_per_person && (
              <div style={{
                display: 'inline-flex', alignItems: 'baseline', gap: 6,
                padding: '10px 28px', borderRadius: 12,
                background: `rgba(${r},${g},${b},.06)`,
              }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: font, color: primary }}>
                  {slots[0].price_per_person}
                </span>
                {slots[0].price_rental && (
                  <span style={{ fontSize: '.75rem', color: subColor }}>· {slots[0].price_rental} total</span>
                )}
              </div>
            )}
            {!slots[0]?.price_per_person && slots[0]?.price_rental && (
              <div style={{
                display: 'inline-flex', alignItems: 'baseline', gap: 6,
                padding: '10px 28px', borderRadius: 12,
                background: `rgba(${r},${g},${b},.06)`,
              }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: font, color: primary }}>
                  {slots[0].price_rental}
                </span>
              </div>
            )}

            {slots.flatMap(s => s.dates).length > 0 && (
              <div style={{ fontSize: '.9rem', color: textColor, textAlign: 'center' }}>
                {fmtDatesAsOptions(slots.flatMap(s => s.dates))}
              </div>
            )}

            {slots[0]?.notes && (
              <div style={{ fontSize: '.78rem', color: subColor, textAlign: 'center', maxWidth: 400 }}>{slots[0].notes}</div>
            )}
          </div>
        )}

      </div>
    </section>
  )
}

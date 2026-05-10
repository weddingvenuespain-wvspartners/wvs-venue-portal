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

/** Format individual dates as "15 may, 16 may o 17 may" (not ranges) */
function fmtDatesAsOptions(dates: string[]): string {
  if (!dates.length) return ''
  const sorted = [...dates].sort()
  const labels = sorted.map(d => {
    const dt = new Date(d + 'T12:00:00')
    return dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  })
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} o ${labels[1]}`
  return labels.slice(0, -1).join(', ') + ' o ' + labels[labels.length - 1]
}

function allSamePrice(slots: DateSlot[]) {
  const prices = slots.map(s => (s.price_per_person ?? '') + '|' + (s.price_rental ?? ''))
  return prices.every(p => p === prices[0])
}

export default function DateSelector({ slots, primary, onPrimary, dark = false, font, onSelect }: Props) {
  const [selected, setSelected] = useState<number | null>(null)

  const textColor = dark ? '#fff' : '#1a1a1a'
  const subColor  = dark ? 'rgba(255,255,255,.5)' : '#888'
  const cardBg    = dark ? '#111' : '#fff'
  const cardBorder = dark ? 'rgba(255,255,255,.08)' : '#e8e2d8'
  const secBg     = dark ? '#080808' : '#f4f1ec'

  const samePrice = allSamePrice(slots)
  const interactive = slots.length > 1

  return (
    <section style={{ padding: '64px 0', background: secBg }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 40px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <span style={{ fontSize: '.6rem', fontWeight: 700, letterSpacing: '.22em', textTransform: 'uppercase', color: primary, display: 'block', marginBottom: 10 }}>
            {interactive ? 'Fecha de la boda' : 'Fechas disponibles'}
          </span>
          <h2 style={{ fontFamily: font, fontSize: 'clamp(1.3rem,2.2vw,1.8rem)', fontWeight: 300, color: textColor, lineHeight: 1.2, margin: 0 }}>
            {interactive
              ? (samePrice ? '¿Qué fecha preferís?' : 'Cada fecha tiene condiciones distintas')
              : 'Tenemos disponibilidad para vosotros'}
          </h2>
          {interactive && (
            <p style={{ fontSize: '.8rem', color: subColor, marginTop: 10, lineHeight: 1.5 }}>
              Seleccionad la opción que mejor se adapte
            </p>
          )}
        </div>

        {/* Slot cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: slots.length === 1 ? '1fr' : slots.length === 2 ? 'repeat(2,1fr)' : 'repeat(auto-fill,minmax(240px,1fr))',
          gap: 12,
          maxWidth: slots.length === 1 ? 400 : '100%',
          margin: '0 auto',
        }}>
          {slots.map((slot, i) => {
            const isSel = selected === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (!interactive) return
                  const next = isSel ? null : i
                  setSelected(next)
                  onSelect?.(next)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  textAlign: 'left', padding: '16px 20px',
                  background: cardBg,
                  border: `1.5px solid ${isSel ? primary : cardBorder}`,
                  borderRadius: 12,
                  cursor: interactive ? 'pointer' : 'default',
                  transition: 'border-color .2s, box-shadow .2s',
                  boxShadow: isSel
                    ? `0 0 0 3px ${primary}22`
                    : '0 1px 4px rgba(0,0,0,.05)',
                }}
              >
                {/* Radio indicator */}
                {interactive && (
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${isSel ? primary : cardBorder}`,
                    background: isSel ? primary : 'transparent',
                    transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSel && <div style={{ width: 6, height: 6, borderRadius: '50%', background: onPrimary }} />}
                  </div>
                )}

                {/* Date info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.85rem', fontWeight: 600, color: textColor }}>
                    {fmtDatesAsOptions(slot.dates)}
                  </div>
                  {slot.label && (
                    <div style={{ fontSize: '.72rem', color: subColor, marginTop: 2 }}>{slot.label}</div>
                  )}
                  {slot.notes && (
                    <div style={{ fontSize: '.68rem', color: subColor, marginTop: 2, fontStyle: 'italic' }}>{slot.notes}</div>
                  )}
                </div>

                {/* Price */}
                {(slot.price_rental || slot.price_per_person) && (
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: isSel ? primary : subColor, fontFamily: font, flexShrink: 0 }}>
                    {slot.price_rental ?? slot.price_per_person}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Selection indicator */}
        {interactive && selected !== null && (
          <div style={{ marginTop: 20, textAlign: 'center', fontSize: '.78rem', color: subColor }}>
            Selección: <strong style={{ color: textColor }}>{fmtDatesAsOptions(slots[selected].dates)}</strong>
            {slots[selected].price_rental && <> · <strong style={{ color: primary }}>{slots[selected].price_rental}</strong></>}
          </div>
        )}

        {/* Non-interactive single slot */}
        {!interactive && (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            {slots[0]?.price_rental && (
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: primary, marginTop: 8 }}>
                {slots[0].price_rental}
              </div>
            )}
          </div>
        )}

      </div>
    </section>
  )
}

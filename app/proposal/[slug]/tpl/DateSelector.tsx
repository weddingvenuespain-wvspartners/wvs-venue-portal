'use client'
import { useState } from 'react'
import type { DateSlot } from '@/lib/proposal-types'

type Props = {
  slots: DateSlot[]
  primary: string
  onPrimary: string
  dark?: boolean
  font?: string
  coupleEmail?: string | null
  proposalId?: string
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

function allSamePrice(slots: DateSlot[]) {
  const prices = slots.map(s => (s.price_per_person ?? '') + '|' + (s.price_rental ?? ''))
  return prices.every(p => p === prices[0])
}

export default function DateSelector({ slots, primary, onPrimary, dark = false, font, coupleEmail, proposalId }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [sending, setSending] = useState(false)

  const textColor = dark ? '#fff' : '#1a1a1a'
  const subColor  = dark ? 'rgba(255,255,255,.5)' : '#888'
  const cardBg    = dark ? '#111' : '#fff'
  const cardBorder = dark ? 'rgba(255,255,255,.08)' : '#e8e2d8'
  const secBg     = dark ? '#080808' : '#f4f1ec'

  const samePrice = allSamePrice(slots)
  const interactive = slots.length > 1 && !samePrice

  const handleConfirm = async () => {
    if (selected === null || !proposalId) return
    setSending(true)
    try {
      await fetch(`/api/proposals/${proposalId}/select-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_index: selected, slot: slots[selected] }),
      })
      setConfirmed(true)
    } catch {
      setConfirmed(true) // optimistic
    } finally {
      setSending(false)
    }
  }

  return (
    <section style={{ padding: '80px 0', background: secBg }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 40px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.22em', textTransform: 'uppercase', color: primary, display: 'block', marginBottom: 12 }}>
            {interactive ? 'Elegid vuestra fecha' : 'Fechas disponibles'}
          </span>
          <h2 style={{ fontFamily: font, fontSize: 'clamp(1.5rem,2.5vw,2.2rem)', fontWeight: 300, color: textColor, lineHeight: 1.2, margin: 0 }}>
            {interactive
              ? 'Cada fecha tiene su propio precio'
              : 'Tenemos disponibilidad para vosotros'}
          </h2>
          {interactive && (
            <p style={{ fontSize: '.82rem', color: subColor, marginTop: 12, lineHeight: 1.6 }}>
              Seleccionad la opción que mejor se adapte a vuestras preferencias
            </p>
          )}
        </div>

        {/* Slot cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: slots.length === 1 ? '1fr' : slots.length === 2 ? 'repeat(2,1fr)' : 'repeat(auto-fill,minmax(260px,1fr))',
          gap: 16,
          maxWidth: slots.length === 1 ? 480 : '100%',
          margin: '0 auto',
        }}>
          {slots.map((slot, i) => {
            const isSelected = selected === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => interactive && !confirmed && setSelected(isSelected ? null : i)}
                style={{
                  display: 'flex', flexDirection: 'column', textAlign: 'left', padding: 0,
                  background: cardBg,
                  border: `2px solid ${isSelected ? primary : cardBorder}`,
                  borderRadius: 14, overflow: 'hidden',
                  cursor: interactive && !confirmed ? 'pointer' : 'default',
                  transition: 'border-color .2s, box-shadow .2s',
                  boxShadow: isSelected
                    ? `0 0 0 4px ${primary}22, 0 4px 20px rgba(0,0,0,.15)`
                    : '0 1px 6px rgba(0,0,0,.07)',
                }}
              >
                {/* Price band */}
                {(slot.price_per_person || slot.price_rental) && (
                  <div style={{
                    padding: '14px 20px',
                    background: isSelected ? primary : dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)',
                    borderBottom: `1px solid ${isSelected ? 'transparent' : cardBorder}`,
                    transition: 'background .2s',
                    display: 'flex', alignItems: 'baseline', gap: 8,
                  }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 700, color: isSelected ? onPrimary : primary, fontFamily: font, lineHeight: 1 }}>
                      {slot.price_per_person ?? slot.price_rental}
                    </span>
                    {slot.price_per_person && slot.price_rental && (
                      <span style={{ fontSize: '.72rem', color: isSelected ? `${onPrimary}99` : subColor }}>
                        · {slot.price_rental} total
                      </span>
                    )}
                  </div>
                )}

                {/* Content */}
                <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    {slot.label && (
                      <div style={{ fontSize: '.88rem', fontWeight: 700, color: textColor }}>{slot.label}</div>
                    )}
                    {interactive && (
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${isSelected ? primary : cardBorder}`,
                        background: isSelected ? primary : 'transparent',
                        transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isSelected && <div style={{ width: 7, height: 7, borderRadius: '50%', background: onPrimary }} />}
                      </div>
                    )}
                  </div>

                  {/* Dates list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {slot.dates.map((d, di) => (
                      <div key={di} style={{ fontSize: '.8rem', color: subColor, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: primary, display: 'inline-block', flexShrink: 0 }} />
                        {fmtDate(d)}
                      </div>
                    ))}
                  </div>

                  {slot.notes && (
                    <div style={{ fontSize: '.72rem', color: subColor, lineHeight: 1.5, fontStyle: 'italic' }}>
                      {slot.notes}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Confirm CTA — only when interactive and something selected */}
        {interactive && selected !== null && !confirmed && (
          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: '.82rem', color: subColor }}>
              Habéis elegido: <strong style={{ color: textColor }}>{slots[selected].label || slots[selected].dates.map(fmtDate).join(', ')}</strong>
              {slots[selected].price_per_person && <> · <strong style={{ color: primary }}>{slots[selected].price_per_person}</strong></>}
            </div>
            <button
              onClick={handleConfirm}
              disabled={sending}
              style={{
                background: primary, color: onPrimary, border: 'none',
                padding: '13px 40px', fontSize: '.78rem', fontWeight: 700,
                letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer',
                borderRadius: 3, opacity: sending ? .7 : 1,
              }}
            >
              {sending ? 'Enviando…' : 'Confirmar esta fecha →'}
            </button>
          </div>
        )}

        {/* Confirmed state */}
        {confirmed && (
          <div style={{ marginTop: 32, padding: '20px 32px', background: `${primary}18`, border: `1px solid ${primary}44`, borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: textColor, marginBottom: 6 }}>
              ✓ Fecha confirmada
            </div>
            <div style={{ fontSize: '.82rem', color: subColor, lineHeight: 1.6 }}>
              Hemos notificado al venue vuestra preferencia.
              {selected !== null && <> Habéis elegido: <strong>{slots[selected].label || slots[selected].dates.map(fmtDate).join(', ')}</strong>.</>}
              {' '}Pronto recibiréis confirmación.
            </div>
          </div>
        )}

        {/* Non-interactive: just show all dates flat */}
        {!interactive && (
          <div style={{ marginTop: 32, textAlign: 'center' }}>
            {slots.flatMap(s => s.dates).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
                {slots.flatMap(s => s.dates).map((d, i) => (
                  <span key={i} style={{ padding: '6px 16px', border: `1px solid ${cardBorder}`, borderRadius: 999, fontSize: '.78rem', color: textColor }}>
                    {fmtDate(d)}
                  </span>
                ))}
              </div>
            )}
            {slots[0]?.price_per_person && (
              <div style={{ marginTop: 16, fontSize: '1.1rem', fontWeight: 700, color: primary }}>
                {slots[0].price_per_person}
              </div>
            )}
            {slots[0]?.notes && (
              <div style={{ marginTop: 8, fontSize: '.78rem', color: subColor }}>{slots[0].notes}</div>
            )}
          </div>
        )}

      </div>
    </section>
  )
}

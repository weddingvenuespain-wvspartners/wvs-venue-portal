'use client'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X, Check, Loader2 } from 'lucide-react'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_SHORT = ['L','M','X','J','V','S','D']

function pad(n: number) { return String(n).padStart(2, '0') }
function todayIso() { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}` }
function isoToDate(s: string) { return new Date(s + 'T12:00:00') }
function dateLabel(iso: string) {
  return isoToDate(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

type DateSlotOption = {
  label?: string
  dates: string[]
  price_rental?: string
  price_per_person?: string
}

type Props = {
  proposalId: string
  coupleName: string
  primaryColor?: string
  selectedSpaces?: Array<{ group_name: string; space_name: string }>
  selectedMenus?: string[]
  dateSlots?: DateSlotOption[]
  preSelectedDateSlot?: number | null
  onClose: () => void
  onSuccess: () => void
}

/** Format dates as "15 may, 16 may o 17 may" (individual options, not ranges) */
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

export default function VisitBookingModal({
  proposalId, coupleName, primaryColor = '#C4975A',
  selectedSpaces = [], selectedMenus = [],
  dateSlots = [], preSelectedDateSlot = null,
  onClose, onSuccess,
}: Props) {
  const [slots, setSlots] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const hasMultipleDateSlots = dateSlots.length > 1
  const [step, setStep] = useState<'type' | 'date_pref' | 'calendar' | 'time' | 'confirm'>('type')
  const [visitType, setVisitType] = useState<string | null>(null)
  const [preferredDateSlot, setPreferredDateSlot] = useState<number | null>(preSelectedDateSlot)
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const today = todayIso()

  useEffect(() => {
    fetch(`/api/proposals/${proposalId}/visit-slots`)
      .then(r => r.json())
      .then(d => { setSlots(d.slots ?? {}); setLoading(false) })
      .catch(() => setLoading(false))
  }, [proposalId])

  // ── Calendar helpers ─────────────────────────────────────────────────────────
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDow = (() => { const d = new Date(viewYear, viewMonth, 1).getDay(); return d === 0 ? 6 : d - 1 })()

  const hasSlotsOn = (iso: string) => !!(slots[iso]?.length)

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1) }

  const selectDate = (iso: string) => {
    if (!hasSlotsOn(iso) || iso < today) return
    setSelectedDate(iso)
    setSelectedTime(null)
    setStep('time')
  }

  const submit = async () => {
    if (!selectedDate || !selectedTime) return
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`/api/proposals/${proposalId}/visit-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate, time: selectedTime,
          message: message || null,
          couple_email: email || null,
          visit_type: visitType,
          selected_spaces: selectedSpaces,
          selected_menus: selectedMenus,
          preferred_date_slot: preferredDateSlot !== null ? dateSlots[preferredDateSlot] : null,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Error al enviar'); setSubmitting(false); return }
      onSuccess()
    } catch {
      setError('Error de conexión'); setSubmitting(false)
    }
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 9000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  }
  const modal: React.CSSProperties = {
    background: '#111', border: '1px solid #222', borderRadius: 16,
    width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
    position: 'relative',
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {step !== 'type' && (
              <button onClick={() => {
                if (step === 'confirm') setStep('time')
                else if (step === 'time') setStep('calendar')
                else if (step === 'calendar') setStep(hasMultipleDateSlots ? 'date_pref' : 'type')
                else if (step === 'date_pref') setStep('type')
              }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '0 0 8px' }}>
                <ChevronLeft size={14} /> Atrás
              </button>
            )}
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: primaryColor }}>Solicitar visita</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginTop: 2 }}>
              {step === 'type' && '¿Cómo os gustaría conocernos?'}
              {step === 'date_pref' && '¿Qué fecha de boda os gusta más?'}
              {step === 'calendar' && 'Elige un día para la visita'}
              {step === 'time' && selectedDate && dateLabel(selectedDate)}
              {step === 'confirm' && 'Confirmar visita'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '16px 24px 24px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,.3)' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
              <div style={{ marginTop: 8, fontSize: 12 }}>Cargando disponibilidad…</div>
            </div>
          )}

          {!loading && Object.keys(slots).length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,.4)', fontSize: 14 }}>
              No hay disponibilidad configurada.<br />
              <span style={{ fontSize: 12, marginTop: 4, display: 'block' }}>Contacta directamente con el venue.</span>
            </div>
          )}

          {/* ── STEP: VISIT TYPE ── */}
          {step === 'type' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { id: 'presencial', icon: '🏛️', label: 'Visitar el venue', desc: 'Ven a conocer el espacio en persona' },
                { id: 'videollamada', icon: '📹', label: 'Videollamada', desc: 'Conoced el venue desde casa' },
                { id: 'llamada', icon: '📞', label: 'Llamada telefónica', desc: 'Hablad con nuestro equipo' },
              ].map(opt => (
                <button key={opt.id} type="button"
                  onClick={() => {
                    setVisitType(opt.id)
                    setStep(hasMultipleDateSlots ? 'date_pref' : 'calendar')
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '16px 18px', borderRadius: 10,
                    background: 'rgba(255,255,255,.04)',
                    border: '1px solid rgba(255,255,255,.1)',
                    cursor: 'pointer', color: '#fff', textAlign: 'left',
                    transition: 'background .15s, border-color .15s',
                  }}>
                  <span style={{ fontSize: 22 }}>{opt.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 1 }}>{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── STEP: WEDDING DATE PREFERENCE ── */}
          {!loading && step === 'date_pref' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{
                background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 4,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={primaryColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', lineHeight: 1.4 }}>
                  Antes de agendar la visita, decidnos qué <strong style={{ color: '#fff' }}>fecha de boda</strong> os interesa más
                </span>
              </div>
              {dateSlots.map((ds, i) => {
                const isSel = preferredDateSlot === i
                return (
                  <button key={i} type="button"
                    onClick={() => { setPreferredDateSlot(i); setStep('calendar') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px', borderRadius: 10,
                      background: isSel ? `${primaryColor}22` : 'rgba(255,255,255,.04)',
                      border: `1px solid ${isSel ? primaryColor : 'rgba(255,255,255,.1)'}`,
                      cursor: 'pointer', color: '#fff', textAlign: 'left',
                    }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${isSel ? primaryColor : 'rgba(255,255,255,.2)'}`,
                      background: isSel ? primaryColor : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSel && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtDatesAsOptions(ds.dates)}</div>
                      {ds.label && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 1 }}>{ds.label}</div>}
                    </div>
                    {(ds.price_rental || ds.price_per_person) && (
                      <div style={{ fontSize: 15, fontWeight: 700, color: primaryColor, flexShrink: 0 }}>
                        {ds.price_rental || ds.price_per_person}
                      </div>
                    )}
                  </button>
                )
              })}
              <button type="button"
                onClick={() => { setPreferredDateSlot(null); setStep('calendar') }}
                style={{
                  padding: '11px 16px', borderRadius: 10,
                  background: 'transparent', border: '1px dashed rgba(255,255,255,.12)',
                  cursor: 'pointer', color: 'rgba(255,255,255,.35)', fontSize: 12,
                  textAlign: 'center',
                }}>
                Aún no lo tengo claro
              </button>
            </div>
          )}

          {/* ── STEP: CALENDAR ── */}
          {!loading && Object.keys(slots).length > 0 && step === 'calendar' && (
            <div>
              {/* Month nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', padding: 4 }}><ChevronLeft size={16} /></button>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{MONTHS[viewMonth]} {viewYear}</span>
                <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', padding: 4 }}><ChevronRight size={16} /></button>
              </div>

              {/* Weekday headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                {DAYS_SHORT.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', letterSpacing: '.06em', padding: '4px 0' }}>{d}</div>
                ))}
              </div>

              {/* Days grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const iso = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
                  const available = hasSlotsOn(iso)
                  const isPast = iso < today
                  const isSelected = selectedDate === iso
                  return (
                    <button key={day} type="button" onClick={() => selectDate(iso)}
                      disabled={!available || isPast}
                      style={{
                        aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: available && !isPast ? 600 : 400, borderRadius: 8, border: 'none',
                        cursor: available && !isPast ? 'pointer' : 'default',
                        background: isSelected ? primaryColor : available && !isPast ? 'rgba(255,255,255,.08)' : 'transparent',
                        color: isSelected ? '#fff' : available && !isPast ? '#fff' : 'rgba(255,255,255,.2)',
                        position: 'relative',
                        transition: 'background .15s',
                      }}>
                      {day}
                      {available && !isPast && !isSelected && (
                        <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: primaryColor }} />
                      )}
                    </button>
                  )
                })}
              </div>

              <div style={{ marginTop: 14, fontSize: 11, color: 'rgba(255,255,255,.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: primaryColor, display: 'inline-block' }} />
                Días con disponibilidad
              </div>
            </div>
          )}

          {/* ── STEP: TIME SLOTS ── */}
          {!loading && step === 'time' && selectedDate && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {(slots[selectedDate] ?? []).map(t => (
                  <button key={t} type="button" onClick={() => { setSelectedTime(t); setStep('confirm') }}
                    style={{
                      padding: '12px 0', borderRadius: 8, border: `1px solid ${selectedTime === t ? primaryColor : 'rgba(255,255,255,.12)'}`,
                      background: selectedTime === t ? `${primaryColor}22` : 'rgba(255,255,255,.04)',
                      color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer',
                      transition: 'all .15s',
                    }}>
                    {t}h
                  </button>
                ))}
              </div>
              {!(slots[selectedDate]?.length) && (
                <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                  No hay huecos disponibles este día. Elige otra fecha.
                </p>
              )}
            </div>
          )}

          {/* ── STEP: CONFIRM ── */}
          {!loading && step === 'confirm' && selectedDate && selectedTime && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Summary */}
              <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visitType && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>Tipo de visita</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
                      {visitType === 'presencial' ? '🏛️ Visita al venue' : visitType === 'videollamada' ? '📹 Videollamada' : '📞 Llamada telefónica'}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>Fecha y hora</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{dateLabel(selectedDate)} · {selectedTime}h</div>
                </div>
                {preferredDateSlot !== null && dateSlots[preferredDateSlot] && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>Fecha de boda preferida</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
                      <strong style={{ color: '#fff' }}>{fmtDatesAsOptions(dateSlots[preferredDateSlot].dates)}</strong>
                      {dateSlots[preferredDateSlot].price_rental && <span style={{ color: primaryColor, marginLeft: 8 }}>{dateSlots[preferredDateSlot].price_rental}</span>}
                    </div>
                  </div>
                )}
                {selectedSpaces.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>Espacios</div>
                    {selectedSpaces.map((s, i) => (
                      <div key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>{s.group_name}: <strong style={{ color: '#fff' }}>{s.space_name}</strong></div>
                    ))}
                  </div>
                )}
                {selectedMenus.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>Menús</div>
                    {selectedMenus.map((m, i) => <div key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>{m}</div>)}
                  </div>
                )}
              </div>

              {/* Email */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 6 }}>
                  Tu email (para la confirmación)
                </label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="hola@email.com"
                  style={{ width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
              </div>

              {/* Message */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 6 }}>
                  Mensaje (opcional)
                </label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                  placeholder="¿Algo que queráis comentar antes de la visita?"
                  style={{ width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, resize: 'none', boxSizing: 'border-box' }} />
              </div>

              {error && <div style={{ fontSize: 12, color: '#fca5a5', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6, padding: '8px 12px' }}>{error}</div>}

              <button type="button" onClick={submit} disabled={submitting}
                style={{ background: primaryColor, color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? .7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {submitting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={16} />}
                {submitting ? 'Enviando…' : 'Solicitar visita'}
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

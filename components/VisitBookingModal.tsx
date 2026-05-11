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
  selectedExtraSvcs?: string[]
  spaceGroups?: Array<{ name: string; selection_mode?: string; optional?: boolean; requires_selection?: boolean }>
  dateSlots?: DateSlotOption[]
  preSelectedDateSlot?: number | null
  onClose: () => void
  onSuccess: () => void
}

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

export default function VisitBookingModal({
  proposalId, coupleName, primaryColor = '#C4975A',
  selectedSpaces = [], selectedMenus = [], selectedExtraSvcs = [], spaceGroups,
  dateSlots = [], preSelectedDateSlot = null,
  onClose, onSuccess,
}: Props) {
  const [slots, setSlots] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const hasMultipleDateSlots = dateSlots.length > 1
  const [step, setStep] = useState<'type' | 'date_pref' | 'calendar' | 'time' | 'confirm'>('type')
  const [visitType, setVisitType] = useState<'presencial' | 'online' | null>(null)
  const [preferredDateSlot, setPreferredDateSlot] = useState<number | null>(preSelectedDateSlot)
  const [preferredWeddingDate, setPreferredWeddingDate] = useState<string | null>(null)
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

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

  const missingRequiredGroups = (spaceGroups ?? []).filter(g => {
    const isOptional = g.optional || g.selection_mode === 'optional' || g.selection_mode === 'none' || g.requires_selection === false
    if (isOptional) return false
    return !selectedSpaces.some(s => s.group_name === g.name)
  })

  const submit = async () => {
    if (!selectedDate || !selectedTime) return
    if (!email.trim()) { setError('Indica tu email'); return }
    if (!isValidEmail(email)) { setError('Email no válido'); return }
    if (missingRequiredGroups.length > 0) {
      setError(`Selecciona una opción en: ${missingRequiredGroups.map(g => g.name).join(', ')}`)
      return
    }
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`/api/proposals/${proposalId}/visit-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate, time: selectedTime,
          visit_type: visitType || 'presencial',
          message: message || null,
          couple_email: email.trim(),
          selected_spaces: selectedSpaces,
          selected_menus: selectedMenus,
          selected_extra_svcs: selectedExtraSvcs.length > 0 ? selectedExtraSvcs : undefined,
          preferred_date_slot: preferredDateSlot !== null && dateSlots[preferredDateSlot] ? dateSlots[preferredDateSlot] : null,
          preferred_wedding_date: preferredWeddingDate || null,
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
              <button onClick={() => setStep(
                  step === 'confirm' ? 'time'
                  : step === 'time' ? 'calendar'
                  : step === 'calendar' ? (hasMultipleDateSlots ? 'date_pref' : 'type')
                  : step === 'date_pref' ? 'type'
                  : 'type'
                )}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '0 0 8px' }}>
                <ChevronLeft size={14} /> Atrás
              </button>
            )}
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: primaryColor }}>Solicitar visita</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginTop: 2 }}>
              {step === 'type' && '¿Cómo preferís la visita?'}
              {step === 'date_pref' && 'Fecha de vuestra boda'}
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
          {!loading && step === 'type' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button type="button" onClick={() => {
                  setVisitType('presencial')
                  if (hasMultipleDateSlots) {
                    // Jump calendar to month of first proposed date
                    const firstDate = dateSlots[0]?.dates?.[0]
                    if (firstDate) { const d = new Date(firstDate + 'T12:00:00'); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()) }
                    setStep('date_pref')
                  } else { setStep('calendar') }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', borderRadius: 12,
                  border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)',
                  color: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${primaryColor}22`, border: `1px solid ${primaryColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={primaryColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Visita presencial</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>Ven a conocer el espacio en persona</div>
                </div>
              </button>
              <button type="button" onClick={() => {
                  setVisitType('online')
                  if (hasMultipleDateSlots) {
                    const firstDate = dateSlots[0]?.dates?.[0]
                    if (firstDate) { const d = new Date(firstDate + 'T12:00:00'); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()) }
                    setStep('date_pref')
                  } else { setStep('calendar') }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', borderRadius: 12,
                  border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)',
                  color: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${primaryColor}22`, border: `1px solid ${primaryColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={primaryColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15.6 11.6a4 4 0 10-7.2 0"/><circle cx="12" cy="12" r="2"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Videollamada</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>Os enseñamos el venue por video</div>
                </div>
              </button>
            </div>
          )}

          {/* ── STEP: DATE PREFERENCE — calendar, select ONE individual date ── */}
          {!loading && step === 'date_pref' && hasMultipleDateSlots && (() => {
            // Map each individual date → its slot index + price
            const dateInfo = new Map<string, { slotIdx: number; price: string }>()
            dateSlots.forEach((slot, si) => {
              const price = slot.price_rental || slot.price_per_person || ''
              slot.dates.forEach(d => dateInfo.set(d, { slotIdx: si, price }))
            })

            const calYear = viewYear
            const calMonth = viewMonth
            const calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
            const calFirstDow = (() => { const d = new Date(calYear, calMonth, 1).getDay(); return d === 0 ? 6 : d - 1 })()

            // Price for currently selected individual date
            const selInfo = preferredWeddingDate ? dateInfo.get(preferredWeddingDate) : null

            return (
              <div>
                <div style={{ margin: '0 0 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill={primaryColor} stroke="none">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', lineHeight: 1.5 }}>
                      ¿Qué <strong style={{ color: '#fff' }}>fecha de boda</strong> os interesa más?
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginLeft: 24 }}>
                    No te preocupes, se puede cambiar más adelante
                  </div>
                </div>

                {/* Month nav */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', padding: 4 }}><ChevronLeft size={16} /></button>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{MONTHS[calMonth]} {calYear}</span>
                  <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', padding: 4 }}><ChevronRight size={16} /></button>
                </div>

                {/* Weekday headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                  {DAYS_SHORT.map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', letterSpacing: '.06em', padding: '4px 0' }}>{d}</div>
                  ))}
                </div>

                {/* Days grid — only proposed dates clickable */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                  {Array.from({ length: calFirstDow }).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: calDaysInMonth }).map((_, i) => {
                    const day = i + 1
                    const iso = `${calYear}-${pad(calMonth + 1)}-${pad(day)}`
                    const proposed = dateInfo.has(iso)
                    const isSelected = preferredWeddingDate === iso
                    return (
                      <button key={day} type="button"
                        onClick={() => {
                          if (!proposed) return
                          const info = dateInfo.get(iso)!
                          setPreferredWeddingDate(iso)
                          setPreferredDateSlot(info.slotIdx)
                        }}
                        disabled={!proposed}
                        style={{
                          aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: proposed ? 600 : 400, borderRadius: 8, border: 'none',
                          cursor: proposed ? 'pointer' : 'default',
                          background: isSelected ? primaryColor : proposed ? 'rgba(255,255,255,.1)' : 'transparent',
                          color: isSelected ? '#fff' : proposed ? '#fff' : 'rgba(255,255,255,.15)',
                          position: 'relative',
                          transition: 'background .15s',
                        }}>
                        {day}
                        {proposed && !isSelected && (
                          <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: primaryColor }} />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Selected date → show date label + price */}
                {preferredWeddingDate && selInfo && (
                  <div style={{
                    marginTop: 16, padding: '12px 16px', borderRadius: 10,
                    background: `${primaryColor}15`, border: `1px solid ${primaryColor}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                      {dateLabel(preferredWeddingDate)}
                    </div>
                    {selInfo.price && (
                      <div style={{ fontSize: 18, fontWeight: 700, color: primaryColor }}>
                        {selInfo.price}
                      </div>
                    )}
                  </div>
                )}

                {/* Next / skip */}
                <button type="button"
                  onClick={() => setStep('calendar')}
                  style={{
                    marginTop: 16, width: '100%', padding: '13px 0', borderRadius: 10,
                    background: preferredWeddingDate ? primaryColor : 'rgba(255,255,255,.08)',
                    color: preferredWeddingDate ? '#fff' : 'rgba(255,255,255,.4)',
                    border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    transition: 'all .2s',
                  }}>
                  {preferredWeddingDate ? 'Siguiente →' : 'Aún no lo tengo claro — saltar'}
                </button>
              </div>
            )
          })()}

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
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>Tipo de visita</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{visitType === 'online' ? '📹 Videollamada' : '🏠 Presencial'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>Fecha y hora</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{dateLabel(selectedDate)} · {selectedTime}h</div>
                </div>
                {preferredWeddingDate && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>Fecha preferida para la boda</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                      {dateLabel(preferredWeddingDate)}
                      {preferredDateSlot !== null && dateSlots[preferredDateSlot]?.price_rental && <span style={{ color: primaryColor, marginLeft: 8 }}>{dateSlots[preferredDateSlot].price_rental}</span>}
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
                  Tu email (para la confirmación) *
                </label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required
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

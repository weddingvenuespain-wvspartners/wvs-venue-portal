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
function dateLabelShort(iso: string) {
  return isoToDate(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
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

// step groups → which "paso" they belong to
type Step = 'type' | 'info' | 'calendar' | 'time' | 'confirm'
function stepNum(s: Step) {
  if (s === 'type') return 1
  if (s === 'info') return 2
  return 3
}

const TOTAL_STEPS = 3

export default function VisitBookingModal({
  proposalId, coupleName, primaryColor = '#C4975A',
  selectedSpaces = [], selectedMenus = [], selectedExtraSvcs = [], spaceGroups,
  dateSlots = [], preSelectedDateSlot = null,
  onClose, onSuccess,
}: Props) {
  const [slots, setSlots] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)

  const [step, setStep] = useState<Step>('type')
  const [visitType, setVisitType] = useState<'presencial' | 'online' | null>(null)

  // Preferred wedding date — picked in step 2
  const [preferredDateSlot, setPreferredDateSlot] = useState<number | null>(preSelectedDateSlot)
  const [preferredWeddingDate, setPreferredWeddingDate] = useState<string | null>(null)

  // Visit scheduling — step 3
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const today = todayIso()

  // Build flat list of all individual proposed dates for the picker
  const allProposedDates: Array<{ iso: string; slotIdx: number; price: string }> = []
  dateSlots.forEach((slot, si) => {
    const price = slot.price_rental || slot.price_per_person || ''
    slot.dates.forEach(d => allProposedDates.push({ iso: d, slotIdx: si, price }))
  })
  // Sort chronologically
  allProposedDates.sort((a, b) => a.iso.localeCompare(b.iso))

  useEffect(() => {
    fetch(`/api/proposals/${proposalId}/visit-slots`)
      .then(r => r.json())
      .then(d => { setSlots(d.slots ?? {}); setLoading(false) })
      .catch(() => setLoading(false))
  }, [proposalId])

  // Calendar helpers
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDow = (() => { const d = new Date(viewYear, viewMonth, 1).getDay(); return d === 0 ? 6 : d - 1 })()
  const hasSlotsOn = (iso: string) => !!(slots[iso]?.length)
  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1) }
  const selectDate = (iso: string) => {
    if (!hasSlotsOn(iso) || iso < today) return
    setSelectedDate(iso); setSelectedTime(null); setStep('time')
  }

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
  const missingRequiredGroups = (spaceGroups ?? []).filter(g => {
    const isOptional = g.optional || g.selection_mode === 'optional' || g.selection_mode === 'none' || g.requires_selection === false
    if (isOptional) return false
    return !selectedSpaces.some(s => s.group_name === g.name)
  })

  const goBack = () => {
    if (step === 'confirm') setStep('time')
    else if (step === 'time') setStep('calendar')
    else if (step === 'calendar') setStep('info')
    else if (step === 'info') setStep('type')
  }

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
    } catch { setError('Error de conexión'); setSubmitting(false) }
  }

  // ── Shared styles ─────────────────────────────────────────────────────────────
  const rowLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)',
    textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3,
  }

  // ── Step indicator ────────────────────────────────────────────────────────────
  const currentStep = stepNum(step)
  const StepBar = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const n = i + 1
        const active = n === currentStep
        const done = n < currentStep
        return (
          <div key={n} style={{
            height: 4, borderRadius: 2,
            width: active ? 24 : 8,
            background: active ? primaryColor : done ? `${primaryColor}55` : 'rgba(255,255,255,.15)',
            transition: 'all .3s',
          }} />
        )
      })}
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginLeft: 4, letterSpacing: '.04em' }}>
        Paso {currentStep} de {TOTAL_STEPS}
      </span>
    </div>
  )

  const stepTitle = () => {
    if (step === 'type') return '¿Cómo preferís la visita?'
    if (step === 'info') return 'Confirmad vuestra información'
    if (step === 'calendar') return 'Elige un día para la visita'
    if (step === 'time' && selectedDate) return dateLabel(selectedDate)
    if (step === 'confirm') return 'Confirmar y enviar'
    return ''
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            {step !== 'type' && (
              <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '0 0 8px' }}>
                <ChevronLeft size={14} /> Atrás
              </button>
            )}
            <StepBar />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginTop: 4 }}>{stepTitle()}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', padding: 4, flexShrink: 0, marginTop: 2 }}>
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

          {/* ══════════════════════════════════════════════════════════════════
              PASO 1 — Tipo de visita
          ══════════════════════════════════════════════════════════════════ */}
          {!loading && step === 'type' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                {
                  id: 'presencial' as const,
                  label: 'Visita presencial',
                  desc: 'Ven a conocer el espacio en persona',
                  icon: (
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={primaryColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                  ),
                },
                {
                  id: 'online' as const,
                  label: 'Videollamada',
                  desc: 'Os enseñamos el venue por video',
                  icon: (
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={primaryColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7"/>
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                  ),
                },
              ] as const).map(opt => {
                const sel = visitType === opt.id
                return (
                  <button key={opt.id} type="button"
                    onClick={() => { setVisitType(opt.id); setStep('info') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', borderRadius: 12,
                      border: `1.5px solid ${sel ? primaryColor : 'rgba(255,255,255,.12)'}`,
                      background: sel ? `${primaryColor}18` : 'rgba(255,255,255,.04)',
                      color: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                    }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${primaryColor}22`, border: `1px solid ${primaryColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {opt.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>{opt.desc}</div>
                    </div>
                    <ChevronRight size={16} color="rgba(255,255,255,.3)" />
                  </button>
                )
              })}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              PASO 2 — Fecha de boda + resumen de selecciones
          ══════════════════════════════════════════════════════════════════ */}
          {!loading && step === 'info' && (() => {
            const needsDatePick = allProposedDates.length > 1
            const canContinue = !needsDatePick || !!preferredWeddingDate

            // Auto-select if only 1 proposed date
            if (allProposedDates.length === 1 && !preferredWeddingDate) {
              setPreferredWeddingDate(allProposedDates[0].iso)
              setPreferredDateSlot(allProposedDates[0].slotIdx)
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* ── Visit type chip ─── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>
                    {visitType === 'online' ? '📹 Videollamada' : '🏠 Visita presencial'}
                  </span>
                  <button type="button" onClick={() => setStep('type')}
                    style={{ fontSize: 11, color: primaryColor, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                    cambiar
                  </button>
                </div>

                {/* ── Date picker (proposed wedding dates) ─── */}
                {allProposedDates.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
                      {needsDatePick ? 'Fecha de boda — elige una *' : 'Fecha de boda'}
                    </div>
                    {allProposedDates.length === 1 ? (
                      /* Single date — show as confirmed */
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, border: `1.5px solid ${primaryColor}`, background: `${primaryColor}18` }}>
                        <Check size={14} color={primaryColor} strokeWidth={3} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{dateLabelShort(allProposedDates[0].iso)}</span>
                        {allProposedDates[0].price && (
                          <span style={{ fontSize: 13, color: primaryColor, fontWeight: 600, marginLeft: 'auto' }}>{allProposedDates[0].price}</span>
                        )}
                      </div>
                    ) : (
                      /* Multiple dates — pick one */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {allProposedDates.map(({ iso, slotIdx, price }) => {
                          const sel = preferredWeddingDate === iso
                          return (
                            <button key={iso} type="button"
                              onClick={() => { setPreferredWeddingDate(iso); setPreferredDateSlot(slotIdx) }}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 16px', borderRadius: 10,
                                border: `1.5px solid ${sel ? primaryColor : 'rgba(255,255,255,.1)'}`,
                                background: sel ? `${primaryColor}18` : 'rgba(255,255,255,.03)',
                                color: '#fff', cursor: 'pointer', transition: 'all .15s',
                              }}>
                              <span style={{ fontSize: 14, fontWeight: sel ? 600 : 400 }}>{dateLabelShort(iso)}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {price && <span style={{ fontSize: 13, color: sel ? primaryColor : 'rgba(255,255,255,.4)', fontWeight: 600 }}>{price}</span>}
                                <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${sel ? primaryColor : 'rgba(255,255,255,.2)'}`, background: sel ? primaryColor : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {sel && <Check size={10} color="#fff" strokeWidth={3} />}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                        {!preferredWeddingDate && (
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>
                            Podéis cambiarla más adelante
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Menus summary ─── */}
                {selectedMenus.length > 0 && (
                  <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
                      Menú{selectedMenus.length > 1 ? 's' : ''}
                    </div>
                    {selectedMenus.map((m, i) => (
                      <div key={i} style={{ fontSize: 14, color: '#fff', fontWeight: 500, paddingTop: i > 0 ? 4 : 0 }}>{m}</div>
                    ))}
                  </div>
                )}

                {/* ── Extra services summary ─── */}
                {selectedExtraSvcs.length > 0 && (
                  <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
                      Servicios adicionales
                    </div>
                    {selectedExtraSvcs.map((s, i) => (
                      <div key={i} style={{ fontSize: 14, color: '#fff', fontWeight: 500, paddingTop: i > 0 ? 4 : 0 }}>{s}</div>
                    ))}
                  </div>
                )}

                {/* ── Spaces summary ─── */}
                {selectedSpaces.length > 0 && (
                  <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
                      Espacios
                    </div>
                    {selectedSpaces.map((s, i) => (
                      <div key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,.75)', paddingTop: i > 0 ? 4 : 0 }}>
                        {s.group_name}: <strong style={{ color: '#fff' }}>{s.space_name}</strong>
                      </div>
                    ))}
                  </div>
                )}

                <button type="button"
                  onClick={() => setStep('calendar')}
                  disabled={!canContinue}
                  style={{
                    padding: '14px 0', borderRadius: 10, border: 'none', fontSize: 15, fontWeight: 700,
                    background: canContinue ? primaryColor : 'rgba(255,255,255,.1)',
                    color: canContinue ? '#fff' : 'rgba(255,255,255,.3)',
                    cursor: canContinue ? 'pointer' : 'not-allowed',
                    transition: 'all .2s',
                  }}>
                  {needsDatePick && !preferredWeddingDate ? 'Elige una fecha para continuar' : 'Siguiente →'}
                </button>
              </div>
            )
          })()}

          {/* ══════════════════════════════════════════════════════════════════
              PASO 3 — Calendario, hora y envío
          ══════════════════════════════════════════════════════════════════ */}

          {/* No availability configured */}
          {!loading && Object.keys(slots).length === 0 && (step === 'calendar' || step === 'time' || step === 'confirm') && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,.4)', fontSize: 14 }}>
              No hay disponibilidad configurada.<br />
              <span style={{ fontSize: 12, marginTop: 4, display: 'block' }}>Contacta directamente con el venue.</span>
            </div>
          )}

          {/* Calendar */}
          {!loading && Object.keys(slots).length > 0 && step === 'calendar' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', padding: 4 }}><ChevronLeft size={16} /></button>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{MONTHS[viewMonth]} {viewYear}</span>
                <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', padding: 4 }}><ChevronRight size={16} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                {DAYS_SHORT.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', letterSpacing: '.06em', padding: '4px 0' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const iso = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
                  const available = hasSlotsOn(iso)
                  const isPast = iso < today
                  const isSel = selectedDate === iso
                  return (
                    <button key={day} type="button" onClick={() => selectDate(iso)}
                      disabled={!available || isPast}
                      style={{
                        aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: available && !isPast ? 600 : 400, borderRadius: 8, border: 'none',
                        cursor: available && !isPast ? 'pointer' : 'default',
                        background: isSel ? primaryColor : available && !isPast ? 'rgba(255,255,255,.08)' : 'transparent',
                        color: isSel ? '#fff' : available && !isPast ? '#fff' : 'rgba(255,255,255,.2)',
                        position: 'relative', transition: 'background .15s',
                      }}>
                      {day}
                      {available && !isPast && !isSel && (
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

          {/* Time slots */}
          {!loading && step === 'time' && selectedDate && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {(slots[selectedDate] ?? []).map(t => (
                  <button key={t} type="button" onClick={() => { setSelectedTime(t); setStep('confirm') }}
                    style={{
                      padding: '12px 0', borderRadius: 8,
                      border: `1px solid ${selectedTime === t ? primaryColor : 'rgba(255,255,255,.12)'}`,
                      background: selectedTime === t ? `${primaryColor}22` : 'rgba(255,255,255,.04)',
                      color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer', transition: 'all .15s',
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

          {/* Confirm + submit */}
          {!loading && step === 'confirm' && selectedDate && selectedTime && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Summary */}
              <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={rowLabel}>Tipo de visita</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{visitType === 'online' ? '📹 Videollamada' : '🏠 Presencial'}</div>
                </div>
                <div>
                  <div style={rowLabel}>Fecha y hora de la visita</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{dateLabel(selectedDate)} · {selectedTime}h</div>
                </div>
                {preferredWeddingDate && (
                  <div>
                    <div style={rowLabel}>Fecha de boda preferida</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                      {dateLabelShort(preferredWeddingDate)}
                      {preferredDateSlot !== null && dateSlots[preferredDateSlot]?.price_rental && (
                        <span style={{ color: primaryColor, marginLeft: 8 }}>{dateSlots[preferredDateSlot].price_rental}</span>
                      )}
                    </div>
                  </div>
                )}
                {selectedSpaces.length > 0 && (
                  <div>
                    <div style={rowLabel}>Espacios</div>
                    {selectedSpaces.map((s, i) => (
                      <div key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>{s.group_name}: <strong style={{ color: '#fff' }}>{s.space_name}</strong></div>
                    ))}
                  </div>
                )}
                {selectedMenus.length > 0 && (
                  <div>
                    <div style={rowLabel}>Menús</div>
                    {selectedMenus.map((m, i) => <div key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>{m}</div>)}
                  </div>
                )}
              </div>

              <div>
                <label style={{ ...rowLabel, display: 'block', marginBottom: 6 }}>Tu email (para la confirmación) *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="hola@email.com"
                  style={{ width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ ...rowLabel, display: 'block', marginBottom: 6 }}>Mensaje (opcional)</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                  placeholder="¿Algo que queráis comentar antes de la visita?"
                  style={{ width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, resize: 'none', boxSizing: 'border-box' }} />
              </div>

              {error && (
                <div style={{ fontSize: 12, color: '#fca5a5', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6, padding: '8px 12px' }}>{error}</div>
              )}

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

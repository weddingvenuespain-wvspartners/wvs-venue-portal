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

type MenuCartItem = { name: string; guests: number; courseSelections: string[] }
type CartSummary = { guests: number; menuItems: MenuCartItem[]; extras: Array<{ name: string; category: string; guests?: number }>; total: number }

type Props = {
  proposalId: string
  coupleName: string
  primaryColor?: string
  selectedSpaces?: Array<{ group_name: string; space_name: string }>
  selectedMenus?: string[]
  menuCart?: CartSummary | null
  guestCount?: number
  weddingDate?: string
  selectedExtraSvcs?: string[]
  spaceGroups?: Array<{ name: string; selection_mode?: string; optional?: boolean; requires_selection?: boolean }>
  dateSlots?: DateSlotOption[]
  preSelectedDateSlot?: number | null
  onClose: () => void
  onSuccess: () => void
}

// Steps: date_pick → type → info → calendar → time → confirm
// date_pick only shown if multiple proposed dates
type Step = 'date_pick' | 'type' | 'info' | 'calendar' | 'time' | 'confirm'
function stepNum(s: Step) {
  if (s === 'date_pick') return 0 // pre-step, not counted
  if (s === 'type') return 1
  if (s === 'info') return 2
  return 3
}

const TOTAL_STEPS = 3

export default function VisitBookingModal({
  proposalId, coupleName, primaryColor = '#4A6B52',
  selectedSpaces = [], selectedMenus = [], menuCart, guestCount, weddingDate,
  selectedExtraSvcs = [], spaceGroups,
  dateSlots = [], preSelectedDateSlot = null,
  onClose, onSuccess,
}: Props) {
  const [slots, setSlots] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)

  // Build flat list of all proposed dates
  const allProposedDates: Array<{ iso: string; slotIdx: number; price: string; label?: string }> = []
  ;(dateSlots ?? []).forEach((slot, si) => {
    if (!slot || !Array.isArray(slot.dates)) return
    const price = slot.price_rental || slot.price_per_person || ''
    slot.dates.forEach(d => allProposedDates.push({ iso: d, slotIdx: si, price, label: slot.label }))
  })
  allProposedDates.sort((a, b) => a.iso.localeCompare(b.iso))

  const multiDates = allProposedDates.length > 1
  const singleDate = allProposedDates.length === 1

  // Auto-select if single date
  const [preferredDateSlot, setPreferredDateSlot] = useState<number | null>(
    singleDate ? allProposedDates[0]?.slotIdx ?? preSelectedDateSlot : preSelectedDateSlot
  )
  const [preferredWeddingDate, setPreferredWeddingDate] = useState<string | null>(
    singleDate ? allProposedDates[0]?.iso ?? null : null
  )

  // Start on date_pick if multiple dates, otherwise type
  const [step, setStep] = useState<Step>(multiDates ? 'date_pick' : 'type')
  const [visitType, setVisitType] = useState<'presencial' | 'online' | null>(null)

  // Visit scheduling
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const today = todayIso()

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

  const goBack = () => {
    if (step === 'confirm') setStep('time')
    else if (step === 'time') setStep('calendar')
    else if (step === 'calendar') setStep('info')
    else if (step === 'info') setStep('type')
    else if (step === 'type' && multiDates) setStep('date_pick')
  }

  const submit = async () => {
    if (!selectedDate || !selectedTime) return
    if (!email.trim()) { setError('Indica tu email'); return }
    if (!isValidEmail(email)) { setError('Email no válido'); return }
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
  const cardBg: React.CSSProperties = {
    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 10, padding: '12px 16px',
  }

  // ── Step indicator ────────────────────────────────────────────────────────────
  const currentStep = stepNum(step)
  const displayStep = currentStep === 0 ? 0 : currentStep
  const StepBar = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
      {displayStep === 0 ? (
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', letterSpacing: '.04em' }}>
          Antes de empezar…
        </span>
      ) : (
        <>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => {
            const n = i + 1
            const active = n === displayStep
            const done = n < displayStep
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
            Paso {displayStep} de {TOTAL_STEPS}
          </span>
        </>
      )}
    </div>
  )

  const stepTitle = () => {
    if (step === 'date_pick') return '¿Qué fecha preferís para la boda?'
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
            {step !== 'date_pick' && step !== 'type' && (
              <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '0 0 8px' }}>
                <ChevronLeft size={14} /> Atrás
              </button>
            )}
            {step === 'type' && multiDates && (
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
              PRE-STEP — Pick wedding date (only if multiple)
          ══════════════════════════════════════════════════════════════════ */}
          {!loading && step === 'date_pick' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginBottom: 4, lineHeight: 1.5 }}>
                Se os han propuesto varias fechas. Elegid la que más os guste:
              </div>
              {allProposedDates.map(({ iso, slotIdx, price, label }) => {
                const sel = preferredWeddingDate === iso
                return (
                  <button key={iso} type="button"
                    onClick={() => {
                      setPreferredWeddingDate(iso)
                      setPreferredDateSlot(slotIdx)
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px', borderRadius: 12,
                      border: `1.5px solid ${sel ? primaryColor : 'rgba(255,255,255,.1)'}`,
                      background: sel ? `${primaryColor}18` : 'rgba(255,255,255,.03)',
                      color: '#fff', cursor: 'pointer', transition: 'all .15s', textAlign: 'left',
                    }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: sel ? 600 : 400 }}>{dateLabelShort(iso)}</div>
                      {label && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>{label}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {price && <span style={{ fontSize: 13, color: sel ? primaryColor : 'rgba(255,255,255,.4)', fontWeight: 600 }}>{price}</span>}
                      <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${sel ? primaryColor : 'rgba(255,255,255,.2)'}`, background: sel ? primaryColor : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {sel && <Check size={11} color="#fff" strokeWidth={3} />}
                      </div>
                    </div>
                  </button>
                )
              })}
              <button type="button"
                onClick={() => setStep('type')}
                disabled={!preferredWeddingDate}
                style={{
                  marginTop: 8, padding: '14px 0', borderRadius: 10, border: 'none', fontSize: 15, fontWeight: 700,
                  background: preferredWeddingDate ? primaryColor : 'rgba(255,255,255,.1)',
                  color: preferredWeddingDate ? '#fff' : 'rgba(255,255,255,.3)',
                  cursor: preferredWeddingDate ? 'pointer' : 'not-allowed',
                  transition: 'all .2s',
                }}>
                Siguiente →
              </button>
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
              PASO 2 — Resumen completo (carrito)
          ══════════════════════════════════════════════════════════════════ */}
          {!loading && step === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Helper text */}
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', lineHeight: 1.5, marginBottom: 2 }}>
                Si queréis cambiar algo, cerrad este modal y modificadlo en el dosier.
              </div>

              {/* Visit type chip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>
                  {visitType === 'online' ? '📹 Videollamada' : '🏠 Visita presencial'}
                </span>
                <button type="button" onClick={() => setStep('type')}
                  style={{ fontSize: 11, color: primaryColor, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                  cambiar
                </button>
              </div>

              {/* Wedding date + guests row */}
              {(preferredWeddingDate || weddingDate || guestCount) && (
                <div style={cardBg}>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {(preferredWeddingDate || weddingDate) && (
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={rowLabel}>Fecha de boda</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                          {dateLabelShort(preferredWeddingDate || weddingDate!)}
                        </div>
                        {preferredDateSlot !== null && dateSlots[preferredDateSlot]?.price_rental && (
                          <div style={{ fontSize: 12, color: primaryColor, fontWeight: 600, marginTop: 2 }}>{dateSlots[preferredDateSlot].price_rental}</div>
                        )}
                      </div>
                    )}
                    {guestCount && (
                      <div>
                        <div style={rowLabel}>Invitados</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{guestCount} personas</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Spaces */}
              {selectedSpaces.length > 0 && (
                <div style={cardBg}>
                  <div style={rowLabel}>Espacios</div>
                  {selectedSpaces.map((s, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,.75)', paddingTop: i > 0 ? 4 : 0 }}>
                      <span style={{ color: 'rgba(255,255,255,.4)' }}>{s.group_name}:</span>{' '}
                      <strong style={{ color: '#fff' }}>{s.space_name}</strong>
                    </div>
                  ))}
                </div>
              )}

              {/* Menus — rich cart from WeddingProposal */}
              {menuCart && menuCart.menuItems.length > 0 ? (
                <div style={cardBg}>
                  <div style={rowLabel}>Menú</div>
                  {menuCart.menuItems.map((m, i) => (
                    <div key={i} style={{ paddingTop: i > 0 ? 10 : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{m.name}</span>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.45)' }}>{m.guests} pers.</span>
                      </div>
                      {m.courseSelections.length > 0 && (
                        <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: `2px solid ${primaryColor}33` }}>
                          {m.courseSelections.map((cs, j) => (
                            <div key={j} style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', lineHeight: 1.6 }}>{cs}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {menuCart.total > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.08)' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.5)' }}>Total menú estimado</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: primaryColor }}>{menuCart.total.toLocaleString('es-ES')} €</span>
                    </div>
                  )}
                </div>
              ) : selectedMenus.length > 0 ? (
                /* Fallback: just names */
                <div style={cardBg}>
                  <div style={rowLabel}>Menú</div>
                  {selectedMenus.map((m, i) => (
                    <div key={i} style={{ fontSize: 14, color: '#fff', fontWeight: 500, paddingTop: i > 0 ? 4 : 0 }}>✓ {m}</div>
                  ))}
                </div>
              ) : null}

              {/* Extras from menu (noche/madrugada, añadidos, etc.) */}
              {menuCart && menuCart.extras.length > 0 && (
                <div style={cardBg}>
                  <div style={rowLabel}>Extras del evento</div>
                  {menuCart.extras.map((e, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#fff', paddingTop: i > 0 ? 3 : 0 }}>
                      <span>✓ {e.name}</span>
                      {e.guests && <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{e.guests} pers.</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Extra services (zone supplements, etc.) */}
              {selectedExtraSvcs.length > 0 && (
                <div style={cardBg}>
                  <div style={rowLabel}>Servicios adicionales</div>
                  {selectedExtraSvcs.map((s, i) => (
                    <div key={i} style={{ fontSize: 13, color: '#fff', fontWeight: 500, paddingTop: i > 0 ? 3 : 0 }}>✓ {s}</div>
                  ))}
                </div>
              )}

              {/* No selections */}
              {selectedSpaces.length === 0 && selectedMenus.length === 0 && selectedExtraSvcs.length === 0 && !(menuCart?.extras.length) && !preferredWeddingDate && !weddingDate && (
                <div style={{ ...cardBg, textAlign: 'center', color: 'rgba(255,255,255,.35)', fontSize: 13, padding: '20px 16px' }}>
                  No habéis seleccionado opciones todavía.<br/>
                  <span style={{ fontSize: 11 }}>Podéis hacerlo desde el dosier digital.</span>
                </div>
              )}

              <button type="button"
                onClick={() => setStep('calendar')}
                style={{
                  marginTop: 4, padding: '14px 0', borderRadius: 10, border: 'none', fontSize: 15, fontWeight: 700,
                  background: primaryColor, color: '#fff', cursor: 'pointer', transition: 'all .2s',
                }}>
                Siguiente →
              </button>
            </div>
          )}

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
              <div style={{ ...cardBg, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={rowLabel}>Tipo de visita</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{visitType === 'online' ? '📹 Videollamada' : '🏠 Presencial'}</div>
                </div>
                <div>
                  <div style={rowLabel}>Fecha y hora de la visita</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{dateLabel(selectedDate)} · {selectedTime}h</div>
                </div>
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
                <div style={{ fontSize: 12, color: '#E0C2BD', background: 'rgba(188,82,73,.1)', border: '1px solid rgba(188,82,73,.2)', borderRadius: 6, padding: '8px 12px' }}>{error}</div>
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

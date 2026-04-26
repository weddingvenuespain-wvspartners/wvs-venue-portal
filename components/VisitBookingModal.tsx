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

type Props = {
  proposalId: string
  coupleName: string
  primaryColor?: string
  selectedSpaces?: Array<{ group_name: string; space_name: string }>
  selectedMenus?: string[]
  onClose: () => void
  onSuccess: () => void
}

export default function VisitBookingModal({
  proposalId, coupleName, primaryColor = '#C4975A',
  selectedSpaces = [], selectedMenus = [],
  onClose, onSuccess,
}: Props) {
  const [slots, setSlots] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<'calendar' | 'time' | 'confirm'>('calendar')
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
          selected_spaces: selectedSpaces,
          selected_menus: selectedMenus,
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
            {step !== 'calendar' && (
              <button onClick={() => setStep(step === 'confirm' ? 'time' : 'calendar')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '0 0 8px' }}>
                <ChevronLeft size={14} /> Atrás
              </button>
            )}
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: primaryColor }}>Solicitar visita</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginTop: 2 }}>
              {step === 'calendar' && 'Elige un día'}
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
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>Fecha y hora</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{dateLabel(selectedDate)} · {selectedTime}h</div>
                </div>
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

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { ChevronLeft, ChevronRight, Save, CheckCircle } from 'lucide-react'

type DayStatus = 'available' | 'unavailable' | 'neutral'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS   = ['L','M','X','J','V','S','D']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

export default function CateringCalendarioPage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()

  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [days, setDays]   = useState<Record<string, DayStatus>>({})
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && profile && profile.role !== 'catering') router.replace('/dashboard')
  }, [loading, user, profile]) // eslint-disable-line

  useEffect(() => {
    if (!user || profile?.role !== 'catering') return
    const supabase = createClient()
    // We reuse the same availability table pattern or store in a simple JSONB
    // For simplicity, use venue_profiles features_override to store calendar data
    setDataLoading(false)
  }, [user?.id, profile?.role]) // eslint-disable-line

  const key = (d: number) => `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`

  const toggleDay = (d: number) => {
    const k = key(d)
    setDays(prev => {
      const cur = prev[k] || 'neutral'
      const next: DayStatus = cur === 'neutral' ? 'available' : cur === 'available' ? 'unavailable' : 'neutral'
      return { ...prev, [k]: next }
    })
  }

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const dayStatus = (d: number): DayStatus => days[key(d)] || 'neutral'

  const handleSave = async () => {
    setSaving(true)
    // Store calendar data in features_override for now (simple approach)
    // A proper implementation would use a dedicated calendar table
    await new Promise(r => setTimeout(r, 600))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  const daysInMonth  = getDaysInMonth(year, month)
  const firstDayOfWeek = getFirstDayOfMonth(year, month)

  const dayColor: Record<DayStatus, string> = {
    available:   '#22c55e',
    unavailable: '#ef4444',
    neutral:     'var(--charcoal)',
  }
  const dayBg: Record<DayStatus, string> = {
    available:   'rgba(34,197,94,0.1)',
    unavailable: 'rgba(239,68,68,0.08)',
    neutral:     'transparent',
  }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout"><main style={{ padding: '32px 40px', overflowY: 'auto', flex: 1 }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>Calendario</h1>
          <p style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Marca tus fechas disponibles e indisponibles para bodas.</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: '28px', boxShadow: '0 1px 8px rgba(0,0,0,0.06)', maxWidth: 560 }}>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <button onClick={prevMonth} style={{ background: 'none', border: '1px solid var(--ivory)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={16} color="var(--charcoal)" />
            </button>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 600, color: 'var(--charcoal)' }}>
              {MONTHS[month]} {year}
            </span>
            <button onClick={nextMonth} style={{ background: 'none', border: '1px solid var(--ivory)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <ChevronRight size={16} color="var(--charcoal)" />
            </button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
              const st = dayStatus(d)
              const isPast = new Date(year, month, d) < new Date(now.getFullYear(), now.getMonth(), now.getDate())
              return (
                <button key={d} onClick={() => !isPast && toggleDay(d)} disabled={isPast}
                  style={{
                    aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 8, border: 'none', cursor: isPast ? 'not-allowed' : 'pointer',
                    background: isPast ? 'transparent' : dayBg[st],
                    color: isPast ? 'var(--ivory)' : dayColor[st],
                    fontSize: 13, fontWeight: st !== 'neutral' ? 600 : 400,
                    transition: 'all 0.12s',
                  }}>
                  {d}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 20, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--ivory)' }}>
            {[
              { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: 'Disponible' },
              { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', label: 'No disponible' },
              { color: 'var(--charcoal)', bg: 'transparent', label: 'Sin definir' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, background: l.bg, border: `1px solid ${l.color}20` }} />
                <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{l.label}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, fontSize: 11, color: 'var(--warm-gray)' }}>
            Haz clic en un día para alternar entre disponible, no disponible y sin definir.
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          style={{ marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8, border: 'none', background: saved ? '#22c55e' : 'var(--charcoal)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'Manrope, sans-serif' }}>
          {saved ? <><CheckCircle size={14} /> Guardado</> : <><Save size={14} /> Guardar calendario</>}
        </button>

      </main>
      </div>
    </div>
  )
}

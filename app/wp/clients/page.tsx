'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Heart, Plus, Search, ChevronRight, Building2, Calendar, Users, Send, Eye, FileText, X, Trash2 } from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = { draft: 'Borrador', sent: 'Enviada', viewed: 'Vista' }
const STATUS_COLOR: Record<string, string>  = { draft: 'var(--warm-gray)', sent: '#f59e0b', viewed: '#22c55e' }
const STATUS_BG: Record<string, string>     = { draft: 'rgba(100,100,100,0.08)', sent: 'rgba(245,158,11,0.1)', viewed: 'rgba(34,197,94,0.1)' }

const BUDGET_OPTS: [string, string][] = [
  ['menos_5k',  '< 5.000 €'],
  ['5k_10k',    '5.000 – 10.000 €'],
  ['10k_20k',   '10.000 – 20.000 €'],
  ['20k_35k',   '20.000 – 35.000 €'],
  ['35k_50k',   '35.000 – 50.000 €'],
  ['mas_50k',   '> 50.000 €'],
]
const BUDGET_LABEL: Record<string, string> = Object.fromEntries([['sin_definir','Sin definir'], ...BUDGET_OPTS])

const CEREMONY_OPTS: [string, string][] = [
  ['sin_definir', 'Sin especificar'],
  ['civil',       'Civil'],
  ['religiosa',   'Religiosa'],
  ['simbolica',   'Simbólica'],
]

const LANG_PRESETS = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'Inglés' },
  { code: 'ca', label: 'Catalán' },
  { code: 'fr', label: 'Francés' },
  { code: 'it', label: 'Italiano' },
  { code: 'de', label: 'Alemán' },
  { code: 'pt', label: 'Portugués' },
]

const DATE_FLEX_OPTS = [
  { value: 'exact',       label: 'Fecha exacta'  },
  { value: 'range',       label: 'Rango'          },
  { value: 'multi_range', label: 'Varios rangos'  },
  { value: 'month',       label: 'Mes'            },
  { value: 'season',      label: 'Estación'       },
  { value: 'flexible',    label: 'Flexible'       },
]

const SEASONS = [
  { value: 'spring', label: 'Primavera' },
  { value: 'summer', label: 'Verano'    },
  { value: 'autumn', label: 'Otoño'     },
  { value: 'winter', label: 'Invierno'  },
]

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const thisYear = new Date().getFullYear()
const YEAR_OPTS = Array.from({ length: 7 }, (_, i) => thisYear + i)

// ── Empty form ────────────────────────────────────────────────────────────────

const emptyForm = () => ({
  name:                '',
  email:               '',
  phone:               '',
  whatsapp:            '',
  // date
  date_flexibility:    'exact',
  wedding_date:        '',
  wedding_date_to:     '',
  wedding_date_ranges: [] as { from: string; to: string }[],
  wedding_year:        String(thisYear + 1),
  wedding_month:       '6',
  wedding_season:      'summer',
  // other
  guest_count:         '',
  ceremony_type:       'sin_definir',
  language:            '',
  budget:              '',
  notes:               '',
})

// ── Language tag picker ───────────────────────────────────────────────────────

function LanguagePicker({ value, onChange, inputSt }: { value: string; onChange: (v: string) => void; inputSt: React.CSSProperties }) {
  const tags = (value || '').split(',').map(s => s.trim()).filter(Boolean)
  const labelFor = (t: string) => LANG_PRESETS.find(p => p.code === t)?.label || t

  const addCode = (code: string) => {
    if (tags.includes(code)) return
    onChange([...tags, code].join(','))
  }
  const remove = (idx: number) => onChange(tags.filter((_, i) => i !== idx).join(','))

  return (
    <div>
      {/* Selected tags */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {tags.map((t, i) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: 'rgba(196,151,90,0.12)', border: '1px solid rgba(196,151,90,0.3)', fontSize: 12, color: 'var(--charcoal)', fontWeight: 600 }}>
              {labelFor(t)}
              <button type="button" onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 0, display: 'flex', alignItems: 'center' }}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Quick picks */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {LANG_PRESETS.filter(p => !tags.includes(p.code)).map(p => (
          <button key={p.code} type="button" onClick={() => addCode(p.code)}
            style={{ padding: '4px 11px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--warm-gray)', fontWeight: 500, transition: 'all 0.12s' }}
            onMouseOver={e => { (e.target as HTMLButtonElement).style.borderColor = 'var(--gold)'; (e.target as HTMLButtonElement).style.color = 'var(--gold)' }}
            onMouseOut={e => { (e.target as HTMLButtonElement).style.borderColor = 'var(--ivory)'; (e.target as HTMLButtonElement).style.color = 'var(--warm-gray)' }}
          >
            + {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Date picker (no calendar, just inputs) ────────────────────────────────────

function DatePicker({ form, set, inputSt }: { form: ReturnType<typeof emptyForm>; set: (k: string, v: any) => void; inputSt: React.CSSProperties }) {
  const addRange = () => set('wedding_date_ranges', [...form.wedding_date_ranges, { from: '', to: '' }])
  const updateRange = (i: number, field: 'from' | 'to', v: string) => {
    const next = form.wedding_date_ranges.map((r, idx) => idx === i ? { ...r, [field]: v } : r)
    set('wedding_date_ranges', next)
  }
  const removeRange = (i: number) => set('wedding_date_ranges', form.wedding_date_ranges.filter((_, idx) => idx !== i))

  return (
    <div>
      {/* Pills */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
        {DATE_FLEX_OPTS.map(opt => (
          <button key={opt.value} type="button" onClick={() => set('date_flexibility', opt.value)} style={{
            padding: '5px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: '1px solid', fontWeight: 500, transition: 'all 0.12s',
            borderColor: form.date_flexibility === opt.value ? 'var(--gold)' : 'var(--ivory)',
            background:  form.date_flexibility === opt.value ? 'var(--gold)' : 'transparent',
            color:       form.date_flexibility === opt.value ? '#fff' : 'var(--warm-gray)',
          }}>{opt.label}</button>
        ))}
      </div>

      {/* EXACT */}
      {form.date_flexibility === 'exact' && (
        <input type="date" value={form.wedding_date} onChange={e => set('wedding_date', e.target.value)}
          style={inputSt} />
      )}

      {/* RANGE */}
      {form.date_flexibility === 'range' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 4 }}>Desde</div>
            <input type="date" value={form.wedding_date} onChange={e => set('wedding_date', e.target.value)} style={inputSt} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 4 }}>Hasta</div>
            <input type="date" value={form.wedding_date_to} onChange={e => set('wedding_date_to', e.target.value)} min={form.wedding_date || undefined} style={inputSt} />
          </div>
        </div>
      )}

      {/* MULTI_RANGE */}
      {form.date_flexibility === 'multi_range' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {form.wedding_date_ranges.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--warm-gray)', flexShrink: 0, minWidth: 56 }}>Opción {i + 1}</span>
              <input type="date" value={r.from} onChange={e => updateRange(i, 'from', e.target.value)} style={{ ...inputSt, flex: 1 }} />
              <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>–</span>
              <input type="date" value={r.to} onChange={e => updateRange(i, 'to', e.target.value)} min={r.from || undefined} style={{ ...inputSt, flex: 1 }} />
              <button type="button" onClick={() => removeRange(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4, display: 'flex', alignItems: 'center' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addRange}
            style={{ alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px dashed var(--ivory)', background: 'transparent', color: 'var(--warm-gray)', fontWeight: 500 }}>
            + Añadir opción
          </button>
        </div>
      )}

      {/* MONTH */}
      {form.date_flexibility === 'month' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
          <select value={form.wedding_month} onChange={e => set('wedding_month', e.target.value)} style={inputSt}>
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select value={form.wedding_year} onChange={e => set('wedding_year', e.target.value)} style={{ ...inputSt, width: 110 }}>
            {YEAR_OPTS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}

      {/* SEASON */}
      {form.date_flexibility === 'season' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {SEASONS.map(s => {
            const active = form.wedding_season === s.value
            return (
              <button key={s.value} type="button" onClick={() => set('wedding_season', s.value)}
                style={{ padding: '6px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: `1.5px solid ${active ? 'var(--gold)' : 'var(--ivory)'}`, background: active ? 'var(--gold)' : '#fff', color: active ? '#fff' : 'var(--charcoal)', fontWeight: active ? 700 : 500, transition: 'all 0.15s' }}>
                {s.label}
              </button>
            )
          })}
          <select value={form.wedding_year} onChange={e => set('wedding_year', e.target.value)} style={{ ...inputSt, width: 110 }}>
            {YEAR_OPTS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}

      {/* FLEXIBLE */}
      {form.date_flexibility === 'flexible' && (
        <div style={{ fontSize: 13, color: 'var(--warm-gray)', fontStyle: 'italic', padding: '10px 14px', background: 'var(--cream)', borderRadius: 8, border: '1px solid var(--ivory)' }}>
          La pareja es flexible — acordaréis la fecha más adelante.
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()

  const [clients, setClients]   = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [search, setSearch]     = useState('')
  const [dataLoading, setDataLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState(emptyForm())
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && profile && profile.role !== 'wedding_planner') router.replace('/dashboard')
  }, [loading, user, profile]) // eslint-disable-line

  const load = async () => {
    if (!user) return
    const supabase = createClient()
    const { data } = await supabase
      .from('wp_clients')
      .select('*, wp_client_venues(id, availability_status), wp_client_caterings(id)')
      .eq('planner_id', user.id)
      .order('created_at', { ascending: false })
    setClients(data || [])
    setFiltered(data || [])
    setDataLoading(false)
  }

  useEffect(() => { if (user && profile?.role === 'wedding_planner') load() }, [user?.id, profile?.role]) // eslint-disable-line

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(clients.filter(c => c.name.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)))
  }, [search, clients])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const openModal = () => { setForm(emptyForm()); setFormError(''); setShowModal(true) }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim())                                  { setFormError('El nombre de la pareja es obligatorio'); return }
    if (!form.email.trim() && !form.phone.trim())           { setFormError('Indica al menos un email o teléfono'); return }
    if (!form.guest_count)                                  { setFormError('El número de invitados es obligatorio'); return }
    if (!form.language.trim())                              { setFormError('Selecciona el idioma de la pareja'); return }
    if (!form.budget)                                       { setFormError('Selecciona el presupuesto orientativo'); return }
    if (form.date_flexibility === 'exact' && !form.wedding_date) { setFormError('Indica la fecha de boda'); return }
    if (form.date_flexibility === 'range' && !form.wedding_date) { setFormError('Indica la fecha de inicio del rango'); return }
    if (form.date_flexibility === 'multi_range' && !form.wedding_date_ranges.some(r => r.from)) { setFormError('Añade al menos un rango de fechas'); return }

    setSaving(true)
    setFormError('')
    try {
      const supabase = createClient()

      // Build date payload
      const dateFlex = form.date_flexibility
      const weddingDate = ['exact', 'range'].includes(dateFlex) ? (form.wedding_date || null) : null
      const weddingDateTo = dateFlex === 'range' ? (form.wedding_date_to || null) : null
      const weddingDateRanges = dateFlex === 'multi_range' ? form.wedding_date_ranges.filter(r => r.from) : null
      const weddingYear = ['month', 'season'].includes(dateFlex) ? parseInt(form.wedding_year) : null
      const weddingMonth = dateFlex === 'month' ? parseInt(form.wedding_month) : null
      const weddingSeason = dateFlex === 'season' ? form.wedding_season : null

      const { error } = await supabase.from('wp_clients').insert({
        planner_id:          user!.id,
        name:                form.name.trim(),
        email:               form.email.trim() || null,
        phone:               form.phone.trim() || null,
        whatsapp:            form.whatsapp.trim() || null,
        source:              'wvs_planner',
        date_flexibility:    dateFlex,
        wedding_date:        weddingDate,
        wedding_date_to:     weddingDateTo,
        wedding_date_ranges: weddingDateRanges,
        wedding_year:        weddingYear,
        wedding_month:       weddingMonth,
        wedding_season:      weddingSeason,
        guest_count:         parseInt(form.guest_count),
        ceremony_type:       form.ceremony_type !== 'sin_definir' ? form.ceremony_type : null,
        language:            form.language.trim(),
        budget:              form.budget,
        notes:               form.notes.trim() || null,
      })
      if (error) throw error
      setShowModal(false)
      load()
    } catch (e: any) {
      setFormError(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--ivory)', background: 'var(--cream)',
    fontSize: 13, color: 'var(--charcoal)', outline: 'none',
    fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
  }

  const labelSt: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6,
  }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout"><main style={{ padding: '32px 40px', overflowY: 'auto', flex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>Mis parejas</h1>
            <p style={{ fontSize: 13, color: 'var(--warm-gray)' }}>{clients.length} pareja{clients.length !== 1 ? 's' : ''} registrada{clients.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={openModal} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px',
            borderRadius: 8, background: 'var(--charcoal)', color: '#fff',
            fontSize: 13, fontWeight: 500, fontFamily: 'Manrope, sans-serif', border: 'none', cursor: 'pointer',
          }}>
            <Plus size={14} /> Nueva pareja
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 20, maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
          <input
            placeholder="Buscar pareja..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputSt, paddingLeft: 34, background: '#fff' }}
          />
        </div>

        {/* List */}
        {dataLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <div style={{ width: 20, height: 20, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <Heart size={40} style={{ color: 'var(--ivory)', marginBottom: 14 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>
              {search ? 'Sin resultados' : 'Aún no tienes parejas'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 20 }}>
              {search ? 'Prueba con otro nombre o email' : 'Añade tu primera pareja para empezar a gestionar propuestas'}
            </div>
            {!search && (
              <button onClick={openModal} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px',
                borderRadius: 8, background: 'var(--charcoal)', color: '#fff',
                fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
              }}>
                <Plus size={13} /> Añadir pareja
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filtered.map((c: any) => {
              const venueCount    = c.wp_client_venues?.length || 0
              const cateringCount = c.wp_client_caterings?.length || 0
              const availPending  = (c.wp_client_venues || []).filter((v: any) => v.availability_status === 'requested').length
              return (
                <Link key={c.id} href={`/wp/clients/${c.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: '#fff', borderRadius: 12, padding: '18px 20px',
                    boxShadow: '0 1px 6px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 16,
                    transition: 'box-shadow 0.15s, transform 0.12s', cursor: 'pointer',
                  }}
                    onMouseOver={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.09)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseOut={e => { e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'none' }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(196,151,90,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Heart size={20} color="var(--gold)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>{c.name}</div>
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        {c.wedding_date && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--warm-gray)' }}>
                            <Calendar size={11} />
                            {new Date(c.wedding_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </span>
                        )}
                        {c.guest_count && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--warm-gray)' }}>
                            <Users size={11} /> {c.guest_count} inv.
                          </span>
                        )}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--warm-gray)' }}>
                          <Building2 size={11} /> {venueCount} venue{venueCount !== 1 ? 's' : ''}
                        </span>
                        {cateringCount > 0 && (
                          <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>· {cateringCount} catering</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      {availPending > 0 && (
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontWeight: 600 }}>
                          {availPending} pendiente{availPending !== 1 ? 's' : ''}
                        </span>
                      )}
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: STATUS_BG[c.proposal_status], color: STATUS_COLOR[c.proposal_status], fontWeight: 600 }}>
                        {STATUS_LABEL[c.proposal_status]}
                      </span>
                      <ChevronRight size={14} color="var(--warm-gray)" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
      </div>

      {/* Modal nueva pareja */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

            {/* Modal header */}
            <div style={{ padding: '24px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--charcoal)', margin: 0 }}>Nueva pareja</h2>
                <p style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 3, marginBottom: 0 }}>Vía WVS Planner · Los campos con * son obligatorios</p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ padding: '20px 28px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {formError && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13 }}>
                  {formError}
                </div>
              )}

              {/* Nombre */}
              <div>
                <label style={labelSt}>Nombre de la pareja *</label>
                <input placeholder="Ej: María & Juan" value={form.name} onChange={e => set('name', e.target.value)} style={inputSt} />
              </div>

              {/* Email + Teléfono */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelSt}>Email *</label>
                  <input type="email" placeholder="maria@email.com" value={form.email} onChange={e => set('email', e.target.value)} style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>Teléfono *</label>
                  <input type="tel" placeholder="+34 600 000 000" value={form.phone} onChange={e => set('phone', e.target.value)} style={inputSt} />
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--warm-gray)', margin: '-8px 0 0', fontStyle: 'italic' }}>* Al menos email o teléfono es obligatorio</p>

              {/* WhatsApp */}
              <div>
                <label style={labelSt}>WhatsApp <span style={{ fontWeight: 400, color: 'var(--warm-gray)' }}>(si es distinto al teléfono)</span></label>
                <input type="tel" placeholder="+34 600 000 000" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} style={inputSt} />
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid var(--ivory)' }} />

              {/* Fecha */}
              <div>
                <label style={labelSt}>Fecha de boda *</label>
                <DatePicker form={form} set={set} inputSt={inputSt} />
              </div>

              {/* Invitados */}
              <div>
                <label style={labelSt}>Número de invitados *</label>
                <input type="number" placeholder="150" min={1} value={form.guest_count} onChange={e => set('guest_count', e.target.value)} style={inputSt} />
              </div>

              {/* Tipo de ceremonia */}
              <div>
                <label style={labelSt}>Tipo de ceremonia</label>
                <select value={form.ceremony_type} onChange={e => set('ceremony_type', e.target.value)} style={inputSt}>
                  {CEREMONY_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {/* Idioma */}
              <div>
                <label style={labelSt}>Idioma de la pareja *</label>
                <LanguagePicker value={form.language} onChange={v => set('language', v)} inputSt={inputSt} />
              </div>

              {/* Presupuesto */}
              <div>
                <label style={labelSt}>Presupuesto orientativo *</label>
                <select value={form.budget} onChange={e => set('budget', e.target.value)} style={inputSt}>
                  <option value="">Selecciona un rango</option>
                  {BUDGET_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {/* Notas internas */}
              <div>
                <label style={labelSt}>Notas internas <span style={{ fontWeight: 400, color: 'var(--warm-gray)' }}>(opcional)</span></label>
                <textarea placeholder="Preferencias, notas de la primera llamada…" value={form.notes} onChange={e => set('notes', e.target.value)}
                  style={{ ...inputSt, minHeight: 72, resize: 'vertical', padding: '9px 12px' }} />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--charcoal)', fontSize: 13, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--charcoal)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Guardando…' : 'Crear pareja'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  )
}

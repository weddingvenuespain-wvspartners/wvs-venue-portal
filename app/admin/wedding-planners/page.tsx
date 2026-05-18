'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Heart, Phone, Mail, Users, Calendar, MessageSquare, MapPin, RefreshCw, ChevronDown } from 'lucide-react'

type PlannerLead = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  guests: string | null
  wedding_date: string | null
  budget: string | null
  initial_message: string | null
  whatsapp_consent: boolean
  planner_status: string
  source: string | null
  created_at: string
  venue_id: string | null
  venue_name?: string | null
  venue_location?: string | null
}

const BUDGET_LABEL: Record<string, string> = {
  'sin_definir':    'Sin definir',
  'menos_10k':      '< 10.000 €',
  '10k_15k':        '10.000–15.000 €',
  '10k_20k':        '10.000–20.000 €',
  '15k_20k':        '15.000–20.000 €',
  '20k_25k':        '20.000–25.000 €',
  '25k_30k':        '25.000–30.000 €',
  '20k_35k':        '20.000–35.000 €',
  '30k_40k':        '30.000–40.000 €',
  '35k_50k':        '35.000–50.000 €',
  '40k_50k':        '40.000–50.000 €',
  '40k_51k':        '40.000–51.000 €',
  '50k_75k':        '50.000–75.000 €',
  '51k_60k':        '51.000–60.000 €',
  '75k_100k':       '75.000–100.000 €',
  'mas_50k':        '> 50.000 €',
  'mas_60k':        '> 60.000 €',
  'mas_75k':        '> 75.000 €',
  'mas_100k':       '> 100.000 €',
  'wvs_menos_20k':  '< 20.000 €',
  'wvs_20k_35k':    '20.000–35.000 €',
  'wvs_35k_40k':    '35.000–40.000 €',
  'wvs_40k_51k':    '40.000–51.000 €',
  'wvs_51k_60k':    '51.000–60.000 €',
  'wvs_mas_60k':    '> 60.000 €',
}

const TABS = [
  { key: 'new',        label: 'Nuevas',      color: '#2E6DB4' },
  { key: 'contacted',  label: 'Contactadas', color: '#3b82f6' },
  { key: 'accepted',   label: 'Aceptadas',   color: '#22c55e' },
  { key: 'cancelled',  label: 'Canceladas',  color: '#6b7280' },
] as const

type TabKey = typeof TABS[number]['key']

const STATUS_OPTIONS = [
  { value: 'new',        label: 'Nueva',      color: '#2E6DB4' },
  { value: 'contacted',  label: 'Contactada', color: '#3b82f6' },
  { value: 'accepted',   label: 'Aceptada',   color: '#22c55e' },
  { value: 'cancelled',  label: 'Cancelada',  color: '#6b7280' },
]

function fmtDate(d: string | null) {
  if (!d) return '—'
  // Handle both YYYY-MM-DD and full ISO timestamps
  const date = d.length <= 10 ? new Date(d + 'T12:00:00') : new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function WeddingPlannersPage() {
  const router = useRouter()
  const { user, loading: authLoading, profile } = useAuth()
  const [leads, setLeads] = useState<PlannerLead[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('new')
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null)

  // Close status dropdown on outside click
  useEffect(() => {
    if (!statusMenuId) return
    const close = () => setStatusMenuId(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [statusMenuId])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    if (profile && profile.role !== 'admin') { router.push('/'); return }
    load()
  }, [user, authLoading, profile]) // eslint-disable-line

  const load = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, email, phone, guests, wedding_date, budget, initial_message, whatsapp_consent, planner_status, source, created_at, venue_id')
      .eq('wants_wedding_planner', true)
      .order('created_at', { ascending: false })
    if (error) { console.error(error); setLoading(false); return }

    // Enrich with venue names + locations
    const venueIds = [...new Set((data || []).map((l: any) => l.venue_id).filter(Boolean))]
    let venueMap: Record<string, { name: string; location: string | null }> = {}
    if (venueIds.length) {
      const { data: venues } = await supabase
        .from('user_venues')
        .select('id, name')
        .in('id', venueIds)

      // Get locations from venue_onboarding
      const { data: onbs } = await supabase
        .from('venue_onboarding')
        .select('venue_id, ficha_data')
        .in('venue_id', venueIds)

      const locationMap: Record<string, string> = {}
      if (onbs) onbs.forEach((o: any) => {
        if (o.venue_id && o.ficha_data?.location) locationMap[o.venue_id] = o.ficha_data.location
      })

      if (venues) venues.forEach((v: any) => {
        venueMap[v.id] = { name: v.name, location: locationMap[v.id] || null }
      })
    }

    setLeads((data || []).map((l: any) => ({
      ...l,
      planner_status: l.planner_status || 'new',
      venue_name: l.venue_id ? venueMap[l.venue_id]?.name || null : null,
      venue_location: l.venue_id ? venueMap[l.venue_id]?.location || null : null,
    })))
    setLoading(false)
  }

  const updateStatus = async (leadId: string, newStatus: string) => {
    const supabase = createClient()
    await supabase.from('leads').update({ planner_status: newStatus }).eq('id', leadId)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, planner_status: newStatus } : l))
    setStatusMenuId(null)
    // Notify sidebar to refresh WP badge count
    window.dispatchEvent(new Event('wvs-wp-badge-refresh'))
  }

  const filtered = leads.filter(l => l.planner_status === activeTab)

  const tabCounts = TABS.reduce((acc, t) => {
    acc[t.key] = leads.filter(l => l.planner_status === t.key).length
    return acc
  }, {} as Record<TabKey, number>)

  if (loading || authLoading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold)' }}>Cargando...</div>
    </div>
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Peticiones Wedding Planner</div>
          <button className="btn btn-ghost" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <RefreshCw size={13} /> Actualizar
          </button>
        </div>
        <div className="page-content">

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--ivory)' }}>
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
                  color: activeTab === tab.key ? tab.color : 'var(--warm-gray)',
                  borderBottom: activeTab === tab.key ? `2px solid ${tab.color}` : '2px solid transparent',
                  marginBottom: -2, transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {tab.label}
                {tabCounts[tab.key] > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                    background: activeTab === tab.key ? tab.color : 'var(--ivory)',
                    color: activeTab === tab.key ? '#fff' : 'var(--warm-gray)',
                  }}>
                    {tabCounts[tab.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="card" style={{ padding: '48px 32px', textAlign: 'center' }}>
              <Heart size={32} style={{ color: 'var(--ivory)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, color: 'var(--warm-gray)' }}>
                No hay peticiones {TABS.find(t => t.key === activeTab)?.label.toLowerCase()}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'visible' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--cream)', borderBottom: '1px solid var(--ivory)' }}>
                    {['Pareja', 'Contacto', 'Venue', 'Ubicación', 'Fecha / Invitados', 'Presupuesto', 'Estado', 'Recibida'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--warm-gray)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(lead => (<>
                    <tr
                      key={lead.id}
                      onClick={() => lead.initial_message && setExpanded(expanded === lead.id ? null : lead.id)}
                      style={{ borderBottom: expanded === lead.id ? 'none' : '1px solid var(--ivory)', cursor: lead.initial_message ? 'pointer' : 'default', background: expanded === lead.id ? '#fdf8f4' : '#fff', transition: 'background 0.1s' }}
                    >
                      {/* Pareja */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--espresso)' }}>{lead.name || '—'}</div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                          {lead.whatsapp_consent && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 10, background: '#dcfce7', fontSize: 9, fontWeight: 600, color: '#16a34a' }}>
                              ✓ WhatsApp
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Contacto */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {lead.email && <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--charcoal)', fontSize: 12 }}><Mail size={10} style={{ color: 'var(--warm-gray)' }} />{lead.email}</div>}
                          {lead.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--charcoal)', fontSize: 12 }}><Phone size={10} style={{ color: 'var(--warm-gray)' }} />{lead.phone}</div>}
                        </div>
                      </td>
                      {/* Venue */}
                      <td style={{ padding: '12px 14px', color: lead.venue_name ? 'var(--espresso)' : 'var(--warm-gray)', fontStyle: lead.venue_name ? 'normal' : 'italic', fontWeight: 500 }}>
                        {lead.venue_name || '—'}
                      </td>
                      {/* Ubicación */}
                      <td style={{ padding: '12px 14px' }}>
                        {lead.venue_location ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--charcoal)', fontSize: 12 }}>
                            <MapPin size={10} style={{ color: 'var(--warm-gray)' }} />{lead.venue_location}
                          </div>
                        ) : <span style={{ color: 'var(--warm-gray)' }}>—</span>}
                      </td>
                      {/* Fecha / Invitados */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--charcoal)', fontSize: 12 }}><Calendar size={10} style={{ color: 'var(--warm-gray)' }} />{fmtDate(lead.wedding_date)}</div>
                          {lead.guests && <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--charcoal)', fontSize: 12 }}><Users size={10} style={{ color: 'var(--warm-gray)' }} />{lead.guests}</div>}
                        </div>
                      </td>
                      {/* Presupuesto */}
                      <td style={{ padding: '12px 14px', color: 'var(--charcoal)', fontSize: 12 }}>
                        {BUDGET_LABEL[lead.budget || 'sin_definir'] || '—'}
                      </td>
                      {/* Estado */}
                      <td style={{ padding: '12px 14px', position: 'relative' }}>
                        <button
                          onMouseDown={(e) => { e.stopPropagation(); setStatusMenuId(statusMenuId === lead.id ? null : lead.id) }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '4px 10px', borderRadius: 8, border: '1px solid var(--ivory)',
                            background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                            color: STATUS_OPTIONS.find(s => s.value === lead.planner_status)?.color || 'var(--warm-gray)',
                          }}
                        >
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_OPTIONS.find(s => s.value === lead.planner_status)?.color }} />
                          {STATUS_OPTIONS.find(s => s.value === lead.planner_status)?.label}
                          <ChevronDown size={10} />
                        </button>
                        {statusMenuId === lead.id && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 14, zIndex: 50,
                            background: '#fff', border: '1px solid var(--ivory)', borderRadius: 10,
                            boxShadow: '0 4px 16px rgba(0,0,0,0.1)', padding: 4, minWidth: 140,
                          }}>
                            {STATUS_OPTIONS.filter(s => s.value !== lead.planner_status).map(opt => (
                              <button
                                key={opt.value}
                                onMouseDown={(e) => { e.stopPropagation(); updateStatus(lead.id, opt.value) }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                                  padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer',
                                  fontSize: 12, color: opt.color, fontWeight: 500, borderRadius: 6,
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#f9f7f2')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                              >
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: opt.color }} />
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      {/* Recibida */}
                      <td style={{ padding: '12px 14px', color: 'var(--warm-gray)', fontSize: 12 }}>
                        {fmtDate(lead.created_at)}
                      </td>
                    </tr>
                    {expanded === lead.id && lead.initial_message && (
                      <tr key={`${lead.id}-msg`} style={{ background: '#fdf8f4', borderBottom: '1px solid var(--ivory)' }}>
                        <td colSpan={8} style={{ padding: '0 14px 14px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <MessageSquare size={13} style={{ color: 'var(--gold)', flexShrink: 0, marginTop: 2 }} />
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Mensaje</div>
                              <div style={{ fontSize: 13, color: 'var(--charcoal)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{lead.initial_message}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

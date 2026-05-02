'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Heart, Phone, Mail, Users, Calendar, MessageSquare, ExternalLink, RefreshCw } from 'lucide-react'

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
  source: string | null
  created_at: string
  venue_id: string | null
  // joined
  venue_name?: string | null
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

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function WeddingPlannersPage() {
  const router = useRouter()
  const { user, loading: authLoading, profile } = useAuth()
  const [leads, setLeads] = useState<PlannerLead[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

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
      .select('id, name, email, phone, guests, wedding_date, budget, initial_message, whatsapp_consent, source, created_at, venue_id')
      .eq('wants_wedding_planner', true)
      .order('created_at', { ascending: false })
    if (error) { console.error(error); setLoading(false); return }

    // Enrich with venue names
    const venueIds = [...new Set((data || []).map((l: any) => l.venue_id).filter(Boolean))]
    let venueMap: Record<string, string> = {}
    if (venueIds.length) {
      const { data: venues } = await supabase
        .from('user_venues')
        .select('id, name')
        .in('id', venueIds)
      if (venues) venues.forEach((v: any) => { venueMap[v.id] = v.name })
    }

    setLeads((data || []).map((l: any) => ({ ...l, venue_name: l.venue_id ? venueMap[l.venue_id] || null : null })))
    setLoading(false)
  }

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

          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: '6px 14px', borderRadius: 20, background: '#fdf2f8', border: '1px solid #f0abfc', fontSize: 12, fontWeight: 600, color: '#a21caf' }}>
              {leads.length} {leads.length === 1 ? 'petición' : 'peticiones'}
            </div>
            <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Parejas que marcaron "We'd like help planning and coordinating our wedding"</span>
          </div>

          {leads.length === 0 ? (
            <div className="card" style={{ padding: '48px 32px', textAlign: 'center' }}>
              <Heart size={32} style={{ color: 'var(--ivory)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, color: 'var(--warm-gray)' }}>No hay peticiones de wedding planner todavía</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--cream)', borderBottom: '1px solid var(--ivory)' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--warm-gray)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pareja</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--warm-gray)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contacto</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--warm-gray)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Venue</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--warm-gray)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fecha / Invitados</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--warm-gray)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Presupuesto</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--warm-gray)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recibida</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => (
                    <>
                      <tr
                        key={lead.id}
                        onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}
                        style={{ borderBottom: '1px solid var(--ivory)', cursor: 'pointer', background: expanded === lead.id ? '#fdf8f4' : '#fff', transition: 'background 0.1s' }}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--espresso)' }}>{lead.name || '—'}</div>
                          {lead.whatsapp_consent && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3, padding: '2px 7px', borderRadius: 10, background: '#dcfce7', fontSize: 10, fontWeight: 600, color: '#16a34a' }}>
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="#16a34a"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.555 4.118 1.528 5.847L0 24l6.335-1.508A11.942 11.942 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.65-.502-5.18-1.378l-.37-.22-3.862.919.977-3.773-.243-.387A9.953 9.953 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                              WhatsApp OK
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {lead.email && <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--charcoal)' }}><Mail size={11} style={{ color: 'var(--warm-gray)' }} />{lead.email}</div>}
                            {lead.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--charcoal)' }}><Phone size={11} style={{ color: 'var(--warm-gray)' }} />{lead.phone}</div>}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: lead.venue_name ? 'var(--espresso)' : 'var(--warm-gray)', fontStyle: lead.venue_name ? 'normal' : 'italic' }}>
                          {lead.venue_name || 'Sin venue asignado'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--charcoal)' }}><Calendar size={11} style={{ color: 'var(--warm-gray)' }} />{fmtDate(lead.wedding_date)}</div>
                            {lead.guests && <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--charcoal)' }}><Users size={11} style={{ color: 'var(--warm-gray)' }} />{lead.guests} invitados</div>}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--charcoal)' }}>
                          {BUDGET_LABEL[lead.budget || 'sin_definir'] || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--warm-gray)', fontSize: 12 }}>
                          {fmtDate(lead.created_at)}
                        </td>
                      </tr>
                      {expanded === lead.id && lead.initial_message && (
                        <tr key={`${lead.id}-msg`} style={{ background: '#fdf8f4', borderBottom: '1px solid var(--ivory)' }}>
                          <td colSpan={6} style={{ padding: '0 16px 14px 16px' }}>
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
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

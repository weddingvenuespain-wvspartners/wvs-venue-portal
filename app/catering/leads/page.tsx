'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Users, Calendar, Filter, CheckCircle, XCircle, RotateCcw, MessageSquare } from 'lucide-react'

const STATUSES = [
  { value: 'all',       label: 'Todos' },
  { value: 'new',       label: 'Nuevos' },
  { value: 'contacted', label: 'Contactados' },
  { value: 'won',       label: 'Confirmados' },
  { value: 'lost',      label: 'Perdidos' },
]

const STATUS_LABEL: Record<string, string> = {
  new: 'Nuevo', contacted: 'Contactado', proposal_sent: 'Propuesta enviada',
  visit_scheduled: 'Visita', post_visit: 'Post visita', budget_sent: 'Presupuesto',
  won: 'Confirmado', lost: 'Perdido',
}
const STATUS_COLOR: Record<string, string> = {
  new: '#ef4444', contacted: '#3b82f6', proposal_sent: '#8b5cf6',
  visit_scheduled: '#f59e0b', post_visit: '#f59e0b', budget_sent: '#f97316',
  won: '#22c55e', lost: 'var(--warm-gray)',
}

const SOURCE_LABEL: Record<string, string> = { wedding_planner: 'Planner', direct: 'Directo', web: 'Web' }

export default function CateringLeadsPage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()

  const [leads, setLeads]       = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [dataLoading, setDataLoading]   = useState(true)

  // Detail modal
  const [selected, setSelected] = useState<any>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && profile && profile.role !== 'catering') router.replace('/dashboard')
  }, [loading, user, profile]) // eslint-disable-line

  const load = async () => {
    if (!user) return
    const supabase = createClient()
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setLeads(data || [])
    setFiltered(data || [])
    setDataLoading(false)
  }

  useEffect(() => { if (user && profile?.role === 'catering') load() }, [user?.id, profile?.role]) // eslint-disable-line

  useEffect(() => {
    setFiltered(statusFilter === 'all' ? leads : leads.filter(l => l.status === statusFilter))
  }, [statusFilter, leads])

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id)
    const supabase = createClient()
    await supabase.from('leads').update({ status }).eq('id', id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    if (selected?.id === id) setSelected((s: any) => ({ ...s, status }))
    setUpdatingId(null)
  }

  const BUDGET_LABEL: Record<string, string> = {
    sin_definir: 'Sin definir', 'menos_5k': '< 5k €', '5k_10k': '5–10k €',
    '10k_20k': '10–20k €', '20k_35k': '20–35k €', '35k_50k': '35–50k €', 'mas_50k': '> 50k €',
  }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout"><main style={{ padding: '32px 40px', overflowY: 'auto', flex: 1 }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>Solicitudes</h1>
          <p style={{ fontSize: 13, color: 'var(--warm-gray)' }}>{leads.length} solicitud{leads.length !== 1 ? 'es' : ''} recibida{leads.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          {STATUSES.map(s => (
            <button key={s.value} onClick={() => setStatusFilter(s.value)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: statusFilter === s.value ? 'var(--charcoal)' : '#fff',
                color: statusFilter === s.value ? '#fff' : 'var(--warm-gray)',
                fontSize: 12, fontWeight: statusFilter === s.value ? 600 : 400,
                fontFamily: 'Manrope, sans-serif', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}>
              {s.label}
            </button>
          ))}
        </div>

        {dataLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <div style={{ width: 20, height: 20, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <Users size={40} style={{ color: 'var(--ivory)', marginBottom: 14 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>Sin solicitudes</div>
            <div style={{ fontSize: 13, color: 'var(--warm-gray)' }}>
              {statusFilter !== 'all' ? 'No hay solicitudes en este estado' : 'Aún no has recibido solicitudes'}
            </div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            {filtered.map((l: any, i: number) => (
              <div key={l.id}
                onClick={() => setSelected(l)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--ivory)' : 'none', cursor: 'pointer', transition: 'background 0.12s' }}
                onMouseOver={e => (e.currentTarget.style.background = 'rgba(196,151,90,0.03)')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(34,197,94,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Users size={16} color="#16a34a" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>{l.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', display: 'flex', gap: 10 }}>
                    {l.wedding_date && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Calendar size={10} /> {new Date(l.wedding_date).toLocaleDateString('es-ES')}
                      </span>
                    )}
                    {l.guests && <span>{l.guests} inv.</span>}
                    {l.source === 'wedding_planner' && (
                      <span style={{ background: 'rgba(139,92,246,0.1)', color: '#7c3aed', padding: '1px 6px', borderRadius: 8, fontWeight: 600, fontSize: 10 }}>
                        Planner
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLOR[l.status] || 'var(--warm-gray)', padding: '3px 8px', borderRadius: 8, background: `${STATUS_COLOR[l.status] || '#999'}15` }}>
                    {STATUS_LABEL[l.status] || l.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      </div>

      {/* Detail modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}
        >
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 600, color: 'var(--charcoal)' }}>{selected.name}</h2>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', fontSize: 18 }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                ['Email', selected.email],
                ['Teléfono', selected.phone],
                ['Fecha boda', selected.wedding_date ? new Date(selected.wedding_date).toLocaleDateString('es-ES') : '—'],
                ['Invitados', selected.guests || '—'],
                ['Presupuesto', BUDGET_LABEL[selected.budget] || '—'],
                ['Origen', selected.source === 'wedding_planner' ? '🎯 Wedding Planner' : selected.source || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.06em', marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 13, color: 'var(--charcoal)' }}>{v || '—'}</div>
                </div>
              ))}
            </div>

            {selected.notes && (
              <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 20, lineHeight: 1.5 }}>
                {selected.notes}
              </div>
            )}

            <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.06em' }}>CAMBIAR ESTADO</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selected.status === 'new' && (
                <button onClick={() => updateStatus(selected.id, 'contacted')} disabled={!!updatingId}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  <MessageSquare size={12} /> Marcar contactado
                </button>
              )}
              {!['won','lost'].includes(selected.status) && (
                <button onClick={() => updateStatus(selected.id, 'won')} disabled={!!updatingId}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  <CheckCircle size={12} /> Confirmar boda
                </button>
              )}
              {selected.status !== 'lost' && (
                <button onClick={() => updateStatus(selected.id, 'lost')} disabled={!!updatingId}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  <XCircle size={12} /> Perdido
                </button>
              )}
              {selected.status === 'lost' && (
                <button onClick={() => updateStatus(selected.id, 'new')} disabled={!!updatingId}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: 'none', background: 'var(--ivory)', color: 'var(--charcoal)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  <RotateCcw size={12} /> Volver a nuevo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

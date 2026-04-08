'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Eye, MousePointerClick, MessageSquare, TrendingUp } from 'lucide-react'

const LEAD_STATUS_MAP = [
  { status: 'new',              label: 'Nuevos',              color: 'var(--gold)'  },
  { status: 'contacted',        label: 'Contactados',         color: '#3b82f6'      },
  { status: 'proposal_sent',    label: 'Propuesta enviada',   color: '#8b5cf6'      },
  { status: 'visit_scheduled',  label: 'Visita agendada',     color: '#06b6d4'      },
  { status: 'budget_sent',      label: 'Presupuesto enviado', color: '#f59e0b'      },
  { status: 'won',              label: 'Cerrado ganado',      color: '#22c55e'      },
  { status: 'lost',             label: 'Cerrado perdido',     color: '#6b7280'      },
]

export default function EstadisticasPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [proposals,   setProposals]   = useState<any[]>([])
  const [leads,       setLeads]       = useState<any[]>([])
  const [ctaReqs,     setCtaReqs]     = useState<any[]>([])
  const [messages,    setMessages]    = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    load()
  }, [user, authLoading])

  const load = async () => {
    const supabase = createClient()
    const [
      { data: props },
      { data: leadsData },
      { data: ctas },
      { data: msgs },
    ] = await Promise.all([
      supabase.from('proposals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('leads').select('status, created_at').eq('user_id', user.id),
      supabase.from('proposal_cta_requests').select('type, created_at, proposal_id'),
      supabase.from('proposal_messages').select('created_at, proposal_id'),
    ])
    if (props)     setProposals(props)
    if (leadsData) setLeads(leadsData)
    if (ctas)      setCtaReqs(ctas)
    if (msgs)      setMessages(msgs)
    setLoading(false)
  }

  const totalViews = proposals.reduce((a, p) => a + (p.views || 0), 0)
  const wonLeads = leads.filter(l => l.status === 'won' || l.status === 'booked').length
  const conversion = leads.length > 0 ? Math.round((wonLeads / leads.length) * 100) : 0

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const newLeadsMonth = leads.filter(l => l.created_at >= thisMonthStart).length

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold)' }}>Cargando...</div>
    </div>
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Estadísticas</div>
        </div>
        <div className="page-content">

          {/* KPIs */}
          <div className="stats-grid">
            <div className="stat-card accent">
              <div className="stat-label">Total leads</div>
              <div className="stat-value">{leads.length}</div>
              <div className="stat-sub">+{newLeadsMonth} este mes</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Propuestas enviadas</div>
              <div className="stat-value">{proposals.filter(p => p.status !== 'draft').length}</div>
              <div className="stat-sub">{proposals.length} creadas en total</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total aperturas</div>
              <div className="stat-value">{totalViews}</div>
              <div className="stat-sub">{proposals.length > 0 ? (totalViews / proposals.length).toFixed(1) : 0} media por propuesta</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Tasa de cierre</div>
              <div className="stat-value">{conversion}%</div>
              <div className="stat-sub">{wonLeads} bodas ganadas</div>
            </div>
          </div>

          <div className="two-col" style={{ marginBottom: 16 }}>

            {/* Leads por estado */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Leads por estado</div>
                <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{leads.length} total</span>
              </div>
              <div>
                {LEAD_STATUS_MAP.map(({ status, label, color }) => {
                  const count = leads.filter(l => l.status === status).length
                  const pct   = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0
                  return (
                    <div key={status} style={{ padding: '10px 20px', borderBottom: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <div style={{ fontSize: 12, flex: 1, color: 'var(--charcoal)' }}>{label}</div>
                      <div style={{ width: 80, height: 4, background: 'var(--ivory)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.5s' }} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--warm-gray)', minWidth: 20, textAlign: 'right', fontWeight: count > 0 ? 500 : 400 }}>{count}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Propuestas más activas */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Propuestas más activas</div>
                <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>por aperturas</span>
              </div>
              <div>
                {proposals.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 13 }}>
                    Aún no hay propuestas
                  </div>
                ) : proposals
                    .sort((a, b) => (b.views || 0) - (a.views || 0))
                    .slice(0, 7)
                    .map(p => {
                      const pCtas = ctaReqs.filter(c => c.proposal_id === p.id).length
                      const pMsgs = messages.filter(m => m.proposal_id === p.id).length
                      return (
                        <div key={p.id} style={{ padding: '10px 20px', borderBottom: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.couple_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{new Date(p.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--warm-gray)', fontSize: 11 }} title="Aperturas">
                              <Eye size={10} /> {p.views || 0}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--warm-gray)', fontSize: 11 }} title="Solicitudes CTA">
                              <MousePointerClick size={10} /> {pCtas}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--warm-gray)', fontSize: 11 }} title="Mensajes">
                              <MessageSquare size={10} /> {pMsgs}
                            </div>
                          </div>
                        </div>
                      )
                    })}
              </div>
            </div>
          </div>

          <div className="alert alert-info">
            <TrendingUp size={14} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12 }}>
              Las aperturas de propuestas se registran cuando las parejas abren el enlace. El seguimiento de CTAs y mensajes estará completo cuando el sistema de chat esté activo.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

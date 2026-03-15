'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

const STAGES = [
  { key: 'new', label: 'Consulta', color: '#C4975A' },
  { key: 'contacted', label: 'Contactado', color: '#8FA68B' },
  { key: 'visit', label: 'Visita', color: '#7BA3C4' },
  { key: 'quote', label: 'Presupuesto', color: '#A68BBF' },
  { key: 'booked', label: 'Reservado', color: '#4CAF7D' },
]

export default function PipelinePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', session.user.id)
        .not('status', 'eq', 'done')
        .order('created_at', { ascending: false })
      if (data) setLeads(data)
      setLoading(false)
    }
    init()
  }, [router])

  const moveToStage = async (leadId: string, newStatus: string) => {
    const supabase = createClient()
    await supabase.from('leads').update({ status: newStatus }).eq('id', leadId)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
  }

  const getLeadsByStage = (stage: string) => leads.filter(l => l.status === stage)

  if (loading) return <div style={{ minHeight: '100vh', background: '#1A1512', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#C4975A', fontFamily: 'serif' }}>Cargando...</div></div>

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar userEmail={user?.email} />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Pipeline</div>
          <div style={{ fontSize: '12px', color: 'var(--warm-gray)' }}>
            {leads.length} contactos activos
          </div>
        </div>
        <div className="page-content" style={{ overflowX: 'auto' }}>
          <div className="pipeline-grid" style={{ minWidth: '900px' }}>
            {STAGES.map(stage => {
              const stageLeads = getLeadsByStage(stage.key)
              return (
                <div
                  key={stage.key}
                  className="pipeline-col"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    if (dragging) moveToStage(dragging, stage.key)
                    setDragging(null)
                  }}
                >
                  <div className="pipeline-col-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stage.color, display: 'inline-block' }}/>
                      {stage.label}
                    </span>
                    <span style={{ background: 'rgba(0,0,0,0.08)', borderRadius: '10px', padding: '1px 7px', fontSize: '10px' }}>
                      {stageLeads.length}
                    </span>
                  </div>

                  {stageLeads.length === 0 && (
                    <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--stone)', fontSize: '11px' }}>
                      Sin contactos
                    </div>
                  )}

                  {stageLeads.map((lead: any) => (
                    <div
                      key={lead.id}
                      className="pipeline-card"
                      draggable
                      onDragStart={() => setDragging(lead.id)}
                      onDragEnd={() => setDragging(null)}
                    >
                      <div className="pc-name">{lead.name}</div>
                      {lead.wedding_date && (
                        <div className="pc-date">
                          {lead.wedding_date} {lead.guests ? `· ${lead.guests} pers.` : ''}
                        </div>
                      )}
                      {lead.email && (
                        <div style={{ fontSize: '10px', color: 'var(--warm-gray)', marginTop: '4px' }}>{lead.email}</div>
                      )}
                      <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {STAGES.filter(s => s.key !== stage.key).map(s => (
                          <button
                            key={s.key}
                            onClick={() => moveToStage(lead.id, s.key)}
                            style={{
                              background: 'var(--ivory)', border: 'none', borderRadius: '4px',
                              padding: '2px 7px', fontSize: '10px', color: 'var(--warm-gray)',
                              cursor: 'pointer', transition: 'all 0.1s'
                            }}
                            onMouseOver={e => (e.currentTarget.style.background = '#e0d8ce')}
                            onMouseOut={e => (e.currentTarget.style.background = 'var(--ivory)')}
                          >
                            → {s.label}
                          </button>
                        ))}
                        <button
                          onClick={() => moveToStage(lead.id, 'done')}
                          style={{
                            background: '#f0fdf4', border: 'none', borderRadius: '4px',
                            padding: '2px 7px', fontSize: '10px', color: '#166534',
                            cursor: 'pointer'
                          }}
                        >
                          ✓ Realizada
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          <p style={{ marginTop: '16px', fontSize: '11.5px', color: 'var(--warm-gray)', textAlign: 'center' }}>
            Arrastra las tarjetas entre columnas o usa los botones de estado para mover contactos
          </p>
        </div>
      </div>
    </div>
  )
}

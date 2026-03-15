'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'

export default function LeadsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
        .order('created_at', { ascending: false })
      if (data) setLeads(data)
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) return <div style={{ minHeight: '100vh', background: '#1A1512', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#C4975A', fontFamily: 'serif' }}>Cargando...</div></div>

  const newLeads = leads.filter(l => l.status === 'new')
  const otherLeads = leads.filter(l => l.status !== 'new')

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar userEmail={user?.email} />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Leads</div>
          <Link href="/crm">
            <button className="btn btn-primary">+ Nuevo contacto</button>
          </Link>
        </div>
        <div className="page-content">
          {newLeads.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: '12px' }}>
                Nuevos · Sin responder
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {newLeads.map((lead: any) => (
                  <div key={lead.id} className="card" style={{ borderLeft: '3px solid var(--gold)' }}>
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%', background: 'var(--ivory)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: 'var(--gold)', flexShrink: 0
                      }}>
                        {lead.name?.[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 400, fontSize: '14px' }}>{lead.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--warm-gray)' }}>
                          {lead.email} {lead.wedding_date ? `· Boda: ${lead.wedding_date}` : ''} {lead.guests ? `· ${lead.guests} invitados` : ''}
                        </div>
                        {lead.notes && <div style={{ fontSize: '12px', color: 'var(--warm-gray)', marginTop: '4px', fontStyle: 'italic' }}>{lead.notes}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', padding: '2px 8px', background: 'var(--ivory)', borderRadius: '10px', color: 'var(--warm-gray)' }}>
                          {lead.source || 'Web'}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--warm-gray)' }}>
                          {new Date(lead.created_at).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: '12px' }}>
              Todos los leads ({leads.length})
            </div>
            <div className="card">
              {leads.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: '13px' }}>
                  Aún no tienes leads.<br />
                  <span style={{ fontSize: '11px' }}>Los leads de tu ficha en la web aparecerán aquí automáticamente cuando alguien rellene el formulario de contacto.</span>
                </div>
              ) : (
                <table className="table">
                  <thead><tr><th>Nombre</th><th>Email</th><th>Boda</th><th>Invitados</th><th>Origen</th><th>Estado</th></tr></thead>
                  <tbody>
                    {leads.map((lead: any) => (
                      <tr key={lead.id}>
                        <td style={{ fontWeight: 400 }}>{lead.name}</td>
                        <td style={{ color: 'var(--warm-gray)', fontSize: '12px' }}>{lead.email || '—'}</td>
                        <td style={{ color: 'var(--warm-gray)', fontSize: '12px' }}>{lead.wedding_date || '—'}</td>
                        <td style={{ color: 'var(--warm-gray)', fontSize: '12px' }}>{lead.guests || '—'}</td>
                        <td><span style={{ fontSize: '10.5px', padding: '2px 8px', background: 'var(--ivory)', borderRadius: '10px', color: 'var(--warm-gray)' }}>{lead.source || 'Web'}</span></td>
                        <td>
                          <span className={`badge badge-${lead.status}`}>
                           {({'new':'Nuevo','contacted':'Contactado','visit':'Visita','quote':'Presupuesto','booked':'Reservado','done':'Realizada'} as Record<string, string>)[lead.status] || lead.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

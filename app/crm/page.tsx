'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'

const STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo', contacted: 'Contactado', visit: 'Visita',
  quote: 'Presupuesto', booked: 'Reservado', done: 'Realizada'
}

const STATUS_CLASSES: Record<string, string> = {
  new: 'badge-new', contacted: 'badge-contacted', visit: 'badge-visit',
  quote: 'badge-quote', booked: 'badge-booked', done: 'badge-done'
}

export default function CrmPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({
    name: '', email: '', phone: '', wedding_date: '',
    guests: '', source: 'manual', status: 'new', notes: ''
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      await loadLeads(session.user.id)
      setLoading(false)
    }
    init()
  }, [router])

  const loadLeads = async (userId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (data) setLeads(data)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('leads').insert([{
      ...form, user_id: user.id, guests: form.guests ? parseInt(form.guests) : null
    }])
    if (!error) {
      setSuccess('Contacto guardado')
      setShowForm(false)
      setForm({ name: '', email: '', phone: '', wedding_date: '', guests: '', source: 'manual', status: 'new', notes: '' })
      await loadLeads(user.id)
      setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(false)
  }

  const updateStatus = async (id: string, status: string) => {
    const supabase = createClient()
    await supabase.from('leads').update({ status }).eq('id', id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
  }

  const filtered = filter === 'all' ? leads : leads.filter(l => l.status === filter)

  if (loading) return <div style={{ minHeight: '100vh', background: '#1A1512', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#C4975A',  }}>Cargando...</div></div>

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Todos los contactos</div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nuevo contacto</button>
        </div>
        <div className="page-content">
          {success && <div className="alert-success">{success}</div>}

          {/* New contact form */}
          {showForm && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header">
                <div className="card-title">Nuevo contacto</div>
                <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
              <div className="card-body">
                <form onSubmit={handleSave}>
                  <div className="three-col">
                    <div className="form-group">
                      <label className="form-label">Nombre *</label>
                      <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input className="form-input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Teléfono</label>
                      <input className="form-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Fecha de boda</label>
                      <input className="form-input" type="month" value={form.wedding_date} onChange={e => setForm({...form, wedding_date: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nº invitados</label>
                      <input className="form-input" type="number" value={form.guests} onChange={e => setForm({...form, guests: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Origen</label>
                      <select className="form-select" value={form.source} onChange={e => setForm({...form, source: e.target.value})}>
                        <option value="manual">Manual</option>
                        <option value="web">Web WVS</option>
                        <option value="instagram">Instagram</option>
                        <option value="referral">Referido</option>
                        <option value="other">Otro</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notas</label>
                    <textarea className="form-textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Detalles, preferencias, observaciones..." />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar contacto'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Filter */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {['all', 'new', 'contacted', 'visit', 'quote', 'booked', 'done'].map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`btn ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '5px 14px', fontSize: '11.5px' }}
              >
                {s === 'all' ? 'Todos' : STATUS_LABELS[s]}
                {s !== 'all' && (
                  <span style={{ marginLeft: '4px', opacity: 0.7 }}>
                    ({leads.filter(l => l.status === s).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="card">
            {filtered.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: '13px' }}>
                {leads.length === 0 ? 'Aún no tienes contactos. Añade el primero.' : 'No hay contactos con este filtro.'}
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Fecha boda</th>
                    <th>Invitados</th>
                    <th>Origen</th>
                    <th>Estado</th>
                    <th>Fecha entrada</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead: any) => (
                    <tr key={lead.id}>
                      <td>
                        <div style={{ fontWeight: 400 }}>{lead.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--warm-gray)' }}>{lead.email}</div>
                      </td>
                      <td style={{ color: 'var(--warm-gray)', fontSize: '12px' }}>{lead.wedding_date || '—'}</td>
                      <td style={{ color: 'var(--warm-gray)', fontSize: '12px' }}>{lead.guests || '—'}</td>
                      <td>
                        <span style={{ fontSize: '10.5px', padding: '2px 8px', background: 'var(--ivory)', borderRadius: '10px', color: 'var(--warm-gray)' }}>
                          {lead.source || 'Web'}
                        </span>
                      </td>
                      <td>
                        <select
                          value={lead.status}
                          onChange={e => updateStatus(lead.id, e.target.value)}
                          style={{
                            border: 'none', background: 'transparent', fontSize: '12px',
                            color: 'var(--charcoal)', cursor: 'pointer', outline: 'none'
                          }}
                        >
                          {Object.entries(STATUS_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ color: 'var(--warm-gray)', fontSize: '11px' }}>
                        {new Date(lead.created_at).toLocaleDateString('es-ES')}
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
  )
}

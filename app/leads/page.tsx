'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Plus, Search, X } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'new', label: 'Nuevo' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'qualified', label: 'Cualificado' },
  { value: 'proposal', label: 'Propuesta' },
  { value: 'booked', label: 'Reservado' },
  { value: 'lost', label: 'Perdido' },
]

const SOURCE_OPTIONS = [
  { value: 'web', label: 'Web' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'referral', label: 'Referido' },
  { value: 'manual', label: 'Manual' },
  { value: 'other', label: 'Otro' },
]

const BADGE: Record<string, string> = {
  new: 'badge-new', contacted: 'badge-contacted', qualified: 'badge-active',
  proposal: 'badge-quote', booked: 'badge-booked', lost: 'badge-inactive',
}

const emptyForm = { name: '', email: '', phone: '', wedding_date: '', guests: '', source: 'web', status: 'new', notes: '' }

export default function LeadsPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [leads, setLeads]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]     = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError]   = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data } = await supabase
        .from('leads').select('*').eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
      if (data) setLeads(data)
      setLoading(false)
    }
    init()
  }, [router])

  const notify = (msg: string, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => { setSuccess(''); setError('') }, 3000)
  }

  const handleSubmit = async () => {
    if (!form.name) { notify('El nombre es obligatorio', true); return }
    setSaving(true)
    const supabase = createClient()
    if (editId) {
      const { error: err } = await supabase.from('leads').update({ ...form, guests: form.guests ? parseInt(form.guests) : null }).eq('id', editId)
      if (err) notify('Error al actualizar', true)
      else {
        setLeads(prev => prev.map(l => l.id === editId ? { ...l, ...form } : l))
        notify('Lead actualizado')
        setShowForm(false); setEditId(null); setForm(emptyForm)
      }
    } else {
      const { data, error: err } = await supabase.from('leads')
        .insert({ ...form, user_id: user.id, guests: form.guests ? parseInt(form.guests) : null })
        .select().single()
      if (err) notify('Error al crear el lead', true)
      else {
        setLeads(prev => [data, ...prev])
        notify('Lead creado correctamente')
        setShowForm(false); setForm(emptyForm)
      }
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este lead?')) return
    const supabase = createClient()
    await supabase.from('leads').delete().eq('id', id)
    setLeads(prev => prev.filter(l => l.id !== id))
  }

  const openEdit = (lead: any) => {
    setForm({ name: lead.name || '', email: lead.email || '', phone: lead.phone || '', wedding_date: lead.wedding_date || '', guests: lead.guests?.toString() || '', source: lead.source || 'web', status: lead.status || 'new', notes: lead.notes || '' })
    setEditId(lead.id)
    setShowForm(true)
  }

  const filtered = leads.filter(l => {
    const matchS = filterStatus === 'all' || l.status === filterStatus
    const matchQ = !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.email?.toLowerCase().includes(search.toLowerCase())
    return matchS && matchQ
  })

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1A1512', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C4975A', fontFamily: 'serif' }}>Cargando...</div>
    </div>
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Leads</div>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true) }}>
            <Plus size={13} /> Nuevo lead
          </button>
        </div>
        <div className="page-content">
          {success && <div className="alert alert-success">{success}</div>}
          {error   && <div className="alert alert-error">{error}</div>}

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
              <input className="form-input" style={{ paddingLeft: 28, fontSize: 12 }} placeholder="Buscar por nombre o email..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={`btn btn-sm ${filterStatus === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilterStatus('all')}>Todos ({leads.length})</button>
              {STATUS_OPTIONS.map(s => {
                const count = leads.filter(l => l.status === s.value).length
                return count > 0 ? (
                  <button key={s.value} className={`btn btn-sm ${filterStatus === s.value ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilterStatus(s.value)}>
                    {s.label} ({count})
                  </button>
                ) : null
              })}
            </div>
          </div>

          {/* Tabla */}
          <div className="card">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Contacto</th>
                    <th>Fecha boda</th>
                    <th>Invitados</th>
                    <th>Fuente</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--warm-gray)' }}>
                      {search || filterStatus !== 'all' ? 'Sin resultados' : 'Aún no tienes leads. ¡Crea el primero!'}
                    </td></tr>
                  )}
                  {filtered.map(lead => (
                    <tr key={lead.id}>
                      <td><div style={{ fontWeight: 500 }}>{lead.name}</div>{lead.notes && <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{lead.notes.slice(0, 40)}...</div>}</td>
                      <td>
                        {lead.email && <div style={{ fontSize: 12 }}>{lead.email}</div>}
                        {lead.phone && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{lead.phone}</div>}
                      </td>
                      <td style={{ fontSize: 12 }}>{lead.wedding_date ? new Date(lead.wedding_date).toLocaleDateString('es-ES') : '—'}</td>
                      <td style={{ fontSize: 12 }}>{lead.guests || '—'}</td>
                      <td><span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{SOURCE_OPTIONS.find(s => s.value === lead.source)?.label || lead.source}</span></td>
                      <td><span className={`badge ${BADGE[lead.status] || ''}`}>{STATUS_OPTIONS.find(s => s.value === lead.status)?.label || lead.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(lead)}>Editar</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(lead.id)}>
                            <X size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal formulario */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editId ? 'Editar lead' : 'Nuevo lead'}</div>
            <div style={{ marginTop: 16 }}>
              <div className="two-col">
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre completo" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className="two-col">
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de boda</label>
                  <input className="form-input" type="date" value={form.wedding_date} onChange={e => setForm(f => ({ ...f, wedding_date: e.target.value }))} />
                </div>
              </div>
              <div className="two-col">
                <div className="form-group">
                  <label className="form-label">Invitados</label>
                  <input className="form-input" type="number" value={form.guests} onChange={e => setForm(f => ({ ...f, guests: e.target.value }))} placeholder="Nº estimado" />
                </div>
                <div className="form-group">
                  <label className="form-label">Fuente</label>
                  <select className="form-input" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                    {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Estado</label>
                <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notas</label>
                <textarea className="form-textarea" style={{ minHeight: 80 }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Detalles adicionales..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditId(null) }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

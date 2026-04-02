'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Plus, Edit2, ToggleLeft, ToggleRight, ArrowLeft, Trash2 } from 'lucide-react'

type Plan = {
  id: string
  name: string
  description: string | null
  price_yearly: number
  price_monthly: number | null
  min_commitment_months: number
  features: string[]
  is_active: boolean
  created_at: string
}

const EMPTY_PLAN: Omit<Plan, 'id' | 'created_at'> = {
  name: '',
  description: '',
  price_yearly: 300,
  price_monthly: 30,
  min_commitment_months: 12,
  features: ['Ficha publicada en Wedding Venues Spain', 'Leads ilimitados', 'Panel de gestión'],
  is_active: true,
}

export default function PlanesPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans]     = useState<Plan[]>([])
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError]     = useState('')

  // Modal state
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<Plan | null>(null)
  const [form, setForm]             = useState(EMPTY_PLAN)
  const [featInput, setFeatInput]   = useState('')

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: me } = await supabase.from('venue_profiles').select('role').eq('user_id', session.user.id).single()
      if (me?.role !== 'admin') { router.push('/dashboard'); return }
      const { data } = await supabase.from('venue_plans').select('*').order('created_at', { ascending: true })
      if (data) setPlans(data)
      setLoading(false)
    }
    init()
  }, [user, profile, authLoading, router])

  const notify = (msg: string, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => { setSuccess(''); setError('') }, 4000)
  }

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_PLAN)
    setFeatInput('')
    setShowModal(true)
  }

  const openEdit = (plan: Plan) => {
    setEditing(plan)
    setForm({
      name: plan.name, description: plan.description || '',
      price_yearly: plan.price_yearly, price_monthly: plan.price_monthly ?? 0,
      min_commitment_months: plan.min_commitment_months,
      features: [...plan.features], is_active: plan.is_active,
    })
    setFeatInput('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { notify('El nombre del plan es obligatorio', true); return }
    setSaving(true)
    const supabase = createClient()
    const payload = {
      name: form.name.trim(), description: form.description || null,
      price_yearly: form.price_yearly, price_monthly: form.price_monthly || null,
      min_commitment_months: form.min_commitment_months,
      features: form.features, is_active: form.is_active,
    }
    try {
      if (editing) {
        const { data, error: err } = await supabase.from('venue_plans').update(payload).eq('id', editing.id).select().single()
        if (err) throw err
        setPlans(p => p.map(x => x.id === editing.id ? data : x))
        notify('Plan actualizado ✓')
      } else {
        const { data, error: err } = await supabase.from('venue_plans').insert(payload).select().single()
        if (err) throw err
        setPlans(p => [...p, data])
        notify('Plan creado ✓')
      }
      setShowModal(false)
    } catch { notify('Error al guardar', true) }
    setSaving(false)
  }

  const handleToggle = async (plan: Plan) => {
    const supabase = createClient()
    await supabase.from('venue_plans').update({ is_active: !plan.is_active }).eq('id', plan.id)
    setPlans(p => p.map(x => x.id === plan.id ? { ...x, is_active: !x.is_active } : x))
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('venue_plans').delete().eq('id', id)
    setPlans(p => p.filter(x => x.id !== id))
    setConfirmDelete(null)
    notify('Plan eliminado')
  }

  const addFeature = () => {
    const t = featInput.trim()
    if (t && !form.features.includes(t)) setForm(f => ({ ...f, features: [...f.features, t] }))
    setFeatInput('')
  }

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/admin" className="btn btn-ghost btn-sm"><ArrowLeft size={13} /> CRM</a>
            <div className="topbar-title">Planes y ofertas</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <Plus size={13} /> Nuevo plan
          </button>
        </div>

        <div className="page-content">
          {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}
          {error   && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{error}</div>}

          {plans.length === 0 && (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ color: 'var(--warm-gray)', marginBottom: 16 }}>Aún no hay planes definidos.</div>
              <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={13} /> Crear el primer plan</button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {plans.map(plan => (
              <div key={plan.id} className="card" style={{ opacity: plan.is_active ? 1 : 0.6 }}>
                <div className="card-body">
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'Cormorant Garamond, serif', color: 'var(--espresso)' }}>{plan.name}</div>
                      {plan.description && <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{plan.description}</div>}
                    </div>
                    <span className={`badge ${plan.is_active ? 'badge-active' : 'badge-inactive'}`}>
                      {plan.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  {/* Prices */}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                    <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '8px 14px', textAlign: 'center', flex: 1 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)', fontFamily: 'Cormorant Garamond, serif' }}>{plan.price_yearly}€</div>
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.06em' }}>/ año</div>
                    </div>
                    {plan.price_monthly && (
                      <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '8px 14px', textAlign: 'center', flex: 1 }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--espresso)', fontFamily: 'Cormorant Garamond, serif' }}>{plan.price_monthly}€</div>
                        <div style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.06em' }}>/ mes</div>
                      </div>
                    )}
                  </div>
                  {plan.min_commitment_months > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 12 }}>
                      Permanencia mínima: {plan.min_commitment_months} meses
                    </div>
                  )}

                  {/* Features */}
                  {plan.features.length > 0 && (
                    <ul style={{ margin: '0 0 16px', padding: 0, listStyle: 'none' }}>
                      {plan.features.map((f, i) => (
                        <li key={i} style={{ fontSize: 12, color: 'var(--charcoal)', padding: '3px 0', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <span style={{ color: 'var(--gold)', flexShrink: 0 }}>✓</span> {f}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--ivory)' }}>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => openEdit(plan)}>
                      <Edit2 size={12} /> Editar
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleToggle(plan)} title={plan.is_active ? 'Desactivar' : 'Activar'}>
                      {plan.is_active ? <ToggleRight size={14} style={{ color: 'var(--gold)' }} /> : <ToggleLeft size={14} />}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(plan.id)} title="Eliminar">
                      <Trash2 size={13} style={{ color: '#c0392b' }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add / Edit modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Editar plan' : 'Nuevo plan'}</div>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre del plan *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Ficha Estándar WVS" />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input className="form-input" value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descripción del plan" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Precio anual (€)</label>
                  <input className="form-input" type="number" value={form.price_yearly} onChange={e => setForm(f => ({ ...f, price_yearly: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Precio mensual (€)</label>
                  <input className="form-input" type="number" value={form.price_monthly || ''} onChange={e => setForm(f => ({ ...f, price_monthly: parseFloat(e.target.value) || 0 }))} placeholder="Opcional" />
                </div>
                <div className="form-group">
                  <label className="form-label">Permanencia (meses)</label>
                  <input className="form-input" type="number" value={form.min_commitment_months} onChange={e => setForm(f => ({ ...f, min_commitment_months: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Características incluidas</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input className="form-input" value={featInput} onChange={e => setFeatInput(e.target.value)} placeholder="Añadir característica..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFeature())} />
                  <button className="btn btn-ghost btn-sm" onClick={addFeature}><Plus size={12} /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {form.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: 'var(--cream)', borderRadius: 6 }}>
                      <span style={{ fontSize: 12, flex: 1, color: 'var(--charcoal)' }}>✓ {f}</span>
                      <button onClick={() => setForm(fm => ({ ...fm, features: fm.features.filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 0, fontSize: 14 }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear plan'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <div className="modal-title">¿Eliminar plan?</div>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 13, color: 'var(--warm-gray)' }}>
                Esta acción no se puede deshacer. Los usuarios con este plan asignado mantendrán su historial.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

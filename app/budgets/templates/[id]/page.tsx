'use client'
import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { usePlanFeatures } from '@/lib/use-plan-features'
import {
  Plus, Trash2, X, Check, Save, GripVertical,
  AlertCircle, Loader2, ArrowLeft, Pencil,
} from 'lucide-react'
import type { LineItemGroup, LineItem } from '@/lib/budget-types'

function nanoid(len = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

type StructureTemplate = {
  id: string
  name: string
  description: string | null
  is_default: boolean
  line_items: { groups: LineItemGroup[] }
  created_at: string
  updated_at: string
}

export default function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user, loading: authLoading, activeVenue } = useAuth()
  const { isBlocked } = useRequireSubscription()
  const features = usePlanFeatures()

  const [template, setTemplate] = useState<StructureTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [groups, setGroups] = useState<LineItemGroup[]>([])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadTemplate()
  }, [user, authLoading, activeVenue?.id])

  const loadTemplate = async () => {
    if (!activeVenue) return
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('budget_structure_templates')
      .select('*')
      .eq('id', id)
      .eq('venue_id', activeVenue.id)
      .single()
    if (!data || err) {
      setError('Plantilla no encontrada')
      setLoading(false)
      return
    }
    const tpl = data as StructureTemplate
    setTemplate(tpl)
    setName(tpl.name)
    setDescription(tpl.description ?? '')
    setGroups(tpl.line_items?.groups ?? [])
    setLoading(false)
  }

  const subtotal = groups.reduce((sum, g) => sum + g.items.reduce((s, i) => s + i.subtotal, 0), 0)

  const saveTemplate = useCallback(async () => {
    if (!template) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('budget_structure_templates').update({
      name: name.trim() || 'Sin nombre',
      description: description.trim() || null,
      line_items: { groups },
      updated_at: new Date().toISOString(),
    }).eq('id', template.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [template, name, description, groups])

  // Auto-save debounced
  useEffect(() => {
    if (!template || loading) return
    const t = setTimeout(() => { saveTemplate() }, 1500)
    return () => clearTimeout(t)
  }, [name, description, groups])

  // Group operations
  const addGroup = () => {
    setGroups(prev => [...prev, { id: nanoid(), name: 'Nuevo grupo', items: [] }])
  }
  const removeGroup = (gid: string) => {
    setGroups(prev => prev.filter(g => g.id !== gid))
  }
  const updateGroupName = (gid: string, gname: string) => {
    setGroups(prev => prev.map(g => g.id === gid ? { ...g, name: gname } : g))
  }

  // Item operations
  const addItem = (gid: string) => {
    setGroups(prev => prev.map(g => g.id === gid ? {
      ...g, items: [...g.items, { id: nanoid(), concept: '', qty: 1, unit_price: 0, subtotal: 0 }]
    } : g))
  }
  const removeItem = (gid: string, iid: string) => {
    setGroups(prev => prev.map(g => g.id === gid ? { ...g, items: g.items.filter(i => i.id !== iid) } : g))
  }
  const updateItem = (gid: string, iid: string, field: keyof LineItem, value: any) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== gid) return g
      return {
        ...g, items: g.items.map(i => {
          if (i.id !== iid) return i
          const updated = { ...i, [field]: value }
          if (field === 'qty' || field === 'unit_price') {
            updated.subtotal = Math.round(updated.qty * updated.unit_price * 100) / 100
          }
          return updated
        })
      }
    }))
  }

  if (isBlocked) return null

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', color: 'var(--warm-gray)', gap: 8 }}>
      <Loader2 size={16} className="animate-spin" /> Cargando plantilla...
    </div>
  )

  if (error || !template) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: 'var(--cream)' }}>
      <AlertCircle size={18} style={{ color: 'var(--rose)' }} />
      <div style={{ fontSize: 14, color: 'var(--charcoal)' }}>{error || 'No encontrada'}</div>
      <button className="btn btn-ghost btn-sm" onClick={() => router.push('/budgets')}>← Volver</button>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          onClick={() => router.push('/budgets')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 6 }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--espresso)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name || 'Plantilla'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Plantilla de estructura</span>
            {saving && <span style={{ color: '#b45309' }}>· guardando...</span>}
            {saved && !saving && <span style={{ color: '#16a34a' }}>· guardado</span>}
          </div>
        </div>
        <button
          onClick={saveTemplate}
          disabled={saving}
          className="btn btn-primary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {saving ? <><Loader2 size={12} className="animate-spin" /> Guardando...</>
            : saved ? <><Check size={12} /> Guardado</>
            : <><Save size={12} /> Guardar</>}
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 28px' }}>

        {/* Name + description */}
        <div style={{ marginBottom: 24 }}>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label">Nombre de la plantilla</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Boda completa, Cena privada..." style={{ fontSize: 14, fontWeight: 600 }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Descripcion (opcional)</label>
            <input className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Breve descripcion de para que sirve esta plantilla..." />
          </div>
        </div>

        {/* Groups + items editor */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Conceptos
            </div>
            <button onClick={addGroup} className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--gold)' }}>
              <Plus size={12} /> Grupo
            </button>
          </div>

          {groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--warm-gray)', fontSize: 13, background: '#fff', borderRadius: 10, border: '1px dashed var(--border)' }}>
              <div style={{ marginBottom: 8 }}>Sin grupos todavia</div>
              <button onClick={addGroup} className="btn btn-primary btn-sm"><Plus size={12} /> Anadir grupo</button>
            </div>
          ) : groups.map(g => (
            <div key={g.id} style={{ marginBottom: 12, border: '1px solid var(--ivory)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
              {/* Group header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', background: 'var(--cream)', borderBottom: '1px solid var(--ivory)' }}>
                <GripVertical size={12} style={{ color: 'var(--stone)', cursor: 'grab', flexShrink: 0 }} />
                <input
                  value={g.name}
                  onChange={e => updateGroupName(g.id, e.target.value)}
                  style={{ flex: 1, background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--espresso)', outline: 'none', minWidth: 0 }}
                />
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', flexShrink: 0 }}>
                  {g.items.reduce((s, i) => s + i.subtotal, 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </div>
                <button onClick={() => removeGroup(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: 2, flexShrink: 0 }}>
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 90px 28px', gap: 0, padding: '4px 12px', fontSize: 9, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--ivory)' }}>
                <span>Concepto</span>
                <span style={{ textAlign: 'center' }}>Uds</span>
                <span style={{ textAlign: 'right' }}>EUR/ud</span>
                <span style={{ textAlign: 'right' }}>Total</span>
                <span />
              </div>

              {/* Items */}
              {g.items.map(item => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 90px 28px', gap: 0, padding: '5px 12px', alignItems: 'center', borderBottom: '1px solid var(--ivory)' }}>
                  <input
                    value={item.concept}
                    onChange={e => updateItem(g.id, item.id, 'concept', e.target.value)}
                    className="form-input"
                    style={{ border: 'none', padding: '3px 0', fontSize: 12 }}
                    placeholder="Concepto"
                  />
                  <input
                    type="number" min={0}
                    value={item.qty}
                    onChange={e => updateItem(g.id, item.id, 'qty', Number(e.target.value))}
                    className="form-input"
                    style={{ border: 'none', padding: '3px', fontSize: 12, textAlign: 'center' }}
                  />
                  <input
                    type="number" min={0} step={0.01}
                    value={item.unit_price}
                    onChange={e => updateItem(g.id, item.id, 'unit_price', Number(e.target.value))}
                    className="form-input"
                    style={{ border: 'none', padding: '3px', fontSize: 12, textAlign: 'right' }}
                  />
                  <div style={{ fontSize: 12, fontWeight: 500, textAlign: 'right', color: 'var(--charcoal)' }}>
                    {item.subtotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </div>
                  <button
                    onClick={() => removeItem(g.id, item.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: 1 }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              {/* Add item button */}
              <button
                onClick={() => addItem(g.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--gold)', width: '100%' }}
              >
                <Plus size={11} /> Concepto
              </button>
            </div>
          ))}
        </div>

        {/* Total summary */}
        <div style={{ padding: '14px 16px', background: '#fff', borderRadius: 10, border: '1px solid var(--ivory)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total base plantilla</div>
              <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>
                {groups.length} grupo{groups.length !== 1 ? 's' : ''} · {groups.reduce((s, g) => s + g.items.length, 0)} concepto{groups.reduce((s, g) => s + g.items.length, 0) !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--espresso)' }}>
              {subtotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </div>
          </div>
        </div>

        {/* Tip */}
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(196,151,90,0.08)', borderRadius: 8, border: '1px solid rgba(196,151,90,0.2)' }}>
          <div style={{ fontSize: 12, color: 'var(--charcoal)', lineHeight: 1.5 }}>
            <strong>Tip:</strong> Los conceptos con "por persona" en el nombre se ajustaran automaticamente al numero de invitados al crear un presupuesto.
          </div>
        </div>
      </div>
    </div>
  )
}

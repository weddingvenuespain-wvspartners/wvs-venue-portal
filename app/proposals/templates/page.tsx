'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, LayoutTemplate, Trash2, Star, FileText, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { usePlanFeatures } from '@/lib/use-plan-features'
import Sidebar from '@/components/Sidebar'

type Template = {
  id: string
  name: string
  description: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export default function TemplatesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { isBlocked, ready } = useRequireSubscription()
  const features = usePlanFeatures()

  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !ready) return
    if (!user || isBlocked || !features.propuestas) { router.replace('/proposals'); return }
    fetch('/api/proposal-templates')
      .then(r => r.json())
      .then(data => { setTemplates(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user, authLoading, isBlocked, ready, features.propuestas, router])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true); setError(null)
    try {
      const res = await fetch('/api/proposal-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), sections_data: { has_catering: true, sections_enabled: { hero: true, welcome: true, gallery: true, testimonials: true, map: true, contact: true } } }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      const tpl = await res.json()
      router.push(`/proposals/templates/${tpl.id}`)
    } catch (e: any) {
      setError(e.message); setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla? Las propuestas que la usen no se verán afectadas.')) return
    setDeleting(id)
    await fetch(`/api/proposal-templates/${id}`, { method: 'DELETE' })
    setTemplates(t => t.filter(x => x.id !== id))
    setDeleting(null)
  }

  const setDefault = async (id: string) => {
    await fetch(`/api/proposal-templates/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_default: true }) })
    setTemplates(t => t.map(x => ({ ...x, is_default: x.id === id })))
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cream)' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Propuestas</div>
        </div>

        <div className="page-content">
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--ivory)', marginBottom: 24 }}>
            <a href="/proposals" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', textDecoration: 'none', borderBottom: '2px solid transparent', marginBottom: -2, color: 'var(--warm-gray)', transition: 'all .15s' }}>
              <FileText size={15} /><span style={{ fontSize: 13, fontWeight: 500 }}>Propuestas</span>
            </a>
            <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: 'none', border: 'none', cursor: 'default', borderBottom: '2px solid var(--gold)', marginBottom: -2, color: 'var(--espresso)' }}>
              <LayoutTemplate size={15} color="var(--gold)" /><span style={{ fontSize: 13, fontWeight: 600 }}>Plantillas</span>
            </button>
          </div>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--warm-gray)' }} />
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--espresso)', marginBottom: 4 }}>Plantillas de propuesta</h1>
                  <p style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.55, maxWidth: 560 }}>
                    Define configuraciones reutilizables: qué secciones aparecen y qué menús y extras se precargan. Al crear una propuesta puedes elegir con qué plantilla parte.
                  </p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)} style={{ flexShrink: 0 }}>
                  <Plus size={14} /> Nueva plantilla
                </button>
              </div>

              {/* Create form */}
              {showCreate && (
                <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 10 }}>Nueva plantilla</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="form-input" placeholder="Nombre (ej. Boda clásica, Evento íntimo…)"
                      value={newName} onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreate()}
                      style={{ flex: 1 }} autoFocus />
                    <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating || !newName.trim()}>
                      {creating ? <Loader2 size={13} className="animate-spin" /> : 'Crear'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setShowCreate(false); setNewName('') }}>Cancelar</button>
                  </div>
                  {error && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{error}</div>}
                </div>
              )}

              {/* Template list */}
              {templates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12 }}>
                  <LayoutTemplate size={36} style={{ color: 'var(--warm-gray)', opacity: 0.4, marginBottom: 12 }} />
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>Sin plantillas todavía</div>
                  <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 20 }}>
                    Crea tu primera plantilla para agilizar la creación de propuestas.
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                    <Plus size={13} /> Crear primera plantilla
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {templates.map(tpl => (
                    <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', transition: 'box-shadow .15s' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--cream)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <LayoutTemplate size={16} style={{ color: 'var(--gold)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)' }}>{tpl.name}</span>
                          {tpl.is_default && (
                            <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--gold)', color: '#fff', padding: '1px 6px', borderRadius: 10, letterSpacing: '.04em' }}>POR DEFECTO</span>
                          )}
                        </div>
                        {tpl.description && <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{tpl.description}</div>}
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 3, opacity: .7 }}>
                          Actualizada {new Date(tpl.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {!tpl.is_default && (
                          <button title="Marcar como por defecto" className="btn btn-ghost btn-sm" onClick={() => setDefault(tpl.id)}>
                            <Star size={13} />
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/proposals/templates/${tpl.id}`)}>
                          Editar
                        </button>
                        <button title="Eliminar" className="btn btn-ghost btn-sm" onClick={() => handleDelete(tpl.id)} disabled={deleting === tpl.id}
                          style={{ color: '#dc2626' }}>
                          {deleting === tpl.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

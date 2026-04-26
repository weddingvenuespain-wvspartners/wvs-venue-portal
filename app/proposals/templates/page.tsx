'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, LayoutTemplate, Trash2, Star, FileText, Loader2, Pencil } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Tabs from '@/components/Tabs'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { usePlanFeatures } from '@/lib/use-plan-features'

type Template = {
  id: string
  name: string
  description: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

// Module-level cache so re-entering this tab is instant.
let cachedTemplates: Template[] | null = null

export default function TemplatesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { isBlocked, ready } = useRequireSubscription()
  const features = usePlanFeatures()

  const [templates, setTemplates] = useState<Template[]>(cachedTemplates ?? [])
  const [loading, setLoading] = useState(cachedTemplates === null)
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
      .then(data => {
        const list = Array.isArray(data) ? data : []
        cachedTemplates = list
        setTemplates(list)
        setLoading(false)
      })
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
    setTemplates(t => {
      const next = t.filter(x => x.id !== id)
      cachedTemplates = next
      return next
    })
    setDeleting(null)
  }

  const setDefault = async (id: string) => {
    await fetch(`/api/proposal-templates/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_default: true }) })
    setTemplates(t => {
      const next = t.map(x => ({ ...x, is_default: x.id === id }))
      cachedTemplates = next
      return next
    })
  }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Propuestas</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              <Plus size={13} /> Nueva plantilla
            </button>
          </div>
        </div>

        <Tabs
          activeKey="templates"
          tabs={[
            { key: 'proposals', label: 'Propuestas', icon: FileText, href: '/proposals' },
            { key: 'templates', label: 'Plantillas', icon: LayoutTemplate },
          ]}
        />

        <div className="page-content">
          {/* Intro */}
          <p style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.55, maxWidth: 620, marginBottom: 20 }}>
            Define configuraciones reutilizables: qué secciones aparecen y qué menús y extras se precargan. Al crear una propuesta puedes elegir con qué plantilla parte.
          </p>

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
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
            <div style={{ width: 24, height: 24, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : templates.length === 0 ? (
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
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(max(180px, 22%), 1fr))',
            gap: 16,
          }}>
            {templates.map(tpl => (
              <div
                key={tpl.id}
                onClick={() => router.push(`/proposals/templates/${tpl.id}`)}
                style={{
                  position: 'relative',
                  display: 'flex', flexDirection: 'column',
                  background: '#fff',
                  border: '1px solid var(--ivory)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                  transition: 'border-color .15s, box-shadow .15s, transform .15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--gold)'
                  e.currentTarget.style.boxShadow = '0 8px 22px rgba(0,0,0,.1)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  const ov = e.currentTarget.querySelector<HTMLElement>('.tpl-card-hover')
                  if (ov) ov.style.opacity = '1'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--ivory)'
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.06)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  const ov = e.currentTarget.querySelector<HTMLElement>('.tpl-card-hover')
                  if (ov) ov.style.opacity = '0'
                }}
              >
                {/* Preview thumbnail */}
                <div style={{ position: 'relative', height: 200, background: '#f9f6f2', borderBottom: '1px solid var(--ivory)', overflow: 'hidden' }}>
                  <iframe
                    src={`/proposals/templates/${tpl.id}/preview`}
                    loading="lazy"
                    title={`Preview ${tpl.name}`}
                    style={{
                      position: 'absolute', top: 0, left: 0,
                      width: '400%', height: '400%',
                      transform: 'scale(0.25)',
                      transformOrigin: 'top left',
                      border: 0,
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Hover overlay with edit hint */}
                  <div className="tpl-card-hover" style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(45, 36, 28, 0.55)',
                    color: '#fff',
                    opacity: 0,
                    transition: 'opacity .15s',
                    pointerEvents: 'none',
                    fontSize: 12, fontWeight: 600, letterSpacing: '.02em',
                    gap: 6,
                  }}>
                    <Pencil size={14} /> Editar plantilla
                  </div>
                  {tpl.is_default && (
                    <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, fontWeight: 700, background: 'var(--gold)', color: '#fff', padding: '2px 6px', borderRadius: 10, letterSpacing: '.04em' }}>POR DEFECTO</span>
                  )}
                </div>

                {/* Footer with name + actions */}
                <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                      {tpl.name}
                    </div>
                    <div style={{ display: 'flex', gap: 0 }} onClick={e => e.stopPropagation()}>
                      <button title="Editar" className="btn btn-ghost btn-sm" onClick={() => router.push(`/proposals/templates/${tpl.id}`)}
                        style={{ height: 26, width: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Pencil size={12} />
                      </button>
                      {!tpl.is_default && (
                        <button title="Marcar como por defecto" className="btn btn-ghost btn-sm" onClick={() => setDefault(tpl.id)}
                          style={{ height: 26, width: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Star size={12} />
                        </button>
                      )}
                      <button title="Eliminar" className="btn btn-ghost btn-sm" onClick={() => handleDelete(tpl.id)} disabled={deleting === tpl.id}
                        style={{ height: 26, width: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                        {deleting === tpl.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--warm-gray)', opacity: .7 }}>
                    Actualizada {new Date(tpl.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

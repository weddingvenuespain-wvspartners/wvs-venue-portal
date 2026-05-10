'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, LayoutTemplate, Trash2, Star, Loader2, Pencil, FileText, X, Zap, Sparkles, ClipboardList, MessageCircle, Target, Check, type LucideIcon } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Tabs from '@/components/Tabs'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { usePlanFeatures } from '@/lib/use-plan-features'
import { DEFAULT_TEMPLATES, type DefaultTemplateIcon } from '@/lib/proposal-starter-templates'

const SAMPLE_ICON: Record<DefaultTemplateIcon, LucideIcon> = {
  'zap': Zap,
  'sparkles': Sparkles,
  'clipboard-list': ClipboardList,
  'message-circle': MessageCircle,
  'target': Target,
}

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
  const [deleting, setDeleting] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'samples' | 'mine'>('samples')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

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

  const startDraft = (fromSampleId?: string) => {
    setPickerOpen(false)
    router.push(fromSampleId
      ? `/proposals/templates/new?from=${fromSampleId}`
      : '/proposals/templates/new')
  }

  const setDefault = async (id: string) => {
    await fetch(`/api/proposal-templates/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_default: true }) })
    setTemplates(t => {
      const next = t.map(x => ({ ...x, is_default: x.id === id }))
      cachedTemplates = next
      return next
    })
  }

  const startRename = (tpl: Template) => {
    setRenamingId(tpl.id)
    setRenameValue(tpl.name)
  }

  const commitRename = async () => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return }
    await fetch(`/api/proposal-templates/${renamingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: renameValue.trim() }) })
    setTemplates(t => {
      const next = t.map(x => x.id === renamingId ? { ...x, name: renameValue.trim() } : x)
      cachedTemplates = next
      return next
    })
    setRenamingId(null)
  }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Propuestas</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setPickerOpen(true)}>
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

          {/* Sub-tab segmented control */}
          <div style={{ display: 'inline-flex', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 8, padding: 3, marginBottom: 18 }}>
            {([
              { key: 'samples', label: `Estilos de página · ${DEFAULT_TEMPLATES.length}` },
              { key: 'mine',    label: `Mis plantillas · ${templates.length}` },
            ] as const).map(t => {
              const active = activeSection === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveSection(t.key)}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6,
                    border: 'none', cursor: 'pointer',
                    background: active ? '#fff' : 'transparent',
                    color: active ? 'var(--charcoal)' : 'var(--warm-gray)',
                    boxShadow: active ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                    transition: 'background .15s, color .15s, box-shadow .15s',
                  }}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* Samples grid */}
          {activeSection === 'samples' && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.55, marginBottom: 14 }}>
                5 estilos de página con datos de ejemplo. Haz clic en cualquiera para duplicarla a tu cuenta y editarla.
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(max(180px, 22%), 1fr))',
                gap: 16,
              }}>
                {DEFAULT_TEMPLATES.map(sample => (
                    <div
                      key={sample.id}
                      onClick={() => startDraft(sample.id)}
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
                        const ov = e.currentTarget.querySelector<HTMLElement>('.sample-card-hover')
                        if (ov) ov.style.opacity = '1'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--ivory)'
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.06)'
                        e.currentTarget.style.transform = 'translateY(0)'
                        const ov = e.currentTarget.querySelector<HTMLElement>('.sample-card-hover')
                        if (ov) ov.style.opacity = '0'
                      }}
                    >
                      {/* Real iframe preview using the sample id route */}
                      <div style={{ position: 'relative', height: 200, background: '#f9f6f2', borderBottom: '1px solid var(--ivory)', overflow: 'hidden' }}>
                        <iframe
                          src={`/proposals/templates/${sample.id}/preview`}
                          loading="lazy"
                          title={`Preview ${sample.name}`}
                          style={{
                            position: 'absolute', top: 0, left: 0,
                            width: '400%', height: '400%',
                            transform: 'scale(0.25)',
                            transformOrigin: 'top left',
                            border: 0,
                            pointerEvents: 'none',
                          }}
                        />
                        <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, fontWeight: 700, background: 'rgba(255,255,255,.85)', color: 'var(--charcoal)', padding: '2px 6px', borderRadius: 10, letterSpacing: '.04em' }}>ESTILO</span>
                        <div className="sample-card-hover" style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          background: 'rgba(45, 36, 28, 0.65)',
                          color: '#fff',
                          opacity: 0,
                          transition: 'opacity .15s',
                          pointerEvents: 'none',
                          fontSize: 12, fontWeight: 600, letterSpacing: '.02em',
                        }}>
                          <Pencil size={14} /> Usar como base
                        </div>
                      </div>
                      <div style={{ padding: '10px 12px 12px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sample.name}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--warm-gray)', opacity: .7, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sample.description}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Mis plantillas — listado */}
          {activeSection === 'mine' && (
          <>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
            <div style={{ width: 24, height: 24, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : templates.length === 0 ? (
          <div style={{ padding: '20px 16px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--warm-gray)' }}>
            Todavía no tienes plantillas propias. Pulsa <strong>Nueva plantilla</strong> para empezar (en blanco o partiendo de una muestra).
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
                    {renamingId === tpl.id ? (
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <input
                          autoFocus
                          className="form-input"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                          onBlur={() => commitRename()}
                          style={{ fontSize: 12, height: 26, padding: '0 8px', flex: 1, minWidth: 0 }}
                        />
                        <button className="btn btn-ghost btn-sm" onClick={commitRename}
                          style={{ height: 26, width: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sage)' }}>
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div
                          style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, cursor: 'text' }}
                          onClick={e => { e.stopPropagation(); startRename(tpl) }}
                          title="Haz clic para renombrar"
                        >
                          {tpl.name}
                        </div>
                        <div style={{ display: 'flex', gap: 0 }} onClick={e => e.stopPropagation()}>
                          <button title="Renombrar" className="btn btn-ghost btn-sm" onClick={() => startRename(tpl)}
                            style={{ height: 26, width: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Pencil size={10} />
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
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--warm-gray)', opacity: .7 }}>
                    Actualizada {new Date(tpl.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
          </>
          )}
        </div>
      </div>

      {pickerOpen && (
        <div className="modal-overlay" onClick={() => setPickerOpen(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ position: 'relative', paddingRight: 48 }}>
              <div className="modal-title">Nueva plantilla</div>
              <div className="modal-sub">Empieza desde cero o usa uno de los estilos de página como base</div>
              <button onClick={() => setPickerOpen(false)} style={{ position: 'absolute', top: '50%', right: 16, transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 6, display: 'flex', alignItems: 'center', borderRadius: 6 }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => startDraft()}
                className="starter-card"
                style={{ flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}
              >
                <div className="starter-card-icon">
                  <FileText size={20} strokeWidth={1.6} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>En blanco</div>
                  <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.5 }}>Plantilla vacía para configurar desde cero.</div>
                </div>
              </button>
              {DEFAULT_TEMPLATES.map(tpl => {
                const Icon = SAMPLE_ICON[tpl.icon]
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => startDraft(tpl.id)}
                    className="starter-card"
                    style={{ flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}
                  >
                    <div className="starter-card-icon">
                      <Icon size={20} strokeWidth={1.6} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>{tpl.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.5 }}>{tpl.description}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

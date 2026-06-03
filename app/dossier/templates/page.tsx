'use client'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, LayoutTemplate, Trash2, Star, Loader2, Pencil, FileText, X, Zap, Sparkles, ClipboardList, MessageCircle, Target, Check, ChevronLeft, ChefHat, BedDouble, type LucideIcon } from 'lucide-react'
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
  'bed-double': BedDouble,
}

type Template = {
  id: string
  name: string
  description: string | null
  is_default: boolean
  sections_data?: { visual_template_id?: number } | null
  created_at: string
  updated_at: string
}

const STYLE_NAMES: Record<number, string> = {
  1: 'Impacto Directo',
  2: 'Emoción Primero',
  3: 'Todo Claro',
  4: 'Social Proof',
  5: 'Minimalista',
}

/* Visual identity per sample template */
const SAMPLE_VISUAL: Record<string, { bg: string; accent: string; fg: string; tagline: string }> = {
  t1: { bg: '#1B1A17', accent: '#C4975A', fg: '#E8E2D6', tagline: 'Dark luxury' },
  t2: { bg: '#FAF6F0', accent: '#8B6914', fg: '#3A2E1C', tagline: 'Cream editorial' },
  t3: { bg: '#F4F7F5', accent: '#2D4A3A', fg: '#1E2E24', tagline: 'Estructurado' },
  t4: { bg: '#F0F2F8', accent: '#4A5C8A', fg: '#2A3050', tagline: 'Social proof' },
  t5: { bg: '#FFFFFF', accent: '#1A1A1A', fg: '#1A1A1A', tagline: 'Minimal' },
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
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Multi-step picker modal
  const [pickerStep, setPickerStep] = useState<'style' | 'catering' | 'config' | 'modality'>('style')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerFrom, setPickerFrom] = useState<string | undefined>(undefined)
  const [pickerCatering, setPickerCatering] = useState<boolean | null>(null)
  const [pickerModalities, setPickerModalities] = useState<any[]>([])
  const [pickerConfigs, setPickerConfigs] = useState<any[]>([])
  const [pickerConfigId, setPickerConfigId] = useState<string | null>(null)

  const openPicker = () => {
    setPickerStep('style'); setPickerFrom(undefined); setPickerCatering(null)
    setPickerConfigId(null); setPickerOpen(true)
  }
  const closePicker = () => setPickerOpen(false)

  useEffect(() => {
    if (!pickerOpen) return
    if (pickerModalities.length === 0) {
      fetch('/api/estructura/modalities').then(r => r.ok ? r.json() : null).then(d => { if (d?.modalities) setPickerModalities(d.modalities) }).catch(() => {})
    }
    if (pickerConfigs.length === 0) {
      fetch('/api/estructura/commercial-configs').then(r => r.ok ? r.json() : null).then(d => { if (d?.configs) setPickerConfigs(d.configs.filter((c: any) => (c.config_type ?? 'space') === 'space')) }).catch(() => {})
    }
  }, [pickerOpen, pickerModalities.length, pickerConfigs.length])

  useEffect(() => {
    if (authLoading || !ready) return
    if (!user || isBlocked || !features.propuestas) { router.replace('/dossier'); return }
    fetch('/api/dossier-templates')
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
    await fetch(`/api/dossier-templates/${id}`, { method: 'DELETE' })
    setTemplates(t => {
      const next = t.filter(x => x.id !== id)
      cachedTemplates = next
      return next
    })
    setDeleting(null)
  }

  const startDraft = (modalityId?: string | null) => {
    setPickerOpen(false)
    const params = new URLSearchParams()
    if (pickerFrom) params.set('from', pickerFrom)
    if (pickerCatering !== null) params.set('catering', pickerCatering ? '1' : '0')
    if (pickerConfigId) params.set('config_id', pickerConfigId)
    if (modalityId) params.set('modality_id', modalityId)
    router.push(`/dossier/templates/new${params.size > 0 ? '?' + params.toString() : ''}`)
  }

  const setDefault = async (id: string) => {
    await fetch(`/api/dossier-templates/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_default: true }) })
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
    await fetch(`/api/dossier-templates/${renamingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: renameValue.trim() }) })
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
          <div className="topbar-title">Dosieres</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={openPicker}>
              <Plus size={13} /> Nueva plantilla
            </button>
          </div>
        </div>

        <Tabs
          activeKey="templates"
          tabs={[
            { key: 'proposals', label: 'Propuestas', icon: FileText, href: '/dossier' },
            { key: 'templates', label: 'Plantillas', icon: LayoutTemplate },
          ]}
        />

        <div className="page-content">
          {/* Intro */}
          <p style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.55, maxWidth: 620, marginBottom: 20 }}>
            Define configuraciones reutilizables: qué secciones aparecen y qué menús y extras se precargan. Al crear una propuesta puedes elegir con qué plantilla parte.
          </p>

          {/* Sub-tab segmented control */}
          <div style={{ display: 'inline-flex', gap: 0, background: '#fff', borderRadius: '8px 8px 0 0', border: '1px solid var(--border)', borderBottom: '2px solid var(--border)', marginBottom: 18 }}>
            {([
              { key: 'samples', label: 'Estilos de página', count: DEFAULT_TEMPLATES.length },
              { key: 'mine',    label: 'Mis plantillas', count: templates.length },
            ] as const).map((t, i) => {
              const active = activeSection === t.key
              return (
                <React.Fragment key={t.key}>
                  {i > 0 && <div style={{ width: 1, background: 'var(--border)', margin: '6px 0' }} />}
                  <button
                    type="button"
                    onClick={() => setActiveSection(t.key)}
                    style={{
                      fontSize: 12.5, fontWeight: active ? 700 : 500, padding: '8px 16px 10px', borderRadius: 0,
                      border: 'none', cursor: 'pointer', background: 'transparent', position: 'relative',
                      color: active ? 'var(--charcoal)' : 'var(--warm-gray)',
                      borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
                      marginBottom: -2,
                      transition: 'color .15s, border-color .15s',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {t.label}
                    <span style={{
                      fontSize: 10, fontWeight: 700, lineHeight: 1,
                      padding: '2px 6px', borderRadius: 10,
                      background: active ? 'var(--gold)' : 'var(--cream)',
                      color: active ? '#fff' : 'var(--warm-gray)',
                      transition: 'background .15s, color .15s',
                    }}>{t.count}</span>
                  </button>
                </React.Fragment>
              )
            })}
          </div>

          {/* Samples grid */}
          {activeSection === 'samples' && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.55, marginBottom: 14 }}>
                5 estilos de página con datos de ejemplo. Haz clic en cualquiera para ver una vista previa.
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(max(220px, 22%), 1fr))',
                gap: 16,
              }}>
                {DEFAULT_TEMPLATES.map(sample => {
                  const v = SAMPLE_VISUAL[sample.id] || SAMPLE_VISUAL.t5
                  const Icon = SAMPLE_ICON[sample.icon]
                  return (
                    <div
                      key={sample.id}
                      onClick={() => window.open(`/dossier/templates/${sample.id}/preview`, '_blank')}
                      style={{
                        position: 'relative',
                        display: 'flex', flexDirection: 'column',
                        background: '#fff',
                        border: '1px solid var(--ivory)',
                        borderRadius: 14,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                        transition: 'border-color .2s, box-shadow .2s, transform .2s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = v.accent
                        e.currentTarget.style.boxShadow = `0 12px 28px rgba(0,0,0,.12)`
                        e.currentTarget.style.transform = 'translateY(-3px)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--ivory)'
                        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.06)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      {/* Color preview area */}
                      <div style={{
                        background: v.bg,
                        padding: '24px 18px 20px',
                        position: 'relative',
                        overflow: 'hidden',
                      }}>
                        {/* Decorative mini-layout lines */}
                        <div style={{ opacity: 0.15 }}>
                          <div style={{ width: '40%', height: 3, background: v.accent, borderRadius: 2, marginBottom: 6 }} />
                          <div style={{ width: '70%', height: 2, background: v.fg, borderRadius: 2, marginBottom: 4 }} />
                          <div style={{ width: '55%', height: 2, background: v.fg, borderRadius: 2, marginBottom: 4 }} />
                          <div style={{ width: '30%', height: 2, background: v.fg, borderRadius: 2 }} />
                        </div>
                        {/* Accent dot */}
                        <div style={{
                          position: 'absolute', top: 12, right: 12,
                          width: 28, height: 28, borderRadius: 8,
                          background: v.accent,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: 0.9,
                        }}>
                          <Icon size={14} style={{ color: v.bg }} strokeWidth={2} />
                        </div>
                        {/* Tagline chip */}
                        <div style={{
                          marginTop: 10,
                          display: 'inline-flex',
                          padding: '2px 8px', borderRadius: 6,
                          background: `${v.accent}18`,
                          border: `1px solid ${v.accent}30`,
                          fontSize: 9, fontWeight: 600, letterSpacing: '.04em',
                          color: v.accent, textTransform: 'uppercase',
                        }}>
                          {v.tagline}
                        </div>
                      </div>
                      {/* Card footer */}
                      <div style={{ padding: '12px 16px 14px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--charcoal)', lineHeight: 1.2, marginBottom: 3 }}>
                          {sample.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.4 }}>
                          {sample.description}
                        </div>
                      </div>
                    </div>
                  )
                })}
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
            Todavía no tienes plantillas propias. Pulsa <strong>Nueva plantilla</strong> para empezar partiendo de un estilo.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(max(180px, 22%), 1fr))',
            gap: 16,
          }}>
            {templates.map(tpl => {
              const tplStyleId = tpl.sections_data?.visual_template_id
              const tplKey = tplStyleId ? `t${tplStyleId}` : null
              const tplVis = tplKey ? SAMPLE_VISUAL[tplKey] : null
              return (
              <div
                key={tpl.id}
                onClick={() => router.push(`/dossier/templates/${tpl.id}`)}
                style={{
                  position: 'relative',
                  display: 'flex', flexDirection: 'column',
                  background: '#fff',
                  border: '1px solid var(--ivory)',
                  borderRadius: 14,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                  transition: 'border-color .2s, box-shadow .2s, transform .2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = tplVis?.accent || 'var(--gold)'
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,.12)'
                  e.currentTarget.style.transform = 'translateY(-3px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--ivory)'
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.06)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                {/* Color band */}
                <div style={{
                  height: 4,
                  background: tplVis ? `linear-gradient(90deg, ${tplVis.accent}, ${tplVis.accent}88)` : 'linear-gradient(90deg, var(--gold), var(--gold-light))',
                }} />

                {/* Body with name + actions */}
                <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                        <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                          <button title="Renombrar" className="btn btn-ghost btn-sm" onClick={() => startRename(tpl)}
                            style={{ height: 24, width: 24, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Pencil size={11} />
                          </button>
                          {!tpl.is_default && (
                            <button title="Marcar como por defecto" className="btn btn-ghost btn-sm" onClick={() => setDefault(tpl.id)}
                              style={{ height: 24, width: 24, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Star size={11} />
                            </button>
                          )}
                          <button title="Eliminar plantilla" className="btn btn-ghost btn-sm" onClick={() => handleDelete(tpl.id)} disabled={deleting === tpl.id}
                            style={{ height: 24, width: 24, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#B0473E' }}>
                            {deleting === tpl.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', opacity: .7, flex: 1 }}>
                      Actualizada {new Date(tpl.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    {tpl.is_default && (
                      <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--gold)', color: '#fff', padding: '2px 6px', borderRadius: 10, letterSpacing: '.04em', flexShrink: 0 }}>POR DEFECTO</span>
                    )}
                  </div>
                  {tpl.sections_data?.visual_template_id && STYLE_NAMES[tpl.sections_data.visual_template_id] && (
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <LayoutTemplate size={10} style={{ opacity: 0.5 }} />
                      {STYLE_NAMES[tpl.sections_data.visual_template_id]}
                    </div>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); router.push(`/dossier/templates/${tpl.id}`) }}
                    className="btn btn-ghost btn-sm"
                    style={{ width: '100%', marginTop: 6, fontSize: 11, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 6 }}
                  >
                    <Pencil size={11} /> Editar contenido
                  </button>
                </div>
              </div>
            )})}
          </div>
        )}
          </>
          )}
        </div>
      </div>

      {pickerOpen && (
        <div className="modal-overlay" onClick={closePicker}>
          <div className="modal" style={{ maxWidth: pickerStep === 'style' ? 640 : 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ position: 'relative', paddingRight: 48 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {pickerStep !== 'style' && (
                  <button type="button" onClick={() => setPickerStep(pickerStep === 'modality' ? 'config' : pickerStep === 'config' ? 'catering' : 'style')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', padding: 0 }}>
                    <ChevronLeft size={16} />
                  </button>
                )}
                <div>
                  <div className="modal-title" style={{ marginBottom: 2 }}>
                    {pickerStep === 'style' ? 'Nueva plantilla'
                      : pickerStep === 'catering' ? '¿Incluye catering?'
                      : pickerStep === 'config' ? '¿Qué configuración comercial?'
                      : '¿Qué modalidad?'}
                  </div>
                  <div className="modal-sub">
                    {pickerStep === 'style' ? 'Elige uno de los estilos de página como base'
                      : pickerStep === 'catering' ? 'Activa la pestaña de Menús en el editor'
                      : pickerStep === 'config' ? 'Define qué config aplicará a esta plantilla'
                      : 'Se precargará al crear un dosier con esta plantilla'}
                  </div>
                </div>
              </div>
              <button onClick={closePicker} style={{ position: 'absolute', top: '50%', right: 16, transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 6, display: 'flex', alignItems: 'center', borderRadius: 6 }}>
                <X size={20} />
              </button>
            </div>

            {/* Step 1 — Style (must always pick a visual style; no blank option) */}
            {pickerStep === 'style' && (
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {DEFAULT_TEMPLATES.map(tpl => {
                  const Icon = SAMPLE_ICON[tpl.icon]
                  return (
                    <button key={tpl.id} type="button" onClick={() => { setPickerFrom(tpl.id); setPickerStep('catering') }}
                      className="starter-card" style={{ flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                      <div className="starter-card-icon"><Icon size={20} strokeWidth={1.6} /></div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>{tpl.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.5 }}>{tpl.description}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Step 2 — Catering */}
            {pickerStep === 'catering' && (
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button type="button" onClick={() => { setPickerCatering(true); setPickerStep('config') }}
                  style={{ padding: '20px 24px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', border: '2px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(196,151,90,0.12)', border: '1.5px solid rgba(196,151,90,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ChefHat size={18} style={{ color: 'var(--gold)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 3 }}>Sí, incluye menú y catering</div>
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Configura cóctel, menús principales, noche y madrugada</div>
                  </div>
                </button>
                <button type="button" onClick={() => { setPickerCatering(false); setPickerStep('config') }}
                  style={{ padding: '20px 24px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', border: '2px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--cream)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <LayoutTemplate size={18} style={{ color: 'var(--warm-gray)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 3 }}>No, solo información del venue</div>
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Sin sección de menús ni selección de platos</div>
                  </div>
                </button>
              </div>
            )}

            {/* Step 3 — Config comercial (improved UI) */}
            {pickerStep === 'config' && (
              <div className="modal-body">
                {pickerConfigs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                      <Plus size={22} style={{ color: 'var(--gold)' }} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 6 }}>Sin configuraciones</div>
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)', maxWidth: 320, margin: '0 auto', lineHeight: 1.5 }}>
                      No hay configuraciones comerciales tipo "Espacio". Crea una en <strong>Configuración → Alquiler y tarifas</strong> antes de continuar.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                    {pickerConfigs.map((c: any) => {
                      const spaceLabel = { single: 'Espacio único', single_with_supplements: 'Base + zonas', multiple_independent: 'Grupos espacios' }[c.config?.space_type as string] ?? '—'
                      const priceLabel = { rental: 'Alquiler', per_person: 'Por persona', package: 'Paquetes' }[c.config?.price_model as string] ?? '—'
                      const modCount = pickerModalities.filter((m: any) => m.commercial_config_id === c.id).length
                      return (
                        <button key={c.id} type="button" onClick={() => { setPickerConfigId(c.id); setPickerStep('modality') }}
                          style={{
                            padding: 16, borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                            border: '2px solid var(--ivory)', background: '#fff',
                            display: 'flex', flexDirection: 'column', gap: 10,
                            transition: 'all .15s', position: 'relative',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.background = 'var(--cream)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ivory)'; e.currentTarget.style.background = '#fff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(74,107,82,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <LayoutTemplate size={18} style={{ color: 'var(--gold)' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--charcoal)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{modCount} {modCount === 1 ? 'modalidad' : 'modalidades'}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid var(--ivory)' }}>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'var(--cream)', color: 'var(--espresso)', border: '1px solid var(--ivory)' }}>{spaceLabel}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'var(--cream)', color: 'var(--espresso)', border: '1px solid var(--ivory)' }}>{priceLabel}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Step 4 — Modality (improved UI, filtered by selected config) */}
            {pickerStep === 'modality' && (() => {
              const filtered = pickerModalities.filter((m: any) => m.commercial_config_id === pickerConfigId)
              const cfg = pickerConfigs.find(c => c.id === pickerConfigId)
              const DUR_LABEL: Record<string, { label: string; emoji: string }> = {
                '1_day':         { label: 'Día completo',  emoji: '☀️' },
                '1_day_morning': { label: 'Medio día',     emoji: '🌤️' },
                '2_days':        { label: '2 días',         emoji: '🌗' },
                'package':       { label: 'Paquete',        emoji: '📦' },
                'custom':        { label: 'Personalizada', emoji: '🛠️' },
              }
              return (
                <div className="modal-body">
                  {cfg && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--warm-gray)', marginBottom: 12, padding: '6px 12px', background: 'var(--cream)', borderRadius: 6, border: '1px solid var(--ivory)' }}>
                      <LayoutTemplate size={12} style={{ color: 'var(--gold)' }} />
                      <span>Configuración: <strong style={{ color: 'var(--charcoal)' }}>{cfg.name}</strong></span>
                    </div>
                  )}
                  {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 22 }}>☀️</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 6 }}>Sin modalidades</div>
                      <div style={{ fontSize: 12, color: 'var(--warm-gray)', maxWidth: 320, margin: '0 auto', lineHeight: 1.5 }}>
                        Esta configuración aún no tiene modalidades. Ve a <strong>Configuración → Alquiler y tarifas</strong> para crearlas.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                      {filtered.map((m: any) => {
                        const dt = DUR_LABEL[m.duration_type] ?? { label: '', emoji: '☀️' }
                        const priceCount = (m.prices?.length ?? 0) + (m.packages ?? []).reduce((s: number, p: any) => s + (p.prices?.length ?? 0), 0)
                        return (
                          <button key={m.id} type="button" onClick={() => startDraft(m.id)}
                            style={{
                              padding: 16, borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                              border: '2px solid var(--ivory)', background: '#fff',
                              display: 'flex', flexDirection: 'column', gap: 10,
                              transition: 'all .15s', opacity: m.is_active === false ? 0.5 : 1,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.background = 'var(--cream)' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ivory)'; e.currentTarget.style.background = '#fff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(196,151,90,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>{dt.emoji}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--charcoal)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{m.duration_label ?? dt.label}</div>
                              </div>
                            </div>
                            {priceCount > 0 && (
                              <div style={{ display: 'flex', gap: 5, paddingTop: 6, borderTop: '1px solid var(--ivory)' }}>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'var(--cream)', color: 'var(--espresso)', border: '1px solid var(--ivory)' }}>{priceCount} tarifa{priceCount === 1 ? '' : 's'}</span>
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import {
  ChevronLeft, ChevronDown, Check, Loader2, ChefHat, LayoutTemplate,
  Upload, X, Monitor, Smartphone, RefreshCcw, ExternalLink,
  PanelLeftOpen, PanelLeftClose, Info, Palette,
} from 'lucide-react'
import type { SectionsData, VenueSpaceGroup } from '@/lib/proposal-types'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { GOOGLE_FONTS, FONT_CATEGORIES, ALL_FONTS_URL, getFontByValue } from '@/lib/fonts'
import ProposalMenuEditor from './ProposalMenuEditor'
import SpaceGroupEditor from './SpaceGroupEditor'
import MultipleZonesEditor from './MultipleZonesEditor'
import { INCLUSION_ICON_CHOICES } from '@/app/proposal/[slug]/tpl/shared'
import { getSectionLabel, SECTION_SPACE_TYPES, SPACE_TYPE_LABELS } from '@/lib/section-visibility'

// ─── Section catalogue ────────────────────────────────────────────────────────

export const ALL_SECTION_IDS = [
  'hero', 'availability', 'sticky_nav',
  'welcome', 'welcome_light', 'welcome_split', 'welcome_editorial',
  'experience', 'gallery',
  'single_space', 'zones', 'space_groups', 'venue_rental', 'inclusions', 'testimonials',
  'collaborators', 'accommodation', 'extra_services',
  'faq', 'schedule_visit', 'map', 'contact',
] as const

type SectionId = typeof ALL_SECTION_IDS[number]

const SECTION_LABELS: Record<SectionId, string> = {
  hero:              'Foto principal',
  availability:      'Disponibilidad',
  sticky_nav:        'Menú de navegación (sticky top)',
  welcome:           'Bienvenida · Oscura (cita centrada)',
  welcome_light:     'Bienvenida · Fondo claro',
  welcome_split:     'Bienvenida · Dos columnas',
  welcome_editorial: 'Bienvenida · Editorial (tipografía grande)',
  experience:        'La experiencia',
  gallery:           'Galería de fotos',
  single_space:      'Tu espacio',
  zones:             'Zonas del venue',
  space_groups:      'Grupos de espacios',
  venue_rental:      'Tarifas de alquiler (grid temporada × día)',
  inclusions:        'Qué incluye',
  testimonials:      'Testimonios',
  collaborators:     'Colaboradores',
  accommodation:     'Alojamiento',
  extra_services:    'Servicios adicionales',
  faq:               'Preguntas frecuentes',
  schedule_visit:    'Agendar visita',
  map:               'Mapa y ubicación',
  contact:           'Datos de contacto',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentTemplate = {
  id: string
  name: string
  description: string | null
  sections_data: SectionsData
  is_default: boolean
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TemplateEditor({
  template,
  onBack,
  onSave,
}: {
  template: ContentTemplate
  onBack?: () => void
  onSave?: (updated: ContentTemplate) => void
}) {
  const { user } = useAuth()

  const [name, setName]               = useState(template.name)
  const [description, setDescription] = useState(template.description ?? '')
  const [isDefault, setIsDefault]     = useState(template.is_default)
  const [sections, setSections]       = useState<SectionsData>(template.sections_data ?? {})
  const [activeTab, setActiveTab]     = useState<'sections' | 'menus' | 'visual'>('sections')
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [dirty, setDirty]             = useState(false)

  // Sidebar width: normal (340) or expanded (580)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const sidebarWidth = sidebarExpanded ? 580 : 340

  // Preview iframe
  const iframeRef  = useRef<HTMLIFrameElement>(null)
  const [iframeReady, setIframeReady] = useState(false)
  const [device, setDevice]           = useState<'desktop' | 'mobile'>('desktop')

  // Upload states
  const [uploadingHero,    setUploadingHero]    = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const [uploadingLogo,    setUploadingLogo]    = useState(false)
  const heroInputRef    = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef    = useRef<HTMLInputElement>(null)

  // Open/close section content cards
  const [openSecs, setOpenSecs] = useState<Set<string>>(new Set())

  // Venue commercial config + zones — drives which sections appear and their labels,
  // plus the multiple_independent zone picker
  const [commercialConfig, setCommercialConfig] = useState<{ space_type: string; price_model: string } | null>(null)
  const [venueSpaceGroups, setVenueSpaceGroups] = useState<VenueSpaceGroup[]>([])
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    ;(async () => {
      const { data } = await supabase
        .from('venue_settings')
        .select('commercial_config, space_groups')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data?.commercial_config) setCommercialConfig(data.commercial_config as any)
      if (Array.isArray(data?.space_groups)) setVenueSpaceGroups(data.space_groups as VenueSpaceGroup[])
    })()
  }, [user])

  const iframeUrl = `/proposals/templates/${template.id}/preview`

  // ── postMessage live preview ──────────────────────────────────────────────
  const buildPatch = useCallback(() => ({
    couple_name:         'Sofía & Alejandro',
    personal_message:    (sections as any).welcome_default || 'Querida Sofía & Alejandro, es un placer teneros aquí. Hemos preparado esta propuesta pensando en vosotros.',
    guest_count:         150,
    wedding_date:        null,
    price_estimate:      null,
    show_availability:   false,
    show_price_estimate: false,
    sections_data:       sections,
    branding: {
      logo_url:      sections.logo_url ?? null,
      primary_color: sections.primary_color ?? '#2d4a7a',
      font_family:   sections.font_family ?? 'Georgia, serif',
    },
  }), [sections])

  useEffect(() => {
    const onMessage = (e: MessageEvent<any>) => {
      if (e.data?.type !== 'proposal-preview-ready') return
      setIframeReady(true)
      iframeRef.current?.contentWindow?.postMessage({ type: 'proposal-preview-update', patch: buildPatch() }, '*')
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [buildPatch])

  useEffect(() => {
    if (!iframeReady) return
    const t = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'proposal-preview-update', patch: buildPatch() }, '*')
    }, 200)
    return () => clearTimeout(t)
  }, [sections, iframeReady, buildPatch])

  useEffect(() => { setIframeReady(false) }, [device])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const markDirty = () => { setSaved(false); setDirty(true) }

  const isSectionOn = useCallback((id: string) => {
    const e = sections.sections_enabled
    if (!e) return true
    return e[id] !== false
  }, [sections.sections_enabled])

  const toggleSection = (id: string, val: boolean) => {
    setSections(s => ({ ...s, sections_enabled: { ...(s.sections_enabled ?? {}), [id]: val } }))
    markDirty()
  }

  const WELCOME_VARIANTS = ['welcome', 'welcome_light', 'welcome_split', 'welcome_editorial']
  const WELCOME_VARIANT_LABELS: Record<string, string> = {
    welcome: 'Oscura · cita centrada',
    welcome_light: 'Fondo claro',
    welcome_split: 'Dos columnas con imagen',
    welcome_editorial: 'Editorial · tipografía grande',
  }
  const welcomeGroupOn = !WELCOME_VARIANTS.every(v => (sections.sections_enabled ?? {})[v] === false)
  const activeWelcome = WELCOME_VARIANTS.find(v => (sections.sections_enabled ?? {})[v] === true)
    ?? (welcomeGroupOn ? (WELCOME_VARIANTS.find(v => (sections.sections_enabled ?? {})[v] !== false) ?? 'welcome') : 'welcome')
  const toggleWelcomeGroup = (on: boolean) => {
    setSections(s => ({
      ...s,
      sections_enabled: {
        ...(s.sections_enabled ?? {}),
        ...Object.fromEntries(WELCOME_VARIANTS.map(v => [v, on ? v === activeWelcome : false]))
      }
    }))
    markDirty()
  }
  const selectWelcomeVariant = (variant: string) => {
    setSections(s => ({
      ...s,
      sections_enabled: {
        ...(s.sections_enabled ?? {}),
        ...Object.fromEntries(WELCOME_VARIANTS.map(wv => [wv, wv === variant]))
      }
    }))
    markDirty()
  }

  const hasCatering = sections.has_catering !== false

  const getOverride = (key: string) => (sections as any)[key] as any[] ?? []
  const setOverride = (key: string, val: any) => { setSections((s: any) => ({ ...s, [key]: val })); markDirty() }
  const updateItem  = (key: string, i: number, field: string, val: any) => {
    const arr = [...getOverride(key)]; arr[i] = { ...arr[i], [field]: val }; setOverride(key, arr)
  }
  const removeItem  = (key: string, i: number) => setOverride(key, getOverride(key).filter((_: any, j: number) => j !== i))
  const addItem     = (key: string, tpl: any) => setOverride(key, [...getOverride(key), tpl])

  // ── Image upload ─────────────────────────────────────────────────────────
  const uploadImage = async (file: File, folder: string): Promise<string | null> => {
    if (!user) return null
    const supabase = createClient()
    const ext  = file.name.split('.').pop()
    const path = `${user.id}/${folder}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('proposal-assets').upload(path, file, { upsert: true })
    if (error) return null
    return supabase.storage.from('proposal-assets').getPublicUrl(path).data.publicUrl
  }

  const handleHeroUpload = async (file: File) => {
    setUploadingHero(true)
    const url = await uploadImage(file, 'hero')
    if (url) { setSections(s => ({ ...s, hero_image_url: url })); markDirty() }
    setUploadingHero(false)
  }

  const handleGalleryUpload = async (files: FileList) => {
    setUploadingGallery(true)
    const urls: string[] = []
    for (const f of Array.from(files)) { const u = await uploadImage(f, 'gallery'); if (u) urls.push(u) }
    if (urls.length) { setSections(s => ({ ...s, gallery_urls: [...(s.gallery_urls ?? []), ...urls] })); markDirty() }
    setUploadingGallery(false)
  }

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true)
    const url = await uploadImage(file, 'logos')
    if (url) { setSections(s => ({ ...s, logo_url: url })); markDirty() }
    setUploadingLogo(false)
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) { setSaveError('El nombre es obligatorio'); return }
    setSaving(true); setSaveError(null)
    try {
      const res = await fetch(`/api/proposal-templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description || null, sections_data: sections, is_default: isDefault }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error al guardar') }
      const updated = await res.json()
      setSaved(true); setDirty(false)
      setTimeout(() => setSaved(false), 3000)
      onSave?.({ ...template, ...updated })
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const addBtn: React.CSSProperties    = { fontSize: 11, color: 'var(--gold)', background: 'none', border: '1px dashed var(--border)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', marginTop: 6, width: '100%' }
  const removeBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: '2px 4px', flexShrink: 0, display: 'inline-flex', alignItems: 'center' }

  // ── Render section content editor ─────────────────────────────────────────
  const renderSectionContent = (secId: SectionId) => {
    const overrideKey = `${secId}_override`

    if (secId === 'hero') return (
      <div>
        <input ref={heroInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleHeroUpload(e.target.files[0])} />
        {sections.hero_image_url && (
          <div style={{ marginBottom: 8, position: 'relative', display: 'inline-block', width: '100%' }}>
            <img src={sections.hero_image_url} alt="hero" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
            <button onClick={() => { setSections(s => ({ ...s, hero_image_url: undefined })); markDirty() }}
              style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={10} color="#fff" />
            </button>
          </div>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => heroInputRef.current?.click()} disabled={uploadingHero} style={{ width: '100%', justifyContent: 'center' }}>
          <Upload size={12} /> {uploadingHero ? 'Subiendo…' : sections.hero_image_url ? 'Cambiar imagen' : 'Subir foto principal'}
        </button>
      </div>
    )

    if (secId === 'welcome') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea className="form-textarea" style={{ minHeight: 90, fontSize: 12 }}
          placeholder="Queridos {{pareja}}, ha sido un placer recibiros en la finca…"
          value={(sections as any).welcome_default ?? ''}
          onChange={e => { setSections(s => ({ ...s, welcome_default: e.target.value } as any)); markDirty() }} />
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 7, padding: '8px 10px', fontSize: 11, color: '#92400e', lineHeight: 1.55 }}>
          <strong>Marcadores dinámicos:</strong><br />
          <code style={{ background: 'rgba(0,0,0,.06)', padding: '1px 4px', borderRadius: 3 }}>{'{{pareja}}'}</code> → nombre de la pareja &nbsp;·&nbsp;
          <code style={{ background: 'rgba(0,0,0,.06)', padding: '1px 4px', borderRadius: 3 }}>{'{{invitados}}'}</code> → nº invitados &nbsp;·&nbsp;
          <code style={{ background: 'rgba(0,0,0,.06)', padding: '1px 4px', borderRadius: 3 }}>{'{{fecha}}'}</code> → fecha de boda
        </div>
      </div>
    )

    if (secId === 'availability') return (
      <textarea className="form-textarea" style={{ minHeight: 60, fontSize: 12 }}
        placeholder="Ej. Fecha disponible con confirmación prioritaria…"
        value={sections.availability_message ?? ''}
        onChange={e => { setSections(s => ({ ...s, availability_message: e.target.value })); markDirty() }} />
    )

    if (secId === 'experience') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input className="form-input" placeholder="Título (ej. Una finca del siglo XVII…)" style={{ fontSize: 12 }}
          value={(sections as any).experience_override?.title ?? ''}
          onChange={e => { setSections(s => ({ ...s, experience_override: { ...((s as any).experience_override ?? {}), title: e.target.value } } as any)); markDirty() }} />
        <textarea className="form-textarea" style={{ minHeight: 100, fontSize: 12 }} placeholder="Historia y descripción del venue…"
          value={(sections as any).experience_override?.body ?? ''}
          onChange={e => { setSections(s => ({ ...s, experience_override: { ...((s as any).experience_override ?? {}), body: e.target.value } } as any)); markDirty() }} />
      </div>
    )

    if (secId === 'gallery') return (
      <div>
        <input ref={galleryInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => e.target.files?.length && handleGalleryUpload(e.target.files)} />
        {(sections.gallery_urls ?? []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {(sections.gallery_urls ?? []).map((url, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={url} alt="" style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 5, border: '1px solid var(--border)', display: 'block' }} />
                <button onClick={() => { setSections(s => ({ ...s, gallery_urls: (s.gallery_urls ?? []).filter((_, j) => j !== i) })); markDirty() }}
                  style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={8} color="#fff" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => galleryInputRef.current?.click()} disabled={uploadingGallery} style={{ width: '100%', justifyContent: 'center' }}>
          <Upload size={12} /> {uploadingGallery ? 'Subiendo…' : 'Añadir fotos a la galería'}
        </button>
      </div>
    )

    if (secId === 'single_space') {
      const ss: any = (sections as any).single_space ?? {}
      const setSs = (patch: any) => { setSections((s: any) => ({ ...s, single_space: { ...((s as any).single_space ?? {}), ...patch } })); markDirty() }
      const features: string[] = Array.isArray(ss.features) ? ss.features : []
      const setFeatures = (next: string[]) => setSs({ features: next })
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="form-input" placeholder="Título (ej. El Salón Principal)" style={{ fontSize: 12 }} value={ss.title ?? ''} onChange={e => setSs({ title: e.target.value })} />
          <textarea className="form-textarea" style={{ minHeight: 70, fontSize: 12 }} placeholder="Descripción del espacio…" value={ss.description ?? ''} onChange={e => setSs({ description: e.target.value })} />
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="form-input" style={{ fontSize: 12 }} placeholder="m² (ej. 500)" value={ss.sqm ?? ''} onChange={e => setSs({ sqm: e.target.value })} />
            <input className="form-input" style={{ fontSize: 12 }} placeholder="Capacidad máx. (ej. 200)" value={ss.max_guests ?? ''} onChange={e => setSs({ max_guests: e.target.value })} />
          </div>
          <input className="form-input" style={{ fontSize: 12 }} placeholder="URL imagen del espacio (opcional)" value={ss.image_url ?? ''} onChange={e => setSs({ image_url: e.target.value })} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 4 }}>Características destacadas</div>
            {features.map((f, fi) => (
              <div key={fi} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                <input className="form-input" style={{ fontSize: 12 }} placeholder="Ej. Aire acondicionado" value={f} onChange={e => setFeatures(features.map((x, j) => j === fi ? e.target.value : x))} />
                <button type="button" style={removeBtn} onClick={() => setFeatures(features.filter((_, j) => j !== fi))}><X size={12} /></button>
              </div>
            ))}
            <button type="button" style={addBtn} onClick={() => setFeatures([...features, ''])}>+ Añadir característica</button>
          </div>
        </div>
      )
    }

    if (secId === 'zones') return (
      <div>
        {getOverride(overrideKey).map((z: any, i: number) => (
          <details key={i} style={{ border: '1px solid var(--border)', borderRadius: 7, marginBottom: 7, overflow: 'hidden' }}>
            <summary style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--charcoal)', fontWeight: 500, background: 'var(--cream)', listStyle: 'none' }}>
              <ChevronDown size={11} color="var(--warm-gray)" />
              <span style={{ flex: 1 }}>{z.name || <em style={{ color: 'var(--warm-gray)' }}>Nueva zona</em>}</span>
              <button type="button" style={removeBtn} onClick={e => { e.preventDefault(); e.stopPropagation(); removeItem(overrideKey, i) }}><X size={12} /></button>
            </summary>
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="form-input" placeholder="Nombre *" style={{ fontSize: 12 }} value={z.name ?? ''} onChange={e => updateItem(overrideKey, i, 'name', e.target.value)} />
                <input className="form-input" style={{ width: 75, flexShrink: 0, fontSize: 12 }} type="number" placeholder="m²" value={z.sqm ?? ''} onChange={e => updateItem(overrideKey, i, 'sqm', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <input className="form-input" placeholder="Descripción" style={{ fontSize: 12 }} value={z.description ?? ''} onChange={e => updateItem(overrideKey, i, 'description', e.target.value)} />
              <input className="form-input" style={{ fontSize: 12 }}
                placeholder={commercialConfig?.space_type === 'single_with_supplements' ? 'Suplemento (ej. +500€)' : 'Precio (opcional)'}
                value={z.price ?? ''} onChange={e => updateItem(overrideKey, i, 'price', e.target.value)} />
              <ZonePhotoUpload zone={z} onUpload={async (file) => { const url = await uploadImage(file, 'zones'); if (url) updateItem(overrideKey, i, 'photos', [url]) }} onRemove={() => updateItem(overrideKey, i, 'photos', [])} />
            </div>
          </details>
        ))}
        <button type="button" style={addBtn} onClick={() => addItem(overrideKey, { name: '', description: '', capacities: [] })}>+ Añadir zona</button>
      </div>
    )

    if (secId === 'space_groups') {
      if (commercialConfig?.space_type === 'multiple_independent') {
        return (
          <MultipleZonesEditor
            venueSpaceGroups={venueSpaceGroups}
            groups={(sections as any).space_groups ?? []}
            onChange={val => { setSections((s: any) => ({ ...s, space_groups: val })); markDirty() }}
            uploadImage={uploadImage}
          />
        )
      }
      return (
        <SpaceGroupEditor
          groups={(sections as any).space_groups ?? []}
          onChange={val => { setSections((s: any) => ({ ...s, space_groups: val })); markDirty() }}
          uploadImage={uploadImage}
        />
      )
    }

    if (secId === 'venue_rental') return (
      <div style={{ padding: '10px 12px', background: 'var(--cream)', borderRadius: 7, fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.5, display: 'flex', gap: 8 }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 1, color: 'var(--gold)' }} />
        Las tarifas se configuran en <strong>Estructura → Modalidades</strong> y se asignan por propuesta según la fecha.
      </div>
    )

    if (secId === 'inclusions') return (
      <div>
        {getOverride(overrideKey).map((x: any, i: number) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 7, marginBottom: 7, padding: '8px 10px', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                <select className="form-input" style={{ width: 160, fontSize: 11, flexShrink: 0 }} value={x.icon ?? ''} onChange={e => updateItem(overrideKey, i, 'icon', e.target.value)}>
                  <option value="">— icono —</option>
                  {INCLUSION_ICON_CHOICES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <input className="form-input" placeholder="Título *" style={{ fontSize: 12 }} value={x.title ?? ''} onChange={e => updateItem(overrideKey, i, 'title', e.target.value)} />
              </div>
              <input className="form-input" placeholder="Descripción (opcional)" style={{ fontSize: 12 }} value={x.description ?? ''} onChange={e => updateItem(overrideKey, i, 'description', e.target.value)} />
            </div>
            <button type="button" style={removeBtn} onClick={() => removeItem(overrideKey, i)}><X size={12} /></button>
          </div>
        ))}
        <button type="button" style={addBtn} onClick={() => addItem(overrideKey, { title: '', icon: 'check', description: '' })}>+ Añadir elemento</button>
      </div>
    )

    if (secId === 'testimonials') return (
      <div>
        {getOverride(overrideKey).map((t: any, i: number) => (
          <details key={i} style={{ border: '1px solid var(--border)', borderRadius: 7, marginBottom: 7, overflow: 'hidden' }}>
            <summary style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--charcoal)', fontWeight: 500, background: 'var(--cream)', listStyle: 'none' }}>
              <ChevronDown size={11} color="var(--warm-gray)" />
              <span style={{ flex: 1 }}>{t.couple_name || <em style={{ color: 'var(--warm-gray)' }}>Nuevo testimonio</em>}</span>
              <button type="button" style={removeBtn} onClick={e => { e.preventDefault(); e.stopPropagation(); removeItem(overrideKey, i) }}><X size={12} /></button>
            </summary>
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                <input className="form-input" placeholder="Nombres pareja *" style={{ fontSize: 12 }} value={t.couple_name ?? ''} onChange={e => updateItem(overrideKey, i, 'couple_name', e.target.value)} />
                <input className="form-input" type="date" style={{ width: 145, flexShrink: 0, fontSize: 12 }} value={t.wedding_date ?? ''} onChange={e => updateItem(overrideKey, i, 'wedding_date', e.target.value)} />
              </div>
              <textarea className="form-textarea" style={{ minHeight: 70, fontSize: 12 }} placeholder="Testimonio…" value={t.text ?? ''} onChange={e => updateItem(overrideKey, i, 'text', e.target.value)} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--warm-gray)' }}>
                Estrellas:
                <input className="form-input" type="number" min={1} max={5} style={{ width: 65, fontSize: 12 }} value={t.rating ?? 5} onChange={e => updateItem(overrideKey, i, 'rating', Number(e.target.value) || 5)} />
              </div>
            </div>
          </details>
        ))}
        <button type="button" style={addBtn} onClick={() => addItem(overrideKey, { couple_name: '', text: '', wedding_date: '', rating: 5 })}>+ Añadir testimonio</button>
      </div>
    )

    if (secId === 'collaborators') return (
      <div>
        {getOverride(overrideKey).map((c: any, i: number) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 7, marginBottom: 7, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <input className="form-input" placeholder="Nombre *" style={{ fontSize: 12 }} value={c.name ?? ''} onChange={e => updateItem(overrideKey, i, 'name', e.target.value)} />
              <input className="form-input" style={{ width: 130, flexShrink: 0, fontSize: 12 }} placeholder="Categoría" value={c.category ?? ''} onChange={e => updateItem(overrideKey, i, 'category', e.target.value)} />
              <button type="button" style={removeBtn} onClick={() => removeItem(overrideKey, i)}><X size={12} /></button>
            </div>
            <input className="form-input" placeholder="Descripción" style={{ fontSize: 12 }} value={c.description ?? ''} onChange={e => updateItem(overrideKey, i, 'description', e.target.value)} />
          </div>
        ))}
        <button type="button" style={addBtn} onClick={() => addItem(overrideKey, { name: '', category: '', description: '' })}>+ Añadir colaborador</button>
      </div>
    )

    if (secId === 'accommodation') {
      const acc: any = (sections as any).accommodation_override ?? {}
      const p = (patch: any) => { setSections(s => ({ ...s, accommodation_override: { ...((s as any).accommodation_override ?? {}), ...patch } } as any)); markDirty() }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input className="form-input" placeholder="Habitaciones disponibles" style={{ fontSize: 12 }} value={acc.rooms ?? ''} onChange={e => p({ rooms: e.target.value })} />
          <textarea className="form-textarea" style={{ minHeight: 70, fontSize: 12 }} placeholder="Descripción del alojamiento…" value={acc.description ?? ''} onChange={e => p({ description: e.target.value })} />
          <input className="form-input" placeholder="Información de precios (opcional)" style={{ fontSize: 12 }} value={acc.price_info ?? ''} onChange={e => p({ price_info: e.target.value })} />
          <input className="form-input" placeholder="Alojamientos cercanos (opcional)" style={{ fontSize: 12 }} value={acc.nearby ?? ''} onChange={e => p({ nearby: e.target.value })} />
        </div>
      )
    }

    if (secId === 'extra_services') return (
      <div>
        {getOverride(overrideKey).map((s: any, i: number) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 7, marginBottom: 7, padding: '8px 10px', display: 'flex', gap: 5, alignItems: 'center' }}>
            <input className="form-input" placeholder="Nombre *" style={{ fontSize: 12 }} value={s.name ?? ''} onChange={e => updateItem(overrideKey, i, 'name', e.target.value)} />
            <input className="form-input" style={{ width: 90, flexShrink: 0, fontSize: 12 }} placeholder="Precio" value={s.price ?? ''} onChange={e => updateItem(overrideKey, i, 'price', e.target.value)} />
            <button type="button" style={removeBtn} onClick={() => removeItem(overrideKey, i)}><X size={12} /></button>
          </div>
        ))}
        <button type="button" style={addBtn} onClick={() => addItem(overrideKey, { name: '', price: '', description: '' })}>+ Añadir servicio</button>
      </div>
    )

    if (secId === 'faq') return (
      <div>
        {getOverride(overrideKey).map((f: any, i: number) => (
          <details key={i} style={{ border: '1px solid var(--border)', borderRadius: 7, marginBottom: 7, overflow: 'hidden' }}>
            <summary style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--charcoal)', fontWeight: 500, background: 'var(--cream)', listStyle: 'none' }}>
              <ChevronDown size={11} color="var(--warm-gray)" />
              <span style={{ flex: 1 }}>{f.question || <em style={{ color: 'var(--warm-gray)' }}>Nueva pregunta</em>}</span>
              <button type="button" style={removeBtn} onClick={e => { e.preventDefault(); e.stopPropagation(); removeItem(overrideKey, i) }}><X size={12} /></button>
            </summary>
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input className="form-input" placeholder="Pregunta *" style={{ fontSize: 12 }} value={f.question ?? ''} onChange={e => updateItem(overrideKey, i, 'question', e.target.value)} />
              <textarea className="form-textarea" style={{ minHeight: 65, fontSize: 12 }} placeholder="Respuesta *" value={f.answer ?? ''} onChange={e => updateItem(overrideKey, i, 'answer', e.target.value)} />
            </div>
          </details>
        ))}
        <button type="button" style={addBtn} onClick={() => addItem(overrideKey, { question: '', answer: '' })}>+ Añadir pregunta</button>
      </div>
    )

    if (secId === 'map') {
      const m: any = (sections as any).map_override ?? {}
      const p = (patch: any) => { setSections(s => ({ ...s, map_override: { ...((s as any).map_override ?? {}), ...patch } } as any)); markDirty() }
      const extractSrc = (raw: string) => { const match = raw.match(/src\s*=\s*["']([^"']+)["']/i); return match ? match[1] : raw }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>URL o código iframe de Google Maps</div>
          <textarea className="form-textarea" style={{ minHeight: 56, fontSize: 11, fontFamily: 'monospace' }} placeholder="Pega la URL o el <iframe> de Google Maps…" value={m.embed_url ?? ''} onChange={e => p({ embed_url: extractSrc(e.target.value) })} />
          <input className="form-input" placeholder="Dirección" style={{ fontSize: 12 }} value={m.address ?? ''} onChange={e => p({ address: e.target.value })} />
          <input className="form-input" placeholder="Notas de ubicación (opcional)" style={{ fontSize: 12 }} value={m.notes ?? ''} onChange={e => p({ notes: e.target.value })} />
        </div>
      )
    }

    if (secId === 'contact') {
      const c: any = (sections as any).contact ?? {}
      const p = (patch: any) => { setSections(s => ({ ...s, contact: { ...((s as any).contact ?? {}), ...patch } } as any)); markDirty() }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input className="form-input" placeholder="Teléfono / WhatsApp" style={{ fontSize: 12 }} value={c.phone ?? ''} onChange={e => p({ phone: e.target.value })} />
          <input className="form-input" type="email" placeholder="Email de contacto" style={{ fontSize: 12 }} value={c.email ?? ''} onChange={e => p({ email: e.target.value })} />
        </div>
      )
    }

    if (secId === 'sticky_nav') return (
      <div style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.6, background: 'var(--cream)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
        Añade enlaces de navegación a la barra superior. Aparecen al hacer scroll y llevan a las secciones activas (Galería, Espacios, Menús, Contactar…). Se generan automáticamente.
      </div>
    )

    if (secId === 'welcome_light') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
          Muestra el mensaje de bienvenida sobre fondo claro crema. Puedes añadir una imagen de fondo opcional.
        </div>
        <input className="form-input" placeholder="URL imagen de fondo (opcional)" style={{ fontSize: 12 }}
          value={(sections as any).welcome_light?.image_url ?? ''}
          onChange={e => { setSections(s => ({ ...s, welcome_light: { ...((s as any).welcome_light ?? {}), image_url: e.target.value } } as any)); markDirty() }} />
      </div>
    )

    if (secId === 'welcome_split') {
      const ws: any = (sections as any).welcome_split ?? {}
      const p = (patch: any) => { setSections(s => ({ ...s, welcome_split: { ...((s as any).welcome_split ?? {}), ...patch } } as any)); markDirty() }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
            Dos columnas: imagen a un lado, mensaje de bienvenida al otro.
          </div>
          <input className="form-input" placeholder="URL de la imagen" style={{ fontSize: 12 }} value={ws.image_url ?? ''} onChange={e => p({ image_url: e.target.value })} />
          <div style={{ display: 'flex', gap: 6 }}>
            {(['left', 'right'] as const).map(side => (
              <button key={side} type="button"
                style={{ flex: 1, padding: '6px 0', fontSize: 11, borderRadius: 6, border: '1px solid var(--border)', background: (ws.image_side ?? 'left') === side ? 'var(--gold)' : 'var(--surface)', color: (ws.image_side ?? 'left') === side ? '#fff' : 'var(--charcoal)', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => p({ image_side: side })}>
                {side === 'left' ? 'Imagen izquierda' : 'Imagen derecha'}
              </button>
            ))}
          </div>
        </div>
      )
    }

    if (secId === 'welcome_editorial') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
          Tipografía editorial grande, estilo revista de lujo. Muestra el mensaje de bienvenida en grande.
        </div>
        <input className="form-input" placeholder="Eyebrow (ej. Un mensaje para vosotros)" style={{ fontSize: 12 }}
          value={(sections as any).welcome_editorial?.eyebrow ?? ''}
          onChange={e => { setSections(s => ({ ...s, welcome_editorial: { ...((s as any).welcome_editorial ?? {}), eyebrow: e.target.value } } as any)); markDirty() }} />
      </div>
    )

    if (secId === 'schedule_visit') {
      const sv: any = (sections as any).schedule_visit ?? {}
      const p = (patch: any) => { setSections(s => ({ ...s, schedule_visit: { ...((s as any).schedule_visit ?? {}), ...patch } } as any)); markDirty() }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input className="form-input" placeholder="Título (ej. Visitadnos en persona)" style={{ fontSize: 12 }} value={sv.title ?? ''} onChange={e => p({ title: e.target.value })} />
          <textarea className="form-textarea" style={{ minHeight: 60, fontSize: 12 }} placeholder="Subtítulo / descripción breve…" value={sv.subtitle ?? ''} onChange={e => p({ subtitle: e.target.value })} />
          <input className="form-input" placeholder="URL Calendly / Cal.com (opcional)" style={{ fontSize: 12 }} value={sv.url ?? ''} onChange={e => p({ url: e.target.value })} />
          <input className="form-input" placeholder="Texto del botón (ej. Reservar visita →)" style={{ fontSize: 12 }} value={sv.cta_label ?? ''} onChange={e => p({ cta_label: e.target.value })} />
          <input className="form-input" placeholder="Nota pequeña (horarios, duración…)" style={{ fontSize: 12 }} value={sv.note ?? ''} onChange={e => p({ note: e.target.value })} />
        </div>
      )
    }

    return null
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--cream)' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div style={{ height: 52, flexShrink: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 0 }}>
        {onBack && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ gap: 5, color: 'var(--warm-gray)' }}>
              <ChevronLeft size={15} /> Plantillas
            </button>
            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 12px' }} />
          </>
        )}
        <input
          value={name}
          onChange={e => { setName(e.target.value); markDirty() }}
          placeholder="Nombre de la plantilla"
          style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', width: 220 }}
        />
        <span style={{ fontSize: 12, color: saved ? '#16a34a' : 'var(--warm-gray)', marginLeft: 4, display: 'flex', alignItems: 'center', gap: 4, transition: 'color .3s' }}>
          · {saved ? 'Guardado' : dirty ? 'Sin guardar' : 'Sin cambios'}
          {saved && <Check size={11} strokeWidth={2.5} />}
        </span>
        <div style={{ flex: 1 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--warm-gray)', cursor: 'pointer', userSelect: 'none', marginRight: 16 }}>
          <input type="checkbox" checked={isDefault} onChange={e => { setIsDefault(e.target.checked); markDirty() }}
            style={{ accentColor: 'var(--gold)', width: 13, height: 13 }} />
          Por defecto
        </label>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || (!dirty && !saveError)} style={{ minWidth: 140 }}>
          {saving ? <><Loader2 size={13} className="animate-spin" /> Guardando…</> : saved ? <><Check size={13} /> Guardado</> : 'Guardar cambios'}
        </button>
      </div>

      {saveError && (
        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '6px 20px', fontSize: 12, color: '#dc2626' }}>{saveError}</div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{ width: sidebarWidth, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width .2s ease' }}>

          {/* Tabs + expand toggle */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--ivory)', flexShrink: 0, alignItems: 'center' }}>
            {([
              { id: 'sections', label: 'Secciones', icon: <LayoutTemplate size={12} /> },
              { id: 'visual',   label: 'Visual',     icon: <Palette size={12} /> },
              { id: 'menus',    label: 'Menús',      icon: <ChefHat size={12} /> },
            ] as const).map(tab => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '11px 8px', background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: activeTab === tab.id ? '2px solid var(--gold)' : '2px solid transparent',
                  marginBottom: -2,
                  color: activeTab === tab.id ? 'var(--espresso)' : 'var(--warm-gray)',
                  fontWeight: activeTab === tab.id ? 600 : 400, fontSize: 12, transition: 'color .15s',
                }}>
                {tab.icon}{tab.label}
              </button>
            ))}
            {/* Expand/collapse sidebar */}
            <button
              type="button"
              title={sidebarExpanded ? 'Reducir panel' : 'Ampliar panel'}
              onClick={() => setSidebarExpanded(v => !v)}
              style={{ padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', flexShrink: 0, borderBottom: '2px solid transparent', marginBottom: -2 }}
            >
              {sidebarExpanded ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            </button>
          </div>

          {/* Sidebar content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>

            {/* ── SECCIONES tab ─────────────────────────────────────────────── */}
            {activeTab === 'sections' && (
              <div style={{ padding: '16px 16px 32px' }}>

                {/* Description */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--warm-gray)', marginBottom: 6 }}>Descripción</div>
                  <textarea className="form-input" value={description} onChange={e => { setDescription(e.target.value); markDirty() }}
                    placeholder="Descripción breve (opcional)" rows={2} style={{ fontSize: 12, resize: 'none', color: 'var(--warm-gray)' }} />
                </div>

                {/* Catering toggle */}
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--warm-gray)', marginBottom: 8 }}>Tipo</div>
                <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>Incluye menús y catering</div>
                      <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>Habilita la pestaña Menús</div>
                    </div>
                    <Toggle value={hasCatering} onChange={v => { setSections(s => ({ ...s, has_catering: v })); markDirty() }} />
                  </div>
                </div>

                {/* Section list — each row has toggle + label + expand */}
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--warm-gray)', marginBottom: 8 }}>Secciones de la propuesta</div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  {(() => {
                    const SPACE_GROUP_IDS = ['single_space', 'zones', 'space_groups', 'venue_rental']
                    const isSpaceGroupOpen = openSecs.has('__space_group')
                    const activeSpaceIds = SPACE_GROUP_IDS.filter(id => isSectionOn(id))
                    const activeSpaceLabel = activeSpaceIds.length === 0
                      ? 'Ninguna activa'
                      : activeSpaceIds.map(id => getSectionLabel(id, commercialConfig?.space_type as any, SECTION_LABELS[id as SectionId])).join(' · ')
                    const renderSpaceGroupHeader = () => (
                      <div key="__sg_header" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(196,151,90,0.06)' }}>
                        <div
                          onClick={() => setOpenSecs(s => { const n = new Set(s); n.has('__space_group') ? n.delete('__space_group') : n.add('__space_group'); return n })}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
                        >
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--charcoal)' }}>Espacios y precios</span>
                              <span style={{ fontSize: 10, color: activeSpaceIds.length > 0 ? 'var(--gold)' : 'var(--warm-gray)', background: '#fff', padding: '1px 7px', borderRadius: 10, border: '1px solid var(--border)', fontWeight: 600 }}>{activeSpaceIds.length}/{SPACE_GROUP_IDS.length}</span>
                            </div>
                            <div style={{ fontSize: 11, color: activeSpaceIds.length === 0 ? 'var(--warm-gray)' : '#999', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeSpaceLabel}</div>
                          </div>
                          <ChevronDown size={13} style={{ color: 'var(--warm-gray)', transform: isSpaceGroupOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0, marginTop: 2 }} />
                        </div>
                      </div>
                    )

                    return ALL_SECTION_IDS.map((secId, i) => {
                    if (['welcome_light', 'welcome_split', 'welcome_editorial'].includes(secId)) return null

                    const isInSpaceGroup = SPACE_GROUP_IDS.includes(secId)
                    const isFirstSpaceVisible = isInSpaceGroup && SPACE_GROUP_IDS[0] === secId
                    if (isInSpaceGroup && !isSpaceGroupOpen) {
                      return isFirstSpaceVisible ? renderSpaceGroupHeader() : null
                    }

                    if (secId === 'welcome') {
                      const isWelcomeOpen = openSecs.has('welcome')
                      const activeVariantLabel = welcomeGroupOn ? WELCOME_VARIANT_LABELS[activeWelcome] : 'Desactivada'
                      return (
                        <div key="welcome-group" style={{ borderBottom: '1px solid var(--border)', opacity: welcomeGroupOn ? 1 : 0.5, transition: 'opacity .15s', background: 'rgba(196,151,90,0.06)' }}>
                          <div
                            onClick={() => setOpenSecs(s => { const n = new Set(s); n.has('welcome') ? n.delete('welcome') : n.add('welcome'); return n })}
                            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
                          >
                            <div onClick={e => { e.stopPropagation(); toggleWelcomeGroup(!welcomeGroupOn) }} style={{ marginTop: 2 }}>
                              <Toggle value={welcomeGroupOn} onChange={v => toggleWelcomeGroup(v)} />
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--charcoal)' }}>Bienvenida</span>
                                <span style={{ fontSize: 10, color: welcomeGroupOn ? 'var(--gold)' : 'var(--warm-gray)', background: '#fff', padding: '1px 7px', borderRadius: 10, border: '1px solid var(--border)', fontWeight: 600 }}>{welcomeGroupOn ? '1' : '0'}/{WELCOME_VARIANTS.length}</span>
                              </div>
                              <div style={{ fontSize: 11, color: welcomeGroupOn ? '#999' : 'var(--warm-gray)', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeVariantLabel}</div>
                            </div>
                            <ChevronDown size={13} style={{ color: 'var(--warm-gray)', transform: isWelcomeOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0, marginTop: 2 }} />
                          </div>
                          {isWelcomeOpen && (
                            <div style={{ padding: '12px 14px 14px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, padding: '8px 10px', background: 'var(--cream)', borderRadius: 8, border: '1px solid var(--border)' }}>
                                {WELCOME_VARIANTS.map(v => (
                                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '3px 0' }}>
                                    <input type="radio" name="welcome-variant-tpl" checked={activeWelcome === v} onChange={() => selectWelcomeVariant(v)} style={{ accentColor: 'var(--gold)' }} />
                                    <span style={{ fontSize: 12, color: 'var(--charcoal)' }}>{WELCOME_VARIANT_LABELS[v]}</span>
                                  </label>
                                ))}
                              </div>
                              {renderSectionContent(activeWelcome as SectionId)}
                            </div>
                          )}
                        </div>
                      )
                    }

                    const isOn   = isSectionOn(secId)
                    const isOpen = openSecs.has(secId)
                    const isLast = i === ALL_SECTION_IDS.length - 1
                    return (
                      <Fragment key={secId}>
                      {isInSpaceGroup && isFirstSpaceVisible && renderSpaceGroupHeader()}
                      <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)', opacity: isOn ? 1 : 0.5, transition: 'opacity .15s', ...(isInSpaceGroup ? { paddingLeft: 14, borderLeft: '2px solid rgba(196,151,90,0.25)', background: 'rgba(196,151,90,0.02)' } : {}) }}>
                        {/* Row header */}
                        <div
                          onClick={() => setOpenSecs(s => { const n = new Set(s); n.has(secId) ? n.delete(secId) : n.add(secId); return n })}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: isOpen ? 'var(--cream)' : 'var(--surface)', transition: 'background .15s' }}
                        >
                          <div onClick={e => { e.stopPropagation(); toggleSection(secId, !isOn) }}>
                            <Toggle value={isOn} onChange={v => toggleSection(secId, v)} />
                          </div>
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', userSelect: 'none' }}>{getSectionLabel(secId, commercialConfig?.space_type as any, SECTION_LABELS[secId])}</span>
                          <ChevronDown size={13} style={{ color: 'var(--warm-gray)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
                        </div>
                        {/* Expandable content editor */}
                        {isOpen && (
                          <div style={{ padding: '12px 14px 14px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                            {SECTION_SPACE_TYPES[secId] && (() => {
                              const spaceType = commercialConfig?.space_type as any
                              const allowedTypes = SECTION_SPACE_TYPES[secId]
                              const matches = spaceType && allowedTypes.includes(spaceType)
                              if (matches) {
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 11, color: '#166534', lineHeight: 1.4 }}>
                                    <Check size={13} style={{ flexShrink: 0 }} />
                                    <span>Recomendada para tu configuración: <strong>{SPACE_TYPE_LABELS[spaceType]}</strong></span>
                                  </div>
                                )
                              }
                              const targetLabels = allowedTypes.map(t => SPACE_TYPE_LABELS[t]).join(' · ')
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 12, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.4 }}>
                                  <Info size={13} style={{ flexShrink: 0, color: 'var(--warm-gray)' }} />
                                  <span style={{ flex: 1 }}>Aplica si tu configuración es: <strong>{targetLabels}</strong></span>
                                  <a href="/estructura" style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Cambiar →</a>
                                </div>
                              )
                            })()}
                            {renderSectionContent(secId)}
                          </div>
                        )}
                      </div>
                      </Fragment>
                    )
                    })
                  })()}
                </div>
              </div>
            )}

            {/* ── VISUAL tab ────────────────────────────────────────────────── */}
            {activeTab === 'visual' && (
              <div style={{ padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* Load fonts for preview */}
                <link rel="stylesheet" href={ALL_FONTS_URL} />

                {/* Design style */}
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--warm-gray)', marginBottom: 8 }}>Estilo de diseño</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 20 }}>
                  {([
                    { id: 1, icon: '⚡', name: 'Impacto Directo', desc: 'Dark luxury' },
                    { id: 2, icon: '✨', name: 'Emoción Primero', desc: 'Cream editorial' },
                    { id: 3, icon: '📋', name: 'Todo Claro',      desc: 'Estructurado' },
                    { id: 4, icon: '💬', name: 'Social Proof',    desc: 'Stats + confianza' },
                    { id: 5, icon: '◻',  name: 'Minimalista',     desc: 'CTA prominente' },
                  ] as const).map(tpl => {
                    const active = (sections.visual_template_id ?? 1) === tpl.id
                    return (
                      <button key={tpl.id} type="button"
                        onClick={() => { setSections(s => ({ ...s, visual_template_id: tpl.id })); markDirty() }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                          borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                          border: `1.5px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                          background: active ? 'rgba(196,151,90,.08)' : 'var(--surface)',
                        }}>
                        <span style={{ fontSize: 14 }}>{tpl.icon}</span>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: active ? 'var(--gold)' : 'var(--text)' }}>{tpl.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{tpl.desc}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Logo */}
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--warm-gray)', marginBottom: 8 }}>Logo del venue</div>
                <div style={{ marginBottom: 20 }}>
                  <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
                  {sections.logo_url ? (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <img src={sections.logo_url} alt="logo" style={{ maxHeight: 56, maxWidth: '100%', borderRadius: 6, border: '1px solid var(--border)', display: 'block', background: '#fff', padding: 6 }} />
                        <button onClick={() => { setSections(s => ({ ...s, logo_url: null })); markDirty() }}
                          style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <X size={9} color="#fff" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <button className="btn btn-ghost btn-sm" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} style={{ width: '100%', justifyContent: 'center' }}>
                    <Upload size={12} /> {uploadingLogo ? 'Subiendo…' : sections.logo_url ? 'Cambiar logo' : 'Subir logo'}
                  </button>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 6, lineHeight: 1.5 }}>
                    PNG transparente recomendado. Se mostrará en la cabecera de la propuesta.
                  </div>
                </div>

                {/* Primary color */}
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--warm-gray)', marginBottom: 8 }}>Color principal</div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                    {['#2d4a7a','#7a5c3c','#6b2d42','#2a6b4a','#4a4a4a','#8b6914','#C4975A','#8B4513','#1a3a5c','#5c2d6b'].map(c => (
                      <div key={c} onClick={() => { setSections(s => ({ ...s, primary_color: c })); markDirty() }}
                        style={{
                          width: 24, height: 24, borderRadius: 5, background: c, cursor: 'pointer', flexShrink: 0,
                          border: (sections.primary_color ?? '#C4975A') === c ? '2px solid var(--espresso)' : '2px solid transparent',
                          transform: (sections.primary_color ?? '#C4975A') === c ? 'scale(1.2)' : 'scale(1)', transition: 'transform .1s',
                        }} />
                    ))}
                    <input type="color" value={sections.primary_color ?? '#C4975A'}
                      onChange={e => { setSections(s => ({ ...s, primary_color: e.target.value })); markDirty() }}
                      style={{ width: 24, height: 24, padding: 2, borderRadius: 5, border: '1px solid var(--border)', cursor: 'pointer', background: 'none' }} />
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: sections.primary_color ?? '#C4975A', opacity: 0.8 }} />
                </div>

                {/* Secondary color */}
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--warm-gray)', marginBottom: 8 }}>Color secundario</div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                    {['#8B6914','#7a5c3c','#6b2d42','#2a6b4a','#4a4a4a','#1a3a5c','#5c2d6b','#A0826D','#3D5A80','#293241'].map(c => (
                      <div key={c} onClick={() => { setSections(s => ({ ...s, secondary_color: c })); markDirty() }}
                        style={{
                          width: 24, height: 24, borderRadius: 5, background: c, cursor: 'pointer', flexShrink: 0,
                          border: sections.secondary_color === c ? '2px solid var(--espresso)' : '1px solid var(--border)',
                          transform: sections.secondary_color === c ? 'scale(1.2)' : 'scale(1)', transition: 'transform .1s',
                        }} />
                    ))}
                    <input type="color" value={sections.secondary_color ?? '#8B6914'}
                      onChange={e => { setSections(s => ({ ...s, secondary_color: e.target.value })); markDirty() }}
                      style={{ width: 24, height: 24, padding: 2, borderRadius: 5, border: '1px solid var(--border)', cursor: 'pointer', background: 'none' }} />
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: sections.secondary_color ?? '#8B6914', opacity: 0.8 }} />
                  <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 6, lineHeight: 1.45 }}>
                    Disponible como variable <code style={{ background: 'var(--cream)', padding: '0 4px', borderRadius: 3 }}>--tpl-secondary</code> para usos personalizados.
                  </div>
                </div>

                {/* Color mode (light / dark variant of the chosen design) */}
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--warm-gray)', marginBottom: 8 }}>Modo</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 20 }}>
                  {([
                    { id: 'light', label: 'Claro',   bg: '#FAF7F2', fg: '#1A1A1A', sub: 'Fondo crema · texto oscuro' },
                    { id: 'dark',  label: 'Oscuro',  bg: '#0A0A0A', fg: '#F5F5F5', sub: 'Fondo negro · texto claro' },
                  ] as const).map(opt => {
                    const active = (sections.color_mode ?? 'light') === opt.id
                    return (
                      <button key={opt.id} type="button"
                        onClick={() => { setSections(s => ({ ...s, color_mode: opt.id })); markDirty() }}
                        style={{
                          display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px',
                          borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                          border: `1.5px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                          background: active ? 'rgba(196,151,90,.08)' : 'var(--surface)',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 16, height: 16, borderRadius: 4, background: opt.bg, border: '1px solid var(--border)', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--gold)' : 'var(--text)' }}>{opt.label}</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{opt.sub}</div>
                      </button>
                    )
                  })}
                </div>

                {/* Typography */}
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--warm-gray)', marginBottom: 8 }}>Tipografía</div>
                <div style={{ padding: '8px 12px', background: 'var(--cream)', borderRadius: 8, marginBottom: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: sections.font_family ?? 'Georgia, serif', fontSize: 15, color: 'var(--text)' }}>
                    Aa — {getFontByValue(sections.font_family ?? 'Georgia, serif')?.label ?? 'Georgia'}
                  </span>
                </div>
                <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {FONT_CATEGORIES.map(cat => (
                    <div key={cat.key}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{cat.label}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {GOOGLE_FONTS.filter(f => f.category === cat.key).map(opt => {
                          const isActive = (sections.font_family ?? 'Georgia, serif') === opt.value
                          return (
                            <button key={opt.value} type="button"
                              onClick={() => { setSections(s => ({ ...s, font_family: opt.value })); markDirty() }}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '7px 10px', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                                border: `1.5px solid ${isActive ? 'var(--gold)' : 'var(--border)'}`,
                                background: isActive ? 'rgba(196,151,90,0.08)' : 'var(--surface)',
                              }}>
                              <span style={{ fontFamily: opt.value, fontSize: 13, color: 'var(--text)' }}>{opt.label}</span>
                              <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{opt.desc}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}

            {/* ── MENÚS tab ─────────────────────────────────────────────────── */}
            {activeTab === 'menus' && (
              <div style={{ padding: hasCatering ? 0 : '20px 16px' }}>
                {!hasCatering ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--warm-gray)' }}>
                    <ChefHat size={28} style={{ opacity: 0.3, marginBottom: 10 }} />
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Catering desactivado</div>
                    <div style={{ fontSize: 11, lineHeight: 1.5 }}>Activa "Incluye menús y catering" en la pestaña Secciones.</div>
                  </div>
                ) : (
                  <ProposalMenuEditor
                    sections={sections}
                    setSections={s => { setSections(s); markDirty() }}
                    intro="Configura los menús y extras que se precargarán al usar esta plantilla."
                  />
                )}
              </div>
            )}

          </div>
        </div>

        {/* ── Preview panel ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#e8e4dc' }}>

          {/* Preview toolbar */}
          <div style={{ flexShrink: 0, height: 46, borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
            <div style={{ display: 'flex', gap: 2, background: 'var(--ivory)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
              {(['desktop', 'mobile'] as const).map(d => {
                const Icon   = d === 'desktop' ? Monitor : Smartphone
                const active = device === d
                return (
                  <button key={d} type="button" onClick={() => setDevice(d)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer', background: active ? 'var(--gold)' : 'transparent', color: active ? '#fff' : 'var(--warm-gray)', transition: 'background .15s, color .15s' }}>
                    <Icon size={13} />{d === 'desktop' ? 'Desktop' : 'Móvil'}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => { setIframeReady(false); if (iframeRef.current) iframeRef.current.src = iframeUrl }}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--warm-gray)', display: 'inline-flex', alignItems: 'center' }}
                title="Recargar">
                <RefreshCcw size={13} />
              </button>
              <button type="button" onClick={() => window.open(iframeUrl, '_blank')}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--warm-gray)', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11 }}
                title="Abrir en nueva pestaña">
                <ExternalLink size={13} /> Abrir
              </button>
            </div>
          </div>

          {/* Iframe */}
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: device === 'mobile' ? '24px 16px' : 0, position: 'relative' }}>
            {!iframeReady && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--warm-gray)', fontSize: 13, pointerEvents: 'none' }}>
                <Loader2 size={15} className="animate-spin" /> Cargando vista previa…
              </div>
            )}
            <iframe
              key={device}
              ref={iframeRef}
              src={iframeUrl}
              style={{
                width:  device === 'mobile' ? 390 : '100%',
                height: device === 'mobile' ? 844 : '100%',
                border: device === 'mobile' ? '1px solid var(--border)' : 'none',
                borderRadius: device === 'mobile' ? 12 : 0,
                boxShadow: device === 'mobile' ? '0 8px 40px rgba(0,0,0,.15)' : 'none',
                flexShrink: 0,
                opacity: iframeReady ? 1 : 0,
                transition: 'opacity .3s',
              }}
            />
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Zone photo upload helper ─────────────────────────────────────────────────

function ZonePhotoUpload({ zone, onUpload, onRemove }: { zone: any; onUpload: (f: File) => Promise<void>; onRemove: () => void }) {
  const [uploading, setUploading] = useState(false)
  const photo = zone.photos?.[0]
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {photo ? (
        <>
          <img src={photo} alt="" style={{ width: 72, height: 50, objectFit: 'cover', borderRadius: 5, border: '1px solid var(--border)' }} />
          <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={onRemove}>Quitar</button>
          <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', fontSize: 11 }}>
            Cambiar<input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => { if (e.target.files?.[0]) { setUploading(true); await onUpload(e.target.files[0]); setUploading(false) } }} />
          </label>
        </>
      ) : (
        <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', fontSize: 11 }}>
          {uploading ? <><Loader2 size={11} className="animate-spin" /> Subiendo…</> : <><Upload size={11} /> Foto zona</>}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => { if (e.target.files?.[0]) { setUploading(true); await onUpload(e.target.files[0]); setUploading(false) } }} />
        </label>
      )}
    </div>
  )
}

// ─── Toggle helper ────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={value}
      onClick={e => { e.stopPropagation(); onChange(!value) }}
      style={{ width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', flexShrink: 0, background: value ? 'var(--gold)' : '#d1c9b8', position: 'relative', transition: 'background .2s' }}>
      <span style={{ position: 'absolute', top: 2, left: value ? 14 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
    </button>
  )
}

'use client'

import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import {
  ChevronLeft, ChevronDown, Check, Loader2, ChefHat, LayoutTemplate,
  X, Monitor, Smartphone, RefreshCcw, ExternalLink,
  PanelLeftOpen, PanelLeftClose, Info, Palette, Image as ImageIcon,
} from 'lucide-react'
import type { SectionsData, VenueSpaceGroup } from '@/lib/proposal-types'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { GOOGLE_FONTS, FONT_CATEGORIES, ALL_FONTS_URL, getFontByValue } from '@/lib/fonts'
import ProposalMenuEditor from './ProposalMenuEditor'
import SpaceGroupEditor from './SpaceGroupEditor'
import MultipleZonesEditor from './MultipleZonesEditor'
import { ImageUploader } from './ImageUploader'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Checkbox } from '@/components/ui/checkbox'
import {
  SECTION_STYLES,
  getActiveStyle,
  setActiveStyle,
  isSectionGroupEnabled,
  toggleSectionGroup,
} from '@/lib/section-styles'
import { INCLUSION_ICON_CHOICES } from '@/app/proposal/[slug]/tpl/shared'
import { getSectionLabel, isSectionAllowed, SECTION_SPACE_TYPES, SPACE_TYPE_LABELS } from '@/lib/section-visibility'
import { DEFAULT_TEMPLATES } from '@/lib/proposal-starter-templates'

// ─── Section catalogue ────────────────────────────────────────────────────────

export const ALL_SECTION_IDS = [
  'hero', 'availability', 'venue_specs', 'sticky_nav',
  'welcome', 'welcome_light', 'welcome_split', 'welcome_editorial',
  'experience', 'gallery',
  'single_space', 'zones', 'space_groups', 'venue_rental', 'inclusions', 'testimonials',
  'collaborators', 'accommodation', 'extra_services',
  'pricing',
  'faq', 'schedule_visit', 'map', 'floating_contact',
] as const

type SectionId = typeof ALL_SECTION_IDS[number]

const SECTION_LABELS: Record<SectionId, string> = {
  hero:              'Foto principal',
  availability:      'Disponibilidad',
  venue_specs:       'Datos del venue (año, capacidad, extensión…)',
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
  pricing:           'Paquetes y precios',
  faq:               'Preguntas frecuentes',
  schedule_visit:    'Agendar visita / Hablemos',
  map:               'Mapa y ubicación',
  floating_contact:  'Botón flotante de contacto',
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
  const { user, activeVenue } = useAuth()

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


  const [wizardStep, setWizardStep] = useState<'style' | 'catering' | 'modality' | null>(() => {
    if (template.id !== 'new') return null
    const sd = template.sections_data as any
    // Modal picker already collected all choices → skip wizard entirely
    if (sd?.__wizard_done) return null
    // Came from sample style card (old direct link) → style chosen, start at catering
    if (sd?.visual_template_id) return 'catering'
    return 'style'
  })

  // Modalities — for wizard step + existing template editor
  const [modalities, setModalities] = useState<any[]>([])
  useEffect(() => {
    if (modalities.length > 0) return
    fetch('/api/estructura/modalities').then(r => r.ok ? r.json() : null).then(d => { if (d?.modalities) setModalities(d.modalities) })
  }, [modalities.length])

  // Open/close section content cards
  const [openSecs, setOpenSecs] = useState<Set<string>>(new Set())

  // Venue commercial config + zones — drives which sections appear and their labels,
  // plus the multiple_independent zone picker
  const [commercialConfig, setCommercialConfig] = useState<{ space_type: string; price_model: string } | null>(null)
  const [venueSpaceGroups, setVenueSpaceGroups] = useState<VenueSpaceGroup[]>([])
  useEffect(() => {
    if (!user || !activeVenue) return
    const supabase = createClient()
    ;(async () => {
      const { data: rows } = await supabase
        .from('venue_settings')
        .select('commercial_config, space_groups')
        .eq('user_id', user.id)
        .eq('venue_id', activeVenue.id)
        .limit(1)
      const data = Array.isArray(rows) ? rows[0] : null
      if (data?.commercial_config) setCommercialConfig(data.commercial_config as any)
      if (Array.isArray(data?.space_groups)) setVenueSpaceGroups(data.space_groups as VenueSpaceGroup[])
    })()
  }, [user, activeVenue])

  // En modo borrador (id === 'new') el preview apunta a la muestra cuyo
  // visual_template_id coincide con el del borrador, para que el iframe inicial
  // tenga algo razonable que mostrar antes de que el postMessage live-updatee.
  const iframeUrl = template.id === 'new'
    ? `/proposals/templates/t${(sections.visual_template_id as number | undefined) ?? 1}/preview`
    : `/proposals/templates/${template.id}/preview`

  // ── postMessage live preview ──────────────────────────────────────────────
  const buildPatch = useCallback(() => ({
    couple_name:         'Nombre Ejemplo 1 & Nombre Ejemplo 2',
    personal_message:    (sections as any).welcome_default || 'Queridos Nombre Ejemplo 1 & Nombre Ejemplo 2, es un placer presentaros esta propuesta. Aquí encontraréis todos los detalles sobre nuestro espacio y servicios.',
    guest_count:         150,
    wedding_date:        '2026-09-19',
    price_estimate:      18500,
    show_availability:   false,
    show_price_estimate: true,
    sections_data:       sections,
    branding: {
      logo_url:        sections.logo_url ?? null,
      primary_color:   sections.primary_color ?? '#2d4a7a',
      secondary_color: sections.secondary_color ?? null,
      font_family:     sections.font_family ?? 'Georgia, serif',
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

  // Welcome section variants — driven by the central style registry.
  const welcomeStyleConfig = SECTION_STYLES.welcome
  const welcomeGroupOn = isSectionGroupEnabled(sections, 'welcome')
  const activeWelcomeVariantId = getActiveStyle(sections, 'welcome')
  // Map variant id back to legacy section id (e.g. 'light' -> 'welcome_light') so
  // renderSectionContent keeps working with its existing per-variant editors.
  const variantIdToLegacy: Record<string, string> = {
    default: 'welcome',
    light: 'welcome_light',
    split: 'welcome_split',
    editorial: 'welcome_editorial',
  }
  const activeWelcome = variantIdToLegacy[activeWelcomeVariantId] ?? 'welcome'
  const toggleWelcomeGroup = (on: boolean) => {
    setSections(s => toggleSectionGroup(s, 'welcome', on) as SectionsData)
    markDirty()
  }
  const selectWelcomeVariant = (variantId: string) => {
    setSections(s => setActiveStyle(s, 'welcome', variantId) as SectionsData)
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
  const moveItem    = (key: string, i: number, dir: -1 | 1) => {
    const arr = [...getOverride(key)]
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setOverride(key, arr)
  }

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
    const url = await uploadImage(file, 'hero')
    if (url) { setSections(s => ({ ...s, hero_image_url: url })); markDirty() }
  }

  const handleLogoUpload = async (file: File) => {
    const url = await uploadImage(file, 'logos')
    if (url) { setSections(s => ({ ...s, logo_url: url })); markDirty() }
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  // En modo borrador (id === 'new') hace POST y devuelve la fila creada via
  // onSave; el padre se encarga de redirigir a /{nuevoId}. En modo edición,
  // PATCH normal sobre la fila existente.
  const handleSave = async () => {
    if (!name.trim()) { setSaveError('El nombre es obligatorio'); return }
    setSaving(true); setSaveError(null)
    try {
      const isDraft = template.id === 'new'
      const res = await fetch(
        isDraft ? '/api/proposal-templates' : `/api/proposal-templates/${template.id}`,
        {
          method: isDraft ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), description: description || null, sections_data: sections, is_default: isDefault }),
        }
      )
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

    if (secId === 'hero') {
      const overlayColor = (sections as any).hero_overlay_color ?? '#000000'
      const overlayOpacity = (sections as any).hero_overlay_opacity ?? 0.5
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ImageUploader
            value={sections.hero_image_url ?? null}
            height={120}
            label="Foto principal"
            hint="JPG, PNG o WEBP (máx. 10 MB)"
            alt="Hero"
            onUpload={async (f) => { await handleHeroUpload(f) }}
            onRemove={() => { setSections(s => ({ ...s, hero_image_url: undefined })); markDirty() }}
          />
          {/* Overlay controls */}
          <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--warm-gray)', marginBottom: 8 }}>Capa sobre la foto</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <input type="color" value={overlayColor}
                onChange={e => { setSections(s => ({ ...s, hero_overlay_color: e.target.value } as any)); markDirty() }}
                style={{ width: 24, height: 24, padding: 2, borderRadius: 5, border: '1px solid var(--border)', cursor: 'pointer', background: 'none' }} />
              <span style={{ fontSize: 11, color: 'var(--charcoal)', fontWeight: 500 }}>Color</span>
              <span style={{ fontSize: 10, color: 'var(--warm-gray)', marginLeft: 'auto', fontFamily: 'monospace' }}>{overlayColor}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="range" min={0} max={100} step={5} value={Math.round(overlayOpacity * 100)}
                onChange={e => { setSections(s => ({ ...s, hero_overlay_opacity: parseInt(e.target.value) / 100 } as any)); markDirty() }}
                style={{ flex: 1, accentColor: 'var(--gold)', cursor: 'pointer' }} />
              <span style={{ fontSize: 11, color: 'var(--charcoal)', fontWeight: 600, minWidth: 32, textAlign: 'right' }}>{Math.round(overlayOpacity * 100)}%</span>
            </div>
          </div>
          {/* Hero text colors */}
          <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--warm-gray)', marginBottom: 8 }}>Colores del texto</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <input type="color" value={(sections as any).hero_title_color ?? '#ffffff'}
                onChange={e => { setSections(s => ({ ...s, hero_title_color: e.target.value } as any)); markDirty() }}
                style={{ width: 24, height: 24, padding: 2, borderRadius: 5, border: '1px solid var(--border)', cursor: 'pointer', background: 'none' }} />
              <span style={{ fontSize: 11, color: 'var(--charcoal)', fontWeight: 500 }}>Título (nombre pareja)</span>
              <span style={{ fontSize: 10, color: 'var(--warm-gray)', marginLeft: 'auto', fontFamily: 'monospace' }}>{(sections as any).hero_title_color ?? '#ffffff'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="color" value={(sections as any).hero_subtitle_color ?? '#ffffff'}
                onChange={e => { setSections(s => ({ ...s, hero_subtitle_color: e.target.value } as any)); markDirty() }}
                style={{ width: 24, height: 24, padding: 2, borderRadius: 5, border: '1px solid var(--border)', cursor: 'pointer', background: 'none' }} />
              <span style={{ fontSize: 11, color: 'var(--charcoal)', fontWeight: 500 }}>Datos (fecha, invitados, precio)</span>
              <span style={{ fontSize: 10, color: 'var(--warm-gray)', marginLeft: 'auto', fontFamily: 'monospace' }}>{(sections as any).hero_subtitle_color ?? '#ffffff'}</span>
            </div>
          </div>
        </div>
      )
    }

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

    if (secId === 'venue_specs') {
      const vs = (sections as any).venue_specs ?? {}
      const setVs = (patch: any) => { setSections((s: any) => ({ ...s, venue_specs: { ...((s as any).venue_specs ?? {}), ...patch } })); markDirty() }
      const stats: Array<{ value: string; label: string }> = vs.stats ?? []
      const setStats = (next: Array<{ value: string; label: string }>) => setVs({ stats: next })
      const PRESETS = [
        { value: '1687', label: 'Año fundación' },
        { value: '8 Ha', label: 'Extensión' },
        { value: '350', label: 'Capacidad máxima' },
        { value: '1', label: 'Sola boda al día' },
        { value: '12', label: 'Hectáreas de jardines' },
        { value: '200', label: 'Plazas de parking' },
        { value: '5', label: 'Espacios exteriores' },
      ]
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <input className="form-input" style={{ fontSize: 12, width: 80, flexShrink: 0 }} placeholder="Número"
                value={s.value} onChange={e => setStats(stats.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
              <input className="form-input" style={{ fontSize: 12, flex: 1 }} placeholder="Etiqueta"
                value={s.label} onChange={e => setStats(stats.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
              <button type="button" style={removeBtn} onClick={() => setStats(stats.filter((_, j) => j !== i))}><X size={12} /></button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" style={addBtn} onClick={() => setStats([...stats, { value: '', label: '' }])}>+ Añadir dato</button>
            {stats.length === 0 && (
              <button type="button" style={{ ...addBtn, color: 'var(--primary)' }} onClick={() => setStats(PRESETS.slice(0, 4))}>Usar presets</button>
            )}
          </div>
          {stats.length > 0 && (
            <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 2 }}>
              Presets rápidos:{' '}
              {PRESETS.filter(p => !stats.some(s => s.label === p.label)).slice(0, 4).map((p, i) => (
                <button key={i} type="button" onClick={() => setStats([...stats, p])}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, fontSize: 10, padding: '2px 6px', cursor: 'pointer', marginRight: 4, color: 'var(--charcoal)' }}>
                  {p.value} · {p.label}
                </button>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.55 }}>
            Estos datos aparecen como estadísticas en la propuesta. Máximo 4-5 elementos recomendados.
          </div>
        </div>
      )
    }

    if (secId === 'experience') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input className="form-input" placeholder="Título (ej. Una finca del siglo XVII…)" style={{ fontSize: 12 }}
          value={(sections as any).experience_override?.title ?? ''}
          onChange={e => { setSections(s => ({ ...s, experience_override: { ...((s as any).experience_override ?? {}), title: e.target.value } } as any)); markDirty() }} />
        <textarea className="form-textarea" style={{ minHeight: 100, fontSize: 12 }} placeholder="Historia y descripción del venue…"
          value={(sections as any).experience_override?.body ?? ''}
          onChange={e => { setSections(s => ({ ...s, experience_override: { ...((s as any).experience_override ?? {}), body: e.target.value } } as any)); markDirty() }} />
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>Foto de la experiencia</div>
          <ImageUploader
            compact
            value={(sections as any).experience_override?.image_url ?? null}
            aspectRatio={16 / 10}
            alt="Foto experiencia"
            label="Añadir foto"
            onUpload={async (f) => {
              const url = await uploadImage(f, 'experience')
              if (url) {
                setSections(s => ({ ...s, experience_override: { ...((s as any).experience_override ?? {}), image_url: url } } as any))
                markDirty()
              }
            }}
            onRemove={() => {
              setSections(s => ({ ...s, experience_override: { ...((s as any).experience_override ?? {}), image_url: null } } as any))
              markDirty()
            }}
          />
        </div>
      </div>
    )

    if (secId === 'gallery') {
      const urls = sections.gallery_urls ?? []
      const galleryStyleConfig = SECTION_STYLES.gallery
      const activeGalleryVariantId = getActiveStyle(sections, 'gallery')
      const selectGalleryVariant = (variantId: string) => {
        setSections(s => setActiveStyle(s, 'gallery', variantId) as SectionsData)
        markDirty()
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Style picker */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Estilo visual</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {galleryStyleConfig.variants.map(v => {
                const sel = activeGalleryVariantId === v.id
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => selectGalleryVariant(v.id)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      border: `1.5px solid ${sel ? 'var(--gold)' : 'var(--border)'}`,
                      borderRadius: 8,
                      background: sel ? 'rgba(196,151,90,0.08)' : '#fff',
                      cursor: 'pointer',
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--gold)' : 'var(--charcoal)' }}>{v.label}</span>
                      {sel && <Check size={11} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
                    </div>
                    {v.description && (
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', lineHeight: 1.4 }}>{v.description}</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Photo grid */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Fotos</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {urls.map((url, i) => (
                <ImageUploader
                  key={i}
                  compact
                  value={url}
                  aspectRatio={4 / 3}
                  alt=""
                  onUpload={async (f) => {
                    const newUrl = await uploadImage(f, 'gallery')
                    if (newUrl) {
                      setSections(s => ({ ...s, gallery_urls: (s.gallery_urls ?? []).map((u, j) => j === i ? newUrl : u) }))
                      markDirty()
                    }
                  }}
                  onRemove={() => { setSections(s => ({ ...s, gallery_urls: (s.gallery_urls ?? []).filter((_, j) => j !== i) })); markDirty() }}
                />
              ))}
              {/* Multi-file add button */}
              <div
                onClick={() => {
                  const inp = document.createElement('input')
                  inp.type = 'file'
                  inp.accept = 'image/jpeg,image/png,image/webp'
                  inp.multiple = true
                  inp.onchange = async () => {
                    const files = Array.from(inp.files ?? [])
                    for (const f of files) {
                      const newUrl = await uploadImage(f, 'gallery')
                      if (newUrl) {
                        setSections(s => ({ ...s, gallery_urls: [...(s.gallery_urls ?? []), newUrl] }))
                      }
                    }
                    if (files.length) markDirty()
                  }
                  inp.click()
                }}
                style={{
                  aspectRatio: '4/3', borderRadius: 8, border: '2px dashed var(--border)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', gap: 4, background: 'var(--cream)',
                  transition: 'border-color .15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <ImageIcon size={16} style={{ color: 'var(--warm-gray)' }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--charcoal)' }}>Añadir fotos</span>
                <span style={{ fontSize: 9, color: 'var(--warm-gray)' }}>Múltiples a la vez</span>
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (secId === 'single_space') {
      const ss: any = (sections as any).single_space ?? {}
      const setSs = (patch: any) => { setSections((s: any) => ({ ...s, single_space: { ...((s as any).single_space ?? {}), ...patch } })); markDirty() }
      const features: string[] = Array.isArray(ss.features) ? ss.features : []
      const setFeatures = (next: string[]) => setSs({ features: next })
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="form-input" placeholder="Subtítulo (ej. Vuestro espacio)" style={{ fontSize: 12 }} value={ss.subtitle ?? ''} onChange={e => setSs({ subtitle: e.target.value })} />
          <input className="form-input" placeholder="Título (ej. El Salón Principal)" style={{ fontSize: 12 }} value={ss.title ?? ''} onChange={e => setSs({ title: e.target.value })} />
          <textarea className="form-textarea" style={{ minHeight: 70, fontSize: 12 }} placeholder="Descripción del espacio…" value={ss.description ?? ''} onChange={e => setSs({ description: e.target.value })} />
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="form-input" style={{ fontSize: 12 }} placeholder="m² (ej. 500)" value={ss.sqm ?? ''} onChange={e => setSs({ sqm: e.target.value })} />
            <input className="form-input" style={{ fontSize: 12 }} placeholder="Cap. mín." value={ss.min_guests ?? ''} onChange={e => setSs({ min_guests: e.target.value })} />
            <input className="form-input" style={{ fontSize: 12 }} placeholder="Cap. máx." value={ss.max_guests ?? ''} onChange={e => setSs({ max_guests: e.target.value })} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 4 }}>Fotos del espacio</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Migrate legacy single image_url into photos array */}
              {[...(Array.isArray(ss.photos) ? ss.photos : []), ...(ss.image_url && !(ss.photos ?? []).includes(ss.image_url) ? [ss.image_url] : [])].map((url: string, pi: number) => (
                <div key={pi} style={{ position: 'relative', width: 56, height: 56 }}>
                  <img src={url} alt="" style={{ width: 56, height: 56, borderRadius: 6, objectFit: 'cover' }} />
                  <button type="button" onClick={() => {
                    const allPhotos = [...(Array.isArray(ss.photos) ? ss.photos : []), ...(ss.image_url && !(ss.photos ?? []).includes(ss.image_url) ? [ss.image_url] : [])]
                    const next = allPhotos.filter((_: string, j: number) => j !== pi)
                    setSs({ photos: next, image_url: next[0] ?? '' })
                  }}
                    style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ))}
              <ImageUploader label="+" height={48} onUpload={async (f) => {
                const url = await uploadImage(f, 'spaces')
                if (url) {
                  const allPhotos = [...(Array.isArray(ss.photos) ? ss.photos : []), ...(ss.image_url && !(ss.photos ?? []).includes(ss.image_url) ? [ss.image_url] : [])]
                  const next = [...allPhotos, url]
                  setSs({ photos: next, image_url: next[0] })
                }
              }} />
            </div>
          </div>
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
          <div style={{ padding: '10px 12px', background: 'var(--ivory)', border: '1.5px dashed var(--border)', borderRadius: 8, opacity: 0.7, pointerEvents: 'none', userSelect: 'none' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>Precio por fecha del lead</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['Fecha 1', 'Fecha 2'].map((label, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--warm-gray)', flex: 1 }}>{label}</span>
                  <div style={{ width: 80, height: 28, background: 'var(--cream)', borderRadius: 6, border: '1px solid var(--border)' }} />
                  <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>€</span>
                  <span style={{ fontSize: 9, color: 'var(--warm-gray)', background: 'var(--cream)', padding: '1px 6px', borderRadius: 8 }}>auto</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 9, color: 'var(--warm-gray)', marginTop: 6 }}>Se completará automáticamente al asociar un lead con fechas y tarifa.</div>
          </div>
        </div>
      )
    }

    if (secId === 'zones') {
      const zh: any = (sections as any).zones_header ?? {}
      const setZh = (patch: any) => { setSections((s: any) => ({ ...s, zones_header: { ...((s as any).zones_header ?? {}), ...patch } })); markDirty() }
      const zhMode: 'single' | 'zones' = zh.mode ?? 'zones'
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="form-input" placeholder="Etiqueta sección (ej. Los espacios)" style={{ fontSize: 12 }} value={zh.label ?? ''} onChange={e => setZh({ label: e.target.value })} />
          <input className="form-input" placeholder="Título sección (ej. Cada rincón, un escenario)" style={{ fontSize: 12 }} value={zh.title ?? ''} onChange={e => setZh({ title: e.target.value })} />
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['single', 'zones'] as const).map(m => (
              <button key={m} type="button"
                onClick={() => setZh({ mode: m })}
                style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, borderRadius: 6, border: `1px solid ${zhMode === m ? 'var(--gold)' : 'var(--border)'}`, background: zhMode === m ? '#fdf6ea' : '#fff', color: zhMode === m ? '#8a6020' : 'var(--warm-gray)', cursor: 'pointer' }}>
                {m === 'single' ? 'Espacio único' : 'Con suplementos'}
              </button>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 2 }}>
            {getOverride(overrideKey).map((z: any, i: number) => {
              const caps: any[] = Array.isArray(z.capacities) ? z.capacities : []
              const updateCaps = (newCaps: any[]) => updateItem(overrideKey, i, 'capacities', newCaps)
              const feats: string[] = Array.isArray(z.features) ? z.features : []
              return (
                <details key={i} style={{ border: '1px solid var(--border)', borderRadius: 7, marginBottom: 7, overflow: 'hidden' }}>
                  <summary style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--charcoal)', fontWeight: 500, background: 'var(--cream)', listStyle: 'none' }}>
                    <ChevronDown size={11} color="var(--warm-gray)" />
                    <span style={{ flex: 1 }}>{z.name || <em style={{ color: 'var(--warm-gray)' }}>Nueva zona</em>}</span>
                    <button type="button" style={removeBtn} onClick={e => { e.preventDefault(); e.stopPropagation(); moveItem(overrideKey, i, -1) }} title="Subir" disabled={i === 0}>▲</button>
                    <button type="button" style={removeBtn} onClick={e => { e.preventDefault(); e.stopPropagation(); moveItem(overrideKey, i, 1) }} title="Bajar" disabled={i === getOverride(overrideKey).length - 1}>▼</button>
                    <button type="button" style={removeBtn} onClick={e => { e.preventDefault(); e.stopPropagation(); removeItem(overrideKey, i) }}><X size={12} /></button>
                  </summary>
                  <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input className="form-input" placeholder="Subtítulo zona (ej. Espacio 01)" style={{ fontSize: 12 }} value={z.subtitle ?? ''} onChange={e => updateItem(overrideKey, i, 'subtitle', e.target.value)} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input className="form-input" placeholder="Nombre *" style={{ fontSize: 12 }} value={z.name ?? ''} onChange={e => updateItem(overrideKey, i, 'name', e.target.value)} />
                      <input className="form-input" style={{ width: 75, flexShrink: 0, fontSize: 12 }} type="number" placeholder="m²" value={z.sqm ?? ''} onChange={e => updateItem(overrideKey, i, 'sqm', e.target.value ? Number(e.target.value) : undefined)} />
                    </div>
                    <input className="form-input" placeholder="Descripción" style={{ fontSize: 12 }} value={z.description ?? ''} onChange={e => updateItem(overrideKey, i, 'description', e.target.value)} />
                    {/* Price/supplement — only when mode is 'zones' */}
                    {zhMode === 'zones' && (
                      <input className="form-input" style={{ fontSize: 12 }} placeholder="Suplemento (opcional, ej. +500€)" value={z.price ?? ''} onChange={e => updateItem(overrideKey, i, 'price', e.target.value)} />
                    )}
                    {/* Photos */}
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 4 }}>Fotos de la zona</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {(z.photos ?? []).map((url: string, pi: number) => (
                          <div key={pi} style={{ position: 'relative', width: 56, height: 56 }}>
                            <img src={url} alt="" style={{ width: 56, height: 56, borderRadius: 6, objectFit: 'cover' }} />
                            <button type="button" onClick={() => { const next = [...(z.photos ?? [])]; next.splice(pi, 1); updateItem(overrideKey, i, 'photos', next) }}
                              style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                          </div>
                        ))}
                        <ImageUploader label="+" height={48} onUpload={async (f) => { const url = await uploadImage(f, 'zones'); if (url) updateItem(overrideKey, i, 'photos', [...(z.photos ?? []), url]) }} />
                      </div>
                    </div>
                    {/* Capacidades */}
                    <div style={{ background: 'var(--cream)', borderRadius: 6, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>Capacidades</div>
                      {caps.map((c: any, ci: number) => (
                        <div key={ci} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <Select value={c.type ?? 'other'} onValueChange={(v) => updateCaps(caps.map((x: any, j: number) => j === ci ? { ...x, type: v } : x))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ceremony">Ceremonia</SelectItem>
                                <SelectItem value="cocktail">Coctel</SelectItem>
                                <SelectItem value="banquet">Banquete</SelectItem>
                                <SelectItem value="party">Fiesta</SelectItem>
                                <SelectItem value="other">Otro</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <input className="form-input" type="number" placeholder="pax" style={{ width: 72, fontSize: 12 }} value={c.count ?? ''}
                            onChange={e => updateCaps(caps.map((x: any, j: number) => j === ci ? { ...x, count: e.target.value ? Number(e.target.value) : undefined } : x))} />
                          <input className="form-input" placeholder="Etiqueta (opc.)" style={{ flex: 1, fontSize: 12 }} value={c.label ?? ''}
                            onChange={e => updateCaps(caps.map((x: any, j: number) => j === ci ? { ...x, label: e.target.value } : x))} />
                          <button type="button" style={{ ...removeBtn, width: 22, height: 22 }} onClick={() => updateCaps(caps.filter((_: any, j: number) => j !== ci))}><X size={11} /></button>
                        </div>
                      ))}
                      <button type="button" style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '2px 0' }}
                        onClick={() => updateCaps([...caps, { type: 'banquet', count: undefined }])}>
                        + Añadir capacidad
                      </button>
                    </div>
                    {/* Tipo (interior/exterior) + características libres */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <Select value={z.covered || '__none__'} onValueChange={(v) => updateItem(overrideKey, i, 'covered', v === '__none__' ? undefined : v)}>
                          <SelectTrigger><SelectValue placeholder="— tipo —" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— tipo —</SelectItem>
                            <SelectItem value="indoor">Interior</SelectItem>
                            <SelectItem value="outdoor">Exterior</SelectItem>
                            <SelectItem value="covered-outdoor">Exterior cubierto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {/* Features — free text chips */}
                    <div style={{ background: 'var(--cream)', borderRadius: 6, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>Características</div>
                      {feats.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {feats.map((f: string, fi: number) => (
                            <span key={fi} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#fdf6ea', border: '1px solid var(--gold, #2E6DB4)', color: '#8a6020' }}>
                              {f}
                              <button type="button" onClick={() => updateItem(overrideKey, i, 'features', feats.filter((_: string, j: number) => j !== fi))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontSize: 12 }}>×</button>
                            </span>
                          ))}
                        </div>
                      )}
                      <input className="form-input" style={{ fontSize: 11 }} placeholder="Añadir característica (Enter)" onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault()
                          const val = (e.target as HTMLInputElement).value.trim().replace(/,$/, '')
                          if (val) { updateItem(overrideKey, i, 'features', [...feats, val]);(e.target as HTMLInputElement).value = '' }
                        }
                      }} />
                    </div>
                    <input className="form-input" style={{ fontSize: 12 }} placeholder="Notas adicionales (ej. *Opción haima +coste)" value={z.notes ?? ''} onChange={e => updateItem(overrideKey, i, 'notes', e.target.value)} />
                  </div>
                </details>
              )
            })}
            <button type="button" style={addBtn} onClick={() => addItem(overrideKey, { name: '', description: '', capacities: [] })}>+ Añadir zona</button>
          </div>
        </div>
      )
    }

    if (secId === 'space_groups') {
      if (venueSpaceGroups.length > 0 || commercialConfig?.space_type === 'multiple_independent') {
        return (
          <MultipleZonesEditor
            venueSpaceGroups={venueSpaceGroups}
            groups={(sections as any).space_groups ?? []}
            onChange={val => { setSections((s: any) => ({ ...s, space_groups: val })); markDirty() }}
            uploadImage={uploadImage}
            isTemplate
          />
        )
      }
      return (
        <SpaceGroupEditor
          groups={(sections as any).space_groups ?? []}
          onChange={val => { setSections((s: any) => ({ ...s, space_groups: val })); markDirty() }}
          uploadImage={uploadImage}
          isTemplate
        />
      )
    }

    if (secId === 'venue_rental') return (
      <div style={{ padding: '10px 12px', background: 'var(--cream)', borderRadius: 7, fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.5, display: 'flex', gap: 8 }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 1, color: 'var(--gold)' }} />
        Las tarifas se configuran en <strong>Configuración → Opciones y tarifas</strong> y se asignan por propuesta según la fecha.
      </div>
    )

    if (secId === 'inclusions') {
      const inclusionsStyleConfig = SECTION_STYLES.inclusions
      const activeInclusionsVariantId = getActiveStyle(sections, 'inclusions')
      const selectInclusionsVariant = (variantId: string) => {
        setSections(s => setActiveStyle(s, 'inclusions', variantId) as SectionsData)
        markDirty()
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Title + subtitle */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>Título</div>
            <input className="form-input" style={{ fontSize: 12, marginBottom: 8 }} placeholder="Qué incluye"
              value={(sections as any).inclusions_title ?? ''}
              onChange={e => { setSections(s => ({ ...s, inclusions_title: e.target.value } as any)); markDirty() }} />
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>Subtítulo</div>
            <input className="form-input" style={{ fontSize: 12 }} placeholder="Todo lo que necesitáis, sin sorpresas"
              value={(sections as any).inclusions_subtitle ?? ''}
              onChange={e => { setSections(s => ({ ...s, inclusions_subtitle: e.target.value } as any)); markDirty() }} />
          </div>
          {/* Column count */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>Columnas</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[1, 2, 3, 4].map(n => {
                const active = ((sections as any).inclusions_columns ?? 2) === n
                return (
                  <button key={n} type="button"
                    onClick={() => { setSections(s => ({ ...s, inclusions_columns: n } as any)); markDirty() }}
                    style={{
                      padding: '6px 0', textAlign: 'center', fontSize: 12, fontWeight: 600,
                      border: `1.5px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                      borderRadius: 6, cursor: 'pointer',
                      background: active ? 'rgba(196,151,90,0.08)' : '#fff',
                      color: active ? 'var(--gold)' : 'var(--charcoal)',
                    }}>{n}</button>
                )
              })}
            </div>
          </div>
          {/* Style picker */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Estilo visual</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {inclusionsStyleConfig.variants.map(v => {
                const sel = activeInclusionsVariantId === v.id
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => selectInclusionsVariant(v.id)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      border: `1.5px solid ${sel ? 'var(--gold)' : 'var(--border)'}`,
                      borderRadius: 8,
                      background: sel ? 'rgba(196,151,90,0.08)' : '#fff',
                      cursor: 'pointer',
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--gold)' : 'var(--charcoal)' }}>{v.label}</span>
                      {sel && <Check size={11} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
                    </div>
                    {v.description && (
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', lineHeight: 1.4 }}>{v.description}</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Items list */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Elementos</div>
            {getOverride(overrideKey).map((x: any, i: number) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 7, marginBottom: 7, padding: '8px 10px', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <div style={{ width: 160, flexShrink: 0 }}>
                      <Select value={x.icon || '__none__'} onValueChange={(v) => updateItem(overrideKey, i, 'icon', v === '__none__' ? '' : v)}>
                        <SelectTrigger><SelectValue placeholder="— icono —" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— icono —</SelectItem>
                          {INCLUSION_ICON_CHOICES.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <input className="form-input" placeholder="Título *" style={{ fontSize: 12 }} value={x.title ?? ''} onChange={e => updateItem(overrideKey, i, 'title', e.target.value)} />
                  </div>
                  <input className="form-input" placeholder="Descripción (opcional)" style={{ fontSize: 12 }} value={x.description ?? ''} onChange={e => updateItem(overrideKey, i, 'description', e.target.value)} />
                </div>
                <button type="button" style={removeBtn} onClick={() => removeItem(overrideKey, i)}><X size={12} /></button>
              </div>
            ))}
            <button type="button" style={addBtn} onClick={() => addItem(overrideKey, { title: '', icon: 'check', description: '' })}>+ Añadir elemento</button>
          </div>
        </div>
      )
    }

    if (secId === 'testimonials') {
      const testimonialsStyleConfig = SECTION_STYLES.testimonials
      const activeTestimonialsVariantId = getActiveStyle(sections, 'testimonials')
      const selectTestimonialsVariant = (variantId: string) => {
        setSections(s => setActiveStyle(s, 'testimonials', variantId) as SectionsData)
        markDirty()
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Style picker */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Estilo visual</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {testimonialsStyleConfig.variants.map(v => {
                const sel = activeTestimonialsVariantId === v.id
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => selectTestimonialsVariant(v.id)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      border: `1.5px solid ${sel ? 'var(--gold)' : 'var(--border)'}`,
                      borderRadius: 8,
                      background: sel ? 'rgba(196,151,90,0.08)' : '#fff',
                      cursor: 'pointer',
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--gold)' : 'var(--charcoal)' }}>{v.label}</span>
                      {sel && <Check size={11} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
                    </div>
                    {v.description && (
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', lineHeight: 1.4 }}>{v.description}</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Testimonials list */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Testimonios</div>
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
                    <div style={{ width: 165, flexShrink: 0 }}>
                      <DatePicker value={t.wedding_date ?? ''} onChange={(v) => updateItem(overrideKey, i, 'wedding_date', v)} placeholder="Fecha" />
                    </div>
                  </div>
                  <textarea className="form-textarea" style={{ minHeight: 70, fontSize: 12 }} placeholder="Testimonio…" value={t.text ?? ''} onChange={e => updateItem(overrideKey, i, 'text', e.target.value)} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--warm-gray)' }}>
                      Estrellas:
                      <input className="form-input" type="number" min={1} max={5} style={{ width: 65, fontSize: 12 }} value={t.rating ?? 5} onChange={e => updateItem(overrideKey, i, 'rating', Number(e.target.value) || 5)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      {t.photo_url ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <img src={t.photo_url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                          <button type="button" style={removeBtn} onClick={() => updateItem(overrideKey, i, 'photo_url', '')}><X size={11} /></button>
                        </div>
                      ) : (
                        <ImageUploader label="Foto" height={48} onUpload={async (f) => { const url = await uploadImage(f, 'testimonials'); if (url) updateItem(overrideKey, i, 'photo_url', url) }} />
                      )}
                    </div>
                  </div>
                </div>
              </details>
            ))}
            <button type="button" style={addBtn} onClick={() => addItem(overrideKey, { couple_name: '', text: '', wedding_date: '', rating: 5 })}>+ Añadir testimonio</button>
          </div>
        </div>
      )
    }

    if (secId === 'collaborators') {
      const collabMeta = (sections as any).collaborators_meta ?? {}
      const setCollabMeta = (patch: any) => { setSections((s: any) => ({ ...s, collaborators_meta: { ...((s as any).collaborators_meta ?? {}), ...patch } })); markDirty() }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="form-input" style={{ fontSize: 12 }} placeholder="Etiqueta superior (ej. Proveedores de confianza)" value={collabMeta.eyebrow ?? ''} onChange={e => setCollabMeta({ eyebrow: e.target.value })} />
          <input className="form-input" style={{ fontSize: 12 }} placeholder="Título (ej. Nuestros colaboradores)" value={collabMeta.title ?? ''} onChange={e => setCollabMeta({ title: e.target.value })} />
          <input className="form-input" style={{ fontSize: 12 }} placeholder="Subtítulo (ej. Trabajamos sin exclusividad…)" value={collabMeta.subtitle ?? ''} onChange={e => setCollabMeta({ subtitle: e.target.value })} />
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          {getOverride(overrideKey).map((c: any, i: number) => (
            <div key={i} style={{ border: `1px solid ${c.exclusive ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 7, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5, background: c.exclusive ? 'rgba(var(--primary-rgb, 180,130,80), 0.04)' : 'transparent' }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <input className="form-input" placeholder="Nombre *" style={{ fontSize: 12 }} value={c.name ?? ''} onChange={e => updateItem(overrideKey, i, 'name', e.target.value)} />
                <input className="form-input" style={{ width: 130, flexShrink: 0, fontSize: 12 }} placeholder="Categoría" value={c.category ?? ''} onChange={e => updateItem(overrideKey, i, 'category', e.target.value)} />
                <button type="button" style={removeBtn} onClick={() => removeItem(overrideKey, i)}><X size={12} /></button>
              </div>
              <input className="form-input" placeholder="Descripción" style={{ fontSize: 12 }} value={c.description ?? ''} onChange={e => updateItem(overrideKey, i, 'description', e.target.value)} />
              <div style={{ display: 'flex', gap: 5 }}>
                <input className="form-input" style={{ fontSize: 12 }} placeholder="Web (opcional)" value={c.website ?? ''} onChange={e => updateItem(overrideKey, i, 'website', e.target.value)} />
                <input className="form-input" style={{ fontSize: 12, width: 130, flexShrink: 0 }} placeholder="@instagram" value={c.instagram ?? ''} onChange={e => updateItem(overrideKey, i, 'instagram', e.target.value)} />
                <input className="form-input" style={{ fontSize: 12, width: 160, flexShrink: 0 }} placeholder="Email" value={c.email ?? ''} onChange={e => updateItem(overrideKey, i, 'email', e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <input className="form-input" style={{ fontSize: 12, width: 160, flexShrink: 0 }} placeholder="Teléfono" value={c.phone ?? ''} onChange={e => updateItem(overrideKey, i, 'phone', e.target.value)} />
                <input className="form-input" style={{ fontSize: 12 }} placeholder="Info precios orientativa" value={c.price_info ?? ''} onChange={e => updateItem(overrideKey, i, 'price_info', e.target.value)} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: c.exclusive ? 'var(--primary)' : 'var(--warm-gray)' }}>
                <input type="checkbox" checked={!!c.exclusive} onChange={e => updateItem(overrideKey, i, 'exclusive', e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
                Exclusividad
              </label>
            </div>
          ))}
          <button type="button" style={addBtn} onClick={() => addItem(overrideKey, { name: '', category: '', description: '' })}>+ Añadir colaborador</button>
        </div>
      )
    }

    if (secId === 'accommodation') {
      const acc: any = (sections as any).accommodation_override ?? {}
      const p = (patch: any) => { setSections(s => ({ ...s, accommodation_override: { ...((s as any).accommodation_override ?? {}), ...patch } } as any)); markDirty() }
      const roomsList: string[] = Array.isArray(acc.rooms_list) ? acc.rooms_list : (acc.rooms ? acc.rooms.split('·').map((r: string) => r.trim()).filter(Boolean) : [])
      const setRoomsList = (next: string[]) => p({ rooms_list: next, rooms: next.join(' · ') })
      const options: any[] = Array.isArray(acc.options) ? acc.options : []
      const setOptions = (next: any[]) => p({ options: next })
      const updateOpt = (idx: number, patch: any) => setOptions(options.map((o, i) => i === idx ? { ...o, ...patch } : o))

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Description */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 4 }}>Descripción</div>
            <textarea className="form-textarea" style={{ minHeight: 60, fontSize: 12 }} placeholder="La finca dispone de 8 habitaciones…" value={acc.description ?? ''} onChange={e => p({ description: e.target.value })} />
          </div>

          {/* Rooms list */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 4 }}>Habitaciones (lista)</div>
            {roomsList.map((r: string, ri: number) => (
              <div key={ri} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <input className="form-input" style={{ fontSize: 12 }} placeholder="Ej. 4 Suites dobles" value={r} onChange={e => setRoomsList(roomsList.map((x, j) => j === ri ? e.target.value : x))} />
                <button type="button" style={removeBtn} onClick={() => setRoomsList(roomsList.filter((_, j) => j !== ri))}><X size={12} /></button>
              </div>
            ))}
            <button type="button" style={addBtn} onClick={() => setRoomsList([...roomsList, ''])}>+ Añadir tipo de habitación</button>
          </div>

          {/* Tariff options */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 4 }}>Tarifas de alojamiento</div>
            {options.map((opt: any, oi: number) => {
              const prices: any[] = Array.isArray(opt.prices) ? opt.prices : []
              const setPrices = (next: any[]) => updateOpt(oi, { prices: next })
              return (
                <div key={oi} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    <input className="form-input" style={{ fontSize: 12, flex: 1 }} placeholder="Nombre (Ej. Suite Nupcial)" value={opt.label ?? ''} onChange={e => updateOpt(oi, { label: e.target.value })} />
                    <button type="button" style={removeBtn} onClick={() => setOptions(options.filter((_, j) => j !== oi))}><X size={12} /></button>
                  </div>
                  <input className="form-input" style={{ fontSize: 11, marginBottom: 4, width: '100%' }} placeholder="Descripción (opcional)" value={opt.description ?? ''} onChange={e => updateOpt(oi, { description: e.target.value })} />

                  {/* Included toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <label style={{ fontSize: 11, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!opt.included} onChange={e => updateOpt(oi, { included: e.target.checked })} />
                      Incluido en tarifa
                    </label>
                  </div>

                  {/* Prices by season (when not included) */}
                  {!opt.included && (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 3 }}>Precios por temporada</div>
                      {prices.map((pr: any, pi: number) => (
                        <div key={pi} style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
                          <input className="form-input" style={{ fontSize: 11, flex: 1 }} placeholder="Temporada (Ej. Todo el año)" value={pr.season ?? ''} onChange={e => setPrices(prices.map((x, j) => j === pi ? { ...x, season: e.target.value } : x))} />
                          <input className="form-input" style={{ fontSize: 11, width: 100 }} placeholder="Precio" value={pr.price ?? ''} onChange={e => setPrices(prices.map((x, j) => j === pi ? { ...x, price: e.target.value } : x))} />
                          <button type="button" style={removeBtn} onClick={() => setPrices(prices.filter((_, j) => j !== pi))}><X size={12} /></button>
                        </div>
                      ))}
                      <button type="button" style={{ ...addBtn, fontSize: 10 }} onClick={() => setPrices([...prices, { season: '', price: '' }])}>+ Temporada</button>
                    </div>
                  )}
                </div>
              )
            })}
            <button type="button" style={addBtn} onClick={() => setOptions([...options, { label: '', description: '', included: false, prices: [] }])}>+ Añadir tarifa</button>
          </div>

          {/* Nearby */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 4 }}>Alojamientos cercanos</div>
            <input className="form-input" placeholder="Hotel Son Brull (10 min), Castell Son Claret (15 min)…" style={{ fontSize: 12 }} value={acc.nearby ?? ''} onChange={e => p({ nearby: e.target.value })} />
          </div>
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

    if (secId === 'pricing') {
      const pricingStyleConfig = SECTION_STYLES.pricing
      const activePricingVariantId = getActiveStyle(sections, 'pricing')
      const selectPricingVariant = (variantId: string) => {
        setSections(s => setActiveStyle(s, 'pricing', variantId) as SectionsData)
        markDirty()
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Estilo visual</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {pricingStyleConfig.variants.map(v => {
                const sel = activePricingVariantId === v.id
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => selectPricingVariant(v.id)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      border: `1.5px solid ${sel ? 'var(--gold)' : 'var(--border)'}`,
                      borderRadius: 8,
                      background: sel ? 'rgba(196,151,90,0.08)' : '#fff',
                      cursor: 'pointer',
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--gold)' : 'var(--charcoal)' }}>{v.label}</span>
                      {sel && <Check size={11} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
                    </div>
                    {v.description && (
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', lineHeight: 1.4 }}>{v.description}</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.5, padding: '10px 12px', background: 'var(--cream)', borderRadius: 7 }}>
            Los paquetes se editan en <strong>Comunicación → Plantillas de propuesta</strong> o por propuesta concreta.
          </div>
        </div>
      )
    }

    if (secId === 'faq') {
      const faqStyleConfig = SECTION_STYLES.faq
      const activeFaqVariantId = getActiveStyle(sections, 'faq')
      const selectFaqVariant = (variantId: string) => {
        setSections(s => setActiveStyle(s, 'faq', variantId) as SectionsData)
        markDirty()
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Style picker */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Estilo visual</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {faqStyleConfig.variants.map(v => {
                const sel = activeFaqVariantId === v.id
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => selectFaqVariant(v.id)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      border: `1.5px solid ${sel ? 'var(--gold)' : 'var(--border)'}`,
                      borderRadius: 8,
                      background: sel ? 'rgba(196,151,90,0.08)' : '#fff',
                      cursor: 'pointer',
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--gold)' : 'var(--charcoal)' }}>{v.label}</span>
                      {sel && <Check size={11} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
                    </div>
                    {v.description && (
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', lineHeight: 1.4 }}>{v.description}</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* FAQ list */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Preguntas</div>
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
        </div>
      )
    }

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

    if (secId === 'floating_contact') {
      const c: any = (sections as any).contact ?? {}
      const p = (patch: any) => { setSections(s => ({ ...s, contact: { ...((s as any).contact ?? {}), ...patch } } as any)); markDirty() }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 2 }}>Datos de contacto</div>
          <input className="form-input" placeholder="Teléfono / WhatsApp (ej: +34 600 000 000)" style={{ fontSize: 12 }} value={c.phone ?? ''} onChange={e => p({ phone: e.target.value })} />
          <input className="form-input" type="email" placeholder="Email de contacto" style={{ fontSize: 12 }} value={c.email ?? ''} onChange={e => p({ email: e.target.value })} />
          <div style={{ fontSize: 10, color: 'var(--warm-gray)', lineHeight: 1.5, marginTop: 2 }}>
            Se usa para el botón flotante y la sección de contacto. Si lo dejas vacío, se usa el contacto del venue.
          </div>
        </div>
      )
    }

    if (secId === 'sticky_nav') return (
      <div style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.6, background: 'var(--cream)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
        Añade enlaces de navegación a la barra superior. Aparecen al hacer scroll y llevan a las secciones activas (Galería, Espacios, Menús, Contactar…). Se generan automáticamente.
      </div>
    )

    if (secId === 'welcome_light') {
      const wl: any = (sections as any).welcome_light ?? {}
      const setWl = (patch: any) => { setSections(s => ({ ...s, welcome_light: { ...((s as any).welcome_light ?? {}), ...patch } } as any)); markDirty() }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
            Muestra el mensaje de bienvenida sobre fondo claro crema. Puedes añadir una imagen de fondo opcional.
          </div>
          <ImageUploader
            value={wl.image_url ?? null}
            height={140}
            label="Imagen de fondo (opcional)"
            hint="JPG, PNG o WEBP"
            alt="Imagen de fondo bienvenida"
            onUpload={async (f) => {
              const url = await uploadImage(f, 'welcome')
              if (url) setWl({ image_url: url })
            }}
            onRemove={() => setWl({ image_url: null })}
          />
        </div>
      )
    }

    if (secId === 'welcome_split') {
      const ws: any = (sections as any).welcome_split ?? {}
      const p = (patch: any) => { setSections(s => ({ ...s, welcome_split: { ...((s as any).welcome_split ?? {}), ...patch } } as any)); markDirty() }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
            Dos columnas: imagen a un lado, mensaje de bienvenida al otro.
          </div>
          <ImageUploader
            value={ws.image_url ?? null}
            height={140}
            label="Imagen de la sección"
            hint="JPG, PNG o WEBP"
            alt="Imagen bienvenida dividida"
            onUpload={async (f) => {
              const url = await uploadImage(f, 'welcome')
              if (url) p({ image_url: url })
            }}
            onRemove={() => p({ image_url: null })}
          />
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
      const visitStyleConfig = SECTION_STYLES.schedule_visit
      const activeVariantId = getActiveStyle(sections, 'schedule_visit')
      const selectVariant = (variantId: string) => {
        setSections(s => setActiveStyle(s, 'schedule_visit', variantId) as SectionsData)
        markDirty()
      }
      const defaultKinds: Array<{ id: string; label: string }> = [
        { id: 'visit', label: 'Visitar el venue' },
        { id: 'call',  label: 'Llamada telefónica' },
        { id: 'video', label: 'Videollamada' },
        { id: 'menu',  label: 'Pregunta sobre menú' },
        { id: 'other', label: 'Otro' },
      ]
      const kinds: Array<{ id: string; label: string }> = Array.isArray(sv.kinds) && sv.kinds.length > 0 ? sv.kinds : defaultKinds
      const updateKinds = (next: Array<{ id: string; label: string }>) => p({ kinds: next })
      const updateKind = (i: number, label: string) => updateKinds(kinds.map((k, idx) => idx === i ? { ...k, label } : k))
      const removeKind = (i: number) => updateKinds(kinds.filter((_, idx) => idx !== i))
      const moveKind = (i: number, dir: -1 | 1) => {
        const j = i + dir
        if (j < 0 || j >= kinds.length) return
        const next = [...kinds]
        ;[next[i], next[j]] = [next[j], next[i]]
        updateKinds(next)
      }
      const addKind = () => {
        const newId = `custom_${Math.random().toString(36).slice(2, 8)}`
        updateKinds([...kinds, { id: newId, label: 'Nueva opción' }])
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Variant picker */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>Tipo de sección</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {visitStyleConfig.variants.map(v => {
                const sel = activeVariantId === v.id
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => selectVariant(v.id)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      border: `1.5px solid ${sel ? 'var(--gold)' : 'var(--border)'}`,
                      borderRadius: 8,
                      background: sel ? 'rgba(196,151,90,0.08)' : '#fff',
                      cursor: 'pointer',
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--gold)' : 'var(--charcoal)' }}>{v.label}</span>
                      {sel && <Check size={11} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
                    </div>
                    {v.description && (
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', lineHeight: 1.4 }}>{v.description}</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <input className="form-input" placeholder="Título (ej. Agendar visita)" style={{ fontSize: 12 }} value={sv.title ?? ''} onChange={e => p({ title: e.target.value })} />
          <textarea className="form-textarea" style={{ minHeight: 60, fontSize: 12 }} placeholder="Subtítulo / descripción breve…" value={sv.subtitle ?? ''} onChange={e => p({ subtitle: e.target.value })} />

          {activeVariantId === 'cta' ? (
            <>
              <input className="form-input" placeholder="URL Calendly / Cal.com (opcional)" style={{ fontSize: 12 }} value={sv.url ?? ''} onChange={e => p({ url: e.target.value })} />
              <input className="form-input" placeholder="Texto del botón (ej. Reservar visita →)" style={{ fontSize: 12 }} value={sv.cta_label ?? ''} onChange={e => p({ cta_label: e.target.value })} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--warm-gray)', flex: 1 }}>Color del texto del botón</label>
                <input type="color" value={sv.cta_text_color || '#ffffff'} onChange={e => p({ cta_text_color: e.target.value })}
                  style={{ width: 32, height: 28, padding: 2, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', background: 'none' }} />
                {sv.cta_text_color && (
                  <button type="button" onClick={() => p({ cta_text_color: '' })}
                    style={{ fontSize: 10, color: 'var(--warm-gray)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>
                    Reset
                  </button>
                )}
              </div>
              <input className="form-input" placeholder="Nota pequeña (horarios, duración…)" style={{ fontSize: 12 }} value={sv.note ?? ''} onChange={e => p({ note: e.target.value })} />
              <div style={{ fontSize: 10, color: 'var(--warm-gray)', lineHeight: 1.5, marginTop: 2 }}>
                Si dejas la URL vacía, el botón abre el calendario con horarios disponibles configurados en el venue.
              </div>
            </>
          ) : (
            <div style={{ marginTop: 2 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>Opciones del formulario</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {kinds.map((k, i) => (
                  <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', background: 'var(--surface)' }}>
                    <button type="button" onClick={() => moveKind(i, -1)} disabled={i === 0}
                      title="Subir"
                      style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: 'var(--warm-gray)', padding: 2, opacity: i === 0 ? 0.3 : 1 }}>
                      <ChevronDown size={11} style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <button type="button" onClick={() => moveKind(i, 1)} disabled={i === kinds.length - 1}
                      title="Bajar"
                      style={{ background: 'none', border: 'none', cursor: i === kinds.length - 1 ? 'default' : 'pointer', color: 'var(--warm-gray)', padding: 2, opacity: i === kinds.length - 1 ? 0.3 : 1 }}>
                      <ChevronDown size={11} />
                    </button>
                    <input className="form-input" style={{ flex: 1, fontSize: 12, padding: '4px 8px', border: 'none', background: 'transparent' }}
                      value={k.label}
                      onChange={e => updateKind(i, e.target.value)}
                      placeholder="Etiqueta de la opción" />
                    {k.id === 'visit' ? (
                      <span title="Esta opción abre el calendario para reservar visita"
                        style={{ fontSize: 9, fontWeight: 700, color: 'var(--gold)', background: 'rgba(196,151,90,.12)', padding: '2px 6px', borderRadius: 99, letterSpacing: '.04em' }}>
                        VISITA
                      </span>
                    ) : (
                      <button type="button" style={removeBtn} onClick={() => removeKind(i)} title="Eliminar opción">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" style={{ ...addBtn, marginTop: 6 }} onClick={addKind}>+ Añadir opción</button>
              <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 4, lineHeight: 1.5 }}>
                La opción <strong>Visitar el venue</strong> abre el calendario con horarios disponibles. El resto envían el formulario al inbox de Consultas.
              </div>
            </div>
          )}
        </div>
      )
    }

    return null
  }

  // ─────────────────────────────────────────────────────────────────────────────

  if (wizardStep !== null) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column' }}>
        {/* Wizard top bar */}
        <div style={{ height: 52, flexShrink: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12 }}>
          {onBack && (
            <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ gap: 5, color: 'var(--warm-gray)' }}>
              <ChevronLeft size={15} /> Plantillas
            </button>
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)' }}>
            {wizardStep === 'style' ? 'Nueva plantilla · Paso 1 de 3' : wizardStep === 'catering' ? 'Nueva plantilla · Paso 2 de 3' : 'Nueva plantilla · Paso 3 de 3'}
          </span>
        </div>

        {/* Wizard body */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>

          {wizardStep === 'style' && (
            <div style={{ maxWidth: 680, width: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: 36 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 8 }}>¿Qué diseño base quieres usar?</div>
                <div style={{ fontSize: 14, color: 'var(--warm-gray)' }}>Puedes cambiarlo en cualquier momento desde el editor</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {DEFAULT_TEMPLATES.map(tpl => {
                  const color = (tpl.sections_data as any).primary_color ?? '#2E6DB4'
                  return (
                    <button key={tpl.id} type="button"
                      onClick={() => {
                        setSections(s => ({
                          ...s,
                          visual_template_id: (tpl.sections_data as any).visual_template_id,
                          primary_color: (tpl.sections_data as any).primary_color,
                          secondary_color: (tpl.sections_data as any).secondary_color,
                          font_family: (tpl.sections_data as any).font_family,
                        }))
                        setWizardStep('catering')
                      }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10,
                        padding: '16px 16px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                        border: '2px solid var(--border)', background: 'var(--surface)',
                        transition: 'border-color .15s, box-shadow .15s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = color; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 0 3px ${color}22` }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none' }}
                    >
                      <div style={{ width: '100%', height: 40, borderRadius: 6, background: `linear-gradient(135deg, ${color}22, ${color}44)`, border: `1.5px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: color }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 3 }}>{tpl.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.4 }}>{tpl.description}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {wizardStep === 'catering' && (
            <div style={{ maxWidth: 440, width: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: 36 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 8 }}>¿Incluye menús y catering?</div>
                <div style={{ fontSize: 14, color: 'var(--warm-gray)' }}>Esto activa la pestaña de Menús en el editor. Puedes cambiarlo después.</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button type="button"
                  onClick={() => { setSections(s => ({ ...s, has_catering: true })); markDirty(); setWizardStep('modality') }}
                  style={{
                    padding: '20px 24px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    border: '2px solid var(--border)', background: 'var(--surface)',
                    display: 'flex', alignItems: 'center', gap: 16,
                  }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(196,151,90,0.12)', border: '1.5px solid rgba(196,151,90,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ChefHat size={18} style={{ color: 'var(--gold)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 3 }}>Sí, incluye menú y catering</div>
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Configura cóctel, menús principales, noche y madrugada</div>
                  </div>
                </button>
                <button type="button"
                  onClick={() => { setSections(s => ({ ...s, has_catering: false })); markDirty(); setWizardStep('modality') }}
                  style={{
                    padding: '20px 24px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    border: '2px solid var(--border)', background: 'var(--surface)',
                    display: 'flex', alignItems: 'center', gap: 16,
                  }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--cream)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <LayoutTemplate size={18} style={{ color: 'var(--warm-gray)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 3 }}>No, solo información del venue</div>
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Sin sección de menús ni selección de platos</div>
                  </div>
                </button>
              </div>
              <button type="button" onClick={() => setWizardStep('style')}
                style={{ marginTop: 20, width: '100%', padding: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <ChevronLeft size={13} /> Volver al diseño
              </button>
            </div>
          )}

          {wizardStep === 'modality' && (
            <div style={{ maxWidth: 480, width: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: 36 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 8 }}>¿Qué modalidad se usará?</div>
                <div style={{ fontSize: 14, color: 'var(--warm-gray)' }}>Se precargará al crear un dosier con esta plantilla. Puedes cambiarlo en cada dosier.</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {modalities.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--warm-gray)', textAlign: 'center', padding: '20px 0' }}>Cargando modalidades…</div>
                ) : modalities.map((m: any) => (
                  <button key={m.id} type="button"
                    onClick={() => { setSections(s => ({ ...s, default_modality_id: m.id } as any)); markDirty(); setWizardStep(null) }}
                    style={{ padding: '16px 20px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', border: '2px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(196,151,90,0.12)', border: '1.5px solid rgba(196,151,90,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>
                      ☀️
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 2 }}>{m.name}</div>
                      {m.duration_label && <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>{m.duration_label}</div>}
                    </div>
                  </button>
                ))}
                <button type="button"
                  onClick={() => { setSections(s => ({ ...s, default_modality_id: undefined } as any)); setWizardStep(null) }}
                  style={{ marginTop: 4, padding: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--warm-gray)', textAlign: 'center' }}>
                  Saltar — lo decidiré en cada dosier
                </button>
              </div>
              <button type="button" onClick={() => setWizardStep('catering')}
                style={{ marginTop: 16, width: '100%', padding: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <ChevronLeft size={13} /> Volver al catering
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

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
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--warm-gray)', cursor: 'pointer', userSelect: 'none', marginRight: 16 }}>
          <Checkbox checked={isDefault} onCheckedChange={(v) => { setIsDefault(v === true); markDirty() }} />
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

                {/* Modality selector */}
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--warm-gray)', marginBottom: 8 }}>Modalidad por defecto</div>
                <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
                  {modalities.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Sin modalidades configuradas</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {modalities.map((m: any) => {
                        const selected = (sections as any).default_modality_id === m.id
                        return (
                          <button key={m.id} type="button"
                            onClick={() => { setSections(s => ({ ...s, default_modality_id: selected ? undefined : m.id } as any)); markDirty() }}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${selected ? 'var(--gold)' : 'var(--border)'}`, background: selected ? 'rgba(196,151,90,0.08)' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                            <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selected ? 'var(--gold)' : 'var(--border)'}`, background: selected ? 'var(--gold)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {selected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>{m.name}</div>
                              {m.duration_label && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{m.duration_label}</div>}
                            </div>
                          </button>
                        )
                      })}
                      {(sections as any).default_modality_id && (
                        <button type="button" onClick={() => { setSections(s => ({ ...s, default_modality_id: undefined } as any)); markDirty() }}
                          style={{ fontSize: 11, color: 'var(--warm-gray)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', textAlign: 'left' }}>
                          × Quitar modalidad por defecto
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Section list — each row has toggle + label + expand */}
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--warm-gray)', marginBottom: 8 }}>Secciones de la propuesta</div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  {(() => {
                    const SPACE_GROUP_IDS = ['single_space', 'zones', 'space_groups', 'venue_rental']
                    const visibleSpaceSubs = SPACE_GROUP_IDS.filter(id => isSectionAllowed(id, commercialConfig?.space_type as any))
                    const isSpaceGroupOpen = openSecs.has('__space_group')
                    const activeSpaceIds = visibleSpaceSubs.filter(id => isSectionOn(id))
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
                              <span style={{ fontSize: 10, color: activeSpaceIds.length > 0 ? 'var(--gold)' : 'var(--warm-gray)', background: '#fff', padding: '1px 7px', borderRadius: 10, border: '1px solid var(--border)', fontWeight: 600 }}>{activeSpaceIds.length}/{visibleSpaceSubs.length}</span>
                            </div>
                            <div style={{ fontSize: 11, color: activeSpaceIds.length === 0 ? 'var(--warm-gray)' : '#999', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeSpaceLabel}</div>
                          </div>
                          <ChevronDown size={13} style={{ color: 'var(--warm-gray)', transform: isSpaceGroupOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0, marginTop: 2 }} />
                        </div>
                      </div>
                    )

                    return ALL_SECTION_IDS.map((secId, i) => {
                    if (['welcome_light', 'welcome_split', 'welcome_editorial'].includes(secId)) return null
                    if (!isSectionAllowed(secId, commercialConfig?.space_type as any)) return null

                    const isInSpaceGroup = SPACE_GROUP_IDS.includes(secId)
                    const isFirstSpaceVisible = isInSpaceGroup && visibleSpaceSubs[0] === secId
                    if (isInSpaceGroup && !isSpaceGroupOpen) {
                      return isFirstSpaceVisible ? renderSpaceGroupHeader() : null
                    }

                    if (secId === 'welcome') {
                      const isWelcomeOpen = openSecs.has('welcome')
                      const activeVariant = welcomeStyleConfig.variants.find(v => v.id === activeWelcomeVariantId)
                      const activeVariantLabel = welcomeGroupOn ? (activeVariant?.label ?? '—') : 'Desactivada'
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
                                <span style={{ fontSize: 10, color: welcomeGroupOn ? 'var(--gold)' : 'var(--warm-gray)', background: '#fff', padding: '1px 7px', borderRadius: 10, border: '1px solid var(--border)', fontWeight: 600 }}>Estilo: {activeVariant?.label ?? '—'}</span>
                              </div>
                              <div style={{ fontSize: 11, color: welcomeGroupOn ? '#999' : 'var(--warm-gray)', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeVariantLabel}</div>
                            </div>
                            <ChevronDown size={13} style={{ color: 'var(--warm-gray)', transform: isWelcomeOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0, marginTop: 2 }} />
                          </div>
                          {isWelcomeOpen && (
                            <div style={{ padding: '12px 14px 14px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Estilo visual</div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
                                {welcomeStyleConfig.variants.map(v => {
                                  const sel = activeWelcomeVariantId === v.id
                                  return (
                                    <button
                                      key={v.id}
                                      type="button"
                                      onClick={() => selectWelcomeVariant(v.id)}
                                      style={{
                                        textAlign: 'left',
                                        padding: '10px 12px',
                                        border: `1.5px solid ${sel ? 'var(--gold)' : 'var(--border)'}`,
                                        borderRadius: 8,
                                        background: sel ? 'rgba(196,151,90,0.08)' : '#fff',
                                        cursor: 'pointer',
                                        transition: 'all .15s',
                                        position: 'relative',
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--gold)' : 'var(--charcoal)' }}>{v.label}</span>
                                        {sel && <Check size={11} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
                                      </div>
                                      {v.description && (
                                        <div style={{ fontSize: 10, color: 'var(--warm-gray)', lineHeight: 1.4 }}>{v.description}</div>
                                      )}
                                    </button>
                                  )
                                })}
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
                      {/* Menu row — appears after inclusions when catering is enabled */}
                      {secId === 'testimonials' && hasCatering && (
                        <div style={{ borderBottom: '1px solid var(--border)', background: 'rgba(196,151,90,0.04)' }}>
                          <div
                            onClick={() => setActiveTab('menus' as any)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', transition: 'background .15s' }}
                          >
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0, opacity: .6 }} />
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--gold)', userSelect: 'none' }}>Menús y catering</span>
                            <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Ir al tab →</span>
                          </div>
                        </div>
                      )}
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
                                  <a href="/configuracion" style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Cambiar →</a>
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

                {/* Logo */}
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--warm-gray)', marginBottom: 8 }}>Logo del venue</div>
                <div style={{ marginBottom: 20 }}>
                  <ImageUploader
                    value={sections.logo_url ?? null}
                    height={88}
                    objectFit="contain"
                    label="Subir logo"
                    hint="PNG transparente recomendado"
                    alt="Logo del venue"
                    onUpload={async (f) => { await handleLogoUpload(f) }}
                    onRemove={() => { setSections(s => ({ ...s, logo_url: null })); markDirty() }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 6, lineHeight: 1.5 }}>
                    Se mostrará en la cabecera de la propuesta.
                  </div>
                </div>

                {/* Primary color */}
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--warm-gray)', marginBottom: 8 }}>Color principal</div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                    {['#2d4a7a','#7a5c3c','#6b2d42','#2a6b4a','#4a4a4a','#8b6914','#2E6DB4','#8B4513','#1a3a5c','#5c2d6b'].map(c => (
                      <div key={c} onClick={() => { setSections(s => ({ ...s, primary_color: c })); markDirty() }}
                        style={{
                          width: 24, height: 24, borderRadius: 5, background: c, cursor: 'pointer', flexShrink: 0,
                          border: (sections.primary_color ?? '#2E6DB4') === c ? '2px solid var(--espresso)' : '2px solid transparent',
                          transform: (sections.primary_color ?? '#2E6DB4') === c ? 'scale(1.2)' : 'scale(1)', transition: 'transform .1s',
                        }} />
                    ))}
                    <input type="color" value={sections.primary_color ?? '#2E6DB4'}
                      onChange={e => { setSections(s => ({ ...s, primary_color: e.target.value })); markDirty() }}
                      style={{ width: 24, height: 24, padding: 2, borderRadius: 5, border: '1px solid var(--border)', cursor: 'pointer', background: 'none' }} />
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: sections.primary_color ?? '#2E6DB4', opacity: 0.8 }} />
                </div>

                {/* Color mode — only for templates that support it (T1) */}
                {((sections.visual_template_id as number | undefined) ?? 1) === 1 && (
                  <>
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
                  </>
                )}

                {/* Sticky footer text color */}
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--warm-gray)', marginBottom: 8 }}>Color texto barra inferior</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <input type="color" value={(sections as any).sbar_text_color ?? '#ffffff'}
                    onChange={e => { setSections(s => ({ ...s, sbar_text_color: e.target.value } as any)); markDirty() }}
                    style={{ width: 24, height: 24, padding: 2, borderRadius: 5, border: '1px solid var(--border)', cursor: 'pointer', background: 'none' }} />
                  <span style={{ fontSize: 11, color: 'var(--charcoal)', fontWeight: 500 }}>Texto y botones</span>
                  <span style={{ fontSize: 10, color: 'var(--warm-gray)', marginLeft: 'auto', fontFamily: 'monospace' }}>{(sections as any).sbar_text_color ?? '#ffffff'}</span>
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
              <div style={{ padding: 0 }}>
                {/* Master menu toggle */}
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>Mostrar secciones de menú</div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>Activa o desactiva todas las secciones de menú en la propuesta</div>
                  </div>
                  <Toggle value={hasCatering} onChange={v => { setSections(s => ({ ...s, has_catering: v })); markDirty() }} />
                </div>
                {!hasCatering ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--warm-gray)' }}>
                    <ChefHat size={28} style={{ opacity: 0.3, marginBottom: 10 }} />
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Secciones de menú desactivadas</div>
                    <div style={{ fontSize: 11, lineHeight: 1.5 }}>Activa el toggle de arriba para configurar menús y catering.</div>
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
  const photo = zone.photos?.[0]
  return (
    <div style={{ width: 96 }}>
      <ImageUploader
        compact
        value={photo ?? null}
        aspectRatio={4 / 3}
        label="Foto zona"
        alt={zone.name ?? 'Zona'}
        onUpload={onUpload}
        onRemove={onRemove}
      />
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

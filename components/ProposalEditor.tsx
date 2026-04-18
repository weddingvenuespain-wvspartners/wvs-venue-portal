'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Check, X, Upload, AlertCircle, Zap, Sparkles, ClipboardList, MessageCircle, Target, Loader2, ChevronDown, ArrowLeft, Copy } from 'lucide-react'
import type { SectionsData } from '@/lib/proposal-types'
import { GOOGLE_FONTS, FONT_CATEGORIES, ALL_FONTS_URL, getFontByValue } from '@/lib/fonts'
import { useUnsavedChanges } from '@/lib/use-unsaved-changes'
import ProposalPreview from './ProposalPreview'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProposalTemplate = {
  id: string
  name: string
  sections: Array<{ id: string; enabled?: boolean }>
  accent_color: string
  font_family?: string
  is_default: boolean
}

type VenueContent = {
  video_default: any
  techspecs: any
  accommodation_info: any
  map_info: any
  chat_settings: any
  testimonials: any[]
  packages: any[]
  zones: any[]
  season_prices: any[]
  inclusions: any[]
  exclusions: any[]
  faq: any[]
  collaborators: any[]
  extra_services: any[]
  menu_prices: any[]
  experience: any | null
}

export type EditorProposal = {
  id: string
  slug: string
  couple_name: string
  guest_count: number | null
  wedding_date: string | null
  price_estimate: number | null
  personal_message: string | null
  couple_email: string | null
  show_availability: boolean
  show_price_estimate: boolean
  status: string
  lead_id: string | null
  sections_data?: SectionsData | null
  template_id?: string | null
  branding?: { logo_url: string | null; primary_color: string; font_family?: string } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLORS = ['#2d4a7a', '#7a5c3c', '#6b2d42', '#2a6b4a', '#4a4a4a', '#8b6914']

const LIBRARY_SECTIONS = ['gallery', 'packages', 'season_prices', 'inclusions', 'extra_services', 'menu_prices', 'experience', 'collaborators', 'faq', 'zones', 'hero', 'cta', 'contact']

const SECTION_LABELS: Record<string, string> = {
  hero: 'Foto principal', welcome: 'Mensaje de bienvenida', video: 'Video del venue',
  gallery: 'Galería de fotos', techspecs: 'Ficha técnica', zones: 'Zonas del venue',
  packages: 'Paquetes y precios', season_prices: 'Desglose / Temporadas',
  inclusions: 'Qué incluye', extra_services: 'Servicios adicionales',
  menu_prices: 'Catering y menú', accommodation: 'Alojamiento', experience: 'La experiencia',
  map: 'Mapa y ubicación', testimonials: 'Testimonios', collaborators: 'Colaboradores',
  faq: 'Preguntas frecuentes', chat: 'Chat en vivo', nextsteps: 'Próximos pasos',
  timeline: 'Línea de tiempo', availability: 'Disponibilidad', cta: 'Botón de reserva',
  contact: 'Datos de contacto',
}

const emptySections: SectionsData = {
  visual_template_id: 1,
  video_url: '', video_title: '',
  show_chat: false, chat_intro: '',
  show_nextsteps: false, nextsteps: [],
  show_timeline: false, timeline_intro: '', timeline: [],
  show_testimonials: false, testimonials: [],
  show_map: false, map_embed_url: '', map_address: '', map_notes: '',
  show_techspecs: false, techspecs: {},
  show_accommodation: false, accommodation: {},
  show_availability_msg: false, availability_message: '',
  sections_enabled: {},
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProposalEditor({ proposal: initial }: { proposal: EditorProposal }) {
  const router = useRouter()
  const { user } = useAuth()

  const [proposal, setProposal] = useState<EditorProposal>(initial)
  const [leads, setLeads] = useState<any[]>([])
  const [templates, setTemplates] = useState<ProposalTemplate[]>([])
  const [venueContent, setVenueContent] = useState<VenueContent>({
    video_default: null, techspecs: null, accommodation_info: null, map_info: null, chat_settings: null,
    testimonials: [], packages: [], zones: [], season_prices: [], inclusions: [], exclusions: [], faq: [], collaborators: [], extra_services: [], menu_prices: [], experience: null,
  })
  const [venue, setVenue] = useState<any>(null)

  const [form, setForm] = useState({
    lead_id: initial.lead_id ?? '',
    couple_name: initial.couple_name,
    couple_email: initial.couple_email ?? '',
    guest_count: initial.guest_count?.toString() ?? '',
    wedding_date: initial.wedding_date ?? '',
    price_estimate: initial.price_estimate?.toString() ?? '',
    personal_message: initial.personal_message ?? '',
    show_availability: initial.show_availability,
    show_price_estimate: initial.show_price_estimate,
    primary_color: initial.branding?.primary_color ?? '#2d4a7a',
    logo_url: initial.branding?.logo_url ?? null as string | null,
    font_family: initial.branding?.font_family ?? 'Georgia, serif',
    template_id: initial.template_id ?? '',
  })
  const [sections, setSections] = useState<SectionsData>({ ...emptySections, ...(initial.sections_data ?? {}) })
  const [activeTab, setActiveTab] = useState<'datos' | 'visual' | 'secciones'>('datos')
  const [openSecs, setOpenSecs] = useState<Set<string>>(new Set())

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingHero, setUploadingHero] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err: boolean } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const heroInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Snapshot del estado guardado para detectar cambios sin guardar
  const savedSnapshotRef = useRef(JSON.stringify({ form, sections }))
  const isDirty = JSON.stringify({ form, sections }) !== savedSnapshotRef.current
  const { confirmLeave } = useUnsavedChanges(isDirty)

  // Load secondary data (leads, templates, venue content) once
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    ;(async () => {
      const [{ data: leadsData }, { data: tplData }, { data: vcRows }, { data: venueRow }] = await Promise.all([
        supabase.from('leads').select('id, name, guests, email').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('proposal_web_templates').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('venue_content').select('*').eq('user_id', user.id),
        supabase.from('venue_onboarding').select('name, city, region, contact_email, contact_phone, website, photo_urls').eq('user_id', user.id).maybeSingle(),
      ])
      if (leadsData) setLeads(leadsData)
      if (tplData) setTemplates(tplData as ProposalTemplate[])
      if (venueRow) setVenue(venueRow)
      if (vcRows) {
        const rows = vcRows as any[]
        const findOne = (sec: string) => { const r = rows.find(r => r.section === sec); return r ? { ...r.data } : null }
        const findMany = (sec: string) => rows.filter(r => r.section === sec).map(r => ({ id: r.id, ...r.data }))
        setVenueContent({
          video_default: findOne('video_default'),
          techspecs: findOne('techspecs'),
          accommodation_info: findOne('accommodation_info'),
          map_info: findOne('map_info'),
          chat_settings: findOne('chat_settings'),
          experience: findOne('experience'),
          testimonials: findMany('testimonial'),
          packages: findMany('package'),
          zones: findMany('zone'),
          season_prices: findMany('season_price'),
          inclusions: findMany('inclusion'),
          exclusions: findMany('exclusion'),
          faq: findMany('faq'),
          collaborators: findMany('collaborator'),
          extra_services: findMany('extra_service'),
          menu_prices: findMany('menu_price'),
        })
      }
    })()
    if (!document.querySelector('link[data-gf-editor]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = ALL_FONTS_URL
      link.setAttribute('data-gf-editor', '1')
      document.head.appendChild(link)
    }
  }, [user])

  const notify = (msg: string, err = false) => {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 3500)
  }
  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

  // ── Apply template: pre-fill sections from venue content
  const applyTemplate = (tplId: string, vc: VenueContent) => {
    const tpl = templates.find(t => t.id === tplId) ?? templates.find(t => t.is_default)
    if (!tpl) return
    const sectionIds = (tpl.sections || []).filter((s: any) => s.enabled !== false).map((s: any) => s.id)
    const enabled: Record<string, boolean> = {}
    sectionIds.forEach(id => { enabled[id] = true })
    setSections(prev => ({
      ...prev,
      sections_enabled: enabled,
      video_url: sectionIds.includes('video') && vc.video_default?.url ? vc.video_default.url : prev.video_url,
      video_title: sectionIds.includes('video') && vc.video_default?.title ? vc.video_default.title : prev.video_title,
      show_techspecs: sectionIds.includes('techspecs') ? true : prev.show_techspecs,
      techspecs: sectionIds.includes('techspecs') && vc.techspecs ? { sqm: vc.techspecs.sqm, ceiling: vc.techspecs.ceiling, parking: vc.techspecs.parking, accessibility: vc.techspecs.accessibility, ceremony_spaces: vc.techspecs.ceremony_spaces, extra: vc.techspecs.extra } : prev.techspecs,
      show_accommodation: sectionIds.includes('accommodation') ? true : prev.show_accommodation,
      accommodation: sectionIds.includes('accommodation') && vc.accommodation_info ? { rooms: vc.accommodation_info.rooms, description: vc.accommodation_info.description, price_info: vc.accommodation_info.price_info, nearby: vc.accommodation_info.nearby } : prev.accommodation,
      show_map: sectionIds.includes('map') ? true : prev.show_map,
      map_embed_url: sectionIds.includes('map') && vc.map_info?.embed_url ? vc.map_info.embed_url : prev.map_embed_url,
      map_address: sectionIds.includes('map') && vc.map_info?.address ? vc.map_info.address : prev.map_address,
      map_notes: sectionIds.includes('map') && vc.map_info?.notes ? vc.map_info.notes : prev.map_notes,
      show_chat: sectionIds.includes('chat') ? (vc.chat_settings?.enabled ?? true) : prev.show_chat,
      chat_intro: sectionIds.includes('chat') && vc.chat_settings?.intro_text ? vc.chat_settings.intro_text : prev.chat_intro,
      show_testimonials: sectionIds.includes('testimonials') ? true : prev.show_testimonials,
      testimonials: sectionIds.includes('testimonials') && vc.testimonials?.length ? vc.testimonials.slice(0, 3).map((t: any) => ({ names: t.couple_name || '', date: t.wedding_date || '', guests: t.guests, text: t.text || '', photo_url: t.photo_url || '' })) : prev.testimonials,
    }))
    if (tpl.accent_color) setForm(f => ({ ...f, primary_color: tpl.accent_color }))
    if (tpl.font_family) setForm(f => ({ ...f, font_family: tpl.font_family! }))
  }

  // ── Upload helper
  const uploadImage = async (file: File, folder: string): Promise<string | null> => {
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${folder}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('proposal-assets').upload(path, file, { upsert: true })
    if (uploadErr) { notify(`Error al subir imagen: ${uploadErr.message}`, true); return null }
    const { data: { publicUrl } } = supabase.storage.from('proposal-assets').getPublicUrl(path)
    return publicUrl
  }

  const handleLogoUpload = async (file: File) => {
    setUploading(true)
    const url = await uploadImage(file, 'logos')
    if (url) setForm(f => ({ ...f, logo_url: url }))
    setUploading(false)
  }
  const handleHeroUpload = async (file: File) => {
    setUploadingHero(true)
    const url = await uploadImage(file, 'hero')
    if (url) setSections(s => ({ ...s, hero_image_url: url }))
    setUploadingHero(false)
  }
  const handleGalleryUpload = async (files: FileList) => {
    setUploadingGallery(true)
    const urls: string[] = []
    for (const file of Array.from(files)) {
      const url = await uploadImage(file, 'gallery')
      if (url) urls.push(url)
    }
    if (urls.length) setSections(s => ({ ...s, gallery_urls: [...(s.gallery_urls ?? []), ...urls] }))
    setUploadingGallery(false)
  }

  // ── Save
  const handleSave = async () => {
    if (!form.couple_name.trim()) { notify('El nombre de la pareja es obligatorio', true); return }
    setSaving(true)
    const supabase = createClient()

    const cleanSections: SectionsData = {
      ...sections,
      nextsteps: sections.nextsteps?.filter(x => x.title.trim()) ?? [],
      timeline: sections.timeline?.filter(x => x.time.trim() || x.title.trim()) ?? [],
      testimonials: sections.testimonials?.filter(x => x.names.trim() || x.text.trim()) ?? [],
    }

    const { couple_email: coupleEmailValue, ...corePayload } = {
      user_id: user.id,
      lead_id: form.lead_id || null,
      couple_name: form.couple_name,
      couple_email: form.couple_email || null,
      personal_message: form.personal_message || null,
      guest_count: form.guest_count ? parseInt(form.guest_count) : null,
      wedding_date: form.wedding_date || null,
      price_estimate: form.price_estimate ? parseInt(form.price_estimate) : null,
      show_availability: form.show_availability,
      show_price_estimate: form.show_price_estimate,
      sections_data: cleanSections,
      template_id: form.template_id || null,
    }

    const { error: updErr } = await supabase.from('proposals').update(corePayload).eq('id', proposal.id)
    if (updErr) { notify('Error al guardar', true); setSaving(false); return }

    if (coupleEmailValue !== undefined) {
      await supabase.from('proposals').update({ couple_email: coupleEmailValue }).eq('id', proposal.id)
    }

    const brandingPayload = {
      proposal_id: proposal.id,
      user_id: user.id,
      logo_url: form.logo_url || null,
      primary_color: form.primary_color,
      font_family: form.font_family,
    }
    const { error: bErr } = await supabase.from('proposal_branding').upsert(brandingPayload, { onConflict: 'proposal_id' })
    if (bErr && (bErr.code === '42703' || (bErr.message ?? '').includes('font_family'))) {
      const { font_family: _omit, ...baseBranding } = brandingPayload
      await supabase.from('proposal_branding').upsert(baseBranding, { onConflict: 'proposal_id' })
    }

    savedSnapshotRef.current = JSON.stringify({ form, sections })
    setProposal(p => ({ ...p, couple_name: form.couple_name, guest_count: corePayload.guest_count, wedding_date: form.wedding_date || null }))
    notify('Propuesta guardada')
    setSaving(false)
  }

  const onLeadChange = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId)
    setForm(f => ({
      ...f,
      lead_id: leadId,
      couple_name: lead ? lead.name : f.couple_name,
      couple_email: lead?.email ?? f.couple_email,
      guest_count: lead?.guests ? String(lead.guests) : f.guest_count,
    }))
  }

  const copyUrl = () => {
    const url = `${window.location.origin}/proposal/${proposal.slug}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Sections array helpers
  const addTimeline = () => setSections(s => ({ ...s, timeline: [...(s.timeline ?? []), { time: '', title: '', description: '' }] }))
  const updateTimeline = (i: number, key: string, val: string) => setSections(s => ({ ...s, timeline: (s.timeline ?? []).map((x, idx) => idx === i ? { ...x, [key]: val } : x) }))
  const removeTimeline = (i: number) => setSections(s => ({ ...s, timeline: (s.timeline ?? []).filter((_, idx) => idx !== i) }))
  const addTestimonial = () => setSections(s => ({ ...s, testimonials: [...(s.testimonials ?? []), { names: '', text: '', date: '', guests: undefined, photo_url: '' }] }))
  const updateTestimonial = (i: number, key: string, val: any) => setSections(s => ({ ...s, testimonials: (s.testimonials ?? []).map((x, idx) => idx === i ? { ...x, [key]: val } : x) }))
  const removeTestimonial = (i: number) => setSections(s => ({ ...s, testimonials: (s.testimonials ?? []).filter((_, idx) => idx !== i) }))
  const addNextstep = () => setSections(s => ({ ...s, nextsteps: [...(s.nextsteps ?? []), { title: '', description: '' }] }))
  const updateNextstep = (i: number, key: string, val: string) => setSections(s => ({ ...s, nextsteps: (s.nextsteps ?? []).map((x, idx) => idx === i ? { ...x, [key]: val } : x) }))
  const removeNextstep = (i: number) => setSections(s => ({ ...s, nextsteps: (s.nextsteps ?? []).filter((_, idx) => idx !== i) }))

  // ── Per-proposal content overrides
  const hasOverride = (key: string) => (sections as any)[key] != null
  const getOverride = (key: string) => (sections as any)[key] as any[]
  const setOverride = (key: string, val: any) => setSections((s: any) => ({ ...s, [key]: val }))
  const clearOverride = (key: string) => setSections((s: any) => { const n = { ...s }; delete n[key]; return n })
  const updateOverrideItem = (key: string, i: number, field: string, val: any) => {
    const items = [...((sections as any)[key] ?? [])]
    items[i] = { ...items[i], [field]: val }
    setOverride(key, items)
  }
  const removeOverrideItem = (key: string, i: number) => setOverride(key, ((sections as any)[key] ?? []).filter((_: any, idx: number) => idx !== i))
  const addOverrideItem = (key: string, template: any) => setOverride(key, [...((sections as any)[key] ?? []), template])
  const initOverride = (secId: string) => {
    const vc = venueContent
    const libData: Record<string, any[]> = {
      packages: vc.packages.map((p: any) => ({ name: p.name ?? '', subtitle: p.subtitle ?? '', price: p.price ?? '', description: p.description ?? '', includes: p.includes ? [...p.includes] : [] })),
      zones: vc.zones.map((z: any) => ({ name: z.name ?? '', description: z.description ?? '', capacity_min: z.capacity_min, capacity_max: z.capacity_max, price: z.price ?? '' })),
      season_prices: vc.season_prices.map((s: any) => ({ label: s.label ?? s.season ?? '', date_range: s.date_range ?? '', price_modifier: s.price_modifier ?? '', notes: s.notes ?? '' })),
      inclusions: vc.inclusions.map((x: any) => ({ title: x.title ?? '', emoji: x.emoji ?? '', description: x.description ?? '' })),
      exclusions: vc.exclusions?.map((x: any) => ({ title: x.title ?? '', description: x.description ?? '' })) ?? [],
      faq: vc.faq.map((f: any) => ({ question: f.question ?? '', answer: f.answer ?? '' })),
      collaborators: vc.collaborators.map((c: any) => ({ name: c.name ?? '', category: c.category ?? '', description: c.description ?? '', website: c.website ?? '' })),
      extra_services: vc.extra_services.map((s: any) => ({ name: s.name ?? '', price: s.price ?? '', description: s.description ?? '' })),
      menu_prices: vc.menu_prices.map((m: any) => ({ name: m.name ?? '', price_per_person: m.price_per_person ?? '', description: m.description ?? '', min_guests: m.min_guests })),
      testimonials: vc.testimonials.map((t: any) => ({ couple_name: t.couple_name ?? '', text: t.text ?? '', wedding_date: t.wedding_date ?? '', rating: t.rating })),
    }
    if (secId === 'experience') {
      const exp = vc.experience
      setOverride('experience_override', { title: exp?.title ?? '', body: exp?.body ?? '' })
      return
    }
    setOverride(`${secId}_override`, libData[secId] ?? [])
  }

  // ── Build preview patch — what the iframe sees as the live state
  const previewPatch = useMemo(() => {
    const cleanSections: SectionsData = {
      ...sections,
      nextsteps: sections.nextsteps?.filter(x => x.title.trim()) ?? [],
      timeline: sections.timeline?.filter(x => x.time.trim() || x.title.trim()) ?? [],
      testimonials: sections.testimonials?.filter(x => x.names.trim() || x.text.trim()) ?? [],
    }
    return {
      couple_name: form.couple_name,
      personal_message: form.personal_message || null,
      guest_count: form.guest_count ? parseInt(form.guest_count) : null,
      wedding_date: form.wedding_date || null,
      price_estimate: form.price_estimate ? parseInt(form.price_estimate) : null,
      show_availability: form.show_availability,
      show_price_estimate: form.show_price_estimate,
      sections_data: cleanSections,
      branding: {
        logo_url: form.logo_url || null,
        primary_color: form.primary_color,
      },
    }
  }, [form, sections])

  // ── Reusable styles
  const secLabel: React.CSSProperties = { fontSize: 11, color: 'var(--warm-gray)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }
  const addBtn: React.CSSProperties = { fontSize: 11, color: 'var(--gold)', background: 'none', border: '1px dashed var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', marginTop: 8, width: '100%' }
  const removeBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: '2px 4px', flexShrink: 0 }
  const itemCard: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: 'var(--cream)' }}>

      {/* ── LEFT PANEL: form ───────────────────────────────────────── */}
      <div style={{ width: 460, minWidth: 460, display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => confirmLeave(() => router.push('/proposals'))}
              title="Volver a propuestas"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4, display: 'inline-flex', alignItems: 'center', borderRadius: 6 }}
            >
              <ArrowLeft size={16} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {form.couple_name || 'Nueva propuesta'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                {proposal.status === 'draft' ? 'Borrador' : proposal.status === 'sent' ? 'Enviada' : proposal.status === 'viewed' ? 'Vista' : proposal.status}
                {isDirty && <span style={{ color: '#b45309', marginLeft: 6 }}>· sin guardar</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={copyUrl}
              title="Copiar URL pública"
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--warm-gray)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ flexShrink: 0, display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 14px', gap: 4 }}>
          {(['datos', 'visual', 'secciones'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--gold)' : '2px solid transparent',
                color: activeTab === tab ? 'var(--gold)' : 'var(--warm-gray)',
                textTransform: 'capitalize', letterSpacing: '0.03em',
              }}
            >
              {tab === 'datos' ? 'Datos' : tab === 'visual' ? 'Visual' : 'Secciones'}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px' }}>

          {/* ══ TAB: DATOS ══ */}
          {activeTab === 'datos' && (
            <div>
              <div style={{ ...secLabel, marginBottom: 10 }}>Datos de la pareja</div>

              {leads.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Vincular a un lead (opcional)</label>
                  <select className="form-input" value={form.lead_id} onChange={e => onLeadChange(e.target.value)}>
                    <option value="">— Sin lead —</option>
                    {leads.map(l => <option key={l.id} value={l.id}>{l.name}{l.guests ? ` · ${l.guests} inv.` : ''}</option>)}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Nombre de la pareja *</label>
                <input className="form-input" value={form.couple_name} onChange={e => setForm(f => ({ ...f, couple_name: e.target.value }))} placeholder="Ej: Laura & Carlos" />
              </div>
              <div className="form-group">
                <label className="form-label">Email de la pareja</label>
                <input className="form-input" type="email" value={form.couple_email} onChange={e => setForm(f => ({ ...f, couple_email: e.target.value }))} placeholder="laura@gmail.com" style={form.couple_email && !isValidEmail(form.couple_email) ? { borderColor: '#e53e3e' } : {}} />
                {form.couple_email && !isValidEmail(form.couple_email) && <div style={{ fontSize: 11, color: '#e53e3e', marginTop: 4 }}>Email no válido</div>}
              </div>

              <div className="two-col">
                <div className="form-group">
                  <label className="form-label">Nº invitados</label>
                  <input className="form-input" type="number" value={form.guest_count} onChange={e => setForm(f => ({ ...f, guest_count: e.target.value }))} placeholder="150" />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de boda</label>
                  <input className="form-input" type="date" value={form.wedding_date} onChange={e => setForm(f => ({ ...f, wedding_date: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Mensaje personal</label>
                <textarea className="form-textarea" style={{ minHeight: 90 }} value={form.personal_message} onChange={e => setForm(f => ({ ...f, personal_message: e.target.value }))} placeholder="Mensaje personalizado para esta pareja..." />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.show_availability} onChange={e => setForm(f => ({ ...f, show_availability: e.target.checked }))} />
                Mostrar disponibilidad
              </label>
            </div>
          )}

          {/* ══ TAB: VISUAL ══ */}
          {activeTab === 'visual' && (
            <div>
              <div style={secLabel}>Aspecto visual de la landing</div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Diseño de la landing</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                  {([
                    { id: 1, icon: <Zap size={18} />, name: 'Impacto Directo', desc: 'Dark luxury · precio visible · CTA al frente' },
                    { id: 2, icon: <Sparkles size={18} />, name: 'Emoción Primero', desc: 'Cream editorial · galería arriba · emotivo' },
                    { id: 3, icon: <ClipboardList size={18} />, name: 'Todo Claro', desc: 'Sidebar + índice · estructurado' },
                    { id: 4, icon: <MessageCircle size={18} />, name: 'Social Proof', desc: 'Stats + testimonios · confianza' },
                    { id: 5, icon: <Target size={18} />, name: 'Minimalista', desc: 'Limpio · CTA muy prominente' },
                  ] as const).map(tpl => {
                    const active = (sections.visual_template_id ?? 1) === tpl.id
                    return (
                      <button key={tpl.id} type="button" onClick={() => setSections(s => ({ ...s, visual_template_id: tpl.id }))}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                          borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                          border: `2px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                          background: active ? 'rgba(196,151,90,0.10)' : 'var(--surface)',
                        }}>
                        <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{tpl.icon}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--gold)' : 'var(--text)', marginBottom: 2 }}>{tpl.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--warm-gray)', lineHeight: 1.4 }}>{tpl.desc}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {templates.length > 0 && (
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Plantilla de propuesta</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {templates.map(t => {
                      const isActive = form.template_id === t.id
                      return (
                        <button key={t.id} type="button"
                          onClick={() => { setForm(f => ({ ...f, template_id: t.id })); applyTemplate(t.id, venueContent) }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                            borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                            border: `2px solid ${isActive ? 'var(--gold)' : 'var(--border)'}`,
                            background: isActive ? 'rgba(196,151,90,0.08)' : 'var(--surface)',
                          }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: t.accent_color || 'var(--gold)', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{t.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{(t.sections || []).filter((s: any) => s.enabled !== false).length} secciones · {t.font_family?.split(',')[0].replace(/"/g, '') || 'Georgia'}</div>
                          </div>
                          {t.is_default && <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 8 }}>Por defecto</span>}
                          {isActive && <Check size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {templates.length === 0 && (
                <div style={{ padding: '10px 14px', background: 'var(--cream)', borderRadius: 8, fontSize: 12, color: 'var(--warm-gray)', marginBottom: 16, border: '1px dashed var(--border)' }}>
                  No tienes plantillas aún. <a href="/comunicacion" target="_blank" style={{ color: 'var(--gold)' }}>Crea una en Comunicación →</a>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Color principal</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map(c => (
                    <div key={c} onClick={() => setForm(f => ({ ...f, primary_color: c }))}
                      style={{
                        width: 26, height: 26, borderRadius: 6, background: c, cursor: 'pointer',
                        border: form.primary_color === c ? '2px solid #C4975A' : '2px solid transparent',
                        transform: form.primary_color === c ? 'scale(1.15)' : 'scale(1)',
                      }} />
                  ))}
                  <input type="color" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                    style={{ width: 26, height: 26, padding: 2, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: 'none' }} />
                </div>
                <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: form.primary_color, opacity: 0.85 }} />
              </div>

              <div className="form-group">
                <label className="form-label">Logo del venue</label>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
                {form.logo_url && (
                  <div style={{ marginBottom: 8, position: 'relative', display: 'inline-block' }}>
                    <img src={form.logo_url} alt="logo" style={{ height: 64, maxWidth: 180, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', background: '#f8f7f4', padding: '6px 10px', display: 'block' }} />
                    <button onClick={() => setForm(f => ({ ...f, logo_url: null }))} title="Eliminar logo"
                      style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={11} style={{ color: '#fff' }} />
                    </button>
                  </div>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ width: '100%', justifyContent: 'center' }}>
                  <Upload size={12} /> {uploading ? 'Subiendo...' : form.logo_url ? 'Cambiar logo' : 'Subir logo'}
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Tipografía — {getFontByValue(form.font_family)?.label ?? 'Georgia'}</label>
                <div style={{ padding: '8px 12px', background: 'var(--cream)', borderRadius: 8, marginBottom: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: form.font_family, fontSize: 16, color: 'var(--text)' }}>Aa — {form.couple_name || 'Laura & Carlos'}</span>
                </div>
                <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {FONT_CATEGORIES.map(cat => (
                    <div key={cat.key}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{cat.label}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {GOOGLE_FONTS.filter(f => f.category === cat.key).map(opt => {
                          const isActive = form.font_family === opt.value
                          return (
                            <button key={opt.value} type="button" onClick={() => setForm(f => ({ ...f, font_family: opt.value }))}
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
            </div>
          )}

          {/* ══ TAB: SECCIONES ══ */}
          {activeTab === 'secciones' && (() => {
            const tpl = templates.find(t => t.id === form.template_id) ?? templates.find(t => t.is_default)
            const tplSections = tpl ? (tpl.sections || []).filter((s: any) => s.enabled !== false).map((s: any) => s.id) : []
            const toggleSec = (id: string, val: boolean) => setSections(s => ({ ...s, sections_enabled: { ...(s.sections_enabled ?? {}), [id]: val } }))
            const isSectionOn = (id: string) => {
              const e = sections.sections_enabled
              return e ? (e[id] !== false) : true
            }
            const chipStyle: React.CSSProperties = { fontSize: 11, color: 'var(--charcoal)', background: '#fff', border: '1px solid var(--ivory)', borderRadius: 6, padding: '3px 9px' }
            const emptyHint = (msg: string) => <div style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic' }}>{msg}</div>
            const customizeBtn = (secId: string) => (
              <div style={{ marginTop: 8 }}>
                <button type="button" onClick={() => initOverride(secId)} style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: '1px dashed var(--gold)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                  Personalizar para esta pareja →
                </button>
              </div>
            )
            const restoreBtn = (key: string) => (
              <button type="button" onClick={() => clearOverride(key)} style={{ fontSize: 11, color: 'var(--warm-gray)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 6 }}>
                ← Usar contenido de la biblioteca
              </button>
            )
            const overrideBadge = <div style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.04em' }}>✦ PERSONALIZADO PARA ESTA PAREJA</div>

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {tplSections.length === 0 && (
                  <div style={{ padding: '16px', background: 'var(--cream)', borderRadius: 8, fontSize: 13, color: 'var(--warm-gray)', border: '1px dashed var(--border)' }}>
                    Ve a la pestaña <strong>Visual</strong> y selecciona una plantilla para ver las secciones disponibles.
                  </div>
                )}

                {tplSections.map(secId => {
                  const label = SECTION_LABELS[secId] || secId
                  const isOn = isSectionOn(secId)
                  const isLibrary = LIBRARY_SECTIONS.includes(secId)
                  const isOpen = openSecs.has(secId)
                  const overrideKey = `${secId}_override`
                  const vc = venueContent

                  return (
                    <div key={secId} className="sec-row" style={{ opacity: isOn ? 1 : 0.55 }}>
                      <div className="sec-header" onClick={() => setOpenSecs(s => { const n = new Set(s); n.has(secId) ? n.delete(secId) : n.add(secId); return n })}>
                        <div onClick={e => { e.stopPropagation(); toggleSec(secId, !isOn) }}
                          style={{ width: 34, height: 19, borderRadius: 10, background: isOn ? 'var(--gold)' : '#d1c9b8', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
                          <div style={{ position: 'absolute', top: 2, left: isOn ? 15 : 2, width: 15, height: 15, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)', flex: 1, userSelect: 'none' }}>{label}</span>
                        <ChevronDown size={14} style={{ color: 'var(--warm-gray)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
                      </div>

                      {isOpen && isOn && isLibrary && (
                        <div className="sec-open-content" style={{ padding: '12px 14px 14px' }}>
                          {secId === 'hero' && (
                            <div>
                              <input ref={heroInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleHeroUpload(e.target.files[0])} />
                              {sections.hero_image_url && (
                                <div style={{ marginBottom: 8, position: 'relative', display: 'inline-block' }}>
                                  <img src={sections.hero_image_url} alt="hero" style={{ width: '100%', maxWidth: 340, height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
                                  <button onClick={() => setSections(s => ({ ...s, hero_image_url: undefined }))} title="Eliminar imagen"
                                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={11} style={{ color: '#fff' }} />
                                  </button>
                                </div>
                              )}
                              <button className="btn btn-ghost btn-sm" onClick={() => heroInputRef.current?.click()} disabled={uploadingHero} style={{ width: '100%', justifyContent: 'center' }}>
                                <Upload size={12} /> {uploadingHero ? 'Subiendo...' : sections.hero_image_url ? 'Cambiar imagen' : 'Subir foto principal'}
                              </button>
                            </div>
                          )}
                          {secId === 'gallery' && (
                            <div>
                              <input ref={galleryInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => e.target.files?.length && handleGalleryUpload(e.target.files)} />
                              {(sections.gallery_urls ?? []).length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                  {(sections.gallery_urls ?? []).map((url, i) => (
                                    <div key={i} style={{ position: 'relative' }}>
                                      <img src={url} alt="" style={{ width: 72, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />
                                      <button onClick={() => setSections(s => ({ ...s, gallery_urls: (s.gallery_urls ?? []).filter((_, idx) => idx !== i) }))}
                                        style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <X size={9} style={{ color: '#fff' }} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <button className="btn btn-ghost btn-sm" onClick={() => galleryInputRef.current?.click()} disabled={uploadingGallery} style={{ width: '100%', justifyContent: 'center' }}>
                                <Upload size={12} /> {uploadingGallery ? 'Subiendo...' : 'Añadir fotos'}
                              </button>
                            </div>
                          )}
                          {secId === 'cta' && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Botón de reserva al final de la propuesta</div>}
                          {secId === 'contact' && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Datos de contacto del venue</div>}

                          {/* PACKAGES */}
                          {secId === 'packages' && (hasOverride(overrideKey) ? (
                            <div>
                              {overrideBadge}
                              {(getOverride(overrideKey) ?? []).map((pkg: any, i: number) => (
                                <div key={i} style={itemCard}>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <input className="form-input" placeholder="Nombre *" value={pkg.name ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'name', e.target.value)} />
                                    <input className="form-input" style={{ width: 100, flexShrink: 0 }} placeholder="Precio" value={pkg.price ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'price', e.target.value)} />
                                    <button type="button" style={removeBtn} onClick={() => removeOverrideItem(overrideKey, i)}><X size={13} /></button>
                                  </div>
                                  <input className="form-input" placeholder="Subtítulo" value={pkg.subtitle ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'subtitle', e.target.value)} />
                                  <textarea className="form-textarea" style={{ minHeight: 50 }} placeholder="Descripción" value={pkg.description ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'description', e.target.value)} />
                                </div>
                              ))}
                              <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { name: '', price: '', subtitle: '', description: '', includes: [] })}>+ Añadir paquete</button>
                              {restoreBtn(overrideKey)}
                            </div>
                          ) : (
                            <div>
                              {vc.packages.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{vc.packages.map((p: any, i: number) => <span key={i} style={chipStyle}>{p.name}{p.price ? ` · ${p.price}` : ''}</span>)}</div> : emptyHint('Sin paquetes en biblioteca')}
                              {customizeBtn(secId)}
                            </div>
                          ))}

                          {/* ZONES */}
                          {secId === 'zones' && (hasOverride(overrideKey) ? (
                            <div>
                              {overrideBadge}
                              {(getOverride(overrideKey) ?? []).map((z: any, i: number) => (
                                <div key={i} style={itemCard}>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <input className="form-input" placeholder="Nombre *" value={z.name ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'name', e.target.value)} />
                                    <input className="form-input" style={{ width: 80, flexShrink: 0 }} type="number" placeholder="Min" value={z.capacity_min ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'capacity_min', e.target.value ? Number(e.target.value) : undefined)} />
                                    <input className="form-input" style={{ width: 80, flexShrink: 0 }} type="number" placeholder="Max" value={z.capacity_max ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'capacity_max', e.target.value ? Number(e.target.value) : undefined)} />
                                    <button type="button" style={removeBtn} onClick={() => removeOverrideItem(overrideKey, i)}><X size={13} /></button>
                                  </div>
                                  <input className="form-input" placeholder="Descripción" value={z.description ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'description', e.target.value)} />
                                </div>
                              ))}
                              <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { name: '', description: '', price: '' })}>+ Añadir zona</button>
                              {restoreBtn(overrideKey)}
                            </div>
                          ) : (
                            <div>
                              {vc.zones.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{vc.zones.map((z: any, i: number) => <span key={i} style={chipStyle}>{z.name}{z.capacity_max ? ` · hasta ${z.capacity_max} inv.` : ''}</span>)}</div> : emptyHint('Sin zonas en biblioteca')}
                              {customizeBtn(secId)}
                            </div>
                          ))}

                          {/* INCLUSIONS */}
                          {secId === 'inclusions' && (hasOverride(overrideKey) ? (
                            <div>
                              {overrideBadge}
                              {(getOverride(overrideKey) ?? []).map((x: any, i: number) => (
                                <div key={i} style={{ ...itemCard, flexDirection: 'row', alignItems: 'center' }}>
                                  <input className="form-input" style={{ width: 44, flexShrink: 0 }} placeholder="✓" value={x.emoji ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'emoji', e.target.value)} />
                                  <input className="form-input" placeholder="Título *" value={x.title ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'title', e.target.value)} />
                                  <input className="form-input" placeholder="Descripción" value={x.description ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'description', e.target.value)} />
                                  <button type="button" style={removeBtn} onClick={() => removeOverrideItem(overrideKey, i)}><X size={13} /></button>
                                </div>
                              ))}
                              <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { title: '', emoji: '', description: '' })}>+ Añadir inclusión</button>
                              {restoreBtn(overrideKey)}
                            </div>
                          ) : (
                            <div>
                              {vc.inclusions.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{vc.inclusions.map((x: any, i: number) => <span key={i} style={chipStyle}>{x.emoji || '✓'} {x.title}</span>)}</div> : emptyHint('Sin inclusiones en biblioteca')}
                              {customizeBtn(secId)}
                            </div>
                          ))}

                          {/* FAQ */}
                          {secId === 'faq' && (hasOverride(overrideKey) ? (
                            <div>
                              {overrideBadge}
                              {(getOverride(overrideKey) ?? []).map((f: any, i: number) => (
                                <div key={i} style={itemCard}>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <input className="form-input" placeholder="Pregunta *" value={f.question ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'question', e.target.value)} />
                                    <button type="button" style={removeBtn} onClick={() => removeOverrideItem(overrideKey, i)}><X size={13} /></button>
                                  </div>
                                  <textarea className="form-textarea" style={{ minHeight: 60 }} placeholder="Respuesta *" value={f.answer ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'answer', e.target.value)} />
                                </div>
                              ))}
                              <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { question: '', answer: '' })}>+ Añadir pregunta</button>
                              {restoreBtn(overrideKey)}
                            </div>
                          ) : (
                            <div>
                              {vc.faq.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{vc.faq.slice(0, 4).map((f: any, i: number) => <span key={i} style={chipStyle}>{f.question}</span>)}{vc.faq.length > 4 && <span style={{ ...chipStyle, background: 'var(--cream)' }}>+{vc.faq.length - 4} más</span>}</div> : emptyHint('Sin FAQs en biblioteca')}
                              {customizeBtn(secId)}
                            </div>
                          ))}

                          {/* MENU PRICES */}
                          {secId === 'menu_prices' && (hasOverride(overrideKey) ? (
                            <div>
                              {overrideBadge}
                              {(getOverride(overrideKey) ?? []).map((m: any, i: number) => (
                                <div key={i} style={itemCard}>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <input className="form-input" placeholder="Nombre *" value={m.name ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'name', e.target.value)} />
                                    <input className="form-input" style={{ width: 110, flexShrink: 0 }} placeholder="Precio/p. *" value={m.price_per_person ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'price_per_person', e.target.value)} />
                                    <button type="button" style={removeBtn} onClick={() => removeOverrideItem(overrideKey, i)}><X size={13} /></button>
                                  </div>
                                  <input className="form-input" placeholder="Descripción" value={m.description ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'description', e.target.value)} />
                                </div>
                              ))}
                              <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { name: '', price_per_person: '', description: '' })}>+ Añadir menú</button>
                              {restoreBtn(overrideKey)}
                            </div>
                          ) : (
                            <div>
                              {vc.menu_prices.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{vc.menu_prices.map((m: any, i: number) => <span key={i} style={chipStyle}>{m.name}{m.price_per_person ? ` · ${m.price_per_person}/p.` : ''}</span>)}</div> : emptyHint('Sin menús en biblioteca')}
                              {customizeBtn(secId)}
                            </div>
                          ))}

                          {/* EXTRA SERVICES */}
                          {secId === 'extra_services' && (hasOverride(overrideKey) ? (
                            <div>
                              {overrideBadge}
                              {(getOverride(overrideKey) ?? []).map((s: any, i: number) => (
                                <div key={i} style={{ ...itemCard, flexDirection: 'row', alignItems: 'center' }}>
                                  <input className="form-input" placeholder="Nombre *" value={s.name ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'name', e.target.value)} />
                                  <input className="form-input" style={{ width: 100, flexShrink: 0 }} placeholder="Precio" value={s.price ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'price', e.target.value)} />
                                  <input className="form-input" placeholder="Descripción" value={s.description ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'description', e.target.value)} />
                                  <button type="button" style={removeBtn} onClick={() => removeOverrideItem(overrideKey, i)}><X size={13} /></button>
                                </div>
                              ))}
                              <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { name: '', price: '', description: '' })}>+ Añadir servicio</button>
                              {restoreBtn(overrideKey)}
                            </div>
                          ) : (
                            <div>
                              {vc.extra_services.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{vc.extra_services.map((x: any, i: number) => <span key={i} style={chipStyle}>{x.name}{x.price ? ` · ${x.price}` : ''}</span>)}</div> : emptyHint('Sin servicios en biblioteca')}
                              {customizeBtn(secId)}
                            </div>
                          ))}

                          {/* SEASON PRICES */}
                          {secId === 'season_prices' && (hasOverride(overrideKey) ? (
                            <div>
                              {overrideBadge}
                              {(getOverride(overrideKey) ?? []).map((s: any, i: number) => (
                                <div key={i} style={itemCard}>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <input className="form-input" placeholder="Etiqueta *" value={s.label ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'label', e.target.value)} />
                                    <input className="form-input" style={{ width: 110, flexShrink: 0 }} placeholder="Modificador" value={s.price_modifier ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'price_modifier', e.target.value)} />
                                    <button type="button" style={removeBtn} onClick={() => removeOverrideItem(overrideKey, i)}><X size={13} /></button>
                                  </div>
                                  <input className="form-input" placeholder="Rango fechas" value={s.date_range ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'date_range', e.target.value)} />
                                </div>
                              ))}
                              <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { label: '', price_modifier: '', date_range: '' })}>+ Añadir temporada</button>
                              {restoreBtn(overrideKey)}
                            </div>
                          ) : (
                            <div>
                              {vc.season_prices.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{vc.season_prices.map((s: any, i: number) => <span key={i} style={chipStyle}>{s.label || s.season}{s.price_modifier ? ` · ${s.price_modifier}` : ''}</span>)}</div> : emptyHint('Sin temporadas en biblioteca')}
                              {customizeBtn(secId)}
                            </div>
                          ))}

                          {/* COLLABORATORS */}
                          {secId === 'collaborators' && (hasOverride(overrideKey) ? (
                            <div>
                              {overrideBadge}
                              {(getOverride(overrideKey) ?? []).map((c: any, i: number) => (
                                <div key={i} style={itemCard}>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <input className="form-input" placeholder="Nombre *" value={c.name ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'name', e.target.value)} />
                                    <input className="form-input" style={{ width: 120, flexShrink: 0 }} placeholder="Categoría" value={c.category ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'category', e.target.value)} />
                                    <button type="button" style={removeBtn} onClick={() => removeOverrideItem(overrideKey, i)}><X size={13} /></button>
                                  </div>
                                  <input className="form-input" placeholder="Descripción" value={c.description ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'description', e.target.value)} />
                                  <input className="form-input" placeholder="Web" value={c.website ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'website', e.target.value)} />
                                </div>
                              ))}
                              <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { name: '', category: '', description: '', website: '' })}>+ Añadir colaborador</button>
                              {restoreBtn(overrideKey)}
                            </div>
                          ) : (
                            <div>
                              {vc.collaborators.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{vc.collaborators.map((c: any, i: number) => <span key={i} style={chipStyle}>{c.name}{c.category ? ` · ${c.category}` : ''}</span>)}</div> : emptyHint('Sin colaboradores en biblioteca')}
                              {customizeBtn(secId)}
                            </div>
                          ))}

                          {/* EXPERIENCE */}
                          {secId === 'experience' && (hasOverride('experience_override') ? (
                            <div>
                              {overrideBadge}
                              <input className="form-input" placeholder="Título" value={(sections as any).experience_override?.title ?? ''} onChange={e => setOverride('experience_override', { ...((sections as any).experience_override ?? {}), title: e.target.value })} style={{ marginBottom: 6 }} />
                              <textarea className="form-textarea" style={{ minHeight: 100 }} placeholder="Descripción..." value={(sections as any).experience_override?.body ?? ''} onChange={e => setOverride('experience_override', { ...((sections as any).experience_override ?? {}), body: e.target.value })} />
                              {restoreBtn('experience_override')}
                            </div>
                          ) : (
                            <div>
                              {vc.experience?.body ? <div style={{ fontSize: 11, color: 'var(--charcoal)', fontStyle: 'italic', lineHeight: 1.5 }}>"{(vc.experience.body).slice(0, 100)}…"</div> : emptyHint('Sin texto de experiencia en biblioteca')}
                              {customizeBtn(secId)}
                            </div>
                          ))}

                          {/* TESTIMONIALS override */}
                          {secId === 'testimonials' && (hasOverride(overrideKey) ? (
                            <div>
                              {overrideBadge}
                              {(getOverride(overrideKey) ?? []).map((t: any, i: number) => (
                                <div key={i} style={itemCard}>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <input className="form-input" placeholder="Nombres pareja" value={t.couple_name ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'couple_name', e.target.value)} />
                                    <input className="form-input" style={{ width: 110, flexShrink: 0 }} type="date" value={t.wedding_date ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'wedding_date', e.target.value)} />
                                    <button type="button" style={removeBtn} onClick={() => removeOverrideItem(overrideKey, i)}><X size={13} /></button>
                                  </div>
                                  <textarea className="form-textarea" style={{ minHeight: 60 }} placeholder="Testimonio..." value={t.text ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'text', e.target.value)} />
                                </div>
                              ))}
                              <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { couple_name: '', text: '', wedding_date: '', rating: 5 })}>+ Añadir testimonio</button>
                              {restoreBtn(overrideKey)}
                            </div>
                          ) : (
                            <div>
                              {vc.testimonials.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{vc.testimonials.slice(0, 3).map((t: any, i: number) => <span key={i} style={chipStyle}>{t.couple_name}</span>)}{vc.testimonials.length > 3 && <span style={{ ...chipStyle, background: 'var(--cream)' }}>+{vc.testimonials.length - 3} más</span>}</div> : emptyHint('Sin testimonios en biblioteca')}
                              {customizeBtn(secId)}
                            </div>
                          ))}
                        </div>
                      )}

                      {!isLibrary && isOpen && isOn && (
                        <div className="sec-open-content" style={{ padding: '12px 14px 14px' }}>
                          {secId === 'video' && (
                            <>
                              <div className="form-group">
                                <label className="form-label">URL del vídeo</label>
                                <input className="form-input" value={sections.video_url ?? ''} onChange={e => setSections(s => ({ ...s, video_url: e.target.value }))} placeholder="https://www.youtube.com/watch?v=..." />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Título</label>
                                <input className="form-input" value={sections.video_title ?? ''} onChange={e => setSections(s => ({ ...s, video_title: e.target.value }))} placeholder="Conoce nuestro venue" />
                              </div>
                            </>
                          )}
                          {secId === 'welcome' && (
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Mensaje de bienvenida</label>
                              <textarea className="form-textarea" style={{ minHeight: 80 }} value={form.personal_message ?? ''} onChange={e => setForm(f => ({ ...f, personal_message: e.target.value }))} />
                            </div>
                          )}
                          {secId === 'techspecs' && (
                            <>
                              {([['sqm', 'Superficie (m²)', '800 m²'], ['ceiling', 'Altura techo', '6 m'], ['parking', 'Parking', '200 plazas'], ['accessibility', 'Accesibilidad', 'Acceso silla de ruedas'], ['ceremony_spaces', 'Espacios ceremonia', 'Jardín, capilla'], ['extra', 'Otros datos', '']] as [string, string, string][]).map(([key, lbl, ph]) => (
                                <div className="form-group" key={key}>
                                  <label className="form-label">{lbl}</label>
                                  <input className="form-input" value={(sections.techspecs as any)?.[key] ?? ''} onChange={e => setSections(s => ({ ...s, techspecs: { ...(s.techspecs ?? {}), [key]: e.target.value } }))} placeholder={ph} />
                                </div>
                              ))}
                            </>
                          )}
                          {secId === 'accommodation' && (
                            <>
                              {([['rooms', 'Habitaciones', '20 habitaciones'], ['description', 'Descripción', ''], ['price_info', 'Info de precio', 'Desde 120€/noche'], ['nearby', 'Alojamiento cercano', '']] as [string, string, string][]).map(([key, lbl, ph]) => (
                                <div className="form-group" key={key}>
                                  <label className="form-label">{lbl}</label>
                                  <input className="form-input" value={(sections.accommodation as any)?.[key] ?? ''} onChange={e => setSections(s => ({ ...s, accommodation: { ...(s.accommodation ?? {}), [key]: e.target.value } }))} placeholder={ph} />
                                </div>
                              ))}
                            </>
                          )}
                          {secId === 'map' && (
                            <>
                              <div className="form-group">
                                <label className="form-label">URL embed del mapa</label>
                                <input className="form-input" value={sections.map_embed_url ?? ''} onChange={e => setSections(s => ({ ...s, map_embed_url: e.target.value }))} placeholder="https://maps.google.com/..." />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Dirección</label>
                                <input className="form-input" value={sections.map_address ?? ''} onChange={e => setSections(s => ({ ...s, map_address: e.target.value }))} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Notas</label>
                                <input className="form-input" value={sections.map_notes ?? ''} onChange={e => setSections(s => ({ ...s, map_notes: e.target.value }))} />
                              </div>
                            </>
                          )}
                          {secId === 'testimonials' && (
                            <div>
                              {(sections.testimonials ?? []).map((item, i) => (
                                <div key={i} style={itemCard}>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <input className="form-input" value={item.names} onChange={e => updateTestimonial(i, 'names', e.target.value)} placeholder="Nombre pareja" />
                                    <input className="form-input" style={{ width: 110, flexShrink: 0 }} type="date" value={item.date ?? ''} onChange={e => updateTestimonial(i, 'date', e.target.value)} />
                                    <button style={removeBtn} onClick={() => removeTestimonial(i)}><X size={13} /></button>
                                  </div>
                                  <textarea className="form-textarea" style={{ minHeight: 60 }} value={item.text} onChange={e => updateTestimonial(i, 'text', e.target.value)} placeholder="Testimonio..." />
                                </div>
                              ))}
                              <button style={addBtn} onClick={addTestimonial}>+ Añadir testimonio</button>
                            </div>
                          )}
                          {secId === 'chat' && (
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Texto introductorio</label>
                              <input className="form-input" value={sections.chat_intro ?? ''} onChange={e => setSections(s => ({ ...s, chat_intro: e.target.value }))} placeholder="¿Tienes alguna pregunta?..." />
                            </div>
                          )}
                          {secId === 'nextsteps' && (
                            <div>
                              {(sections.nextsteps ?? []).map((item, i) => (
                                <div key={i} style={itemCard}>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                                    <input className="form-input" value={item.title} onChange={e => updateNextstep(i, 'title', e.target.value)} placeholder="Título" />
                                    <button style={removeBtn} onClick={() => removeNextstep(i)}><X size={13} /></button>
                                  </div>
                                  <input className="form-input" value={item.description} onChange={e => updateNextstep(i, 'description', e.target.value)} placeholder="Descripción" />
                                </div>
                              ))}
                              <button style={addBtn} onClick={addNextstep}>+ Añadir paso</button>
                            </div>
                          )}
                          {secId === 'timeline' && (
                            <div>
                              <div className="form-group">
                                <label className="form-label">Introducción</label>
                                <input className="form-input" value={sections.timeline_intro ?? ''} onChange={e => setSections(s => ({ ...s, timeline_intro: e.target.value }))} />
                              </div>
                              {(sections.timeline ?? []).map((item, i) => (
                                <div key={i} style={itemCard}>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <input className="form-input" style={{ width: 80, flexShrink: 0 }} value={item.time} onChange={e => updateTimeline(i, 'time', e.target.value)} placeholder="12:00" />
                                    <input className="form-input" value={item.title} onChange={e => updateTimeline(i, 'title', e.target.value)} placeholder="Momento" />
                                    <button style={removeBtn} onClick={() => removeTimeline(i)}><X size={13} /></button>
                                  </div>
                                  <input className="form-input" value={item.description ?? ''} onChange={e => updateTimeline(i, 'description', e.target.value)} placeholder="Descripción" />
                                </div>
                              ))}
                              <button style={addBtn} onClick={addTimeline}>+ Añadir momento</button>
                            </div>
                          )}
                          {secId === 'availability' && (
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Mensaje</label>
                              <textarea className="form-textarea" style={{ minHeight: 70 }} value={sections.availability_message ?? ''} onChange={e => setSections(s => ({ ...s, availability_message: e.target.value }))} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* Footer save */}
        <div style={{ flexShrink: 0, padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || uploading || !isDirty}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {saving ? 'Guardando…' : isDirty ? 'Guardar cambios' : 'Guardado'}
          </button>
        </div>
      </div>

      {/* ── RIGHT PANEL: preview ──────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, height: '100vh' }}>
        <ProposalPreview slug={proposal.slug} patch={previewPatch} />
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: toast.err ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${toast.err ? '#fca5a5' : '#86efac'}`,
          color: toast.err ? '#991b1b' : '#15803d',
          padding: '12px 16px', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,.13)',
          fontSize: 13, maxWidth: 380, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {toast.err ? <AlertCircle size={15} /> : <Check size={15} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  )
}

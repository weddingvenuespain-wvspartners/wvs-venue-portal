'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Plus, Copy, ExternalLink, X, Check, Eye, Send, Palette, Upload, Trash2, AlertCircle, Lock } from 'lucide-react'
import type { SectionsData } from '@/lib/proposal-types'
import { GOOGLE_FONTS, FONT_CATEGORIES, ALL_FONTS_URL, getFontByValue } from '@/lib/fonts'
import { usePlanFeatures } from '@/lib/use-plan-features'

const MAX_PROPOSALS_PER_LEAD = 6

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

type Proposal = {
  id: string
  slug: string
  couple_name: string
  guest_count: number | null
  wedding_date: string | null
  price_estimate: number | null
  personal_message: string | null
  show_availability: boolean
  show_price_estimate: boolean
  status: 'draft' | 'sent' | 'viewed' | 'expired'
  views: number
  lead_id: string | null
  created_at: string
  sections_data?: SectionsData | null
  // join
  branding?: ProposalBranding | null
}

type ProposalBranding = {
  id?: string
  proposal_id: string
  user_id: string
  logo_url: string | null
  primary_color: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSlug(name: string) {
  const base = name.toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
  const rand = Math.random().toString(36).slice(2, 6)
  return `${base}-${rand}`
}

const S_BADGE: Record<string, string> = {
  draft:   'badge-inactive',
  sent:    'badge-contacted',
  viewed:  'badge-active',
  expired: 'badge-pending',
}
const S_LABEL: Record<string, string> = {
  draft:   'Borrador',
  sent:    'Enviada',
  viewed:  'Vista',
  expired: 'Expirada',
}

const PRESET_COLORS = [
  '#2d4a7a', '#7a5c3c', '#6b2d42',
  '#2a6b4a', '#4a4a4a', '#8b6914',
]


const emptyForm = {
  lead_id:              '',
  couple_name:          '',
  guest_count:          '',
  wedding_date:         '',
  price_estimate:       '',
  personal_message:     '',
  show_availability:    true,
  show_price_estimate:  true,
  // branding
  primary_color:        '#2d4a7a',
  logo_url:             '' as string | null,
  font_family:          'Georgia, serif',
  // template
  template_id:          '' as string,
}

const emptySections: SectionsData = {
  visual_template_id:   1,
  video_url:            '',
  video_title:          '',
  show_chat:            false,
  chat_intro:           '',
  show_nextsteps:       false,
  nextsteps:            [],
  show_timeline:        false,
  timeline_intro:       '',
  timeline:             [],
  show_testimonials:    false,
  testimonials:         [],
  show_map:             false,
  map_embed_url:        '',
  map_address:          '',
  map_notes:            '',
  show_techspecs:       false,
  techspecs:            {},
  show_accommodation:   false,
  accommodation:        {},
  show_availability_msg: false,
  availability_message: '',
  sections_enabled:     {},
}

// Sections that pull from the venue content library (no per-proposal editing)
const LIBRARY_SECTIONS = ['gallery', 'packages', 'season_prices', 'inclusions', 'extra_services', 'menu_prices', 'experience', 'collaborators', 'faq', 'zones', 'hero', 'cta', 'contact']

// Section labels for display
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

// ─── Componente principal ─────────────────────────────────────────────────────

function PropuestasPageContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const features = usePlanFeatures()

  const [proposals,    setProposals]    = useState<Proposal[]>([])
  const [leads,        setLeads]        = useState<any[]>([])
  const [templates,    setTemplates]    = useState<ProposalTemplate[]>([])
  const [venueContent, setVenueContent] = useState<VenueContent>({ video_default: null, techspecs: null, accommodation_info: null, map_info: null, chat_settings: null, testimonials: [], packages: [], zones: [], season_prices: [], inclusions: [], exclusions: [], faq: [], collaborators: [], extra_services: [], menu_prices: [], experience: null })
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [form,         setForm]         = useState({ ...emptyForm })
  const [sections,     setSections]     = useState<SectionsData>(emptySections)
  const [activeTab,    setActiveTab]    = useState<'datos' | 'visual' | 'secciones'>('datos')
  const [saving,      setSaving]      = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [copied,      setCopied]      = useState<string | null>(null)
  const [success,     setSuccess]     = useState('')
  const [error,       setError]       = useState('')
  const [limitWarn,   setLimitWarn]   = useState('')
  const fileInputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    load()
    // Load all Google Fonts for the font picker preview
    if (!document.querySelector('link[data-gf-editor]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = ALL_FONTS_URL
      link.setAttribute('data-gf-editor', '1')
      document.head.appendChild(link)
    }
  }, [user, authLoading])

  // Auto-open form when coming from leads page with ?lead_id=xxx&create=1
  useEffect(() => {
    if (loading) return
    const urlLeadId = searchParams.get('lead_id')
    const autoCreate = searchParams.get('create') === '1'
    if (!urlLeadId || !autoCreate) return

    const existingCount = proposals.filter(p => p.lead_id === urlLeadId).length
    if (existingCount >= MAX_PROPOSALS_PER_LEAD) {
      setLimitWarn(`Este lead ya tiene ${existingCount} propuesta${existingCount !== 1 ? 's' : ''} (máximo ${MAX_PROPOSALS_PER_LEAD}). Edita una existente o elimínala para crear una nueva.`)
      return
    }
    onLeadChange(urlLeadId)
    setEditingId(null)
    setSections(emptySections)
    setActiveTab('datos')
    setShowForm(true)
  }, [loading, searchParams])

  // Auto-apply default template when opening a new proposal form
  useEffect(() => {
    if (!showForm || editingId || templates.length === 0) return
    const def = templates.find(t => t.is_default) ?? templates[0]
    if (!def) return
    setForm(f => ({ ...f, template_id: def.id }))
    applyTemplate(def.id, venueContent)
  }, [showForm, templates])

  // ── Carga propuestas + leads + plantillas + contenido venue
  const load = async () => {
    const supabase = createClient()
    const [{ data: props }, { data: leadsData }, { data: tplData }, { data: vcRows }] = await Promise.all([
      supabase.from('proposals').select('*, branding:proposal_branding(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('leads').select('id, name, guests').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('proposal_web_templates').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('venue_content').select('*').eq('user_id', user.id),
    ])
    if (props)     setProposals(props as Proposal[])
    if (leadsData) setLeads(leadsData)
    if (tplData)   setTemplates(tplData as ProposalTemplate[])
    if (vcRows) {
      const rows = vcRows as any[]
      const findOne = (sec: string) => { const r = rows.find(r => r.section === sec); return r ? { ...r.data } : null }
      const findMany = (sec: string) => rows.filter(r => r.section === sec).map(r => ({ id: r.id, ...r.data }))
      setVenueContent({
        video_default:      findOne('video_default'),
        techspecs:          findOne('techspecs'),
        accommodation_info: findOne('accommodation_info'),
        map_info:           findOne('map_info'),
        chat_settings:      findOne('chat_settings'),
        experience:         findOne('experience'),
        testimonials:       findMany('testimonial'),
        packages:           findMany('package'),
        zones:              findMany('zone'),
        season_prices:      findMany('season_price'),
        inclusions:         findMany('inclusion'),
        exclusions:         findMany('exclusion'),
        faq:                findMany('faq'),
        collaborators:      findMany('collaborator'),
        extra_services:     findMany('extra_service'),
        menu_prices:        findMany('menu_price'),
      })
    }
    setLoading(false)
  }

  // ── Pre-fill sections from venue content when template changes (new proposal only)
  const applyTemplate = (tplId: string, vc: VenueContent) => {
    const tpl = templates.find(t => t.id === tplId) ?? templates.find(t => t.is_default)
    if (!tpl) return
    const sectionIds = (tpl.sections || []).filter((s: any) => s.enabled !== false).map((s: any) => s.id)
    const enabled: Record<string, boolean> = {}
    sectionIds.forEach(id => { enabled[id] = true })
    setSections(prev => ({
      ...prev,
      sections_enabled: enabled,
      // Pre-fill video
      video_url:   sectionIds.includes('video') && vc.video_default?.url  ? vc.video_default.url  : prev.video_url,
      video_title: sectionIds.includes('video') && vc.video_default?.title ? vc.video_default.title : prev.video_title,
      // Pre-fill techspecs
      show_techspecs: sectionIds.includes('techspecs') ? true : prev.show_techspecs,
      techspecs: sectionIds.includes('techspecs') && vc.techspecs ? { sqm: vc.techspecs.sqm, ceiling: vc.techspecs.ceiling, parking: vc.techspecs.parking, accessibility: vc.techspecs.accessibility, ceremony_spaces: vc.techspecs.ceremony_spaces, extra: vc.techspecs.extra } : prev.techspecs,
      // Pre-fill accommodation
      show_accommodation: sectionIds.includes('accommodation') ? true : prev.show_accommodation,
      accommodation: sectionIds.includes('accommodation') && vc.accommodation_info ? { rooms: vc.accommodation_info.rooms, description: vc.accommodation_info.description, price_info: vc.accommodation_info.price_info, nearby: vc.accommodation_info.nearby } : prev.accommodation,
      // Pre-fill map
      show_map:      sectionIds.includes('map') ? true : prev.show_map,
      map_embed_url: sectionIds.includes('map') && vc.map_info?.embed_url ? vc.map_info.embed_url : prev.map_embed_url,
      map_address:   sectionIds.includes('map') && vc.map_info?.address   ? vc.map_info.address   : prev.map_address,
      map_notes:     sectionIds.includes('map') && vc.map_info?.notes     ? vc.map_info.notes     : prev.map_notes,
      // Pre-fill chat
      show_chat:  sectionIds.includes('chat') ? (vc.chat_settings?.enabled ?? true) : prev.show_chat,
      chat_intro: sectionIds.includes('chat') && vc.chat_settings?.intro_text ? vc.chat_settings.intro_text : prev.chat_intro,
      // Pre-fill testimonials
      show_testimonials: sectionIds.includes('testimonials') ? true : prev.show_testimonials,
      testimonials: sectionIds.includes('testimonials') && vc.testimonials?.length ? vc.testimonials.slice(0, 3).map((t: any) => ({ names: t.couple_name || '', date: t.wedding_date || '', guests: t.guests, text: t.text || '', photo_url: t.photo_url || '' })) : prev.testimonials,
    }))
    // Also apply template branding
    if (tpl.accent_color) setForm(f => ({ ...f, primary_color: tpl.accent_color }))
    if (tpl.font_family)  setForm(f => ({ ...f, font_family: tpl.font_family! }))
  }

  const notify = (msg: string, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => { setSuccess(''); setError('') }, 3500)
  }

  const closeModal = () => {
    setShowForm(false)
    setEditingId(null)
    setActiveTab('datos')
  }

  // ── Subir logo a Supabase Storage
  const handleLogoUpload = async (file: File) => {
    if (!file) return
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`
    const { data, error: uploadErr } = await supabase.storage
      .from('proposal-assets')
      .upload(path, file, { upsert: true })
    if (uploadErr) { notify('Error al subir el logo', true); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('proposal-assets').getPublicUrl(path)
    setForm(f => ({ ...f, logo_url: publicUrl }))
    setUploading(false)
  }

  // ── Crear o editar propuesta
  const handleSave = async () => {
    if (!form.couple_name.trim()) { notify('El nombre de la pareja es obligatorio', true); return }
    if (!editingId && form.lead_id) {
      const count = proposals.filter(p => p.lead_id === form.lead_id).length
      if (count >= MAX_PROPOSALS_PER_LEAD) {
        notify(`Límite alcanzado: máximo ${MAX_PROPOSALS_PER_LEAD} propuestas por lead.`, true)
        return
      }
    }
    setSaving(true)
    const supabase = createClient()

    // Clean up empty strings in sections
    const cleanSections: SectionsData = {
      ...sections,
      nextsteps:    sections.nextsteps?.filter(x => x.title.trim()) ?? [],
      timeline:     sections.timeline?.filter(x => x.time.trim() || x.title.trim()) ?? [],
      testimonials: sections.testimonials?.filter(x => x.names.trim() || x.text.trim()) ?? [],
    }

    const proposalPayload = {
      user_id:             user.id,
      lead_id:             form.lead_id || null,
      couple_name:         form.couple_name,
      personal_message:    form.personal_message || null,
      guest_count:         form.guest_count ? parseInt(form.guest_count) : null,
      wedding_date:        form.wedding_date || null,
      price_estimate:      form.price_estimate ? parseInt(form.price_estimate) : null,
      show_availability:   form.show_availability,
      show_price_estimate: form.show_price_estimate,
      sections_data:       cleanSections,
      template_id:         form.template_id || null,
    }

    let proposalId = editingId

    if (editingId) {
      const { error: updErr } = await supabase
        .from('proposals')
        .update(proposalPayload)
        .eq('id', editingId)
      if (updErr) { notify('Error al guardar', true); setSaving(false); return }
    } else {
      const slug = generateSlug(form.couple_name)
      let { data, error: insErr } = await supabase
        .from('proposals')
        .insert({ ...proposalPayload, slug, status: 'draft' })
        .select()
        .single()
      // Retry without unknown columns (42703 = undefined_column)
      if (insErr && insErr.code === '42703') {
        const { sections_data: _s, template_id: _t, show_price_estimate: _p, ...basePayload } = proposalPayload as any
        const r = await supabase.from('proposals').insert({ ...basePayload, slug, status: 'draft' }).select().single()
        data = r.data; insErr = r.error
      }
      if (insErr || !data) { notify(`Error al crear la propuesta: ${insErr?.message ?? 'desconocido'}`, true); setSaving(false); return }
      proposalId = data.id
    }

    // Guardar branding (upsert) — retry without font_family if column missing
    const brandingPayload = {
      proposal_id:   proposalId!,
      user_id:       user.id,
      logo_url:      form.logo_url || null,
      primary_color: form.primary_color,
      font_family:   form.font_family,
    }
    const { error: bErr } = await supabase.from('proposal_branding').upsert(brandingPayload, { onConflict: 'proposal_id' })
    if (bErr && (bErr.code === '42703' || (bErr.message ?? '').includes('font_family'))) {
      const { font_family: _omit2, ...baseBranding } = brandingPayload
      await supabase.from('proposal_branding').upsert(baseBranding, { onConflict: 'proposal_id' })
    }

    notify(editingId ? 'Propuesta actualizada' : 'Propuesta creada — copia la URL y envíala')
    closeModal()
    setForm(emptyForm)
    setSections(emptySections)
    load()
    setSaving(false)
  }

  const handleEdit = (p: Proposal) => {
    setEditingId(p.id)
    setForm({
      lead_id:             p.lead_id ?? '',
      couple_name:         p.couple_name,
      guest_count:         p.guest_count?.toString() ?? '',
      wedding_date:        p.wedding_date ?? '',
      price_estimate:      p.price_estimate?.toString() ?? '',
      personal_message:    p.personal_message ?? '',
      show_availability:   p.show_availability,
      show_price_estimate: p.show_price_estimate,
      primary_color:       p.branding?.primary_color ?? '#2d4a7a',
      logo_url:            p.branding?.logo_url ?? null,
      font_family:         (p.branding as any)?.font_family ?? 'Georgia, serif',
      template_id:         (p as any).template_id ?? '',
    })
    setSections({ ...emptySections, ...(p.sections_data ?? {}) })
    setActiveTab('datos')
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta propuesta? La URL dejará de funcionar.')) return
    const supabase = createClient()
    await supabase.from('proposals').delete().eq('id', id)
    setProposals(prev => prev.filter(p => p.id !== id))
  }

  const markSent = async (id: string) => {
    const supabase = createClient()
    await supabase.from('proposals').update({ status: 'sent' }).eq('id', id)
    setProposals(prev => prev.map(p => p.id === id ? { ...p, status: 'sent' } : p))
  }

  const copyUrl = (slug: string) => {
    const url = `${window.location.origin}/proposal/${slug}`
    navigator.clipboard.writeText(url)
    setCopied(slug)
    setTimeout(() => setCopied(null), 2000)
  }

  const onLeadChange = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId)
    setForm(f => ({
      ...f,
      lead_id:     leadId,
      couple_name: lead ? lead.name : f.couple_name,
      guest_count: lead?.guests ? String(lead.guests) : f.guest_count,
    }))
  }

  // ── Helpers para arrays en secciones ──────────────────────────────────────────

  const addTimeline = () =>
    setSections(s => ({ ...s, timeline: [...(s.timeline ?? []), { time: '', title: '', description: '' }] }))
  const updateTimeline = (i: number, key: string, val: string) =>
    setSections(s => ({ ...s, timeline: (s.timeline ?? []).map((x, idx) => idx === i ? { ...x, [key]: val } : x) }))
  const removeTimeline = (i: number) =>
    setSections(s => ({ ...s, timeline: (s.timeline ?? []).filter((_, idx) => idx !== i) }))

  const addTestimonial = () =>
    setSections(s => ({ ...s, testimonials: [...(s.testimonials ?? []), { names: '', text: '', date: '', guests: undefined, photo_url: '' }] }))
  const updateTestimonial = (i: number, key: string, val: any) =>
    setSections(s => ({ ...s, testimonials: (s.testimonials ?? []).map((x, idx) => idx === i ? { ...x, [key]: val } : x) }))
  const removeTestimonial = (i: number) =>
    setSections(s => ({ ...s, testimonials: (s.testimonials ?? []).filter((_, idx) => idx !== i) }))

  const addNextstep = () =>
    setSections(s => ({ ...s, nextsteps: [...(s.nextsteps ?? []), { title: '', description: '' }] }))
  const updateNextstep = (i: number, key: string, val: string) =>
    setSections(s => ({ ...s, nextsteps: (s.nextsteps ?? []).map((x, idx) => idx === i ? { ...x, [key]: val } : x) }))
  const removeNextstep = (i: number) =>
    setSections(s => ({ ...s, nextsteps: (s.nextsteps ?? []).filter((_, idx) => idx !== i) }))

  // ── Per-proposal content overrides ────────────────────────────────────────────
  const hasOverride = (key: string) => (sections as any)[key] != null
  const getOverride = (key: string) => (sections as any)[key] as any[]
  const setOverride = (key: string, val: any) => setSections((s: any) => ({ ...s, [key]: val }))
  const clearOverride = (key: string) => setSections((s: any) => { const n = { ...s }; delete n[key]; return n })
  const updateOverrideItem = (key: string, i: number, field: string, val: any) => {
    const items = [...((sections as any)[key] ?? [])]
    items[i] = { ...items[i], [field]: val }
    setOverride(key, items)
  }
  const removeOverrideItem = (key: string, i: number) =>
    setOverride(key, ((sections as any)[key] ?? []).filter((_: any, idx: number) => idx !== i))
  const addOverrideItem = (key: string, template: any) =>
    setOverride(key, [...((sections as any)[key] ?? []), template])
  const initOverride = (secId: string) => {
    const vc = venueContent
    const libData: Record<string, any[]> = {
      packages:       vc.packages.map((p: any) => ({ name: p.name ?? '', subtitle: p.subtitle ?? '', price: p.price ?? '', description: p.description ?? '', includes: p.includes ? [...p.includes] : [] })),
      zones:          vc.zones.map((z: any) => ({ name: z.name ?? '', description: z.description ?? '', capacity_min: z.capacity_min, capacity_max: z.capacity_max, price: z.price ?? '' })),
      season_prices:  vc.season_prices.map((s: any) => ({ label: s.label ?? s.season ?? '', date_range: s.date_range ?? '', price_modifier: s.price_modifier ?? '', notes: s.notes ?? '' })),
      inclusions:     vc.inclusions.map((x: any) => ({ title: x.title ?? '', emoji: x.emoji ?? '', description: x.description ?? '' })),
      exclusions:     vc.exclusions?.map((x: any) => ({ title: x.title ?? '', description: x.description ?? '' })) ?? [],
      faq:            vc.faq.map((f: any) => ({ question: f.question ?? '', answer: f.answer ?? '' })),
      collaborators:  vc.collaborators.map((c: any) => ({ name: c.name ?? '', category: c.category ?? '', description: c.description ?? '', website: c.website ?? '' })),
      extra_services: vc.extra_services.map((s: any) => ({ name: s.name ?? '', price: s.price ?? '', description: s.description ?? '' })),
      menu_prices:    vc.menu_prices.map((m: any) => ({ name: m.name ?? '', price_per_person: m.price_per_person ?? '', description: m.description ?? '', min_guests: m.min_guests })),
      testimonials:   vc.testimonials.map((t: any) => ({ couple_name: t.couple_name ?? '', text: t.text ?? '', wedding_date: t.wedding_date ?? '', rating: t.rating })),
    }
    if (secId === 'experience') {
      const exp = vc.experience
      setOverride('experience_override', { title: exp?.title ?? '', body: exp?.body ?? '' })
      return
    }
    setOverride(`${secId}_override`, libData[secId] ?? [])
  }

  // ── Contadores stats ───────────────────────────────────────────────────────────

  const counts = {
    total:  proposals.length,
    sent:   proposals.filter(p => ['sent', 'viewed'].includes(p.status)).length,
    viewed: proposals.filter(p => p.status === 'viewed').length,
    views:  proposals.reduce((a, p) => a + (p.views || 0), 0),
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1A1512', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C4975A', fontFamily: 'serif' }}>Cargando...</div>
    </div>
  )

  if (!features.propuestas) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cream)' }}>
      <Sidebar />
      <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <div style={{ textAlign: 'center', maxWidth: 480, padding: '40px 24px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Lock size={32} style={{ color: 'var(--gold)', opacity: 0.7 }} />
          </div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, color: 'var(--espresso)', marginBottom: 12 }}>Propuestas personalizadas</div>
          <div style={{ fontSize: 14, color: 'var(--warm-gray)', lineHeight: 1.7, marginBottom: 28 }}>
            Crea landings únicas para cada pareja con tu branding, precios y secciones personalizadas.<br />
            Disponible en el plan <strong>Premium</strong>.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <div style={{ background: 'var(--ivory)', borderRadius: 10, padding: '14px 20px', width: '100%', maxWidth: 340, textAlign: 'left' }}>
              {['Landing personalizada por pareja', 'Tu logo, colores y tipografía', 'Secciones con precios y contenido', 'URL única y seguimiento de vistas'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--charcoal)', marginBottom: 8 }}>
                  <span style={{ color: 'var(--gold)', fontWeight: 700 }}>✓</span> {f}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Contacta con tu gestor de cuenta para actualizar tu plan</div>
          </div>
        </div>
      </main>
    </div>
  )

  // ── Estilos reutilizables ──────────────────────────────────────────────────────
  const secLabel: React.CSSProperties = {
    fontSize: 11, color: 'var(--warm-gray)', fontWeight: 600,
    letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10,
  }
  const secBox: React.CSSProperties = {
    border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 12,
  }
  const toggleRow: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13,
  }
  const addBtn: React.CSSProperties = {
    fontSize: 11, color: 'var(--gold)', background: 'none', border: '1px dashed var(--border)',
    borderRadius: 6, padding: '4px 10px', cursor: 'pointer', marginTop: 8, width: '100%',
  }
  const removeBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)',
    padding: '2px 4px', flexShrink: 0,
  }
  const itemCard: React.CSSProperties = {
    border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', marginBottom: 8,
    display: 'flex', flexDirection: 'column', gap: 6,
  }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">

        <div className="topbar">
          <div className="topbar-title">Propuestas</div>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(emptyForm); setSections(emptySections); setEditingId(null); setActiveTab('datos'); setShowForm(true) }}>
            <Plus size={13} /> Nueva propuesta
          </button>
        </div>

        <div className="page-content">
          {success   && <div className="alert alert-success">{success}</div>}
          {error     && <div className="alert alert-error">{error}</div>}
          {limitWarn && (
            <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Límite de propuestas alcanzado</strong><br />
                <span style={{ fontSize: 12 }}>{limitWarn}</span>
                <button onClick={() => setLimitWarn('')} style={{ marginLeft: 12, fontSize: 11, color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Cerrar</button>
              </div>
            </div>
          )}

          <div className="stats-grid">
            <div className="stat-card accent">
              <div className="stat-label">Total creadas</div>
              <div className="stat-value">{counts.total}</div>
              <div className="stat-sub">Historial completo</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Enviadas</div>
              <div className="stat-value">{counts.sent}</div>
              <div className="stat-sub">Activas ahora</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Vistas por parejas</div>
              <div className="stat-value">{counts.viewed}</div>
              <div className="stat-sub">Han abierto el enlace</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total aperturas</div>
              <div className="stat-value">{counts.views}</div>
              <div className="stat-sub">{counts.total > 0 ? (counts.views / counts.total).toFixed(1) : 0} de media</div>
            </div>
          </div>

          <div className="card">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pareja</th>
                    <th>Boda</th>
                    <th>Estado</th>
                    <th>Vistas</th>
                    <th>Branding</th>
                    <th>Creada</th>
                    <th>Compartir</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--warm-gray)' }}>
                        <Send size={28} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                        <div style={{ marginBottom: 4 }}>Aún no has creado ninguna propuesta.</div>
                        <div style={{ fontSize: 12, marginBottom: 16 }}>Crea una landing personalizada para cada pareja y envíasela por WhatsApp o email.</div>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>Crear primera propuesta →</button>
                      </td>
                    </tr>
                  )}
                  {proposals.map(p => {
                      const leadProposalCount = p.lead_id ? proposals.filter(x => x.lead_id === p.lead_id).length : null
                      const atLimit = leadProposalCount !== null && leadProposalCount >= MAX_PROPOSALS_PER_LEAD
                      const linkedLeadName = leads.find(l => l.id === p.lead_id)?.name
                      return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {p.couple_name}
                          {leadProposalCount !== null && (
                            <span title={`${leadProposalCount}/${MAX_PROPOSALS_PER_LEAD} propuestas para este lead`} style={{
                              fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 600,
                              background: atLimit ? '#fee2e2' : 'var(--ivory)',
                              color: atLimit ? '#dc2626' : 'var(--warm-gray)',
                            }}>
                              {leadProposalCount}/{MAX_PROPOSALS_PER_LEAD}
                            </span>
                          )}
                        </div>
                        {p.guest_count && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{p.guest_count} invitados</div>}
                        {linkedLeadName && (
                          <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 1 }}>
                            Lead: {linkedLeadName}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>
                        {p.wedding_date
                          ? new Date(p.wedding_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td><span className={`badge ${S_BADGE[p.status] || ''}`}>{S_LABEL[p.status] || p.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Eye size={11} style={{ color: 'var(--warm-gray)' }} />
                          <span style={{ fontSize: 12 }}>{p.views || 0}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            width: 16, height: 16, borderRadius: 4,
                            background: p.branding?.primary_color ?? '#2d4a7a',
                            border: '1px solid rgba(255,255,255,0.1)',
                            flexShrink: 0
                          }} />
                          {p.branding?.logo_url
                            ? <img src={p.branding.logo_url} alt="logo" style={{ height: 16, maxWidth: 40, objectFit: 'contain', opacity: 0.8 }} />
                            : <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>sin logo</span>
                          }
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--warm-gray)' }}>
                        {new Date(p.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => copyUrl(p.slug)}>
                            {copied === p.slug
                              ? <><Check size={12} style={{ color: 'var(--sage)' }} /> Copiado</>
                              : <><Copy size={12} /> Copiar URL</>}
                          </button>
                          <a href={`/proposal/${p.slug}`} target="_blank" rel="noopener" className="btn btn-ghost btn-sm" title="Ver landing">
                            <ExternalLink size={11} />
                          </a>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(p)} title="Editar">
                            <Palette size={11} />
                          </button>
                          {p.status === 'draft' && (
                            <button className="btn btn-primary btn-sm" onClick={() => markSent(p.id)} title="Marcar como enviada">
                              <Send size={11} /> Enviar
                            </button>
                          )}
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>
                            <X size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                      )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal crear / editar propuesta */}
      {showForm && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>

            <div className="modal-header">
              <div className="modal-title">{editingId ? 'Editar propuesta' : 'Nueva propuesta'}</div>
              <div className="modal-sub">
                {editingId ? 'Modifica los datos, el aspecto visual y las secciones' : 'Crea una landing personalizada para una pareja'}
              </div>
            </div>

            {/* ── Tabs ── */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px', gap: 4 }}>
              {(['datos', 'visual', 'secciones'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '8px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--gold)' : '2px solid transparent',
                    color: activeTab === tab ? 'var(--gold)' : 'var(--warm-gray)',
                    textTransform: 'capitalize', letterSpacing: '0.03em',
                  }}
                >
                  {tab === 'datos' ? 'Datos' : tab === 'visual' ? 'Visual' : 'Secciones'}
                </button>
              ))}
            </div>

            <div className="modal-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

              {/* ══════════════ TAB: DATOS ══════════════ */}
              {activeTab === 'datos' && (
                <div>
                  <div style={{ ...secLabel, marginBottom: 10 }}>Datos de la pareja</div>

                  {leads.length > 0 && (
                    <div className="form-group">
                      <label className="form-label">Vincular a un lead (opcional)</label>
                      <select className="form-input" value={form.lead_id} onChange={e => onLeadChange(e.target.value)}>
                        <option value="">— Sin lead —</option>
                        {leads.map(l => (
                          <option key={l.id} value={l.id}>{l.name}{l.guests ? ` · ${l.guests} inv.` : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="two-col">
                    <div className="form-group">
                      <label className="form-label">Nombre de la pareja *</label>
                      <input
                        className="form-input"
                        value={form.couple_name}
                        onChange={e => setForm(f => ({ ...f, couple_name: e.target.value }))}
                        placeholder="Ej: Laura & Carlos"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nº invitados estimado</label>
                      <input
                        className="form-input" type="number"
                        value={form.guest_count}
                        onChange={e => setForm(f => ({ ...f, guest_count: e.target.value }))}
                        placeholder="Ej: 150"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Fecha de boda</label>
                      <input
                        className="form-input" type="date"
                        value={form.wedding_date}
                        onChange={e => setForm(f => ({ ...f, wedding_date: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Mensaje personal</label>
                    <textarea
                      className="form-textarea"
                      style={{ minHeight: 90 }}
                      value={form.personal_message}
                      onChange={e => setForm(f => ({ ...f, personal_message: e.target.value }))}
                      placeholder="Escribe un mensaje personalizado para esta pareja..."
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.show_availability} onChange={e => setForm(f => ({ ...f, show_availability: e.target.checked }))} />
                      Mostrar disponibilidad
                    </label>
                  </div>
                </div>
              )}

              {/* ══════════════ TAB: VISUAL ══════════════ */}
              {activeTab === 'visual' && (
                <div>
                  <div style={secLabel}>Aspecto visual de la landing</div>

                  {/* ── Selector de diseño visual ── */}
                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label">Diseño de la landing</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {([
                        { id: 1, icon: '⚡', name: 'Impacto Directo',      desc: 'Dark luxury · precio visible · CTA al frente' },
                        { id: 2, icon: '✨', name: 'Emoción Primero',       desc: 'Cream editorial · galería arriba · emotivo' },
                        { id: 3, icon: '📋', name: 'Todo Claro',            desc: 'Sidebar + índice · estructurado · analítico' },
                        { id: 4, icon: '💬', name: 'Social Proof',          desc: 'Stats + testimonios al inicio · confianza' },
                        { id: 5, icon: '🎯', name: 'Minimalista / Urgencia', desc: 'Post-visita · limpio · CTA muy prominente' },
                      ] as const).map(tpl => {
                        const active = (sections.visual_template_id ?? 1) === tpl.id
                        return (
                          <button key={tpl.id} type="button"
                            onClick={() => setSections(s => ({ ...s, visual_template_id: tpl.id }))}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                              borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                              border: `2px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                              background: active ? 'rgba(196,151,90,0.10)' : 'var(--surface)',
                              transition: 'border-color .15s, background .15s',
                            }}
                          >
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

                  {/* Plantilla de secciones */}
                  {templates.length > 0 && (
                    <div className="form-group" style={{ marginBottom: 16 }}>
                      <label className="form-label">Plantilla de propuesta</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {templates.map(t => {
                          const isActive = form.template_id === t.id
                          return (
                            <button key={t.id} type="button"
                              onClick={() => {
                                setForm(f => ({ ...f, template_id: t.id }))
                                applyTemplate(t.id, venueContent)
                              }}
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
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 6 }}>
                        Cambia la plantilla en <a href="/comunicacion" target="_blank" style={{ color: 'var(--gold)' }}>Comunicación → Plantilla y diseño</a>
                      </div>
                    </div>
                  )}
                  {templates.length === 0 && (
                    <div style={{ padding: '10px 14px', background: 'var(--cream)', borderRadius: 8, fontSize: 12, color: 'var(--warm-gray)', marginBottom: 16, border: '1px dashed var(--border)' }}>
                      No tienes plantillas aún. <a href="/comunicacion" target="_blank" style={{ color: 'var(--gold)' }}>Crea una en Comunicación →</a>
                    </div>
                  )}

                  <div className="two-col">
                    {/* Color principal */}
                    <div className="form-group">
                      <label className="form-label">Color principal</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {PRESET_COLORS.map(c => (
                          <div
                            key={c}
                            onClick={() => setForm(f => ({ ...f, primary_color: c }))}
                            style={{
                              width: 26, height: 26, borderRadius: 6, background: c, cursor: 'pointer',
                              border: form.primary_color === c ? '2px solid #C4975A' : '2px solid transparent',
                              transition: 'transform .1s',
                              transform: form.primary_color === c ? 'scale(1.15)' : 'scale(1)',
                            }}
                          />
                        ))}
                        <input
                          type="color"
                          value={form.primary_color}
                          onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                          style={{ width: 26, height: 26, padding: 2, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: 'none' }}
                          title="Color personalizado"
                        />
                      </div>
                      <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: form.primary_color, opacity: 0.85 }} />
                    </div>

                    {/* Logo */}
                    <div className="form-group">
                      <label className="form-label">Logo del venue</label>
                      {form.logo_url ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <img src={form.logo_url} alt="logo" style={{ height: 36, maxWidth: 100, objectFit: 'contain', borderRadius: 4, border: '1px solid var(--border)' }} />
                          <button className="btn btn-ghost btn-sm" onClick={() => setForm(f => ({ ...f, logo_url: null }))} title="Eliminar logo">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                          />
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            style={{ width: '100%', justifyContent: 'center' }}
                          >
                            <Upload size={12} />
                            {uploading ? 'Subiendo...' : 'Subir logo (PNG/SVG)'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tipografía */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Tipografía — {getFontByValue(form.font_family)?.label ?? 'Georgia'}</label>
                    <div style={{ padding: '8px 12px', background: 'var(--cream)', borderRadius: 8, marginBottom: 8, border: '1px solid var(--border)' }}>
                      <span style={{ fontFamily: form.font_family, fontSize: 16, color: 'var(--text)' }}>
                        Aa — {form.couple_name || 'Laura & Carlos'}
                      </span>
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

                  {/* Preview mini */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', fontSize: 11, marginTop: 8 }}>
                    <div style={{ background: form.primary_color, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {form.logo_url
                        ? <img src={form.logo_url} alt="" style={{ height: 18, maxWidth: 60, objectFit: 'contain' }} />
                        : <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Tu venue</div>
                      }
                      <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontFamily: form.font_family }}>
                        {form.couple_name || 'Nombre de la pareja'}
                      </div>
                    </div>
                    <div style={{ background: 'var(--surface)', padding: '8px 14px', color: 'var(--warm-gray)', fontSize: 11 }}>
                      Preview de la cabecera de la landing
                    </div>
                  </div>
                </div>
              )}

              {/* ══════════════ TAB: SECCIONES ══════════════ */}
              {activeTab === 'secciones' && (() => {
                // Get sections from selected template
                const tpl = templates.find(t => t.id === form.template_id) ?? templates.find(t => t.is_default)
                const tplSections = tpl ? (tpl.sections || []).filter((s: any) => s.enabled !== false).map((s: any) => s.id) : []

                // Toggle a section on/off for this proposal
                const toggleSec = (id: string, val: boolean) =>
                  setSections(s => ({ ...s, sections_enabled: { ...(s.sections_enabled ?? {}), [id]: val } }))
                const isSectionOn = (id: string) => {
                  const e = sections.sections_enabled
                  return e ? (e[id] !== false) : true
                }

                return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

                  {/* No template selected */}
                  {tplSections.length === 0 && (
                    <div style={{ padding: '16px', background: 'var(--cream)', borderRadius: 8, fontSize: 13, color: 'var(--warm-gray)', border: '1px dashed var(--border)' }}>
                      Ve a la pestaña <strong>Visual</strong> y selecciona una plantilla para ver las secciones disponibles.
                    </div>
                  )}

                  {/* ── Render each template section ── */}
                  {tplSections.map(secId => {
                    const label = SECTION_LABELS[secId] || secId
                    const isOn = isSectionOn(secId)
                    const isLibrary = LIBRARY_SECTIONS.includes(secId)

                    return (
                      <div key={secId} style={{ ...secBox, opacity: isOn ? 1 : 0.5 }}>

                        {/* Section header with toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isOn ? 8 : 0 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                            <input type="checkbox" checked={isOn} onChange={e => toggleSec(secId, e.target.checked)} />
                            <span style={{ ...secLabel, marginBottom: 0 }}>{label}</span>
                          </label>
                        </div>

                        {/* Library section content — editable per proposal */}
                        {isOn && isLibrary && (() => {
                          const vc = venueContent
                          const chipStyle: React.CSSProperties = { fontSize: 11, color: 'var(--charcoal)', background: '#fff', border: '1px solid var(--ivory)', borderRadius: 6, padding: '3px 9px' }
                          const emptyHint = (msg: string) => <div style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic' }}>{msg}</div>

                          // Static sections — no editing
                          if (secId === 'hero')    return <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Foto principal del venue</div>
                          if (secId === 'gallery') return <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Galería de fotos del venue</div>
                          if (secId === 'cta')     return <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Botón de reserva al final de la propuesta</div>
                          if (secId === 'contact') return <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Datos de contacto del venue</div>

                          // Editable library sections
                          const overrideKey = `${secId}_override`
                          const isOverriding = hasOverride(overrideKey) || secId === 'experience' && hasOverride('experience_override')
                          const actualOverrideKey = secId === 'experience' ? 'experience_override' : overrideKey

                          const customizeBtn = (_libraryIsEmpty: boolean) => (
                            <div style={{ marginTop: 8 }}>
                              <button type="button" onClick={() => initOverride(secId)} style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: '1px dashed var(--gold)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                                Personalizar para esta pareja →
                              </button>
                            </div>
                          )

                          const restoreBtn = (
                            <button type="button" onClick={() => clearOverride(actualOverrideKey)} style={{ fontSize: 11, color: 'var(--warm-gray)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 6 }}>
                              ← Usar contenido de la biblioteca
                            </button>
                          )

                          const overrideBadge = <div style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.04em' }}>✦ PERSONALIZADO PARA ESTA PAREJA</div>

                          // ── PACKAGES ──
                          if (secId === 'packages') {
                            if (!isOverriding) return (
                              <div>
                                {vc.packages.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{vc.packages.map((p: any, i: number) => <span key={i} style={chipStyle}>{p.name}{p.price ? ` · ${p.price}` : ''}</span>)}</div> : emptyHint('Sin paquetes en biblioteca')}
                                {customizeBtn(!vc.packages.length)}
                              </div>
                            )
                            const items = getOverride(overrideKey) ?? []
                            return (
                              <div>
                                {overrideBadge}
                                {items.map((pkg: any, i: number) => (
                                  <div key={i} style={itemCard}>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      <input className="form-input" placeholder="Nombre del paquete *" value={pkg.name ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'name', e.target.value)} />
                                      <input className="form-input" style={{ width: 100, flexShrink: 0 }} placeholder="Precio" value={pkg.price ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'price', e.target.value)} />
                                      <button type="button" style={removeBtn} onClick={() => removeOverrideItem(overrideKey, i)}><X size={13} /></button>
                                    </div>
                                    <input className="form-input" placeholder="Subtítulo" value={pkg.subtitle ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'subtitle', e.target.value)} />
                                    <textarea className="form-textarea" style={{ minHeight: 50 }} placeholder="Descripción" value={pkg.description ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'description', e.target.value)} />
                                  </div>
                                ))}
                                <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { name: '', price: '', subtitle: '', description: '', includes: [] })}>+ Añadir paquete</button>
                                {restoreBtn}
                              </div>
                            )
                          }

                          // ── ZONES ──
                          if (secId === 'zones') {
                            if (!isOverriding) return (
                              <div>
                                {vc.zones.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{vc.zones.map((z: any, i: number) => <span key={i} style={chipStyle}>{z.name}{z.capacity_max ? ` · hasta ${z.capacity_max} inv.` : ''}</span>)}</div> : emptyHint('Sin zonas en biblioteca')}
                                {customizeBtn(!vc.zones.length)}
                              </div>
                            )
                            const items = getOverride(overrideKey) ?? []
                            return (
                              <div>
                                {overrideBadge}
                                {items.map((z: any, i: number) => (
                                  <div key={i} style={itemCard}>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      <input className="form-input" placeholder="Nombre de la zona *" value={z.name ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'name', e.target.value)} />
                                      <input className="form-input" style={{ width: 80, flexShrink: 0 }} type="number" placeholder="Cap. min" value={z.capacity_min ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'capacity_min', e.target.value ? Number(e.target.value) : undefined)} />
                                      <input className="form-input" style={{ width: 80, flexShrink: 0 }} type="number" placeholder="Cap. max" value={z.capacity_max ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'capacity_max', e.target.value ? Number(e.target.value) : undefined)} />
                                      <input className="form-input" style={{ width: 90, flexShrink: 0 }} placeholder="Precio" value={z.price ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'price', e.target.value)} />
                                      <button type="button" style={removeBtn} onClick={() => removeOverrideItem(overrideKey, i)}><X size={13} /></button>
                                    </div>
                                    <input className="form-input" placeholder="Descripción" value={z.description ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'description', e.target.value)} />
                                  </div>
                                ))}
                                <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { name: '', description: '', price: '' })}>+ Añadir zona</button>
                                {restoreBtn}
                              </div>
                            )
                          }

                          // ── INCLUSIONS ──
                          if (secId === 'inclusions') {
                            if (!isOverriding) return (
                              <div>
                                {vc.inclusions.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{vc.inclusions.map((x: any, i: number) => <span key={i} style={chipStyle}>{x.emoji || '✓'} {x.title}</span>)}</div> : emptyHint('Sin inclusiones en biblioteca')}
                                {customizeBtn(!vc.inclusions.length)}
                              </div>
                            )
                            const items = getOverride(overrideKey) ?? []
                            return (
                              <div>
                                {overrideBadge}
                                {items.map((x: any, i: number) => (
                                  <div key={i} style={{ ...itemCard, flexDirection: 'row', alignItems: 'center' }}>
                                    <input className="form-input" style={{ width: 44, flexShrink: 0 }} placeholder="✓" value={x.emoji ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'emoji', e.target.value)} />
                                    <input className="form-input" placeholder="Título *" value={x.title ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'title', e.target.value)} />
                                    <input className="form-input" placeholder="Descripción (opcional)" value={x.description ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'description', e.target.value)} />
                                    <button type="button" style={removeBtn} onClick={() => removeOverrideItem(overrideKey, i)}><X size={13} /></button>
                                  </div>
                                ))}
                                <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { title: '', emoji: '', description: '' })}>+ Añadir inclusión</button>
                                {restoreBtn}
                              </div>
                            )
                          }

                          // ── FAQ ──
                          if (secId === 'faq') {
                            if (!isOverriding) return (
                              <div>
                                {vc.faq.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{vc.faq.slice(0,4).map((f: any, i: number) => <span key={i} style={chipStyle}>{f.question}</span>)}{vc.faq.length > 4 && <span style={{ ...chipStyle, background: 'var(--cream)' }}>+{vc.faq.length - 4} más</span>}</div> : emptyHint('Sin FAQs en biblioteca')}
                                {customizeBtn(!vc.faq.length)}
                              </div>
                            )
                            const items = getOverride(overrideKey) ?? []
                            return (
                              <div>
                                {overrideBadge}
                                {items.map((f: any, i: number) => (
                                  <div key={i} style={itemCard}>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      <input className="form-input" placeholder="Pregunta *" value={f.question ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'question', e.target.value)} />
                                      <button type="button" style={removeBtn} onClick={() => removeOverrideItem(overrideKey, i)}><X size={13} /></button>
                                    </div>
                                    <textarea className="form-textarea" style={{ minHeight: 60 }} placeholder="Respuesta *" value={f.answer ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'answer', e.target.value)} />
                                  </div>
                                ))}
                                <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { question: '', answer: '' })}>+ Añadir pregunta</button>
                                {restoreBtn}
                              </div>
                            )
                          }

                          // ── MENU PRICES ──
                          if (secId === 'menu_prices') {
                            if (!isOverriding) return (
                              <div>
                                {vc.menu_prices.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{vc.menu_prices.map((m: any, i: number) => <span key={i} style={chipStyle}>{m.name}{m.price_per_person ? ` · ${m.price_per_person}/p.` : ''}</span>)}</div> : emptyHint('Sin menús en biblioteca')}
                                {customizeBtn(!vc.menu_prices.length)}
                              </div>
                            )
                            const items = getOverride(overrideKey) ?? []
                            return (
                              <div>
                                {overrideBadge}
                                {items.map((m: any, i: number) => (
                                  <div key={i} style={itemCard}>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      <input className="form-input" placeholder="Nombre del menú *" value={m.name ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'name', e.target.value)} />
                                      <input className="form-input" style={{ width: 110, flexShrink: 0 }} placeholder="Precio/persona *" value={m.price_per_person ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'price_per_person', e.target.value)} />
                                      <button type="button" style={removeBtn} onClick={() => removeOverrideItem(overrideKey, i)}><X size={13} /></button>
                                    </div>
                                    <input className="form-input" placeholder="Descripción" value={m.description ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'description', e.target.value)} />
                                  </div>
                                ))}
                                <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { name: '', price_per_person: '', description: '' })}>+ Añadir menú</button>
                                {restoreBtn}
                              </div>
                            )
                          }

                          // ── EXTRA SERVICES ──
                          if (secId === 'extra_services') {
                            if (!isOverriding) return (
                              <div>
                                {vc.extra_services.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{vc.extra_services.map((x: any, i: number) => <span key={i} style={chipStyle}>{x.name}{x.price ? ` · ${x.price}` : ''}</span>)}</div> : emptyHint('Sin servicios en biblioteca')}
                                {customizeBtn(!vc.extra_services.length)}
                              </div>
                            )
                            const items = getOverride(overrideKey) ?? []
                            return (
                              <div>
                                {overrideBadge}
                                {items.map((s: any, i: number) => (
                                  <div key={i} style={{ ...itemCard, flexDirection: 'row', alignItems: 'center' }}>
                                    <input className="form-input" placeholder="Nombre *" value={s.name ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'name', e.target.value)} />
                                    <input className="form-input" style={{ width: 100, flexShrink: 0 }} placeholder="Precio" value={s.price ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'price', e.target.value)} />
                                    <input className="form-input" placeholder="Descripción" value={s.description ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'description', e.target.value)} />
                                    <button type="button" style={removeBtn} onClick={() => removeOverrideItem(overrideKey, i)}><X size={13} /></button>
                                  </div>
                                ))}
                                <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { name: '', price: '', description: '' })}>+ Añadir servicio</button>
                                {restoreBtn}
                              </div>
                            )
                          }

                          // ── SEASON PRICES ──
                          if (secId === 'season_prices') {
                            if (!isOverriding) return (
                              <div>
                                {vc.season_prices.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{vc.season_prices.map((s: any, i: number) => <span key={i} style={chipStyle}>{s.label || s.season}{s.price_modifier ? ` · ${s.price_modifier}` : ''}</span>)}</div> : emptyHint('Sin temporadas en biblioteca')}
                                {customizeBtn(!vc.season_prices.length)}
                              </div>
                            )
                            const items = getOverride(overrideKey) ?? []
                            return (
                              <div>
                                {overrideBadge}
                                {items.map((s: any, i: number) => (
                                  <div key={i} style={itemCard}>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      <input className="form-input" placeholder="Etiqueta *" value={s.label ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'label', e.target.value)} />
                                      <input className="form-input" style={{ width: 110, flexShrink: 0 }} placeholder="Precio / modificador" value={s.price_modifier ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'price_modifier', e.target.value)} />
                                      <button type="button" style={removeBtn} onClick={() => removeOverrideItem(overrideKey, i)}><X size={13} /></button>
                                    </div>
                                    <input className="form-input" placeholder="Rango de fechas (ej: Oct – Dic)" value={s.date_range ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'date_range', e.target.value)} />
                                  </div>
                                ))}
                                <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { label: '', price_modifier: '', date_range: '' })}>+ Añadir temporada</button>
                                {restoreBtn}
                              </div>
                            )
                          }

                          // ── COLLABORATORS ──
                          if (secId === 'collaborators') {
                            if (!isOverriding) return (
                              <div>
                                {vc.collaborators.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{vc.collaborators.map((c: any, i: number) => <span key={i} style={chipStyle}>{c.name}{c.category ? ` · ${c.category}` : ''}</span>)}</div> : emptyHint('Sin colaboradores en biblioteca')}
                                {customizeBtn(!vc.collaborators.length)}
                              </div>
                            )
                            const items = getOverride(overrideKey) ?? []
                            return (
                              <div>
                                {overrideBadge}
                                {items.map((c: any, i: number) => (
                                  <div key={i} style={itemCard}>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      <input className="form-input" placeholder="Nombre *" value={c.name ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'name', e.target.value)} />
                                      <input className="form-input" style={{ width: 120, flexShrink: 0 }} placeholder="Categoría" value={c.category ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'category', e.target.value)} />
                                      <button type="button" style={removeBtn} onClick={() => removeOverrideItem(overrideKey, i)}><X size={13} /></button>
                                    </div>
                                    <input className="form-input" placeholder="Descripción" value={c.description ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'description', e.target.value)} />
                                    <input className="form-input" placeholder="Web (https://...)" value={c.website ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'website', e.target.value)} />
                                  </div>
                                ))}
                                <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { name: '', category: '', description: '', website: '' })}>+ Añadir colaborador</button>
                                {restoreBtn}
                              </div>
                            )
                          }

                          // ── EXPERIENCE ──
                          if (secId === 'experience') {
                            const expKey = 'experience_override'
                            const expIsOverriding = hasOverride(expKey)
                            if (!expIsOverriding) return (
                              <div>
                                {vc.experience?.body ? <div style={{ fontSize: 11, color: 'var(--charcoal)', fontStyle: 'italic', lineHeight: 1.5 }}>"{(vc.experience.body).slice(0,100)}…"</div> : emptyHint('Sin texto de experiencia en biblioteca')}
                                {customizeBtn(!vc.experience?.body)}
                              </div>
                            )
                            const exp = (sections as any)[expKey] ?? { title: '', body: '' }
                            return (
                              <div>
                                {overrideBadge}
                                <input className="form-input" placeholder="Título (ej: La experiencia)" value={exp.title ?? ''} onChange={e => setOverride(expKey, { ...exp, title: e.target.value })} style={{ marginBottom: 6 }} />
                                <textarea className="form-textarea" style={{ minHeight: 100 }} placeholder="Descripción de la experiencia para esta pareja..." value={exp.body ?? ''} onChange={e => setOverride(expKey, { ...exp, body: e.target.value })} />
                                {restoreBtn}
                              </div>
                            )
                          }

                          // ── TESTIMONIALS (via override) ──
                          if (secId === 'testimonials') {
                            if (!isOverriding) return (
                              <div>
                                {vc.testimonials.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{vc.testimonials.slice(0,3).map((t: any, i: number) => <span key={i} style={chipStyle}>{t.couple_name}</span>)}{vc.testimonials.length > 3 && <span style={{ ...chipStyle, background: 'var(--cream)' }}>+{vc.testimonials.length - 3} más</span>}</div> : emptyHint('Sin testimonios en biblioteca')}
                                {customizeBtn(!vc.testimonials.length)}
                              </div>
                            )
                            const items = getOverride(overrideKey) ?? []
                            return (
                              <div>
                                {overrideBadge}
                                {items.map((t: any, i: number) => (
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
                                {restoreBtn}
                              </div>
                            )
                          }

                          return null
                        })()}

                        {/* Per-section content editors (only if on and not a library section) */}
                        {isOn && secId === 'video' && (
                          <div className="two-col">
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                              <label className="form-label">URL del vídeo (YouTube o Vimeo)</label>
                              <input className="form-input" value={sections.video_url ?? ''} onChange={e => setSections(s => ({ ...s, video_url: e.target.value }))} placeholder="https://www.youtube.com/watch?v=..." />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Título (opcional)</label>
                              <input className="form-input" value={sections.video_title ?? ''} onChange={e => setSections(s => ({ ...s, video_title: e.target.value }))} placeholder="Conoce nuestro venue" />
                            </div>
                          </div>
                        )}

                        {isOn && secId === 'welcome' && (
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Mensaje personalizado para esta pareja</label>
                            <textarea className="form-textarea" style={{ minHeight: 80 }} value={form.personal_message ?? ''} onChange={e => setForm(f => ({ ...f, personal_message: e.target.value }))} placeholder="Escribe aquí el mensaje de bienvenida para esta pareja..." />
                          </div>
                        )}

                        {isOn && secId === 'techspecs' && (
                          <div className="two-col">
                            {([['sqm','Superficie (m²)','800 m²'],['ceiling','Altura techo','6 m'],['parking','Parking','200 plazas'],['accessibility','Accesibilidad','Acceso silla de ruedas'],['ceremony_spaces','Espacios ceremonia','Jardín, capilla'],['extra','Otros datos','Generador propio']] as [string,string,string][]).map(([key,lbl,ph]) => (
                              <div className="form-group" key={key}>
                                <label className="form-label">{lbl}</label>
                                <input className="form-input" value={(sections.techspecs as any)?.[key] ?? ''} onChange={e => setSections(s => ({ ...s, techspecs: { ...(s.techspecs ?? {}), [key]: e.target.value } }))} placeholder={ph} />
                              </div>
                            ))}
                          </div>
                        )}

                        {isOn && secId === 'accommodation' && (
                          <div className="two-col">
                            {([['rooms','Habitaciones','20 habitaciones'],['description','Descripción','Descripción del alojamiento'],['price_info','Info de precio','Desde 120€/noche'],['nearby','Alojamiento cercano','Hotel a 5 min']] as [string,string,string][]).map(([key,lbl,ph]) => (
                              <div className="form-group" key={key}>
                                <label className="form-label">{lbl}</label>
                                <input className="form-input" value={(sections.accommodation as any)?.[key] ?? ''} onChange={e => setSections(s => ({ ...s, accommodation: { ...(s.accommodation ?? {}), [key]: e.target.value } }))} placeholder={ph} />
                              </div>
                            ))}
                          </div>
                        )}

                        {isOn && secId === 'map' && (
                          <div className="two-col">
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                              <label className="form-label">URL embed del mapa (Google Maps)</label>
                              <input className="form-input" value={sections.map_embed_url ?? ''} onChange={e => setSections(s => ({ ...s, map_embed_url: e.target.value }))} placeholder="https://maps.google.com/maps?q=...&output=embed" />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Dirección</label>
                              <input className="form-input" value={sections.map_address ?? ''} onChange={e => setSections(s => ({ ...s, map_address: e.target.value }))} placeholder="Calle Ejemplo 10, Madrid" />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Notas de acceso</label>
                              <input className="form-input" value={sections.map_notes ?? ''} onChange={e => setSections(s => ({ ...s, map_notes: e.target.value }))} placeholder="Salida 14 de la A-6" />
                            </div>
                          </div>
                        )}

                        {isOn && secId === 'testimonials' && (
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

                        {isOn && secId === 'chat' && (
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Texto introductorio del formulario</label>
                            <input className="form-input" value={sections.chat_intro ?? ''} onChange={e => setSections(s => ({ ...s, chat_intro: e.target.value }))} placeholder="¿Tienes alguna pregunta? Escríbenos..." />
                          </div>
                        )}

                        {isOn && secId === 'nextsteps' && (
                          <div>
                            {(sections.nextsteps ?? []).map((item, i) => (
                              <div key={i} style={itemCard}>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                                  <input className="form-input" value={item.title} onChange={e => updateNextstep(i, 'title', e.target.value)} placeholder="Título del paso" />
                                  <button style={removeBtn} onClick={() => removeNextstep(i)}><X size={13} /></button>
                                </div>
                                <input className="form-input" value={item.description} onChange={e => updateNextstep(i, 'description', e.target.value)} placeholder="Descripción" />
                              </div>
                            ))}
                            <button style={addBtn} onClick={addNextstep}>+ Añadir paso</button>
                          </div>
                        )}

                        {isOn && secId === 'timeline' && (
                          <div>
                            <div className="form-group">
                              <label className="form-label">Introducción (opcional)</label>
                              <input className="form-input" value={sections.timeline_intro ?? ''} onChange={e => setSections(s => ({ ...s, timeline_intro: e.target.value }))} placeholder="Así imaginamos vuestro gran día..." />
                            </div>
                            {(sections.timeline ?? []).map((item, i) => (
                              <div key={i} style={itemCard}>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <input className="form-input" style={{ width: 80, flexShrink: 0 }} value={item.time} onChange={e => updateTimeline(i, 'time', e.target.value)} placeholder="12:00" />
                                  <input className="form-input" value={item.title} onChange={e => updateTimeline(i, 'title', e.target.value)} placeholder="Momento del día" />
                                  <button style={removeBtn} onClick={() => removeTimeline(i)}><X size={13} /></button>
                                </div>
                                <input className="form-input" value={item.description ?? ''} onChange={e => updateTimeline(i, 'description', e.target.value)} placeholder="Descripción (opcional)" />
                              </div>
                            ))}
                            <button style={addBtn} onClick={addTimeline}>+ Añadir momento</button>
                          </div>
                        )}

                        {isOn && secId === 'availability' && (
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Mensaje de disponibilidad</label>
                            <textarea className="form-textarea" style={{ minHeight: 70 }} value={sections.availability_message ?? ''} onChange={e => setSections(s => ({ ...s, availability_message: e.target.value }))} placeholder="Ej: Actualmente tenemos disponibilidad para los meses de..." />
                          </div>
                        )}

                      </div>
                    )
                  })}

                </div>
                )
              })()}

            </div>{/* end inner flex column */}
            </div>{/* end modal-body */}

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || uploading}>
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear propuesta →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PropuestasPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <PropuestasPageContent />
    </Suspense>
  )
}

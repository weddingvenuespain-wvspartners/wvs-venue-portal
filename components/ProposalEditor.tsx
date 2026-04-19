'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Check, X, Upload, AlertCircle, Zap, Sparkles, ClipboardList, MessageCircle, Target, ChevronDown, ArrowLeft, Copy } from 'lucide-react'
import type { SectionsData } from '@/lib/proposal-types'
import { GOOGLE_FONTS, FONT_CATEGORIES, ALL_FONTS_URL, getFontByValue } from '@/lib/fonts'
import { useUnsavedChanges } from '@/lib/use-unsaved-changes'
import ProposalPreview from './ProposalPreview'
import ProposalMenuEditor from './ProposalMenuEditor'
import { INCLUSION_ICON_CHOICES } from '@/app/proposal/[slug]/tpl/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProposalTemplate = {
  id: string
  name: string
  sections: Array<{ id: string; enabled?: boolean }>
  accent_color: string
  font_family?: string
  is_default: boolean
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

const SECTION_LABELS: Record<string, string> = {
  hero: 'Foto principal',
  availability: 'Disponibilidad',
  welcome: 'Mensaje de bienvenida',
  experience: 'La experiencia',
  gallery: 'Galería de fotos',
  zones: 'Zonas del venue',
  venue_rental: 'Tarifas de alquiler (grid temporada × día)',
  inclusions: 'Qué incluye',
  testimonials: 'Testimonios',
  collaborators: 'Colaboradores',
  accommodation: 'Alojamiento',
  extra_services: 'Servicios adicionales',
  faq: 'Preguntas frecuentes',
  map: 'Mapa y ubicación',
  contact: 'Datos de contacto',
}

const emptySections: SectionsData = {
  visual_template_id: 1,
  availability_message: '',
  accommodation: {},
  sections_enabled: {},
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProposalEditor({ proposal: initial }: { proposal: EditorProposal }) {
  const router = useRouter()
  const { user } = useAuth()

  const [proposal, setProposal] = useState<EditorProposal>(initial)
  const [leads, setLeads] = useState<any[]>([])
  const [templates, setTemplates] = useState<ProposalTemplate[]>([])
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
  const [activeTab, setActiveTab] = useState<'datos' | 'visual' | 'secciones' | 'menus'>('datos')
  const [openSecs, setOpenSecs] = useState<Set<string>>(new Set())

  // Si desactivan catering y estaban en la tab de menús, volver a secciones
  useEffect(() => {
    if (activeTab === 'menus' && sections.has_catering === false) setActiveTab('secciones')
  }, [activeTab, sections.has_catering])

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

  // Load secondary data (leads, templates, venue) once
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    ;(async () => {
      const [{ data: leadsData }, { data: tplData }, { data: venueRow }] = await Promise.all([
        supabase.from('leads').select('id, name, guests, email').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('proposal_web_templates').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('venue_onboarding').select('name, city, region, contact_email, contact_phone, website, photo_urls').eq('user_id', user.id).maybeSingle(),
      ])
      if (leadsData) setLeads(leadsData)
      if (tplData) setTemplates(tplData as ProposalTemplate[])
      if (venueRow) setVenue(venueRow)
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

    const cleanSections: SectionsData = { ...sections }

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

  // ── Per-proposal content overrides
  const getOverride = (key: string) => (sections as any)[key] as any[]
  const setOverride = (key: string, val: any) => setSections((s: any) => ({ ...s, [key]: val }))
  const updateOverrideItem = (key: string, i: number, field: string, val: any) => {
    const items = [...((sections as any)[key] ?? [])]
    items[i] = { ...items[i], [field]: val }
    setOverride(key, items)
  }
  const removeOverrideItem = (key: string, i: number) => setOverride(key, ((sections as any)[key] ?? []).filter((_: any, idx: number) => idx !== i))
  const addOverrideItem = (key: string, template: any) => setOverride(key, [...((sections as any)[key] ?? []), template])

  // ── Build preview patch — what the iframe sees as the live state
  const previewPatch = useMemo(() => {
    const cleanSections: SectionsData = { ...sections }
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
        font_family: form.font_family,
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
          {(['datos', 'visual', 'secciones', 'menus'] as const)
            .filter(tab => tab !== 'menus' || sections.has_catering !== false)
            .map(tab => (
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
              {tab === 'datos' ? 'Datos' : tab === 'visual' ? 'Visual' : tab === 'secciones' ? 'Secciones' : 'Menús'}
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

              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">Tipo de servicio</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { v: true,  label: 'Con catering / menú', desc: 'Incluye sección de menús y aperitivos' },
                    { v: false, label: 'Solo venue', desc: 'Sin menús — solo alquiler del espacio' },
                  ].map(opt => {
                    const active = (sections.has_catering ?? true) === opt.v
                    return (
                      <button key={String(opt.v)} type="button"
                        onClick={() => setSections(s => ({ ...s, has_catering: opt.v }))}
                        style={{ flex: 1, padding: '10px 12px', fontSize: 12, fontWeight: 500, borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                          border: `1.5px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                          background: active ? 'rgba(196,151,90,.08)' : 'var(--surface)',
                          color: active ? 'var(--charcoal)' : 'var(--warm-gray)' }}>
                        <div style={{ fontWeight: 600 }}>{opt.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 2, fontWeight: 400 }}>{opt.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">IVA en los precios</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { v: false, label: 'IVA no incluido' },
                    { v: true,  label: 'IVA incluido' },
                  ].map(opt => {
                    const active = (sections.iva_included ?? false) === opt.v
                    return (
                      <button key={String(opt.v)} type="button"
                        onClick={() => setSections(s => ({ ...s, iva_included: opt.v }))}
                        style={{ flex: 1, padding: '8px 12px', fontSize: 12, fontWeight: 500, borderRadius: 6, cursor: 'pointer',
                          border: `1.5px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                          background: active ? 'rgba(196,151,90,.08)' : 'var(--surface)',
                          color: active ? 'var(--charcoal)' : 'var(--warm-gray)' }}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
                <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 4, lineHeight: 1.5 }}>
                  Se mostrará junto a los precios de la propuesta.
                </div>
              </div>

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
            // Sections in the same order the templates render them
            const ALL_SECTION_IDS = [
              'hero',
              'availability',
              'welcome',
              'experience',
              'gallery',
              'zones',
              'venue_rental',
              'inclusions',
              'testimonials',
              'collaborators',
              'accommodation',
              'extra_services',
              'faq',
              'map',
              'contact',
            ]
            const tplSections: string[] = ALL_SECTION_IDS
            const toggleSec = (id: string, val: boolean) => setSections(s => ({ ...s, sections_enabled: { ...(s.sections_enabled ?? {}), [id]: val } }))
            const isSectionOn = (id: string) => {
              const e = sections.sections_enabled
              return e ? (e[id] !== false) : true
            }
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
                  const isOpen = openSecs.has(secId)
                  const overrideKey = `${secId}_override`

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

                      {isOpen && (
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
                          {secId === 'contact' && (() => {
                            const c: any = sections.contact ?? {}
                            const patch = (p: any) => setSections(s => ({ ...s, contact: { ...(s.contact ?? {}), ...p } }))
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">Teléfono (WhatsApp)</label>
                                  <input className="form-input" placeholder="+34 600 000 000" value={c.phone ?? ''} onChange={e => patch({ phone: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">Email</label>
                                  <input className="form-input" type="email" placeholder="eventos@venue.com" value={c.email ?? ''} onChange={e => patch({ email: e.target.value })} />
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
                                  Estos datos aparecerán como botones de WhatsApp y email al final de la propuesta y en el botón flotante. Si se dejan vacíos y el venue tiene contacto configurado, se usará el del venue.
                                </div>
                              </div>
                            )
                          })()}

                          {/* ZONES */}
                          {secId === 'zones' && (
                            <div>
                              {(getOverride(overrideKey) ?? []).map((z: any, i: number) => {
                                const caps = Array.isArray(z.capacities) ? z.capacities : []
                                const updateCaps = (newCaps: any[]) => updateOverrideItem(overrideKey, i, 'capacities', newCaps)
                                const photo = z.photos?.[0]
                                const handleUpload = async (file: File) => {
                                  if (!user) return
                                  const supabase = createClient()
                                  const path = `${user.id}/zones/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
                                  const { error } = await supabase.storage.from('proposal-assets').upload(path, file, { upsert: true })
                                  if (error) return
                                  const { data } = supabase.storage.from('proposal-assets').getPublicUrl(path)
                                  updateOverrideItem(overrideKey, i, 'photos', [data.publicUrl])
                                }
                                return (
                                  <details key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden', background: 'var(--surface)' }}>
                                    <summary style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--charcoal)', fontWeight: 500, background: 'var(--cream)', listStyle: 'none' }}>
                                      <ChevronDown size={12} style={{ color: 'var(--warm-gray)' }} />
                                      <span style={{ flex: 1 }}>{z.name || <em style={{ color: 'var(--warm-gray)' }}>Nueva zona</em>}</span>
                                      <button type="button" style={removeBtn} onClick={e => { e.preventDefault(); e.stopPropagation(); removeOverrideItem(overrideKey, i) }}><X size={13} /></button>
                                    </summary>
                                    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <input className="form-input" placeholder="Nombre *" value={z.name ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'name', e.target.value)} />
                                        <input className="form-input" style={{ width: 80, flexShrink: 0 }} type="number" placeholder="m²" value={z.sqm ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'sqm', e.target.value ? Number(e.target.value) : undefined)} />
                                      </div>
                                      <input className="form-input" placeholder="Descripción breve" value={z.description ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'description', e.target.value)} />

                                      {/* Image upload */}
                                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        {photo ? (
                                          <>
                                            <img src={photo} alt="" style={{ width: 80, height: 54, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateOverrideItem(overrideKey, i, 'photos', [])}>Quitar</button>
                                            <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                                              Cambiar
                                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                                            </label>
                                          </>
                                        ) : (
                                          <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                                            <Upload size={12} /> Subir imagen (opcional)
                                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                                          </label>
                                        )}
                                        <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Si no subes una, se usará una foto de la galería del venue.</div>
                                      </div>

                                      {/* Capacidades múltiples */}
                                      <div style={{ background: 'var(--cream)', borderRadius: 6, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <div style={{ fontSize: 10, color: 'var(--warm-gray)', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>Capacidades</div>
                                        {caps.map((c: any, ci: number) => (
                                          <div key={ci} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                            <select className="form-input" style={{ flex: 1 }} value={c.type ?? 'other'}
                                              onChange={e => updateCaps(caps.map((x: any, j: number) => j === ci ? { ...x, type: e.target.value } : x))}>
                                              <option value="ceremony">Ceremonia</option>
                                              <option value="cocktail">Coctel</option>
                                              <option value="banquet">Banquete</option>
                                              <option value="party">Fiesta</option>
                                              <option value="other">Otro</option>
                                            </select>
                                            <input className="form-input" type="number" placeholder="pax" style={{ width: 80 }} value={c.count ?? ''}
                                              onChange={e => updateCaps(caps.map((x: any, j: number) => j === ci ? { ...x, count: e.target.value ? Number(e.target.value) : undefined } : x))} />
                                            <input className="form-input" placeholder="Etiqueta (opc.)" style={{ flex: 1 }} value={c.label ?? ''}
                                              onChange={e => updateCaps(caps.map((x: any, j: number) => j === ci ? { ...x, label: e.target.value } : x))} />
                                            <button type="button" style={{ ...removeBtn, width: 22, height: 22 }} onClick={() => updateCaps(caps.filter((_: any, j: number) => j !== ci))}><X size={11} /></button>
                                          </div>
                                        ))}
                                        <button type="button" style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '2px 0' }}
                                          onClick={() => updateCaps([...caps, { type: 'banquet', count: undefined }])}>
                                          + Añadir capacidad
                                        </button>
                                      </div>

                                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--charcoal)' }}>
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                                          <input type="checkbox" checked={!!z.climatized} onChange={e => updateOverrideItem(overrideKey, i, 'climatized', e.target.checked)} />
                                          Climatizado
                                        </label>
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                                          <input type="checkbox" checked={!!z.plan_b} onChange={e => updateOverrideItem(overrideKey, i, 'plan_b', e.target.checked)} />
                                          Plan B (cubierto)
                                        </label>
                                        <select className="form-input" style={{ width: 170 }} value={z.covered ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'covered', e.target.value || undefined)}>
                                          <option value="">— tipo —</option>
                                          <option value="indoor">Interior</option>
                                          <option value="outdoor">Exterior</option>
                                          <option value="covered-outdoor">Exterior cubierto</option>
                                        </select>
                                      </div>

                                      <input className="form-input" placeholder="Notas adicionales (ej. *Opción haima +coste)" value={z.notes ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'notes', e.target.value)} />
                                    </div>
                                  </details>
                                )
                              })}
                              <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { name: '', description: '', capacities: [] })}>+ Añadir zona</button>
                            </div>
                          )}

                          {/* INCLUSIONS */}
                          {secId === 'inclusions' && (
                            <div>
                              {(getOverride(overrideKey) ?? []).map((x: any, i: number) => (
                                <details key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden', background: 'var(--surface)' }}>
                                  <summary style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--charcoal)', fontWeight: 500, background: 'var(--cream)', listStyle: 'none' }}>
                                    <ChevronDown size={12} style={{ color: 'var(--warm-gray)' }} />
                                    <span style={{ flex: 1 }}>{x.title || <em style={{ color: 'var(--warm-gray)' }}>Nueva inclusión</em>}</span>
                                    <button type="button" style={removeBtn} onClick={e => { e.preventDefault(); e.stopPropagation(); removeOverrideItem(overrideKey, i) }}><X size={13} /></button>
                                  </summary>
                                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <select className="form-input" style={{ width: 200, flexShrink: 0 }} value={x.icon ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'icon', e.target.value)}>
                                        <option value="">— icono —</option>
                                        {INCLUSION_ICON_CHOICES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                      </select>
                                      <input className="form-input" placeholder="Título *" value={x.title ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'title', e.target.value)} />
                                    </div>
                                    <input className="form-input" placeholder="Descripción (opcional)" value={x.description ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'description', e.target.value)} />
                                  </div>
                                </details>
                              ))}
                              <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { title: '', icon: 'check', description: '' })}>+ Añadir inclusión</button>
                            </div>
                          )}

                          {/* FAQ */}
                          {secId === 'faq' && (
                            <div>
                              {(getOverride(overrideKey) ?? []).map((f: any, i: number) => (
                                <details key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden', background: 'var(--surface)' }}>
                                  <summary style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--charcoal)', fontWeight: 500, background: 'var(--cream)', listStyle: 'none' }}>
                                    <ChevronDown size={12} style={{ color: 'var(--warm-gray)' }} />
                                    <span style={{ flex: 1 }}>{f.question || <em style={{ color: 'var(--warm-gray)' }}>Nueva pregunta</em>}</span>
                                    <button type="button" style={removeBtn} onClick={e => { e.preventDefault(); e.stopPropagation(); removeOverrideItem(overrideKey, i) }}><X size={13} /></button>
                                  </summary>
                                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <input className="form-input" placeholder="Pregunta *" value={f.question ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'question', e.target.value)} />
                                    <textarea className="form-textarea" style={{ minHeight: 70 }} placeholder="Respuesta *" value={f.answer ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'answer', e.target.value)} />
                                  </div>
                                </details>
                              ))}
                              <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { question: '', answer: '' })}>+ Añadir pregunta</button>
                            </div>
                          )}

                          {/* EXTRA SERVICES */}
                          {secId === 'extra_services' && (
                            <div>
                              {(getOverride(overrideKey) ?? []).map((s: any, i: number) => (
                                <div key={i} style={{ ...itemCard, flexDirection: 'row', alignItems: 'center' }}>
                                  <input className="form-input" placeholder="Nombre *" value={s.name ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'name', e.target.value)} />
                                  <input className="form-input" style={{ width: 100, flexShrink: 0 }} placeholder="Precio" value={s.price ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'price', e.target.value)} />
                                  <input className="form-input" placeholder="Descripción" value={s.description ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'description', e.target.value)} />
                                  <button type="button" style={removeBtn} onClick={() => removeOverrideItem(overrideKey, i)}><X size={13} /></button>
                                </div>
                              ))}
                              <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { name: '', price: '', description: '' })}>+ Añadir servicio</button>
                            </div>
                          )}

                          {/* VENUE RENTAL GRID (temporada × día) */}
                          {secId === 'venue_rental' && (() => {
                            const vr: any = sections.venue_rental ?? {}
                            const tiers: string[] = Array.isArray(vr.day_tiers) ? vr.day_tiers : []
                            const rows: any[] = Array.isArray(vr.rows) ? vr.rows : []
                            const patchVr = (patch: any) => setSections(s => ({ ...s, venue_rental: { ...(s.venue_rental ?? {}), ...patch } }))
                            const tierCount = Math.max(tiers.length, 1)
                            return (
                              <div>
                                <input className="form-input" placeholder="Título (ej. Tarifas de alquiler)" value={vr.title ?? ''} onChange={e => patchVr({ title: e.target.value })} style={{ marginBottom: 6 }} />
                                <input className="form-input" placeholder="Intro breve (opc.)" value={vr.intro ?? ''} onChange={e => patchVr({ intro: e.target.value })} style={{ marginBottom: 10 }} />

                                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 4 }}>Columnas (días)</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                                  {tiers.map((t: string, ti: number) => (
                                    <div key={ti} style={{ display: 'flex', gap: 5 }}>
                                      <input className="form-input" placeholder="Ej. Sábados y festivos" value={t} onChange={e => patchVr({ day_tiers: tiers.map((x, i) => i === ti ? e.target.value : x) })} />
                                      <button type="button" style={{ ...removeBtn, width: 22, height: 22 }} onClick={() => patchVr({
                                        day_tiers: tiers.filter((_, i) => i !== ti),
                                        rows: rows.map(r => ({ ...r, prices: (r.prices ?? []).filter((_: any, i: number) => i !== ti) })),
                                      })}><X size={11} /></button>
                                    </div>
                                  ))}
                                  <button type="button" style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '2px 0' }}
                                    onClick={() => patchVr({ day_tiers: [...tiers, ''] })}>+ Añadir columna</button>
                                </div>

                                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 4 }}>Filas (temporadas)</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                                  {rows.map((row: any, ri: number) => (
                                    <div key={ri} style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                        <input className="form-input" placeholder="Temporada (ej. Junio, Julio)" value={row.season ?? ''} onChange={e => patchVr({ rows: rows.map((r, i) => i === ri ? { ...r, season: e.target.value } : r) })} />
                                        <button type="button" style={removeBtn} onClick={() => patchVr({ rows: rows.filter((_, i) => i !== ri) })}><X size={13} /></button>
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tierCount}, 1fr)`, gap: 5 }}>
                                        {Array.from({ length: tierCount }).map((_, ci) => (
                                          <input key={ci} className="form-input" placeholder={tiers[ci] || `Col ${ci + 1}`} value={row.prices?.[ci] ?? ''}
                                            onChange={e => {
                                              const newPrices = [...(row.prices ?? [])]
                                              while (newPrices.length < tierCount) newPrices.push('')
                                              newPrices[ci] = e.target.value
                                              patchVr({ rows: rows.map((r, i) => i === ri ? { ...r, prices: newPrices } : r) })
                                            }} />
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                  <button type="button" style={addBtn} onClick={() => patchVr({ rows: [...rows, { season: '', prices: Array(tierCount).fill('') }] })}>+ Añadir temporada</button>
                                </div>

                                <input className="form-input" placeholder="Notas al pie (opc. ej. '21% IVA no incluido')" value={vr.notes ?? ''} onChange={e => patchVr({ notes: e.target.value })} />
                              </div>
                            )
                          })()}

                          {/* COLLABORATORS */}
                          {secId === 'collaborators' && (
                            <div>
                              {(getOverride(overrideKey) ?? []).map((c: any, i: number) => (
                                <details key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden', background: 'var(--surface)' }}>
                                  <summary style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--charcoal)', fontWeight: 500, background: 'var(--cream)', listStyle: 'none' }}>
                                    <ChevronDown size={12} style={{ color: 'var(--warm-gray)' }} />
                                    <span style={{ flex: 1 }}>{c.name || <em style={{ color: 'var(--warm-gray)' }}>Nuevo colaborador</em>}{c.category ? <span style={{ color: 'var(--warm-gray)', fontSize: 11, marginLeft: 6 }}>· {c.category}</span> : null}</span>
                                    <button type="button" style={removeBtn} onClick={e => { e.preventDefault(); e.stopPropagation(); removeOverrideItem(overrideKey, i) }}><X size={13} /></button>
                                  </summary>
                                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <input className="form-input" placeholder="Nombre *" value={c.name ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'name', e.target.value)} />
                                      <input className="form-input" style={{ width: 160, flexShrink: 0 }} placeholder="Categoría (ej. Catering)" value={c.category ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'category', e.target.value)} />
                                    </div>
                                    <input className="form-input" placeholder="Descripción" value={c.description ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'description', e.target.value)} />
                                    <input className="form-input" placeholder="Web (opcional)" value={c.website ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'website', e.target.value)} />
                                  </div>
                                </details>
                              ))}
                              <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { name: '', category: '', description: '', website: '' })}>+ Añadir colaborador</button>
                            </div>
                          )}

                          {/* EXPERIENCE */}
                          {secId === 'experience' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <input className="form-input" placeholder="Título (ej. Una finca del siglo XVII...)" value={(sections as any).experience_override?.title ?? ''} onChange={e => setOverride('experience_override', { ...((sections as any).experience_override ?? {}), title: e.target.value })} />
                              <textarea className="form-textarea" style={{ minHeight: 120 }} placeholder="Texto de la experiencia / historia del venue..." value={(sections as any).experience_override?.body ?? ''} onChange={e => setOverride('experience_override', { ...((sections as any).experience_override ?? {}), body: e.target.value })} />
                            </div>
                          )}

                          {/* TESTIMONIALS */}
                          {secId === 'testimonials' && (
                            <div>
                              {(getOverride(overrideKey) ?? []).map((t: any, i: number) => (
                                <details key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden', background: 'var(--surface)' }}>
                                  <summary style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--charcoal)', fontWeight: 500, background: 'var(--cream)', listStyle: 'none' }}>
                                    <ChevronDown size={12} style={{ color: 'var(--warm-gray)' }} />
                                    <span style={{ flex: 1 }}>{t.couple_name || <em style={{ color: 'var(--warm-gray)' }}>Nuevo testimonio</em>}{t.wedding_date ? <span style={{ color: 'var(--warm-gray)', fontSize: 11, marginLeft: 6 }}>· {t.wedding_date}</span> : null}</span>
                                    <button type="button" style={removeBtn} onClick={e => { e.preventDefault(); e.stopPropagation(); removeOverrideItem(overrideKey, i) }}><X size={13} /></button>
                                  </summary>
                                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <input className="form-input" placeholder="Nombres pareja (ej. Marina & David)" value={t.couple_name ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'couple_name', e.target.value)} />
                                      <input className="form-input" type="date" style={{ width: 160, flexShrink: 0 }} value={t.wedding_date ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'wedding_date', e.target.value)} />
                                    </div>
                                    <textarea className="form-textarea" style={{ minHeight: 80 }} placeholder="Testimonio..." value={t.text ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'text', e.target.value)} />
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
                                      <label style={{ color: 'var(--warm-gray)' }}>Estrellas:</label>
                                      <input className="form-input" type="number" min={1} max={5} style={{ width: 70 }} value={t.rating ?? 5} onChange={e => updateOverrideItem(overrideKey, i, 'rating', Number(e.target.value) || 5)} />
                                    </div>
                                  </div>
                                </details>
                              ))}
                              <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { couple_name: '', text: '', wedding_date: '', rating: 5 })}>+ Añadir testimonio</button>
                            </div>
                          )}

                          {secId === 'welcome' && (
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <textarea className="form-textarea" style={{ minHeight: 80 }} placeholder="Mensaje personalizado para la pareja..." value={form.personal_message ?? ''} onChange={e => setForm(f => ({ ...f, personal_message: e.target.value }))} />
                            </div>
                          )}

                          {secId === 'availability' && (
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <textarea className="form-textarea" style={{ minHeight: 70 }} placeholder="Ej. Fecha disponible, confirmación prioritaria..." value={sections.availability_message ?? ''} onChange={e => setSections(s => ({ ...s, availability_message: e.target.value }))} />
                            </div>
                          )}

                          {secId === 'map' && (() => {
                            const extractEmbedSrc = (raw: string): string => {
                              const trimmed = raw.trim()
                              if (!trimmed) return ''
                              // Si pegan el iframe HTML completo, extraer el src
                              const m = trimmed.match(/src\s*=\s*["']([^"']+)["']/i)
                              if (m) return m[1]
                              return trimmed
                            }
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">Código embed de Google Maps</label>
                                  <textarea className="form-textarea" style={{ minHeight: 70, fontFamily: 'ui-monospace, monospace', fontSize: 11 }}
                                    placeholder={'Pega aquí el <iframe src="..."> de Google Maps'}
                                    value={sections.map_embed_url ?? ''}
                                    onChange={e => setSections(s => ({ ...s, map_embed_url: extractEmbedSrc(e.target.value) }))} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">Dirección</label>
                                  <input className="form-input" placeholder="Calle, ciudad" value={sections.map_address ?? ''} onChange={e => setSections(s => ({ ...s, map_address: e.target.value }))} />
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.6, background: 'var(--cream)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                                  <strong style={{ color: 'var(--charcoal)' }}>Cómo obtener el embed:</strong><br />
                                  1. Ve a <a href="https://www.google.com/maps" target="_blank" rel="noopener" style={{ color: 'var(--gold)' }}>Google Maps</a> y busca tu venue<br />
                                  2. Clica <strong>Compartir</strong> → pestaña <strong>Insertar un mapa</strong><br />
                                  3. Copia el <code style={{ background: 'var(--surface)', padding: '1px 4px', borderRadius: 3 }}>&lt;iframe src="…"&gt;</code> completo y pégalo arriba
                                </div>
                              </div>
                            )
                          })()}

                          {secId === 'accommodation' && (() => {
                            const acc: any = sections.accommodation ?? {}
                            const setAcc = (patch: any) => setSections(s => ({ ...s, accommodation: { ...(s.accommodation ?? {}), ...patch } }))
                            const options: any[] = Array.isArray(acc.options) ? acc.options : []
                            const setOptions = (next: any[]) => setAcc({ options: next })
                            return (
                              <>
                                <div className="form-group">
                                  <label className="form-label">Descripción general</label>
                                  <textarea className="form-textarea" style={{ minHeight: 70 }} value={acc.description ?? ''} onChange={e => setAcc({ description: e.target.value })} placeholder="La masía dispone de…" />
                                </div>
                                <div className="form-group">
                                  <label className="form-label">Nº de habitaciones / descripción corta</label>
                                  <input className="form-input" value={acc.rooms ?? ''} onChange={e => setAcc({ rooms: e.target.value })} placeholder="5 suites dobles · 1 suite nupcial" />
                                </div>

                                {/* Opciones estructuradas con precios por temporada */}
                                <div className="form-group" style={{ background: 'var(--cream)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                                  <label className="form-label" style={{ fontSize: 11 }}>Opciones de alojamiento con precios</label>
                                  {options.map((opt: any, oi: number) => {
                                    const prices: any[] = Array.isArray(opt.prices) ? opt.prices : []
                                    const patchOpt = (p: any) => setOptions(options.map((o, i) => i === oi ? { ...o, ...p } : o))
                                    return (
                                      <div key={oi} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                          <input className="form-input" placeholder="Etiqueta * (ej. Suite Nupcial)" value={opt.label ?? ''} onChange={e => patchOpt({ label: e.target.value })} />
                                          <button type="button" style={removeBtn} onClick={() => setOptions(options.filter((_, i) => i !== oi))}><X size={13} /></button>
                                        </div>
                                        <input className="form-input" placeholder="Descripción breve (opcional)" value={opt.description ?? ''} onChange={e => patchOpt({ description: e.target.value })} />
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--charcoal)', cursor: 'pointer' }}>
                                          <input type="checkbox" checked={!!opt.included} onChange={e => patchOpt({ included: e.target.checked })} />
                                          Incluido en la tarifa del venue
                                        </label>
                                        {!opt.included && (
                                          <>
                                            <input className="form-input" placeholder="Precio libre (opc. ej. 'Desde 120€/noche')" value={opt.price_info ?? ''} onChange={e => patchOpt({ price_info: e.target.value })} />
                                            <div style={{ fontSize: 10, color: 'var(--warm-gray)', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', marginTop: 2 }}>Precios por temporada</div>
                                            {prices.map((p: any, pi: number) => (
                                              <div key={pi} style={{ display: 'flex', gap: 5 }}>
                                                <input className="form-input" placeholder="Temporada (ej. Alta / May-Oct)" value={p.season ?? ''} onChange={e => patchOpt({ prices: prices.map((x, i) => i === pi ? { ...x, season: e.target.value } : x) })} />
                                                <input className="form-input" placeholder="Precio (ej. 4.000€/noche)" style={{ width: 170 }} value={p.price ?? ''} onChange={e => patchOpt({ prices: prices.map((x, i) => i === pi ? { ...x, price: e.target.value } : x) })} />
                                                <button type="button" style={{ ...removeBtn, width: 22, height: 22 }} onClick={() => patchOpt({ prices: prices.filter((_, i) => i !== pi) })}><X size={11} /></button>
                                              </div>
                                            ))}
                                            <button type="button" style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '2px 0' }}
                                              onClick={() => patchOpt({ prices: [...prices, { season: '', price: '' }] })}>
                                              + Añadir temporada
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )
                                  })}
                                  <button type="button" style={addBtn} onClick={() => setOptions([...options, { label: '', prices: [] }])}>+ Añadir opción de alojamiento</button>
                                </div>

                                <div className="form-group">
                                  <label className="form-label">Info de precio (fallback libre)</label>
                                  <input className="form-input" value={acc.price_info ?? ''} onChange={e => setAcc({ price_info: e.target.value })} placeholder="Si no usas opciones, texto libre. Ej: Desde 120€/noche" />
                                </div>
                                <div className="form-group">
                                  <label className="form-label">Alojamiento cercano</label>
                                  <textarea className="form-textarea" style={{ minHeight: 50 }} value={acc.nearby ?? ''} onChange={e => setAcc({ nearby: e.target.value })} placeholder="Hoteles y turismo rural cercanos" />
                                </div>
                              </>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* ══ TAB: MENÚS ══ */}
          {activeTab === 'menus' && (
            <ProposalMenuEditor sections={sections} setSections={setSections} />
          )}
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

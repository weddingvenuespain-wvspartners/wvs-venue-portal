'use client'
import { useEffect, useState, useRef, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Check, X, AlertCircle, ChevronDown, ArrowLeft, Copy, ChefHat, Lock, RefreshCw, Eye, EyeOff } from 'lucide-react'
import type { SectionsData, VenueSpaceGroup } from '@/lib/proposal-types'
import { GOOGLE_FONTS, FONT_CATEGORIES, ALL_FONTS_URL, getFontByValue } from '@/lib/fonts'
import { useUnsavedChanges } from '@/lib/use-unsaved-changes'
import ProposalPreview from './ProposalPreview'
import ProposalMenuEditor from './ProposalMenuEditor'
import SpaceGroupEditor from './SpaceGroupEditor'
import MultipleZonesEditor from './MultipleZonesEditor'
import ProposalDateModal from './ProposalDateModal'
import { ImageUploader } from './ImageUploader'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Checkbox } from '@/components/ui/checkbox'
import { INCLUSION_ICON_CHOICES } from '@/app/proposal/[slug]/tpl/shared'
import { isSectionAllowed, getSectionLabel } from '@/lib/section-visibility'
import { getLeadDateRanges } from '@/lib/lead-dates'
import { DEFAULT_TEMPLATES } from '@/lib/proposal-starter-templates'

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
  modality_id?: string | null
  sections_data?: SectionsData | null
  template_id?: string | null
  branding?: { logo_url: string | null; primary_color: string; font_family?: string } | null
  access_password?: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLORS = ['#2d4a7a', '#7a5c3c', '#6b2d42', '#2a6b4a', '#4a4a4a', '#8b6914']

const SECTION_LABELS: Record<string, string> = {
  hero: 'Foto principal',
  date_slots: 'Fechas disponibles',
  availability: 'Disponibilidad',
  sticky_nav: 'Menú de navegación (sticky top)',
  welcome: 'Bienvenida · Oscura (cita centrada)',
  welcome_light: 'Bienvenida · Fondo claro',
  welcome_split: 'Bienvenida · Dos columnas',
  welcome_editorial: 'Bienvenida · Editorial (tipografía grande)',
  experience: 'La experiencia',
  gallery: 'Galería de fotos',
  single_space: 'Tu espacio',
  zones: 'Zonas del venue',
  space_groups: 'Grupos de espacios',
  venue_rental: 'Tarifas de alquiler (grid temporada × día)',
  inclusions: 'Qué incluye',
  testimonials: 'Testimonios',
  collaborators: 'Colaboradores',
  accommodation: 'Alojamiento',
  extra_services: 'Servicios adicionales',
  faq: 'Preguntas frecuentes',
  schedule_visit: 'Agendar visita',
  map: 'Mapa y ubicación',
  contact: 'Datos de contacto',
}

const emptySections: SectionsData = {
  visual_template_id: 1,
  availability_message: '',
  accommodation: {},
  sections_enabled: {},
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ModalityPrice = { id: string; date_from: string; date_to: string; price: number; notes?: string | null }

const DAYS_ES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']

function getDayLabel(from: number, to: number): string {
  if (from === to) return DAYS_ES[from] ?? ''
  return `${DAYS_ES[from] ?? ''} → ${DAYS_ES[to] ?? ''}`
}

function formatSeasonLabel(dateFrom: string, dateTo: string): string {
  const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const f = new Date(dateFrom + 'T12:00:00')
  const t = new Date(dateTo + 'T12:00:00')
  const fStr = `${f.getDate()} ${MONTHS[f.getMonth()]}`
  const tStr = `${t.getDate()} ${MONTHS[t.getMonth()]}`
  return `${fStr} – ${tStr}`
}

function getDefaultSections(cfg: { space_type: string; price_model: string; menu_included?: boolean; has_menu_types?: boolean; catering_own?: boolean }): Record<string, boolean> {
  const hasOwnMenu = cfg.menu_included === true || cfg.catering_own === true
  return {
    hero:             true,
    availability:     false,
    sticky_nav:       false,
    welcome:          true,
    welcome_light:    false,
    welcome_split:    false,
    welcome_editorial: false,
    experience:       true,
    gallery:          true,
    single_space:     cfg.space_type === 'single' || cfg.space_type === 'single_with_supplements',
    zones:            cfg.space_type === 'single_with_supplements',
    space_groups:     cfg.space_type === 'multiple_independent' || cfg.space_type === 'single_with_supplements',
    venue_rental:     cfg.price_model === 'rental' && cfg.space_type !== 'multiple_independent',
    inclusions:       cfg.price_model === 'package' && cfg.menu_included !== false,
    testimonials:     true,
    collaborators:    false,
    accommodation:    false,
    extra_services:   cfg.space_type === 'single_with_supplements' || cfg.space_type === 'multiple_independent',
    faq:              false,
    schedule_visit:   false,
    map:              true,
    contact:          true,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProposalEditor({ proposal: initial }: { proposal: EditorProposal }) {
  const router = useRouter()
  const { user, activeVenue } = useAuth()

  const [proposal, setProposal] = useState<EditorProposal>(initial)
  const [leads, setLeads] = useState<any[]>([])
  const [templates, setTemplates] = useState<ProposalTemplate[]>([])
  const [venue, setVenue] = useState<any>(null)

  const [modalities, setModalities] = useState<any[]>([])
  const [commercialConfig, setCommercialConfig] = useState<{ space_type: string; price_model: string } | null>(null)
  const [venueSpaceGroups, setVenueSpaceGroups] = useState<VenueSpaceGroup[]>([])
  const [menuCatalog, setMenuCatalog] = useState<SectionsData | null>(null)
  const [contentTemplates, setContentTemplates] = useState<Array<{ id: string; name: string; description: string | null; sections_data: SectionsData; is_default: boolean }>>([])
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [showDateModal, setShowDateModal] = useState(false)
  const [editLeadDates, setEditLeadDates] = useState(false)
  const [leadDatesForm, setLeadDatesForm] = useState<any>(null)
  const [savingLeadDates, setSavingLeadDates] = useState(false)
  const [showTemplateList, setShowTemplateList] = useState(false)
  const [showFontList, setShowFontList] = useState(false)

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
    primary_color: initial.branding?.primary_color ?? (initial.sections_data as any)?.primary_color ?? '#2d4a7a',
    logo_url: initial.branding?.logo_url ?? (initial.sections_data as any)?.logo_url ?? null as string | null,
    font_family: initial.branding?.font_family ?? (initial.sections_data as any)?.font_family ?? 'Georgia, serif',
    template_id: initial.template_id ?? '',
    modality_id: initial.modality_id ?? '',
    access_password: initial.access_password ?? '',
    password_protected: !!initial.access_password,
  })
  const [sections, setSections] = useState<SectionsData>({ ...emptySections, ...(initial.sections_data ?? {}) })
  const [activeTab, setActiveTab] = useState<'datos' | 'visual' | 'secciones' | 'menus'>('datos')
  const [openSecs, setOpenSecs] = useState<Set<string>>(new Set(['__space_group']))

  // Si desactivan catering y estaban en la tab de menús, volver a secciones
  useEffect(() => {
    if (activeTab === 'menus' && sections.has_catering === false) setActiveTab('secciones')
  }, [activeTab, sections.has_catering])

  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err: boolean } | null>(null)

  // Snapshot del estado guardado para detectar cambios sin guardar
  const savedSnapshotRef = useRef(JSON.stringify({ form, sections }))
  const isDirty = JSON.stringify({ form, sections }) !== savedSnapshotRef.current
  const { confirmLeave } = useUnsavedChanges(isDirty)

  // Load secondary data (leads, templates, venue) once
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    ;(async () => {
      const [{ data: leadsData }, { data: tplData }, { data: venueRow }, { data: settingsRow }, modalRes, ctplRes] = await Promise.all([
        supabase.from('leads').select('id, name, guests, email, wedding_date, wedding_date_to, wedding_date_ranges, date_flexibility, wedding_year, wedding_month, wedding_season').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('proposal_web_templates').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('venue_onboarding').select('name, city, region, contact_email, contact_phone, website, photo_urls').eq('user_id', user.id).maybeSingle(),
        (activeVenue?.id
          ? supabase.from('venue_settings').select('commercial_config, menu_catalog, space_groups').eq('user_id', user.id).eq('venue_id', activeVenue.id).limit(1)
          : supabase.from('venue_settings').select('commercial_config, menu_catalog, space_groups').eq('user_id', user.id).limit(1)),
        fetch('/api/estructura/modalities'),
        fetch('/api/proposal-templates'),
      ])
      if (leadsData) setLeads(leadsData)
      if (tplData) setTemplates(tplData as ProposalTemplate[])
      if (venueRow) setVenue(venueRow)
      const settingsRow0 = Array.isArray(settingsRow) ? settingsRow[0] : settingsRow
      const cfg = settingsRow0?.commercial_config as { space_type: string; price_model: string } | null
      if (cfg) setCommercialConfig(cfg)
      if (settingsRow0?.menu_catalog) setMenuCatalog(settingsRow0.menu_catalog as SectionsData)

      const spaceGroups = Array.isArray(settingsRow0?.space_groups) ? settingsRow0.space_groups as VenueSpaceGroup[] : []
      if (spaceGroups.length) setVenueSpaceGroups(spaceGroups)

      let loadedModalities: any[] = []
      if (modalRes.ok) { const mj = await modalRes.json(); loadedModalities = mj.modalities ?? []; setModalities(loadedModalities) }
      if (ctplRes.ok) { const ct = await ctplRes.json(); setContentTemplates(Array.isArray(ct) ? ct : []) }

      // ── Auto-populate sections for NEW proposals ──────────────────────────
      const isNew = !initial.sections_data || Object.keys(initial.sections_data.sections_enabled ?? {}).length === 0
      // If proposal was seeded from a content template, skip overwriting content sections
      // (only allow sections_enabled to be auto-set from venue defaults)
      const fromTemplate = !!(initial.sections_data as any)?.content_template_id
      if (isNew && cfg) {
        const autoPatch: Partial<SectionsData> = {
          sections_enabled: getDefaultSections(cfg),
        }

        // Task 2: Auto-populate space_groups from venue config
        if (!fromTemplate && (cfg.space_type === 'multiple_independent' || cfg.space_type === 'single_with_supplements') && spaceGroups.length > 0) {
          // Gather supplement prices from modality tariffs: {zone_id → [{season_label, price}]}
          const modPrices: any[] = loadedModalities[0]?.prices ?? loadedModalities[0]?.packages?.flatMap((p: any) => p.prices ?? []) ?? []
          const suppPricesByZone: Record<string, Array<{label: string; price: string}>> = {}
          for (const p of modPrices) {
            const supp = p.supplement_prices ?? {}
            for (const [zoneId, price] of Object.entries(supp)) {
              if (!suppPricesByZone[zoneId]) suppPricesByZone[zoneId] = []
              const label = p.season ?? [p.date_from, p.date_to].filter(Boolean).join(' – ') ?? 'Temporada'
              suppPricesByZone[zoneId].push({ label, price: String(price) })
            }
          }

          autoPatch.space_groups = spaceGroups.map(vg => {
            const includedIds = new Set(vg.included_zone_ids ?? [])
            return {
              group_id: vg.id,
              name: vg.name,
              description: '',
              note: '',
              selection_mode: vg.selection_mode,
              pick_n_min: vg.pick_n_min,
              pick_n_max: vg.pick_n_max,
              included_zone_ids: vg.included_zone_ids,
              pricing_mode: vg.pricing_mode ?? 'per_space',
              base_price: vg.base_price ?? '',
              spaces: vg.spaces.map(vs => {
                const isIncluded = includedIds.has(vs.id)
                const suppTiers = suppPricesByZone[vs.id] ?? []
                // For selectable (supplement) zones: use tariff prices if available
                const price = isIncluded ? '' : (vs.price ?? (suppTiers.length === 1 ? `+${suppTiers[0].price}€` : ''))
                const priceTiers = !isIncluded && suppTiers.length > 1
                  ? suppTiers.map(t => ({ label: t.label, price: `+${t.price}€` }))
                  : undefined
                return {
                  zone_id: vs.id,
                  name: vs.name,
                  description: vs.description ?? '',
                  price,
                  ...(priceTiers ? { price_tiers: priceTiers } : {}),
                  capacity_min: vs.capacity_min,
                  capacity_max: vs.capacity_max,
                }
              }),
            }
          })
        }

        // Task 3: Auto-populate venue_rental grid from modality tariffs
        if (!fromTemplate && cfg.price_model === 'rental' && loadedModalities.length > 0) {
          const mod = loadedModalities[0] // use first (or selected) modality
          const allPrices: ModalityPrice[] = mod.duration_type === 'package'
            ? (mod.packages ?? []).flatMap((pkg: any) => pkg.prices ?? [])
            : (mod.prices ?? [])

          if (allPrices.length > 0) {
            // Day tiers = package labels (or single column for non-package)
            const dayTiers: string[] = mod.duration_type === 'package'
              ? (mod.packages ?? []).map((pkg: any) => pkg.label || getDayLabel(pkg.day_from, pkg.day_to))
              : ['Precio']

            // Seasons = unique date ranges across all prices
            const seasonMap = new Map<string, { season: string; date_from: string; date_to: string }>()
            allPrices.forEach(p => {
              const key = `${p.date_from}_${p.date_to}`
              if (!seasonMap.has(key)) {
                seasonMap.set(key, { season: formatSeasonLabel(p.date_from, p.date_to), date_from: p.date_from, date_to: p.date_to })
              }
            })
            const seasons = Array.from(seasonMap.values()).sort((a, b) => a.date_from.localeCompare(b.date_from))

            // Build rows: each season × each tier
            const rows = seasons.map(s => {
              const prices: string[] = mod.duration_type === 'package'
                ? (mod.packages ?? []).map((pkg: any) => {
                    const match = (pkg.prices ?? []).find((p: any) => p.date_from === s.date_from && p.date_to === s.date_to)
                    return match ? String(match.price) : ''
                  })
                : [String(allPrices.find(p => p.date_from === s.date_from && p.date_to === s.date_to)?.price ?? '')]
              return { season: s.season, prices }
            })

            autoPatch.venue_rental = { title: 'Tarifas de alquiler', intro: '', day_tiers: dayTiers, rows, notes: '' }
          }
        }

        // Task 4: Auto-populate packages from modality packages
        if (!fromTemplate && loadedModalities.length > 0) {
          const mod = loadedModalities[0]
          if (mod.duration_type === 'package' && (mod.packages ?? []).length > 0) {
            autoPatch.packages_override = (mod.packages as any[]).map(pkg => ({
              name: pkg.label || getDayLabel(pkg.day_from, pkg.day_to),
              description: mod.description ?? '',
              price: '',
            }))
          }
        }

        setSections(prev => ({ ...prev, ...autoPatch }))
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

  // Re-group date slots with prices when modalities load for existing proposals
  useEffect(() => {
    if (!modalities.length || !form.modality_id) return
    const currentSlots: any[] = (sections as any).date_slots ?? []
    if (!currentSlots.length) return
    // Check if any slot is missing price info — if so, regroup
    const missingPrices = currentSlots.some((s: any) => !s.price_rental && !s.price_per_person)
    if (missingPrices) regroupDateSlots(form.modality_id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalities])

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
    const url = await uploadImage(file, 'logos')
    if (url) setForm(f => ({ ...f, logo_url: url }))
  }
  const handleHeroUpload = async (file: File) => {
    const url = await uploadImage(file, 'hero')
    if (url) setSections(s => ({ ...s, hero_image_url: url }))
  }

  // ── Save
  const handleSave = async () => {
    if (!form.couple_name.trim()) { notify('El nombre de la pareja es obligatorio', true); return }
    setSaving(true)
    const supabase = createClient()

    const cleanSections: SectionsData = { ...sections }

    const accessPassword = form.password_protected && form.access_password.trim()
      ? form.access_password.trim()
      : null

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
      modality_id: form.modality_id || null,
      access_password: accessPassword,
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

  // Auto-fill price from modality when modality + wedding_date are both set
  // Mon=0 … Sun=6 (same convention as WeekDayPicker)
  const weddingDayOfWeek = (weddingDate: string): number => {
    const jsDay = new Date(weddingDate + 'T12:00:00').getDay()
    return (jsDay + 6) % 7
  }

  const getPriceForDate = (modalityId: string, weddingDate: string): number | null => {
    const modality = modalities.find(m => m.id === modalityId)
    if (!modality || !weddingDate) return null

    if (modality.duration_type === 'package') {
      // Find the package whose check-in day matches the day of the week
      const dow = weddingDayOfWeek(weddingDate)
      const pkg = (modality.packages ?? []).find((p: any) => p.day_from === dow)
      if (!pkg?.prices?.length) return null
      const match = pkg.prices.find((p: any) => weddingDate >= p.date_from && weddingDate <= p.date_to)
      return match ? parseFloat(match.price) : null
    }

    if (!modality.prices?.length) return null
    const match = modality.prices.find((p: any) => weddingDate >= p.date_from && weddingDate <= p.date_to)
    if (!match) return null
    // For single_with_supplements / multiple_independent, base price is in group_prices[0].base_price (top-level price is always 0)
    if ((match.price === 0 || match.price === '0' || match.price == null) && Array.isArray(match.group_prices) && match.group_prices.length > 0) {
      const bp = match.group_prices[0].base_price
      return bp != null ? parseFloat(bp) : null
    }
    return parseFloat(match.price)
  }

  const getMatchedPackageLabel = (modalityId: string, weddingDate: string): string | null => {
    const modality = modalities.find(m => m.id === modalityId)
    if (modality?.duration_type !== 'package' || !weddingDate) return null
    const dow = weddingDayOfWeek(weddingDate)
    const pkg = (modality.packages ?? []).find((p: any) => p.day_from === dow)
    if (!pkg) return null
    if (pkg.label) return pkg.label
    const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
    return pkg.day_from === pkg.day_to ? DAYS[pkg.day_from] : `${DAYS[pkg.day_from]} → ${DAYS[pkg.day_to]}`
  }

  // Re-group existing date_slots by price when modality changes or dates exist without prices
  const regroupDateSlots = (modalityId: string) => {
    setSections((s: any) => {
      const currentSlots: any[] = s.date_slots ?? []
      if (!currentSlots.length) return s
      // Collect all dates from all slots
      const allDates: string[] = currentSlots.flatMap((slot: any) => slot.dates ?? []).filter(Boolean)
      if (!allDates.length) return s

      const priceGroups = new Map<string, string[]>()
      for (const d of allDates) {
        const price = getPriceForDate(modalityId, d)
        const key = price !== null ? String(price) : 'none'
        if (!priceGroups.has(key)) priceGroups.set(key, [])
        priceGroups.get(key)!.push(d)
      }

      if (priceGroups.size > 1) {
        const newSlots = Array.from(priceGroups.entries()).map(([priceKey, slotDates]) => ({
          label: '',
          dates: slotDates,
          price_rental: priceKey !== 'none' ? `${Number(priceKey).toLocaleString('es-ES')} €` : '',
          price_per_person: '',
          notes: '',
        }))
        return { ...s, date_slots: newSlots, sections_enabled: { ...s.sections_enabled, date_slots: true } }
      } else {
        const price = getPriceForDate(modalityId, allDates[0])
        return {
          ...s,
          date_slots: [{
            label: currentSlots.length === 1 && currentSlots[0].label ? currentSlots[0].label : 'Fechas propuestas',
            dates: allDates,
            price_rental: price !== null ? `${price.toLocaleString('es-ES')} €` : '',
            price_per_person: currentSlots[0]?.price_per_person ?? '',
            notes: currentSlots[0]?.notes ?? '',
          }],
          sections_enabled: { ...s.sections_enabled, date_slots: true },
        }
      }
    })
  }

  const onModalityChange = (modalityId: string) => {
    const price = modalityId && form.wedding_date ? getPriceForDate(modalityId, form.wedding_date) : null
    setForm(f => ({ ...f, modality_id: modalityId, ...(price !== null ? { price_estimate: String(price) } : {}) }))
    if (modalityId) regroupDateSlots(modalityId)
    // Recalculate non-overridden date_prices using day-by-day price split
    const lead = leads.find(l => l.id === form.lead_id)
    if (lead) {
      const computed = computeDatePrices(lead, modalityId)
      if (computed) setSections((s: any) => ({ ...s, single_space: { ...(s.single_space ?? {}), date_prices: computed } }))
    }
  }

  const onWeddingDateChange = (date: string) => {
    const price = form.modality_id && date ? getPriceForDate(form.modality_id, date) : null
    setForm(f => ({ ...f, wedding_date: date, ...(price !== null ? { price_estimate: String(price) } : {}) }))
  }

  const computeDatePrices = (lead: any, modalityId: string | null, modalitiesOverride?: any[]) => {
    const ranges = getLeadDateRanges(lead)
    if (!ranges.length || !modalityId) return null

    const mods = modalitiesOverride ?? modalities
    const modality = mods.find((m: any) => m.id === modalityId)
    if (!modality) return null

    const getPriceFn = (wDate: string): number | null => {
      if (!modality.prices?.length) return null
      const match = modality.prices.find((p: any) => wDate >= p.date_from && wDate <= p.date_to)
      if (!match) return null
      if ((match.price === 0 || match.price === '0' || match.price == null) && Array.isArray(match.group_prices) && match.group_prices.length > 0) {
        const bp = match.group_prices[0].base_price
        return bp != null ? parseFloat(bp) : null
      }
      return parseFloat(match.price)
    }

    const addDays = (iso: string, n: number) => {
      const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n)
      return d.toISOString().slice(0, 10)
    }
    const diffDays = (a: string, b: string) =>
      Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)

    const result: any[] = []

    for (const r of ranges) {
      if (!r.to || r.to === r.from) {
        const p = getPriceFn(r.from)
        result.push({ date_from: r.from, date_to: r.to, price_min: p !== null ? String(p) : undefined, overridden: false })
        continue
      }
      // Walk day by day, group consecutive days with same price into sub-ranges
      const totalDays = diffDays(r.from, r.to)
      let subStart = r.from
      let subPrice = getPriceFn(r.from)
      for (let i = 1; i <= totalDays; i++) {
        const day = addDays(r.from, i)
        const dayPrice = getPriceFn(day)
        if (dayPrice !== subPrice || i === totalDays) {
          const subEnd = i === totalDays && dayPrice === subPrice ? day : addDays(r.from, i - 1)
          result.push({
            date_from: subStart,
            date_to: subEnd === subStart ? undefined : subEnd,
            price_min: subPrice !== null ? String(subPrice) : undefined,
            overridden: false,
          })
          if (i === totalDays && dayPrice !== subPrice) {
            result.push({ date_from: day, date_to: undefined, price_min: dayPrice !== null ? String(dayPrice) : undefined, overridden: false })
          }
          subStart = day
          subPrice = dayPrice
        }
      }
    }

    // Sort chronologically before merging (lead ranges may be unordered)
    result.sort((a, b) => a.date_from.localeCompare(b.date_from))

    // Merge adjacent entries with same price into one range
    const merged: any[] = []
    for (const entry of result) {
      const prev = merged[merged.length - 1]
      const prevEnd = prev?.date_to ?? prev?.date_from
      const isAdjacent = prev && prev.price_min === entry.price_min && prevEnd && addDays(prevEnd, 1) === entry.date_from
      if (isAdjacent) {
        merged[merged.length - 1] = { ...prev, date_to: entry.date_to ?? entry.date_from }
      } else {
        merged.push(entry)
      }
    }

    return merged.some(r => r.price_min) ? merged : null
  }

  const recalculateWithFreshLead = async (leadId: string, modalityId: string | null) => {
    const supabase = createClient()
    // Fetch fresh lead AND fresh modality prices in parallel
    const [leadRes, modalRes] = await Promise.all([
      supabase.from('leads').select('id, name, guests, email, wedding_date, wedding_date_to, wedding_date_ranges, date_flexibility').eq('id', leadId).single(),
      fetch('/api/estructura/modalities'),
    ])
    const freshLead = leadRes.data
    if (!freshLead) return
    setLeads(prev => prev.map(l => l.id === leadId ? freshLead : l))

    let freshModalities: any[] = modalities
    if (modalRes.ok) {
      const mj = await modalRes.json()
      freshModalities = mj.modalities ?? []
      setModalities(freshModalities)
    }

    const effectiveId = modalityId ?? (freshModalities.length === 1 ? freshModalities[0].id : null)
    if (!effectiveId) return

    const computed = computeDatePrices(freshLead, effectiveId, freshModalities)
    if (computed) setSections((s: any) => ({ ...s, single_space: { ...(s.single_space ?? {}), date_prices: computed } }))
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
    if (lead) {
      const dp = computeDatePrices(lead, form.modality_id ?? null)
      if (dp) setSections((s: any) => ({ ...s, single_space: { ...(s.single_space ?? {}), date_prices: dp } }))
    }
  }

  const copyUrl = () => {
    const url = `${window.location.origin}/proposal/${proposal.slug}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Listado combinado: muestras estáticas (DEFAULT_TEMPLATES) + plantillas del usuario.
  // Las muestras llevan id 't1'..'t5'; las propias, UUIDs.
  type SelectorTemplate = {
    id: string
    name: string
    description: string | null
    sections_data: SectionsData
    is_default: boolean
    isSample: boolean
  }
  const allTemplates: SelectorTemplate[] = useMemo(() => {
    // Only show user's own templates — NOT the sample/default style templates
    return contentTemplates.map(t => ({
      id: t.id, name: t.name, description: t.description,
      sections_data: t.sections_data, is_default: t.is_default, isSample: false,
    }))
  }, [contentTemplates])

  // ── Apply a content template to sections (con confirm si sobrescribe overrides)
  const applyContentTemplate = (templateId: string) => {
    const tpl = allTemplates.find(t => t.id === templateId)
    if (!tpl) return
    const sd = tpl.sections_data ?? {}

    // Detectar override-keys que la plantilla define Y que el usuario ya tiene
    // editados con contenido. Solo esas se sobrescribirán de forma destructiva.
    const OVERRIDE_LABELS: Record<string, string> = {
      zones_override:          'zonas',
      space_groups:            'grupos de espacios',
      menus_override:          'menús',
      menu_extras_override:    'extras de menú',
      appetizers_base_override:'aperitivos',
      inclusions_override:     'qué incluye',
      testimonials_override:   'testimonios',
      collaborators_override:  'colaboradores',
      extra_services_override: 'servicios adicionales',
      faq_override:            'preguntas frecuentes',
      packages_override:       'paquetes',
      experience_override:     'la experiencia',
      venue_rental:            'tarifas de alquiler',
      single_space:            'tu espacio',
      accommodation:           'alojamiento',
    }
    const conflicting = Object.entries(OVERRIDE_LABELS)
      .filter(([key]) => {
        const incoming = (sd as any)[key]
        const current  = (sections as any)[key]
        if (incoming == null) return false        // template doesn't define this → no conflict
        if (current  == null) return false        // user has nothing → no conflict
        if (Array.isArray(current) && current.length === 0) return false
        if (typeof current === 'object' && Object.keys(current).length === 0) return false
        return true
      })
      .map(([, label]) => label)

    if (conflicting.length > 0) {
      const list = conflicting.length > 4
        ? conflicting.slice(0, 4).join(', ') + ` y ${conflicting.length - 4} más`
        : conflicting.join(', ')
      const ok = confirm(`Aplicar "${tpl.name}" sobrescribirá: ${list}.\n\nEl resto de tus cambios se mantienen. ¿Continuar?`)
      if (!ok) return
    }

    setApplyingTemplate(true)
    setSections(s => ({
      ...s,
      ...sd,
      content_template_id: templateId,
    }))
    // Also apply visual branding from template if set
    if (sd.primary_color) setForm(f => ({ ...f, primary_color: sd.primary_color! }))
    if (sd.font_family)   setForm(f => ({ ...f, font_family: sd.font_family! }))
    if (sd.logo_url)      setForm(f => ({ ...f, logo_url: sd.logo_url! }))
    setTimeout(() => setApplyingTemplate(false), 500)
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
  const moveOverrideItem = (key: string, i: number, dir: -1 | 1) => {
    const arr = [...((sections as any)[key] ?? [])]
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setOverride(key, arr)
  }

  // ── Build preview patch — what the iframe sees as the live state
  const previewPatch = useMemo(() => {
    const cleanSections: SectionsData = { ...sections }
    // Merge live included_zone_ids + selection_mode from venueSpaceGroups into space_groups
    // so preview receives correct ITP config even for proposals created before this was stored
    if (Array.isArray((cleanSections as any).space_groups) && venueSpaceGroups.length > 0) {
      (cleanSections as any).space_groups = (cleanSections as any).space_groups.map((sg: any) => {
        const vg = venueSpaceGroups.find(v => v.id === (sg.group_id ?? sg.id))
        if (!vg) return sg
        return {
          ...sg,
          selection_mode: vg.selection_mode,
          pick_n_min: vg.pick_n_min,
          pick_n_max: vg.pick_n_max,
          included_zone_ids: vg.included_zone_ids,
          pricing_mode: vg.pricing_mode ?? 'per_space',
          spaces: Array.isArray(sg.spaces) ? sg.spaces.map((sp: any) => {
            const vs = vg.spaces.find(s => s.id === (sp.zone_id ?? sp.id))
            return vs ? { ...sp, zone_id: vs.id } : sp
          }) : sg.spaces,
        }
      })
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
        secondary_color: (sections as any).secondary_color ?? null,
        font_family: form.font_family,
      },
    }
  }, [form, sections, venueSpaceGroups])

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
                  <Select value={form.lead_id || '__none__'} onValueChange={(v) => onLeadChange(v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="— Sin lead —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Sin lead —</SelectItem>
                      {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.name}{l.guests ? ` · ${l.guests} inv.` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
              </div>

              {/* Fechas propuestas (lead) */}
              {(() => {
                const lead = leads.find(l => l.id === form.lead_id)
                if (!lead) return null
                const flex = lead.date_flexibility || 'exact'
                const fmtD = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                type Chip = { label: string }
                const chips: Chip[] = []
                if (flex === 'exact' && lead.wedding_date)
                  chips.push({ label: fmtD(lead.wedding_date) })
                else if (flex === 'range' && lead.wedding_date)
                  chips.push({ label: lead.wedding_date_to && lead.wedding_date_to !== lead.wedding_date ? `${fmtD(lead.wedding_date)} – ${fmtD(lead.wedding_date_to)}` : fmtD(lead.wedding_date) })
                else if (flex === 'multi_range')
                  (lead.wedding_date_ranges ?? []).filter((r: any) => r?.from).forEach((r: any) => chips.push({ label: r.to && r.to !== r.from ? `${fmtD(r.from)} – ${fmtD(r.to)}` : fmtD(r.from) }))
                else if (flex === 'month' && lead.wedding_month)
                  chips.push({ label: `${lead.wedding_month}${lead.wedding_year ? ' ' + lead.wedding_year : ''}` })
                else if (flex === 'season' && lead.wedding_season)
                  chips.push({ label: `${lead.wedding_season}${lead.wedding_year ? ' ' + lead.wedding_year : ''}` })
                else if (lead.wedding_year)
                  chips.push({ label: `Año ${lead.wedding_year}` })

                const saveLeadDates = async () => {
                  if (!leadDatesForm) return
                  setSavingLeadDates(true)
                  const supabase = createClient()
                  const payload: any = {
                    date_flexibility: leadDatesForm.date_flexibility,
                    wedding_date: leadDatesForm.wedding_date || null,
                    wedding_date_to: leadDatesForm.wedding_date_to || null,
                    wedding_date_ranges: leadDatesForm.date_flexibility === 'multi_range' ? leadDatesForm.wedding_date_ranges : null,
                    wedding_year: leadDatesForm.wedding_year || null,
                    wedding_month: leadDatesForm.wedding_month || null,
                    wedding_season: leadDatesForm.wedding_season || null,
                  }
                  await supabase.from('leads').update(payload).eq('id', lead.id)
                  setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...payload } : l))
                  setEditLeadDates(false)
                  setSavingLeadDates(false)
                }

                const ldf = leadDatesForm ?? lead
                const setLdf = (patch: any) => setLeadDatesForm((prev: any) => ({ ...(prev ?? lead), ...patch }))
                const currentFlex = ldf.date_flexibility || 'exact'

                return (
                  <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <label className="form-label" style={{ margin: 0, flex: 1 }}>Fechas propuestas</label>
                      <button type="button" onClick={() => { if (!editLeadDates) setLeadDatesForm(lead); setEditLeadDates(v => !v) }}
                        style={{ fontSize: 10, color: 'var(--warm-gray)', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '2px 8px', cursor: 'pointer' }}>
                        {editLeadDates ? 'Cancelar' : '✎ Editar'}
                      </button>
                    </div>

                    {!editLeadDates ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {chips.length ? chips.map((chip, ci) => (
                          <span key={ci} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--charcoal)' }}>
                            {chip.label}
                          </span>
                        )) : <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Sin fechas asignadas</span>}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--cream)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <select className="form-input" style={{ fontSize: 12 }} value={currentFlex} onChange={e => setLdf({ date_flexibility: e.target.value, wedding_date: '', wedding_date_to: '', wedding_date_ranges: [{ from: '', to: '' }] })}>
                          <option value="exact">Fecha exacta</option>
                          <option value="range">Rango de fechas</option>
                          <option value="multi_range">Varios rangos</option>
                          <option value="month">Mes</option>
                          <option value="season">Temporada</option>
                          <option value="flexible">Flexible</option>
                        </select>

                        {currentFlex === 'exact' && (
                          <DatePicker value={ldf.wedding_date ?? ''} onChange={v => setLdf({ wedding_date: v })} placeholder="Fecha" />
                        )}
                        {currentFlex === 'range' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <DatePicker value={ldf.wedding_date ?? ''} onChange={v => setLdf({ wedding_date: v })} placeholder="Desde" />
                            <DatePicker value={ldf.wedding_date_to ?? ''} onChange={v => setLdf({ wedding_date_to: v })} placeholder="Hasta" />
                          </div>
                        )}
                        {currentFlex === 'multi_range' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {(ldf.wedding_date_ranges ?? [{ from: '', to: '' }]).map((r: any, ri: number) => (
                              <div key={ri} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <DatePicker value={r.from ?? ''} onChange={v => { const next = [...(ldf.wedding_date_ranges ?? [])]; next[ri] = { ...next[ri], from: v }; setLdf({ wedding_date_ranges: next }) }} placeholder="Desde" />
                                <DatePicker value={r.to ?? ''} onChange={v => { const next = [...(ldf.wedding_date_ranges ?? [])]; next[ri] = { ...next[ri], to: v }; setLdf({ wedding_date_ranges: next }) }} placeholder="Hasta" />
                                <button type="button" style={removeBtn} onClick={() => setLdf({ wedding_date_ranges: (ldf.wedding_date_ranges ?? []).filter((_: any, j: number) => j !== ri) })}><X size={11} /></button>
                              </div>
                            ))}
                            <button type="button" style={addBtn} onClick={() => setLdf({ wedding_date_ranges: [...(ldf.wedding_date_ranges ?? []), { from: '', to: '' }] })}>+ Añadir rango</button>
                          </div>
                        )}
                        {(currentFlex === 'month' || currentFlex === 'season' || currentFlex === 'flexible') && (
                          <input className="form-input" style={{ fontSize: 12 }} placeholder="Año (ej. 2026)" type="number" value={ldf.wedding_year ?? ''} onChange={e => setLdf({ wedding_year: e.target.value ? Number(e.target.value) : null })} />
                        )}
                        {currentFlex === 'month' && (
                          <input className="form-input" style={{ fontSize: 12 }} placeholder="Mes (1-12)" type="number" min={1} max={12} value={ldf.wedding_month ?? ''} onChange={e => setLdf({ wedding_month: e.target.value ? Number(e.target.value) : null })} />
                        )}
                        {currentFlex === 'season' && (
                          <select className="form-input" style={{ fontSize: 12 }} value={ldf.wedding_season ?? ''} onChange={e => setLdf({ wedding_season: e.target.value })}>
                            <option value="">— Temporada —</option>
                            <option value="spring">Primavera</option>
                            <option value="summer">Verano</option>
                            <option value="autumn">Otoño</option>
                            <option value="winter">Invierno</option>
                          </select>
                        )}

                        <button type="button" className="btn btn-primary btn-sm" onClick={saveLeadDates} disabled={savingLeadDates}>
                          {savingLeadDates ? 'Guardando…' : 'Guardar fechas del lead'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Fecha de boda confirmada */}
              <div className="form-group">
                <label className="form-label">Fecha de boda <span style={{ fontWeight: 400, color: 'var(--warm-gray)' }}>(opcional)</span></label>
                <button type="button" className="form-input" onClick={() => setShowDateModal(true)}
                  style={{ textAlign: 'left', cursor: 'pointer', color: form.wedding_date ? 'var(--charcoal)' : 'var(--warm-gray)' }}>
                  {(() => {
                    const slotDates: string[] = (sections as any).date_slots?.[0]?.dates ?? []
                    if (slotDates.length > 1) {
                      return slotDates.map(d => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })).join(' · ')
                    }
                    return form.wedding_date
                      ? new Date(form.wedding_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                      : 'Sin confirmar…'
                  })()}
                </button>
                {form.wedding_date && (
                  <button type="button" onClick={() => setForm(f => ({ ...f, wedding_date: '' }))}
                    style={{ fontSize: 10, color: 'var(--warm-gray)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 2, padding: 0 }}>
                    × Quitar fecha confirmada
                  </button>
                )}
              </div>

              {modalities.filter(m => m.is_active).length > 0 && (
                <div className="form-group">
                  <label className="form-label">Modalidad</label>
                  <Select
                    value={form.modality_id || '__none__'}
                    onValueChange={(v) => onModalityChange(v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="— Sin modalidad —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Sin modalidad —</SelectItem>
                      {modalities.filter(m => m.is_active).map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}{m.duration_label ? ` · ${m.duration_label}` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.modality_id && form.wedding_date && (() => {
                    const price = getPriceForDate(form.modality_id, form.wedding_date)
                    const pkgLabel = getMatchedPackageLabel(form.modality_id, form.wedding_date)
                    if (price !== null) return (
                      <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 4 }}>
                        ✓ Precio precargado automáticamente{pkgLabel ? ` · paquete ${pkgLabel}` : ''}
                      </div>
                    )
                    return (
                      <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>
                        Sin tarifa definida para esta fecha — puedes introducir el precio manualmente
                      </div>
                    )
                  })()}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Mensaje personal</label>
                <textarea className="form-textarea" style={{ minHeight: 90 }} value={form.personal_message} onChange={e => setForm(f => ({ ...f, personal_message: e.target.value }))} placeholder="Mensaje personalizado para esta pareja..." />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <Checkbox checked={form.show_availability} onCheckedChange={(v) => setForm(f => ({ ...f, show_availability: v === true }))} />
                Mostrar disponibilidad
              </label>

              <PasswordProtectionBlock form={form} setForm={setForm} />

              {/* Template selector moved to Visual tab */}

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
              {/* Template selector — collapsed: show current + edit btn */}
              {allTemplates.length > 0 && (() => {
                const currentTpl = allTemplates.find(t => t.id === (sections as any).content_template_id)
                return (
                  <>
                    <div style={secLabel}>Plantilla</div>
                    <div className="form-group">
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                        borderRadius: 8, border: '1.5px solid var(--gold)',
                        background: 'rgba(196,151,90,0.06)',
                      }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(196,151,90,0.15)', border: '1px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <ChefHat size={13} style={{ color: 'var(--gold)' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>
                            {currentTpl?.name ?? 'Ninguna seleccionada'}
                          </div>
                          {currentTpl?.description && <div style={{ fontSize: 10, color: 'var(--warm-gray)', lineHeight: 1.4 }}>{currentTpl.description}</div>}
                        </div>
                        <button type="button" onClick={() => setShowTemplateList(v => !v)}
                          style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', background: 'rgba(196,151,90,0.1)', border: '1px solid rgba(196,151,90,0.25)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {showTemplateList ? 'Cerrar' : 'Cambiar'}
                        </button>
                      </div>

                      {/* Expandable template list */}
                      {showTemplateList && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 300, overflowY: 'auto', padding: '4px 0' }}>
                          {allTemplates.map(tpl => {
                            const isActive = (sections as any).content_template_id === tpl.id
                            return (
                              <button key={tpl.id} type="button"
                                onClick={() => { applyContentTemplate(tpl.id); setShowTemplateList(false) }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                                  borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%',
                                  border: `1.5px solid ${isActive ? 'var(--gold)' : 'var(--border)'}`,
                                  background: isActive ? 'rgba(196,151,90,0.08)' : 'var(--surface)',
                                }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? 'var(--gold)' : 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {tpl.name}
                                    {tpl.isSample && <span style={{ fontSize: 9, background: 'rgba(0,0,0,.06)', color: 'var(--warm-gray)', padding: '1px 6px', borderRadius: 8, fontWeight: 700, letterSpacing: '.04em' }}>MUESTRA</span>}
                                    {tpl.is_default && <span style={{ fontSize: 9, background: isActive ? 'var(--gold)' : 'var(--warm-gray)', color: '#fff', padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>DEF</span>}
                                  </div>
                                  {tpl.description && <div style={{ fontSize: 10, color: 'var(--warm-gray)', lineHeight: 1.4, marginTop: 1 }}>{tpl.description}</div>}
                                </div>
                                {isActive && <Check size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )
              })()}

              <div style={secLabel}>Aspecto visual</div>

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
                <ImageUploader
                  value={form.logo_url ?? null}
                  height={88}
                  objectFit="contain"
                  label="Subir logo"
                  hint="PNG transparente recomendado"
                  alt="Logo del venue"
                  onUpload={async (f) => { await handleLogoUpload(f) }}
                  onRemove={() => setForm(f => ({ ...f, logo_url: null }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tipografía</label>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: form.font_family, fontSize: 16, color: 'var(--text)' }}>Aa — {form.couple_name || 'Laura & Carlos'}</span>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{getFontByValue(form.font_family)?.label ?? 'Georgia'}</div>
                  </div>
                  <button type="button" onClick={() => setShowFontList(v => !v)}
                    style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', background: 'rgba(196,151,90,0.1)', border: '1px solid rgba(196,151,90,0.25)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {showFontList ? 'Cerrar' : 'Cambiar'}
                  </button>
                </div>

                {/* Expandable font list */}
                {showFontList && (
                  <div style={{ marginTop: 8, maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {FONT_CATEGORIES.map(cat => (
                      <div key={cat.key}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{cat.label}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {GOOGLE_FONTS.filter(f => f.category === cat.key).map(opt => {
                            const isActive = form.font_family === opt.value
                            return (
                              <button key={opt.value} type="button" onClick={() => { setForm(f => ({ ...f, font_family: opt.value })); setShowFontList(false) }}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '7px 10px', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                                  border: `1.5px solid ${isActive ? 'var(--gold)' : 'var(--border)'}`,
                                  background: isActive ? 'rgba(196,151,90,0.08)' : 'var(--surface)',
                                }}>
                                <span style={{ fontFamily: opt.value, fontSize: 13, color: 'var(--text)' }}>{opt.label}</span>
                                {isActive ? <Check size={13} style={{ color: 'var(--gold)' }} /> : <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{opt.desc}</span>}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ TAB: SECCIONES ══ */}
          {activeTab === 'secciones' && (() => {
            // Sections in the same order the templates render them
            const ALL_SECTION_IDS = [
              // Order matches T1Impacto render order top → bottom
              'sticky_nav',
              'hero',
              'availability',
              'date_slots',
              'welcome', 'welcome_light', 'welcome_split', 'welcome_editorial', // grouped
              'experience',
              'gallery',
              'single_space',
              'zones',
              'space_groups',
              'venue_rental',
              'inclusions',
              'testimonials',
              'collaborators',
              'accommodation',
              'extra_services',
              'faq',
              'schedule_visit',
              'map',
              'contact',
            ]
            const tplSections: string[] = ALL_SECTION_IDS
            const toggleSec = (id: string, val: boolean) => setSections(s => ({ ...s, sections_enabled: { ...(s.sections_enabled ?? {}), [id]: val } }))
            const isSectionOn = (id: string) => {
              const e = sections.sections_enabled
              return e ? (e[id] !== false) : true
            }

            const WELCOME_VARIANTS = ['welcome', 'welcome_light', 'welcome_split', 'welcome_editorial']
            const WELCOME_VARIANT_LABELS: Record<string, string> = {
              welcome: 'Oscura · cita centrada',
              welcome_light: 'Fondo claro',
              welcome_split: 'Dos columnas con imagen',
              welcome_editorial: 'Editorial · tipografía grande',
            }
            const se = sections.sections_enabled ?? {}
            const welcomeGroupOn = !WELCOME_VARIANTS.every(v => se[v] === false)
            const activeWelcome = WELCOME_VARIANTS.find(v => se[v] === true)
              ?? (welcomeGroupOn ? (WELCOME_VARIANTS.find(v => se[v] !== false) ?? 'welcome') : 'welcome')
            const toggleWelcomeGroup = (on: boolean) => setSections(s => ({
              ...s,
              sections_enabled: {
                ...(s.sections_enabled ?? {}),
                ...Object.fromEntries(WELCOME_VARIANTS.map(v => [v, on ? v === activeWelcome : false]))
              }
            }))
            const selectWelcomeVariant = (variant: string) => setSections(s => ({
              ...s,
              sections_enabled: {
                ...(s.sections_enabled ?? {}),
                ...Object.fromEntries(WELCOME_VARIANTS.map(wv => [wv, wv === variant]))
              }
            }))

            const SPACE_GROUP_IDS = ['single_space', 'zones', 'space_groups', 'venue_rental']
            const visibleSpaceSubs = SPACE_GROUP_IDS.filter(id => isSectionAllowed(id, commercialConfig?.space_type as any))
            const isSpaceGroupOpen = openSecs.has('__space_group')
            const activeSpaceIds = visibleSpaceSubs.filter(id => isSectionOn(id))
            const activeSpaceLabel = activeSpaceIds.length === 0
              ? 'Ninguna activa'
              : activeSpaceIds.map(id => getSectionLabel(id, commercialConfig?.space_type as any, SECTION_LABELS[id] || id)).join(' · ')
            const renderSpaceGroupHeader = () => (
              <div key="__sg_header" className="sec-row" style={{
                background: 'rgba(196,151,90,0.06)',
                marginBottom: isSpaceGroupOpen ? 0 : undefined,
                borderBottomLeftRadius: isSpaceGroupOpen ? 0 : undefined,
                borderBottomRightRadius: isSpaceGroupOpen ? 0 : undefined,
                borderBottom: isSpaceGroupOpen ? 'none' : undefined,
              }}>
                <div className="sec-header"
                  onClick={() => setOpenSecs(s => { const n = new Set(s); n.has('__space_group') ? n.delete('__space_group') : n.add('__space_group'); return n })}
                  style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--charcoal)' }}>Espacios y precios</span>
                      <span style={{ fontSize: 10, color: activeSpaceIds.length > 0 ? 'var(--gold)' : 'var(--warm-gray)', background: '#fff', padding: '1px 7px', borderRadius: 10, border: '1px solid var(--border)', fontWeight: 600 }}>{activeSpaceIds.length}/{visibleSpaceSubs.length}</span>
                    </div>
                    <div style={{ fontSize: 11, color: activeSpaceIds.length === 0 ? 'var(--warm-gray)' : '#999', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeSpaceLabel}</div>
                  </div>
                  <ChevronDown size={14} style={{ color: 'var(--warm-gray)', transform: isSpaceGroupOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0, marginTop: 2 }} />
                </div>
              </div>
            )

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {tplSections.length === 0 && (
                  <div style={{ padding: '16px', background: 'var(--cream)', borderRadius: 8, fontSize: 13, color: 'var(--warm-gray)', border: '1px dashed var(--border)' }}>
                    Ve a la pestaña <strong>Visual</strong> y selecciona una plantilla para ver las secciones disponibles.
                  </div>
                )}

                {tplSections.map(secId => {
                  if (['welcome_light', 'welcome_split', 'welcome_editorial'].includes(secId)) return null
                  if (!isSectionAllowed(secId, commercialConfig?.space_type as any)) return null

                  // Space group: collapsed → only header at first sub; expanded → header + indented subs
                  const isInSpaceGroup = SPACE_GROUP_IDS.includes(secId)
                  const isFirstSpaceVisible = isInSpaceGroup && visibleSpaceSubs[0] === secId
                  if (isInSpaceGroup && !isSpaceGroupOpen) {
                    return isFirstSpaceVisible ? renderSpaceGroupHeader() : null
                  }

                  if (secId === 'welcome') {
                    const isWelcomeOpen = openSecs.has('welcome')
                    const activeVariantLabel = welcomeGroupOn ? WELCOME_VARIANT_LABELS[activeWelcome] : 'Desactivada'
                    return (
                      <div key="welcome-group" className="sec-row" style={{ opacity: welcomeGroupOn ? 1 : 0.55, background: 'rgba(196,151,90,0.06)' }}>
                        <div className="sec-header"
                          onClick={() => setOpenSecs(s => { const n = new Set(s); n.has('welcome') ? n.delete('welcome') : n.add('welcome'); return n })}
                          style={{ alignItems: 'flex-start' }}>
                          <div onClick={e => { e.stopPropagation(); toggleWelcomeGroup(!welcomeGroupOn) }}
                            style={{ width: 34, height: 19, borderRadius: 10, background: welcomeGroupOn ? 'var(--gold)' : '#d1c9b8', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0, marginTop: 2 }}>
                            <div style={{ position: 'absolute', top: 2, left: welcomeGroupOn ? 15 : 2, width: 15, height: 15, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--charcoal)' }}>Bienvenida</span>
                              <span style={{ fontSize: 10, color: welcomeGroupOn ? 'var(--gold)' : 'var(--warm-gray)', background: '#fff', padding: '1px 7px', borderRadius: 10, border: '1px solid var(--border)', fontWeight: 600 }}>{welcomeGroupOn ? '1' : '0'}/{WELCOME_VARIANTS.length}</span>
                            </div>
                            <div style={{ fontSize: 11, color: welcomeGroupOn ? '#999' : 'var(--warm-gray)', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeVariantLabel}</div>
                          </div>
                          <ChevronDown size={14} style={{ color: 'var(--warm-gray)', transform: isWelcomeOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0, marginTop: 2 }} />
                        </div>

                        {isWelcomeOpen && (
                          <div className="sec-open-content" style={{ padding: '12px 14px 14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, padding: '8px 10px', background: 'var(--cream)', borderRadius: 8, border: '1px solid var(--border)' }}>
                              {WELCOME_VARIANTS.map(v => (
                                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '3px 0' }}>
                                  <input type="radio" name="welcome-variant" checked={activeWelcome === v} onChange={() => selectWelcomeVariant(v)} style={{ accentColor: 'var(--gold)' }} />
                                  <span style={{ fontSize: 12, color: 'var(--charcoal)' }}>{WELCOME_VARIANT_LABELS[v]}</span>
                                </label>
                              ))}
                            </div>

                            {activeWelcome === 'welcome' && (
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <textarea className="form-textarea" style={{ minHeight: 80 }} placeholder="Mensaje personalizado para la pareja..." value={form.personal_message ?? ''} onChange={e => setForm(f => ({ ...f, personal_message: e.target.value }))} />
                                <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4, lineHeight: 1.5 }}>
                                  Si se deja vacío, se usará el texto por defecto de la plantilla.
                                </div>
                              </div>
                            )}

                            {activeWelcome === 'welcome_light' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
                                  Muestra el mensaje de bienvenida sobre fondo claro crema. Ideal para venues con estética romántica y luminosa.
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">Imagen de fondo (opcional)</label>
                                  <ImageUploader
                                    value={(sections as any).welcome_light?.image_url ?? null}
                                    height={160}
                                    label="Imagen de fondo"
                                    hint="JPG, PNG o WEBP"
                                    alt="Imagen bienvenida clara"
                                    onUpload={async (f) => {
                                      const url = await uploadImage(f, 'welcome')
                                      if (url) setSections((s: any) => ({ ...s, welcome_light: { ...(s.welcome_light ?? {}), image_url: url } }))
                                    }}
                                    onRemove={() => setSections((s: any) => ({ ...s, welcome_light: { ...(s.welcome_light ?? {}), image_url: null } }))}
                                  />
                                </div>
                              </div>
                            )}

                            {activeWelcome === 'welcome_split' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
                                  Muestra el mensaje de bienvenida en dos columnas: imagen a un lado, texto al otro.
                                </div>
                                <div className="form-group">
                                  <label className="form-label">Imagen de la sección</label>
                                  <ImageUploader
                                    value={(sections as any).welcome_split?.image_url ?? null}
                                    height={160}
                                    label="Imagen de la sección"
                                    hint="JPG, PNG o WEBP"
                                    alt="Imagen bienvenida dividida"
                                    onUpload={async (f) => {
                                      const url = await uploadImage(f, 'welcome')
                                      if (url) setSections((s: any) => ({ ...s, welcome_split: { ...(s.welcome_split ?? {}), image_url: url } }))
                                    }}
                                    onRemove={() => setSections((s: any) => ({ ...s, welcome_split: { ...(s.welcome_split ?? {}), image_url: null } }))}
                                  />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">Posición de la imagen</label>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    {(['left', 'right'] as const).map(side => (
                                      <button key={side} type="button"
                                        style={{ flex: 1, padding: '7px 0', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: ((sections as any).welcome_split?.image_side ?? 'left') === side ? 'var(--gold)' : 'var(--surface)', color: ((sections as any).welcome_split?.image_side ?? 'left') === side ? '#fff' : 'var(--charcoal)', cursor: 'pointer', fontWeight: 600 }}
                                        onClick={() => setSections((s: any) => ({ ...s, welcome_split: { ...(s.welcome_split ?? {}), image_side: side } }))}>
                                        {side === 'left' ? 'Izquierda' : 'Derecha'}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {activeWelcome === 'welcome_editorial' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
                                  Muestra el mensaje de bienvenida con tipografía editorial grande, estilo revista de lujo.
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">Eyebrow / Etiqueta superior (opcional)</label>
                                  <input className="form-input" placeholder="Ej. Un mensaje para vosotros" value={(sections as any).welcome_editorial?.eyebrow ?? ''} onChange={e => setSections((s: any) => ({ ...s, welcome_editorial: { ...(s.welcome_editorial ?? {}), eyebrow: e.target.value } }))} />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  }

                  const label = getSectionLabel(secId, commercialConfig?.space_type as any, SECTION_LABELS[secId] || secId)
                  const isOn = isSectionOn(secId)
                  const isOpen = openSecs.has(secId)
                  const overrideKey = `${secId}_override`
                  const spaceSubIdx = isInSpaceGroup ? visibleSpaceSubs.indexOf(secId) : -1
                  const isLastSpaceSub = isInSpaceGroup && spaceSubIdx === visibleSpaceSubs.length - 1

                  return (
                    <Fragment key={secId}>
                    {isInSpaceGroup && isFirstSpaceVisible && renderSpaceGroupHeader()}

                    {/* ── Precio por fecha — editable block (no toggle) ── */}
                    {secId === 'single_space' && isInSpaceGroup && (() => {
                      const dpRaw: any[] = Array.isArray((sections as any).single_space?.date_prices)
                        ? [...(sections as any).single_space.date_prices].sort((a: any, b: any) => (a.date_from ?? '').localeCompare(b.date_from ?? ''))
                        : []
                      const setDp = (next: any[]) => setSections((s: any) => ({ ...s, single_space: { ...(s.single_space ?? {}), date_prices: next } }))
                      const effectiveModalityId = form.modality_id || (modalities.length === 1 ? modalities[0].id : null)
                      const canCompute = !!form.lead_id && !!effectiveModalityId
                      const fmtRange = (entry: any) => {
                        const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                        if (!entry.date_to || entry.date_to === entry.date_from) return fmt(entry.date_from)
                        const days = Math.round((new Date(entry.date_to + 'T12:00:00').getTime() - new Date(entry.date_from + 'T12:00:00').getTime()) / 86400000)
                        if (days === 1) return `${fmt(entry.date_from)} o ${fmt(entry.date_to)}`
                        return `${fmt(entry.date_from)} – ${fmt(entry.date_to)}`
                      }
                      return (
                        <div style={{ borderLeft: '1px solid var(--ivory)', borderRight: '1px solid var(--ivory)', borderTop: '1px solid rgba(196,151,90,0.15)', background: 'var(--cream)', padding: '12px 14px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--warm-gray)' }}>Precio por fecha</span>
                            <button type="button" disabled={!canCompute}
                              title={!canCompute ? 'Selecciona lead y modalidad primero' : undefined}
                              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', color: canCompute ? 'var(--charcoal)' : 'var(--warm-gray)', cursor: canCompute ? 'pointer' : 'not-allowed', opacity: canCompute ? 1 : 0.5 }}
                              onClick={() => canCompute && recalculateWithFreshLead(form.lead_id!, effectiveModalityId)}>
                              ↺ recalcular
                            </button>
                          </div>
                          {dpRaw.length === 0 ? (
                            <div style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic' }}>
                              {canCompute ? 'Haz clic en recalcular para generar los precios' : 'Selecciona lead y modalidad primero'}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {dpRaw.map((entry: any, i: number) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 11, color: 'var(--charcoal)', flex: 1, minWidth: 0 }}>{fmtRange(entry)}</span>
                                  <input type="number" className="form-input" placeholder="precio"
                                    value={entry.price_min ?? ''}
                                    onChange={e => setDp(dpRaw.map((x: any, j: number) => j === i ? { ...x, price_min: e.target.value, overridden: true } : x))}
                                    style={{ width: 72, textAlign: 'right', fontSize: 11, padding: '3px 6px' }} />
                                  <span style={{ fontSize: 10, color: 'var(--warm-gray)', flexShrink: 0 }}>€</span>
                                  <span style={{ fontSize: 9, color: entry.overridden ? 'var(--gold)' : 'var(--warm-gray)', background: '#fff', padding: '1px 5px', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }}>
                                    {entry.overridden ? 'manual' : 'auto'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    <div
                      className={isInSpaceGroup ? undefined : 'sec-row'}
                      style={isInSpaceGroup ? {
                        opacity: isOn ? 1 : 0.55,
                        borderLeft: '1px solid var(--ivory)',
                        borderRight: '1px solid var(--ivory)',
                        borderBottom: isLastSpaceSub ? '1px solid var(--ivory)' : undefined,
                        borderTop: spaceSubIdx > 0 ? '1px solid rgba(196,151,90,0.15)' : undefined,
                        borderRadius: isLastSpaceSub ? '0 0 8px 8px' : 0,
                        marginBottom: isLastSpaceSub ? 8 : 0,
                        background: isOn ? '#fff' : '#faf9f7',
                        overflow: 'hidden',
                      } : { opacity: isOn ? 1 : 0.55 }}>
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
                          {/* DATE SLOTS */}
                          {secId === 'date_slots' && (() => {
                            const slots: any[] = (sections as any).date_slots ?? []
                            const setSlots = (val: any[]) => setSections((s: any) => ({ ...s, date_slots: val }))
                            const updateSlot = (i: number, patch: any) => setSlots(slots.map((s: any, j: number) => j === i ? { ...s, ...patch } : s))
                            const removeSlot = (i: number) => setSlots(slots.filter((_: any, j: number) => j !== i))
                            const addDate = (i: number) => updateSlot(i, { dates: [...(slots[i].dates ?? []), ''] })
                            const updateDate = (i: number, di: number, val: string) => updateSlot(i, { dates: slots[i].dates.map((d: string, j: number) => j === di ? val : d) })
                            const removeDate = (i: number, di: number) => updateSlot(i, { dates: slots[i].dates.filter((_: string, j: number) => j !== di) })

                            return (
                              <div>
                                <div style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.6, marginBottom: 10, background: 'var(--cream)', borderRadius: 6, padding: '8px 10px' }}>
                                  Añade una o varias franjas de fechas. Si tienen <strong>precios distintos</strong>, la pareja podrá seleccionar la que prefiera y el precio se mostrará dinámicamente.
                                </div>
                                {slots.map((slot: any, i: number) => (
                                  <details key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
                                    <summary style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--charcoal)', background: 'var(--cream)', listStyle: 'none' }}>
                                      <ChevronDown size={12} style={{ color: 'var(--warm-gray)' }} />
                                      <span style={{ flex: 1 }}>{slot.label || <em style={{ color: 'var(--warm-gray)', fontWeight: 400 }}>Franja {i + 1}</em>}</span>
                                      {slot.price_per_person && <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>{slot.price_per_person}</span>}
                                      <button type="button" style={removeBtn} onClick={e => { e.preventDefault(); e.stopPropagation(); removeSlot(i) }}><X size={13} /></button>
                                    </summary>
                                    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      <input className="form-input" placeholder="Etiqueta  (ej. Temporada alta · Sábados)" value={slot.label ?? ''} onChange={e => updateSlot(i, { label: e.target.value })} />
                                      <div style={{ display: 'flex', gap: 6 }}>
                                        <input className="form-input" placeholder="Precio/persona  (ej. 110€/pax)" style={{ flex: 1 }} value={slot.price_per_person ?? ''} onChange={e => updateSlot(i, { price_per_person: e.target.value })} />
                                        <input className="form-input" placeholder="Precio total  (ej. 8.000€)" style={{ flex: 1 }} value={slot.price_rental ?? ''} onChange={e => updateSlot(i, { price_rental: e.target.value })} />
                                      </div>
                                      <input className="form-input" placeholder="Nota  (ej. IVA no incluido · Viernes)" value={slot.notes ?? ''} onChange={e => updateSlot(i, { notes: e.target.value })} />
                                      {/* Dates */}
                                      <div style={{ background: 'var(--cream)', borderRadius: 6, padding: '8px 10px' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: 6 }}>Fechas</div>
                                        {(slot.dates ?? []).map((d: string, di: number) => (
                                          <div key={di} style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 4 }}>
                                            <div style={{ flex: 1 }}>
                                              <DatePicker value={d} onChange={(v) => updateDate(i, di, v)} placeholder="Fecha" />
                                            </div>
                                            <button type="button" style={removeBtn} onClick={() => removeDate(i, di)}><X size={11} /></button>
                                          </div>
                                        ))}
                                        <button type="button" style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }} onClick={() => addDate(i)}>
                                          + Añadir fecha
                                        </button>
                                      </div>
                                    </div>
                                  </details>
                                ))}
                                <button type="button" style={addBtn} onClick={() => setSlots([...slots, { label: '', dates: [], price_per_person: '', notes: '' }])}>
                                  + Añadir franja de fechas
                                </button>
                              </div>
                            )
                          })()}

                          {secId === 'hero' && (
                            <ImageUploader
                              value={sections.hero_image_url ?? null}
                              height={120}
                              label="Foto principal"
                              hint="JPG, PNG o WEBP (máx. 10 MB)"
                              alt="Hero"
                              onUpload={async (f) => { await handleHeroUpload(f) }}
                              onRemove={() => setSections(s => ({ ...s, hero_image_url: undefined }))}
                            />
                          )}
                          {secId === 'gallery' && (() => {
                            const urls = sections.gallery_urls ?? []
                            return (
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
                                      if (newUrl) setSections(s => ({ ...s, gallery_urls: (s.gallery_urls ?? []).map((u, j) => j === i ? newUrl : u) }))
                                    }}
                                    onRemove={() => setSections(s => ({ ...s, gallery_urls: (s.gallery_urls ?? []).filter((_, j) => j !== i) }))}
                                  />
                                ))}
                                <ImageUploader
                                  compact
                                  value={null}
                                  aspectRatio={4 / 3}
                                  label="Añadir foto"
                                  onUpload={async (f) => {
                                    const newUrl = await uploadImage(f, 'gallery')
                                    if (newUrl) setSections(s => ({ ...s, gallery_urls: [...(s.gallery_urls ?? []), newUrl] }))
                                  }}
                                />
                              </div>
                            )
                          })()}
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

                          {/* SINGLE SPACE */}
                          {secId === 'single_space' && (() => {
                            const ss: any = (sections as any).single_space ?? {}
                            const setSs = (patch: any) => setSections((s: any) => ({ ...s, single_space: { ...(s.single_space ?? {}), ...patch } }))
                            const features: string[] = Array.isArray(ss.features) ? ss.features : []
                            const setFeatures = (next: string[]) => setSs({ features: next })
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">Subtítulo</label>
                                  <input className="form-input" placeholder="Ej. Vuestro espacio" value={ss.subtitle ?? ''} onChange={e => setSs({ subtitle: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">Título</label>
                                  <input className="form-input" placeholder="Ej. El Salón Principal" value={ss.title ?? ''} onChange={e => setSs({ title: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">Descripción</label>
                                  <textarea className="form-textarea" style={{ minHeight: 70 }} placeholder="Cuenta cómo es el espacio, qué lo hace especial…" value={ss.description ?? ''} onChange={e => setSs({ description: e.target.value })} />
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                    <label className="form-label">m²</label>
                                    <input className="form-input" placeholder="500" value={ss.sqm ?? ''} onChange={e => setSs({ sqm: e.target.value })} />
                                  </div>
                                  <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                    <label className="form-label">Cap. mín.</label>
                                    <input className="form-input" placeholder="50" value={ss.min_guests ?? ''} onChange={e => setSs({ min_guests: e.target.value })} />
                                  </div>
                                  <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                    <label className="form-label">Cap. máx.</label>
                                    <input className="form-input" placeholder="200" value={ss.max_guests ?? ''} onChange={e => setSs({ max_guests: e.target.value })} />
                                  </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">Fotos del espacio</label>
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                    {[...(Array.isArray(ss.photos) ? ss.photos : []), ...(ss.image_url && !(ss.photos ?? []).includes(ss.image_url) ? [ss.image_url] : [])].map((url: string, pi: number) => (
                                      <div key={pi} style={{ position: 'relative', width: 56, height: 56 }}>
                                        <img src={url} alt="" style={{ width: 56, height: 56, borderRadius: 6, objectFit: 'cover' }} />
                                        <button type="button" onClick={() => {
                                          const allPhotos = [...(Array.isArray(ss.photos) ? ss.photos : []), ...(ss.image_url && !(ss.photos ?? []).includes(ss.image_url) ? [ss.image_url] : [])]
                                          const next = allPhotos.filter((_: string, j: number) => j !== pi)
                                          setSs({ photos: next, image_url: next[0] ?? '' })
                                        }} style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
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
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">Características destacadas</label>
                                  {features.map((f, fi) => (
                                    <div key={fi} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                                      <input className="form-input" placeholder="Ej. Aire acondicionado" value={f} onChange={e => setFeatures(features.map((x, j) => j === fi ? e.target.value : x))} />
                                      <button type="button" style={removeBtn} onClick={() => setFeatures(features.filter((_, j) => j !== fi))}><X size={11} /></button>
                                    </div>
                                  ))}
                                  <button type="button" style={addBtn} onClick={() => setFeatures([...features, ''])}>+ Añadir característica</button>
                                </div>
                              </div>
                            )
                          })()}

                          {/* ZONES */}
                          {secId === 'zones' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {/* Section header */}
                              {(() => {
                                const zh: any = (sections as any).zones_header ?? {}
                                const setZh = (patch: any) => setSections((s: any) => ({ ...s, zones_header: { ...((s as any).zones_header ?? {}), ...patch } }))
                                const zhMode: 'single' | 'zones' = zh.mode ?? 'zones'
                                return (
                                  <>
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
                                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 2 }} />
                                    {(getOverride(overrideKey) ?? []).map((z: any, i: number) => {
                                      const caps = Array.isArray(z.capacities) ? z.capacities : []
                                      const updateCaps = (newCaps: any[]) => updateOverrideItem(overrideKey, i, 'capacities', newCaps)
                                      const feats: string[] = Array.isArray(z.features) ? z.features : []
                                      return (
                                        <details key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden', background: 'var(--surface)' }}>
                                          <summary style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--charcoal)', fontWeight: 500, background: 'var(--cream)', listStyle: 'none' }}>
                                            <ChevronDown size={12} style={{ color: 'var(--warm-gray)' }} />
                                            <span style={{ flex: 1 }}>{z.name || <em style={{ color: 'var(--warm-gray)' }}>Nueva zona</em>}</span>
                                            <button type="button" style={removeBtn} onClick={e => { e.preventDefault(); e.stopPropagation(); moveOverrideItem(overrideKey, i, -1) }} title="Subir" disabled={i === 0}>▲</button>
                                            <button type="button" style={removeBtn} onClick={e => { e.preventDefault(); e.stopPropagation(); moveOverrideItem(overrideKey, i, 1) }} title="Bajar" disabled={i === (getOverride(overrideKey) ?? []).length - 1}>▼</button>
                                            <button type="button" style={removeBtn} onClick={e => { e.preventDefault(); e.stopPropagation(); removeOverrideItem(overrideKey, i) }}><X size={13} /></button>
                                          </summary>
                                          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <input className="form-input" placeholder="Subtítulo zona (ej. Espacio 01)" style={{ fontSize: 12 }} value={z.subtitle ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'subtitle', e.target.value)} />
                                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                              <input className="form-input" placeholder="Nombre *" value={z.name ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'name', e.target.value)} />
                                              <input className="form-input" style={{ width: 80, flexShrink: 0 }} type="number" placeholder="m²" value={z.sqm ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'sqm', e.target.value ? Number(e.target.value) : undefined)} />
                                            </div>
                                            <input className="form-input" placeholder="Descripción breve" value={z.description ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'description', e.target.value)} />
                                            {/* Supplement/price — only when mode is 'zones' */}
                                            {zhMode === 'zones' && (
                                              <input className="form-input"
                                                placeholder={commercialConfig?.space_type === 'single_with_supplements' ? 'Suplemento (ej. +500€)' : 'Precio/suplemento (opcional)'}
                                                value={z.price ?? ''}
                                                onChange={e => updateOverrideItem(overrideKey, i, 'price', e.target.value)} />
                                            )}
                                            {/* Multi-photo upload */}
                                            <div>
                                              <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 4 }}>Fotos de la zona</div>
                                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                                {(z.photos ?? []).map((url: string, pi: number) => (
                                                  <div key={pi} style={{ position: 'relative', width: 56, height: 56 }}>
                                                    <img src={url} alt="" style={{ width: 56, height: 56, borderRadius: 6, objectFit: 'cover' }} />
                                                    <button type="button" onClick={() => { const next = [...(z.photos ?? [])]; next.splice(pi, 1); updateOverrideItem(overrideKey, i, 'photos', next) }}
                                                      style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                                                  </div>
                                                ))}
                                                <ImageUploader label="+" height={48} onUpload={async (f) => { const url = await uploadImage(f, 'zones'); if (url) updateOverrideItem(overrideKey, i, 'photos', [...(z.photos ?? []), url]) }} />
                                              </div>
                                              <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 4 }}>Sin foto: se usará una de la galería del venue.</div>
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
                                            {/* Tipo + características libres */}
                                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                              <div style={{ flex: 1 }}>
                                                <Select value={z.covered || '__none__'} onValueChange={(v) => updateOverrideItem(overrideKey, i, 'covered', v === '__none__' ? undefined : v)}>
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
                                                    <span key={fi} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#fdf6ea', border: '1px solid var(--gold)', color: '#8a6020' }}>
                                                      {f}
                                                      <button type="button" onClick={() => updateOverrideItem(overrideKey, i, 'features', feats.filter((_: string, j: number) => j !== fi))}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontSize: 12 }}>×</button>
                                                    </span>
                                                  ))}
                                                </div>
                                              )}
                                              <input className="form-input" style={{ fontSize: 12 }} placeholder="Añadir característica (Enter)" onKeyDown={e => {
                                                if (e.key === 'Enter' || e.key === ',') {
                                                  e.preventDefault()
                                                  const val = (e.target as HTMLInputElement).value.trim().replace(/,$/, '')
                                                  if (val) { updateOverrideItem(overrideKey, i, 'features', [...feats, val]);(e.target as HTMLInputElement).value = '' }
                                                }
                                              }} />
                                            </div>
                                            <input className="form-input" placeholder="Notas adicionales (ej. *Opción haima +coste)" value={z.notes ?? ''} onChange={e => updateOverrideItem(overrideKey, i, 'notes', e.target.value)} />
                                          </div>
                                        </details>
                                      )
                                    })}
                                    <button type="button" style={addBtn} onClick={() => addOverrideItem(overrideKey, { name: '', description: '', capacities: [] })}>+ Añadir zona</button>
                                  </>
                                )
                              })()}
                            </div>
                          )}

                          {/* SPACE GROUPS */}
                          {secId === 'space_groups' && (
                            (venueSpaceGroups.length > 0 || commercialConfig?.space_type === 'multiple_independent') ? (
                              <MultipleZonesEditor
                                venueSpaceGroups={venueSpaceGroups}
                                groups={(sections as any).space_groups ?? []}
                                onChange={val => setSections((s: any) => ({ ...s, space_groups: val }))}
                                uploadImage={uploadImage}
                                guestCount={leads.find(l => l.id === form.lead_id)?.guests ?? undefined}
                              />
                            ) : (
                              <SpaceGroupEditor
                                groups={(sections as any).space_groups ?? []}
                                onChange={val => setSections((s: any) => ({ ...s, space_groups: val }))}
                                uploadImage={uploadImage}
                              />
                            )
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
                                      <div style={{ width: 200, flexShrink: 0 }}>
                                        <Select value={x.icon || '__none__'} onValueChange={(v) => updateOverrideItem(overrideKey, i, 'icon', v === '__none__' ? '' : v)}>
                                          <SelectTrigger><SelectValue placeholder="— icono —" /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="__none__">— icono —</SelectItem>
                                            {INCLUSION_ICON_CHOICES.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                          </SelectContent>
                                        </Select>
                                      </div>
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
                                      <div style={{ width: 180, flexShrink: 0 }}>
                                        <DatePicker value={t.wedding_date ?? ''} onChange={(v) => updateOverrideItem(overrideKey, i, 'wedding_date', v)} placeholder="Fecha de boda" />
                                      </div>
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

                          {secId === 'availability' && (
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <textarea className="form-textarea" style={{ minHeight: 70 }} placeholder="Ej. Fecha disponible, confirmación prioritaria..." value={sections.availability_message ?? ''} onChange={e => setSections(s => ({ ...s, availability_message: e.target.value }))} />
                            </div>
                          )}

                          {secId === 'sticky_nav' && (
                            <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.6, background: 'var(--cream)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                              Cuando está activo, aparecen enlaces de navegación en la barra superior para que la pareja pueda saltar directamente a las secciones más relevantes (galería, espacios, menús, contacto...).
                              Los enlaces se generan automáticamente según las secciones que tengas activadas.
                            </div>
                          )}

                          {secId === 'schedule_visit' && (() => {
                            const sv: any = (sections as any).schedule_visit ?? {}
                            const setSv = (patch: any) => setSections((s: any) => ({ ...s, schedule_visit: { ...sv, ...patch } }))
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div className="form-group">
                                  <label className="form-label">Título</label>
                                  <input className="form-input" placeholder="Visitadnos en persona" value={sv.title ?? ''} onChange={e => setSv({ title: e.target.value })} />
                                </div>
                                <div className="form-group">
                                  <label className="form-label">Subtítulo</label>
                                  <textarea className="form-textarea" style={{ minHeight: 60 }} placeholder="Ven a conocer el espacio, sin compromiso. Nuestro equipo estará encantado de enseñaros el venue." value={sv.subtitle ?? ''} onChange={e => setSv({ subtitle: e.target.value })} />
                                </div>
                                <div className="form-group">
                                  <label className="form-label">URL para agendar (Calendly, Cal.com…)</label>
                                  <input className="form-input" placeholder="https://calendly.com/..." value={sv.url ?? ''} onChange={e => setSv({ url: e.target.value })} />
                                </div>
                                <div className="form-group">
                                  <label className="form-label">Texto del botón</label>
                                  <input className="form-input" placeholder="Reservar visita gratuita →" value={sv.cta_label ?? ''} onChange={e => setSv({ cta_label: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
                                  <label className="form-label" style={{ flex: 1, marginBottom: 0 }}>Color del texto del botón</label>
                                  <input type="color" value={sv.cta_text_color || '#ffffff'} onChange={e => setSv({ cta_text_color: e.target.value })}
                                    style={{ width: 32, height: 28, padding: 2, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', background: 'none' }} />
                                  {sv.cta_text_color && (
                                    <button type="button" onClick={() => setSv({ cta_text_color: '' })}
                                      style={{ fontSize: 10, color: 'var(--warm-gray)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>
                                      Reset
                                    </button>
                                  )}
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">Nota pequeña (opcional)</label>
                                  <input className="form-input" placeholder="Visitas de lunes a viernes · Duración aprox. 45 min" value={sv.note ?? ''} onChange={e => setSv({ note: e.target.value })} />
                                </div>
                              </div>
                            )
                          })()}

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
                                          <Checkbox checked={!!opt.included} onCheckedChange={(v) => patchOpt({ included: v === true })} />
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
                    </Fragment>
                  )
                })}
              </div>
            )
          })()}

          {/* ══ TAB: MENÚS ══ */}
          {activeTab === 'menus' && (
            <div>
              {/* Cargar desde catálogo — solo si hay catálogo y la propuesta no tiene menús aún */}
              {menuCatalog && (menuCatalog.menus_override?.length || menuCatalog.menu_extras_override?.length || menuCatalog.appetizers_base_override?.length) &&
               !sections.menus_override?.length && !sections.menu_extras_override?.length && !sections.appetizers_base_override?.length && (
                <div style={{ margin: '0 0 16px', background: '#FDF8F0', border: '1px dashed #C4975A66', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <ChefHat size={18} style={{ color: '#C4975A', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>Tienes un catálogo de menús definido</div>
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Cárgalo como punto de partida y personalízalo para esta pareja</div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setSections(s => ({
                    ...s,
                    menus_override:          menuCatalog.menus_override ?? s.menus_override,
                    menu_extras_override:    menuCatalog.menu_extras_override ?? s.menu_extras_override,
                    appetizers_base_override: menuCatalog.appetizers_base_override ?? s.appetizers_base_override,
                  }))}>
                    Cargar catálogo
                  </button>
                </div>
              )}
              <ProposalMenuEditor sections={sections} setSections={setSections} />
            </div>
          )}
        </div>

        {/* Footer save */}
        <div style={{ flexShrink: 0, padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn"
            onClick={handleSave}
            disabled={saving || !isDirty}
            style={{ flex: 1, justifyContent: 'center', background: 'var(--cream)', color: 'var(--charcoal)', border: '1px solid var(--border)' }}
          >
            {saving ? 'Guardando…' : isDirty ? 'Guardar borrador' : 'Guardado'}
          </button>
          <button
            className="btn btn-primary"
            onClick={async () => {
              await handleSave()
              if (!form.couple_name.trim()) return
              const supabase = createClient()
              await supabase.from('proposals').update({ status: 'sent' }).eq('id', proposal.id)
              setProposal(p => ({ ...p, status: 'sent' }))
              copyUrl()
              notify('Propuesta enviada — URL copiada')
            }}
            disabled={saving || !form.couple_name.trim()}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Enviar propuesta
          </button>
        </div>
      </div>

      {/* ── RIGHT PANEL: preview ──────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, height: '100vh' }}>
        <ProposalPreview slug={proposal.slug} patch={previewPatch} onReload={() => {
          if (!commercialConfig) return
          const defaults = getDefaultSections(commercialConfig)
          const SPACE_KEYS = ['single_space', 'zones', 'space_groups', 'venue_rental', 'extra_services'] as const
          setSections(prev => ({
            ...prev,
            sections_enabled: {
              ...(prev.sections_enabled ?? {}),
              ...Object.fromEntries(SPACE_KEYS.map(k => [k, defaults[k as keyof typeof defaults]])),
            },
          }))
        }} />
      </div>

      {/* ── Date picker modal ── */}
      {showDateModal && user && (
        <ProposalDateModal
          userId={user.id}
          currentDate={form.wedding_date || null}
          onClose={() => setShowDateModal(false)}
          onConfirm={(dates) => {
            const first = dates[0] ?? ''
            onWeddingDateChange(first)
            if (dates.length > 0) {
              // Group dates by price so each slot has its own price
              const modalityId = form.modality_id
              if (modalityId) {
                const priceGroups = new Map<string, string[]>()
                for (const d of dates) {
                  const price = getPriceForDate(modalityId, d)
                  const key = price !== null ? String(price) : 'none'
                  if (!priceGroups.has(key)) priceGroups.set(key, [])
                  priceGroups.get(key)!.push(d)
                }
                if (priceGroups.size > 1) {
                  // Different prices → separate slots
                  const slots = Array.from(priceGroups.entries()).map(([priceKey, slotDates]) => ({
                    label: '',
                    dates: slotDates,
                    price_rental: priceKey !== 'none' ? `${Number(priceKey).toLocaleString('es-ES')} €` : '',
                    price_per_person: '',
                    notes: '',
                  }))
                  setSections((s: any) => ({ ...s, date_slots: slots, sections_enabled: { ...s.sections_enabled, date_slots: true } }))
                } else {
                  // Same price → one slot
                  const price = getPriceForDate(modalityId, first)
                  setSections((s: any) => ({
                    ...s,
                    date_slots: [{
                      label: 'Fechas propuestas',
                      dates,
                      price_rental: price !== null ? `${price.toLocaleString('es-ES')} €` : '',
                      price_per_person: '',
                      notes: '',
                    }],
                    sections_enabled: { ...s.sections_enabled, date_slots: true },
                  }))
                }
              } else {
                setSections((s: any) => ({
                  ...s,
                  date_slots: [{ label: 'Fechas propuestas', dates }],
                  sections_enabled: { ...s.sections_enabled, date_slots: true },
                }))
              }
            }
            setShowDateModal(false)
          }}
        />
      )}

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

// ─── Password protection sub-block ────────────────────────────────────────────
// Optional gate for the public proposal URL. Plain text by design (soft-protect).

function PasswordProtectionBlock({
  form, setForm,
}: {
  form: { password_protected: boolean; access_password: string }
  setForm: React.Dispatch<React.SetStateAction<any>>
}) {
  const [reveal, setReveal] = useState(false)

  const generatePassword = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let pwd = ''
    const arr = new Uint8Array(10)
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(arr)
      for (let i = 0; i < arr.length; i++) pwd += alphabet[arr[i] % alphabet.length]
    } else {
      for (let i = 0; i < 10; i++) pwd += alphabet[Math.floor(Math.random() * alphabet.length)]
    }
    setForm((f: any) => ({ ...f, access_password: pwd, password_protected: true }))
    setReveal(true)
  }

  return (
    <div style={{ marginTop: 14, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
        <Checkbox
          checked={form.password_protected}
          onCheckedChange={(v) => setForm((f: any) => ({ ...f, password_protected: v === true }))}
        />
        <Lock size={13} style={{ color: 'var(--warm-gray)' }} />
        Proteger con contraseña
      </label>
      <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4, marginLeft: 22, lineHeight: 1.5 }}>
        La pareja necesitará introducirla antes de ver la propuesta.
      </div>

      {form.password_protected && (
        <div style={{ marginTop: 10, marginLeft: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type={reveal ? 'text' : 'password'}
                className="form-input"
                placeholder="Contraseña"
                value={form.access_password}
                onChange={e => setForm((f: any) => ({ ...f, access_password: e.target.value }))}
                style={{ fontSize: 12, paddingRight: 32 }}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setReveal(r => !r)}
                aria-label={reveal ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4, display: 'inline-flex' }}
              >
                {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <button
              type="button"
              onClick={generatePassword}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '0 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--cream)', color: 'var(--charcoal)', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              <RefreshCw size={11} /> Generar
            </button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
            Comparte la contraseña por un canal aparte (WhatsApp, email distinto al del enlace).
          </div>
        </div>
      )}
    </div>
  )
}

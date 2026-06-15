// app/dossier/[slug]/page.tsx
// Ruta pública — NO requiere autenticación
// URL: /dossier/laura-carlos-mn4h

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import ProposalLanding from './ProposalLanding'
import ProposalGate from '@/components/ProposalGate'
import type { SectionsData } from '@/lib/proposal-types'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type VenueContent = {
  packages:       Array<{ id: string; name: string; subtitle?: string; price?: string; min_guests?: number; max_guests?: number; description?: string; includes?: string[]; sort_order: number; is_active?: boolean }>
  zones:          Array<{ id: string; name: string; description?: string; capacity_min?: number; capacity_max?: number; price?: string; sort_order: number }>
  season_prices:  Array<{ id: string; season: string; label: string; date_range?: string; price_modifier?: string; notes?: string; sort_order: number }>
  inclusions:     Array<{ id: string; title: string; description?: string; emoji?: string; sort_order: number }>
  exclusions:     Array<{ id: string; title: string; description?: string; sort_order: number }>
  faq:            Array<{ id: string; question: string; answer: string; category?: string; sort_order: number }>
  testimonials:   Array<{ id: string; couple_name: string; wedding_date?: string; text: string; rating: number; photo_url?: string }>
  collaborators:  Array<{ id: string; name: string; category: string; description?: string; website?: string; sort_order: number }>
  extra_services: Array<{ id: string; name: string; description?: string; price?: string; sort_order: number }>
  menu_prices:    Array<{ id: string; name: string; description?: string; price_per_person: string; min_guests?: number; sort_order: number }>
  experience:     { id: string; title: string; body: string } | null
  techspecs:      { id: string; sqm?: string; ceiling?: string; parking?: string; accessibility?: string; ceremony_spaces?: string; extra?: string } | null
  accommodation_info: { id: string; rooms?: string; description?: string; price_info?: string; nearby?: string } | null
  map_info:       { id: string; embed_url?: string; address?: string; notes?: string } | null
  budget_simulator: { id: string; base_price?: string; price_per_person?: string; notes?: string } | null
  countdown:      { id: string; days?: number; message?: string } | null
}

export type ProposalData = {
  id: string
  slug: string
  couple_name: string
  personal_message: string | null
  guest_count: number | null
  wedding_date: string | null
  price_estimate: number | null
  show_availability: boolean
  show_price_estimate: boolean
  status: string
  ctas: string[]
  sections_data?: SectionsData | null
  _preview?: boolean
  venueContent: VenueContent
  commercialConfig?: { space_type?: string; price_model?: string } | null
  lodging?: {
    config_id: string
    room_types: any[]
    prices: any[]
    extras: any[]
    blocks: any[]
    inventory_limits: any[]
    selections: any[]
  } | null
  commission_planner_id?: string | null
  commission_percent?: number | null
  commission_mode?: 'comisionable' | 'neto' | null
  commission_amount?: number | null
  // venue — used only for hero name/city and contact
  venue: {
    name: string | null
    city: string | null
    region: string | null
    contact_email: string | null
    contact_phone: string | null
    website: string | null
    photo_urls: string[] | null
  } | null
  // branding
  branding: {
    logo_url: string | null
    primary_color: string
    secondary_color?: string | null
    font_family?: string | null
  } | null
}

// ─── Supabase server client (sin cookies de auth, solo lectura pública) ───────

async function createPublicClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set() {},
        remove() {},
      },
    }
  )
}

// ─── Metadata dinámica ────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createPublicClient()
  const { data } = await supabase
    .from('proposals')
    .select('couple_name, venue_onboarding!proposals_user_id_fkey(name, city)')
    .eq('slug', slug)
    .single()

  if (!data) return { title: 'Propuesta | FOREVENTOS' }

  const venue = (data as any).venue_onboarding
  return {
    title: `${data.couple_name} | ${venue?.name ?? 'FOREVENTOS'}`,
    description: `Propuesta personalizada para ${data.couple_name}${venue?.city ? ` en ${venue.city}` : ''}.`,
    openGraph: {
      title: `${data.couple_name} · Propuesta exclusiva`,
      description: `Tu propuesta personalizada de boda en ${venue?.name ?? 'FOREVENTOS'}`,
    },
  }
}

// ─── Page (Server Component) ──────────────────────────────────────────────────

export default async function ProposalPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Promise<{ preview?: string }> }) {
  const { slug } = await params
  const sp = searchParams ? await searchParams : {}
  const preview = sp?.preview === '1'
  const supabase = await createPublicClient()

  // 1. Obtener propuesta
  const { data: proposal, error } = await supabase
    .from('proposals')
    .select(`
      id, slug, couple_name, personal_message,
      guest_count, wedding_date, price_estimate,
      show_availability, show_price_estimate, status, ctas,
      sections_data, user_id, access_password, venue_id,
      commission_planner_id, commission_percent, commission_mode, commission_amount,
      lodging_config_id
    `)
    .eq('slug', slug)
    .single()

  if (error || !proposal) notFound()

  // 1b. Password gate — render lock screen if access_password is set and cookie does not match.
  // Preview mode (editor iframe) bypasses the gate so the venue can see their own proposal.
  if (proposal.access_password && !preview) {
    const cookieStore = await cookies()
    const unlockCookie = cookieStore.get(`proposal_unlock_${proposal.id}`)?.value
    if (unlockCookie !== proposal.access_password) {
      return <ProposalGate slug={proposal.slug} coupleName={proposal.couple_name} />
    }
  }

  // 2. Obtener datos del venue (solo nombre, ciudad, contacto para el hero y CTA)
  let { data: venueData } = await supabase
    .from('venue_onboarding')
    .select('name, city, region, contact_email, contact_phone, website, photo_urls')
    .eq('user_id', proposal.user_id)
    .eq('venue_id', proposal.venue_id)
    .maybeSingle()
  // Fallback: if no venue_onboarding matched by venue_id, try user_venues for the name
  if (!venueData && proposal.venue_id) {
    const { data: uv } = await supabase
      .from('user_venues')
      .select('name')
      .eq('id', proposal.venue_id)
      .maybeSingle()
    if (uv?.name) venueData = { name: uv.name, city: null, region: null, contact_email: null, contact_phone: null, website: null, photo_urls: null } as any
  }

  // 3. Obtener branding
  const { data: brandingData } = await supabase
    .from('proposal_branding')
    .select('logo_url, primary_color, font_family')
    .eq('proposal_id', proposal.id)
    .single()

  // 4. Obtener venue_settings (space_groups + commercial_config para secciones y tarifas)
  const { data: venueSettings } = await supabase
    .from('venue_settings')
    .select('space_groups, commercial_config')
    .eq('user_id', proposal.user_id)
    .maybeSingle()

  // If proposal has a specific commercial_config_id, use that config instead
  // Also pull zones/space_groups from the config (per-config storage)
  if ((proposal as any).commercial_config_id) {
    const { data: ccRow } = await supabase
      .from('venue_commercial_configs')
      .select('config')
      .eq('id', (proposal as any).commercial_config_id)
      .maybeSingle()
    if (ccRow?.config && venueSettings) {
      const cfg = ccRow.config as any
      ;(venueSettings as any).commercial_config = cfg
      // Override venue-level zones/space_groups with config-scoped ones if present
      if (Array.isArray(cfg.space_groups)) {
        ;(venueSettings as any).space_groups = cfg.space_groups
      }
      if (Array.isArray(cfg.zones)) {
        ;(venueSettings as any).zones = cfg.zones
      }
    }
  }

  // Modalities: load modalidades of proposal's commercial_config_id
  // These drive the "Paquetes" section when price_model='package'
  let modalitiesData: any[] = []
  if ((proposal as any).commercial_config_id) {
    const { data: mods } = await supabase
      .from('venue_modalities')
      .select(`
        *,
        packages:venue_modality_packages(*, prices:venue_modality_prices(*), option_groups:package_option_groups(*, items:package_option_items(*))),
        prices:venue_modality_prices(*)
      `)
      .eq('commercial_config_id', (proposal as any).commercial_config_id)
      .eq('is_active', true)
      .order('sort_order')
    modalitiesData = mods ?? []
  }

  // Lodging data: load if proposal has lodging_config_id
  let lodgingData: any = null
  if ((proposal as any).lodging_config_id) {
    const lcId = (proposal as any).lodging_config_id
    const [rtsR, prR, exR, lmR, selR] = await Promise.all([
      supabase.from('venue_room_types').select('*').eq('commercial_config_id', lcId).eq('is_active', true).order('sort_order'),
      supabase.from('venue_room_prices').select('*'),
      supabase.from('venue_room_extras').select('*').eq('commercial_config_id', lcId).eq('is_active', true).order('sort_order'),
      supabase.from('proposal_room_inventory_limits').select('*').eq('proposal_id', proposal.id),
      supabase.from('proposal_room_selections').select('*').eq('proposal_id', proposal.id),
    ])
    const rts = rtsR.data ?? []
    const rtIds = rts.map((r: any) => r.id)
    // Filter prices to only those of relevant room types
    const prices = (prR.data ?? []).filter((p: any) => rtIds.includes(p.room_type_id))
    // Load blocks
    const { data: blocksData } = await supabase
      .from('venue_room_blocks')
      .select('*')
      .in('room_type_id', rtIds.length > 0 ? rtIds : ['00000000-0000-0000-0000-000000000000'])
    lodgingData = {
      config_id:      lcId,
      room_types:     rts,
      prices,
      extras:         exR.data ?? [],
      blocks:         blocksData ?? [],
      inventory_limits: lmR.data ?? [],
      selections:     selR.data ?? [],
    }
  }

  // 5. Obtener venue_content (contenido de propuesta — completamente independiente de la ficha)
  const { data: vcRows } = await supabase
    .from('venue_content')
    .select('*')
    .eq('user_id', proposal.user_id)
    .order('sort_order')

  const vc = (vcRows ?? []) as any[]
  const findOne = (sec: string) => { const r = vc.find(r => r.section === sec); return r ? { id: r.id, ...r.data } : null }
  const findMany = (sec: string) => vc.filter(r => r.section === sec).map(r => ({ id: r.id, ...r.data }))

  const venueContent: VenueContent = {
    packages:       findMany('package'),
    zones:          findMany('zone'),
    season_prices:  findMany('season_price'),
    inclusions:     findMany('inclusion'),
    exclusions:     findMany('exclusion'),
    faq:            findMany('faq'),
    testimonials:   findMany('testimonial'),
    collaborators:  findMany('collaborator'),
    extra_services: findMany('extra_service'),
    menu_prices:        findMany('menu_price'),
    experience:         findOne('experience'),
    techspecs:          findOne('techspecs'),
    accommodation_info: findOne('accommodation_info'),
    map_info:           findOne('map_info'),
    budget_simulator:   findOne('budget_simulator'),
    countdown:          findOne('countdown'),
  }

  // Merge venue_settings.space_groups as fallback when proposal has none configured
  const sectionsData: any = { ...(proposal.sections_data as any ?? {}) }
  if (!sectionsData.space_groups?.length && venueSettings?.space_groups?.length) {
    sectionsData.space_groups = venueSettings.space_groups
  } else if (sectionsData.space_groups?.length && venueSettings?.space_groups?.length) {
    // Sync live fields from venue_settings (source of truth) into sections_data groups
    sectionsData.space_groups = sectionsData.space_groups.map((sg: any) => {
      const live = (venueSettings.space_groups as any[]).find((v: any) => v.id === (sg.group_id ?? sg.id))
      if (!live) return sg
      const synced: any = { ...sg }
      if ('included_zone_ids' in live) synced.included_zone_ids = live.included_zone_ids
      if ('selection_mode' in live) synced.selection_mode = live.selection_mode
      if ('pick_n_min' in live) synced.pick_n_min = live.pick_n_min
      if ('pick_n_max' in live) synced.pick_n_max = live.pick_n_max
      if ('pricing_display' in live) synced.pricing_display = live.pricing_display
      if (Array.isArray(live.spaces) && Array.isArray(sg.spaces)) {
        synced.spaces = sg.spaces.map((sp: any) => {
          const liveSp = live.spaces.find((ls: any) => ls.id === (sp.id ?? sp.zone_id))
          if (!liveSp) return sp
          return {
            ...sp,
            zone_id: liveSp.id,  // ensure zone_id is set for included_zone_ids matching
            ...(Array.isArray(liveSp.price_tiers) ? { price_tiers: liveSp.price_tiers } : {}),
          }
        })
      }
      return synced
    })
  }

  const sectionsSecondary = sectionsData?.secondary_color as string | undefined
  const baseBranding = brandingData ?? { logo_url: null, primary_color: '#2d4a7a' }
  const proposalData: ProposalData = {
    ...proposal,
    sections_data: sectionsData,
    venue: venueData ?? null,
    branding: { ...baseBranding, secondary_color: sectionsSecondary ?? null },
    venueContent,
    commercialConfig: (venueSettings as any)?.commercial_config ?? null,
    lodging: lodgingData,
    modalities: modalitiesData,
  } as any

  return <ProposalLanding data={proposalData} preview={preview} />
}

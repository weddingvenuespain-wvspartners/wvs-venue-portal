// Single source of truth for proposal section types.

// ── Visit availability (configured in /estructura) ────────────────────────────
export type DaySchedule = {
  day: number       // 0=Monday … 6=Sunday
  enabled: boolean
  from: string      // "10:00"
  to: string        // "19:00"
}

export type HourRange = { from: string; to: string }  // "HH:mm"

export type BlockedDate = {
  date: string                               // "YYYY-MM-DD"
  type: 'full' | 'morning' | 'afternoon' | 'hours'
  ranges?: HourRange[]                       // multiple hour ranges when type === 'hours'
  from?: string                              // legacy single range (backward compat)
  to?: string                               // legacy single range (backward compat)
}

export type VisitAvailability = {
  slot_duration: 30 | 45 | 60 | 90 | 120   // minutes per slot
  schedule: DaySchedule[]
  block_booked_weddings: boolean            // block days with reservado/ganado calendar entries
  block_calendar_unavailable: boolean       // block any day that is not 'libre' in calendar
  blocked_dates: BlockedDate[]              // manual blocks
}

// ── Visit request (stored in proposals.visit_request) ────────────────────────
export type VisitRequest = {
  date: string        // "YYYY-MM-DD"
  time: string        // "HH:MM"
  message?: string
  couple_name?: string
  couple_email?: string
  selected_spaces?: Array<{ group_name: string; space_name: string }>
  selected_menus?: string[]
  requested_at: string   // ISO timestamp
  status: 'pending' | 'confirmed' | 'cancelled'
}


// Imported by:
//  - app/proposal/[slug]/tpl/shared.tsx (re-exports these to templates)
//  - components/ProposalEditor.tsx / ProposalMenuEditor.tsx

// ── Menu structured types (WeddingProposal) ────────────────────────────────────
export type MenuItem = {
  name: string
  description?: string
  extra_price?: string            // opcional, normalmente vacío si incluido
}

export type MenuCourse = {
  label: string                   // "Primer plato", "Plato principal", "Postre"...
  mode?: 'fixed' | 'pick_one' | 'pick_n'  // default: 'fixed'
  pick_count?: number             // si mode='pick_n'
  items: MenuItem[]
}

export type MenuSeasonPrice = {
  date_from:        string   // "YYYY-MM-DD"
  date_to:          string   // "YYYY-MM-DD"
  price_per_person: string   // "95€ +IVA"
  season?:          string   // etiqueta libre, ej: "Temporada alta"
}

export type Menu = {
  id?: string                     // opcional, para referenciar en la selección
  name: string                    // "Menú Bosque"
  subtitle?: string
  price_per_person: string        // precio base / por defecto (puede ser vacío si solo hay gasto mínimo)
  min_spend?: string              // gasto mínimo total (ej. "12.000€ +IVA") — para menús carta o abiertos
  season_prices?: MenuSeasonPrice[] // precios por temporada (sobrescriben price_per_person si la fecha aplica)
  min_guests?: number
  max_guests?: number
  courses?: MenuCourse[]          // si tiene cursos estructurados
  description?: string            // fallback: texto libre
  photo_url?: string
  pdf_url?: string
}

export type MenuExtra = {
  id?: string
  category: 'station' | 'resopon' | 'open_bar' | 'ceremony' | 'audiovisual' | 'music' | 'other'
  name: string
  description?: string
  price: string                   // "45€", "1000€"
  price_type: 'per_person' | 'flat'
  min_guests?: number
  photo_url?: string
}

export type AppetizerGroup = {
  label: string                   // "Aperitivos fríos", "Buffet mediterráneo"
  items: string[]
}

export type DateSlot = {
  id?: string
  label?: string           // "Temporada alta", "Fin de semana premium"
  dates: string[]          // ["2025-10-04", "2025-10-11"]
  price_per_person?: string // "110€/pax"
  price_rental?: string    // "5.000€"
  notes?: string           // "Sábados · IVA no incluido"
}

export type VenueSpaceItem = {
  id?: string
  zone_id?: string  // link to VenueSpace.id in venue_settings.space_groups
  name: string
  description?: string
  photo_url?: string
  capacity_min?: number
  capacity_max?: number
  price?: string
  price_label?: string
}

export type SpaceGroup = {
  id?: string
  group_id?: string  // link to VenueSpaceGroup.id in venue_settings.space_groups
  name: string
  description?: string
  note?: string
  requires_selection?: boolean  // legacy
  selection_mode?: 'pick_one' | 'pick_n' | 'optional'
  pick_n_min?: number
  pick_n_max?: number
  pricing_mode?: 'group_base' | 'per_space'  // group_base: base + extras; per_space: each space has its own price
  base_price?: string  // when pricing_mode === 'group_base'
  spaces: VenueSpaceItem[]
}

// ── Venue space groups — source of truth in venue_settings.space_groups ────────
export type VenueSpace = {
  id: string
  name: string
  description?: string
  capacity_min?: number
  capacity_max?: number
  price?: string
  photo_url?: string
}

export type VenueSpaceGroup = {
  id: string
  name: string
  selection_mode: 'pick_one' | 'pick_n' | 'optional'
  pick_n_min?: number   // minimum selections (pick_n mode)
  pick_n_max?: number   // maximum selections (pick_n mode)
  pricing_mode?: 'group_base' | 'per_space'  // default: per_space
  base_price?: string  // when pricing_mode === 'group_base'
  spaces: VenueSpace[]
}

export type SectionsData = {
  availability_message?: string
  sections_enabled?: Record<string, boolean>
  iva_included?: boolean
  show_menu_prices?: boolean        // default true; false = menus shown without price (price comes from proposal estimate)
  menu_sections_visible?: { cocktail?: boolean; menus?: boolean; night?: boolean; event_extras?: boolean }
  // Visual branding (used by templates; copied to proposal branding on apply)
  primary_color?: string
  secondary_color?: string
  background_color?: string
  color_mode?: 'light' | 'dark'   // forces light/dark variant on top of any template
  logo_url?: string | null
  font_family?: string
  contact?: { phone?: string; email?: string }
  has_catering?: boolean
  venue_rental?: {
    title?: string
    intro?: string
    day_tiers?: string[]
    rows?: Array<{ season: string; prices: Array<string | null> }>
    notes?: string
  }
  single_space?: {
    title?: string
    description?: string
    sqm?: string
    max_guests?: string
    features?: string[]
    image_url?: string
  } | null
  packages_override?:       Array<{ name: string; subtitle?: string; price?: string; description?: string; includes?: string[]; is_recommended?: boolean; min_guests?: number; max_guests?: number; is_active?: boolean }> | null
  zones_override?:          Array<{
    name: string
    description?: string
    photos?: string[]
    price?: string
    capacities?: Array<{ type: 'ceremony' | 'cocktail' | 'banquet' | 'party' | 'other'; count?: number; label?: string }>
    sqm?: number
    climatized?: boolean
    plan_b?: boolean
    covered?: 'indoor' | 'outdoor' | 'covered-outdoor'
    notes?: string
    capacity_min?: number
    capacity_max?: number
  }> | null
  season_prices_override?:  Array<{ label?: string; season?: string; date_range?: string; price_modifier?: string; notes?: string }> | null
  inclusions_override?:     Array<{ title: string; emoji?: string; icon?: string; description?: string }> | null
  faq_override?:            Array<{ question: string; answer: string }> | null
  collaborators_override?:  Array<{ name: string; category: string; description?: string; website?: string }> | null
  extra_services_override?: Array<{ name: string; price?: string; description?: string }> | null
  menu_prices_override?:    Array<{ name: string; price_per_person: string; description?: string; min_guests?: number }> | null
  // Nuevo modelo estructurado (WeddingProposal)
  menus_override?:          Menu[] | null
  menu_extras_override?:    MenuExtra[] | null
  appetizers_base_override?: AppetizerGroup[] | null
  experience_override?:     { title: string; body: string } | null
  testimonials_override?:   Array<{ couple_name?: string; names?: string; wedding_date?: string; date?: string; text: string; rating?: number; photo_url?: string }> | null
  // Per-proposal image overrides
  hero_image_url?: string
  gallery_urls?: string[]
  // Date slots — multiple available dates with optional per-slot pricing
  date_slots?: DateSlot[] | null
  // Space groups — grouped zone selector for venues with multiple zones
  space_groups?: SpaceGroup[] | null
  // Per-proposal map override (if empty, falls back to venueContent.map_info)
  map_embed_url?: string
  map_address?: string
  // Visual template selection (1–5)
  visual_template_id?: number
  // Content template that was last applied to this proposal
  content_template_id?: string
  // Sections — new blocks
  schedule_visit?: { title?: string; subtitle?: string; url?: string; cta_label?: string; note?: string } | null
  sticky_nav?: { links?: Array<{ label: string; anchor: string }> } | null
  welcome_light?: { image_url?: string } | null
  welcome_split?: { image_url?: string; image_side?: 'left' | 'right' } | null
  welcome_editorial?: { eyebrow?: string } | null
  // Legacy fallback used by extractData for older proposals
  testimonials?: Array<{ names: string; couple_name?: string; date?: string; wedding_date?: string; guests?: number; text: string; rating?: number; photo_url?: string }>
  accommodation?: {
    rooms?: string
    description?: string
    price_info?: string
    nearby?: string
    options?: Array<{
      label: string
      description?: string
      included?: boolean
      price_info?: string
      prices?: Array<{ season: string; price: string }>
    }>
  }
}

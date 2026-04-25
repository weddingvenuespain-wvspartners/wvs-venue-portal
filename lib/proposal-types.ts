// Single source of truth for proposal section types.
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

export type VenueSpaceItem = {
  id?: string
  name: string
  description?: string
  photo_url?: string
  capacity_max?: number
  price?: string
  price_label?: string
}

export type SpaceGroup = {
  id?: string
  name: string
  description?: string
  note?: string
  requires_selection?: boolean
  spaces: VenueSpaceItem[]
}

export type SectionsData = {
  availability_message?: string
  sections_enabled?: Record<string, boolean>
  iva_included?: boolean
  show_menu_prices?: boolean        // default true; false = menus shown without price (price comes from proposal estimate)
  contact?: { phone?: string; email?: string }
  has_catering?: boolean
  venue_rental?: {
    title?: string
    intro?: string
    day_tiers?: string[]
    rows?: Array<{ season: string; prices: Array<string | null> }>
    notes?: string
  }
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
  // Space groups — grouped zone selector for venues with multiple zones
  space_groups?: SpaceGroup[] | null
  // Per-proposal map override (if empty, falls back to venueContent.map_info)
  map_embed_url?: string
  map_address?: string
  // Visual template selection (1–5)
  visual_template_id?: number
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

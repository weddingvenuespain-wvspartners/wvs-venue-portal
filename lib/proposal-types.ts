// Shared types for proposal/sections data
// Used by app/propuestas/page.tsx

export type SectionsData = {
  video_url?: string; video_title?: string
  show_chat?: boolean; chat_intro?: string
  show_nextsteps?: boolean
  nextsteps?: Array<{ title: string; description: string }>
  show_availability_msg?: boolean; availability_message?: string
  sections_enabled?: Record<string, boolean>
  packages_override?:       Array<{ name: string; subtitle?: string; price?: string; description?: string; includes?: string[]; is_recommended?: boolean; min_guests?: number; max_guests?: number; is_active?: boolean }> | null
  zones_override?:          Array<{ name: string; description?: string; capacity_min?: number; capacity_max?: number; price?: string; photos?: string[] }> | null
  season_prices_override?:  Array<{ label?: string; season?: string; date_range?: string; price_modifier?: string; notes?: string }> | null
  inclusions_override?:     Array<{ title: string; emoji?: string; description?: string }> | null
  faq_override?:            Array<{ question: string; answer: string }> | null
  collaborators_override?:  Array<{ name: string; category: string; description?: string; website?: string }> | null
  extra_services_override?: Array<{ name: string; price?: string; description?: string }> | null
  menu_prices_override?:    Array<{ name: string; price_per_person: string; description?: string; min_guests?: number }> | null
  experience_override?:     { title: string; body: string } | null
  testimonials_override?:   Array<{ couple_name?: string; names?: string; wedding_date?: string; date?: string; text: string; rating?: number; photo_url?: string }> | null
  // Per-proposal image overrides
  hero_image_url?: string
  gallery_urls?: string[]
  // Visual template selection (1–5)
  visual_template_id?: number
  // Legacy fields used by propuestas/page.tsx
  show_timeline?: boolean; timeline_intro?: string
  timeline?: Array<{ time: string; title: string; description?: string }>
  show_testimonials?: boolean
  testimonials?: Array<{ names: string; couple_name?: string; date?: string; wedding_date?: string; guests?: number; text: string; rating?: number; photo_url?: string }>
  show_map?: boolean; map_embed_url?: string; map_address?: string; map_notes?: string
  show_techspecs?: boolean
  techspecs?: { sqm?: string; ceiling?: string; parking?: string; accessibility?: string; ceremony_spaces?: string; extra?: string }
  show_accommodation?: boolean
  accommodation?: { rooms?: string; description?: string; price_info?: string; nearby?: string }
}

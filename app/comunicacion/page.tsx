'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import {
  MessageCircle, Mail, FileText, Plus, Trash2, Send, X,
  Copy, Check, Upload, Eye, Sparkles, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  AlertCircle, User, Search, Palette, Link2, ToggleLeft, ToggleRight,
  Pencil, Download, Star, Package, HelpCircle, Quote, List,
  GripVertical, ChevronsUpDown, Image as ImageIcon, Layers,
  MapPin, Calendar, XCircle, Images, Users, Timer, UtensilsCrossed,
  Calculator, ScrollText, Ban, Lock,
  AlertTriangle, Camera, Flower2, Music, Snowflake
} from 'lucide-react'
import { GOOGLE_FONTS, FONT_CATEGORIES, ALL_FONTS_URL, getFontByValue } from '@/lib/fonts'
import { usePlanFeatures } from '@/lib/use-plan-features'

// ── Types ────────────────────────────────────────────────────────────────────

type CommTab = 'messages' | 'dossier'

// ── Content Library Types ────────────────────────────────────────────────────

type ContentSection =
  | 'packages'
  | 'zones'
  | 'season_prices'
  | 'inclusions'
  | 'exclusions'
  | 'faq'
  | 'testimonials'
  | 'hero_photos'
  | 'gallery'
  | 'collaborators'
  | 'extra_services'
  | 'countdown'
  | 'menu_price'
  | 'budget_simulator'
  | 'conditions'
  | 'experience'
  | 'video_default'
  | 'techspecs'
  | 'accommodation_info'
  | 'map_info'
  | 'chat_settings'
  | 'caterer_recommendation'
  | 'vendor_policy'
  | 'payment_plan'
  | 'display_config'

// ── Pricing model ────────────────────────────────────────────────────────────

type PricingModel = 'all_inclusive' | 'venue_only' | 'semi_inclusive' | 'modular'

type VenuePricingModel = {
  id?: string
  model: PricingModel
  catering_policy?: 'included' | 'internal_preferred' | 'external_free' | 'external_mandatory'
  notes?: string
}

const PRICING_MODELS: Array<{
  value: PricingModel
  icon: string
  label: string
  desc: string
  priceUnit: string
  tip: string
}> = [
  {
    value: 'all_inclusive',
    icon: '🎯',
    label: 'Todo incluido',
    desc: 'Precio/persona cubre espacio, catering, bebidas y coordinación.',
    priceUnit: '€/persona',
    tip: 'Cada paquete tiene precio por persona. Las inclusiones muestran todo lo que está en el precio.',
  },
  {
    value: 'venue_only',
    icon: '🏛️',
    label: 'Solo espacio',
    desc: 'Precio fijo por el alquiler. La pareja escoge caterer, decoración, etc. por separado.',
    priceUnit: '€/evento',
    tip: 'Los paquetes son tarifas de alquiler. Las exclusiones son tan importantes como las inclusiones.',
  },
  {
    value: 'semi_inclusive',
    icon: '🎨',
    label: 'Semi-incluido',
    desc: 'Espacio + algunos servicios propios (catering opcional o incluido). Libertad en el resto.',
    priceUnit: '€ base + opcionales',
    tip: 'Puedes mostrar un precio base del espacio y paquetes de catering por separado.',
  },
  {
    value: 'modular',
    icon: '🧩',
    label: 'À la carte',
    desc: 'La pareja construye su boda servicio a servicio desde un catálogo.',
    priceUnit: '€/servicio',
    tip: 'Usa "Servicios adicionales" para cada módulo. Los paquetes son bundles de módulos.',
  },
]

// Maps group id → relevance per pricing model
type SectionRelevance = 'key' | 'optional' | 'na'
const SECTION_RELEVANCE: Record<string, Partial<Record<PricingModel, SectionRelevance>>> = {
  // Core groups — all 'key' by definition (only shown for their model)
  prices:            { all_inclusive: 'key',      venue_only: 'key',      semi_inclusive: 'key',      modular: 'key'      },
  menus:             { all_inclusive: 'key',                              semi_inclusive: 'key',      modular: 'optional' },
  inclusions:        {                                                     semi_inclusive: 'key'                          },
  extras:            { all_inclusive: 'key',      venue_only: 'key',      semi_inclusive: 'key',      modular: 'key'      },
  booking:           { all_inclusive: 'key',      venue_only: 'key',      semi_inclusive: 'key',      modular: 'key'      },
  // semi_inclusive / modular specific (venue_only pricing is all in group 1)
  // semi_inclusive specific
  flexible_services: {                                                     semi_inclusive: 'key'                           },
  // modular specific
  components:        {                                                                                 modular: 'key'      },
  rules:             {                                                                                 modular: 'key'      },
  // Secondary groups (always shown)
  collaborators:     { all_inclusive: 'optional', venue_only: 'key',      semi_inclusive: 'key',      modular: 'optional' },
  visual:            { all_inclusive: 'optional', venue_only: 'optional', semi_inclusive: 'optional', modular: 'optional' },
  commercial:        { all_inclusive: 'optional', venue_only: 'optional', semi_inclusive: 'optional', modular: 'optional' },
  venue_info:        { all_inclusive: 'optional', venue_only: 'key',      semi_inclusive: 'optional', modular: 'optional' },
  tools_faq:         { all_inclusive: 'optional', venue_only: 'key',      semi_inclusive: 'optional', modular: 'optional' },
}

const RELEVANCE_BADGE: Record<SectionRelevance, { label: string; color: string; bg: string }> = {
  key:      { label: '🔑 Clave',    color: '#92400e', bg: '#fef3c7' },
  optional: { label: '⚪ Opcional', color: '#6b7280', bg: '#f3f4f6' },
  na:       { label: '🚫 No aplica', color: '#9ca3af', bg: '#f9fafb' },
}

type VenuePackage = {
  id: string
  name: string
  subtitle?: string
  tier?: 'basico' | 'estandar' | 'premium' | 'exclusivo' | 'lujo'
  price?: string
  price_type?: 'per_person' | 'flat_fee' | 'from_price' | 'on_request' | 'min_spend'
  price_iva_included?: boolean
  is_recommended?: boolean
  min_guests?: number
  max_guests?: number
  days_available?: string[]
  event_hours?: number
  music_curfew?: string
  description?: string
  includes: string[]
  sort_order: number
  is_active: boolean
}

type VenueInclusion = {
  id: string
  title: string
  description?: string
  emoji?: string
  category?: 'espacio' | 'catering' | 'coordinacion' | 'decoracion' | 'alojamiento' | 'av_musica' | 'otros'
  sort_order: number
}

type VenueFaq = {
  id: string
  question: string
  answer: string
  category?: string
  sort_order: number
}

type VenueTestimonial = {
  id: string
  couple_name: string
  wedding_date?: string
  text: string
  rating: number
  photo_url?: string
}

type VenueExperience = {
  id: string
  title: string
  body: string
}

type VenueVideoSection = { id?: string; url?: string; title?: string }
type VenueTechspecs = { id?: string; sqm?: string; ceiling?: string; parking?: string; accessibility?: string; ceremony_spaces?: string; extra?: string }
type VenueAccommodationInfo = { id?: string; rooms?: string; description?: string; price_info?: string; nearby?: string }
type VenueMapInfo = { id?: string; embed_url?: string; address?: string; notes?: string }
type VenueChatSettings = { id?: string; enabled?: boolean; intro_text?: string }

type VenueZone = {
  id: string
  name: string
  description?: string
  capacity_min?: number
  capacity_max?: number
  price?: string
  sort_order: number
  photos?: string[]
  supplement_price?: string   // base_plus: extra cost for this optional zone
  group_name?: string         // by_group: which selection group this zone belongs to
}

type VenueSeasonPrice = {
  id: string
  season: string
  label: string
  // New date-range period fields (for venue_only primary pricing)
  date_from?: string      // ISO "YYYY-MM-DD"
  date_to?: string        // ISO "YYYY-MM-DD"
  base_price?: string     // absolute price for this period (e.g. "5500")
  price_unit?: 'per_day' | 'per_event'
  zone_id?: string        // links period to a specific zone (venue_only by-zone pricing)
  applicable_days?: string[]   // e.g. ['vie','sab','dom'] — empty/null = all days
  includes_holidays?: boolean  // true = price also applies on public holidays
  // Legacy adjustment fields
  date_range?: string
  price_modifier?: string
  notes?: string
  sort_order: number
}

type VenueExclusion = {
  id: string
  title: string
  description?: string
  sort_order: number
}

type VenueCollaborator = {
  id: string
  name: string
  category: string
  description?: string
  website?: string
  sort_order: number
}

type VenueExtraService = {
  id: string
  name: string
  description?: string
  price?: string
  sort_order: number
}

type VenueCountdown = {
  id: string
  days: number
  message: string
}

type VenueMenuPrice = {
  id: string
  name: string
  description?: string
  price_per_person: string
  min_guests?: number
  sort_order: number
}

type VenueBudgetSimulator = {
  id: string
  base_price: string
  price_per_person: string
  notes?: string
}

type VenueConditions = {
  id: string
  title: string
  body: string
}

type VenueCatererRecommendation = {
  id: string
  name: string
  category?: string
  website?: string
  phone?: string
  notes?: string
  sort_order: number
}

// ── Vendor policy ─────────────────────────────────────────────────────────────
type VendorPolicyChoice = 'exclusive' | 'approved_list' | 'open'

type VendorPolicy = {
  id?: string
  catering?: VendorPolicyChoice
  dj_music?: VendorPolicyChoice
  photography?: VendorPolicyChoice
  decoration?: VendorPolicyChoice
  coordinator?: VendorPolicyChoice
  external_fee?: string   // e.g. "15% sobre presupuesto externo"
  notes?: string
}

// ── Payment plan ─────────────────────────────────────────────────────────────
type PaymentMilestone = {
  id: string
  label: string                       // e.g. "Señal de reserva"
  amount_type: 'fixed' | 'percent'
  amount: string                      // e.g. "3000" or "30"
  trigger?: string                    // e.g. "Al firmar el contrato"
}

type VenuePaymentPlan = {
  id?: string
  milestones: PaymentMilestone[]
  security_deposit?: string           // e.g. "1.500€ fianza"
  cancellation_policy?: string
}

// ── Display config — toggles per section ─────────────────────────────────────
type VenueDisplayConfig = {
  id?: string
  // Prices
  prices_has_season?: boolean
  prices_has_day_pricing?: boolean
  prices_has_zone_pricing?: boolean
  prices_has_min_spend?: boolean
  prices_is_multiday?: boolean
  venue_price_type?: 'full' | 'base_plus'
  // Menus/catering
  menus_active?: boolean
  menus_has_children?: boolean
  menus_has_vegan?: boolean
  menus_has_tasting?: boolean
  // Booking / conditions
  booking_has_vendor_policy?: boolean
  booking_has_payment_plan?: boolean
  // Venue info
  venue_has_accommodation?: boolean
  venue_has_zones?: boolean
  // Tools
  tools_budget_sim?: boolean
  tools_countdown?: boolean
  tools_chat?: boolean
}

const DEFAULT_DISPLAY_CFG: VenueDisplayConfig = {
  prices_has_season: false,
  prices_has_day_pricing: false,
  prices_has_zone_pricing: false,
  prices_has_min_spend: false,
  prices_is_multiday: false,
  venue_price_type: 'full',
  menus_active: true,
  menus_has_children: false,
  menus_has_vegan: false,
  menus_has_tasting: false,
  booking_has_vendor_policy: false,
  booking_has_payment_plan: false,
  venue_has_accommodation: false,
  venue_has_zones: false,
  tools_budget_sim: false,
  tools_countdown: false,
  tools_chat: false,
}

type Channel = 'whatsapp' | 'email' | 'both'

type MsgTemplate = {
  id: string
  name: string
  category: string
  channel: Channel
  subject?: string
  body: string
  created_at?: string
}

type ProposalTplSection = {
  id: string
  enabled: boolean
  selected_ids?: string[]  // which content items to show (undefined/empty = all)
}

type ProposalTemplate = {
  id: string
  name: string
  type: 'standard' | 'indian' | 'events' | 'custom'
  sections: ProposalTplSection[]
  accent_color: string
  header_text: string
  cta_text: string
  show_price: boolean
  is_default: boolean
  font_family?: string
}

type Dossier = {
  id: string
  name: string
  file_url: string
  description?: string
  is_default: boolean
  created_at: string
}

type Lead = { id: string; name: string; email?: string; phone?: string; wedding_date?: string; guests?: number }

// ── Constants ────────────────────────────────────────────────────────────────

const MSG_VARS = [
  { key: '{{nombre}}',           label: 'Nombre pareja',    sample: 'Laura & Carlos' },
  { key: '{{venue}}',            label: 'Nombre venue',     sample: 'Villa Rosa' },
  { key: '{{fecha}}',            label: 'Fecha boda',       sample: '15 jun. 2026' },
  { key: '{{invitados}}',        label: 'Nº invitados',     sample: '150' },
  { key: '{{precio}}',           label: 'Precio',           sample: '12.500€' },
  { key: '{{enlace_propuesta}}', label: 'Link propuesta',   sample: 'https://wvs.es/p/abc123' },
  { key: '{{enlace_dossier}}',   label: 'Link dossier',     sample: 'https://wvs.es/d/abc123' },
]

const MSG_CATEGORIES = [
  { value: 'contacto',    label: 'Primer contacto' },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'visita',      label: 'Visita' },
  { value: 'propuesta',   label: 'Propuesta' },
  { value: 'dossier',     label: 'Dossier' },
  { value: 'general',     label: 'General' },
]

const ALL_SECTIONS_CFG = [
  { id: 'hero',          label: 'Foto principal',              desc: 'Imagen de portada con nombre de la pareja',   required: true,  emoji: '🖼️' },
  { id: 'welcome',       label: 'Mensaje de bienvenida',       desc: 'Texto personalizado para la pareja',          emoji: '💌' },
  { id: 'video',         label: 'Video del venue',             desc: 'YouTube o Vimeo embebido',                    emoji: '🎬' },
  { id: 'gallery',       label: 'Galería de fotos',            desc: 'Selección de imágenes del venue',             emoji: '🖼️' },
  { id: 'techspecs',     label: 'Ficha técnica del venue',     desc: 'Capacidad, m², espacios, parking…',           emoji: '📐' },
  { id: 'zones',         label: 'Zonas del venue',             desc: 'Espacios interiores y exteriores',            emoji: '🏛️' },
  { id: 'packages',      label: 'Paquetes y precios',          desc: 'Tabla de paquetes con precios',               emoji: '💎' },
  { id: 'season_prices', label: 'Desglose / Temporadas',       desc: 'Precios por temporada o tipo de día',         emoji: '📅' },
  { id: 'inclusions',    label: 'Qué incluye',                 desc: 'Lista de servicios incluidos',                emoji: '✅' },
  { id: 'extra_services',label: 'Servicios adicionales',       desc: 'Extras opcionales y add-ons',                 emoji: '➕' },
  { id: 'menu_prices',   label: 'Catering y menú',             desc: 'Opciones de menú y precios',                  emoji: '🍽️' },
  { id: 'accommodation', label: 'Alojamiento',                 desc: 'Habitaciones disponibles e info',             emoji: '🛏️' },
  { id: 'experience',    label: 'La experiencia',              desc: 'Descripción del día especial',                emoji: '✨' },
  { id: 'map',           label: 'Mapa y ubicación',            desc: 'Mapa interactivo y cómo llegar',              emoji: '📍' },
  { id: 'testimonials',  label: 'Testimonios',                 desc: 'Opiniones de parejas anteriores',             emoji: '💬' },
  { id: 'collaborators', label: 'Colaboradores recomendados',  desc: 'Proveedores de confianza del venue',          emoji: '🤝' },
  { id: 'faq',           label: 'Preguntas frecuentes',        desc: 'FAQ personalizadas',                          emoji: '❓' },
  { id: 'chat',          label: 'Chat en vivo',                desc: 'Formulario de preguntas rápidas',             emoji: '💬' },
  { id: 'nextsteps',     label: 'Próximos pasos',              desc: 'Guía de pasos para confirmar la boda',        emoji: '👣' },
  { id: 'timeline',      label: 'Línea de tiempo',             desc: 'Hitos del día de la boda',                    emoji: '⏱️' },
  { id: 'availability',  label: 'Disponibilidad',              desc: 'Mensaje sobre fechas disponibles',            emoji: '📆' },
  { id: 'cta',           label: 'Botón de reserva',            desc: 'CTA para confirmar la fecha',                 required: true,  emoji: '🔒' },
  { id: 'contact',       label: 'Datos de contacto',           desc: 'Teléfono, email, dirección',                  required: true,  emoji: '📞' },
]

// Backward-compat alias used in the rest of the file
const PROPOSAL_SECTIONS_CFG = ALL_SECTIONS_CFG

const PROPOSAL_TYPES = [
  { value: 'standard', label: '💍 Boda estándar',  desc: 'Ceremonia civil o religiosa clásica' },
  { value: 'indian',   label: '🪔 Boda india',      desc: 'Eventos multiculturales y celebraciones hindúes' },
  { value: 'events',   label: '🎉 Eventos',          desc: 'Cumpleaños, corporativos, celebraciones' },
  { value: 'custom',   label: '✏️ Personalizado',    desc: 'Configuración completamente libre' },
]

const DEFAULT_MSG_TEMPLATES: Omit<MsgTemplate, 'id'>[] = [
  {
    name: 'Primer contacto',
    channel: 'whatsapp',
    category: 'contacto',
    body: `Hola {{nombre}} 👋\n\nMuchas gracias por vuestro interés en {{venue}}. Nos encantaría acompañaros en vuestro día especial.\n\nHe preparado una propuesta personalizada para vosotros:\n{{enlace_propuesta}}\n\n¿Cuándo podríais hacer una visita para conocer el espacio? \n\nUn abrazo,\nEl equipo de {{venue}}`,
  },
  {
    name: 'Seguimiento (1 semana)',
    channel: 'whatsapp',
    category: 'seguimiento',
    body: `Hola {{nombre}} 😊\n\nQuería ponerme en contacto para saber si habéis tenido la oportunidad de revisar la propuesta que os envié.\n\n¿Tenéis alguna duda o pregunta? Estoy a vuestra disposición.\n\n{{venue}}`,
  },
  {
    name: 'Confirmación de visita',
    channel: 'whatsapp',
    category: 'visita',
    body: `Hola {{nombre}} 🎉\n\nOs confirmamos vuestra visita a {{venue}}.\n\n¡Estamos deseando conoceros! Si necesitáis cualquier cosa antes, escribidnos.\n\nHasta pronto,\n{{venue}}`,
  },
  {
    name: 'Envío de propuesta',
    channel: 'email',
    category: 'propuesta',
    subject: 'Vuestra propuesta personalizada — {{venue}}',
    body: `Hola {{nombre}},\n\nHa sido un placer hablar con vosotros. Os adjuntamos vuestra propuesta personalizada para vuestro gran día en {{venue}}.\n\n🔗 Ver propuesta: {{enlace_propuesta}}\n\nEstamos a vuestra disposición para cualquier consulta.\n\nUn abrazo,\nEl equipo de {{venue}}`,
  },
  {
    name: 'Envío de dossier',
    channel: 'whatsapp',
    category: 'dossier',
    body: `Hola {{nombre}} 📎\n\nOs enviamos nuestro dossier con toda la información de {{venue}}:\n\n{{enlace_dossier}}\n\nAquí encontraréis todo sobre nuestros espacios, servicios y paquetes. ¡Cualquier pregunta, aquí estamos! 😊`,
  },
]

// ── Section presets ───────────────────────────────────────────────────────────
const SECTION_PRESETS: Array<{
  id: string
  name: string
  icon: string
  when: string
  sections: string[]
}> = [
  {
    id: 'impacto_directo',
    name: 'Impacto Directo',
    icon: '⚡',
    when: 'Venues premium. La pareja ya os conoce y necesita el empujón final.',
    sections: ['hero', 'packages', 'inclusions', 'extra_services', 'budget_simulator', 'cta', 'contact'],
  },
  {
    id: 'emocion_primero',
    name: 'Emoción Primero',
    icon: '✨',
    when: 'Venues con fuerte identidad visual (masías, jardines, espacios históricos).',
    sections: ['hero', 'gallery', 'experience', 'testimonials', 'inclusions', 'packages', 'cta', 'contact'],
  },
  {
    id: 'todo_claro',
    name: 'Todo Claro',
    icon: '📋',
    when: 'Parejas analíticas o venues con propuesta compleja (muchos extras, catering incluido).',
    sections: ['hero', 'experience', 'inclusions', 'extra_services', 'faq', 'packages', 'budget_simulator', 'cta', 'contact'],
  },
  {
    id: 'social_proof',
    name: 'Social Proof',
    icon: '💬',
    when: 'Venues con muchas bodas realizadas y buenas reseñas. Compiten con otros espacios similares.',
    sections: ['hero', 'testimonials', 'gallery', 'inclusions', 'packages', 'faq', 'cta', 'contact'],
  },
  {
    id: 'minimalista',
    name: 'Minimalista / Urgencia',
    icon: '🎯',
    when: 'Seguimiento post-visita o venues con fechas casi llenas. Máxima conversión en mínimas secciones.',
    sections: ['hero', 'inclusions', 'packages', 'availability', 'budget_simulator', 'cta', 'contact'],
  },
]

const DEFAULT_PROPOSAL_TPL: Omit<ProposalTemplate, 'id'> = {
  name: 'Plantilla estándar',
  type: 'standard',
  sections: PROPOSAL_SECTIONS_CFG.map(s => ({ id: s.id, enabled: true })),
  accent_color: '#C9A96E',
  header_text: 'Vuestra propuesta personalizada',
  cta_text: 'Reservar fecha',
  show_price: true,
  is_default: true,
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ComunicacionPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { isBlocked } = useRequireSubscription()
  const features = usePlanFeatures()

  const [activeTab, setActiveTab]         = useState<CommTab>('messages')
  const [msgTemplates, setMsgTemplates]   = useState<MsgTemplate[]>([])
  const [dossiers, setDossiers]           = useState<Dossier[]>([])
  const [leads, setLeads]                 = useState<Lead[]>([])
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    load()
  }, [user, authLoading])


  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    const supabase = createClient()
    const [msgRes, dosRes, leadsRes] = await Promise.all([
      supabase.from('message_templates').select('*').eq('user_id', user!.id).order('created_at'),
      supabase.from('dossiers').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('leads').select('id,name,email,phone,wedding_date,guests').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(100),
    ])
    setMsgTemplates(msgRes.data || [])
    setDossiers(dosRes.data || [])
    setLeads(leadsRes.data || [])
    setLoading(false)
  }

  const TABS: { key: CommTab; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: 'messages', label: 'Mensajes', icon: <MessageCircle size={15} />, desc: 'Plantillas de WhatsApp y email' },
    { key: 'dossier',  label: 'Dossier',  icon: <FileText size={15} />,      desc: 'PDF para enviar a parejas' },
  ]

  if (isBlocked) return null

  if (authLoading || loading) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar"><div className="topbar-title">Comunicación</div></div>
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <div style={{ color: 'var(--warm-gray)', fontSize: 13 }}>Cargando...</div>
        </div>
      </div>
    </div>
  )

  // Basic plan guard — full page locked
  if (!features.comunicacion) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cream)' }}>
      <Sidebar />
      <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 24px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32 }}>✉️</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--espresso)', fontFamily: 'Manrope, sans-serif', marginBottom: 10 }}>Comunicación — Plan Premium</div>
          <div style={{ fontSize: 14, color: 'var(--warm-gray)', lineHeight: 1.6, marginBottom: 24 }}>
            Crea plantillas de mensajes, diseña tu web de propuesta y genera dossiers personalizados para cada pareja.
          </div>
          <a href="/perfil" style={{ display: 'inline-block', padding: '10px 24px', background: 'var(--gold)', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
            Actualizar plan →
          </a>
        </div>
      </main>
    </div>
  )


  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Comunicación y plantillas</div>
        </div>
        <div className="page-content">

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--ivory)', marginBottom: 24 }}>
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === tab.key ? '2px solid var(--gold)' : '2px solid transparent',
                marginBottom: -2,
                color: activeTab === tab.key ? 'var(--espresso)' : 'var(--warm-gray)',
                transition: 'all 0.15s',
              }}>
                <span style={{ color: activeTab === tab.key ? 'var(--gold)' : 'var(--warm-gray)' }}>{tab.icon}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400 }}>{tab.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--stone)', display: activeTab === tab.key ? 'block' : 'none' }}>{tab.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {activeTab === 'messages' && (
            <MessagesTab
              templates={msgTemplates}
              leads={leads}
              userId={user!.id}
              onRefresh={() => load(true)}
            />
          )}
          {activeTab === 'dossier' && (
            <DossierTab
              dossiers={dossiers}
              leads={leads}
              userId={user!.id}
              onRefresh={() => load(true)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Messages Tab ──────────────────────────────────────────────────────────────

function MessagesTab({ templates, leads, userId, onRefresh }: {
  templates: MsgTemplate[]
  leads: Lead[]
  userId: string
  onRefresh: () => void
}) {
  const [selected,   setSelected]   = useState<MsgTemplate | null>(null)
  const [isNew,      setIsNew]      = useState(false)
  const [sendModal,  setSendModal]  = useState<MsgTemplate | null>(null)
  const [filterCh,   setFilterCh]   = useState<'all' | Channel>('all')
  const [saving,     setSaving]     = useState(false)
  const [copied,     setCopied]     = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const emptyForm: Omit<MsgTemplate, 'id'> = {
    name: '', category: 'contacto', channel: 'whatsapp', subject: '', body: ''
  }
  const [form, setForm] = useState(emptyForm)
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const openNew = () => {
    setForm(emptyForm); setSelected(null); setIsNew(true)
  }
  const openEdit = (t: MsgTemplate) => {
    setForm({ name: t.name, category: t.category, channel: t.channel, subject: t.subject || '', body: t.body })
    setSelected(t); setIsNew(false)
  }

  const handleSeed = async () => {
    const supabase = createClient()
    for (const t of DEFAULT_MSG_TEMPLATES) {
      await supabase.from('message_templates').insert({ ...t, user_id: userId })
    }
    onRefresh()
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.body.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = { ...form, subject: form.subject || null, user_id: userId }
    if (isNew) {
      await supabase.from('message_templates').insert(payload)
    } else if (selected) {
      await supabase.from('message_templates').update(payload).eq('id', selected.id)
    }
    setSaving(false); setIsNew(false); setSelected(null); onRefresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla?')) return
    const supabase = createClient()
    await supabase.from('message_templates').delete().eq('id', id)
    if (selected?.id === id) { setSelected(null); setIsNew(false) }
    onRefresh()
  }

  const insertVar = (v: string) => {
    const el = bodyRef.current
    if (!el) { setF('body', form.body + v); return }
    const start = el.selectionStart; const end = el.selectionEnd
    const next = form.body.slice(0, start) + v + form.body.slice(end)
    setF('body', next)
    setTimeout(() => { el.focus(); el.setSelectionRange(start + v.length, start + v.length) }, 0)
  }

  const visible = filterCh === 'all' ? templates : templates.filter(t => t.channel === filterCh || t.channel === 'both')

  const CH_CFG = {
    whatsapp: { label: 'WhatsApp', color: '#16a34a', bg: '#dcfce7', icon: <MessageCircle size={12} /> },
    email:    { label: 'Email',    color: '#2563eb', bg: '#dbeafe', icon: <Mail size={12} /> },
    both:     { label: 'Ambos',    color: '#7c3aed', bg: '#ede9fe', icon: <Sparkles size={12} /> },
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>

      {/* Left: template list */}
      <div className="card" style={{ position: 'sticky', top: 80 }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--ivory)', display: 'flex', gap: 6 }}>
          {(['all', 'whatsapp', 'email'] as const).map(ch => (
            <button key={ch} onClick={() => setFilterCh(ch)} style={{
              flex: 1, padding: '4px 0', fontSize: 11, borderRadius: 6, cursor: 'pointer', border: '1px solid',
              borderColor: filterCh === ch ? 'var(--gold)' : 'var(--ivory)',
              background: filterCh === ch ? 'var(--gold)' : 'transparent',
              color: filterCh === ch ? '#fff' : 'var(--warm-gray)',
            }}>
              {ch === 'all' ? 'Todos' : ch === 'whatsapp' ? 'WhatsApp' : 'Email'}
            </button>
          ))}
        </div>

        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {visible.length === 0 ? (
            <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12, color: 'var(--warm-gray)' }}>
              Sin plantillas
              {templates.length === 0 && (
                <button onClick={handleSeed} style={{ display: 'block', margin: '12px auto 0', fontSize: 11, color: 'var(--gold)', background: 'none', border: '1px dashed var(--gold)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>
                  <Sparkles size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  Cargar plantillas predefinidas
                </button>
              )}
            </div>
          ) : visible.map(t => {
            const ch = CH_CFG[t.channel]
            const isActive = selected?.id === t.id
            return (
              <div key={t.id} onClick={() => openEdit(t)} style={{
                padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--ivory)',
                background: isActive ? '#fef9ec' : '#fff',
                borderLeft: isActive ? '2px solid var(--gold)' : '2px solid transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{t.name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: ch.color, background: ch.bg, padding: '1px 6px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                    {ch.icon} {ch.label}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--warm-gray)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.body.slice(0, 60)}...
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--ivory)' }}>
          <button onClick={openNew} className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
            <Plus size={12} /> Nueva plantilla
          </button>
        </div>
      </div>

      {/* Right: editor */}
      {(isNew || selected) ? (
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, color: 'var(--espresso)' }}>
              {isNew ? 'Nueva plantilla' : 'Editar plantilla'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {selected && (
                <>
                  <button onClick={() => setSendModal(selected)} className="btn btn-ghost btn-sm">
                    <Send size={12} /> Enviar
                  </button>
                  <button onClick={() => handleDelete(selected.id)} style={{ fontSize: 12, color: '#dc2626', background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>
                    <Trash2 size={12} />
                  </button>
                </>
              )}
              <button onClick={() => { setSelected(null); setIsNew(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}>
                <X size={16} />
              </button>
            </div>
          </div>

          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nombre de la plantilla</label>
                <input className="form-input" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Ej: Primer contacto" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Categoría</label>
                <select className="form-input" value={form.category} onChange={e => setF('category', e.target.value)}>
                  {MSG_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Canal</label>
                <select className="form-input" value={form.channel} onChange={e => setF('channel', e.target.value)}>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="both">Ambos canales</option>
                </select>
              </div>
            </div>

            {(form.channel === 'email' || form.channel === 'both') && (
              <div className="form-group">
                <label className="form-label">Asunto del email</label>
                <input className="form-input" value={form.subject || ''} onChange={e => setF('subject', e.target.value)} placeholder="Ej: Vuestra propuesta personalizada — {{venue}}" />
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Mensaje</label>
                <span style={{ fontSize: 10, color: form.body.length > 900 ? '#dc2626' : 'var(--stone)' }}>{form.body.length} caracteres</span>
              </div>
              <textarea ref={bodyRef} className="form-textarea" style={{ minHeight: 180, fontFamily: 'monospace', fontSize: 12 }}
                value={form.body} onChange={e => setF('body', e.target.value)}
                placeholder="Escribe tu mensaje aquí. Usa las variables de abajo para personalizar." />
            </div>

            {/* Variable chips */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 6 }}>Click para insertar variable en el cursor:</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {MSG_VARS.map(v => (
                  <button key={v.key} type="button" onClick={() => insertVar(v.key)} style={{
                    fontSize: 11, padding: '3px 9px', borderRadius: 12, cursor: 'pointer',
                    border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)',
                    fontFamily: 'monospace',
                  }}>
                    {v.key}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--stone)', marginTop: 6 }}>
                {MSG_VARS.map(v => `${v.key} → ${v.sample}`).join('  ·  ')}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setSelected(null); setIsNew(false) }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim() || !form.body.trim()}>
                {saving ? 'Guardando...' : 'Guardar plantilla'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <MessageCircle size={36} style={{ color: 'var(--gold)', margin: '0 auto 16px', opacity: 0.6 }} />
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, marginBottom: 8, color: 'var(--espresso)' }}>Plantillas de mensajes</div>
          <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 24, maxWidth: 360, margin: '0 auto 24px', lineHeight: 1.7 }}>
            Crea plantillas con variables dinámicas para enviar por WhatsApp o email con un solo click.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={openNew} className="btn btn-primary"><Plus size={13} /> Nueva plantilla</button>
            {templates.length === 0 && (
              <button onClick={handleSeed} className="btn btn-ghost"><Sparkles size={13} /> Cargar predefinidas</button>
            )}
          </div>
        </div>
      )}

      {/* Send modal */}
      {sendModal && (
        <SendMsgModal
          template={sendModal}
          leads={leads}
          onClose={() => setSendModal(null)}
        />
      )}
    </div>
  )
}

// ── Send Message Modal ────────────────────────────────────────────────────────

function SendMsgModal({ template, leads, onClose }: {
  template: MsgTemplate
  leads: Lead[]
  onClose: () => void
}) {
  const [lead, setLead]       = useState<Lead | null>(null)
  const [search, setSearch]   = useState('')
  const [vars, setVars]       = useState<Record<string, string>>({})
  const [copied, setCopied]   = useState(false)

  const fillFromLead = (l: Lead) => {
    setLead(l)
    const dt = l.wedding_date ? new Date(l.wedding_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
    setVars({
      '{{nombre}}': l.name,
      '{{fecha}}': dt,
      '{{invitados}}': l.guests ? String(l.guests) : '',
    })
    setSearch('')
  }

  const interpolate = (text: string) => {
    let out = text
    MSG_VARS.forEach(v => { out = out.replaceAll(v.key, vars[v.key] || v.key) })
    return out
  }

  const preview = interpolate(template.body)
  const subjectPreview = template.subject ? interpolate(template.subject) : ''

  const waLink = `https://wa.me/${lead?.phone?.replace(/[^0-9]/g, '') || ''}?text=${encodeURIComponent(preview)}`
  const emailLink = `mailto:${lead?.email || ''}?subject=${encodeURIComponent(subjectPreview)}&body=${encodeURIComponent(preview)}`

  const filtered = leads.filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6)

  const copyText = () => {
    navigator.clipboard.writeText(preview)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 19, color: 'var(--espresso)' }}>Enviar: {template.name}</div>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>Selecciona un lead para personalizar el mensaje</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Lead selector */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>1. Seleccionar lead</div>
            {lead ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, marginBottom: 10 }}>
                <User size={14} style={{ color: '#16a34a' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>{lead.name}</div>
                  <div style={{ fontSize: 11, color: '#16a34a' }}>{lead.phone || lead.email || 'Sin contacto'}</div>
                </div>
                <button onClick={() => setLead(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a' }}><X size={12} /></button>
              </div>
            ) : (
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                <input className="form-input" style={{ paddingLeft: 30 }} value={search}
                  onChange={e => setSearch(e.target.value)} placeholder="Buscar lead..." />
              </div>
            )}
            {search && !lead && (
              <div style={{ border: '1px solid var(--ivory)', borderRadius: 8, overflow: 'hidden' }}>
                {filtered.map(l => (
                  <div key={l.id} onClick={() => fillFromLead(l)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--ivory)', background: '#fff' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                    <User size={13} style={{ color: 'var(--warm-gray)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{l.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{l.phone || l.email || '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Variable overrides */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>2. Personalizar variables</div>
              {MSG_VARS.filter(v => template.body.includes(v.key)).map(v => (
                <div key={v.key} className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label" style={{ fontSize: 10, fontFamily: 'monospace' }}>{v.key} — {v.label}</label>
                  <input className="form-input" style={{ fontSize: 12 }}
                    value={vars[v.key] || ''} onChange={e => setVars(prev => ({ ...prev, [v.key]: e.target.value }))}
                    placeholder={v.sample} />
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Vista previa</div>
            <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '14px', fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap', minHeight: 180, color: '#1a1a1a', border: '1px solid #bbf7d0', marginBottom: 12 }}>
              {preview}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(template.channel === 'whatsapp' || template.channel === 'both') && (
                <a href={waLink} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#16a34a', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
                  <MessageCircle size={15} />
                  Abrir en WhatsApp
                  {lead?.phone && <span style={{ fontSize: 11, opacity: 0.8, marginLeft: 4 }}>{lead.phone}</span>}
                </a>
              )}
              {(template.channel === 'email' || template.channel === 'both') && (
                <a href={emailLink} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#2563eb', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
                  <Mail size={15} />
                  Abrir en email
                  {lead?.email && <span style={{ fontSize: 11, opacity: 0.8, marginLeft: 4 }}>{lead.email}</span>}
                </a>
              )}
              <button onClick={copyText}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'var(--cream)', color: 'var(--charcoal)', border: '1px solid var(--ivory)', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
                {copied ? <><Check size={14} style={{ color: '#16a34a' }} /> ¡Copiado!</> : <><Copy size={14} /> Copiar texto</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
// ── Dossier Tab ───────────────────────────────────────────────────────────────

function DossierTab({ dossiers, leads, userId, onRefresh }: {
  dossiers: Dossier[]
  leads: Lead[]
  userId: string
  onRefresh: () => void
}) {
  const [sendModal, setSendModal]   = useState<Dossier | null>(null)
  const [newForm,   setNewForm]     = useState({ name: '', file_url: '', description: '' })
  const [showAdd,   setShowAdd]     = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [saving,    setSaving]      = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    setUploading(true)
    const supabase = createClient()
    const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { data, error } = await supabase.storage.from('dossiers').upload(path, file, { upsert: true })
    if (!error && data) {
      const { data: { publicUrl } } = supabase.storage.from('dossiers').getPublicUrl(data.path)
      setNewForm(f => ({ ...f, file_url: publicUrl, name: f.name || file.name.replace(/\.[^.]+$/, '') }))
    }
    setUploading(false)
  }

  const handleSave = async () => {
    if (!newForm.name.trim() || !newForm.file_url.trim()) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('dossiers').insert({
      user_id: userId,
      name: newForm.name.trim(),
      file_url: newForm.file_url.trim(),
      description: newForm.description.trim() || null,
      is_default: dossiers.length === 0,
    })
    setSaving(false); setShowAdd(false); setNewForm({ name: '', file_url: '', description: '' }); onRefresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este dossier?')) return
    const supabase = createClient()
    await supabase.from('dossiers').delete().eq('id', id)
    onRefresh()
  }

  const setDefault = async (id: string) => {
    const supabase = createClient()
    await supabase.from('dossiers').update({ is_default: false }).eq('user_id', userId)
    await supabase.from('dossiers').update({ is_default: true }).eq('id', id)
    onRefresh()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)', marginBottom: 2 }}>Dossier del venue</div>
          <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Sube tu dossier en PDF y envíalo directamente por WhatsApp o email</div>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary btn-sm"><Plus size={12} /> Añadir dossier</button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card" style={{ padding: '20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>Nuevo dossier</div>
            <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}><X size={16} /></button>
          </div>

          {/* Upload zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type === 'application/pdf') handleUpload(f) }}
            style={{
              border: '2px dashed var(--gold)', borderRadius: 10, padding: '28px', textAlign: 'center',
              cursor: 'pointer', background: '#fef9ec', marginBottom: 16,
            }}>
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
            {uploading ? (
              <div style={{ color: 'var(--warm-gray)', fontSize: 13 }}>Subiendo...</div>
            ) : newForm.file_url ? (
              <div>
                <Check size={24} style={{ color: '#16a34a', margin: '0 auto 8px' }} />
                <div style={{ fontSize: 13, color: '#15803d', fontWeight: 500 }}>PDF subido correctamente</div>
                <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>Click para cambiar archivo</div>
              </div>
            ) : (
              <div>
                <Upload size={28} style={{ color: 'var(--gold)', margin: '0 auto 10px' }} />
                <div style={{ fontSize: 13, color: 'var(--charcoal)', fontWeight: 500 }}>Arrastra tu PDF aquí o haz click</div>
                <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>Solo archivos PDF · Máx. 20MB</div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 8 }}>O pega la URL directa de tu dossier:</div>
            <input className="form-input" style={{ fontSize: 12 }} value={newForm.file_url}
              onChange={e => setNewForm(f => ({ ...f, file_url: e.target.value }))}
              placeholder="https://drive.google.com/... o URL pública del PDF" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nombre del dossier</label>
              <input className="form-input" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Dossier Villa Rosa 2026" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Descripción (opcional)</label>
              <input className="form-input" value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} placeholder="Ej: Dossier general bodas" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !newForm.name.trim() || !newForm.file_url.trim()}>
              {saving ? 'Guardando...' : 'Guardar dossier'}
            </button>
          </div>
        </div>
      )}

      {/* Dossier list */}
      {dossiers.length === 0 && !showAdd ? (
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <FileText size={36} style={{ color: 'var(--gold)', margin: '0 auto 16px', opacity: 0.6 }} />
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, marginBottom: 8 }}>Sin dossiers</div>
          <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 20 }}>Sube tu dossier en PDF para enviarlo rápidamente a las parejas interesadas.</div>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary"><Plus size={13} /> Añadir dossier</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dossiers.map(d => (
            <div key={d.id} className="card">
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Icon */}
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={20} style={{ color: '#92400e' }} />
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>{d.name}</div>
                    {d.is_default && <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 8px', borderRadius: 10, fontWeight: 600 }}>Predeterminado</span>}
                  </div>
                  {d.description && <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 4 }}>{d.description}</div>}
                  <div style={{ fontSize: 11, color: 'var(--stone)' }}>
                    Añadido el {new Date(d.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                  <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '7px 12px', borderRadius: 7, border: '1px solid var(--ivory)', color: 'var(--charcoal)', textDecoration: 'none', background: '#fff' }}>
                    <Eye size={13} /> Ver
                  </a>
                  <button onClick={() => setSendModal(d)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '7px 12px', borderRadius: 7, border: '1px solid var(--gold)', color: 'var(--gold)', background: '#fff', cursor: 'pointer' }}>
                    <Send size={13} /> Enviar
                  </button>
                  {!d.is_default && (
                    <button onClick={() => setDefault(d.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '7px 12px', borderRadius: 7, border: '1px solid var(--ivory)', color: 'var(--warm-gray)', background: '#fff', cursor: 'pointer' }}>
                      <Star size={13} />
                    </button>
                  )}
                  <button onClick={() => handleDelete(d.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '7px 12px', borderRadius: 7, border: '1px solid #fca5a5', color: '#dc2626', background: '#fff', cursor: 'pointer' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {sendModal && (
        <SendDossierModal
          dossier={sendModal}
          leads={leads}
          onClose={() => setSendModal(null)}
        />
      )}
    </div>
  )
}

// ── Send Dossier Modal ────────────────────────────────────────────────────────

function SendDossierModal({ dossier, leads, onClose }: {
  dossier: Dossier
  leads: Lead[]
  onClose: () => void
}) {
  const [lead,   setLead]   = useState<Lead | null>(null)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(false)

  const filtered = leads.filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6)

  const waText = `Hola${lead ? ` ${lead.name.split(' ')[0]}` : ''} 📎\n\nOs enviamos nuestro dossier con toda la información del venue:\n\n${dossier.file_url}\n\n¡Cualquier pregunta, aquí estamos! 😊`
  const waLink = `https://wa.me/${lead?.phone?.replace(/[^0-9]/g, '') || ''}?text=${encodeURIComponent(waText)}`
  const emailLink = `mailto:${lead?.email || ''}?subject=${encodeURIComponent(`Dossier — ${dossier.name}`)}&body=${encodeURIComponent(waText)}`

  const copyLink = () => {
    navigator.clipboard.writeText(dossier.file_url)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 19, color: 'var(--espresso)' }}>Enviar dossier</div>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{dossier.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Lead selector */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Seleccionar lead (opcional)</div>
            {lead ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8 }}>
                <User size={14} style={{ color: '#16a34a' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>{lead.name}</div>
                  <div style={{ fontSize: 11, color: '#16a34a' }}>{lead.phone || lead.email || 'Sin contacto'}</div>
                </div>
                <button onClick={() => setLead(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a' }}><X size={12} /></button>
              </div>
            ) : (
              <div>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                  <input className="form-input" style={{ paddingLeft: 30 }} value={search}
                    onChange={e => setSearch(e.target.value)} placeholder="Buscar lead por nombre..." />
                </div>
                {search && (
                  <div style={{ border: '1px solid var(--ivory)', borderRadius: 8, overflow: 'hidden' }}>
                    {filtered.map(l => (
                      <div key={l.id} onClick={() => { setLead(l); setSearch('') }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--ivory)', background: '#fff' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                        <User size={13} style={{ color: 'var(--warm-gray)' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{l.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{l.phone || l.email || '—'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Send buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#16a34a', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
              <MessageCircle size={16} />
              <div>
                <div>Enviar por WhatsApp</div>
                {lead?.phone && <div style={{ fontSize: 11, opacity: 0.85 }}>{lead.phone}</div>}
              </div>
            </a>
            <a href={emailLink} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#2563eb', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
              <Mail size={16} />
              <div>
                <div>Enviar por email</div>
                {lead?.email && <div style={{ fontSize: 11, opacity: 0.85 }}>{lead.email}</div>}
              </div>
            </a>
            <button onClick={copyLink}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--cream)', color: 'var(--charcoal)', border: '1px solid var(--ivory)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
              {copied ? <><Check size={16} style={{ color: '#16a34a' }} /> ¡Enlace copiado!</> : <><Link2 size={16} /> Copiar enlace del PDF</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
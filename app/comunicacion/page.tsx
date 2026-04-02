'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import {
  MessageCircle, Mail, FileText, Plus, Trash2, Send, X,
  Copy, Check, Upload, Eye, Sparkles, ChevronDown, ChevronUp,
  AlertCircle, User, Search, Palette, Link2, ToggleLeft, ToggleRight,
  Pencil, Download, Star, Package, HelpCircle, Quote, List,
  GripVertical, ChevronsUpDown, Image as ImageIcon, Layers,
  MapPin, Calendar, XCircle, Images, Users, Timer, UtensilsCrossed,
  Calculator, ScrollText, Ban, Lock
} from 'lucide-react'
import { GOOGLE_FONTS, FONT_CATEGORIES, ALL_FONTS_URL, getFontByValue } from '@/lib/fonts'
import { usePlanFeatures } from '@/lib/use-plan-features'

// ── Types ────────────────────────────────────────────────────────────────────

type CommTab = 'messages' | 'proposal' | 'dossier'

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

type VenuePackage = {
  id: string
  name: string
  subtitle?: string
  price?: string
  min_guests?: number
  max_guests?: number
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
}

type VenueSeasonPrice = {
  id: string
  season: string
  label: string
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
  const features = usePlanFeatures()

  const [activeTab, setActiveTab]         = useState<CommTab>('messages')
  const [msgTemplates, setMsgTemplates]   = useState<MsgTemplate[]>([])
  const [proposalTpls, setProposalTpls]   = useState<ProposalTemplate[]>([])
  const [dossiers, setDossiers]           = useState<Dossier[]>([])
  const [leads, setLeads]                 = useState<Lead[]>([])
  const [venueContent, setVenueContent]   = useState<{
    packages: VenuePackage[]
    zones: VenueZone[]
    season_prices: VenueSeasonPrice[]
    inclusions: VenueInclusion[]
    exclusions: VenueExclusion[]
    faq: VenueFaq[]
    testimonials: VenueTestimonial[]
    collaborators: VenueCollaborator[]
    extra_services: VenueExtraService[]
    countdown: VenueCountdown | null
    menu_prices: VenueMenuPrice[]
    budget_simulator: VenueBudgetSimulator | null
    conditions: VenueConditions | null
    experience: VenueExperience | null
    video_default: VenueVideoSection | null
    techspecs: VenueTechspecs | null
    accommodation_info: VenueAccommodationInfo | null
    map_info: VenueMapInfo | null
    chat_settings: VenueChatSettings | null
  }>({
    packages: [], zones: [], season_prices: [], inclusions: [], exclusions: [],
    faq: [], testimonials: [], collaborators: [], extra_services: [],
    countdown: null, menu_prices: [], budget_simulator: null, conditions: null, experience: null,
    video_default: null, techspecs: null, accommodation_info: null, map_info: null, chat_settings: null,
  })
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    load()
  }, [user, authLoading])

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    const supabase = createClient()
    const [msgRes, propRes, dosRes, leadsRes, contentRes] = await Promise.all([
      supabase.from('message_templates').select('*').eq('user_id', user!.id).order('created_at'),
      supabase.from('proposal_web_templates').select('*').eq('user_id', user!.id).order('created_at'),
      supabase.from('dossiers').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('leads').select('id,name,email,phone,wedding_date,guests').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('venue_content').select('*').eq('user_id', user!.id).order('sort_order'),
    ])
    setMsgTemplates(msgRes.data || [])
    setProposalTpls(propRes.data || [])
    setDossiers(dosRes.data || [])
    setLeads(leadsRes.data || [])
    const rows: any[] = contentRes.data || []
    setVenueContent({
      packages:          rows.filter(r => r.section === 'package').map(r => ({ id: r.id, sort_order: r.sort_order, is_active: r.is_active, ...r.data })),
      zones:             rows.filter(r => r.section === 'zone').map(r => ({ id: r.id, sort_order: r.sort_order, ...r.data })),
      season_prices:     rows.filter(r => r.section === 'season_price').map(r => ({ id: r.id, sort_order: r.sort_order, ...r.data })),
      inclusions:        rows.filter(r => r.section === 'inclusion').map(r => ({ id: r.id, sort_order: r.sort_order, ...r.data })),
      exclusions:        rows.filter(r => r.section === 'exclusion').map(r => ({ id: r.id, sort_order: r.sort_order, ...r.data })),
      faq:               rows.filter(r => r.section === 'faq').map(r => ({ id: r.id, sort_order: r.sort_order, ...r.data })),
      testimonials:      rows.filter(r => r.section === 'testimonial').map(r => ({ id: r.id, ...r.data })),
      collaborators:     rows.filter(r => r.section === 'collaborator').map(r => ({ id: r.id, sort_order: r.sort_order, ...r.data })),
      extra_services:    rows.filter(r => r.section === 'extra_service').map(r => ({ id: r.id, sort_order: r.sort_order, ...r.data })),
      countdown:         rows.find(r => r.section === 'countdown') ? { id: rows.find(r => r.section === 'countdown').id, ...rows.find(r => r.section === 'countdown').data } : null,
      menu_prices:       rows.filter(r => r.section === 'menu_price').map(r => ({ id: r.id, sort_order: r.sort_order, ...r.data })),
      budget_simulator:  rows.find(r => r.section === 'budget_simulator') ? { id: rows.find(r => r.section === 'budget_simulator').id, ...rows.find(r => r.section === 'budget_simulator').data } : null,
      conditions:        rows.find(r => r.section === 'conditions') ? { id: rows.find(r => r.section === 'conditions').id, ...rows.find(r => r.section === 'conditions').data } : null,
      experience:        rows.find(r => r.section === 'experience') ? { id: rows.find(r => r.section === 'experience').id, ...rows.find(r => r.section === 'experience').data } : null,
      video_default:     rows.find(r => r.section === 'video_default') ? { id: rows.find(r => r.section === 'video_default').id, ...rows.find(r => r.section === 'video_default').data } : null,
      techspecs:         rows.find(r => r.section === 'techspecs') ? { id: rows.find(r => r.section === 'techspecs').id, ...rows.find(r => r.section === 'techspecs').data } : null,
      accommodation_info: rows.find(r => r.section === 'accommodation_info') ? { id: rows.find(r => r.section === 'accommodation_info').id, ...rows.find(r => r.section === 'accommodation_info').data } : null,
      map_info:          rows.find(r => r.section === 'map_info') ? { id: rows.find(r => r.section === 'map_info').id, ...rows.find(r => r.section === 'map_info').data } : null,
      chat_settings:     rows.find(r => r.section === 'chat_settings') ? { id: rows.find(r => r.section === 'chat_settings').id, ...rows.find(r => r.section === 'chat_settings').data } : null,
    })
    setLoading(false)
  }

  const TABS: { key: CommTab; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: 'messages', label: 'Mensajes',         icon: <MessageCircle size={15} />, desc: 'Plantillas de WhatsApp y email' },
    { key: 'proposal', label: 'Web de propuesta', icon: <Eye size={15} />,           desc: 'Plantilla, secciones y contenido de la propuesta' },
    { key: 'dossier',  label: 'Dossier',          icon: <FileText size={15} />,      desc: 'PDF para enviar a parejas' },
  ]

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
            {TABS.map(tab => {
              const isProposalLocked = tab.key === 'proposal' && !features.propuestas_web
              return (
                <button key={tab.key} onClick={() => { if (!isProposalLocked) setActiveTab(tab.key) }} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px',
                  background: 'none', border: 'none', cursor: isProposalLocked ? 'not-allowed' : 'pointer',
                  borderBottom: activeTab === tab.key ? '2px solid var(--gold)' : '2px solid transparent',
                  marginBottom: -2,
                  color: isProposalLocked ? 'var(--stone)' : activeTab === tab.key ? 'var(--espresso)' : 'var(--warm-gray)',
                  opacity: isProposalLocked ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}>
                  <span style={{ color: isProposalLocked ? 'var(--stone)' : activeTab === tab.key ? 'var(--gold)' : 'var(--warm-gray)' }}>{tab.icon}</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {tab.label}
                      {isProposalLocked && <Lock size={10} />}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--stone)', display: activeTab === tab.key ? 'block' : 'none' }}>{tab.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>

          {activeTab === 'messages' && (
            <MessagesTab
              templates={msgTemplates}
              leads={leads}
              userId={user!.id}
              onRefresh={() => load(true)}
            />
          )}
          {activeTab === 'proposal' && !features.propuestas_web && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
              <div style={{ textAlign: 'center', maxWidth: 440 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <Lock size={28} style={{ color: 'var(--gold)', opacity: 0.7 }} />
                </div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: 'var(--espresso)', marginBottom: 10 }}>Web de propuesta</div>
                <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.7, marginBottom: 20 }}>
                  Crea plantillas de propuesta personalizadas con tu branding, secciones y contenido.<br />
                  Disponible en el plan <strong>Premium</strong>.
                </div>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Contacta con tu gestor de cuenta para actualizar tu plan</div>
              </div>
            </div>
          )}
          {activeTab === 'proposal' && features.propuestas_web && (
            <ProposalTab
              templates={proposalTpls}
              userId={user!.id}
              content={venueContent}
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
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, color: 'var(--espresso)' }}>
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
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, marginBottom: 8, color: 'var(--espresso)' }}>Plantillas de mensajes</div>
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
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 19, color: 'var(--espresso)' }}>Enviar: {template.name}</div>
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

// ── Proposal Tab ──────────────────────────────────────────────────────────────

function ProposalTab({ templates, userId, content, onRefresh }: {
  templates: ProposalTemplate[]
  userId: string
  content: Parameters<typeof ContentTab>[0]['content']
  onRefresh: () => void
}) {
  const [subTab,    setSubTab]    = useState<'design' | 'content'>('design')
  const [selected,  setSelected]  = useState<ProposalTemplate | null>(null)
  const [isNew,     setIsNew]     = useState(false)
  const [saving,    setSaving]    = useState(false)

  // Load all Google Fonts once for editor previews
  useEffect(() => {
    if (document.querySelector('link[data-gf-editor]')) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = ALL_FONTS_URL
    link.setAttribute('data-gf-editor', '1')
    document.head.appendChild(link)
  }, [])

  const emptyForm = (): Omit<ProposalTemplate, 'id'> => ({
    name: 'Nueva plantilla',
    type: 'standard',
    // Start with required sections + common defaults
    sections: ALL_SECTIONS_CFG
      .filter(s => s.required || ['welcome', 'gallery', 'packages', 'inclusions', 'experience', 'testimonials', 'faq'].includes(s.id))
      .map(s => ({ id: s.id, enabled: true })),
    accent_color: '#C9A96E',
    header_text: 'Vuestra propuesta personalizada',
    cta_text: 'Reservar fecha',
    show_price: true,
    is_default: false,
    font_family: 'Georgia, serif',
  })

  const [form, setForm] = useState(emptyForm())
  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // ── Drag & Drop state ─────────────────────────────────────────────────────
  const [dragId,   setDragId]   = useState<string | null>(null)
  const [dragFrom, setDragFrom] = useState<'available' | 'selected' | null>(null)
  const [dropOver, setDropOver] = useState<{ panel: 'available' | 'selected'; idx: number } | null>(null)

  // ── Font picker state ──────────────────────────────────────────────────────
  const [fontOpen,   setFontOpen]   = useState(false)
  const [fontSearch, setFontSearch] = useState('')

  // ── Section item picker (which items are shown per section) ───────────────
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null)

  // Map section id → available items from content library
  const sectionItems: Record<string, Array<{ id: string; label: string }>> = {
    packages:      content.packages.map(p => ({ id: p.id, label: p.name })),
    zones:         content.zones.map(z => ({ id: z.id, label: z.name })),
    season_prices: content.season_prices.map(s => ({ id: s.id, label: s.label })),
    inclusions:    content.inclusions.map(i => ({ id: i.id, label: i.title })),
    exclusions:    content.exclusions.map(e => ({ id: e.id, label: e.title })),
    faq:           content.faq.map(f => ({ id: f.id, label: f.question })),
    testimonials:  content.testimonials.map(t => ({ id: t.id, label: t.couple_name })),
    collaborators: content.collaborators.map(c => ({ id: c.id, label: c.name })),
    extra_services:content.extra_services.map(s => ({ id: s.id, label: s.name })),
    menu_prices:   content.menu_prices.map(m => ({ id: m.id, label: m.name })),
  }

  const toggleSectionItem = (sectionId: string, itemId: string) => {
    setForm(f => {
      const secs = f.sections.map(s => {
        if (s.id !== sectionId) return s
        const ids = s.selected_ids ?? []
        const next = ids.includes(itemId) ? ids.filter(x => x !== itemId) : [...ids, itemId]
        return { ...s, selected_ids: next }
      })
      return { ...f, sections: secs }
    })
  }

  // Available = all sections NOT currently in form.sections
  const availableSections = ALL_SECTIONS_CFG.filter(s => !form.sections.some(x => x.id === s.id))

  const onDragStart = (id: string, from: 'available' | 'selected') => {
    setDragId(id); setDragFrom(from)
  }
  const onDragEnd = () => { setDragId(null); setDragFrom(null); setDropOver(null) }

  const onDrop = (toPanel: 'available' | 'selected', toIdx: number) => {
    if (!dragId || !dragFrom) return
    setForm(f => {
      const secs = [...f.sections]
      if (dragFrom === 'available' && toPanel === 'selected') {
        // Add to selected at position
        secs.splice(toIdx, 0, { id: dragId, enabled: true })
      } else if (dragFrom === 'selected' && toPanel === 'selected') {
        // Reorder within selected
        const fromIdx = secs.findIndex(s => s.id === dragId)
        if (fromIdx === -1) return f
        const [moved] = secs.splice(fromIdx, 1)
        secs.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, moved)
      } else if (dragFrom === 'selected' && toPanel === 'available') {
        // Remove from selected (skip required)
        const cfg = ALL_SECTIONS_CFG.find(s => s.id === dragId)
        if (cfg && 'required' in cfg && cfg.required) return f
        return { ...f, sections: secs.filter(s => s.id !== dragId) }
      }
      return { ...f, sections: secs }
    })
    onDragEnd()
  }

  const removeSection = (id: string) => {
    const cfg = ALL_SECTIONS_CFG.find(s => s.id === id)
    if (cfg && 'required' in cfg && cfg.required) return
    setForm(f => ({ ...f, sections: f.sections.filter(s => s.id !== id) }))
  }

  const addSection = (id: string) => {
    if (form.sections.find(s => s.id === id)) return
    // Add before required sections at the end
    const reqIds = ALL_SECTIONS_CFG.filter(s => 'required' in s && s.required).map(s => s.id)
    setForm(f => {
      const secs = [...f.sections]
      const firstReqIdx = secs.findIndex(s => reqIds.includes(s.id))
      if (firstReqIdx === -1) secs.push({ id, enabled: true })
      else secs.splice(firstReqIdx, 0, { id, enabled: true })
      return { ...f, sections: secs }
    })
  }

  const openNew = () => { setForm(emptyForm()); setSelected(null); setIsNew(true) }
  const openEdit = (t: ProposalTemplate) => {
    // Load existing selected sections (handle both old format with enabled flag and new format)
    const existing = (t.sections || []) as Array<{ id: string; enabled?: boolean }>
    let sections: Array<{ id: string; enabled: true }> = existing
      .filter(x => x.enabled !== false)
      .map(x => ({ id: x.id, enabled: true as const }))
    // Ensure required sections are always present
    ALL_SECTIONS_CFG.filter(s => s.required).forEach(req => {
      if (!sections.find(x => x.id === req.id)) sections = [{ id: req.id, enabled: true }, ...sections]
    })
    setForm({ name: t.name, type: t.type, sections, accent_color: t.accent_color, header_text: t.header_text, cta_text: t.cta_text, show_price: t.show_price, is_default: t.is_default, font_family: t.font_family || 'Georgia, serif' })
    setSelected(t); setIsNew(false)
  }

  const handleSeed = async () => {
    const supabase = createClient()
    await supabase.from('proposal_web_templates').insert({ ...DEFAULT_PROPOSAL_TPL, user_id: userId })
    onRefresh()
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const payload = { ...form, user_id: userId }
    if (form.is_default) {
      await supabase.from('proposal_web_templates').update({ is_default: false }).eq('user_id', userId)
    }
    if (isNew) {
      await supabase.from('proposal_web_templates').insert(payload)
    } else if (selected) {
      await supabase.from('proposal_web_templates').update(payload).eq('id', selected.id)
    }
    setSaving(false); setIsNew(false); setSelected(null); onRefresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla de propuesta?')) return
    const supabase = createClient()
    await supabase.from('proposal_web_templates').delete().eq('id', id)
    if (selected?.id === id) { setSelected(null); setIsNew(false) }
    onRefresh()
  }

  const setDefault = async (id: string) => {
    const supabase = createClient()
    await supabase.from('proposal_web_templates').update({ is_default: false }).eq('user_id', userId)
    await supabase.from('proposal_web_templates').update({ is_default: true }).eq('id', id)
    onRefresh()
  }

  const enabledCount = form.sections.length

  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--cream)', borderRadius: 8, padding: 4, width: 'fit-content' }}>
        {([
          { key: 'design',  label: '🎨 Plantilla y diseño',      desc: 'Estructura, secciones y CTA de la propuesta web' },
          { key: 'content', label: '📦 Contenido de la propuesta', desc: 'Paquetes, FAQ, testimonios y más' },
        ] as const).map(st => (
          <button key={st.key} onClick={() => setSubTab(st.key)} style={{
            padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
            background: subTab === st.key ? '#fff' : 'transparent',
            color: subTab === st.key ? 'var(--espresso)' : 'var(--warm-gray)',
            boxShadow: subTab === st.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s',
          }}>
            {st.label}
          </button>
        ))}
      </div>

      {/* Sub-tab: Contenido */}
      {subTab === 'content' && (
        <ContentTab content={content} userId={userId} onRefresh={onRefresh} />
      )}

      {/* Sub-tab: Diseño — Template cards */}
      {subTab === 'design' && !isNew && !selected && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)', marginBottom: 2 }}>Plantillas de propuesta web</div>
              <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Define el diseño y contenido de las páginas de propuesta que verán las parejas</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={openNew} className="btn btn-primary btn-sm"><Plus size={12} /> Nueva plantilla</button>
              {templates.length === 0 && <button onClick={handleSeed} className="btn btn-ghost btn-sm"><Sparkles size={12} /> Cargar estándar</button>}
            </div>
          </div>

          {templates.length === 0 ? (
            <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
              <Eye size={36} style={{ color: 'var(--gold)', margin: '0 auto 16px', opacity: 0.6 }} />
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, marginBottom: 8 }}>Sin plantillas de propuesta</div>
              <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 20 }}>Crea una plantilla para personalizar qué verán las parejas cuando abran su propuesta.</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button onClick={openNew} className="btn btn-primary"><Plus size={13} /> Crear plantilla</button>
                <button onClick={handleSeed} className="btn btn-ghost"><Sparkles size={13} /> Cargar estándar</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {templates.map(t => {
                const typeInfo = PROPOSAL_TYPES.find(p => p.value === t.type)
                const enabledSecs = (t.sections || []).filter((s: any) => s.enabled !== false).length
                return (
                  <div key={t.id} className="card" style={{ cursor: 'pointer', border: t.is_default ? '2px solid var(--gold)' : '1px solid var(--ivory)' }} onClick={() => openEdit(t)}>
                    {/* Color swatch header */}
                    <div style={{ height: 6, background: t.accent_color || 'var(--gold)', borderRadius: '8px 8px 0 0' }} />
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)', marginBottom: 3 }}>{t.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>{typeInfo?.label || t.type}</div>
                        </div>
                        {t.is_default && <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>Predeterminada</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                        <span style={{ fontSize: 11, color: 'var(--warm-gray)', background: 'var(--cream)', padding: '2px 8px', borderRadius: 8 }}>
                          {enabledSecs} secciones
                        </span>
                        <span style={{ fontSize: 11, color: t.show_price ? '#16a34a' : 'var(--warm-gray)', background: t.show_price ? '#dcfce7' : 'var(--cream)', padding: '2px 8px', borderRadius: 8 }}>
                          {t.show_price ? '💰 Con precios' : 'Sin precios'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={e => { e.stopPropagation(); openEdit(t) }} style={{ flex: 1, fontSize: 11, padding: '5px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--charcoal)' }}>
                          <Pencil size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Editar
                        </button>
                        {!t.is_default && (
                          <button onClick={e => { e.stopPropagation(); setDefault(t.id) }} style={{ flex: 1, fontSize: 11, padding: '5px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)' }}>
                            <Star size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Predeterminar
                          </button>
                        )}
                        <button onClick={e => { e.stopPropagation(); handleDelete(t.id) }} style={{ padding: '5px 8px', borderRadius: 6, cursor: 'pointer', border: '1px solid #fca5a5', background: 'transparent', color: '#dc2626' }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      {subTab === 'design' && (isNew || selected) && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <button onClick={() => { setSelected(null); setIsNew(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', fontSize: 12 }}>← Volver</button>
            <span style={{ color: 'var(--stone)' }}>·</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>{isNew ? 'Nueva plantilla' : `Editando: ${selected?.name}`}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>

            {/* Left: sections + type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Presets — only when creating a new template */}
              {isNew && (
                <div className="card" style={{ padding: '18px 20px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>Empezar desde una plantilla predefinida</div>
                  <div style={{ fontSize: 11, color: 'var(--stone)', marginBottom: 14 }}>Elige una estructura optimizada para conversión y personalízala después.</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                    {SECTION_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          const sectionList = preset.sections
                            .map(id => ALL_SECTIONS_CFG.find(s => s.id === id))
                            .filter(Boolean) as typeof ALL_SECTIONS_CFG
                          // Ensure required sections are always included
                          const requiredNotIn = ALL_SECTIONS_CFG.filter(s => s.required && !preset.sections.includes(s.id))
                          const merged = [...sectionList, ...requiredNotIn]
                          setForm(f => ({
                            ...f,
                            name: preset.name,
                            sections: merged.map(s => ({ id: s.id, enabled: true as const })),
                          }))
                        }}
                        style={{
                          padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                          border: '1.5px solid var(--ivory)', background: '#fff',
                          textAlign: 'left', transition: 'border-color 0.15s, box-shadow 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(201,169,110,0.15)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ivory)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none' }}
                      >
                        <div style={{ fontSize: 20, marginBottom: 6 }}>{preset.icon}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--espresso)', marginBottom: 4 }}>{preset.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--stone)', lineHeight: 1.4, marginBottom: 8 }}>{preset.when}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {preset.sections.slice(0, 5).map(id => {
                            const cfg = ALL_SECTIONS_CFG.find(s => s.id === id)
                            return cfg ? (
                              <span key={id} style={{ fontSize: 9, background: 'var(--cream)', color: 'var(--warm-gray)', padding: '1px 6px', borderRadius: 6 }}>
                                {cfg.label}
                              </span>
                            ) : null
                          })}
                          {preset.sections.length > 5 && (
                            <span style={{ fontSize: 9, color: 'var(--stone)', padding: '1px 4px' }}>+{preset.sections.length - 5}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Type + name */}
              <div className="card" style={{ padding: '18px 20px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 14 }}>Información básica</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Nombre de la plantilla</label>
                    <input className="form-input" value={form.name} onChange={e => setF('name', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Predeterminada</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <button type="button" onClick={() => setF('is_default', !form.is_default)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: form.is_default ? 'var(--gold)' : 'var(--stone)' }}>
                        {form.is_default ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                      </button>
                      <span style={{ fontSize: 12, color: form.is_default ? 'var(--gold)' : 'var(--warm-gray)' }}>
                        {form.is_default ? 'Sí (se usa por defecto)' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="form-label">Tipo de evento</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {PROPOSAL_TYPES.map(pt => (
                      <button key={pt.value} type="button" onClick={() => setF('type', pt.value)} style={{
                        padding: '10px 6px', borderRadius: 8, cursor: 'pointer', border: '2px solid',
                        borderColor: form.type === pt.value ? 'var(--gold)' : 'var(--ivory)',
                        background: form.type === pt.value ? '#fef9ec' : '#fff',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 16, marginBottom: 4 }}>{pt.label.split(' ')[0]}</div>
                        <div style={{ fontSize: 11, fontWeight: form.type === pt.value ? 600 : 400, color: form.type === pt.value ? 'var(--espresso)' : 'var(--warm-gray)' }}>
                          {pt.label.split(' ').slice(1).join(' ')}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sections — Two-panel drag & drop */}
              <div className="card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>Secciones de la propuesta</div>
                  <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{form.sections.length} secciones activas</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--stone)', marginBottom: 16 }}>Arrastra para reordenar. Las 🔒 son obligatorias.</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16 }}>

                  {/* Left: Selected (large cards, reorderable) */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      En la plantilla — orden de aparición
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {form.sections.map((secForm, idx) => {
                        const sec = ALL_SECTIONS_CFG.find(s => s.id === secForm.id)
                        if (!sec) return null
                        const isRequired = 'required' in sec && sec.required
                        const isDragging = dragId === sec.id
                        const isDropBefore = dropOver?.panel === 'selected' && dropOver.idx === idx
                        return (
                          <div key={sec.id}>
                            {/* Drop indicator line */}
                            <div style={{
                              height: isDropBefore ? 3 : 0,
                              background: 'var(--gold)',
                              borderRadius: 2,
                              marginBottom: isDropBefore ? 6 : 0,
                              transition: 'height 0.1s, margin 0.1s',
                            }} />
                            <div
                              draggable={!isRequired}
                              onDragStart={() => !isRequired && onDragStart(sec.id, 'selected')}
                              onDragEnd={onDragEnd}
                              onDragOver={e => { e.preventDefault(); setDropOver({ panel: 'selected', idx }) }}
                              onDrop={() => onDrop('selected', idx)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '10px 12px',
                                borderRadius: expandedSectionId === sec.id ? '8px 8px 0 0' : 8,
                                cursor: isRequired ? 'default' : 'grab',
                                userSelect: 'none',
                                background: isRequired ? '#f0fdf4' : isDragging ? '#fef9ec' : '#fff',
                                border: `1.5px solid ${isDragging ? 'var(--gold)' : isRequired ? '#86efac' : 'var(--ivory)'}`,
                                borderBottom: expandedSectionId === sec.id ? '1px solid var(--ivory)' : undefined,
                                opacity: isDragging ? 0.5 : 1,
                                transform: isDragging ? 'scale(0.98)' : 'scale(1)',
                                transition: 'opacity 0.15s, transform 0.1s, border-color 0.15s, background 0.15s',
                                boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                              }}>
                              <div style={{ flexShrink: 0, color: isRequired ? '#16a34a' : 'var(--stone)' }}>
                                {isRequired ? <Lock size={13} /> : <GripVertical size={15} />}
                              </div>
                              <span style={{ fontSize: 18, flexShrink: 0 }}>{sec.emoji}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: isRequired ? '#166534' : 'var(--espresso)', marginBottom: 1 }}>{sec.label}</div>
                                <div style={{ fontSize: 11, color: 'var(--stone)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sec.desc}</div>
                              </div>
                              {/* Item picker toggle — only for sections with content */}
                              {sectionItems[sec.id]?.length > 0 && (() => {
                                const secForm2 = form.sections.find(s => s.id === sec.id)
                                const selCount = secForm2?.selected_ids?.length ?? 0
                                const totalCount = sectionItems[sec.id].length
                                return (
                                  <button type="button"
                                    onClick={e => { e.stopPropagation(); setExpandedSectionId(expandedSectionId === sec.id ? null : sec.id) }}
                                    title="Escoger elementos"
                                    style={{
                                      flexShrink: 0, cursor: 'pointer', border: '1px solid',
                                      borderColor: expandedSectionId === sec.id ? 'var(--gold)' : 'var(--ivory)',
                                      background: expandedSectionId === sec.id ? '#fef9ec' : 'transparent',
                                      borderRadius: 6, padding: '3px 7px', display: 'flex', alignItems: 'center', gap: 4,
                                    }}>
                                    <List size={11} style={{ color: expandedSectionId === sec.id ? 'var(--gold)' : 'var(--stone)' }} />
                                    <span style={{ fontSize: 10, color: expandedSectionId === sec.id ? 'var(--gold)' : 'var(--stone)', fontWeight: 600 }}>
                                      {selCount > 0 ? `${selCount}/${totalCount}` : 'Todos'}
                                    </span>
                                  </button>
                                )
                              })()}
                              {!isRequired && (
                                <button type="button" onClick={() => removeSection(sec.id)}
                                  style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--stone)', padding: '2px 4px', borderRadius: 4, lineHeight: 1, fontSize: 16 }}>×</button>
                              )}
                            </div>
                            {/* Item picker panel */}
                            {expandedSectionId === sec.id && sectionItems[sec.id]?.length > 0 && (() => {
                              const secForm2 = form.sections.find(s => s.id === sec.id)
                              const selIds = secForm2?.selected_ids ?? []
                              const items = sectionItems[sec.id]
                              return (
                                <div style={{
                                  border: '1.5px solid var(--ivory)', borderTop: 'none',
                                  borderRadius: '0 0 8px 8px', background: '#fafafa',
                                  padding: '10px 12px',
                                }}>
                                  <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 8, fontWeight: 600 }}>
                                    Selecciona qué elementos mostrar en esta sección (vacío = todos)
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 180, overflowY: 'auto' }}>
                                    {items.map(item => {
                                      const checked = selIds.length === 0 || selIds.includes(item.id)
                                      const explicitly = selIds.includes(item.id)
                                      return (
                                        <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--espresso)' }}>
                                          <input type="checkbox"
                                            checked={selIds.length === 0 ? true : explicitly}
                                            onChange={() => {
                                              // If currently showing all (empty selIds), toggle means: select all except this one
                                              if (selIds.length === 0) {
                                                const allExcept = items.filter(i => i.id !== item.id).map(i => i.id)
                                                setForm(f => ({ ...f, sections: f.sections.map(s => s.id === sec.id ? { ...s, selected_ids: allExcept } : s) }))
                                              } else {
                                                toggleSectionItem(sec.id, item.id)
                                              }
                                            }}
                                            style={{ accentColor: 'var(--gold)', cursor: 'pointer' }}
                                          />
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.label}</span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                  {selIds.length > 0 && (
                                    <button type="button"
                                      onClick={() => setForm(f => ({ ...f, sections: f.sections.map(s => s.id === sec.id ? { ...s, selected_ids: [] } : s) }))}
                                      style={{ marginTop: 8, fontSize: 10, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                                      Mostrar todos
                                    </button>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        )
                      })}
                      {/* Drop zone at end */}
                      <div
                        onDragOver={e => { e.preventDefault(); setDropOver({ panel: 'selected', idx: form.sections.length }) }}
                        onDrop={() => onDrop('selected', form.sections.length)}
                        style={{
                          height: dragId ? 40 : 32,
                          borderRadius: 8, border: '2px dashed',
                          borderColor: dropOver?.panel === 'selected' && dropOver.idx === form.sections.length ? 'var(--gold)' : 'var(--ivory)',
                          background: dropOver?.panel === 'selected' && dropOver.idx === form.sections.length ? '#fef9ec' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, color: 'var(--stone)', transition: 'all 0.15s',
                          marginTop: 2,
                        }}>
                        {dragFrom === 'available' && <span>Soltar aquí ↓</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right: Available (compact chips) */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Disponibles
                    </div>
                    <div
                      onDragOver={e => { e.preventDefault(); setDropOver({ panel: 'available', idx: 0 }) }}
                      onDrop={() => onDrop('available', 0)}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 4,
                        background: dropOver?.panel === 'available' && dragFrom === 'selected' ? '#fef9ec' : 'var(--cream)',
                        borderRadius: 8, padding: 8, border: '1px dashed',
                        borderColor: dropOver?.panel === 'available' && dragFrom === 'selected' ? 'var(--gold)' : 'var(--ivory)',
                        minHeight: 80, transition: 'background 0.15s, border-color 0.15s',
                      }}>
                      {availableSections.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--stone)', fontSize: 10, padding: '16px 4px' }}>
                          Todas añadidas ✓
                        </div>
                      ) : availableSections.map(sec => (
                        <div key={sec.id}
                          draggable
                          onDragStart={() => onDragStart(sec.id, 'available')}
                          onDragEnd={onDragEnd}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 7px', background: dragId === sec.id ? '#fef9ec' : '#fff',
                            borderRadius: 6, border: `1px solid ${dragId === sec.id ? 'var(--gold)' : 'var(--ivory)'}`,
                            cursor: 'grab', userSelect: 'none',
                            opacity: dragId === sec.id ? 0.5 : 1,
                            transition: 'opacity 0.15s, border-color 0.15s',
                          }}>
                          <span style={{ fontSize: 13, flexShrink: 0 }}>{sec.emoji}</span>
                          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--espresso)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.label}</div>
                          <button type="button" onClick={() => addSection(sec.id)}
                            style={{
                              flexShrink: 0, background: 'var(--gold)', border: 'none', cursor: 'pointer',
                              color: '#fff', width: 18, height: 18, borderRadius: '50%',
                              fontSize: 14, lineHeight: '18px', textAlign: 'center', fontWeight: 700, padding: 0,
                            }}>+</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--stone)', marginTop: 6, textAlign: 'center' }}>
                      Arrastra o pulsa + para añadir
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: style settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="card" style={{ padding: '18px 20px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 14 }}>Estilo y textos</div>

                <div className="form-group">
                  <label className="form-label">Color de acento</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="color" value={form.accent_color} onChange={e => setF('accent_color', e.target.value)}
                      style={{ width: 40, height: 34, borderRadius: 6, border: '1px solid var(--ivory)', cursor: 'pointer', padding: 2 }} />
                    <input className="form-input" style={{ fontFamily: 'monospace', fontSize: 12 }} value={form.accent_color}
                      onChange={e => setF('accent_color', e.target.value)} placeholder="#C9A96E" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Tipografía</label>
                  {/* Preview + trigger */}
                  <button type="button"
                    onClick={() => { setFontOpen(o => !o); setFontSearch('') }}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      border: `1.5px solid ${fontOpen ? 'var(--gold)' : 'var(--ivory)'}`,
                      background: fontOpen ? '#fef9ec' : 'var(--cream)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    }}>
                    <span style={{ fontFamily: form.font_family || 'Georgia, serif', fontSize: 17, color: 'var(--espresso)' }}>
                      Aa — {getFontByValue(form.font_family || 'Georgia, serif')?.label ?? 'Georgia'}
                    </span>
                    <ChevronDown size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0, transform: fontOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                  </button>
                  {fontOpen && (() => {
                    const q = fontSearch.toLowerCase()
                    const filtered = GOOGLE_FONTS.filter(f =>
                      !q || f.label.toLowerCase().includes(q) || (f.desc || '').toLowerCase().includes(q)
                    )
                    return (
                      <div style={{ marginTop: 4, border: '1.5px solid var(--gold)', borderRadius: 8, background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                        {/* Search */}
                        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--ivory)' }}>
                          <input
                            autoFocus
                            value={fontSearch}
                            onChange={e => setFontSearch(e.target.value)}
                            placeholder="Buscar tipografía…"
                            style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--ivory)', borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        {/* Scrollable list */}
                        <div style={{ maxHeight: 280, overflowY: 'auto', padding: '6px' }}>
                          {filtered.length === 0 && (
                            <div style={{ padding: '12px', textAlign: 'center', fontSize: 12, color: 'var(--stone)' }}>Sin resultados</div>
                          )}
                          {!q && FONT_CATEGORIES.map(cat => {
                            const fonts = GOOGLE_FONTS.filter(f => f.category === cat.key)
                            return (
                              <div key={cat.key} style={{ marginBottom: 4 }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 6px 2px' }}>{cat.label}</div>
                                {fonts.map(opt => {
                                  const isActive = (form.font_family || 'Georgia, serif') === opt.value
                                  return (
                                    <button key={opt.value} type="button"
                                      onClick={() => { setF('font_family', opt.value); setFontOpen(false) }}
                                      style={{
                                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '6px 8px', borderRadius: 6, cursor: 'pointer', textAlign: 'left', border: 'none',
                                        background: isActive ? '#fef9ec' : 'transparent',
                                        outline: isActive ? '1.5px solid var(--gold)' : 'none',
                                        outlineOffset: '-1px',
                                      }}>
                                      <span style={{ fontFamily: opt.value, fontSize: 13, color: 'var(--espresso)' }}>{opt.label}</span>
                                      <span style={{ fontSize: 9, color: 'var(--warm-gray)', flexShrink: 0, marginLeft: 6 }}>{opt.desc}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            )
                          })}
                          {q && filtered.map(opt => {
                            const isActive = (form.font_family || 'Georgia, serif') === opt.value
                            return (
                              <button key={opt.value} type="button"
                                onClick={() => { setF('font_family', opt.value); setFontOpen(false) }}
                                style={{
                                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '6px 8px', borderRadius: 6, cursor: 'pointer', textAlign: 'left', border: 'none',
                                  background: isActive ? '#fef9ec' : 'transparent',
                                  outline: isActive ? '1.5px solid var(--gold)' : 'none',
                                  outlineOffset: '-1px',
                                }}>
                                <span style={{ fontFamily: opt.value, fontSize: 13, color: 'var(--espresso)' }}>{opt.label}</span>
                                <span style={{ fontSize: 9, color: 'var(--warm-gray)', flexShrink: 0, marginLeft: 6 }}>{opt.desc}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                <div className="form-group">
                  <label className="form-label">Título de cabecera</label>
                  <input className="form-input" value={form.header_text} onChange={e => setF('header_text', e.target.value)}
                    placeholder="Vuestra propuesta personalizada" />
                </div>

                <div className="form-group">
                  <label className="form-label">Texto del botón CTA</label>
                  <input className="form-input" value={form.cta_text} onChange={e => setF('cta_text', e.target.value)}
                    placeholder="Reservar fecha" />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Mostrar precios</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <button type="button" onClick={() => setF('show_price', !form.show_price)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: form.show_price ? 'var(--gold)' : 'var(--stone)' }}>
                      {form.show_price ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    </button>
                    <span style={{ fontSize: 12, color: form.show_price ? 'var(--gold)' : 'var(--warm-gray)' }}>
                      {form.show_price ? 'Precios visibles' : 'Precios ocultos'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="card" style={{ padding: '18px 20px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 10 }}>Vista previa</div>
                <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--ivory)' }}>
                  <div style={{ height: 60, background: `linear-gradient(135deg, ${form.accent_color}22, ${form.accent_color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 13, fontFamily: 'Cormorant Garamond, serif', color: form.accent_color, fontWeight: 600 }}>{form.header_text}</span>
                  </div>
                  <div style={{ padding: '10px 12px', background: '#fafafa' }}>
                    {form.sections.map(s => {
                      const cfg = ALL_SECTIONS_CFG.find(c => c.id === s.id)
                      return <div key={s.id} style={{ fontSize: 10, color: 'var(--warm-gray)', padding: '3px 0', borderBottom: '1px solid var(--ivory)' }}>{cfg?.emoji} {cfg?.label}</div>
                    })}
                    <div style={{ marginTop: 8, background: form.accent_color, color: '#fff', padding: '6px', borderRadius: 6, textAlign: 'center', fontSize: 11, fontFamily: form.font_family }}>
                      {form.cta_text}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '12px 16px', background: '#fef9ec', border: '1px solid #fde68a', borderRadius: 10, fontSize: 12, color: 'var(--espresso)' }}>
                <strong>💡 Ver propuesta real</strong><br />
                <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Ve a </span>
                <a href="/propuestas" target="_blank" style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>Propuestas →</a>
                <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}> abre cualquier propuesta con el icono 🔗 para ver la landing en vivo.</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
                  {saving ? 'Guardando...' : 'Guardar plantilla'}
                </button>
                <button className="btn btn-ghost" onClick={() => { setSelected(null); setIsNew(false) }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Content Tab ───────────────────────────────────────────────────────────────

function ContentTab({ content, userId, onRefresh }: {
  content: {
    packages: VenuePackage[]
    zones: VenueZone[]
    season_prices: VenueSeasonPrice[]
    inclusions: VenueInclusion[]
    exclusions: VenueExclusion[]
    faq: VenueFaq[]
    testimonials: VenueTestimonial[]
    collaborators: VenueCollaborator[]
    extra_services: VenueExtraService[]
    countdown: VenueCountdown | null
    menu_prices: VenueMenuPrice[]
    budget_simulator: VenueBudgetSimulator | null
    conditions: VenueConditions | null
    experience: VenueExperience | null
    video_default: VenueVideoSection | null
    techspecs: VenueTechspecs | null
    accommodation_info: VenueAccommodationInfo | null
    map_info: VenueMapInfo | null
    chat_settings: VenueChatSettings | null
  }
  userId: string
  onRefresh: () => void
}) {
  const [openGroup, setOpenGroup] = useState<string | null>('prices')
  const toggle = (id: string) => setOpenGroup(g => g === id ? null : id)

  type AccordionGroup = {
    id: string
    icon: string
    title: string
    desc: string
    count: number
    body: React.ReactNode
  }

  const groups: AccordionGroup[] = [
    {
      id: 'prices',
      icon: '💰',
      title: '1. Precios y formatos',
      desc: 'Paquetes, precio por menú y reglas de precio',
      count: content.packages.length + content.menu_prices.length + content.season_prices.length,
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <PackagesEditor items={content.packages} userId={userId} onRefresh={onRefresh} />
          <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 28 }}>
            <MenuPriceEditor items={content.menu_prices} userId={userId} onRefresh={onRefresh} />
          </div>
          <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 28 }}>
            <SeasonPricesEditor items={content.season_prices} userId={userId} onRefresh={onRefresh} />
          </div>
        </div>
      ),
    },
    {
      id: 'inclusions',
      icon: '✅',
      title: '2. Qué incluye y condiciones',
      desc: 'Servicios incluidos, exclusiones y condiciones de reserva',
      count: content.inclusions.length + content.exclusions.length + (content.conditions ? 1 : 0),
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <InclusionsEditor items={content.inclusions} userId={userId} onRefresh={onRefresh} />
          <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 28 }}>
            <ExclusionsEditor items={content.exclusions} userId={userId} onRefresh={onRefresh} />
          </div>
          <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 28 }}>
            <ConditionsEditor item={content.conditions} userId={userId} onRefresh={onRefresh} />
          </div>
        </div>
      ),
    },
    {
      id: 'extras',
      icon: '➕',
      title: '3. Servicios y extras',
      desc: 'Extras opcionales y colaboradores recomendados',
      count: content.extra_services.length + content.collaborators.length,
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <ExtraServicesEditor items={content.extra_services} userId={userId} onRefresh={onRefresh} />
          <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 28 }}>
            <CollaboratorsEditor items={content.collaborators} userId={userId} onRefresh={onRefresh} />
          </div>
        </div>
      ),
    },
    {
      id: 'visual',
      icon: '📸',
      title: '4. Contenido visual',
      desc: 'Fotos destacadas, galería y vídeo',
      count: content.video_default?.url ? 1 : 0,
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <PhotosPlaceholder type="hero" />
          <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 28 }}>
            <PhotosPlaceholder type="gallery" />
          </div>
          <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 28 }}>
            <VenueVideoEditor item={content.video_default} userId={userId} onRefresh={onRefresh} />
          </div>
        </div>
      ),
    },
    {
      id: 'commercial',
      icon: '💬',
      title: '5. Contenido comercial',
      desc: 'Descripción de la experiencia y testimonios de parejas',
      count: (content.experience ? 1 : 0) + content.testimonials.length,
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <ExperienceEditor item={content.experience} userId={userId} onRefresh={onRefresh} />
          <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 28 }}>
            <TestimonialsEditor items={content.testimonials} userId={userId} onRefresh={onRefresh} />
          </div>
        </div>
      ),
    },
    {
      id: 'faq',
      icon: '❓',
      title: '6. Preguntas frecuentes',
      desc: 'Responde las dudas más habituales de las parejas',
      count: content.faq.length,
      body: <FaqEditor items={content.faq} userId={userId} onRefresh={onRefresh} />,
    },
    {
      id: 'venue_info',
      icon: '📍',
      title: '7. Información del venue',
      desc: 'Ficha técnica, zonas, alojamiento y ubicación',
      count: (content.techspecs ? 1 : 0) + content.zones.length + (content.accommodation_info ? 1 : 0) + (content.map_info?.embed_url ? 1 : 0),
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <VenueTechspecsEditor item={content.techspecs} userId={userId} onRefresh={onRefresh} />
          <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 28 }}>
            <ZonesEditor items={content.zones} userId={userId} onRefresh={onRefresh} />
          </div>
          <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 28 }}>
            <VenueAccommodationEditor item={content.accommodation_info} userId={userId} onRefresh={onRefresh} />
          </div>
          <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 28 }}>
            <VenueMapEditor item={content.map_info} userId={userId} onRefresh={onRefresh} />
          </div>
        </div>
      ),
    },
    {
      id: 'tools',
      icon: '🧮',
      title: '8. Herramientas',
      desc: 'Simulador de presupuesto y cuenta atrás',
      count: (content.budget_simulator ? 1 : 0) + (content.countdown ? 1 : 0),
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <BudgetSimulatorEditor item={content.budget_simulator} userId={userId} onRefresh={onRefresh} />
          <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 28 }}>
            <CountdownEditor item={content.countdown} userId={userId} onRefresh={onRefresh} />
          </div>
        </div>
      ),
    },
    {
      id: 'interaction',
      icon: '💬',
      title: '9. Interacción',
      desc: 'Formulario de preguntas en la propuesta',
      count: content.chat_settings?.enabled ? 1 : 0,
      body: <VenueChatEditor item={content.chat_settings} userId={userId} onRefresh={onRefresh} />,
    },
  ]

  return (
    <div>
      {/* Info banner */}
      <div style={{ padding: '12px 16px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, marginBottom: 20, fontSize: 12, color: '#0369a1', lineHeight: 1.7 }}>
        <strong>Configura una vez, se carga en cada propuesta.</strong> Puedes ajustar cualquier dato por pareja antes de enviar.
      </div>

      {/* Accordion groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {groups.map(group => {
          const isOpen = openGroup === group.id
          return (
            <div key={group.id} style={{ border: '1px solid var(--ivory)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
              {/* Header */}
              <button
                onClick={() => toggle(group.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                  padding: '16px 20px', background: isOpen ? '#fef9ec' : '#fff',
                  border: 'none', borderBottom: isOpen ? '1px solid var(--ivory)' : 'none',
                  cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{group.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>{group.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{group.desc}</div>
                </div>
                {group.count > 0 && (
                  <span style={{ fontSize: 10, background: isOpen ? 'var(--gold)' : 'var(--cream)', color: isOpen ? '#fff' : 'var(--warm-gray)', borderRadius: 10, padding: '2px 8px', fontWeight: 600, flexShrink: 0 }}>
                    {group.count}
                  </span>
                )}
                {isOpen
                  ? <ChevronUp size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                  : <ChevronDown size={16} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                }
              </button>

              {/* Body */}
              {isOpen && (
                <div style={{ padding: '24px 24px 28px' }}>
                  {group.body}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Content: Packages ─────────────────────────────────────────────────────────

function PackagesEditor({ items, userId, onRefresh }: { items: VenuePackage[]; userId: string; onRefresh: () => void }) {
  const [editing, setEditing]   = useState<VenuePackage | null>(null)
  const [isNew,   setIsNew]     = useState(false)
  const [saving,  setSaving]    = useState(false)

  const empty = (): Omit<VenuePackage, 'id'> => ({
    name: '', subtitle: '', price: '', min_guests: undefined, max_guests: undefined,
    description: '', includes: [''], sort_order: items.length, is_active: true,
  })
  const [form, setForm] = useState<Omit<VenuePackage, 'id'>>(empty())
  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const openNew = () => { setForm(empty()); setIsNew(true); setEditing(null) }
  const openEdit = (p: VenuePackage) => {
    setForm({ name: p.name, subtitle: p.subtitle || '', price: p.price || '', min_guests: p.min_guests, max_guests: p.max_guests, description: p.description || '', includes: p.includes?.length ? p.includes : [''], sort_order: p.sort_order, is_active: p.is_active })
    setEditing(p); setIsNew(false)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'package', sort_order: form.sort_order, is_active: form.is_active, data: { name: form.name, subtitle: form.subtitle, price: form.price, min_guests: form.min_guests, max_guests: form.max_guests, description: form.description, includes: form.includes.filter(Boolean) } }
    if (isNew) await supabase.from('venue_content').insert(payload)
    else if (editing) await supabase.from('venue_content').update(payload).eq('id', editing.id)
    setSaving(false); setIsNew(false); setEditing(null); onRefresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este paquete?')) return
    await createClient().from('venue_content').delete().eq('id', id)
    if (editing?.id === id) setEditing(null)
    onRefresh()
  }

  const updateInclude = (i: number, val: string) => {
    const arr = [...form.includes]; arr[i] = val; setF('includes', arr)
  }
  const addInclude    = () => setF('includes', [...form.includes, ''])
  const removeInclude = (i: number) => setF('includes', form.includes.filter((_, j) => j !== i))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Paquetes y precios</div>
          <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Define los tiers que ofreces. Se muestran en la propuesta con posibilidad de ajustar por pareja.</div>
        </div>
        <button onClick={openNew} className="btn btn-primary btn-sm"><Plus size={12} /> Nuevo paquete</button>
      </div>

      {/* Form */}
      {(isNew || editing) && (
        <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>{isNew ? 'Nuevo paquete' : `Editando: ${editing?.name}`}</div>
            <button onClick={() => { setIsNew(false); setEditing(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nombre del paquete *</label>
              <input className="form-input" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Ej: Paquete Silver" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Subtítulo</label>
              <input className="form-input" value={form.subtitle || ''} onChange={e => setF('subtitle', e.target.value)} placeholder="Ej: Ideal para bodas íntimas" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Precio</label>
              <input className="form-input" value={form.price || ''} onChange={e => setF('price', e.target.value)} placeholder="Ej: desde 8.500€" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Mín. invitados</label>
              <input className="form-input" type="number" value={form.min_guests || ''} onChange={e => setF('min_guests', e.target.value ? parseInt(e.target.value) : undefined)} placeholder="80" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Máx. invitados</label>
              <input className="form-input" type="number" value={form.max_guests || ''} onChange={e => setF('max_guests', e.target.value ? parseInt(e.target.value) : undefined)} placeholder="150" />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Descripción del paquete</label>
            <textarea className="form-textarea" style={{ minHeight: 70 }} value={form.description || ''} onChange={e => setF('description', e.target.value)} placeholder="Descripción breve del paquete y qué lo hace especial..." />
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Qué incluye (para este paquete)</label>
              <button type="button" onClick={addInclude} style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Plus size={11} /> Añadir
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {form.includes.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ color: '#16a34a', fontSize: 14, flexShrink: 0 }}>✓</span>
                  <input className="form-input" style={{ flex: 1 }} value={item} onChange={e => updateInclude(i, e.target.value)} placeholder="Ej: Catering con menú degustación" />
                  {form.includes.length > 1 && (
                    <button type="button" onClick={() => removeInclude(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 2 }}><X size={12} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => { setIsNew(false); setEditing(null) }}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>{saving ? 'Guardando...' : 'Guardar paquete'}</button>
          </div>
        </div>
      )}

      {/* Package cards */}
      {items.length === 0 && !isNew ? (
        <div className="card" style={{ padding: '36px 24px', textAlign: 'center' }}>
          <Package size={32} style={{ color: 'var(--gold)', margin: '0 auto 12px', opacity: 0.6 }} />
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, marginBottom: 8 }}>Sin paquetes definidos</div>
          <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 16 }}>Define tus paquetes una vez y se añadirán automáticamente a cada propuesta.</div>
          <button onClick={openNew} className="btn btn-primary btn-sm"><Plus size={12} /> Crear primer paquete</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(pkg => (
            <div key={pkg.id} className="card" style={{ opacity: pkg.is_active ? 1 : 0.55 }}>
              <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--espresso)' }}>{pkg.name}</span>
                    {pkg.price && <span style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600 }}>{pkg.price}</span>}
                    {(pkg.min_guests || pkg.max_guests) && (
                      <span style={{ fontSize: 11, color: 'var(--warm-gray)', background: 'var(--cream)', padding: '1px 8px', borderRadius: 8 }}>
                        {pkg.min_guests && pkg.max_guests ? `${pkg.min_guests}–${pkg.max_guests} inv.` : pkg.max_guests ? `hasta ${pkg.max_guests} inv.` : `desde ${pkg.min_guests} inv.`}
                      </span>
                    )}
                  </div>
                  {pkg.subtitle && <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 6 }}>{pkg.subtitle}</div>}
                  {pkg.description && <div style={{ fontSize: 12, color: 'var(--charcoal)', marginBottom: 8, lineHeight: 1.5 }}>{pkg.description}</div>}
                  {pkg.includes?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {pkg.includes.filter(Boolean).map((inc, i) => (
                        <span key={i} style={{ fontSize: 11, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 8 }}>✓ {inc}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => openEdit(pkg)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--ivory)', background: '#fff', color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Pencil size={11} /> Editar
                  </button>
                  <button onClick={() => handleDelete(pkg.id)} style={{ fontSize: 11, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', border: '1px solid #fca5a5', background: '#fff', color: '#dc2626' }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Content: Inclusions ───────────────────────────────────────────────────────

function InclusionsEditor({ items, userId, onRefresh }: { items: VenueInclusion[]; userId: string; onRefresh: () => void }) {
  const [editing, setEditing] = useState<VenueInclusion | null>(null)
  const [isNew,   setIsNew]   = useState(false)
  const [saving,  setSaving]  = useState(false)

  const empty = (): Omit<VenueInclusion, 'id'> => ({ title: '', description: '', emoji: '✓', sort_order: items.length })
  const [form, setForm] = useState(empty())
  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const openNew  = () => { setForm(empty()); setIsNew(true); setEditing(null) }
  const openEdit = (item: VenueInclusion) => {
    setForm({ title: item.title, description: item.description || '', emoji: item.emoji || '✓', sort_order: item.sort_order })
    setEditing(item); setIsNew(false)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'inclusion', sort_order: form.sort_order, is_active: true, data: { title: form.title, description: form.description, emoji: form.emoji } }
    if (isNew) await supabase.from('venue_content').insert(payload)
    else if (editing) await supabase.from('venue_content').update(payload).eq('id', editing.id)
    setSaving(false); setIsNew(false); setEditing(null); onRefresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar?')) return
    await createClient().from('venue_content').delete().eq('id', id)
    onRefresh()
  }

  const COMMON_INCLUSIONS = [
    { title: 'Catering personalizado', emoji: '🍽️' },
    { title: 'Música y DJ', emoji: '🎵' },
    { title: 'Decoración floral', emoji: '💐' },
    { title: 'Coordinador de bodas', emoji: '📋' },
    { title: 'Aparcamiento gratuito', emoji: '🚗' },
    { title: 'Zona de ceremonia', emoji: '💍' },
    { title: 'Suite nupcial', emoji: '🛏️' },
    { title: 'Iluminación decorativa', emoji: '💡' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Qué incluye</div>
          <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Servicios incluidos en tu venue. Se muestran como checklist en la propuesta.</div>
        </div>
        <button onClick={openNew} className="btn btn-primary btn-sm"><Plus size={12} /> Añadir</button>
      </div>

      {/* Quick add from common */}
      {!isNew && (
        <div style={{ marginBottom: 14, padding: '14px 16px', background: 'var(--cream)', borderRadius: 10, border: '1px dashed var(--gold)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 10 }}>Selecciona los más comunes para añadir rápido:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {COMMON_INCLUSIONS.filter(ci => !items.some(i => i.title === ci.title)).map(ci => (
              <button key={ci.title} type="button" onClick={async () => {
                await createClient().from('venue_content').insert({ user_id: userId, section: 'inclusion', sort_order: 0, is_active: true, data: { title: ci.title, description: '', emoji: ci.emoji } })
                onRefresh()
              }} style={{ fontSize: 12, padding: '5px 11px', borderRadius: 20, cursor: 'pointer', border: '1px solid var(--ivory)', background: '#fff', color: 'var(--charcoal)' }}>
                {ci.emoji} {ci.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      {(isNew || editing) && (
        <div className="card" style={{ padding: '16px', marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Emoji</label>
              <input className="form-input" style={{ textAlign: 'center', fontSize: 18 }} value={form.emoji || ''} onChange={e => setF('emoji', e.target.value)} maxLength={2} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Título *</label>
              <input className="form-input" value={form.title} onChange={e => setF('title', e.target.value)} placeholder="Ej: Catering personalizado" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Descripción breve</label>
              <input className="form-input" value={form.description || ''} onChange={e => setF('description', e.target.value)} placeholder="Ej: Menú degustación de 5 platos" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setIsNew(false); setEditing(null) }}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.title.trim()}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#fff', border: '1px solid var(--ivory)', borderRadius: 8 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{item.emoji || '✓'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)' }}>{item.title}</div>
              {item.description && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{item.description}</div>}
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={() => openEdit(item)} style={{ background: 'none', border: '1px solid var(--ivory)', borderRadius: 6, cursor: 'pointer', padding: '4px 8px', color: 'var(--charcoal)' }}><Pencil size={11} /></button>
              <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', padding: '4px 8px', color: '#dc2626' }}><Trash2 size={11} /></button>
            </div>
          </div>
        ))}
        {items.length === 0 && !isNew && (
          <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 12 }}>
            <List size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div>Añade los servicios incluidos en tu venue</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Content: FAQ ──────────────────────────────────────────────────────────────

function FaqEditor({ items, userId, onRefresh }: { items: VenueFaq[]; userId: string; onRefresh: () => void }) {
  const [editing,  setEditing]  = useState<VenueFaq | null>(null)
  const [isNew,    setIsNew]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const empty = (): Omit<VenueFaq, 'id'> => ({ question: '', answer: '', category: 'general', sort_order: items.length })
  const [form, setForm] = useState(empty())
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const openNew  = () => { setForm(empty()); setIsNew(true); setEditing(null) }
  const openEdit = (item: VenueFaq) => {
    setForm({ question: item.question, answer: item.answer, category: item.category || 'general', sort_order: item.sort_order })
    setEditing(item); setIsNew(false)
  }

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'faq', sort_order: form.sort_order, is_active: true, data: { question: form.question, answer: form.answer, category: form.category } }
    if (isNew) await supabase.from('venue_content').insert(payload)
    else if (editing) await supabase.from('venue_content').update(payload).eq('id', editing.id)
    setSaving(false); setIsNew(false); setEditing(null); onRefresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta pregunta?')) return
    await createClient().from('venue_content').delete().eq('id', id)
    onRefresh()
  }

  const SAMPLE_FAQS = [
    { question: '¿Cuántas personas tienen capacidad?', answer: '' },
    { question: '¿Se puede elegir el catering externo?', answer: '' },
    { question: '¿Hay alojamiento disponible?', answer: '' },
    { question: '¿Cuánto tiempo tenemos el venue?', answer: '' },
    { question: '¿Cómo se gestiona el pago y la señal?', answer: '' },
    { question: '¿Se permiten mascotas?', answer: '' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Preguntas frecuentes</div>
          <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Responde las dudas más habituales. Se muestran en acordeón en la propuesta.</div>
        </div>
        <button onClick={openNew} className="btn btn-primary btn-sm"><Plus size={12} /> Añadir pregunta</button>
      </div>

      {/* Quick FAQ seeds */}
      {!isNew && (
        <div style={{ marginBottom: 14, padding: '14px 16px', background: 'var(--cream)', borderRadius: 10, border: '1px dashed var(--gold)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 10 }}>Preguntas habituales — haz click para crear:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {SAMPLE_FAQS.filter(sq => !items.some(i => i.question === sq.question)).map(sq => (
              <button key={sq.question} type="button" onClick={() => {
                setForm({ question: sq.question, answer: '', category: 'general', sort_order: items.length })
                setIsNew(true); setEditing(null)
              }} style={{ fontSize: 11, padding: '5px 11px', borderRadius: 20, cursor: 'pointer', border: '1px solid var(--ivory)', background: '#fff', color: 'var(--charcoal)', textAlign: 'left' }}>
                {sq.question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      {(isNew || editing) && (
        <div className="card" style={{ padding: '16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>{isNew ? 'Nueva pregunta' : 'Editar pregunta'}</span>
            <button onClick={() => { setIsNew(false); setEditing(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}><X size={14} /></button>
          </div>
          <div className="form-group">
            <label className="form-label">Pregunta *</label>
            <input className="form-input" value={form.question} onChange={e => setF('question', e.target.value)} placeholder="Ej: ¿Cuántas personas tienen capacidad?" />
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Respuesta *</label>
            <textarea className="form-textarea" style={{ minHeight: 90 }} value={form.answer} onChange={e => setF('answer', e.target.value)} placeholder="Respuesta detallada..." />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setIsNew(false); setEditing(null) }}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.question.trim() || !form.answer.trim()}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      {/* FAQ accordion list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map((item, i) => (
          <div key={item.id} style={{ border: '1px solid var(--ivory)', borderRadius: 8, overflow: 'hidden' }}>
            <div onClick={() => setExpanded(expanded === item.id ? null : item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer', background: expanded === item.id ? '#fef9ec' : '#fff' }}>
              <span style={{ fontSize: 12, color: 'var(--stone)', fontWeight: 700, minWidth: 20 }}>{i + 1}</span>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--charcoal)' }}>{item.question}</div>
              <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                <button onClick={() => openEdit(item)} style={{ background: 'none', border: '1px solid var(--ivory)', borderRadius: 6, cursor: 'pointer', padding: '3px 7px', color: 'var(--charcoal)' }}><Pencil size={11} /></button>
                <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', padding: '3px 7px', color: '#dc2626' }}><Trash2 size={11} /></button>
              </div>
              {expanded === item.id ? <ChevronUp size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />}
            </div>
            {expanded === item.id && (
              <div style={{ padding: '10px 14px 14px 44px', background: '#fefcf5', fontSize: 12, color: 'var(--charcoal)', lineHeight: 1.7, borderTop: '1px solid var(--ivory)' }}>
                {item.answer}
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && !isNew && (
          <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 12 }}>
            <HelpCircle size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div>Añade las preguntas frecuentes de tu venue</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Content: Testimonials ─────────────────────────────────────────────────────

function TestimonialsEditor({ items, userId, onRefresh }: { items: VenueTestimonial[]; userId: string; onRefresh: () => void }) {
  const [editing, setEditing] = useState<VenueTestimonial | null>(null)
  const [isNew,   setIsNew]   = useState(false)
  const [saving,  setSaving]  = useState(false)

  const empty = (): Omit<VenueTestimonial, 'id'> => ({ couple_name: '', wedding_date: '', text: '', rating: 5, photo_url: '' })
  const [form, setForm] = useState(empty())
  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const openNew  = () => { setForm(empty()); setIsNew(true); setEditing(null) }
  const openEdit = (item: VenueTestimonial) => {
    setForm({ couple_name: item.couple_name, wedding_date: item.wedding_date || '', text: item.text, rating: item.rating, photo_url: item.photo_url || '' })
    setEditing(item); setIsNew(false)
  }

  const handleSave = async () => {
    if (!form.couple_name.trim() || !form.text.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'testimonial', sort_order: 0, is_active: true, data: { couple_name: form.couple_name, wedding_date: form.wedding_date, text: form.text, rating: form.rating, photo_url: form.photo_url } }
    if (isNew) await supabase.from('venue_content').insert(payload)
    else if (editing) await supabase.from('venue_content').update(payload).eq('id', editing.id)
    setSaving(false); setIsNew(false); setEditing(null); onRefresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este testimonio?')) return
    await createClient().from('venue_content').delete().eq('id', id)
    onRefresh()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Testimonios</div>
          <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Opiniones de bodas anteriores. Generan confianza en la propuesta.</div>
        </div>
        <button onClick={openNew} className="btn btn-primary btn-sm"><Plus size={12} /> Añadir testimonio</button>
      </div>

      {/* Form */}
      {(isNew || editing) && (
        <div className="card" style={{ padding: '16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>{isNew ? 'Nuevo testimonio' : 'Editar'}</span>
            <button onClick={() => { setIsNew(false); setEditing(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}><X size={14} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nombre de la pareja *</label>
              <input className="form-input" value={form.couple_name} onChange={e => setF('couple_name', e.target.value)} placeholder="Laura & Carlos" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Fecha de la boda</label>
              <input className="form-input" value={form.wedding_date || ''} onChange={e => setF('wedding_date', e.target.value)} placeholder="junio 2024" />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label">Testimonio *</label>
            <textarea className="form-textarea" style={{ minHeight: 80 }} value={form.text} onChange={e => setF('text', e.target.value)} placeholder="Su valoración sobre la experiencia en el venue..." />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Valoración:</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => setF('rating', n)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: n <= form.rating ? '#f59e0b' : '#d1d5db' }}>★</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setIsNew(false); setEditing(null) }}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.couple_name.trim() || !form.text.trim()}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {items.map(item => (
          <div key={item.id} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: '#f59e0b' }}>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)', marginTop: 2 }}>{item.couple_name}</div>
                {item.wedding_date && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{item.wedding_date}</div>}
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={() => openEdit(item)} style={{ background: 'none', border: '1px solid var(--ivory)', borderRadius: 6, cursor: 'pointer', padding: '3px 7px' }}><Pencil size={11} /></button>
                <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', padding: '3px 7px', color: '#dc2626' }}><Trash2 size={11} /></button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--charcoal)', lineHeight: 1.6, fontStyle: 'italic' }}>"{item.text}"</div>
          </div>
        ))}
        {items.length === 0 && !isNew && (
          <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 12, gridColumn: '1 / -1' }}>
            <Quote size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div>Añade testimonios de bodas anteriores para generar confianza</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Content: Experience ───────────────────────────────────────────────────────

function ExperienceEditor({ item, userId, onRefresh }: { item: VenueExperience | null; userId: string; onRefresh: () => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: item?.title || 'La experiencia en nuestro venue', body: item?.body || '' })
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.body.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'experience', sort_order: 0, is_active: true, data: { title: form.title, body: form.body } }
    if (item) await supabase.from('venue_content').update(payload).eq('id', item.id)
    else await supabase.from('venue_content').insert(payload)
    setSaving(false); onRefresh()
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>La experiencia</div>
        <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Un texto evocador que describe el día de boda en tu venue. Aparece como sección narrativa en la propuesta.</div>
      </div>

      <div className="card" style={{ padding: '20px' }}>
        <div className="form-group">
          <label className="form-label">Título de la sección</label>
          <input className="form-input" value={form.title} onChange={e => setF('title', e.target.value)} placeholder="Ej: La experiencia en nuestro venue" />
        </div>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Descripción *</label>
            <span style={{ fontSize: 10, color: 'var(--stone)' }}>{form.body.length} caracteres</span>
          </div>
          <textarea className="form-textarea" style={{ minHeight: 200 }} value={form.body} onChange={e => setF('body', e.target.value)}
            placeholder="Describe cómo es vivir el día de boda en tu venue. Habla de los espacios, la luz, los momentos especiales, la atención que reciben las parejas...

Ej: Desde el momento en que llegáis a Villa Rosa, el tiempo parece detenerse. Los jardines de 3 hectáreas, la luz dorada del atardecer filtrándose entre los olivos centenarios y el olor a flores silvestres crean el escenario perfecto para vuestro día más especial..." />
        </div>
        <div style={{ padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#0369a1' }}>
          💡 <strong>Consejo:</strong> Escribe en segunda persona del plural (vosotros), sé evocador y específico. Menciona detalles únicos del venue que lo diferencien de los demás.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.body.trim()}>
            {saving ? 'Guardando...' : item ? 'Actualizar texto' : 'Guardar texto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Content: Zones ────────────────────────────────────────────────────────────

function ZonesEditor({ items, userId, onRefresh }: { items: VenueZone[]; userId: string; onRefresh: () => void }) {
  const [editing,    setEditing]    = useState<VenueZone | null>(null)
  const [isNew,      setIsNew]      = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState<string | null>(null)
  const [uploading,  setUploading]  = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const empty = (): Omit<VenueZone, 'id'> => ({ name: '', description: '', capacity_min: undefined, capacity_max: undefined, price: '', sort_order: items.length, photos: [] })
  const [form, setForm] = useState(empty())
  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const openNew  = () => { setForm(empty()); setIsNew(true); setEditing(null) }
  const openEdit = (item: VenueZone) => {
    setForm({ name: item.name, description: item.description || '', capacity_min: item.capacity_min, capacity_max: item.capacity_max, price: item.price || '', sort_order: item.sort_order, photos: item.photos || [] })
    setEditing(item); setIsNew(false)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true); setSaveError(null)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'zone', sort_order: form.sort_order, is_active: true, data: { name: form.name, description: form.description, capacity_min: form.capacity_min, capacity_max: form.capacity_max, price: form.price, photos: form.photos ?? [] } }
    let err = null
    if (isNew) { const r = await supabase.from('venue_content').insert(payload); err = r.error }
    else if (editing) { const r = await supabase.from('venue_content').update(payload).eq('id', editing.id); err = r.error }
    setSaving(false)
    if (err) { setSaveError(err.message); return }
    setIsNew(false); setEditing(null); onRefresh()
  }
  const handleDelete = async (id: string) => { if (!confirm('¿Eliminar zona?')) return; await createClient().from('venue_content').delete().eq('id', id); onRefresh() }

  const handlePhotoUpload = async (files: FileList) => {
    setUploading(true)
    const supabase = createClient()
    const uploaded: string[] = []
    for (const file of Array.from(files)) {
      const ext  = file.name.split('.').pop()
      const path = `zones/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('proposal-assets').upload(path, file, { upsert: true })
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('proposal-assets').getPublicUrl(path)
        uploaded.push(publicUrl)
      }
    }
    setF('photos', [...(form.photos ?? []), ...uploaded])
    setUploading(false)
  }

  const removePhoto = (idx: number) => setF('photos', (form.photos ?? []).filter((_, i) => i !== idx))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Zonas y precios</div>
          <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Define los espacios de tu venue con capacidad, precio y fotos.</div>
        </div>
        <button onClick={openNew} className="btn btn-primary btn-sm"><Plus size={12} /> Añadir zona</button>
      </div>

      {(isNew || editing) && (
        <div className="card" style={{ padding: '16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>{isNew ? 'Nueva zona' : 'Editar zona'}</span>
            <button onClick={() => { setIsNew(false); setEditing(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}><X size={14} /></button>
          </div>

          {/* Basic fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nombre de la zona *</label>
              <input className="form-input" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Ej: Jardín principal" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Precio base</label>
              <input className="form-input" value={form.price || ''} onChange={e => setF('price', e.target.value)} placeholder="Ej: desde 5.000€" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10, marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Capacidad mín.</label>
              <input className="form-input" type="number" value={form.capacity_min || ''} onChange={e => setF('capacity_min', Number(e.target.value) || undefined)} placeholder="50" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Capacidad máx.</label>
              <input className="form-input" type="number" value={form.capacity_max || ''} onChange={e => setF('capacity_max', Number(e.target.value) || undefined)} placeholder="300" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Descripción</label>
              <input className="form-input" value={form.description || ''} onChange={e => setF('description', e.target.value)} placeholder="Ej: Espacio exterior para ceremonias" />
            </div>
          </div>

          {/* Photo gallery */}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Fotos de la zona</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {(form.photos ?? []).map((url, i) => (
                <div key={i} style={{ position: 'relative', width: 80, height: 60, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--ivory)' }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => removePhoto(i)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#fff', padding: '1px 4px', fontSize: 11, lineHeight: 1 }}>×</button>
                </div>
              ))}
              <div
                onClick={() => photoInputRef.current?.click()}
                style={{ width: 80, height: 60, borderRadius: 6, border: '1px dashed var(--gold)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: uploading ? 'default' : 'pointer', color: 'var(--gold)', fontSize: 10, gap: 3 }}>
                {uploading ? '...' : <><Upload size={14} /><span>Subir</span></>}
              </div>
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => e.target.files?.length && handlePhotoUpload(e.target.files)} />
            <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Sube una o varias fotos de esta zona (JPG, PNG, WEBP)</div>
          </div>

          {saveError && <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 8, padding: '6px 10px', background: '#fef2f2', borderRadius: 6 }}>Error: {saveError}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setIsNew(false); setEditing(null) }}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || uploading || !form.name.trim()}>{saving ? 'Guardando...' : 'Guardar zona'}</button>
          </div>
        </div>
      )}

      {/* Zone cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(item => (
          <div key={item.id} style={{ background: '#fff', border: '1px solid var(--ivory)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Photo strip */}
            {(item.photos ?? []).length > 0 && (
              <div style={{ display: 'flex', gap: 2, height: 90, overflow: 'hidden' }}>
                {(item.photos ?? []).slice(0, 4).map((url, i) => (
                  <img key={i} src={url} alt="" style={{ flex: 1, minWidth: 0, objectFit: 'cover' }} />
                ))}
                {(item.photos ?? []).length > 4 && (
                  <div style={{ flex: 1, minWidth: 40, background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--warm-gray)' }}>+{(item.photos ?? []).length - 4}</div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
              {!(item.photos ?? []).length && <MapPin size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>{item.name}</span>
                  {item.price && <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 500 }}>{item.price}</span>}
                  {(item.capacity_min || item.capacity_max) && (
                    <span style={{ fontSize: 11, color: 'var(--warm-gray)', background: 'var(--cream)', padding: '1px 8px', borderRadius: 8 }}>
                      {item.capacity_min && item.capacity_max ? `${item.capacity_min}–${item.capacity_max} inv.` : item.capacity_max ? `hasta ${item.capacity_max} inv.` : `desde ${item.capacity_min} inv.`}
                    </span>
                  )}
                  {(item.photos ?? []).length > 0 && <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{item.photos!.length} foto{item.photos!.length !== 1 ? 's' : ''}</span>}
                </div>
                {item.description && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{item.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={() => openEdit(item)} style={{ background: 'none', border: '1px solid var(--ivory)', borderRadius: 6, cursor: 'pointer', padding: '4px 8px', color: 'var(--charcoal)' }}><Pencil size={11} /></button>
                <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', padding: '4px 8px', color: '#dc2626' }}><Trash2 size={11} /></button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && !isNew && (
          <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 12 }}>
            <MapPin size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div>Define los espacios y zonas disponibles en tu venue</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Content: Season Prices ────────────────────────────────────────────────────

function SeasonPricesEditor({ items, userId, onRefresh }: { items: VenueSeasonPrice[]; userId: string; onRefresh: () => void }) {
  const [editing, setEditing] = useState<VenueSeasonPrice | null>(null)
  const [isNew,   setIsNew]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const empty = (): Omit<VenueSeasonPrice, 'id'> => ({ season: 'alta', label: '', date_range: '', price_modifier: '', notes: '', sort_order: items.length })
  const [form, setForm] = useState(empty())
  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const openNew  = () => { setForm(empty()); setIsNew(true); setEditing(null) }
  const openEdit = (item: VenueSeasonPrice) => { setForm({ season: item.season, label: item.label, date_range: item.date_range || '', price_modifier: item.price_modifier || '', notes: item.notes || '', sort_order: item.sort_order }); setEditing(item); setIsNew(false) }

  const handleSave = async () => {
    if (!form.label.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'season_price', sort_order: form.sort_order, is_active: true, data: { season: form.season, label: form.label, date_range: form.date_range, price_modifier: form.price_modifier, notes: form.notes } }
    if (isNew) await supabase.from('venue_content').insert(payload)
    else if (editing) await supabase.from('venue_content').update(payload).eq('id', editing.id)
    setSaving(false); setIsNew(false); setEditing(null); onRefresh()
  }
  const handleDelete = async (id: string) => { if (!confirm('¿Eliminar?')) return; await createClient().from('venue_content').delete().eq('id', id); onRefresh() }

  const SEASON_COLORS: Record<string, { bg: string; color: string; label: string }> = {
    alta:  { bg: '#fef3c7', color: '#92400e', label: '🔥 Temporada alta' },
    media: { bg: '#dbeafe', color: '#1e40af', label: '🌤 Temporada media' },
    baja:  { bg: '#dcfce7', color: '#166534', label: '❄️ Temporada baja' },
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Precios por época</div>
          <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Define los periodos del año y cómo afectan al precio.</div>
        </div>
        <button onClick={openNew} className="btn btn-primary btn-sm"><Plus size={12} /> Añadir época</button>
      </div>

      {(isNew || editing) && (
        <div className="card" style={{ padding: '16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>{isNew ? 'Nueva época' : 'Editar época'}</span>
            <button onClick={() => { setIsNew(false); setEditing(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}><X size={14} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tipo de temporada</label>
              <select className="form-input" value={form.season} onChange={e => setF('season', e.target.value)}>
                <option value="alta">Temporada alta</option>
                <option value="media">Temporada media</option>
                <option value="baja">Temporada baja</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Etiqueta *</label>
              <input className="form-input" value={form.label} onChange={e => setF('label', e.target.value)} placeholder="Ej: Junio – Septiembre" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Rango de fechas</label>
              <input className="form-input" value={form.date_range || ''} onChange={e => setF('date_range', e.target.value)} placeholder="Ej: 01 Jun – 30 Sep" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Modificador de precio</label>
              <input className="form-input" value={form.price_modifier || ''} onChange={e => setF('price_modifier', e.target.value)} placeholder="Ej: +20% o desde 8.000€" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Notas adicionales</label>
              <input className="form-input" value={form.notes || ''} onChange={e => setF('notes', e.target.value)} placeholder="Ej: Incluye viernes y sábados" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setIsNew(false); setEditing(null) }}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.label.trim()}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => {
          const cfg = SEASON_COLORS[item.season] || SEASON_COLORS['media']
          return (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff', border: '1px solid var(--ivory)', borderRadius: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: cfg.bg, color: cfg.color, flexShrink: 0 }}>{cfg.label}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>{item.label}</span>
                  {item.date_range && <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{item.date_range}</span>}
                  {item.price_modifier && <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 500 }}>{item.price_modifier}</span>}
                </div>
                {item.notes && <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{item.notes}</div>}
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={() => openEdit(item)} style={{ background: 'none', border: '1px solid var(--ivory)', borderRadius: 6, cursor: 'pointer', padding: '4px 8px' }}><Pencil size={11} /></button>
                <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', padding: '4px 8px', color: '#dc2626' }}><Trash2 size={11} /></button>
              </div>
            </div>
          )
        })}
        {items.length === 0 && !isNew && (
          <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 12 }}>
            <Calendar size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div>Configura los precios según la temporada del año</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Content: Exclusions ───────────────────────────────────────────────────────

function ExclusionsEditor({ items, userId, onRefresh }: { items: VenueExclusion[]; userId: string; onRefresh: () => void }) {
  const [editing, setEditing] = useState<VenueExclusion | null>(null)
  const [isNew,   setIsNew]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const empty = (): Omit<VenueExclusion, 'id'> => ({ title: '', description: '', sort_order: items.length })
  const [form, setForm] = useState(empty())
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const openNew  = () => { setForm(empty()); setIsNew(true); setEditing(null) }
  const openEdit = (item: VenueExclusion) => { setForm({ title: item.title, description: item.description || '', sort_order: item.sort_order }); setEditing(item); setIsNew(false) }

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'exclusion', sort_order: form.sort_order, is_active: true, data: { title: form.title, description: form.description } }
    if (isNew) await supabase.from('venue_content').insert(payload)
    else if (editing) await supabase.from('venue_content').update(payload).eq('id', editing.id)
    setSaving(false); setIsNew(false); setEditing(null); onRefresh()
  }
  const handleDelete = async (id: string) => { if (!confirm('¿Eliminar?')) return; await createClient().from('venue_content').delete().eq('id', id); onRefresh() }

  const COMMON = ['Catering externo no permitido', 'Música hasta las 00:00h', 'Sin alojamiento incluido', 'Fuegos artificiales no permitidos', 'Animales no permitidos', 'No se permite decoración propia']

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Qué no incluye</div>
          <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Exclusiones y restricciones del venue. Ayuda a evitar malentendidos.</div>
        </div>
        <button onClick={openNew} className="btn btn-primary btn-sm"><Plus size={12} /> Añadir</button>
      </div>

      {!isNew && (
        <div style={{ marginBottom: 14, padding: '14px 16px', background: 'var(--cream)', borderRadius: 10, border: '1px dashed var(--gold)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 10 }}>Exclusiones comunes — haz click para añadir:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {COMMON.filter(c => !items.some(i => i.title === c)).map(c => (
              <button key={c} type="button" onClick={async () => { await createClient().from('venue_content').insert({ user_id: userId, section: 'exclusion', sort_order: 0, is_active: true, data: { title: c, description: '' } }); onRefresh() }}
                style={{ fontSize: 11, padding: '5px 11px', borderRadius: 20, cursor: 'pointer', border: '1px solid var(--ivory)', background: '#fff', color: 'var(--charcoal)' }}>
                ✕ {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {(isNew || editing) && (
        <div className="card" style={{ padding: '16px', marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Exclusión *</label>
              <input className="form-input" value={form.title} onChange={e => setF('title', e.target.value)} placeholder="Ej: Catering externo no permitido" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Descripción adicional</label>
              <input className="form-input" value={form.description || ''} onChange={e => setF('description', e.target.value)} placeholder="Ej: Solo trabajamos con nuestro catering" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setIsNew(false); setEditing(null) }}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.title.trim()}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#fff', border: '1px solid var(--ivory)', borderRadius: 8 }}>
            <Ban size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)' }}>{item.title}</div>
              {item.description && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{item.description}</div>}
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={() => openEdit(item)} style={{ background: 'none', border: '1px solid var(--ivory)', borderRadius: 6, cursor: 'pointer', padding: '4px 8px' }}><Pencil size={11} /></button>
              <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', padding: '4px 8px', color: '#dc2626' }}><Trash2 size={11} /></button>
            </div>
          </div>
        ))}
        {items.length === 0 && !isNew && (
          <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 12 }}>
            <Ban size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div>Añade qué cosas no están incluidas o no están permitidas en tu venue</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Content: Photos Placeholder ───────────────────────────────────────────────

function PhotosPlaceholder({ type }: { type: 'hero' | 'gallery' }) {
  const isHero = type === 'hero'
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>{isHero ? 'Fotos principales' : 'Galería de fotos'}</div>
        <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>{isHero ? 'Imágenes destacadas que aparecen en la portada y cabecera de tu propuesta.' : 'Álbum completo del venue que se muestra en la galería de la propuesta.'}</div>
      </div>
      <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
        {isHero ? <ImageIcon size={36} style={{ color: 'var(--gold)', margin: '0 auto 16px', opacity: 0.6 }} /> : <Images size={36} style={{ color: 'var(--gold)', margin: '0 auto 16px', opacity: 0.6 }} />}
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, marginBottom: 8, color: 'var(--espresso)' }}>{isHero ? 'Fotos principales' : 'Galería de fotos'}</div>
        <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 16, maxWidth: 360, margin: '0 auto 20px', lineHeight: 1.7 }}>
          La gestión de fotos se realiza desde <strong>Mi ficha</strong>. Allí puedes subir, organizar y destacar las imágenes de tu venue.
        </div>
        <a href="/ficha" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 18px', borderRadius: 8, background: 'var(--gold)', color: '#fff', textDecoration: 'none', fontWeight: 500 }}>
          <ImageIcon size={13} /> Ir a Mi ficha
        </a>
      </div>
    </div>
  )
}

// ── Content: Collaborators ────────────────────────────────────────────────────

function CollaboratorsEditor({ items, userId, onRefresh }: { items: VenueCollaborator[]; userId: string; onRefresh: () => void }) {
  const [editing, setEditing] = useState<VenueCollaborator | null>(null)
  const [isNew,   setIsNew]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const empty = (): Omit<VenueCollaborator, 'id'> => ({ name: '', category: 'fotografia', description: '', website: '', sort_order: items.length })
  const [form, setForm] = useState(empty())
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const openNew  = () => { setForm(empty()); setIsNew(true); setEditing(null) }
  const openEdit = (item: VenueCollaborator) => { setForm({ name: item.name, category: item.category, description: item.description || '', website: item.website || '', sort_order: item.sort_order }); setEditing(item); setIsNew(false) }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'collaborator', sort_order: form.sort_order, is_active: true, data: { name: form.name, category: form.category, description: form.description, website: form.website } }
    if (isNew) await supabase.from('venue_content').insert(payload)
    else if (editing) await supabase.from('venue_content').update(payload).eq('id', editing.id)
    setSaving(false); setIsNew(false); setEditing(null); onRefresh()
  }
  const handleDelete = async (id: string) => { if (!confirm('¿Eliminar?')) return; await createClient().from('venue_content').delete().eq('id', id); onRefresh() }

  const CATEGORIES: Record<string, string> = { fotografia: '📷 Fotografía', video: '🎥 Vídeo', flores: '💐 Flores', musica: '🎵 Música y DJ', catering: '🍽️ Catering', otros: '✨ Otros' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Colaboradores</div>
          <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Proveedores y profesionales recomendados para el día de la boda.</div>
        </div>
        <button onClick={openNew} className="btn btn-primary btn-sm"><Plus size={12} /> Añadir colaborador</button>
      </div>

      {(isNew || editing) && (
        <div className="card" style={{ padding: '16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>{isNew ? 'Nuevo colaborador' : 'Editar colaborador'}</span>
            <button onClick={() => { setIsNew(false); setEditing(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}><X size={14} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Ej: Foto & Más Estudio" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Categoría</label>
              <select className="form-input" value={form.category} onChange={e => setF('category', e.target.value)}>
                {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Descripción</label>
              <input className="form-input" value={form.description || ''} onChange={e => setF('description', e.target.value)} placeholder="Ej: Especialistas en bodas íntimas" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Web / Instagram</label>
              <input className="form-input" value={form.website || ''} onChange={e => setF('website', e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setIsNew(false); setEditing(null) }}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.name.trim()}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {items.map(item => (
          <div key={item.id} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 4, display: 'block' }}>{CATEGORIES[item.category] || item.category}</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>{item.name}</div>
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={() => openEdit(item)} style={{ background: 'none', border: '1px solid var(--ivory)', borderRadius: 6, cursor: 'pointer', padding: '3px 7px' }}><Pencil size={11} /></button>
                <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', padding: '3px 7px', color: '#dc2626' }}><Trash2 size={11} /></button>
              </div>
            </div>
            {item.description && <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 4 }}>{item.description}</div>}
            {item.website && <a href={item.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none' }}>{item.website}</a>}
          </div>
        ))}
        {items.length === 0 && !isNew && (
          <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 12, gridColumn: '1 / -1' }}>
            <Users size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div>Añade fotógrafos, floristas, músicos y otros colaboradores recomendados</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Content: Extra Services ───────────────────────────────────────────────────

function ExtraServicesEditor({ items, userId, onRefresh }: { items: VenueExtraService[]; userId: string; onRefresh: () => void }) {
  const [editing, setEditing] = useState<VenueExtraService | null>(null)
  const [isNew,   setIsNew]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const empty = (): Omit<VenueExtraService, 'id'> => ({ name: '', description: '', price: '', sort_order: items.length })
  const [form, setForm] = useState(empty())
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const openNew  = () => { setForm(empty()); setIsNew(true); setEditing(null) }
  const openEdit = (item: VenueExtraService) => { setForm({ name: item.name, description: item.description || '', price: item.price || '', sort_order: item.sort_order }); setEditing(item); setIsNew(false) }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'extra_service', sort_order: form.sort_order, is_active: true, data: { name: form.name, description: form.description, price: form.price } }
    if (isNew) await supabase.from('venue_content').insert(payload)
    else if (editing) await supabase.from('venue_content').update(payload).eq('id', editing.id)
    setSaving(false); setIsNew(false); setEditing(null); onRefresh()
  }
  const handleDelete = async (id: string) => { if (!confirm('¿Eliminar?')) return; await createClient().from('venue_content').delete().eq('id', id); onRefresh() }

  const COMMON_EXTRAS = ['Hora extra de celebración', 'Fotomatón', 'Barra libre premium', 'Transporte para invitados', 'Decoración personalizada', 'Animación infantil', 'Suite nupcial extra', 'Fuegos artificiales']

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Servicios extra</div>
          <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Add-ons y upgrades que las parejas pueden añadir a su celebración.</div>
        </div>
        <button onClick={openNew} className="btn btn-primary btn-sm"><Plus size={12} /> Añadir servicio</button>
      </div>

      {!isNew && (
        <div style={{ marginBottom: 14, padding: '14px 16px', background: 'var(--cream)', borderRadius: 10, border: '1px dashed var(--gold)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 10 }}>Servicios habituales — haz click para añadir:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {COMMON_EXTRAS.filter(c => !items.some(i => i.name === c)).map(c => (
              <button key={c} type="button" onClick={async () => { await createClient().from('venue_content').insert({ user_id: userId, section: 'extra_service', sort_order: 0, is_active: true, data: { name: c, description: '', price: '' } }); onRefresh() }}
                style={{ fontSize: 11, padding: '5px 11px', borderRadius: 20, cursor: 'pointer', border: '1px solid var(--ivory)', background: '#fff', color: 'var(--charcoal)' }}>
                ✨ {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {(isNew || editing) && (
        <div className="card" style={{ padding: '16px', marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Servicio *</label>
              <input className="form-input" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Ej: Hora extra" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Descripción</label>
              <input className="form-input" value={form.description || ''} onChange={e => setF('description', e.target.value)} placeholder="Ej: Amplía la celebración una hora más" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Precio</label>
              <input className="form-input" value={form.price || ''} onChange={e => setF('price', e.target.value)} placeholder="Ej: 800€" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setIsNew(false); setEditing(null) }}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.name.trim()}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#fff', border: '1px solid var(--ivory)', borderRadius: 8 }}>
            <Sparkles size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)' }}>{item.name}</span>
                {item.price && <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>{item.price}</span>}
              </div>
              {item.description && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{item.description}</div>}
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={() => openEdit(item)} style={{ background: 'none', border: '1px solid var(--ivory)', borderRadius: 6, cursor: 'pointer', padding: '4px 8px' }}><Pencil size={11} /></button>
              <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', padding: '4px 8px', color: '#dc2626' }}><Trash2 size={11} /></button>
            </div>
          </div>
        ))}
        {items.length === 0 && !isNew && (
          <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 12 }}>
            <Sparkles size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div>Añade servicios opcionales que las parejas pueden contratar</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Content: Countdown ────────────────────────────────────────────────────────

function CountdownEditor({ item, userId, onRefresh }: { item: VenueCountdown | null; userId: string; onRefresh: () => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ days: item?.days ?? 7, message: item?.message ?? 'Esta propuesta estará disponible durante un tiempo limitado. ¡Asegura vuestra fecha antes de que sea demasiado tarde!' })
  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'countdown', sort_order: 0, is_active: true, data: { days: form.days, message: form.message } }
    if (item) await supabase.from('venue_content').update(payload).eq('id', item.id)
    else await supabase.from('venue_content').insert(payload)
    setSaving(false); onRefresh()
  }
  const handleDelete = async () => {
    if (!item || !confirm('¿Desactivar el countdown?')) return
    await createClient().from('venue_content').delete().eq('id', item.id)
    onRefresh()
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Countdown de propuesta</div>
        <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Muestra un contador de tiempo en la propuesta para incentivar una respuesta rápida.</div>
      </div>

      <div className="card" style={{ padding: '20px' }}>
        <div style={{ padding: '12px 16px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, marginBottom: 20, fontSize: 12, color: '#92400e' }}>
          ⏱️ <strong>Cómo funciona:</strong> Cuando envíes una propuesta, la pareja verá un contador regresivo con los días que tienen para responder. Cuando expire, el acceso a la propuesta puede limitarse.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, marginBottom: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Días para responder</label>
            <input className="form-input" type="number" min={1} max={30} value={form.days} onChange={e => setF('days', Number(e.target.value))} />
            <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 4 }}>Recomendado: 5–10 días</div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Mensaje que verá la pareja</label>
            <textarea className="form-textarea" style={{ minHeight: 80 }} value={form.message} onChange={e => setF('message', e.target.value)} />
          </div>
        </div>

        {/* Preview */}
        <div style={{ background: '#1a1a1a', borderRadius: 10, padding: '20px', marginBottom: 16, textAlign: 'center' }}>
          <div style={{ color: '#9ca3af', fontSize: 11, marginBottom: 8 }}>VISTA PREVIA</div>
          <div style={{ color: '#fff', fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>{form.message}</div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {['Días', 'Horas', 'Min', 'Seg'].map((unit, i) => (
              <div key={unit} style={{ textAlign: 'center' }}>
                <div style={{ background: 'var(--gold)', color: '#fff', borderRadius: 8, padding: '10px 14px', fontSize: 24, fontWeight: 700, minWidth: 56 }}>{i === 0 ? form.days : i === 1 ? '23' : i === 2 ? '59' : '59'}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{unit}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {item && <button className="btn btn-ghost" onClick={handleDelete} style={{ color: '#dc2626', borderColor: '#fca5a5' }}>Desactivar</button>}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : item ? 'Actualizar' : 'Activar countdown'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Content: Menu Price ───────────────────────────────────────────────────────

function MenuPriceEditor({ items, userId, onRefresh }: { items: VenueMenuPrice[]; userId: string; onRefresh: () => void }) {
  const [editing, setEditing] = useState<VenueMenuPrice | null>(null)
  const [isNew,   setIsNew]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const empty = (): Omit<VenueMenuPrice, 'id'> => ({ name: '', description: '', price_per_person: '', min_guests: undefined, sort_order: items.length })
  const [form, setForm] = useState(empty())
  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const openNew  = () => { setForm(empty()); setIsNew(true); setEditing(null) }
  const openEdit = (item: VenueMenuPrice) => { setForm({ name: item.name, description: item.description || '', price_per_person: item.price_per_person, min_guests: item.min_guests, sort_order: item.sort_order }); setEditing(item); setIsNew(false) }

  const handleSave = async () => {
    if (!form.name.trim() || !form.price_per_person.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'menu_price', sort_order: form.sort_order, is_active: true, data: { name: form.name, description: form.description, price_per_person: form.price_per_person, min_guests: form.min_guests } }
    if (isNew) await supabase.from('venue_content').insert(payload)
    else if (editing) await supabase.from('venue_content').update(payload).eq('id', editing.id)
    setSaving(false); setIsNew(false); setEditing(null); onRefresh()
  }
  const handleDelete = async (id: string) => { if (!confirm('¿Eliminar?')) return; await createClient().from('venue_content').delete().eq('id', id); onRefresh() }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Precio por menú</div>
          <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Opciones de menú con precio por persona. Se muestran en la propuesta y simulador.</div>
        </div>
        <button onClick={openNew} className="btn btn-primary btn-sm"><Plus size={12} /> Añadir menú</button>
      </div>

      {(isNew || editing) && (
        <div className="card" style={{ padding: '16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>{isNew ? 'Nuevo menú' : 'Editar menú'}</span>
            <button onClick={() => { setIsNew(false); setEditing(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}><X size={14} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nombre del menú *</label>
              <input className="form-input" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Ej: Menú clásico" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Precio por persona *</label>
              <input className="form-input" value={form.price_per_person} onChange={e => setF('price_per_person', e.target.value)} placeholder="Ej: 85€/p.p." />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Mín. invitados</label>
              <input className="form-input" type="number" value={form.min_guests || ''} onChange={e => setF('min_guests', Number(e.target.value) || undefined)} placeholder="Ej: 100" />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Descripción del menú</label>
            <textarea className="form-textarea" style={{ minHeight: 70 }} value={form.description || ''} onChange={e => setF('description', e.target.value)} placeholder="Ej: Entrantes variados, 2 platos principales a elegir, postre y bebidas incluidas" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setIsNew(false); setEditing(null) }}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.name.trim() || !form.price_per_person.trim()}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {items.map(item => (
          <div key={item.id} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>{item.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 14, color: 'var(--gold)', fontWeight: 700 }}>{item.price_per_person}</span>
                  {item.min_guests && <span style={{ fontSize: 11, color: 'var(--warm-gray)', background: 'var(--cream)', padding: '1px 7px', borderRadius: 8 }}>mín. {item.min_guests} inv.</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={() => openEdit(item)} style={{ background: 'none', border: '1px solid var(--ivory)', borderRadius: 6, cursor: 'pointer', padding: '3px 7px' }}><Pencil size={11} /></button>
                <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', padding: '3px 7px', color: '#dc2626' }}><Trash2 size={11} /></button>
              </div>
            </div>
            {item.description && <div style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.5 }}>{item.description}</div>}
          </div>
        ))}
        {items.length === 0 && !isNew && (
          <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 12, gridColumn: '1 / -1' }}>
            <UtensilsCrossed size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div>Añade las opciones de menú y su precio por persona</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Content: Budget Simulator ─────────────────────────────────────────────────

function BudgetSimulatorEditor({ item, userId, onRefresh }: { item: VenueBudgetSimulator | null; userId: string; onRefresh: () => void }) {
  const [saving, setSaving] = useState(false)
  const [guests, setGuests] = useState(150)
  const [form, setForm] = useState({ base_price: item?.base_price ?? '', price_per_person: item?.price_per_person ?? '', notes: item?.notes ?? '' })
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.base_price.trim() || !form.price_per_person.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'budget_simulator', sort_order: 0, is_active: true, data: { base_price: form.base_price, price_per_person: form.price_per_person, notes: form.notes } }
    if (item) await supabase.from('venue_content').update(payload).eq('id', item.id)
    else await supabase.from('venue_content').insert(payload)
    setSaving(false); onRefresh()
  }

  const base = parseFloat(form.base_price.replace(/[^0-9.]/g, '')) || 0
  const pp   = parseFloat(form.price_per_person.replace(/[^0-9.]/g, '')) || 0
  const total = base + (pp * guests)

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Simulación de presupuesto</div>
        <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Calculadora orientativa que se muestra en la propuesta para que la pareja estime el coste según sus invitados.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)', marginBottom: 14 }}>Configurar simulador</div>
          <div className="form-group">
            <label className="form-label">Precio base del venue (€)</label>
            <input className="form-input" value={form.base_price} onChange={e => setF('base_price', e.target.value)} placeholder="Ej: 3000" />
            <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 3 }}>Alquiler del espacio, independiente de invitados</div>
          </div>
          <div className="form-group">
            <label className="form-label">Precio por persona (€/p.p.)</label>
            <input className="form-input" value={form.price_per_person} onChange={e => setF('price_per_person', e.target.value)} placeholder="Ej: 85" />
            <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 3 }}>Catering y servicios por invitado</div>
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Notas del simulador</label>
            <textarea className="form-textarea" style={{ minHeight: 70 }} value={form.notes || ''} onChange={e => setF('notes', e.target.value)} placeholder="Ej: Precio orientativo, sujeto a personalización. Incluye catering básico." />
          </div>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.base_price.trim() || !form.price_per_person.trim()} style={{ width: '100%', justifyContent: 'center' }}>
            {saving ? 'Guardando...' : item ? 'Actualizar simulador' : 'Activar simulador'}
          </button>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)', marginBottom: 14 }}>Vista previa del simulador</div>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Número de invitados: <strong style={{ color: 'var(--gold)' }}>{guests}</strong></label>
            <input type="range" min={50} max={500} step={10} value={guests} onChange={e => setGuests(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--gold)', marginTop: 8 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--warm-gray)', marginTop: 2 }}>
              <span>50</span><span>500</span>
            </div>
          </div>
          <div style={{ background: 'var(--cream)', borderRadius: 10, padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 6 }}>
              <span>Precio base</span><span style={{ color: 'var(--charcoal)', fontWeight: 500 }}>{base.toLocaleString('es-ES')}€</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 10 }}>
              <span>{guests} invitados × {pp.toLocaleString('es-ES')}€</span><span style={{ color: 'var(--charcoal)', fontWeight: 500 }}>{(pp * guests).toLocaleString('es-ES')}€</span>
            </div>
            <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>Total estimado</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)', fontFamily: 'Cormorant Garamond, serif' }}>{total.toLocaleString('es-ES')}€</span>
            </div>
            {form.notes && <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 8, lineHeight: 1.5 }}>* {form.notes}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Content: Conditions ───────────────────────────────────────────────────────

function ConditionsEditor({ item, userId, onRefresh }: { item: VenueConditions | null; userId: string; onRefresh: () => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: item?.title || 'Condiciones de reserva', body: item?.body || '' })
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.body.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'conditions', sort_order: 0, is_active: true, data: { title: form.title, body: form.body } }
    if (item) await supabase.from('venue_content').update(payload).eq('id', item.id)
    else await supabase.from('venue_content').insert(payload)
    setSaving(false); onRefresh()
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Condiciones</div>
        <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Términos, política de reserva y condiciones generales que se muestran al final de la propuesta.</div>
      </div>
      <div className="card" style={{ padding: '20px' }}>
        <div className="form-group">
          <label className="form-label">Título de la sección</label>
          <input className="form-input" value={form.title} onChange={e => setF('title', e.target.value)} placeholder="Ej: Condiciones de reserva" />
        </div>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Condiciones *</label>
            <span style={{ fontSize: 10, color: 'var(--stone)' }}>{form.body.length} caracteres</span>
          </div>
          <textarea className="form-textarea" style={{ minHeight: 240, fontFamily: 'monospace', fontSize: 12 }} value={form.body} onChange={e => setF('body', e.target.value)}
            placeholder={`Ej:\n\n1. SEÑAL Y RESERVA\nPara confirmar la reserva de la fecha se requiere el pago de una señal del 20% del presupuesto total.\n\n2. CANCELACIÓN\nEn caso de cancelación con menos de 6 meses de antelación, la señal no será reembolsable.\n\n3. CAPACIDAD\nEl venue tiene una capacidad máxima de X invitados.\n\n4. HORARIO\nLa celebración finalizará a las 05:00h. Cualquier extensión deberá acordarse previamente.`} />
        </div>
        <div style={{ padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#0369a1' }}>
          💡 <strong>Consejo:</strong> Sé claro y conciso. Incluye política de cancelación, señal mínima, horario máximo y cualquier restricción importante.
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.body.trim()}>
          {saving ? 'Guardando...' : item ? 'Actualizar condiciones' : 'Guardar condiciones'}
        </button>
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
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, marginBottom: 8 }}>Sin dossiers</div>
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
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 19, color: 'var(--espresso)' }}>Enviar dossier</div>
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
// ── Content: Video del venue ───────────────────────────────────────────────────

function VenueVideoEditor({ item, userId, onRefresh }: { item: VenueVideoSection | null; userId: string; onRefresh: () => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ url: item?.url || '', title: item?.title || '' })

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'video_default', sort_order: 0, is_active: true, data: { url: form.url.trim(), title: form.title.trim() } }
    if (item?.id) await supabase.from('venue_content').update(payload).eq('id', item.id)
    else await supabase.from('venue_content').insert(payload)
    setSaving(false); onRefresh()
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Vídeo del venue</div>
        <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Un vídeo de YouTube o Vimeo que se muestra en las propuestas enviadas.</div>
      </div>
      <div className="card" style={{ padding: '20px' }}>
        <div className="form-group">
          <label className="form-label">URL del vídeo *</label>
          <input className="form-input" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://www.youtube.com/watch?v=..." />
          <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>Soporta YouTube y Vimeo</div>
        </div>
        <div className="form-group">
          <label className="form-label">Título de la sección (opcional)</label>
          <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Conoce nuestro venue" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.url.trim()}>
            {saving ? 'Guardando...' : item?.id ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Content: Ficha técnica ─────────────────────────────────────────────────────

function VenueTechspecsEditor({ item, userId, onRefresh }: { item: VenueTechspecs | null; userId: string; onRefresh: () => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    sqm:             item?.sqm || '',
    ceiling:         item?.ceiling || '',
    parking:         item?.parking || '',
    accessibility:   item?.accessibility || '',
    ceremony_spaces: item?.ceremony_spaces || '',
    extra:           item?.extra || '',
  })
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'techspecs', sort_order: 0, is_active: true, data: form }
    if (item?.id) await supabase.from('venue_content').update(payload).eq('id', item.id)
    else await supabase.from('venue_content').insert(payload)
    setSaving(false); onRefresh()
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Ficha técnica</div>
        <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Datos técnicos del venue que aparecen en la sección de ficha de las propuestas.</div>
      </div>
      <div className="card" style={{ padding: '20px' }}>
        <div className="two-col">
          {([
            ['sqm',             'Superficie (m²)',       'Ej: 800 m²'],
            ['ceiling',         'Altura del techo',      'Ej: 6 m'],
            ['parking',         'Parking',               'Ej: 200 plazas gratuitas'],
            ['accessibility',   'Accesibilidad',         'Ej: Acceso para silla de ruedas'],
            ['ceremony_spaces', 'Espacios de ceremonia', 'Ej: Jardín, capilla interior'],
            ['extra',           'Otros datos',           'Ej: Generador propio, wifi...'],
          ] as [string, string, string][]).map(([k, label, ph]) => (
            <div className="form-group" key={k}>
              <label className="form-label">{label}</label>
              <input className="form-input" value={(form as any)[k]} onChange={e => setF(k, e.target.value)} placeholder={ph} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : item?.id ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Content: Alojamiento ───────────────────────────────────────────────────────

function VenueAccommodationEditor({ item, userId, onRefresh }: { item: VenueAccommodationInfo | null; userId: string; onRefresh: () => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    rooms:       item?.rooms || '',
    description: item?.description || '',
    price_info:  item?.price_info || '',
    nearby:      item?.nearby || '',
  })
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'accommodation_info', sort_order: 0, is_active: true, data: form }
    if (item?.id) await supabase.from('venue_content').update(payload).eq('id', item.id)
    else await supabase.from('venue_content').insert(payload)
    setSaving(false); onRefresh()
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Alojamiento</div>
        <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Información sobre alojamiento propio o cercano para los invitados.</div>
      </div>
      <div className="card" style={{ padding: '20px' }}>
        <div className="two-col">
          {([
            ['rooms',       'Habitaciones propias',  'Ej: 12 habitaciones dobles'],
            ['price_info',  'Precios orientativos',  'Ej: Desde 120 EUR/noche'],
            ['description', 'Descripción',           'Describe el alojamiento del venue...'],
            ['nearby',      'Hoteles cercanos',      'Ej: Hotel Palacio a 2 km'],
          ] as [string, string, string][]).map(([k, label, ph]) => (
            <div className="form-group" key={k}>
              <label className="form-label">{label}</label>
              <input className="form-input" value={(form as any)[k]} onChange={e => setF(k, e.target.value)} placeholder={ph} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : item?.id ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Content: Mapa y cómo llegar ────────────────────────────────────────────────

function VenueMapEditor({ item, userId, onRefresh }: { item: VenueMapInfo | null; userId: string; onRefresh: () => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    embed_url: item?.embed_url || '',
    address:   item?.address || '',
    notes:     item?.notes || '',
  })
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'map_info', sort_order: 0, is_active: true, data: form }
    if (item?.id) await supabase.from('venue_content').update(payload).eq('id', item.id)
    else await supabase.from('venue_content').insert(payload)
    setSaving(false); onRefresh()
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Mapa y cómo llegar</div>
        <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Incrusta un mapa de Google Maps con dirección y notas de acceso en las propuestas.</div>
      </div>
      <div className="card" style={{ padding: '20px' }}>
        <div className="form-group">
          <label className="form-label">URL embed de Google Maps</label>
          <input className="form-input" value={form.embed_url} onChange={e => setF('embed_url', e.target.value)} placeholder="https://www.google.com/maps/embed?pb=..." />
          <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>Google Maps → Compartir → Insertar mapa → copia la URL del atributo src del iframe</div>
        </div>
        <div className="two-col">
          <div className="form-group">
            <label className="form-label">Dirección completa</label>
            <input className="form-input" value={form.address} onChange={e => setF('address', e.target.value)} placeholder="Calle Ejemplo 10, 28001 Madrid" />
          </div>
          <div className="form-group">
            <label className="form-label">Notas de acceso</label>
            <input className="form-input" value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Ej: Salida 14 de la A-6" />
          </div>
        </div>
        {form.embed_url && (
          <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--ivory)' }}>
            <iframe src={form.embed_url} width="100%" height="200" style={{ border: 0, display: 'block' }} loading="lazy" />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : item?.id ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Content: Chat / Formulario de preguntas ────────────────────────────────────

function VenueChatEditor({ item, userId, onRefresh }: { item: VenueChatSettings | null; userId: string; onRefresh: () => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    enabled:    item?.enabled ?? false,
    intro_text: item?.intro_text || 'Escríbenos tu pregunta y te respondemos en menos de 24 horas.',
  })

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, section: 'chat_settings', sort_order: 0, is_active: true, data: form }
    if (item?.id) await supabase.from('venue_content').update(payload).eq('id', item.id)
    else await supabase.from('venue_content').insert(payload)
    setSaving(false); onRefresh()
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Formulario de preguntas</div>
        <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Permite a las parejas enviarte preguntas directamente desde la propuesta web.</div>
      </div>
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer' }} onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}>
          <span style={{ color: form.enabled ? 'var(--gold)' : 'var(--stone)' }}>
            {form.enabled ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: form.enabled ? 'var(--espresso)' : 'var(--warm-gray)' }}>
              {form.enabled ? 'Formulario activado' : 'Formulario desactivado'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--stone)' }}>Las parejas podrán enviarte preguntas desde la propuesta</div>
          </div>
        </div>
        {form.enabled && (
          <div className="form-group">
            <label className="form-label">Texto introductorio</label>
            <input className="form-input" value={form.intro_text} onChange={e => setForm(f => ({ ...f, intro_text: e.target.value }))} placeholder="Escríbenos tu pregunta..." />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : item?.id ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

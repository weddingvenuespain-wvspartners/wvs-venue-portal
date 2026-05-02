// Plantillas por defecto: 5 estilos visuales (T1–T5) con datos ricos de ejemplo.
// Sirven a la vez como:
//   • Muestras estáticas en /proposals/templates (no se borran ni se modifican)
//   • Starter al crear una propuesta nueva (En blanco + 5 plantillas)
// Comparten el mismo contenido (Finca Son Vell). Lo que cambia es el
// visual_template_id y el branding (color_mode/primary/secondary/font).

import type { SectionsData } from './proposal-types'

export type DefaultTemplateId = 't1' | 't2' | 't3' | 't4' | 't5'

// Nombre de icono lucide-react que el componente resuelve vía lookup.
export type DefaultTemplateIcon = 'zap' | 'sparkles' | 'clipboard-list' | 'message-circle' | 'target'

export type DefaultTemplate = {
  id: DefaultTemplateId
  name: string
  description: string
  icon: DefaultTemplateIcon
  is_default: boolean             // primero de la lista (sólo uno) — al duplicar se marca is_default
  couple_name: string
  guest_count: number
  personal_message: string
  price_estimate: number
  show_availability: boolean
  show_price_estimate: boolean
  branding: { primary_color: string; font_family: string }
  sections_data: SectionsData
}

// ── Contenido base compartido (Finca Son Vell — catering completo) ────────────
const BASE_PROPOSAL = {
  couple_name: 'Sofía & Alejandro',
  guest_count: 150,
  personal_message: 'Queridos Sofía y Alejandro, ha sido un placer recibiros en la finca. Aquí tenéis nuestra propuesta completa, con todo el cariño que merece vuestro día.',
  price_estimate: 23500,
  show_availability: true,
  show_price_estimate: true,
}

const BASE_SECTIONS: SectionsData = {
  has_catering: true,
  iva_included: false,
  availability_message: 'Fecha confirmada · Última disponibilidad en junio',
  sections_enabled: {
    hero: true, availability: true, welcome: true, experience: true,
    gallery: true, zones: true, venue_rental: false, inclusions: true,
    testimonials: true, collaborators: true, accommodation: true,
    extra_services: true, faq: true, map: true, contact: true,
  },
  contact: {
    phone: '+34 600 123 456',
    email: 'hola@tuvenue.com',
  },
  experience_override: {
    title: 'Finca Son Vell — Tradición mallorquina desde 1687',
    body: 'Finca centenaria a 20 minutos de Palma, rodeada de olivares y montañas de Tramuntana. Ofrecemos una experiencia gastronómica completa con producto local y bodega propia. Un equipo con más de 15 años creando bodas memorables.',
  },
  zones_override: [
    {
      name: 'La Capella',
      description: 'Capilla de piedra del siglo XVII rodeada de cipreses centenarios.',
      capacities: [{ type: 'ceremony', count: 200 }],
      sqm: 190, covered: 'indoor', plan_b: false,
    },
    {
      name: 'Jardí de les Oliveres',
      description: 'Jardín con olivos centenarios, palmeras y fuentes. Vistas a Tramuntana.',
      capacities: [
        { type: 'cocktail', count: 280 },
        { type: 'banquet', count: 180 },
      ],
      sqm: 1000, covered: 'outdoor',
    },
    {
      name: 'Sala Principal',
      description: 'Sala de banquetes con techos abovedados, arcos de piedra y vigas del siglo XVIII.',
      capacities: [
        { type: 'cocktail', count: 300 },
        { type: 'banquet', count: 250 },
      ],
      sqm: 340, covered: 'indoor', climatized: true, plan_b: true,
    },
  ],
  inclusions_override: [
    { icon: 'chef-hat', title: 'Chef ejecutivo', description: 'Menús personalizables con producto local de temporada.' },
    { icon: 'wine', title: 'Bodega propia', description: 'Maridaje de autor con vinos mallorquines incluido.' },
    { icon: 'users', title: 'Equipo de servicio', description: '1 camarero cada 12 invitados durante todo el evento.' },
    { icon: 'music', title: 'Equipo de sonido', description: 'Sonido ambiental en ceremonia, cóctel y banquete.' },
    { icon: 'armchair', title: 'Mobiliario completo', description: 'Mesas, sillas Chiavari y menaje premium.' },
    { icon: 'sparkles', title: 'Coordinación del evento', description: 'Wedding planner dedicada 3 meses antes del evento.' },
  ],
  menus_override: [
    {
      id: 'm-1', name: 'Menú Oliveres', price_per_person: '95 €', min_guests: 80,
      subtitle: '4 pases + postre · Maridaje incluido',
      courses: [
        {
          label: 'Aperitivo (cóctel)', mode: 'fixed',
          items: [
            { name: 'Tartar de atún rojo sobre tosta de pan de payés' },
            { name: 'Croquetas de sobrasada y miel' },
            { name: 'Brocheta de pulpo a la brasa con alioli de ajo negro' },
          ],
        },
        {
          label: 'Primer plato', mode: 'pick_one',
          items: [
            { name: 'Arroz caldoso de bogavante' },
            { name: 'Canelones de rustido tradicional' },
          ],
        },
        {
          label: 'Plato principal', mode: 'pick_one',
          items: [
            { name: 'Cordero lechal al horno con patatas panaderas' },
            { name: 'Lubina salvaje al horno con verduras de temporada' },
            { name: 'Solomillo de Girona con salsa al Porto y foie poêlé', extra_price: '8 €' },
          ],
        },
        {
          label: 'Postre', mode: 'pick_one',
          items: [
            { name: 'Coulant de chocolate con helado de vainilla' },
            { name: 'Tarta de queso mallorquín con frutos rojos' },
          ],
        },
      ],
    },
    {
      id: 'm-2', name: 'Menú Tramuntana', price_per_person: '125 €', min_guests: 80,
      subtitle: '6 pases + tabla de quesos + postre · Sommelier incluido',
    },
    {
      id: 'm-3', name: 'Menú Son Vell', price_per_person: '165 €', min_guests: 100,
      subtitle: 'Experiencia de autor 8 pases · Maridaje premium',
    },
  ],
  menu_extras_override: [
    { id: 'x-1', category: 'station', name: 'Estación de ostras', description: 'Ostras abiertas al momento. 2 uds. por persona.', price: '20 €', price_type: 'per_person' },
    { id: 'x-2', category: 'station', name: 'Estación de foie', description: 'Foie poêlé con mermeladas y tostas.', price: '12 €', price_type: 'per_person' },
    { id: 'x-3', category: 'resopon', name: 'Mini hamburguesas y hot dogs', description: 'Resopón a partir de las 2:00 AM.', price: '10 €', price_type: 'per_person' },
    { id: 'x-4', category: 'resopon', name: 'Focaccia Son Vell', description: 'Focaccia recién horneada con toppings variados.', price: '8 €', price_type: 'per_person' },
    { id: 'x-5', category: 'ceremony', name: 'Ceremonia civil en jardín', description: 'Montaje de sillas, decoración base y mesa para oficiante.', price: '1.500 €', price_type: 'flat' },
    { id: 'x-6', category: 'ceremony', name: 'Ceremonia religiosa en La Capella', description: 'Tasa por uso del espacio consagrado.', price: '1.800 €', price_type: 'flat' },
    { id: 'x-7', category: 'music', name: 'Pack música (DJ + 3h)', description: 'DJ desde la ceremonia hasta 3h de barra.', price: '1.500 €', price_type: 'flat' },
    { id: 'x-8', category: 'music', name: 'Hora extra open bar', description: 'Por persona, 80% de los invitados.', price: '18 €', price_type: 'per_person' },
    { id: 'x-9', category: 'audiovisual', name: 'Iluminación decorativa', description: 'Spotlight de color en la terraza principal.', price: '700 €', price_type: 'flat' },
  ],
  appetizers_base_override: [
    { label: 'Aperitivos fríos', items: ['Pa amb oli con jamón serrano', 'Gazpacho de sandía', 'Tartar de salmón sobre blini'] },
    { label: 'Aperitivos calientes', items: ['Croquetas de jamón ibérico', 'Buñuelos de bacalao', 'Mini empanadillas de sobrasada'] },
  ],
  testimonials_override: [
    { couple_name: 'Anna & Guillem', wedding_date: '2024-07-20', text: 'La gastronomía fue el momento estrella de la boda. Todos nuestros invitados aún hablan del menú maridado. El equipo, diez sobre diez.', rating: 5 },
    { couple_name: 'María & Joan', wedding_date: '2024-09-07', text: 'Profesionales de principio a fin. Desde el primer contacto hasta el último brindis, todo perfecto. La finca es mágica y el catering de alta cocina.', rating: 5 },
    { couple_name: 'Isabel & Lucas', wedding_date: '2024-05-25', text: 'La capilla al atardecer y el banquete bajo los olivos. Una experiencia sensorial completa.', rating: 5 },
  ],
  collaborators_override: [
    { category: 'Flores', name: 'Flors de Mallorca', description: 'Composiciones florales mediterráneas con producto local.' },
    { category: 'Música', name: 'Duet Son Vell', description: 'Violín y piano para ceremonia y cóctel.' },
    { category: 'Foto', name: 'Pere Colom Photography', description: 'Reportaje editorial documental.' },
    { category: 'Vídeo', name: 'Mallorca Wedding Films', description: 'Cinematografía de bodas en 4K.' },
  ],
  accommodation: {
    description: 'La finca dispone de 8 habitaciones renovadas con arte mallorquín contemporáneo.',
    rooms: '1 Suite Nupcial · 4 Suites dobles · 2 Habitaciones premium · 1 Habitación de cortesía',
    options: [
      { label: 'Noche de bodas (pareja)', description: 'Suite Nupcial con desayuno en habitación.', included: true },
      { label: 'Suite Nupcial individual', description: 'Noche extra pre o post boda.', prices: [{ season: 'Todo el año', price: '380 € / noche' }] },
      { label: 'Habitación doble', prices: [{ season: 'Temporada baja', price: '220 € / noche' }, { season: 'Temporada alta', price: '320 € / noche' }] },
    ],
    nearby: 'Hotel Son Brull (10 min), Castell Son Claret (15 min).',
  },
  extra_services_override: [
    { name: 'Transporte invitados', price: '1.200 €', description: 'Autobús Palma–Finca ida y vuelta.' },
    { name: 'Cabina de fotos', price: '800 €', description: 'Photo booth con atrezzo para toda la noche.' },
    { name: 'Barra premium', price: '22 €', description: 'Por persona. Ginebras premium, cocktails de autor.' },
  ],
  faq_override: [
    { question: '¿Se puede cambiar el menú?', answer: 'Sí, cada menú es personalizable. Podemos adaptar platos a alergias, preferencias dietéticas y vegetarianos/veganos.' },
    { question: '¿Cuándo hacemos la cata del menú?', answer: 'Dos meses antes de la boda. Incluye a la pareja y un acompañante.' },
    { question: '¿Hay menú infantil?', answer: 'Sí, menú adaptado para niños hasta 12 años al 50% del precio adulto.' },
    { question: '¿Hasta qué hora podemos estar?', answer: 'Hasta las 03:00. Ampliaciones según normativa y coste adicional.' },
  ],
}

// Helper: combina BASE_SECTIONS con el branding visual de cada plantilla.
function styled(visual_template_id: 1 | 2 | 3 | 4 | 5, color_mode: 'light' | 'dark', primary: string, secondary: string, font: string): SectionsData {
  return {
    ...BASE_SECTIONS,
    visual_template_id,
    color_mode,
    primary_color: primary,
    secondary_color: secondary,
    font_family: font,
  }
}

// ── Las 5 plantillas por defecto ──────────────────────────────────────────────
export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    id: 't1',
    name: 'Impacto Directo',
    description: 'Dark luxury · precio visible · CTA al frente',
    icon: 'zap',
    is_default: true,
    ...BASE_PROPOSAL,
    branding: { primary_color: '#C4975A', font_family: "'Cormorant Garamond', serif" },
    sections_data: styled(1, 'dark', '#C4975A', '#8B6914', "'Cormorant Garamond', serif"),
  },
  {
    id: 't2',
    name: 'Emoción Primero',
    description: 'Cream editorial · galería arriba · emotivo',
    icon: 'sparkles',
    is_default: false,
    ...BASE_PROPOSAL,
    branding: { primary_color: '#8B6914', font_family: "'Cormorant Garamond', serif" },
    sections_data: styled(2, 'light', '#8B6914', '#C4975A', "'Cormorant Garamond', serif"),
  },
  {
    id: 't3',
    name: 'Todo Claro',
    description: 'Sidebar + índice · estructurado',
    icon: 'clipboard-list',
    is_default: false,
    ...BASE_PROPOSAL,
    branding: { primary_color: '#2D4A3A', font_family: "'Inter', sans-serif" },
    sections_data: styled(3, 'light', '#2D4A3A', '#5A7A6A', "'Inter', sans-serif"),
  },
  {
    id: 't4',
    name: 'Social Proof',
    description: 'Stats + testimonios · confianza',
    icon: 'message-circle',
    is_default: false,
    ...BASE_PROPOSAL,
    branding: { primary_color: '#4A5C8A', font_family: "'Inter', sans-serif" },
    sections_data: styled(4, 'light', '#4A5C8A', '#8FA1C7', "'Inter', sans-serif"),
  },
  {
    id: 't5',
    name: 'Minimalista',
    description: 'Limpio · CTA muy prominente',
    icon: 'target',
    is_default: false,
    ...BASE_PROPOSAL,
    branding: { primary_color: '#1A1A1A', font_family: "'Cormorant Garamond', serif" },
    sections_data: styled(5, 'light', '#1A1A1A', '#666666', "'Cormorant Garamond', serif"),
  },
]

export function getDefaultTemplate(id: string | null): DefaultTemplate | null {
  return DEFAULT_TEMPLATES.find(t => t.id === id) ?? null
}

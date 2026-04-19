// Starter templates para nuevas propuestas.
// El usuario elige una de estas al crear una propuesta nueva; el contenido se
// vuelca en sections_data como punto de partida editable.

import type { SectionsData } from './proposal-types'

export type StarterTemplateId = 'venue' | 'full'

// Nombre de icono lucide-react que el componente resuelve vía lookup.
export type StarterTemplateIcon = 'building-2' | 'utensils-crossed'

export type StarterTemplate = {
  id: StarterTemplateId
  label: string
  description: string
  icon: StarterTemplateIcon
  couple_name: string
  guest_count: number
  personal_message: string
  price_estimate: number
  show_availability: boolean
  show_price_estimate: boolean
  branding: { primary_color: string; font_family: string }
  sections_data: SectionsData
}

// ── Starter: Solo venue (alquiler del espacio, sin catering) ──────────────────
const VENUE: StarterTemplate = {
  id: 'venue',
  label: 'Solo venue',
  description: 'Alquiler del espacio sin catering ni menús.',
  icon: 'building-2',
  couple_name: 'Marina & David',
  guest_count: 120,
  personal_message: 'Queridos Marina y David, gracias por confiar en nosotros. Hemos preparado esta propuesta pensando en vuestro día especial.',
  price_estimate: 8500,
  show_availability: true,
  show_price_estimate: true,
  branding: { primary_color: '#2D4A3A', font_family: "'Cormorant Garamond', serif" },
  sections_data: {
    visual_template_id: 1,
    has_catering: false,
    iva_included: false,
    availability_message: 'Fecha confirmada · Reserva prioritaria 72h',
    sections_enabled: {
      hero: true, availability: true, welcome: true, experience: true,
      gallery: true, zones: true, venue_rental: true, inclusions: true,
      testimonials: true, collaborators: true, accommodation: true,
      extra_services: true, faq: true, map: true, contact: true,
    },
    experience_override: {
      title: 'Una masía del siglo XVIII frente al mar',
      body: 'Villa Mar Blau es una finca histórica en la Costa Brava con 200 años de historia. Rodeada de pinos, con vistas al mar y jardines botánicos centenarios, ofrece un escenario único para celebraciones íntimas y elegantes. Cada boda es la única del día.',
    },
    zones_override: [
      {
        name: 'Jardín del Mar',
        description: 'Jardín principal con vistas panorámicas al Mediterráneo. Ceremonia entre pinos y buganvillas.',
        capacities: [
          { type: 'ceremony', count: 150 },
          { type: 'cocktail', count: 180 },
        ],
        sqm: 800, covered: 'outdoor', plan_b: true,
      },
      {
        name: 'Terraza Principal',
        description: 'Terraza de piedra con pérgola de hierro forjado. Ideal para cóctel de bienvenida y banquete al atardecer.',
        capacities: [
          { type: 'cocktail', count: 160 },
          { type: 'banquet', count: 130 },
        ],
        sqm: 450, covered: 'covered-outdoor',
      },
      {
        name: 'Sala Histórica',
        description: 'Salón interior con techos abovedados del siglo XVIII y lámparas de cristal. Plan B climatizado.',
        capacities: [
          { type: 'banquet', count: 120 },
          { type: 'party', count: 140 },
        ],
        sqm: 220, covered: 'indoor', climatized: true, plan_b: true,
      },
    ],
    venue_rental: {
      title: 'Tarifas de alquiler',
      day_tiers: ['Sábados y festivos', 'Viernes y domingos', 'Lunes a jueves'],
      rows: [
        { season: 'Mayo, Junio, Septiembre, Octubre', prices: ['7.500 €', '5.500 €', '4.000 €'] },
        { season: 'Julio, Agosto', prices: ['9.000 €', '6.500 €', '5.000 €'] },
        { season: 'Noviembre a Abril', prices: ['5.000 €', '3.500 €', '2.500 €'] },
      ],
      notes: '*21% IVA no incluido. Incluye montaje y desmontaje.',
    },
    inclusions_override: [
      { icon: 'key', title: 'Exclusividad total', description: 'Una sola boda al día. La finca es solo vuestra durante 14 horas.' },
      { icon: 'clock', title: '14 horas de uso', description: 'Desde las 10:00 hasta las 00:00 (ampliable).' },
      { icon: 'armchair', title: 'Mobiliario incluido', description: 'Mesas y sillas Chiavari para hasta 180 invitados.' },
      { icon: 'users', title: 'Coordinador de espacio', description: 'Un responsable de la finca durante todo el evento.' },
      { icon: 'sparkles', title: 'Limpieza post-evento', description: 'Incluida en la tarifa base.' },
      { icon: 'lightbulb', title: 'Iluminación ambiental', description: 'Iluminación decorativa y técnica básica.' },
    ],
    testimonials_override: [
      { couple_name: 'Laura & Marc', wedding_date: '2024-09-14', text: 'El lugar perfecto. La atención del equipo fue impecable desde el primer día. Nuestros invitados aún hablan del atardecer.', rating: 5 },
      { couple_name: 'Elena & Pablo', wedding_date: '2024-06-22', text: 'Profesionales en todos los sentidos. Flexibilidad, cariño y un espacio mágico. Lo recomendamos sin dudarlo.', rating: 5 },
      { couple_name: 'Clara & Iván', wedding_date: '2024-05-18', text: 'Todo fluyó como habíamos soñado. El jardín del mar al atardecer es simplemente espectacular.', rating: 5 },
    ],
    collaborators_override: [
      { category: 'Catering', name: 'Catering Maremoto', description: 'Producto de proximidad y cocina mediterránea.' },
      { category: 'Catering', name: 'La Cava del Empordà', description: 'Propuestas de autor con maridaje.' },
      { category: 'Flores', name: 'Petal & Co', description: 'Estilismo floral natural e informal.' },
      { category: 'Música', name: 'Son de Mar DJ', description: 'DJ + ceremonia con música en vivo.' },
      { category: 'Foto', name: 'Nuria Serrat', description: 'Fotografía documental y reportaje editorial.' },
    ],
    accommodation: {
      description: 'La finca cuenta con alojamiento opcional para la pareja y familiares directos. 5 habitaciones dobles con baño privado.',
      rooms: '1 Suite nupcial · 4 Habitaciones dobles · 2 Habitaciones familiares',
      options: [
        { label: 'Suite nupcial', description: 'Noche de bodas con vistas al mar y desayuno.', included: true },
        { label: 'Habitación doble', prices: [{ season: 'Temporada baja', price: '150 € / noche' }, { season: 'Temporada alta', price: '220 € / noche' }] },
      ],
      nearby: 'Hotel Ses Illes (5 min), Aiguablava Beach Resort (10 min).',
    },
    extra_services_override: [
      { name: 'Haima beduina', price: '1.800 €', description: 'Carpa decorativa 6x6m para cóctel o zona chill-out.' },
      { name: 'Iluminación guirnaldas', price: '950 €', description: 'Guirnaldas de bombillas vintage en terraza y jardín.' },
      { name: 'Servicio de parking', price: '400 €', description: 'Dos operarios durante 6 horas.' },
      { name: 'Hora extra', price: '600 €', description: 'Ampliación del evento por hora adicional.' },
    ],
    faq_override: [
      { question: '¿Cuántas bodas celebráis al día?', answer: 'Solo una. La finca es exclusivamente vuestra durante todo el día del evento.' },
      { question: '¿Se puede celebrar la ceremonia en la finca?', answer: 'Sí, el Jardín del Mar tiene licencia para celebrar ceremonias civiles.' },
      { question: '¿Hay plan B en caso de lluvia?', answer: 'Sí, la Sala Histórica tiene capacidad para 120 invitados y está climatizada.' },
      { question: '¿Hay limitación de horario?', answer: 'La música debe finalizar a las 00:00 por normativa municipal. Podéis ampliar con barra libre hasta las 02:00.' },
    ],
  },
}

// ── Starter: Con catering (venue + catering completo + menús) ────────────────
const FULL: StarterTemplate = {
  id: 'full',
  label: 'Con catering',
  description: 'Venue + catering completo con menús estructurados y extras.',
  icon: 'utensils-crossed',
  couple_name: 'Sofía & Alejandro',
  guest_count: 150,
  personal_message: 'Queridos Sofía y Alejandro, ha sido un placer recibiros en la finca. Aquí tenéis nuestra propuesta completa, con todo el cariño que merece vuestro día.',
  price_estimate: 23500,
  show_availability: true,
  show_price_estimate: true,
  branding: { primary_color: '#8B6914', font_family: "'Cormorant Garamond', serif" },
  sections_data: {
    visual_template_id: 1,
    has_catering: true,
    iva_included: false,
    availability_message: 'Fecha confirmada · Última disponibilidad en junio',
    sections_enabled: {
      hero: true, availability: true, welcome: true, experience: true,
      gallery: true, zones: true, venue_rental: false, inclusions: true,
      testimonials: true, collaborators: true, accommodation: true,
      extra_services: true, faq: true, map: true, contact: true,
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
  },
}

export const STARTER_TEMPLATES: StarterTemplate[] = [VENUE, FULL]

export function getStarterTemplate(id: string | null): StarterTemplate | null {
  return STARTER_TEMPLATES.find(t => t.id === id) ?? null
}

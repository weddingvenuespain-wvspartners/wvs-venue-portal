// /dossier/templates/[id]/preview — renders the template as a fake proposal.
// Used as the iframe src in TemplateEditor for live preview via postMessage,
// y también para los thumbnails del listado de plantillas.
//
// Dos modos:
//   • id ∈ {t1..t5}: muestra estática. No requiere auth ni queries — datos
//     vienen 100% del array DEFAULT_TEMPLATES + venue stub "Finca Son Vell".
//   • id = UUID: plantilla del usuario. Requiere auth + lookup en BD y trae
//     venue/branding/content de la cuenta para que el preview sea real.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import ProposalLanding from '@/app/dossier/[slug]/ProposalLanding'
import type { ProposalData, VenueContent } from '@/app/dossier/[slug]/page'
import { getDefaultTemplate } from '@/lib/proposal-starter-templates'

// Demo photos (Unsplash — Mediterranean / Mallorca-style venues, free license)
const DEMO_PHOTOS = [
  'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1600&q=80', // luxury venue arched window
  'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=1600&q=80', // wedding ceremony arch
  'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1600&q=80', // banquet table outdoor
  'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?auto=format&fit=crop&w=1600&q=80', // mediterranean villa exterior
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1600&q=80', // floral decor close-up
  'https://images.unsplash.com/photo-1465495976277-4387d4b0e4a6?auto=format&fit=crop&w=1600&q=80', // countryside venue olive
  'https://images.unsplash.com/photo-1519741347686-c1e0aadf4611?auto=format&fit=crop&w=1600&q=80', // ceremony chairs
  'https://images.unsplash.com/photo-1478146059778-26028b07395a?auto=format&fit=crop&w=1600&q=80', // outdoor table setting
]

const SAMPLE_VENUE_CONTENT: VenueContent = {
  packages: [
    { id: 'p1', name: 'Paquete Esencial',      subtitle: 'Para 80-120 invitados', price: '15.500 €', min_guests: 80,  max_guests: 120, description: 'Espacio completo, menú maridado y servicio profesional.', includes: ['Alquiler exclusivo del venue', 'Coordinación dedicada', 'Menú 4 pases con maridaje', 'Mobiliario premium', 'Equipo de sonido'], sort_order: 0, is_active: true },
    { id: 'p2', name: 'Paquete Tramuntana',    subtitle: 'Para 120-180 invitados', price: '24.500 €', min_guests: 120, max_guests: 180, description: 'Experiencia gastronómica completa con sommelier dedicado.', includes: ['Todo lo anterior', 'Menú 6 pases premium', 'Sommelier dedicado', 'Cóctel de bienvenida ampliado', 'Estación de quesos artesanos'], sort_order: 1, is_active: true },
    { id: 'p3', name: 'Paquete Son Vell',      subtitle: 'Experiencia premium completa', price: '38.500 €', min_guests: 100, max_guests: 200, description: 'La experiencia más completa: cocina de autor, alojamiento y servicios premium.', includes: ['Todo lo anterior', 'Menú 8 pases de autor', 'Maridaje premium', '5 habitaciones incluidas', 'DJ + barra libre 4h', 'Photo booth incluido'], sort_order: 2, is_active: true },
  ],
  zones: [
    { id: 'z1', name: 'La Capella',           description: 'Capilla de piedra del siglo XVII para ceremonias íntimas.', capacity_min: 60, capacity_max: 200, sort_order: 0 },
    { id: 'z2', name: 'Jardí de les Oliveres', description: 'Jardín con olivos centenarios y vistas a Tramuntana.',     capacity_min: 80, capacity_max: 280, sort_order: 1 },
    { id: 'z3', name: 'Sala Principal',        description: 'Sala con techos abovedados y vigas del siglo XVIII.',      capacity_min: 80, capacity_max: 250, sort_order: 2 },
  ],
  season_prices: [
    { id: 'sp1', season: 'high',   label: 'Temporada Alta',  date_range: 'Mayo – Septiembre', price_modifier: 'Tarifa base', sort_order: 0 },
    { id: 'sp2', season: 'medium', label: 'Temporada Media', date_range: 'Abril y Octubre',   price_modifier: '-15%',         sort_order: 1 },
    { id: 'sp3', season: 'low',    label: 'Temporada Baja',  date_range: 'Nov – Marzo',       price_modifier: '-30%',         sort_order: 2 },
  ],
  inclusions: [
    { id: 'i1', title: 'Chef ejecutivo',       description: 'Menús personalizables con producto local de temporada.',    emoji: '👨‍🍳', sort_order: 0 },
    { id: 'i2', title: 'Bodega propia',        description: 'Maridaje de autor con vinos mallorquines incluido.',         emoji: '🍷', sort_order: 1 },
    { id: 'i3', title: 'Equipo de servicio',   description: '1 camarero cada 12 invitados durante todo el evento.',      emoji: '👥', sort_order: 2 },
    { id: 'i4', title: 'Sonido profesional',   description: 'Sonido ambiental en ceremonia, cóctel y banquete.',          emoji: '🎵', sort_order: 3 },
    { id: 'i5', title: 'Mobiliario completo',  description: 'Mesas, sillas Chiavari y menaje premium.',                   emoji: '🪑', sort_order: 4 },
    { id: 'i6', title: 'Wedding planner',      description: 'Coordinación dedicada 3 meses antes del evento.',            emoji: '✨', sort_order: 5 },
  ],
  exclusions: [
    { id: 'e1', title: 'Decoración floral',    description: 'Trabajamos con floristas colaboradores.',  sort_order: 0 },
    { id: 'e2', title: 'Fotografía y vídeo',   description: 'Recomendamos profesionales locales.',      sort_order: 1 },
  ],
  faq: [
    { id: 'f1', question: '¿Se puede cambiar el menú?',         answer: 'Sí, cada menú es personalizable. Podemos adaptar platos a alergias y dietas especiales.', sort_order: 0 },
    { id: 'f2', question: '¿Cuándo hacemos la cata del menú?',  answer: 'Dos meses antes de la boda. Incluye a la pareja y un acompañante.',                       sort_order: 1 },
    { id: 'f3', question: '¿Hay menú infantil?',                answer: 'Sí, menú adaptado para niños hasta 12 años al 50% del precio adulto.',                    sort_order: 2 },
    { id: 'f4', question: '¿Hasta qué hora podemos estar?',     answer: 'Hasta las 03:00. Ampliaciones según normativa.',                                          sort_order: 3 },
  ],
  testimonials: [
    { id: 't1', couple_name: 'Anna & Guillem',   wedding_date: '2024-07-20', text: 'La gastronomía fue el momento estrella de la boda. Todos nuestros invitados aún hablan del menú maridado.',     rating: 5 },
    { id: 't2', couple_name: 'María & Joan',     wedding_date: '2024-09-07', text: 'Profesionales de principio a fin. La finca es mágica y el catering de alta cocina.',                              rating: 5 },
    { id: 't3', couple_name: 'Isabel & Lucas',   wedding_date: '2024-05-25', text: 'La capilla al atardecer y el banquete bajo los olivos. Una experiencia sensorial completa.',                       rating: 5 },
  ],
  collaborators: [
    { id: 'c1', name: 'Flors de Mallorca',        category: 'Flores',    description: 'Composiciones florales mediterráneas con producto local.', sort_order: 0 },
    { id: 'c2', name: 'Duet Son Vell',            category: 'Música',    description: 'Violín y piano para ceremonia y cóctel.',                   sort_order: 1 },
    { id: 'c3', name: 'Pere Colom Photography',   category: 'Foto',      description: 'Reportaje editorial documental.',                          sort_order: 2 },
    { id: 'c4', name: 'Mallorca Wedding Films',   category: 'Vídeo',     description: 'Cinematografía de bodas en 4K.',                           sort_order: 3 },
  ],
  extra_services: [
    { id: 'ex1', name: 'Transporte invitados',   description: 'Autobús Palma–Finca ida y vuelta.', price: '1.200 €', sort_order: 0 },
    { id: 'ex2', name: 'Cabina de fotos',        description: 'Photo booth con atrezzo.',          price: '800 €',   sort_order: 1 },
    { id: 'ex3', name: 'Barra premium',          description: 'Ginebras premium y cocktails.',     price: '22 €',    sort_order: 2 },
  ],
  menu_prices: [
    { id: 'mp1', name: 'Menú Oliveres',   description: '4 pases + postre · Maridaje incluido',  price_per_person: '95 €',  min_guests: 80,  sort_order: 0 },
    { id: 'mp2', name: 'Menú Tramuntana', description: '6 pases + tabla de quesos + postre',    price_per_person: '125 €', min_guests: 80,  sort_order: 1 },
    { id: 'mp3', name: 'Menú Son Vell',   description: 'Experiencia 8 pases · Maridaje premium', price_per_person: '165 €', min_guests: 100, sort_order: 2 },
  ],
  experience: {
    id: 'exp1',
    title: 'Finca Son Vell — Tradición mallorquina desde 1687',
    body:  'Finca centenaria a 20 minutos de Palma, rodeada de olivares y montañas de Tramuntana. Ofrecemos una experiencia gastronómica completa con producto local y bodega propia. Un equipo con más de 15 años creando bodas memorables.',
  },
  techspecs: null,
  accommodation_info: {
    id: 'acc1',
    rooms:     '1 Suite Nupcial · 4 Suites dobles · 2 Habitaciones premium · 1 Habitación de cortesía',
    description: 'La finca dispone de 8 habitaciones renovadas con arte mallorquín contemporáneo.',
    price_info:  'Desde 220 € / noche · Suite Nupcial 380 €',
    nearby:    'Hotel Son Brull (10 min), Castell Son Claret (15 min).',
  },
  map_info: {
    id: 'map1',
    address: 'Camí de Son Vell s/n · 07009 Palma · Mallorca',
    notes:   '20 minutos del aeropuerto. Aparcamiento gratuito para 80 vehículos.',
  },
  budget_simulator: null,
  countdown:        null,
}

// Stub de venue para muestras (Finca Son Vell — coincide con experience_override
// y testimonials_override del array DEFAULT_TEMPLATES).
const SAMPLE_VENUE = {
  name:           'Finca Son Vell',
  city:           'Mallorca',
  region:         'Islas Baleares',
  contact_email:  'hola@fincasonvell.com',
  contact_phone:  '+34 971 000 000',
  website:        'https://fincasonvell.com',
  photo_urls:     DEMO_PHOTOS,
}

export default async function TemplatePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // ── Sample preview: sin auth, sin BD ───────────────────────────────────────
  const sample = getDefaultTemplate(id)
  if (sample) {
    const sd = sample.sections_data as any
    const proposalData: ProposalData = {
      id:                  `tpl-${id}`,
      slug:                `tpl-${id}`,
      couple_name:         sample.couple_name,
      personal_message:    sample.personal_message,
      guest_count:         sample.guest_count,
      wedding_date:        '2026-09-19',
      price_estimate:      sample.price_estimate,
      show_availability:   sample.show_availability,
      show_price_estimate: sample.show_price_estimate,
      status:              'preview',
      ctas:                [],
      sections_data:       sample.sections_data,
      venueContent:        SAMPLE_VENUE_CONTENT,
      venue:               SAMPLE_VENUE,
      branding: {
        logo_url:      null,
        primary_color: sd.primary_color ?? sample.branding.primary_color,
        font_family:   sd.font_family   ?? sample.branding.font_family,
      },
    }
    return <ProposalLanding data={proposalData} preview={true} />
  }

  // ── Plantilla del usuario: auth + lookup ───────────────────────────────────
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value, set() {}, remove() {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: template } = await supabase
    .from('proposal_content_templates')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!template) notFound()

  const [{ data: venueData }, { data: brandingRow }, { data: vcRows }] = await Promise.all([
    supabase.from('venue_onboarding').select('name, city, region, contact_email, contact_phone, website, photo_urls').eq('user_id', user.id).maybeSingle(),
    supabase.from('proposal_web_templates').select('accent_color, font_family').eq('user_id', user.id).eq('is_default', true).maybeSingle(),
    supabase.from('venue_content').select('*').eq('user_id', user.id).order('sort_order'),
  ])

  // Fetch commercial config + modalities + packages + prices when template has a commercial config
  let modalitiesData: any[] = []
  let commercialConfigData: { space_type?: string; price_model?: string } | null = null
  if ((template as any).commercial_config_id) {
    const [{ data: ccRow }, { data: mods }] = await Promise.all([
      supabase.from('venue_commercial_configs').select('config').eq('id', (template as any).commercial_config_id).maybeSingle(),
      supabase.from('venue_modalities')
        .select('*, packages:venue_modality_packages(*, prices:venue_modality_prices(*), option_groups:package_option_groups(*, items:package_option_items(*))), prices:venue_modality_prices(*)')
        .eq('commercial_config_id', (template as any).commercial_config_id)
        .eq('is_active', true)
        .order('sort_order'),
    ])
    commercialConfigData = (ccRow as any)?.config ?? null
    modalitiesData = mods ?? []
  }

  const vc = (vcRows ?? []) as any[]
  const findOne = (sec: string) => { const r = vc.find(r => r.section === sec); return r ? { id: r.id, ...r.data } : null }
  const findMany = (sec: string) => vc.filter(r => r.section === sec).map(r => ({ id: r.id, ...r.data }))

  const venueContent: VenueContent = {
    packages:            findMany('package'),
    zones:               findMany('zone'),
    season_prices:       findMany('season_price'),
    inclusions:          findMany('inclusion'),
    exclusions:          findMany('exclusion'),
    faq:                 findMany('faq'),
    testimonials:        findMany('testimonial'),
    collaborators:       findMany('collaborator'),
    extra_services:      findMany('extra_service'),
    menu_prices:         findMany('menu_price'),
    experience:          findOne('experience'),
    techspecs:           findOne('techspecs'),
    accommodation_info:  findOne('accommodation_info'),
    map_info:            findOne('map_info'),
    budget_simulator:    findOne('budget_simulator'),
    countdown:           findOne('countdown'),
  }

  const sd = (template.sections_data ?? {}) as any
  const baseBrand = brandingRow
    ? { logo_url: null as string | null, primary_color: brandingRow.accent_color ?? '#2d4a7a', font_family: brandingRow.font_family }
    : { logo_url: null as string | null, primary_color: '#2d4a7a' }
  const branding = {
    ...baseBrand,
    ...(sd.primary_color ? { primary_color: sd.primary_color } : {}),
    ...(sd.font_family   ? { font_family:   sd.font_family   } : {}),
    ...(sd.logo_url      ? { logo_url:      sd.logo_url      } : {}),
  }
  const commercialConfig = commercialConfigData
  const proposalData: ProposalData = {
    id:                  `tpl-${id}`,
    slug:                `tpl-${id}`,
    couple_name:         'Nombre Ejemplo 1 & Nombre Ejemplo 2',
    personal_message:    sd.welcome_default ?? 'Queridos Nombre Ejemplo 1 & Nombre Ejemplo 2, es un placer presentaros esta propuesta. Aquí encontraréis todos los detalles sobre nuestro espacio y servicios.',
    guest_count:         150,
    wedding_date:        '2026-09-19',
    price_estimate:      18500,
    show_availability:   false,
    show_price_estimate: true,
    status:              'preview',
    ctas:                [],
    sections_data:       template.sections_data,
    venueContent,
    venue:               venueData ?? null,
    branding,
    commercialConfig,
    modalities:          modalitiesData,
  } as any

  return <ProposalLanding data={proposalData} preview={true} />
}

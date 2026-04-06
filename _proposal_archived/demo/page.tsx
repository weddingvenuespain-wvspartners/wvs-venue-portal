'use client'
// /proposal/demo — Página de demo con datos inventados ricos
// Muestra los 5 templates con contenido completo de un venue de lujo ficticio
// URL: /proposal/demo  (usa ?t=1..5 para preseleccionar template)

import { useState, useEffect } from 'react'
import T1Impacto     from '../[slug]/tpl/T1Impacto'
import T2Emocion     from '../[slug]/tpl/T2Emocion'
import T3TodoClaro   from '../[slug]/tpl/T3TodoClaro'
import T4SocialProof from '../[slug]/tpl/T4SocialProof'
import T5Minimalista from '../[slug]/tpl/T5Minimalista'
import type { ProposalData } from '../[slug]/page'

// ─── Unsplash photos ─────────────────────────────────────────────────────────
const P = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=85&auto=format&fit=crop`

const PHOTOS = {
  hero:       P('1519741497674-611481863552', 1920),
  ceremony:   P('1519225421980-715cb0215aed', 1200),
  garden:     P('1550005809-8b30ed64bfb1', 1200),
  dining:     P('1414235077428-338989a2e8c0', 1200),
  cocktail:   P('1464366400600-7168b8af9bc3', 1200),
  pool:       P('1572633891952-8e8a7e60a2cc', 1200),
  cellar:     P('1510812431401-41d2bd2722f3', 1200),
  couple1:    P('1583939003579-730e3918a45a', 900),
  couple2:    P('1537633552985-df8429e8048b', 900),
  couple3:    P('1549451371-64aa98a6f660', 900),
  flowers:    P('1558618666-fcd25c85cd64', 900),
  night:      P('1478145046317-39f10e56b5e9', 1200),
  exterior:   P('1531058020387-3be344556be6', 1200),
  suite:      P('1522771739844-6a9136b0a16d', 900),
}

// ─── Rich mock data ───────────────────────────────────────────────────────────
const DEMO_DATA: ProposalData = {
  id: 'demo-finca-son-vell',
  slug: 'demo',
  couple_name: 'Laura & Carlos',
  personal_message:
    'Queridos Laura y Carlos,\n\nHa sido un placer conoceros y enseñaros nuestra finca. La manera en que os miráis y la historia que queréis contar nos confirma que vuestra boda va a ser algo absolutamente único.\n\nHemos preparado esta propuesta pensando en cada detalle que nos compartisteis: la ceremonia al atardecer entre los olivos centenarios, el banquete bajo las estrellas y esa pista de baile que no queréis que pare.\n\nEstamos aquí para acompañaros en cada paso del camino.\n\nCon mucho cariño,\nEl equipo de Finca Son Vell',
  guest_count: 180,
  wedding_date: '2026-09-12',
  price_estimate: 42000,
  show_availability: true,
  show_price_estimate: true,
  status: 'sent',
  ctas: ['Reservar fecha', 'Hablar con coordinadora'],

  venue: {
    name: 'Finca Son Vell',
    city: 'Binissalem',
    region: 'Mallorca',
    contact_email: 'eventos@fincasonvell.com',
    contact_phone: '+34 971 512 348',
    website: 'https://fincasonvell.com',
    photo_urls: [
      PHOTOS.hero,
      PHOTOS.ceremony,
      PHOTOS.garden,
      PHOTOS.dining,
      PHOTOS.cocktail,
      PHOTOS.pool,
      PHOTOS.night,
      PHOTOS.exterior,
    ],
  },

  branding: {
    logo_url: null,
    primary_color: '#8B6F47',
  },

  sections_data: {
    visual_template_id: 1,
    show_availability_msg: true,
    availability_message: 'Fecha disponible — Solo quedan 2 sábados libres en septiembre 2026.',
    sections_enabled: {
      hero: true, experience: true, gallery: true, packages: true,
      inclusions: true, zones: true, testimonials: true, faq: true,
      collaborators: true, cta: true,
    },
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  venueContent: ({
    // ── Packages ─────────────────────────────────────────────────────────────
    packages: [
      {
        id: 'pkg-esencial',
        name: 'Esencial',
        subtitle: 'La experiencia Son Vell en su esencia',
        price: '165 €',
        min_guests: 80,
        max_guests: 150,
        description: 'Acceso completo a la finca con las zonas principales incluidas.',
        is_active: true,
        is_recommended: false,
        sort_order: 1,
        includes: [
          'Alquiler exclusivo de la finca (1 boda/día)',
          'Ceremonia en La Capella o jardines',
          'Cóctel en El Jardí de les Oliveres',
          'Banquete en La Sala Principal',
          'Climatización de espacios interiores',
          '8 horas de celebración',
          'Parking privado para 200 vehículos',
          'Coordinador/a el día del evento',
        ],
      },
      {
        id: 'pkg-clasico',
        name: 'Clásico',
        subtitle: 'El paquete más elegido por nuestras parejas',
        price: '210 €',
        min_guests: 100,
        max_guests: 220,
        description: 'La propuesta completa con acceso a todos los espacios y servicios premium.',
        is_active: true,
        is_recommended: true,
        sort_order: 2,
        includes: [
          'Todo lo incluido en Esencial',
          'Suite nupcial con acceso el día anterior',
          'Apertura de La Terrassa para after-party',
          'Acceso a El Celler para copa de bienvenida',
          '10 horas de celebración',
          'Servicio de protocolo y bienvenida',
          'Iluminación ambiente personalizable',
          'Seguridad y acceso controlado',
          '2 aparcacoches',
        ],
      },
      {
        id: 'pkg-gran-gala',
        name: 'Gran Gala',
        subtitle: 'La experiencia más exclusiva de Mallorca',
        price: '275 €',
        min_guests: 130,
        max_guests: 300,
        description: 'La celebración definitiva con alojamiento, carpa y servicio white-glove.',
        is_active: true,
        is_recommended: false,
        sort_order: 3,
        includes: [
          'Todo lo incluido en Clásico',
          'Alquiler de las 6 suites de la finca (2 noches)',
          'Desayuno privado el día siguiente',
          'Carpa de lujo para 300+ invitados',
          '12 horas de celebración',
          'Coordinadora exclusiva 3 meses antes',
          'Degustación de menú sin cargo',
          'Prueba de sonido e iluminación previa',
          'Floristería de bienvenida incluida',
        ],
      },
    ],

    // ── Zones / Spaces ────────────────────────────────────────────────────────
    zones: [
      {
        id: 'zone-capella',
        name: 'La Capella',
        description:
          'Nuestra capilla de piedra del siglo XVII es el escenario más íntimo y emotivo de la finca. Rodeada de cipreses centenarios y con la luz del atardecer mallorquín filtrándose entre los muros de piedra, es el lugar perfecto para pronunciar vuestros votos.',
        capacity_min: 20,
        capacity_max: 200,
        price: 'Incluida en todos los paquetes',
        sort_order: 1,
        photos: [PHOTOS.ceremony],
      },
      {
        id: 'zone-jardi',
        name: 'El Jardí de les Oliveres',
        description:
          'El jardín de los olivos centenarios es el espacio ideal para el cóctel de bienvenida. Con más de 3.000 m² de jardines mediterráneos, palmeras, fuentes y vistas a las colinas de Tramuntana, vuestros invitados disfrutarán de un ambiente único e irrepetible.',
        capacity_min: 80,
        capacity_max: 280,
        price: 'Incluido en todos los paquetes',
        sort_order: 2,
        photos: [PHOTOS.garden],
      },
      {
        id: 'zone-sala',
        name: 'La Sala Principal',
        description:
          'El corazón de la finca. Una sala de banquetes de techos abovedados, arcos de piedra viva y vigas de madera del siglo XVIII. Completamente climatizada, con sistema de sonido integrado y posibilidad de iluminación personalizada para cada momento de la noche.',
        capacity_min: 60,
        capacity_max: 250,
        price: 'Incluida en todos los paquetes',
        sort_order: 3,
        photos: [PHOTOS.dining],
      },
      {
        id: 'zone-celler',
        name: 'El Celler',
        description:
          'Nuestro bodega histórica, excavada en roca viva, ofrece un ambiente íntimo e inigualable para la copa de bienvenida o una cena exclusiva. El perfume de la madera de roble y los barriles centenarios crean una atmósfera absolutamente única.',
        capacity_min: 20,
        capacity_max: 60,
        price: 'Disponible en Clásico y Gran Gala',
        sort_order: 4,
        photos: [PHOTOS.cellar],
      },
      {
        id: 'zone-terrassa',
        name: 'La Terrassa',
        description:
          'La terraza exterior, con vistas panorámicas a los viñedos y la Serra de Tramuntana, es el escenario perfecto para el after-party. Con barra de cócteles, zona lounge y pista de baile al aire libre, mantiene la magia hasta el amanecer.',
        capacity_min: 50,
        capacity_max: 300,
        price: 'Disponible en Clásico y Gran Gala',
        sort_order: 5,
        photos: [PHOTOS.pool],
      },
    ],

    // ── Season Prices ─────────────────────────────────────────────────────────
    season_prices: [
      {
        id: 'sp-alta',
        season: 'alta',
        label: 'Temporada Alta',
        date_range: 'Junio · Julio · Agosto · Septiembre',
        price_modifier: 'Sábado y festivo desde 13.500 € + precio/persona',
        notes: 'Viernes y domingo desde 9.800 €. Lunes–Jueves desde 6.200 €.',
        sort_order: 1,
      },
      {
        id: 'sp-media',
        season: 'media',
        label: 'Temporada Media',
        date_range: 'Abril · Mayo · Octubre',
        price_modifier: 'Sábado y festivo desde 9.600 € + precio/persona',
        notes: 'Viernes y domingo desde 7.400 €. Lunes–Jueves desde 4.800 €.',
        sort_order: 2,
      },
      {
        id: 'sp-baja',
        season: 'baja',
        label: 'Temporada Baja',
        date_range: 'Noviembre · Diciembre · Enero · Febrero · Marzo',
        price_modifier: 'Sábado y festivo desde 6.800 € + precio/persona',
        notes: 'Lunes–Jueves desde 3.200 €. Consultar descuentos especiales.',
        sort_order: 3,
      },
    ],

    // ── Inclusions ────────────────────────────────────────────────────────────
    inclusions: [
      { id: 'inc-1',  title: 'Uso exclusivo de la finca',            emoji: '🏰', description: 'Solo una boda al día. La finca es completamente vuestra.', sort_order: 1 },
      { id: 'inc-2',  title: '10 horas de celebración',              emoji: '⏱️', description: 'Desde la llegada de los invitados hasta el cierre de la barra.', sort_order: 2 },
      { id: 'inc-3',  title: 'Suite nupcial',                        emoji: '🛏️', description: 'Suite exclusiva con terraza privada y jacuzzi con vistas al jardín.', sort_order: 3 },
      { id: 'inc-4',  title: 'Parking privado vigilado',             emoji: '🅿️', description: 'Parking para 250 vehículos con servicio de aparcacoches.', sort_order: 4 },
      { id: 'inc-5',  title: 'Coordinadora dedicada',                emoji: '👩‍💼', description: 'Tu coordinadora te acompaña desde 3 meses antes hasta el último baile.', sort_order: 5 },
      { id: 'inc-6',  title: 'Plan B climatizado',                   emoji: '☂️', description: 'Espacio cubierto con aire acondicionado en caso de lluvia.', sort_order: 6 },
      { id: 'inc-7',  title: 'Licencia SGAE',                        emoji: '🎵', description: 'Tasas de música incluidas. Sin sorpresas en la factura.', sort_order: 7 },
      { id: 'inc-8',  title: 'Limpieza pre, durante y post',         emoji: '✨', description: 'Servicio de limpieza profesional antes, durante y después del evento.', sort_order: 8 },
      { id: 'inc-9',  title: 'Seguridad y protocolo',                emoji: '🔒', description: 'Equipo de seguridad y control de accesos durante toda la celebración.', sort_order: 9 },
      { id: 'inc-10', title: 'Iluminación ambiente',                 emoji: '💡', description: 'Sistema de iluminación LED personalizable para cada momento.', sort_order: 10 },
      { id: 'inc-11', title: 'Wifi de alta velocidad',               emoji: '📶', description: 'Cobertura wifi en todos los espacios para vosotros y vuestros invitados.', sort_order: 11 },
      { id: 'inc-12', title: 'Acceso a proveedores el día anterior', emoji: '🚛', description: 'Apertura de la finca para decoración y montaje la víspera de la boda.', sort_order: 12 },
    ],

    // ── Testimonials ──────────────────────────────────────────────────────────
    testimonials: [
      {
        id: 'test-1',
        couple_name: 'Marina & David',
        wedding_date: 'Septiembre 2024',
        text: 'Finca Son Vell superó cada una de nuestras expectativas. Desde el primer momento, el equipo de coordinación nos hizo sentir que nuestra boda era lo más importante del mundo. La capilla al atardecer fue absolutamente mágica, y nuestros invitados aún nos hablan de esa noche. Si buscáis un lugar que combine historia, elegancia y calidez humana, no hay otro sitio.',
        rating: 5,
        photo_url: PHOTOS.couple1,
        sort_order: 1,
      },
      {
        id: 'test-2',
        couple_name: 'Sofía & Alejandro',
        wedding_date: 'Junio 2024',
        text: 'Llevamos nueve meses casados y seguimos recibiendo mensajes de nuestros invitados diciéndonos que fue la mejor boda a la que han asistido. La combinación de la piedra centenaria, los jardines mediterráneos y la profesionalidad del equipo lo convierten en un lugar verdaderamente irrepetible. Gracias infinitas.',
        rating: 5,
        photo_url: PHOTOS.couple2,
        sort_order: 2,
      },
      {
        id: 'test-3',
        couple_name: 'Laura & Jordi',
        wedding_date: 'Octubre 2023',
        text: 'El equipo de coordinación de Son Vell es simplemente increíble. Desde la primera visita hasta el último baile, nos acompañaron con una atención personalizada que no esperábamos encontrar. El celler fue el espacio que más nos sorprendió: nuestros invitados no querían salir de allí. Una experiencia de diez.',
        rating: 5,
        photo_url: PHOTOS.couple3,
        sort_order: 3,
      },
      {
        id: 'test-4',
        couple_name: 'Ana & Miguel',
        wedding_date: 'Mayo 2024',
        text: 'Cuando visitamos la finca por primera vez, supe inmediatamente que era nuestro lugar. El entorno es mágico: piedra antigua, olivos centenarios, el olor del mediterráneo... Pero lo que realmente marca la diferencia es el equipo humano. Son Vell no es solo un espacio, es una familia que te acoge.',
        rating: 5,
        photo_url: null,
        sort_order: 4,
      },
    ],

    // ── Collaborators ─────────────────────────────────────────────────────────
    collaborators: [
      { id: 'col-1',  name: 'Rubén Larruy',         category: 'Fotografía',     description: 'Fotógrafo editorial especializado en bodas de lujo. Ganador de los premios ISPWP 2023.',             website: 'https://rubenlarruy.com',       sort_order: 1 },
      { id: 'col-2',  name: 'North Miles',           category: 'Fotografía',     description: 'Duo de fotógrafos con estilo documental y emocional. Partners oficiales de Son Vell.',              website: 'https://northmiles.com',        sort_order: 2 },
      { id: 'col-3',  name: 'Crispetes Films',       category: 'Vídeo',          description: 'Productora audiovisual premiada internacionalmente. Sus bodas son cortometrajes de autor.',          website: 'https://crispetesfilms.com',    sort_order: 3 },
      { id: 'col-4',  name: 'Odos Vídeos',           category: 'Vídeo',          description: 'Estilo documental emocional. Cada vídeo es una historia de amor única.',                           website: 'https://odosvideos.com',        sort_order: 4 },
      { id: 'col-5',  name: 'Loving the Flowers',    category: 'Florística',     description: 'Estudio de florística de lujo. Diseño floral de alta gama para eventos exclusivos.',               website: 'https://lovingtheflowers.com',  sort_order: 5 },
      { id: 'col-6',  name: 'Prada Flors',           category: 'Florística',     description: 'Floristas con más de 20 años decorando las bodas más exclusivas de Mallorca.',                      website: 'https://pradaflors.com',        sort_order: 6 },
      { id: 'col-7',  name: 'La Cuina de l\'Avi',    category: 'Catering',       description: 'Gastronomía mallorquina de temporada con producto local y técnica de alta cocina.',                website: 'https://lacuinadelavi.com',     sort_order: 7 },
      { id: 'col-8',  name: 'Slow Chef BCN',         category: 'Catering',       description: 'Catering de autor con ingredientes km0. Menús personalizados para cada boda.',                     website: 'https://slowchefbcn.com',       sort_order: 8 },
    ],

    // ── Extra Services ────────────────────────────────────────────────────────
    extra_services: [
      { id: 'ex-1', name: 'Photo Booth exclusivo Son Vell',  price: '850 €',  description: 'Photo booth con atrezzo de la finca y álbum impreso incluido. Exclusivo — no se permite ningún otro.',  sort_order: 1 },
      { id: 'ex-2', name: 'Servicio de carpa de lujo',       price: 'Desde 4.800 €', description: 'Carpa translúcida con iluminación interior para eventos superiores a 250 invitados.',          sort_order: 2 },
      { id: 'ex-3', name: 'Barra libre premium 2h extra',    price: '18 €/pers', description: 'Extensión de 2 horas adicionales de barra con cócteles de temporada y espumoso.',                sort_order: 3 },
      { id: 'ex-4', name: 'Buggy de bienvenida vintage',     price: '380 €',  description: 'Buggy eléctrico vintage de la finca para traslado de los novios entre espacios.',                    sort_order: 4 },
      { id: 'ex-5', name: 'Degustación privada de vinos',    price: '65 €/pers', description: 'Cata guiada de los vinos de la finca en El Celler con el enólogo residente.',                    sort_order: 5 },
    ],

    // ── Menu Prices ───────────────────────────────────────────────────────────
    menu_prices: [
      { id: 'men-1', name: 'Menú Oliveres',         price_per_person: '95 €',  description: 'Menú de temporada con producto local. 4 pases + postre. Maridaje incluido.',     min_guests: 80,  sort_order: 1 },
      { id: 'men-2', name: 'Menú Tramuntana',       price_per_person: '125 €', description: 'Alta cocina mallorquina. 6 pases + tabla de quesos + postre. Sommelier incluido.', min_guests: 80,  sort_order: 2 },
      { id: 'men-3', name: 'Menú Son Vell Gourmet', price_per_person: '165 €', description: 'Experiencia gastronómica de autor. 8 pases. Maridaje premium. Menú personalizado.', min_guests: 100, sort_order: 3 },
    ],

    // ── Experience ────────────────────────────────────────────────────────────
    experience: {
      id: 'exp-1',
      title: 'Una finca del siglo XVII, renovada para vuestra historia',
      body: 'Finca Son Vell nació en 1687 como residencia de la familia Vell, una de las más influyentes del interior de Mallorca. Durante más de tres siglos, sus muros de piedra de marès han sido testigos de generaciones de historia, celebraciones y vida mallorquina en estado puro.\n\nEn 2018, la familia propietaria emprendió una restauración exhaustiva de tres años para devolver a la finca su esplendor original, integrando las comodidades más modernas sin renunciar a la autenticidad de sus piedras centenarias. El resultado es un espacio único en Europa: 8 hectáreas de viñedos, olivares y jardines mediterráneos que abrazan una arquitectura del siglo XVII perfectamente preservada.\n\nHoy, Finca Son Vell es el escenario elegido por las parejas más exigentes de toda Europa para celebrar el día más importante de sus vidas. Solo una boda al día. Solo la vuestra.',
    },

    // ── Tech Specs ────────────────────────────────────────────────────────────
    techspecs: {
      id: 'tech-1',
      sqm: '3.200 m² de espacios cubiertos · 8 hectáreas de jardines',
      ceiling: '7,4 m de altura en La Sala Principal · 4,8 m en El Celler',
      parking: 'Parking privado para 250 vehículos + 8 plazas VIP en acceso principal',
      accessibility: 'Acceso adaptado a todos los espacios · Rampas y aseos adaptados',
      ceremony_spaces: 'La Capella (200 pax) · Jardines (ilimitado) · Interior con cubierta (350 pax)',
      extra: 'Generador propio · WiFi 600Mbps · Sistema de sonido Bose integrado · Climatización por zonas',
    },

    // ── Accommodation ─────────────────────────────────────────────────────────
    accommodation_info: {
      id: 'accom-1',
      rooms: '1 Suite Nupcial · 4 Suites Dobles · 2 Habitaciones Premium · 1 Habitación de cortesía',
      description:
        'La finca dispone de 8 habitaciones y suites, todas renovadas con mimo y decoradas con arte mallorquín contemporáneo. La Suite Nupcial incluye terraza privada con jacuzzi exterior y vistas a los viñedos, cama king size y servicio de desayuno en habitación.',
      price_info: 'Alquiler completo de las 8 estancias: 2.800 € (2 noches). Suite Nupcial individual: 380 €/noche. Suites Dobles: 240 €/noche.',
      nearby: 'Hotel Son Brull (5★, 8 km) · Gran Hotel Soller (5★, 25 km) · Pueblo de Binissalem a 2 km con varios alojamientos boutique.',
    },

    // ── Map ───────────────────────────────────────────────────────────────────
    map_info: {
      id: 'map-1',
      embed_url: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3083.1!2d2.845!3d39.686!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sFinca+Son+Vell!5e0!3m2!1ses!2ses!4v1',
      address: 'Camí Son Vell, s/n · 07350 Binissalem, Mallorca (Illes Balears)',
      notes: 'A 25 min del Aeropuerto de Palma · A 15 min de Palma centro · Carretera privada de acceso de 800 m. Coordenadas: 39.686°N, 2.845°E',
    },

    // ── Budget Simulator ──────────────────────────────────────────────────────
    budget_simulator: {
      id: 'budget-1',
      base_price: '9.600',
      price_per_person: '210',
      notes: 'Precio base de alquiler finca + precio por persona del paquete Clásico. IVA (21%) no incluido en precio de alquiler. IVA (10%) no incluido en precio/persona.',
    },

    // ── FAQ ───────────────────────────────────────────────────────────────────
    faq: [
      {
        id: 'faq-1',
        question: '¿Qué incluye exactamente el alquiler de la finca?',
        answer: 'El alquiler incluye el uso exclusivo de todos los espacios de la finca durante el tiempo contratado, el equipo de coordinación, servicio de limpieza pre y post evento, seguridad, iluminación ambiente, sistema de sonido, climatización y parking. La suite nupcial está incluida en los paquetes Clásico y Gran Gala.',
        category: 'Alquiler',
        sort_order: 1,
      },
      {
        id: 'faq-2',
        question: '¿Podemos elegir nuestro propio catering?',
        answer: 'Sí, trabajamos con libertad de catering. Os facilitamos nuestra lista de caterings colaboradores (con quienes tenemos experiencia previa en la finca), pero también podéis traer vuestro propio proveedor previa aprobación y visita técnica. Hay un suplemento de coordinación de 800 € para caterings externos.',
        category: 'Servicios',
        sort_order: 2,
      },
      {
        id: 'faq-3',
        question: '¿Hay alojamiento en la finca para los novios?',
        answer: 'Sí. La Suite Nupcial está incluida en los paquetes Clásico y Gran Gala. En el Gran Gala se incluye además el alquiler completo de las 8 habitaciones de la finca para la noche de la boda y la noche anterior. Para huéspedes adicionales, ofrecemos tarifas especiales en hoteles colaboradores cercanos.',
        category: 'Alojamiento',
        sort_order: 3,
      },
      {
        id: 'faq-4',
        question: '¿Qué ocurre si llueve?',
        answer: 'Tenemos un Plan B completamente equipado y climatizado (La Sala Principal y La Sala Cel combinadas) capaz de acoger hasta 350 personas en formato banquete. El espacio está montado y preparado siempre de manera paralela, sin coste adicional, para que podáis disfrutar sin preocupaciones.',
        category: 'Logística',
        sort_order: 4,
      },
      {
        id: 'faq-5',
        question: '¿Cuándo podemos realizar la ceremonia civil?',
        answer: 'La finca dispone de licencia para la celebración de ceremonias civiles en todos sus espacios. Colaboramos habitualmente con los juzgados de Binissalem e Inca. También podéis contar con un officiant civil privado (lista disponible). Para ceremonias religiosas, la Capella tiene bendición y celebración de misas autorizadas.',
        category: 'Ceremonia',
        sort_order: 5,
      },
      {
        id: 'faq-6',
        question: '¿Cuál es el horario máximo de la música?',
        answer: 'La finca dispone de insonorización en La Sala Principal y El Nightclub que permiten música hasta las 5:00 h sin restricciones. La música exterior en La Terrassa tiene autorización hasta las 1:00 h. El generador propio garantiza suministro eléctrico ininterrumpido durante toda la noche.',
        category: 'Logística',
        sort_order: 6,
      },
      {
        id: 'faq-7',
        question: '¿Hay disponibilidad en nuestra fecha?',
        answer: 'Para verificar disponibilidad en vuestra fecha específica, contactadnos directamente. En temporada alta (junio-septiembre) recomendamos reservar con 12-18 meses de antelación. Para temporada media y baja la disponibilidad es mayor. La reserva se formaliza con la firma del contrato y el pago del 30% del alquiler.',
        category: 'Reserva',
        sort_order: 7,
      },
      {
        id: 'faq-8',
        question: '¿Se permite decoración externa y acceso previo para montaje?',
        answer: 'Sí. La finca permite el acceso a proveedores de decoración y montaje desde las 9:00 h del día anterior a la boda, sin coste adicional. Para montajes especialmente elaborados, también es posible contratar acceso desde 2 días antes (50% del precio de alquiler por día extra).',
        category: 'Logística',
        sort_order: 8,
      },
    ],

    // ── Countdown ─────────────────────────────────────────────────────────────
    countdown: {
      id: 'cd-1',
      days: 165,
      message: 'Quedan 165 días para el gran día. ¡Es el momento de confirmar!',
    },
  }) as any,
}

// ─── Template definitions ─────────────────────────────────────────────────────
const TEMPLATES = [
  { id: 1, icon: '⚡', name: 'Impacto Directo',       color: '#0a0a0a' },
  { id: 2, icon: '✨', name: 'Emoción Primero',        color: '#8B6F47' },
  { id: 3, icon: '📋', name: 'Todo Claro',             color: '#2D4A7A' },
  { id: 4, icon: '💬', name: 'Social Proof',           color: '#C9714A' },
  { id: 5, icon: '🎯', name: 'Minimalista / Urgencia', color: '#111111' },
]

// ─── Demo Switcher ────────────────────────────────────────────────────────────
function TemplateSwitcher({ active, onChange }: { active: number; onChange: (n: number) => void }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    }}>
      {!collapsed && (
        <div style={{
          display: 'flex', gap: 6, background: 'rgba(10,10,10,.92)',
          backdropFilter: 'blur(16px)', borderRadius: 50,
          padding: '8px 12px',
          boxShadow: '0 8px 40px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.08)',
        }}>
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              title={t.name}
              style={{
                background: active === t.id ? t.color || '#fff' : 'transparent',
                border: `1.5px solid ${active === t.id ? 'transparent' : 'rgba(255,255,255,.18)'}`,
                color: '#fff',
                padding: '7px 16px',
                borderRadius: 50,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: active === t.id ? 700 : 400,
                fontFamily: 'system-ui, sans-serif',
                letterSpacing: '.03em',
                transition: 'all .2s',
                whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span>{t.icon}</span>
              <span style={{ display: window.innerWidth > 600 ? 'inline' : 'none' }}>{t.name}</span>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          background: 'rgba(10,10,10,.85)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,.12)',
          color: 'rgba(255,255,255,.5)', fontSize: 10, letterSpacing: '.1em',
          padding: '4px 14px', borderRadius: 50, cursor: 'pointer',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {collapsed ? '▲ DEMO MODE' : '▼ ocultar'}
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProposalDemoPage() {
  const [templateId, setTemplateId] = useState(1)

  // Read ?t= param on mount
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('t')
    const n = parseInt(p || '1')
    if (n >= 1 && n <= 5) setTemplateId(n)
  }, [])

  // Build data with the chosen visual_template_id
  const data: ProposalData = {
    ...DEMO_DATA,
    sections_data: { ...DEMO_DATA.sections_data, visual_template_id: templateId },
    branding: {
      logo_url: null,
      primary_color: templateId === 3 ? '#2D4A7A' : templateId === 4 ? '#C9714A' : '#8B6F47',
    },
  }

  const renderTemplate = () => {
    switch (templateId) {
      case 2: return <T2Emocion     data={data} />
      case 3: return <T3TodoClaro   data={data} />
      case 4: return <T4SocialProof data={data} />
      case 5: return <T5Minimalista data={data} />
      default: return <T1Impacto    data={data} />
    }
  }

  return (
    <>
      {renderTemplate()}
      <TemplateSwitcher active={templateId} onChange={id => {
        setTemplateId(id)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }} />
    </>
  )
}

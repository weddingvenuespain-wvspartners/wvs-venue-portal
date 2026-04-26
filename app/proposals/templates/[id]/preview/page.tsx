// /proposals/templates/[id]/preview — renders the template as a fake proposal
// Used as the iframe src in TemplateEditor for live preview via postMessage.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import ProposalLanding from '@/app/proposal/[slug]/ProposalLanding'
import type { ProposalData, VenueContent } from '@/app/proposal/[slug]/page'

async function createAuthClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value, set() {}, remove() {} } }
  )
}

export default async function TemplatePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createAuthClient()

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

  const vc = (vcRows ?? []) as any[]
  const findOne = (sec: string) => { const r = vc.find(r => r.section === sec); return r ? { id: r.id, ...r.data } : null }
  const findMany = (sec: string) => vc.filter(r => r.section === sec).map(r => ({ id: r.id, ...r.data }))

  // Demo fallbacks so the template preview renders all sections even without real venue data
  const DEMO: VenueContent = {
    packages: [
      { id: 'd1', name: 'Paquete Esencial', subtitle: 'Lo fundamental para vuestra boda', price: '85€', includes: ['Uso exclusivo de la finca', 'Coordinación del evento', 'Aparcamiento privado'], sort_order: 0 },
      { id: 'd2', name: 'Paquete Premium', subtitle: 'La experiencia completa', price: '120€', includes: ['Todo lo del Esencial', 'Decoración floral', 'Iluminación especial', 'Barra libre 6h'], sort_order: 1 },
    ],
    zones: [
      { id: 'z1', name: 'Jardín Principal', description: 'Amplio jardín exterior rodeado de vegetación centenaria, ideal para ceremonias y cócteles al aire libre.', capacity_min: 50, capacity_max: 300, sort_order: 0 },
      { id: 'z2', name: 'Salón de Banquetes', description: 'Salón interior climatizado con techos altos y luz natural, perfecto para el banquete y la celebración.', capacity_min: 80, capacity_max: 250, sort_order: 1 },
    ],
    season_prices: [
      { id: 's1', season: 'alta', label: 'Temporada alta', date_range: '15 jun – 15 sep · Viernes a domingo', price_modifier: 'Desde 95€/pax', sort_order: 0 },
      { id: 's2', season: 'media', label: 'Temporada media', date_range: '1 abr – 14 jun · 16 sep – 30 nov', price_modifier: 'Desde 80€/pax', sort_order: 1 },
    ],
    inclusions: [
      { id: 'i1', title: 'Uso exclusivo', description: 'Solo una celebración al día', emoji: 'key', sort_order: 0 },
      { id: 'i2', title: 'Aparcamiento', description: 'Parking gratuito para todos los invitados', emoji: 'car', sort_order: 1 },
      { id: 'i3', title: 'Coordinación', description: 'Coordinador dedicado el día de la boda', emoji: 'clipboard', sort_order: 2 },
      { id: 'i4', title: 'Vajilla y cubertería', description: 'Incluida en todos los paquetes', emoji: 'utensils', sort_order: 3 },
    ],
    exclusions: [],
    faq: [
      { id: 'f1', question: '¿Cuánto tiempo tenemos para la celebración?', answer: 'La finca está disponible desde las 12:00 h. La música debe finalizar a las 02:00 h en interior y a las 00:00 h en exterior.', sort_order: 0 },
      { id: 'f2', question: '¿Podemos traer nuestros propios proveedores?', answer: 'Trabajamos con proveedores de confianza pero somos abiertos. Consultadnos y lo valoramos juntos.', sort_order: 1 },
    ],
    testimonials: [
      { id: 't1', couple_name: 'Laura & Carlos', wedding_date: '2024-09-14', text: 'Una experiencia inolvidable. El equipo estuvo pendiente de cada detalle y nuestros invitados no paran de hablar de la boda.', rating: 5 },
      { id: 't2', couple_name: 'Marta & Javier', wedding_date: '2024-06-22', text: 'El espacio es precioso y el servicio impecable. Repetiríamos sin dudarlo.', rating: 5 },
    ],
    collaborators: [
      { id: 'c1', name: 'Flores & Co.', category: 'Floristería', description: 'Especialistas en decoración floral para bodas', sort_order: 0 },
      { id: 'c2', name: 'Foto & Film Studio', category: 'Fotografía', description: 'Capturamos los momentos más especiales', sort_order: 1 },
    ],
    extra_services: [
      { id: 'e1', name: 'Photocall con atrezzo', price: '350€', sort_order: 0 },
      { id: 'e2', name: 'Barra de cócteles premium', price: '12€/pax', sort_order: 1 },
    ],
    menu_prices: [],
    experience: { id: 'exp1', title: 'Una finca con historia y carácter propio', body: 'Enclavada entre viñedos y bosques centenarios, nuestra finca lleva más de tres siglos siendo testigo de celebraciones únicas. Cada rincón ha sido cuidado para que vuestra boda sea exactamente como la habéis imaginado: íntima, elegante y completamente vuestra.' },
    techspecs: { id: 'ts1', sqm: '2.500 m² · Jardín 1.800 m²', parking: 'Aparcamiento gratuito para 150 vehículos', accessibility: 'Acceso adaptado en todas las zonas' },
    accommodation_info: { id: 'ac1', rooms: '8 habitaciones', description: 'Alojamiento en la propia finca para los novios y familia cercana.', price_info: 'Desde 150€/noche' },
    map_info: { id: 'map1', address: 'Carretera de la Finca, km 12 · 28000 Madrid', notes: 'A 40 min del centro de Madrid por la A-6' },
    budget_simulator: null,
    countdown: null,
  }

  const venueContent: VenueContent = {
    packages:            findMany('package').length        ? findMany('package')        : DEMO.packages,
    zones:               findMany('zone').length           ? findMany('zone')           : DEMO.zones,
    season_prices:       findMany('season_price').length   ? findMany('season_price')   : DEMO.season_prices,
    inclusions:          findMany('inclusion').length      ? findMany('inclusion')      : DEMO.inclusions,
    exclusions:          findMany('exclusion'),
    faq:                 findMany('faq').length            ? findMany('faq')            : DEMO.faq,
    testimonials:        findMany('testimonial').length    ? findMany('testimonial')    : DEMO.testimonials,
    collaborators:       findMany('collaborator').length   ? findMany('collaborator')   : DEMO.collaborators,
    extra_services:      findMany('extra_service').length  ? findMany('extra_service')  : DEMO.extra_services,
    menu_prices:         findMany('menu_price'),
    experience:          findOne('experience')        ?? DEMO.experience,
    techspecs:           findOne('techspecs')         ?? DEMO.techspecs,
    accommodation_info:  findOne('accommodation_info') ?? DEMO.accommodation_info,
    map_info:            findOne('map_info')           ?? DEMO.map_info,
    budget_simulator:    findOne('budget_simulator'),
    countdown:           findOne('countdown'),
  }

  const sd = (template.sections_data ?? {}) as any
  const proposalData: ProposalData = {
    id:                  `tpl-${id}`,
    slug:                `tpl-${id}`,
    couple_name:         'Sofía & Alejandro',
    personal_message:    sd.welcome_default ?? 'Queridos Sofía & Alejandro,\n\nEs un placer presentaros esta propuesta exclusiva que hemos preparado especialmente para vosotros. Estamos convencidos de que vuestra boda merece un espacio único, y creemos que nuestra finca es el escenario perfecto para ese día tan especial.\n\nEsperamos que esta propuesta refleje todo lo que podemos ofreceros.',
    guest_count:         150,
    wedding_date:        null,
    price_estimate:      null,
    show_availability:   false,
    show_price_estimate: false,
    status:              'preview',
    ctas:                [],
    sections_data:       template.sections_data,
    venueContent,
    venue:               venueData ?? null,
    branding:            brandingRow
      ? { logo_url: null, primary_color: brandingRow.accent_color ?? '#2d4a7a', font_family: brandingRow.font_family }
      : { logo_url: null, primary_color: '#2d4a7a' },
  }

  return <ProposalLanding data={proposalData} preview={true} />
}

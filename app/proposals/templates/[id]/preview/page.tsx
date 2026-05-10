// /proposals/templates/[id]/preview — renders the template as a fake proposal.
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
import ProposalLanding from '@/app/proposal/[slug]/ProposalLanding'
import type { ProposalData, VenueContent } from '@/app/proposal/[slug]/page'
import { getDefaultTemplate } from '@/lib/proposal-starter-templates'

const EMPTY_VENUE_CONTENT: VenueContent = {
  packages: [], zones: [], season_prices: [], inclusions: [], exclusions: [],
  faq: [], testimonials: [], collaborators: [], extra_services: [], menu_prices: [],
  experience: null, techspecs: null, accommodation_info: null, map_info: null,
  budget_simulator: null, countdown: null,
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
  photo_urls:     [] as string[],
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
      venueContent:        EMPTY_VENUE_CONTENT,
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
  }

  return <ProposalLanding data={proposalData} preview={true} />
}

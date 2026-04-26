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
    couple_name:         'Sofía & Alejandro',
    personal_message:    sd.welcome_default ?? null,
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
    branding,
  }

  return <ProposalLanding data={proposalData} preview={true} />
}

import { createClient } from '@supabase/supabase-js'
import CoupleLandingClient from './CoupleLandingClient'

export const dynamic = 'force-dynamic'

export default async function CoupleLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: client } = await supabase
    .from('wp_clients')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!client) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf9f7', fontFamily: 'Manrope, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💍</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#3d3530', marginBottom: 8 }}>Propuesta no encontrada</h1>
          <p style={{ fontSize: 14, color: '#9c8f88' }}>Este enlace no existe o ha caducado.</p>
        </div>
      </div>
    )
  }

  // Fetch venues + caterings (no join — venue_user_id FK points to auth.users, not venue_profiles)
  const [venuesRes, cateringsRes] = await Promise.all([
    supabase.from('wp_client_venues').select('*').eq('client_id', client.id).order('sort_order'),
    supabase.from('wp_client_caterings').select('*').eq('client_id', client.id).order('sort_order'),
  ])

  const venueRows    = venuesRes.data    || []
  const cateringRows = cateringsRes.data || []

  let venues: any[]    = venueRows
  let caterings: any[] = cateringRows

  if (venueRows.length > 0) {
    const ids = venueRows.map((v: any) => v.venue_user_id)

    const [{ data: profs }, { data: onbs }] = await Promise.all([
      supabase.from('venue_profiles').select('user_id, display_name, city, venue_type, venue_website, phone').in('user_id', ids),
      supabase.from('venue_onboarding').select('user_id, ficha_data').in('user_id', ids),
    ])

    const profMap = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p]))
    const onbMap  = Object.fromEntries((onbs  || []).map((o: any) => [o.user_id, o.ficha_data]))

    venues = venueRows.map((v: any) => {
      const fd = onbMap[v.venue_user_id] || {}
      return {
        ...v,
        venue_prof: profMap[v.venue_user_id] || null,
        hero_image: fd.heroImageUrl || null,
        gallery:    Array.isArray(fd.gallery) ? fd.gallery.filter(Boolean).slice(0, 8) : [],
        short_desc: fd.shortDesc || fd.miniDesc || null,
        capacity:   fd.capacity  || null,
        location:   fd.location  || null,
      }
    })
  }

  if (cateringRows.length > 0) {
    const ids = cateringRows.map((c: any) => c.catering_user_id)
    const { data: profs } = await supabase
      .from('venue_profiles')
      .select('user_id, display_name, city, venue_type, venue_website')
      .in('user_id', ids)
    const map = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p]))
    caterings = cateringRows.map((c: any) => ({ ...c, cat_prof: map[c.catering_user_id] || null }))
  }

  return (
    <CoupleLandingClient
      client={client}
      venues={venues}
      caterings={caterings}
    />
  )
}

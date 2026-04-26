import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const WP_URL = process.env.NEXT_PUBLIC_WP_URL || 'https://weddingvenuesspain.com'

// Usamos credenciales admin del servidor — el venue nunca necesita conectar su WP
function getAdminAuth() {
  const user = process.env.WORDPRESS_ADMIN_USER
  const pass = process.env.WORDPRESS_ADMIN_PASSWORD
  if (!user || !pass) throw new Error('WP admin credentials not configured')
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('venue_profiles')
      .select('wp_venue_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.wp_venue_id) {
      return NextResponse.json({ error: 'No tienes un venue asignado' }, { status: 403 })
    }

    const body = await req.json()
    const wpPayload: Record<string, any> = {}

    if (body.title   !== undefined) wpPayload.title   = body.title
    if (body.content !== undefined) wpPayload.content = body.content
    if (body.excerpt !== undefined) wpPayload.excerpt = body.excerpt

    const acf: Record<string, any> = {}
    const acfFields = [
      'H1_Venue', 'location', 'Short_Description_of_Venue',
      'venue_starting_price', 'Capacity_of_Venue', 'accommodation', 'Min_Nights_of_Venue',
      'h1_image', 'vertical_photo', 'h2-Venue_and_mini_description', 'start_of_post_content',
      'h2_gallery', 'h2_gallery_copy', 'h2_gallery_copy2', 'h2_gallery_copy3',
      'h2_gallery_copy4', 'h2_gallery_copy5', 'h2_gallery_copy6', 'h2_gallery_copy7',
      'starting_price_breakdown1', 'starting_price_breakdown_text_area_1',
      'starting_price_breakdown_3', 'starting_price_breakdown_text_area_3',
      'Starting_Price_Breakdown_3_LunchDinner_text_area', 'starting_price_breakdown_text_area_5',
      'starting_price_breakdown_4', 'starting_price_breakdown_text_area_4',
      'wvs_accommodation_help',
      'Specific_Location', 'Places_Nearby', 'Closest_Airport_to_Venue',
    ]
    acfFields.forEach(f => { if (body[f] !== undefined) acf[f] = body[f] })
    if (Object.keys(acf).length > 0) wpPayload.acf = acf

    const wpRes = await fetch(`${WP_URL}/wp-json/wp/v2/venues/${profile.wp_venue_id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAdminAuth(),
      },
      body: JSON.stringify(wpPayload),
    })

    const wpData = await wpRes.json()
    if (!wpRes.ok) {
      return NextResponse.json(
        { error: 'wp_error', message: wpData.message || 'Error al guardar en WordPress' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, venue: wpData })

  } catch (err) {
    console.error('[/api/venues/update]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

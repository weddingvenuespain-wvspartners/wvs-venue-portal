import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const WP_URL = process.env.NEXT_PUBLIC_WP_URL || 'https://weddingvenuesspain.com'

function getWpAdminAuth() {
  const user = process.env.WORDPRESS_ADMIN_USER
  const pass = process.env.WORDPRESS_ADMIN_PASSWORD
  if (!user || !pass) return null
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

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('venue_profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Solo el administrador puede crear venues' }, { status: 403 })
    }

    const auth = getWpAdminAuth()
    if (!auth) {
      return NextResponse.json(
        { error: 'WORDPRESS_ADMIN_USER o WORDPRESS_ADMIN_PASSWORD no configurados' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { onboarding_user_id, target_user_id, ...directData } = body

    let venueData: Record<string, any> = directData
    const targetUserId: string | null = onboarding_user_id || target_user_id || null

    if (onboarding_user_id) {
      const { data: onboarding } = await supabase
        .from('venue_onboarding')
        .select('*')
        .eq('user_id', onboarding_user_id)
        .single()

      if (!onboarding) {
        return NextResponse.json({ error: 'No se encontró el onboarding de ese usuario' }, { status: 404 })
      }
      venueData = onboarding
    }

    const wpPayload: Record<string, any> = {
      status: 'publish',
      title: venueData.name || venueData.H1_Venue || 'Nuevo venue',
      content: venueData.description || venueData.start_of_post_content || '',
      excerpt: venueData.short_bio || '',
      acf: {
        H1_Venue:                        venueData.name || venueData.H1_Venue || '',
        location:                        venueData.city || venueData.location || '',
        Short_Description_of_Venue:      venueData.short_bio || venueData.Short_Description_of_Venue || '',
        venue_starting_price:            venueData.price_min?.toString() || venueData.venue_starting_price || '',
        Capacity_of_Venue:               venueData.capacity_max?.toString() || venueData.Capacity_of_Venue || '',
        accommodation:                   venueData.accommodation || '',
        Min_Nights_of_Venue:             venueData.Min_Nights_of_Venue || '',
        'h2-Venue_and_mini_description': venueData['h2-Venue_and_mini_description'] || venueData.short_bio || '',
        start_of_post_content:           venueData.description || venueData.start_of_post_content || '',
        Specific_Location:               venueData.address || venueData.Specific_Location || '',
        Places_Nearby:                   venueData.Places_Nearby || '',
        Closest_Airport_to_Venue:        venueData.Closest_Airport_to_Venue || '',
      }
    }

    const wpRes = await fetch(`${WP_URL}/wp-json/wp/v2/venues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth,
      },
      body: JSON.stringify(wpPayload),
    })

    const wpData = await wpRes.json()

    if (!wpRes.ok) {
      console.error('[/api/venues/create] WP error:', wpData)
      return NextResponse.json(
        { error: 'wp_error', message: wpData.message || 'Error al crear el venue en WordPress' },
        { status: 500 }
      )
    }

    const newWpId = wpData.id

    if (targetUserId) {
      await supabase
        .from('venue_onboarding')
        .update({
          status: 'approved',
          wp_post_id: newWpId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('user_id', targetUserId)

      await supabase
        .from('venue_profiles')
        .update({
          wp_venue_id: newWpId,
          status: 'active',
        })
        .eq('user_id', targetUserId)
    }

    return NextResponse.json({
      success: true,
      wp_venue_id: newWpId,
      wp_url: wpData.link,
    })

  } catch (err) {
    console.error('[/api/venues/create]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

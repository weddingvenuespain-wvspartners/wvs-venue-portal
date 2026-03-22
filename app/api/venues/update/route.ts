import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const WP_URL = process.env.NEXT_PUBLIC_WP_URL || 'https://weddingvenuesspain.com'

export async function POST(req: NextRequest) {
  try {
    // 1. Verificar sesión de Supabase
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name) => cookieStore.get(name)?.value } }
    )

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // 2. Obtener perfil del usuario (wp_venue_id + wp_token)
    const { data: profile } = await supabase
      .from('venue_profiles')
      .select('wp_venue_id, wp_token')
      .eq('user_id', session.user.id)
      .single()

    if (!profile?.wp_venue_id) {
      return NextResponse.json({ error: 'No tienes un venue asignado' }, { status: 403 })
    }
    if (!profile?.wp_token) {
      return NextResponse.json({ error: 'Necesitas conectar tu cuenta de WordPress primero' }, { status: 403 })
    }

    // 3. Leer el body con todos los campos
    const body = await req.json()

    // 4. Construir el payload para la WP REST API
    //    Los campos ACF van dentro de { acf: { campo: valor } }
    //    El título y el content van en el nivel raíz
    const wpPayload: Record<string, any> = {}

    // Campos raíz de WP
    if (body.title !== undefined)   wpPayload.title   = body.title
    if (body.content !== undefined) wpPayload.content = body.content
    if (body.excerpt !== undefined) wpPayload.excerpt = body.excerpt

    // Campos ACF
    const acf: Record<string, any> = {}

    // Sección 1 — Info principal
    if (body.H1_Venue                !== undefined) acf.H1_Venue                = body.H1_Venue
    if (body.location                !== undefined) acf.location                = body.location
    if (body.Short_Description_of_Venue !== undefined) acf.Short_Description_of_Venue = body.Short_Description_of_Venue
    if (body.venue_starting_price    !== undefined) acf.venue_starting_price    = body.venue_starting_price
    if (body.Capacity_of_Venue       !== undefined) acf.Capacity_of_Venue       = body.Capacity_of_Venue
    if (body.accommodation           !== undefined) acf.accommodation           = body.accommodation
    if (body.Min_Nights_of_Venue     !== undefined) acf.Min_Nights_of_Venue     = body.Min_Nights_of_Venue

    // Sección 2 — Descripción e imagen principal
    if (body.h1_image                    !== undefined) acf.h1_image                    = body.h1_image
    if (body['h2-Venue_and_mini_description'] !== undefined) acf['h2-Venue_and_mini_description'] = body['h2-Venue_and_mini_description']
    if (body.start_of_post_content       !== undefined) acf.start_of_post_content       = body.start_of_post_content

    // Sección 3 — Galerías horizontales (hasta 8 imágenes individuales)
    const hGalleryFields = [
      'h2_gallery', 'h2_gallery_copy', 'h2_gallery_copy2', 'h2_gallery_copy3',
      'h2_gallery_copy4', 'h2_gallery_copy5', 'h2_gallery_copy6', 'h2_gallery_copy7'
    ]
    hGalleryFields.forEach(field => {
      if (body[field] !== undefined) acf[field] = body[field]
    })

    // Sección 4 — Desglose de precios
    if (body.starting_price_breakdown1           !== undefined) acf.starting_price_breakdown1           = body.starting_price_breakdown1
    if (body.starting_price_breakdown_text_area_1 !== undefined) acf.starting_price_breakdown_text_area_1 = body.starting_price_breakdown_text_area_1
    if (body.starting_price_breakdown_3          !== undefined) acf.starting_price_breakdown_3          = body.starting_price_breakdown_3
    if (body.starting_price_breakdown_text_area_3 !== undefined) acf.starting_price_breakdown_text_area_3 = body.starting_price_breakdown_text_area_3
    if (body.Starting_Price_Breakdown_3_LunchDinner_text_area !== undefined) acf.Starting_Price_Breakdown_3_LunchDinner_text_area = body.Starting_Price_Breakdown_3_LunchDinner_text_area
    if (body.starting_price_breakdown_text_area_5 !== undefined) acf.starting_price_breakdown_text_area_5 = body.starting_price_breakdown_text_area_5
    if (body.starting_price_breakdown_4          !== undefined) acf.starting_price_breakdown_4          = body.starting_price_breakdown_4
    if (body.starting_price_breakdown_text_area_4 !== undefined) acf.starting_price_breakdown_text_area_4 = body.starting_price_breakdown_text_area_4

    // Sección 5 — Ubicación
    if (body.Specific_Location      !== undefined) acf.Specific_Location      = body.Specific_Location
    if (body.Places_Nearby          !== undefined) acf.Places_Nearby          = body.Places_Nearby
    if (body.Closest_Airport_to_Venue !== undefined) acf.Closest_Airport_to_Venue = body.Closest_Airport_to_Venue

    // Galerías Photo Gallery (section_2_image y end_gallery)
    // Estas galerías ACF esperan un array de IDs de media de WP
    if (body.section_2_image !== undefined) acf.section_2_image = body.section_2_image
    if (body.end_gallery     !== undefined) acf.end_gallery     = body.end_gallery

    if (Object.keys(acf).length > 0) {
      wpPayload.acf = acf
    }

    // 5. Llamar a la WP REST API
    const wpRes = await fetch(
      `${WP_URL}/wp-json/wp/v2/wedding-venues/${profile.wp_venue_id}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${profile.wp_token}`,
        },
        body: JSON.stringify(wpPayload),
      }
    )

    const wpData = await wpRes.json()

    // 6. Token expirado → informar al cliente para que reconecte
    if (!wpRes.ok) {
      if (wpData.code === 'jwt_auth_invalid_token' || wpData.code === 'jwt_auth_expired') {
        return NextResponse.json(
          { error: 'token_expired', message: 'Tu sesión de WordPress ha expirado. Vuelve a conectar tu cuenta.' },
          { status: 401 }
        )
      }
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

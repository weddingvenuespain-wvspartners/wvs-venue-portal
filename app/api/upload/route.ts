import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const WP_URL = process.env.NEXT_PUBLIC_WP_URL || 'https://weddingvenuesspain.com'

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

    const { data: profile } = await supabase
      .from('venue_profiles')
      .select('wp_token, wp_venue_id')
      .eq('user_id', session.user.id)
      .single()

    if (!profile?.wp_token) {
      return NextResponse.json({ error: 'Necesitas conectar tu cuenta de WordPress primero' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no permitido. Usa JPG, PNG, WEBP o GIF.' },
        { status: 400 }
      )
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'El archivo es demasiado grande. Máximo 10MB.' },
        { status: 400 }
      )
    }

    const fileBuffer = await file.arrayBuffer()

    const wpRes = await fetch(`${WP_URL}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${profile.wp_token}`,
        'Content-Disposition': `attachment; filename="${file.name}"`,
        'Content-Type': file.type,
      },
      body: fileBuffer,
    })

    const wpData = await wpRes.json()

    if (!wpRes.ok) {
      if (wpData.code === 'jwt_auth_invalid_token' || wpData.code === 'jwt_auth_expired') {
        return NextResponse.json(
          { error: 'token_expired', message: 'Tu sesión de WordPress ha expirado.' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: 'wp_error', message: wpData.message || 'Error al subir imagen a WordPress' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      id: wpData.id,
      url: wpData.source_url,
      thumbnail: wpData.media_details?.sizes?.thumbnail?.source_url || wpData.source_url,
      full: wpData.source_url,
    })

  } catch (err) {
    console.error('[/api/upload]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

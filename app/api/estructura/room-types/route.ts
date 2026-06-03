import { NextRequest, NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// GET  /api/estructura/room-types?commercial_config_id=xxx  — list room types for a lodging config
// POST /api/estructura/room-types — create a room type

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const configId = req.nextUrl.searchParams.get('commercial_config_id')
    const venueId  = req.nextUrl.searchParams.get('venue_id')

    const svc = getServiceClient()
    let query = svc
      .from('venue_room_types')
      .select(`
        *,
        prices:venue_room_prices(*)
      `)
      .eq('user_id', session.user.id)

    if (configId) query = query.eq('commercial_config_id', configId)
    if (venueId)  query = query.eq('venue_id', venueId)

    const { data, error } = await query.order('sort_order')
    if (error) {
      console.error('[room-types GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ room_types: data ?? [] })
  } catch (err: any) {
    console.error('[room-types GET]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { venue_id, commercial_config_id, name, description, total_quantity, capacity_persons, bed_config, features, photo_urls, sort_order } = body

    if (!venue_id) return NextResponse.json({ error: 'venue_id requerido' }, { status: 400 })
    if (!commercial_config_id) return NextResponse.json({ error: 'commercial_config_id requerido' }, { status: 400 })
    if (!name?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('venue_room_types')
      .insert({
        user_id:              session.user.id,
        venue_id,
        commercial_config_id,
        name:                 name.trim(),
        description:          description?.trim() || null,
        total_quantity:       total_quantity ?? 1,
        capacity_persons:     capacity_persons ?? 2,
        bed_config:           bed_config?.trim() || null,
        features:             features ?? [],
        photo_urls:           photo_urls ?? [],
        sort_order:           sort_order ?? 0,
      })
      .select()
      .single()

    if (error) {
      console.error('[room-types POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ room_type: data })
  } catch (err: any) {
    console.error('[room-types POST]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

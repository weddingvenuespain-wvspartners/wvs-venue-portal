import { NextRequest, NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const configId = req.nextUrl.searchParams.get('commercial_config_id')

    const svc = getServiceClient()
    let query = svc.from('venue_room_extras').select('*').eq('user_id', session.user.id)
    if (configId) query = query.eq('commercial_config_id', configId)

    const { data, error } = await query.order('sort_order')
    if (error) {
      console.error('[room-extras GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ extras: data ?? [] })
  } catch (err: any) {
    console.error('[room-extras GET]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { venue_id, commercial_config_id, name, description, pricing_unit, price, applies_to_room_types, is_default_included, sort_order } = body

    if (!venue_id) return NextResponse.json({ error: 'venue_id requerido' }, { status: 400 })
    if (!commercial_config_id) return NextResponse.json({ error: 'commercial_config_id requerido' }, { status: 400 })
    if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
    if (!['per_person_per_night','per_night','per_person','flat'].includes(pricing_unit)) {
      return NextResponse.json({ error: 'pricing_unit inválido' }, { status: 400 })
    }

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('venue_room_extras')
      .insert({
        user_id:               session.user.id,
        venue_id,
        commercial_config_id,
        name:                  name.trim(),
        description:           description?.trim() || null,
        pricing_unit,
        price:                 price ?? 0,
        applies_to_room_types: applies_to_room_types ?? null,
        is_default_included:   !!is_default_included,
        sort_order:            sort_order ?? 0,
      })
      .select()
      .single()

    if (error) {
      console.error('[room-extras POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ extra: data })
  } catch (err: any) {
    console.error('[room-extras POST]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

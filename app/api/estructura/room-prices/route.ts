import { NextRequest, NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// GET  /api/estructura/room-prices?room_type_id=xxx — list prices for room type
// POST /api/estructura/room-prices — create price

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const roomTypeId = req.nextUrl.searchParams.get('room_type_id')

    const svc = getServiceClient()
    let query = svc.from('venue_room_prices').select('*').eq('user_id', session.user.id)
    if (roomTypeId) query = query.eq('room_type_id', roomTypeId)

    const { data, error } = await query.order('date_from')
    if (error) {
      console.error('[room-prices GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ prices: data ?? [] })
  } catch (err: any) {
    console.error('[room-prices GET]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { room_type_id, date_from, date_to, price_per_night, min_nights, price_tiers, notes } = body

    if (!room_type_id) return NextResponse.json({ error: 'room_type_id requerido' }, { status: 400 })
    if (!date_from || !date_to) return NextResponse.json({ error: 'Fechas requeridas' }, { status: 400 })
    if (price_per_night == null) return NextResponse.json({ error: 'Precio requerido' }, { status: 400 })

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('venue_room_prices')
      .insert({
        user_id:         session.user.id,
        room_type_id,
        date_from,
        date_to,
        price_per_night,
        min_nights:      min_nights ?? 1,
        price_tiers:     price_tiers ?? null,
        notes:           notes?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[room-prices POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ price: data })
  } catch (err: any) {
    console.error('[room-prices POST]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// GET /api/estructura/room-blocks?room_type_id=&from=&to=  — list blocks (optional date range)
// POST /api/estructura/room-blocks — create manual block

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const roomTypeId = req.nextUrl.searchParams.get('room_type_id')
    const configId = req.nextUrl.searchParams.get('commercial_config_id')
    const from = req.nextUrl.searchParams.get('from')
    const to   = req.nextUrl.searchParams.get('to')

    const svc = getServiceClient()
    let query = svc.from('venue_room_blocks').select('*').eq('user_id', session.user.id)

    if (roomTypeId) query = query.eq('room_type_id', roomTypeId)
    else if (configId) {
      // Filter via room types belonging to the config
      const { data: rts } = await svc.from('venue_room_types').select('id').eq('commercial_config_id', configId).eq('user_id', session.user.id)
      const ids = (rts ?? []).map((r: any) => r.id)
      if (ids.length === 0) return NextResponse.json({ blocks: [] })
      query = query.in('room_type_id', ids)
    }

    if (from && to) {
      // Overlap: block.date_from <= to AND block.date_to >= from
      query = query.lte('date_from', to).gte('date_to', from)
    }

    const { data, error } = await query.order('date_from')
    if (error) {
      console.error('[room-blocks GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ blocks: data ?? [] })
  } catch (err: any) {
    console.error('[room-blocks GET]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { room_type_id, date_from, date_to, quantity_blocked, reason, proposal_id, notes } = body

    if (!room_type_id || !date_from || !date_to || !quantity_blocked) {
      return NextResponse.json({ error: 'Campos requeridos faltantes' }, { status: 400 })
    }
    const r = reason && ['manual','reserva','mantenimiento','pms_externo'].includes(reason) ? reason : 'manual'

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('venue_room_blocks')
      .insert({
        user_id: session.user.id,
        room_type_id,
        date_from,
        date_to,
        quantity_blocked,
        reason: r,
        proposal_id: proposal_id ?? null,
        notes: notes?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[room-blocks POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ block: data })
  } catch (err: any) {
    console.error('[room-blocks POST]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

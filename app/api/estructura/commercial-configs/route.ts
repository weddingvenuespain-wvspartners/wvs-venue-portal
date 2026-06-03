import { NextRequest, NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// GET  /api/estructura/commercial-configs?venue_id=xxx — list all configs for venue
// POST /api/estructura/commercial-configs — create a new config

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const venueId = req.nextUrl.searchParams.get('venue_id')
    const svc = getServiceClient()

    let query = svc
      .from('venue_commercial_configs')
      .select('*')
      .eq('user_id', session.user.id)

    if (venueId) query = query.eq('venue_id', venueId)

    const { data, error } = await query.order('sort_order').order('created_at')

    if (error) {
      console.error('[commercial-configs GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ configs: data ?? [] })
  } catch (err: any) {
    console.error('[commercial-configs GET]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { venue_id, name, config, is_default, sort_order, config_type } = body

    if (!venue_id) return NextResponse.json({ error: 'venue_id requerido' }, { status: 400 })
    if (!name?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

    const ct = config_type === 'lodging' ? 'lodging' : 'space'

    const svc = getServiceClient()

    // If marking as default, unmark others first (only within same config_type)
    if (is_default) {
      await svc
        .from('venue_commercial_configs')
        .update({ is_default: false })
        .eq('user_id', session.user.id)
        .eq('venue_id', venue_id)
        .eq('config_type', ct)
    }

    const { data, error } = await svc
      .from('venue_commercial_configs')
      .insert({
        user_id: session.user.id,
        venue_id,
        name: name.trim(),
        config: config ?? {},
        config_type: ct,
        is_default: is_default ?? false,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single()

    if (error) {
      console.error('[commercial-configs POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ config: data })
  } catch (err: any) {
    console.error('[commercial-configs POST]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// GET  /api/estructura/modalities — list all modalities for the user
// POST /api/estructura/modalities — create a new modality

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const venueId = req.nextUrl.searchParams.get('venue_id')
    const configId = req.nextUrl.searchParams.get('commercial_config_id')

    const svc = getServiceClient()
    let query = svc
      .from('venue_modalities')
      .select(`
        *,
        packages:venue_modality_packages(
          *,
          prices:venue_modality_prices(*)
        ),
        prices:venue_modality_prices(*)
      `)
      .eq('user_id', session.user.id)
    if (venueId) query = query.eq('venue_id', venueId)
    if (configId) query = query.eq('commercial_config_id', configId)
    const { data, error } = await query
      .order('sort_order')
      .order('sort_order', { referencedTable: 'venue_modality_packages' })

    if (error) {
      console.error('[/api/estructura/modalities GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ modalities: data ?? [] })
  } catch (err: any) {
    console.error('[/api/estructura/modalities GET]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { name, description, duration_label, duration_type, day_from, day_to, sort_order, venue_id, commercial_config_id, linked_menu_ids, days_of_week, includes, min_guests, max_guests } = body

    if (!name?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    if (!commercial_config_id) return NextResponse.json({ error: 'commercial_config_id requerido — toda modalidad pertenece a una configuración' }, { status: 400 })

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('venue_modalities')
      .insert({
        user_id:        session.user.id,
        venue_id:       venue_id ?? null,
        commercial_config_id: commercial_config_id ?? null,
        name:           name.trim(),
        description:    description?.trim() || null,
        duration_label: duration_label?.trim() || null,
        duration_type:  duration_type ?? 'custom',
        day_from:       day_from ?? null,
        day_to:         day_to   ?? null,
        sort_order:     sort_order ?? 0,
        linked_menu_ids: linked_menu_ids ?? null,
        days_of_week:   days_of_week ?? null,
        includes:       includes ?? null,
        min_guests:     min_guests ?? null,
        max_guests:     max_guests ?? null,
      })
      .select()
      .single()

    if (error) {
      console.error('[/api/estructura/modalities POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ modality: data })
  } catch (err: any) {
    console.error('[/api/estructura/modalities POST]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

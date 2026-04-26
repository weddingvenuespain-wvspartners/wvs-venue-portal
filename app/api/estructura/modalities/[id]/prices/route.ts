import { NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// GET  /api/estructura/modalities/[id]/prices — list prices for a modality
// POST /api/estructura/modalities/[id]/prices — add a price range

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('venue_modality_prices')
      .select('*')
      .eq('modality_id', id)
      .eq('user_id', session.user.id)
      .order('date_from')

    if (error) {
      console.error('[/api/estructura/prices GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ prices: data ?? [] })
  } catch (err: any) {
    console.error('[/api/estructura/prices GET]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { date_from, date_to, price, notes, day_from, day_to, price_per_person, zone_prices, supplement_prices } = body

    if (!date_from || !date_to) return NextResponse.json({ error: 'Las fechas son obligatorias' }, { status: 400 })
    if (price === undefined || price === null) return NextResponse.json({ error: 'El precio es obligatorio' }, { status: 400 })
    if (date_to < date_from) return NextResponse.json({ error: 'La fecha de fin debe ser posterior a la de inicio' }, { status: 400 })

    // Verify the modality belongs to this user
    const svc = getServiceClient()
    const { data: modal } = await svc
      .from('venue_modalities')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (!modal) return NextResponse.json({ error: 'Modalidad no encontrada' }, { status: 404 })

    const { data, error } = await svc
      .from('venue_modality_prices')
      .insert({
        modality_id:       id,
        user_id:           session.user.id,
        date_from,
        date_to,
        price:             parseFloat(price),
        notes:             notes?.trim() || null,
        day_from:          day_from          ?? null,
        day_to:            day_to            ?? null,
        price_per_person:  price_per_person  != null ? parseFloat(price_per_person) : null,
        zone_prices:       zone_prices       ?? null,
        supplement_prices: supplement_prices ?? null,
      })
      .select()
      .single()

    if (error) {
      console.error('[/api/estructura/prices POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ price: data })
  } catch (err: any) {
    console.error('[/api/estructura/prices POST]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

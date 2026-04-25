import { NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// PATCH  /api/estructura/prices/[id] — update a price range
// DELETE /api/estructura/prices/[id] — delete a price range

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { date_from, date_to, price, notes, day_from, day_to, price_per_person, zone_prices, supplement_prices } = body

    if (date_from && date_to && date_to < date_from)
      return NextResponse.json({ error: 'La fecha de fin debe ser posterior a la de inicio' }, { status: 400 })

    const update: Record<string, any> = {}
    if (date_from          !== undefined) update.date_from          = date_from
    if (date_to            !== undefined) update.date_to            = date_to
    if (price              !== undefined) update.price              = parseFloat(price)
    if (notes              !== undefined) update.notes              = notes?.trim() || null
    if (day_from           !== undefined) update.day_from           = day_from
    if (day_to             !== undefined) update.day_to             = day_to
    if (price_per_person   !== undefined) update.price_per_person   = price_per_person != null ? parseFloat(price_per_person) : null
    if (zone_prices        !== undefined) update.zone_prices        = zone_prices
    if (supplement_prices  !== undefined) update.supplement_prices  = supplement_prices

    if (Object.keys(update).length === 0)
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('venue_modality_prices')
      .update(update)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('[/api/estructura/prices PATCH]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ price: data })
  } catch (err: any) {
    console.error('[/api/estructura/prices PATCH]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const svc = getServiceClient()
    const { error } = await svc
      .from('venue_modality_prices')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('[/api/estructura/prices DELETE]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[/api/estructura/prices DELETE]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

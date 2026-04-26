import { NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// GET  /api/estructura/packages/[id]/prices — list prices for a package
// POST /api/estructura/packages/[id]/prices — create a price for a package

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('venue_modality_prices')
      .select('*')
      .eq('package_id', id)
      .eq('user_id', session.user.id)
      .order('date_from')

    if (error) {
      console.error('[/api/estructura/packages/prices GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ prices: data ?? [] })
  } catch (err: any) {
    console.error('[/api/estructura/packages/prices GET]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { date_from, date_to, price, notes, price_per_person, zone_prices, supplement_prices } = body

    if (!date_from || !date_to) return NextResponse.json({ error: 'Las fechas son obligatorias' }, { status: 400 })
    if (price === undefined || price === null) return NextResponse.json({ error: 'El precio es obligatorio' }, { status: 400 })
    if (date_to < date_from) return NextResponse.json({ error: 'La fecha de fin debe ser posterior a la de inicio' }, { status: 400 })

    const svc = getServiceClient()

    // Verify the package belongs to this user and get its modality_id
    const { data: pkg } = await svc
      .from('venue_modality_packages')
      .select('id, modality_id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (!pkg) return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 })

    const { data, error } = await svc
      .from('venue_modality_prices')
      .insert({
        package_id:        id,
        modality_id:       pkg.modality_id,
        user_id:           session.user.id,
        date_from,
        date_to,
        price:             parseFloat(price),
        notes:             notes?.trim() || null,
        price_per_person:  price_per_person  != null ? parseFloat(price_per_person) : null,
        zone_prices:       zone_prices       ?? null,
        supplement_prices: supplement_prices ?? null,
      })
      .select()
      .single()

    if (error) {
      console.error('[/api/estructura/packages/prices POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ price: data })
  } catch (err: any) {
    console.error('[/api/estructura/packages/prices POST]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// GET  /api/estructura/modalities/[id]/packages — list packages for a modality
// POST /api/estructura/modalities/[id]/packages — create a package slot

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('venue_modality_packages')
      .select('*, prices:venue_modality_prices(*)')
      .eq('modality_id', id)
      .eq('user_id', session.user.id)
      .order('sort_order')

    if (error) {
      console.error('[/api/estructura/packages GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ packages: data ?? [] })
  } catch (err: any) {
    console.error('[/api/estructura/packages GET]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { day_from, day_to, label, sort_order, venue_id, name, description, includes, min_guests, max_guests, linked_menu_ids } = body

    const svc = getServiceClient()

    // Verify modality belongs to user
    const { data: modal } = await svc
      .from('venue_modalities')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (!modal) return NextResponse.json({ error: 'Modalidad no encontrada' }, { status: 404 })

    const { data, error } = await svc
      .from('venue_modality_packages')
      .insert({
        modality_id: id,
        user_id:     session.user.id,
        venue_id:    venue_id ?? null,
        day_from:    day_from ?? null,
        day_to:      day_to ?? null,
        label:       label?.trim() || null,
        name:        name?.trim() || null,
        description: description?.trim() || null,
        includes:    includes ?? null,
        min_guests:  min_guests ?? null,
        max_guests:  max_guests ?? null,
        linked_menu_ids: linked_menu_ids ?? null,
        sort_order:  sort_order ?? 0,
      })
      .select()
      .single()

    if (error) {
      console.error('[/api/estructura/packages POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ package: { ...data, prices: [] } })
  } catch (err: any) {
    console.error('[/api/estructura/packages POST]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

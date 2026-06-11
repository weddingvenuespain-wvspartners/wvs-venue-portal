import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/auth-server'
import { requireFeature } from '@/lib/plan-server'

// GET  /api/estructura/modalities/[id]/packages — list packages for a modality
// POST /api/estructura/modalities/[id]/packages — create a package slot

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const gate = await requireFeature('estructura')
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('venue_modality_packages')
      .select('*, prices:venue_modality_prices(*)')
      .eq('modality_id', id)
      .eq('user_id', gate.userId)
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
    const gate = await requireFeature('estructura')
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const body = await req.json()
    const { day_from, day_to, label, sort_order, venue_id } = body

    if (day_from === undefined || day_from === null) return NextResponse.json({ error: 'day_from es obligatorio' }, { status: 400 })
    if (day_to   === undefined || day_to   === null) return NextResponse.json({ error: 'day_to es obligatorio' },   { status: 400 })

    const svc = getServiceClient()

    // Verify modality belongs to user
    const { data: modal } = await svc
      .from('venue_modalities')
      .select('id')
      .eq('id', id)
      .eq('user_id', gate.userId)
      .maybeSingle()

    if (!modal) return NextResponse.json({ error: 'Modalidad no encontrada' }, { status: 404 })

    const { data, error } = await svc
      .from('venue_modality_packages')
      .insert({
        modality_id: id,
        user_id:     gate.userId,
        venue_id:    venue_id ?? null,
        day_from,
        day_to,
        label:       label?.trim() || null,
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

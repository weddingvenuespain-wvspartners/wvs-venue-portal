import { NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// PATCH  /api/estructura/packages/[id] — update a package slot
// DELETE /api/estructura/packages/[id] — delete a package slot (and its prices via CASCADE)

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { day_from, day_to, label, sort_order } = body

    const update: Record<string, any> = {}
    if (day_from    !== undefined) update.day_from   = day_from
    if (day_to      !== undefined) update.day_to     = day_to
    if (label       !== undefined) update.label      = label?.trim() || null
    if (sort_order  !== undefined) update.sort_order = sort_order

    if (Object.keys(update).length === 0)
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })


    const svc = getServiceClient()
    const { data, error } = await svc
      .from('venue_modality_packages')
      .update(update)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('[/api/estructura/packages PATCH]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ package: data })
  } catch (err: any) {
    console.error('[/api/estructura/packages PATCH]', err)
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
      .from('venue_modality_packages')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('[/api/estructura/packages DELETE]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[/api/estructura/packages DELETE]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

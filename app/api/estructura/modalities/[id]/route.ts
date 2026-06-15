import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/auth-server'
import { requireFeature } from '@/lib/plan-server'

// PATCH  /api/estructura/modalities/[id] — update modality
// DELETE /api/estructura/modalities/[id] — delete modality

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const gate = await requireFeature('estructura')
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const body = await req.json()
    const { name, description, duration_label, duration_type, day_from, day_to, sort_order, is_active, commercial_config_id, linked_menu_ids, days_of_week, includes, min_guests, max_guests } = body

    const update: Record<string, any> = {}
    if (name !== undefined)           update.name           = name.trim()
    if (description !== undefined)    update.description    = description?.trim() || null
    if (duration_label !== undefined) update.duration_label = duration_label?.trim() || null
    if (duration_type !== undefined)  update.duration_type  = duration_type
    if (day_from !== undefined)       update.day_from       = day_from
    if (day_to   !== undefined)       update.day_to         = day_to
    if (sort_order !== undefined)     update.sort_order     = sort_order
    if (is_active !== undefined)      update.is_active      = is_active
    if (commercial_config_id !== undefined) update.commercial_config_id = commercial_config_id
    if (linked_menu_ids !== undefined) update.linked_menu_ids = linked_menu_ids
    if (days_of_week !== undefined) update.days_of_week = days_of_week
    if (includes !== undefined) update.includes = includes
    if (min_guests !== undefined) update.min_guests = min_guests
    if (max_guests !== undefined) update.max_guests = max_guests

    if (Object.keys(update).length === 0)
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('venue_modalities')
      .update(update)
      .eq('id', id)
      .eq('user_id', gate.userId)
      .select()
      .single()

    if (error) {
      console.error('[/api/estructura/modalities PATCH]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ modality: data })
  } catch (err: any) {
    console.error('[/api/estructura/modalities PATCH]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const gate = await requireFeature('estructura')
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const svc = getServiceClient()
    const { error } = await svc
      .from('venue_modalities')
      .delete()
      .eq('id', id)
      .eq('user_id', gate.userId)

    if (error) {
      console.error('[/api/estructura/modalities DELETE]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[/api/estructura/modalities DELETE]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

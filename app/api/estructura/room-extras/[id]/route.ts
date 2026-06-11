import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/auth-server'
import { requireFeature } from '@/lib/plan-server'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const gate = await requireFeature('estructura')
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const { id } = await ctx.params
    const body = await req.json()
    const patch: Record<string, any> = {}
    const fields = ['name','description','pricing_unit','price','applies_to_room_types','is_default_included','sort_order','is_active']
    for (const f of fields) if (f in body) patch[f] = body[f]

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('venue_room_extras')
      .update(patch)
      .eq('id', id)
      .eq('user_id', gate.userId)
      .select()
      .single()

    if (error) {
      console.error('[room-extras PATCH]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ extra: data })
  } catch (err: any) {
    console.error('[room-extras PATCH]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const gate = await requireFeature('estructura')
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const { id } = await ctx.params
    const svc = getServiceClient()
    const { error } = await svc.from('venue_room_extras').delete().eq('id', id).eq('user_id', gate.userId)

    if (error) {
      console.error('[room-extras DELETE]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[room-extras DELETE]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/auth-server'
import { requireFeature } from '@/lib/plan-server'

// GET    /api/estructura/commercial-configs/:id
// PATCH  /api/estructura/commercial-configs/:id
// DELETE /api/estructura/commercial-configs/:id

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const gate = await requireFeature('estructura')
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const { id } = await ctx.params
    const svc = getServiceClient()

    const { data, error } = await svc
      .from('venue_commercial_configs')
      .select('*')
      .eq('id', id)
      .eq('user_id', gate.userId)
      .single()

    if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ config: data })
  } catch (err: any) {
    console.error('[commercial-configs/:id GET]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const gate = await requireFeature('estructura')
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const { id } = await ctx.params
    const body = await req.json()
    const svc = getServiceClient()

    // If marking as default, unmark others first
    if (body.is_default) {
      // Get the venue_id for this config
      const { data: existing } = await svc
        .from('venue_commercial_configs')
        .select('venue_id')
        .eq('id', id)
        .eq('user_id', gate.userId)
        .single()

      if (existing) {
        await svc
          .from('venue_commercial_configs')
          .update({ is_default: false })
          .eq('user_id', gate.userId)
          .eq('venue_id', existing.venue_id)
          .neq('id', id)
      }
    }

    const { data, error } = await svc
      .from('venue_commercial_configs')
      .update(body)
      .eq('id', id)
      .eq('user_id', gate.userId)
      .select()
      .single()

    if (error) {
      console.error('[commercial-configs/:id PATCH]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ config: data })
  } catch (err: any) {
    console.error('[commercial-configs/:id PATCH]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const gate = await requireFeature('estructura')
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const { id } = await ctx.params
    const svc = getServiceClient()

    // Delete modalities belonging to this config first (defensive — modalities die with their config)
    await svc
      .from('venue_modalities')
      .delete()
      .eq('commercial_config_id', id)
      .eq('user_id', gate.userId)

    const { error } = await svc
      .from('venue_commercial_configs')
      .delete()
      .eq('id', id)
      .eq('user_id', gate.userId)

    if (error) {
      console.error('[commercial-configs/:id DELETE]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[commercial-configs/:id DELETE]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

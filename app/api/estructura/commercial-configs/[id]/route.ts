import { NextRequest, NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// GET    /api/estructura/commercial-configs/:id
// PATCH  /api/estructura/commercial-configs/:id
// DELETE /api/estructura/commercial-configs/:id

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await ctx.params
    const svc = getServiceClient()

    const { data, error } = await svc
      .from('venue_commercial_configs')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
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
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

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
        .eq('user_id', session.user.id)
        .single()

      if (existing) {
        await svc
          .from('venue_commercial_configs')
          .update({ is_default: false })
          .eq('user_id', session.user.id)
          .eq('venue_id', existing.venue_id)
          .neq('id', id)
      }
    }

    const { data, error } = await svc
      .from('venue_commercial_configs')
      .update(body)
      .eq('id', id)
      .eq('user_id', session.user.id)
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
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await ctx.params
    const svc = getServiceClient()

    // Delete modalities belonging to this config first (defensive — modalities die with their config)
    await svc
      .from('venue_modalities')
      .delete()
      .eq('commercial_config_id', id)
      .eq('user_id', session.user.id)

    const { error } = await svc
      .from('venue_commercial_configs')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

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

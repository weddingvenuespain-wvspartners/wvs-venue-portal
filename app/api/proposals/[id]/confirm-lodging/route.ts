import { NextRequest, NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/proposals/:id/confirm-lodging
// Reads proposal_room_selections, creates venue_room_blocks (reason='reserva'),
// linked to this proposal. Idempotent: deletes prior 'reserva' blocks for the proposal first.

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await ctx.params
    const svc = getServiceClient()

    // Verify ownership
    const { data: prop } = await svc.from('proposals').select('user_id').eq('id', id).single()
    if (!prop || prop.user_id !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Clear previous blocks for this proposal
    await svc.from('venue_room_blocks').delete().eq('proposal_id', id).eq('reason', 'reserva')

    // Load selections
    const { data: sels } = await svc.from('proposal_room_selections').select('*').eq('proposal_id', id)
    const selections = sels ?? []

    if (selections.length === 0) {
      return NextResponse.json({ ok: true, blocks_created: 0 })
    }

    const blocks = selections.map((s: any) => ({
      user_id:          session.user.id,
      room_type_id:     s.room_type_id,
      date_from:        s.check_in,
      date_to:          s.check_out,
      quantity_blocked: s.quantity,
      reason:           'reserva',
      proposal_id:      id,
    }))

    const { error } = await svc.from('venue_room_blocks').insert(blocks)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, blocks_created: blocks.length })
  } catch (err: any) {
    console.error('[confirm-lodging]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE — release blocks (cancel reservation)
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await ctx.params
    const svc = getServiceClient()

    const { data: prop } = await svc.from('proposals').select('user_id').eq('id', id).single()
    if (!prop || prop.user_id !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { error } = await svc.from('venue_room_blocks').delete().eq('proposal_id', id).eq('reason', 'reserva')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

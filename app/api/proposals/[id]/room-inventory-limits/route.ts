import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/auth-server'
import { requireFeature } from '@/lib/plan-server'

type Ctx = { params: Promise<{ id: string }> }

// GET — public read (dossier needs it)
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const svc = getServiceClient()
    const { data, error } = await svc
      .from('proposal_room_inventory_limits')
      .select('*')
      .eq('proposal_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ limits: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST — replace all limits for proposal (venue editor)
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const gate = await requireFeature('propuestas')
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const { id } = await ctx.params
    const body = await req.json()
    const limits = Array.isArray(body.limits) ? body.limits : []

    const svc = getServiceClient()

    // Verify ownership
    const { data: prop } = await svc.from('proposals').select('user_id').eq('id', id).single()
    if (!prop || prop.user_id !== gate.userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    await svc.from('proposal_room_inventory_limits').delete().eq('proposal_id', id)

    if (limits.length > 0) {
      const rows = limits.map((l: any) => ({
        proposal_id:  id,
        room_type_id: l.room_type_id,
        max_quantity: l.max_quantity,
      }))
      const { error } = await svc.from('proposal_room_inventory_limits').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/auth-server'

// PUBLIC endpoints — used by dossier landing page (client selects rooms)
// Proposal slug already authorizes; we use ID via the URL param.

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const svc = getServiceClient()
    const { data, error } = await svc
      .from('proposal_room_selections')
      .select('*')
      .eq('proposal_id', id)
      .order('created_at')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ selections: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST — replace all selections for a proposal (simplest approach for selector UI)
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const body = await req.json()
    const selections = Array.isArray(body.selections) ? body.selections : []

    const svc = getServiceClient()
    // Delete existing
    await svc.from('proposal_room_selections').delete().eq('proposal_id', id)
    // Insert new
    if (selections.length > 0) {
      const rows = selections.map((s: any) => ({
        proposal_id:     id,
        room_type_id:    s.room_type_id,
        check_in:        s.check_in,
        check_out:       s.check_out,
        quantity:        s.quantity,
        extras_selected: s.extras_selected ?? [],
        computed_total:  s.computed_total ?? null,
      }))
      const { error } = await svc.from('proposal_room_selections').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

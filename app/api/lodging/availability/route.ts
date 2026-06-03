import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/auth-server'

// GET /api/lodging/availability?config_id=xxx&from=YYYY-MM-DD&to=YYYY-MM-DD&proposal_id=optional
// PUBLIC endpoint — used by dossier page to render selector.
// Returns room types + prices + extras + computed availability per type.

export async function GET(req: NextRequest) {
  try {
    const configId   = req.nextUrl.searchParams.get('config_id')
    const from       = req.nextUrl.searchParams.get('from')
    const to         = req.nextUrl.searchParams.get('to')
    const proposalId = req.nextUrl.searchParams.get('proposal_id')

    if (!configId) return NextResponse.json({ error: 'config_id requerido' }, { status: 400 })

    const svc = getServiceClient()

    // Room types
    const { data: roomTypes, error: rtErr } = await svc
      .from('venue_room_types')
      .select('*')
      .eq('commercial_config_id', configId)
      .eq('is_active', true)
      .order('sort_order')

    if (rtErr) {
      console.error('[lodging/availability]', rtErr.message)
      return NextResponse.json({ error: rtErr.message }, { status: 500 })
    }
    const rts = roomTypes ?? []
    if (rts.length === 0) {
      return NextResponse.json({ room_types: [], prices: [], extras: [], inventory_limits: [], availability: {} })
    }

    const rtIds = rts.map(r => r.id)

    // Prices
    const { data: prices } = await svc
      .from('venue_room_prices')
      .select('*')
      .in('room_type_id', rtIds)
      .order('date_from')

    // Extras
    const { data: extras } = await svc
      .from('venue_room_extras')
      .select('*')
      .eq('commercial_config_id', configId)
      .eq('is_active', true)
      .order('sort_order')

    // Inventory limits for proposal (if any)
    let inventoryLimits: any[] = []
    if (proposalId) {
      const { data: lim } = await svc
        .from('proposal_room_inventory_limits')
        .select('*')
        .eq('proposal_id', proposalId)
        .in('room_type_id', rtIds)
      inventoryLimits = lim ?? []
    }

    // Availability per room type (over date range)
    const availability: Record<string, number> = {}
    if (from && to) {
      // Get overlapping blocks
      const { data: blocks } = await svc
        .from('venue_room_blocks')
        .select('*')
        .in('room_type_id', rtIds)
        .lte('date_from', to)
        .gte('date_to', from)

      for (const rt of rts) {
        // Find max blocked quantity across the date range
        const rtBlocks = (blocks ?? []).filter((b: any) => b.room_type_id === rt.id)
        const maxBlocked = rtBlocks.reduce((max: number, b: any) => Math.max(max, b.quantity_blocked || 0), 0)
        const limit = inventoryLimits.find((l: any) => l.room_type_id === rt.id)
        const offered = limit?.max_quantity ?? rt.total_quantity
        availability[rt.id] = Math.max(0, Math.min(offered, rt.total_quantity - maxBlocked))
      }
    } else {
      for (const rt of rts) {
        const limit = inventoryLimits.find((l: any) => l.room_type_id === rt.id)
        availability[rt.id] = limit?.max_quantity ?? rt.total_quantity
      }
    }

    return NextResponse.json({
      room_types: rts,
      prices: prices ?? [],
      extras: extras ?? [],
      inventory_limits: inventoryLimits,
      availability,
    })
  } catch (err: any) {
    console.error('[lodging/availability]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

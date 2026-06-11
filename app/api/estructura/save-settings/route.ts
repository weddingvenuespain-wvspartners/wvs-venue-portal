import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireFeature } from '@/lib/plan-server'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// POST /api/estructura/save-settings
// Body: partial venue_settings patch (e.g. { visit_availability: {...} })
// Reads the current row, merges, and writes back — safe against column overwrites.
export async function POST(req: NextRequest) {
  try {
    const gate = await requireFeature('estructura')
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const { venue_id, ...patch } = await req.json()
    if (!venue_id) return NextResponse.json({ error: 'Missing venue_id' }, { status: 400 })

    const svc = getServiceClient()

    const { data: current } = await svc
      .from('venue_settings')
      .select('*')
      .eq('user_id', gate.userId)
      .eq('venue_id', venue_id)
      .maybeSingle()

    const upsertPayload: Record<string, any> = { ...(current || {}), ...patch, user_id: gate.userId, venue_id }

    const { error } = await svc
      .from('venue_settings')
      .upsert(upsertPayload, { onConflict: 'user_id,venue_id' })

    if (error) {
      console.error('[save-settings]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[save-settings]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

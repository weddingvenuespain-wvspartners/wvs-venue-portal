import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// Public endpoint — called by the couple from the proposal landing (no auth required)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { slot_index, slot } = body

    if (slot_index === undefined || !slot) {
      return NextResponse.json({ error: 'Missing slot data' }, { status: 400 })
    }

    const cookieStore = await cookies()
    // Use service-role-less anon client — proposal is public
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n: string) => cookieStore.get(n)?.value, set() {}, remove() {} } }
    )

    // Verify proposal exists and is public/sent
    const { data: proposal } = await supabase
      .from('proposals')
      .select('id, user_id, couple_name, status, sections_data')
      .eq('id', id)
      .in('status', ['sent', 'viewed', 'preview'])
      .maybeSingle()

    if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Persist selected date into sections_data.selected_date_slot
    const updatedSections = {
      ...(proposal.sections_data ?? {}),
      selected_date_slot: { slot_index, slot, selected_at: new Date().toISOString() },
    }

    await supabase
      .from('proposals')
      .update({ sections_data: updatedSections })
      .eq('id', id)

    // Mirror into the unified responses inbox (delete-then-insert: last pick wins).
    try {
      const svc = getServiceClient()
      const slotDates: string[] = Array.isArray(slot?.dates)
        ? slot.dates.filter((d: any) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
        : []
      const firstDate = slotDates[0] ?? null
      const eventAt = firstDate ? new Date(`${firstDate}T12:00:00`).toISOString() : null
      await svc.from('proposal_inquiries').delete().eq('proposal_id', id).eq('kind', 'date_pick')
      const { error: inqInsErr } = await svc.from('proposal_inquiries').insert({
        proposal_id: id,
        user_id: proposal.user_id,
        kind: 'date_pick',
        name: proposal.couple_name || 'Pareja',
        email: null,
        phone: null,
        preferred_dates: slotDates.slice(0, 5),
        message: null,
        status: 'new',
        payload: { slot_index, slot },
        event_at: eventAt,
      })
      if (inqInsErr) console.error('[select-date] inquiries insert error', inqInsErr.message)
    } catch (inqErr: any) {
      console.error('[select-date] inquiries mirror error', inqErr?.message)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

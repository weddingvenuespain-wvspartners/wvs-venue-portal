import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// POST /api/calendar/disconnect  body: { venue_id: string }
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { venue_id } = await req.json()
    if (!venue_id) return NextResponse.json({ error: 'Missing venue_id' }, { status: 400 })

    const db = svc()

    // Remove google_calendar config and clear google_blocked_dates
    const { data: settings } = await db
      .from('venue_settings')
      .select('visit_availability')
      .eq('user_id', user.id)
      .eq('venue_id', venue_id)
      .maybeSingle()

    const currentAvail = settings?.visit_availability ?? {}
    const { google_blocked_dates: _, ...availWithoutGcal } = currentAvail

    await db
      .from('venue_settings')
      .update({
        google_calendar:    null,
        visit_availability: availWithoutGcal,
      })
      .eq('user_id', user.id)
      .eq('venue_id', venue_id)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[calendar/disconnect]', err)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// GET /api/calendar/status?venue_id=...
// Returns ONLY the non-sensitive connection info. The google_calendar JSON in
// venue_settings holds OAuth access/refresh tokens, which must never be sent to
// the browser — so the client reads connection state through this endpoint
// instead of selecting google_calendar directly.
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const venueId = req.nextUrl.searchParams.get('venue_id')
    if (!venueId) return NextResponse.json({ error: 'Missing venue_id' }, { status: 400 })

    const { data } = await svc()
      .from('venue_settings')
      .select('google_calendar')
      .eq('user_id', user.id)
      .eq('venue_id', venueId)
      .maybeSingle()

    const gcal = data?.google_calendar as
      | { calendar_name?: string; last_sync?: string | null }
      | null

    if (!gcal) return NextResponse.json({ connected: false })

    return NextResponse.json({
      connected: true,
      calendar_name: gcal.calendar_name ?? 'Google Calendar',
      last_sync: gcal.last_sync ?? null,
    })
  } catch (err: any) {
    console.error('[calendar/status]', err)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getValidAccessToken, fetchCalendarEvents, eventsToBlockedDates } from '@/lib/google-calendar'
import type { GCalConfig } from '@/lib/google-calendar'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// POST /api/calendar/sync  body: { venue_id: string }
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
    const { data: settings } = await db
      .from('venue_settings')
      .select('google_calendar, visit_availability')
      .eq('user_id', user.id)
      .eq('venue_id', venue_id)
      .maybeSingle()

    const gcal: GCalConfig | null = settings?.google_calendar ?? null
    if (!gcal?.refresh_token) {
      return NextResponse.json({ error: 'Google Calendar no conectado' }, { status: 400 })
    }

    const { token, updated } = await getValidAccessToken(gcal)
    const activeConfig = updated ?? gcal

    const now     = new Date()
    const horizon = new Date(now); horizon.setFullYear(horizon.getFullYear() + 1)
    const events  = await fetchCalendarEvents(token, activeConfig.calendar_id, now.toISOString(), horizon.toISOString())
    const googleBlockedDates = eventsToBlockedDates(events)

    const currentAvail = settings?.visit_availability ?? {}
    const newGcalConfig = { ...activeConfig, last_sync: new Date().toISOString() }

    await db
      .from('venue_settings')
      .update({
        google_calendar:    newGcalConfig,
        visit_availability: { ...currentAvail, google_blocked_dates: googleBlockedDates },
      })
      .eq('user_id', user.id)
      .eq('venue_id', venue_id)

    return NextResponse.json({
      ok: true,
      blocked_count: googleBlockedDates.length,
      last_sync: newGcalConfig.last_sync,
    })
  } catch (err: any) {
    console.error('[calendar/sync]', err)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getValidAccessToken, createCalendarEvent } from '@/lib/google-calendar'
import type { GCalConfig } from '@/lib/google-calendar'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function pad(n: number) { return String(n).padStart(2, '0') }
function fmtDT(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}
// Add one day to a YYYY-MM-DD string (for all-day event exclusive end)
function nextDay(iso: string) {
  const d = new Date(iso); d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

// POST /api/calendar/push-all  body: { venue_id: string }
// Pushes all confirmed weddings + scheduled visits to Google Calendar.
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
    if (updated) {
      await db.from('venue_settings').update({ google_calendar: updated })
        .eq('user_id', user.id).eq('venue_id', venue_id)
    }

    const calId = gcal.calendar_id
    let pushed = 0

    // 1. Confirmed weddings — calendar_entries with status reservado/ganado
    const today = new Date().toISOString().slice(0, 10)
    const { data: entries } = await db
      .from('calendar_entries')
      .select('date, status, lead_id')
      .eq('user_id', user.id)
      .eq('venue_id', venue_id)
      .in('status', ['reservado', 'ganado'])
      .gte('date', today)

    // Group consecutive dates per lead into single all-day events
    const leadDates: Record<string, string[]> = {}
    for (const e of entries ?? []) {
      const key = e.lead_id ?? e.date
      if (!leadDates[key]) leadDates[key] = []
      leadDates[key].push(e.date)
    }

    // Get couple names for leads
    const leadIds = Object.keys(leadDates).filter(k => k.length > 10) // UUIDs
    const { data: leads } = leadIds.length
      ? await db.from('leads').select('id, couple_name').in('id', leadIds)
      : { data: [] }
    const leadNames: Record<string, string> = {}
    for (const l of leads ?? []) leadNames[l.id] = l.couple_name ?? 'Boda'

    for (const [leadId, dates] of Object.entries(leadDates)) {
      const sorted = [...dates].sort()
      const startDate = sorted[0]
      const endDate   = nextDay(sorted[sorted.length - 1])
      const name = leadNames[leadId] ?? 'Boda'
      await createCalendarEvent(token, calId, {
        summary: `🎊 ${name}`,
        description: 'Boda confirmada — WeddingVenuesSpain',
        startDate,
        endDate,
      })
      pushed++
    }

    // 2. Scheduled visits — leads with visit_date
    const { data: visitLeads } = await db
      .from('leads')
      .select('couple_name, visit_date, visit_time')
      .eq('user_id', user.id)
      .eq('venue_id', venue_id)
      .eq('status', 'visit_scheduled')
      .gte('visit_date', today)
      .not('visit_date', 'is', null)

    const slotDuration = settings?.visit_availability?.slot_duration ?? 60

    for (const v of visitLeads ?? []) {
      const time = v.visit_time ?? '10:00'
      const startDT = new Date(`${v.visit_date}T${time.padStart(5,'0')}:00`)
      const endDT   = new Date(startDT.getTime() + slotDuration * 60_000)
      await createCalendarEvent(token, calId, {
        summary: `Visita — ${v.couple_name || 'Pareja'}`,
        description: 'Visita agendada — WeddingVenuesSpain',
        startDateTime: fmtDT(startDT),
        endDateTime:   fmtDT(endDT),
      })
      pushed++
    }

    return NextResponse.json({ ok: true, pushed })
  } catch (err: any) {
    console.error('[calendar/push-all]', err)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendVisitRequestEmail } from '@/lib/mailer'
import { getValidAccessToken, createCalendarEvent } from '@/lib/google-calendar'
import type { GCalConfig } from '@/lib/google-calendar'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// POST /api/proposals/[id]/visit-request
// Public — couple submits a visit request from the proposal page.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { date, time, message, couple_email, selected_spaces, selected_menus } = body

    if (!date || !time) {
      return NextResponse.json({ error: 'Fecha y hora son obligatorias' }, { status: 400 })
    }
    const trimmedEmail = typeof couple_email === 'string' ? couple_email.trim() : ''
    if (!trimmedEmail) {
      return NextResponse.json({ error: 'Indica tu email' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: 'Email no válido' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n: string) => cookieStore.get(n)?.value, set() {}, remove() {} } }
    )

    // 1. Get proposal
    const { data: proposal } = await supabase
      .from('proposals')
      .select('id, user_id, venue_id, lead_id, couple_name')
      .eq('id', id)
      .maybeSingle()

    if (!proposal) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })

    const visitRequest = {
      date, time,
      message: message || null,
      couple_name: proposal.couple_name,
      couple_email: couple_email || null,
      selected_spaces: selected_spaces ?? [],
      selected_menus: selected_menus ?? [],
      requested_at: new Date().toISOString(),
      status: 'pending',
    }

    // 2. Save visit_request on proposal
    const { error: proposalErr } = await supabase
      .from('proposals')
      .update({ visit_request: visitRequest })
      .eq('id', id)
    if (proposalErr) console.error('[visit-request] proposal update error', proposalErr)

    // 3. Update lead if linked
    if (proposal.lead_id) {
      const { error: leadErr } = await supabase
        .from('leads')
        .update({ visit_date: date, visit_time: time, status: 'visit_scheduled' })
        .eq('id', proposal.lead_id)
      if (leadErr) console.error('[visit-request] lead update error', leadErr)
    }

    // 3b. Mirror into the unified responses inbox (proposal_inquiries).
    //     Service client is required because the public anon caller can't
    //     write user_id-bound rows under RLS. Delete-then-insert so a couple
    //     changing their mind doesn't spawn duplicates (we keep "last pick wins"
    //     for visits without relying on a partial unique index).
    try {
      const svc = getServiceClient()
      const eventAt = new Date(`${date}T${/^\d{2}:\d{2}/.test(time) ? time : '12:00'}:00`).toISOString()
      await svc.from('proposal_inquiries').delete().eq('proposal_id', id).eq('kind', 'visit')
      const { error: inqInsErr } = await svc.from('proposal_inquiries').insert({
        proposal_id: id,
        user_id: proposal.user_id,
        kind: 'visit',
        name: proposal.couple_name || 'Pareja',
        email: couple_email || null,
        phone: null,
        preferred_dates: [date],
        message: message || null,
        status: 'new',
        payload: {
          date, time,
          selected_spaces: selected_spaces ?? [],
          selected_menus: selected_menus ?? [],
        },
        event_at: eventAt,
      })
      if (inqInsErr) console.error('[visit-request] inquiries insert error', inqInsErr.message)
    } catch (inqErr: any) {
      console.error('[visit-request] inquiries mirror error', inqErr?.message)
    }

    // 3c. Push visit to Google Calendar (non-fatal)
    try {
      const svc2 = getServiceClient()
      const { data: vsRow } = await svc2
        .from('venue_settings')
        .select('google_calendar, visit_availability')
        .eq('user_id', proposal.user_id)
        .eq('venue_id', proposal.venue_id ?? '')
        .maybeSingle()

      const gcal: GCalConfig | null = vsRow?.google_calendar ?? null
      if (gcal?.refresh_token) {
        const { token, updated } = await getValidAccessToken(gcal)
        if (updated) {
          await svc2.from('venue_settings').update({ google_calendar: updated })
            .eq('user_id', proposal.user_id).eq('venue_id', proposal.venue_id ?? '')
        }
        const slotDuration = vsRow?.visit_availability?.slot_duration ?? 60
        const [h, m] = time.split(':').map(Number)
        const startDT = new Date(`${date}T${time.padStart(5, '0')}:00`)
        const endDT   = new Date(startDT.getTime() + slotDuration * 60_000)
        const pad = (n: number) => String(n).padStart(2, '0')
        const fmtDT = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
        await createCalendarEvent(token, gcal.calendar_id, {
          summary: `Visita — ${proposal.couple_name || 'Pareja'}`,
          description: 'Visita agendada desde WeddingVenuesSpain',
          startDateTime: fmtDT(startDT),
          endDateTime:   fmtDT(endDT),
        })
      }
    } catch (gcalErr: any) {
      console.error('[visit-request] gcal push error', gcalErr?.message)
    }

    // 4. Send email notification to venue
    let emailSent = false
    try {
      const { data: venueData } = await supabase
        .from('venue_onboarding')
        .select('name, contact_email, smtp_from_email, smtp_host, smtp_port, smtp_user, smtp_pass')
        .eq('user_id', proposal.user_id)
        .maybeSingle()

      const venueEmail = venueData?.contact_email
      if (venueEmail && venueData) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.weddingvenuesspain.com'
        const smtpConfig = (venueData.smtp_host && venueData.smtp_user && venueData.smtp_pass && venueData.smtp_from_email)
          ? { host: venueData.smtp_host, port: venueData.smtp_port ?? 465, user: venueData.smtp_user, pass: venueData.smtp_pass, fromEmail: venueData.smtp_from_email }
          : null

        await sendVisitRequestEmail({
          to: venueEmail,
          venueName: venueData.name || 'Wedding Venues Spain',
          coupleName: proposal.couple_name,
          visitDate: date,
          visitTime: time,
          message: message || null,
          selectedSpaces: selected_spaces ?? [],
          selectedMenus: selected_menus ?? [],
          proposalUrl: `${appUrl}/proposals/${id}/edit`,
          smtpConfig,
        })
        emailSent = true
      }
    } catch (mailErr: any) {
      console.error('[visit-request] email error:', mailErr?.message)
    }

    return NextResponse.json({ ok: true, emailSent })
  } catch (err: any) {
    console.error('[visit-request]', err)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendVisitRequestEmail } from '@/lib/mailer'

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

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n: string) => cookieStore.get(n)?.value, set() {}, remove() {} } }
    )

    // 1. Get proposal
    const { data: proposal } = await supabase
      .from('proposals')
      .select('id, user_id, lead_id, couple_name')
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
    await supabase
      .from('proposals')
      .update({ visit_request: visitRequest })
      .eq('id', id)

    // 3. Update lead if linked
    if (proposal.lead_id) {
      await supabase
        .from('leads')
        .update({ visit_date: date, visit_time: time, status: 'visit_scheduled' })
        .eq('id', proposal.lead_id)
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

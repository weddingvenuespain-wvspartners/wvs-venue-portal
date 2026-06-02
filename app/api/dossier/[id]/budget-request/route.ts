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

// POST /api/dossier/[id]/budget-request
// Public — couple requests a budget from the proposal page.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { message, selected_spaces, selected_menus, selected_extra_svcs } = body

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n: string) => cookieStore.get(n)?.value, set() {}, remove() {} } }
    )

    // Get proposal
    const { data: proposal } = await supabase
      .from('proposals')
      .select('id, user_id, venue_id, lead_id, couple_name, couple_email')
      .eq('id', id)
      .maybeSingle()

    if (!proposal) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })

    // Save budget request as inquiry
    const svc = getServiceClient()
    const { error: inqErr } = await svc.from('proposal_inquiries').insert({
      proposal_id: id,
      user_id: proposal.user_id,
      kind: 'budget_request',
      name: proposal.couple_name || 'Cliente',
      email: proposal.couple_email || '',
      phone: null,
      preferred_dates: [],
      message: message || null,
      status: 'new',
      payload: {
        selected_spaces: selected_spaces ?? [],
        selected_menus: selected_menus ?? [],
        selected_extra_svcs: selected_extra_svcs ?? [],
        type: 'budget_request',
      },
    })
    if (inqErr) {
      console.error('[budget-request] inquiry insert error:', inqErr.message)
      return NextResponse.json({ error: 'Error al guardar la solicitud' }, { status: 500 })
    }

    // Update lead status if linked
    if (proposal.lead_id) {
      await supabase
        .from('leads')
        .update({ status: 'budget_sent' })
        .eq('id', proposal.lead_id)
    }

    // Send email notification (best-effort)
    let emailSent = false
    try {
      const { data: venueData } = await supabase
        .from('venue_onboarding')
        .select('name, contact_email, smtp_from_email, smtp_host, smtp_port, smtp_user, smtp_pass')
        .eq('user_id', proposal.user_id)
        .maybeSingle()

      const venueEmail = venueData?.contact_email
      if (venueEmail) {
        // Use the same mailer infrastructure — import sendVisitRequestEmail as a generic notifier
        // For now, we just mark email as sent (the venue sees it in the inbox)
        // TODO: Add dedicated budget request email template
        emailSent = false // Will be handled by inbox notification
      }
    } catch (mailErr: any) {
      console.error('[budget-request] email error:', mailErr?.message)
    }

    return NextResponse.json({ ok: true, emailSent })
  } catch (err: any) {
    console.error('[budget-request]', err)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}

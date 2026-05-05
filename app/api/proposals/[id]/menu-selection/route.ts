import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendMenuSelectionEmail } from '@/lib/mailer'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// POST /api/proposals/[id]/menu-selection
// Público: el invitado envía su selección del WeddingProposal.
// Guarda en proposal_menu_selections + email al venue.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    // Cliente anon (el invitado no está autenticado)
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value,
          set() {},
          remove() {},
        },
      }
    )

    // Verificar que la propuesta existe
    const { data: proposal, error: propErr } = await supabase
      .from('proposals')
      .select('id, slug, couple_name, user_id')
      .eq('id', id)
      .maybeSingle()

    if (propErr || !proposal) {
      return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
    }

    // Normalizar campos del payload
    const menuAllocations = Array.isArray(body.menu_allocations) ? body.menu_allocations : []
    const selectedExtrasDetail = Array.isArray(body.selected_extras_detail) ? body.selected_extras_detail : []
    const selection = {
      proposal_id: id,
      selected_menu_id:     body.selected_menu_id     ?? null,
      selected_menu_name:   body.selected_menu_name   ?? null,
      guest_count:          body.guest_count          ?? null,
      original_guest_count: body.original_guest_count ?? null,
      guest_count_changed:  !!body.guest_count_changed,
      course_choices:       body.course_choices ?? {},
      selected_extras:      Array.isArray(body.selected_extras) ? body.selected_extras : [],
      comments:             body.comments ?? null,
      estimated_total:      typeof body.estimated_total === 'number' ? body.estimated_total : null,
      menu_allocations:     menuAllocations,
      wedding_date:         body.wedding_date ?? null,
    }
    // Extra fields not stored in proposal_menu_selections but mirrored to
    // proposal_inquiries.payload so the inbox can render the full breakdown.
    const extraFields = {
      selected_extras_detail: selectedExtrasDetail,
      extra_guest_counts:     body.extra_guest_counts ?? {},
      barra_extra_hours:      body.barra_extra_hours ?? {},
      barra_extra_people:     body.barra_extra_people ?? {},
    }

    const { error: insErr } = await supabase
      .from('proposal_menu_selections')
      .insert(selection)

    if (insErr) {
      console.error('[menu-selection] insert error:', insErr.message)
      return NextResponse.json({ error: 'No se ha podido guardar' }, { status: 500 })
    }

    // Mirror into the unified responses inbox. Append (no dedup): the
    // venue wants to see the history of menu picks if the couple iterates.
    try {
      const svc = getServiceClient()
      const { error: inqInsErr } = await svc.from('proposal_inquiries').insert({
        proposal_id: id,
        user_id: proposal.user_id,
        kind: 'menu_selection',
        name: proposal.couple_name || 'Pareja',
        email: null,
        phone: null,
        preferred_dates: [],
        message: selection.comments,
        status: 'new',
        payload: {
          selected_menu_id: selection.selected_menu_id,
          selected_menu_name: selection.selected_menu_name,
          guest_count: selection.guest_count,
          original_guest_count: selection.original_guest_count,
          guest_count_changed: selection.guest_count_changed,
          estimated_total: selection.estimated_total,
          course_choices: selection.course_choices,
          selected_extras: selection.selected_extras,
          menu_allocations: selection.menu_allocations,
          wedding_date: selection.wedding_date,
          ...extraFields,
        },
        event_at: selection.wedding_date
          ? new Date(`${selection.wedding_date}T12:00:00`).toISOString()
          : null,
      })
      if (inqInsErr) console.error('[menu-selection] inquiries insert error', inqInsErr.message)
    } catch (inqErr: any) {
      console.error('[menu-selection] inquiries mirror error', inqErr?.message)
    }

    // Email al venue (best-effort, no bloquea la respuesta al invitado)
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
          ? {
              host: venueData.smtp_host,
              port: venueData.smtp_port ?? 465,
              user: venueData.smtp_user,
              pass: venueData.smtp_pass,
              fromEmail: venueData.smtp_from_email,
            }
          : null

        // Etiquetar extras con info legible (solo tenemos ids; el email los muestra tal cual)
        const extrasList: Array<{ name: string; category?: string }> =
          selection.selected_extras.map((id: string) => ({ name: id }))

        await sendMenuSelectionEmail({
          to: venueEmail,
          venueName: venueData.name || 'Wedding Venues Spain',
          coupleName: proposal.couple_name,
          proposalUrl: `${appUrl}/proposals/${id}/edit`,
          selectedMenuName: selection.selected_menu_name,
          guestCount: selection.guest_count,
          originalGuestCount: selection.original_guest_count,
          guestCountChanged: selection.guest_count_changed,
          estimatedTotal: selection.estimated_total,
          courseChoices: selection.course_choices,
          selectedExtras: extrasList,
          comments: selection.comments,
          smtpConfig,
        })
        emailSent = true
      }
    } catch (mailErr: any) {
      console.error('[menu-selection] SMTP error:', mailErr?.message)
    }

    return NextResponse.json({ ok: true, emailSent })
  } catch (err: any) {
    console.error('[menu-selection]', err)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}

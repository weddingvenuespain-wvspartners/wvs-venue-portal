import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendMenuSelectionEmail } from '@/lib/mailer'

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
    }

    const { error: insErr } = await supabase
      .from('proposal_menu_selections')
      .insert(selection)

    if (insErr) {
      console.error('[menu-selection] insert error:', insErr.message)
      return NextResponse.json({ error: 'No se ha podido guardar' }, { status: 500 })
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

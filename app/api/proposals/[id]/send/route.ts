import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendProposalEmail } from '@/lib/mailer'
import { requireFeature } from '@/lib/plan-server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const gate = await requireFeature('propuestas')
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const body = await req.json().catch(() => ({}))
    const emailOverride: string | null = body.email || null
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // Fetch proposal (must belong to the authenticated user) — sin couple_email ya que puede no existir la columna
    const { data: proposal, error } = await supabase
      .from('proposals')
      .select('id, slug, couple_name, lead_id, status, user_id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single()

    if (error || !proposal) {
      return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
    }

    // Resolve email: override from request body, then lead email
    let recipientEmail: string | null = emailOverride
    if (!recipientEmail && proposal.lead_id) {
      const { data: lead } = await supabase
        .from('leads')
        .select('email')
        .eq('id', proposal.lead_id)
        .maybeSingle()
      recipientEmail = lead?.email ?? null
    }

    // Update status to sent (and save email if provided, silently ignore if column missing)
    await supabase.from('proposals').update({ status: 'sent' }).eq('id', id)
    if (emailOverride) {
      await supabase.from('proposals').update({ couple_email: emailOverride }).eq('id', id)
        .then(() => {}) // ignorar error si columna no existe
    }

    // Send email if we have a recipient
    let emailSent = false
    let emailError: string | null = null
    if (recipientEmail) {
      try {
        const { data: venueData } = await supabase
          .from('venue_onboarding')
          .select('name, contact_email, smtp_from_email, smtp_host, smtp_port, smtp_user, smtp_pass')
          .eq('user_id', session.user.id)
          .maybeSingle()

        const { data: brandingData } = await supabase
          .from('proposal_branding')
          .select('logo_url, primary_color')
          .eq('proposal_id', id)
          .maybeSingle()

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.weddingvenuesspain.com'
        const proposalUrl = `${appUrl}/proposal/${proposal.slug}`
        const venueName = venueData?.name ?? 'Wedding Venues Spain'

        const smtpConfig = (venueData?.smtp_host && venueData?.smtp_user && venueData?.smtp_pass && venueData?.smtp_from_email)
          ? {
              host:      venueData.smtp_host,
              port:      venueData.smtp_port ?? 465,
              user:      venueData.smtp_user,
              pass:      venueData.smtp_pass,
              fromEmail: venueData.smtp_from_email,
            }
          : null

        await sendProposalEmail({
          to: recipientEmail,
          coupleName: proposal.couple_name,
          venueName,
          venueEmail: venueData?.contact_email ?? null,
          proposalUrl,
          logoUrl: brandingData?.logo_url,
          primaryColor: brandingData?.primary_color,
          smtpConfig,
        })

        emailSent = true
      } catch (mailErr: any) {
        console.error('[proposals/send] SMTP error:', mailErr?.message)
        emailError = mailErr?.message ?? 'Error SMTP'
      }
    }

    return NextResponse.json({ ok: true, emailSent, recipientEmail, emailError })
  } catch (err: any) {
    console.error('[proposals/send]', err)
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
  }
}

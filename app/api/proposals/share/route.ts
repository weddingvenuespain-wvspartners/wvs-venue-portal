import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendShareWithPartnerEmail } from '@/lib/mailer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// POST /api/proposals/share
// Public — couple shares the proposal URL with their partner via email.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const slug: string | undefined = body.slug
    const partnerEmail: string | undefined = body.partner_email?.trim?.()
    const fromName: string | undefined = body.from_name?.trim?.() || null

    if (!slug || !partnerEmail || !EMAIL_RE.test(partnerEmail)) {
      return NextResponse.json({ ok: false, error: 'Email no válido' }, { status: 400 })
    }

    const svc = getServiceClient()
    const { data: proposal } = await svc
      .from('proposals')
      .select('id, slug, user_id, couple_name')
      .eq('slug', slug)
      .maybeSingle()

    if (!proposal) {
      return NextResponse.json({ ok: false, error: 'Propuesta no encontrada' }, { status: 404 })
    }

    const { data: venueData } = await svc
      .from('venue_onboarding')
      .select('name, smtp_from_email, smtp_host, smtp_port, smtp_user, smtp_pass')
      .eq('user_id', proposal.user_id)
      .maybeSingle()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.weddingvenuesspain.com'
    const smtpConfig = (venueData?.smtp_host && venueData?.smtp_user && venueData?.smtp_pass && venueData?.smtp_from_email)
      ? {
          host: venueData.smtp_host,
          port: venueData.smtp_port ?? 465,
          user: venueData.smtp_user,
          pass: venueData.smtp_pass,
          fromEmail: venueData.smtp_from_email,
        }
      : null

    await sendShareWithPartnerEmail({
      to: partnerEmail,
      fromName,
      venueName: venueData?.name || 'Wedding Venues Spain',
      coupleName: proposal.couple_name || 'la pareja',
      proposalUrl: `${appUrl}/proposal/${proposal.slug}`,
      smtpConfig,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[proposals/share]', err)
    return NextResponse.json({ ok: false, error: err?.message || 'Error interno' }, { status: 500 })
  }
}

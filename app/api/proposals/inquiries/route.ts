import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendInquiryEmail } from '@/lib/mailer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Kinds are now editor-configurable. We accept any non-empty string up to 64
// chars. The 'visit' id is special: it never reaches this endpoint because
// InquiryForm routes it to VisitBookingModal client-side.
const KIND_MAX = 64

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// POST /api/proposals/inquiries
// Public — anonymous couple submits an inquiry from the proposal landing.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const slug: string | undefined = body.slug
    const kind: string | undefined = body.kind?.trim?.()
    const kindLabel: string | undefined = body.kind_label?.trim?.() || null
    const name: string | undefined = body.name?.trim?.()
    const email: string | undefined = body.email?.trim?.() || null
    const phone: string | undefined = body.phone?.trim?.() || null
    const messageRaw: string | undefined = body.message?.trim?.() || null
    const preferredDates: string[] = Array.isArray(body.preferred_dates)
      ? body.preferred_dates.filter((d: any) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 5)
      : []

    if (!slug || !name || !kind || kind.length > KIND_MAX) {
      return NextResponse.json({ ok: false, error: 'Datos incompletos' }, { status: 400 })
    }
    if (!email) {
      return NextResponse.json({ ok: false, error: 'Indica tu email' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'Email no válido' }, { status: 400 })
    }
    const message = messageRaw && messageRaw.length > 2000 ? messageRaw.slice(0, 2000) : messageRaw

    const svc = getServiceClient()

    const { data: proposal, error: pErr } = await svc
      .from('proposals')
      .select('id, user_id, couple_name')
      .eq('slug', slug)
      .single()

    if (pErr || !proposal) {
      return NextResponse.json({ ok: false, error: 'Propuesta no encontrada' }, { status: 404 })
    }

    const { data: inquiry, error: iErr } = await svc
      .from('proposal_inquiries')
      .insert({
        proposal_id: proposal.id,
        user_id: proposal.user_id,
        kind,
        kind_label: kindLabel,
        name,
        email,
        phone,
        preferred_dates: preferredDates,
        message,
        status: 'new',
      })
      .select('id')
      .single()

    if (iErr) {
      console.error('[inquiries] insert error', iErr)
      return NextResponse.json({ ok: false, error: iErr.message || 'No se ha podido enviar' }, { status: 500 })
    }

    // Send notification to venue (best-effort, don't fail the request)
    try {
      const { data: venueData } = await svc
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

        await sendInquiryEmail({
          to: venueEmail,
          venueName: venueData.name || 'Wedding Venues Spain',
          coupleName: proposal.couple_name || name,
          kind,
          kindLabel,
          name,
          email,
          phone,
          preferredDates,
          message,
          proposalUrl: `${appUrl}/proposals/${proposal.id}/edit`,
          smtpConfig,
        })
      }
    } catch (mailErr: any) {
      console.error('[inquiries] email error', mailErr?.message)
    }

    return NextResponse.json({ ok: true, id: inquiry.id })
  } catch (err: any) {
    console.error('[inquiries]', err)
    return NextResponse.json({ ok: false, error: err?.message || 'Error interno' }, { status: 500 })
  }
}

// GET /api/proposals/inquiries
// Authenticated — venue lists its own inquiries. RLS scopes to current user.
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

    const url = new URL(req.url)
    const status = url.searchParams.get('status')

    // Use `*` so this endpoint tolerates the migration state — pre-migration
    // the new columns (payload, event_at) just won't be in the response.
    const baseSelect = '*, proposals!inner(id, slug, couple_name, lead_id, leads(id, name))'

    let query = supabase
      .from('proposal_inquiries')
      .select(baseSelect)
      .order('created_at', { ascending: false })
      .limit(200)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, inquiries: data ?? [] })
  } catch (err: any) {
    console.error('[inquiries GET]', err)
    return NextResponse.json({ ok: false, error: err?.message || 'Error interno' }, { status: 500 })
  }
}

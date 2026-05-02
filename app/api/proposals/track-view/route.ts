import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { sendFirstViewEmail } from '@/lib/mailer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function hashIp(ip: string | null): string | null {
  if (!ip) return null
  const salt = process.env.IP_HASH_SALT || 'wvs-default-salt'
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return null
}

async function notifyFirstView(userId: string, proposalId: string, coupleName: string | null) {
  // Use service role: anon RLS hides venue_onboarding fields needed here
  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: venueData } = await svc
    .from('venue_onboarding')
    .select('name, contact_email, smtp_from_email, smtp_host, smtp_port, smtp_user, smtp_pass')
    .eq('user_id', userId)
    .maybeSingle()

  const venueEmail = venueData?.contact_email
  if (!venueEmail || !venueData) return

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

  await sendFirstViewEmail({
    to: venueEmail,
    venueName: venueData.name || 'Wedding Venues Spain',
    coupleName: coupleName || 'la pareja',
    proposalUrl: `${appUrl}/proposals/${proposalId}/edit`,
    smtpConfig,
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const slug: string | undefined = body.slug
    const session: string | undefined = body.session

    if (!slug || !session) {
      return NextResponse.json({ ok: false, error: 'Missing slug or session' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    // viewer_user_id is used by the RPC to skip self-views.
    const { data: { user } } = await supabase.auth.getUser()

    const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null
    const ipHash = hashIp(getClientIp(req))

    // Snapshot first_viewed_at before the RPC so we can detect the very first view
    const { data: before } = await supabase
      .from('proposals')
      .select('id, user_id, couple_name, first_viewed_at')
      .eq('slug', slug)
      .maybeSingle()

    const { error } = await supabase.rpc('track_proposal_view', {
      p_slug:        slug,
      p_session:     session,
      p_user_agent:  userAgent,
      p_ip_hash:     ipHash,
      p_viewer_user: user?.id ?? null,
    })

    if (error) {
      console.error('[track-view] rpc error:', error.message)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    // First-view notification (best-effort, never blocks)
    if (before && !before.first_viewed_at) {
      const { data: after } = await supabase
        .from('proposals')
        .select('first_viewed_at')
        .eq('id', before.id)
        .maybeSingle()
      if (after?.first_viewed_at) {
        notifyFirstView(before.user_id, before.id, before.couple_name).catch(err =>
          console.error('[track-view] first-view email error:', err?.message),
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[track-view]', err)
    return NextResponse.json({ ok: false, error: err.message ?? 'Error' }, { status: 500 })
  }
}

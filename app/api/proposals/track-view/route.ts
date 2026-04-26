import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import crypto from 'crypto'

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

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[track-view]', err)
    return NextResponse.json({ ok: false, error: err.message ?? 'Error' }, { status: 500 })
  }
}

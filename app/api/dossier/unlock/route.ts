import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { dossierUnlockToken } from '@/lib/dossier-unlock'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

/** Constant-time string comparison (avoids timing oracles on the password). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const slug: string | undefined = body.slug
    const password: string | undefined = body.password

    if (!slug || typeof password !== 'string') {
      return NextResponse.json({ ok: false, error: 'Missing slug or password' }, { status: 400 })
    }

    // Brute-force guard: cap attempts per slug+IP.
    const allowed = await checkRateLimit(`dossier-unlock:${slug}:${clientIp(req)}`, 10, 600)
    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'Demasiados intentos. Inténtalo más tarde.' }, { status: 429 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    const { data: proposal, error } = await supabase
      .from('proposals')
      .select('id, access_password')
      .eq('slug', slug)
      .single()

    if (error || !proposal) {
      return NextResponse.json({ ok: false, error: 'Propuesta no encontrada' }, { status: 404 })
    }

    if (!proposal.access_password) {
      // Propuesta no protegida — nada que desbloquear
      return NextResponse.json({ ok: true, locked: false })
    }

    if (!safeEqual(password, proposal.access_password)) {
      return NextResponse.json({ ok: false, error: 'Contraseña incorrecta' }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set({
      name: `proposal_unlock_${proposal.id}`,
      value: dossierUnlockToken(proposal.id),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    })
    return res
  } catch (err: any) {
    console.error('[proposals/unlock]', err)
    return NextResponse.json({ ok: false, error: err.message ?? 'Error' }, { status: 500 })
  }
}

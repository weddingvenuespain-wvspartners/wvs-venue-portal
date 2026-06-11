import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/auth-server'
import crypto from 'crypto'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { slug, password } = body as { slug?: string; password?: string }
    if (!slug || !password) return NextResponse.json({ ok: false }, { status: 400 })

    const allowed = await checkRateLimit(`budget-pw:${slug}:${clientIp(req)}`, 10, 600)
    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'too_many_attempts' }, { status: 429 })
    }

    const { data: budget } = await getServiceClient()
      .from('budgets')
      .select('password')
      .eq('slug', slug)
      .single()

    if (!budget) return NextResponse.json({ ok: false }, { status: 404 })

    if (budget.password && safeEqual(password, budget.password)) {
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'wrong_password' }, { status: 401 })
  } catch (err: any) {
    console.error('[budgets/check-password]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

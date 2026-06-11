import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/auth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const slug: string | undefined = body.slug
    if (!slug) return NextResponse.json({ ok: false }, { status: 400 })

    // Public view-tracking endpoint: use the service role (budgets is not
    // anon-readable) and scope strictly by slug.
    const supabase = getServiceClient()

    const now = new Date().toISOString()

    // Fetch current budget
    const { data: budget } = await supabase
      .from('budgets')
      .select('id, status, first_viewed_at, open_count')
      .eq('slug', slug)
      .single()

    if (!budget) return NextResponse.json({ ok: false }, { status: 404 })

    const updates: any = {
      last_viewed_at: now,
      open_count: (budget.open_count ?? 0) + 1,
    }
    if (!budget.first_viewed_at) updates.first_viewed_at = now
    if (budget.status === 'sent') updates.status = 'viewed'

    await supabase.from('budgets').update(updates).eq('id', budget.id)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[budgets/track]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

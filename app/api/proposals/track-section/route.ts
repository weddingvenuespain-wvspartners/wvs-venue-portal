import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// POST /api/proposals/track-section
// Anonymous — fired by the public proposal landing once per (session, section)
// when a section first enters the viewport. Server dedupes via UNIQUE constraint.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const slug: string | undefined = body.slug
    const session: string | undefined = body.session
    const sectionId: string | undefined = body.section_id

    if (!slug || !session || !sectionId) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    if (sectionId.length > 64) {
      return NextResponse.json({ ok: false, error: 'section_id too long' }, { status: 400 })
    }

    const svc = getServiceClient()
    const { data: proposal } = await svc
      .from('proposals')
      .select('id, user_id')
      .eq('slug', slug)
      .maybeSingle()

    if (!proposal) return NextResponse.json({ ok: false }, { status: 404 })

    // Insert; UNIQUE (proposal_id, session, section_id) silently dedupes
    await svc
      .from('proposal_section_views')
      .insert({
        proposal_id: proposal.id,
        user_id: proposal.user_id,
        session,
        section_id: sectionId,
      })
      .then(({ error }) => {
        // 23505 = unique_violation, expected
        if (error && error.code !== '23505') {
          console.error('[track-section] insert error', error.message)
        }
      })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[track-section]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

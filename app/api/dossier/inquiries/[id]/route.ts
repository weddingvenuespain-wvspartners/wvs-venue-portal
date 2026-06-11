import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = ['new', 'replied', 'closed'] as const
type Status = typeof ALLOWED_STATUS[number]

// PATCH /api/dossier/inquiries/[id]
// Authenticated — venue updates inquiry status. RLS scopes to owner.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const status: string | undefined = body.status

    if (!status || !ALLOWED_STATUS.includes(status as Status)) {
      return NextResponse.json({ ok: false, error: 'Estado no válido' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

    // Scope to the owner explicitly: an inquiry belongs to the venue via
    // user_id. This guards against IDOR regardless of whether RLS is active
    // on proposal_inquiries.
    const { data: updated, error } = await supabase
      .from('proposal_inquiries')
      .update({ status })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (!updated || updated.length === 0) {
      return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Error interno' }, { status: 500 })
  }
}

// DELETE /api/dossier/inquiries/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

    // Scope delete to the owner (see PATCH note above).
    const { data: deleted, error } = await supabase
      .from('proposal_inquiries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Error interno' }, { status: 500 })
  }
}

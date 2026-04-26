import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireFeature } from '@/lib/plan-server'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value, set() {}, remove() {} } }
  )
}

type Params = { params: Promise<{ id: string }> }

// GET /api/proposal-templates/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const gate = await requireFeature('propuestas')
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { id } = await params
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('proposal_content_templates')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

// PATCH /api/proposal-templates/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireFeature('propuestas')
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { id } = await params
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined)         patch.name          = body.name
  if (body.description !== undefined)  patch.description   = body.description
  if (body.sections_data !== undefined) patch.sections_data = body.sections_data
  if (body.is_default !== undefined)   patch.is_default    = body.is_default

  // If setting as default, unset others first
  if (body.is_default) {
    await supabase
      .from('proposal_content_templates')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .neq('id', id)
  }

  const { data, error } = await supabase
    .from('proposal_content_templates')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/proposal-templates/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const gate = await requireFeature('propuestas')
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { id } = await params
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { error } = await supabase
    .from('proposal_content_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

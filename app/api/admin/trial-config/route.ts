import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  )
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data: me } = await supabase
    .from('venue_profiles').select('role').eq('user_id', session.user.id).single()
  return me?.role === 'admin' ? session : null
}

const DEFAULTS = { id: 1, is_active: true, trial_days: 14, trial_plan_id: null }

// GET /api/admin/trial-config
export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('trial_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    // If table doesn't exist yet, return defaults gracefully
    if (error) {
      console.warn('[/api/admin/trial-config GET] table may not exist yet:', error.message)
      return NextResponse.json({ config: DEFAULTS })
    }

    return NextResponse.json({ config: data ?? DEFAULTS })
  } catch (err: any) {
    console.error('[/api/admin/trial-config GET]', err)
    return NextResponse.json({ config: DEFAULTS })
  }
}

// PUT /api/admin/trial-config
export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const { is_active, trial_days, trial_plan_id } = await req.json()
    if (typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'is_active debe ser boolean' }, { status: 400 })
    }
    if (typeof trial_days !== 'number' || trial_days < 1 || trial_days > 365) {
      return NextResponse.json({ error: 'trial_days debe ser un número entre 1 y 365' }, { status: 400 })
    }

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('trial_config')
      .upsert(
        { id: 1, is_active, trial_days, trial_plan_id: trial_plan_id || null, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
      .select()
      .single()

    if (error) {
      console.error('[/api/admin/trial-config PUT]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ config: data })
  } catch (err: any) {
    console.error('[/api/admin/trial-config PUT]', err)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}

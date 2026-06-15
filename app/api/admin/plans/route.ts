import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase: null, userId: null }
  const { data: me } = await supabase
    .from('venue_profiles').select('role').eq('user_id', user.id).single()
  return me?.role === 'admin' ? { supabase, userId: user.id } : { supabase: null, userId: null }
}

async function logPlanHistory(svc: any, planId: string, userId: string, action: string, changes?: any) {
  try {
    await svc.from('venue_plan_history').insert({
      plan_id: planId,
      changed_by: userId,
      action,
      changes: changes || null,
    })
  } catch {} // don't fail if table doesn't exist yet
}

// ── PATCH /api/admin/plans ─────────────────────────────────────────────────────
// Body: { id, ...fields }  — update any plan fields (is_active, visible_on_web, etc.)
export async function PATCH(req: NextRequest) {
  try {
    const { supabase, userId } = await requireAdmin()
    if (!supabase || !userId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const { id, ...fields } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const svc = getServiceClient()

    // Get current plan for history diff
    const { data: before } = await svc.from('venue_plans').select('*').eq('id', id).single()

    const { data, error } = await svc
      .from('venue_plans').update(fields).eq('id', id).select().single()
    if (error) throw error

    // Log changes
    const changes: any = {}
    for (const key of Object.keys(fields)) {
      if (JSON.stringify(before?.[key]) !== JSON.stringify(fields[key])) {
        changes[key] = { old: before?.[key], new: fields[key] }
      }
    }
    const action = 'is_active' in fields
      ? (fields.is_active ? 'activated' : 'deactivated')
      : 'updated'
    if (Object.keys(changes).length > 0) {
      await logPlanHistory(svc, id, userId, action, changes)
    }

    return NextResponse.json({ success: true, plan: data })
  } catch (err: any) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── DELETE /api/admin/plans ───────────────────────────────────────────────────
// Body: { id }
// Blocks delete if the plan has active subscribers
export async function DELETE(req: NextRequest) {
  try {
    const { supabase, userId } = await requireAdmin()
    if (!supabase || !userId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const svc = getServiceClient()

    // Check for active/trial subscribers
    const { count } = await svc
      .from('venue_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('plan_id', id)
      .in('status', ['active', 'trial', 'paused'])

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: hay ${count} suscripción(es) activa(s) en este plan. Desactívalo para que no acepte nuevas altas.` },
        { status: 409 }
      )
    }

    // Get plan name before delete for history
    const { data: plan } = await svc.from('venue_plans').select('name, display_name').eq('id', id).single()
    await logPlanHistory(svc, id, userId, 'deleted', { name: plan?.display_name || plan?.name })

    const { error } = await svc.from('venue_plans').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

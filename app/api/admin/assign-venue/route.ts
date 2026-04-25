import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS so admin can write rows for any user
function getServiceClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

// Auth-gated: caller must be an admin
async function requireAdmin(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: me } = await supabase
    .from('venue_profiles').select('role').eq('user_id', user.id).single()
  if (me?.role !== 'admin') return null
  return supabase
}

// ── POST /api/admin/assign-venue ───────────────────────────────────────────────
// Body: { user_id, wp_venue_id, plan_id?, billing_cycle?, price? }
export async function POST(req: NextRequest) {
  try {
    const authClient = await requireAdmin(req)
    if (!authClient) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const { user_id, wp_venue_id, plan_id, billing_cycle, start_trial, trial_days } = await req.json()
    if (!user_id || !wp_venue_id)
      return NextResponse.json({ error: 'user_id y wp_venue_id son requeridos' }, { status: 400 })

    const svc = getServiceClient()

    // 1. Create subscription if plan selected AND trial explicitly requested
    let subId: string | null = null
    if (plan_id && start_trial) {
      const cycle = billing_cycle || 'yearly'
      const start = new Date().toISOString().slice(0, 10)

      // Use admin-provided trial_days; fallback to plan default
      let days = parseInt(trial_days) || 0
      if (!days) {
        const { data: planData } = await svc
          .from('venue_plans').select('trial_days').eq('id', plan_id).single()
        days = planData?.trial_days ?? 14
      }

      const trialEnd = new Date()
      trialEnd.setDate(trialEnd.getDate() + days)

      const { data: sub, error: subErr } = await svc
        .from('venue_subscriptions')
        .insert({
          user_id, plan_id, billing_cycle: cycle,
          status: 'trial',
          start_date: start,
          trial_end_date: trialEnd.toISOString().slice(0, 10),
          renewal_date: null,
        })
        .select().single()
      if (subErr) console.error('[assign-venue] subscription insert error', subErr)
      subId = sub?.id || null
    }

    // 2. Upsert user_venues (conflict on user_id + wp_venue_id)
    const { error: uvErr } = await svc
      .from('user_venues')
      .upsert({ user_id, wp_venue_id, subscription_id: subId }, { onConflict: 'user_id,wp_venue_id' })
    if (uvErr) {
      console.error('[assign-venue] user_venues upsert error', uvErr)
      return NextResponse.json({ error: uvErr.message }, { status: 500 })
    }

    // 3. Count existing venues BEFORE this assignment to decide if it's the first
    const { count } = await svc
      .from('user_venues')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)

    const isFirst = (count ?? 0) <= 1   // just inserted, so <=1 means it's the first

    if (isFirst) {
      // Upsert venue_profiles (handles users who have no row yet)
      const { error: profErr } = await svc
        .from('venue_profiles')
        .upsert(
          { user_id, wp_venue_id, status: 'active' },
          { onConflict: 'user_id' }
        )
      if (profErr) console.error('[assign-venue] venue_profiles upsert error', profErr)
    }

    // 4. Return fresh data so the admin UI can update
    const { data: uvData } = await svc.from('user_venues').select('*').eq('user_id', user_id)
    const { data: profData } = await svc.from('venue_profiles').select('*').eq('user_id', user_id).single()

    return NextResponse.json({ success: true, user_venues: uvData, profile: profData, subscription_id: subId })
  } catch (err: any) {
    console.error('[/api/admin/assign-venue]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── DELETE /api/admin/assign-venue ────────────────────────────────────────────
// Body: { uv_id }
export async function DELETE(req: NextRequest) {
  try {
    const authClient = await requireAdmin(req)
    if (!authClient) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const { uv_id } = await req.json()
    if (!uv_id) return NextResponse.json({ error: 'uv_id requerido' }, { status: 400 })

    const svc = getServiceClient()

    // 1. Get the row BEFORE deleting so we know the user_id
    const { data: uvRow } = await svc.from('user_venues').select('user_id, wp_venue_id').eq('id', uv_id).single()
    if (!uvRow) return NextResponse.json({ error: 'Venue no encontrado' }, { status: 404 })

    // 2. Delete the row
    const { error: delErr } = await svc.from('user_venues').delete().eq('id', uv_id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    // 3. Check remaining venues for this user
    const { data: remaining } = await svc.from('user_venues').select('wp_venue_id').eq('user_id', uvRow.user_id)

    let updatedProfile = null
    if (!remaining || remaining.length === 0) {
      // No venues left — clear primary venue, set inactive, wipe pending changes
      await svc.from('venue_profiles').update({ wp_venue_id: null, status: 'inactive' }).eq('user_id', uvRow.user_id)
      await svc.from('venue_onboarding').update({ changes_data: null, changes_status: null }).eq('user_id', uvRow.user_id)
    } else {
      // Reassign primary venue to first remaining
      const nextId = remaining[0].wp_venue_id
      await svc.from('venue_profiles').update({ wp_venue_id: nextId }).eq('user_id', uvRow.user_id)
    }

    const { data: profData } = await svc.from('venue_profiles').select('*').eq('user_id', uvRow.user_id).single()
    updatedProfile = profData

    return NextResponse.json({ success: true, user_id: uvRow.user_id, profile: updatedProfile })
  } catch (err: any) {
    console.error('[/api/admin/assign-venue DELETE]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

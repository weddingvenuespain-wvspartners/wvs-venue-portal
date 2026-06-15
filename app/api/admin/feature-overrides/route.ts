import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function requireAdmin(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('venue_profiles').select('role').eq('user_id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

// GET /api/admin/feature-overrides?userId=xxx — Get overrides for a user
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const userId = req.nextUrl.searchParams.get('userId')
  const svc = getServiceClient()

  try {
    if (userId) {
      // Get overrides for specific user
      const { data } = await svc
        .from('venue_feature_overrides')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      // Also get the current features_override from venue_profiles
      const { data: profile } = await svc
        .from('venue_profiles')
        .select('features_override')
        .eq('user_id', userId)
        .single()

      return NextResponse.json({
        overrides: data || [],
        legacy_overrides: profile?.features_override || {},
      })
    } else {
      // Get all overrides (for admin overview)
      const { data } = await svc
        .from('venue_feature_overrides')
        .select('*, venue_profiles!user_id(display_name, first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(100)

      return NextResponse.json({ overrides: data || [] })
    }
  } catch (err: any) {
    console.error('[admin/feature-overrides GET]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin/feature-overrides — Set a feature override for a user
// Body: { userId, featureKey, enabled, reason? }
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  try {
    const { userId, featureKey, enabled, reason } = await req.json()
    if (!userId || !featureKey) return NextResponse.json({ error: 'userId y featureKey requeridos' }, { status: 400 })

    const svc = getServiceClient()

    // Upsert in venue_feature_overrides table
    const { data, error } = await svc
      .from('venue_feature_overrides')
      .upsert({
        user_id: userId,
        feature_key: featureKey,
        enabled: enabled !== false,
        reason: reason || null,
        set_by: admin.id,
      }, { onConflict: 'user_id,feature_key' })
      .select()
      .single()

    if (error) throw error

    // Also sync to venue_profiles.features_override (for backward compat)
    const { data: allOverrides } = await svc
      .from('venue_feature_overrides')
      .select('feature_key, enabled')
      .eq('user_id', userId)

    const overrideObj: Record<string, boolean> = {}
    allOverrides?.forEach((o: any) => { overrideObj[o.feature_key] = o.enabled })

    await svc
      .from('venue_profiles')
      .update({ features_override: overrideObj })
      .eq('user_id', userId)

    return NextResponse.json({ override: data })
  } catch (err: any) {
    console.error('[admin/feature-overrides POST]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/admin/feature-overrides — Remove a feature override
// Body: { userId, featureKey }
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  try {
    const { userId, featureKey } = await req.json()
    if (!userId || !featureKey) return NextResponse.json({ error: 'userId y featureKey requeridos' }, { status: 400 })

    const svc = getServiceClient()

    await svc
      .from('venue_feature_overrides')
      .delete()
      .eq('user_id', userId)
      .eq('feature_key', featureKey)

    // Sync to venue_profiles
    const { data: remaining } = await svc
      .from('venue_feature_overrides')
      .select('feature_key, enabled')
      .eq('user_id', userId)

    const overrideObj: Record<string, boolean> = {}
    remaining?.forEach((o: any) => { overrideObj[o.feature_key] = o.enabled })

    await svc
      .from('venue_profiles')
      .update({ features_override: Object.keys(overrideObj).length > 0 ? overrideObj : null })
      .eq('user_id', userId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[admin/feature-overrides DELETE]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

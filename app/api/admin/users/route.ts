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

async function getSession() {
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
  return { userId: session.user.id, role: me?.role ?? 'venue_owner' }
}

// GET /api/admin/users
// Returns all venue_profiles enriched with email + last_sign_in_at from auth.users
export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const svc = getServiceClient()

    const [{ data: profiles }, { data: { users } }] = await Promise.all([
      svc.from('venue_profiles').select('*').order('created_at', { ascending: false }),
      svc.auth.admin.listUsers({ perPage: 1000 }),
    ])

    // Build email/last_sign_in map keyed by user_id
    const authMap: Record<string, { email: string; last_sign_in_at: string | null }> = {}
    users?.forEach(u => {
      authMap[u.id] = { email: u.email ?? '', last_sign_in_at: u.last_sign_in_at ?? null }
    })

    const enriched = (profiles ?? []).map(p => ({
      ...p,
      email:           authMap[p.user_id]?.email           ?? null,
      last_sign_in_at: authMap[p.user_id]?.last_sign_in_at ?? null,
    }))

    return NextResponse.json({ profiles: enriched })
  } catch (err: any) {
    console.error('[/api/admin/users]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PATCH /api/admin/users
// Update a venue_profile.
// - Admins can update any profile (all fields including admin_notes)
// - Venue owners can only update their OWN profile (safe fields only)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const { user_id, ...rawFields } = await req.json()
    if (!user_id) return NextResponse.json({ error: 'user_id requerido' }, { status: 400 })

    const isAdmin = session.role === 'admin'

    // Non-admins can only update their own profile and only safe fields
    if (!isAdmin) {
      if (user_id !== session.userId)
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      // Strip fields that only admins should be able to set
      const { admin_notes, role, status, wp_venue_id, wp_username, ...safeFields } = rawFields
      const fields = safeFields
      const svc = getServiceClient()
      const { data, error } = await svc
        .from('venue_profiles').update(fields).eq('user_id', user_id).select().single()
      if (error) throw error
      return NextResponse.json({ profile: data })
    }

    // Admin: update any field
    const svc = getServiceClient()
    const { data, error } = await svc
      .from('venue_profiles').update(rawFields).eq('user_id', user_id).select().single()
    if (error) throw error
    return NextResponse.json({ profile: data })
  } catch (err: any) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

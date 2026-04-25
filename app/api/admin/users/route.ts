import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { sendActivationEmail } from '@/lib/mailer'

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: me } = await supabase
    .from('venue_profiles').select('role').eq('user_id', user.id).single()
  return { userId: user.id, role: me?.role ?? 'venue_owner' }
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

    // Fetch current status before update to detect activation
    const { data: current } = await svc
      .from('venue_profiles').select('status, display_name, company').eq('user_id', user_id).single()

    const { data, error } = await svc
      .from('venue_profiles').update(rawFields).eq('user_id', user_id).select().single()
    if (error) throw error

    // Auto-send activation email + create trial when status changes to 'active'
    const wasActivated =
      current?.status === 'pending' && rawFields.status === 'active'

    if (wasActivated) {
      // 1. Send activation email
      try {
        const { data: { users } } = await svc.auth.admin.listUsers({ perPage: 1000 })
        const authUser = users?.find(u => u.id === user_id)
        if (authUser?.email) {
          const venueName = current?.display_name || current?.company || ''
          await sendActivationEmail(authUser.email, venueName)
        }
      } catch (mailErr) {
        console.error('[activation email]', mailErr)
      }

      // 2. Auto-create trial subscription if trial is enabled and venue has no subscription yet
      try {
        const { data: trialConfig } = await svc
          .from('trial_config').select('is_active, trial_days, trial_plan_id').eq('id', 1).maybeSingle()

        if (trialConfig?.is_active) {
          // Only create trial if venue doesn't already have any subscription
          const { data: existingSub } = await svc
            .from('venue_subscriptions')
            .select('id')
            .eq('user_id', user_id)
            .in('status', ['active', 'trial', 'paused'])
            .maybeSingle()

          if (!existingSub) {
            const today    = new Date()
            const trialEnd = new Date()
            trialEnd.setDate(today.getDate() + (trialConfig.trial_days ?? 14))

            await svc.from('venue_subscriptions').insert({
              user_id,
              plan_id:        trialConfig.trial_plan_id ?? null,
              billing_cycle:  null,
              status:         'trial',
              start_date:     today.toISOString().slice(0, 10),
              trial_end_date: trialEnd.toISOString().slice(0, 10),
            })
          }
        }
      } catch (trialErr) {
        console.error('[auto trial]', trialErr)
      }
    }

    return NextResponse.json({ profile: data, emailSent: wasActivated })
  } catch (err: any) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

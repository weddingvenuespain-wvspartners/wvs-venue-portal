import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS
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
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  )
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false
  const { data: me } = await supabase
    .from('venue_profiles').select('role').eq('user_id', session.user.id).single()
  return me?.role === 'admin'
}

// ── POST /api/admin/create-user ───────────────────────────────────────────────
// Body: {
//   email,
//   first_name?, last_name?, phone?, company?,
//   plan_id?,        — if set, creates a subscription
//   billing_cycle?,  — must match a BillingCycle.id on the plan
//   start_trial?,    — boolean, default false
//   trial_days?,     — number (only used when start_trial=true)
// }
export async function POST(req: NextRequest) {
  try {
    const isAdmin = await requireAdmin()
    if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const {
      email, first_name, last_name, phone, company,
      plan_id, billing_cycle, start_trial, trial_days,
    } = await req.json()

    if (!email?.trim()) return NextResponse.json({ error: 'El email es obligatorio' }, { status: 400 })

    const svc = getServiceClient()

    // 1. Send invitation email — creates auth user + envía email con link para establecer contraseña
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.weddingvenuesspain.com'
    const { data: inviteData, error: inviteErr } = await svc.auth.admin.inviteUserByEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${appUrl}/login` }
    )

    if (inviteErr) {
      // If user already exists in auth, try to just fetch their ID
      if (inviteErr.message?.toLowerCase().includes('already registered') ||
          inviteErr.message?.toLowerCase().includes('already been registered')) {
        return NextResponse.json(
          { error: 'Este email ya está registrado en el sistema' },
          { status: 400 }
        )
      }
      throw inviteErr
    }

    const userId = inviteData.user.id

    // 2. Create venue_profile (upsert in case it already exists)
    const { error: profErr } = await svc.from('venue_profiles').upsert({
      user_id:    userId,
      role:       'venue_owner',
      status:     'pending',
      first_name: first_name?.trim() || null,
      last_name:  last_name?.trim()  || null,
      phone:      phone?.trim()      || null,
      company:    company?.trim()    || null,
    }, { onConflict: 'user_id' })
    if (profErr) console.error('[create-user] profile error', profErr)

    // 3. Optionally create trial subscription
    let subId: string | null = null
    if (plan_id && start_trial) {
      const cycle   = billing_cycle || 'yearly'
      const days    = parseInt(trial_days) || 14
      const today   = new Date()
      const trialEnd = new Date()
      trialEnd.setDate(today.getDate() + days)

      const { data: sub, error: subErr } = await svc
        .from('venue_subscriptions')
        .insert({
          user_id:        userId,
          plan_id,
          billing_cycle:  cycle,
          status:         'trial',
          start_date:     today.toISOString().slice(0, 10),
          trial_end_date: trialEnd.toISOString().slice(0, 10),
          renewal_date:   null,
        })
        .select().single()

      if (subErr) console.error('[create-user] subscription error', subErr)
      else subId = sub?.id || null
    }

    // 4. Return fresh profile
    const { data: profile } = await svc
      .from('venue_profiles').select('*').eq('user_id', userId).single()

    return NextResponse.json({ success: true, user_id: userId, profile, subscription_id: subId })
  } catch (err: any) {
    console.error('[/api/admin/create-user]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

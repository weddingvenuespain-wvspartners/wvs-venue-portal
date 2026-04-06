import { NextResponse } from 'next/server'
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

// GET /api/admin/stats
// Returns aggregate metrics for the admin dashboard
export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const svc = getServiceClient()

    const [{ data: profiles }, { data: subs }] = await Promise.all([
      svc.from('venue_profiles')
        .select('user_id, first_name, last_name, company, email, created_at, status')
        .neq('role', 'admin')
        .order('created_at', { ascending: false }),
      svc.from('venue_subscriptions')
        .select('user_id, status, trial_end_date, plan_id, renewal_date')
        .in('status', ['active', 'trial', 'paused']),
    ])

    const subMap: Record<string, typeof subs extends (infer T)[] | null ? T : never> = {}
    subs?.forEach(s => { if (!subMap[s.user_id]) subMap[s.user_id] = s })

    const total   = profiles?.length ?? 0
    const active  = subs?.filter(s => s.status === 'active').length ?? 0
    const trial   = subs?.filter(s => s.status === 'trial').length ?? 0
    const paused  = subs?.filter(s => s.status === 'paused').length ?? 0
    const noPlan  = (profiles ?? []).filter(p => !subMap[p.user_id]).length

    const now = Date.now()
    const in7days = now + 7 * 86400000

    const expiringSoon = (subs ?? [])
      .filter(s => s.status === 'trial' && s.trial_end_date)
      .filter(s => {
        const t = new Date(s.trial_end_date!).getTime()
        return t >= now && t <= in7days
      })
      .map(s => {
        const p = profiles?.find(p => p.user_id === s.user_id)
        const daysLeft = Math.ceil((new Date(s.trial_end_date!).getTime() - now) / 86400000)
        return {
          user_id:    s.user_id,
          name:       [p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.company || '—',
          email:      p?.email ?? null,
          trial_end_date: s.trial_end_date,
          daysLeft,
        }
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)

    const recentSignups = (profiles ?? []).slice(0, 6).map(p => ({
      user_id:    p.user_id,
      name:       [p.first_name, p.last_name].filter(Boolean).join(' ') || p.company || '—',
      email:      p.email ?? null,
      created_at: p.created_at,
      status:     p.status,
      sub_status: subMap[p.user_id]?.status ?? null,
    }))

    return NextResponse.json({
      total, active, trial, paused, noPlan,
      expiringSoon,
      recentSignups,
    })
  } catch (err: any) {
    console.error('[/api/admin/stats]', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}

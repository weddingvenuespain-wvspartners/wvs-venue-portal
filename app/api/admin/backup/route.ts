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

/**
 * Auth check — two methods accepted:
 *  1. API key via "Authorization: Bearer <BACKUP_API_KEY>" header (for GitHub Actions / cron)
 *  2. Browser session cookie with admin role (for manual download from the portal)
 */
async function isAuthorized(req: NextRequest): Promise<boolean> {
  // Method 1: API key (for automated backups)
  const apiKey = process.env.BACKUP_API_KEY
  const authHeader = req.headers.get('Authorization') ?? ''
  if (apiKey && authHeader === `Bearer ${apiKey}`) return true

  // Method 2: session cookie with admin role
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return false
    const { data: me } = await supabase
      .from('venue_profiles').select('role').eq('user_id', session.user.id).single()
    return me?.role === 'admin'
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!await isAuthorized(req)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const svc = getServiceClient()

    const [
      venueProfilesRes,
      leadsRes,
      proposalsRes,
      subscriptionsRes,
      plansRes,
      paymentHistoryRes,
    ] = await Promise.all([
      svc.from('venue_profiles').select('*').order('created_at', { ascending: false }),
      svc.from('leads').select('*').order('created_at', { ascending: false }),
      svc.from('proposals').select('*').order('created_at', { ascending: false }),
      svc.from('venue_subscriptions').select('*').order('created_at', { ascending: false }),
      svc.from('venue_plans').select('*').order('created_at', { ascending: false }),
      svc.from('venue_payment_history').select('*').order('created_at', { ascending: false }),
    ])

    const recordCounts = {
      venue_profiles:      venueProfilesRes.data?.length  ?? 0,
      leads:               leadsRes.data?.length           ?? 0,
      proposals:           proposalsRes.data?.length       ?? 0,
      venue_subscriptions: subscriptionsRes.data?.length   ?? 0,
      venue_plans:         plansRes.data?.length            ?? 0,
      venue_payment_history: paymentHistoryRes.data?.length ?? 0,
    }

    const backupData = {
      backup_at:    new Date().toISOString(),
      record_counts: recordCounts,
      venue_profiles:      venueProfilesRes.data  ?? [],
      leads:               leadsRes.data           ?? [],
      proposals:           proposalsRes.data       ?? [],
      venue_subscriptions: subscriptionsRes.data   ?? [],
      venue_plans:         plansRes.data            ?? [],
      venue_payment_history: paymentHistoryRes.data ?? [],
    }

    // Log the backup (silent fail if table doesn't exist)
    try {
      await svc.from('backup_log').insert({
        created_at: new Date().toISOString(),
        record_counts: recordCounts,
        source: req.headers.get('Authorization') ? 'api_key' : 'browser',
      })
    } catch { /* table may not exist yet */ }

    const json = JSON.stringify(backupData, null, 2)
    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="wvs-backup-${date}.json"`,
      },
    })
  } catch (err: any) {
    console.error('[/api/admin/backup]', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}

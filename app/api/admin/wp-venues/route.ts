import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function isAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: me } = await supabase
    .from('venue_profiles').select('role').eq('user_id', user.id).single()
  return me?.role === 'admin'
}

// GET /api/admin/wp-venues — proxy WP REST API to avoid CORS
export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // WordPress REST API may require auth for custom post types
    const headers: Record<string, string> = {
      'User-Agent': 'WVS-Venue-Portal/1.0',
    }
    const wpUser = process.env.WORDPRESS_ADMIN_USER
    const wpPass = process.env.WORDPRESS_APP_PASSWORD || process.env.WORDPRESS_ADMIN_PASSWORD
    if (wpUser && wpPass) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${wpUser}:${wpPass}`).toString('base64')
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_WP_URL || 'https://weddingvenuesspain.com'}/wp-json/wp/v2/venues?per_page=100&acf_format=standard&_fields=id,title,acf,link`,
      { cache: 'no-store', signal: AbortSignal.timeout(10000), headers }
    )

    if (!res.ok) {
      return NextResponse.json(
        { error: `WP API responded ${res.status}` },
        { status: 502 }
      )
    }

    const data = await res.json()
    return NextResponse.json({ venues: Array.isArray(data) ? data : [] })
  } catch (err: any) {
    console.error('[/api/admin/wp-venues]', err?.message || err)
    return NextResponse.json(
      { error: err?.name === 'TimeoutError' ? 'WP API timeout' : 'Error fetching WP venues' },
      { status: 502 }
    )
  }
}

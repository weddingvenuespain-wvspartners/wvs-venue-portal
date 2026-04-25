import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const WP_URL = process.env.NEXT_PUBLIC_WP_URL || 'https://weddingvenuesspain.com'

export async function GET() {
  try {
    // Auth check — admin only
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const { data: caller } = await supabase
      .from('venue_profiles').select('role').eq('user_id', user.id).single()
    if (caller?.role !== 'admin') return NextResponse.json({ error: 'Solo admin' }, { status: 403 })

    const token    = process.env.WVS_REST_TOKEN
    const wpUser   = process.env.WORDPRESS_ADMIN_USER
    const svcKey   = process.env.SUPABASE_SERVICE_ROLE_KEY

    const result: Record<string, any> = {
      env: {
        WVS_REST_TOKEN:            token   ? `SET (${token.length} chars, starts: "${token.slice(0,4)}...")` : 'NOT SET',
        WORDPRESS_ADMIN_USER:      wpUser  ? `SET ("${wpUser}")` : 'NOT SET',
        WORDPRESS_ADMIN_PASSWORD:  process.env.WORDPRESS_ADMIN_PASSWORD ? 'SET' : 'NOT SET',
        SUPABASE_SERVICE_ROLE_KEY: svcKey  ? `SET (${svcKey.length} chars)` : 'NOT SET',
        NEXT_PUBLIC_WP_URL:        WP_URL,
      }
    }

    // Test WordPress token directly if set
    if (token) {
      try {
        const testRes = await fetch(`${WP_URL}/wp-json/wvs/v1/venue/1/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-WVS-Token': token },
          body: JSON.stringify({ title: '__debug_test__' }),
        })
        const testBody = await testRes.json().catch(() => ({}))
        result.wp_token_test = {
          status: testRes.status,
          // 404 = auth passed but post not found (correct!) | 403 / "not allowed" = wrong token
          auth_passed: testRes.status !== 403 && !(testBody?.message?.includes('not allowed')),
          response: testBody,
        }
      } catch (e: any) {
        result.wp_token_test = { error: e?.message }
      }
    }

    return NextResponse.json(result, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

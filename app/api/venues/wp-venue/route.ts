import { NextRequest, NextResponse } from 'next/server'

const WP_URL = process.env.NEXT_PUBLIC_WP_URL || 'https://weddingvenuesspain.com'

function getAdminAuth() {
  const user = process.env.WORDPRESS_ADMIN_USER
  const pass = process.env.WORDPRESS_ADMIN_PASSWORD
  if (!user || !pass) return null
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // 1. Try the custom WVS endpoint first — returns ALL ACF fields via get_field()
  //    Requires: add the wvs-venue-endpoint.php snippet to your WordPress site
  try {
    const customRes = await fetch(`${WP_URL}/wp-json/wvs/v1/venue/${id}`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    })
    if (customRes.ok) {
      const data = await customRes.json()
      // Custom endpoint returns acf at top level — perfect
      return NextResponse.json({ ...data, _source: 'custom' })
    }
  } catch {
    // Custom endpoint not installed yet — fall through to standard
  }

  // 2. Fall back to standard WP REST endpoint
  const auth = getAdminAuth()
  const headers: Record<string, string> = {}
  if (auth) headers['Authorization'] = auth
  try {
    const wpRes = await fetch(
      `${WP_URL}/wp-json/wp/v2/venues/${id}?acf_format=standard`,
      { headers, cache: 'no-store' }
    )
    if (!wpRes.ok) {
      const err = await wpRes.json().catch(() => ({}))
      return NextResponse.json(
        { error: `WP error ${wpRes.status}: ${err.message || 'unknown'}` },
        { status: wpRes.status }
      )
    }
    const data = await wpRes.json()
    return NextResponse.json({ ...data, _source: 'standard' })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to reach WordPress' }, { status: 502 })
  }
}

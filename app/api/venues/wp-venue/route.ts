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

  const auth = getAdminAuth()
  const headers: Record<string, string> = {}
  if (auth) headers['Authorization'] = auth

  // Fire both endpoints in parallel — prefer custom, fall back to standard
  const customPromise = fetch(`${WP_URL}/wp-json/wvs/v1/venue/${id}`, {
    next: { revalidate: 300 },
  }).then(async res => {
    if (!res.ok) throw new Error('custom endpoint failed')
    const data = await res.json()
    return { ...data, _source: 'custom' as const }
  })

  const standardPromise = fetch(
    `${WP_URL}/wp-json/wp/v2/venues/${id}?acf_format=standard`,
    { headers, next: { revalidate: 300 } },
  ).then(async res => {
    if (!res.ok) throw new Error(`WP error ${res.status}`)
    const data = await res.json()
    return { ...data, _source: 'standard' as const }
  })

  try {
    const [customResult, standardResult] = await Promise.allSettled([customPromise, standardPromise])

    if (customResult.status === 'fulfilled') {
      return NextResponse.json(customResult.value)
    }
    if (standardResult.status === 'fulfilled') {
      return NextResponse.json(standardResult.value)
    }

    return NextResponse.json(
      { error: 'Failed to reach WordPress' },
      { status: 502 },
    )
  } catch {
    return NextResponse.json({ error: 'Failed to reach WordPress' }, { status: 502 })
  }
}

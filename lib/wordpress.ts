const WP_URL = process.env.NEXT_PUBLIC_WP_URL || 'https://weddingvenuesspain.com'

export async function getVenue(id: number) {
  const res = await fetch(`${WP_URL}/wp-json/wp/v2/venues/${id}?acf_format=standard`, {
    cache: 'no-store'
  })
  if (!res.ok) return null
  return res.json()
}

export async function getAllVenues() {
  const res = await fetch(`${WP_URL}/wp-json/wp/v2/venues?per_page=100&acf_format=standard`, {
    cache: 'no-store'
  })
  if (!res.ok) return []
  return res.json()
}

export async function updateVenue(id: number, data: any, token: string) {
  const res = await fetch(`${WP_URL}/wp-json/wp/v2/venues/${id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })
  return res.json()
}

export async function getWPToken(username: string, password: string) {
  const res = await fetch(`${WP_URL}/wp-json/jwt-auth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  return res.json()
}

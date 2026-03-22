const WP_URL = process.env.NEXT_PUBLIC_WP_URL || 'https://weddingvenuesspain.com'

export async function getVenue(id: number) {
  const res = await fetch(
    `${WP_URL}/wp-json/wp/v2/wedding-venues/${id}?acf_format=standard`,
    { cache: 'no-store' }
  )
  if (!res.ok) return null
  return res.json()
}

export async function getAllVenues() {
  const res = await fetch(
    `${WP_URL}/wp-json/wp/v2/wedding-venues?per_page=100&acf_format=standard`,
    { cache: 'no-store' }
  )
  if (!res.ok) return []
  return res.json()
}

export async function getLocations() {
  const res = await fetch(
    `${WP_URL}/wp-json/wp/v2/locations?per_page=100`,
    { cache: 'no-store' }
  )
  if (!res.ok) return []
  return res.json()
}

export async function getStyles() {
  const res = await fetch(
    `${WP_URL}/wp-json/wp/v2/style?per_page=100`,
    { cache: 'no-store' }
  )
  if (!res.ok) return []
  return res.json()
}

export async function getWPToken(username: string, password: string) {
  const res = await fetch(`${WP_URL}/wp-json/jwt-auth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return res.json()
}

export const ACCOMMODATION_OPTIONS = [
  { value: 'yes',      label: 'Sí, incluye alojamiento' },
  { value: 'no',       label: 'No incluye alojamiento' },
  { value: 'optional', label: 'Alojamiento opcional' },
]

export const VENUE_PRICE_OPTIONS = [
  { value: '$',   label: '$ — Precio económico' },
  { value: '$$',  label: '$$ — Precio medio' },
  { value: '$$$', label: '$$$ — Precio alto' },
]

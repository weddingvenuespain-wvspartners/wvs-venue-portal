// Publicación del canal weddingvenuesspain.com.
// Convierte la ficha_data del editor (canal de venta) en las columnas planas
// de venue_onboarding que expone la vista public_venues, que es la fuente de
// datos en runtime de la web nueva (wvs-web). Sustituye la antigua publicación
// a WordPress.

// ── Saneado HTML (mismas reglas que la antigua publicación a WP) ─────────────

export function stripDangerousHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}

function cleanPostContent(html: string): string {
  return html
    .replace(/<div>(\s*<br\s*\/?>?\s*)<\/div>/gi, '')
    .replace(/<p>(\s*<br\s*\/?>?\s*)<\/p>/gi, '')
    .trim()
}

// ── Taxonomías de wvs-web ────────────────────────────────────────────────────
// Slugs de estilo válidos (content/wp/styles.json de wvs-web).
export const WVS_STYLE_SLUGS = ['beach', 'castle', 'hotel', 'luxury', 'villa', 'vineyard'] as const

// Regiones con página de location en wvs-web (content/wp/locations.json).
const LOCATION_SLUG_REGIONS = new Set(['mallorca', 'ibiza', 'barcelona', 'malaga', 'marbella'])

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

// '$'→'€' (fichas antiguas guardaban símbolos de dólar)
function toEuroLevel(v: string): string | null {
  if (!v) return null
  const level = v.replace(/\$/g, '€')
  return /^€{1,3}$/.test(level) ? level : null
}

function toNumber(v: unknown): number | null {
  const n = parseFloat(String(v ?? '').replace(/[^\d.,-]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function toInt(v: unknown): number | null {
  const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

// "5500" → "5,500€" (formato de venue_from_display existente en la web)
function euros(value: string): string {
  const n = toNumber(value)
  if (n === null) return ''
  return `${n.toLocaleString('en-US')}€`
}

export interface PublicVenueColumns {
  name: string
  description: string | null
  tagline: string | null
  region: string | null
  location_slug: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  capacity_min: number | null
  capacity_max: number | null
  menu_price: string | null
  venue_price_level: string | null
  venue_from_display: string | null
  catering_from: string | null
  accommodation_note: string | null
  airport_info: string | null
  nearby: string | null
  video_hero_url: string | null
  whatsapp_number: string | null
  style_slugs: string[] | null
  photo_urls: string[] | null
  content_html: string | null
  seo_title: string
  seo_description: string | null
  testimonials: { quote: string; author: string }[]
  faqs: { question: string; answer: string }[]
  published_at: string
  updated_at: string
}

// d = ficha_data del editor (ver collectAllFields en app/channels/weddingvenuesspain/page.tsx)
export function buildPublicVenueColumns(d: Record<string, any>): PublicVenueColumns {
  const regionRaw = String(d.location || '').trim()
  const region = regionRaw ? slugify(regionRaw) : null

  // Precio del menú: "200€/person" (formato que muestra la web)
  const menuUnit = d.menuPriceUnit === 'day' ? 'day' : 'person'
  const menuPrice = d.menuPriceValue ? `${d.menuPriceValue}€/${menuUnit}` : null

  // Venue fee: "5,500€" o "5,500€ (2 Nights)" — 'Included in menu' si va incluido
  let venueFrom: string | null = null
  if (d.venueFeeIncluded) {
    venueFrom = 'Included in menu'
  } else if (d.venueFeeValue) {
    const nights = parseInt(d.venueFeeNights) || 0
    const nightsTxt = nights > 0 ? ` (${nights} Night${nights > 1 ? 's' : ''})` : ''
    venueFrom = `${euros(d.venueFeeValue)}${nightsTxt}` || null
  }

  const cateringUnit = ['person', 'day', 'event'].includes(d.cateringFeeUnit) ? d.cateringFeeUnit : 'person'
  const cateringFrom = d.cateringFeeValue ? `${d.cateringFeeValue}€/${cateringUnit}` : null

  let accommodationNote: string | null = null
  if (d.accommodation === 'yes') {
    const g = d.accomGuests ? `${d.accomGuests} guests` : 'guests'
    const n = d.accomNights ? ` ${d.accomNights} night${parseInt(d.accomNights) !== 1 ? 's' : ''}` : ''
    accommodationNote = `Included for ${g}${n}`
  } else if (d.accommodation === 'optional' || d.wvsAccomHelp) {
    accommodationNote = 'On request'
  } else if (d.accommodation === 'no') {
    accommodationNote = 'Not included'
  }

  // Fotos: hero primero (la web usa la primera como portada), luego la galería
  const gallery: string[] = (Array.isArray(d.gallery) ? d.gallery : [])
    .map((g: any) => (g && typeof g === 'object' ? g.url : typeof g === 'string' ? g : ''))
    .filter((u: string) => u && !u.startsWith('blob:'))
  const photoUrls = [d.heroImageUrl, ...gallery]
    .filter((u: string) => u && !u.startsWith('blob:'))
    .filter((u: string, i: number, arr: string[]) => arr.indexOf(u) === i)

  // Contenido: mini párrafo de apertura + descripción completa
  const miniParagraph = String(d.miniParagraph || '').trim()
  const post = cleanPostContent(String(d.postContent || ''))
  const contentHtml = stripDangerousHtml(
    [miniParagraph && !post.includes(miniParagraph) ? `<p>${miniParagraph}</p>` : '', post]
      .filter(Boolean)
      .join('\n')
  ).trim()

  const testimonials = (d.reviewsEnabled !== false && Array.isArray(d.reviews) ? d.reviews : [])
    .filter((r: any) => r?.text?.trim())
    .map((r: any) => ({
      quote: String(r.text).trim(),
      author: [r.couple_name, r.country].map((s: any) => String(s || '').trim()).filter(Boolean).join(', '),
    }))

  const faqs = (Array.isArray(d.faqs) ? d.faqs : [])
    .filter((f: any) => f?.question?.trim() && f?.answer?.trim())
    .map((f: any) => ({ question: String(f.question).trim(), answer: String(f.answer).trim() }))

  const styles = (Array.isArray(d.styles) ? d.styles : [])
    .filter((s: any) => (WVS_STYLE_SLUGS as readonly string[]).includes(s))

  const now = new Date().toISOString()

  return {
    name: String(d.H1_Venue || '').trim(),
    description: String(d.shortDesc || '').trim() || null,
    tagline: String(d.miniDesc || '').trim() || null,
    region,
    location_slug: region && LOCATION_SLUG_REGIONS.has(region) ? `${region}-wedding-venues` : null,
    city: String(d.specificLocation || '').trim() || null,
    latitude: toNumber(d.latitude),
    longitude: toNumber(d.longitude),
    capacity_min: toInt(d.capacityMin),
    capacity_max: toInt(d.capacity),
    menu_price: menuPrice,
    venue_price_level: toEuroLevel(String(d.venuePrice || '')),
    venue_from_display: venueFrom,
    catering_from: cateringFrom,
    accommodation_note: accommodationNote,
    airport_info: String(d.closestAirport || '').trim() || null,
    nearby: String(d.placesNearby || '').trim() || null,
    video_hero_url: String(d.videoHeroUrl || '').trim() || null,
    whatsapp_number: String(d.whatsappNumber || '').trim() || null,
    style_slugs: styles.length ? styles : null,
    photo_urls: photoUrls.length ? photoUrls : null,
    content_html: contentHtml || null,
    // Mismo patrón de title que las fichas importadas del WP antiguo
    seo_title: `${String(d.H1_Venue || '').trim()} - Wedding Venues Spain`,
    seo_description: String(d.shortDesc || '').trim() || null,
    testimonials,
    faqs,
    published_at: now,
    updated_at: now,
  }
}

// Avisa a wvs-web para que regenere la página del venue (ISR revalidateTag).
// Fallo no fatal: la web se regenera sola cada 24 h como red de seguridad.
export async function revalidateWvsWeb(slug: string): Promise<void> {
  const base = process.env.WVS_WEB_URL || 'https://weddingvenuesspain.com'
  const secret = process.env.WVS_WEB_REVALIDATE_SECRET
  if (!secret) {
    console.warn('[wvs-publish] WVS_WEB_REVALIDATE_SECRET no configurado; sin revalidación inmediata')
    return
  }
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': secret },
      body: JSON.stringify({ slug, entity: 'venue' }),
    })
    if (!res.ok) console.error('[wvs-publish] revalidate failed:', res.status, await res.text())
  } catch (e) {
    console.error('[wvs-publish] revalidate error:', e)
  }
}

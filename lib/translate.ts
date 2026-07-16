// Traducción automática vía DeepL API para wvs-web.
// Idiomas soportados: es, de, fr (nunca traducimos a en; en es el original).
//
// La API Free (500k chars/mes) es más que suficiente para 22 venues x 3 idiomas
// x ~2000 chars/venue = ~132k chars por lote completo. Devoluciones no fatales:
// si DeepL falla, dejamos el campo vacío y wvs-web hace fallback al inglés.

export type Lang = 'es' | 'de' | 'fr'
export const TARGET_LANGS: Lang[] = ['es', 'de', 'fr']

const DEEPL_TARGET: Record<Lang, string> = {
  es: 'ES',
  de: 'DE',
  fr: 'FR',
}

interface DeepLResponse {
  translations: { detected_source_language: string; text: string }[]
}

// Endpoint según tipo de key. Las keys API Free acaban en ':fx' y van al
// subdominio api-free; las Pro van a api.deepl.com.
function deepLEndpoint(key: string): string {
  return key.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate'
}

// Traduce un array de strings de en → targetLang en una sola llamada (más
// eficiente que N llamadas). Devuelve array del mismo tamaño; si algún texto
// falla o está vacío, devuelve string vacía en esa posición.
async function deepLBatch(
  texts: string[],
  targetLang: Lang,
  opts: { html?: boolean } = {}
): Promise<string[]> {
  const key = process.env.DEEPL_API_KEY
  if (!key) throw new Error('DEEPL_API_KEY no configurada')

  const params = new URLSearchParams()
  for (const t of texts) params.append('text', t || ' ') // DeepL rechaza strings vacías
  params.append('source_lang', 'EN')
  params.append('target_lang', DEEPL_TARGET[targetLang])
  if (opts.html) params.append('tag_handling', 'html')
  params.append('preserve_formatting', '1')

  const res = await fetch(deepLEndpoint(key), {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  if (!res.ok) {
    throw new Error(`DeepL ${res.status}: ${await res.text()}`)
  }
  const data = (await res.json()) as DeepLResponse
  return data.translations.map(t => t.text)
}

// Estructura completa de una traducción de un venue.
export interface VenueTranslation {
  name?: string | null
  description?: string | null
  tagline?: string | null
  content_html?: string | null
  seo_title?: string | null
  seo_description?: string | null
  accommodation_note?: string | null
  testimonials?: { quote: string; author: string }[]
  faqs?: { question: string; answer: string }[]
}

export interface VenueSource {
  name: string
  description: string | null
  tagline: string | null
  content_html: string | null
  seo_title: string | null
  seo_description: string | null
  accommodation_note: string | null
  testimonials: { quote: string; author: string }[] | null
  faqs: { question: string; answer: string }[] | null
}

// Traduce todos los campos de texto de un venue a un idioma. Empaqueta todo
// en una sola llamada por idioma (menos cuota y más rápido).
export async function translateVenueTo(
  v: VenueSource,
  target: Lang
): Promise<VenueTranslation> {
  // 1) Campos de texto plano — una sola llamada
  const plainTexts: string[] = [
    v.name || '',
    v.description || '',
    v.tagline || '',
    v.seo_title || '',
    v.seo_description || '',
    v.accommodation_note || '',
  ]
  const plainOut = await deepLBatch(plainTexts, target)
  const [name, description, tagline, seoTitle, seoDescription, accommodationNote] = plainOut

  // 2) Content HTML — llamada aparte con tag_handling html
  let contentHtml: string | null = null
  if (v.content_html && v.content_html.trim()) {
    const [h] = await deepLBatch([v.content_html], target, { html: true })
    contentHtml = h || null
  }

  // 3) Testimonials — mismo empaquetado; author normalmente son nombres propios
  //    pero DeepL los deja igual si no tiene sentido traducirlos.
  let testimonials: { quote: string; author: string }[] | undefined
  if (v.testimonials?.length) {
    const flat = v.testimonials.flatMap(t => [t.quote, t.author])
    const out = await deepLBatch(flat, target)
    testimonials = v.testimonials.map((_, i) => ({
      quote:  out[i * 2] || v.testimonials![i].quote,
      author: out[i * 2 + 1] || v.testimonials![i].author,
    }))
  }

  // 4) FAQs
  let faqs: { question: string; answer: string }[] | undefined
  if (v.faqs?.length) {
    const flat = v.faqs.flatMap(f => [f.question, f.answer])
    const out = await deepLBatch(flat, target)
    faqs = v.faqs.map((_, i) => ({
      question: out[i * 2]     || v.faqs![i].question,
      answer:   out[i * 2 + 1] || v.faqs![i].answer,
    }))
  }

  return {
    name: name || null,
    description: description || null,
    tagline: tagline || null,
    content_html: contentHtml,
    seo_title: seoTitle || null,
    seo_description: seoDescription || null,
    accommodation_note: accommodationNote || null,
    testimonials,
    faqs,
  }
}

// Traduce a los 3 idiomas de destino y devuelve el mapa completo. Fallos por
// idioma son no fatales: se devuelve un objeto vacío para ese idioma.
export async function translateVenueAll(
  v: VenueSource
): Promise<Record<Lang, VenueTranslation>> {
  const results = await Promise.all(
    TARGET_LANGS.map(async l => {
      try {
        return [l, await translateVenueTo(v, l)] as const
      } catch (e) {
        console.error(`[translate] ${l} falló:`, e)
        return [l, {} as VenueTranslation] as const
      }
    })
  )
  return Object.fromEntries(results) as Record<Lang, VenueTranslation>
}

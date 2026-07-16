// Traduce todos los venues publicados (public_venues) a ES/DE/FR con DeepL
// y guarda el resultado en venue_onboarding.translations. Idempotente: por
// defecto salta los venues que ya tengan translations. Con --force reprocesa.
//
// Uso:
//   node scripts/backfill-translations.mjs           # solo los que no tienen
//   node scripts/backfill-translations.mjs --force   # reprocesa todos
//   node scripts/backfill-translations.mjs --slug=can-marti   # uno solo
//
// Env vars requeridas: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// DEEPL_API_KEY. Se leen de .env.local si existe.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// Carga .env.local (npm run no lo hace automáticamente)
const envPath = join(ROOT, '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DEEPL_KEY    = process.env.DEEPL_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY || !DEEPL_KEY) {
  console.error('Faltan variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEEPL_API_KEY')
  process.exit(1)
}

const args = process.argv.slice(2)
const FORCE   = args.includes('--force')
const ONLY_SLUG = args.find(a => a.startsWith('--slug='))?.split('=')[1] || null

const DEEPL_URL = DEEPL_KEY.endsWith(':fx')
  ? 'https://api-free.deepl.com/v2/translate'
  : 'https://api.deepl.com/v2/translate'

const TARGET_LANGS = ['es', 'de', 'fr']
const DEEPL_TARGET = { es: 'ES', de: 'DE', fr: 'FR' }

async function deepLBatch(texts, targetLang, { html = false } = {}) {
  const params = new URLSearchParams()
  for (const t of texts) params.append('text', t || ' ')
  params.append('source_lang', 'EN')
  params.append('target_lang', DEEPL_TARGET[targetLang])
  if (html) params.append('tag_handling', 'html')
  params.append('preserve_formatting', '1')

  const res = await fetch(DEEPL_URL, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${DEEPL_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.translations.map(t => t.text)
}

async function translateVenueTo(v, target) {
  const plain = [
    v.name || '',
    v.description || '',
    v.tagline || '',
    v.seo_title || '',
    v.seo_description || '',
    v.accommodation_note || '',
  ]
  const [name, description, tagline, seoTitle, seoDescription, accommodationNote] =
    await deepLBatch(plain, target)

  let contentHtml = null
  if (v.content_html?.trim()) {
    const [h] = await deepLBatch([v.content_html], target, { html: true })
    contentHtml = h || null
  }

  let testimonials
  if (v.testimonials?.length) {
    const flat = v.testimonials.flatMap(t => [t.quote, t.author])
    const out = await deepLBatch(flat, target)
    testimonials = v.testimonials.map((t, i) => ({
      quote:  out[i * 2] || t.quote,
      author: out[i * 2 + 1] || t.author,
    }))
  }

  let faqs
  if (v.faqs?.length) {
    const flat = v.faqs.flatMap(f => [f.question, f.answer])
    const out = await deepLBatch(flat, target)
    faqs = v.faqs.map((f, i) => ({
      question: out[i * 2] || f.question,
      answer:   out[i * 2 + 1] || f.answer,
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

async function fetchVenues() {
  let url = `${SUPABASE_URL}/rest/v1/venue_onboarding?status=eq.published&select=id,slug,name,description,tagline,content_html,seo_title,seo_description,accommodation_note,testimonials,faqs,translations`
  if (ONLY_SLUG) url += `&slug=eq.${encodeURIComponent(ONLY_SLUG)}`
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase fetch: ${res.status} ${await res.text()}`)
  return res.json()
}

async function saveTranslations(id, translations) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/venue_onboarding?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ translations }),
  })
  if (!res.ok) throw new Error(`Supabase patch ${id}: ${res.status} ${await res.text()}`)
}

async function main() {
  const rows = await fetchVenues()
  console.log(`[backfill] ${rows.length} venues publicados`)

  let done = 0, skipped = 0, failed = 0
  for (const v of rows) {
    if (!FORCE && v.translations && Object.keys(v.translations).length) {
      console.log(`  ⏭  ${v.slug} — ya tiene traducciones`)
      skipped++
      continue
    }
    console.log(`  →  ${v.slug} traduciendo...`)
    const translations = {}
    for (const lang of TARGET_LANGS) {
      try {
        translations[lang] = await translateVenueTo(v, lang)
      } catch (e) {
        console.error(`     ${lang} falló:`, e.message)
        translations[lang] = {}
      }
    }
    try {
      await saveTranslations(v.id, translations)
      console.log(`     ✓ guardado`)
      done++
    } catch (e) {
      console.error(`     ✗ save falló:`, e.message)
      failed++
    }
  }
  console.log(`\n[backfill] hecho: ${done} guardados, ${skipped} saltados, ${failed} fallos`)
}

main().catch(e => { console.error(e); process.exit(1) })

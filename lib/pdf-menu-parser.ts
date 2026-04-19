'use client'
// Extracción best-effort de menús desde un PDF con pdfjs-dist.
// Funciona 100% en cliente, sin tokens ni servidor.
// Solo funciona si el PDF tiene texto seleccionable (no escaneado).

import type { Menu, MenuCourse } from './proposal-types'

// Palabras que indican un encabezado de curso
const COURSE_KEYWORDS = [
  'aperitivo', 'aperitivos',
  'entrante', 'entrantes',
  'primer plato', 'primeros',
  'plato principal', 'principal', 'principales', 'segundo', 'segundos',
  'postre', 'postres',
  'pastel', 'tarta nupcial', 'pastel nupcial',
  'café', 'cafés', 'cafes', 'cafe', 'infusiones', 'licores',
  'bodega', 'vinos', 'bebidas',
  'barra libre',
  'buffet', 'buffets',
]

// Regex para precios como "138€", "156€ +IVA", "1.200€"
const PRICE_REGEX = /(\d{1,4}(?:[.,]\d{1,3})?\s*€)(\s*\+?\s*IVA)?/i
const MENU_NAME_REGEX = /^(menú|menu)\s+(.+)$/i
const PICK_HINT_REGEX = /a\s+escoger\s+(\d+)|escoge[rd]?\s+(\d+)|elegir\s+(\d+)/i

function isCourseHeader(line: string): boolean {
  const lower = line.toLowerCase().trim()
  if (line.length > 60) return false
  // Mayúsculas y corta: probablemente header
  const ratioUpper = (line.replace(/[^a-záéíóúñ]/gi, '').match(/[A-ZÁÉÍÓÚÑ]/g)?.length ?? 0)
    / Math.max(1, line.replace(/[^a-záéíóúñ]/gi, '').length)
  const isAllCaps = ratioUpper > 0.7 && line.length <= 40
  const matchesKeyword = COURSE_KEYWORDS.some(kw => lower === kw || lower.startsWith(kw + ' ') || lower.startsWith(kw + ':'))
  return isAllCaps || matchesKeyword
}

function isMenuNameLine(line: string): { match: boolean; name?: string } {
  const m = line.match(MENU_NAME_REGEX)
  if (m) return { match: true, name: m[0].trim() }
  return { match: false }
}

function extractPrice(lines: string[]): string | null {
  for (const line of lines) {
    const m = line.match(PRICE_REGEX)
    if (m) return m[0].replace(/\s+/g, ' ').trim()
  }
  return null
}

export async function extractText(file: File): Promise<string> {
  // Carga dinámica para evitar ejecutar pdfjs en SSR
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // Worker servido desde public/ (copiado en commit 4, sin dependencia de CDN)
  // @ts-ignore
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs'

  const buf = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buf }).promise

  let allText = ''
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    // Agrupar por línea (misma Y con tolerancia)
    const byY = new Map<number, Array<{ x: number; str: string }>>()
    for (const item of content.items as any[]) {
      if (!item.str) continue
      const y = Math.round(item.transform[5])
      if (!byY.has(y)) byY.set(y, [])
      byY.get(y)!.push({ x: item.transform[4], str: item.str })
    }
    const lines = Array.from(byY.entries())
      .sort((a, b) => b[0] - a[0]) // y descendente = de arriba a abajo
      .map(([, chunks]) => chunks.sort((a, b) => a.x - b.x).map(c => c.str).join(' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    allText += lines.join('\n') + '\n\n'
  }
  return allText.trim()
}

export function parseMenus(text: string): Menu[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return []

  // Detectar posiciones de menús: líneas que empiezan por "Menú" o "MENU"
  const menuStarts: number[] = []
  lines.forEach((line, i) => {
    if (isMenuNameLine(line).match) menuStarts.push(i)
  })

  // Si no hay marcadores claros, tratamos todo como un único menú
  const segments: Array<{ startLine: number; endLine: number }> = []
  if (menuStarts.length === 0) {
    segments.push({ startLine: 0, endLine: lines.length })
  } else {
    for (let i = 0; i < menuStarts.length; i++) {
      segments.push({
        startLine: menuStarts[i],
        endLine: i + 1 < menuStarts.length ? menuStarts[i + 1] : lines.length,
      })
    }
  }

  const menus: Menu[] = []
  for (const seg of segments) {
    const chunk = lines.slice(seg.startLine, seg.endLine)
    if (!chunk.length) continue

    const firstLine = chunk[0]
    const nameMatch = isMenuNameLine(firstLine)
    const name = nameMatch.name || firstLine

    const price = extractPrice(chunk) ?? ''

    // Detectar cursos
    const courses: MenuCourse[] = []
    let currentCourse: MenuCourse | null = null
    const skipAfter = nameMatch.match ? 1 : 0

    for (let i = skipAfter; i < chunk.length; i++) {
      const line = chunk[i]
      // Saltar líneas que son solo el precio
      if (line.match(/^precio/i) || line === price) continue
      // Saltar línea con "+IVA" solo
      if (/^\+?\s*IVA/i.test(line)) continue

      if (isCourseHeader(line)) {
        if (currentCourse) courses.push(currentCourse)
        const pickHint = line.match(PICK_HINT_REGEX)
        currentCourse = {
          label: line.replace(/[:]+$/, '').trim(),
          mode: pickHint ? 'pick_n' : 'fixed',
          pick_count: pickHint ? parseInt(pickHint[1] || pickHint[2] || pickHint[3] || '1') : undefined,
          items: [],
        }
      } else if (currentCourse) {
        currentCourse.items.push({ name: line })
      }
    }
    if (currentCourse) courses.push(currentCourse)

    menus.push({
      id: `pdf-${Date.now()}-${menus.length}`,
      name: name || 'Menú sin nombre',
      price_per_person: price || '—',
      courses: courses.length ? courses : undefined,
      description: courses.length ? undefined : chunk.slice(skipAfter).join('\n'),
    })
  }

  return menus
}

export async function parseMenuPdf(file: File): Promise<{ rawText: string; menus: Menu[] }> {
  const rawText = await extractText(file)
  const menus = parseMenus(rawText)
  return { rawText, menus }
}

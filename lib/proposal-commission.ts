// ──────────────────────────────────────────────────────────────────────────────
// Apply commission markup to ProposalData and BudgetView data structures.
// Only "neto" mode requires this transformation: prices stored as venue-net
// must be multiplied by (1 + percent/100) before showing to the client.
// "comisionable" mode stores prices already with commission included.
// ──────────────────────────────────────────────────────────────────────────────

import type { CommissionMode } from './commission'

type AnyObj = Record<string, any>

function markupNumber(n: number, factor: number) {
  if (!Number.isFinite(n)) return n
  return Math.round(n * factor * 100) / 100
}

/** Multiply numeric prefix in strings like "1.500 €", "120/pers.", "30 €/h". */
function markupString(s: string, factor: number): string {
  if (!s) return s
  // Match first contiguous numeric (with optional thousand sep . , and decimal)
  const m = s.match(/(\d[\d.,]*)/)
  if (!m) return s
  const raw = m[1]
  // Detect format: dot as thousands separator if value has 4+ digits and ends with 3
  let normalized: number
  if (raw.includes(',')) {
    // European: 1.234,56 → 1234.56
    normalized = parseFloat(raw.replace(/\./g, '').replace(',', '.'))
  } else if (raw.includes('.')) {
    const parts = raw.split('.')
    if (parts.length === 2 && parts[1].length === 3) {
      // 1.500 — thousands separator
      normalized = parseFloat(raw.replace(/\./g, ''))
    } else {
      normalized = parseFloat(raw)
    }
  } else {
    normalized = parseFloat(raw)
  }
  if (!Number.isFinite(normalized)) return s
  const marked = Math.round(normalized * factor * 100) / 100
  // Format back (es-ES: 1.500 € style if integer, otherwise 2 decimals)
  const formatted = Number.isInteger(marked)
    ? marked.toLocaleString('es-ES')
    : marked.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return s.replace(raw, formatted)
}

const STRING_PRICE_KEYS = new Set([
  'price', 'price_per_person', 'extra_price', 'price_modifier', 'min_spend',
  'extra_hour_price', 'price_rental', 'min_guest_charge', 'base_price', 'menu_price',
  'price_min', 'price_max',
])

const NUMBER_PRICE_KEYS = new Set(['price_estimate', 'price_value'])

/**
 * Recursively walks an object and applies markup to:
 * - String fields in STRING_PRICE_KEYS (e.g. "1.500 €")
 * - Numeric fields in NUMBER_PRICE_KEYS (e.g. price_estimate: 1500)
 *
 * Returns a new object; original is not mutated.
 */
function walkApplyMarkup(obj: any, factor: number, seen = new WeakSet()): any {
  if (obj == null) return obj
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') return obj
  if (Array.isArray(obj)) return obj.map(item => walkApplyMarkup(item, factor, seen))
  if (typeof obj !== 'object') return obj
  if (seen.has(obj)) return obj
  seen.add(obj)
  const out: AnyObj = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && STRING_PRICE_KEYS.has(k)) {
      out[k] = markupString(v, factor)
    } else if (typeof v === 'number' && NUMBER_PRICE_KEYS.has(k)) {
      out[k] = markupNumber(v, factor)
    } else {
      out[k] = walkApplyMarkup(v, factor, seen)
    }
  }
  return out
}

/**
 * Apply commission to a proposal-style data object (with sections_data, venueContent, etc).
 * Only mutates prices when mode === 'neto'. Returns the original object for other modes.
 */
export function applyCommissionToProposalData<T extends AnyObj>(
  data: T,
  commissionPercent: number | null | undefined,
  commissionMode: CommissionMode | null | undefined,
): T {
  if (!commissionPercent || !commissionMode || commissionMode !== 'neto') return data
  const factor = 1 + commissionPercent / 100
  return walkApplyMarkup(data, factor)
}

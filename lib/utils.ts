import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── CSS injection guards ──────────────────────────────────────────────────────
// User-controlled branding (colors, fonts) is interpolated into <style> tags on
// the public dossier landing. Validate strictly to prevent stored CSS injection
// (e.g. breaking out of a declaration to inject arbitrary rules or url()).

const HEX_COLOR     = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const RGB_COLOR     = /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)$/
const HSL_COLOR     = /^hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*(?:,\s*[\d.]+\s*)?\)$/

/** Returns the value if it's a safe CSS color, otherwise `fallback` (default null). */
export function safeCssColor(value: unknown, fallback: string | null = null): string | null {
  if (typeof value !== 'string') return fallback
  const v = value.trim()
  if (HEX_COLOR.test(v) || RGB_COLOR.test(v) || HSL_COLOR.test(v)) return v
  return fallback
}

/** Returns a sanitized font-family list (letters, numbers, spaces, commas, quotes, hyphens). */
export function safeFontFamily(value: unknown, fallback: string | null = null): string | null {
  if (typeof value !== 'string') return fallback
  const v = value.trim()
  if (!v || v.length > 120) return fallback
  if (/^[\w\s,'"-]+$/.test(v)) return v
  return fallback
}

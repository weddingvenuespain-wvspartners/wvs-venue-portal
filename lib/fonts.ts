// lib/fonts.ts — Comprehensive Google Fonts library for proposal branding

export type GoogleFont = {
  label: string
  value: string       // CSS font-family value to apply
  googleName: string | null  // Google Fonts URL family param (null = system font)
  category: 'serif' | 'script' | 'display' | 'sans'
  desc: string
}

export const GOOGLE_FONTS: GoogleFont[] = [
  // ── Serif ──────────────────────────────────────────────────────────
  { label: 'Georgia',            value: 'Georgia, serif',                              googleName: null,                                                             category: 'serif',   desc: 'Clásica y legible' },
  { label: 'Cormorant Garamond', value: '"Cormorant Garamond", Georgia, serif',        googleName: 'Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400',    category: 'serif',   desc: 'Refinada y romántica' },
  { label: 'Playfair Display',   value: '"Playfair Display", Georgia, serif',          googleName: 'Playfair+Display:ital,wght@0,400;0,600;1,400',                  category: 'serif',   desc: 'Editorial y sofisticada' },
  { label: 'EB Garamond',        value: '"EB Garamond", Georgia, serif',               googleName: 'EB+Garamond:ital,wght@0,400;0,600;1,400',                       category: 'serif',   desc: 'Histórica y elegante' },
  { label: 'Lora',               value: '"Lora", Georgia, serif',                      googleName: 'Lora:ital,wght@0,400;0,600;1,400',                              category: 'serif',   desc: 'Moderna con alma clásica' },
  { label: 'Merriweather',       value: '"Merriweather", Georgia, serif',              googleName: 'Merriweather:ital,wght@0,300;0,400;1,300',                      category: 'serif',   desc: 'Legible y formal' },
  { label: 'Libre Baskerville',  value: '"Libre Baskerville", Georgia, serif',         googleName: 'Libre+Baskerville:ital,wght@0,400;0,700;1,400',                 category: 'serif',   desc: 'Clásica americana' },
  { label: 'Crimson Text',       value: '"Crimson Text", Georgia, serif',              googleName: 'Crimson+Text:ital,wght@0,400;0,600;1,400',                      category: 'serif',   desc: 'Literaria y cálida' },
  { label: 'Cardo',              value: '"Cardo", Georgia, serif',                     googleName: 'Cardo:ital,wght@0,400;0,700;1,400',                             category: 'serif',   desc: 'Académica y distinguida' },
  { label: 'Source Serif 4',     value: '"Source Serif 4", Georgia, serif',            googleName: 'Source+Serif+4:ital,opsz,wght@0,8,300;0,8,400;1,8,300',        category: 'serif',   desc: 'Limpia y profesional' },
  { label: 'Spectral',           value: '"Spectral", Georgia, serif',                  googleName: 'Spectral:ital,wght@0,300;0,400;1,300',                          category: 'serif',   desc: 'Elegante para pantalla' },
  { label: 'Vollkorn',           value: '"Vollkorn", Georgia, serif',                  googleName: 'Vollkorn:ital,wght@0,400;0,600;1,400',                          category: 'serif',   desc: 'Robusta y atemporal' },

  // ── Script / Caligrafía ────────────────────────────────────────────
  { label: 'Great Vibes',        value: '"Great Vibes", cursive',                      googleName: 'Great+Vibes',                                                   category: 'script',  desc: 'Caligrafía elegante' },
  { label: 'Dancing Script',     value: '"Dancing Script", cursive',                   googleName: 'Dancing+Script:wght@400;600',                                   category: 'script',  desc: 'Fluida y festiva' },
  { label: 'Parisienne',         value: '"Parisienne", cursive',                       googleName: 'Parisienne',                                                    category: 'script',  desc: 'Francesa y romántica' },
  { label: 'Alex Brush',         value: '"Alex Brush", cursive',                       googleName: 'Alex+Brush',                                                    category: 'script',  desc: 'Delicada y fina' },
  { label: 'Sacramento',         value: '"Sacramento", cursive',                       googleName: 'Sacramento',                                                    category: 'script',  desc: 'Manuscrita y suave' },
  { label: 'Pinyon Script',      value: '"Pinyon Script", cursive',                    googleName: 'Pinyon+Script',                                                 category: 'script',  desc: 'Vintage y artesanal' },
  { label: 'Allura',             value: '"Allura", cursive',                           googleName: 'Allura',                                                        category: 'script',  desc: 'Fluida y luminosa' },
  { label: 'Satisfy',            value: '"Satisfy", cursive',                          googleName: 'Satisfy',                                                       category: 'script',  desc: 'Informal y chic' },

  // ── Display / Elegante ─────────────────────────────────────────────
  { label: 'Cinzel',             value: '"Cinzel", serif',                             googleName: 'Cinzel:wght@400;600',                                           category: 'display', desc: 'Mayúsculas romanas' },
  { label: 'Italiana',           value: '"Italiana", serif',                           googleName: 'Italiana',                                                      category: 'display', desc: 'Fina y glamurosa' },
  { label: 'Philosopher',        value: '"Philosopher", serif',                        googleName: 'Philosopher:ital,wght@0,400;0,700;1,400',                       category: 'display', desc: 'Sobria y distinguida' },
  { label: 'IM Fell English',    value: '"IM Fell English", serif',                    googleName: 'IM+Fell+English:ital@0;1',                                      category: 'display', desc: 'Antigua y con carácter' },
  { label: 'Josefin Slab',       value: '"Josefin Slab", serif',                       googleName: 'Josefin+Slab:ital,wght@0,300;0,400;1,300',                     category: 'display', desc: 'Geométrica y vintage' },
  { label: 'Tenor Sans',         value: '"Tenor Sans", sans-serif',                    googleName: 'Tenor+Sans',                                                    category: 'display', desc: 'Alta costura y moda' },
  { label: 'Forum',              value: '"Forum", serif',                              googleName: 'Forum',                                                         category: 'display', desc: 'Arquitectónica y clásica' },

  // ── Sans-serif ─────────────────────────────────────────────────────
  { label: 'Montserrat',         value: '"Montserrat", sans-serif',                    googleName: 'Montserrat:ital,wght@0,300;0,400;0,600;1,300',                  category: 'sans',    desc: 'Moderna y versátil' },
  { label: 'Raleway',            value: '"Raleway", sans-serif',                       googleName: 'Raleway:ital,wght@0,300;0,400;0,600;1,300',                     category: 'sans',    desc: 'Elegante sin serifa' },
  { label: 'Josefin Sans',       value: '"Josefin Sans", sans-serif',                  googleName: 'Josefin+Sans:ital,wght@0,300;0,400;1,300',                     category: 'sans',    desc: 'Geométrica y ligera' },
  { label: 'Lato',               value: '"Lato", sans-serif',                          googleName: 'Lato:ital,wght@0,300;0,400;1,300',                              category: 'sans',    desc: 'Amigable y clara' },
  { label: 'Nunito',             value: '"Nunito", sans-serif',                        googleName: 'Nunito:ital,wght@0,300;0,400;1,300',                            category: 'sans',    desc: 'Redondeada y suave' },
  { label: 'Poppins',            value: '"Poppins", sans-serif',                       googleName: 'Poppins:ital,wght@0,300;0,400;1,300',                           category: 'sans',    desc: 'Limpia y contemporánea' },
  { label: 'Quicksand',          value: '"Quicksand", sans-serif',                     googleName: 'Quicksand:wght@300;400;600',                                    category: 'sans',    desc: 'Suave y moderna' },
  { label: 'DM Sans',            value: '"DM Sans", sans-serif',                       googleName: 'DM+Sans:ital,wght@0,300;0,400;1,300',                           category: 'sans',    desc: 'Minimalista y fresca' },
  { label: 'Sin serifa (sistema)', value: '-apple-system, Helvetica, sans-serif',      googleName: null,                                                             category: 'sans',    desc: 'Rápida, sin descarga' },
]

export const FONT_CATEGORIES: { key: GoogleFont['category']; label: string }[] = [
  { key: 'serif',   label: 'Serif — Clásicas' },
  { key: 'script',  label: 'Script — Caligráficas' },
  { key: 'display', label: 'Display — Especiales' },
  { key: 'sans',    label: 'Sans-serif — Modernas' },
]

/** Build a single Google Fonts CDN URL for a list of fonts */
export function buildGoogleFontsUrl(fonts: GoogleFont[]): string {
  const toLoad = fonts.filter(f => f.googleName)
  if (!toLoad.length) return ''
  const families = toLoad.map(f => `family=${f.googleName}`).join('&')
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}

/** Build a Google Fonts CDN URL for a single font value */
export function buildSingleFontUrl(fontValue: string): string | null {
  const font = GOOGLE_FONTS.find(f => f.value === fontValue)
  if (!font || !font.googleName) return null
  return `https://fonts.googleapis.com/css2?family=${font.googleName}&display=swap`
}

/** Get font object by CSS value */
export function getFontByValue(value: string): GoogleFont | undefined {
  return GOOGLE_FONTS.find(f => f.value === value)
}

/** All Google Fonts CDN URL (for editor previews) */
export const ALL_FONTS_URL = buildGoogleFontsUrl(GOOGLE_FONTS)

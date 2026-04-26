// Section Style Registry
// =======================
// Each section in a proposal/template can have multiple visual variants.
// This file is the single source of truth: adding a new variant for an
// existing section, or registering a brand-new section with variants, is
// just an entry in SECTION_STYLES + the matching renderer in the visual
// templates (T1Impacto, T4SocialProof…).
//
// Storage model in `sections_data`:
//   {
//     ...
//     styles: {
//       welcome: 'editorial',
//       gallery: 'mosaic',
//     }
//   }
//
// For backwards compatibility we also fall back to the legacy boolean
// toggles (e.g. sections_enabled.welcome_light) when `styles` is absent.

export type StyleVariant = {
  id: string
  label: string
  description?: string
  /** Optional badge shown on the picker card (e.g. "Recomendada"). */
  badge?: string
}

export type SectionStyleConfig = {
  sectionId: string
  defaultVariant: string
  variants: StyleVariant[]
  /** Legacy `sections_enabled` flags that map to a variant id. Read-only fallback. */
  legacyEnabledMap?: Record<string, string>
}

export const SECTION_STYLES: Record<string, SectionStyleConfig> = {
  welcome: {
    sectionId: 'welcome',
    defaultVariant: 'default',
    variants: [
      { id: 'default',   label: 'Oscura',     description: 'Cita centrada sobre fondo oscuro' },
      { id: 'light',     label: 'Clara',      description: 'Fondo claro con imagen de apoyo' },
      { id: 'split',     label: 'Dividida',   description: 'Texto + imagen en dos columnas' },
      { id: 'editorial', label: 'Editorial',  description: 'Tipografía grande estilo revista' },
    ],
    legacyEnabledMap: {
      welcome:           'default',
      welcome_light:     'light',
      welcome_split:     'split',
      welcome_editorial: 'editorial',
    },
  },
  gallery: {
    sectionId: 'gallery',
    defaultVariant: 'carousel',
    variants: [
      { id: 'carousel', label: 'Carrusel',    description: 'Tira deslizante con avance automático' },
      { id: 'mosaic',   label: 'Mosaico',     description: 'Foto principal grande + grid asimétrico' },
      { id: 'grid',     label: 'Cuadrícula',  description: 'Todas iguales en grid uniforme' },
    ],
  },
}

export function getSectionStyle(sectionId: string): SectionStyleConfig | undefined {
  return SECTION_STYLES[sectionId]
}

/** Returns the active variant id for a section, with legacy fallback. */
export function getActiveStyle(sectionsData: any, sectionId: string): string {
  const cfg = SECTION_STYLES[sectionId]
  if (!cfg) return 'default'

  const explicit = sectionsData?.styles?.[sectionId]
  if (explicit && cfg.variants.some(v => v.id === explicit)) return explicit

  // Legacy: pick the first sections_enabled flag that maps to a variant
  if (cfg.legacyEnabledMap) {
    const enabled = sectionsData?.sections_enabled ?? {}
    for (const [flag, variantId] of Object.entries(cfg.legacyEnabledMap)) {
      if (enabled[flag] === true) return variantId
    }
  }

  return cfg.defaultVariant
}

/** Returns a new sections_data with the variant updated. Also clears legacy flags so both models stay consistent. */
export function setActiveStyle(sectionsData: any, sectionId: string, variantId: string): any {
  const cfg = SECTION_STYLES[sectionId]
  if (!cfg) return sectionsData

  const next: any = {
    ...(sectionsData ?? {}),
    styles: { ...((sectionsData ?? {}).styles ?? {}), [sectionId]: variantId },
  }

  // Sync legacy flags so visual templates that still read them keep working.
  if (cfg.legacyEnabledMap) {
    const enabled: Record<string, boolean> = { ...((sectionsData ?? {}).sections_enabled ?? {}) }
    for (const [flag, vId] of Object.entries(cfg.legacyEnabledMap)) {
      enabled[flag] = vId === variantId
    }
    next.sections_enabled = enabled
  }

  return next
}

/** True when the section group is enabled (at least one variant is on). */
export function isSectionGroupEnabled(sectionsData: any, sectionId: string): boolean {
  const cfg = SECTION_STYLES[sectionId]
  if (!cfg) return true

  const enabled = sectionsData?.sections_enabled ?? {}
  if (cfg.legacyEnabledMap) {
    const flags = Object.keys(cfg.legacyEnabledMap)
    // Off only when every legacy flag is explicitly false
    return !flags.every(f => enabled[f] === false)
  }
  return enabled[sectionId] !== false
}

/** Toggle the whole section group on/off. When turning on, keeps the active variant; when off, disables every legacy flag. */
export function toggleSectionGroup(sectionsData: any, sectionId: string, on: boolean): any {
  const cfg = SECTION_STYLES[sectionId]
  if (!cfg) return sectionsData

  const active = getActiveStyle(sectionsData, sectionId)
  const enabled: Record<string, boolean> = { ...((sectionsData ?? {}).sections_enabled ?? {}) }

  if (cfg.legacyEnabledMap) {
    for (const [flag, vId] of Object.entries(cfg.legacyEnabledMap)) {
      enabled[flag] = on && vId === active
    }
  } else {
    enabled[sectionId] = on
  }

  return { ...(sectionsData ?? {}), sections_enabled: enabled }
}

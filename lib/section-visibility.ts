// Maps venue commercial config (`space_type`) to which sections should appear
// in editors and which dynamic label they should use. Keeps proposal/template
// editors visually coherent with the venue's commercial model.

export type SpaceType = 'single' | 'single_with_supplements' | 'multiple_independent' | null | undefined

export const SPACE_TYPE_LABELS: Record<string, string> = {
  single: 'Un único espacio',
  single_with_supplements: 'Espacio principal + zonas opcionales',
  multiple_independent: 'Varias zonas a elegir',
}

// Which space_types each section is designed for. Used to render
// "matches your config" banners inside template editors.
export const SECTION_SPACE_TYPES: Record<string, Array<'single' | 'single_with_supplements' | 'multiple_independent'>> = {
  zones: ['single_with_supplements'],
  space_groups: ['multiple_independent'],
  venue_rental: ['single', 'single_with_supplements'],
}

export function isSectionAllowed(secId: string, spaceType: SpaceType): boolean {
  if (!spaceType) return true

  switch (secId) {
    case 'zones':
      return spaceType === 'single_with_supplements'
    case 'space_groups':
      return spaceType === 'multiple_independent'
    case 'venue_rental':
      return spaceType !== 'multiple_independent'
    default:
      return true
  }
}

export function getSectionLabel(secId: string, spaceType: SpaceType, fallback: string): string {
  switch (secId) {
    case 'zones':
      if (spaceType === 'single_with_supplements') return 'Zonas opcionales con suplemento'
      return fallback
    case 'space_groups':
      if (spaceType === 'multiple_independent') return 'Elige tu zona (cliente escoge)'
      return fallback
    case 'venue_rental':
      if (spaceType === 'single') return 'Tarifa de alquiler'
      if (spaceType === 'single_with_supplements') return 'Tarifa base de alquiler'
      return fallback
    default:
      return fallback
  }
}

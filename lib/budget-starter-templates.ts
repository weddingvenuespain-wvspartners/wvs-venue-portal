import type { LineItemGroup } from './budget-types'

export type BudgetStarterTemplateId = 'evento-completo' | 'celebracion-intima' | 'premium' | 'corporativo'

export type BudgetStarterTemplate = {
  id: BudgetStarterTemplateId
  name: string
  description: string
  icon: 'gem' | 'heart' | 'crown' | 'briefcase'
  groups: LineItemGroup[]
}

// ── Helper ───────────────────────────────────────────────────────────────────
let _counter = 0
const uid = () => `tpl_${++_counter}`

function item(concept: string, qty: number, unit_price: number) {
  const id = uid()
  return { id, concept, qty, unit_price, subtotal: qty * unit_price }
}

function group(name: string, items: ReturnType<typeof item>[]): LineItemGroup {
  return { id: uid(), name, items }
}

// ── Templates ────────────────────────────────────────────────────────────────
// Generic: sirven para bodas, cenas, eventos, comuniones, etc.
// El venue personaliza nombres y precios tras duplicar.

export const DEFAULT_BUDGET_TEMPLATES: BudgetStarterTemplate[] = [
  {
    id: 'evento-completo',
    name: 'Evento completo',
    description: 'Estructura general para eventos de 80-200 personas con espacio, catering, decoracion y servicios.',
    icon: 'gem',
    groups: [
      group('Alquiler del espacio', [
        item('Alquiler del espacio', 1, 5000),
        item('Hora extra', 2, 500),
      ]),
      group('Catering y bebidas', [
        item('Menu por persona', 120, 85),
        item('Barra de bebidas por persona', 120, 25),
        item('Menu infantil por persona', 10, 35),
      ]),
      group('Decoracion y montaje', [
        item('Decoracion floral', 1, 800),
        item('Centros de mesa', 12, 60),
        item('Iluminacion ambiente', 1, 600),
      ]),
      group('Servicios adicionales', [
        item('Coordinacion del evento', 1, 500),
        item('Parking', 1, 300),
        item('Limpieza post-evento', 1, 400),
      ]),
    ],
  },
  {
    id: 'celebracion-intima',
    name: 'Celebracion intima',
    description: 'Para eventos reducidos de 20-50 personas con toque especial.',
    icon: 'heart',
    groups: [
      group('Alquiler del espacio', [
        item('Salon privado', 1, 2500),
      ]),
      group('Catering y bebidas', [
        item('Menu degustacion por persona', 35, 110),
        item('Maridaje de vinos por persona', 35, 30),
      ]),
      group('Decoracion', [
        item('Decoracion floral', 1, 500),
        item('Ambientacion y velas', 1, 250),
      ]),
      group('Extras', [
        item('Musica en vivo', 1, 400),
        item('Coordinacion', 1, 350),
      ]),
    ],
  },
  {
    id: 'premium',
    name: 'Evento premium',
    description: 'Experiencia exclusiva con servicios premium, gastronomia de autor y atencion personalizada.',
    icon: 'crown',
    groups: [
      group('Uso exclusivo del espacio', [
        item('Uso exclusivo (jornada completa)', 1, 10000),
        item('Ensayo o preparacion (dia anterior)', 1, 1500),
        item('Hora extra', 3, 600),
      ]),
      group('Gastronomia', [
        item('Menu de autor por persona', 150, 140),
        item('Estacion de cocktails', 1, 1200),
        item('Barra premium por persona', 150, 40),
        item('Late night snacks por persona', 150, 12),
      ]),
      group('Produccion y decoracion', [
        item('Diseno floral de autor', 1, 2500),
        item('Centros de mesa', 18, 90),
        item('Iluminacion arquitectonica', 1, 1500),
        item('Montaje especial', 1, 800),
      ]),
      group('Servicios VIP', [
        item('Coordinacion integral', 1, 2000),
        item('Transporte invitados', 2, 500),
        item('Valet parking', 1, 600),
        item('Suite / alojamiento', 1, 350),
        item('Limpieza y desmontaje', 1, 600),
      ]),
    ],
  },
  {
    id: 'corporativo',
    name: 'Evento corporativo',
    description: 'Jornadas, presentaciones, team building, cenas de empresa.',
    icon: 'briefcase',
    groups: [
      group('Alquiler del espacio', [
        item('Sala principal (jornada completa)', 1, 3500),
        item('Sala auxiliar / breakout', 1, 800),
      ]),
      group('Catering', [
        item('Coffee break manana por persona', 60, 12),
        item('Almuerzo por persona', 60, 55),
        item('Coffee break tarde por persona', 60, 12),
        item('Coctel networking por persona', 60, 30),
      ]),
      group('Equipamiento tecnico', [
        item('Pantalla y proyector', 1, 300),
        item('Equipo de sonido y microfonos', 1, 400),
        item('Wifi dedicado', 1, 200),
      ]),
      group('Servicios', [
        item('Coordinador de evento', 1, 500),
        item('Personal de sala', 4, 150),
        item('Aparcamiento reservado', 1, 250),
      ]),
    ],
  },
]

/**
 * Deep-clone a template's groups with fresh IDs.
 */
export function cloneTemplateGroups(groups: LineItemGroup[]): LineItemGroup[] {
  let counter = 0
  const freshId = () => `g${Date.now()}_${++counter}`
  return groups.map(g => ({
    id: freshId(),
    name: g.name,
    items: g.items.map(i => ({
      id: freshId(),
      concept: i.concept,
      qty: i.qty,
      unit_price: i.unit_price,
      subtotal: i.subtotal,
    })),
  }))
}

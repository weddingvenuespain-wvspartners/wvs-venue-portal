'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { usePlanFeatures } from '@/lib/use-plan-features'
import {
  Plus, ChevronDown, ChevronUp, Pencil, Trash2,
  X, Check, Lock, Sun, Moon, CalendarDays, Package, SlidersHorizontal,
  Building2, Users, Layers, CreditCard, LayoutGrid, Settings2, ChefHat, Save,
  Maximize2, Minimize2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import ProposalMenuEditor from '@/components/ProposalMenuEditor'
import DatePicker, { fmtDate } from '@/components/DatePicker'
import type { SectionsData } from '@/lib/proposal-types'
import { WeddingProposal } from '@/app/proposal/[slug]/tpl/WeddingProposal'
import type { ProposalData } from '@/app/proposal/[slug]/page'

// ── Duration types ─────────────────────────────────────────────────────────────

type DurationType = '1_day' | '1_day_morning' | '2_days' | 'package' | 'custom'

const DURATION_TYPES = [
  { key: '1_day'         as DurationType, label: '1 día',                  sublabel: 'Solo el día del evento',          detail: 'Ej: 12:00 → 00:00',           color: '#C4975A', bg: '#FDF8F0', Icon: Sun              },
  { key: '1_day_morning' as DurationType, label: '1 día + noche + mañana', sublabel: 'Hasta mediodía del día siguiente', detail: 'Ej: Sáb. 12:00 → Dom. 14:00', color: '#7C3AED', bg: '#F5F3FF', Icon: Moon             },
  { key: '2_days'        as DurationType, label: '2 días completos',        sublabel: 'Día 1 + noche + día 2 entero',    detail: 'Ej: Sáb. 12:00 → Dom. 23:59', color: '#2563EB', bg: '#EFF6FF', Icon: CalendarDays     },
  { key: 'package'       as DurationType, label: 'Paquetes de días',        sublabel: 'Varios rangos que cubren la semana', detail: 'Ej: Lun-Mié, Mié-Vie, Vie-Dom', color: '#059669', bg: '#ECFDF5', Icon: Package      },
  { key: 'custom'        as DurationType, label: 'Personalizado',           sublabel: 'Define tu propia duración',        detail: 'Descripción libre',            color: '#8A7F76', bg: '#F7F3EE', Icon: SlidersHorizontal },
]

function getDT(key: DurationType | string | undefined) {
  return DURATION_TYPES.find(d => d.key === key) ?? DURATION_TYPES[4]
}

// ── Types ──────────────────────────────────────────────────────────────────────

type SpaceType  = 'single' | 'single_with_supplements' | 'multiple_independent'
type PriceModel = 'rental' | 'per_person' | 'package'

type CommercialConfig = {
  space_type:          SpaceType
  price_model:         PriceModel
  menu_included?:      boolean   // per_person/package: ¿el precio incluye menú?
  has_menu_types?:     boolean   // si menu_included: ¿hay varios tipos de menú?
  catering_own?:       boolean   // si menú no incluido o rental: ¿catering propio?
  catering_mandatory?: boolean   // si catering_own: ¿es obligatorio contratarlo?
}

type WizardQuestion = 'space_type' | 'price_model' | 'menu_included' | 'catering_own' | 'catering_mandatory' | 'has_menu_types'
type WizardConfig   = Partial<CommercialConfig>

type ZoneItem       = { id: string; name: string }
type SupplementItem = { id: string; name: string }

type ZonePrice       = { zone_id: string; price: number }
type SupplementPrice = { supplement_id: string; price: number }

type ModalityPrice = {
  id: string; modality_id: string; package_id: string | null
  date_from: string; date_to: string; price: number; notes: string | null
  price_per_person?: number | null
  zone_prices?: ZonePrice[] | null
  supplement_prices?: SupplementPrice[] | null
}

type ModalityPackage = {
  id: string; modality_id: string
  day_from: number; day_to: number; label: string | null; sort_order: number
  prices: ModalityPrice[]
}

type Modality = {
  id: string; name: string; description: string | null; duration_label: string | null
  duration_type: DurationType; sort_order: number; is_active: boolean
  packages: ModalityPackage[]
  prices: ModalityPrice[]      // direct prices (non-package type)
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DAY_SHORT = ['L','M','X','J','V','S','D']
const DAY_FULL  = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}
// Returns all days in a package range, handling cross-week wrap (day_to < day_from)
function getPackageDays(from: number, to: number): number[] {
  const days: number[] = []
  let current = from
  days.push(current)
  while (current !== to) {
    current = (current + 1) % 7
    days.push(current)
  }
  return days
}

// Interior days = all days except the start and end (check-in/check-out)
function getInteriorDays(from: number, to: number): number[] {
  return getPackageDays(from, to).slice(1, -1)
}

// Two packages conflict if any interior day of one appears in any day of the other
function packagesConflict(f1: number, t1: number, f2: number, t2: number): boolean {
  const interior1 = new Set(getInteriorDays(f1, t1))
  const interior2 = new Set(getInteriorDays(f2, t2))
  const all2      = new Set(getPackageDays(f2, t2))
  const all1      = new Set(getPackageDays(f1, t1))
  for (const d of interior1) if (all2.has(d)) return true
  for (const d of interior2) if (all1.has(d)) return true
  return false
}

function pkgLabel(p: ModalityPackage): string {
  if (p.label) return p.label
  if (p.day_from === p.day_to) return DAY_FULL[p.day_from]
  const wrap = p.day_to < p.day_from
  return `${DAY_FULL[p.day_from]} → ${DAY_FULL[p.day_to]}${wrap ? ' (cruza semana)' : ''}`
}

function pkgShortLabel(from: number, to: number): string {
  if (from === to) return DAY_SHORT[from]
  const wrap = to < from
  return `${DAY_SHORT[from]}→${DAY_SHORT[to]}${wrap ? '*' : ''}`
}

const emptyModalForm = { name: '', description: '', duration_type: 'custom' as DurationType }
const emptyPriceForm = {
  date_from: '', date_to: '', price: '', notes: '',
  price_per_person: '',
  zone_prices: {} as Record<string, string>,
  supplement_prices: {} as Record<string, string>,
}

// ── Price helpers ──────────────────────────────────────────────────────────────

function buildPricePayload(form: typeof emptyPriceForm, cfg: CommercialConfig | null) {
  const base: Record<string, any> = { date_from: form.date_from, date_to: form.date_to, notes: form.notes }
  const model = cfg?.price_model ?? 'rental'
  const space = cfg?.space_type  ?? 'single'

  if (space === 'multiple_independent') {
    base.price = 0
    base.zone_prices = Object.entries(form.zone_prices)
      .filter(([, v]) => v !== '')
      .map(([zone_id, price]) => ({ zone_id, price: parseFloat(price) }))
  } else {
    base.price = parseFloat(form.price) || 0
    if (model === 'per_person' || model === 'package') {
      base.price_per_person = form.price_per_person !== '' ? parseFloat(form.price_per_person) : null
    }
    if (space === 'single_with_supplements') {
      base.supplement_prices = Object.entries(form.supplement_prices)
        .filter(([, v]) => v !== '')
        .map(([supplement_id, price]) => ({ supplement_id, price: parseFloat(price) }))
    }
  }
  return base
}

function initPriceForm(p: ModalityPrice): typeof emptyPriceForm {
  return {
    date_from: p.date_from,
    date_to:   p.date_to,
    price:     String(p.price ?? ''),
    notes:     p.notes ?? '',
    price_per_person: p.price_per_person != null ? String(p.price_per_person) : '',
    zone_prices: Object.fromEntries((p.zone_prices ?? []).map(z => [z.zone_id, String(z.price)])),
    supplement_prices: Object.fromEntries((p.supplement_prices ?? []).map(s => [s.supplement_id, String(s.price)])),
  }
}

// ── WeekDayPicker ──────────────────────────────────────────────────────────────
// First click = check-in day, second click = check-out day.
// If check-out < check-in → wraps around week (e.g. Fri→Tue = Fri,Sat,Sun,Mon,Tue).
// Conflict: two packages conflict when any interior day of one falls in any day of the other.

type DayRange = { day_from: number; day_to: number }

function WeekDayPicker({ dayFrom, dayTo, onChange, accent = '#059669', hint, blockedRanges = [] }: {
  dayFrom: number | null; dayTo: number | null
  onChange: (from: number | null, to: number | null) => void
  accent?: string; hint?: string
  blockedRanges?: DayRange[]
}) {
  // Interior days of existing packages: fully off-limits
  const isInterior = (day: number): boolean =>
    blockedRanges.some(r => getInteriorDays(r.day_from, r.day_to).includes(day))

  // A day already used as check-in can't be a start again
  const isUsedAsStart = (day: number): boolean =>
    blockedRanges.some(r => r.day_from === day)

  // A day already used as check-out can't be an end again
  const isUsedAsEnd = (day: number): boolean =>
    blockedRanges.some(r => r.day_to === day)

  const wouldConflict = (f: number, t: number): boolean =>
    blockedRanges.some(r => packagesConflict(f, t, r.day_from, r.day_to))

  const endConflicts = (end: number): boolean => {
    if (dayFrom === null) return false
    if (end === dayFrom) {
      // Single-day package: the day must not already be someone's checkout
      return isUsedAsEnd(end)
    }
    return isInterior(end) || isUsedAsEnd(end) || wouldConflict(dayFrom, end)
  }

  const isBlockedAsStart = (i: number): boolean => isInterior(i) || isUsedAsStart(i)

  const inRange = (i: number): boolean => {
    if (dayFrom === null) return false
    if (dayTo === null) return i === dayFrom
    return getPackageDays(dayFrom, dayTo).includes(i)
  }

  const handleClick = (i: number) => {
    if (dayFrom === null || dayTo !== null) {
      if (isBlockedAsStart(i)) return
      onChange(i, null)
      return
    }
    if (i === dayFrom) {
      // Second click = single-day package; always valid if the day passed isBlockedAsStart
      onChange(dayFrom, i)
      return
    }
    if (endConflicts(i)) return
    onChange(dayFrom, i)
  }

  const picking = dayFrom !== null && dayTo === null

  return (
    <div>
      {hint && <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 8, lineHeight: 1.4 }}>{hint}</div>}
      <div style={{ display: 'flex', border: `1px solid ${picking ? `${accent}55` : 'var(--ivory)'}`, borderRadius: 9, overflow: 'hidden', transition: 'border-color 0.15s' }}>
        {DAY_SHORT.map((d, i) => {
          const active      = inRange(i)
          const isCheckin   = i === dayFrom && dayTo !== null
          const isCheckout  = i === dayTo   && dayTo !== null
          const isSingleDay = isCheckin && isCheckout
          const isPendingStart = i === dayFrom && picking
          const blocked     = (!picking && !isSingleDay && isBlockedAsStart(i)) || (picking && i !== dayFrom && endConflicts(i))
          const isPending   = picking && i !== dayFrom && !blocked

          return (
            <button key={i} onClick={() => handleClick(i)} title={DAY_FULL[i]}
              style={{
                flex: 1, padding: isSingleDay ? '4px 0' : isPendingStart ? '4px 0' : '9px 0',
                fontSize: 12,
                fontWeight: active || isPendingStart ? 700 : 500,
                border: 'none',
                borderRight: i < 6 ? `1px solid ${active ? `${accent}44` : picking ? `${accent}22` : 'var(--ivory)'}` : 'none',
                cursor: blocked ? 'not-allowed' : 'pointer',
                fontFamily: 'Manrope, sans-serif',
                background: active ? accent : blocked ? '#F3F3F3' : isPending ? '#FAFAF9' : '#fff',
                color: active ? '#fff' : blocked ? '#C8C8C8' : isPendingStart ? accent : 'var(--charcoal)',
                transition: 'background 0.1s',
                opacity: blocked ? 0.4 : 1,
                outline: isPendingStart ? `2px dashed ${accent}` : 'none',
                outlineOffset: -3,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
              }}>
              {(isCheckin || isPendingStart) && (
                <span style={{ fontSize: 7, lineHeight: 1, opacity: 0.85 }}>▼</span>
              )}
              <span>{d}</span>
              {isCheckout && (
                <span style={{ fontSize: 7, lineHeight: 1, opacity: 0.85 }}>▲</span>
              )}
              {!isCheckin && !isCheckout && !isPendingStart && (
                <span style={{ fontSize: 7, lineHeight: 1, opacity: 0 }}>▲</span>
              )}
            </button>
          )
        })}
      </div>

      <div style={{ fontSize: 11, minHeight: 18, marginTop: 5 }}>
        {dayFrom !== null && dayTo !== null
          ? <span style={{ color: accent, fontWeight: 600 }}>
              {dayFrom === dayTo
                ? <>{DAY_FULL[dayFrom]} <span style={{ fontWeight: 400, color: 'var(--warm-gray)' }}>(solo este día)</span></>
                : <>{DAY_FULL[dayFrom]} → {DAY_FULL[dayTo]}{dayTo < dayFrom && <span style={{ fontWeight: 400, color: 'var(--warm-gray)' }}> (cruza semana)</span>}</>
              }
            </span>
          : picking
          ? <span style={{ color: 'var(--warm-gray)' }}>
              Llegada <b style={{ color: accent }}>{DAY_FULL[dayFrom!]}</b> — selecciona salida o clic de nuevo para solo ese día
            </span>
          : <span style={{ color: 'var(--warm-gray)' }}>Selecciona el día de llegada</span>
        }
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function EstructuraPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { isBlocked } = useRequireSubscription()
  const features = usePlanFeatures()

  const [activeTab, setActiveTab]             = useState<'modalidades' | 'menus'>('modalidades')
  const [modalities, setModalities]           = useState<Modality[]>([])
  const [loading, setLoading]                 = useState(true)
  const [expanded, setExpanded]               = useState<Set<string>>(new Set())
  const [error, setError]                     = useState('')
  const [menuCatalog, setMenuCatalog]         = useState<SectionsData>({})
  const [previewExpanded, setPreviewExpanded] = useState(false)
  const [catalogSaving, setCatalogSaving]     = useState(false)
  const [catalogSaved, setCatalogSaved]       = useState(false)
  const [commercialConfig, setCommercialConfig] = useState<CommercialConfig | null>(null)
  const [configWizardOpen, setConfigWizardOpen]   = useState(false)
  const [wizardQuestion, setWizardQuestion]       = useState<WizardQuestion>('space_type')
  const [wizardHistory, setWizardHistory]         = useState<WizardQuestion[]>([])
  const [wizardConfig, setWizardConfig]           = useState<WizardConfig>({})
  const [configSaving, setConfigSaving]           = useState(false)

  // Zones & supplements
  const [zones, setZones]                   = useState<ZoneItem[]>([])
  const [supplements, setSupplements]       = useState<SupplementItem[]>([])
  const [newZoneName, setNewZoneName]       = useState('')
  const [newSuppName, setNewSuppName]       = useState('')
  const [savingZS, setSavingZS]             = useState(false)

  // Modality modal
  const [modalOpen, setModalOpen]     = useState(false)
  const [editing, setEditing]         = useState<Modality | null>(null)
  const [modalForm, setModalForm]     = useState(emptyModalForm)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalError, setModalError]   = useState('')

  // Package slot state
  const [addingPkg, setAddingPkg]         = useState<string | null>(null)         // modality id
  const [pkgForm, setPkgForm]             = useState<{ day_from: number | null; day_to: number | null; label: string }>({ day_from: null, day_to: null, label: '' })
  const [editingPkg, setEditingPkg]       = useState<string | null>(null)         // package id
  const [editPkgForm, setEditPkgForm]     = useState<{ day_from: number | null; day_to: number | null; label: string }>({ day_from: null, day_to: null, label: '' })
  const [pkgSaving, setPkgSaving]         = useState(false)
  const [pkgError, setPkgError]           = useState('')

  // Price state
  type PriceAdding = { modalityId: string; packageId: string | null }
  const [priceAdding, setPriceAdding]     = useState<PriceAdding | null>(null)
  const [priceForm, setPriceForm]         = useState(emptyPriceForm)
  const [editingPrice, setEditingPrice]   = useState<string | null>(null)
  const [editPriceForm, setEditPriceForm] = useState(emptyPriceForm)
  const [priceSaving, setPriceSaving]     = useState(false)
  const [priceError, setPriceError]       = useState('')

  const menuPreviewData = useMemo<ProposalData>(() => ({
    id: 'preview', slug: 'preview', couple_name: 'Vista previa',
    personal_message: null, guest_count: 100, wedding_date: null,
    price_estimate: null, show_availability: false, show_price_estimate: false,
    status: 'preview', ctas: [], sections_data: menuCatalog,
    venueContent: { packages: [], zones: [], season_prices: [], inclusions: [], exclusions: [], faq: [], testimonials: [], collaborators: [], extra_services: [], menu_prices: [], experience: null, techspecs: null, accommodation_info: null, map_info: null, budget_simulator: null, countdown: null },
    venue: null, branding: null,
  }), [menuCatalog])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    load()
  }, [user, authLoading]) // eslint-disable-line

  const load = async () => {
    const supabase = createClient()
    const [res, { data: settingsRow }] = await Promise.all([
      fetch('/api/estructura/modalities'),
      supabase.from('venue_settings').select('commercial_config, zones, supplements, menu_catalog').eq('user_id', user!.id).maybeSingle(),
    ])
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Error al cargar'); setLoading(false); return }
    // Filter direct prices: only those with package_id === null
    const mods = (json.modalities ?? []).map((m: any) => ({
      ...m,
      prices:   (m.prices   ?? []).filter((p: any) => !p.package_id),
      packages: (m.packages ?? []).map((pkg: any) => ({
        ...pkg,
        prices: (pkg.prices ?? []).sort((a: any, b: any) => a.date_from.localeCompare(b.date_from)),
      })),
    }))
    setModalities(mods)
    if (settingsRow?.commercial_config) setCommercialConfig(settingsRow.commercial_config as CommercialConfig)
    if (settingsRow?.zones)        setZones(settingsRow.zones as ZoneItem[])
    if (settingsRow?.supplements)  setSupplements(settingsRow.supplements as SupplementItem[])
    if (settingsRow?.menu_catalog) setMenuCatalog(settingsRow.menu_catalog as SectionsData)
    setLoading(false)
  }

  const saveCommercialConfig = async (cfg: CommercialConfig) => {
    setConfigSaving(true)
    const supabase = createClient()
    await supabase.from('venue_settings').upsert({ user_id: user!.id, commercial_config: cfg }, { onConflict: 'user_id' })
    setCommercialConfig(cfg)
    setConfigSaving(false)
    setConfigWizardOpen(false)
  }

  const saveZonesSupplements = async (newZones: ZoneItem[], newSupps: SupplementItem[]) => {
    setSavingZS(true)
    const supabase = createClient()
    await supabase.from('venue_settings').upsert({ user_id: user!.id, zones: newZones, supplements: newSupps }, { onConflict: 'user_id' })
    setSavingZS(false)
  }

  const saveMenuCatalog = async () => {
    setCatalogSaving(true)
    const supabase = createClient()
    await supabase.from('venue_settings').upsert({ user_id: user!.id, menu_catalog: menuCatalog }, { onConflict: 'user_id' })
    setCatalogSaving(false)
    setCatalogSaved(true)
    setTimeout(() => setCatalogSaved(false), 2500)
  }

  const addZone = async () => {
    const name = newZoneName.trim()
    if (!name) return
    const next = [...zones, { id: crypto.randomUUID(), name }]
    setZones(next); setNewZoneName('')
    await saveZonesSupplements(next, supplements)
  }

  const removeZone = async (id: string) => {
    const next = zones.filter(z => z.id !== id)
    setZones(next)
    await saveZonesSupplements(next, supplements)
  }

  const addSupplement = async () => {
    const name = newSuppName.trim()
    if (!name) return
    const next = [...supplements, { id: crypto.randomUUID(), name }]
    setSupplements(next); setNewSuppName('')
    await saveZonesSupplements(zones, next)
  }

  const removeSupplement = async (id: string) => {
    const next = supplements.filter(s => s.id !== id)
    setSupplements(next)
    await saveZonesSupplements(zones, next)
  }

  const openWizard = () => {
    setWizardQuestion('space_type')
    setWizardHistory([])
    setWizardConfig(commercialConfig ?? {})
    setConfigWizardOpen(true)
  }

  const wizardNext = (next: WizardQuestion) => {
    setWizardHistory(h => [...h, wizardQuestion])
    setWizardQuestion(next)
  }

  const wizardBack = () => {
    const prev = wizardHistory[wizardHistory.length - 1]
    if (!prev) return
    setWizardHistory(h => h.slice(0, -1))
    setWizardQuestion(prev)
  }

  const isWizardDone = (cfg: WizardConfig): cfg is CommercialConfig => {
    if (!cfg.space_type || !cfg.price_model) return false
    const model = cfg.price_model
    if (model === 'rental') {
      if (cfg.catering_own === undefined) return false
      if (cfg.catering_own && cfg.catering_mandatory === undefined) return false
    } else {
      if (cfg.menu_included === undefined) return false
      if (cfg.menu_included && cfg.has_menu_types === undefined) return false
      if (!cfg.menu_included) {
        if (cfg.catering_own === undefined) return false
        if (cfg.catering_own && cfg.catering_mandatory === undefined) return false
      }
    }
    return true
  }

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  // ── Modality CRUD ──────────────────────────────────────────────────────────

  const openCreate = () => { setEditing(null); setModalForm(emptyModalForm); setModalError(''); setModalOpen(true) }

  const openEdit = (m: Modality) => {
    setEditing(m)
    setModalForm({ name: m.name, description: m.description ?? '', duration_type: m.duration_type ?? 'custom' })
    setModalError(''); setModalOpen(true)
  }

  const saveModality = async () => {
    if (!modalForm.name.trim()) { setModalError('El nombre es obligatorio'); return }
    setModalSaving(true); setModalError('')
    try {
      const url    = editing ? `/api/estructura/modalities/${editing.id}` : '/api/estructura/modalities'
      const method = editing ? 'PATCH' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...modalForm, sort_order: editing?.sort_order ?? modalities.length }) })
      const json   = await res.json()
      if (!res.ok) { setModalError(json.error ?? 'Error al guardar'); setModalSaving(false); return }
      if (editing) {
        setModalities(prev => prev.map(m => m.id === editing.id ? { ...m, ...json.modality } : m))
      } else {
        setModalities(prev => [...prev, { ...json.modality, packages: [], prices: [] }])
      }
      setModalOpen(false)
    } catch { setModalError('Error de red') }
    setModalSaving(false)
  }

  const deleteModality = async (id: string) => {
    if (!confirm('¿Eliminar esta modalidad y todos sus paquetes y precios?')) return
    const res = await fetch(`/api/estructura/modalities/${id}`, { method: 'DELETE' })
    if (!res.ok) { setError('Error al eliminar'); return }
    setModalities(prev => prev.filter(m => m.id !== id))
  }

  const toggleActive = async (m: Modality) => {
    const res  = await fetch(`/api/estructura/modalities/${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !m.is_active }) })
    const json = await res.json()
    if (res.ok) setModalities(prev => prev.map(x => x.id === m.id ? { ...x, is_active: json.modality.is_active } : x))
  }

  // ── Package CRUD ───────────────────────────────────────────────────────────

  const startAddPkg = (modalityId: string) => {
    setAddingPkg(modalityId); setPkgForm({ day_from: null, day_to: null, label: '' }); setPkgError('')
    if (!expanded.has(modalityId)) toggle(modalityId)
  }

  const cancelAddPkg = () => { setAddingPkg(null); setPkgError('') }

  const savePkg = async () => {
    if (!addingPkg) return
    if (pkgForm.day_from === null || pkgForm.day_to === null) { setPkgError('Selecciona los días del paquete'); return }
    setPkgSaving(true); setPkgError('')
    try {
      const existingPkgs = modalities.find(m => m.id === addingPkg)?.packages ?? []
      const sortOrder    = existingPkgs.length
      const res  = await fetch(`/api/estructura/modalities/${addingPkg}/packages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...pkgForm, sort_order: sortOrder }) })
      const json = await res.json()
      if (!res.ok) { setPkgError(json.error ?? 'Error al guardar'); setPkgSaving(false); return }
      setModalities(prev => prev.map(m => m.id === addingPkg
        ? { ...m, packages: [...m.packages, json.package] }
        : m
      ))
      setAddingPkg(null)
    } catch { setPkgError('Error de red') }
    setPkgSaving(false)
  }

  const startEditPkg = (pkg: ModalityPackage) => {
    setEditingPkg(pkg.id); setEditPkgForm({ day_from: pkg.day_from, day_to: pkg.day_to, label: pkg.label ?? '' }); setPkgError('')
  }

  const saveEditPkg = async (modalityId: string, pkgId: string) => {
    if (editPkgForm.day_from === null || editPkgForm.day_to === null) { setPkgError('Selecciona los días'); return }
    setPkgSaving(true); setPkgError('')
    try {
      const res  = await fetch(`/api/estructura/packages/${pkgId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editPkgForm) })
      const json = await res.json()
      if (!res.ok) { setPkgError(json.error ?? 'Error'); setPkgSaving(false); return }
      setModalities(prev => prev.map(m => m.id === modalityId
        ? { ...m, packages: m.packages.map(p => p.id === pkgId ? { ...p, ...json.package } : p) }
        : m
      ))
      setEditingPkg(null)
    } catch { setPkgError('Error de red') }
    setPkgSaving(false)
  }

  const deletePkg = async (modalityId: string, pkgId: string) => {
    if (!confirm('¿Eliminar este paquete y todos sus períodos de precio?')) return
    const res = await fetch(`/api/estructura/packages/${pkgId}`, { method: 'DELETE' })
    if (res.ok) setModalities(prev => prev.map(m =>
      m.id === modalityId ? { ...m, packages: m.packages.filter(p => p.id !== pkgId) } : m
    ))
  }

  // ── Price CRUD ─────────────────────────────────────────────────────────────

  const startAddPrice = (modalityId: string, packageId: string | null = null) => {
    setPriceAdding({ modalityId, packageId }); setPriceForm(emptyPriceForm); setPriceError('')
    if (!expanded.has(modalityId)) toggle(modalityId)
  }

  const cancelAddPrice = () => { setPriceAdding(null); setPriceForm(emptyPriceForm) }

  const savePrice = async () => {
    if (!priceAdding) return
    if (!priceForm.date_from || !priceForm.date_to) { setPriceError('Las fechas son obligatorias'); return }
    const isMulti = commercialConfig?.space_type === 'multiple_independent'
    const needsPrice = !isMulti || Object.keys(priceForm.zone_prices).length === 0
    if (!isMulti && !priceForm.price) { setPriceError('El precio es obligatorio'); return }
    setPriceSaving(true); setPriceError('')
    try {
      const { modalityId, packageId } = priceAdding
      const url = packageId
        ? `/api/estructura/packages/${packageId}/prices`
        : `/api/estructura/modalities/${modalityId}/prices`
      const body = buildPricePayload(priceForm, commercialConfig)
      const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) { setPriceError(json.error ?? 'Error al guardar'); setPriceSaving(false); return }

      setModalities(prev => prev.map(m => {
        if (m.id !== modalityId) return m
        if (packageId) {
          return {
            ...m,
            packages: m.packages.map(pkg => pkg.id === packageId
              ? { ...pkg, prices: [...pkg.prices, json.price].sort((a, b) => a.date_from.localeCompare(b.date_from)) }
              : pkg
            ),
          }
        }
        return { ...m, prices: [...m.prices, json.price].sort((a, b) => a.date_from.localeCompare(b.date_from)) }
      }))
      setPriceAdding(null); setPriceForm(emptyPriceForm)
    } catch { setPriceError('Error de red') }
    setPriceSaving(false)
  }

  const startEditPrice = (p: ModalityPrice) => {
    setEditingPrice(p.id)
    setEditPriceForm(initPriceForm(p))
    setPriceError('')
  }

  const saveEditPrice = async (modalityId: string, packageId: string | null, priceId: string) => {
    if (!editPriceForm.date_from || !editPriceForm.date_to) { setPriceError('Las fechas son obligatorias'); return }
    const isMulti = commercialConfig?.space_type === 'multiple_independent'
    if (!isMulti && !editPriceForm.price) { setPriceError('El precio es obligatorio'); return }
    setPriceSaving(true); setPriceError('')
    try {
      const body = buildPricePayload(editPriceForm, commercialConfig)
      const res  = await fetch(`/api/estructura/prices/${priceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) { setPriceError(json.error ?? 'Error'); setPriceSaving(false); return }

      setModalities(prev => prev.map(m => {
        if (m.id !== modalityId) return m
        if (packageId) {
          return {
            ...m,
            packages: m.packages.map(pkg => pkg.id === packageId
              ? { ...pkg, prices: pkg.prices.map(p => p.id === priceId ? json.price : p).sort((a, b) => a.date_from.localeCompare(b.date_from)) }
              : pkg
            ),
          }
        }
        return { ...m, prices: m.prices.map(p => p.id === priceId ? json.price : p).sort((a, b) => a.date_from.localeCompare(b.date_from)) }
      }))
      setEditingPrice(null)
    } catch { setPriceError('Error de red') }
    setPriceSaving(false)
  }

  const deletePrice = async (modalityId: string, packageId: string | null, priceId: string) => {
    if (!confirm('¿Eliminar este período de precio?')) return
    const res = await fetch(`/api/estructura/prices/${priceId}`, { method: 'DELETE' })
    if (res.ok) setModalities(prev => prev.map(m => {
      if (m.id !== modalityId) return m
      if (packageId) {
        return { ...m, packages: m.packages.map(pkg => pkg.id === packageId ? { ...pkg, prices: pkg.prices.filter(p => p.id !== priceId) } : pkg) }
      }
      return { ...m, prices: m.prices.filter(p => p.id !== priceId) }
    }))
  }

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (isBlocked) return null

  if (authLoading || loading) return (
    <div style={{ display: 'flex' }}><Sidebar />
      <div className="main-layout">
        <div className="topbar"><div className="topbar-title">Estructura</div></div>
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <div style={{ color: 'var(--warm-gray)', fontSize: 13 }}>Cargando...</div>
        </div>
      </div>
    </div>
  )

  if (!features.estructura) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cream)' }}><Sidebar />
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 24px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Lock size={32} style={{ color: 'var(--gold)', opacity: 0.7 }} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--espresso)', marginBottom: 10 }}>Estructura comercial — Plan Premium</div>
          <div style={{ fontSize: 14, color: 'var(--warm-gray)', lineHeight: 1.6, marginBottom: 24 }}>Define las modalidades de tu venue y sus tarifas por período. Disponible en el plan Premium.</div>
          <a href="/perfil" style={{ display: 'inline-block', padding: '10px 24px', background: 'var(--gold)', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>Actualizar plan →</a>
        </div>
      </main>
    </div>
  )

  // Total prices across all modalities (package prices + direct prices)
  const totalPrices = modalities.reduce((s, m) =>
    s + m.prices.length + m.packages.reduce((ps, pkg) => ps + pkg.prices.length, 0), 0)

  // Whether the venue's commercial config involves menus/catering at all
  const venueHasMenus = commercialConfig?.menu_included === true || commercialConfig?.catering_own === true
  const menuCount  = menuCatalog.menus_override?.length ?? 0
  const extraCount = menuCatalog.menu_extras_override?.length ?? 0

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div>
            <div className="topbar-title">Estructura comercial</div>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 1 }}>
              {activeTab === 'modalidades' ? 'Define las modalidades de tu venue y sus tarifas por temporada' : 'Catálogo de menús, extras y aperitivos de tu venue'}
            </div>
          </div>
          {activeTab === 'modalidades' && (
            <button className="btn btn-primary btn-sm" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Nueva modalidad
            </button>
          )}
          {activeTab === 'menus' && (
            <button className="btn btn-primary btn-sm" onClick={saveMenuCatalog} disabled={catalogSaving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {catalogSaved ? <><Check size={14} /> Guardado</> : <><Save size={14} /> {catalogSaving ? 'Guardando…' : 'Guardar catálogo'}</>}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: '1px solid var(--ivory)', display: 'flex', gap: 0, padding: '0 24px', background: '#fff' }}>
          <button onClick={() => setActiveTab('modalidades')}
            style={{ padding: '10px 16px', fontSize: 13, fontWeight: activeTab === 'modalidades' ? 600 : 400, color: activeTab === 'modalidades' ? 'var(--charcoal)' : 'var(--warm-gray)', background: 'none', border: 'none', borderBottom: activeTab === 'modalidades' ? '2px solid var(--gold)' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'color 0.15s', marginBottom: -1 }}>
            Modalidades y tarifas
          </button>
          <button onClick={() => setActiveTab('menus')}
            style={{ padding: '10px 16px', fontSize: 13, fontWeight: activeTab === 'menus' ? 600 : 400, color: activeTab === 'menus' ? 'var(--charcoal)' : 'var(--warm-gray)', background: 'none', border: 'none', borderBottom: activeTab === 'menus' ? '2px solid var(--gold)' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'color 0.15s', marginBottom: -1 }}>
            <ChefHat size={13} />
            Menús y extras
            {/* Status badge */}
            {commercialConfig && !venueHasMenus && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'var(--ivory)', color: 'var(--warm-gray)', letterSpacing: '0.04em' }}>N/A</span>
            )}
            {venueHasMenus && (menuCount > 0 || extraCount > 0) && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(196,151,90,.12)', color: 'var(--gold)', letterSpacing: '0.04em' }}>
                {[menuCount > 0 && `${menuCount} menú${menuCount > 1 ? 's' : ''}`, extraCount > 0 && `${extraCount} extra${extraCount > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
              </span>
            )}
            {venueHasMenus && menuCount === 0 && extraCount === 0 && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', display: 'inline-block', marginLeft: 2 }} title="Sin menús configurados" />
            )}
          </button>
        </div>

        <div className="page-content">
          {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

          {/* ── TAB: MENÚS ───────────────────────────────────────────────────── */}
          {activeTab === 'menus' && (
            <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start', margin: '-24px -28px' }}>
              {/* Left: editor — hidden when preview expanded or venue has no menus */}
              {!previewExpanded && (
                <div style={{ flex: '0 0 500px', padding: '24px 28px', overflowY: 'auto' }}>
                  {!venueHasMenus && commercialConfig ? (
                    /* Point 2: no catering in config → explain + redirect */
                    <div style={{ background: '#F7F3EE', border: '1px solid var(--ivory)', borderRadius: 12, padding: '28px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>🍽️</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 8 }}>
                        Tu modelo no incluye catering propio
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.75, marginBottom: 20 }}>
                        Según tu configuración comercial, la sección de menús <strong>no aparecerá</strong> en tus propuestas.<br />
                        Si ofreces o trabajas con catering propio, actualiza tu configuración.
                      </div>
                      <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('modalidades')}>
                        Revisar configuración →
                      </button>
                    </div>
                  ) : (
                    <ProposalMenuEditor
                      sections={menuCatalog}
                      setSections={setMenuCatalog}
                      intro="Define el catálogo de menús, extras y aperitivos de tu venue. Se usará como base al crear nuevas propuestas."
                    />
                  )}
                </div>
              )}
              {/* Right: live preview */}
              <div style={{ flex: 1, minWidth: 0, borderLeft: previewExpanded ? 'none' : '1px solid var(--ivory)', position: 'sticky', top: 112, alignSelf: 'flex-start', height: 'calc(100vh - 112px)', overflowY: 'auto', background: '#f9f6f2' }}>
                {/* Sticky toolbar */}
                <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', justifyContent: 'flex-end', padding: '6px 10px', background: 'rgba(249,246,242,.85)', backdropFilter: 'blur(6px)', borderBottom: '1px solid var(--ivory)' }}>
                  <button
                    type="button"
                    onClick={() => setPreviewExpanded(v => !v)}
                    title={previewExpanded ? 'Volver al editor' : 'Ampliar vista previa'}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', background: '#fff', border: '1px solid var(--ivory)', borderRadius: 7, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}
                  >
                    {previewExpanded ? <><Minimize2 size={11} /> Contraer</> : <><Maximize2 size={11} /> Ampliar</>}
                  </button>
                </div>
                {/* Point 5: preview reflects commercial config */}
                {!venueHasMenus && commercialConfig ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100% - 37px)', padding: 32, textAlign: 'center', gap: 10 }}>
                    <div style={{ fontSize: 40, opacity: 0.2 }}>🍽️</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warm-gray)', opacity: 0.6, lineHeight: 1.6 }}>
                      La sección de menús no aparece<br />en propuestas con tu configuración
                    </div>
                  </div>
                ) : (
                  <WeddingProposal
                    data={menuPreviewData}
                    menus={menuCatalog.menus_override ?? null}
                    extras={menuCatalog.menu_extras_override ?? null}
                    appetizers={menuCatalog.appetizers_base_override ?? null}
                    primary="#C4975A"
                    onPrimary="#fff"
                    previewOnly
                  />
                )}
              </div>
            </div>
          )}

          {/* ── TAB: MODALIDADES ─────────────────────────────────────────────── */}
          {activeTab === 'modalidades' && <>

          {/* Commercial config banner */}
          {commercialConfig ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid var(--ivory)', borderRadius: 10, padding: '12px 16px', marginBottom: 24, maxWidth: 860 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Settings2 size={18} style={{ color: 'var(--gold)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 2 }}>Configuración comercial</div>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.6 }}>
                  {({ single: 'Un espacio único', single_with_supplements: 'Un espacio + suplementos', multiple_independent: 'Varias zonas independientes' } as Record<SpaceType, string>)[commercialConfig.space_type]}
                  {' · '}
                  {({ rental: 'Alquiler del espacio', per_person: 'Por persona', package: 'Paquetes' } as Record<PriceModel, string>)[commercialConfig.price_model]}
                  {commercialConfig.menu_included === true && ' · Menú incluido'}
                  {commercialConfig.menu_included === false && ' · Menú aparte'}
                  {commercialConfig.has_menu_types === true && ' · Varios tipos de menú'}
                  {commercialConfig.catering_own === true && (commercialConfig.catering_mandatory ? ' · Catering propio obligatorio' : ' · Catering propio opcional')}
                  {commercialConfig.catering_own === false && ' · Sin catering propio'}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={openWizard} style={{ flexShrink: 0 }}>Editar</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FDF8F0', border: '1px dashed #C4975A66', borderRadius: 10, padding: '14px 16px', marginBottom: 24, maxWidth: 860 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #C4975A44' }}>
                <Settings2 size={18} style={{ color: '#C4975A' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>Configura tu modelo comercial</div>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Indica cómo trabajas para que las propuestas se adapten automáticamente</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={openWizard} style={{ flexShrink: 0 }}>Configurar</button>
            </div>
          )}

          {/* Zones panel — only for multiple_independent */}
          {commercialConfig?.space_type === 'multiple_independent' && (
            <div style={{ background: '#fff', border: '1px solid var(--ivory)', borderRadius: 10, padding: '16px 20px', marginBottom: 16, maxWidth: 860 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <LayoutGrid size={14} style={{ color: '#2563EB' }} /> Zonas del venue
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: zones.length > 0 ? 12 : 0 }}>
                {zones.map(z => (
                  <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 20, padding: '4px 10px 4px 12px' }}>
                    <span style={{ fontSize: 12, color: '#1D4ED8', fontWeight: 500 }}>{z.name}</span>
                    <button onClick={() => removeZone(z.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93C5FD', padding: 0, display: 'flex', lineHeight: 1 }}><X size={12} /></button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder="Nombre de la zona (ej: Salón, Jardín…)" value={newZoneName}
                  onChange={e => setNewZoneName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addZone()}
                  style={{ fontSize: 12, flex: 1 }} />
                <button className="btn btn-ghost btn-sm" onClick={addZone} disabled={!newZoneName.trim() || savingZS} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={12} /> Añadir
                </button>
              </div>
              {zones.length === 0 && <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 8 }}>Define las zonas para poder asignar precios por separado en cada modalidad.</div>}
            </div>
          )}

          {/* Supplements panel — only for single_with_supplements */}
          {commercialConfig?.space_type === 'single_with_supplements' && (
            <div style={{ background: '#fff', border: '1px solid var(--ivory)', borderRadius: 10, padding: '16px 20px', marginBottom: 16, maxWidth: 860 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={14} style={{ color: '#7C3AED' }} /> Extras / Suplementos
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: supplements.length > 0 ? 12 : 0 }}>
                {supplements.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 20, padding: '4px 10px 4px 12px' }}>
                    <span style={{ fontSize: 12, color: '#6D28D9', fontWeight: 500 }}>{s.name}</span>
                    <button onClick={() => removeSupplement(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C4B5FD', padding: 0, display: 'flex', lineHeight: 1 }}><X size={12} /></button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder="Nombre del suplemento (ej: Jardín, Piscina…)" value={newSuppName}
                  onChange={e => setNewSuppName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSupplement()}
                  style={{ fontSize: 12, flex: 1 }} />
                <button className="btn btn-ghost btn-sm" onClick={addSupplement} disabled={!newSuppName.trim() || savingZS} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={12} /> Añadir
                </button>
              </div>
              {supplements.length === 0 && <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 8 }}>Define los extras disponibles para poder fijar su precio en cada período.</div>}
            </div>
          )}

          {/* Stats */}
          {modalities.length > 0 && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              {[
                { label: 'Modalidades activas', value: modalities.filter(m => m.is_active).length },
                { label: 'Total modalidades',   value: modalities.length },
                { label: 'Tarifas definidas',   value: totalPrices },
              ].map(s => (
                <div key={s.label} style={{ background: '#fff', border: '1px solid var(--ivory)', borderRadius: 10, padding: '12px 20px', minWidth: 120 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--charcoal)', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {modalities.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 24px' }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: '#fff', border: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <CalendarDays size={28} style={{ color: 'var(--gold)' }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 8 }}>Sin modalidades todavía</div>
              <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 28, maxWidth: 380, margin: '0 auto 28px', lineHeight: 1.6 }}>
                Define cómo alquilas tu venue: por días, fines de semana, paquetes... Cada modalidad puede tener tarifas distintas por temporada.
              </div>
              <button className="btn btn-primary" onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} /> Crear primera modalidad
              </button>
            </div>
          )}

          {/* Modality cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 860 }}>
            {modalities.map(m => {
              const dt         = getDT(m.duration_type)
              const isExpanded = expanded.has(m.id)
              const isPkg      = m.duration_type === 'package'
              const isAddingPkgHere = addingPkg === m.id

              // Existing package day ranges for conflict detection
              const existingRanges: DayRange[] = m.packages.map(pkg => ({
                day_from: pkg.day_from, day_to: pkg.day_to,
              }))

              return (
                <div key={m.id} style={{ background: '#fff', border: '1px solid var(--ivory)', borderRadius: 12, overflow: 'hidden', opacity: m.is_active ? 1 : 0.6, boxShadow: isExpanded ? '0 4px 18px rgba(0,0,0,0.07)' : '0 1px 4px rgba(0,0,0,0.03)', transition: 'box-shadow 0.2s, opacity 0.2s' }}>
                  <div style={{ display: 'flex' }}>
                    <div style={{ width: 4, background: dt.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>

                      {/* Header */}
                      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => toggle(m.id)}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: dt.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <dt.Icon size={18} style={{ color: dt.color }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--charcoal)' }}>{m.name}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, background: dt.bg, color: dt.color, padding: '2px 9px', borderRadius: 20, border: `1px solid ${dt.color}33` }}>{dt.label}</span>
                              {!m.is_active && <span style={{ fontSize: 10, background: 'var(--ivory)', color: 'var(--warm-gray)', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>INACTIVA</span>}
                            </div>
                            {/* Package day range badges */}
                            {isPkg && m.packages.length > 0 && (
                              <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                                {m.packages.map(pkg => (
                                  <span key={pkg.id} style={{ fontSize: 10, background: `${dt.color}18`, color: dt.color, padding: '2px 7px', borderRadius: 10, fontWeight: 600, border: `1px solid ${dt.color}33` }}>
                                    {pkgShortLabel(pkg.day_from, pkg.day_to)}
                                  </span>
                                ))}
                              </div>
                            )}
                            {m.description && !isPkg && (
                              <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 420 }}>{m.description}</div>
                            )}
                          </div>
                        </div>
                        {/* Right controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, color: 'var(--warm-gray)', background: 'var(--cream)', padding: '3px 10px', borderRadius: 20, fontWeight: 500, border: '1px solid var(--ivory)', whiteSpace: 'nowrap' }}>
                            {isPkg
                              ? `${m.packages.length} ${m.packages.length === 1 ? 'paquete' : 'paquetes'}`
                              : `${m.prices.length} ${m.prices.length === 1 ? 'tarifa' : 'tarifas'}`
                            }
                          </span>
                          <button onClick={() => toggleActive(m)} title={m.is_active ? 'Desactivar' : 'Activar'}
                            style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: m.is_active ? 'var(--gold)' : '#D1C9BF', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                            <span style={{ position: 'absolute', top: 2, left: m.is_active ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)} style={{ padding: '5px 7px' }}><Pencil size={13} /></button>
                          <button className="btn btn-ghost btn-sm" onClick={() => deleteModality(m.id)} style={{ padding: '5px 7px', color: 'var(--rose)' }}><Trash2 size={13} /></button>
                          <button className="btn btn-ghost btn-sm" onClick={() => toggle(m.id)} style={{ padding: '5px 7px' }}>
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded body */}
                      {(isExpanded || isAddingPkgHere) && (
                        <div style={{ borderTop: '1px solid var(--ivory)' }}>

                          {/* ── PACKAGE TYPE ─────────────────────────────── */}
                          {isPkg && (
                            <div>
                              {m.packages.map(pkg => {
                                const isEditingThisPkg    = editingPkg === pkg.id
                                const isAddingPriceHere   = priceAdding?.packageId === pkg.id
                                const otherRanges         = existingRanges.filter(r => r.day_from !== pkg.day_from || r.day_to !== pkg.day_to)

                                return (
                                  <div key={pkg.id} style={{ borderBottom: '1px solid var(--ivory)' }}>

                                    {/* Package slot header */}
                                    {isEditingThisPkg ? (
                                      <div style={{ padding: '12px 16px', background: '#FAFDF9' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: dt.color, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Editar paquete</div>
                                        <WeekDayPicker
                                          dayFrom={editPkgForm.day_from}
                                          dayTo={editPkgForm.day_to}
                                          onChange={(f, t) => setEditPkgForm(v => ({ ...v, day_from: f, day_to: t }))}
                                          accent={dt.color}
                                          hint="El mismo día puede ser salida de un paquete y entrada del siguiente"
                                          blockedRanges={otherRanges}
                                        />
                                        <div style={{ marginTop: 10 }}>
                                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Etiqueta (opcional)</div>
                                          <input type="text" className="form-input" placeholder="Ej: Fin de semana largo" value={editPkgForm.label} onChange={e => setEditPkgForm(v => ({ ...v, label: e.target.value }))} style={{ fontSize: 12 }} />
                                        </div>
                                        {pkgError && <div style={{ fontSize: 11, color: 'var(--rose)', marginTop: 6 }}>{pkgError}</div>}
                                        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                                          <button className="btn btn-primary btn-sm" disabled={pkgSaving} onClick={() => saveEditPkg(m.id, pkg.id)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Check size={12} /> {pkgSaving ? 'Guardando…' : 'Guardar'}
                                          </button>
                                          <button className="btn btn-ghost btn-sm" onClick={() => { setEditingPkg(null); setPkgError('') }}>Cancelar</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ padding: '9px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F7FAF8' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          <div style={{ width: 3, height: 16, background: dt.color, borderRadius: 2 }} />
                                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--charcoal)' }}>{pkgLabel(pkg)}</span>
                                          <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{pkg.prices.length} {pkg.prices.length === 1 ? 'período' : 'períodos'}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                          {!isAddingPriceHere && (
                                            <button className="btn btn-ghost btn-sm" onClick={() => startAddPrice(m.id, pkg.id)} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                                              <Plus size={11} /> Añadir período
                                            </button>
                                          )}
                                          <button className="btn btn-ghost btn-sm" onClick={() => startEditPkg(pkg)} style={{ padding: '3px 6px' }}><Pencil size={12} /></button>
                                          <button className="btn btn-ghost btn-sm" onClick={() => deletePkg(m.id, pkg.id)} style={{ padding: '3px 6px', color: 'var(--rose)' }}><Trash2 size={12} /></button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Package prices */}
                                    {!isEditingThisPkg && (
                                      <div style={{ padding: '4px 12px 8px' }}>
                                        {pkg.prices.map(p => (
                                          <div key={p.id} style={{ marginTop: 4 }}>
                                            {editingPrice === p.id ? (
                                              <PriceForm
                                                form={editPriceForm}
                                                onChange={setEditPriceForm}
                                                accent={dt.color}
                                                saving={priceSaving}
                                                error={priceError}
                                                onSave={() => saveEditPrice(m.id, pkg.id, p.id)}
                                                onCancel={() => setEditingPrice(null)}
                                                isEdit
                                                cfg={commercialConfig}
                                                zones={zones}
                                                supplements={supplements}
                                              />
                                            ) : (
                                              <PriceRow
                                                price={p}
                                                accent={dt.color}
                                                cfg={commercialConfig}
                                                zones={zones}
                                                supplements={supplements}
                                                onEdit={() => startEditPrice(p)}
                                                onDelete={() => deletePrice(m.id, pkg.id, p.id)}
                                              />
                                            )}
                                          </div>
                                        ))}
                                        {pkg.prices.length === 0 && !isAddingPriceHere && (
                                          <div style={{ padding: '10px 4px', color: 'var(--warm-gray)', fontSize: 12 }}>
                                            Sin períodos.{' '}
                                            <button style={{ background: 'none', border: 'none', color: dt.color, cursor: 'pointer', fontSize: 12, fontWeight: 600 }} onClick={() => startAddPrice(m.id, pkg.id)}>+ Añadir</button>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Add price for this package */}
                                    {isAddingPriceHere && !isEditingThisPkg && (
                                      <div style={{ padding: '0 12px 12px' }}>
                                        <PriceForm
                                          form={priceForm}
                                          onChange={setPriceForm}
                                          accent={dt.color}
                                          saving={priceSaving}
                                          error={priceError}
                                          onSave={savePrice}
                                          onCancel={cancelAddPrice}
                                          cfg={commercialConfig}
                                          zones={zones}
                                          supplements={supplements}
                                        />
                                      </div>
                                    )}
                                  </div>
                                )
                              })}

                              {/* Add new package slot */}
                              {isAddingPkgHere ? (
                                <div style={{ padding: '14px 16px', background: '#FAFAF9' }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: dt.color, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Nuevo paquete de días</div>
                                  <WeekDayPicker
                                    dayFrom={pkgForm.day_from}
                                    dayTo={pkgForm.day_to}
                                    onChange={(f, t) => setPkgForm(v => ({ ...v, day_from: f, day_to: t }))}
                                    accent={dt.color}
                                    hint="El mismo día puede ser salida de un paquete y entrada del siguiente. Los paquetes pueden cruzar la semana (ej: Vie → Mar)."
                                    blockedRanges={existingRanges}
                                  />
                                  <div style={{ marginTop: 10 }}>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Etiqueta (opcional)</div>
                                    <input type="text" className="form-input" placeholder="Ej: Fin de semana largo" value={pkgForm.label} onChange={e => setPkgForm(v => ({ ...v, label: e.target.value }))} style={{ fontSize: 12 }} />
                                  </div>
                                  {pkgError && <div style={{ fontSize: 11, color: 'var(--rose)', marginTop: 6 }}>{pkgError}</div>}
                                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                                    <button className="btn btn-primary btn-sm" disabled={pkgSaving} onClick={savePkg} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <Check size={12} /> {pkgSaving ? 'Guardando…' : 'Crear paquete'}
                                    </button>
                                    <button className="btn btn-ghost btn-sm" onClick={cancelAddPkg}>Cancelar</button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ padding: '10px 16px', background: '#FAFAF9' }}>
                                  <button className="btn btn-ghost btn-sm" onClick={() => startAddPkg(m.id)} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, color: dt.color, borderColor: `${dt.color}44` }}>
                                    <Plus size={11} /> Nuevo paquete de días
                                  </button>
                                </div>
                              )}

                              {m.packages.length === 0 && !isAddingPkgHere && (
                                <div style={{ padding: '0 16px 16px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 12 }}>
                                  <span>Crea tu primer paquete para definir los rangos de días disponibles.</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ── NON-PACKAGE TYPE ──────────────────────────── */}
                          {!isPkg && (
                            <div>
                              <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAF9' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Tarifas por temporada</span>
                                {!priceAdding && (
                                  <button className="btn btn-ghost btn-sm" onClick={() => startAddPrice(m.id)} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Plus size={11} /> Añadir período
                                  </button>
                                )}
                              </div>
                              {m.prices.length > 0 && (
                                <div style={{ padding: '4px 12px 12px' }}>
                                  {m.prices.filter(p => !p.package_id).map(p => (
                                    <div key={p.id} style={{ marginTop: 4 }}>
                                      {editingPrice === p.id ? (
                                        <PriceForm
                                          form={editPriceForm}
                                          onChange={setEditPriceForm}
                                          accent={dt.color}
                                          saving={priceSaving}
                                          error={priceError}
                                          onSave={() => saveEditPrice(m.id, null, p.id)}
                                          onCancel={() => setEditingPrice(null)}
                                          isEdit
                                          cfg={commercialConfig}
                                          zones={zones}
                                          supplements={supplements}
                                        />
                                      ) : (
                                        <PriceRow
                                          price={p}
                                          accent={dt.color}
                                          cfg={commercialConfig}
                                          zones={zones}
                                          supplements={supplements}
                                          onEdit={() => startEditPrice(p)}
                                          onDelete={() => deletePrice(m.id, null, p.id)}
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {m.prices.filter(p => !p.package_id).length === 0 && !priceAdding && (
                                <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 12 }}>
                                  Sin tarifas definidas.{' '}
                                  <button style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }} onClick={() => startAddPrice(m.id)}>+ Añadir período</button>
                                </div>
                              )}
                              {priceAdding?.modalityId === m.id && !priceAdding.packageId && (
                                <div style={{ padding: '0 12px 12px' }}>
                                  <PriceForm
                                    form={priceForm}
                                    onChange={setPriceForm}
                                    accent={dt.color}
                                    saving={priceSaving}
                                    error={priceError}
                                    onSave={savePrice}
                                    onCancel={cancelAddPrice}
                                    cfg={commercialConfig}
                                    zones={zones}
                                    supplements={supplements}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          </>}
        </div>
      </div>

      {/* ── Commercial config wizard ───────────────────────────────────────── */}
      {configWizardOpen && (() => {
        const QUESTION_LABELS: Record<WizardQuestion, string> = {
          space_type:          '¿Cómo está organizado tu espacio?',
          price_model:         '¿Cómo cobras el espacio?',
          menu_included:       wizardConfig.price_model === 'per_person' ? '¿El precio por persona incluye menú?' : '¿El paquete incluye menú?',
          catering_own:        '¿Ofreces catering / menú propio?',
          catering_mandatory:  '¿Es obligatorio contratar el catering interno?',
          has_menu_types:      '¿Hay diferentes tipos de menú (menú A, menú B…)?',
        }

        const cardOpts = (q: WizardQuestion) => {
          if (q === 'space_type') return [
            { key: 'single',               icon: Building2, label: 'Un único espacio',                   sub: 'Solo un evento a la vez, sin posibilidad de reservar zonas adicionales',                          color: '#C4975A', bg: '#FDF8F0' },
            { key: 'single_with_supplements', icon: Layers, label: 'Espacio principal + zonas opcionales', sub: 'El cliente contrata el espacio base y puede añadir zonas extra con suplemento (jardín, terraza…)', color: '#7C3AED', bg: '#F5F3FF' },
            { key: 'multiple_independent', icon: LayoutGrid, label: 'Varias zonas a elegir',              sub: 'El cliente escoge qué zona quiere. Cada zona es independiente y tiene su propio precio',           color: '#2563EB', bg: '#EFF6FF' },
          ] as { key: string; icon: any; label: string; sub: string; color: string; bg: string }[]
          if (q === 'price_model') return [
            { key: 'rental',     icon: CreditCard, label: 'Alquiler del espacio', sub: 'Precio fijo por el espacio, sin importar el número de invitados', color: '#059669', bg: '#ECFDF5' },
            { key: 'per_person', icon: Users,      label: 'Precio por persona',   sub: 'El total depende de cuántos asistentes hay',                     color: '#DC2626', bg: '#FEF2F2' },
            { key: 'package',    icon: Package,    label: 'Paquetes cerrados',    sub: 'Precio todo incluido (espacio + servicios) por persona o evento', color: '#C4975A', bg: '#FDF8F0' },
          ] as { key: string; icon: any; label: string; sub: string; color: string; bg: string }[]
          return null
        }

        const yesNoOpts = [
          { key: true,  label: 'Sí', color: '#059669', bg: '#ECFDF5' },
          { key: false, label: 'No', color: '#6B7280', bg: '#F9FAFB' },
        ]

        const currentVal = (() => {
          if (wizardQuestion === 'space_type')         return wizardConfig.space_type
          if (wizardQuestion === 'price_model')        return wizardConfig.price_model
          if (wizardQuestion === 'menu_included')      return wizardConfig.menu_included
          if (wizardQuestion === 'catering_own')       return wizardConfig.catering_own
          if (wizardQuestion === 'catering_mandatory') return wizardConfig.catering_mandatory
          if (wizardQuestion === 'has_menu_types')     return wizardConfig.has_menu_types
        })()

        const handleAnswer = (val: any) => {
          let next: WizardConfig = { ...wizardConfig }
          if (wizardQuestion === 'space_type') {
            next = { space_type: val }  // reset downstream when space changes
          } else if (wizardQuestion === 'price_model') {
            next = { ...next, price_model: val, menu_included: undefined, catering_own: undefined, catering_mandatory: undefined, has_menu_types: undefined }
          } else if (wizardQuestion === 'menu_included') {
            next = { ...next, menu_included: val, catering_own: undefined, catering_mandatory: undefined, has_menu_types: undefined }
          } else if (wizardQuestion === 'catering_own') {
            next = { ...next, catering_own: val, catering_mandatory: undefined }
          } else if (wizardQuestion === 'catering_mandatory') {
            next = { ...next, catering_mandatory: val }
          } else if (wizardQuestion === 'has_menu_types') {
            next = { ...next, has_menu_types: val }
          }
          setWizardConfig(next)

          // Determine next question
          const model = next.price_model
          let goTo: WizardQuestion | 'DONE' = 'DONE'
          if (wizardQuestion === 'space_type')         goTo = 'price_model'
          else if (wizardQuestion === 'price_model')   goTo = model === 'rental' ? 'catering_own' : 'menu_included'
          else if (wizardQuestion === 'menu_included') goTo = val ? 'has_menu_types' : 'catering_own'
          else if (wizardQuestion === 'catering_own')  goTo = val ? 'catering_mandatory' : 'DONE'
          else if (wizardQuestion === 'catering_mandatory') goTo = 'DONE'
          else if (wizardQuestion === 'has_menu_types')     goTo = 'DONE'

          if (goTo === 'DONE') {
            if (isWizardDone(next)) saveCommercialConfig(next)
          } else {
            wizardNext(goTo)
          }
        }

        const cards = cardOpts(wizardQuestion)
        const isYesNo = !cards
        const stepNum = wizardHistory.length + 1

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setConfigWizardOpen(false)}>
            <div style={{ background: '#ffffff', borderRadius: 14, width: '100%', maxWidth: 520, boxShadow: '0 24px 80px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--charcoal)' }}>Configuración comercial</div>
                  <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>Pregunta {stepNum}</div>
                </div>
                <button onClick={() => setConfigWizardOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4, display: 'flex' }}><X size={18} /></button>
              </div>

              <div style={{ padding: '20px 24px 24px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 16 }}>
                  {QUESTION_LABELS[wizardQuestion]}
                </div>

                {/* Card options (space_type, price_model) */}
                {cards && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {cards.map(opt => {
                      const sel = currentVal === opt.key
                      const Icon = opt.icon
                      return (
                        <button key={String(opt.key)} onClick={() => handleAnswer(opt.key)}
                          style={{ padding: '14px 16px', border: `2px solid ${sel ? opt.color : 'var(--ivory)'}`, borderRadius: 10, background: sel ? opt.bg : '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', outline: 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: sel ? `${opt.color}22` : 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={20} style={{ color: sel ? opt.color : 'var(--warm-gray)' }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: sel ? opt.color : 'var(--charcoal)', marginBottom: 2 }}>{opt.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{opt.sub}</div>
                          </div>
                          {sel && <div style={{ width: 20, height: 20, borderRadius: '50%', background: opt.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={12} style={{ color: '#fff' }} /></div>}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Yes/No options */}
                {isYesNo && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {yesNoOpts.map(opt => {
                      const sel = currentVal === opt.key
                      return (
                        <button key={String(opt.key)} onClick={() => handleAnswer(opt.key)}
                          style={{ padding: '20px 16px', border: `2px solid ${sel ? opt.color : 'var(--ivory)'}`, borderRadius: 10, background: sel ? opt.bg : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', outline: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: sel ? `${opt.color}22` : 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {opt.key ? <Check size={18} style={{ color: sel ? opt.color : 'var(--warm-gray)' }} /> : <X size={18} style={{ color: sel ? opt.color : 'var(--warm-gray)' }} />}
                          </div>
                          <span style={{ fontSize: 15, fontWeight: 700, color: sel ? opt.color : 'var(--charcoal)' }}>{opt.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Back button */}
                {wizardHistory.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <button className="btn btn-ghost btn-sm" onClick={wizardBack}>← Atrás</button>
                  </div>
                )}

                {configSaving && (
                  <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--warm-gray)' }}>Guardando…</div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Modality modal ─────────────────────────────────────────────────── */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setModalOpen(false)}>
          <div style={{ background: '#ffffff', borderRadius: 14, width: '100%', maxWidth: 540, boxShadow: '0 24px 80px rgba(0,0,0,0.25)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--charcoal)' }}>{editing ? 'Editar modalidad' : 'Nueva modalidad'}</div>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4, display: 'flex' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--charcoal)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>Nombre *</div>
                <input className="form-input" placeholder="Ej: Fin de semana, Día único, Paquetes semanales…" value={modalForm.name} onChange={e => setModalForm(f => ({ ...f, name: e.target.value }))} autoFocus style={{ fontSize: 13 }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--charcoal)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>Tipo de duración / regla</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {DURATION_TYPES.map(dt => {
                    const sel = modalForm.duration_type === dt.key
                    return (
                      <button key={dt.key} onClick={() => setModalForm(f => ({ ...f, duration_type: dt.key }))}
                        style={{ padding: '11px 13px', border: `2px solid ${sel ? dt.color : 'var(--ivory)'}`, borderRadius: 10, background: sel ? dt.bg : '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', outline: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                          <dt.Icon size={13} style={{ color: sel ? dt.color : 'var(--warm-gray)', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: sel ? dt.color : 'var(--charcoal)' }}>{dt.label}</span>
                          {sel && <span style={{ marginLeft: 'auto', width: 14, height: 14, borderRadius: '50%', background: dt.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={9} style={{ color: '#fff' }} /></span>}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--warm-gray)', lineHeight: 1.4 }}>{dt.sublabel}</div>
                        {sel && <div style={{ fontSize: 10, color: dt.color, marginTop: 4, fontStyle: 'italic' }}>{dt.detail}</div>}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--charcoal)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>Descripción (opcional)</div>
                <textarea className="form-input" placeholder="Qué incluye esta modalidad, horas exactas, condiciones especiales…" value={modalForm.description} onChange={e => setModalForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ resize: 'vertical', fontSize: 12 }} />
              </div>
              {modalError && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginTop: 14 }}>{modalError}</div>}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--ivory)', display: 'flex', gap: 8, justifyContent: 'flex-end', background: '#FAFAF9', flexShrink: 0 }}>
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={modalSaving} onClick={saveModality}>
                {modalSaving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear modalidad'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PriceRow({ price, accent, cfg, zones, supplements, onEdit, onDelete }: {
  price: ModalityPrice; accent: string
  cfg: CommercialConfig | null
  zones: ZoneItem[]; supplements: SupplementItem[]
  onEdit: () => void; onDelete: () => void
}) {
  const model = cfg?.price_model ?? 'rental'
  const space = cfg?.space_type  ?? 'single'

  const renderAmount = () => {
    if (space === 'multiple_independent') {
      const zp = price.zone_prices ?? []
      if (zp.length === 0) return <span style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Sin precios por zona</span>
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {zp.map(z => {
            const zone = zones.find(zo => zo.id === z.zone_id)
            return zone ? (
              <span key={z.zone_id} style={{ fontSize: 12, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '2px 8px', color: '#1D4ED8' }}>
                {zone.name}: <strong>{fmt(z.price)}</strong>
              </span>
            ) : null
          })}
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {model === 'rental' && (
          <span style={{ fontSize: 15, fontWeight: 700, color: accent }}>{fmt(price.price)}</span>
        )}
        {(model === 'per_person' || model === 'package') && (
          <span style={{ fontSize: 15, fontWeight: 700, color: accent }}>{fmt(price.price)}<span style={{ fontSize: 11, fontWeight: 400 }}>/pers.</span></span>
        )}
        {space === 'single_with_supplements' && (price.supplement_prices ?? []).map(sp => {
          const supp = supplements.find(s => s.id === sp.supplement_id)
          return supp ? (
            <span key={sp.supplement_id} style={{ fontSize: 11, background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 6, padding: '2px 8px', color: '#6D28D9' }}>
              +{supp.name}: {fmt(sp.price)}
            </span>
          ) : null
        })}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--cream)', borderRadius: 8, border: '1px solid var(--ivory)', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 185, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: 'var(--charcoal)', fontWeight: 500 }}>{fmtDate(price.date_from)}</span>
        <span style={{ fontSize: 10, color: 'var(--stone)' }}>→</span>
        <span style={{ fontSize: 12, color: 'var(--charcoal)', fontWeight: 500 }}>{fmtDate(price.date_to)}</span>
      </div>
      <div style={{ flex: 1, minWidth: 100 }}>{renderAmount()}</div>
      {price.notes && <span style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic', width: '100%', paddingLeft: 2 }}>{price.notes}</span>}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={onEdit} style={{ padding: '3px 7px' }}><Pencil size={12} /></button>
        <button className="btn btn-ghost btn-sm" onClick={onDelete} style={{ padding: '3px 7px', color: 'var(--rose)' }}><Trash2 size={12} /></button>
      </div>
    </div>
  )
}

function PriceForm({ form, onChange, accent, saving, error, onSave, onCancel, isEdit = false, cfg, zones, supplements }: {
  form: typeof emptyPriceForm; onChange: (f: typeof emptyPriceForm) => void
  accent: string; saving: boolean; error: string
  onSave: () => void; onCancel: () => void
  isEdit?: boolean
  cfg: CommercialConfig | null
  zones: ZoneItem[]; supplements: SupplementItem[]
}) {
  const model = cfg?.price_model ?? 'rental'
  const space = cfg?.space_type  ?? 'single'
  const isMulti = space === 'multiple_independent'
  const isSupp  = space === 'single_with_supplements'
  const showPerPerson = model === 'per_person' || model === 'package'
  const showBase = model === 'rental'

  const labelBase = model === 'per_person' ? 'PRECIO/PERSONA €' : model === 'package' ? 'PRECIO PAQUETE €' : 'PRECIO €'

  return (
    <div style={{ background: '#fff', border: `2px ${isEdit ? 'solid' : 'dashed'} ${accent}${isEdit ? '' : '55'}`, borderRadius: 10, padding: '14px' }}>
      {!isEdit && (
        <div style={{ fontSize: 10, fontWeight: 700, color: accent, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
          Nuevo período de precio
        </div>
      )}

      {/* Date pickers row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMulti ? '1fr 1fr' : '1fr 1fr 120px', gap: 10, marginBottom: 10 }}>
        <DatePicker label="DESDE" value={form.date_from} onChange={v => onChange({ ...form, date_from: v })} accent={accent} />
        <DatePicker label="HASTA" value={form.date_to}   onChange={v => onChange({ ...form, date_to: v })}   accent={accent} minDate={form.date_from || undefined} />
        {!isMulti && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{labelBase}</div>
            <input type="number" className="form-input" placeholder="0" value={form.price} onChange={e => onChange({ ...form, price: e.target.value })} style={{ fontSize: 12 }} />
          </div>
        )}
      </div>

      {/* Zone prices — multiple_independent */}
      {isMulti && zones.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Precio por zona €</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {zones.map(z => (
              <div key={z.id}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#1D4ED8', marginBottom: 4 }}>{z.name}</div>
                <input type="number" className="form-input" placeholder="0"
                  value={form.zone_prices[z.id] ?? ''}
                  onChange={e => onChange({ ...form, zone_prices: { ...form.zone_prices, [z.id]: e.target.value } })}
                  style={{ fontSize: 12 }} />
              </div>
            ))}
          </div>
        </div>
      )}
      {isMulti && zones.length === 0 && (
        <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>
          Define primero las zonas del venue para poder asignar precios por zona.
        </div>
      )}

      {/* Supplement prices — single_with_supplements */}
      {isSupp && supplements.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Precio por suplemento €</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {supplements.map(s => (
              <div key={s.id}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6D28D9', marginBottom: 4 }}>{s.name}</div>
                <input type="number" className="form-input" placeholder="0"
                  value={form.supplement_prices[s.id] ?? ''}
                  onChange={e => onChange({ ...form, supplement_prices: { ...form.supplement_prices, [s.id]: e.target.value } })}
                  style={{ fontSize: 12 }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* per_person: price field already in header row, no extra UI needed */}
      {(model === 'per_person' || model === 'package') && !isMulti && (
        <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 10, fontStyle: 'italic' }}>
          {model === 'package' ? 'Precio por persona todo incluido' : 'Precio por comensal/asistente'}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>NOTA (opcional)</div>
        <input type="text" className="form-input" placeholder="Ej: Temporada alta, Navidades..." value={form.notes} onChange={e => onChange({ ...form, notes: e.target.value })} style={{ fontSize: 12 }} />
      </div>
      {error && <div style={{ fontSize: 11, color: 'var(--rose)', marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" disabled={saving} onClick={onSave} style={{ flex: isEdit ? 0 : 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 5 }}>
          {saving ? 'Guardando…' : <><Check size={13} /> {isEdit ? 'Guardar' : 'Guardar período'}</>}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

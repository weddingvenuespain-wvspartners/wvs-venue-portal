'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { usePlanFeatures } from '@/lib/use-plan-features'
import {
  Plus, ChevronDown, ChevronUp, Pencil, Trash2,
  X, Check, Lock, Sun, Moon, CalendarDays, Package, SlidersHorizontal,
  Building2, Users, Layers, CreditCard, LayoutGrid, Settings2, ChevronRight, ChevronLeft,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import DatePicker, { fmtDate } from '@/components/DatePicker'
import type { VenueSpace, VenueSpaceGroup, VisitAvailability, DaySchedule, BlockedDate, HourRange } from '@/lib/proposal-types'

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
  space_type:  SpaceType
  price_model: PriceModel
}

type WizardQuestion = 'space_type' | 'price_model'
type WizardConfig   = Partial<CommercialConfig>

type ZoneItem       = { id: string; name: string }  // used only by PriceRow/PriceForm
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

  const [modalities, setModalities]           = useState<Modality[]>([])
  const [loading, setLoading]                 = useState(true)
  const [expanded, setExpanded]               = useState<Set<string>>(new Set())
  const [error, setError]                     = useState('')
  const [commercialConfig, setCommercialConfig] = useState<CommercialConfig | null>(null)
  const [configWizardOpen, setConfigWizardOpen]   = useState(false)
  const [wizardQuestion, setWizardQuestion]       = useState<WizardQuestion>('space_type')
  const [wizardHistory, setWizardHistory]         = useState<WizardQuestion[]>([])
  const [wizardConfig, setWizardConfig]           = useState<WizardConfig>({})
  const [configSaving, setConfigSaving]           = useState(false)

  // Space groups (replaces flat zones for multiple_independent)
  const [venueSpaceGroups, setVenueSpaceGroups] = useState<VenueSpaceGroup[]>([])
  const [savingGroups, setSavingGroups]           = useState(false)
  const [expandedGroups, setExpandedGroups]       = useState<Set<string>>(new Set())
  const [editingGroupId, setEditingGroupId]       = useState<string | null>(null)
  const [editGroupName, setEditGroupName]         = useState('')
  const [addingSpaceToGroup, setAddingSpaceToGroup] = useState<string | null>(null)
  const [newSpaceForm, setNewSpaceForm]           = useState({ name: '', cap_min: '', cap_max: '', price: '', description: '' })
  const [editingSpaceKey, setEditingSpaceKey]     = useState<string | null>(null)
  const [editSpaceForm, setEditSpaceForm]         = useState({ name: '', cap_min: '', cap_max: '', price: '', description: '' })

  // Visit availability
  const DEFAULT_SCHEDULE: DaySchedule[] = [0,1,2,3,4].map(day => ({ day, enabled: true, from: '10:00', to: '19:00' }))
    .concat([5,6].map(day => ({ day, enabled: false, from: '10:00', to: '14:00' })))
  const [visitAvail, setVisitAvail]     = useState<VisitAvailability>({ slot_duration: 60, schedule: DEFAULT_SCHEDULE, block_booked_weddings: true, block_calendar_unavailable: false, blocked_dates: [] })
  const [savingVisit, setSavingVisit]   = useState(false)
  const [visitAvailOpen, setVisitAvailOpen] = useState(false)
  const [visitAvailDirty, setVisitAvailDirty] = useState(false)
  // Block calendar UI state
  const [blockCalYear,  setBlockCalYear]  = useState(() => new Date().getFullYear())
  const [blockCalMonth, setBlockCalMonth] = useState(() => new Date().getMonth())
  const [blockView, setBlockView] = useState<'month' | 'week'>('month')
  const [blockWeekStart, setBlockWeekStart] = useState<string>(() => {
    const t = new Date(); const day = t.getDay(); const diff = day === 0 ? -6 : 1 - day; t.setDate(t.getDate() + diff)
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`
  })
  const [blockPickerDate, setBlockPickerDate] = useState<string | null>(null)
  const [blockType, setBlockType] = useState<BlockedDate['type']>('full')
  const [blockRanges, setBlockRanges] = useState<Array<{ from: string; to: string }>>([{ from: '09:00', to: '13:00' }])
  // Range-select mode
  const [blockRangeStart, setBlockRangeStart] = useState<string | null>(null)
  const [blockRangeEnd,   setBlockRangeEnd]   = useState<string | null>(null)
  const [blockRangeMode,  setBlockRangeMode]  = useState(false)
  // Calendar entries overlaid on block calendar
  const [blockCalEntries, setBlockCalEntries] = useState<Record<string, string>>({})

  // Supplements
  const [supplements, setSupplements]       = useState<SupplementItem[]>([])
  const [newSuppName, setNewSuppName]       = useState('')
  const [savingZS, setSavingZS]             = useState(false)

  // Derived flat zones list for modality pricing (PriceRow/PriceForm)
  const zones: ZoneItem[] = venueSpaceGroups.flatMap(g => g.spaces.map(s => ({ id: s.id, name: s.name })))

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


  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    load()
  }, [user, authLoading]) // eslint-disable-line

  // Load calendar_entries for the visible range (month or week view)
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const p = (n: number) => String(n).padStart(2, '0')
    let from: string, to: string
    if (blockView === 'week') {
      from = blockWeekStart
      const end = new Date(blockWeekStart + 'T12:00:00'); end.setDate(end.getDate() + 6)
      to = `${end.getFullYear()}-${p(end.getMonth()+1)}-${p(end.getDate())}`
    } else {
      from = `${blockCalYear}-${p(blockCalMonth + 1)}-01`
      const lastDay = new Date(blockCalYear, blockCalMonth + 1, 0).getDate()
      to = `${blockCalYear}-${p(blockCalMonth + 1)}-${p(lastDay)}`
    }
    supabase.from('calendar_entries').select('date,status').eq('user_id', user.id).gte('date', from).lte('date', to)
      .then(({ data }) => {
        const map: Record<string, string> = {}
        data?.forEach(e => { map[e.date] = e.status })
        setBlockCalEntries(map)
      })
  }, [blockCalYear, blockCalMonth, blockView, blockWeekStart, user]) // eslint-disable-line

  const load = async () => {
    const supabase = createClient()
    const [res, { data: settingsRow }] = await Promise.all([
      fetch('/api/estructura/modalities'),
      supabase.from('venue_settings').select('commercial_config, space_groups, zones, supplements, visit_availability').eq('user_id', user!.id).maybeSingle(),
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
    if (settingsRow?.space_groups) {
      setVenueSpaceGroups(settingsRow.space_groups as VenueSpaceGroup[])
      setExpandedGroups(new Set((settingsRow.space_groups as VenueSpaceGroup[]).map((g: VenueSpaceGroup) => g.id)))
    } else if (settingsRow?.zones && Array.isArray(settingsRow.zones) && settingsRow.zones.length > 0) {
      // Migrate old flat zones into a single default group
      const migrated: VenueSpaceGroup[] = [{
        id: crypto.randomUUID(),
        name: 'Espacios del venue',
        selection_mode: 'pick_one',
        spaces: (settingsRow.zones as ZoneItem[]).map(z => ({ id: z.id, name: z.name })),
      }]
      setVenueSpaceGroups(migrated)
      setExpandedGroups(new Set([migrated[0].id]))
    }
    if (settingsRow?.supplements)    setSupplements(settingsRow.supplements as SupplementItem[])
    if (settingsRow?.visit_availability) {
      const va = settingsRow.visit_availability as VisitAvailability & { blocked_dates?: Array<BlockedDate | string> }
      // Migrate legacy string[] blocked_dates → BlockedDate[]
      const blocked: BlockedDate[] = (va.blocked_dates ?? []).map(b =>
        typeof b === 'string' ? { date: b, type: 'full' as const } : b
      )
      setVisitAvail({ ...va, blocked_dates: blocked })
    }
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

  const saveSpaceGroups = async (groups: VenueSpaceGroup[]) => {
    setSavingGroups(true)
    const supabase = createClient()
    await supabase.from('venue_settings').upsert({ user_id: user!.id, space_groups: groups }, { onConflict: 'user_id' })
    setSavingGroups(false)
  }

  const saveVisitAvail = async (va: VisitAvailability) => {
    setSavingVisit(true)
    const supabase = createClient()
    const { error } = await supabase.from('venue_settings').upsert({ user_id: user!.id, visit_availability: va }, { onConflict: 'user_id' })
    if (error) console.error('[saveVisitAvail]', error)
    else setVisitAvailDirty(false)
    setSavingVisit(false)
  }

  const saveSupplements = async (newSupps: SupplementItem[]) => {
    setSavingZS(true)
    const supabase = createClient()
    await supabase.from('venue_settings').upsert({ user_id: user!.id, supplements: newSupps }, { onConflict: 'user_id' })
    setSavingZS(false)
  }

  const addGroup = async () => {
    const newGroup: VenueSpaceGroup = { id: crypto.randomUUID(), name: 'Nuevo grupo', selection_mode: 'pick_one', spaces: [] }
    const next = [...venueSpaceGroups, newGroup]
    setVenueSpaceGroups(next)
    setExpandedGroups(prev => new Set([...prev, newGroup.id]))
    setEditingGroupId(newGroup.id); setEditGroupName('Nuevo grupo')
    await saveSpaceGroups(next)
  }

  const removeGroup = async (groupId: string) => {
    const next = venueSpaceGroups.filter(g => g.id !== groupId)
    setVenueSpaceGroups(next)
    await saveSpaceGroups(next)
  }

  const updateGroup = async (groupId: string, patch: Partial<VenueSpaceGroup>) => {
    const next = venueSpaceGroups.map(g => g.id === groupId ? { ...g, ...patch } : g)
    setVenueSpaceGroups(next)
    await saveSpaceGroups(next)
  }

  const commitGroupName = async (groupId: string) => {
    const name = editGroupName.trim()
    if (name) await updateGroup(groupId, { name })
    setEditingGroupId(null)
  }

  const addSpace = async (groupId: string) => {
    const name = newSpaceForm.name.trim()
    if (!name) return
    const space: VenueSpace = {
      id: crypto.randomUUID(), name,
      capacity_min: newSpaceForm.cap_min ? Number(newSpaceForm.cap_min) : undefined,
      capacity_max: newSpaceForm.cap_max ? Number(newSpaceForm.cap_max) : undefined,
      price: newSpaceForm.price || undefined,
      description: newSpaceForm.description || undefined,
    }
    const next = venueSpaceGroups.map(g => g.id === groupId ? { ...g, spaces: [...g.spaces, space] } : g)
    setVenueSpaceGroups(next)
    setNewSpaceForm({ name: '', cap_min: '', cap_max: '', price: '', description: '' })
    setAddingSpaceToGroup(null)
    await saveSpaceGroups(next)
  }

  const removeSpace = async (groupId: string, spaceId: string) => {
    const next = venueSpaceGroups.map(g => g.id === groupId ? { ...g, spaces: g.spaces.filter(s => s.id !== spaceId) } : g)
    setVenueSpaceGroups(next)
    await saveSpaceGroups(next)
  }

  const commitSpaceEdit = async (groupId: string, spaceId: string) => {
    const name = editSpaceForm.name.trim()
    if (!name) { setEditingSpaceKey(null); return }
    const patch: Partial<VenueSpace> = {
      name,
      capacity_min: editSpaceForm.cap_min ? Number(editSpaceForm.cap_min) : undefined,
      capacity_max: editSpaceForm.cap_max ? Number(editSpaceForm.cap_max) : undefined,
      price: editSpaceForm.price || undefined,
      description: editSpaceForm.description || undefined,
    }
    const next = venueSpaceGroups.map(g => g.id === groupId ? { ...g, spaces: g.spaces.map(s => s.id === spaceId ? { ...s, ...patch } : s) } : g)
    setVenueSpaceGroups(next)
    setEditingSpaceKey(null)
    await saveSpaceGroups(next)
  }

  const addSupplement = async () => {
    const name = newSuppName.trim()
    if (!name) return
    const next = [...supplements, { id: crypto.randomUUID(), name }]
    setSupplements(next); setNewSuppName('')
    await saveSupplements(next)
  }

  const removeSupplement = async (id: string) => {
    const next = supplements.filter(s => s.id !== id)
    setSupplements(next)
    await saveSupplements(next)
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


  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div>
            <div className="topbar-title">Estructura comercial</div>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 1 }}>
              Define las modalidades de tu venue y sus tarifas por temporada
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Nueva modalidad
          </button>
        </div>

        <div className="page-content">
          {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

          {/* ── MODALIDADES ───────────────────────────────────────────────────── */}
          {<>

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

          {/* Space groups panel — only for multiple_independent */}
          {commercialConfig?.space_type === 'multiple_independent' && (
            <div style={{ background: '#fff', border: '1px solid var(--ivory)', borderRadius: 10, padding: '16px 20px', marginBottom: 16, maxWidth: 860 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <LayoutGrid size={14} style={{ color: '#2563EB' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--charcoal)', flex: 1 }}>Grupos y espacios</span>
                <button className="btn btn-ghost btn-sm" onClick={addGroup} disabled={savingGroups} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                  <Plus size={11} /> Nuevo grupo
                </button>
              </div>

              {venueSpaceGroups.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', padding: '8px 0' }}>
                  Crea grupos para organizar tus espacios. Ej: "Salones interiores", "Espacios exteriores".
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {venueSpaceGroups.map(group => {
                  const isOpen = expandedGroups.has(group.id)
                  const isEditingName = editingGroupId === group.id
                  return (
                    <div key={group.id} style={{ border: '1px solid #BFDBFE', borderRadius: 8, overflow: 'hidden' }}>
                      {/* Group header */}
                      <div style={{ background: '#EFF6FF', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button type="button" onClick={() => setExpandedGroups(prev => { const s = new Set(prev); isOpen ? s.delete(group.id) : s.add(group.id); return s })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1D4ED8', padding: 0, display: 'flex' }}>
                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        {isEditingName ? (
                          <input autoFocus className="form-input" value={editGroupName} onChange={e => setEditGroupName(e.target.value)}
                            onBlur={() => commitGroupName(group.id)} onKeyDown={e => e.key === 'Enter' && commitGroupName(group.id)}
                            style={{ fontSize: 12, fontWeight: 600, flex: 1, padding: '2px 6px' }} />
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#1D4ED8', flex: 1 }}>{group.name}</span>
                        )}
                        {/* Selection mode pills */}
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(['pick_one', 'pick_n', 'optional'] as const).map(mode => (
                            <button key={mode} type="button" onClick={() => updateGroup(group.id, { selection_mode: mode })}
                              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600,
                                background: group.selection_mode === mode ? '#1D4ED8' : '#DBEAFE',
                                color: group.selection_mode === mode ? '#fff' : '#1D4ED8' }}>
                              {mode === 'pick_one' ? 'Elegir 1' : mode === 'pick_n' ? 'Elegir N' : 'Opcional'}
                            </button>
                          ))}
                        </div>
                        {/* Pricing mode pills */}
                        <div style={{ display: 'flex', gap: 4, marginLeft: 4, paddingLeft: 8, borderLeft: '1px solid #BFDBFE' }}>
                          {(['per_space', 'group_base'] as const).map(pm => (
                            <button key={pm} type="button" onClick={() => updateGroup(group.id, { pricing_mode: pm })}
                              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600,
                                background: (group.pricing_mode ?? 'per_space') === pm ? '#0F766E' : '#CCFBF1',
                                color: (group.pricing_mode ?? 'per_space') === pm ? '#fff' : '#0F766E' }}
                              title={pm === 'per_space' ? 'Cada espacio tiene su propio precio' : 'Precio base del grupo + suplementos por espacio'}>
                              {pm === 'per_space' ? 'Precio/espacio' : 'Base + extras'}
                            </button>
                          ))}
                        </div>
                        {group.selection_mode === 'pick_n' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input type="number" className="form-input" placeholder="mín" value={group.pick_n_min ?? ''}
                              onChange={e => updateGroup(group.id, { pick_n_min: e.target.value ? Number(e.target.value) : undefined })}
                              style={{ width: 44, fontSize: 11, padding: '2px 4px' }} />
                            <span style={{ fontSize: 10, color: '#64748B' }}>–</span>
                            <input type="number" className="form-input" placeholder="máx" value={group.pick_n_max ?? ''}
                              onChange={e => updateGroup(group.id, { pick_n_max: e.target.value ? Number(e.target.value) : undefined })}
                              style={{ width: 44, fontSize: 11, padding: '2px 4px' }} />
                          </div>
                        )}
                        <button type="button" onClick={() => { setEditingGroupId(group.id); setEditGroupName(group.name) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93C5FD', padding: '2px 4px', display: 'flex' }}>
                          <Pencil size={12} />
                        </button>
                        <button type="button" onClick={() => removeGroup(group.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FCA5A5', padding: '2px 4px', display: 'flex' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Group body */}
                      {isOpen && (
                        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {group.pricing_mode === 'group_base' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#0F766E', whiteSpace: 'nowrap' }}>Precio base del grupo:</span>
                              <input className="form-input" placeholder="ej. 5.000€"
                                value={group.base_price ?? ''}
                                onChange={e => updateGroup(group.id, { base_price: e.target.value })}
                                style={{ fontSize: 12, flex: 1 }} />
                              <span style={{ fontSize: 10, color: '#0F766E', fontStyle: 'italic' }}>los espacios actúan como suplemento opcional</span>
                            </div>
                          )}
                          {group.spaces.length === 0 && addingSpaceToGroup !== group.id && (
                            <div style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Sin espacios. Añade el primero.</div>
                          )}

                          {group.spaces.map(space => {
                            const spaceKey = `${group.id}:${space.id}`
                            const isEditingSpace = editingSpaceKey === spaceKey
                            return (
                              <div key={space.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', background: 'var(--cream)' }}>
                                {isEditingSpace ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <input autoFocus className="form-input" placeholder="Nombre *" value={editSpaceForm.name}
                                        onChange={e => setEditSpaceForm(f => ({ ...f, name: e.target.value }))}
                                        style={{ fontSize: 12, flex: 2 }} />
                                      <input type="number" className="form-input" placeholder="Cap. mín" value={editSpaceForm.cap_min}
                                        onChange={e => setEditSpaceForm(f => ({ ...f, cap_min: e.target.value }))}
                                        style={{ fontSize: 12, width: 80 }} />
                                      <input type="number" className="form-input" placeholder="Cap. máx" value={editSpaceForm.cap_max}
                                        onChange={e => setEditSpaceForm(f => ({ ...f, cap_max: e.target.value }))}
                                        style={{ fontSize: 12, width: 80 }} />
                                      <input className="form-input" placeholder={group.pricing_mode === 'group_base' ? 'Suplemento' : 'Precio'} value={editSpaceForm.price}
                                        onChange={e => setEditSpaceForm(f => ({ ...f, price: e.target.value }))}
                                        style={{ fontSize: 12, width: 100 }} />
                                    </div>
                                    <input className="form-input" placeholder="Descripción breve (opcional)" value={editSpaceForm.description}
                                      onChange={e => setEditSpaceForm(f => ({ ...f, description: e.target.value }))}
                                      style={{ fontSize: 12 }} />
                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingSpaceKey(null)}>Cancelar</button>
                                      <button className="btn btn-primary btn-sm" onClick={() => commitSpaceEdit(group.id, space.id)}>Guardar</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', flex: 1 }}>{space.name}</span>
                                    {(space.capacity_min || space.capacity_max) && (
                                      <span style={{ fontSize: 11, color: '#64748B', background: '#F1F5F9', borderRadius: 5, padding: '1px 6px' }}>
                                        <Users size={9} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                                        {space.capacity_min ?? '0'}–{space.capacity_max ?? '∞'} pax
                                      </span>
                                    )}
                                    {space.price && (
                                      <span style={{ fontSize: 11, color: '#64748B', background: '#F1F5F9', borderRadius: 5, padding: '1px 6px' }}>
                                        {group.pricing_mode === 'group_base' && !space.price.trim().startsWith('+') ? `+${space.price}` : space.price}
                                      </span>
                                    )}
                                    {space.description && (
                                      <span style={{ fontSize: 10, color: 'var(--warm-gray)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{space.description}</span>
                                    )}
                                    <button type="button" onClick={() => { setEditingSpaceKey(spaceKey); setEditSpaceForm({ name: space.name, cap_min: space.capacity_min?.toString() ?? '', cap_max: space.capacity_max?.toString() ?? '', price: space.price ?? '', description: space.description ?? '' }) }}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: '2px 4px', display: 'flex' }}>
                                      <Pencil size={12} />
                                    </button>
                                    <button type="button" onClick={() => removeSpace(group.id, space.id)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FCA5A5', padding: '2px 4px', display: 'flex' }}>
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}

                          {/* Add space form */}
                          {addingSpaceToGroup === group.id ? (
                            <div style={{ border: '1px dashed #BFDBFE', borderRadius: 6, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <input autoFocus className="form-input" placeholder="Nombre del espacio *" value={newSpaceForm.name}
                                  onChange={e => setNewSpaceForm(f => ({ ...f, name: e.target.value }))}
                                  onKeyDown={e => e.key === 'Enter' && addSpace(group.id)}
                                  style={{ fontSize: 12, flex: 2 }} />
                                <input type="number" className="form-input" placeholder="Cap. mín" value={newSpaceForm.cap_min}
                                  onChange={e => setNewSpaceForm(f => ({ ...f, cap_min: e.target.value }))}
                                  style={{ fontSize: 12, width: 80 }} />
                                <input type="number" className="form-input" placeholder="Cap. máx" value={newSpaceForm.cap_max}
                                  onChange={e => setNewSpaceForm(f => ({ ...f, cap_max: e.target.value }))}
                                  style={{ fontSize: 12, width: 80 }} />
                                <input className="form-input" placeholder={group.pricing_mode === 'group_base' ? 'Suplemento' : 'Precio'} value={newSpaceForm.price}
                                  onChange={e => setNewSpaceForm(f => ({ ...f, price: e.target.value }))}
                                  style={{ fontSize: 12, width: 100 }} />
                              </div>
                              <input className="form-input" placeholder="Descripción breve (opcional)" value={newSpaceForm.description}
                                onChange={e => setNewSpaceForm(f => ({ ...f, description: e.target.value }))}
                                style={{ fontSize: 12 }} />
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => { setAddingSpaceToGroup(null); setNewSpaceForm({ name: '', cap_min: '', cap_max: '', price: '', description: '' }) }}>Cancelar</button>
                                <button className="btn btn-primary btn-sm" disabled={!newSpaceForm.name.trim()} onClick={() => addSpace(group.id)}>Añadir espacio</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setAddingSpaceToGroup(group.id)}
                              style={{ fontSize: 11, color: '#2563EB', background: 'none', border: '1px dashed #BFDBFE', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', textAlign: 'left' }}>
                              <Plus size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />Añadir espacio
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
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

          {/* ── Visit availability panel ─────────────────────────────────────── */}
          {(() => {
            const DAY_NAMES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
            const DURATIONS: Array<{ value: 30|45|60|90|120; label: string }> = [
              { value: 30, label: '30 min' }, { value: 45, label: '45 min' },
              { value: 60, label: '1 hora' }, { value: 90, label: '1,5 h' }, { value: 120, label: '2 h' },
            ]
            const updateDay = (day: number, patch: Partial<DaySchedule>) => {
              const next: VisitAvailability = { ...visitAvail, schedule: visitAvail.schedule.map(s => s.day === day ? { ...s, ...patch } : s) }
              setVisitAvail(next); setVisitAvailDirty(true)
            }
            const updateAvail = (patch: Partial<VisitAvailability>) => {
              const next = { ...visitAvail, ...patch }; setVisitAvail(next); setVisitAvailDirty(true)
            }
            const upsertBlockedDates = (dates: string[], block: Omit<BlockedDate, 'date'>) => {
              const newEntries: BlockedDate[] = dates.map(d => ({ date: d, ...block }))
              const newDates = new Set(dates)
              const rest = visitAvail.blocked_dates.filter(x => !newDates.has(x.date))
              const next = { ...visitAvail, blocked_dates: [...rest, ...newEntries].sort((a, z) => a.date.localeCompare(z.date)) }
              setVisitAvail(next); setVisitAvailDirty(true)
            }
            const removeBlockedDate = (date: string) => {
              const next = { ...visitAvail, blocked_dates: visitAvail.blocked_dates.filter(x => x.date !== date) }
              setVisitAvail(next); setVisitAvailDirty(true)
              if (blockPickerDate === date) setBlockPickerDate(null)
            }
            // Calendar helpers
            const CAL_MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
            const CAL_DAYS = ['L','M','X','J','V','S','D']
            const pad2 = (n: number) => String(n).padStart(2, '0')
            const daysInMonth = new Date(blockCalYear, blockCalMonth + 1, 0).getDate()
            const firstDow = (() => { const d = new Date(blockCalYear, blockCalMonth, 1).getDay(); return d === 0 ? 6 : d - 1 })()
            const todayIso = (() => { const t = new Date(); return `${t.getFullYear()}-${pad2(t.getMonth()+1)}-${pad2(t.getDate())}` })()
            const blockedMap: Record<string, BlockedDate> = {}
            visitAvail.blocked_dates.forEach(b => { blockedMap[b.date] = b })
            // Auto-blocked from main calendar
            const getAutoBlock = (iso: string): 'wedding' | 'unavailable' | null => {
              const s = blockCalEntries[iso]
              if (!s || s === 'libre') return null
              if (visitAvail.block_booked_weddings && (s === 'reservado' || s === 'ganado')) return 'wedding'
              if (visitAvail.block_calendar_unavailable && s !== 'libre') return 'unavailable'
              return null
            }
            const blockTypeLabel = (t: BlockedDate['type']) => ({ full: 'Día completo', morning: 'Solo mañana', afternoon: 'Solo tarde', hours: 'Horas concretas' })[t]
            const blockColor = (t: BlockedDate['type']) => ({ full: '#f87171', morning: '#fb923c', afternoon: '#fbbf24', hours: '#a78bfa' })[t]
            // Range helpers
            const rangeMin = blockRangeStart && blockPickerDate ? [blockRangeStart, blockPickerDate].sort()[0] : null
            const rangeMax = blockRangeStart && blockPickerDate ? [blockRangeStart, blockPickerDate].sort()[1] : null
            const isInRange = (iso: string) => !!(rangeMin && rangeMax && iso >= rangeMin && iso <= rangeMax)
            // Build list of all dates currently selected (range or single)
            const getSelectedDates = (): string[] => {
              if (blockRangeMode && blockRangeStart && blockPickerDate) {
                const [s, e] = [blockRangeStart, blockPickerDate].sort()
                const out: string[] = []
                const cur = new Date(s + 'T12:00:00')
                const end = new Date(e + 'T12:00:00')
                while (cur <= end) {
                  out.push(`${cur.getFullYear()}-${pad2(cur.getMonth()+1)}-${pad2(cur.getDate())}`)
                  cur.setDate(cur.getDate() + 1)
                }
                return out
              }
              return blockPickerDate ? [blockPickerDate] : []
            }
            const selectedDates = getSelectedDates()
            const pickerLabel = blockRangeMode && blockRangeStart && blockPickerDate && blockRangeStart !== blockPickerDate
              ? `${new Date(rangeMin!+'T12:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})} – ${new Date(rangeMax!+'T12:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})} (${selectedDates.length} días)`
              : blockPickerDate
                ? new Date(blockPickerDate+'T12:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})
                : blockRangeMode && blockRangeStart
                  ? `Desde ${new Date(blockRangeStart+'T12:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})} — elige el día final`
                  : null
            const confirmBlock = () => {
              if (!selectedDates.length) return
              const block: Omit<BlockedDate,'date'> = blockType === 'hours'
                ? { type: 'hours', ranges: blockRanges.filter(r => r.from && r.to) }
                : { type: blockType }
              upsertBlockedDates(selectedDates, block)
              setBlockPickerDate(null)
              setBlockRangeStart(null)
              setBlockRangeEnd(null)
            }
            return (
              <div style={{ background: '#fff', border: '1px solid var(--ivory)', borderRadius: 10, marginBottom: 16, maxWidth: 860, overflow: 'hidden' }}>
                {/* Collapsible header */}
                <button type="button" onClick={() => setVisitAvailOpen(o => !o)}
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
                  <CalendarDays size={14} style={{ color: '#059669', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--charcoal)', flex: 1 }}>Disponibilidad para visitas</span>
                  {visitAvailDirty && !visitAvailOpen && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#d97706', background: '#fef3c7', borderRadius: 5, padding: '2px 7px' }}>Sin guardar</span>
                  )}
                  {visitAvailDirty && visitAvailOpen && (
                    <span style={{ fontSize: 10, color: '#d97706' }}>Cambios pendientes</span>
                  )}
                  {visitAvailOpen ? <ChevronUp size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />}
                </button>

                {visitAvailOpen && (
                <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--ivory)' }}>
                <div style={{ height: 16 }} />

                {/* Duration */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 6 }}>Duración de cada visita</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {DURATIONS.map(({ value, label }) => (
                      <button key={value} type="button" onClick={() => updateAvail({ slot_duration: value })}
                        style={{ fontSize: 11, padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
                          background: visitAvail.slot_duration === value ? '#059669' : '#D1FAE5',
                          color: visitAvail.slot_duration === value ? '#fff' : '#065F46' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Weekly schedule */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 8 }}>Horario disponible</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {visitAvail.schedule.map(ds => (
                      <div key={ds.day} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button type="button" onClick={() => updateDay(ds.day, { enabled: !ds.enabled })}
                          style={{ width: 72, fontSize: 11, padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, textAlign: 'center',
                            background: ds.enabled ? '#059669' : '#F3F4F6', color: ds.enabled ? '#fff' : '#9CA3AF' }}>
                          {DAY_NAMES[ds.day].slice(0, 3)}
                        </button>
                        {ds.enabled && (
                          <>
                            <input type="time" value={ds.from} onChange={e => updateDay(ds.day, { from: e.target.value })}
                              className="form-input" style={{ fontSize: 12, width: 90 }} />
                            <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>—</span>
                            <input type="time" value={ds.to} onChange={e => updateDay(ds.day, { to: e.target.value })}
                              className="form-input" style={{ fontSize: 12, width: 90 }} />
                          </>
                        )}
                        {!ds.enabled && <span style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic' }}>No disponible</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* What blocks a slot */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 8 }}>Qué bloquea un hueco automáticamente</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--charcoal)', cursor: 'default' }}>
                      <input type="checkbox" checked disabled style={{ width: 14, height: 14 }} />
                      Visitas ya agendadas <span style={{ fontSize: 10, color: 'var(--warm-gray)', marginLeft: 4 }}>(siempre activo)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--charcoal)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={visitAvail.block_booked_weddings}
                        onChange={e => updateAvail({ block_booked_weddings: e.target.checked })} style={{ width: 14, height: 14 }} />
                      Días con boda reservada / contratada en el calendario
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--charcoal)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={visitAvail.block_calendar_unavailable}
                        onChange={e => updateAvail({ block_calendar_unavailable: e.target.checked })} style={{ width: 14, height: 14 }} />
                      Cualquier día marcado como no libre en el calendario
                    </label>
                  </div>
                </div>

                {/* Manual blocked dates — calendar views */}
                <div>
                  {/* Toolbar: view toggle + navigation */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', marginRight: 4 }}>Bloquear fechas manualmente</div>
                    <div style={{ display: 'flex', background: '#f3f0ec', borderRadius: 8, padding: 2, gap: 1 }}>
                      {(['month','week'] as const).map(v => (
                        <button key={v} type="button" onClick={() => setBlockView(v)}
                          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600,
                            background: blockView === v ? '#fff' : 'transparent',
                            color: blockView === v ? 'var(--charcoal)' : 'var(--warm-gray)',
                            boxShadow: blockView === v ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>
                          {v === 'month' ? 'Mes' : 'Semana'}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                      <button type="button" onClick={() => {
                        if (blockView === 'month') { if (blockCalMonth === 0) { setBlockCalMonth(11); setBlockCalYear(y => y-1) } else setBlockCalMonth(m => m-1) }
                        else { const d = new Date(blockWeekStart+'T12:00:00'); d.setDate(d.getDate()-7); const p=(n:number)=>String(n).padStart(2,'0'); setBlockWeekStart(`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`) }
                      }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', display: 'flex', padding: 4 }}><ChevronLeft size={15} /></button>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', minWidth: 120, textAlign: 'center' }}>
                        {blockView === 'month' ? `${CAL_MONTHS[blockCalMonth]} ${blockCalYear}` : (() => {
                          const end = new Date(blockWeekStart+'T12:00:00'); end.setDate(end.getDate()+6)
                          const p=(n:number)=>String(n).padStart(2,'0')
                          const s = new Date(blockWeekStart+'T12:00:00')
                          return `${p(s.getDate())} ${CAL_MONTHS[s.getMonth()].slice(0,3)} – ${p(end.getDate())} ${CAL_MONTHS[end.getMonth()].slice(0,3)}`
                        })()}
                      </span>
                      <button type="button" onClick={() => {
                        if (blockView === 'month') { if (blockCalMonth === 11) { setBlockCalMonth(0); setBlockCalYear(y => y+1) } else setBlockCalMonth(m => m+1) }
                        else { const d = new Date(blockWeekStart+'T12:00:00'); d.setDate(d.getDate()+7); const p=(n:number)=>String(n).padStart(2,'0'); setBlockWeekStart(`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`) }
                      }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', display: 'flex', padding: 4 }}><ChevronRight size={15} /></button>
                    </div>
                    {blockView === 'month' && (
                      <button type="button"
                        onClick={() => { const next = !blockRangeMode; setBlockRangeMode(next); if (!next) { setBlockRangeStart(null); setBlockRangeEnd(null); setBlockPickerDate(null) } }}
                        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
                          background: blockRangeMode ? '#1e3a5f' : '#ede9e4',
                          color: blockRangeMode ? '#fff' : 'var(--charcoal)' }}>
                        {blockRangeMode ? '✕ Cancelar rango' : '↔ Rango'}
                      </button>
                    )}
                  </div>
                  {blockRangeMode && blockView === 'month' && (
                    <div style={{ fontSize: 11, color: '#1e3a5f', background: '#e8f0fe', borderRadius: 7, padding: '6px 12px', marginBottom: 8 }}>
                      {!blockRangeStart ? 'Haz click en el primer día del rango' : !blockPickerDate || blockPickerDate === blockRangeStart ? 'Ahora haz click en el último día del rango' : `Rango seleccionado: ${selectedDates.length} días`}
                    </div>
                  )}
                  <div style={{ border: '1px solid var(--ivory)', borderRadius: 10, overflow: 'hidden' }}>
                    {/* Day headers — month view only */}
                    {blockView === 'month' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: '#faf8f5', borderBottom: '1px solid var(--ivory)' }}>
                      {CAL_DAYS.map((d, i) => (
                        <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: i >= 5 ? 'var(--gold)' : 'var(--warm-gray)', letterSpacing: '.08em', padding: '6px 0' }}>{d}</div>
                      ))}
                    </div>
                    )}
                    {/* Day cells — month view */}
                    {blockView === 'month' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
                      {Array.from({ length: firstDow }).map((_, i) => (
                        <div key={`e${i}`} style={{ minHeight: 44, borderRight: '1px solid var(--ivory)', borderBottom: '1px solid var(--ivory)' }} />
                      ))}
                      {Array.from({ length: daysInMonth }).map((_, idx) => {
                        const day = idx + 1
                        const iso = `${blockCalYear}-${pad2(blockCalMonth + 1)}-${pad2(day)}`
                        const b = blockedMap[iso]
                        const autoBlock = getAutoBlock(iso)
                        const isToday = iso === todayIso
                        const isPast = iso < todayIso
                        const isRangeStart = blockRangeStart === iso
                        const inRange = isInRange(iso)
                        const isSelected = !blockRangeMode && blockPickerDate === iso
                        const col = (firstDow + idx) % 7
                        const cellBg = isSelected || isRangeStart ? '#1e3a5f'
                          : inRange ? '#dbeafe'
                          : b ? `${blockColor(b.type)}22`
                          : autoBlock === 'wedding' ? '#d1fae5'
                          : autoBlock === 'unavailable' ? '#f3f4f6'
                          : '#fff'
                        return (
                          <button key={day} type="button"
                            disabled={isPast}
                            onClick={() => {
                              if (isPast) return
                              if (blockRangeMode) {
                                if (!blockRangeStart) {
                                  setBlockRangeStart(iso); setBlockPickerDate(null)
                                } else if (iso === blockRangeStart) {
                                  setBlockRangeStart(null); setBlockPickerDate(null)
                                } else {
                                  setBlockPickerDate(iso)
                                  const b2 = blockedMap[iso]
                                  if (b2) { setBlockType(b2.type); setBlockRanges(b2.ranges ?? (b2.from ? [{ from: b2.from, to: b2.to ?? '13:00' }] : [{ from: '09:00', to: '13:00' }])) }
                                  else { setBlockType('full'); setBlockRanges([{ from: '09:00', to: '13:00' }]) }
                                }
                              } else {
                                if (isSelected) { setBlockPickerDate(null); return }
                                setBlockPickerDate(iso)
                                if (b) { setBlockType(b.type); setBlockRanges(b.ranges ?? (b.from ? [{ from: b.from, to: b.to ?? '13:00' }] : [{ from: '09:00', to: '13:00' }])) }
                                else { setBlockType('full'); setBlockRanges([{ from: '09:00', to: '13:00' }]) }
                              }
                            }}
                            style={{
                              minHeight: 48, border: 'none',
                              borderRight: col !== 6 ? '1px solid var(--ivory)' : 'none',
                              borderBottom: '1px solid var(--ivory)',
                              background: isPast ? '#f9f8f7' : cellBg,
                              cursor: isPast ? 'default' : 'pointer',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, padding: '4px 2px',
                              opacity: isPast ? 0.4 : 1,
                              boxShadow: isToday ? 'inset 0 0 0 2px var(--gold)' : 'none',
                              transition: 'background .1s', position: 'relative',
                            }}
                          >
                            <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: (isSelected || isRangeStart) ? '#fff' : inRange ? '#1e3a5f' : isToday ? 'var(--gold)' : 'var(--charcoal)' }}>{day}</span>
                            {/* Manual block label */}
                            {b && !inRange && !isSelected && !isRangeStart && (
                              <span style={{ fontSize: 7, fontWeight: 700, color: blockColor(b.type), letterSpacing: '.04em', textTransform: 'uppercase', lineHeight: 1, textAlign: 'center' }}>
                                {b.type === 'hours' ? b.ranges?.map(r => r.from.slice(0,5)).join(' ') : blockTypeLabel(b.type).slice(0, 4)}
                              </span>
                            )}
                            {/* Auto-block indicator (no manual block on this day) */}
                            {!b && autoBlock && !inRange && !isSelected && !isRangeStart && (
                              <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', lineHeight: 1, color: autoBlock === 'wedding' ? '#047857' : '#6b7280' }}>
                                {autoBlock === 'wedding' ? 'Boda' : 'Ocup.'}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>}

                    {/* ── Week view ─────────────────────────────────────────── */}
                    {blockView === 'week' && (() => {
                      const PX_PER_HOUR = 50
                      const TIME_START = 8
                      const TIME_END = 21
                      const HOURS = Array.from({ length: TIME_END - TIME_START }, (_, i) => TIME_START + i)
                      const timeToY = (t: string) => {
                        const [h, m] = t.split(':').map(Number)
                        return ((h * 60 + m) - TIME_START * 60) / 60 * PX_PER_HOUR
                      }
                      // Build week dates
                      const weekDates: string[] = []
                      for (let i = 0; i < 7; i++) {
                        const d = new Date(blockWeekStart + 'T12:00:00'); d.setDate(d.getDate() + i)
                        weekDates.push(`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`)
                      }
                      const weekDayNames = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
                      const COL_W = 80
                      const TIME_COL_W = 36
                      const totalH = (TIME_END - TIME_START) * PX_PER_HOUR

                      const renderBlockRects = (iso: string) => {
                        const b = blockedMap[iso]
                        const auto = getAutoBlock(iso)
                        const rects: React.ReactNode[] = []

                        if (auto === 'wedding') rects.push(
                          <div key="auto-w" style={{ position:'absolute', inset: 0, background: '#d1fae588', borderRadius: 3, pointerEvents: 'none' }}>
                            <span style={{ fontSize: 8, fontWeight: 700, color: '#047857', padding: '2px 4px', display: 'block' }}>Boda</span>
                          </div>
                        )
                        else if (auto === 'unavailable') rects.push(
                          <div key="auto-u" style={{ position:'absolute', inset: 0, background: '#f3f4f688', borderRadius: 3, pointerEvents: 'none' }}>
                            <span style={{ fontSize: 8, fontWeight: 700, color: '#6b7280', padding: '2px 4px', display: 'block' }}>Ocup.</span>
                          </div>
                        )

                        if (!b) return rects

                        const addRect = (from: string, to: string, color: string, label: string) => {
                          const top = Math.max(0, timeToY(from))
                          const bot = Math.min(totalH, timeToY(to))
                          if (bot <= top) return
                          rects.push(
                            <div key={`${from}-${to}`} style={{
                              position: 'absolute', left: 2, right: 2, top, height: bot - top,
                              background: `${color}44`, border: `1.5px solid ${color}88`, borderRadius: 4,
                              overflow: 'hidden', fontSize: 8, fontWeight: 700, color, padding: '1px 3px', lineHeight: 1.3,
                            }}>{label}</div>
                          )
                        }

                        if (b.type === 'full') addRect('08:00', `${TIME_END}:00`, blockColor('full'), 'Bloqueado')
                        else if (b.type === 'morning') addRect('08:00', '13:00', blockColor('morning'), 'Mañana')
                        else if (b.type === 'afternoon') addRect('13:00', `${TIME_END}:00`, blockColor('afternoon'), 'Tarde')
                        else if (b.type === 'hours' && b.ranges?.length)
                          b.ranges.forEach(r => addRect(r.from, r.to, blockColor('hours'), `${r.from}–${r.to}`))

                        return rects
                      }

                      return (
                        <div style={{ overflowX: 'auto' }}>
                          <div style={{ minWidth: TIME_COL_W + COL_W * 7 }}>
                            {/* Day headers */}
                            <div style={{ display: 'flex', borderBottom: '1px solid var(--ivory)', background: '#faf8f5' }}>
                              <div style={{ width: TIME_COL_W, flexShrink: 0 }} />
                              {weekDates.map((iso, wi) => {
                                const d = new Date(iso + 'T12:00:00')
                                const isPast = iso < todayIso
                                const isToday = iso === todayIso
                                return (
                                  <div key={iso} style={{ width: COL_W, flexShrink: 0, textAlign: 'center', padding: '6px 4px', borderLeft: '1px solid var(--ivory)', opacity: isPast ? 0.45 : 1 }}>
                                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{weekDayNames[wi]}</div>
                                    <div style={{ fontSize: 14, fontWeight: isToday ? 700 : 500, color: isToday ? '#059669' : 'var(--charcoal)', width: 24, height: 24, borderRadius: '50%', background: isToday ? '#d1fae5' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px auto 0' }}>{d.getDate()}</div>
                                  </div>
                                )
                              })}
                            </div>
                            {/* Time grid */}
                            <div style={{ display: 'flex', position: 'relative', height: totalH }}>
                              {/* Hour labels */}
                              <div style={{ width: TIME_COL_W, flexShrink: 0, position: 'relative' }}>
                                {HOURS.map(h => (
                                  <div key={h} style={{ position: 'absolute', top: (h - TIME_START) * PX_PER_HOUR - 6, left: 0, right: 0, textAlign: 'right', paddingRight: 6, fontSize: 9, color: 'var(--warm-gray)', fontWeight: 500 }}>{h}:00</div>
                                ))}
                              </div>
                              {/* Day columns */}
                              {weekDates.map((iso, wi) => {
                                const isPast = iso < todayIso
                                const isToday = iso === todayIso
                                const isPickerOpen = blockPickerDate === iso
                                return (
                                  <div key={iso} style={{ width: COL_W, flexShrink: 0, borderLeft: '1px solid var(--ivory)', position: 'relative', opacity: isPast ? 0.4 : 1, cursor: isPast ? 'default' : 'pointer', background: isToday ? '#f9fffe' : '#fff' }}
                                    onClick={e => {
                                      if (isPast) return
                                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                      const y = e.clientY - rect.top
                                      const clickedMin = Math.floor((y / PX_PER_HOUR + TIME_START) * 60 / 30) * 30
                                      const fromH = Math.floor(clickedMin / 60), fromM = clickedMin % 60
                                      const toH = Math.floor((clickedMin + 60) / 60), toM = (clickedMin + 60) % 60
                                      const fmt = (h: number, m: number) => `${pad2(h)}:${pad2(m)}`
                                      setBlockPickerDate(isPickerOpen ? null : iso)
                                      const b = blockedMap[iso]
                                      if (b) { setBlockType(b.type); setBlockRanges(b.ranges ?? (b.from ? [{from: b.from, to: b.to??'13:00'}] : [{from:'09:00',to:'13:00'}])) }
                                      else { setBlockType('hours'); setBlockRanges([{ from: fmt(fromH, fromM), to: fmt(Math.min(toH, TIME_END), toM) }]) }
                                    }}>
                                    {/* Hour lines */}
                                    {HOURS.map(h => (
                                      <div key={h} style={{ position: 'absolute', top: (h - TIME_START) * PX_PER_HOUR, left: 0, right: 0, borderTop: '1px solid var(--ivory)', pointerEvents: 'none' }} />
                                    ))}
                                    {/* Schedule available background */}
                                    {visitAvail.schedule.filter(s => s.enabled && s.day === (new Date(iso+'T12:00:00').getDay() === 0 ? 6 : new Date(iso+'T12:00:00').getDay() - 1)).map(s => {
                                      const top = timeToY(s.from); const bot = timeToY(s.to)
                                      return <div key="avail" style={{ position: 'absolute', left: 0, right: 0, top: Math.max(0,top), height: Math.max(0, bot - top), background: '#f0fdf4', pointerEvents: 'none' }} />
                                    })}
                                    {/* Blocks */}
                                    {renderBlockRects(iso)}
                                    {/* Today indicator */}
                                    {isToday && <div style={{ position: 'absolute', left: 0, right: 0, top: Math.max(0, timeToY(`${pad2(new Date().getHours())}:${pad2(new Date().getMinutes())}`)), height: 2, background: '#059669', pointerEvents: 'none' }} />}
                                    {/* Selected column highlight */}
                                    {isPickerOpen && <div style={{ position: 'absolute', inset: 0, background: 'rgba(30,58,95,.06)', pointerEvents: 'none' }} />}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                  </div>

                  {/* Picker panel — always below the calendar, regardless of view height */}
                  {pickerLabel && blockPickerDate && (
                    <div style={{ marginTop: 10, border: '1px solid var(--ivory)', borderRadius: 10, padding: '14px 16px', background: '#f9f7f4' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ flex: 1 }}>{pickerLabel}</span>
                        {!blockRangeMode && blockPickerDate && blockedMap[blockPickerDate] && (
                          <button type="button" onClick={() => removeBlockedDate(blockPickerDate)}
                            style={{ fontSize: 10, fontWeight: 600, color: '#dc2626', background: '#fee2e2', border: 'none', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>
                            Quitar bloqueo
                          </button>
                        )}
                        <button type="button" onClick={() => { setBlockPickerDate(null); setBlockRangeStart(null); setBlockRangeEnd(null) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', display: 'flex', padding: 2 }}><X size={14} /></button>
                      </div>
                      {/* Block type pills */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        {(['full','morning','afternoon','hours'] as BlockedDate['type'][]).map(t => (
                          <button key={t} type="button" onClick={() => setBlockType(t)}
                            style={{ fontSize: 11, padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
                              background: blockType === t ? blockColor(t) : '#ede9e4',
                              color: blockType === t ? '#fff' : 'var(--charcoal)' }}>
                            {blockTypeLabel(t)}
                          </button>
                        ))}
                      </div>
                      {/* Multiple hour ranges */}
                      {blockType === 'hours' && (
                        <div style={{ marginBottom: 10 }}>
                          {blockRanges.map((r, ri) => (
                            <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <input type="time" className="form-input" value={r.from}
                                onChange={e => setBlockRanges(prev => prev.map((x, i) => i === ri ? { ...x, from: e.target.value } : x))}
                                style={{ fontSize: 12, width: 90 }} />
                              <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>—</span>
                              <input type="time" className="form-input" value={r.to}
                                onChange={e => setBlockRanges(prev => prev.map((x, i) => i === ri ? { ...x, to: e.target.value } : x))}
                                style={{ fontSize: 12, width: 90 }} />
                              {blockRanges.length > 1 && (
                                <button type="button" onClick={() => setBlockRanges(prev => prev.filter((_, i) => i !== ri))}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', display: 'flex', padding: 2 }}><X size={13} /></button>
                              )}
                            </div>
                          ))}
                          <button type="button" onClick={() => setBlockRanges(prev => [...prev, { from: '15:00', to: '18:00' }])}
                            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 7, border: '1px dashed #a78bfa', background: 'transparent', color: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Plus size={11} /> Añadir otro rango
                          </button>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button type="button" onClick={confirmBlock}
                          style={{ fontSize: 12, fontWeight: 700, padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Check size={13} /> Confirmar bloqueo{selectedDates.length > 1 ? ` (${selectedDates.length} días)` : ''}
                        </button>
                        <button type="button" onClick={() => { setBlockPickerDate(null); setBlockRangeStart(null); setBlockRangeEnd(null) }}
                          style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--ivory)', cursor: 'pointer', background: '#fff', color: 'var(--warm-gray)', fontWeight: 500 }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Legend */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                    {(['full','morning','afternoon','hours'] as BlockedDate['type'][]).map(t => (
                      <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: blockColor(t), flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{blockTypeLabel(t)}</span>
                      </div>
                    ))}
                    {(visitAvail.block_booked_weddings || visitAvail.block_calendar_unavailable) && (
                      <>
                        {visitAvail.block_booked_weddings && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#d1fae5', border: '1px solid #059669', flexShrink: 0 }} />
                            <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Boda reservada</span>
                          </div>
                        )}
                        {visitAvail.block_calendar_unavailable && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f3f4f6', border: '1px solid #d1d5db', flexShrink: 0 }} />
                            <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>No libre</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Save button */}
                  <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button type="button" onClick={() => saveVisitAvail(visitAvail)} disabled={savingVisit || !visitAvailDirty}
                      style={{ fontSize: 12, fontWeight: 700, padding: '7px 20px', borderRadius: 8, border: 'none', cursor: visitAvailDirty ? 'pointer' : 'default',
                        background: visitAvailDirty ? '#059669' : '#e5e7eb', color: visitAvailDirty ? '#fff' : '#9ca3af',
                        display: 'flex', alignItems: 'center', gap: 6, transition: 'background .15s' }}>
                      <Check size={13} /> {savingVisit ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                    {visitAvailDirty && !savingVisit && (
                      <span style={{ fontSize: 11, color: '#d97706' }}>Tienes cambios sin guardar</span>
                    )}
                  </div>
                </div>
                </div>
                )}
              </div>
            )
          })()}

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
          space_type:  '¿Cómo está organizado tu espacio?',
          price_model: '¿Cómo cobras el espacio?',
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

        const currentVal = wizardQuestion === 'space_type' ? wizardConfig.space_type : wizardConfig.price_model

        const handleAnswer = (val: any) => {
          const next: WizardConfig = wizardQuestion === 'space_type'
            ? { space_type: val }
            : { ...wizardConfig, price_model: val }
          setWizardConfig(next)

          if (wizardQuestion === 'space_type') {
            wizardNext('price_model')
          } else {
            if (isWizardDone(next)) saveCommercialConfig(next)
          }
        }

        const cards = cardOpts(wizardQuestion)
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

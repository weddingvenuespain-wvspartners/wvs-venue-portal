'use client'
// ProposalMenuEditor — UI para configurar los menús, extras y aperitivos
// de una propuesta concreta. Se integra en el tab "Menús" de ProposalEditor.

import { useRef, useState } from 'react'
import { ChevronDown, ChevronRight, X, GripVertical, Upload, FileText, Sparkles, Undo2, Wine, UtensilsCrossed, Moon, PartyPopper, Eye, EyeOff, Plus, Trash2, ImagePlus, LayoutGrid, List } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import DatePicker from '@/components/DatePicker'
import type { SectionsData, Menu, MenuCourse, MenuExtra, AppetizerGroup, MenuSeasonPrice } from '@/lib/proposal-types'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

const COCKTAIL_EXTRA_OPTIONS: Array<{ value: MenuExtra['category']; label: string }> = [
  { value: 'station', label: 'Estaciones / Buffets' },
]
const NIGHT_EXTRA_OPTIONS: Array<{ value: MenuExtra['category']; label: string }> = [
  { value: 'resopon',  label: 'Resopón' },
  { value: 'open_bar', label: 'Barra libre' },
]
const EVENT_EXTRA_OPTIONS: Array<{ value: MenuExtra['category']; label: string }> = [
  { value: 'ceremony',    label: 'Ceremonia' },
  { value: 'music',       label: 'Música' },
  { value: 'audiovisual', label: 'Audiovisual' },
  { value: 'other',       label: 'Otros' },
]

const MODE_OPTIONS: Array<{ value: NonNullable<MenuCourse['mode']>; label: string }> = [
  { value: 'fixed',    label: 'Fijo (sin elección)' },
  { value: 'pick_one', label: 'Escoger 1' },
  { value: 'pick_n',   label: 'Escoger N' },
]

// ─── Shared styles ─────────────────────────────────────────────────────────────

const addBtn: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 12, fontWeight: 500,
  color: 'var(--gold)', background: 'none', border: '1px dashed var(--gold)',
  borderRadius: 6, cursor: 'pointer', marginTop: 4,
}
const removeBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6, background: 'none',
  border: '1px solid var(--border)', color: 'var(--warm-gray)',
  cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const sectionBlock: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
  padding: 16, marginBottom: 16,
}
const sectionHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  marginBottom: 12, userSelect: 'none',
}
const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', letterSpacing: '-0.01em',
}
const hint: React.CSSProperties = {
  fontSize: 11, color: 'var(--warm-gray)', marginBottom: 12, lineHeight: 1.5,
}
const fieldLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)',
  letterSpacing: '.08em', textTransform: 'uppercase' as const,
  marginTop: 10, marginBottom: 5,
}
const subLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--charcoal)',
  letterSpacing: '.06em', textTransform: 'uppercase' as const, marginBottom: 8,
}

// Extra card with a left-border accent
const extraCard: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px',
  background: 'var(--cream)', borderRadius: 8,
  border: '1px solid var(--border)', borderLeft: '3px solid var(--gold)',
  marginBottom: 8,
}
const subBlock: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 10,
  overflow: 'hidden',
  marginBottom: 0,
  background: 'var(--cream)',
}
const subBlockHeader: React.CSSProperties = {
  padding: '10px 14px',
  background: 'var(--cream)',
  borderBottom: '1px solid var(--border)',
}
const subBlockTitle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const,
  letterSpacing: '.07em', color: 'var(--charcoal)',
}
const subBlockHint: React.CSSProperties = {
  fontSize: 11, color: 'var(--warm-gray)', marginTop: 3, lineHeight: 1.4,
}
const subBlockBody: React.CSSProperties = {
  padding: '12px 14px',
  background: '#fff',
}

export default function ProposalMenuEditor({
  sections,
  setSections,
  intro,
}: {
  sections: SectionsData
  setSections: React.Dispatch<React.SetStateAction<SectionsData>>
  intro?: string
}) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'cocktail' | 'menus' | 'night' | 'extras'>('menus')
  const [expandedMenus, setExpandedMenus] = useState<Set<number>>(new Set([0]))
  const toggleMenu = (i: number) => setExpandedMenus(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['cocktail', 'menus', 'night_extras', 'event_extras']))
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseMessage, setParseMessage] = useState<string | null>(null)
  const [undoSnapshot, setUndoSnapshot] = useState<{ prev: Menu[] | null; count: number } | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const menuPdfRefs = useRef<Record<number, HTMLInputElement | null>>({})

  // ─── PDF helpers ───────────────────────────────────────────────────────────

  const uploadPdf = async (file: File): Promise<string | null> => {
    if (!user) return null
    const supabase = createClient()
    const path = `${user.id}/menus/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const { error } = await supabase.storage.from('proposal-assets').upload(path, file, { upsert: true, contentType: 'application/pdf' })
    if (error) { setParseMessage(`Error al subir: ${error.message}`); return null }
    const { data } = supabase.storage.from('proposal-assets').getPublicUrl(path)
    return data.publicUrl
  }

  const handleImportPdf = async (file: File) => {
    setParseMessage(null)
    setUndoSnapshot(null)
    setParsing(true)
    try {
      const { parseMenuPdf } = await import('@/lib/pdf-menu-parser')
      const { menus: detected } = await parseMenuPdf(file)

      setUploadingPdf(true)
      const pdfUrl = await uploadPdf(file)
      setUploadingPdf(false)

      if (!detected.length) {
        setParseMessage('No se detectaron menús en el PDF. Puedes añadirlos manualmente.')
      } else {
        const enriched = detected.map(m => ({ ...m, pdf_url: pdfUrl ?? undefined }))
        const prev = sections.menus_override ?? null
        setSections(s => ({ ...s, menus_override: [...(s.menus_override ?? []), ...enriched] }))
        setUndoSnapshot({ prev, count: detected.length })
        setParseMessage(null)
      }
    } catch (err: any) {
      setParseMessage(`Error al leer el PDF: ${err?.message || 'desconocido'}`)
    } finally {
      setParsing(false)
    }
  }

  const handleUndoImport = () => {
    if (!undoSnapshot) return
    setSections(s => ({ ...s, menus_override: undoSnapshot.prev }))
    setUndoSnapshot(null)
    setParseMessage('Importación deshecha. Los menús anteriores se han restaurado.')
  }

  const handleAttachPdfToMenu = async (menuIdx: number, file: File) => {
    setUploadingPdf(true)
    const url = await uploadPdf(file)
    setUploadingPdf(false)
    if (url) updateMenu(menuIdx, { pdf_url: url })
  }

  const toggle = (k: string) => setOpenSections(s => {
    const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n
  })

  // ─── Menus helpers ─────────────────────────────────────────────────────────
  const menus: Menu[] = sections.menus_override ?? []
  const setMenus = (val: Menu[] | null) =>
    setSections(s => ({ ...s, menus_override: val }))

  const addMenu = () => setMenus([
    ...menus,
    { id: `m${Date.now()}`, name: '', price_per_person: '', courses: [] },
  ])
  const updateMenu = (i: number, patch: Partial<Menu>) =>
    setMenus(menus.map((m, idx) => idx === i ? { ...m, ...patch } : m))
  const removeMenu = (i: number) =>
    setMenus(menus.filter((_, idx) => idx !== i))

  const addCourse = (mi: number) =>
    updateMenu(mi, { courses: [...(menus[mi].courses ?? []), { label: '', mode: 'fixed', items: [] }] })
  const updateCourse = (mi: number, ci: number, patch: Partial<MenuCourse>) =>
    updateMenu(mi, { courses: (menus[mi].courses ?? []).map((c, idx) => idx === ci ? { ...c, ...patch } : c) })
  const removeCourse = (mi: number, ci: number) =>
    updateMenu(mi, { courses: (menus[mi].courses ?? []).filter((_, idx) => idx !== ci) })

  const addItem = (mi: number, ci: number) => {
    const courses = menus[mi].courses ?? []
    const newCourses = courses.map((c, idx) => idx === ci ? { ...c, items: [...c.items, { name: '' }] } : c)
    updateMenu(mi, { courses: newCourses })
  }
  const updateItem = (mi: number, ci: number, ii: number, patch: Partial<{ name: string; description: string; extra_price: string; image_url: string }>) => {
    const courses = menus[mi].courses ?? []
    const newCourses = courses.map((c, idx) => idx === ci
      ? { ...c, items: c.items.map((it, iii) => iii === ii ? { ...it, ...patch } : it) }
      : c)
    updateMenu(mi, { courses: newCourses })
  }
  const removeItem = (mi: number, ci: number, ii: number) => {
    const courses = menus[mi].courses ?? []
    const newCourses = courses.map((c, idx) => idx === ci
      ? { ...c, items: c.items.filter((_, iii) => iii !== ii) }
      : c)
    updateMenu(mi, { courses: newCourses })
  }

  const [uploadingItem, setUploadingItem] = useState<string | null>(null) // "mi-ci-ii"
  const uploadDishImage = async (mi: number, ci: number, ii: number, file: File) => {
    const key = `${mi}-${ci}-${ii}`
    setUploadingItem(key)
    try {
      const form = new FormData(); form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { console.error('Upload error:', data); return }
      updateItem(mi, ci, ii, { image_url: data.url })
    } catch (err) { console.error('Upload failed:', err) }
    finally { setUploadingItem(null) }
  }

  // Generic image upload — returns URL or null
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const uploadImage = async (key: string, file: File, onDone: (url: string) => void) => {
    setUploadingKey(key)
    try {
      const form = new FormData(); form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { console.error('Upload error:', data); return }
      onDone(data.url)
    } catch (err) { console.error('Upload failed:', err) }
    finally { setUploadingKey(null) }
  }

  // ─── Extras helpers ────────────────────────────────────────────────────────
  const extras: MenuExtra[] = sections.menu_extras_override ?? []
  const setExtras = (val: MenuExtra[] | null) =>
    setSections(s => ({ ...s, menu_extras_override: val }))
  const addExtra = (category: MenuExtra['category'] = 'station') => setExtras([
    ...extras,
    { id: `x${Date.now()}`, category, name: '', price: '', price_type: 'per_person' },
  ])
  const updateExtra = (i: number, patch: Partial<MenuExtra>) =>
    setExtras(extras.map((e, idx) => idx === i ? { ...e, ...patch } : e))
  const removeExtra = (i: number) =>
    setExtras(extras.filter((_, idx) => idx !== i))

  // ─── Appetizers helpers ────────────────────────────────────────────────────
  const appetizers: AppetizerGroup[] = sections.appetizers_base_override ?? []
  const setAppetizers = (val: AppetizerGroup[] | null) =>
    setSections(s => ({ ...s, appetizers_base_override: val }))
  const addGroup = () => setAppetizers([...appetizers, { label: '', items: [] }])
  const updateGroup = (i: number, patch: Partial<AppetizerGroup>) =>
    setAppetizers(appetizers.map((g, idx) => idx === i ? { ...g, ...patch } : g))
  const removeGroup = (i: number) =>
    setAppetizers(appetizers.filter((_, idx) => idx !== i))
  const setGroupItemsText = (i: number, text: string) => {
    const items = text.split('\n').map(l => l.trim()).filter(Boolean)
    updateGroup(i, { items })
  }

  // ─── Reusable extra card row ───────────────────────────────────────────────
  const renderExtraCard = (
    e: MenuExtra,
    i: number,
    categoryOptions: Array<{ value: MenuExtra['category']; label: string }>,
    showCategory = true,
  ) => (
    <div key={i} style={extraCard}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {showCategory && (
          <div style={{ width: 120, flexShrink: 0 }}>
            <Select value={e.category} onValueChange={(v) => updateExtra(i, { category: v as MenuExtra['category'] })}>
              <SelectTrigger style={{ fontSize: 12 }}><SelectValue /></SelectTrigger>
              <SelectContent>
                {categoryOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <input className="form-input" placeholder="Nombre" value={e.name}
          onChange={ev => updateExtra(i, { name: ev.target.value })} style={{ flex: 1, minWidth: 110, fontSize: 12 }} />
        <button type="button" style={removeBtn} onClick={() => removeExtra(i)}><X size={13} /></button>
      </div>
      <input className="form-input" placeholder="Descripción breve (opcional)" value={e.description ?? ''}
        onChange={ev => updateExtra(i, { description: ev.target.value })}
        style={{ fontSize: 12 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6 }}>
        <input className="form-input" placeholder="Precio (ej. 25€)" value={e.price}
          onChange={ev => updateExtra(i, { price: ev.target.value })} style={{ fontSize: 12 }} />
        <Select value={e.price_type} onValueChange={(v) => updateExtra(i, { price_type: v as MenuExtra['price_type'] })}>
          <SelectTrigger style={{ fontSize: 12 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="per_person">Por persona</SelectItem>
            <SelectItem value="flat">Precio total</SelectItem>
          </SelectContent>
        </Select>
        <input className="form-input" type="number" min={0} placeholder="Mín. pax (opc.)"
          value={e.min_guests ?? ''}
          onChange={ev => updateExtra(i, { min_guests: ev.target.value ? parseInt(ev.target.value) : undefined })}
          style={{ fontSize: 12 }}
          title="Mínimo de comensales para ofrecer este extra" />
      </div>
      {/* Photo upload */}
      {e.photo_url ? (
        <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', height: 72 }}>
          <img src={e.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: 2, padding: 4 }}>
            <label style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ImagePlus size={12} style={{ color: '#fff' }} />
              <input type="file" accept="image/*" hidden onChange={ev => {
                const f = ev.target.files?.[0]; if (f) uploadImage(`extra-${i}`, f, url => updateExtra(i, { photo_url: url })); ev.target.value = ''
              }} />
            </label>
            <button type="button" onClick={() => updateExtra(i, { photo_url: undefined })}
              style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(0,0,0,.55)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Trash2 size={11} style={{ color: '#fff' }} />
            </button>
          </div>
        </div>
      ) : (
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          height: 38, borderRadius: 6, cursor: 'pointer',
          border: '1.5px dashed var(--gold-light, #D4B896)', background: 'rgba(196,151,90,.04)',
        }}>
          {uploadingKey === `extra-${i}` ? (
            <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 500 }}>Subiendo...</span>
          ) : (
            <>
              <ImagePlus size={14} style={{ color: 'var(--gold)' }} />
              <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 500 }}>Añadir foto</span>
            </>
          )}
          <input type="file" accept="image/*" hidden onChange={ev => {
            const f = ev.target.files?.[0]; if (f) uploadImage(`extra-${i}`, f, url => updateExtra(i, { photo_url: url })); ev.target.value = ''
          }} />
        </label>
      )}
      {e.category === 'open_bar' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6, marginTop: 4 }}>
          <input className="form-input" type="number" min={0} placeholder="Horas incluidas (opc.)"
            value={e.hours_included ?? ''}
            onChange={ev => updateExtra(i, { hours_included: ev.target.value ? parseInt(ev.target.value) : undefined })}
            style={{ fontSize: 12 }}
            title="Horas de barra libre incluidas en el precio base" />
          <input className="form-input" placeholder="Precio hora extra (ej. 8€)"
            value={e.extra_hour_price ?? ''}
            onChange={ev => updateExtra(i, { extra_hour_price: ev.target.value || undefined })}
            style={{ fontSize: 12 }}
            title="Precio por persona por hora extra de barra libre" />
          <input className="form-input" placeholder="Gasto mín. (ej. 2000€)"
            value={e.min_spend ?? ''}
            onChange={ev => updateExtra(i, { min_spend: ev.target.value || undefined })}
            style={{ fontSize: 12 }}
            title="Gasto mínimo total para esta barra libre" />
        </div>
      )}
    </div>
  )

  const vis = sections.menu_sections_visible ?? {}
  const isVisible = (key: keyof typeof vis) => vis[key] !== false
  const toggleVis = (key: keyof typeof vis) =>
    setSections(s => ({ ...s, menu_sections_visible: { ...(s.menu_sections_visible ?? {}), [key]: !isVisible(key) } }))

  const VisToggle = ({ skey }: { skey: keyof typeof vis }) => (
    <button
      type="button"
      role="switch"
      aria-checked={isVisible(skey)}
      title={isVisible(skey) ? 'Ocultar en propuesta' : 'Mostrar en propuesta'}
      onClick={e => { e.stopPropagation(); toggleVis(skey) }}
      style={{
        width: 34, height: 19, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0,
        background: isVisible(skey) ? 'var(--gold)' : '#d1d5db',
        position: 'relative', transition: 'background .2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2,
        left: isVisible(skey) ? 17 : 2,
        width: 15, height: 15, borderRadius: 8, background: '#fff', transition: 'left .2s',
      }} />
    </button>
  )

  // Counts for tab badges
  const cocktailCount = appetizers.length + extras.filter(e => e.category === 'station').length
  const menusCount    = menus.length
  const nightCount    = extras.filter(e => e.category === 'resopon' || e.category === 'open_bar').length
  const eventCount    = extras.filter(e => ['ceremony','music','audiovisual','other'].includes(e.category)).length

  const TABS = [
    { key: 'cocktail' as const, label: 'Cóctel', icon: Wine,            count: cocktailCount, visKey: 'cocktail'     as const },
    { key: 'menus'    as const, label: 'Menús',  icon: UtensilsCrossed, count: menusCount,    visKey: 'menus'        as const },
    { key: 'night'    as const, label: 'Noche',  icon: Moon,            count: nightCount,    visKey: 'night'        as const },
    { key: 'extras'   as const, label: 'Extras', icon: PartyPopper,     count: eventCount,    visKey: 'event_extras' as const },
  ]

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--warm-gray)', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, lineHeight: 1.55 }}>
        {intro ?? <>Aquí configuráis los <strong>menús, extras y aperitivos</strong> que verán los invitados en el bloque interactivo al final de la propuesta. Lo que elijan se os enviará por email.</>}
      </div>

      {/* ── Top tab navigation (vertical stacked: icon on top, label + count below) ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16,
        background: '#fff', padding: 6, borderRadius: 12,
        border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {TABS.map(t => {
          const active = activeTab === t.key
          const visible = isVisible(t.visKey)
          const Icon = t.icon
          return (
            <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
              style={{
                minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 4px',
                background: active ? 'var(--gold)' : 'var(--cream)',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                color: active ? '#fff' : 'var(--charcoal)',
                transition: 'all .15s', position: 'relative',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F0EAE0' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'var(--cream)' }}>
              {/* Count badge top-right corner */}
              {t.count > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  fontSize: 9, fontWeight: 700, padding: '0 5px', borderRadius: 10, minWidth: 16, textAlign: 'center',
                  background: active ? 'rgba(255,255,255,0.28)' : '#fff',
                  color: active ? '#fff' : 'var(--warm-gray)',
                  lineHeight: '14px', border: active ? 'none' : '1px solid var(--border)',
                }}>{t.count}</span>
              )}
              <Icon size={16} style={{ flexShrink: 0, color: active ? '#fff' : 'var(--gold)' }} />
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{t.label}</span>
              {!visible && <EyeOff size={10} style={{ color: active ? 'rgba(255,255,255,0.7)' : 'var(--warm-gray)', flexShrink: 0, position: 'absolute', bottom: 3, right: 4 }} />}
            </button>
          )
        })}
      </div>

      {/* "Importar desde PDF" oculto temporalmente — el parser no acierta con todos los menús.
          Mantener el handler/refs para reactivarlo cuando mejore el parsing. */}

      {undoSnapshot && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, padding: '10px 12px', borderRadius: 8, marginBottom: 12, background: '#EEF2EC', border: '1px solid #C3D4C5', color: '#3C5945' }}>
          <span style={{ flex: 1 }}>
            ✓ Importados <strong>{undoSnapshot.count} menú{undoSnapshot.count > 1 ? 's' : ''}</strong>. Revisa y edita antes de guardar.
          </span>
          <button type="button" onClick={handleUndoImport}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #C3D4C5', color: '#3C5945', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            <Undo2 size={12} /> Deshacer
          </button>
          <button type="button" onClick={() => setUndoSnapshot(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3C5945', padding: 2, display: 'flex' }}>
            <X size={13} />
          </button>
        </div>
      )}

      {parseMessage && (
        <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 6, marginBottom: 12, background: parseMessage.startsWith('✓') ? '#EEF2EC' : '#F7F3E8', border: `1px solid ${parseMessage.startsWith('✓') ? '#C3D4C5' : '#C2A968'}`, color: parseMessage.startsWith('✓') ? '#3C5945' : '#7A5A2E' }}>
          {parseMessage}
        </div>
      )}

      {/* ─── CÓCTEL DE BIENVENIDA ───────────────────────────────────────────── */}
      {activeTab === 'cocktail' && (() => {
        const cocktailExtras = extras.filter(e => e.category === 'station')
        return (
          <div style={{ opacity: isVisible('cocktail') ? 1 : 0.55, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {/* Visibility banner */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: isVisible('cocktail') ? 'var(--cream)' : '#F5F0E8', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isVisible('cocktail') ? <Eye size={14} style={{ color: 'var(--gold)' }} /> : <EyeOff size={14} style={{ color: 'var(--warm-gray)' }} />}
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>
                  {isVisible('cocktail') ? 'Visible en la propuesta' : 'Oculto en la propuesta'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>· {appetizers.length} grupos aperitivos · {cocktailExtras.length} estaciones</span>
              </div>
              <VisToggle skey="cocktail" />
            </div>
            {true && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                {/* Sub-block: Aperitivos incluidos */}
                <div style={subBlock}>
                  <div style={subBlockHeader}>
                    <div style={subBlockTitle}>Aperitivos incluidos</div>
                    <div style={subBlockHint}>Los que acompañan siempre al menú (fríos, calientes, buffets…). Se muestran sin opción de elegir.</div>
                  </div>
                  <div style={subBlockBody}>
                    {appetizers.map((g, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', background: 'var(--cream)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 8 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input className="form-input" placeholder="Etiqueta (ej. Aperitivos fríos)" value={g.label}
                            onChange={e => updateGroup(i, { label: e.target.value })} style={{ flex: 1 }} />
                          <button type="button" style={removeBtn} onClick={() => removeGroup(i)}><X size={13} /></button>
                        </div>
                        <textarea className="form-textarea" style={{ minHeight: 80, fontFamily: 'inherit', fontSize: 12 }}
                          placeholder="Un item por línea&#10;Crema de melón · Crema de ceps&#10;Airbag con jamón ibérico"
                          value={g.items.join('\n')}
                          onChange={e => setGroupItemsText(i, e.target.value)} />
                        {/* Group photos — multiple */}
                        {(() => {
                          const photos = g.image_urls?.length ? g.image_urls : g.image_url ? [g.image_url] : []
                          const removePhoto = (pi: number) => {
                            const next = photos.filter((_, idx) => idx !== pi)
                            updateGroup(i, { image_urls: next, image_url: next[0] ?? undefined })
                          }
                          const addPhoto = (url: string) => {
                            const next = [...photos, url]
                            updateGroup(i, { image_urls: next, image_url: next[0] })
                          }
                          return (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {photos.map((url, pi) => (
                                <div key={pi} style={{ position: 'relative', width: 72, height: 72, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  <button type="button" onClick={() => removePhoto(pi)}
                                    style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: 4, background: 'rgba(0,0,0,.6)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                    <X size={10} style={{ color: '#fff' }} />
                                  </button>
                                </div>
                              ))}
                              <label style={{
                                width: photos.length ? 72 : '100%', height: photos.length ? 72 : 38,
                                borderRadius: 6, cursor: 'pointer', flexShrink: 0,
                                border: '1.5px dashed var(--gold-light, #D4B896)', background: 'rgba(196,151,90,.04)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              }}>
                                {uploadingKey === `app-${i}` ? (
                                  <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 500 }}>Subiendo...</span>
                                ) : (
                                  <>
                                    <ImagePlus size={photos.length ? 16 : 14} style={{ color: 'var(--gold)' }} />
                                    {!photos.length && <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 500 }}>Añadir fotos</span>}
                                  </>
                                )}
                                <input type="file" accept="image/*" hidden onChange={e => {
                                  const f = e.target.files?.[0]; if (f) uploadImage(`app-${i}`, f, addPhoto); e.target.value = ''
                                }} />
                              </label>
                            </div>
                          )
                        })()}
                      </div>
                    ))}
                    <button type="button" style={addBtn} onClick={addGroup}>+ Añadir grupo de aperitivos</button>
                  </div>
                </div>

                {/* Sub-block: Estaciones opcionales */}
                <div style={subBlock}>
                  <div style={subBlockHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={subBlockTitle}>Estaciones opcionales</div>
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 6, background: '#F7F3E8', color: '#7A5A2E', border: '1px solid #E2D4AE' }}>Opcional</span>
                    </div>
                    <div style={subBlockHint}>Añadidos que los invitados pueden contratar: ostras, foie, quesos, buffet de jamón…</div>
                  </div>
                  <div style={subBlockBody}>
                    {cocktailExtras.map(e => renderExtraCard(e, extras.indexOf(e), COCKTAIL_EXTRA_OPTIONS, false))}
                    <button type="button" style={addBtn} onClick={() => addExtra('station')}>+ Añadir estación</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ─── MENÚS PRINCIPALES ──────────────────────────────────────────────── */}
      {activeTab === 'menus' && (
      <div style={{ opacity: isVisible('menus') ? 1 : 0.55, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {/* Visibility banner */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: isVisible('menus') ? 'var(--cream)' : '#F5F0E8', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isVisible('menus') ? <Eye size={14} style={{ color: 'var(--gold)' }} /> : <EyeOff size={14} style={{ color: 'var(--warm-gray)' }} />}
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>{isVisible('menus') ? 'Visible en la propuesta' : 'Oculto en la propuesta'}</span>
            <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>· {menus.length} menú{menus.length !== 1 ? 's' : ''}</span>
          </div>
          <VisToggle skey="menus" />
        </div>

        {true && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
            {/* Config row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>Mostrar precios al cliente</div>
                <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>
                  Desactiva si el precio ya está en la propuesta y los menús son solo informativos
                </div>
              </div>
              <button
                type="button" role="switch" aria-checked={sections.show_menu_prices !== false}
                onClick={() => setSections(s => ({ ...s, show_menu_prices: s.show_menu_prices === false ? true : false }))}
                style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0, background: sections.show_menu_prices !== false ? 'var(--gold)' : 'var(--warm-gray)', position: 'relative', transition: 'background .2s' }}>
                <span style={{ position: 'absolute', top: 3, left: sections.show_menu_prices !== false ? 21 : 3, width: 16, height: 16, borderRadius: 8, background: '#fff', transition: 'left .2s' }} />
              </button>
            </div>

            {/* Supplements toggle — only visible when prices hidden */}
            {sections.show_menu_prices === false && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>Mostrar suplementos</div>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>
                    Muestra el precio extra por plato aunque los precios base estén ocultos
                  </div>
                </div>
                <button
                  type="button" role="switch" aria-checked={sections.show_menu_supplements !== false}
                  onClick={() => setSections(s => ({ ...s, show_menu_supplements: s.show_menu_supplements === false ? true : false }))}
                  style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0, background: sections.show_menu_supplements !== false ? 'var(--gold)' : 'var(--warm-gray)', position: 'relative', transition: 'background .2s' }}>
                  <span style={{ position: 'absolute', top: 3, left: sections.show_menu_supplements !== false ? 21 : 3, width: 16, height: 16, borderRadius: 8, background: '#fff', transition: 'left .2s' }} />
                </button>
              </div>
            )}

            {/* Display mode toggle — list vs gallery */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>Formato visual</div>
                <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>
                  Galería muestra tarjetas con fotos de los platos
                </div>
              </div>
              <div style={{ display: 'flex', gap: 2, background: 'var(--bg)', borderRadius: 6, padding: 2 }}>
                <button type="button"
                  onClick={() => setSections(s => ({ ...s, menu_display_mode: 'list' }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 5,
                    border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    background: (sections.menu_display_mode ?? 'list') === 'list' ? 'var(--gold)' : 'transparent',
                    color: (sections.menu_display_mode ?? 'list') === 'list' ? '#fff' : 'var(--warm-gray)',
                    transition: 'all .15s',
                  }}>
                  <List size={12} /> Lista
                </button>
                <button type="button"
                  onClick={() => setSections(s => ({ ...s, menu_display_mode: 'gallery' }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 5,
                    border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    background: sections.menu_display_mode === 'gallery' ? 'var(--gold)' : 'transparent',
                    color: sections.menu_display_mode === 'gallery' ? '#fff' : 'var(--warm-gray)',
                    transition: 'all .15s',
                  }}>
                  <LayoutGrid size={12} /> Galería
                </button>
              </div>
            </div>

            {/* Menu pick limit */}
            {menus.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>¿Cuántos menús puede elegir la pareja?</div>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>
                    El total de comensales se repartirá entre los menús seleccionados
                  </div>
                </div>
                <div style={{ width: 120 }}>
                  <Select
                    value={sections.menu_pick_limit != null ? String(sections.menu_pick_limit) : 'all'}
                    onValueChange={(v) => {
                      setSections(s => ({ ...s, menu_pick_limit: v === 'all' ? null : parseInt(v) }))
                    }}
                  >
                    <SelectTrigger style={{ fontSize: 12 }}><SelectValue placeholder="Sin límite" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Sin límite</SelectItem>
                      <SelectItem value="1">Solo 1</SelectItem>
                      {Array.from({ length: Math.min(menus.length, 5) - 1 }, (_, i) => i + 2).map(n => (
                        <SelectItem key={n} value={String(n)}>Hasta {n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div style={subBlock}>
              <div style={subBlockHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={subBlockTitle}>Menús ({menus.length})</div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: '#ffebee', color: '#b71c1c', border: '1px solid #ffcdd2' }}>Obligatorio</span>
                </div>
                <div style={subBlockHint}>Crea cada menú con sus platos. Para platos que la pareja debe elegir, usa <strong>"Escoger 1"</strong> o <strong>"Escoger N"</strong>.</div>
              </div>
              <div style={subBlockBody}>
                {menus.map((m, mi) => {
                  const expanded = expandedMenus.has(mi)
                  const courseCount = (m.courses ?? []).length
                  return (
                  <div key={mi} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
                    {/* Header — clickable to expand */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: expanded ? 'var(--cream)' : '#fff', borderBottom: expanded ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                      onClick={() => toggleMenu(mi)}>
                      <ChevronRight size={14} style={{ color: 'var(--warm-gray)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.name || <span style={{ color: 'var(--warm-gray)', fontStyle: 'italic', fontWeight: 400 }}>Sin nombre — pulsa para editar</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>
                          {m.price_per_person && <span>{m.price_per_person}</span>}
                          {m.price_per_person && courseCount > 0 && <span> · </span>}
                          {courseCount > 0 && <span>{courseCount} curso{courseCount !== 1 ? 's' : ''}</span>}
                          {!m.price_per_person && courseCount === 0 && <span>Vacío</span>}
                        </div>
                      </div>
                      <button type="button" onClick={e => { e.stopPropagation(); removeMenu(mi) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 5, borderRadius: 4, display: 'flex' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#FAF3F2'; e.currentTarget.style.color = '#BC5249' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--warm-gray)' }}
                        title="Eliminar menú"><Trash2 size={13} /></button>
                    </div>

                    {expanded && (
                    <div style={{ padding: '12px 14px', background: 'var(--cream)' }}>
                    {/* Nombre del menú */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                      <input className="form-input" placeholder="Nombre del menú (ej. Menú Bosque)"
                        value={m.name} onChange={e => updateMenu(mi, { name: e.target.value })}
                        style={{ flex: 1, fontWeight: 600 }} />
                    </div>

                    {/* PRECIOS */}
                    <div style={fieldLabel}>Precios</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <input className="form-input" placeholder="€/persona (ej. 85€ +IVA)"
                        value={m.price_per_person} onChange={e => updateMenu(mi, { price_per_person: e.target.value })}
                        style={{ fontSize: 12 }} />
                      <input className="form-input" placeholder="Gasto mínimo (ej. 10.000€)"
                        value={m.min_spend ?? ''} onChange={e => updateMenu(mi, { min_spend: e.target.value || undefined })}
                        style={{ fontSize: 12 }} />
                    </div>

                    {/* Precios por temporada */}
                    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginTop: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Precios por temporada</span>
                        <button type="button"
                          onClick={() => updateMenu(mi, { season_prices: [...(m.season_prices ?? []), { date_from: '', date_to: '', price_per_person: '', season: '' }] })}
                          style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                          + Añadir
                        </button>
                      </div>
                      {(m.season_prices ?? []).length === 0 && (
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Sin variaciones — se usa siempre el precio base</div>
                      )}
                      {(m.season_prices ?? []).map((sp, si) => {
                        const updateSp = (patch: Partial<MenuSeasonPrice>) => {
                          const s = [...(m.season_prices ?? [])]
                          s[si] = { ...s[si], ...patch }
                          updateMenu(mi, { season_prices: s })
                        }
                        const invalid = sp.date_from && sp.date_to && sp.date_from > sp.date_to
                        return (
                          <div key={si} style={{ background: 'var(--cream)', border: `1px solid ${invalid ? '#E0C2BD' : 'var(--border)'}`, borderRadius: 8, padding: '10px 10px 8px', marginBottom: 8 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                              <DatePicker label="Desde" value={sp.date_from} onChange={v => updateSp({ date_from: v })} allowPast />
                              <DatePicker label="Hasta" value={sp.date_to} onChange={v => updateSp({ date_to: v })} allowPast minDate={sp.date_from || undefined} />
                            </div>
                            {invalid && <div style={{ fontSize: 10, color: '#B0473E', marginBottom: 6 }}>La fecha de inicio debe ser anterior a la de fin</div>}
                            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 24px', gap: 8, alignItems: 'center' }}>
                              <input className="form-input" placeholder="Precio (ej. 95€)" value={sp.price_per_person}
                                onChange={e => updateSp({ price_per_person: e.target.value })} style={{ fontSize: 12 }} />
                              <input className="form-input" placeholder="Etiqueta (ej. Temporada alta)" value={sp.season ?? ''}
                                onChange={e => updateSp({ season: e.target.value })} style={{ fontSize: 12 }} />
                              <button type="button"
                                onClick={() => updateMenu(mi, { season_prices: (m.season_prices ?? []).filter((_, i) => i !== si) })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={13} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* CAPACIDAD */}
                    <div style={fieldLabel}>Capacidad</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <input className="form-input" type="number" min={0} placeholder="Mín. invitados (opc.)"
                        value={m.min_guests ?? ''} onChange={e => updateMenu(mi, { min_guests: e.target.value ? parseInt(e.target.value) : undefined })}
                        style={{ fontSize: 12 }} />
                      <input className="form-input" type="number" min={0} placeholder="Máx. invitados (opc.)"
                        value={(m as any).max_guests ?? ''} onChange={e => updateMenu(mi, { max_guests: e.target.value ? parseInt(e.target.value) : undefined } as any)}
                        style={{ fontSize: 12 }} />
                    </div>

                    {/* DESCRIPCIÓN */}
                    <div style={fieldLabel}>Descripción</div>
                    <input className="form-input" placeholder="Subtítulo / descripción corta (opcional)"
                      value={m.subtitle ?? ''} onChange={e => updateMenu(mi, { subtitle: e.target.value })}
                      style={{ marginBottom: 6, fontSize: 12 }} />
                    <textarea className="form-textarea"
                      style={{ minHeight: 60, fontFamily: 'inherit', fontSize: 12 }}
                      placeholder="Descripción del menú (se muestra si no hay platos estructurados)"
                      value={m.description ?? ''} onChange={e => updateMenu(mi, { description: e.target.value || undefined })} />

                    {/* PDF adjunto */}
                    <div style={{ marginTop: 6 }}>
                      {m.pdf_url ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 6 }}>
                          <FileText size={13} style={{ color: 'var(--gold)' }} />
                          <a href={m.pdf_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, color: 'var(--charcoal)', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            PDF adjunto
                          </a>
                          <button type="button" onClick={() => updateMenu(mi, { pdf_url: undefined })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 2 }}>
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <input ref={el => { menuPdfRefs.current[mi] = el }} type="file" accept="application/pdf"
                            style={{ display: 'none' }}
                            onChange={e => e.target.files?.[0] && handleAttachPdfToMenu(mi, e.target.files[0])} />
                          <button type="button" className="btn btn-ghost btn-sm"
                            onClick={() => menuPdfRefs.current[mi]?.click()}
                            disabled={uploadingPdf}>
                            <Upload size={11} /> Adjuntar PDF
                          </button>
                        </>
                      )}
                    </div>

                    {/* CURSOS / PLATOS */}
                    <div style={fieldLabel}>Cursos / Platos</div>
                    {(m.courses ?? []).map((c, ci) => (
                      <div key={ci} style={{ background: '#fff', borderRadius: 8, border: '1px solid var(--border)', padding: 10, marginBottom: 6 }}>
                        {/* Row 1: drag + name + remove */}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                          <GripVertical size={13} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                          <input className="form-input" placeholder="Ej. Primer plato" value={c.label}
                            onChange={e => updateCourse(mi, ci, { label: e.target.value })} style={{ flex: 1, minWidth: 0, fontSize: 12 }} />
                          <button type="button" style={removeBtn} onClick={() => removeCourse(mi, ci)}><X size={13} /></button>
                        </div>
                        {/* Row 2: mode + badge + pick_n */}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 140 }}>
                            <Select value={c.mode ?? 'fixed'} onValueChange={(v) => updateCourse(mi, ci, { mode: v as MenuCourse['mode'] })}>
                              <SelectTrigger style={{ fontSize: 12 }}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {MODE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          {(c.mode === 'pick_one' || c.mode === 'pick_n') && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: '#ffebee', color: '#b71c1c', border: '1px solid #ffcdd2', whiteSpace: 'nowrap', flexShrink: 0 }}>Obligatorio</span>
                          )}
                          {c.mode === 'fixed' && (
                            <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 6, background: '#EEF2EC', color: '#35513E', border: '1px solid #D2DFD3', whiteSpace: 'nowrap', flexShrink: 0 }}>Fijo</span>
                          )}
                          {c.mode === 'pick_n' && (
                            <input className="form-input" type="number" min={1} placeholder="N"
                              value={c.pick_count ?? 1} onChange={e => updateCourse(mi, ci, { pick_count: parseInt(e.target.value) || 1 })}
                              style={{ width: 56, flexShrink: 0, fontSize: 12 }} />
                          )}
                        </div>
                        {/* Items — each in own card with stacked rows */}
                        {c.items.map((it, ii) => {
                          const imgKey = `${mi}-${ci}-${ii}`
                          const isUploading = uploadingItem === imgKey
                          return (
                          <div key={ii} style={{ background: 'var(--cream)', borderRadius: 8, padding: '8px 10px', marginBottom: 6, marginLeft: 18, border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                              <input className="form-input" placeholder="Nombre del plato" value={it.name}
                                onChange={e => updateItem(mi, ci, ii, { name: e.target.value })} style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500 }} />
                              <button type="button" style={{ ...removeBtn, width: 24, height: 24 }} onClick={() => removeItem(mi, ci, ii)}>
                                <X size={11} />
                              </button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 6, marginBottom: 6 }}>
                              <input className="form-input" placeholder="Descripción (opc.)" value={it.description ?? ''}
                                onChange={e => updateItem(mi, ci, ii, { description: e.target.value })} style={{ fontSize: 11 }} />
                              <input className="form-input" placeholder="+precio" value={it.extra_price ?? ''}
                                onChange={e => updateItem(mi, ci, ii, { extra_price: e.target.value })}
                                style={{ fontSize: 11 }} />
                            </div>
                            {/* Dish image — prominent upload area */}
                            {it.image_url ? (
                              <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', height: 80 }}>
                                <img src={it.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: 2, padding: 4 }}>
                                  <label style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                    <ImagePlus size={12} style={{ color: '#fff' }} />
                                    <input type="file" accept="image/*" hidden onChange={e => {
                                      const f = e.target.files?.[0]; if (f) uploadDishImage(mi, ci, ii, f); e.target.value = ''
                                    }} />
                                  </label>
                                  <button type="button" onClick={() => updateItem(mi, ci, ii, { image_url: '' })}
                                    style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(0,0,0,.55)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                    <Trash2 size={11} style={{ color: '#fff' }} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <label style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                height: 44, borderRadius: 6, cursor: 'pointer',
                                border: '1.5px dashed var(--gold-light, #D4B896)', background: 'rgba(196,151,90,.04)',
                                transition: 'all .15s',
                              }}>
                                {isUploading ? (
                                  <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 500 }}>Subiendo foto...</span>
                                ) : (
                                  <>
                                    <ImagePlus size={16} style={{ color: 'var(--gold)' }} />
                                    <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 500 }}>Añadir foto del plato</span>
                                  </>
                                )}
                                <input type="file" accept="image/*" hidden onChange={e => {
                                  const f = e.target.files?.[0]; if (f) uploadDishImage(mi, ci, ii, f); e.target.value = ''
                                }} />
                              </label>
                            )}
                          </div>
                          )
                        })}
                        <button type="button"
                          onClick={() => addItem(mi, ci)}
                          style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 18, padding: '4px 0' }}>
                          + Añadir plato
                        </button>
                      </div>
                    ))}
                    <button type="button" style={addBtn} onClick={() => addCourse(mi)}>+ Añadir curso</button>
                    </div>
                    )}
                  </div>
                  )
                })}
                {menus.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--warm-gray)' }}>
                    <UtensilsCrossed size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
                    <div style={{ fontSize: 13, marginBottom: 12 }}>Sin menús todavía</div>
                  </div>
                )}
                <button type="button" style={addBtn} onClick={() => { addMenu(); setTimeout(() => setExpandedMenus(s => new Set([...s, menus.length])), 0) }}><Plus size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />Añadir menú</button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ─── NOCHE Y MADRUGADA ───────────────────────────────────────────────── */}
      {activeTab === 'night' && (() => {
        const nightExtras = extras.filter(e => e.category === 'resopon' || e.category === 'open_bar')
        return (
          <div style={{ opacity: isVisible('night') ? 1 : 0.55, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: isVisible('night') ? 'var(--cream)' : '#F5F0E8', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isVisible('night') ? <Eye size={14} style={{ color: 'var(--gold)' }} /> : <EyeOff size={14} style={{ color: 'var(--warm-gray)' }} />}
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>{isVisible('night') ? 'Visible en la propuesta' : 'Oculto en la propuesta'}</span>
                <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>· {nightExtras.length} opciones</span>
              </div>
              <VisToggle skey="night" />
            </div>
            {true && (
              <div style={{ paddingTop: 4 }}>
                <div style={subBlock}>
                  <div style={subBlockHeader}>
                    <div style={subBlockTitle}>Opciones de noche</div>
                    <div style={subBlockHint}>Resopón, barra libre… El campo <strong>Mín. pax</strong> bloquea la opción si hay pocos comensales.</div>
                  </div>
                  <div style={subBlockBody}>
                    {nightExtras.map(e => renderExtraCard(e, extras.indexOf(e), NIGHT_EXTRA_OPTIONS))}
                    <button type="button" style={addBtn} onClick={() => addExtra('resopon')}>+ Añadir opción de noche</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ─── EXTRAS DEL EVENTO ───────────────────────────────────────────────── */}
      {activeTab === 'extras' && (() => {
        const eventExtras = extras.filter(e => ['ceremony','music','audiovisual','other'].includes(e.category))
        return (
          <div style={{ opacity: isVisible('event_extras') ? 1 : 0.55, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: isVisible('event_extras') ? 'var(--cream)' : '#F5F0E8', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isVisible('event_extras') ? <Eye size={14} style={{ color: 'var(--gold)' }} /> : <EyeOff size={14} style={{ color: 'var(--warm-gray)' }} />}
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>{isVisible('event_extras') ? 'Visible en la propuesta' : 'Oculto en la propuesta'}</span>
                <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>· {eventExtras.length} extras</span>
              </div>
              <VisToggle skey="event_extras" />
            </div>
            {true && (
              <div style={{ paddingTop: 4 }}>
                <div style={subBlock}>
                  <div style={subBlockHeader}>
                    <div style={subBlockTitle}>Extras del evento</div>
                    <div style={subBlockHint}>Ceremonia, música, audiovisual… Se muestran en un bloque separado de la propuesta.</div>
                  </div>
                  <div style={subBlockBody}>
                    {eventExtras.map(e => renderExtraCard(e, extras.indexOf(e), EVENT_EXTRA_OPTIONS))}
                    <button type="button" style={addBtn} onClick={() => addExtra('ceremony')}>+ Añadir extra del evento</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

    </div>
  )
}

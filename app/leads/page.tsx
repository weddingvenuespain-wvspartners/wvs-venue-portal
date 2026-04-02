'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { usePlanFeatures } from '@/lib/use-plan-features'
import {
  Plus, Search, X, Phone, Mail, MessageCircle,
  Calendar, Users, ChevronRight, RotateCcw, CheckCircle,
  ExternalLink, Edit2, Trash2, Clock, Filter, FileText, Download
} from 'lucide-react'

// ── Types & config ─────────────────────────────────────────────────────────────
type DbStatus = 'new' | 'contacted' | 'proposal_sent' | 'visit_scheduled' | 'budget_sent' | 'won' | 'lost'
type Tab      = 'new' | 'in_progress' | 'visit' | 'confirmed' | 'lost'

const TAB_STATUSES: Record<Tab, DbStatus[]> = {
  new:         ['new'],
  in_progress: ['contacted', 'proposal_sent', 'budget_sent'],
  visit:       ['visit_scheduled'],
  confirmed:   ['won'],
  lost:        ['lost'],
}

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: 'new',         label: 'Nuevos',          emoji: '✨' },
  { key: 'in_progress', label: 'En seguimiento',  emoji: '💬' },
  { key: 'visit',       label: 'Visita agendada', emoji: '🏛️' },
  { key: 'confirmed',   label: 'Confirmados',     emoji: '🎉' },
  { key: 'lost',        label: 'Perdidos',        emoji: '❌' },
]

const SUB_STATUS_LABEL: Record<DbStatus, string> = {
  new: 'Nuevo', contacted: 'Contactado', proposal_sent: 'Propuesta enviada',
  visit_scheduled: 'Visita agendada', budget_sent: 'Presupuesto enviado',
  won: 'Confirmado', lost: 'Perdido',
}
const SOURCE_LABEL: Record<string, string> = {
  web: 'Web', whatsapp: 'WhatsApp', instagram: 'Instagram',
  email: 'Email', referral: 'Referido', manual: 'Manual', other: 'Otro',
}
const BUDGET_LABEL: Record<string, string> = {
  sin_definir: '—', menos_20k: '< 20k€', '20k_35k': '20–35k€',
  '35k_50k': '35–50k€', mas_50k: '> 50k€',
}
const CEREMONY_LABEL: Record<string, string> = {
  sin_definir: '—', civil: 'Civil', religiosa: 'Religiosa', simbolica: 'Simbólica',
}
const MONTHS     = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_SHORT = ['L','M','X','J','V','S','D']

const DATE_FLEX_OPTS = [
  { value: 'exact',        label: 'Fecha exacta'   },
  { value: 'range',        label: 'Rango'           },
  { value: 'multi_range',  label: 'Varios rangos'   },
  { value: 'month',        label: 'Mes'             },
  { value: 'season',       label: 'Estación'        },
  { value: 'flexible',     label: 'Flexible'        },
]
const SEASONS = [
  { value: 'spring', label: 'Primavera', emoji: '🌱' },
  { value: 'summer', label: 'Verano',    emoji: '☀️' },
  { value: 'autumn', label: 'Otoño',     emoji: '🍂' },
  { value: 'winter', label: 'Invierno',  emoji: '❄️' },
]
const YEAR_OPTS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + i)

function pad(n: number) { return String(n).padStart(2,'0') }
function toIso(y: number, m: number, d: number) { return `${y}-${pad(m+1)}-${pad(d)}` }
function todayIso() {
  const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`
}

// Format the lead date for display
function formatLeadDate(lead: any): { line1: string; line2?: string; color?: string } {
  const flex = lead.date_flexibility || 'exact'
  const fmtShort = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  const fmtNoYear = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '?'
  switch (flex) {
    case 'range':
      return { line1: `${fmtNoYear(lead.wedding_date)} – ${fmtShort(lead.wedding_date_to)}` }
    case 'multi_range': {
      const ranges: { from: string; to: string }[] = lead.wedding_date_ranges || []
      if (!ranges.length) return { line1: 'Varios rangos', color: 'var(--warm-gray)' }
      const first = ranges[0]
      const rest  = ranges.length > 1 ? ` +${ranges.length - 1} más` : ''
      return { line1: `${fmtNoYear(first.from)} – ${fmtNoYear(first.to)}${rest}` }
    }
    case 'month':
      return { line1: `${MONTHS[(lead.wedding_month || 1) - 1]} ${lead.wedding_year || ''}` }
    case 'season': {
      const s = SEASONS.find(x => x.value === lead.wedding_season)
      return { line1: `${s?.emoji || ''} ${s?.label || ''} ${lead.wedding_year || ''}` }
    }
    case 'flexible':
      return { line1: 'Fecha flexible', color: 'var(--warm-gray)' }
    default: // exact
      if (!lead.wedding_date) return { line1: 'Sin fecha', color: 'var(--stone)' }
      const days = Math.ceil((new Date(lead.wedding_date + 'T12:00:00').getTime() - Date.now()) / 86400000)
      const color = days < 0 ? 'var(--warm-gray)' : days < 60 ? '#dc2626' : days < 120 ? '#d97706' : '#16a34a'
      return { line1: fmtShort(lead.wedding_date), line2: days > 0 ? `${days < 60 ? '⚡ ' : ''}${days} días` : undefined, color }
  }
}

// Is this lead's date in the past?
function isLeadDatePast(lead: any): boolean {
  const today = todayIso()
  const flex  = lead.date_flexibility || 'exact'
  switch (flex) {
    case 'exact':
      return !!lead.wedding_date && lead.wedding_date < today
    case 'range':
      return !!(lead.wedding_date_to || lead.wedding_date) && (lead.wedding_date_to || lead.wedding_date) < today
    case 'multi_range': {
      const ranges: { from: string; to: string }[] = lead.wedding_date_ranges || []
      if (!ranges.length) return false
      // past only if ALL ranges are in the past
      return ranges.every(r => (r.to || r.from) < today)
    }
    case 'month':
      if (!lead.wedding_year || !lead.wedding_month) return false
      return `${lead.wedding_year}-${pad(lead.wedding_month)}-28` < today
    case 'season': {
      if (!lead.wedding_year || !lead.wedding_season) return false
      const ends: Record<string, string> = {
        spring: `${lead.wedding_year}-06-21`,
        summer: `${lead.wedding_year}-09-22`,
        autumn: `${lead.wedding_year}-12-21`,
        winter: `${lead.wedding_year + 1}-03-20`,
      }
      return (ends[lead.wedding_season] || '') < today
    }
    default: return false
  }
}

function urgencyColor(days: number | null) {
  if (days === null || days < 0) return 'var(--warm-gray)'
  if (days < 60) return '#dc2626'
  if (days < 120) return '#d97706'
  return '#16a34a'
}

const emptyForm = {
  name: '', email: '', phone: '', whatsapp: '',
  // flexible date fields
  date_flexibility: 'exact',
  wedding_date: '', wedding_date_to: '',
  wedding_date_ranges: [] as { from: string; to: string }[],
  wedding_year: String(new Date().getFullYear() + 1),
  wedding_month: '6',
  wedding_season: 'summer',
  // other
  visit_date: '', guests: '', source: 'web',
  notes: '', ceremony_type: 'sin_definir', budget: 'sin_definir',
  language: 'es', style: '',
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const router   = useRouter()
  const { user, loading: authLoading } = useAuth()
  const features = usePlanFeatures()

  const [leads,     setLeads]     = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('new')
  const [search,    setSearch]    = useState('')

  // Filters
  const [hidePast,    setHidePast]    = useState(true)
  const [filterSrc,   setFilterSrc]   = useState('all')
  const [filterBudget,setFilterBudget]= useState('all')
  const [showFilters, setShowFilters] = useState(false)

  // Modals
  const [showForm,   setShowForm]   = useState(false)
  const [editLead,   setEditLead]   = useState<any|null>(null)
  const [detailLead, setDetailLead] = useState<any|null>(null)
  const [form,       setForm]       = useState(emptyForm)
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    load()
  }, [user, authLoading])

  const load = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('leads').select('*')
      .eq('user_id', user!.id).order('created_at', { ascending: false })
    if (data) setLeads(data)
    setLoading(false)
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // Tab counts (ignoring filters so counts are always real)
  const tabCounts = useMemo(() => {
    const c: Record<string, number> = {}
    leads.forEach(l => {
      const t = (Object.entries(TAB_STATUSES) as [Tab, DbStatus[]][])
        .find(([, ss]) => ss.includes(l.status))?.[0]
      if (t) c[t] = (c[t] || 0) + 1
    })
    return c
  }, [leads])

  // Tabs visible based on plan (leads_new_only → only 'Nuevos' tab)
  const visibleTabs = features.leads_new_only
    ? TABS.filter(t => t.key === 'new')
    : TABS

  // Apply filters + search to current tab
  const visibleLeads = useMemo(() => {
    const statuses = features.leads_new_only
      ? (['new'] as DbStatus[])
      : TAB_STATUSES[activeTab]
    return leads.filter(l => {
      if (!statuses.includes(l.status)) return false
      if (features.leads_date_filter && hidePast && isLeadDatePast(l)) return false
      if (filterSrc !== 'all' && l.source !== filterSrc) return false
      if (filterBudget !== 'all' && l.budget !== filterBudget) return false
      if (search && !l.name?.toLowerCase().includes(search.toLowerCase()) &&
          !l.email?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [leads, activeTab, hidePast, filterSrc, filterBudget, search, features.leads_new_only, features.leads_date_filter])

  // CSV export
  const exportCSV = () => {
    const header = ['Nombre','Email','Teléfono','WhatsApp','Fecha boda','Invitados','Estado','Origen','Presupuesto','Notas']
    const rows = visibleLeads.map(l => [
      l.name, l.email, l.phone, l.whatsapp, l.wedding_date || '',
      l.guests || '', SUB_STATUS_LABEL[l.status as DbStatus] || l.status,
      SOURCE_LABEL[l.source] || l.source, BUDGET_LABEL[l.budget] || l.budget, l.notes || '',
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`))
    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['\uFEFF' + csv, ''], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'leads.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const moveToStatus = async (id: string, status: DbStatus) => {
    const supabase = createClient()
    await supabase.from('leads').update({ status }).eq('id', id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    const newTab = (Object.entries(TAB_STATUSES) as [Tab, DbStatus[]][])
      .find(([, ss]) => ss.includes(status))?.[0]
    if (newTab && newTab !== activeTab)
      showToast(`Lead movido a "${TABS.find(t => t.key === newTab)?.label}"`)
  }

  const deleteLead = async (id: string) => {
    if (!confirm('¿Eliminar este lead?')) return
    const supabase = createClient()
    await supabase.from('leads').delete().eq('id', id)
    setLeads(prev => prev.filter(l => l.id !== id))
    if (detailLead?.id === id) setDetailLead(null)
    showToast('Lead eliminado')
  }

  const openCreate = () => { setForm(emptyForm); setEditLead(null); setShowForm(true) }
  const openEdit   = (lead: any) => {
    setForm({
      name: lead.name || '', email: lead.email || '', phone: lead.phone || '',
      whatsapp: lead.whatsapp || '',
      date_flexibility: lead.date_flexibility || 'exact',
      wedding_date: lead.wedding_date || '', wedding_date_to: lead.wedding_date_to || '',
      wedding_date_ranges: lead.wedding_date_ranges || [],
      wedding_year: lead.wedding_year ? String(lead.wedding_year) : String(new Date().getFullYear() + 1),
      wedding_month: lead.wedding_month ? String(lead.wedding_month) : '6',
      wedding_season: lead.wedding_season || 'summer',
      visit_date: lead.visit_date || '', guests: lead.guests?.toString() || '',
      source: lead.source || 'web', notes: lead.notes || '',
      ceremony_type: lead.ceremony_type || 'sin_definir',
      budget: lead.budget || 'sin_definir', language: lead.language || 'es',
      style: lead.style || '',
    })
    setEditLead(lead); setDetailLead(null); setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { showToast('El nombre es obligatorio'); return }
    setSaving(true)
    const supabase = createClient()
    const payload  = {
      ...form,
      guests: form.guests ? parseInt(form.guests) : null,
      visit_date: form.visit_date || null,
      wedding_date: ['exact','range'].includes(form.date_flexibility) ? (form.wedding_date || null) : null,
      wedding_date_to: form.date_flexibility === 'range' ? (form.wedding_date_to || null) : null,
      wedding_date_ranges: form.date_flexibility === 'multi_range' ? form.wedding_date_ranges.filter(r => r.from) : null,
      wedding_year: ['month','season'].includes(form.date_flexibility) ? parseInt(form.wedding_year) : null,
      wedding_month: form.date_flexibility === 'month' ? parseInt(form.wedding_month) : null,
      wedding_season: form.date_flexibility === 'season' ? form.wedding_season : null,
    }
    if (editLead) {
      const { data, error } = await supabase.from('leads').update(payload).eq('id', editLead.id).select().single()
      if (error) { showToast(`Error: ${error.message}`); setSaving(false); return }
      if (data) setLeads(prev => prev.map(l => l.id === editLead.id ? data : l))
      showToast('Lead actualizado')
    } else {
      const { data, error } = await supabase.from('leads')
        .insert({ ...payload, user_id: user!.id, status: 'new' }).select().single()
      if (error) { showToast(`Error: ${error.message}`); setSaving(false); return }
      if (data) setLeads(prev => [data, ...prev])
      showToast('Nuevo lead creado')
    }
    setShowForm(false); setEditLead(null); setSaving(false)
  }

  const activeFiltersCount = [
    hidePast ? 0 : 1,
    filterSrc !== 'all' ? 1 : 0,
    filterBudget !== 'all' ? 1 : 0,
  ].reduce((a,b) => a+b, 0) + (hidePast ? 1 : 0)  // hidePast ON counts as 1 filter active

  if (loading) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--warm-gray)', fontSize: 13 }}>Cargando leads...</div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">

        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-title">Leads</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            { (
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                <input className="form-input" style={{ paddingLeft: 28, fontSize: 12, width: 220 }}
                  placeholder="Buscar por nombre o email…"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            )}
            {features.leads_export && (
              <button className="btn btn-ghost btn-sm" onClick={exportCSV} title="Exportar leads visibles a CSV">
                <Download size={13} /> Exportar CSV
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <Plus size={13} /> Nuevo lead
            </button>
          </div>
        </div>

        <div className="page-content">

          {/* Plan restriction notice */}
          {features.leads_new_only && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#1e40af' }}>
              <span>ℹ️</span>
              <span>Tu plan <strong>{features.planName}</strong> muestra únicamente los leads nuevos recibidos. <a href="/perfil" style={{ color: '#1e40af', fontWeight: 600 }}>Actualiza tu plan</a> para acceder a todo el CRM de leads.</span>
            </div>
          )}

          {/* Tabs + filters row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '1px solid var(--ivory)', marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {visibleTabs.map(tab => {
                const count   = tabCounts[tab.key] || 0
                const isActive = activeTab === tab.key
                return (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                    padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--espresso)' : 'var(--warm-gray)',
                    borderBottom: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                    marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}>
                    <span>{tab.emoji}</span>
                    <span>{tab.label}</span>
                    {count !== null && count > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, minWidth: 18, height: 18,
                        borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isActive ? 'var(--gold)' : 'var(--ivory)',
                        color: isActive ? '#fff' : 'var(--warm-gray)', padding: '0 5px',
                      }}>{count}</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Filter toggle button (only on non-calendar tabs) */}
            { (
              <button onClick={() => setShowFilters(f => !f)} style={{
                marginBottom: 4, fontSize: 12, padding: '5px 12px', borderRadius: 6,
                cursor: 'pointer', border: '1px solid var(--ivory)', background: showFilters ? 'var(--cream)' : 'transparent',
                color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Filter size={12} />
                Filtros
                {activeFiltersCount > 0 && (
                  <span style={{ background: 'var(--gold)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 8, padding: '1px 5px' }}>
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Filters panel */}
          {showFilters &&  (
            <div style={{ background: 'var(--cream)', border: '1px solid var(--ivory)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Hide past — only visible if plan allows date filtering */}
              {features.leads_date_filter && (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <div onClick={() => setHidePast(p => !p)} style={{
                      width: 36, height: 20, borderRadius: 10, background: hidePast ? 'var(--gold)' : '#d1d5db',
                      position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                    }}>
                      <div style={{
                        position: 'absolute', top: 2, left: hidePast ? 18 : 2, width: 16, height: 16,
                        borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </div>
                    <span style={{ color: 'var(--charcoal)', fontWeight: 500 }}>Ocultar fechas pasadas</span>
                  </label>
                  <div style={{ width: 1, height: 24, background: 'var(--ivory)' }} />
                </>
              )}

              {/* Source filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--warm-gray)', fontWeight: 500 }}>Fuente:</span>
                <select className="form-input" style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}
                  value={filterSrc} onChange={e => setFilterSrc(e.target.value)}>
                  <option value="all">Todas</option>
                  {Object.entries(SOURCE_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {/* Budget filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--warm-gray)', fontWeight: 500 }}>Presupuesto:</span>
                <select className="form-input" style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}
                  value={filterBudget} onChange={e => setFilterBudget(e.target.value)}>
                  <option value="all">Todos</option>
                  {Object.entries(BUDGET_LABEL).filter(([v]) => v !== 'sin_definir').map(([v,l]) =>
                    <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {/* Reset */}
              {(filterSrc !== 'all' || filterBudget !== 'all') && (
                <button onClick={() => { setFilterSrc('all'); setFilterBudget('all') }}
                  style={{ fontSize: 11, color: 'var(--warm-gray)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Limpiar filtros
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div style={{ marginTop: showFilters ? 0 : 16 }}>
            {visibleLeads.length === 0 ? (
              <EmptyState tab={activeTab} search={search} hidePast={hidePast}
                onClear={() => { setSearch(''); setHidePast(false) }} onNew={openCreate} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visibleLeads.map(lead => (
                  <LeadRow key={lead.id} lead={lead} tab={activeTab}
                    onMove={moveToStatus} onEdit={openEdit}
                    onDelete={deleteLead} onDetail={setDetailLead} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--espresso)', color: '#fff', padding: '10px 20px',
          borderRadius: 8, fontSize: 13, zIndex: 2000, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          pointerEvents: 'none',
        }}>{toast}</div>
      )}

      {detailLead && (
        <DetailDrawer lead={detailLead}
          tab={(Object.entries(TAB_STATUSES) as [Tab, DbStatus[]][]).find(([,ss]) => ss.includes(detailLead.status))?.[0] || 'new'}
          onClose={() => setDetailLead(null)}
          onEdit={openEdit} onDelete={deleteLead} onMove={moveToStatus} />
      )}

      {showForm && (
        <LeadFormModal form={form} setForm={setForm} isEdit={!!editLead}
          saving={saving} onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditLead(null) }} />
      )}
    </div>
  )
}

// ── Lead Row ───────────────────────────────────────────────────────────────────
function LeadRow({ lead, tab, onMove, onEdit, onDelete, onDetail }: {
  lead: any; tab: Tab
  onMove: (id: string, s: DbStatus) => void
  onEdit: (l: any) => void
  onDelete: (id: string) => void
  onDetail: (l: any) => void
}) {

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* Urgency stripe */}
        {(() => {
          const days = lead.date_flexibility === 'exact' || !lead.date_flexibility ? (lead.wedding_date ? Math.ceil((new Date(lead.wedding_date + 'T12:00:00').getTime() - Date.now()) / 86400000) : null) : null
          const color = days !== null && days > 0 ? urgencyColor(days) : 'var(--ivory)'
          return <div style={{ width: 4, background: color, flexShrink: 0 }} />
        })()}

        {/* Main content */}
        <div style={{ flex: 1, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', minWidth: 0 }}
          onClick={() => onDetail(lead)}>

          <div style={{ minWidth: 170, maxWidth: 200 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)', marginBottom: 3 }}>{lead.name}</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {lead.source && (
                <span style={{ fontSize: 10, background: 'var(--ivory)', color: 'var(--warm-gray)', padding: '1px 7px', borderRadius: 10 }}>
                  {SOURCE_LABEL[lead.source] || lead.source}
                </span>
              )}
              {tab === 'in_progress' && (
                <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 7px', borderRadius: 10, fontWeight: 500 }}>
                  {SUB_STATUS_LABEL[lead.status as DbStatus]}
                </span>
              )}
            </div>
          </div>

          <div style={{ minWidth: 130 }}>
            {(() => {
              const { line1, line2, color } = formatLeadDate(lead)
              return (
                <>
                  <div style={{ fontSize: 12, color: color || 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Calendar size={11} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                    {line1}
                  </div>
                  {line2 && <div style={{ fontSize: 11, color: color || 'var(--warm-gray)', fontWeight: 600, marginTop: 2 }}>{line2}</div>}
                </>
              )
            })()}
            {tab === 'visit' && lead.visit_date && (
              <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                🏛️ {new Date(lead.visit_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </div>
            )}
          </div>

          <div style={{ minWidth: 90 }}>
            {lead.guests && (
              <div style={{ fontSize: 12, color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Users size={11} style={{ color: 'var(--warm-gray)' }} /> {lead.guests} inv.
              </div>
            )}
            {lead.budget && lead.budget !== 'sin_definir' && (
              <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{BUDGET_LABEL[lead.budget]}</div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {lead.email && (
              <div style={{ fontSize: 12, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Mail size={11} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} /> {lead.email}
              </div>
            )}
            {lead.phone && (
              <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Phone size={10} style={{ flexShrink: 0 }} /> {lead.phone}
              </div>
            )}
          </div>

          {lead.notes && (
            <div style={{ maxWidth: 150, fontSize: 11, color: 'var(--warm-gray)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              "{lead.notes.slice(0,50)}{lead.notes.length > 50 ? '…' : ''}"
            </div>
          )}

          <ChevronRight size={14} style={{ color: 'var(--stone)', flexShrink: 0 }} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', borderLeft: '1px solid var(--ivory)', flexShrink: 0 }}>
          <QuickActions lead={lead} tab={tab} onMove={onMove} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>
    </div>
  )
}

// ── Quick Actions ──────────────────────────────────────────────────────────────
function QuickActions({ lead, tab, onMove, onEdit, onDelete }: {
  lead: any; tab: Tab
  onMove: (id: string, s: DbStatus) => void
  onEdit: (l: any) => void
  onDelete: (id: string) => void
}) {
  const p: React.CSSProperties = { fontSize: 11, padding: '5px 11px', borderRadius: 6, cursor: 'pointer', border: 'none', fontWeight: 600, background: 'var(--gold)', color: '#fff', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }
  const g: React.CSSProperties = { fontSize: 11, padding: '5px 9px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--warm-gray)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }
  const d: React.CSSProperties = { fontSize: 11, padding: '5px 9px', borderRadius: 6, cursor: 'pointer', border: '1px solid #fca5a5', background: 'transparent', color: '#dc2626', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }

  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {tab === 'new' && (<>
        <a href={`/propuestas?lead_id=${lead.id}&create=1`} style={{ ...p, textDecoration: 'none' }}><FileText size={11} /> Crear propuesta</a>
        <button style={g} onClick={() => onMove(lead.id, 'contacted')}><ChevronRight size={11} /> En seguimiento</button>
        <button style={g} onClick={() => onEdit(lead)}><Edit2 size={11} /></button>
        <button style={d} onClick={() => onMove(lead.id, 'lost')}>Perdido</button>
      </>)}

      {tab === 'in_progress' && (<>
        <a href={`/propuestas?lead_id=${lead.id}&create=1`} style={{ ...g, textDecoration: 'none' }}><FileText size={11} /> Propuesta</a>
        <button style={p} onClick={() => onMove(lead.id, 'visit_scheduled')}><Calendar size={11} /> Agendar visita</button>
        <button style={{ ...p, background: '#16a34a' }} onClick={() => onMove(lead.id, 'won')}>🎉 Confirmar boda</button>
        {lead.status !== 'budget_sent' && <button style={g} onClick={() => onMove(lead.id, 'budget_sent')}>Presupuesto enviado</button>}
        <button style={g} onClick={() => onMove(lead.id, 'new')}><RotateCcw size={11} /> Nuevo</button>
        <button style={g} onClick={() => onEdit(lead)}><Edit2 size={11} /></button>
        <button style={d} onClick={() => onMove(lead.id, 'lost')}>Perdido</button>
      </>)}

      {tab === 'visit' && (<>
        <button style={p} onClick={() => onMove(lead.id, 'won')}>🎉 Confirmar boda</button>
        <button style={g} onClick={() => onMove(lead.id, 'budget_sent')}>Enviar presupuesto</button>
        <button style={g} onClick={() => onMove(lead.id, 'contacted')}><RotateCcw size={11} /> En seguimiento</button>
        <button style={g} onClick={() => onEdit(lead)}><Edit2 size={11} /></button>
        <button style={d} onClick={() => onMove(lead.id, 'lost')}>Perdido</button>
      </>)}

      {tab === 'confirmed' && (<>
        <a href="/propuestas" style={{ ...g, textDecoration: 'none' }}><ExternalLink size={11} /> Propuesta</a>
        <button style={g} onClick={() => onEdit(lead)}><Edit2 size={11} /></button>
        <button style={d} onClick={() => onDelete(lead.id)}><Trash2 size={11} /></button>
      </>)}

      {tab === 'lost' && (<>
        <button style={g} onClick={() => onMove(lead.id, 'contacted')}><RotateCcw size={11} /> Reactivar</button>
        <button style={g} onClick={() => onEdit(lead)}><Edit2 size={11} /></button>
        <button style={d} onClick={() => onDelete(lead.id)}><Trash2 size={11} /></button>
      </>)}
    </div>
  )
}


// ── Detail Drawer ──────────────────────────────────────────────────────────────
function DetailDrawer({ lead, tab, onClose, onEdit, onDelete, onMove }: {
  lead: any; tab: Tab
  onClose: () => void; onEdit: (l: any) => void
  onDelete: (id: string) => void; onMove: (id: string, s: DbStatus) => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }} onClick={onClose}>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 420, background: '#fff', boxShadow: '-8px 0 40px rgba(0,0,0,0.12)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: 'var(--espresso)' }}>{lead.name}</div>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 4 }}>
              {SUB_STATUS_LABEL[lead.status as DbStatus]} · {SOURCE_LABEL[lead.source] || lead.source}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onEdit(lead)} style={{ background: 'none', border: '1px solid var(--ivory)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--charcoal)' }}>
              <Edit2 size={12} /> Editar
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}><X size={18} /></button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '20px 24px' }}>
          {(() => {
            const { line1, line2, color } = formatLeadDate(lead)
            return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            <InfoBlock icon={<Calendar size={13} />} label="Fecha de boda"
              value={line1} sub={line2} subColor={color} />
            {lead.visit_date && (
              <InfoBlock icon={<span style={{ fontSize: 13 }}>🏛️</span>} label="Fecha de visita"
                value={new Date(lead.visit_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} />
            )}
            <InfoBlock icon={<Users size={13} />} label="Invitados" value={lead.guests ? `${lead.guests} personas` : '—'} />
            <InfoBlock icon={null} label="Presupuesto" value={BUDGET_LABEL[lead.budget] || '—'} />
            <InfoBlock icon={null} label="Ceremonia" value={CEREMONY_LABEL[lead.ceremony_type] || '—'} />
            {lead.style && <InfoBlock icon={null} label="Estilo" value={lead.style} />}
          </div>
            )
          })()}

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Contacto</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lead.email && (
                <a href={`mailto:${lead.email}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--charcoal)', textDecoration: 'none', padding: '8px 12px', background: 'var(--cream)', borderRadius: 8 }}>
                  <Mail size={14} style={{ color: 'var(--warm-gray)' }} /> {lead.email}
                </a>
              )}
              {lead.phone && (
                <a href={`tel:${lead.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--charcoal)', textDecoration: 'none', padding: '8px 12px', background: 'var(--cream)', borderRadius: 8 }}>
                  <Phone size={14} style={{ color: 'var(--warm-gray)' }} /> {lead.phone}
                </a>
              )}
              {lead.whatsapp && (
                <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#16a34a', textDecoration: 'none', padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac' }}>
                  <MessageCircle size={14} /> WhatsApp: {lead.whatsapp}
                </a>
              )}
            </div>
          </div>

          {lead.notes && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Notas</div>
              <div style={{ fontSize: 13, color: 'var(--charcoal)', background: 'var(--cream)', padding: '12px 14px', borderRadius: 8, lineHeight: 1.6, borderLeft: '3px solid var(--gold)' }}>
                {lead.notes}
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, color: 'var(--stone)' }}>
            <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
            Creado el {new Date(lead.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--ivory)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Mover a</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(Object.entries(TAB_STATUSES) as [Tab, DbStatus[]][]).map(([tabKey, statuses]) => {
              if (tabKey === tab) return null
              const tabInfo = TABS.find(t => t.key === tabKey)
              return (
                <button key={tabKey} onClick={() => { onMove(lead.id, statuses[0]); onClose() }}
                  style={{ fontSize: 12, padding: '5px 11px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {tabInfo?.emoji} {tabInfo?.label}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={`/propuestas?lead_id=${lead.id}&create=1`}
              style={{ flex: 1, fontSize: 12, padding: '8px', borderRadius: 6, border: '1px solid var(--gold)', color: 'var(--gold)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 500 }}>
              <FileText size={12} /> Crear propuesta
            </a>
            <button onClick={() => onDelete(lead.id)}
              style={{ fontSize: 12, padding: '8px 12px', borderRadius: 6, cursor: 'pointer', border: '1px solid #fca5a5', background: 'transparent', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Trash2 size={12} /> Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Info Block ─────────────────────────────────────────────────────────────────
function InfoBlock({ icon, label, value, sub, subColor }: { icon: React.ReactNode; label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--espresso)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: subColor || 'var(--warm-gray)', fontWeight: 600, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Empty State ────────────────────────────────────────────────────────────────
function EmptyState({ tab, search, hidePast, onClear, onNew }: {
  tab: Tab; search: string; hidePast: boolean; onClear: () => void; onNew: () => void
}) {
  const msgs: Partial<Record<Tab, { title: string; sub: string }>> = {
    new:         { title: 'Sin leads nuevos',          sub: 'Los nuevos contactos aparecerán aquí.' },
    in_progress: { title: 'Nada en seguimiento',       sub: 'Marca un lead como contactado para verlo aquí.' },
    visit:       { title: 'Sin visitas agendadas',     sub: 'Cuando agendes una visita, aparecerá aquí.' },
    confirmed:   { title: 'Sin bodas confirmadas aún', sub: '¡A cerrar esa primera boda!' },
    lost:        { title: 'Sin leads perdidos',        sub: '¡Todo el mundo sigue activo!' },
  }
  const { title, sub } = msgs[tab] || { title: '', sub: '' }
  const isFiltered = search || hidePast
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--warm-gray)' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{TABS.find(t => t.key === tab)?.emoji}</div>
      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 6 }}>
        {isFiltered ? 'Sin resultados con los filtros actuales' : title}
      </div>
      <div style={{ fontSize: 13, marginBottom: 20 }}>{isFiltered ? '' : sub}</div>
      {isFiltered
        ? <button className="btn btn-ghost btn-sm" onClick={onClear}>Limpiar filtros</button>
        : tab === 'new' && <button className="btn btn-primary btn-sm" onClick={onNew}><Plus size={13} /> Crear primer lead</button>
      }
    </div>
  )
}

// ── Form Modal ─────────────────────────────────────────────────────────────────
function LeadFormModal({ form, setForm, isEdit, saving, onSubmit, onClose }: {
  form: any; setForm: (f: any) => void; isEdit: boolean
  saving: boolean; onSubmit: () => void; onClose: () => void
}) {
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600, width: '100%' }} onClick={e => e.stopPropagation()}>

        {/* Header — sticky */}
        <div className="modal-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="modal-title">{isEdit ? 'Editar lead' : 'Nuevo lead'}</div>
              <div className="modal-sub">{isEdit ? 'Actualiza los datos del lead' : 'Añade una pareja interesada'}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}><X size={18} /></button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="modal-body">

          {/* Section: La pareja */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>La pareja</div>

            <div className="form-group">
              <label className="form-label">Nombre de la pareja *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Laura & Carlos" />
            </div>

            {/* ── Flexible date ── */}
            <div className="form-group">
              <label className="form-label">Fecha de boda</label>
              {/* Type selector */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                {DATE_FLEX_OPTS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => set('date_flexibility', opt.value)} style={{
                    padding: '4px 11px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid',
                    borderColor: form.date_flexibility === opt.value ? 'var(--gold)' : 'var(--ivory)',
                    background:  form.date_flexibility === opt.value ? 'var(--gold)' : 'transparent',
                    color:       form.date_flexibility === opt.value ? '#fff' : 'var(--warm-gray)',
                    fontWeight:  form.date_flexibility === opt.value ? 600 : 400,
                    transition: 'all 0.15s',
                  }}>{opt.label}</button>
                ))}
              </div>

              {form.date_flexibility === 'exact' && (
                <input className="form-input" type="date" value={form.wedding_date}
                  onChange={e => set('wedding_date', e.target.value)} />
              )}

              {form.date_flexibility === 'range' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="form-input" type="date" value={form.wedding_date}
                    onChange={e => set('wedding_date', e.target.value)} />
                  <span style={{ color: 'var(--warm-gray)', fontSize: 13, whiteSpace: 'nowrap' }}>hasta</span>
                  <input className="form-input" type="date" value={form.wedding_date_to}
                    onChange={e => set('wedding_date_to', e.target.value)} />
                </div>
              )}

              {form.date_flexibility === 'multi_range' && (
                <div>
                  {(form.wedding_date_ranges as { from: string; to: string }[]).map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--warm-gray)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
                      <input className="form-input" type="date" value={r.from}
                        onChange={e => { const ranges = [...form.wedding_date_ranges]; ranges[i] = { ...r, from: e.target.value }; set('wedding_date_ranges', ranges) }} />
                      <span style={{ color: 'var(--warm-gray)', fontSize: 13, whiteSpace: 'nowrap' }}>hasta</span>
                      <input className="form-input" type="date" value={r.to}
                        onChange={e => { const ranges = [...form.wedding_date_ranges]; ranges[i] = { ...r, to: e.target.value }; set('wedding_date_ranges', ranges) }} />
                      <button type="button" onClick={() => set('wedding_date_ranges', (form.wedding_date_ranges as { from: string; to: string }[]).filter((_: { from: string; to: string }, j: number) => j !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                  <button type="button"
                    onClick={() => set('wedding_date_ranges', [...form.wedding_date_ranges, { from: '', to: '' }])}
                    style={{ fontSize: 12, color: 'var(--gold)', background: 'none', border: '1px dashed var(--gold)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', marginTop: 2 }}>
                    + Añadir rango
                  </button>
                </div>
              )}

              {form.date_flexibility === 'month' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="form-input" value={form.wedding_month} onChange={e => set('wedding_month', e.target.value)}>
                    {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                  <select className="form-input" style={{ width: 110 }} value={form.wedding_year} onChange={e => set('wedding_year', e.target.value)}>
                    {YEAR_OPTS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}

              {form.date_flexibility === 'season' && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {SEASONS.map(s => (
                    <button key={s.value} type="button" onClick={() => set('wedding_season', s.value)} style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid',
                      borderColor: form.wedding_season === s.value ? 'var(--gold)' : 'var(--ivory)',
                      background:  form.wedding_season === s.value ? '#fef9ec' : 'transparent',
                      color:       form.wedding_season === s.value ? '#92400e' : 'var(--warm-gray)',
                      fontWeight:  form.wedding_season === s.value ? 600 : 400,
                    }}>{s.emoji} {s.label}</button>
                  ))}
                  <select className="form-input" style={{ width: 110 }} value={form.wedding_year} onChange={e => set('wedding_year', e.target.value)}>
                    {YEAR_OPTS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}

              {form.date_flexibility === 'flexible' && (
                <div style={{ padding: '10px 14px', background: 'var(--cream)', borderRadius: 8, fontSize: 13, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🗓️</span> Sin fecha definida — la pareja es flexible
                </div>
              )}
            </div>

            {/* Contact in 2-col */}
            <div className="two-col">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
            </div>

            <div className="two-col">
              <div className="form-group">
                <label className="form-label">WhatsApp</label>
                <input className="form-input" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="+34 600 000 000" />
              </div>
              <div className="form-group">
                <label className="form-label">Nº invitados</label>
                <input className="form-input" type="number" value={form.guests} onChange={e => set('guests', e.target.value)} placeholder="150" />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--ivory)', marginBottom: 20 }} />

          {/* Section: Detalles */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Detalles</div>

            <div className="two-col">
              <div className="form-group">
                <label className="form-label">Fuente</label>
                <select className="form-input" value={form.source} onChange={e => set('source', e.target.value)}>
                  {Object.entries(SOURCE_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Presupuesto</label>
                <select className="form-input" value={form.budget} onChange={e => set('budget', e.target.value)}>
                  <option value="sin_definir">Sin definir</option>
                  <option value="menos_20k">&lt; 20.000 €</option>
                  <option value="20k_35k">20.000 – 35.000 €</option>
                  <option value="35k_50k">35.000 – 50.000 €</option>
                  <option value="mas_50k">&gt; 50.000 €</option>
                </select>
              </div>
            </div>

            <div className="two-col">
              <div className="form-group">
                <label className="form-label">Ceremonia</label>
                <select className="form-input" value={form.ceremony_type} onChange={e => set('ceremony_type', e.target.value)}>
                  <option value="sin_definir">Sin definir</option>
                  <option value="civil">Civil</option>
                  <option value="religiosa">Religiosa</option>
                  <option value="simbolica">Simbólica</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Idioma</label>
                <select className="form-input" value={form.language} onChange={e => set('language', e.target.value)}>
                  <option value="es">Español</option>
                  <option value="en">Inglés</option>
                  <option value="fr">Francés</option>
                  <option value="other">Otro</option>
                </select>
              </div>
            </div>

            <div className="two-col">
              <div className="form-group">
                <label className="form-label">Fecha de visita</label>
                <input className="form-input" type="date" value={form.visit_date} onChange={e => set('visit_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Estilo buscado</label>
                <input className="form-input" value={form.style} onChange={e => set('style', e.target.value)} placeholder="Rústico, moderno, clásico…" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notas internas</label>
              <textarea className="form-textarea" style={{ minHeight: 72 }} value={form.notes}
                onChange={e => set('notes', e.target.value)} placeholder="Observaciones privadas…" />
            </div>
          </div>

        </div>

        {/* Footer — sticky */}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={saving}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear lead'}
          </button>
        </div>
      </div>
    </div>
  )
}

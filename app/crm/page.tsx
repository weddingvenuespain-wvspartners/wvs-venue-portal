'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import NoVenueState from '@/components/NoVenueState'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  Plus, Search, X, Phone, Mail, MessageCircle, Heart,
  ChevronRight, Calendar, Download, Upload, ArrowUpDown, StickyNote,
  Users, CheckCircle2, Crown, AlertTriangle, Merge,
} from 'lucide-react'
import type { Client, ClientType, ClientWithStats } from '@/lib/clients'
import { CLIENT_TYPE_LABELS, CLIENT_TYPE_COLORS, isProfessional } from '@/lib/clients'
import ImportContactsModal from '@/components/ImportContactsModal'

const STATUS_LABEL: Record<string, string> = {
  new: 'Nuevo', contacted: 'Contactado', proposal_sent: 'Propuesta enviada',
  visit_scheduled: 'Visita programada', post_visit: 'Post-visita',
  budget_sent: 'Presupuesto enviado', won: 'Confirmado', lost: 'Perdido',
}
const STATUS_COLOR: Record<string, string> = {
  new: '#eab308', contacted: '#4F6D8C', proposal_sent: '#7E72A0',
  visit_scheduled: '#5B8794', post_visit: '#f97316',
  budget_sent: '#5C8570', won: '#5C7E64', lost: '#BC5249',
}

const BUDGET_LABELS: Record<string, string> = {
  sin_definir: '—', menos_10k: '< 10k€', '10k_15k': '10–15k€', '15k_20k': '15–20k€',
  '20k_25k': '20–25k€', '25k_30k': '25–30k€', '30k_40k': '30–40k€',
  '40k_50k': '40–50k€', '50k_75k': '50–75k€', '75k_100k': '75–100k€', mas_100k: '> 100k€',
  menos_20k: '< 20k€', '20k_35k': '20–35k€', '35k_50k': '35–50k€', mas_50k: '> 50k€',
  'wvs_menos_20k': '< 20k€', 'wvs_20k_35k': '20–35k€', 'wvs_35k_40k': '35–40k€',
  'wvs_40k_51k': '40–51k€', 'wvs_51k_60k': '51–60k€', 'wvs_mas_60k': '> 60k€',
  'wvs_35k_60k': '35–60k€', 'wvs_60k_100k': '60–100k€', 'wvs_mas_100k': '> 100k€',
}

type LeadStatusFilter = 'all' | 'active' | 'won' | 'lost' | 'no_leads'
type SortOption = 'recent' | 'name_asc' | 'name_desc' | 'wedding_date' | 'budget'
type ViewTab = 'todos' | 'planners'

// Budget sort order (lower index = lower budget)
const BUDGET_ORDER: Record<string, number> = {
  sin_definir: 0, menos_10k: 1, '10k_15k': 2, '15k_20k': 3,
  '20k_25k': 4, '25k_30k': 5, '30k_40k': 6, '40k_50k': 7,
  '50k_75k': 8, '75k_100k': 9, mas_100k: 10,
  menos_20k: 1, '20k_35k': 4, '35k_50k': 6, mas_50k: 8,
  wvs_menos_20k: 1, wvs_20k_35k: 4, wvs_35k_40k: 5,
  wvs_40k_51k: 7, wvs_51k_60k: 8, wvs_mas_60k: 10,
  wvs_35k_60k: 7, wvs_60k_100k: 9, wvs_mas_100k: 10,
}

export default function CrmListPage() {
  const { user, activeVenue, loading: authLoading } = useAuth()
  useRequireSubscription()
  const router = useRouter()
  const supabase = createClient()

  const [clients, setClients] = useState<ClientWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [viewTab, setViewTab] = useState<ViewTab>('todos')

  // New client modal
  const [showNewModal, setShowNewModal] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', email: '', phone: '', whatsapp: '', client_type: 'pareja' as ClientType })
  const [saving, setSaving] = useState(false)

  // Quick notes
  const [notesClientId, setNotesClientId] = useState<string | null>(null)
  const [notesValue, setNotesValue] = useState('')
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Import modal
  const [showImport, setShowImport] = useState(false)
  const existingEmails = useMemo(() => new Set(clients.map(c => (c.email || '').toLowerCase()).filter(Boolean)), [clients])
  const existingPhones = useMemo(() => new Set(clients.map(c => (c.phone || '').replace(/[\s\-().]/g, '')).filter(Boolean)), [clients])

  // Duplicates
  type DuplicateGroup = { primary: ClientWithStats; duplicates: ClientWithStats[]; reason: string }
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [merging, setMerging] = useState(false)

  // ── Data loading ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !activeVenue) { setLoading(false); return }
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeVenue?.id])

  const loadData = async () => {
    if (!activeVenue) return
    setLoading(true)

    const [clientsRes, leadsRes] = await Promise.all([
      supabase.from('clients').select('*').eq('venue_id', activeVenue.id).order('created_at', { ascending: false }),
      supabase.from('leads').select('id, name, email, status, client_id, created_at, wedding_date, guests, budget, source').eq('venue_id', activeVenue.id),
    ])

    const rawClients: Client[] = clientsRes.data ?? []
    const rawLeads: any[] = leadsRes.data ?? []

    const withStats: ClientWithStats[] = rawClients.map(c => {
      const clientLeads = rawLeads.filter((l: any) => l.client_id === c.id)
      const activeLeads = clientLeads.filter((l: any) => l.status !== 'won' && l.status !== 'lost')
      const lastLead = [...clientLeads].sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))[0]
      const coupleCount = isProfessional(c.client_type)
        ? rawClients.filter(rc => rc.parent_client_id === c.id).length
        : undefined
      return {
        ...c,
        active_leads: activeLeads.length,
        total_leads: clientLeads.length,
        last_contact: lastLead?.created_at ?? c.created_at,
        couple_count: coupleCount,
        _latestLead: lastLead ?? null,
        _parentName: c.parent_client_id ? rawClients.find(p => p.id === c.parent_client_id)?.name ?? null : null,
      } as any
    })

    withStats.sort((a, b) => (b.last_contact ?? '').localeCompare(a.last_contact ?? ''))
    setClients(withStats)
    setLoading(false)
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = clients.length
    const withActive = clients.filter(c => c.active_leads > 0).length
    const confirmed = clients.filter(c => (c as any)._latestLead?.status === 'won').length
    const wps = clients.filter(c => isProfessional(c.client_type)).length
    return { total, withActive, confirmed, wps }
  }, [clients])

  // ── Duplicate detection ──────────────────────────────────────────────────────
  const duplicateGroups = useMemo((): DuplicateGroup[] => {
    const groups: DuplicateGroup[] = []
    const seen = new Set<string>()

    for (let i = 0; i < clients.length; i++) {
      if (seen.has(clients[i].id)) continue
      const dupes: { client: ClientWithStats; reason: string }[] = []

      for (let j = i + 1; j < clients.length; j++) {
        if (seen.has(clients[j].id)) continue
        const a = clients[i], b = clients[j]

        // Match by email
        if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) {
          dupes.push({ client: b, reason: 'Mismo email' })
          continue
        }
        // Match by phone (normalize)
        if (a.phone && b.phone) {
          const pa = a.phone.replace(/\D/g, '')
          const pb = b.phone.replace(/\D/g, '')
          if (pa && pb && (pa === pb || pa.endsWith(pb) || pb.endsWith(pa))) {
            dupes.push({ client: b, reason: 'Mismo teléfono' })
            continue
          }
        }
        // Match by name (exact, case-insensitive, both non-empty)
        if (a.name && b.name && a.name.trim().toLowerCase() === b.name.trim().toLowerCase() && a.name.trim().length > 2) {
          dupes.push({ client: b, reason: 'Mismo nombre' })
          continue
        }
      }

      if (dupes.length > 0) {
        seen.add(clients[i].id)
        dupes.forEach(d => seen.add(d.client.id))
        groups.push({
          primary: clients[i],
          duplicates: dupes.map(d => d.client),
          reason: dupes.map(d => d.reason).join(', '),
        })
      }
    }
    return groups
  }, [clients])

  // ── Merge duplicates ────────────────────────────────────────────────────────
  const mergePair = async (keepId: string, removeId: string) => {
    if (!activeVenue) return
    setMerging(true)
    try {
      // Get both clients for enrichment
      const keep = clients.find(c => c.id === keepId)
      const remove = clients.find(c => c.id === removeId)
      if (!keep || !remove) { setMerging(false); return }

      // Enrich: fill missing fields on the kept client
      const updates: Record<string, string> = {}
      if (!keep.email    && remove.email)    updates.email    = remove.email
      if (!keep.phone    && remove.phone)    updates.phone    = remove.phone
      if (!keep.whatsapp && remove.whatsapp) updates.whatsapp = remove.whatsapp
      if (!keep.language && remove.language) updates.language = remove.language
      if (!keep.country  && remove.country)  updates.country  = remove.country
      if (keep.notes || remove.notes) {
        const combined = [keep.notes, remove.notes].filter(Boolean).join('\n---\n')
        if (combined !== (keep.notes ?? '')) updates.notes = combined
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('clients').update(updates).eq('id', keepId)
      }

      // Reassign all leads from removed client to kept client
      await supabase.from('leads').update({ client_id: keepId }).eq('client_id', removeId)

      // Delete the duplicate
      await supabase.from('clients').delete().eq('id', removeId)

      await loadData()
    } catch (err) {
      console.error('Merge error:', err)
    }
    setMerging(false)
  }

  // ── Filtering + sorting ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = clients

    // View tab filter
    if (viewTab === 'planners') {
      list = list.filter(c => isProfessional(c.client_type))
    }

    if (typeFilter !== 'all' && viewTab !== 'planners') {
      list = list.filter(c => c.client_type === typeFilter)
    }
    if (statusFilter !== 'all') {
      list = list.filter(c => {
        const ll = (c as any)._latestLead
        if (statusFilter === 'no_leads') return !ll
        if (statusFilter === 'active') return ll && ll.status !== 'won' && ll.status !== 'lost'
        if (statusFilter === 'won') return ll?.status === 'won'
        if (statusFilter === 'lost') return ll?.status === 'lost'
        return true
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q)
      )
    }

    // Sort
    const sorted = [...list]
    switch (sortBy) {
      case 'name_asc':
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        break
      case 'name_desc':
        sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''))
        break
      case 'wedding_date': {
        sorted.sort((a, b) => {
          const da = (a as any)._latestLead?.wedding_date || ''
          const db = (b as any)._latestLead?.wedding_date || ''
          if (!da && !db) return 0
          if (!da) return 1
          if (!db) return -1
          return da.localeCompare(db)
        })
        break
      }
      case 'budget': {
        sorted.sort((a, b) => {
          const ba = BUDGET_ORDER[(a as any)._latestLead?.budget] ?? -1
          const bb = BUDGET_ORDER[(b as any)._latestLead?.budget] ?? -1
          return bb - ba // highest budget first
        })
        break
      }
      default: // 'recent'
        sorted.sort((a, b) => (b.last_contact ?? '').localeCompare(a.last_contact ?? ''))
    }

    return sorted
  }, [clients, typeFilter, statusFilter, search, sortBy, viewTab])

  // ── Create client ─────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!activeVenue || !newForm.name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('clients').insert({
      venue_id: activeVenue.id,
      name: newForm.name.trim(),
      email: newForm.email.trim() || null,
      phone: newForm.phone.trim() || null,
      whatsapp: newForm.whatsapp.trim() || null,
      client_type: newForm.client_type,
    })
    setSaving(false)
    if (!error) {
      setShowNewModal(false)
      setNewForm({ name: '', email: '', phone: '', whatsapp: '', client_type: 'pareja' })
      loadData()
    }
  }

  // ── Quick notes ───────────────────────────────────────────────────────────────
  const openNotes = (c: ClientWithStats) => {
    setNotesClientId(c.id)
    setNotesValue(c.notes ?? '')
  }
  const saveNotesDebounced = (val: string, clientId: string) => {
    setNotesValue(val)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      await supabase.from('clients').update({ notes: val }).eq('id', clientId)
      // Update local state
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, notes: val } : c))
    }, 800)
  }

  // ── CSV Export ─────────────────────────────────────────────────────────────────
  const exportExcel = async () => {
    const XLSX = await import('xlsx')
    const headers = ['Nombre', 'Tipo', 'Email', 'Teléfono', 'WhatsApp', 'País', 'Idioma', 'Etiquetas', 'Leads activos', 'Último estado', 'Fecha boda', 'Presupuesto', 'Notas', 'Creado']
    const dataRows = filtered.map(c => {
      const ll = (c as any)._latestLead
      return [
        c.name,
        CLIENT_TYPE_LABELS[c.client_type] ?? c.client_type,
        c.email ?? '',
        c.phone ?? '',
        c.whatsapp ?? '',
        c.country ?? '',
        c.language ?? '',
        Array.isArray(c.tags) ? c.tags.join(', ') : '',
        c.active_leads,
        ll ? (STATUS_LABEL[ll.status] ?? ll.status) : '',
        ll?.wedding_date ?? '',
        ll?.budget ? (BUDGET_LABELS[ll.budget] ?? ll.budget) : '',
        (c.notes ?? '').replace(/[\n\r]+/g, ' '),
        c.created_at?.split('T')[0] ?? '',
      ]
    })
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 16) }))
    XLSX.utils.book_append_sheet(wb, ws, 'Contactos')
    XLSX.writeFile(wb, `contactos_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const fmtDate = (d: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (authLoading) return null
  if (!user) { router.push('/login'); return null }

  if (!authLoading && !activeVenue) {
    return <><Sidebar /><div className="main-layout" style={{ padding: '24px 28px' }}><NoVenueState /></div></>
  }

  return (
    <>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Contactos</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowImport(true)} title="Importar contactos desde Excel">
              <Upload size={13} /> Importar
            </button>
            <button className="btn btn-ghost btn-sm" onClick={exportExcel} title="Exportar contactos a Excel">
              <Download size={13} /> Exportar
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowNewModal(true)}>
              <Plus size={13} /> Nuevo contacto
            </button>
          </div>
        </div>

        <div className="page-content">

        {/* ── KPI cards ──────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total contactos', value: kpis.total, icon: <Users size={16} />, color: '#5F6196', bg: '#eef2ff' },
            { label: 'Con leads activos', value: kpis.withActive, icon: <Heart size={16} />, color: '#AC8B4C', bg: '#F7F3E8' },
            { label: 'Confirmados', value: kpis.confirmed, icon: <CheckCircle2 size={16} />, color: '#5C8570', bg: '#EDF2ED' },
            { label: 'Colaboradores', value: kpis.wps, icon: <Crown size={16} />, color: '#7E72A0', bg: '#F2F1F8' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.color, flexShrink: 0 }}>
                {kpi.icon}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--charcoal)', lineHeight: 1 }}>{kpi.value}</div>
                <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{kpi.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Duplicates banner ────────────────────────────────────────── */}
        {duplicateGroups.length > 0 && (
          <div
            onClick={() => setShowDuplicates(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', marginBottom: 16,
              borderRadius: 10, background: '#F7F3E8', border: '1px solid #E2D4AE', cursor: 'pointer',
              transition: 'background .12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F3EBD8')}
            onMouseLeave={e => (e.currentTarget.style.background = '#F7F3E8')}>
            <AlertTriangle size={18} style={{ color: '#AC8B4C', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#7A5A2E' }}>
                {duplicateGroups.length} posible{duplicateGroups.length !== 1 ? 's' : ''} duplicado{duplicateGroups.length !== 1 ? 's' : ''} detectado{duplicateGroups.length !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 11, color: '#8A6A38' }}>Click para revisar y fusionar</div>
            </div>
            <Merge size={16} style={{ color: '#AC8B4C' }} />
          </div>
        )}

        {/* ── View tabs (Todos / Wedding Planners) ───────────────────── */}
        <div style={{ display: 'inline-flex', gap: 0, background: '#fff', borderRadius: '8px 8px 0 0', border: '1px solid var(--border)', borderBottom: '2px solid var(--border)', marginBottom: 16 }}>
          {([
            { key: 'todos' as ViewTab, label: 'Todos', icon: null as React.ReactNode, count: clients.length },
            { key: 'planners' as ViewTab, label: 'Colaboradores', icon: <Crown size={14} /> as React.ReactNode, count: kpis.wps },
          ]).map(t => (
            <button key={t.key} onClick={() => setViewTab(t.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 20px', fontSize: 13, fontWeight: viewTab === t.key ? 700 : 500,
                color: viewTab === t.key ? 'var(--charcoal)' : 'var(--warm-gray)',
                background: 'none', border: 'none', borderBottom: viewTab === t.key ? '2px solid var(--gold)' : '2px solid transparent',
                cursor: 'pointer', marginBottom: -2, fontFamily: 'Inter, sans-serif',
              }}>
              {t.icon}{t.label} <span style={{ fontSize: 11, color: 'var(--warm-gray)', marginLeft: 4 }}>({t.count})</span>
            </button>
          ))}
        </div>

        {/* ── Search, filters & sort ────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', position: 'relative', minWidth: 220 }}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)', zIndex: 1 }} />
            <input className="form-input" style={{ paddingLeft: 32, paddingRight: search ? 32 : 12 }}
              placeholder="Buscar por nombre, email o teléfono..."
              value={search} onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', display: 'flex' }}>
                <X size={14} />
              </button>
            )}
          </div>
          {viewTab !== 'planners' && (
            <div style={{ width: 160 }}>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger style={{ background: '#fff' }}><SelectValue placeholder="Todos los tipos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {(Object.keys(CLIENT_TYPE_LABELS) as ClientType[]).map(t => (
                    <SelectItem key={t} value={t}>{CLIENT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div style={{ width: 200 }}>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LeadStatusFilter)}>
              <SelectTrigger style={{ background: '#fff' }}><SelectValue placeholder="Todos los estados" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Con lead activo</SelectItem>
                <SelectItem value="won">Confirmados</SelectItem>
                <SelectItem value="lost">Perdidos</SelectItem>
                <SelectItem value="no_leads">Sin peticiones</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div style={{ width: 160 }}>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger style={{ background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ArrowUpDown size={12} />
                  <SelectValue placeholder="Ordenar" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Más reciente</SelectItem>
                <SelectItem value="name_asc">Nombre A→Z</SelectItem>
                <SelectItem value="name_desc">Nombre Z→A</SelectItem>
                <SelectItem value="wedding_date">Fecha de boda</SelectItem>
                <SelectItem value="budget">Presupuesto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── List ───────────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--warm-gray)' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--warm-gray)', background: '#fff', borderRadius: 8, border: '1px solid var(--border)' }}>
            {search || typeFilter !== 'all' || statusFilter !== 'all' ? 'No se encontraron contactos con esos filtros.' : 'No hay contactos todavía.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filtered.map(c => {
              const tc = CLIENT_TYPE_COLORS[c.client_type] ?? CLIENT_TYPE_COLORS.otro
              const isWP = isProfessional(c.client_type)
              const ll = (c as any)._latestLead
              const parentName = (c as any)._parentName
              const hasNotes = !!(c.notes && c.notes.trim())
              return (
                <div key={c.id}
                  style={{
                    background: isWP ? '#faf5ff' : '#fff',
                    borderRadius: 8,
                    border: isWP ? '1px solid #e9d5ff' : '1px solid var(--border)',
                    padding: '10px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'background .12s',
                  }}
                  onClick={() => router.push(`/crm/${c.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = isWP ? '#f3e8ff' : '#faf9f7')}
                  onMouseLeave={e => (e.currentTarget.style.background = isWP ? '#faf5ff' : '#fff')}>

                  {/* Avatar */}
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: tc.bg, border: `1.5px solid ${tc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: tc.color, flexShrink: 0 }}>
                    {(c.name || '?')[0].toUpperCase()}
                  </div>

                  {/* Name + badges */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name || '(sin nombre)'}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, flexShrink: 0 }}>
                        {CLIENT_TYPE_LABELS[c.client_type]}
                      </span>
                      {parentName && (
                        <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 999, background: '#f3e8ff', color: '#5A4878', border: '1px solid #d8b4fe', flexShrink: 0 }}>
                          WP: {parentName}
                        </span>
                      )}
                      {isWP && c.couple_count !== undefined && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: '#f3e8ff', color: '#5A4878', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                          <Heart size={9} /> {c.couple_count}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--warm-gray)' }}>
                      {c.email && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{c.email}</span>}
                      {c.phone && <span>{c.phone}</span>}
                      {ll?.wedding_date && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Calendar size={10} /> {fmtDate(ll.wedding_date)}
                        </span>
                      )}
                      {ll?.budget && BUDGET_LABELS[ll.budget] && BUDGET_LABELS[ll.budget] !== '—' && (
                        <span>{BUDGET_LABELS[ll.budget]}</span>
                      )}
                    </div>
                  </div>

                  {/* Active leads count / lead status badge */}
                  <div style={{ flexShrink: 0 }}>
                    {isWP ? (
                      c.couple_count ? (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#f3e8ff', color: '#5A4878' }}>
                          {c.couple_count} pareja{c.couple_count !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: '#ccc' }}>Sin parejas</span>
                      )
                    ) : c.active_leads > 0 ? (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#F3EBD8', color: '#7A5A2E' }}>
                        {c.active_leads} activa{c.active_leads !== 1 ? 's' : ''}
                      </span>
                    ) : ll ? (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: ll.status === 'won' ? '#DDE7DF' : ll.status === 'lost' ? '#F2E2E0' : '#f5f5f4', color: STATUS_COLOR[ll.status] ?? '#999' }}>
                        {STATUS_LABEL[ll.status] ?? ll.status}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: '#ccc' }}>—</span>
                    )}
                  </div>

                  {/* Quick notes button */}
                  <button
                    onClick={e => { e.stopPropagation(); openNotes(c) }}
                    title={hasNotes ? 'Ver/editar notas' : 'Añadir nota'}
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: hasNotes ? '#F3EBD8' : 'var(--cream)',
                      border: hasNotes ? '1px solid #E2D4AE' : '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', flexShrink: 0,
                    }}>
                    <StickyNote size={12} style={{ color: hasNotes ? '#7A5A2E' : '#999' }} />
                  </button>

                  {/* Quick contact actions */}
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {c.whatsapp && (
                      <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()} title="WhatsApp"
                        style={{ width: 28, height: 28, borderRadius: 6, background: '#DDE7DF', border: '1px solid #C3D4C5', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                        <MessageCircle size={12} style={{ color: '#4A6B52' }} />
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`}
                        onClick={e => e.stopPropagation()} title="Email"
                        style={{ width: 28, height: 28, borderRadius: 6, background: '#DDE5EF', border: '1px solid #AFC0D2', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                        <Mail size={12} style={{ color: '#47648A' }} />
                      </a>
                    )}
                    {c.phone && (
                      <a href={`tel:${c.phone}`}
                        onClick={e => e.stopPropagation()} title="Llamar"
                        style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--cream)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                        <Phone size={12} style={{ color: '#666' }} />
                      </a>
                    )}
                  </div>

                  {/* Last contact date */}
                  <span style={{ fontSize: 10, color: 'var(--warm-gray)', flexShrink: 0, minWidth: 68, textAlign: 'right' }}>
                    {fmtDate(c.last_contact)}
                  </span>

                  <ChevronRight size={13} style={{ color: '#ddd', flexShrink: 0 }} />
                </div>
              )
            })}
          </div>
        )}

        {/* ── Quick Notes Modal ───────────────────────────────────────── */}
        <Dialog open={!!notesClientId} onOpenChange={open => { if (!open) setNotesClientId(null) }}>
          <DialogContent style={{ maxWidth: 480 }}>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StickyNote size={16} style={{ color: 'var(--gold)' }} />
              Notas — {clients.find(c => c.id === notesClientId)?.name ?? ''}
            </DialogTitle>
            <textarea
              className="form-input"
              rows={6}
              value={notesValue}
              onChange={e => notesClientId && saveNotesDebounced(e.target.value, notesClientId)}
              placeholder="Escribe notas rápidas sobre este contacto…"
              style={{ resize: 'vertical', fontSize: 13, marginTop: 8 }}
              autoFocus
            />
            <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 4 }}>
              Guardado automático
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Duplicates Modal ─────────────────────────────────────────── */}
        <Dialog open={showDuplicates} onOpenChange={setShowDuplicates}>
          <DialogContent style={{ maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }}>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Merge size={18} style={{ color: 'var(--gold)' }} />
              Posibles duplicados ({duplicateGroups.length})
            </DialogTitle>
            <p style={{ fontSize: 12, color: 'var(--warm-gray)', margin: '4px 0 16px' }}>
              Contactos con mismo email, teléfono o nombre. Selecciona cuál conservar — el otro se eliminará y sus leads se reasignarán.
            </p>
            {duplicateGroups.map((group, gi) => (
              <div key={gi} style={{ marginBottom: 20, padding: 16, borderRadius: 10, background: '#fafaf8', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#AC8B4C', letterSpacing: '0.06em', marginBottom: 10 }}>
                  {group.reason}
                </div>
                {[group.primary, ...group.duplicates].map(c => {
                  const tc = CLIENT_TYPE_COLORS[c.client_type] ?? CLIENT_TYPE_COLORS.otro
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid var(--border)', marginBottom: 6 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: tc.bg, border: `1.5px solid ${tc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: tc.color, flexShrink: 0 }}>
                        {(c.name || '?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)' }}>{c.name || '(sin nombre)'}</div>
                        <div style={{ fontSize: 11, color: '#aaa', display: 'flex', gap: 8 }}>
                          {c.email && <span>{c.email}</span>}
                          {c.phone && <span>{c.phone}</span>}
                          <span>{c.total_leads} lead{c.total_leads !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <button
                        disabled={merging}
                        onClick={async () => {
                          const otherId = c.id === group.primary.id ? group.duplicates[0].id : group.primary.id
                          await mergePair(c.id, otherId)
                        }}
                        style={{
                          padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                          background: 'var(--gold)', color: '#fff', border: 'none', cursor: merging ? 'wait' : 'pointer',
                          opacity: merging ? 0.5 : 1, flexShrink: 0,
                        }}>
                        Conservar
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
            {duplicateGroups.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--warm-gray)', textAlign: 'center', padding: 20 }}>
                No hay duplicados detectados 🎉
              </p>
            )}
          </DialogContent>
        </Dialog>

        {/* ── New Client Modal ────────────────────────────────────────── */}
        <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
          <DialogContent style={{ maxWidth: 460, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px 16px' }}>
              <DialogTitle style={{ fontSize: 16, fontWeight: 700, color: 'var(--charcoal)', margin: 0 }}>Nuevo contacto</DialogTitle>
              <p style={{ fontSize: 12, color: 'var(--warm-gray)', margin: '4px 0 0' }}>Añade un contacto a tu CRM</p>
            </div>

            {/* Type selector — visual pills */}
            <div style={{ padding: '0 24px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Tipo de contacto</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {([
                  { type: 'pareja' as ClientType, label: 'Pareja', icon: '💍', desc: 'Pareja directa' },
                  { type: 'wedding_planner' as ClientType, label: 'Wedding Planner', icon: '👑', desc: 'Planificador de bodas' },
                  { type: 'organizador' as ClientType, label: 'Organizador', icon: '📋', desc: 'Organizador de eventos' },
                  { type: 'empresa' as ClientType, label: 'Empresa', icon: '🏢', desc: 'Empresa o agencia' },
                  { type: 'cliente' as ClientType, label: 'Cliente', icon: '👤', desc: 'Cliente particular' },
                  { type: 'otro' as ClientType, label: 'Otro', icon: '📌', desc: 'Otro tipo' },
                ]).map(opt => {
                  const selected = newForm.client_type === opt.type
                  const colors = CLIENT_TYPE_COLORS[opt.type]
                  return (
                    <button key={opt.type} onClick={() => setNewForm(f => ({ ...f, client_type: opt.type }))}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        padding: '10px 6px 8px', borderRadius: 10, border: `1.5px solid ${selected ? colors.border : 'var(--border)'}`,
                        background: selected ? colors.bg : '#fff', cursor: 'pointer', transition: 'all .15s',
                        transform: selected ? 'scale(1.02)' : 'none',
                      }}
                      onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.background = colors.bg + '66' } }}
                      onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = '#fff' } }}>
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{opt.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: selected ? 700 : 500, color: selected ? colors.color : 'var(--charcoal)', textAlign: 'center', lineHeight: 1.2 }}>{opt.label}</span>
                    </button>
                  )
                })}
              </div>
              {isProfessional(newForm.client_type) && (
                <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: '#f3e8ff', fontSize: 11, color: '#5A4878', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Crown size={12} /> Podrás vincular parejas, peticiones y colaboraciones
                </div>
              )}
            </div>

            {/* Form fields */}
            <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4, display: 'block' }}>Nombre *</label>
                <input className="form-input" placeholder={isProfessional(newForm.client_type) ? 'Nombre o nombre de empresa' : 'Nombre completo'} value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4, display: 'block' }}>Email</label>
                <input className="form-input" placeholder="email@ejemplo.com" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4, display: 'block' }}>Teléfono</label>
                  <input className="form-input" placeholder="+34 600..." value={newForm.phone} onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4, display: 'block' }}>WhatsApp</label>
                  <input className="form-input" placeholder="+34 600..." value={newForm.whatsapp} onChange={e => setNewForm(f => ({ ...f, whatsapp: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowNewModal(false)}>Cancelar</button>
                <button onClick={handleCreate} disabled={saving || !newForm.name.trim()}
                  style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--gold)', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: saving || !newForm.name.trim() ? 0.5 : 1, transition: 'opacity .15s' }}>
                  {saving ? 'Guardando...' : 'Crear contacto'}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        </div>{/* /page-content */}

      {activeVenue && (
        <ImportContactsModal
          open={showImport}
          onClose={() => setShowImport(false)}
          venueId={activeVenue.id}
          existingEmails={existingEmails}
          existingPhones={existingPhones}
          onImported={loadData}
        />
      )}

      </div>
    </>
  )
}

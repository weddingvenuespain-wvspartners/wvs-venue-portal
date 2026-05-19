'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import Spinner from '@/components/Spinner'
import {
  Search, X, Phone, Mail, MessageCircle, Users, Download,
  ChevronUp, ChevronDown, ArrowUpDown, ExternalLink,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type Lead = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  source?: string | null
  status: string
  wedding_date?: string | null
  wedding_year?: number | null
  wedding_month?: number | null
  guests?: number | null
  budget?: string | null
  ceremony_type?: string | null
  notes?: string | null
  created_at: string
}

type SortKey = 'name' | 'status' | 'wedding_date' | 'guests' | 'created_at'
type SortDir = 'asc' | 'desc'

// ── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  new:             { label: 'Nuevo',             bg: '#eff6ff', color: '#1d4ed8' },
  contacted:       { label: 'Contactado',        bg: '#f5f3ff', color: '#6d28d9' },
  proposal_sent:   { label: 'Propuesta enviada', bg: '#fefce8', color: '#a16207' },
  visit_scheduled: { label: 'Visita agendada',   bg: '#f0fdf4', color: '#15803d' },
  post_visit:      { label: 'Post-visita',       bg: '#ecfdf5', color: '#059669' },
  budget_sent:     { label: 'Presupuesto',       bg: '#fff7ed', color: '#c2410c' },
  won:             { label: 'Confirmado',        bg: '#d1fae5', color: '#065f46' },
  lost:            { label: 'Perdido',           bg: '#fef2f2', color: '#b91c1c' },
}

const SOURCE_LABEL: Record<string, string> = {
  web: 'Web', whatsapp: 'WhatsApp', instagram: 'Instagram',
  email: 'Email', referral: 'Referido', manual: 'Manual',
  other: 'Otro', wedding_planner: 'Planner',
  wedding_venues_spain: 'Wedding Venues Spain',
  bodas_net: 'Bodas.net',
}

const BUDGET_LABEL: Record<string, string> = {
  sin_definir: '—', menos_10k: '< 10k€', '10k_15k': '10–15k€',
  '15k_20k': '15–20k€', '20k_25k': '20–25k€', '25k_30k': '25–30k€',
  '30k_40k': '30–40k€', '40k_50k': '40–50k€', '50k_75k': '50–75k€',
  '75k_100k': '75–100k€', mas_100k: '> 100k€',
  menos_20k: '< 20k€', '20k_35k': '20–35k€', '35k_50k': '35–50k€', mas_50k: '> 50k€',
  wvs_menos_20k: '< 20k€', wvs_20k_35k: '20–35k€', wvs_35k_40k: '35–40k€',
  wvs_40k_51k: '40–51k€', wvs_51k_60k: '51–60k€', wvs_mas_60k: '> 60k€',
}

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmtDate(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

function weddingLabel(lead: Lead) {
  if (lead.wedding_date) {
    const d = new Date(lead.wedding_date + 'T12:00:00')
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
  }
  if (lead.wedding_year && lead.wedding_month) return `${MONTHS_SHORT[lead.wedding_month - 1]} ${lead.wedding_year}`
  if (lead.wedding_year) return `${lead.wedding_year}`
  return '—'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CrmPage() {
  const router = useRouter()
  const { user, loading: authLoading, activeVenue } = useAuth()
  const { isBlocked } = useRequireSubscription()

  const [leads,   setLeads]   = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [yearFilter,   setYearFilter]   = useState<string>('all')
  const [sortKey,  setSortKey]  = useState<SortKey>('created_at')
  const [sortDir,  setSortDir]  = useState<SortDir>('desc')

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    load()
  }, [user, authLoading, activeVenue?.id]) // eslint-disable-line

  const load = async () => {
    if (!activeVenue) { setLoading(false); return }
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('leads')
      .select('id,name,email,phone,whatsapp,source,status,wedding_date,wedding_year,wedding_month,guests,budget,ceremony_type,notes,created_at')
      .eq('venue_id', activeVenue.id)
      .order('created_at', { ascending: false })
    if (data) setLeads(data as Lead[])
    setLoading(false)
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return {
      total:      leads.length,
      newMonth:   leads.filter(l => l.created_at.startsWith(thisMonth)).length,
      active:     leads.filter(l => !['won', 'lost'].includes(l.status)).length,
      won:        leads.filter(l => l.status === 'won').length,
      convRate:   leads.length > 0 ? Math.round((leads.filter(l => l.status === 'won').length / leads.length) * 100) : 0,
    }
  }, [leads])

  // ── Years available ────────────────────────────────────────────────────────
  const years = useMemo(() => {
    const ys = new Set<number>()
    leads.forEach(l => {
      if (l.wedding_date) ys.add(new Date(l.wedding_date + 'T12:00:00').getFullYear())
      if (l.wedding_year) ys.add(l.wedding_year)
    })
    return [...ys].sort((a, b) => b - a)
  }, [leads])

  // ── Filtered + sorted ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = [...leads]

    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(l =>
        l.name.toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.phone || '').includes(q) ||
        (l.whatsapp || '').includes(q)
      )
    }
    if (statusFilter !== 'all') rows = rows.filter(l => l.status === statusFilter)
    if (sourceFilter !== 'all') rows = rows.filter(l => l.source === sourceFilter)
    if (yearFilter !== 'all') {
      const y = parseInt(yearFilter)
      rows = rows.filter(l => {
        if (l.wedding_date) return new Date(l.wedding_date + 'T12:00:00').getFullYear() === y
        return l.wedding_year === y
      })
    }

    rows.sort((a, b) => {
      let va: any, vb: any
      if (sortKey === 'name')         { va = a.name; vb = b.name }
      else if (sortKey === 'status')  { va = a.status; vb = b.status }
      else if (sortKey === 'wedding_date') { va = a.wedding_date || `${a.wedding_year}-${a.wedding_month}`; vb = b.wedding_date || `${b.wedding_year}-${b.wedding_month}` }
      else if (sortKey === 'guests')  { va = a.guests ?? 0; vb = b.guests ?? 0 }
      else                            { va = a.created_at; vb = b.created_at }
      if (va == null) return 1
      if (vb == null) return -1
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
    })

    return rows
  }, [leads, search, statusFilter, sourceFilter, yearFilter, sortKey, sortDir])

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Nombre','Email','Teléfono','WhatsApp','Fuente','Estado','Fecha boda','Invitados','Presupuesto','Entrada']
    const rows = filtered.map(l => [
      l.name,
      l.email || '',
      l.phone || '',
      l.whatsapp || '',
      SOURCE_LABEL[l.source || ''] || l.source || '',
      STATUS_CFG[l.status]?.label || l.status,
      weddingLabel(l),
      l.guests || '',
      BUDGET_LABEL[l.budget || ''] || l.budget || '',
      fmtDate(l.created_at),
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'contactos.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const SortBtn = ({ col }: { col: SortKey }) => {
    const active = sortKey === col
    const toggle = () => { if (active) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(col); setSortDir('asc') } }
    return (
      <button onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 2, color: active ? 'var(--gold)' : 'var(--warm-gray)', verticalAlign: 'middle' }}>
        {!active && <ArrowUpDown size={11} />}
        {active && sortDir === 'asc' && <ChevronUp size={11} />}
        {active && sortDir === 'desc' && <ChevronDown size={11} />}
      </button>
    )
  }

  if (isBlocked) return null
  if (loading || authLoading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </div>
  )

  const sources = [...new Set(leads.map(l => l.source).filter(Boolean))] as string[]

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">CRM — Todos los contactos</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={exportCSV} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={13} /> Exportar CSV
            </button>
            <button onClick={() => router.push('/leads')} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ExternalLink size={13} /> Ir a Leads
            </button>
          </div>
        </div>

        <div className="page-content">

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total contactos', value: stats.total,    color: 'var(--charcoal)' },
              { label: 'Nuevos este mes', value: stats.newMonth, color: '#2563eb' },
              { label: 'Pipeline activo', value: stats.active,   color: '#7c3aed' },
              { label: 'Confirmados',     value: stats.won,      color: '#059669' },
              { label: 'Conversión',      value: `${stats.convRate}%`, color: stats.convRate >= 20 ? '#059669' : stats.convRate >= 10 ? '#d97706' : '#dc2626' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'Inter, sans-serif', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4, letterSpacing: '0.03em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Search + filters */}
          <div className="card" style={{ marginBottom: 16, padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)', pointerEvents: 'none' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre, email o teléfono…"
                style={{ width: '100%', paddingLeft: 30, paddingRight: search ? 28 : 10, paddingTop: 7, paddingBottom: 7, border: '1px solid var(--ivory)', borderRadius: 8, fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none', background: '#faf8f5', boxSizing: 'border-box' }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 0 }}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Status filter */}
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid var(--ivory)', borderRadius: 8, fontSize: 12, fontFamily: 'Inter, sans-serif', background: '#faf8f5', color: 'var(--charcoal)', cursor: 'pointer' }}>
              <option value="all">Todos los estados</option>
              {Object.entries(STATUS_CFG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            {/* Source filter */}
            {sources.length > 0 && (
              <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
                style={{ padding: '7px 10px', border: '1px solid var(--ivory)', borderRadius: 8, fontSize: 12, fontFamily: 'Inter, sans-serif', background: '#faf8f5', color: 'var(--charcoal)', cursor: 'pointer' }}>
                <option value="all">Todos los canales</option>
                {sources.map(s => <option key={s} value={s}>{SOURCE_LABEL[s] || s}</option>)}
              </select>
            )}

            {/* Year filter */}
            {years.length > 0 && (
              <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
                style={{ padding: '7px 10px', border: '1px solid var(--ivory)', borderRadius: 8, fontSize: 12, fontFamily: 'Inter, sans-serif', background: '#faf8f5', color: 'var(--charcoal)', cursor: 'pointer' }}>
                <option value="all">Todos los años</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}

            {/* Clear */}
            {(statusFilter !== 'all' || sourceFilter !== 'all' || yearFilter !== 'all' || search) && (
              <button onClick={() => { setStatusFilter('all'); setSourceFilter('all'); setYearFilter('all'); setSearch('') }}
                style={{ fontSize: 11, color: 'var(--warm-gray)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                Limpiar filtros
              </button>
            )}

            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>
              {filtered.length} contacto{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 13 }}>
                {leads.length === 0 ? 'Aún no tienes contactos. Los leads de tus canales de venta aparecerán aquí.' : 'Sin contactos con los filtros aplicados.'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--ivory)', background: '#faf8f5' }}>
                      {[
                        { label: 'Nombre',      key: 'name' as SortKey,         w: '20%' },
                        { label: 'Contacto',    key: null,                       w: '14%' },
                        { label: 'Canal',       key: null,                       w: '12%' },
                        { label: 'Estado',      key: 'status' as SortKey,       w: '13%' },
                        { label: 'Boda',        key: 'wedding_date' as SortKey, w: '10%' },
                        { label: 'Invitados',   key: 'guests' as SortKey,       w: '8%'  },
                        { label: 'Presupuesto', key: null,                       w: '10%' },
                        { label: 'Entrada',     key: 'created_at' as SortKey,   w: '10%' },
                        { label: '',            key: null,                       w: '3%'  },
                      ].map((col, i) => (
                        <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--warm-gray)', width: col.w, whiteSpace: 'nowrap' }}>
                          {col.label} {col.key && <SortBtn col={col.key} />}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(lead => {
                      const sc = STATUS_CFG[lead.status] || { label: lead.status, bg: '#f3f4f6', color: '#6b7280' }
                      return (
                        <tr key={lead.id}
                          onClick={() => router.push(`/leads`)}
                          style={{ borderBottom: '1px solid var(--ivory)', cursor: 'pointer', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#faf8f5')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {/* Name */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{lead.name}</div>
                            {lead.email && <div style={{ fontSize: 11, color: 'var(--warm-gray)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{lead.email}</div>}
                          </td>

                          {/* Contact icons */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              {lead.phone && (
                                <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} title={lead.phone}
                                  style={{ color: '#6b7280', display: 'flex' }}>
                                  <Phone size={13} />
                                </a>
                              )}
                              {lead.whatsapp && (
                                <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g,'')}`} onClick={e => e.stopPropagation()} target="_blank" rel="noreferrer" title={lead.whatsapp}
                                  style={{ color: '#25D366', display: 'flex' }}>
                                  <MessageCircle size={13} />
                                </a>
                              )}
                              {lead.email && (
                                <a href={`mailto:${lead.email}`} onClick={e => e.stopPropagation()} title={lead.email}
                                  style={{ color: '#6b7280', display: 'flex' }}>
                                  <Mail size={13} />
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Source */}
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 11, background: 'var(--ivory)', color: 'var(--warm-gray)', borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                              {SOURCE_LABEL[lead.source || ''] || lead.source || '—'}
                            </span>
                          </td>

                          {/* Status */}
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color, borderRadius: 5, padding: '3px 8px', whiteSpace: 'nowrap' }}>
                              {sc.label}
                            </span>
                          </td>

                          {/* Wedding date */}
                          <td style={{ padding: '10px 14px', color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>
                            {weddingLabel(lead)}
                          </td>

                          {/* Guests */}
                          <td style={{ padding: '10px 14px', color: 'var(--warm-gray)', textAlign: 'center' }}>
                            {lead.guests ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Users size={11} /> {lead.guests}
                              </span>
                            ) : '—'}
                          </td>

                          {/* Budget */}
                          <td style={{ padding: '10px 14px', color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>
                            {BUDGET_LABEL[lead.budget || ''] || lead.budget || '—'}
                          </td>

                          {/* Created */}
                          <td style={{ padding: '10px 14px', color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>
                            {fmtDate(lead.created_at)}
                          </td>

                          {/* Link to leads */}
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <ExternalLink size={12} style={{ color: '#c0bbb4' }} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

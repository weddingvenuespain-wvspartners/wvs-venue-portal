'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  Plus, Search, X, Phone, Mail, MessageCircle, Heart,
  ChevronRight, Calendar,
} from 'lucide-react'
import type { Client, ClientType, ClientWithStats } from '@/lib/clients'
import { CLIENT_TYPE_LABELS, CLIENT_TYPE_COLORS } from '@/lib/clients'

const STATUS_LABEL: Record<string, string> = {
  new: 'Nuevo', contacted: 'Contactado', proposal_sent: 'Propuesta enviada',
  visit_scheduled: 'Visita programada', post_visit: 'Post-visita',
  budget_sent: 'Presupuesto enviado', won: 'Confirmado', lost: 'Perdido',
}
const STATUS_COLOR: Record<string, string> = {
  new: '#eab308', contacted: '#3b82f6', proposal_sent: '#8b5cf6',
  visit_scheduled: '#06b6d4', post_visit: '#f97316',
  budget_sent: '#10b981', won: '#22c55e', lost: '#ef4444',
}

const BUDGET_LABELS: Record<string, string> = {
  sin_definir: '—', menos_10k: '< 10k€', '10k_15k': '10–15k€', '15k_20k': '15–20k€',
  '20k_25k': '20–25k€', '25k_30k': '25–30k€', '30k_40k': '30–40k€',
  '40k_50k': '40–50k€', '50k_75k': '50–75k€', '75k_100k': '75–100k€', mas_100k: '> 100k€',
  menos_20k: '< 20k€', '20k_35k': '20–35k€', '35k_50k': '35–50k€', mas_50k: '> 50k€',
  'wvs_menos_20k': '< 20k€', 'wvs_20k_35k': '20–35k€', 'wvs_35k_40k': '35–40k€',
  'wvs_40k_51k': '40–51k€', 'wvs_51k_60k': '51–60k€', 'wvs_mas_60k': '> 60k€',
}

type LeadStatusFilter = 'all' | 'active' | 'won' | 'lost' | 'no_leads'

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

  // New client modal
  const [showNewModal, setShowNewModal] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', email: '', phone: '', whatsapp: '', client_type: 'pareja' as ClientType })
  const [saving, setSaving] = useState(false)

  // ── Data loading ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !activeVenue) return
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
      const coupleCount = c.client_type === 'wedding_planner'
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

  // ── Filtering ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = clients
    if (typeFilter !== 'all') list = list.filter(c => c.client_type === typeFilter)
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
    return list
  }, [clients, typeFilter, statusFilter, search])

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

  const fmtDate = (d: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const totalActive = clients.filter(c => c.active_leads > 0).length

  if (authLoading) return null
  if (!user) { router.push('/login'); return null }

  return (
    <>
      <Sidebar />
      <div className="main-layout" style={{ padding: '24px 28px' }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--charcoal)', margin: 0 }}>CRM</h1>
            <p style={{ fontSize: 13, color: 'var(--warm-gray)', margin: '4px 0 0' }}>
              Directorio de clientes
            </p>
          </div>
          <button onClick={() => setShowNewModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--gold)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            <Plus size={14} /> Nuevo cliente
          </button>
        </div>

        {/* ── Search & filters ───────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
            <input
              placeholder="Buscar por nombre, email o teléfono..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 10px 8px 30px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', background: '#fff' }}
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}>
                <X size={13} />
              </button>
            )}
          </div>
          <div style={{ width: 170 }}>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue placeholder="Todos los tipos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {(Object.keys(CLIENT_TYPE_LABELS) as ClientType[]).map(t => (
                  <SelectItem key={t} value={t}>{CLIENT_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div style={{ width: 170 }}>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LeadStatusFilter)}>
              <SelectTrigger><SelectValue placeholder="Todos los estados" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Con lead activo</SelectItem>
                <SelectItem value="won">Confirmados</SelectItem>
                <SelectItem value="lost">Perdidos</SelectItem>
                <SelectItem value="no_leads">Sin peticiones</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── List ───────────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--warm-gray)' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--warm-gray)', background: '#fff', borderRadius: 8, border: '1px solid var(--border)' }}>
            {search || typeFilter !== 'all' || statusFilter !== 'all' ? 'No se encontraron clientes con esos filtros.' : 'No hay clientes todavía.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filtered.map(c => {
              const tc = CLIENT_TYPE_COLORS[c.client_type] ?? CLIENT_TYPE_COLORS.otro
              const isWP = c.client_type === 'wedding_planner'
              const ll = (c as any)._latestLead
              const parentName = (c as any)._parentName
              return (
                <div key={c.id}
                  onClick={() => router.push(`/crm/${c.id}`)}
                  style={{ background: '#fff', borderRadius: 8, border: '1px solid var(--border)', padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'background .12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#faf9f7')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>

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
                        <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 999, background: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe', flexShrink: 0 }}>
                          WP: {parentName}
                        </span>
                      )}
                      {isWP && c.couple_count !== undefined && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: '#f3e8ff', color: '#6b21a8', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                          <Heart size={9} /> {c.couple_count}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#aaa' }}>
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
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#f3e8ff', color: '#6b21a8' }}>
                          {c.couple_count} pareja{c.couple_count !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: '#ccc' }}>Sin parejas</span>
                      )
                    ) : c.active_leads > 0 ? (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#fef3c7', color: '#92400e' }}>
                        {c.active_leads} activa{c.active_leads !== 1 ? 's' : ''}
                      </span>
                    ) : ll ? (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: ll.status === 'won' ? '#dcfce7' : ll.status === 'lost' ? '#fee2e2' : '#f5f5f4', color: STATUS_COLOR[ll.status] ?? '#999' }}>
                        {STATUS_LABEL[ll.status] ?? ll.status}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: '#ccc' }}>—</span>
                    )}
                  </div>

                  {/* Quick contact actions */}
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {c.whatsapp && (
                      <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()} title="WhatsApp"
                        style={{ width: 28, height: 28, borderRadius: 6, background: '#dcfce7', border: '1px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                        <MessageCircle size={12} style={{ color: '#16a34a' }} />
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`}
                        onClick={e => e.stopPropagation()} title="Email"
                        style={{ width: 28, height: 28, borderRadius: 6, background: '#dbeafe', border: '1px solid #93c5fd', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                        <Mail size={12} style={{ color: '#2563eb' }} />
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
                  <span style={{ fontSize: 10, color: '#bbb', flexShrink: 0, minWidth: 68, textAlign: 'right' }}>
                    {fmtDate(c.last_contact)}
                  </span>

                  <ChevronRight size={13} style={{ color: '#ddd', flexShrink: 0 }} />
                </div>
              )
            })}
          </div>
        )}

        {/* ── New Client Modal ────────────────────────────────────────── */}
        <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
          <DialogContent style={{ maxWidth: 440 }}>
            <DialogTitle>Nuevo cliente</DialogTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              <input className="form-input" placeholder="Nombre *" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} />
              <input className="form-input" placeholder="Email" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder="Teléfono" style={{ flex: 1 }} value={newForm.phone} onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))} />
                <input className="form-input" placeholder="WhatsApp" style={{ flex: 1 }} value={newForm.whatsapp} onChange={e => setNewForm(f => ({ ...f, whatsapp: e.target.value }))} />
              </div>
              <Select value={newForm.client_type} onValueChange={(v: string) => setNewForm(f => ({ ...f, client_type: v as ClientType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CLIENT_TYPE_LABELS) as ClientType[]).map(t => (
                    <SelectItem key={t} value={t}>{CLIENT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button onClick={handleCreate} disabled={saving || !newForm.name.trim()}
                style={{ padding: '10px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--gold)', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: saving || !newForm.name.trim() ? 0.5 : 1 }}>
                {saving ? 'Guardando...' : 'Crear cliente'}
              </button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </>
  )
}

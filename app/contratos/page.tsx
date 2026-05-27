'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { Plus, FileText, Search, Eye, Printer, Mail, X, Calendar } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Contract = {
  id: string
  contract_number: string
  title: string
  client_name: string
  client_email: string | null
  wedding_date: string | null
  venue_name: string
  total_amount: number
  deposit_amount: number
  template: string
  status: string
  venue_signed_at: string | null
  client_signed_at: string | null
  sent_at: string | null
  created_at: string
  budget_id: string | null
  lead_id: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; badge: string }> = {
  draft:     { label: 'Borrador',   badge: 'badge-inactive' },
  sent:      { label: 'Enviado',    badge: 'badge-pending' },
  signed:    { label: 'Firmado',    badge: 'badge-active' },
  active:    { label: 'Activo',     badge: 'badge-active' },
  completed: { label: 'Completado', badge: 'badge-contacted' },
  cancelled: { label: 'Cancelado',  badge: 'badge-inactive' },
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n))
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContratosPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { isBlocked } = useRequireSubscription()

  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadData()
  }, [user, authLoading])

  const loadData = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('venue_contracts')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })

    setContracts(data ?? [])
    setLoading(false)
  }

  const filtered = contracts
    .filter(c => filterStatus === 'all' || c.status === filterStatus)
    .filter(c => !searchQuery || c.client_name.toLowerCase().includes(searchQuery.toLowerCase()) || c.contract_number.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(c => !dateFrom || c.created_at >= dateFrom)
    .filter(c => !dateTo || c.created_at <= dateTo + 'T23:59:59')

  const clearFilters = () => { setFilterStatus('all'); setSearchQuery(''); setDateFrom(''); setDateTo('') }
  const hasFilters = filterStatus !== 'all' || searchQuery || dateFrom || dateTo

  // Stats
  const active = contracts.filter(c => c.status === 'active' || c.status === 'signed').length
  const pending = contracts.filter(c => c.status === 'sent').length
  const totalValue = contracts.filter(c => ['signed', 'active', 'completed'].includes(c.status)).reduce((s, c) => s + Number(c.total_amount), 0)

  if (isBlocked) return null
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold)' }}>Cargando contratos...</div>
    </div>
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">

        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-title">Contratos</div>
          <button className="btn btn-primary btn-sm" onClick={() => router.push('/contratos/nuevo')}>
            <Plus size={13} /> Nuevo contrato
          </button>
        </div>

        <div className="page-content">

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card accent">
              <div className="stat-label">Contratos activos</div>
              <div className="stat-value">{active}</div>
              <div className="stat-sub">firmados o en vigor</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pendientes de firma</div>
              <div className="stat-value">{pending}</div>
              <div className="stat-sub">enviados</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Valor contratado</div>
              <div className="stat-value">{fmtEur(totalValue)}</div>
              <div className="stat-sub">contratos firmados</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{contracts.length}</div>
              <div className="stat-sub">contratos creados</div>
            </div>
          </div>

          {/* Filters bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <Search size={14} style={{ color: 'var(--warm-gray)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warm-gray)' }}>Filtros</span>
            <input
              className="form-input"
              placeholder="Nombre del cliente..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: '5px 10px', fontSize: 12, width: 180 }}
            />
            <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Fecha contrato:</span>
            <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '5px 8px', fontSize: 12, width: 130 }} />
            <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>&rarr;</span>
            <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '5px 8px', fontSize: 12, width: 130 }} />
            {hasFilters && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ fontSize: 11 }}>
                <X size={11} /> Limpiar
              </button>
            )}
          </div>

          {/* Table */}
          <div className="card">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Cliente</th>
                    <th>Fecha contrato</th>
                    <th>Fecha boda</th>
                    <th>Importe</th>
                    <th>Estado</th>
                    <th style={{ width: 140 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--warm-gray)' }}>
                        <FileText size={28} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                        <div style={{ fontWeight: 500 }}>No hay contratos</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>Crea tu primer contrato</div>
                        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => router.push('/contratos/nuevo')}>
                          <Plus size={12} /> Nuevo contrato
                        </button>
                      </td>
                    </tr>
                  )}
                  {filtered.map((c, idx) => {
                    const st = STATUS_MAP[c.status] ?? { label: c.status, badge: 'badge-inactive' }
                    return (
                      <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/contratos/${c.id}`)}>
                        <td style={{ fontSize: 13, color: 'var(--warm-gray)' }}>{idx + 1}</td>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{c.client_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--warm-gray)', fontFamily: 'monospace' }}>{c.contract_number}</div>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>
                          {fmtDate(c.created_at)}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>
                          {c.wedding_date ? fmtDate(c.wedding_date) : '—'}
                        </td>
                        <td style={{ fontSize: 14, fontWeight: 600 }}>{fmtEur(c.total_amount)}</td>
                        <td><span className={`badge ${st.badge}`}>{st.label}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ width: 30, height: 30, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: '#2563EB', color: 'white' }}
                              title="Ver / Imprimir"
                              onClick={() => router.push(`/contratos/${c.id}`)}
                            >
                              <Printer size={13} />
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ width: 30, height: 30, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: '#2A3D2E', color: 'white' }}
                              title="Enviar por email"
                              onClick={() => { /* TODO: send email */ }}
                            >
                              <Mail size={13} />
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ width: 30, height: 30, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: '#25D366', color: 'white' }}
                              title="Enviar por WhatsApp"
                              onClick={() => {
                                if (c.client_email) window.open(`https://wa.me/?text=Contrato ${c.contract_number}`, '_blank')
                              }}
                            >
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.214l-.252-.149-2.868.852.852-2.868-.149-.252A8 8 0 1112 20z"/></svg>
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ width: 30, height: 30, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: '#EF4444', color: 'white' }}
                              title="Eliminar"
                              onClick={async (e) => {
                                e.stopPropagation()
                                if (!confirm('¿Eliminar este contrato?')) return
                                const supabase = createClient()
                                await supabase.from('venue_contracts').delete().eq('id', c.id)
                                await loadData()
                              }}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

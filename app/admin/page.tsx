'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Search, UserPlus, Plus, X, Check, Edit2, ExternalLink } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = {
  id: string
  user_id: string
  role: string
  status: string
  wp_venue_id: number | null
  wp_username: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  company: string | null
  created_at: string
}

type Plan = {
  id: string
  name: string
  price_yearly: number
  price_monthly: number | null
  is_active: boolean
}

type Subscription = {
  id: string
  user_id: string
  plan_id: string
  billing_cycle: 'monthly' | 'yearly'
  status: 'active' | 'trial' | 'paused' | 'cancelled'
  start_date: string | null
  renewal_date: string | null
  price_paid: number | null
  notes: string | null
}

type UserVenue = {
  id: string
  user_id: string
  wp_venue_id: number
  subscription_id: string | null
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function UserPanel({
  profile,
  wpVenues,
  plans,
  subscriptions,
  userVenues,
  saving,
  onClose,
  onSaveProfile,
  onAssignVenue,
  onRemoveVenue,
  onSaveSubscription,
}: {
  profile: Profile
  wpVenues: any[]
  plans: Plan[]
  subscriptions: Subscription[]
  userVenues: UserVenue[]
  saving: boolean
  onClose: () => void
  onSaveProfile: (p: Profile) => Promise<void>
  onAssignVenue: (userId: string, wpId: number, planId: string, cycle: 'monthly' | 'yearly', price: number) => Promise<void>
  onRemoveVenue: (uvId: string) => Promise<void>
  onSaveSubscription: (sub: Partial<Subscription> & { user_id: string }) => Promise<void>
}) {
  const [tab, setTab] = useState<'perfil' | 'venues' | 'suscripcion'>('perfil')

  // Profile form
  const [pForm, setPForm] = useState({
    first_name: profile.first_name || '',
    last_name: profile.last_name || '',
    phone: profile.phone || '',
    company: profile.company || '',
  })

  // Venue assignment
  const [newVenueId, setNewVenueId]     = useState('')
  const [newPlanId, setNewPlanId]       = useState(plans[0]?.id || '')
  const [newCycle, setNewCycle]         = useState<'monthly' | 'yearly'>('yearly')
  const [newPrice, setNewPrice]         = useState('')

  // Subscription
  const activeSub = subscriptions.find(s => s.user_id === profile.user_id)
  const [subForm, setSubForm] = useState({
    plan_id: activeSub?.plan_id || plans[0]?.id || '',
    billing_cycle: (activeSub?.billing_cycle || 'yearly') as 'monthly' | 'yearly',
    status: (activeSub?.status || 'trial') as Subscription['status'],
    start_date: activeSub?.start_date || new Date().toISOString().slice(0, 10),
    renewal_date: activeSub?.renewal_date || '',
    price_paid: activeSub?.price_paid?.toString() || '',
    notes: activeSub?.notes || '',
  })

  const myVenues = userVenues.filter(v => v.user_id === profile.user_id)
  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.wp_username || profile.user_id.slice(0, 8) + '...'

  const selectedPlan = plans.find(p => p.id === newPlanId)
  useEffect(() => {
    if (selectedPlan) {
      setNewPrice(newCycle === 'yearly' ? String(selectedPlan.price_yearly) : String(selectedPlan.price_monthly || ''))
    }
  }, [newPlanId, newCycle, selectedPlan])

  const subPlan = plans.find(p => p.id === subForm.plan_id)

  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: 40, overflowY: 'auto' }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 680, maxHeight: 'none', overflow: 'visible' }}>
        <div style={{ padding: '24px 28px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600, color: 'var(--espresso)' }}>{displayName}</div>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>
              {profile.wp_username || profile.user_id.slice(0, 16) + '...'}
              {activeSub && (
                <span className={`badge ${activeSub.status === 'active' ? 'badge-active' : activeSub.status === 'trial' ? 'badge-pending' : 'badge-inactive'}`} style={{ marginLeft: 8 }}>
                  {activeSub.status}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 20 }}>
          {(['perfil', 'venues', 'suscripcion'] as const).map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'perfil' ? 'Perfil' : t === 'venues' ? `Venues (${myVenues.length})` : 'Suscripción'}
            </button>
          ))}
        </div>

        {/* ── Perfil tab ── */}
        {tab === 'perfil' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input className="form-input" value={pForm.first_name} onChange={e => setPForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Nombre" />
              </div>
              <div className="form-group">
                <label className="form-label">Apellidos</label>
                <input className="form-input" value={pForm.last_name} onChange={e => setPForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Apellidos" />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input className="form-input" value={pForm.phone} onChange={e => setPForm(f => ({ ...f, phone: e.target.value }))} placeholder="+34 600 000 000" />
              </div>
              <div className="form-group">
                <label className="form-label">Empresa / Hotel</label>
                <input className="form-input" value={pForm.company} onChange={e => setPForm(f => ({ ...f, company: e.target.value }))} placeholder="Nombre del hotel o empresa" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Estado de cuenta</label>
              <div style={{ fontSize: 12, color: 'var(--charcoal)', padding: '8px 0' }}>
                <span className={`badge ${profile.status === 'active' ? 'badge-active' : profile.status === 'pending' ? 'badge-pending' : 'badge-inactive'}`}>{profile.status}</span>
                <span style={{ marginLeft: 10, color: 'var(--warm-gray)' }}>Creado {new Date(profile.created_at).toLocaleDateString('es-ES')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-primary" disabled={saving} onClick={() => onSaveProfile({ ...profile, ...pForm })}>
                <Check size={13} /> {saving ? 'Guardando...' : 'Guardar perfil'}
              </button>
            </div>
          </div>
        )}

        {/* ── Venues tab ── */}
        {tab === 'venues' && (
          <div>
            {/* Existing venues */}
            {myVenues.length === 0 ? (
              <div style={{ color: 'var(--warm-gray)', fontSize: 13, marginBottom: 20 }}>Sin venues asignados.</div>
            ) : (
              <div style={{ marginBottom: 20 }}>
                {myVenues.map(uv => {
                  const wpV = wpVenues.find(v => v.id === uv.wp_venue_id)
                  const sub = subscriptions.find(s => s.id === uv.subscription_id)
                  const plan = plans.find(p => p.id === sub?.plan_id)
                  return (
                    <div key={uv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--cream)', borderRadius: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{wpV ? (wpV.acf?.H1_Venue || wpV.title?.rendered) : `WP #${uv.wp_venue_id}`}</div>
                        {plan && <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{plan.name} · {sub?.billing_cycle === 'yearly' ? 'Anual' : 'Mensual'}</div>}
                      </div>
                      {wpV?.link && (
                        <a href={wpV.link} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={11} /></a>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => onRemoveVenue(uv.id)} title="Quitar venue">
                        <X size={13} style={{ color: '#c0392b' }} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add new venue */}
            <div style={{ padding: 16, border: '1px dashed var(--ivory)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 12 }}>Asignar nuevo venue</div>
              <div className="form-group">
                <label className="form-label">Venue (WordPress)</label>
                <select className="form-input" value={newVenueId} onChange={e => setNewVenueId(e.target.value)}>
                  <option value="">{wpVenues.length === 0 ? 'Cargando...' : 'Selecciona venue...'}</option>
                  {wpVenues.map(v => (
                    <option key={v.id} value={v.id}>{v.acf?.H1_Venue || v.title?.rendered} (#{v.id})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Plan</label>
                  <select className="form-input" value={newPlanId} onChange={e => setNewPlanId(e.target.value)}>
                    <option value="">Sin plan</option>
                    {plans.filter(p => p.is_active).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Ciclo</label>
                  <select className="form-input" value={newCycle} onChange={e => setNewCycle(e.target.value as 'monthly' | 'yearly')}>
                    <option value="yearly">Anual</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Precio (€)</label>
                  <input className="form-input" type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="0" />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!newVenueId || saving}
                  onClick={() => onAssignVenue(profile.user_id, parseInt(newVenueId), newPlanId, newCycle, parseFloat(newPrice) || 0).then(() => { setNewVenueId(''); setNewPrice('') })}
                >
                  <Plus size={12} /> Asignar venue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Suscripción tab ── */}
        {tab === 'suscripcion' && (
          <div>
            {activeSub && (
              <div className={`alert ${activeSub.status === 'active' ? 'alert-success' : 'alert-info'}`} style={{ fontSize: 12, marginBottom: 16 }}>
                Suscripción {activeSub.status === 'active' ? 'activa' : activeSub.status}
                {activeSub.renewal_date && ` · Renovación: ${new Date(activeSub.renewal_date).toLocaleDateString('es-ES')}`}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Plan</label>
                <select className="form-input" value={subForm.plan_id} onChange={e => setSubForm(f => ({ ...f, plan_id: e.target.value }))}>
                  <option value="">Sin plan</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Ciclo de pago</label>
                <select className="form-input" value={subForm.billing_cycle} onChange={e => setSubForm(f => ({ ...f, billing_cycle: e.target.value as 'monthly' | 'yearly' }))}>
                  <option value="yearly">Anual — {subPlan?.price_yearly ?? '?'}€</option>
                  <option value="monthly">Mensual — {subPlan?.price_monthly ?? '?'}€/mes</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Estado</label>
                <select className="form-input" value={subForm.status} onChange={e => setSubForm(f => ({ ...f, status: e.target.value as Subscription['status'] }))}>
                  <option value="trial">Trial</option>
                  <option value="active">Activo (pagado)</option>
                  <option value="paused">Pausado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Precio cobrado (€)</label>
                <input className="form-input" type="number" value={subForm.price_paid} onChange={e => setSubForm(f => ({ ...f, price_paid: e.target.value }))} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha inicio</label>
                <input className="form-input" type="date" value={subForm.start_date} onChange={e => setSubForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha renovación</label>
                <input className="form-input" type="date" value={subForm.renewal_date} onChange={e => setSubForm(f => ({ ...f, renewal_date: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notas internas</label>
              <textarea className="form-textarea" style={{ minHeight: 60 }} value={subForm.notes} onChange={e => setSubForm(f => ({ ...f, notes: e.target.value }))} placeholder="Forma de pago, descuentos, observaciones..." />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                disabled={saving || !subForm.plan_id}
                onClick={() => onSaveSubscription({ ...subForm, user_id: profile.user_id, id: activeSub?.id, price_paid: parseFloat(subForm.price_paid) || null })}
              >
                <Check size={13} /> {saving ? 'Guardando...' : activeSub ? 'Actualizar suscripción' : 'Crear suscripción'}
              </button>
            </div>
          </div>
        )}
        </div>{/* end padding wrapper */}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [loading, setLoading]           = useState(true)
  const [profiles, setProfiles]         = useState<Profile[]>([])
  const [wpVenues, setWpVenues]         = useState<any[]>([])
  const [plans, setPlans]               = useState<Plan[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [userVenues, setUserVenues]     = useState<UserVenue[]>([])
  const [saving, setSaving]             = useState(false)
  const [success, setSuccess]           = useState('')
  const [error, setError]               = useState('')
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selected, setSelected]         = useState<Profile | null>(null)

  const notify = (msg: string, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => { setSuccess(''); setError('') }, 4000)
  }

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: me } = await supabase.from('venue_profiles').select('role').eq('user_id', session.user.id).single()
      if (me?.role !== 'admin') { router.push('/dashboard'); return }

      const [{ data: all }, { data: plansData }, { data: subsData }, { data: uvData }] = await Promise.all([
        supabase.from('venue_profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('venue_plans').select('id, name, price_yearly, price_monthly, is_active').eq('is_active', true),
        supabase.from('venue_subscriptions').select('*'),
        supabase.from('user_venues').select('*'),
      ])

      if (all)       setProfiles(all)
      if (plansData) setPlans(plansData)
      if (subsData)  setSubscriptions(subsData)
      if (uvData)    setUserVenues(uvData)

      try {
        const res = await fetch('https://weddingvenuesspain.com/wp-json/wp/v2/venues?per_page=100&acf_format=standard&_fields=id,title,acf,link', { cache: 'no-store' })
        if (res.ok) { const d = await res.json(); setWpVenues(Array.isArray(d) ? d : []) }
      } catch {}

      setLoading(false)
    }
    init()
  }, [user, profile, authLoading, router])

  const handleSaveProfile = async (updated: Profile) => {
    setSaving(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('venue_profiles').update({
      first_name: updated.first_name, last_name: updated.last_name,
      phone: updated.phone, company: updated.company,
    }).eq('user_id', updated.user_id)
    if (err) { notify('Error al guardar perfil', true) }
    else {
      setProfiles(p => p.map(x => x.user_id === updated.user_id ? { ...x, ...updated } : x))
      setSelected(updated)
      notify('Perfil actualizado ✓')
    }
    setSaving(false)
  }

  const handleAssignVenue = async (userId: string, wpId: number, planId: string, cycle: 'monthly' | 'yearly', price: number) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/assign-venue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, wp_venue_id: wpId, plan_id: planId || null, billing_cycle: cycle, price: price || null }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.error || 'Error al asignar venue', true); setSaving(false); return }

      // Update local state with fresh data from server
      if (data.user_venues) setUserVenues(p => [...p.filter(v => v.user_id !== userId), ...data.user_venues])
      if (data.profile) setProfiles(p => p.map(x => x.user_id === userId ? { ...x, ...data.profile } : x))
      if (data.subscription_id) {
        const supabase = createClient()
        const { data: subData } = await supabase.from('venue_subscriptions').select('*').eq('user_id', userId)
        if (subData) setSubscriptions(p => [...p.filter(s => s.user_id !== userId), ...subData])
      }
      notify('Venue asignado ✓')
    } catch (e: any) { notify(e.message || 'Error al asignar venue', true) }
    setSaving(false)
  }

  const handleRemoveVenue = async (uvId: string) => {
    try {
      const res = await fetch('/api/admin/assign-venue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uv_id: uvId }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.error || 'Error al eliminar venue', true); return }
      setUserVenues(p => p.filter(x => x.id !== uvId))
      // Update profile state with fresh data from server (clears wp_venue_id if no venues left)
      if (data.profile) setProfiles(p => p.map(x => x.user_id === data.user_id ? { ...x, ...data.profile } : x))
      notify('Venue eliminado')
    } catch (e: any) { notify(e.message || 'Error al eliminar venue', true) }
  }

  const handleSaveSubscription = async (sub: Partial<Subscription> & { user_id: string }) => {
    setSaving(true)
    const supabase = createClient()
    try {
      if (sub.id) {
        const { data } = await supabase.from('venue_subscriptions').update(sub).eq('id', sub.id).select().single()
        if (data) setSubscriptions(p => p.map(x => x.id === sub.id ? data : x))
      } else {
        const { data } = await supabase.from('venue_subscriptions').insert(sub).select().single()
        if (data) setSubscriptions(p => [...p, data])
      }
      notify('Suscripción guardada ✓')
    } catch { notify('Error al guardar suscripción', true) }
    setSaving(false)
  }

  const handleToggle = async (userId: string, status: string) => {
    const next = status === 'active' ? 'inactive' : 'active'
    const supabase = createClient()
    await supabase.from('venue_profiles').update({ status: next }).eq('user_id', userId)
    setProfiles(p => p.map(x => x.user_id === userId ? { ...x, status: next } : x))
  }

  const getVenueName = (id: number | null) => {
    if (!id) return null
    const v = wpVenues.find(v => v.id === id)
    return v ? (v.acf?.H1_Venue || v.title?.rendered || `WP #${id}`) : `WP #${id}`
  }

  const owners = profiles.filter(p => p.role !== 'admin')
  const filtered = owners.filter(p => {
    const matchS = filterStatus === 'all' || p.status === filterStatus
    const name   = [p.first_name, p.last_name].filter(Boolean).join(' ').toLowerCase()
    const matchQ = !search || name.includes(search.toLowerCase()) || (p.wp_username || '').toLowerCase().includes(search.toLowerCase()) || p.user_id.includes(search.toLowerCase())
    return matchS && matchQ
  })

  const counts = {
    pending:  owners.filter(p => p.status === 'pending').length,
    active:   owners.filter(p => p.status === 'active').length,
    inactive: owners.filter(p => p.status === 'inactive').length,
  }
  const activeSubsCount = subscriptions.filter(s => s.status === 'active').length

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1A1512', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C4975A', fontFamily: 'serif', fontSize: 16 }}>Cargando...</div>
    </div>
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">CRM de venues</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="/admin/planes" className="btn btn-ghost btn-sm">Gestionar planes →</a>
            <a href="/admin/onboarding" className="btn btn-ghost btn-sm">Solicitudes →</a>
          </div>
        </div>

        <div className="page-content">
          {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}
          {error   && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{error}</div>}

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card accent">
              <div className="stat-label">Total venue owners</div>
              <div className="stat-value">{owners.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Suscripciones activas</div>
              <div className="stat-value" style={{ color: activeSubsCount > 0 ? 'var(--gold)' : undefined }}>{activeSubsCount}</div>
              <div className="stat-sub">Pagando</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Activos</div>
              <div className="stat-value">{counts.active}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Venues en WP</div>
              <div className="stat-value">{wpVenues.length}</div>
              <div className="stat-sub">{wpVenues.length > 0 ? 'Cargados ✓' : 'Sin cargar'}</div>
            </div>
          </div>

          {/* Table */}
          <div className="card">
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--ivory)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                <input className="form-input" style={{ paddingLeft: 28, fontSize: 12, padding: '7px 12px 7px 28px' }}
                  placeholder="Buscar por nombre, email o ID..."
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {([['all','Todos'], ['pending','Pendientes'], ['active','Activos'], ['inactive','Inactivos']] as [string,string][]).map(([k, label]) => (
                  <button key={k} onClick={() => setFilterStatus(k)}
                    className={`btn btn-sm ${filterStatus === k ? 'btn-primary' : 'btn-ghost'}`}>
                    {label}{k !== 'all' ? ` (${counts[k as keyof typeof counts] ?? 0})` : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Empresa</th>
                    <th>Estado</th>
                    <th>Venues asignados</th>
                    <th>Suscripción</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--warm-gray)' }}>
                      {search || filterStatus !== 'all' ? 'Sin resultados' : 'No hay venue owners registrados todavía'}
                    </td></tr>
                  )}
                  {filtered.map(p => {
                    const fullName  = [p.first_name, p.last_name].filter(Boolean).join(' ')
                    const sub       = subscriptions.find(s => s.user_id === p.user_id)
                    const plan      = plans.find(pl => pl.id === sub?.plan_id)
                    const myVenueCount = userVenues.filter(v => v.user_id === p.user_id).length
                    const primaryVenue = getVenueName(p.wp_venue_id)
                    const badgeMap: Record<string, string> = { active: 'badge-active', pending: 'badge-pending', inactive: 'badge-inactive' }
                    const subBadgeMap: Record<string, string> = { active: 'badge-active', trial: 'badge-pending', paused: 'badge-inactive', cancelled: 'badge-inactive' }

                    return (
                      <tr key={p.user_id} style={{ cursor: 'pointer' }} onClick={() => setSelected(p)}>
                        <td>
                          {fullName ? (
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{fullName}</div>
                          ) : (
                            <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--charcoal)' }}>{p.user_id.slice(0, 12)}...</div>
                          )}
                          {p.wp_username && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{p.wp_username}</div>}
                          {p.phone && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>📞 {p.phone}</div>}
                          <div style={{ fontSize: 10, color: 'var(--stone)', marginTop: 1 }}>{new Date(p.created_at).toLocaleDateString('es-ES')}</div>
                        </td>
                        <td style={{ fontSize: 12 }}>{p.company || '—'}</td>
                        <td><span className={`badge ${badgeMap[p.status] || ''}`}>{p.status}</span></td>
                        <td style={{ fontSize: 12 }}>
                          {myVenueCount > 0 ? (
                            <div>
                              <div style={{ fontWeight: 500 }}>{primaryVenue}</div>
                              {myVenueCount > 1 && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>+{myVenueCount - 1} más</div>}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--warm-gray)' }}>Sin asignar</span>
                          )}
                        </td>
                        <td>
                          {sub && plan ? (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 500 }}>{plan.name}</div>
                              <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
                                <span className={`badge ${subBadgeMap[sub.status] || 'badge-inactive'}`} style={{ fontSize: 10 }}>{sub.status}</span>
                                <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{sub.billing_cycle === 'yearly' ? 'Anual' : 'Mensual'}</span>
                              </div>
                              {sub.renewal_date && (
                                <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 2 }}>
                                  Renueva {new Date(sub.renewal_date).toLocaleDateString('es-ES')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--warm-gray)', fontSize: 12 }}>Sin plan</span>
                          )}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(p)}>
                              <Edit2 size={11} /> Editar
                            </button>
                            <button
                              className={`btn btn-sm ${p.status === 'active' ? 'btn-ghost' : 'btn-ghost'}`}
                              style={{ color: p.status === 'active' ? '#c0392b' : undefined }}
                              onClick={() => handleToggle(p.user_id, p.status)}
                            >
                              {p.status === 'active' ? 'Desactivar' : 'Activar'}
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

      {/* User detail panel */}
      {selected && (
        <UserPanel
          profile={selected}
          wpVenues={wpVenues}
          plans={plans}
          subscriptions={subscriptions}
          userVenues={userVenues}
          saving={saving}
          onClose={() => setSelected(null)}
          onSaveProfile={handleSaveProfile}
          onAssignVenue={handleAssignVenue}
          onRemoveVenue={handleRemoveVenue}
          onSaveSubscription={handleSaveSubscription}
        />
      )}
    </div>
  )
}

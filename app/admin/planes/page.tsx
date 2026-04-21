'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Plus, Edit2, ToggleLeft, ToggleRight, ArrowLeft, Trash2, Check, X, Eye, EyeOff, Users, AlertTriangle, Clock, Landmark as LandmarkIcon, ClipboardList, Search } from 'lucide-react'
import type { PlanFeatures } from '@/lib/use-plan-features'
import { type BillingCycle, EMPTY_CYCLE, CYCLE_PRESETS } from '@/lib/billing-types'

// ─── Feature definitions (imported from lib) ─────────────────────────────────
import { FEATURE_DEFS, BASIC_FALLBACK, PREMIUM_FALLBACK } from '@/lib/use-plan-features'

const PERMISSIONS_BASIC   = BASIC_FALLBACK
const PERMISSIONS_PREMIUM = PREMIUM_FALLBACK

// ─── Types ────────────────────────────────────────────────────────────────────

type TrialConfig = {
  is_active: boolean
  trial_days: number
  trial_plan_id: string | null
}

type TargetRole = 'venue_owner' | 'wedding_planner' | 'catering'

type Plan = {
  id: string
  name: string
  display_name: string | null
  description: string | null
  trial_days: number
  billing_cycles: BillingCycle[]
  permissions: PlanFeatures | null
  is_active: boolean
  visible_on_web: boolean
  target_role: TargetRole
  created_at: string
  // loaded client-side
  subscriber_count?: number
}

type PlanForm = Omit<Plan, 'id' | 'created_at' | 'subscriber_count'>

const EMPTY_PLAN: PlanForm = {
  name: '', display_name: '', description: '',
  trial_days: 14,
  billing_cycles: [
    { id: 'yearly', label: 'Anual', price: 350, interval_months: 12, commitment_months: 12, cancel_notice_days: 15 },
  ],
  permissions: { ...PERMISSIONS_BASIC },
  is_active: true,
  visible_on_web: true,
  target_role: 'venue_owner',
}

// ─── Billing cycle row editor ─────────────────────────────────────────────────

function CycleRow({
  cycle, index, onChange, onDelete,
}: {
  cycle: BillingCycle
  index: number
  onChange: (updated: BillingCycle) => void
  onDelete: () => void
}) {
  const set = (k: keyof BillingCycle, v: any) => onChange({ ...cycle, [k]: v })
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '90px 110px 80px 70px 80px 70px 32px',
      gap: 6, alignItems: 'end', padding: '10px 12px',
      background: index % 2 === 0 ? 'var(--cream)' : '#fff',
      borderRadius: 8, marginBottom: 6, border: '1px solid var(--ivory)',
    }}>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}>Slug *</label>
        <input className="form-input" style={{ fontSize: 12 }} value={cycle.id}
          onChange={e => set('id', e.target.value.toLowerCase().replace(/\s/g, '_'))}
          placeholder="yearly" />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}>Etiqueta *</label>
        <input className="form-input" style={{ fontSize: 12 }} value={cycle.label}
          onChange={e => set('label', e.target.value)} placeholder="Anual" />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}>Precio (€)</label>
        <input className="form-input" style={{ fontSize: 12 }} type="number" value={cycle.price}
          onChange={e => set('price', parseFloat(e.target.value) || 0)} />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}>Cada (meses)</label>
        <input className="form-input" style={{ fontSize: 12 }} type="number" min={1} value={cycle.interval_months}
          onChange={e => set('interval_months', parseInt(e.target.value) || 1)} />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}>Compromiso (meses)</label>
        <input className="form-input" style={{ fontSize: 12 }} type="number" min={0} value={cycle.commitment_months}
          onChange={e => set('commitment_months', parseInt(e.target.value) || 0)} />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}>Preaviso (días)</label>
        <input className="form-input" style={{ fontSize: 12 }} type="number" min={0} value={cycle.cancel_notice_days}
          onChange={e => set('cancel_notice_days', parseInt(e.target.value) || 15)} />
      </div>
      <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', color: '#c0392b', marginTop: 16 }}>
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Feature row ─────────────────────────────────────────────────────────────

function FeatureRow({ def, checked, onChange }: { def: import('@/lib/use-plan-features').FeatureDef; checked: boolean; onChange: (v: boolean) => void }) {
  const isRestriction = def.tier === 'restriction'
  const isPremium     = def.tier === 'premium'
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 6,
      cursor: 'pointer', marginBottom: 5,
      background: checked ? (isRestriction ? '#fff5f5' : isPremium ? '#fef9ec' : '#f0fdf4') : '#f8f8f8',
      border: `1px solid ${checked ? (isRestriction ? '#fca5a5' : isPremium ? '#fde68a' : '#bbf7d0') : 'var(--ivory)'}`,
    }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ marginTop: 2, width: 15, height: 15, accentColor: isRestriction ? '#dc2626' : 'var(--gold)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--espresso)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {def.label}
          {isRestriction && <span style={{ fontSize: 9, background: '#fee2e2', color: '#dc2626', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>RESTRICCIÓN ⚠️</span>}
          {isPremium && <span style={{ fontSize: 9, background: '#fef9ec', color: '#92400e', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>PREMIUM</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{def.description}</div>
        {isRestriction && checked && (
          <div style={{ fontSize: 10, color: '#dc2626', marginTop: 4, fontStyle: 'italic' }}>
            ⚠️ Esta restricción LIMITA al usuario. Actívala con cuidado.
          </div>
        )}
      </div>
    </label>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlanesPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans]     = useState<Plan[]>([])
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<Plan | null>(null)
  const [form, setForm]           = useState<PlanForm>(EMPTY_PLAN)
  const [confirmDelete, setConfirmDelete] = useState<Plan | null>(null)
  const [deactivateWarning, setDeactivateWarning] = useState<Plan | null>(null)
  const [plansTab, setPlansTab]           = useState<TargetRole>('venue_owner')

  // Trial config state
  const [trialConfig, setTrialConfig]       = useState<TrialConfig>({ is_active: true, trial_days: 14, trial_plan_id: null })
  const [trialSaving, setTrialSaving]       = useState(false)
  const [trialSuccess, setTrialSuccess]     = useState('')

  useEffect(() => {
    if (authLoading) return
    const CACHE_KEY = 'wvs_admin_planes'

    // Stale-while-revalidate: show cached data instantly
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        const c = JSON.parse(cached)
        if (c.plans) setPlans(c.plans)
        if (c.trialConfig) setTrialConfig(c.trialConfig)
        setLoading(false)
      }
    } catch {}

    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: me } = await supabase.from('venue_profiles').select('role').eq('user_id', session.user.id).single()
      if (me?.role !== 'admin') { router.push('/dashboard'); return }

      // Load plans and trial config in parallel
      const trialController = new AbortController()
      const trialTimeout = setTimeout(() => trialController.abort(), 6000)
      const [plansResult, trialResult] = await Promise.all([
        supabase.from('venue_plans').select('*').order('created_at', { ascending: true }),
        fetch('/api/admin/trial-config', { signal: trialController.signal }).then(r => r.json()).catch(() => ({})),
      ])
      clearTimeout(trialTimeout)

      let enrichedPlans: Plan[] = []
      if (plansResult.data) {
        const { data: subCounts } = await supabase
          .from('venue_subscriptions')
          .select('plan_id')
          .in('status', ['active', 'trial', 'paused'])
        const countMap: Record<string, number> = {}
        subCounts?.forEach(s => { countMap[s.plan_id] = (countMap[s.plan_id] || 0) + 1 })
        enrichedPlans = plansResult.data.map((p: Plan) => ({ ...p, subscriber_count: countMap[p.id] || 0 }))
        setPlans(enrichedPlans)
      }

      if (trialResult.config) {
        setTrialConfig(trialResult.config)
      }

      // Auto-select most basic plan if none configured yet
      if (plansResult.data && !trialResult.config?.trial_plan_id) {
        const basicPlan = plansResult.data.find((p: any) =>
          p.name === 'basic' || p.name.toLowerCase().includes('basic')
        ) ?? plansResult.data.find((p: any) => p.is_active)
        if (basicPlan) {
          setTrialConfig(c => ({ ...c, trial_plan_id: basicPlan.id }))
        }
      }

      setLoading(false)

      // Persist to cache for next visit
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        plans: enrichedPlans, trialConfig: trialResult?.config || null,
      }))
    }
    init()
  }, [authLoading]) // eslint-disable-line

  const handleSaveTrialConfig = async () => {
    setTrialSaving(true)
    try {
      const res = await fetch('/api/admin/trial-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trialConfig),
      })
      const result = await res.json()
      if (!res.ok) { notify(result.error || 'Error al guardar configuración', true); return }
      setTrialConfig(result.config)
      setTrialSuccess('Configuración guardada ✓')
      setTimeout(() => setTrialSuccess(''), 3000)
    } catch (e: any) {
      notify(e?.message || 'Error', true)
    }
    setTrialSaving(false)
  }

  const notify = (msg: string, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => { setSuccess(''); setError('') }, 4000)
  }

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY_PLAN, target_role: plansTab, billing_cycles: [{ ...CYCLE_PRESETS[0] }], permissions: { ...PERMISSIONS_BASIC } }); setShowModal(true) }
  const openEdit = (plan: Plan) => {
    setEditing(plan)
    setForm({
      name: plan.name, display_name: plan.display_name || '',
      description: plan.description || '', trial_days: plan.trial_days ?? 14,
      billing_cycles: plan.billing_cycles?.length ? plan.billing_cycles : [{ ...CYCLE_PRESETS[0] }],
      permissions: plan.permissions ?? { ...PERMISSIONS_BASIC },
      is_active: plan.is_active,
      visible_on_web: plan.visible_on_web ?? true,
      target_role: plan.target_role ?? 'venue_owner',
    })
    setShowModal(true)
  }

  const setCycles = (fn: (c: BillingCycle[]) => BillingCycle[]) =>
    setForm(f => ({ ...f, billing_cycles: fn(f.billing_cycles) }))
  const setPermission = (key: keyof PlanFeatures, value: boolean) =>
    setForm(f => ({ ...f, permissions: { ...(f.permissions ?? {}), [key]: value } as PlanFeatures }))
  const applyPreset = (preset: PlanFeatures) =>
    setForm(f => ({ ...f, permissions: { ...preset } }))

  const handleSave = async () => {
    if (!form.name.trim()) { notify('El slug del plan es obligatorio', true); return }
    if (!form.billing_cycles.length) { notify('Añade al menos un ciclo de pago', true); return }
    if (form.billing_cycles.some(c => !c.id || !c.label)) { notify('Cada ciclo necesita slug y etiqueta', true); return }
    setSaving(true)
    const supabase = createClient()
    const payload = {
      name:           form.name.trim(),
      display_name:   form.display_name?.trim() || null,
      description:    form.description || null,
      trial_days:     form.trial_days || 14,
      billing_cycles: form.billing_cycles,
      permissions:    form.permissions || PERMISSIONS_BASIC,
      is_active:      form.is_active,
      visible_on_web: form.visible_on_web,
      target_role:    form.target_role || 'venue_owner',
    }
    try {
      if (editing) {
        const { data, error: err } = await supabase.from('venue_plans').update(payload).eq('id', editing.id).select().single()
        if (err) throw err
        setPlans(p => p.map(x => x.id === editing.id ? data : x))
        notify('Plan actualizado ✓')
      } else {
        const { data, error: err } = await supabase.from('venue_plans').insert(payload).select().single()
        if (err) throw err
        setPlans(p => [...p, data])
        notify('Plan creado ✓')
      }
      setShowModal(false)
    } catch (e: any) { notify(e?.message || 'Error al guardar', true) }
    setSaving(false)
  }

  // Toggle is_active — warns if plan has subscribers
  const handleToggleActive = async (plan: Plan) => {
    const nextActive = !plan.is_active
    // If deactivating and has subscribers → show warning first
    if (!nextActive && (plan.subscriber_count ?? 0) > 0) {
      setDeactivateWarning(plan)
      return
    }
    await patchPlan(plan.id, { is_active: nextActive })
  }

  // Toggle visible_on_web — no warning needed
  const handleToggleWeb = async (plan: Plan) => {
    await patchPlan(plan.id, { visible_on_web: !plan.visible_on_web })
  }

  const patchPlan = async (id: string, fields: Record<string, any>) => {
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...fields }),
      })
      const result = await res.json()
      if (!res.ok) { notify(result.error || 'Error al actualizar plan', true); return }
      setPlans(p => p.map(x => x.id === id ? { ...x, ...fields } : x))
    } catch (e: any) { notify(e.message || 'Error', true) }
  }

  const handleDelete = async (plan: Plan) => {
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plan.id }),
      })
      const result = await res.json()
      if (!res.ok) { notify(result.error || 'Error al eliminar', true); setConfirmDelete(null); return }
      setPlans(p => p.filter(x => x.id !== plan.id))
      setConfirmDelete(null)
      notify('Plan eliminado ✓')
    } catch (e: any) { notify(e.message || 'Error', true) }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 24, height: 24, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/admin" className="btn btn-ghost btn-sm"><ArrowLeft size={13} /> CRM</a>
            <div className="topbar-title">Planes y funcionalidades</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <Plus size={13} /> Nuevo plan
          </button>
        </div>

        {/* User type tabs */}
        <div style={{ display: 'flex', gap: 2, padding: '0 24px', borderBottom: '1px solid var(--ivory)', background: '#fff' }}>
          {([
            { key: 'venue_owner',     label: 'Venues' },
            { key: 'wedding_planner', label: 'Planners' },
            { key: 'catering',        label: 'Catering' },
          ] as { key: TargetRole; label: string }[]).map(tab => (
            <button key={tab.key} onClick={() => setPlansTab(tab.key)}
              style={{
                padding: '10px 18px', fontSize: 13, fontWeight: plansTab === tab.key ? 600 : 400,
                color: plansTab === tab.key ? 'var(--gold)' : 'var(--warm-gray)',
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                borderBottom: plansTab === tab.key ? '2px solid var(--gold)' : '2px solid transparent',
                background: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', marginBottom: -1,
              }}>
              {tab.label} <span style={{ fontSize: 11, opacity: 0.6 }}>({plans.filter(p => (p.target_role ?? 'venue_owner') === tab.key).length})</span>
            </button>
          ))}
        </div>

        <div className="page-content">
          {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}
          {error   && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{error}</div>}

          {/* ── Trial config section ─────────────────────────────────────────── */}
          <div className="card" style={{ marginBottom: 28, border: trialConfig.is_active ? '1px solid rgba(196,151,90,0.3)' : '1px solid var(--ivory)' }}>
            <div className="card-body" style={{ padding: '20px 24px' }}>

              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: trialConfig.is_active ? 'rgba(196,151,90,0.12)' : 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={16} color={trialConfig.is_active ? 'var(--gold)' : 'var(--warm-gray)'} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--espresso)', fontFamily: 'Manrope, sans-serif' }}>
                      Prueba gratuita (Trial)
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>
                      Se activa automáticamente al aceptar un venue
                    </div>
                  </div>
                </div>

                {/* Master toggle — big and clear */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', padding: '8px 14px', borderRadius: 8, background: trialConfig.is_active ? '#f0fdf4' : '#f9fafb', border: `1px solid ${trialConfig.is_active ? '#bbf7d0' : 'var(--ivory)'}` }}>
                  <input
                    type="checkbox"
                    checked={trialConfig.is_active}
                    onChange={e => setTrialConfig(c => ({ ...c, is_active: e.target.checked }))}
                    style={{ width: 15, height: 15, accentColor: '#16a34a' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: trialConfig.is_active ? '#15803d' : 'var(--warm-gray)' }}>
                    {trialConfig.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </label>
              </div>

              {/* Main controls */}
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, opacity: trialConfig.is_active ? 1 : 0.45, pointerEvents: trialConfig.is_active ? 'auto' : 'none' }}>

                {/* Days — prominent */}
                <div style={{ background: 'var(--cream)', borderRadius: 10, border: '1px solid var(--ivory)', padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Duración</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={trialConfig.trial_days}
                    onChange={e => setTrialConfig(c => ({ ...c, trial_days: parseInt(e.target.value) || 14 }))}
                    style={{ width: '100%', padding: '4px 0', border: 'none', background: 'transparent', fontSize: 32, fontWeight: 700, color: 'var(--gold)', textAlign: 'center', fontFamily: 'Manrope, sans-serif', outline: 'none' }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>días</span>
                </div>

                {/* Right side: plan selector + note */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Plan asignado durante el trial</label>
                    <select
                      className="form-input"
                      value={trialConfig.trial_plan_id ?? ''}
                      onChange={e => setTrialConfig(c => ({ ...c, trial_plan_id: e.target.value || null }))}
                    >
                      <option value="">Sin plan específico — acceso Premium completo</option>
                      {plans.filter(p => p.is_active).map(p => (
                        <option key={p.id} value={p.id}>{p.display_name || p.name}</option>
                      ))}
                      {plans.some(p => !p.is_active) && <option disabled>── Planes inactivos ──</option>}
                      {plans.filter(p => !p.is_active).map(p => (
                        <option key={p.id} value={p.id}>{p.display_name || p.name} (inactivo)</option>
                      ))}
                    </select>
                  </div>

                  {/* Dynamic summary pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(196,151,90,0.07)', border: '1px solid rgba(196,151,90,0.2)' }}>
                    <Clock size={12} color="var(--gold)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
                      Al activar un venue, se crea automáticamente un trial de{' '}
                      <strong style={{ color: 'var(--charcoal)' }}>{trialConfig.trial_days} días</strong>
                      {' '}con{' '}
                      <strong style={{ color: 'var(--charcoal)' }}>
                        {trialConfig.trial_plan_id
                          ? `plan "${plans.find(p => p.id === trialConfig.trial_plan_id)?.display_name || plans.find(p => p.id === trialConfig.trial_plan_id)?.name}"`
                          : 'acceso Premium completo'}
                      </strong>.
                      {' '}Si el venue ya contrató un plan, el trial no se crea.
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--ivory)' }}>
                {trialSuccess && (
                  <span style={{ fontSize: 12, color: '#15803d', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={13} /> {trialSuccess}
                  </span>
                )}
                <button className="btn btn-primary btn-sm" onClick={handleSaveTrialConfig} disabled={trialSaving}>
                  {trialSaving ? 'Guardando...' : 'Guardar configuración'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Plans section header ─────────────────────────────────────────── */}
          {plans.filter(p => (p.target_role ?? 'venue_owner') === plansTab).length === 0 && (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ color: 'var(--warm-gray)', marginBottom: 16 }}>Aún no hay planes para este tipo de usuario.</div>
              <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={13} /> Crear plan</button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {plans.filter(p => (p.target_role ?? 'venue_owner') === plansTab).map(plan => {
              const perms: Record<string, unknown> = plan.permissions ?? {}
              const enabled  = FEATURE_DEFS.filter(f => !f.dangerous && perms[f.key] === true)
              const restricted = FEATURE_DEFS.filter(f => f.dangerous && perms[f.key] === true)
              const cycles   = plan.billing_cycles ?? []
              return (
                <div key={plan.id} className="card" style={{ opacity: plan.is_active ? 1 : 0.6 }}>
                  <div className="card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 600, fontFamily: 'Manrope, sans-serif', color: 'var(--espresso)' }}>
                          {plan.display_name || plan.name}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--warm-gray)', fontFamily: 'monospace', marginTop: 1 }}>slug: {plan.name}</div>
                        {plan.description && <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 3 }}>{plan.description}</div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                        <span className={`badge ${plan.is_active ? 'badge-active' : 'badge-inactive'}`}>
                          {plan.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          {(plan.subscriber_count ?? 0) > 0 && (
                            <span style={{ fontSize: 10, background: '#f0f9ff', color: '#0369a1', padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>
                              <Users size={9} style={{ display: 'inline', marginRight: 3 }} />
                              {plan.subscriber_count} suscriptor{plan.subscriber_count !== 1 ? 'es' : ''}
                            </span>
                          )}
                          <span style={{
                            fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 600,
                            background: plan.visible_on_web ? '#f0fdf4' : '#f9fafb',
                            color: plan.visible_on_web ? '#16a34a' : '#9ca3af',
                          }}>
                            {plan.visible_on_web ? <><Eye size={9} style={{ display: 'inline', marginRight: 3 }} />En web</> : <><EyeOff size={9} style={{ display: 'inline', marginRight: 3 }} />Oculto web</>}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Billing cycles */}
                    {cycles.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 7 }}>
                          Ciclos de pago
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {cycles.map(c => (
                            <div key={c.id} style={{ background: 'var(--cream)', borderRadius: 8, padding: '8px 14px', textAlign: 'center', minWidth: 80 }}>
                              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)', fontFamily: 'Manrope, sans-serif' }}>{c.price}€</div>
                              <div style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{c.label}</div>
                              {c.commitment_months > 0 && (
                                <div style={{ fontSize: 9, color: 'var(--warm-gray)', marginTop: 2 }}>{c.commitment_months}m mín.</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Trial (global) */}
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 12 }}>
                      <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
                      {' '}Trial global:{' '}
                      <strong style={{ color: trialConfig.is_active ? 'var(--gold)' : 'var(--warm-gray)' }}>
                        {trialConfig.is_active ? `${trialConfig.trial_days} días` : 'desactivado'}
                      </strong>
                      &nbsp;·&nbsp; <LandmarkIcon size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> Domiciliación SEPA
                      &nbsp;·&nbsp; Preaviso: <strong>{cycles[0]?.cancel_notice_days ?? 15} días</strong>
                    </div>

                    {/* Features */}
                    {enabled.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Funcionalidades</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {enabled.map(f => (
                            <span key={f.key} style={{
                              fontSize: 11, padding: '2px 8px', borderRadius: 20,
                              background: f.tier === 'premium' ? '#fef9ec' : '#f0fdf4',
                              color:      f.tier === 'premium' ? '#92400e'  : '#16a34a',
                              border: `1px solid ${f.tier === 'premium' ? '#fde68a' : '#bbf7d0'}`,
                              fontWeight: 500,
                            }}>✓ {f.label}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {restricted.length > 0 && (
                      <div style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {restricted.map(f => (
                          <span key={f.key} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#fff5f5', color: '#dc2626', border: '1px solid #fca5a5', fontWeight: 500 }}>✕ {f.label}</span>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--ivory)' }}>
                      <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => openEdit(plan)}>
                        <Edit2 size={12} /> Editar
                      </button>
                      {/* Visible en web toggle */}
                      <button className="btn btn-ghost btn-sm" title={plan.visible_on_web ? 'Ocultar de la web' : 'Mostrar en la web'}
                        onClick={() => handleToggleWeb(plan)}>
                        {plan.visible_on_web ? <Eye size={14} style={{ color: '#16a34a' }} /> : <EyeOff size={14} style={{ color: '#9ca3af' }} />}
                      </button>
                      {/* Activar/desactivar */}
                      <button className="btn btn-ghost btn-sm" title={plan.is_active ? 'Desactivar plan' : 'Activar plan'}
                        onClick={() => handleToggleActive(plan)}>
                        {plan.is_active ? <ToggleRight size={14} style={{ color: 'var(--gold)' }} /> : <ToggleLeft size={14} />}
                      </button>
                      {/* Borrar — disabled si tiene suscriptores */}
                      <button className="btn btn-ghost btn-sm"
                        title={(plan.subscriber_count ?? 0) > 0 ? 'No se puede eliminar: tiene suscriptores activos' : 'Eliminar plan'}
                        onClick={() => (plan.subscriber_count ?? 0) === 0 && setConfirmDelete(plan)}
                        style={{ opacity: (plan.subscriber_count ?? 0) > 0 ? 0.35 : 1, cursor: (plan.subscriber_count ?? 0) > 0 ? 'not-allowed' : 'pointer' }}>
                        <Trash2 size={13} style={{ color: '#c0392b' }} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ alignItems: 'flex-start', paddingTop: 30, overflowY: 'auto' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720, maxHeight: 'none', overflow: 'visible' }}>
            <div className="modal-header">
              <div className="modal-title">{editing ? `Editar: ${editing.display_name || editing.name}` : 'Nuevo plan'}</div>
            </div>
            <div className="modal-body">

              {/* Identidad */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Slug * <span style={{ color: 'var(--warm-gray)', fontWeight: 400 }}>(ej: basic, premium)</span></label>
                  <input className="form-input" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                    placeholder="premium" />
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre visible</label>
                  <input className="form-input" value={form.display_name || ''}
                    onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                    placeholder="Premium" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descripción corta</label>
                <input className="form-input" value={form.description || ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Acceso completo a todas las funcionalidades" />
              </div>
              <div style={{ background: 'rgba(196,151,90,0.07)', border: '1px solid rgba(196,151,90,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Clock size={11} color="var(--gold)" style={{ flexShrink: 0 }} />
                El período de trial se configura globalmente en la sección <strong style={{ color: 'var(--charcoal)' }}>Prueba gratuita</strong> de esta misma página, no por plan.
              </div>

              {/* Tipo de usuario */}
              <div className="form-group" style={{ marginTop: 4 }}>
                <label className="form-label">Tipo de usuario</label>
                <select className="form-input" value={form.target_role}
                  onChange={e => setForm(f => ({ ...f, target_role: e.target.value as TargetRole }))}>
                  <option value="venue_owner">Venue / Finca</option>
                  <option value="wedding_planner">Wedding Planner</option>
                  <option value="catering">Catering</option>
                </select>
              </div>

              {/* Estado y visibilidad */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: form.is_active ? '#f0fdf4' : '#f9fafb', border: `1px solid ${form.is_active ? '#bbf7d0' : 'var(--ivory)'}`, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    style={{ width: 15, height: 15, accentColor: '#16a34a' }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: form.is_active ? '#16a34a' : 'var(--warm-gray)' }}>
                      Plan activo
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Acepta nuevas suscripciones</div>
                  </div>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: form.visible_on_web ? '#f0f9ff' : '#f9fafb', border: `1px solid ${form.visible_on_web ? '#bae6fd' : 'var(--ivory)'}`, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.visible_on_web}
                    onChange={e => setForm(f => ({ ...f, visible_on_web: e.target.checked }))}
                    style={{ width: 15, height: 15, accentColor: '#0369a1' }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: form.visible_on_web ? '#0369a1' : 'var(--warm-gray)' }}>
                      Visible en web
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Aparece en la página de precios</div>
                  </div>
                </label>
              </div>

              {/* Ciclos de pago */}
              <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 14, marginTop: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--charcoal)', letterSpacing: '.07em', textTransform: 'uppercase' }}>
                      Ciclos de pago
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>
                      Cada ciclo define un precio, intervalo de cobro y condiciones de compromiso y preaviso
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {CYCLE_PRESETS.map(preset => (
                      <button key={preset.id} type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}
                        onClick={() => setCycles(c => [...c, { ...preset }])}>
                        + {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '90px 110px 80px 70px 80px 70px 32px', gap: 6, padding: '0 12px', marginBottom: 4 }}>
                  {['Slug', 'Etiqueta', 'Precio €', 'Cada (m)', 'Compromiso (m)', 'Preaviso (d)', ''].map((h, i) => (
                    <div key={i} style={{ fontSize: 9, color: 'var(--warm-gray)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</div>
                  ))}
                </div>

                {form.billing_cycles.map((cycle, i) => (
                  <CycleRow key={i} cycle={cycle} index={i}
                    onChange={updated => setCycles(c => c.map((x, j) => j === i ? updated : x))}
                    onDelete={() => setCycles(c => c.filter((_, j) => j !== i))} />
                ))}
                {form.billing_cycles.length === 0 && (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--warm-gray)', fontSize: 12, background: 'var(--cream)', borderRadius: 8 }}>
                    Sin ciclos. Usa los botones de arriba para añadir.
                  </div>
                )}
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }}
                  onClick={() => setCycles(c => [...c, { ...EMPTY_CYCLE }])}>
                  <Plus size={11} /> Añadir ciclo personalizado
                </button>
              </div>

              {/* Funcionalidades */}
              <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 14, marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--charcoal)', letterSpacing: '.07em', textTransform: 'uppercase' }}>
                    Funcionalidades del plan
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => applyPreset(PERMISSIONS_BASIC)}>Preset Básico</button>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 10, color: '#92400e' }} onClick={() => applyPreset(PERMISSIONS_PREMIUM)}>Preset Premium</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Básicas</div>
                    {FEATURE_DEFS.filter(f => f.tier === 'basic').map(def => (
                      <FeatureRow key={def.key} def={def} checked={form.permissions?.[def.key] === true} onChange={v => setPermission(def.key, v)} />
                    ))}
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6, marginTop: 12 }}>Restricciones</div>
                    {FEATURE_DEFS.filter(f => f.tier === 'restriction').map(def => (
                      <FeatureRow key={def.key} def={def} checked={form.permissions?.[def.key] === true} onChange={v => setPermission(def.key, v)} />
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#92400e', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Premium</div>
                    {FEATURE_DEFS.filter(f => f.tier === 'premium').map(def => (
                      <FeatureRow key={def.key} def={def} checked={form.permissions?.[def.key] === true} onChange={v => setPermission(def.key, v)} />
                    ))}
                  </div>
                </div>
              </div>

            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Check size={13} /> {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm delete ── */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title">¿Eliminar «{confirmDelete.display_name || confirmDelete.name}»?</div>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 13, color: 'var(--warm-gray)' }}>
                Esta acción es irreversible. Solo se puede eliminar un plan sin suscriptores activos.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Deactivate warning (plan has subscribers) ── */}
      {deactivateWarning && (
        <div className="modal-overlay" onClick={() => setDeactivateWarning(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} style={{ color: '#b45309' }} />
                Desactivar plan con suscriptores
              </div>
            </div>
            <div className="modal-body">
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>
                  <AlertTriangle size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> {deactivateWarning.subscriber_count} suscriptor{deactivateWarning.subscriber_count !== 1 ? 'es' : ''} activo{deactivateWarning.subscriber_count !== 1 ? 's' : ''} en «{deactivateWarning.display_name || deactivateWarning.name}»
                </div>
                <ul style={{ fontSize: 12, color: '#92400e', margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.8 }}>
                  <li>Los suscriptores <strong>continúan activos hasta que acabe su ciclo</strong></li>
                  <li>No se podrán crear <strong>nuevas</strong> suscripciones en este plan</li>
                  <li>Deberás <strong>migrar manualmente</strong> cada venue a otro plan antes de su renovación</li>
                </ul>
              </div>

              {/* Step-by-step migration guide */}
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 8 }}>
                  <ClipboardList size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Cómo migrar los suscriptores (paso a paso)
                </div>
                <ol style={{ fontSize: 12, color: '#0369a1', paddingLeft: 18, lineHeight: 2, margin: 0 }}>
                  <li>Desactiva este plan (botón de abajo)</li>
                  <li>Ve al <strong>CRM de venues</strong> y filtra por «{deactivateWarning.display_name || deactivateWarning.name}»</li>
                  <li>Abre cada venue afectado → tab <strong>Suscripción</strong></li>
                  <li>Verás un banner amarillo indicando que el plan está inactivo</li>
                  <li>Selecciona el nuevo plan activo en el desplegable y guarda</li>
                  <li>Se registrará automáticamente un evento «Plan cambiado» en el historial</li>
                </ol>
              </div>

              <a
                href={`/admin?filterPlan=${deactivateWarning.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, width: '100%', justifyContent: 'center', marginBottom: 4 }}>
                <Search size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Ver los {deactivateWarning.subscriber_count} venue{deactivateWarning.subscriber_count !== 1 ? 's' : ''} afectado{deactivateWarning.subscriber_count !== 1 ? 's' : ''} en el CRM →
              </a>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeactivateWarning(null)}>Cancelar</button>
              <button className="btn btn-primary"
                style={{ background: '#b45309', borderColor: '#b45309' }}
                onClick={async () => {
                  await patchPlan(deactivateWarning.id, { is_active: false })
                  setDeactivateWarning(null)
                }}>
                Desactivar plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

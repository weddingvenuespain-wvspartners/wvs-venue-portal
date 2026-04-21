'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import {
  Search, Plus, X, Check, Edit2, ExternalLink, RefreshCw,
  AlertTriangle, CreditCard, UserPlus, Mail, Building2, History,
  Phone, Globe, MapPin, User, Calendar, Clock, Shield, StickyNote,
  Copy, CheckCircle, Settings, Landmark, Lightbulb, ClipboardList,
  Ban, CircleCheckBig, ArrowLeftRight, RotateCcw, FileText, OctagonAlert,
} from 'lucide-react'
import { type BillingCycle, advanceDateByMonths, cancelDeadline, daysUntil } from '@/lib/billing-types'

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
  address: string | null
  city: string | null
  website: string | null
  admin_notes: string | null
  created_at: string
  // enriched from auth.users
  email: string | null
  last_sign_in_at: string | null
  features_override?: Record<string, boolean | null>
}

type Plan = {
  id: string
  name: string
  display_name: string | null
  trial_days: number
  billing_cycles: BillingCycle[]
  is_active: boolean
}

type Subscription = {
  id: string
  user_id: string
  plan_id: string
  billing_cycle: string          // matches a BillingCycle.id from the plan
  status: 'active' | 'trial' | 'trial_expired' | 'paused' | 'cancelled'
  start_date: string | null
  trial_end_date: string | null
  renewal_date: string | null    // = current_period_end
  payment_reference: string | null
  // SEPA domiciliación
  iban: string | null
  account_holder: string | null
  mandate_ref: string | null
  // Cancellation
  cancel_at_period_end: boolean
  cancel_requested_at: string | null
  service_end_date: string | null   // explicit end date, no renewal
  notes: string | null
}

type UserVenue = {
  id: string
  user_id: string
  wp_venue_id: number
  subscription_id: string | null
}

type PaymentEvent = {
  id: string
  user_id: string
  subscription_id: string | null
  event_type: 'payment' | 'trial_started' | 'activated' | 'plan_changed' | 'cancelled' | 'reactivated' | 'note'
  amount: number | null
  reference: string | null
  plan_id: string | null
  billing_cycle: string | null
  notes: string | null
  created_at: string
}

type TrialConfig = {
  is_active: boolean
  trial_days: number
  trial_plan_id: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  active: 'Activo', pending: 'Pendiente', inactive: 'Inactivo',
  trial: 'Trial', trial_expired: 'Fin de trial', paused: 'Pausado', cancelled: 'Cancelado',
}
const SUB_BADGE: Record<string, string> = {
  active: 'badge-active', trial: 'badge-pending', trial_expired: 'badge-inactive',
  paused: 'badge-inactive', cancelled: 'badge-inactive',
}
const PROFILE_BADGE: Record<string, string> = {
  active: 'badge-active', pending: 'badge-pending', inactive: 'badge-inactive',
}

function planLabel(p: Plan) { return p.display_name || p.name }

function getCycle(plan: Plan | undefined, cycleId: string): BillingCycle | undefined {
  return plan?.billing_cycles?.find(c => c.id === cycleId)
}

// Backward-compat: if no cycle found, default interval 12 months
function getIntervalMonths(plan: Plan | undefined, cycleId: string): number {
  return getCycle(plan, cycleId)?.interval_months
    ?? (cycleId === 'monthly' ? 1 : 12)
}

function trialDaysLeft(end: string | null): number | null {
  if (!end) return null
  return Math.ceil((new Date(end).getTime() - Date.now()) / 86400000)
}

function trialBadge(days: number | null): { label: React.ReactNode; color: string; bg: string } | null {
  if (days === null) return null
  if (days < 0)  return { label: 'Trial expirado',       color: '#c0392b', bg: '#fff5f5' }
  if (days <= 3) return { label: <><AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {days}d restantes</>, color: '#c0392b', bg: '#fff5f5' }
  if (days <= 7) return { label: <><Clock size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {days}d restantes</>, color: '#b45309', bg: '#fffbeb' }
  return           { label: `${days}d de trial`,          color: '#6b7280', bg: '#f9fafb' }
}

function contractEndDate(startDate: string | null, commitMonths: number): string | null {
  if (!startDate || !commitMonths) return null
  const d = new Date(startDate)
  d.setMonth(d.getMonth() + commitMonths)
  return d.toISOString().slice(0, 10)
}

// ─── Create User Modal ────────────────────────────────────────────────────────

function CreateUserModal({
  plans, saving, onClose, onCreate,
}: {
  plans: Plan[]
  saving: boolean
  onClose: () => void
  onCreate: (data: {
    email: string; first_name: string; last_name: string; phone: string; company: string
    plan_id: string; billing_cycle: string; start_trial: boolean
    trial_days: number
  }) => Promise<void>
}) {
  const [form, setForm] = useState({
    email: '', first_name: '', last_name: '', phone: '', company: '',
    plan_id: '', billing_cycle: '',
    start_trial: false, trial_days: 14,
  })

  const selectedPlan = plans.find(p => p.id === form.plan_id)

  // Reset billing cycle & trial days when plan changes
  useEffect(() => {
    if (!selectedPlan) return
    const defaultCycle = selectedPlan.billing_cycles?.[0]?.id || ''
    setForm(f => ({
      ...f,
      billing_cycle: defaultCycle,
      trial_days: selectedPlan.trial_days || 14,
    }))
  }, [form.plan_id]) // eslint-disable-line

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: 60 }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div className="modal-title">Nuevo venue owner</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">

          {/* Email */}
          <div className="form-group">
            <label className="form-label">Email del venue * <span style={{ color: 'var(--warm-gray)', fontWeight: 400 }}>(recibirá invitación automáticamente)</span></label>
            <input className="form-input" type="email" value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="contacto@casapalacio.com" />
          </div>

          {/* Name grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input className="form-input" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="María" />
            </div>
            <div className="form-group">
              <label className="form-label">Apellidos</label>
              <input className="form-input" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="García López" />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+34 600 000 000" />
            </div>
            <div className="form-group">
              <label className="form-label">Empresa / Venue</label>
              <input className="form-input" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Casa Palacio Boadella" />
            </div>
          </div>

          {/* Plan section */}
          <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 16, marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--charcoal)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 12 }}>
              Plan (opcional)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Plan</label>
                <select className="form-input" value={form.plan_id} onChange={e => set('plan_id', e.target.value)}>
                  <option value="">Sin plan ahora</option>
                  {plans.filter(p => p.is_active).map(p => (
                    <option key={p.id} value={p.id}>
                      {planLabel(p)} — {p.name === 'basic' ? 'Básico' : 'Premium'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Ciclo de pago</label>
                <select className="form-input" value={form.billing_cycle}
                  onChange={e => set('billing_cycle', e.target.value)}
                  disabled={!form.plan_id}>
                  {!form.plan_id && <option value="">Elige plan primero</option>}
                  {(selectedPlan?.billing_cycles ?? []).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.label} — {c.price}€
                      {c.commitment_months > 0 ? ` (${c.commitment_months}m compromiso)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Trial toggle — only if plan selected */}
            {form.plan_id && (
              <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '12px 14px', marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.start_trial}
                    onChange={e => set('start_trial', e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--gold)' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>Iniciar trial gratuito</div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                      El venue tendrá acceso completo durante el período de prueba antes de pagar
                    </div>
                  </div>
                </label>

                {form.start_trial && (
                  <div style={{ marginTop: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Días de trial</label>
                      <input className="form-input" type="number" min={1} max={365}
                        value={form.trial_days}
                        onChange={e => set('trial_days', parseInt(e.target.value) || 14)} />
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 3 }}>
                        Trial predeterminado del plan: {selectedPlan?.trial_days ?? 14} días
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Info box */}
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 12px', marginTop: 12, fontSize: 12, color: '#0369a1' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Mail size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                Se enviará automáticamente un email de invitación a <strong>{form.email || 'la dirección indicada'}</strong> con un enlace para que el venue establezca su contraseña y acceda al portal.
                {!form.plan_id && ' Podrás asignar un plan más adelante desde el CRM.'}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            disabled={saving || !form.email.trim()}
            onClick={() => onCreate(form)}
          >
            <UserPlus size={13} /> {saving ? 'Creando...' : 'Crear y enviar invitación'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function UserPanel({
  profile, wpVenues, plans, subscriptions, userVenues, saving,
  initialTab, onClose, onSaveProfile, onAssignVenue, onRemoveVenue,
  onSaveSubscription, onRegisterPayment, trialConfig,
}: {
  profile: Profile
  wpVenues: any[]
  plans: Plan[]
  subscriptions: Subscription[]
  userVenues: UserVenue[]
  saving: boolean
  initialTab?: 'perfil' | 'venues' | 'suscripcion' | 'historial' | 'equipo'
  onClose: () => void
  onSaveProfile: (p: Profile) => Promise<void>
  onAssignVenue: (userId: string, wpId: number, planId: string, cycle: string) => Promise<void>
  trialConfig: TrialConfig
  onRemoveVenue: (uvId: string) => Promise<void>
  onSaveSubscription: (sub: Partial<Subscription> & { user_id: string }) => Promise<void>
  onRegisterPayment: (sub: Subscription, amount: string, ref: string) => Promise<void>
}) {
  const [tab, setTab] = useState<'perfil' | 'venues' | 'suscripcion' | 'historial' | 'equipo'>(initialTab || 'perfil')
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [history, setHistory] = useState<PaymentEvent[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const [pForm, setPForm] = useState({
    first_name:  profile.first_name  || '',
    last_name:   profile.last_name   || '',
    phone:       profile.phone       || '',
    company:     profile.company     || '',
    address:     profile.address     || '',
    city:        profile.city        || '',
    website:     profile.website     || '',
    admin_notes: profile.admin_notes || '',
    status:      profile.status      || 'pending',
  })

  // Feature overrides — null = use plan default, true = force on, false = force off
  type OverrideVal = true | false | null
  const [featOverrides, setFeatOverrides] = useState<Record<string, OverrideVal>>(() => {
    const fo = (profile as any).features_override ?? {}
    return typeof fo === 'object' ? fo : {}
  })
  const setOverride = (key: string, val: OverrideVal) =>
    setFeatOverrides(prev => {
      const next = { ...prev }
      if (val === null) delete next[key]
      else next[key] = val
      return next
    })
  const [copied, setCopied] = useState(false)
  const copyEmail = () => {
    if (profile.email) {
      navigator.clipboard.writeText(profile.email)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Venue assignment form
  const [newVenueId,   setNewVenueId]   = useState('')
  const [newPlanId,    setNewPlanId]    = useState(plans[0]?.id || '')
  const [newCycle,     setNewCycle]     = useState('')

  const STATUS_PRIO: Record<string, number> = { active: 0, trial: 1, paused: 2, cancelled: 3 }
  const activeSub = subscriptions
    .filter(s => s.user_id === profile.user_id)
    .sort((a, b) => (STATUS_PRIO[a.status] ?? 9) - (STATUS_PRIO[b.status] ?? 9))[0]
  const subPlan   = plans.find(p => p.id === activeSub?.plan_id)
  const daysLeft  = trialDaysLeft(activeSub?.trial_end_date || null)
  const badge     = trialBadge(daysLeft)

  // Quick-payment bar
  const [payAmount, setPayAmount] = useState('')
  const [payRef,    setPayRef]    = useState('')

  // Migration to new plan (when current plan is inactive)
  const [migratePlanId,    setMigratePlanId]    = useState('')
  const [migrateCycle,     setMigrateCycle]     = useState('')
  const [migrateStartDate, setMigrateStartDate] = useState(
    activeSub?.renewal_date || activeSub?.trial_end_date || new Date().toISOString().slice(0, 10)
  )
  const migratePlan = plans.find(p => p.id === migratePlanId)

  // Subscription form
  const [subForm, setSubForm] = useState({
    plan_id:           activeSub?.plan_id           || trialConfig.trial_plan_id || plans[0]?.id || '',
    billing_cycle:     activeSub?.billing_cycle     || '',
    status:            (activeSub?.status           || 'trial')  as Subscription['status'],
    start_date:        activeSub?.start_date        || new Date().toISOString().slice(0, 10),
    trial_end_date:    activeSub?.trial_end_date    || '',
    renewal_date:      activeSub?.renewal_date      || '',
    payment_reference: activeSub?.payment_reference || '',
    iban:              activeSub?.iban              || '',
    account_holder:    activeSub?.account_holder    || '',
    mandate_ref:       activeSub?.mandate_ref       || '',
    cancel_at_period_end: activeSub?.cancel_at_period_end ?? false,
    service_end_date:  activeSub?.service_end_date  || '',
    notes:             activeSub?.notes             || '',
  })

  const myVenues    = userVenues.filter(v => v.user_id === profile.user_id)
  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
    || profile.company || profile.wp_username || profile.email?.split('@')[0] || profile.user_id.slice(0, 8) + '...'


  // Plan selected in venue assignment
  const selPlanNew = plans.find(p => p.id === newPlanId)
  useEffect(() => {
    if (!selPlanNew) return
    setNewCycle(selPlanNew.billing_cycles?.[0]?.id || '')
  }, [newPlanId]) // eslint-disable-line

  // Plan selected in subscription form
  const editPlan = plans.find(p => p.id === subForm.plan_id)

  // Auto-renewal date when start_date or billing_cycle changes
  useEffect(() => {
    if (subForm.start_date && subForm.billing_cycle) {
      const months = getIntervalMonths(editPlan, subForm.billing_cycle)
      setSubForm(f => ({ ...f, renewal_date: advanceDateByMonths(f.start_date, months) }))
    }
  }, [subForm.start_date, subForm.billing_cycle]) // eslint-disable-line

  // Auto trial_end_date — uses global trial_config days
  useEffect(() => {
    if (subForm.status === 'trial' && subForm.start_date) {
      const days = trialConfig.trial_days || 14
      const d = new Date(subForm.start_date)
      d.setDate(d.getDate() + days)
      setSubForm(f => ({ ...f, trial_end_date: d.toISOString().slice(0, 10) }))
    }
  }, [subForm.status, subForm.start_date]) // eslint-disable-line

  // Load history when tab activated
  useEffect(() => {
    if (tab !== 'historial') return
    setHistoryLoading(true)
    const supabase = createClient()
    supabase
      .from('venue_payment_history')
      .select('*')
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setHistory(data ?? [])
        setHistoryLoading(false)
      })
  }, [tab]) // eslint-disable-line

  // Load team members when tab activated
  useEffect(() => {
    if (tab !== 'equipo') return
    setTeamLoading(true)
    const supabase = createClient()
    supabase
      .from('venue_profiles')
      .select('id, user_id, first_name, last_name, role, status, created_at')
      .eq('company', profile.company || '')
      .neq('user_id', profile.user_id)
      .then(({ data }) => {
        setTeamMembers(data ?? [])
        setTeamLoading(false)
      })
  }, [tab]) // eslint-disable-line

  // Contract end info — uses the billing cycle's commitment_months
  const activeCycle = getCycle(editPlan, subForm.billing_cycle)
  const commitMonths = activeCycle?.commitment_months ?? 0
  const contractEnd = contractEndDate(activeSub?.start_date || null, commitMonths)
  const cyclePriceLabel = activeCycle
    ? `${activeCycle.price}€ ${activeCycle.label.toLowerCase()}`
    : null

  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: 40, overflowY: 'auto' }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 700, maxHeight: 'none', overflow: 'visible' }}>
        <div style={{ padding: '24px 28px' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              {/* Avatar */}
              <div style={{
                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                background: 'var(--cream)', border: '2px solid var(--ivory)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, color: 'var(--gold)',
                fontFamily: 'Manrope, sans-serif',
              }}>
                {(profile.first_name?.[0] || profile.email?.[0] || '?').toUpperCase()}
              </div>
              <div>
              <div style={{ fontSize: 18, fontFamily: 'Manrope, sans-serif', fontWeight: 600, color: 'var(--espresso)' }}>
                {displayName}
              </div>
              {/* Email + phone quick links */}
              <div style={{ display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
                {profile.email && (
                  <a href={`mailto:${profile.email}`} style={{ fontSize: 12, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                    <Mail size={11} /> {profile.email}
                  </a>
                )}
                {profile.phone && (
                  <a href={`tel:${profile.phone}`} style={{ fontSize: 12, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                    <Phone size={11} /> {profile.phone}
                  </a>
                )}
                {profile.company && (
                  <span style={{ fontSize: 12, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Building2 size={11} /> {profile.company}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                {profile.wp_username && <span>{profile.wp_username}</span>}
                {/* Profile status: only show if account is inactive (to flag disabled accounts) */}
                {profile.status !== 'active' && (
                  <span className={`badge ${PROFILE_BADGE[profile.status] || ''}`} style={{ fontSize: 10 }}>
                    Cuenta: {STATUS_LABEL[profile.status] || profile.status}
                  </span>
                )}
                {activeSub && (() => {
                  const isExpiredTrial = activeSub.status === 'trial_expired' ||
                    (activeSub.status === 'trial' && daysLeft !== null && daysLeft <= 0)
                  const subLabel = isExpiredTrial ? 'Fin de trial' : STATUS_LABEL[activeSub.status]
                  const subBadgeClass = isExpiredTrial ? 'badge-inactive' : SUB_BADGE[activeSub.status] || 'badge-inactive'
                  return (
                    <span className={`badge ${subBadgeClass}`} style={{ fontSize: 10 }}>
                      {subLabel}
                    </span>
                  )
                })()}
                {subPlan && (
                  <span style={{
                    background: !subPlan.is_active ? '#fee2e2' : subPlan.name === 'basic' ? '#f0f9ff' : '#fef9ec',
                    color:      !subPlan.is_active ? '#c0392b' : subPlan.name === 'basic' ? '#0369a1' : '#92400e',
                    padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                  }}>
                    {planLabel(subPlan)}{!subPlan.is_active ? <> <AlertTriangle size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /></> : ''}
                  </span>
                )}
                {activeSub?.status === 'trial' && badge && (
                  <span style={{ padding: '1px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                )}
              </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}>
              <X size={16} />
            </button>
          </div>

          {/* Payment bar — trial / trial_expired OR next renewal */}
          {activeSub && (activeSub.status === 'trial' || activeSub.status === 'trial_expired' || activeSub.status === 'active') && (
            <div style={{
              background: (activeSub.status === 'trial' || activeSub.status === 'trial_expired') ? '#fffbeb' : '#f0fdf4',
              border: `1px solid ${(activeSub.status === 'trial' || activeSub.status === 'trial_expired') ? '#fcd34d' : '#bbf7d0'}`,
              borderRadius: 8, padding: '12px 14px', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <CreditCard size={14} style={{ color: (activeSub.status === 'trial' || activeSub.status === 'trial_expired') ? '#b45309' : '#16a34a', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: (activeSub.status === 'trial' || activeSub.status === 'trial_expired') ? '#92400e' : '#15803d' }}>
                  {(activeSub.status === 'trial' || activeSub.status === 'trial_expired') ? 'Registrar pago para activar' : 'Registrar pago / renovación'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>
                  {activeSub.status === 'trial_expired'
                    ? <><AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Fin de trial · pendiente de cobro</>
                    : activeSub.status === 'trial'
                    ? (daysLeft !== null && daysLeft < 0
                        ? <><AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Trial expirado</>
                        : activeSub.trial_end_date
                          ? `Trial hasta ${new Date(activeSub.trial_end_date).toLocaleDateString('es-ES')} (${daysLeft}d)`
                          : 'Trial activo · sin fecha de fin')
                    : activeSub.cancel_at_period_end
                      ? `Fin de servicio: ${activeSub.renewal_date ? new Date(activeSub.renewal_date).toLocaleDateString('es-ES') : '—'}`
                      : `Próx. renovación: ${activeSub.renewal_date ? new Date(activeSub.renewal_date).toLocaleDateString('es-ES') : '—'}`
                  }
                  {subPlan && (() => {
                    const c = getCycle(subPlan, activeSub.billing_cycle)
                    return ` · ${planLabel(subPlan)} ${c ? c.label : activeSub.billing_cycle}`
                  })()}
                </div>
              </div>
              <input style={{ padding: '5px 9px', borderRadius: 6, border: '1px solid var(--ivory)', fontSize: 12, width: 90, background: '#fff' }}
                placeholder={(() => {
                  const c = getCycle(subPlan, activeSub.billing_cycle)
                  return c ? `${c.price}€` : '?€'
                })()}
                value={payAmount} onChange={e => setPayAmount(e.target.value)} />
              <input style={{ padding: '5px 9px', borderRadius: 6, border: '1px solid var(--ivory)', fontSize: 12, width: 150, background: '#fff' }}
                placeholder="Ref. TPV CaixaBank"
                value={payRef} onChange={e => setPayRef(e.target.value)} />
              <button className="btn btn-primary btn-sm" disabled={saving}
                onClick={() => onRegisterPayment(activeSub, payAmount, payRef)}>
                <Check size={12} /> {activeSub.status === 'trial' ? 'Activar' : 'Renovar'}
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: 20 }}>
            {(['perfil', 'venues', 'suscripcion', 'historial', 'equipo'] as const).map(t => (
              <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t === 'perfil'     ? 'Perfil'
                  : t === 'venues'     ? `Venues (${myVenues.length})`
                  : t === 'suscripcion' ? 'Suscripción'
                  : t === 'equipo'     ? 'Equipo'
                  : <><History size={11} style={{ display: 'inline', marginRight: 4 }} />Historial</>}
              </button>
            ))}
          </div>

          {/* ── Perfil ── */}
          {tab === 'perfil' && (
            <div>
              {/* ── Información de acceso (read-only) ── */}
              <div style={{ background: 'var(--cream)', borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                  Acceso y cuenta
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Mail size={10} /> Email
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--espresso)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{profile.email || '—'}</span>
                      {profile.email && (
                        <button onClick={copyEmail} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#16a34a' : 'var(--warm-gray)', padding: 0 }} title="Copiar email">
                          {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
                        </button>
                      )}
                      {profile.email && (
                        <a href={`mailto:${profile.email}`} style={{ color: '#0369a1', fontSize: 11 }}>Enviar email →</a>
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Shield size={10} /> Rol
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--espresso)' }}>
                      {profile.role === 'admin' ? <><Settings size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> Administrador</> : <><Landmark size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> Venue owner</>}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={10} /> Alta
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--espresso)' }}>
                      {new Date(profile.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} /> Último acceso
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--espresso)' }}>
                      {profile.last_sign_in_at
                        ? new Date(profile.last_sign_in_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
                        : 'Nunca'}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Datos personales ── */}
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <User size={11} /> Datos personales
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Nombre</label>
                  <input className="form-input" value={pForm.first_name}
                    onChange={e => setPForm(f => ({ ...f, first_name: e.target.value }))} placeholder="María" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Apellidos</label>
                  <input className="form-input" value={pForm.last_name}
                    onChange={e => setPForm(f => ({ ...f, last_name: e.target.value }))} placeholder="García López" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label"><Phone size={10} style={{ display: 'inline', marginRight: 4 }} />Teléfono</label>
                  <input className="form-input" value={pForm.phone}
                    onChange={e => setPForm(f => ({ ...f, phone: e.target.value }))} placeholder="+34 600 000 000" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Estado de cuenta</label>
                  <select className="form-input" value={pForm.status}
                    onChange={e => setPForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="pending">⏳ Pendiente verificación</option>
                    <option value="active">✅ Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
              </div>

              {/* ── Empresa ── */}
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Building2 size={11} /> Empresa / Venue
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Empresa / Hotel</label>
                  <input className="form-input" value={pForm.company}
                    onChange={e => setPForm(f => ({ ...f, company: e.target.value }))} placeholder="Casa Palacio Boadella" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label"><Globe size={10} style={{ display: 'inline', marginRight: 4 }} />Web</label>
                  <input className="form-input" value={pForm.website}
                    onChange={e => setPForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label"><MapPin size={10} style={{ display: 'inline', marginRight: 4 }} />Dirección</label>
                  <input className="form-input" value={pForm.address}
                    onChange={e => setPForm(f => ({ ...f, address: e.target.value }))} placeholder="Calle Mayor 1" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Ciudad / Provincia</label>
                  <input className="form-input" value={pForm.city}
                    onChange={e => setPForm(f => ({ ...f, city: e.target.value }))} placeholder="Barcelona" />
                </div>
              </div>

              {/* ── WordPress ── */}
              {(profile.wp_username || profile.wp_venue_id) && (
                <div style={{ background: '#f0f9ff', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>
                    WordPress
                  </div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    {profile.wp_username && <span><strong>Usuario WP:</strong> {profile.wp_username}</span>}
                    {profile.wp_venue_id && <span><strong>Venue WP ID:</strong> #{profile.wp_venue_id}</span>}
                  </div>
                </div>
              )}

              {/* ── Notas internas ── */}
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <StickyNote size={11} /> Notas internas <span style={{ fontSize: 9, fontWeight: 400, textTransform: 'none', color: '#b45309' }}>(solo visibles para admins)</span>
              </div>
              <textarea className="form-textarea" style={{ minHeight: 80, marginBottom: 14 }}
                value={pForm.admin_notes}
                onChange={e => setPForm(f => ({ ...f, admin_notes: e.target.value }))}
                placeholder="Observaciones internas sobre este venue: forma de contacto preferida, acuerdos especiales, historial de incidencias..." />

              {/* ── Funcionalidades ── */}
              <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 14, marginTop: 4, marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Shield size={11} /> Funcionalidades
                  <span style={{ fontSize: 9, fontWeight: 400, textTransform: 'none', color: '#b45309', marginLeft: 4 }}>
                    (sobrescriben el plan — dejar en "Auto" para usar el plan)
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {([
                    { key: 'ficha',             label: 'Editar ficha' },
                    { key: 'leads',             label: 'Gestión de leads' },
                    { key: 'calendario',        label: 'Calendario' },
                    { key: 'propuestas',        label: 'Propuestas digitales' },
                    { key: 'propuestas_web',    label: 'Web pública propuestas' },
                    { key: 'comunicacion',      label: 'Tarifas y zonas' },
                    { key: 'estadisticas',      label: 'Estadísticas' },
                    { key: 'leads_export',      label: 'Exportar leads CSV' },
                    { key: 'leads_date_filter', label: 'Filtro fechas leads' },
                    { key: 'leads_new_only',    label: <><span>Solo leads nuevos</span> <AlertTriangle size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /></> },
                  ] as { key: string; label: React.ReactNode }[]).map(({ key, label }) => {
                    const val: OverrideVal = key in featOverrides ? featOverrides[key] as boolean : null
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: val === true ? '#f0fdf4' : val === false ? '#fef2f2' : 'var(--cream)', borderRadius: 6, gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--charcoal)', flex: 1 }}>{label}</span>
                        <select
                          value={val === null ? 'auto' : val ? 'on' : 'off'}
                          onChange={e => {
                            const v = e.target.value
                            setOverride(key, v === 'auto' ? null : v === 'on')
                          }}
                          style={{ fontSize: 10, padding: '2px 4px', borderRadius: 4, border: '1px solid var(--ivory)', background: '#fff', color: val === true ? '#16a34a' : val === false ? '#dc2626' : 'var(--warm-gray)', cursor: 'pointer' }}
                        >
                          <option value="auto">Auto (plan)</option>
                          <option value="on">✓ Activado</option>
                          <option value="off">✗ Desactivado</option>
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" disabled={saving}
                  onClick={() => onSaveProfile({ ...profile, ...pForm, features_override: featOverrides })}>
                  <Check size={13} /> {saving ? 'Guardando...' : 'Guardar perfil'}
                </button>
              </div>
            </div>
          )}

          {/* ── Venues ── */}
          {tab === 'venues' && (
            <div>
              {myVenues.length === 0 ? (
                <div style={{ color: 'var(--warm-gray)', fontSize: 13, marginBottom: 16 }}>
                  Sin venues de WordPress asignados todavía.
                  {!activeSub && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#b45309' }}>
                      <Lightbulb size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Si el venue aún no tiene publicación en WordPress, puedes asignarlo más tarde una vez aprobado el onboarding.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginBottom: 20 }}>
                  {myVenues.map(uv => {
                    const wpV  = wpVenues.find(v => v.id === uv.wp_venue_id)
                    const sub  = subscriptions.find(s => s.id === uv.subscription_id)
                    const plan = plans.find(p => p.id === sub?.plan_id)
                    return (
                      <div key={uv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--cream)', borderRadius: 8, marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>
                            {wpV ? (wpV.acf?.H1_Venue || wpV.title?.rendered) : `WP #${uv.wp_venue_id}`}
                          </div>
                          {plan && (
                            <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>
                              {planLabel(plan)} · {(() => {
                                const c = getCycle(plan, sub?.billing_cycle || '')
                                return c ? c.label : (sub?.billing_cycle || '—')
                              })()}
                              {sub?.status && (() => {
                                const isExpTrial = sub.status === 'trial_expired' ||
                                  (sub.status === 'trial' &&
                                  sub.trial_end_date &&
                                  trialDaysLeft(sub.trial_end_date) !== null &&
                                  (trialDaysLeft(sub.trial_end_date) as number) <= 0)
                                return (
                                  <span className={`badge ${isExpTrial ? 'badge-inactive' : SUB_BADGE[sub.status] || 'badge-inactive'}`} style={{ fontSize: 9, marginLeft: 6 }}>
                                    {isExpTrial ? 'Fin de trial' : STATUS_LABEL[sub.status]}
                                  </span>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                        {wpV?.link && (
                          <a href={wpV.link} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                            <ExternalLink size={11} />
                          </a>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => onRemoveVenue(uv.id)} title="Quitar venue">
                          <X size={13} style={{ color: '#c0392b' }} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Assign new venue */}
              <div style={{ padding: 16, border: '1px dashed var(--ivory)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 12 }}>
                  Asignar venue de WordPress
                </div>
                <div className="form-group">
                  <label className="form-label">Venue (WordPress) *</label>
                  <select className="form-input" value={newVenueId} onChange={e => setNewVenueId(e.target.value)}>
                    <option value="">{wpVenues.length === 0 ? 'Cargando WP...' : 'Selecciona venue...'}</option>
                    {wpVenues.map(v => (
                      <option key={v.id} value={v.id}>{v.acf?.H1_Venue || v.title?.rendered} (#{v.id})</option>
                    ))}
                  </select>
                  {wpVenues.length === 0 && (
                    <div style={{ fontSize: 11, color: '#b45309', marginTop: 4 }}>
                      <AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Si el venue aún no está en WordPress, aprueba primero el onboarding para que se publique.
                    </div>
                  )}
                </div>

                {/* Plan + cycle */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Plan</label>
                    <select className="form-input" value={newPlanId} onChange={e => setNewPlanId(e.target.value)}>
                      <option value="">Sin plan</option>
                      {plans.filter(p => p.is_active).map(p => (
                        <option key={p.id} value={p.id}>{planLabel(p)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ciclo</label>
                    <select className="form-input" value={newCycle} onChange={e => setNewCycle(e.target.value)}
                      disabled={!newPlanId}>
                      {!newPlanId && <option value="">Elige plan</option>}
                      {(selPlanNew?.billing_cycles ?? []).map(c => (
                        <option key={c.id} value={c.id}>
                          {c.label} — {c.price}€
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!newVenueId || saving}
                    onClick={() => onAssignVenue(
                      profile.user_id, parseInt(newVenueId), newPlanId, newCycle,
                    ).then(() => { setNewVenueId('') })}
                  >
                    <Plus size={12} /> Asignar venue
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Suscripción ── */}
          {tab === 'suscripcion' && (
            <div>

              {/* ── Contextual verification banner ── */}
              {profile.status === 'pending' && !activeSub && (
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>⏳</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 3 }}>Sin plan — pendiente de verificación</div>
                    <div style={{ fontSize: 11, color: '#b45309', lineHeight: 1.5 }}>
                      El venue completó el onboarding pero aún no ha contratado ningún plan. Puede haberlo hecho desde la página de precios o estar esperando la activación. Activa la cuenta en la pestaña <strong>Perfil</strong> cuando hayas verificado el venue.
                    </div>
                  </div>
                </div>
              )}
              {profile.status === 'pending' && activeSub && (
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>✅</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d', marginBottom: 3 }}>Plan contratado — pendiente de verificación</div>
                    <div style={{ fontSize: 11, color: '#166534', lineHeight: 1.5 }}>
                      El venue ya ha elegido y pagado su plan <strong>{subPlan ? planLabel(subPlan) : ''}</strong>. Solo falta que actives la cuenta en la pestaña <strong>Perfil</strong> para que pueda acceder al portal.
                    </div>
                  </div>
                </div>
              )}

              {/* Inactive plan migration banner */}
              {activeSub && subPlan && !subPlan.is_active && (
                <div style={{ background: '#fffbeb', border: '2px solid #fcd34d', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <AlertTriangle size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> Plan «{planLabel(subPlan)}» desactivado — migración pendiente
                  </div>

                  {/* Current cycle end info */}
                  <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
                    <div style={{ background: '#fff', borderRadius: 7, padding: '8px 12px', border: '1px solid #fde68a', flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>
                        {activeSub.status === 'trial' ? 'Fin del trial' : 'Fin del ciclo actual'}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#92400e', fontFamily: 'Manrope, sans-serif' }}>
                        {(() => {
                          const d = activeSub.status === 'trial' ? activeSub.trial_end_date : activeSub.renewal_date
                          return d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'
                        })()}
                      </div>
                      <div style={{ fontSize: 10, color: '#b45309', marginTop: 2 }}>
                        {planLabel(subPlan)} · {getCycle(subPlan, activeSub.billing_cycle)?.label || activeSub.billing_cycle}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: 18, color: '#fcd34d' }}>→</div>
                    <div style={{ background: '#f0fdf4', borderRadius: 7, padding: '8px 12px', border: '1px solid #bbf7d0', flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>
                        Inicio nuevo plan
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>
                        {migratePlan ? planLabel(migratePlan) : '— selecciona abajo'}
                      </div>
                      {migratePlan && migrateCycle && (
                        <div style={{ fontSize: 10, color: '#16a34a', marginTop: 2 }}>
                          {getCycle(migratePlan, migrateCycle)?.label} · desde {new Date(migrateStartDate).toLocaleDateString('es-ES')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick migration form */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px', gap: 10, marginBottom: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ color: '#92400e' }}>Nuevo plan *</label>
                      <select className="form-input" value={migratePlanId}
                        onChange={e => {
                          const p = plans.find(x => x.id === e.target.value)
                          setMigratePlanId(e.target.value)
                          setMigrateCycle(p?.billing_cycles?.[0]?.id || '')
                        }}>
                        <option value="">Selecciona plan activo...</option>
                        {plans.filter(p => p.is_active).map(p => (
                          <option key={p.id} value={p.id}>{planLabel(p)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ color: '#92400e' }}>Ciclo de pago *</label>
                      <select className="form-input" value={migrateCycle}
                        onChange={e => setMigrateCycle(e.target.value)}
                        disabled={!migratePlanId}>
                        <option value="">—</option>
                        {(migratePlan?.billing_cycles ?? []).map(c => (
                          <option key={c.id} value={c.id}>{c.label} — {c.price}€</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ color: '#92400e' }}>Fecha inicio</label>
                      <input className="form-input" type="date" value={migrateStartDate}
                        onChange={e => setMigrateStartDate(e.target.value)} />
                    </div>
                  </div>

                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!migratePlanId || !migrateCycle || saving}
                    style={{ background: '#16a34a', borderColor: '#16a34a', width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                      const newPlan = plans.find(p => p.id === migratePlanId)
                      const months = getIntervalMonths(newPlan, migrateCycle)
                      const renewal = advanceDateByMonths(migrateStartDate, months)
                      onSaveSubscription({
                        ...(activeSub?.id ? { id: activeSub.id } : {}),
                        user_id:              profile.user_id,
                        plan_id:              migratePlanId,
                        billing_cycle:        migrateCycle,
                        status:               'active',
                        start_date:           migrateStartDate,
                        trial_end_date:       null,
                        renewal_date:         renewal,
                        payment_reference:    activeSub.payment_reference || null,
                        iban:                 activeSub.iban || null,
                        account_holder:       activeSub.account_holder || null,
                        mandate_ref:          activeSub.mandate_ref || null,
                        cancel_at_period_end: false,
                        service_end_date:     null,
                        notes:                activeSub.notes || null,
                      })
                    }}>
                    <Check size={13} /> {saving ? 'Migrando...' : `Migrar a ${migratePlan ? planLabel(migratePlan) : 'nuevo plan'}`}
                  </button>
                </div>
              )}

              {/* Status banner */}
              {activeSub ? (
                <div className={`alert ${activeSub.status === 'active' ? 'alert-success' : 'alert-info'}`} style={{ fontSize: 12, marginBottom: 16 }}>
                  <strong>{STATUS_LABEL[activeSub.status]}</strong>
                  {activeSub.status === 'trial' && activeSub.trial_end_date && (
                    <> · Trial hasta <strong>{new Date(activeSub.trial_end_date).toLocaleDateString('es-ES')}</strong>
                      {daysLeft !== null && ` (${daysLeft > 0 ? `${daysLeft} días` : 'EXPIRADO'})`}</>
                  )}
                  {activeSub.status === 'active' && activeSub.renewal_date && (
                    <> · {activeSub.cancel_at_period_end ? 'Fin de servicio' : 'Próx. pago'}: <strong>{new Date(activeSub.renewal_date).toLocaleDateString('es-ES')}</strong>
                      {activeSub.cancel_at_period_end && <span style={{ color: '#c0392b', marginLeft: 6 }}>· No renueva</span>}</>
                  )}
                  {subPlan && <> · {planLabel(subPlan)}{!subPlan.is_active && <span style={{ marginLeft: 5, fontSize: 10, background: '#fee2e2', color: '#c0392b', padding: '1px 5px', borderRadius: 3 }}>INACTIVO</span>}</>}
                  {activeSub.payment_reference && (
                    <div style={{ marginTop: 4, fontSize: 11, color: 'var(--warm-gray)' }}>
                      Ref. último pago: {activeSub.payment_reference}
                    </div>
                  )}
                </div>
              ) : (
                <div className="alert alert-info" style={{ fontSize: 12, marginBottom: 16 }}>
                  {profile.status === 'pending'
                    ? 'Aún sin plan contratado. Puedes crearlo manualmente o esperar a que el venue lo haga desde la web.'
                    : 'Sin suscripción. Rellena el formulario para crear una.'}
                </div>
              )}

              {/* Billing info box — cycle + commitment */}
              {activeSub?.status === 'active' && activeCycle ? (
                <div style={{ background: '#f0f9ff', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: '#0369a1', marginBottom: 4 }}>
                    <ClipboardList size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {activeCycle.label}
                    {commitMonths > 0 ? ` · Compromiso ${commitMonths} meses` : ' · Sin permanencia'}
                  </div>
                  <div style={{ color: '#0369a1' }}>
                    Importe por período: <strong>{activeCycle.price}€</strong>
                    {contractEnd && <> · Fin de compromiso: <strong>{new Date(contractEnd).toLocaleDateString('es-ES')}</strong></>}
                  </div>
                  {activeCycle.interval_months < 12 && (
                    <div style={{ color: '#0369a1', marginTop: 3, fontSize: 11 }}>
                      Domiciliación SEPA — cada {activeCycle.interval_months === 1 ? 'mes' : `${activeCycle.interval_months} meses`} se carga automáticamente.
                    </div>
                  )}
                </div>
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Plan</label>
                  <select className="form-input" value={subForm.plan_id}
                    onChange={e => {
                      const p = plans.find(x => x.id === e.target.value)
                      setSubForm(f => ({
                        ...f,
                        plan_id: e.target.value,
                        billing_cycle: p?.billing_cycles?.[0]?.id || f.billing_cycle,
                      }))
                    }}>
                    <option value="">Sin plan</option>
                    {plans.filter(p => p.is_active).map(p => (
                      <option key={p.id} value={p.id}>{planLabel(p)}</option>
                    ))}
                    {plans.some(p => !p.is_active) && (
                      <option disabled>── Planes inactivos ──</option>
                    )}
                    {plans.filter(p => !p.is_active).map(p => (
                      <option key={p.id} value={p.id}>{planLabel(p)} (inactivo)</option>
                    ))}
                  </select>
                  {editPlan && (
                    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{
                        background: !editPlan.is_active ? '#fee2e2' : '#f0f9ff',
                        color:      !editPlan.is_active ? '#c0392b' : '#0369a1',
                        padding: '1px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                      }}>{planLabel(editPlan)}{!editPlan.is_active ? ' — INACTIVO' : ''}</span>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select className="form-input" value={subForm.status}
                    onChange={e => setSubForm(f => ({ ...f, status: e.target.value as Subscription['status'] }))}>
                    <option value="trial">Trial (pendiente de cobro)</option>
                    <option value="trial_expired">Fin de trial — pendiente de cobro</option>
                    <option value="active">Activo (pagado ✓)</option>
                    <option value="paused">Pausado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Ciclo de pago</label>
                  <select className="form-input" value={subForm.billing_cycle}
                    onChange={e => setSubForm(f => ({ ...f, billing_cycle: e.target.value }))}
                    disabled={!editPlan}>
                    {!editPlan && <option value="">Elige plan primero</option>}
                    {(editPlan?.billing_cycles ?? []).map(c => (
                      <option key={c.id} value={c.id}>
                        {c.label} — {c.price}€
                        {c.commitment_months > 0 ? ` (${c.commitment_months}m compromiso)` : ''}
                      </option>
                    ))}
                  </select>
                  {activeCycle && (
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 3 }}>
                      {activeCycle.price}€ · aviso cancelación {activeCycle.cancel_notice_days}d antes
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha inicio</label>
                  <input className="form-input" type="date" value={subForm.start_date}
                    onChange={e => setSubForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>

                {/* Trial end — si status=trial (editable) o trial_expired (solo lectura) */}
                {(subForm.status === 'trial' || subForm.status === 'trial_expired') && (
                  <div className="form-group" style={{
                    background: subForm.status === 'trial_expired' ? '#fff5f5' : '#fffbeb',
                    padding: '10px 12px', borderRadius: 8,
                    border: `1px solid ${subForm.status === 'trial_expired' ? '#fca5a5' : '#fcd34d'}`,
                  }}>
                    <label className="form-label" style={{ color: subForm.status === 'trial_expired' ? '#c0392b' : '#92400e', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {subForm.status === 'trial_expired'
                        ? <><AlertTriangle size={12} /> Fin de trial (expirado)</>
                        : <><Clock size={12} /> Fin del trial</>}
                      {subForm.status === 'trial' && (
                        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 400, color: '#b45309' }}>
                          Config global: {trialConfig.trial_days}d
                        </span>
                      )}
                    </label>
                    <input className="form-input" type="date" value={subForm.trial_end_date}
                      readOnly={subForm.status === 'trial_expired'}
                      style={subForm.status === 'trial_expired' ? { background: '#fee2e2', color: '#c0392b', cursor: 'default' } : {}}
                      onChange={e => subForm.status === 'trial' && setSubForm(f => ({ ...f, trial_end_date: e.target.value }))} />
                    {subForm.trial_end_date && (() => {
                      const d = trialDaysLeft(subForm.trial_end_date)
                      return <div style={{ fontSize: 10, color: subForm.status === 'trial_expired' ? '#c0392b' : '#b45309', marginTop: 3 }}>
                        {d === null ? '' : d < 0
                          ? <><AlertTriangle size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> Expiró hace {Math.abs(d)} día{Math.abs(d) !== 1 ? 's' : ''}</>
                          : `${d} días desde hoy`}
                      </div>
                    })()}
                  </div>
                )}

                {/* Renewal / end date — solo si active */}
                {subForm.status === 'active' && (
                  <div className="form-group">
                    <label className="form-label">
                      {subForm.cancel_at_period_end ? <><Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Fecha de fin de servicio</> : 'Próxima renovación / cobro'}
                    </label>
                    <input className="form-input" type="date" value={subForm.renewal_date}
                      onChange={e => setSubForm(f => ({ ...f, renewal_date: e.target.value }))} />
                    {subForm.renewal_date && !subForm.cancel_at_period_end && activeCycle && (() => {
                      const deadline = cancelDeadline(subForm.renewal_date, activeCycle.cancel_notice_days)
                      return (
                        <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 3 }}>
                          Plazo límite cancelación: <strong>{new Date(deadline).toLocaleDateString('es-ES')}</strong>
                          {` (${activeCycle.cancel_notice_days}d antes)`}
                        </div>
                      )
                    })()}
                    {subForm.cancel_at_period_end && subForm.renewal_date && (
                      <div style={{ fontSize: 10, color: '#c0392b', marginTop: 3 }}>
                        <OctagonAlert size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> El acceso se revocará el {new Date(subForm.renewal_date).toLocaleDateString('es-ES')} y no se renovará
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Ref. pago <span style={{ color: 'var(--warm-gray)', fontWeight: 400 }}>(TPV / mandato)</span></label>
                  <input className="form-input" value={subForm.payment_reference}
                    onChange={e => setSubForm(f => ({ ...f, payment_reference: e.target.value }))}
                    placeholder="Ref. de la última transacción" />
                </div>
              </div>

              {/* ── SEPA Domiciliación ── */}
              <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 14, marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--charcoal)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Domiciliación SEPA
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">IBAN</label>
                    <input className="form-input" value={subForm.iban}
                      onChange={e => setSubForm(f => ({ ...f, iban: e.target.value }))}
                      placeholder="ES00 0000 0000 00 0000000000" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Titular cuenta</label>
                    <input className="form-input" value={subForm.account_holder}
                      onChange={e => setSubForm(f => ({ ...f, account_holder: e.target.value }))}
                      placeholder="Nombre del titular" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ref. mandato SEPA</label>
                    <input className="form-input" value={subForm.mandate_ref}
                      onChange={e => setSubForm(f => ({ ...f, mandate_ref: e.target.value }))}
                      placeholder="WVS-2024-XXXX" />
                  </div>
                </div>
              </div>

              {/* ── Fin de servicio / Cancelación ── */}
              {(subForm.status === 'active' || subForm.status === 'trial') && (
                <div style={{ borderTop: '1px solid var(--ivory)', paddingTop: 14, marginTop: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--charcoal)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Renovación y cancelación
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 8, padding: '10px 12px', borderRadius: 8, background: subForm.cancel_at_period_end ? '#fff5f5' : '#f9fafb', border: `1px solid ${subForm.cancel_at_period_end ? '#fecaca' : 'var(--ivory)'}` }}>
                    <input type="checkbox" checked={subForm.cancel_at_period_end}
                      onChange={e => setSubForm(f => ({ ...f, cancel_at_period_end: e.target.checked }))}
                      style={{ width: 15, height: 15, accentColor: '#c0392b' }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: subForm.cancel_at_period_end ? '#c0392b' : 'var(--charcoal)' }}>
                        Sin renovación automática
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                        {subForm.cancel_at_period_end
                          ? 'El servicio finalizará en la fecha indicada arriba y no se renovará'
                          : 'Se domiciliará el cobro automáticamente en la fecha de renovación'}
                      </div>
                    </div>
                  </label>
                  {subForm.cancel_at_period_end && subForm.renewal_date && activeCycle && (
                    <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#c0392b', marginTop: 8 }}>
                      <OctagonAlert size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Fin de servicio: <strong>{new Date(subForm.renewal_date).toLocaleDateString('es-ES')}</strong>
                      {activeSub?.renewal_date && (
                        <> · Aviso cancelación: <strong>
                          {new Date(cancelDeadline(subForm.renewal_date, activeCycle.cancel_notice_days)).toLocaleDateString('es-ES')}
                        </strong></>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">Notas internas</label>
                <textarea className="form-textarea" style={{ minHeight: 55 }} value={subForm.notes}
                  onChange={e => setSubForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Forma de pago, descuentos, observaciones..." />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  disabled={saving || !subForm.plan_id}
                  onClick={() => onSaveSubscription({
                    ...(activeSub?.id ? { id: activeSub.id } : {}),
                    user_id:              profile.user_id,
                    plan_id:              subForm.plan_id,
                    billing_cycle:        subForm.billing_cycle,
                    status:               subForm.status,
                    start_date:           subForm.start_date           || null,
                    trial_end_date:       subForm.status === 'trial' ? (subForm.trial_end_date || null) : null,
                    renewal_date:         subForm.status === 'active' ? (subForm.renewal_date || null) : null,
                    payment_reference:    subForm.payment_reference    || null,
                    iban:                 subForm.iban                 || null,
                    account_holder:       subForm.account_holder       || null,
                    mandate_ref:          subForm.mandate_ref          || null,
                    cancel_at_period_end: subForm.cancel_at_period_end,
                    service_end_date:     subForm.service_end_date     || null,
                    notes:                subForm.notes                || null,
                  })}
                >
                  <Check size={13} /> {saving ? 'Guardando...' : activeSub ? 'Actualizar suscripción' : 'Crear suscripción'}
                </button>
              </div>
            </div>
          )}

          {/* ── Historial ── */}
          {/* ── Equipo ── */}
          {tab === 'equipo' && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 14 }}>
                Usuarios del equipo
              </div>

              {/* Datos del titular */}
              <div style={{ background: 'var(--cream)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                  Titular de la cuenta
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 2 }}>Nombre</div>
                    <div style={{ fontSize: 13, color: 'var(--charcoal)', fontWeight: 500 }}>
                      {[profile.first_name, profile.last_name].filter(Boolean).join(' ') || '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 2 }}>Email</div>
                    <div style={{ fontSize: 13, color: 'var(--charcoal)' }}>{profile.email || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 2 }}>Teléfono</div>
                    <div style={{ fontSize: 13, color: 'var(--charcoal)' }}>{profile.phone || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 2 }}>Web del venue</div>
                    <div style={{ fontSize: 13, color: 'var(--charcoal)' }}>
                      {(profile as any).venue_website
                        ? <a href={(profile as any).venue_website} target="_blank" rel="noreferrer"
                            style={{ color: 'var(--gold)', textDecoration: 'none' }}>
                            {(profile as any).venue_website}
                          </a>
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 2 }}>Ciudad</div>
                    <div style={{ fontSize: 13, color: 'var(--charcoal)' }}>{profile.city || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginBottom: 2 }}>Tipo de venue</div>
                    <div style={{ fontSize: 13, color: 'var(--charcoal)' }}>{(profile as any).venue_type || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Otros miembros */}
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                Otros usuarios
              </div>
              {teamLoading ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--warm-gray)', fontSize: 13 }}>Cargando...</div>
              ) : teamMembers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 20px', background: 'var(--cream)', borderRadius: 10, color: 'var(--warm-gray)', fontSize: 13 }}>
                  <User size={24} style={{ marginBottom: 8, opacity: .3, display: 'block', margin: '0 auto 8px' }} />
                  Solo hay un usuario en esta cuenta.
                  <div style={{ fontSize: 11, marginTop: 4 }}>En el futuro se podrán invitar miembros del equipo.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {teamMembers.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--cream)', borderRadius: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--warm-gray)', flexShrink: 0 }}>
                        {(m.first_name?.[0] || m.role?.[0] || '?').toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)' }}>
                          {[m.first_name, m.last_name].filter(Boolean).join(' ') || 'Sin nombre'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{m.role}</div>
                      </div>
                      <div style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: m.status === 'active' ? 'rgba(22,163,74,0.1)' : 'rgba(156,163,175,0.15)', color: m.status === 'active' ? '#16a34a' : 'var(--warm-gray)' }}>
                        {m.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'historial' && (
            <div>
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--warm-gray)', fontSize: 13 }}>Cargando historial...</div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--warm-gray)', fontSize: 13 }}>
                  <History size={28} style={{ marginBottom: 10, opacity: .3, display: 'block', margin: '0 auto 10px' }} />
                  Sin eventos registrados todavía.
                  <div style={{ fontSize: 11, marginTop: 6 }}>Los pagos, cambios de plan y otros eventos aparecerán aquí.</div>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  {/* Timeline line */}
                  <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, background: 'var(--ivory)' }} />
                  {history.map((ev, i) => {
                    const plan = plans.find(p => p.id === ev.plan_id)
                    const cycle = plan?.billing_cycles?.find(c => c.id === ev.billing_cycle)
                    const icon = {
                      payment:      { emoji: <CreditCard size={13} />, bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a' },
                      trial_started:{ emoji: <Clock size={13} />, bg: '#fffbeb', border: '#fcd34d', color: '#b45309' },
                      activated:    { emoji: <CircleCheckBig size={13} />, bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a' },
                      plan_changed: { emoji: <ArrowLeftRight size={13} />, bg: '#f0f9ff', border: '#bae6fd', color: '#0369a1' },
                      cancelled:    { emoji: <Ban size={13} />, bg: '#fff5f5', border: '#fecaca', color: '#c0392b' },
                      reactivated:  { emoji: <RotateCcw size={13} />, bg: '#fef9ec', border: '#fde68a', color: '#92400e' },
                      note:         { emoji: <FileText size={13} />, bg: '#f9fafb', border: 'var(--ivory)', color: 'var(--warm-gray)' },
                    }[ev.event_type] ?? { emoji: <>&#8226;</>, bg: '#f9fafb', border: 'var(--ivory)', color: 'var(--warm-gray)' }

                    const eventLabel = {
                      payment:      'Pago registrado',
                      trial_started:'Trial iniciado',
                      activated:    'Suscripción activada',
                      plan_changed: 'Plan cambiado',
                      cancelled:    'Cancelado',
                      reactivated:  'Reactivado',
                      note:         'Nota',
                    }[ev.event_type] ?? ev.event_type

                    return (
                      <div key={ev.id} style={{ display: 'flex', gap: 14, marginBottom: 14, position: 'relative' }}>
                        {/* Dot */}
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                          background: icon.bg, border: `2px solid ${icon.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, position: 'relative', zIndex: 1,
                        }}>{icon.emoji}</div>
                        {/* Content */}
                        <div style={{ flex: 1, background: icon.bg, border: `1px solid ${icon.border}`, borderRadius: 8, padding: '10px 14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: icon.color }}>{eventLabel}</div>
                            <div style={{ fontSize: 10, color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>
                              {new Date(ev.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--charcoal)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {ev.amount != null && (
                              <span style={{ fontWeight: 600 }}>{ev.amount}€</span>
                            )}
                            {plan && (
                              <span>{plan.display_name || plan.name}{cycle ? ` · ${cycle.label}` : ''}</span>
                            )}
                            {ev.reference && (
                              <span style={{ color: 'var(--warm-gray)', fontFamily: 'monospace', fontSize: 11 }}>Ref: {ev.reference}</span>
                            )}
                          </div>
                          {ev.notes && (
                            <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 5, fontStyle: 'italic' }}>{ev.notes}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [loading, setLoading]             = useState(true)
  const [profiles, setProfiles]           = useState<Profile[]>([])
  const [wpVenues, setWpVenues]           = useState<any[]>([])
  const [plans, setPlans]                 = useState<Plan[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [userVenues, setUserVenues]       = useState<UserVenue[]>([])
  const [saving, setSaving]               = useState(false)
  const [trialConfig, setTrialConfig]     = useState<TrialConfig>({ is_active: true, trial_days: 14, trial_plan_id: null })
  const [success, setSuccess]             = useState('')
  const [error, setError]                 = useState('')
  const [search, setSearch]               = useState('')
  const [filterStatus, setFilterStatus]   = useState('all')
  const [filterPlan, setFilterPlan]       = useState('all')
  const [selected, setSelected]           = useState<Profile | null>(null)
  const [selectedTab, setSelectedTab]     = useState<'perfil' | 'venues' | 'suscripcion' | 'historial'>('perfil')
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [crmTab, setCrmTab]               = useState<'venue_owner' | 'wedding_planner' | 'catering'>('venue_owner')

  const notify = (msg: string, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => { setSuccess(''); setError('') }, 4000)
  }

  const loadData = async () => {
    // ── Stale-while-revalidate: show cached data instantly ──
    const CACHE_KEY = 'wvs_admin_crm'
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        const c = JSON.parse(cached)
        if (c.profiles)      setProfiles(c.profiles)
        if (c.plans)         setPlans(c.plans)
        if (c.subscriptions) setSubscriptions(c.subscriptions)
        if (c.userVenues)    setUserVenues(c.userVenues)
        if (c.trialConfig)   setTrialConfig(c.trialConfig)
        setLoading(false)
      }
    } catch {}

    // WP venues from their own cache
    try { const wpc = sessionStorage.getItem('wvs_wp_venues'); if (wpc) setWpVenues(JSON.parse(wpc)) } catch {}

    // ── Auth check ──
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: me } = await supabase.from('venue_profiles').select('role').eq('user_id', session.user.id).single()
    if (me?.role !== 'admin') { router.push('/dashboard'); return }

    // ── Fetch fresh data (background if cache hit) ──
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const [usersRes, { data: plansData }, { data: subsData }, { data: uvData }, trialRes] = await Promise.all([
      fetch('/api/admin/users', { signal: controller.signal }).then(r => r.json()).catch(() => ({})),
      supabase.from('venue_plans').select('id, name, display_name, billing_cycles, trial_days, is_active'),
      supabase.from('venue_subscriptions').select('*'),
      supabase.from('user_venues').select('*'),
      fetch('/api/admin/trial-config', { signal: controller.signal }).then(r => r.json()).catch(() => ({})),
    ])
    clearTimeout(timeout)
    if (usersRes?.profiles) setProfiles(usersRes.profiles)
    if (plansData) setPlans(plansData)
    if (subsData)  setSubscriptions(subsData)
    if (uvData)    setUserVenues(uvData)
    if (trialRes?.config) setTrialConfig(trialRes.config)
    setLoading(false)

    // Persist to cache for next visit
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      profiles: usersRes?.profiles || [], plans: plansData || [],
      subscriptions: subsData || [], userVenues: uvData || [],
      trialConfig: trialRes?.config || null,
    }))

    // ── WP venues: background, non-blocking ──
    const wpController = new AbortController()
    const wpTimeout = setTimeout(() => wpController.abort(), 6000)
    fetch('https://weddingvenuesspain.com/wp-json/wp/v2/venues?per_page=100&acf_format=standard&_fields=id,title,acf,link', { cache: 'no-store', signal: wpController.signal })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d)) { setWpVenues(d); sessionStorage.setItem('wvs_wp_venues', JSON.stringify(d)) } })
      .catch(() => {})
      .finally(() => clearTimeout(wpTimeout))
  }

  // Only run once when auth finishes loading — not on every user/profile state change
  useEffect(() => { if (!authLoading) loadData() }, [authLoading]) // eslint-disable-line

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCreateUser = async (data: any) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) { notify(result.error || 'Error al crear usuario', true); setSaving(false); return }
      if (result.profile) setProfiles(p => [result.profile, ...p])
      if (result.subscription_id) {
        const supabase = createClient()
        const { data: subData } = await supabase.from('venue_subscriptions').select('*').eq('user_id', result.user_id)
        if (subData) setSubscriptions(p => [...p, ...subData])
      }
      setShowCreateUser(false)
      notify('Usuario creado e invitación enviada ✓')
    } catch (e: any) { notify(e.message || 'Error al crear usuario', true) }
    setSaving(false)
  }

  const handleSaveProfile = async (updated: Profile) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:     updated.user_id,
          first_name:  updated.first_name,
          last_name:   updated.last_name,
          phone:       updated.phone,
          company:     updated.company,
          address:     updated.address,
          city:        updated.city,
          website:     updated.website,
          admin_notes: updated.admin_notes,
          status:      updated.status,
        }),
      })
      const result = await res.json()
      if (!res.ok) { notify(result.error || 'Error al guardar perfil', true); setSaving(false); return }
      const saved = { ...updated, ...(result.profile || {}) }
      setProfiles(p => p.map(x => x.user_id === updated.user_id ? saved : x))
      setSelected(saved)
      notify('Perfil actualizado ✓')
    } catch (e: any) { notify(e.message || 'Error', true) }
    setSaving(false)
  }

  const handleAssignVenue = async (
    userId: string, wpId: number, planId: string, cycle: string,
  ) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/assign-venue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId, wp_venue_id: wpId,
          plan_id: planId || null, billing_cycle: cycle || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.error || 'Error al asignar venue', true); setSaving(false); return }
      if (data.user_venues) setUserVenues(p => [...p.filter(v => v.user_id !== userId), ...data.user_venues])
      if (data.profile)     setProfiles(p => p.map(x => x.user_id === userId ? { ...x, ...data.profile } : x))
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
      if (data.profile) setProfiles(p => p.map(x => x.user_id === data.user_id ? { ...x, ...data.profile } : x))
      notify('Venue eliminado')
    } catch (e: any) { notify(e.message || 'Error', true) }
  }

  const handleSaveSubscription = async (sub: Partial<Subscription> & { user_id: string }) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub }),
      })
      const result = await res.json()
      if (!res.ok) { notify(result.error || 'Error al guardar suscripción', true); setSaving(false); return }

      const saved = result.subscription
      if (saved) {
        if (sub.id) {
          setSubscriptions(p => p.map(x => x.id === saved.id ? saved : x))
        } else {
          setSubscriptions(p => [...p, saved])
        }
      }
      notify('Suscripción guardada ✓')
    } catch (e: any) { notify(e?.message || 'Error al guardar suscripción', true) }
    setSaving(false)
  }

  // Register payment: activates trial OR advances renewal for active subscription
  const handleRegisterPayment = async (sub: Subscription, amount: string, ref: string) => {
    setSaving(true)
    const today = new Date().toISOString().slice(0, 10)
    const subPlanData = plans.find(p => p.id === sub.plan_id)
    const months = getIntervalMonths(subPlanData, sub.billing_cycle)
    const baseDate = sub.renewal_date && sub.renewal_date >= today ? sub.renewal_date : today
    const newRenewal = advanceDateByMonths(baseDate, months)

    const eventNotes = sub.status === 'trial'
      ? `Trial → Activo. Próxima renovación: ${new Date(newRenewal).toLocaleDateString('es-ES')}`
      : `Renovación. Próxima: ${new Date(newRenewal).toLocaleDateString('es-ES')}`

    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            id:                sub.id,
            user_id:           sub.user_id,
            plan_id:           sub.plan_id,
            billing_cycle:     sub.billing_cycle,
            status:            'active',
            start_date:        sub.status === 'trial' ? today : (sub.start_date || today),
            trial_end_date:    null,
            renewal_date:      newRenewal,
            payment_reference: ref || sub.payment_reference,
          },
          event_type:  sub.status === 'trial' ? 'activated' : 'payment',
          event_notes: eventNotes,
          amount:      amount ? parseFloat(amount) : null,
          reference:   ref || null,
        }),
      })
      const result = await res.json()
      if (!res.ok) { notify(result.error || 'Error al registrar pago', true); setSaving(false); return }
      if (result.subscription) {
        setSubscriptions(p => p.map(x => x.id === sub.id ? result.subscription : x))
      }
      notify(`Pago registrado ✓ — renovación hasta ${new Date(newRenewal).toLocaleDateString('es-ES')}`)
    } catch (e: any) { notify(e.message || 'Error al registrar pago', true) }
    setSaving(false)
  }

  const handleToggle = async (userId: string, status: string) => {
    const next = status === 'active' ? 'inactive' : 'active'
    const supabase = createClient()
    await supabase.from('venue_profiles').update({ status: next }).eq('user_id', userId)
    setProfiles(p => p.map(x => x.user_id === userId ? { ...x, status: next } : x))
    notify(`Usuario ${next === 'active' ? 'activado' : 'desactivado'} ✓`)
  }

  const getVenueName = (id: number | null) => {
    if (!id) return null
    const v = wpVenues.find(v => v.id === id)
    return v ? (v.acf?.H1_Venue || v.title?.rendered || `WP #${id}`) : `WP #${id}`
  }

  const openPanel = (p: Profile, tab: 'perfil' | 'venues' | 'suscripcion' = 'perfil') => {
    setSelected(p); setSelectedTab(tab)
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const owners = profiles.filter(p => p.role === crmTab)

  const getSubInfo = (userId: string) => {
    // Prefer active > trial > paused > cancelled to avoid showing stale old subs
    const STATUS_PRIORITY: Record<string, number> = { active: 0, trial: 1, paused: 2, cancelled: 3 }
    const sub = subscriptions
      .filter(s => s.user_id === userId)
      .sort((a, b) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9))[0]
    if (!sub) return null
    // Fallback plan when plan_id references a deleted/inactive plan
    const plan = plans.find(p => p.id === sub.plan_id) ?? {
      id: sub.plan_id ?? '', name: '(plan eliminado)', display_name: '(plan eliminado)',
      is_active: false, billing_cycles: [], visible_on_web: false, trial_days: 14,
    }
    return { sub, plan, tier: plan.name === 'basic' ? 'basic' : 'premium' as 'basic' | 'premium' }
  }

  const expiringTrials = useMemo(() => subscriptions.filter(s => {
    if (s.status !== 'trial' || !s.trial_end_date) return false
    const d = trialDaysLeft(s.trial_end_date)
    return d !== null && d <= 7
  }), [subscriptions])

  const filtered = owners.filter(p => {
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    const info = getSubInfo(p.user_id)
    const isPlanId = plans.some(pl => pl.id === filterPlan)
    const matchPlan =
      filterPlan === 'all'      ? true :
      filterPlan === 'none'     ? !info :
      filterPlan === 'trial'         ? info?.sub.status === 'trial' :
      filterPlan === 'trial_expired' ? info?.sub.status === 'trial_expired' :
      filterPlan === 'expiring'      ? expiringTrials.some(s => s.user_id === p.user_id) :
      filterPlan === 'paused'        ? info?.sub.status === 'paused' :
      isPlanId                  ? info?.sub.plan_id === filterPlan : true
    const name   = [p.first_name, p.last_name].filter(Boolean).join(' ').toLowerCase()
    const matchQ = !search
      || name.includes(search.toLowerCase())
      || (p.wp_username || '').toLowerCase().includes(search.toLowerCase())
      || p.user_id.includes(search.toLowerCase())
      || (p.company || '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchPlan && matchQ
  })

  const counts = {
    pending:  owners.filter(p => p.status === 'pending').length,
    active:   owners.filter(p => p.status === 'active').length,
    inactive: owners.filter(p => p.status === 'inactive').length,
  }
  // Deduplicate by user_id (take most recent sub per user)
  const uniqueActiveSubs = subscriptions.filter(s =>
    s.status === 'active' &&
    !subscriptions.some(s2 => s2.user_id === s.user_id && s2.status === 'active' && s2.id > s.id)
  )
  const uniqueTrialSubs = subscriptions.filter(s =>
    s.status === 'trial' &&
    !subscriptions.some(s2 => s2.user_id === s.user_id && s2.status === 'trial' && s2.id > s.id)
  )
  const uniqueTrialExpiredSubs = subscriptions.filter(s => s.status === 'trial_expired')
  const subCounts = {
    active:        uniqueActiveSubs.length,
    trial:         uniqueTrialSubs.length,
    trial_expired: uniqueTrialExpiredSubs.length,
    premium:       uniqueActiveSubs.filter(s => plans.find(p => p.id === s.plan_id)?.name !== 'basic').length,
    basic:         uniqueActiveSubs.filter(s => plans.find(p => p.id === s.plan_id)?.name === 'basic').length,
    expiring:      expiringTrials.length,
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
          <div className="topbar-title">CRM</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={loadData} title="Recargar">
              <RefreshCw size={13} />
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreateUser(true)}>
              <UserPlus size={13} /> {crmTab === 'venue_owner' ? 'Nuevo venue' : crmTab === 'wedding_planner' ? 'Nuevo planner' : 'Nuevo catering'}
            </button>
            <a href="/admin/planes"     className="btn btn-ghost btn-sm">Planes →</a>
            <a href="/admin/onboarding" className="btn btn-ghost btn-sm">Solicitudes →</a>
          </div>
        </div>

        {/* CRM tabs */}
        <div style={{ display: 'flex', gap: 2, padding: '0 24px', borderBottom: '1px solid var(--ivory)', background: '#fff' }}>
          {([
            { key: 'venue_owner',     label: 'Venues',   count: profiles.filter(p => p.role === 'venue_owner').length },
            { key: 'wedding_planner', label: 'Planners', count: profiles.filter(p => p.role === 'wedding_planner').length },
            { key: 'catering',        label: 'Catering', count: profiles.filter(p => p.role === 'catering').length },
          ] as { key: 'venue_owner' | 'wedding_planner' | 'catering'; label: string; count: number }[]).map(tab => (
            <button key={tab.key} onClick={() => { setCrmTab(tab.key); setSearch(''); setFilterStatus('all'); setFilterPlan('all') }}
              style={{
                padding: '10px 18px', fontSize: 13, fontWeight: crmTab === tab.key ? 600 : 400,
                color: crmTab === tab.key ? 'var(--gold)' : 'var(--warm-gray)',
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                borderBottom: crmTab === tab.key ? '2px solid var(--gold)' : '2px solid transparent',
                background: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', marginBottom: -1,
              }}>
              {tab.label} <span style={{ fontSize: 11, opacity: 0.7 }}>({tab.count})</span>
            </button>
          ))}
        </div>

        <div className="page-content">
          {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}
          {error   && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{error}</div>}

          {/* Expiring trials alert */}
          {subCounts.expiring > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <AlertTriangle size={16} style={{ color: '#b45309', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
                  {subCounts.expiring} trial{subCounts.expiring > 1 ? 's' : ''} expiran en menos de 7 días
                </span>
                <span style={{ fontSize: 12, color: '#b45309', marginLeft: 8 }}>
                  — Contacta con estos venues para gestionar el cobro
                </span>
              </div>
              <button className="btn btn-sm"
                style={{ background: '#fef9ec', border: '1px solid #fcd34d', color: '#92400e', fontSize: 11 }}
                onClick={() => setFilterPlan('expiring')}>Ver</button>
            </div>
          )}

          {/* Stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: `repeat(${crmTab === 'venue_owner' ? 5 : 4}, 1fr)` }}>
            <div className="stat-card accent">
              <div className="stat-label">{crmTab === 'venue_owner' ? 'Venue owners' : crmTab === 'wedding_planner' ? 'Planners' : 'Caterings'}</div>
              <div className="stat-value">{owners.length}</div>
              <div className="stat-sub">{counts.active} activos · {counts.pending} por verificar</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pagando</div>
              <div className="stat-value" style={{ color: subCounts.active > 0 ? 'var(--gold)' : undefined }}>{subCounts.active}</div>
              <div className="stat-sub">{subCounts.premium} premium · {subCounts.basic} básico</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">En trial</div>
              <div className="stat-value" style={{ color: subCounts.trial > 0 ? '#b45309' : undefined }}>{subCounts.trial}</div>
              <div className="stat-sub">
                Pendientes de cobro
                {subCounts.trial_expired > 0 && <> · <span style={{ color: '#c0392b', fontWeight: 600 }}>{subCounts.trial_expired} fin de trial</span></>}
              </div>
            </div>
            <div className="stat-card" style={{ cursor: subCounts.expiring > 0 ? 'pointer' : undefined }}
              onClick={() => subCounts.expiring > 0 && setFilterPlan('expiring')}>
              <div className="stat-label" style={{ color: subCounts.expiring > 0 ? '#c0392b' : undefined }}>
                {subCounts.expiring > 0 ? <><AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}</> : ''}Expiran pronto
              </div>
              <div className="stat-value" style={{ color: subCounts.expiring > 0 ? '#c0392b' : undefined }}>{subCounts.expiring}</div>
              <div className="stat-sub">En menos de 7 días</div>
            </div>
            {crmTab === 'venue_owner' && (
              <div className="stat-card">
                <div className="stat-label">Venues en WP</div>
                <div className="stat-value">{wpVenues.length}</div>
                <div className="stat-sub">{wpVenues.length > 0 ? 'Cargados ✓' : 'Sin cargar'}</div>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="card">
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--ivory)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                <input className="form-input" style={{ paddingLeft: 28, fontSize: 12, padding: '7px 12px 7px 28px' }}
                  placeholder="Buscar por nombre, empresa, username..."
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {([['all','Todos'], ['pending','⏳ Por verificar'], ['pending','Pendientes'], ['active','Activos'], ['inactive','Inactivos']] as [string,string][]).map(([k, label]) => (
                  <button key={k} onClick={() => setFilterStatus(k)}
                    className={`btn btn-sm ${filterStatus === k ? 'btn-primary' : 'btn-ghost'}`}>
                    {label}{k !== 'all' ? ` (${counts[k as keyof typeof counts] ?? 0})` : ` (${owners.length})`}
                  </button>
                ))}
              </div>
              <select className="form-input" style={{ fontSize: 11, padding: '6px 10px', width: 'auto', minWidth: 170 }}
                value={filterPlan} onChange={e => setFilterPlan(e.target.value)}>
                <option value="all">Todos los planes</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.display_name || p.name}{!p.is_active ? ' (inactivo)' : ''}
                  </option>
                ))}
                <option value="trial">En trial</option>
                <option value="trial_expired">Fin de trial {subCounts.trial_expired > 0 ? `(${subCounts.trial_expired})` : ''}</option>
                <option value="expiring">Trial expirando {subCounts.expiring > 0 ? `(${subCounts.expiring})` : ''}</option>
                <option value="paused">Pausados</option>
                <option value="none">Sin plan</option>
              </select>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Empresa</th>
                    <th>Estado</th>
                    {crmTab === 'venue_owner' && <th>Venues WP</th>}
                    <th>Plan / Suscripción</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={crmTab === 'venue_owner' ? 6 : 5} style={{ textAlign: 'center', padding: 40, color: 'var(--warm-gray)' }}>
                      {search || filterStatus !== 'all' || filterPlan !== 'all' ? 'Sin resultados' : `No hay ${crmTab === 'venue_owner' ? 'venue owners' : crmTab === 'wedding_planner' ? 'planners' : 'caterings'} registrados todavía`}
                    </td></tr>
                  )}
                  {filtered.map(p => {
                    const info         = getSubInfo(p.user_id)
                    const myVenueCount = userVenues.filter(v => v.user_id === p.user_id).length
                    const primaryVenue = getVenueName(p.wp_venue_id)
                    const dLeft        = info?.sub.status === 'trial' ? trialDaysLeft(info.sub.trial_end_date) : null
                    const tBadge       = trialBadge(dLeft)

                    return (
                      <tr key={p.user_id} style={{ cursor: 'pointer' }} onClick={() => openPanel(p)}>
                        <td>
                          {/* Avatar + name */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                              background: p.status === 'active' ? '#fef9ec' : '#f3f4f6',
                              border: `2px solid ${p.status === 'active' ? '#fde68a' : '#e5e7eb'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 700, color: p.status === 'active' ? '#92400e' : '#9ca3af',
                              fontFamily: 'Manrope, sans-serif',
                            }}>
                              {(p.first_name?.[0] || p.email?.[0] || '?').toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--espresso)', lineHeight: 1.2 }}>
                                {[p.first_name, p.last_name].filter(Boolean).join(' ') || <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--warm-gray)' }}>{p.user_id.slice(0, 12)}…</span>}
                              </div>
                              {p.email && (
                                <div style={{ fontSize: 11, color: '#0369a1', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Mail size={9} /> {p.email}
                                </div>
                              )}
                              {p.phone && (
                                <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Phone size={9} /> {p.phone}
                                </div>
                              )}
                              <div style={{ fontSize: 10, color: 'var(--stone)', marginTop: 2, display: 'flex', gap: 8 }}>
                                <span>Alta {new Date(p.created_at).toLocaleDateString('es-ES')}</span>
                                {p.last_sign_in_at && (
                                  <span style={{ color: 'var(--warm-gray)' }}>
                                    · Acceso {new Date(p.last_sign_in_at).toLocaleDateString('es-ES')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 12 }}>{p.company || '—'}</td>
                        <td>
                          <span className={`badge ${PROFILE_BADGE[p.status] || ''}`}>
                            {STATUS_LABEL[p.status] || p.status}
                          </span>
                        </td>
                        {crmTab === 'venue_owner' && (
                          <td style={{ fontSize: 12 }}>
                          {myVenueCount > 0 ? (
                            <div>
                              <div style={{ fontWeight: 500 }}>{primaryVenue}</div>
                              {myVenueCount > 1 && <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>+{myVenueCount - 1} más</div>}
                            </div>
                          ) : (
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}
                              onClick={e => { e.stopPropagation(); openPanel(p, 'venues') }}>
                              + Asignar
                            </button>
                          )}
                          </td>
                        )}
                        <td>
                          {info ? (
                            <div>
                              <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 3 }}>
                                <span style={{ fontSize: 12, fontWeight: 500 }}>{planLabel(info.plan)}</span>
                                {!info.plan.is_active && (
                                  <span style={{ background: '#fee2e2', color: '#c0392b', padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 700 }}>
                                    INACTIVO <AlertTriangle size={9} style={{ display: 'inline', verticalAlign: 'middle' }} />
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                                {info.sub.status === 'trial' && tBadge ? (
                                  // Show trial badge (may be "Trial expirado" or "Xd restantes")
                                  <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: tBadge.bg, color: tBadge.color }}>
                                    {tBadge.label}
                                  </span>
                                ) : (
                                  <span className={`badge ${SUB_BADGE[info.sub.status] || 'badge-inactive'}`} style={{ fontSize: 10 }}>
                                    {STATUS_LABEL[info.sub.status]}
                                  </span>
                                )}
                                {info.sub.status === 'active' && info.sub.renewal_date && (
                                  <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>
                                    {(() => {
                                      const c = getCycle(info.plan, info.sub.billing_cycle)
                                      return c ? `${c.label} · ` : ''
                                    })()}
                                    {new Date(info.sub.renewal_date).toLocaleDateString('es-ES')}
                                  </span>
                                )}
                              </div>
                              {info.sub.status === 'trial' && (
                                <button className="btn btn-sm" style={{ marginTop: 5, fontSize: 10, background: '#fef9ec', border: '1px solid #fcd34d', color: '#92400e' }}
                                  onClick={e => { e.stopPropagation(); openPanel(p, 'suscripcion') }}>
                                  <CreditCard size={9} /> Cobrar y activar
                                </button>
                              )}
                            </div>
                          ) : (
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}
                              onClick={e => { e.stopPropagation(); openPanel(p, 'suscripcion') }}>
                              + Añadir plan
                            </button>
                          )}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => openPanel(p)}>
                              <Edit2 size={11} /> Editar
                            </button>
                            <button className="btn btn-ghost btn-sm"
                              style={{ color: p.status === 'active' ? '#c0392b' : 'var(--gold)' }}
                              onClick={() => handleToggle(p.user_id, p.status)}>
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

            {filtered.length > 0 && (
              <div style={{ padding: '10px 20px', borderTop: '1px solid var(--ivory)', fontSize: 11, color: 'var(--warm-gray)' }}>
                {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
                {(search || filterStatus !== 'all' || filterPlan !== 'all') && ` de ${owners.length} totales`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateUser && (
        <CreateUserModal
          plans={plans}
          saving={saving}
          onClose={() => setShowCreateUser(false)}
          onCreate={handleCreateUser}
        />
      )}

      {selected && (
        <UserPanel
          key={selected.user_id}
          profile={selected}
          wpVenues={wpVenues}
          plans={plans}
          subscriptions={subscriptions}
          userVenues={userVenues}
          saving={saving}
          initialTab={selectedTab}
          onClose={() => setSelected(null)}
          onSaveProfile={handleSaveProfile}
          onAssignVenue={handleAssignVenue}
          trialConfig={trialConfig}
          onRemoveVenue={handleRemoveVenue}
          onSaveSubscription={handleSaveSubscription}
          onRegisterPayment={handleRegisterPayment}
        />
      )}
    </div>
  )
}

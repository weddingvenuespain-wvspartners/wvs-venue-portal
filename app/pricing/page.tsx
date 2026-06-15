'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { usePlanFeatures, type PlanFeatures, FEATURE_DEFS } from '@/lib/use-plan-features'
import { Check, X, Loader2, ArrowLeft, Shield, LogOut, Clock, PlusCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import type { BillingCycle } from '@/lib/billing-types'
import { Suspense } from 'react'

type Plan = {
  id: string
  name: string
  display_name: string | null
  description: string | null
  billing_cycles: BillingCycle[]
  permissions: Partial<PlanFeatures> | null
  is_active: boolean
  visible_on_web: boolean
  sort_order: number
  comparison_text: string | null
  target_role: string
}

const ROLE_LABELS: Record<string, string> = {
  venue_owner: 'Espacios',
  wedding_planner: 'Wedding Planners',
  catering: 'Catering',
  photographer: 'Fotógrafos',
  dj: 'DJs',
}

// ── Dynamic feature builder ──────────────────────────────────────────────────
// Reads features from plan.permissions + FEATURE_DEFS instead of hardcoded lists.
// Restrictions (tier === 'restriction') never shown on pricing page.
function buildFeatureList(plan: Plan, allPlans: Plan[]): { label: string; included: boolean }[] {
  const perms = plan.permissions ?? {}
  const features: { label: string; included: boolean }[] = []

  // If plan has comparison_text, show it first as a positive feature
  if (plan.comparison_text) {
    features.push({ label: plan.comparison_text, included: true })
  }

  for (const def of FEATURE_DEFS) {
    if (def.tier === 'restriction') continue // never show restrictions on pricing
    const included = perms[def.key] === true
    // For plans with comparison_text (higher tier), only show features unique to this plan
    if (plan.comparison_text && !included) continue // skip negatives on higher plans
    if (plan.comparison_text && included) {
      // Check if this feature is also in a lower-tier plan — skip if so
      const lowerPlan = allPlans.find(p => (p.sort_order ?? 0) < (plan.sort_order ?? 0) && p.permissions?.[def.key] === true)
      if (lowerPlan) continue // already covered by "Todo lo de X +"
    }
    features.push({ label: def.label, included })
  }

  return features
}

// ── Get unique billing intervals across all plans ────────────────────────────
function getUniqueIntervals(plans: Plan[]): { months: number; label: string }[] {
  const seen = new Map<number, string>()
  for (const plan of plans) {
    for (const c of plan.billing_cycles || []) {
      if (!seen.has(c.interval_months)) {
        seen.set(c.interval_months, c.label)
      }
    }
  }
  // Sort: monthly first, then by interval
  return Array.from(seen.entries())
    .sort(([a], [b]) => a - b)
    .map(([months, label]) => ({ months, label }))
}

function PricingPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, profile, loading: authLoading, userVenues, activeVenue } = useAuth()
  const { hasPlan, planName, planTier, isTrial, isTrialExpired, trialDaysLeft } = usePlanFeatures()
  const isPendingVerification = profile?.status === 'pending'
  const newVenueMode = searchParams.get('new_venue') === '1'
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [selectedInterval, setSelectedInterval] = useState(12) // default annual
  const [selectedVenueId, setSelectedVenueId] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<string>('venue_owner')

  useEffect(() => {
    if (activeVenue && !selectedVenueId) setSelectedVenueId(activeVenue.id)
  }, [activeVenue?.id]) // eslint-disable-line

  const isLoggedIn = !!user
  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.replace('/login')
  }

  useEffect(() => {
    const roleParam = searchParams.get('role')
    if (roleParam) setSelectedRole(roleParam)
  }, []) // eslint-disable-line

  useEffect(() => {
    fetch('/api/plans')
      .then(r => r.json())
      .then((data: Plan[]) => {
        const sorted = [...data].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        setPlans(sorted)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Auto-select plan from URL params
  useEffect(() => {
    if (!isLoggedIn || loading || plans.length === 0) return
    const planParam = searchParams.get('plan')
    const cycleParam = searchParams.get('cycle')
    if (planParam && cycleParam) handleSelectPlan(planParam, cycleParam)
  }, [isLoggedIn, loading, plans]) // eslint-disable-line

  const handleSelectPlan = async (planId: string, cycleId: string) => {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/pricing&plan=${planId}&cycle=${cycleId}`)
      return
    }
    setSubmitting(`${planId}-${cycleId}`)
    setError('')
    const venueId = newVenueMode ? null : (selectedVenueId || activeVenue?.id || null)
    try {
      const res = await fetch('/api/stripe/billing-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, cycleId, venueId }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) { setError(data.error || 'Error al preparar el pago'); setSubmitting(null); return }
      window.location.href = data.url
    } catch { setError('Error de conexión. Inténtalo de nuevo.'); setSubmitting(null) }
  }

  // Redirect to dashboard if user has an active plan (including valid trial)
  const isActive = isLoggedIn && !isPendingVerification && hasPlan
  useEffect(() => {
    if (!authLoading && isActive) router.replace('/dashboard')
  }, [authLoading, isActive, router])

  if (loading || (authLoading && !plans.length)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--cream)' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--gold)' }} />
      </div>
    )
  }

  if (isActive) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--cream)', gap: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(74,107,82,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={24} color="#4A6B52" strokeWidth={2.5} />
        </div>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 600, color: 'var(--charcoal)' }}>
          {isTrial ? '¡Tu período de prueba está activado!' : '¡Tu plan está activo!'}
        </p>
        <p style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Redirigiendo al portal...</p>
      </div>
    )
  }

  // Multi-role: get unique roles from plans
  const availableRoles = [...new Set(plans.map(p => p.target_role || 'venue_owner'))]
  const rolePlans = plans.filter(p => (p.target_role || 'venue_owner') === selectedRole)

  const intervals = getUniqueIntervals(rolePlans)
  // If selected interval doesn't exist, default to first available
  const activeInterval = intervals.find(i => i.months === selectedInterval) ? selectedInterval : intervals[0]?.months ?? 12

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {isLoggedIn ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              {!isPendingVerification && hasPlan && !isTrialExpired ? (
                <button onClick={() => router.push('/dashboard')} style={{
                  background: 'rgba(196,151,90,0.08)', border: '1px solid rgba(196,151,90,0.25)',
                  borderRadius: 20, color: 'var(--espresso)', fontSize: 12, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontFamily: 'Inter, sans-serif', padding: '6px 14px', fontWeight: 500,
                }}>
                  <ArrowLeft size={13} /> Volver al portal
                </button>
              ) : <div />}
              <button onClick={handleLogout} style={{
                background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 20,
                color: 'var(--warm-gray)', fontSize: 12, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontFamily: 'Inter, sans-serif', padding: '6px 14px', fontWeight: 500,
              }}>
                <LogOut size={12} /> Cerrar sesión
              </button>
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: 'var(--gold)', letterSpacing: '0.06em', fontWeight: 500 }}>
                FOREVENTOS
              </span>
              <span style={{ fontSize: 11, color: 'var(--warm-gray)', marginLeft: 8 }}>Venue Portal</span>
            </div>
          )}

          <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: 28, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 8 }}>
            {isTrial ? 'Activa tu suscripción' : 'Elige tu plan'}
          </h1>
          <p style={{ color: 'var(--warm-gray)', fontSize: 14, maxWidth: 520, margin: '0 auto' }}>
            {isTrial
              ? 'Estás en período de prueba. Si contratas ahora, tu suscripción se activa de inmediato.'
              : isTrialExpired
                ? 'Tu prueba ha finalizado. Elige un plan para seguir gestionando tu venue.'
                : 'Herramientas profesionales para gestionar bodas, leads y propuestas desde un solo lugar.'}
          </p>

          {/* New-venue mode banner */}
          {isLoggedIn && newVenueMode && (
            <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 20, background: 'rgba(196,151,90,0.1)', border: '1px solid rgba(196,151,90,0.25)', fontSize: 13, color: 'var(--espresso)', fontWeight: 500 }}>
              <PlusCircle size={14} color="var(--gold)" /> Añadiendo un nuevo venue a tu cuenta
            </div>
          )}

          {/* Venue selector */}
          {isLoggedIn && !newVenueMode && userVenues.length > 1 && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Contratar para:</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {userVenues.map(v => (
                  <button key={v.id} type="button" onClick={() => setSelectedVenueId(v.id)} style={{
                    padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif', fontWeight: 600,
                    border: v.id === selectedVenueId ? '1.5px solid var(--gold)' : '1px solid rgba(0,0,0,0.15)',
                    background: v.id === selectedVenueId ? 'rgba(196,151,90,0.12)' : 'transparent',
                    color: v.id === selectedVenueId ? 'var(--espresso)' : 'var(--warm-gray)',
                  }}>
                    {v.name ?? `Venue ${v.wp_venue_id}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status banners */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 12 }}>
            {isLoggedIn && isTrial && !isTrialExpired && (
              <div style={{ padding: '8px 16px', background: 'rgba(196,151,90,0.1)', borderRadius: 8, fontSize: 13, color: 'var(--gold)', textAlign: 'center' }}>
                Tu plan actual: <strong>{planName}</strong> (período de prueba)
                {trialDaysLeft !== null && (
                  <span style={{
                    display: 'inline-block', marginLeft: 8, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                    background: trialDaysLeft <= 3 ? 'rgba(176,71,62,0.12)' : 'rgba(196,151,90,0.15)',
                    color: trialDaysLeft <= 3 ? '#B0473E' : 'var(--gold)',
                  }}>
                    {trialDaysLeft} días restantes
                  </span>
                )}
              </div>
            )}
            {isLoggedIn && isTrialExpired && (
              <div style={{ padding: '12px 20px', background: 'rgba(176,71,62,0.06)', border: '1px solid rgba(176,71,62,0.2)', borderRadius: 8, fontSize: 13, color: '#B0473E', textAlign: 'center', lineHeight: 1.6 }}>
                <strong>Tu período de prueba ha finalizado.</strong><br />
                Escoge un plan para seguir utilizando la plataforma.
              </div>
            )}
            {isLoggedIn && hasPlan && !isTrial && (
              <div style={{ padding: '6px 14px', background: 'rgba(196,151,90,0.1)', borderRadius: 6, fontSize: 12, color: 'var(--gold)' }}>
                Tu plan actual: <strong>{planName}</strong>
              </div>
            )}
            {!isLoggedIn && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(196,151,90,0.1)', borderRadius: 20, padding: '6px 16px', fontSize: 13, color: 'var(--gold)', fontWeight: 500 }}>
                <Check size={14} /> Prueba gratis 14 días — sin compromiso
              </div>
            )}
          </div>

          {/* Role tabs — only show if plans exist for multiple roles */}
          {availableRoles.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 24, padding: '4px', background: 'rgba(0,0,0,0.03)', borderRadius: 24, width: 'fit-content', margin: '24px auto 0' }}>
              {availableRoles.map(role => (
                <button key={role} onClick={() => setSelectedRole(role)} style={{
                  padding: '8px 20px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', border: 'none',
                  fontWeight: selectedRole === role ? 600 : 400,
                  background: selectedRole === role ? '#fff' : 'transparent',
                  color: selectedRole === role ? 'var(--charcoal)' : 'var(--warm-gray)',
                  boxShadow: selectedRole === role ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s',
                }}>
                  {ROLE_LABELS[role] || role}
                </button>
              ))}
            </div>
          )}

          {/* Billing interval selector — supports all available intervals */}
          {intervals.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 }}>
              {intervals.map(interval => (
                <button key={interval.months} onClick={() => setSelectedInterval(interval.months)} style={{
                  padding: '8px 18px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', fontWeight: activeInterval === interval.months ? 600 : 400,
                  border: activeInterval === interval.months ? '1.5px solid var(--gold)' : '1px solid rgba(0,0,0,0.12)',
                  background: activeInterval === interval.months ? 'rgba(196,151,90,0.12)' : 'transparent',
                  color: activeInterval === interval.months ? 'var(--charcoal)' : 'var(--warm-gray)',
                  transition: 'all 0.15s',
                }}>
                  {interval.label}
                </button>
              ))}
              {activeInterval === 12 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: '#4A6B52', background: 'rgba(74,107,82,0.08)', padding: '3px 8px', borderRadius: 4 }}>
                  Ahorra 2 meses
                </span>
              )}
            </div>
          )}
        </div>

        {/* Pending verification banners */}
        {isPendingVerification && (!hasPlan || isTrial) && (
          <div style={{ background: 'rgba(121,111,78,0.08)', border: '1px solid rgba(121,111,78,0.25)', borderRadius: 12, padding: '20px 24px', marginBottom: 28, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: 'rgba(121,111,78,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} color="var(--gold)" />
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--charcoal)' }}>Estamos verificando tu venue</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.6 }}>
                Nuestro equipo revisará tu registro en menos de <strong>24–48 horas</strong>. Mientras tanto ya puedes contratar tu plan — empezará en cuanto activemos tu cuenta.
              </p>
            </div>
          </div>
        )}
        {isPendingVerification && hasPlan && !isTrial && (
          <div style={{ background: 'rgba(74,107,82,0.06)', border: '1px solid rgba(74,107,82,0.25)', borderRadius: 12, padding: '20px 24px', marginBottom: 28, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: 'rgba(74,107,82,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={18} color="#4A6B52" />
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--charcoal)' }}>Plan contratado — verificación en curso</p>
              <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                Perfecto, ya tienes tu plan <strong>{planName}</strong> listo. En cuanto nuestro equipo verifique tu venue recibirás un email y podrás acceder al portal.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(188,82,73,0.08)', border: '1px solid rgba(188,82,73,0.2)', borderRadius: 8, padding: '10px 16px', color: '#B0473E', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>
            {error}
          </div>
        )}

        {/* ── Plans grid ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: rolePlans.length > 2 ? 'repeat(auto-fit, minmax(280px, 1fr))' : rolePlans.length === 2 ? 'repeat(2, 1fr)' : '1fr',
          gap: 24,
          maxWidth: rolePlans.length === 1 ? 420 : undefined,
          margin: '0 auto',
        }}>
          {rolePlans.map(plan => {
            const isPremium = plan.name.toLowerCase().includes('premium') || (plan.sort_order ?? 0) >= 1
            const features = buildFeatureList(plan, rolePlans)
            const isCurrentPlan = isLoggedIn && hasPlan && !isTrial && (
              (isPremium && planTier === 'premium') || (!isPremium && planTier === 'basic')
            )

            // Find cycle matching selected interval, fallback to first
            const cycle = plan.billing_cycles.find((c: BillingCycle) => c.interval_months === activeInterval) || plan.billing_cycles[0]
            const cycleKey = `${plan.id}-${cycle?.id}`
            const isLoading = submitting === cycleKey

            // Monthly equivalent price
            const monthlyEquiv = cycle && cycle.interval_months > 1
              ? Math.round(cycle.price / cycle.interval_months)
              : null

            return (
              <div key={plan.id} style={{
                background: '#fff',
                border: isPremium ? '2px solid var(--gold)' : '2px solid var(--ivory)',
                borderRadius: 14, padding: '32px 28px',
                position: 'relative',
                boxShadow: isPremium ? '0 8px 32px rgba(196,151,90,0.1)' : undefined,
                display: 'flex', flexDirection: 'column',
              }}>
                {isPremium && (
                  <div style={{
                    position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--gold)', color: '#fff', fontSize: 10, fontWeight: 600,
                    padding: '4px 14px', borderRadius: '0 0 8px 8px',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>
                    Recomendado
                  </div>
                )}

                <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 20, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4, marginTop: 0 }}>
                  {plan.display_name || plan.name}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 0, minHeight: 18 }}>
                  {plan.description || ' '}
                </p>

                {/* Price */}
                <div style={{ marginTop: 20, paddingBottom: 20, borderBottom: '1px solid var(--ivory)' }}>
                  <span style={{ fontSize: 36, fontWeight: 700, color: 'var(--charcoal)' }}>
                    {cycle?.price || 0}€
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--warm-gray)', marginLeft: 4 }}>
                    /{cycle?.label?.toLowerCase() || 'mes'}
                  </span>
                  {monthlyEquiv !== null && (
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 4 }}>
                      <strong style={{ color: '#4A6B52' }}>{monthlyEquiv}€/mes</strong> facturado {cycle?.label?.toLowerCase()}mente
                    </div>
                  )}
                  {!cycle && (
                    <div style={{ fontSize: 12, color: '#B0473E', marginTop: 4 }}>
                      No disponible en este período
                    </div>
                  )}
                </div>

                {/* Feature list — dynamic from DB */}
                <div style={{ marginTop: 20, marginBottom: 24, flex: 1 }}>
                  {features.map(({ label, included }) => (
                    <div key={label} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '5px 0', fontSize: 13,
                      color: included ? 'var(--charcoal)' : '#bbb',
                    }}>
                      {included
                        ? <Check size={15} color="var(--gold)" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                        : <X size={15} color="#ddd" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                      }
                      {label}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  onClick={() => cycle && handleSelectPlan(plan.id, cycle.id)}
                  disabled={!!submitting || isCurrentPlan || !cycle}
                  style={{
                    width: '100%', padding: '12px 0', borderRadius: 8, border: 'none',
                    fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500,
                    cursor: submitting || isCurrentPlan || !cycle ? 'default' : 'pointer',
                    transition: 'all 0.15s',
                    background: isCurrentPlan ? 'var(--ivory)' : !cycle ? '#e5e7eb' : isPremium ? 'var(--gold)' : 'var(--charcoal)',
                    color: isCurrentPlan ? 'var(--warm-gray)' : '#fff',
                    opacity: (submitting && !isLoading) ? 0.5 : 1,
                  }}
                >
                  {isLoading ? (
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : isCurrentPlan ? 'Plan actual' : !isLoggedIn ? 'Empezar ahora' : !cycle ? 'No disponible' : 'Contratar'}
                </button>
              </div>
            )
          })}
        </div>

        {/* ── Feature comparison table ── */}
        {rolePlans.length > 1 && (
          <div style={{ marginTop: 48, marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 20, fontWeight: 600, color: 'var(--charcoal)', textAlign: 'center', marginBottom: 24 }}>
              Comparativa de funcionalidades
            </h2>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--ivory)', overflow: 'hidden' }}>
              {/* Header row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `1fr ${rolePlans.map(() => '120px').join(' ')}`,
                borderBottom: '2px solid var(--ivory)', padding: '14px 20px',
                background: 'var(--cream)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Funcionalidad
                </div>
                {rolePlans.map(plan => (
                  <div key={plan.id} style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--charcoal)' }}>
                    {plan.display_name || plan.name}
                  </div>
                ))}
              </div>
              {/* Feature rows */}
              {FEATURE_DEFS.filter(f => f.tier !== 'restriction').map((def, i) => (
                <div key={def.key} style={{
                  display: 'grid',
                  gridTemplateColumns: `1fr ${rolePlans.map(() => '120px').join(' ')}`,
                  padding: '10px 20px',
                  background: i % 2 === 0 ? '#fff' : 'var(--cream)',
                  borderBottom: '1px solid var(--ivory)',
                }}>
                  <div style={{ fontSize: 13, color: 'var(--charcoal)' }} title={def.description}>
                    {def.label}
                    {def.tier === 'premium' && (
                      <span style={{ fontSize: 9, marginLeft: 6, color: '#7A5A2E', background: '#F6F1E4', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>PRO</span>
                    )}
                  </div>
                  {rolePlans.map(plan => {
                    const included = plan.permissions?.[def.key] === true
                    return (
                      <div key={plan.id} style={{ textAlign: 'center' }}>
                        {included
                          ? <Check size={16} color="#4A6B52" strokeWidth={2.5} />
                          : <X size={16} color="#ddd" strokeWidth={2} />
                        }
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 32, color: 'var(--warm-gray)', fontSize: 12 }}>
          <Shield size={14} />
          <span>Pago seguro procesado por Stripe — Tus datos de tarjeta nunca pasan por nuestros servidores</span>
        </div>

        {!isLoggedIn && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--warm-gray)' }}>¿Ya tienes cuenta? </span>
            <button onClick={() => router.push('/login')} style={{
              background: 'none', border: 'none', color: 'var(--gold)',
              fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
            }}>
              Iniciar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PricingPage() {
  return <Suspense><PricingPageInner /></Suspense>
}

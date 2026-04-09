'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { usePlanFeatures, BASIC_FALLBACK, PREMIUM_FALLBACK, type PlanFeatures } from '@/lib/use-plan-features'
import { Check, X, Loader2, ArrowLeft, Shield } from 'lucide-react'
import type { BillingCycle } from '@/lib/billing-types'
import { Suspense } from 'react'

type Plan = {
  id: string
  name: string
  display_name: string | null
  description: string | null
  billing_cycles: BillingCycle[]
  is_active: boolean
  visible_on_web: boolean
}

const FEATURE_LABELS: { key: keyof PlanFeatures; label: string }[] = [
  { key: 'ficha',             label: 'Ficha del venue' },
  { key: 'leads',             label: 'Gestión de leads' },
  { key: 'leads_date_filter', label: 'Filtrar leads por fecha' },
  { key: 'leads_export',      label: 'Exportar leads a CSV' },
  { key: 'calendario',        label: 'Calendario de disponibilidad' },
  { key: 'propuestas',        label: 'Propuestas digitales' },
  { key: 'propuestas_web',    label: 'Web de propuesta pública' },
  { key: 'comunicacion',      label: 'Comunicación y tarifas' },
  { key: 'estadisticas',      label: 'Estadísticas y métricas' },
]

function PricingPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { hasPlan, planName, planTier } = usePlanFeatures()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [billingAnnual, setBillingAnnual] = useState(true)
  const formRef = useRef<HTMLFormElement>(null)

  const isLoggedIn = !!user

  // Load plans
  useEffect(() => {
    fetch('/api/plans')
      .then(r => r.json())
      .then((data: Plan[]) => {
        const sorted = [...data].sort((a, b) => {
          const aP = a.name.toLowerCase().includes('premium') ? 1 : 0
          const bP = b.name.toLowerCase().includes('premium') ? 1 : 0
          return aP - bP
        })
        setPlans(sorted)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Auto-select plan from URL params (after login redirect)
  useEffect(() => {
    if (!isLoggedIn || loading || plans.length === 0) return
    const planParam = searchParams.get('plan')
    const cycleParam = searchParams.get('cycle')
    if (planParam && cycleParam) {
      handleSelectPlan(planParam, cycleParam)
    }
  }, [isLoggedIn, loading, plans]) // eslint-disable-line

  const handleSelectPlan = async (planId: string, cycleId: string) => {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/pricing&plan=${planId}&cycle=${cycleId}`)
      return
    }

    setSubmitting(`${planId}-${cycleId}`)
    setError('')

    localStorage.setItem('wvs_pending_plan', JSON.stringify({ planId, cycleId }))

    try {
      const res = await fetch('/api/redsys/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, cycleId }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Error al preparar el pago')
        setSubmitting(null)
        return
      }

      const form = formRef.current
      if (!form) return
      form.action = data.formData.redsysUrl
      form.method = 'POST'

      while (form.firstChild) form.removeChild(form.firstChild)

      for (const [key, value] of Object.entries(data.formData) as [string, string][]) {
        if (key === 'redsysUrl') continue
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = value
        form.appendChild(input)
      }

      form.submit()
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
      setSubmitting(null)
    }
  }

  if (loading || (authLoading && !plans.length)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--cream)' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--gold)' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '40px 20px' }}>
      <form ref={formRef} style={{ display: 'none' }} />

      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {isLoggedIn ? (
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                background: 'none', border: 'none', color: 'var(--warm-gray)',
                fontSize: 12, cursor: 'pointer', marginBottom: 16, display: 'inline-flex',
                alignItems: 'center', gap: 4, fontFamily: 'Manrope, sans-serif',
              }}
            >
              <ArrowLeft size={14} /> Volver al portal
            </button>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, color: 'var(--gold)', letterSpacing: '0.06em', fontWeight: 500 }}>
                Wedding Venues Spain
              </span>
              <span style={{ fontSize: 11, color: 'var(--warm-gray)', marginLeft: 8 }}>Partner Portal</span>
            </div>
          )}

          <h1 style={{
            fontFamily: 'Manrope, sans-serif', fontSize: 28, fontWeight: 600,
            color: 'var(--charcoal)', marginBottom: 8,
          }}>
            Elige tu plan
          </h1>
          <p style={{ color: 'var(--warm-gray)', fontSize: 14, maxWidth: 500, margin: '0 auto' }}>
            Potencia tu venue con las herramientas que necesitas para gestionar bodas de forma profesional.
          </p>

          {isLoggedIn && hasPlan && (
            <div style={{
              display: 'inline-block', marginTop: 12, padding: '6px 14px',
              background: 'rgba(196,151,90,0.1)', borderRadius: 6,
              fontSize: 12, color: 'var(--gold)',
            }}>
              Tu plan actual: <strong>{planName}</strong>
            </div>
          )}

          {/* Trial banner */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16,
            background: 'rgba(196,151,90,0.1)', borderRadius: 20, padding: '6px 16px',
            fontSize: 13, color: 'var(--gold)', fontWeight: 500,
          }}>
            <Check size={14} /> Prueba gratis 30 días — sin compromiso
          </div>

          {/* Billing toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12, marginTop: 24,
          }}>
            <span style={{
              fontSize: 14, fontWeight: billingAnnual ? 400 : 600,
              color: billingAnnual ? 'var(--warm-gray)' : 'var(--charcoal)',
            }}>
              Mensual
            </span>
            <button onClick={() => setBillingAnnual(!billingAnnual)} style={{
              width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
              background: billingAnnual ? 'var(--gold)' : 'var(--ivory)',
              position: 'relative', transition: 'background 0.2s', padding: 0,
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                left: billingAnnual ? 25 : 3,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }} />
            </button>
            <span style={{
              fontSize: 14, fontWeight: billingAnnual ? 600 : 400,
              color: billingAnnual ? 'var(--charcoal)' : 'var(--warm-gray)',
            }}>
              Anual
            </span>
            {billingAnnual && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#16a34a',
                background: 'rgba(22,163,74,0.08)', padding: '3px 8px', borderRadius: 4,
              }}>
                Ahorra 2 meses
              </span>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8, padding: '10px 16px', color: '#dc2626', fontSize: 13,
            textAlign: 'center', marginBottom: 24,
          }}>
            {error}
          </div>
        )}

        {/* Plans grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: plans.length > 1 ? 'repeat(auto-fit, minmax(340px, 1fr))' : '1fr',
          gap: 24,
          maxWidth: plans.length === 1 ? 420 : undefined,
          margin: '0 auto',
        }}>
          {plans.map(plan => {
            const isPremium = plan.name.toLowerCase().includes('premium')
            const features = isPremium ? PREMIUM_FALLBACK : BASIC_FALLBACK
            const isCurrentPlan = isLoggedIn && hasPlan && (
              (isPremium && planTier === 'premium') ||
              (!isPremium && planTier === 'basic')
            )

            // Find the cycle matching the toggle
            const cycle = plan.billing_cycles.find((c: BillingCycle) =>
              billingAnnual ? c.interval_months === 12 : c.interval_months === 1
            ) || plan.billing_cycles[0]

            const cycleKey = `${plan.id}-${cycle?.id}`
            const isLoading = submitting === cycleKey

            return (
              <div
                key={plan.id}
                style={{
                  background: '#fff',
                  border: isPremium ? '2px solid var(--gold)' : '1px solid var(--ivory)',
                  borderRadius: 14,
                  padding: '32px 28px',
                  position: 'relative',
                  boxShadow: isPremium ? '0 8px 32px rgba(196,151,90,0.1)' : undefined,
                }}
              >
                {isPremium && (
                  <div style={{
                    position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--gold)', color: '#fff', fontSize: 10, fontWeight: 600,
                    padding: '4px 14px', borderRadius: '0 0 8px 8px',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    fontFamily: 'Manrope, sans-serif',
                  }}>
                    Recomendado
                  </div>
                )}

                <h2 style={{
                  fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 600,
                  color: 'var(--charcoal)', marginBottom: 4, marginTop: isPremium ? 10 : 0,
                }}>
                  {plan.display_name || plan.name}
                </h2>

                {plan.description && (
                  <p style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 0 }}>
                    {plan.description}
                  </p>
                )}

                {/* Price */}
                <div style={{ marginTop: 20, paddingBottom: 20, borderBottom: '1px solid var(--ivory)' }}>
                  <span style={{ fontSize: 36, fontWeight: 700, color: 'var(--charcoal)' }}>
                    {cycle?.price || 0}€
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--warm-gray)', marginLeft: 4 }}>
                    /{billingAnnual ? 'año' : 'mes'}
                  </span>
                  {billingAnnual && cycle && (
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 4 }}>
                      {Math.round(cycle.price / 12)}€/mes facturado anualmente
                    </div>
                  )}
                </div>

                {/* Feature list */}
                <div style={{ marginTop: 20, marginBottom: 24 }}>
                  {[...FEATURE_LABELS].sort((a, b) => {
                    return (features[a.key] ? 0 : 1) - (features[b.key] ? 0 : 1)
                  }).map(({ key, label }) => {
                    const included = features[key]
                    return (
                      <div key={key} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '5px 0', fontSize: 13,
                        color: included ? 'var(--charcoal)' : 'var(--warm-gray)',
                        opacity: included ? 1 : 0.4,
                      }}>
                        {included
                          ? <Check size={15} color="var(--gold)" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                          : <X size={15} style={{ flexShrink: 0 }} />
                        }
                        {label}
                      </div>
                    )
                  })}
                </div>

                {/* CTA button */}
                <button
                  onClick={() => cycle && handleSelectPlan(plan.id, cycle.id)}
                  disabled={!!submitting || isCurrentPlan || !cycle}
                  style={{
                    width: '100%', padding: '12px 0', borderRadius: 8, border: 'none',
                    fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 500,
                    cursor: submitting || isCurrentPlan ? 'default' : 'pointer',
                    transition: 'all 0.15s',
                    background: isCurrentPlan ? 'var(--ivory)' : isPremium ? 'var(--gold)' : 'var(--charcoal)',
                    color: isCurrentPlan ? 'var(--warm-gray)' : '#fff',
                    opacity: submitting && !isLoading ? 0.5 : 1,
                  }}
                >
                  {isLoading ? (
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : isCurrentPlan ? (
                    'Plan actual'
                  ) : !isLoggedIn ? (
                    'Empezar ahora'
                  ) : (
                    'Contratar'
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, marginTop: 32, color: 'var(--warm-gray)', fontSize: 12,
        }}>
          <Shield size={14} />
          <span>Pago seguro procesado por Redsys — Tus datos de tarjeta nunca pasan por nuestros servidores</span>
        </div>

        {!isLoggedIn && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--warm-gray)' }}>¿Ya tienes cuenta? </span>
            <button
              onClick={() => router.push('/login')}
              style={{
                background: 'none', border: 'none', color: 'var(--gold)',
                fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              Iniciar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense>
      <PricingPageInner />
    </Suspense>
  )
}

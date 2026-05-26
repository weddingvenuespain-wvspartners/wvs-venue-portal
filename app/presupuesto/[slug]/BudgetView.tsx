'use client'
import { useEffect, useState, useRef } from 'react'
import type { Budget, PaymentInstallment, LineItemGroup } from '@/lib/budget-types'
import {
  Receipt, Calendar, Users, Clock, CheckCircle, AlertCircle, Lock,
  CreditCard, MapPin, Phone, Mail, Globe, ChevronDown, ChevronUp,
  Sparkles, Building2, ArrowRight, Loader2, Check,
} from 'lucide-react'

type VenueInfo = {
  name: string | null
  logo_url: string | null
  contact_email: string | null
  contact_phone: string | null
  description?: string | null
  short_bio?: string | null
  photo_urls?: string[] | null
  features?: string[] | null
  capacity_min?: number | null
  capacity_max?: number | null
  city?: string | null
  address?: string | null
  website?: string | null
}

type Props = {
  budget: Budget
  venue: VenueInfo | null
  branding: { primary_color: string | null; logo_url: string | null; font_family: string | null } | null
  isPreview: boolean
  hasPassword: boolean
}

type TabKey = 'presupuesto' | 'pagos' | 'espacio'

export default function BudgetView({ budget, venue, branding, isPreview, hasPassword }: Props) {
  const primaryColor = branding?.primary_color || '#c9963a'
  const logo = branding?.logo_url || venue?.logo_url
  const venueName = venue?.name || 'Venue'
  const fontFamily = branding?.font_family || 'Inter, sans-serif'
  const [unlocked, setUnlocked] = useState(!hasPassword || isPreview)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('presupuesto')
  const [payingIndex, setPayingIndex] = useState<number | null>(null)
  const [paySuccess, setPaySuccess] = useState<number | null>(null)
  const [payError, setPayError] = useState<number | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Check URL params for payment result
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('paid') === '1') {
      const idx = parseInt(params.get('cuota') || '0', 10)
      setPaySuccess(idx)
      setActiveTab('pagos')
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('error') === '1') {
      const idx = parseInt(params.get('cuota') || '0', 10)
      setPayError(idx)
      setActiveTab('pagos')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Track view
  useEffect(() => {
    if (isPreview || !unlocked) return
    fetch('/api/budgets/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: budget.slug }),
    })
  }, [unlocked])

  const groups = budget.line_items?.groups || []
  const subtotal = groups.reduce((s, g) => s + g.items.reduce((a, i) => a + i.subtotal, 0), 0)
  const isExpired = budget.valid_until && new Date(budget.valid_until) < new Date() && budget.status !== 'accepted'
  const today = new Date().toISOString().slice(0, 10)
  const paymentPlan = (budget.payment_plan || []) as (PaymentInstallment & { paid_at?: string })[]
  const paidTotal = paymentPlan.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const paidPercent = budget.total_amount > 0 ? Math.round((paidTotal / budget.total_amount) * 100) : 0
  const hasPayments = paymentPlan.length > 0

  const handlePasswordSubmit = async () => {
    setPwError(false)
    const res = await fetch('/api/budgets/check-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: budget.slug, password: pwInput }),
    })
    const data = await res.json()
    if (data.ok) setUnlocked(true)
    else setPwError(true)
  }

  const payInstallment = async (index: number) => {
    setPayingIndex(index)
    setPayError(null)
    try {
      const res = await fetch('/api/budget-payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: budget.slug, installmentIndex: index }),
      })
      const data = await res.json()
      if (!data.success || !data.formData) {
        setPayError(index)
        setPayingIndex(null)
        return
      }
      // Submit Redsys redirect form
      const form = formRef.current
      if (!form) return
      form.action = data.formData.redsysUrl
      form.method = 'POST'
      // Clear previous hidden inputs
      form.innerHTML = ''
      for (const [key, value] of Object.entries(data.formData)) {
        if (key === 'redsysUrl') continue
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = value as string
        form.appendChild(input)
      }
      form.submit()
    } catch {
      setPayError(index)
      setPayingIndex(null)
    }
  }

  // Password screen
  if (!unlocked) {
    return (
      <div style={{ minHeight: '100vh', background: '#faf8f5', fontFamily, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '40px 32px', maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', border: '1px solid #e8e2d9' }}>
          {logo && <img src={logo} alt={venueName} style={{ height: 40, objectFit: 'contain', marginBottom: 20 }} />}
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: `${primaryColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Lock size={24} style={{ color: primaryColor }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', fontFamily, marginBottom: 6 }}>Presupuesto protegido</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>Introduce la contrasena para ver el presupuesto de {budget.couple_name}</div>
          <form onSubmit={e => { e.preventDefault(); handlePasswordSubmit() }}>
            <input
              type="password" value={pwInput}
              onChange={e => { setPwInput(e.target.value); setPwError(false) }}
              placeholder="Contrasena"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14, border: `1px solid ${pwError ? '#fca5a5' : '#e8e2d9'}`, outline: 'none', background: pwError ? '#fef2f2' : '#fff', marginBottom: 8, boxSizing: 'border-box' }}
              autoFocus
            />
            {pwError && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>Contrasena incorrecta</div>}
            <button type="submit" style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: primaryColor, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>
              Acceder
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Tab definitions ─────────────────────────────────────────────────────────
  const tabs: { key: TabKey; label: string; icon: typeof Receipt }[] = [
    { key: 'presupuesto', label: 'Presupuesto', icon: Receipt },
    ...(hasPayments ? [{ key: 'pagos' as TabKey, label: 'Pagos', icon: CreditCard }] : []),
    { key: 'espacio', label: venueName, icon: Building2 },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f5', fontFamily }}>
      {/* Hidden form for Redsys redirect */}
      <form ref={formRef} style={{ display: 'none' }} />

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: `3px solid ${primaryColor}`, padding: '28px 24px 0', textAlign: 'center' }}>
        {logo && <img src={logo} alt={venueName} style={{ height: 44, objectFit: 'contain', marginBottom: 14 }} />}
        <div style={{ fontSize: 13, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{venueName}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a', fontFamily }}>{budget.couple_name}</div>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          {budget.wedding_date && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#666' }}>
              <Calendar size={14} /> {new Date(budget.wedding_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
          {budget.guest_count && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#666' }}>
              <Users size={14} /> {budget.guest_count} invitados
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginTop: 20 }}>
          {tabs.map(tab => {
            const active = activeTab === tab.key
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: `3px solid ${active ? primaryColor : 'transparent'}`,
                  marginBottom: -3,
                  color: active ? '#1a1a1a' : '#999',
                  fontWeight: active ? 600 : 400,
                  fontSize: 13, fontFamily,
                  transition: 'all .15s',
                }}
              >
                <Icon size={15} /> {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 60px' }}>

        {/* Expired banner */}
        {isExpired && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#991b1b' }}>
            <AlertCircle size={16} /> Este presupuesto ha expirado
          </div>
        )}

        {/* Payment success banner */}
        {paySuccess !== null && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '14px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#166534' }}>
            <CheckCircle size={16} /> Pago realizado correctamente. Tu cuota ha sido registrada.
          </div>
        )}

        {/* ═══ TAB: PRESUPUESTO ═══ */}
        {activeTab === 'presupuesto' && (
          <>
            {/* Personal message */}
            {budget.notes && (
              <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, padding: '20px 24px', marginBottom: 20, fontSize: 14, color: '#444', lineHeight: 1.7, whiteSpace: 'pre-wrap', borderLeft: `4px solid ${primaryColor}` }}>
                {budget.notes}
              </div>
            )}

            {/* Validity */}
            {budget.valid_until && !isExpired && (
              <div style={{ fontSize: 12, color: '#888', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={13} /> Valido hasta el {new Date(budget.valid_until + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}

            {/* Line items */}
            <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, overflow: 'hidden', marginBottom: 20, opacity: isExpired ? 0.5 : 1 }}>
              {groups.map((g, gi) => (
                <CollapsibleGroup key={gi} group={g} primaryColor={primaryColor} />
              ))}

              {/* Summary */}
              <div style={{ borderTop: '2px solid #e8e2d9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', fontSize: 13, color: '#555' }}>
                  <span>Subtotal</span>
                  <span>{subtotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
                {budget.discount_type && budget.discount_amount && budget.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 20px', fontSize: 13, color: '#16a34a' }}>
                    <span>Descuento{budget.discount_label ? ` — ${budget.discount_label}` : ''}</span>
                    <span>-{budget.discount_type === 'percent' ? `${budget.discount_amount}%` : budget.discount_amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                )}
                {!budget.tax_included && budget.tax_rate && budget.tax_rate > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 20px', fontSize: 13, color: '#555' }}>
                    <span>IVA ({budget.tax_rate}%)</span>
                    <span>{(budget.total_amount - subtotal + (budget.discount_type === 'fixed' ? (budget.discount_amount ?? 0) : budget.discount_type === 'percent' ? subtotal * (budget.discount_amount ?? 0) / 100 : 0)).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                )}
              </div>

              {/* Total */}
              <div style={{ background: primaryColor, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Total</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{budget.total_amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
              </div>
            </div>

            {/* Tax note */}
            {budget.tax_included && budget.tax_rate && budget.tax_rate > 0 && (
              <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginBottom: 20 }}>
                IVA ({budget.tax_rate}%) incluido en todos los precios
              </div>
            )}

            {/* Quick payment CTA */}
            {hasPayments && !isExpired && (() => {
              const nextIdx = paymentPlan.findIndex(p => p.status !== 'paid')
              if (nextIdx === -1) return null
              const next = paymentPlan[nextIdx]
              return (
                <div
                  onClick={() => setActiveTab('pagos')}
                  style={{
                    background: '#fff', border: `2px solid ${primaryColor}`, borderRadius: 12,
                    padding: '16px 20px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 14,
                    transition: 'box-shadow .15s',
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${primaryColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CreditCard size={18} style={{ color: primaryColor }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Proxima cuota: {next.label}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                      {next.due_date ? new Date(next.due_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : 'Sin fecha'}
                    </div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: primaryColor }}>{next.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
                  <ArrowRight size={16} style={{ color: primaryColor }} />
                </div>
              )
            })()}
          </>
        )}

        {/* ═══ TAB: PAGOS ═══ */}
        {activeTab === 'pagos' && hasPayments && (
          <>
            {/* Progress bar */}
            <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Progreso de pagos</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {paidTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} de {budget.total_amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: primaryColor }}>{paidPercent}%</div>
              </div>
              <div style={{ height: 10, background: '#f0ece6', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${paidPercent}%`, background: paidPercent === 100 ? '#16a34a' : primaryColor, borderRadius: 5, transition: 'width .5s ease' }} />
              </div>
            </div>

            {/* Installments */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {paymentPlan.map((p, i) => {
                const isPaid = p.status === 'paid'
                const isOverdue = !isPaid && p.due_date && p.due_date < today
                const isNext = !isPaid && !isOverdue && paymentPlan.findIndex((pp: any) => pp.status !== 'paid' && !(pp.due_date < today)) === i
                const isPaying = payingIndex === i
                const hasError = payError === i

                return (
                  <div key={i} style={{
                    background: '#fff', borderRadius: 12, overflow: 'hidden',
                    border: `2px solid ${isPaid ? '#86efac' : isOverdue ? '#fca5a5' : isNext ? primaryColor : '#e8e2d9'}`,
                  }}>
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        background: isPaid ? '#16a34a' : isOverdue ? '#dc2626' : isNext ? primaryColor : '#e8e2d9',
                        color: '#fff', fontSize: 14, fontWeight: 700,
                      }}>
                        {isPaid ? <CheckCircle size={18} /> : i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>{p.label}</div>
                        <div style={{ fontSize: 12, color: isPaid ? '#16a34a' : isOverdue ? '#dc2626' : '#888', marginTop: 2 }}>
                          {isPaid ? `Pagado${p.paid_at ? ' el ' + new Date(p.paid_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : ''}` :
                            isOverdue ? 'Vencido — ' + new Date(p.due_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) :
                            p.due_date ? new Date(p.due_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Sin fecha'}
                        </div>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: isPaid ? '#16a34a' : '#1a1a1a' }}>
                        {p.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </div>
                    </div>

                    {/* Pay button */}
                    {!isPaid && !isExpired && (
                      <div style={{ padding: '0 20px 16px' }}>
                        {hasError && (
                          <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>Error al procesar el pago. Intentalo de nuevo.</div>
                        )}
                        <button
                          onClick={() => payInstallment(i)}
                          disabled={isPaying || payingIndex !== null}
                          style={{
                            width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                            background: isNext || isOverdue ? primaryColor : '#f5f0eb',
                            color: isNext || isOverdue ? '#fff' : '#666',
                            fontSize: 14, fontWeight: 600, cursor: isPaying ? 'wait' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            opacity: (payingIndex !== null && !isPaying) ? 0.5 : 1,
                            transition: 'opacity .15s',
                          }}
                        >
                          {isPaying ? <><Loader2 size={14} className="animate-spin" /> Procesando...</> :
                            <><CreditCard size={14} /> Pagar {p.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</>}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* All paid celebration */}
            {paidPercent === 100 && (
              <div style={{ textAlign: 'center', padding: '32px 20px', marginTop: 20, background: '#f0fdf4', borderRadius: 12, border: '1px solid #86efac' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#166534', fontFamily }}>Presupuesto completamente pagado</div>
                <div style={{ fontSize: 13, color: '#16a34a', marginTop: 6 }}>Todas las cuotas han sido abonadas. ¡Gracias!</div>
              </div>
            )}
          </>
        )}

        {/* ═══ TAB: ESPACIO ═══ */}
        {activeTab === 'espacio' && (
          <>
            {/* Photos */}
            {venue?.photo_urls && venue.photo_urls.length > 0 && (
              <div style={{ marginBottom: 20, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: venue.photo_urls.length === 1 ? '1fr' : '1fr 1fr', gap: 4 }}>
                  {venue.photo_urls.slice(0, 4).map((url, i) => (
                    <div key={i} style={{ position: 'relative', paddingBottom: i === 0 && venue.photo_urls!.length > 1 ? '60%' : '50%', overflow: 'hidden', borderRadius: i === 0 ? '12px 12px 0 0' : 0 }}>
                      <img src={url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Venue description */}
            <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, padding: '24px', marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', fontFamily, marginBottom: 8 }}>{venueName}</div>
              {(venue?.short_bio || venue?.description) && (
                <div style={{ fontSize: 14, color: '#555', lineHeight: 1.7, marginBottom: 16 }}>
                  {venue.short_bio || venue.description}
                </div>
              )}

              {/* Features badges */}
              {venue?.features && venue.features.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                  {venue.features.map((f, i) => (
                    <span key={i} style={{ fontSize: 11, fontWeight: 500, background: `${primaryColor}10`, color: primaryColor, padding: '4px 10px', borderRadius: 20, border: `1px solid ${primaryColor}30` }}>
                      {f}
                    </span>
                  ))}
                </div>
              )}

              {/* Details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {venue?.capacity_max && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#555' }}>
                    <Users size={15} style={{ color: primaryColor, flexShrink: 0 }} />
                    <span>{venue.capacity_min ? `${venue.capacity_min}–${venue.capacity_max}` : `Hasta ${venue.capacity_max}`} invitados</span>
                  </div>
                )}
                {venue?.city && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#555' }}>
                    <MapPin size={15} style={{ color: primaryColor, flexShrink: 0 }} />
                    <span>{venue.city}</span>
                  </div>
                )}
              </div>
            </div>

            {/* What's included */}
            {budget.includes_text && (
              <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, padding: '24px', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Sparkles size={16} style={{ color: primaryColor }} />
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', fontFamily }}>Que incluye tu presupuesto</div>
                </div>
                <div style={{ fontSize: 14, color: '#555', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {budget.includes_text}
                </div>
              </div>
            )}

            {/* Contact */}
            <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, padding: '24px' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', fontFamily, marginBottom: 14 }}>Contacto</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {venue?.contact_phone && (
                  <a href={`tel:${venue.contact_phone}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#555', textDecoration: 'none' }}>
                    <Phone size={15} style={{ color: primaryColor }} /> {venue.contact_phone}
                  </a>
                )}
                {venue?.contact_email && (
                  <a href={`mailto:${venue.contact_email}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#555', textDecoration: 'none' }}>
                    <Mail size={15} style={{ color: primaryColor }} /> {venue.contact_email}
                  </a>
                )}
                {venue?.website && (
                  <a href={venue.website} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: primaryColor, textDecoration: 'none' }}>
                    <Globe size={15} /> {venue.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: 32, marginTop: 20, borderTop: '1px solid #e8e2d9' }}>
          <div style={{ fontSize: 10, color: '#ccc' }}>Creado con FOREVENTOS</div>
        </div>
      </div>
    </div>
  )
}

// ── Collapsible Group ────────────────────────────────────────────────────────

function CollapsibleGroup({ group, primaryColor }: { group: LineItemGroup; primaryColor: string }) {
  const [open, setOpen] = useState(true)
  const groupTotal = group.items.reduce((s, i) => s + i.subtotal, 0)

  return (
    <div>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: '12px 20px', background: '#faf8f5', borderBottom: '1px solid #e8e2d9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {open ? <ChevronUp size={14} style={{ color: '#999' }} /> : <ChevronDown size={14} style={{ color: '#999' }} />}
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{group.name}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: primaryColor }}>
          {groupTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
        </span>
      </div>
      {open && group.items.map((item, ii) => (
        <div key={ii} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 90px', padding: '10px 20px', borderBottom: '1px solid #f0ece6', fontSize: 13, alignItems: 'center' }}>
          <span style={{ color: '#333' }}>{item.concept}</span>
          <span style={{ textAlign: 'center', color: '#888' }}>{item.qty}</span>
          <span style={{ textAlign: 'right', color: '#888' }}>{item.unit_price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
          <span style={{ textAlign: 'right', fontWeight: 600, color: '#333' }}>{item.subtotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
        </div>
      ))}
    </div>
  )
}

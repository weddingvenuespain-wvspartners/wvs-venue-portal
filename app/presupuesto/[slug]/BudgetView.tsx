'use client'
import { useEffect, useState } from 'react'
import type { Budget, PaymentInstallment, LineItemGroup } from '@/lib/budget-types'
import { Receipt, Calendar, Users, Clock, CheckCircle, AlertCircle, Lock } from 'lucide-react'

type Props = {
  budget: Budget
  venue: { name: string | null; logo_url: string | null; contact_email: string | null; contact_phone: string | null } | null
  branding: { primary_color: string | null; logo_url: string | null; font_family: string | null } | null
  isPreview: boolean
  hasPassword: boolean
}

export default function BudgetView({ budget, venue, branding, isPreview, hasPassword }: Props) {
  const primaryColor = branding?.primary_color || '#c9963a'
  const logo = branding?.logo_url || venue?.logo_url
  const venueName = venue?.name || 'Venue'
  const [unlocked, setUnlocked] = useState(!hasPassword || isPreview)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)

  // Track view
  useEffect(() => {
    if (isPreview || !unlocked) return
    fetch('/api/budgets/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: budget.slug }),
    })
  }, [])

  const groups = budget.line_items?.groups || []
  const subtotal = groups.reduce((s, g) => s + g.items.reduce((a, i) => a + i.subtotal, 0), 0)
  const isExpired = budget.valid_until && new Date(budget.valid_until) < new Date() && budget.status !== 'accepted'
  const today = new Date().toISOString().slice(0, 10)

  const handlePasswordSubmit = async () => {
    setPwError(false)
    const res = await fetch('/api/budgets/check-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: budget.slug, password: pwInput }),
    })
    const data = await res.json()
    if (data.ok) {
      setUnlocked(true)
    } else {
      setPwError(true)
    }
  }

  if (!unlocked) {
    return (
      <div style={{ minHeight: '100vh', background: '#faf8f5', fontFamily: branding?.font_family || 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '40px 32px', maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', border: '1px solid #e8e2d9' }}>
          {logo && <img src={logo} alt={venueName} style={{ height: 40, objectFit: 'contain', marginBottom: 20 }} />}
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: `${primaryColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Lock size={24} style={{ color: primaryColor }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Manrope, sans-serif', marginBottom: 6 }}>Presupuesto protegido</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>Introduce la contraseña para ver el presupuesto de {budget.couple_name}</div>
          <form onSubmit={e => { e.preventDefault(); handlePasswordSubmit() }}>
            <input
              type="password"
              value={pwInput}
              onChange={e => { setPwInput(e.target.value); setPwError(false) }}
              placeholder="Contraseña"
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14,
                border: `1px solid ${pwError ? '#fca5a5' : '#e8e2d9'}`, outline: 'none',
                background: pwError ? '#fef2f2' : '#fff', marginBottom: 8,
                boxSizing: 'border-box',
              }}
              autoFocus
            />
            {pwError && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>Contraseña incorrecta</div>}
            <button
              type="submit"
              style={{
                width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                background: primaryColor, color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', marginTop: 8,
              }}
            >
              Acceder al presupuesto
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f5', fontFamily: branding?.font_family || 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: `3px solid ${primaryColor}`, padding: '32px 24px', textAlign: 'center' }}>
        {logo && <img src={logo} alt={venueName} style={{ height: 48, objectFit: 'contain', marginBottom: 16 }} />}
        <div style={{ fontSize: 14, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{venueName}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Manrope, sans-serif' }}>Presupuesto</div>
        <div style={{ fontSize: 16, color: '#555', marginTop: 8 }}>{budget.couple_name}</div>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
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
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 60px' }}>

        {/* Expired banner */}
        {isExpired && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#991b1b' }}>
            <AlertCircle size={16} /> Este presupuesto ha expirado
          </div>
        )}

        {/* Personal message */}
        {budget.notes && (
          <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, padding: '20px 24px', marginBottom: 20, fontSize: 14, color: '#444', lineHeight: 1.7, whiteSpace: 'pre-wrap', borderLeft: `4px solid ${primaryColor}` }}>
            {budget.notes}
          </div>
        )}

        {/* Validity */}
        {budget.valid_until && !isExpired && (
          <div style={{ fontSize: 12, color: '#888', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={13} /> Válido hasta el {new Date(budget.valid_until + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        )}

        {/* Line items */}
        <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, overflow: 'hidden', marginBottom: 20, opacity: isExpired ? 0.5 : 1 }}>
          {groups.map((g, gi) => (
            <div key={gi}>
              <div style={{ padding: '12px 20px', background: '#faf8f5', borderBottom: '1px solid #e8e2d9', fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>
                {g.name}
              </div>
              {g.items.map((item, ii) => (
                <div key={ii} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 90px', padding: '10px 20px', borderBottom: '1px solid #f0ece6', fontSize: 13, alignItems: 'center' }}>
                  <span style={{ color: '#333' }}>{item.concept}</span>
                  <span style={{ textAlign: 'center', color: '#888' }}>{item.qty}</span>
                  <span style={{ textAlign: 'right', color: '#888' }}>{item.unit_price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  <span style={{ textAlign: 'right', fontWeight: 600, color: '#333' }}>{item.subtotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
              ))}
            </div>
          ))}

          {/* Summary rows */}
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

        {/* Payment plan */}
        {budget.payment_plan && budget.payment_plan.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, padding: '20px 24px', marginBottom: 20, opacity: isExpired ? 0.5 : 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 16, fontFamily: 'Manrope, sans-serif' }}>Plan de pagos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(budget.payment_plan as PaymentInstallment[]).map((p, i) => {
                const isPaid = p.status === 'paid'
                const isOverdue = !isPaid && p.due_date && p.due_date < today
                const isNext = !isPaid && !isOverdue && budget.payment_plan.findIndex((pp: any) => pp.status !== 'paid' && !(pp.due_date < today)) === i
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 10,
                    border: `1px solid ${isPaid ? '#86efac' : isOverdue ? '#fca5a5' : isNext ? primaryColor : '#e8e2d9'}`,
                    background: isPaid ? '#f0fdf4' : isOverdue ? '#fef2f2' : isNext ? `${primaryColor}08` : '#fff',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      background: isPaid ? '#16a34a' : isOverdue ? '#dc2626' : isNext ? primaryColor : '#e8e2d9',
                      color: '#fff', fontSize: 13, fontWeight: 700,
                    }}>
                      {isPaid ? <CheckCircle size={16} /> : i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{p.label}</div>
                      {p.due_date && (
                        <div style={{ fontSize: 12, color: isOverdue ? '#dc2626' : '#888', marginTop: 2 }}>
                          {isOverdue ? 'Vencido — ' : ''}{new Date(p.due_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: isPaid ? '#16a34a' : '#1a1a1a' }}>
                      {p.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tax note */}
        {budget.tax_included && budget.tax_rate && budget.tax_rate > 0 && (
          <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginBottom: 20 }}>
            IVA ({budget.tax_rate}%) incluido en todos los precios
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: 24, borderTop: '1px solid #e8e2d9' }}>
          {venue?.contact_email && (
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{venue.contact_email}</div>
          )}
          {venue?.contact_phone && (
            <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>{venue.contact_phone}</div>
          )}
          <div style={{ fontSize: 10, color: '#ccc' }}>Creado con Wedding Venues Spain</div>
        </div>
      </div>
    </div>
  )
}

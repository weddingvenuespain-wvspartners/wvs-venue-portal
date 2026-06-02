'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import type { Budget, PaymentInstallment, LineItemGroup } from '@/lib/budget-types'
import {
  Receipt, Calendar, Users, Clock, CheckCircle, AlertCircle, Lock,
  CreditCard, MapPin, Phone, Mail, Globe, ChevronDown, ChevronUp,
  Sparkles, Building2, ArrowRight, Loader2, Check, RotateCcw, CalendarDays,
  ScrollText, PenTool,
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

type PaymentRecord = {
  installment_index: number
  amount: number
  status: string
  paid_at: string | null
  payer_name: string | null
  payer_email: string | null
}

type ContractSection = { title: string; content: string }
type PublicContract = {
  id: string
  contract_number: string
  title: string
  status: string
  sections: ContractSection[]
  total_amount: number
  deposit_amount: number
  wedding_date: string | null
  client_name: string
  venue_name: string
  venue_signed_at: string | null
  client_signed_at: string | null
  venue_signature_url: string | null
  client_signature_url: string | null
  created_at: string
}

type Props = {
  budget: Budget
  venue: VenueInfo | null
  branding: { primary_color: string | null; logo_url: string | null; font_family: string | null } | null
  isPreview: boolean
  hasPassword: boolean
  stripeConnected?: boolean
  /** Paid amounts per installment index (from budget_payments) for split payment tracking */
  paidAmounts?: Record<number, number>
  /** Full payment records for history display */
  paymentRecords?: PaymentRecord[]
  /** True when returning from successful Stripe Checkout */
  justPaid?: boolean
  /** Contracts linked to this budget */
  contracts?: PublicContract[]
}

type TabKey = 'presupuesto' | 'pagos' | 'espacio' | 'contrato'

export default function BudgetView({ budget, venue, branding, isPreview, hasPassword, stripeConnected, paidAmounts = {}, paymentRecords = [], justPaid, contracts = [] }: Props) {
  const primaryColor = branding?.primary_color || '#c9963a'
  const logo = branding?.logo_url || venue?.logo_url
  const venueName = venue?.name || 'Venue'
  const fontFamily = branding?.font_family || 'Inter, sans-serif'
  const [unlocked, setUnlocked] = useState(!hasPassword || isPreview)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('presupuesto')
  const [payingIndex, setPayingIndex] = useState<number | 'all' | null>(null)
  const [paySuccess, setPaySuccess] = useState<boolean>(!!justPaid)
  const [payError, setPayError] = useState<number | 'all' | null>(null)
  const [splitMode, setSplitMode] = useState(false)
  const [splitAmount, setSplitAmount] = useState('')
  const [copied, setCopied] = useState(false)
  // Contract signature state
  const [signContractId, setSignContractId] = useState<string | null>(null)
  const [signSaving, setSignSaving] = useState(false)
  const [signFullName, setSignFullName] = useState('')
  const [signNif, setSignNif] = useState('')
  const [signAddress, setSignAddress] = useState('')
  const [signError, setSignError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  // formRef removed — Redsys legacy no longer used for budget payments

  // Switch to pagos tab and clean URL on payment result
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('paid') === '1' || justPaid) {
      setPaySuccess(true)
      setActiveTab('pagos')
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('error') === '1') {
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

  // ── Signature canvas methods ──
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  useEffect(() => { if (signContractId) setTimeout(initCanvas, 50) }, [signContractId, initCanvas])

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => { isDrawing.current = true; lastPos.current = getCanvasPos(e) }
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getCanvasPos(e)
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke()
    lastPos.current = pos
  }
  const stopDraw = () => { isDrawing.current = false }
  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height); initCanvas()
  }
  const saveSignature = async () => {
    if (!signContractId || !canvasRef.current) return
    setSignError('')
    if (!signFullName.trim()) { setSignError('El nombre completo es obligatorio'); return }
    if (!signNif.trim()) { setSignError('El DNI / NIF es obligatorio'); return }
    if (!signAddress.trim()) { setSignError('La dirección es obligatoria'); return }
    // Check canvas has actual drawing — non-empty pixel data
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let hasInk = false
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] !== 0) { hasInk = true; break }
      }
      if (!hasInk) { setSignError('Dibuja tu firma en el recuadro'); return }
    }

    setSignSaving(true)
    const dataUrl = canvas.toDataURL('image/png')
    try {
      const res = await fetch('/api/contracts/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: signContractId,
          budget_slug: budget.slug,
          signature_data: dataUrl,
          full_name: signFullName.trim(),
          nif: signNif.trim(),
          address: signAddress.trim(),
        }),
      })
      if (res.ok) {
        setSignContractId(null)
        window.location.reload()
      } else {
        const data = await res.json().catch(() => ({}))
        setSignError(data.error || 'Error al guardar la firma. Intenta de nuevo.')
      }
    } catch {
      setSignError('Error de red. Intenta de nuevo.')
    }
    setSignSaving(false)
  }

  const groups = budget.line_items?.groups || []
  const subtotal = groups.reduce((s, g) => s + g.items.reduce((a, i) => a + i.subtotal, 0), 0)
  const isExpired = budget.valid_until && new Date(budget.valid_until) < new Date() && budget.status !== 'accepted'
  const today = new Date().toISOString().slice(0, 10)
  const paymentPlan = (budget.payment_plan || []) as (PaymentInstallment & { paid_at?: string })[]
  // Use paidAmounts from DB (source of truth for partial payments)
  const effectivePaidTotal = paymentPlan.reduce((s, p, i) => {
    if (p.status === 'paid') return s + p.amount
    return s + (paidAmounts[i] || 0)
  }, 0)
  const paidPercent = budget.total_amount > 0 ? Math.round((effectivePaidTotal / budget.total_amount) * 100) : 0
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

  // Block payment if there's a contract pending signature (only enforced before any payment)
  const pendingContract = contracts.find(c => !c.client_signed_at && ['draft', 'sent'].includes(c.status))
  const hasPaidAlready = (paymentRecords || []).length > 0
  const paymentBlocked = !!pendingContract && !hasPaidAlready

  const payInstallment = async (index: number | 'all', customAmt?: number) => {
    if (paymentBlocked) {
      setActiveTab('contrato')
      return
    }
    setPayingIndex(index)
    setPayError(null)
    try {
      const body: any = index === 'all'
        ? { slug: budget.slug, payAll: true }
        : { slug: budget.slug, installmentIndex: index }
      if (customAmt != null && index !== 'all') {
        body.customAmount = customAmt
      }
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success || !data.checkoutUrl) {
        setPayError(index)
        setPayingIndex(null)
        return
      }
      window.location.href = data.checkoutUrl
    } catch {
      setPayError(index)
      setPayingIndex(null)
    }
  }

  const copyBudgetLink = () => {
    if (typeof window === 'undefined') return
    navigator.clipboard.writeText(window.location.origin + '/budget/' + budget.slug)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14, border: `1px solid ${pwError ? '#E0C2BD' : '#e8e2d9'}`, outline: 'none', background: pwError ? '#FAF3F2' : '#fff', marginBottom: 8, boxSizing: 'border-box' }}
              autoFocus
            />
            {pwError && <div style={{ fontSize: 12, color: '#B0473E', marginBottom: 8 }}>Contrasena incorrecta</div>}
            <button type="submit" style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: primaryColor, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>
              Acceder
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Tab definitions ─────────────────────────────────────────────────────────
  const hasContracts = contracts.length > 0
  const tabs: { key: TabKey; label: string; icon: typeof Receipt }[] = [
    { key: 'presupuesto', label: 'Presupuesto', icon: Receipt },
    ...(hasPayments ? [{ key: 'pagos' as TabKey, label: 'Pagos', icon: CreditCard }] : []),
    ...(hasContracts ? [{ key: 'contrato' as TabKey, label: 'Contrato', icon: ScrollText }] : []),
    { key: 'espacio', label: venueName, icon: Building2 },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f5', fontFamily }}>
      {/* Budget payments now use Stripe Checkout redirect */}

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
          <div style={{ background: '#FAF3F2', border: '1px solid #E0C2BD', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#7E332D' }}>
            <AlertCircle size={16} /> Este presupuesto ha expirado
          </div>
        )}

        {/* Payment success banner */}
        {paySuccess && (
          <div style={{ background: '#EEF2EC', border: '1px solid #C3D4C5', borderRadius: 10, padding: '14px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#35513E' }}>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 20px', fontSize: 13, color: '#4A6B52' }}>
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
        {activeTab === 'pagos' && hasPayments && (() => {
          const firstUnpaidIdx = paymentPlan.findIndex((p, i) => p.status !== 'paid' && (paidAmounts[i] || 0) < p.amount)
          const remainingTotal = paymentPlan.reduce((s, p, i) => {
            if (p.status === 'paid') return s
            const rem = p.amount - (paidAmounts[i] || 0)
            return s + Math.max(0, rem)
          }, 0)
          const remainingCount = paymentPlan.filter((p, i) => p.status !== 'paid' && (p.amount - (paidAmounts[i] || 0)) > 0).length
          const remainingWithSurcharge = Math.round(remainingTotal * 1.025 * 100) / 100
          const surchargeLabel = (amt: number) => Math.round(amt * 1.025 * 100) / 100

          return (
          <>
            {/* ── Contract signature required warning ── */}
            {paymentBlocked && (
              <div style={{ background: '#F3EBD8', border: '1px solid #fbbf24', borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <AlertCircle size={18} style={{ color: '#8A6A38', flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#78350f', marginBottom: 4 }}>Firma el contrato antes de pagar</div>
                  <div style={{ fontSize: 12, color: '#7A5A2E', lineHeight: 1.5, marginBottom: 10 }}>
                    Para realizar el primer pago, debes firmar el contrato y rellenar tus datos de facturación.
                  </div>
                  <button
                    onClick={() => setActiveTab('contrato')}
                    style={{ padding: '8px 14px', background: primaryColor, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <ScrollText size={12} /> Ir al contrato
                  </button>
                </div>
              </div>
            )}

            {/* ── Segmented Progress ── */}
            <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 16, padding: '24px', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', fontFamily }}>
                  {effectivePaidTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </div>
                <div style={{ fontSize: 13, color: '#888' }}>
                  de {budget.total_amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </div>
              </div>

              {/* Segmented bar — one segment per installment */}
              <div style={{ display: 'flex', gap: 3, height: 12, borderRadius: 6, overflow: 'hidden', background: '#f0ece6', marginBottom: 12 }}>
                {paymentPlan.map((p, i) => {
                  const weight = budget.total_amount > 0 ? (p.amount / budget.total_amount) * 100 : 100 / paymentPlan.length
                  const partPaid = paidAmounts[i] || 0
                  const isFull = p.status === 'paid' || partPaid >= p.amount
                  const isPartial = partPaid > 0 && !isFull
                  const fillPercent = isFull ? 100 : p.amount > 0 ? (partPaid / p.amount) * 100 : 0
                  return (
                    <div key={i} style={{ width: `${weight}%`, position: 'relative', borderRadius: i === 0 ? '6px 0 0 6px' : i === paymentPlan.length - 1 ? '0 6px 6px 0' : 0, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${fillPercent}%`,
                        background: isFull ? '#4A6B52' : isPartial ? '#AC8B4C' : 'transparent',
                        transition: 'width .5s ease',
                      }} />
                    </div>
                  )
                })}
              </div>

              {/* Segment legend */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {paymentPlan.map((p, i) => {
                  const partPaid = paidAmounts[i] || 0
                  const isFull = p.status === 'paid' || partPaid >= p.amount
                  const isPartial = partPaid > 0 && !isFull
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#666' }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: isFull ? '#4A6B52' : isPartial ? '#AC8B4C' : '#e0dbd4',
                      }} />
                      {p.label}
                    </div>
                  )
                })}
              </div>

              {/* Percentage */}
              {paidPercent > 0 && paidPercent < 100 && (
                <div style={{ fontSize: 11, color: primaryColor, fontWeight: 600, marginTop: 8 }}>
                  {paidPercent}% completado
                </div>
              )}
            </div>

            {/* ── Payment Timeline / Calendar ── */}
            {(() => {
              const upcomingPayments = paymentPlan
                .map((p, i) => ({ ...p, index: i, paidAmt: paidAmounts[i] || 0 }))
                .filter(p => p.status !== 'paid' && p.paidAmt < p.amount && p.due_date)
              if (upcomingPayments.length === 0) return null

              return (
                <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <CalendarDays size={15} style={{ color: primaryColor }} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>Calendario de pagos</div>
                  </div>
                  <div style={{ position: 'relative', paddingLeft: 20 }}>
                    {/* Vertical line */}
                    <div style={{ position: 'absolute', left: 7, top: 4, bottom: 4, width: 2, background: '#e8e2d9' }} />
                    {upcomingPayments.map((p, pi) => {
                      const dueDate = new Date(p.due_date + 'T12:00:00')
                      const now = new Date()
                      const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                      const isOverdue = daysLeft < 0
                      const isUrgent = daysLeft >= 0 && daysLeft <= 7
                      const remaining = p.amount - p.paidAmt
                      return (
                        <div key={pi} style={{ position: 'relative', paddingBottom: pi < upcomingPayments.length - 1 ? 14 : 0, display: 'flex', gap: 12 }}>
                          {/* Dot */}
                          <div style={{
                            position: 'absolute', left: -17, top: 4,
                            width: 10, height: 10, borderRadius: '50%', border: '2px solid #fff',
                            background: isOverdue ? '#B0473E' : isUrgent ? '#AC8B4C' : primaryColor,
                          }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>{p.label}</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: isOverdue ? '#B0473E' : '#1a1a1a' }}>
                                {remaining.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                              </div>
                            </div>
                            <div style={{ fontSize: 11, color: isOverdue ? '#B0473E' : isUrgent ? '#AC8B4C' : '#888', marginTop: 1 }}>
                              {dueDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                              {isOverdue ? ` · Vencido hace ${Math.abs(daysLeft)} días` :
                                daysLeft === 0 ? ' · Vence hoy' :
                                daysLeft <= 30 ? ` · Quedan ${daysLeft} días` : ''}
                            </div>
                            {/* Refund policy badge */}
                            {p.refundable !== undefined && (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4,
                                fontSize: 10, padding: '2px 8px', borderRadius: 10,
                                background: p.refundable ? '#EEF2EC' : '#FAF3F2',
                                color: p.refundable ? '#35513E' : '#7E332D',
                                border: `1px solid ${p.refundable ? '#C3D4C5' : '#E0C2BD'}`,
                              }}>
                                <RotateCcw size={9} />
                                {p.refundable
                                  ? (p.refund_deadline
                                    ? `Reembolsable hasta ${new Date(p.refund_deadline + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
                                    : 'Reembolsable')
                                  : 'No reembolsable'}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Pay All button */}
            {stripeConnected && remainingCount > 1 && !isExpired && (
              <div style={{ background: '#fff', border: `2px solid ${primaryColor}`, borderRadius: 12, padding: '20px', marginBottom: 20 }}>
                {payError === 'all' && (
                  <div style={{ fontSize: 12, color: '#B0473E', marginBottom: 10 }}>Error al procesar el pago. Inténtalo de nuevo.</div>
                )}
                <button
                  onClick={() => payInstallment('all')}
                  disabled={payingIndex !== null}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                    background: primaryColor, color: '#fff',
                    fontSize: 15, fontWeight: 700, cursor: payingIndex !== null ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: payingIndex !== null && payingIndex !== 'all' ? 0.5 : 1,
                  }}
                >
                  {payingIndex === 'all' ? <><Loader2 size={15} className="animate-spin" /> Procesando...</> :
                    <><CreditCard size={15} /> Pagar todo — {remainingWithSurcharge.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</>}
                </button>
                <div style={{ fontSize: 10, color: '#999', textAlign: 'center', marginTop: 4 }}>
                  {remainingCount} cuotas restantes · Incluye 2,5% de gastos de gestión
                </div>
              </div>
            )}

            {/* No Stripe message */}
            {!stripeConnected && (
              <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, padding: '16px 20px', marginBottom: 20, fontSize: 13, color: '#666', display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertCircle size={16} style={{ color: '#999', flexShrink: 0 }} />
                Para realizar el pago, contacta directamente con {venueName}.
              </div>
            )}

            {/* Share link for split payments */}
            {stripeConnected && remainingCount > 0 && !isExpired && (
              <button
                onClick={copyBudgetLink}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 500,
                  background: '#fff', border: '1px solid #e8e2d9', color: '#666',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  marginBottom: 20,
                }}
              >
                {copied ? <><Check size={13} /> Enlace copiado</> : <><ArrowRight size={13} /> Compartir enlace para pago compartido</>}
              </button>
            )}

            {/* Installments */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {paymentPlan.map((p, i) => {
                const partiallyPaid = paidAmounts[i] || 0
                const isPaid = p.status === 'paid' || partiallyPaid >= p.amount
                const remaining = isPaid ? 0 : p.amount - partiallyPaid
                const isPartial = partiallyPaid > 0 && !isPaid
                const isOverdue = !isPaid && p.due_date && p.due_date < today
                const isFirstUnpaid = i === firstUnpaidIdx
                const canPay = stripeConnected && isFirstUnpaid && !isExpired && remaining > 0
                const isPaying = payingIndex === i
                const hasError = payError === i
                const partialPercent = p.amount > 0 ? Math.round((partiallyPaid / p.amount) * 100) : 0
                const installmentPayments = paymentRecords.filter(r => r.installment_index === i)

                return (
                  <div key={i} style={{
                    background: '#fff', borderRadius: 12, overflow: 'hidden',
                    border: `2px solid ${isPaid ? '#C3D4C5' : isOverdue ? '#E0C2BD' : isFirstUnpaid ? primaryColor : '#e8e2d9'}`,
                  }}>
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        background: isPaid ? '#4A6B52' : isPartial ? '#AC8B4C' : isOverdue ? '#B0473E' : isFirstUnpaid ? primaryColor : '#e8e2d9',
                        color: '#fff', fontSize: 14, fontWeight: 700,
                      }}>
                        {isPaid ? <CheckCircle size={18} /> : i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>{p.label}</div>
                        <div style={{ fontSize: 12, color: isPaid ? '#4A6B52' : isPartial ? '#AC8B4C' : isOverdue ? '#B0473E' : '#888', marginTop: 2 }}>
                          {isPaid ? `Pagado${p.paid_at ? ' el ' + new Date(p.paid_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : ''}` :
                            isPartial ? `${partialPercent}% pagado — faltan ${remaining.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}` :
                            isOverdue ? 'Vencido — ' + new Date(p.due_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) :
                            p.due_date ? new Date(p.due_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Sin fecha'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: isPaid ? '#4A6B52' : '#1a1a1a' }}>
                          {p.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </div>
                        {!isPaid && stripeConnected && remaining > 0 && (
                          <div style={{ fontSize: 10, color: '#999', marginTop: 1 }}>
                            +2,5% → {surchargeLabel(remaining).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Partial payment progress bar */}
                    {isPartial && (
                      <div style={{ padding: '0 20px 8px' }}>
                        <div style={{ height: 4, background: '#f0ece6', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${partialPercent}%`, background: '#AC8B4C', borderRadius: 2 }} />
                        </div>
                      </div>
                    )}

                    {/* Payment history for this installment */}
                    {installmentPayments.length > 0 && (
                      <div style={{ padding: '0 20px 12px' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#999', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Pagos realizados
                        </div>
                        {installmentPayments.map((pay, pi) => (
                          <div key={pi} style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
                            background: '#faf8f5', borderRadius: 8, marginBottom: 4, fontSize: 12,
                          }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#4A6B5220', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Check size={12} style={{ color: '#4A6B52' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 500, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {pay.payer_name || pay.payer_email || 'Pago anónimo'}
                              </div>
                              {pay.paid_at && (
                                <div style={{ fontSize: 10, color: '#999' }}>
                                  {new Date(pay.paid_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>
                            <div style={{ fontWeight: 600, color: '#4A6B52', whiteSpace: 'nowrap' }}>
                              {Number(pay.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pay button — only first unpaid + Stripe connected */}
                    {canPay && (
                      <div style={{ padding: '0 20px 16px' }}>
                        {hasError && (
                          <div style={{ fontSize: 12, color: '#B0473E', marginBottom: 8 }}>Error al procesar el pago. Inténtalo de nuevo.</div>
                        )}

                        {!splitMode ? (
                          <>
                            <button
                              onClick={() => payInstallment(i)}
                              disabled={isPaying || payingIndex !== null}
                              style={{
                                width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                                background: primaryColor, color: '#fff',
                                fontSize: 14, fontWeight: 600, cursor: isPaying ? 'wait' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                opacity: (payingIndex !== null && !isPaying) ? 0.5 : 1,
                              }}
                            >
                              {isPaying ? <><Loader2 size={14} className="animate-spin" /> Procesando...</> :
                                <><CreditCard size={14} /> Pagar {surchargeLabel(remaining).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</>}
                            </button>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                              <div style={{ fontSize: 10, color: '#999' }}>
                                {remaining.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} + 2,5% gestión
                              </div>
                              <button
                                onClick={() => { setSplitMode(true); setSplitAmount('') }}
                                style={{ fontSize: 10, color: primaryColor, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                              >
                                Pagar otra cantidad
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>
                              Introduce el importe que quieres pagar:
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <div style={{ position: 'relative', flex: 1 }}>
                                <input
                                  type="number"
                                  min={1}
                                  max={remaining}
                                  step="0.01"
                                  value={splitAmount}
                                  onChange={e => setSplitAmount(e.target.value)}
                                  placeholder={`1 - ${remaining.toLocaleString('es-ES')}`}
                                  style={{
                                    width: '100%', padding: '10px 30px 10px 12px', borderRadius: 10, fontSize: 14,
                                    border: '1px solid #e8e2d9', outline: 'none', boxSizing: 'border-box',
                                  }}
                                  autoFocus
                                />
                                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#999' }}>€</span>
                              </div>
                              <button
                                onClick={() => {
                                  const amt = parseFloat(splitAmount)
                                  if (!amt || amt < 1 || amt > remaining) return
                                  payInstallment(i, amt)
                                }}
                                disabled={isPaying || payingIndex !== null || !splitAmount || parseFloat(splitAmount) < 1 || parseFloat(splitAmount) > remaining}
                                style={{
                                  padding: '10px 16px', borderRadius: 10, border: 'none',
                                  background: primaryColor, color: '#fff', fontSize: 13, fontWeight: 600,
                                  cursor: 'pointer', whiteSpace: 'nowrap',
                                  opacity: (!splitAmount || parseFloat(splitAmount) < 1) ? 0.5 : 1,
                                }}
                              >
                                {isPaying ? <Loader2 size={14} className="animate-spin" /> : 'Pagar'}
                              </button>
                            </div>
                            {splitAmount && parseFloat(splitAmount) >= 1 && parseFloat(splitAmount) <= remaining && (
                              <div style={{
                                background: '#faf8f5', borderRadius: 8, padding: '8px 12px', marginTop: 8,
                                display: 'flex', justifyContent: 'space-between', fontSize: 12,
                              }}>
                                <div style={{ color: '#666' }}>
                                  <div>Importe: {parseFloat(splitAmount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
                                  <div>Gestión (2,5%): {(parseFloat(splitAmount) * 0.025).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
                                </div>
                                <div style={{ fontWeight: 700, color: '#1a1a1a', alignSelf: 'center', fontSize: 14 }}>
                                  {surchargeLabel(parseFloat(splitAmount)).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                </div>
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                              <div style={{ fontSize: 10, color: '#999' }}>
                                Máximo: {remaining.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                              </div>
                              <button
                                onClick={() => setSplitMode(false)}
                                style={{ fontSize: 10, color: '#999', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                              >
                                Cancelar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Refund policy badge on installment card */}
                    {p.refundable !== undefined && (
                      <div style={{ padding: '0 20px 10px' }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10, padding: '3px 10px', borderRadius: 10,
                          background: p.refundable ? '#EEF2EC' : '#FAF3F2',
                          color: p.refundable ? '#35513E' : '#7E332D',
                          border: `1px solid ${p.refundable ? '#C3D4C5' : '#E0C2BD'}`,
                        }}>
                          <RotateCcw size={9} />
                          {p.refundable
                            ? (p.refund_deadline
                              ? `Reembolsable hasta el ${new Date(p.refund_deadline + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`
                              : 'Reembolsable')
                            : 'No reembolsable'}
                        </div>
                      </div>
                    )}

                    {/* Locked message for non-first unpaid */}
                    {!isPaid && !isFirstUnpaid && !isExpired && stripeConnected && remaining > 0 && (
                      <div style={{ padding: '0 20px 14px', fontSize: 11, color: '#aaa', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Lock size={12} /> Disponible tras pagar la cuota anterior
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* All paid celebration */}
            {paidPercent === 100 && (
              <div style={{ textAlign: 'center', padding: '32px 20px', marginTop: 20, background: '#EEF2EC', borderRadius: 12, border: '1px solid #C3D4C5' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#35513E', fontFamily }}>Presupuesto completamente pagado</div>
                <div style={{ fontSize: 13, color: '#4A6B52', marginTop: 6 }}>Todas las cuotas han sido abonadas. ¡Gracias!</div>
              </div>
            )}
          </>
          )
        })()}

        {/* ═══ TAB: CONTRATO ═══ */}
        {activeTab === 'contrato' && hasContracts && contracts.map(ctr => {
          const sections: ContractSection[] = Array.isArray(ctr.sections) ? ctr.sections : []
          const fmtDate = (iso: string) => new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
          return (
            <div key={ctr.id} style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, padding: '32px 36px', marginBottom: 20 }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: 28, paddingBottom: 20, borderBottom: `2px solid ${primaryColor}` }}>
                <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>{ctr.contract_number}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', fontFamily }}>{ctr.title}</div>
                <div style={{ marginTop: 10, fontSize: 13, color: '#666' }}>{ctr.venue_name} · {ctr.client_name}</div>
                {ctr.wedding_date && (
                  <div style={{ fontSize: 12, color: primaryColor, marginTop: 4 }}>
                    Fecha del evento: {fmtDate(ctr.wedding_date)}
                  </div>
                )}
              </div>

              {/* Parties */}
              <div style={{ display: 'flex', gap: 20, marginBottom: 24, padding: '14px 18px', background: '#faf8f5', borderRadius: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>El prestador</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{ctr.venue_name}</div>
                </div>
                <div style={{ width: 1, background: '#e8e2d9' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>El cliente</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{ctr.client_name}</div>
                </div>
              </div>

              {/* Sections */}
              {sections.map((s, idx) => (
                <div key={idx} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>
                    {idx + 1}. {s.title}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: '#444', whiteSpace: 'pre-wrap' }}>
                    {s.content}
                  </div>
                </div>
              ))}

              {/* Financial */}
              {(Number(ctr.total_amount) > 0 || Number(ctr.deposit_amount) > 0) && (
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: `2px solid ${primaryColor}` }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>Resumen económico</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1, padding: '12px 14px', background: '#faf8f5', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>Importe total</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>{Number(ctr.total_amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
                    </div>
                    <div style={{ flex: 1, padding: '12px 14px', background: '#faf8f5', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>Señal de reserva</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: primaryColor }}>{Number(ctr.deposit_amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Signatures */}
              <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid #e8e2d9', display: 'flex', gap: 30 }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Firma del venue</div>
                  {ctr.venue_signature_url ? (
                    <img src={ctr.venue_signature_url} alt="Firma venue" style={{ maxHeight: 60, margin: '0 auto', display: 'block' }} />
                  ) : (
                    <div style={{ height: 50, borderBottom: '1px solid #ccc' }} />
                  )}
                  <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>{ctr.venue_name}</div>
                  {ctr.venue_signed_at && <div style={{ fontSize: 10, color: '#4A6B52', marginTop: 2 }}>✓ Firmado</div>}
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Firma del cliente</div>
                  {ctr.client_signature_url ? (
                    <img src={ctr.client_signature_url} alt="Firma cliente" style={{ maxHeight: 60, margin: '0 auto', display: 'block' }} />
                  ) : !isPreview && (ctr.status === 'sent' || ctr.status === 'draft') ? (
                    <button
                      onClick={() => setSignContractId(ctr.id)}
                      style={{
                        width: '100%', height: 60, border: `2px dashed ${primaryColor}`, borderRadius: 8,
                        background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 6, color: primaryColor, fontSize: 12, fontWeight: 600,
                      }}
                    >
                      <PenTool size={14} /> Firmar contrato
                    </button>
                  ) : (
                    <div style={{ height: 50, borderBottom: '1px solid #ccc' }} />
                  )}
                  <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>{ctr.client_name}</div>
                  {ctr.client_signed_at && <div style={{ fontSize: 10, color: '#4A6B52', marginTop: 2 }}>✓ Firmado</div>}
                </div>
              </div>
            </div>
          )
        })}

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

      {/* Contract signature modal */}
      {signContractId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, overflowY: 'auto' }} onClick={() => !signSaving && setSignContractId(null)}>
          <div style={{ background: 'white', borderRadius: 16, padding: '28px 32px', maxWidth: 520, width: '100%', maxHeight: '95vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a', fontFamily }}>Firmar contrato</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Rellena tus datos de facturación y firma en el recuadro</div>
            </div>

            {/* Billing fields */}
            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>Nombre completo *</label>
                <input
                  type="text"
                  value={signFullName}
                  onChange={e => setSignFullName(e.target.value)}
                  placeholder="Nombre y apellidos del titular"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, fontFamily }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>DNI / NIF / Pasaporte *</label>
                <input
                  type="text"
                  value={signNif}
                  onChange={e => setSignNif(e.target.value)}
                  placeholder="12345678A"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, fontFamily }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>Dirección completa *</label>
                <textarea
                  value={signAddress}
                  onChange={e => setSignAddress(e.target.value)}
                  placeholder="Calle, número, código postal, ciudad, país"
                  rows={2}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, fontFamily, resize: 'vertical' }}
                />
              </div>
            </div>

            {/* Signature canvas */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>Firma *</label>
              <button onClick={clearCanvas} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: '#666', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <RotateCcw size={11} /> Borrar
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              style={{ width: '100%', height: 150, border: `2px solid ${primaryColor}`, borderRadius: 8, cursor: 'crosshair', background: '#fafaf8', touchAction: 'none' }}
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
            />

            {signError && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#FAF3F2', border: '1px solid #E9D4D0', borderRadius: 6, fontSize: 12, color: '#7E332D' }}>
                {signError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setSignContractId(null)} disabled={signSaving} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                Cancelar
              </button>
              <button onClick={saveSignature} disabled={signSaving} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: primaryColor, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                {signSaving ? <><Loader2 size={12} className="animate-spin" /> Guardando…</> : <><PenTool size={12} /> Confirmar firma</>}
              </button>
            </div>

            <div style={{ marginTop: 12, padding: '10px 12px', background: '#faf8f5', borderRadius: 6, fontSize: 10, color: '#888', lineHeight: 1.5 }}>
              Al firmar, confirmas que aceptas los términos del contrato y autorizas el uso de tus datos para la emisión de facturas. Esta firma tiene validez legal como acuerdo digital entre las partes.
            </div>
          </div>
        </div>
      )}
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

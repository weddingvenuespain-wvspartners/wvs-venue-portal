'use client'
import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, ExternalLink, Loader2, Zap } from 'lucide-react'

type StripeStatus = {
  connected: boolean
  onboarding_complete?: boolean
  charges_enabled?: boolean
  payouts_enabled?: boolean
  created_at?: string
}

export default function StripeConnectBlock() {
  const [status, setStatus] = useState<StripeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [dashLoading, setDashLoading] = useState(false)

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/stripe/account-status')
      const data = await res.json()
      setStatus(data)
    } catch {
      setStatus({ connected: false })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()

    // If returning from Stripe onboarding, refetch status after webhook fires
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('stripe') === 'success' || params.get('stripe') === 'refresh') {
        setTimeout(fetchStatus, 2000)
      }
    }
  }, [])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const res = await fetch('/api/stripe/create-account', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setConnecting(false)
    }
  }

  const handleDashboard = async () => {
    setDashLoading(true)
    try {
      const res = await fetch('/api/stripe/dashboard-link', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.open(data.url, '_blank')
    } catch { /* ignore */ }
    setDashLoading(false)
  }

  if (loading) {
    return (
      <div style={{ padding: '20px 0', color: 'var(--warm-gray)', fontSize: 13 }}>
        Cargando estado de pagos online...
      </div>
    )
  }

  // Not connected
  if (!status?.connected) {
    return (
      <div>
        <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.7, marginBottom: 16 }}>
          Activa pagos online para que las parejas puedan pagar las cuotas de sus presupuestos
          directamente con tarjeta. El dinero se deposita en tu cuenta bancaria automáticamente.
        </div>
        <div style={{ padding: 16, background: 'var(--cream)', borderRadius: 10, border: '1px solid var(--ivory)', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 8 }}>¿Cómo funciona?</div>
          <ul style={{ fontSize: 12, color: 'var(--charcoal)', lineHeight: 1.8, margin: 0, paddingLeft: 16 }}>
            <li>Verificas tu identidad y añades tu IBAN (~5 minutos)</li>
            <li>Las parejas pagan con tarjeta, Google Pay o Apple Pay</li>
            <li>El dinero se deposita en tu cuenta en 2-3 días laborables</li>
            <li>Se aplica un 2,5% de gastos de gestión sobre cada cobro</li>
          </ul>
        </div>
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="btn btn-primary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {connecting ? <><Loader2 size={14} className="animate-spin" /> Conectando...</> :
            <><Zap size={14} /> Activar pagos online</>}
        </button>
      </div>
    )
  }

  // Connected but onboarding incomplete
  if (!status.onboarding_complete || !status.charges_enabled) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <AlertCircle size={16} style={{ color: '#b45309' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#b45309' }}>Verificación pendiente</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.7, marginBottom: 16 }}>
          Tu cuenta está creada pero Stripe necesita que completes la verificación
          antes de poder recibir pagos.
        </div>
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="btn btn-primary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {connecting ? <><Loader2 size={14} className="animate-spin" /> Cargando...</> :
            'Completar verificación →'}
        </button>
      </div>
    )
  }

  // Fully connected
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <CheckCircle size={16} style={{ color: '#16a34a' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>Stripe conectado</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.7, marginBottom: 16 }}>
        Las parejas pueden pagar las cuotas de sus presupuestos con tarjeta.
        Los cobros se depositan automáticamente en tu cuenta bancaria.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={handleDashboard}
          disabled={dashLoading}
          className="btn btn-ghost btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {dashLoading ? <Loader2 size={14} className="animate-spin" /> :
            <><ExternalLink size={14} /> Ver panel de Stripe</>}
        </button>
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Plus, Trash2, Loader2, RefreshCw, Ticket, Check, X, ArrowLeft } from 'lucide-react'

type Coupon = {
  id: string
  code: string
  active: boolean
  coupon: {
    id: string
    name: string
    percent_off: number | null
    amount_off: number | null
    currency: string | null
    duration: string
    duration_in_months: number | null
    max_redemptions: number | null
    times_redeemed: number
  }
  max_redemptions: number | null
  times_redeemed: number
  expires_at: number | null
  created: number
}

type NewCoupon = {
  code: string
  name: string
  type: 'percent' | 'amount'
  percent_off: number
  amount_off: number
  duration: 'once' | 'repeating' | 'forever'
  duration_in_months: number
  max_redemptions: number | null
  expires_at: string
}

const EMPTY_COUPON: NewCoupon = {
  code: '', name: '', type: 'percent',
  percent_off: 10, amount_off: 50,
  duration: 'once', duration_in_months: 3,
  max_redemptions: null, expires_at: '',
}

export default function CouponsPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<NewCoupon>({ ...EMPTY_COUPON })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [toastErr, setToastErr] = useState(false)

  const notify = (msg: string, err = false) => {
    setToast(msg); setToastErr(err)
    setTimeout(() => setToast(''), 4000)
  }

  const loadCoupons = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/coupons')
      const data = await res.json()
      if (res.ok) setCoupons(data.coupons || [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    if (profile?.role !== 'admin') { router.push('/dashboard'); return }
    loadCoupons()
  }, [authLoading]) // eslint-disable-line

  const handleCreate = async () => {
    if (!form.code.trim()) { notify('Código requerido', true); return }
    setSaving(true)
    try {
      const body: any = {
        code: form.code.trim().toUpperCase(),
        name: form.name || form.code,
        duration: form.duration,
      }
      if (form.type === 'percent') body.percent_off = form.percent_off
      else body.amount_off = form.amount_off
      if (form.duration === 'repeating') body.duration_in_months = form.duration_in_months
      if (form.max_redemptions) body.max_redemptions = form.max_redemptions
      if (form.expires_at) body.expires_at = form.expires_at

      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.error || 'Error', true); setSaving(false); return }
      notify(`Cupón ${data.code} creado`)
      setShowModal(false)
      setForm({ ...EMPTY_COUPON })
      loadCoupons()
    } catch (e: any) { notify(e.message || 'Error', true) }
    setSaving(false)
  }

  const handleDeactivate = async (promoId: string) => {
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoId }),
      })
      if (res.ok) {
        setCoupons(c => c.map(x => x.id === promoId ? { ...x, active: false } : x))
        notify('Cupón desactivado')
      }
    } catch {}
  }

  return (
    <>
      <Sidebar />
      <main className="main-layout">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/admin" className="btn btn-ghost btn-sm"><ArrowLeft size={13} /> CRM</a>
            <div className="topbar-title">Cupones y promociones</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm({ ...EMPTY_COUPON }); setShowModal(true) }}>
            <Plus size={13} /> Nuevo cupón
          </button>
        </div>

        <div className="page-content">
          {toast && <div className={toastErr ? 'alert alert-error' : 'alert alert-success'} style={{ marginBottom: 16 }}>{toast}</div>}

          {/* Info banner */}
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(99,91,255,0.06)', border: '1px solid rgba(99,91,255,0.15)', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Ticket size={16} style={{ color: '#635BFF', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.6 }}>
              Los cupones se crean en Stripe y funcionan automáticamente en Checkout.
              Los venues pueden aplicar el código durante el pago gracias a <strong>allow_promotion_codes</strong>.
              Aquí puedes crear, ver y desactivar códigos promocionales.
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--warm-gray)' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 13 }}>Cargando cupones de Stripe...</div>
            </div>
          ) : coupons.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <Ticket size={32} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
              <div style={{ fontSize: 14, color: 'var(--warm-gray)', marginBottom: 12 }}>No hay cupones creados</div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
                <Plus size={13} /> Crear primer cupón
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                {coupons.map(c => (
                  <div key={c.id} className="card" style={{ marginBottom: 0, opacity: c.active ? 1 : 0.5 }}>
                    <div className="card-body" style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: 'var(--charcoal)', letterSpacing: '0.05em' }}>
                            {c.code}
                          </div>
                          {c.coupon.name && c.coupon.name !== c.code && (
                            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{c.coupon.name}</div>
                          )}
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 6,
                          background: c.active ? 'rgba(74,107,82,0.1)' : 'rgba(0,0,0,0.05)',
                          color: c.active ? '#4A6B52' : 'var(--warm-gray)',
                        }}>
                          {c.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>

                      {/* Discount */}
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#635BFF', marginBottom: 8 }}>
                        {c.coupon.percent_off
                          ? `${c.coupon.percent_off}% off`
                          : c.coupon.amount_off
                            ? `${(c.coupon.amount_off / 100).toFixed(0)}€ off`
                            : '—'}
                      </div>

                      {/* Details */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--cream)', color: 'var(--warm-gray)' }}>
                          {c.coupon.duration === 'once' ? 'Una vez' : c.coupon.duration === 'forever' ? 'Para siempre' : `${c.coupon.duration_in_months} meses`}
                        </span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--cream)', color: 'var(--warm-gray)' }}>
                          Usado: {c.times_redeemed}{c.max_redemptions ? `/${c.max_redemptions}` : ''}
                        </span>
                        {c.expires_at && (
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--cream)', color: 'var(--warm-gray)' }}>
                            Expira: {new Date(c.expires_at * 1000).toLocaleDateString('es-ES')}
                          </span>
                        )}
                      </div>

                      {c.active && (
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeactivate(c.id)}
                          style={{ color: '#B0473E', fontSize: 11, width: '100%', justifyContent: 'center' }}>
                          <Trash2 size={11} /> Desactivar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <button onClick={loadCoupons} className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <RefreshCw size={12} /> Actualizar
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Create modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-title">Nuevo cupón</div>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Código *</label>
                  <input className="form-input" value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                    placeholder="BIENVENIDO20" style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre (opcional)</label>
                  <input className="form-input" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Descuento bienvenida" />
                </div>
              </div>

              {/* Discount type */}
              <div className="form-group">
                <label className="form-label">Tipo de descuento</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setForm(f => ({ ...f, type: 'percent' }))}
                    className={`btn btn-sm ${form.type === 'percent' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }}>
                    % Porcentaje
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, type: 'amount' }))}
                    className={`btn btn-sm ${form.type === 'amount' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }}>
                    € Importe fijo
                  </button>
                </div>
              </div>

              {form.type === 'percent' ? (
                <div className="form-group">
                  <label className="form-label">Porcentaje de descuento</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input className="form-input" type="number" min={1} max={100} value={form.percent_off}
                      onChange={e => setForm(f => ({ ...f, percent_off: parseInt(e.target.value) || 0 }))}
                      style={{ width: 80 }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)' }}>%</span>
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Importe de descuento (EUR)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input className="form-input" type="number" min={1} value={form.amount_off}
                      onChange={e => setForm(f => ({ ...f, amount_off: parseFloat(e.target.value) || 0 }))}
                      style={{ width: 100 }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)' }}>€</span>
                  </div>
                </div>
              )}

              {/* Duration */}
              <div className="form-group">
                <label className="form-label">Duración</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([
                    { value: 'once', label: 'Primera factura' },
                    { value: 'repeating', label: 'Varios meses' },
                    { value: 'forever', label: 'Para siempre' },
                  ] as const).map(d => (
                    <button key={d.value} type="button" onClick={() => setForm(f => ({ ...f, duration: d.value }))}
                      className={`btn btn-sm ${form.duration === d.value ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, fontSize: 11 }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.duration === 'repeating' && (
                <div className="form-group">
                  <label className="form-label">Número de meses</label>
                  <input className="form-input" type="number" min={1} max={36} value={form.duration_in_months}
                    onChange={e => setForm(f => ({ ...f, duration_in_months: parseInt(e.target.value) || 3 }))}
                    style={{ width: 80 }} />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Máx. usos (0 = ilimitado)</label>
                  <input className="form-input" type="number" min={0} value={form.max_redemptions ?? 0}
                    onChange={e => setForm(f => ({ ...f, max_redemptions: parseInt(e.target.value) || null }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha expiración (opcional)</label>
                  <input className="form-input" type="date" value={form.expires_at}
                    onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
                </div>
              </div>

              {/* Preview */}
              <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--cream)', border: '1px solid var(--ivory)', marginTop: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 4 }}>Vista previa:</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: '#635BFF' }}>
                  {form.code || 'CÓDIGO'} → {form.type === 'percent' ? `${form.percent_off}% off` : `${form.amount_off}€ off`}
                  {' '}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--warm-gray)' }}>
                    ({form.duration === 'once' ? 'primera factura' : form.duration === 'forever' ? 'siempre' : `${form.duration_in_months} meses`})
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
                {saving ? 'Creando...' : 'Crear cupón'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

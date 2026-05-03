'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Tabs from '@/components/Tabs'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { usePlanFeatures } from '@/lib/use-plan-features'
import {
  Plus, Trash2, Send, X, Check, Eye, Pencil, Copy,
  Search, Receipt, Star, MessageCircle, Mail, Link2,
  Loader2, AlertCircle, User, Calculator,
} from 'lucide-react'
import type { Budget, BudgetStatus, PaymentTemplate } from '@/lib/budget-types'

const S_BADGE: Record<BudgetStatus, string> = {
  draft: 'badge-inactive',
  sent: 'badge-contacted',
  viewed: 'badge-active',
  accepted: 'badge-confirmed',
  expired: 'badge-pending',
}
const S_LABEL: Record<BudgetStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  viewed: 'Visto',
  accepted: 'Aceptado',
  expired: 'Expirado',
}

type BudgetLead = { id: string; name: string; email?: string; phone?: string }

let cachedBudgets: Budget[] | null = null

export default function BudgetsPage() {
  const router = useRouter()
  const { user, loading: authLoading, activeVenue } = useAuth()
  const { isBlocked } = useRequireSubscription()
  const features = usePlanFeatures()

  const [activeTab, setActiveTab] = useState<'budgets' | 'templates'>('budgets')
  const [budgets, setBudgets] = useState<Budget[]>(cachedBudgets ?? [])
  const [leads, setLeads] = useState<BudgetLead[]>([])
  const [templates, setTemplates] = useState<PaymentTemplate[]>([])
  const [loading, setLoading] = useState(cachedBudgets === null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | BudgetStatus>('all')
  const [sendModal, setSendModal] = useState<Budget | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    load()
  }, [user, authLoading, activeVenue?.id])

  const load = async () => {
    if (!activeVenue) { setLoading(false); return }
    const supabase = createClient()
    const [{ data: b }, { data: l }, { data: t }] = await Promise.all([
      supabase.from('budgets').select('*').eq('venue_id', activeVenue.id).order('created_at', { ascending: false }),
      supabase.from('leads').select('id, name, email, phone').eq('venue_id', activeVenue.id).order('created_at', { ascending: false }),
      supabase.from('budget_payment_templates').select('*').eq('venue_id', activeVenue.id).order('created_at'),
    ])
    if (b) { cachedBudgets = b as Budget[]; setBudgets(cachedBudgets) }
    if (l) setLeads(l as BudgetLead[])
    if (t) setTemplates(t as PaymentTemplate[])
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este presupuesto? La URL dejará de funcionar.')) return
    const supabase = createClient()
    await supabase.from('budgets').delete().eq('id', id)
    setBudgets(prev => {
      const next = prev.filter(b => b.id !== id)
      cachedBudgets = next
      return next
    })
  }

  const handleDuplicate = async (budget: Budget) => {
    const supabase = createClient()
    const { generateBudgetSlug } = await import('@/lib/budget-types')
    const { data } = await supabase.from('budgets').insert({
      user_id: user!.id,
      venue_id: activeVenue!.id,
      lead_id: null,
      slug: generateBudgetSlug(),
      couple_name: `${budget.couple_name} (copia)`,
      couple_email: budget.couple_email,
      wedding_date: budget.wedding_date,
      guest_count: budget.guest_count,
      status: 'draft',
      notes: budget.notes,
      valid_until: null,
      line_items: budget.line_items,
      payment_plan: budget.payment_plan,
      total_amount: budget.total_amount,
      tax_rate: budget.tax_rate,
      tax_included: budget.tax_included,
      discount_type: budget.discount_type,
      discount_amount: budget.discount_amount,
      discount_label: budget.discount_label,
    }).select().single()
    if (data) {
      cachedBudgets = null
      load()
    }
  }

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/presupuesto/${slug}`
    navigator.clipboard.writeText(url)
    setCopied(slug)
    setTimeout(() => setCopied(null), 2000)
  }

  const filtered = budgets.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return b.couple_name.toLowerCase().includes(q)
    }
    return true
  })

  if (isBlocked) return null

  if (!features.presupuestos) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cream)' }}>
      <Sidebar />
      <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 24px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32 }}>
            <Receipt size={32} style={{ color: 'var(--gold)' }} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--espresso)', fontFamily: 'Manrope, sans-serif', marginBottom: 10 }}>Presupuestos — Plan Premium</div>
          <div style={{ fontSize: 14, color: 'var(--warm-gray)', lineHeight: 1.6, marginBottom: 24 }}>
            Crea presupuestos digitales personalizados con desglose, plan de pagos y envíalos directamente a las parejas.
          </div>
          <a href="/perfil" style={{ display: 'inline-block', padding: '10px 24px', background: 'var(--gold)', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
            Actualizar plan →
          </a>
        </div>
      </main>
    </div>
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Presupuestos</div>
          <button onClick={() => router.push('/budgets/new')} className="btn btn-primary btn-sm"><Plus size={13} /> Nuevo presupuesto</button>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={k => setActiveTab(k as 'budgets' | 'templates')}
          tabs={[
            { key: 'budgets',   label: 'Presupuestos', icon: Receipt },
            { key: 'templates', label: 'Plantillas de pago', icon: Calculator },
          ]}
        />

        <div className="page-content">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--warm-gray)' }} />
            </div>
          ) : activeTab === 'templates' ? (
            <PaymentTemplatesTab templates={templates} userId={user!.id} venueId={activeVenue!.id} onRefresh={load} />
          ) : (
            <>
              {/* Filters */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                  <input className="form-input" style={{ paddingLeft: 34 }} placeholder="Buscar por pareja..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <select className="form-input" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                  <option value="all">Todos los estados</option>
                  {Object.entries(S_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              {filtered.length === 0 ? (
                <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
                  <Receipt size={36} style={{ color: 'var(--gold)', margin: '0 auto 16px', opacity: 0.6 }} />
                  <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, marginBottom: 8 }}>
                    {budgets.length === 0 ? 'Sin presupuestos' : 'Sin resultados'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 20 }}>
                    {budgets.length === 0 ? 'Crea tu primer presupuesto digital para enviar a una pareja.' : 'Cambia los filtros de búsqueda.'}
                  </div>
                  {budgets.length === 0 && (
                    <button onClick={() => router.push('/budgets/new')} className="btn btn-primary"><Plus size={13} /> Nuevo presupuesto</button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filtered.map(b => {
                    const lead = b.lead_id ? leads.find(l => l.id === b.lead_id) : null
                    return (
                      <div key={b.id} className="card" style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          {/* Name + lead */}
                          <div style={{ minWidth: 180, flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>{b.couple_name}</div>
                            {lead && (
                              <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <User size={10} /> {lead.name}
                              </div>
                            )}
                          </div>

                          {/* Wedding date */}
                          <div style={{ minWidth: 100, fontSize: 12, color: 'var(--charcoal)' }}>
                            {b.wedding_date ? new Date(b.wedding_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </div>

                          {/* Total */}
                          <div style={{ minWidth: 90, fontSize: 14, fontWeight: 700, color: 'var(--espresso)', textAlign: 'right' }}>
                            {b.total_amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                          </div>

                          {/* Status */}
                          <span className={`badge ${S_BADGE[b.status]}`} style={{ minWidth: 70, textAlign: 'center' }}>
                            {S_LABEL[b.status]}
                          </span>

                          {/* Views */}
                          <div style={{ minWidth: 50, fontSize: 12, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Eye size={12} /> {b.open_count || '—'}
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => router.push(`/budgets/${b.id}/edit`)} className="btn btn-ghost btn-sm" title="Editar"><Pencil size={13} /></button>
                            <button onClick={() => setSendModal(b)} className="btn btn-ghost btn-sm" title="Enviar"><Send size={13} /></button>
                            <button onClick={() => copyLink(b.slug)} className="btn btn-ghost btn-sm" title="Copiar enlace">
                              {copied === b.slug ? <Check size={13} style={{ color: '#16a34a' }} /> : <Copy size={13} />}
                            </button>
                            <button onClick={() => handleDuplicate(b)} className="btn btn-ghost btn-sm" title="Duplicar"><Copy size={13} style={{ opacity: 0.5 }} /></button>
                            <button onClick={() => handleDelete(b.id)} className="btn btn-ghost btn-sm" title="Eliminar"><Trash2 size={13} style={{ color: 'var(--rose)' }} /></button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {sendModal && <SendBudgetModal budget={sendModal} leads={leads} onClose={() => setSendModal(null)} />}
    </div>
  )
}

// ── Payment Templates Tab ─────────────���──────────────────────────────────────

function PaymentTemplatesTab({ templates, userId, venueId, onRefresh }: {
  templates: PaymentTemplate[]; userId: string; venueId: string; onRefresh: () => void
}) {
  const [editing, setEditing] = useState<PaymentTemplate | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [name, setName] = useState('')
  const [installments, setInstallments] = useState<{ label: string; percent: number; due_rule: string; months?: number; days?: number }[]>([])
  const [saving, setSaving] = useState(false)

  const startNew = () => {
    setIsNew(true); setEditing(null); setName('')
    setInstallments([
      { label: 'Depósito', percent: 30, due_rule: 'on_confirmation' },
      { label: '2ª cuota', percent: 40, due_rule: 'months_before', months: 3 },
      { label: 'Pago final', percent: 30, due_rule: 'months_before', months: 1 },
    ])
  }

  const startEdit = (t: PaymentTemplate) => {
    setIsNew(false); setEditing(t); setName(t.name)
    setInstallments(t.installments as any[])
  }

  const cancel = () => { setEditing(null); setIsNew(false) }

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = { user_id: userId, venue_id: venueId, name: name.trim(), installments }
    if (isNew) {
      const { error } = await supabase.from('budget_payment_templates').insert({ ...payload, is_default: templates.length === 0 })
      if (error) { console.error('Insert template error:', error); setSaving(false); return }
    } else if (editing) {
      const { error } = await supabase.from('budget_payment_templates').update(payload).eq('id', editing.id)
      if (error) { console.error('Update template error:', error); setSaving(false); return }
    }
    setSaving(false); cancel(); onRefresh()
  }

  const setDefault = async (id: string) => {
    const supabase = createClient()
    await supabase.from('budget_payment_templates').update({ is_default: false }).eq('venue_id', venueId)
    await supabase.from('budget_payment_templates').update({ is_default: true }).eq('id', id)
    onRefresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla?')) return
    const supabase = createClient()
    await supabase.from('budget_payment_templates').delete().eq('id', id)
    onRefresh()
  }

  const totalPercent = installments.reduce((s, i) => s + i.percent, 0)

  const updateInstallment = (idx: number, field: string, value: any) => {
    setInstallments(prev => prev.map((inst, i) => i === idx ? { ...inst, [field]: value } : inst))
  }

  const DUE_RULE_LABEL: Record<string, string> = {
    on_confirmation: 'Al confirmar',
    months_before: 'Meses antes de la boda',
    days_before: 'Días antes de la boda',
    fixed_date: 'Fecha fija',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)', marginBottom: 2 }}>Plantillas de plan de pagos</div>
          <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Define cuántas cuotas y cuándo se pagan. Se aplican automáticamente al crear presupuestos.</div>
        </div>
        <button onClick={startNew} className="btn btn-primary btn-sm"><Plus size={12} /> Nueva plantilla</button>
      </div>

      {/* Editor */}
      {(isNew || editing) && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>{isNew ? 'Nueva plantilla' : 'Editar plantilla'}</div>
            <button onClick={cancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}><X size={16} /></button>
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Nombre <span style={{ color: 'var(--rose)' }}>*</span></label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Estándar 3 cuotas" style={!name.trim() ? { borderColor: 'var(--rose)' } : {}} autoFocus />
            {!name.trim() && <div style={{ fontSize: 11, color: 'var(--rose)', marginTop: 4 }}>Pon un nombre a la plantilla para poder guardarla</div>}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--espresso)', marginBottom: 8 }}>Cuotas</div>
          {installments.map((inst, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 70px auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input className="form-input" value={inst.label} onChange={e => updateInstallment(i, 'label', e.target.value)} placeholder="Nombre cuota" />
              <div style={{ position: 'relative' }}>
                <input className="form-input" type="number" min={0} max={100} value={inst.percent} onChange={e => updateInstallment(i, 'percent', Number(e.target.value))} style={{ paddingRight: 24 }} />
                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--warm-gray)' }}>%</span>
              </div>
              <select className="form-input" value={inst.due_rule} onChange={e => updateInstallment(i, 'due_rule', e.target.value)}>
                {Object.entries(DUE_RULE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {(inst.due_rule === 'months_before' || inst.due_rule === 'days_before') ? (
                <input className="form-input" type="number" min={1} value={inst.due_rule === 'months_before' ? (inst.months ?? 1) : (inst.days ?? 7)}
                  onChange={e => updateInstallment(i, inst.due_rule === 'months_before' ? 'months' : 'days', Number(e.target.value))}
                  title={inst.due_rule === 'months_before' ? 'Meses antes' : 'Días antes'} />
              ) : <div />}
              <button onClick={() => setInstallments(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: 4 }}><Trash2 size={13} /></button>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <button onClick={() => setInstallments(prev => [...prev, { label: '', percent: 0, due_rule: 'months_before', months: 1 }])} className="btn btn-ghost btn-sm"><Plus size={11} /> Añadir cuota</button>
            <span style={{ fontSize: 11, color: totalPercent === 100 ? '#16a34a' : 'var(--rose)', fontWeight: 600 }}>Total: {totalPercent}%</span>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={cancel}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving || !name.trim() || totalPercent !== 100}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {templates.length === 0 && !isNew ? (
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <Calculator size={36} style={{ color: 'var(--gold)', margin: '0 auto 16px', opacity: 0.6 }} />
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, marginBottom: 8 }}>Sin plantillas de pago</div>
          <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 20 }}>Crea tu primera plantilla para automatizar el plan de pagos en tus presupuestos.</div>
          <button onClick={startNew} className="btn btn-primary"><Plus size={13} /> Nueva plantilla</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.map(t => (
            <div key={t.id} className="card" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>{t.name}</div>
                    {t.is_default && <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 8px', borderRadius: 10, fontWeight: 600 }}>Predeterminada</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>
                    {t.installments.length} cuota{t.installments.length !== 1 ? 's' : ''}: {(t.installments as any[]).map((i: any) => `${i.percent}%`).join(' / ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => startEdit(t)} className="btn btn-ghost btn-sm"><Pencil size={13} /></button>
                  {!t.is_default && <button onClick={() => setDefault(t.id)} className="btn btn-ghost btn-sm" title="Predeterminada"><Star size={13} /></button>}
                  <button onClick={() => handleDelete(t.id)} className="btn btn-ghost btn-sm"><Trash2 size={13} style={{ color: 'var(--rose)' }} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Send Budget Modal ─────���──────────────────────────────────────────────────

function SendBudgetModal({ budget, leads, onClose }: {
  budget: Budget; leads: BudgetLead[]; onClose: () => void
}) {
  const [lead, setLead] = useState<BudgetLead | null>(
    budget.lead_id ? leads.find(l => l.id === budget.lead_id) ?? null : null
  )
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(false)

  const budgetUrl = `${window.location.origin}/presupuesto/${budget.slug}`
  const filtered = leads.filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
  const waText = `Hola${lead ? ` ${lead.name.split(' ')[0]}` : ''}\n\nOs enviamos el presupuesto detallado para vuestra boda:\n\n${budgetUrl}\n\nAhí encontraréis el desglose completo y el plan de pagos. ¡Cualquier pregunta, aquí estamos!`
  const waLink = `https://wa.me/${lead?.phone?.replace(/[^0-9]/g, '') || ''}?text=${encodeURIComponent(waText)}`
  const emailLink = `mailto:${lead?.email || ''}?subject=${encodeURIComponent(`Presupuesto — ${budget.couple_name}`)}&body=${encodeURIComponent(waText)}`

  const copyLink = () => {
    navigator.clipboard.writeText(budgetUrl)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  // Mark as sent
  useEffect(() => {
    if (budget.status === 'draft') {
      const supabase = createClient()
      supabase.from('budgets').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', budget.id)
    }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 19, color: 'var(--espresso)' }}>Enviar presupuesto</div>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{budget.couple_name} — {budget.total_amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {/* Lead selector */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Seleccionar lead (opcional)</div>
            {lead ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8 }}>
                <User size={14} style={{ color: '#16a34a' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>{lead.name}</div>
                  <div style={{ fontSize: 11, color: '#16a34a' }}>{lead.phone || lead.email || 'Sin contacto'}</div>
                </div>
                <button onClick={() => setLead(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a' }}><X size={12} /></button>
              </div>
            ) : (
              <div>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
                  <input className="form-input" style={{ paddingLeft: 30 }} value={search}
                    onChange={e => setSearch(e.target.value)} placeholder="Buscar lead por nombre..." />
                </div>
                {search && (
                  <div style={{ border: '1px solid var(--ivory)', borderRadius: 8, overflow: 'hidden' }}>
                    {filtered.map(l => (
                      <div key={l.id} onClick={() => { setLead(l); setSearch('') }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--ivory)', background: '#fff' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                        <User size={13} style={{ color: 'var(--warm-gray)' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{l.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{l.phone || l.email || '—'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Send buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#16a34a', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
              <MessageCircle size={16} /> Enviar por WhatsApp
            </a>
            <a href={emailLink} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#2563eb', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
              <Mail size={16} /> Enviar por email
            </a>
            <button onClick={copyLink}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--cream)', color: 'var(--charcoal)', border: '1px solid var(--ivory)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
              {copied ? <><Check size={16} style={{ color: '#16a34a' }} /> ¡Enlace copiado!</> : <><Link2 size={16} /> Copiar enlace del presupuesto</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

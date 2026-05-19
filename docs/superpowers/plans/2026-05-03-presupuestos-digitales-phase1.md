# Presupuestos Digitales — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Presupuestos" section where venues create branded digital quotes with line items, discounts, tax, and payment plans — shared via non-indexed URL.

**Architecture:** New `budgets` and `budget_payment_templates` tables in Supabase. Budget editor page at `/budgets/[id]/edit`, couple-facing public page at `/presupuesto/[slug]`, list/management page at `/budgets`. Feature-gated to premium plan. Follows existing proposals patterns.

**Tech Stack:** Next.js 15 App Router, Supabase (client + server), TypeScript, lucide-react icons, inline styles (codebase pattern).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `lib/budget-types.ts` | Shared types: Budget, LineItemGroup, PaymentInstallment, PaymentTemplate |
| `app/budgets/page.tsx` | List page with tabs (presupuestos + plantillas de pago) |
| `app/budgets/new/page.tsx` | Create draft + redirect to editor |
| `app/budgets/[id]/edit/page.tsx` | Budget editor (line items, payment plan, preview) |
| `app/presupuesto/[slug]/page.tsx` | Public couple-facing page (server component) |
| `app/presupuesto/[slug]/BudgetView.tsx` | Client component for public page rendering |
| `app/api/budgets/track/route.ts` | View tracking (no auth) |
| `lib/use-plan-features.ts` | Add `presupuestos` feature flag |
| `components/Sidebar.tsx` | Add "Presupuestos" nav item |
| `app/leads/page.tsx` | Add "Crear presupuesto" quick action |

---

### Task 1: Database Migration — Create Tables

**Files:**
- Create: Supabase migration via MCP

- [ ] **Step 1: Create `budgets` table and `budget_payment_templates` table**

Run this SQL via Supabase MCP `execute_sql`:

```sql
-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  couple_name text NOT NULL DEFAULT 'Nuevo presupuesto',
  couple_email text,
  wedding_date date,
  guest_count int,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','accepted','expired')),
  notes text,
  valid_until date,
  line_items jsonb NOT NULL DEFAULT '{"groups":[]}'::jsonb,
  payment_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 21,
  tax_included boolean DEFAULT true,
  discount_type text CHECK (discount_type IN ('fixed','percent')),
  discount_amount numeric(12,2),
  discount_label text,
  sent_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  open_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Payment plan templates
CREATE TABLE IF NOT EXISTS budget_payment_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  installments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for budgets
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budgets_owner" ON budgets
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "budgets_public_read" ON budgets
  FOR SELECT USING (true);

-- RLS for payment templates
ALTER TABLE budget_payment_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bpt_owner" ON budget_payment_templates
  FOR ALL USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_budgets_venue ON budgets(venue_id);
CREATE INDEX idx_budgets_slug ON budgets(slug);
CREATE INDEX idx_budgets_lead ON budgets(lead_id);
CREATE INDEX idx_bpt_venue ON budget_payment_templates(venue_id);
```

- [ ] **Step 2: Verify tables exist**

Run via MCP `execute_sql`:
```sql
SELECT table_name FROM information_schema.tables WHERE table_name IN ('budgets', 'budget_payment_templates');
```

Expected: both table names returned.

---

### Task 2: Types + Feature Flag

**Files:**
- Create: `lib/budget-types.ts`
- Modify: `lib/use-plan-features.ts`

- [ ] **Step 1: Create shared types file**

Create `lib/budget-types.ts`:

```typescript
export type BudgetStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'expired'

export type LineItem = {
  id: string
  concept: string
  qty: number
  unit_price: number
  subtotal: number
}

export type LineItemGroup = {
  id: string
  name: string
  items: LineItem[]
}

export type LineItemsData = {
  groups: LineItemGroup[]
}

export type PaymentInstallment = {
  label: string
  amount: number
  due_date: string
  status: 'pending' | 'paid'
}

export type PaymentTemplateRule = {
  label: string
  percent: number
  due_rule: 'on_confirmation' | 'months_before' | 'days_before' | 'fixed_date'
  months?: number
  days?: number
  fixed_date?: string
}

export type PaymentTemplate = {
  id: string
  user_id: string
  venue_id: string
  name: string
  is_default: boolean
  installments: PaymentTemplateRule[]
  created_at: string
}

export type Budget = {
  id: string
  user_id: string
  venue_id: string
  lead_id: string | null
  slug: string
  couple_name: string
  couple_email: string | null
  wedding_date: string | null
  guest_count: number | null
  status: BudgetStatus
  notes: string | null
  valid_until: string | null
  line_items: LineItemsData
  payment_plan: PaymentInstallment[]
  total_amount: number
  tax_rate: number | null
  tax_included: boolean
  discount_type: 'fixed' | 'percent' | null
  discount_amount: number | null
  discount_label: string | null
  sent_at: string | null
  first_viewed_at: string | null
  last_viewed_at: string | null
  open_count: number
  created_at: string
  updated_at: string
}

export function generateBudgetSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let slug = ''
  for (let i = 0; i < 10; i++) slug += chars[Math.floor(Math.random() * chars.length)]
  return slug
}

export function calcBudgetTotal(
  groups: LineItemGroup[],
  discount: { type: 'fixed' | 'percent' | null; amount: number | null },
  taxRate: number | null,
  taxIncluded: boolean
): number {
  const subtotal = groups.reduce((sum, g) => sum + g.items.reduce((s, i) => s + i.subtotal, 0), 0)
  let afterDiscount = subtotal
  if (discount.type === 'fixed' && discount.amount) afterDiscount -= discount.amount
  if (discount.type === 'percent' && discount.amount) afterDiscount -= subtotal * (discount.amount / 100)
  if (taxRate && !taxIncluded) afterDiscount *= (1 + taxRate / 100)
  return Math.round(afterDiscount * 100) / 100
}

export function applyPaymentTemplate(
  template: PaymentTemplateRule[],
  total: number,
  weddingDate: string | null
): PaymentInstallment[] {
  return template.map(rule => {
    const amount = Math.round((rule.percent / 100) * total * 100) / 100
    let due_date = ''
    if (rule.due_rule === 'on_confirmation') {
      due_date = new Date().toISOString().slice(0, 10)
    } else if (rule.due_rule === 'fixed_date' && rule.fixed_date) {
      due_date = rule.fixed_date
    } else if (weddingDate) {
      const wd = new Date(weddingDate + 'T12:00:00')
      if (rule.due_rule === 'months_before' && rule.months) {
        wd.setMonth(wd.getMonth() - rule.months)
      } else if (rule.due_rule === 'days_before' && rule.days) {
        wd.setDate(wd.getDate() - rule.days)
      }
      due_date = wd.toISOString().slice(0, 10)
    }
    return { label: rule.label, amount, due_date, status: 'pending' as const }
  })
}
```

- [ ] **Step 2: Add `presupuestos` to PlanFeatures**

In `lib/use-plan-features.ts`, add `presupuestos: boolean` to the `PlanFeatures` type (after `comunicacion`):

```typescript
presupuestos:           boolean  // Crear presupuestos digitales
```

Add to `BASIC_FALLBACK`:
```typescript
presupuestos:           false,
```

Add to `PREMIUM_FALLBACK`:
```typescript
presupuestos:           true,
```

- [ ] **Step 3: Add sidebar nav item**

In `components/Sidebar.tsx`, add to the `venueItems` array after the proposals entry (the line with `href: '/proposals'`):

```typescript
{ href: '/budgets',      label: 'Presupuestos',                                     icon: 'M2 3h12v11H2zM5 1v3M11 1v3M5 7h6M5 10h3',             feature: 'presupuestos' },
```

- [ ] **Step 4: Commit**

```
git add lib/budget-types.ts lib/use-plan-features.ts components/Sidebar.tsx
git commit -m "feat(budgets): add types, feature flag, and sidebar nav"
```

---

### Task 3: Budget List Page

**Files:**
- Create: `app/budgets/page.tsx`

- [ ] **Step 1: Create the list page**

Create `app/budgets/page.tsx`:

```typescript
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
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32 }}>💰</div>
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

// ── Payment Templates Tab ────────────────────────────────────────────────────

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
      await supabase.from('budget_payment_templates').insert({ ...payload, is_default: templates.length === 0 })
    } else if (editing) {
      await supabase.from('budget_payment_templates').update(payload).eq('id', editing.id)
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
            <label className="form-label">Nombre</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Estándar 3 cuotas" />
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--espresso)', marginBottom: 8 }}>Cuotas</div>
          {installments.map((inst, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input className="form-input" value={inst.label} onChange={e => updateInstallment(i, 'label', e.target.value)} placeholder="Nombre cuota" />
              <div style={{ position: 'relative' }}>
                <input className="form-input" type="number" min={0} max={100} value={inst.percent} onChange={e => updateInstallment(i, 'percent', Number(e.target.value))} style={{ paddingRight: 24 }} />
                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--warm-gray)' }}>%</span>
              </div>
              <select className="form-input" value={inst.due_rule} onChange={e => updateInstallment(i, 'due_rule', e.target.value)}>
                {Object.entries(DUE_RULE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button onClick={() => setInstallments(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: 4 }}><Trash2 size={13} /></button>
            </div>
          ))}
          {installments.length > 0 && inst.due_rule === 'months_before' && (
            /* months input handled inline via grid */
            null
          )}
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

// ── Send Budget Modal ────────────────────────────────────────────────────────

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
```

- [ ] **Step 2: Commit**

```
git add app/budgets/page.tsx
git commit -m "feat(budgets): add list page with filters, send modal, payment templates tab"
```

---

### Task 4: Budget Creation Page

**Files:**
- Create: `app/budgets/new/page.tsx`

- [ ] **Step 1: Create the new budget page**

Create `app/budgets/new/page.tsx`:

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { usePlanFeatures } from '@/lib/use-plan-features'
import { Loader2, AlertCircle } from 'lucide-react'
import { generateBudgetSlug } from '@/lib/budget-types'
import type { PaymentTemplate } from '@/lib/budget-types'
import { applyPaymentTemplate } from '@/lib/budget-types'

function NewBudgetContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading, activeVenue } = useAuth()
  const { isBlocked, ready } = useRequireSubscription()
  const features = usePlanFeatures()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    if (isBlocked) return
    if (!ready) return
    if (!features.presupuestos) { router.replace('/budgets'); return }
    if (!activeVenue) return

    const leadId = searchParams.get('lead_id')

    const createDraft = async () => {
      const supabase = createClient()

      let coupleName = 'Nuevo presupuesto'
      let coupleEmail: string | null = null
      let guestCount: number | null = null
      let weddingDate: string | null = null

      if (leadId) {
        const { data: lead } = await supabase
          .from('leads')
          .select('name, email, guests, wedding_date')
          .eq('id', leadId)
          .eq('venue_id', activeVenue.id)
          .maybeSingle()
        if (lead) {
          coupleName = lead.name ?? coupleName
          coupleEmail = lead.email ?? null
          guestCount = lead.guests ?? null
          weddingDate = lead.wedding_date ?? null
        }
      }

      // Load default payment template
      const { data: defTpl } = await supabase
        .from('budget_payment_templates')
        .select('*')
        .eq('venue_id', activeVenue.id)
        .eq('is_default', true)
        .maybeSingle()

      const paymentPlan = defTpl
        ? applyPaymentTemplate(defTpl.installments as any[], 0, weddingDate)
        : []

      const slug = generateBudgetSlug()
      const { data, error: insErr } = await supabase.from('budgets').insert({
        user_id: user.id,
        venue_id: activeVenue.id,
        lead_id: leadId || null,
        slug,
        couple_name: coupleName,
        couple_email: coupleEmail,
        guest_count: guestCount,
        wedding_date: weddingDate,
        status: 'draft',
        line_items: { groups: [] },
        payment_plan: paymentPlan,
        total_amount: 0,
      }).select().single()

      if (insErr || !data) {
        setError(`No se pudo crear el presupuesto: ${insErr?.message ?? 'desconocido'}`)
        return
      }

      router.replace(`/budgets/${data.id}/edit`)
    }

    createDraft()
  }, [user, authLoading, isBlocked, ready, features.presupuestos, activeVenue?.id])

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: 'var(--cream)', padding: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#991b1b', fontSize: 14 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/budgets')}>← Volver a presupuestos</button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', color: 'var(--warm-gray)', gap: 8 }}>
      <Loader2 size={16} className="animate-spin" /> Creando presupuesto…
    </div>
  )
}

export default function NewBudgetPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)' }}><Loader2 size={16} className="animate-spin" /></div>}>
      <NewBudgetContent />
    </Suspense>
  )
}
```

- [ ] **Step 2: Commit**

```
git add app/budgets/new/page.tsx
git commit -m "feat(budgets): add draft creation page with lead pre-fill"
```

---

### Task 5: Budget Editor Page

**Files:**
- Create: `app/budgets/[id]/edit/page.tsx`

- [ ] **Step 1: Create the editor page**

Create `app/budgets/[id]/edit/page.tsx`:

```typescript
'use client'
import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { usePlanFeatures } from '@/lib/use-plan-features'
import {
  Plus, Trash2, X, Check, Eye, Save, Send, ChevronDown,
  GripVertical, AlertCircle, Loader2, Receipt, Package,
  Calculator, MessageCircle, Mail, Link2, User, Search,
} from 'lucide-react'
import type {
  Budget, LineItemGroup, LineItem, PaymentInstallment,
  PaymentTemplate, PaymentTemplateRule,
} from '@/lib/budget-types'
import { calcBudgetTotal, applyPaymentTemplate } from '@/lib/budget-types'

function nanoid(len = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export default function BudgetEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user, loading: authLoading, activeVenue } = useAuth()
  const { isBlocked } = useRequireSubscription()
  const features = usePlanFeatures()

  const [budget, setBudget] = useState<Budget | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [templates, setTemplates] = useState<PaymentTemplate[]>([])
  const [showImport, setShowImport] = useState(false)
  const [modalities, setModalities] = useState<any[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)

  // Form state
  const [coupleName, setCoupleName] = useState('')
  const [coupleEmail, setCoupleEmail] = useState('')
  const [weddingDate, setWeddingDate] = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [notes, setNotes] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [groups, setGroups] = useState<LineItemGroup[]>([])
  const [discountType, setDiscountType] = useState<'fixed' | 'percent' | null>(null)
  const [discountAmount, setDiscountAmount] = useState<number>(0)
  const [discountLabel, setDiscountLabel] = useState('')
  const [taxRate, setTaxRate] = useState<number>(21)
  const [taxIncluded, setTaxIncluded] = useState(true)
  const [paymentPlan, setPaymentPlan] = useState<PaymentInstallment[]>([])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadBudget()
  }, [user, authLoading, activeVenue?.id])

  const loadBudget = async () => {
    if (!activeVenue) return
    const supabase = createClient()
    const [{ data: b }, { data: t }, { data: m }] = await Promise.all([
      supabase.from('budgets').select('*').eq('id', id).eq('venue_id', activeVenue.id).single(),
      supabase.from('budget_payment_templates').select('*').eq('venue_id', activeVenue.id).order('created_at'),
      supabase.from('venue_modalities').select('*, packages:venue_modality_packages(*, prices:venue_modality_prices(*))').eq('user_id', user!.id).order('sort_order'),
    ])
    if (!b) { setError('Presupuesto no encontrado'); setLoading(false); return }
    const budget = b as Budget
    setBudget(budget)
    setCoupleName(budget.couple_name)
    setCoupleEmail(budget.couple_email ?? '')
    setWeddingDate(budget.wedding_date ?? '')
    setGuestCount(budget.guest_count?.toString() ?? '')
    setNotes(budget.notes ?? '')
    setValidUntil(budget.valid_until ?? '')
    setGroups(budget.line_items.groups || [])
    setDiscountType(budget.discount_type)
    setDiscountAmount(budget.discount_amount ?? 0)
    setDiscountLabel(budget.discount_label ?? '')
    setTaxRate(budget.tax_rate ?? 21)
    setTaxIncluded(budget.tax_included ?? true)
    setPaymentPlan(budget.payment_plan || [])
    if (t) setTemplates(t as PaymentTemplate[])
    if (m) setModalities(m)
    setLoading(false)
  }

  const total = calcBudgetTotal(
    groups,
    { type: discountType, amount: discountAmount },
    taxRate,
    taxIncluded
  )

  const subtotal = groups.reduce((sum, g) => sum + g.items.reduce((s, i) => s + i.subtotal, 0), 0)

  const saveBudget = useCallback(async () => {
    if (!budget) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('budgets').update({
      couple_name: coupleName,
      couple_email: coupleEmail || null,
      wedding_date: weddingDate || null,
      guest_count: guestCount ? parseInt(guestCount) : null,
      notes: notes || null,
      valid_until: validUntil || null,
      line_items: { groups },
      payment_plan: paymentPlan,
      total_amount: total,
      tax_rate: taxRate,
      tax_included: taxIncluded,
      discount_type: discountType,
      discount_amount: discountAmount || null,
      discount_label: discountLabel || null,
      updated_at: new Date().toISOString(),
    }).eq('id', budget.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [budget, coupleName, coupleEmail, weddingDate, guestCount, notes, validUntil, groups, paymentPlan, total, taxRate, taxIncluded, discountType, discountAmount, discountLabel])

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (!budget || loading) return
    const t = setTimeout(() => { saveBudget() }, 1500)
    return () => clearTimeout(t)
  }, [coupleName, coupleEmail, weddingDate, guestCount, notes, validUntil, groups, paymentPlan, taxRate, taxIncluded, discountType, discountAmount, discountLabel])

  // Group operations
  const addGroup = () => {
    setGroups(prev => [...prev, { id: nanoid(), name: 'Nuevo grupo', items: [] }])
  }
  const removeGroup = (gid: string) => {
    setGroups(prev => prev.filter(g => g.id !== gid))
  }
  const updateGroupName = (gid: string, name: string) => {
    setGroups(prev => prev.map(g => g.id === gid ? { ...g, name } : g))
  }

  // Item operations
  const addItem = (gid: string) => {
    setGroups(prev => prev.map(g => g.id === gid ? {
      ...g, items: [...g.items, { id: nanoid(), concept: '', qty: 1, unit_price: 0, subtotal: 0 }]
    } : g))
  }
  const removeItem = (gid: string, iid: string) => {
    setGroups(prev => prev.map(g => g.id === gid ? { ...g, items: g.items.filter(i => i.id !== iid) } : g))
  }
  const updateItem = (gid: string, iid: string, field: keyof LineItem, value: any) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== gid) return g
      return {
        ...g, items: g.items.map(i => {
          if (i.id !== iid) return i
          const updated = { ...i, [field]: value }
          if (field === 'qty' || field === 'unit_price') {
            updated.subtotal = Math.round(updated.qty * updated.unit_price * 100) / 100
          }
          return updated
        })
      }
    }))
  }

  // Payment plan
  const applyTemplate = (tpl: PaymentTemplate) => {
    setPaymentPlan(applyPaymentTemplate(tpl.installments as PaymentTemplateRule[], total, weddingDate || null))
  }
  const updatePayment = (idx: number, field: keyof PaymentInstallment, value: any) => {
    setPaymentPlan(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }
  const addPayment = () => {
    setPaymentPlan(prev => [...prev, { label: '', amount: 0, due_date: '', status: 'pending' }])
  }
  const removePayment = (idx: number) => {
    setPaymentPlan(prev => prev.filter((_, i) => i !== idx))
  }

  // Import from structure
  const importModality = (mod: any) => {
    const items: LineItem[] = []
    if (mod.packages) {
      for (const pkg of mod.packages) {
        if (pkg.prices) {
          for (const price of pkg.prices) {
            items.push({
              id: nanoid(),
              concept: pkg.label ? `${mod.name} — ${pkg.label}` : mod.name,
              qty: 1,
              unit_price: parseFloat(price.price) || 0,
              subtotal: parseFloat(price.price) || 0,
            })
          }
        }
      }
    }
    if (items.length === 0 && mod.prices) {
      for (const price of mod.prices) {
        items.push({
          id: nanoid(),
          concept: mod.name,
          qty: 1,
          unit_price: parseFloat(price.price) || 0,
          subtotal: parseFloat(price.price) || 0,
        })
      }
    }
    if (items.length === 0) {
      items.push({ id: nanoid(), concept: mod.name, qty: 1, unit_price: 0, subtotal: 0 })
    }
    setGroups(prev => [...prev, { id: nanoid(), name: mod.name, items }])
    setShowImport(false)
  }

  if (isBlocked) return null

  if (loading) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar"><div className="topbar-title">Presupuesto</div></div>
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <Loader2 size={16} className="animate-spin" style={{ color: 'var(--warm-gray)' }} />
        </div>
      </div>
    </div>
  )

  if (error || !budget) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar"><div className="topbar-title">Presupuesto</div></div>
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, flexDirection: 'column', gap: 12 }}>
          <AlertCircle size={18} style={{ color: 'var(--rose)' }} />
          <div style={{ fontSize: 14, color: 'var(--charcoal)' }}>{error || 'No encontrado'}</div>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/budgets')}>← Volver</button>
        </div>
      </div>
    </div>
  )

  const paymentTotal = paymentPlan.reduce((s, p) => s + p.amount, 0)

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/budgets')}>← Presupuestos</button>
            <div className="topbar-title" style={{ fontSize: 16 }}>{coupleName || 'Presupuesto'}</div>
            <span className={`badge ${S_BADGE[budget.status]}`}>{S_LABEL[budget.status]}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPreviewOpen(true)} className="btn btn-ghost btn-sm"><Eye size={13} /> Vista previa</button>
            <button onClick={saveBudget} className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <><Check size={13} /> Guardado</> : <><Save size={13} /> Guardar</>}
            </button>
          </div>
        </div>

        <div className="page-content" style={{ maxWidth: 820, margin: '0 auto' }}>

          {/* ── Datos de la pareja ─────────────────────────────────────── */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)', marginBottom: 12 }}>Datos de la pareja</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nombre de la pareja</label>
                <input className="form-input" value={coupleName} onChange={e => setCoupleName(e.target.value)} placeholder="Laura y Carlos" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={coupleEmail} onChange={e => setCoupleEmail(e.target.value)} placeholder="pareja@email.com" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Fecha de boda</label>
                <input className="form-input" type="date" value={weddingDate} onChange={e => setWeddingDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nº invitados</label>
                <input className="form-input" type="number" min={0} value={guestCount} onChange={e => setGuestCount(e.target.value)} placeholder="150" />
              </div>
            </div>
          </div>

          {/* ── Líneas del presupuesto ─────────────────────────────────── */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>Conceptos del presupuesto</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {modalities.length > 0 && (
                  <button onClick={() => setShowImport(true)} className="btn btn-ghost btn-sm"><Package size={12} /> Importar desde estructura</button>
                )}
                <button onClick={addGroup} className="btn btn-ghost btn-sm"><Plus size={12} /> Añadir grupo</button>
              </div>
            </div>

            {groups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--warm-gray)', fontSize: 13 }}>
                Añade un grupo de conceptos o importa desde tu estructura configurada.
              </div>
            ) : groups.map(g => (
              <div key={g.id} style={{ marginBottom: 16, border: '1px solid var(--ivory)', borderRadius: 10, overflow: 'hidden' }}>
                {/* Group header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--cream)' }}>
                  <GripVertical size={14} style={{ color: 'var(--stone)', cursor: 'grab' }} />
                  <input
                    value={g.name}
                    onChange={e => updateGroupName(g.id, e.target.value)}
                    style={{ flex: 1, background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--espresso)', outline: 'none' }}
                  />
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginRight: 8 }}>
                    {g.items.reduce((s, i) => s + i.subtotal, 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </div>
                  <button onClick={() => removeGroup(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: 2 }}><Trash2 size={13} /></button>
                </div>
                {/* Column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 100px 100px 30px', gap: 0, padding: '6px 14px', fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--ivory)' }}>
                  <span>Concepto</span><span style={{ textAlign: 'center' }}>Uds.</span><span style={{ textAlign: 'right' }}>Precio/ud</span><span style={{ textAlign: 'right' }}>Subtotal</span><span />
                </div>
                {/* Items */}
                {g.items.map(item => (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 100px 100px 30px', gap: 0, padding: '6px 14px', alignItems: 'center', borderBottom: '1px solid var(--ivory)' }}>
                    <input value={item.concept} onChange={e => updateItem(g.id, item.id, 'concept', e.target.value)} className="form-input" style={{ border: 'none', padding: '4px 0', fontSize: 13 }} placeholder="Concepto" />
                    <input type="number" min={0} value={item.qty} onChange={e => updateItem(g.id, item.id, 'qty', Number(e.target.value))} className="form-input" style={{ border: 'none', padding: '4px', fontSize: 13, textAlign: 'center' }} />
                    <input type="number" min={0} step={0.01} value={item.unit_price} onChange={e => updateItem(g.id, item.id, 'unit_price', Number(e.target.value))} className="form-input" style={{ border: 'none', padding: '4px', fontSize: 13, textAlign: 'right' }} />
                    <div style={{ fontSize: 13, fontWeight: 500, textAlign: 'right', color: 'var(--charcoal)' }}>{item.subtotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
                    <button onClick={() => removeItem(g.id, item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: 2 }}><X size={12} /></button>
                  </div>
                ))}
                <button onClick={() => addItem(g.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--gold)' }}>
                  <Plus size={12} /> Añadir concepto
                </button>
              </div>
            ))}
          </div>

          {/* ── Descuento + IVA + Total ───────────────────────────────── */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
              {/* Discount */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--espresso)', marginBottom: 8 }}>Descuento</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="form-input" style={{ width: 120 }} value={discountType ?? ''} onChange={e => setDiscountType(e.target.value as any || null)}>
                    <option value="">Sin descuento</option>
                    <option value="fixed">Fijo (€)</option>
                    <option value="percent">Porcentaje (%)</option>
                  </select>
                  {discountType && (
                    <>
                      <input className="form-input" type="number" min={0} step={0.01} style={{ width: 100 }} value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value))} />
                      <input className="form-input" style={{ flex: 1 }} value={discountLabel} onChange={e => setDiscountLabel(e.target.value)} placeholder="Descripción descuento" />
                    </>
                  )}
                </div>
              </div>
              {/* Tax */}
              <div style={{ minWidth: 200 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--espresso)', marginBottom: 8 }}>IVA</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="form-input" type="number" min={0} max={100} style={{ width: 70 }} value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} />
                  <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>%</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--charcoal)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={taxIncluded} onChange={e => setTaxIncluded(e.target.checked)} /> IVA incluido
                  </label>
                </div>
              </div>
            </div>
            {/* Total summary */}
            <div style={{ borderTop: '2px solid var(--ivory)', paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--charcoal)', marginBottom: 6 }}>
                <span>Subtotal</span>
                <span>{subtotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
              </div>
              {discountType && discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16a34a', marginBottom: 6 }}>
                  <span>Descuento{discountLabel ? ` (${discountLabel})` : ''}</span>
                  <span>-{discountType === 'percent' ? `${discountAmount}%` : discountAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
              )}
              {!taxIncluded && taxRate > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--charcoal)', marginBottom: 6 }}>
                  <span>IVA ({taxRate}%)</span>
                  <span>{((total - subtotal + (discountType === 'fixed' ? discountAmount : discountType === 'percent' ? subtotal * discountAmount / 100 : 0))).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700, color: 'var(--espresso)', paddingTop: 8, borderTop: '1px solid var(--ivory)' }}>
                <span>Total</span>
                <span>{total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
              </div>
            </div>
          </div>

          {/* ── Plan de pagos ─────────────────────────────────────────── */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)' }}>Plan de pagos</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {templates.length > 0 && (
                  <select className="form-input" style={{ width: 200, fontSize: 12 }} defaultValue="" onChange={e => {
                    const t = templates.find(t => t.id === e.target.value)
                    if (t) applyTemplate(t)
                    e.target.value = ''
                  }}>
                    <option value="" disabled>Aplicar plantilla...</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
                <button onClick={addPayment} className="btn btn-ghost btn-sm"><Plus size={12} /> Añadir cuota</button>
              </div>
            </div>
            {paymentPlan.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--warm-gray)', fontSize: 13 }}>
                Sin plan de pagos definido. Aplica una plantilla o añade cuotas manualmente.
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px 80px 30px', gap: 0, padding: '6px 0', fontSize: 10, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--ivory)' }}>
                  <span>Cuota</span><span style={{ textAlign: 'right' }}>Importe</span><span style={{ textAlign: 'center' }}>Fecha</span><span style={{ textAlign: 'center' }}>Estado</span><span />
                </div>
                {paymentPlan.map((p, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px 80px 30px', gap: 0, padding: '8px 0', alignItems: 'center', borderBottom: '1px solid var(--ivory)' }}>
                    <input value={p.label} onChange={e => updatePayment(i, 'label', e.target.value)} className="form-input" style={{ border: 'none', padding: '4px 0', fontSize: 13 }} placeholder="Nombre cuota" />
                    <input type="number" min={0} step={0.01} value={p.amount} onChange={e => updatePayment(i, 'amount', Number(e.target.value))} className="form-input" style={{ border: 'none', padding: '4px', fontSize: 13, textAlign: 'right' }} />
                    <input type="date" value={p.due_date} onChange={e => updatePayment(i, 'due_date', e.target.value)} className="form-input" style={{ border: 'none', padding: '4px', fontSize: 12, textAlign: 'center' }} />
                    <select value={p.status} onChange={e => updatePayment(i, 'status', e.target.value)} className="form-input" style={{ border: 'none', padding: '4px', fontSize: 11 }}>
                      <option value="pending">Pendiente</option>
                      <option value="paid">Pagado</option>
                    </select>
                    <button onClick={() => removePayment(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: 2 }}><X size={12} /></button>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, fontSize: 12, fontWeight: 600, color: Math.abs(paymentTotal - total) < 0.01 ? '#16a34a' : 'var(--rose)' }}>
                  Suma cuotas: {paymentTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} {Math.abs(paymentTotal - total) >= 0.01 && `(diferencia: ${(paymentTotal - total).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })})`}
                </div>
              </>
            )}
          </div>

          {/* ── Mensaje personalizado + validez ───────────────────────── */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Mensaje personalizado (visible para la pareja)</label>
                <textarea className="form-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Hola Laura y Carlos, aquí tenéis vuestro presupuesto detallado..." style={{ resize: 'vertical' }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Válido hasta</label>
                <input className="form-input" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Import modal */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setShowImport(false)}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '70vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 17, color: 'var(--espresso)' }}>Importar desde estructura</div>
              <button onClick={() => setShowImport(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '16px 24px' }}>
              {modalities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--warm-gray)', fontSize: 13 }}>No tienes modalidades configuradas en Estructura.</div>
              ) : modalities.map((m: any) => (
                <div key={m.id} onClick={() => importModality(m)}
                  style={{ padding: '12px 16px', border: '1px solid var(--ivory)', borderRadius: 8, marginBottom: 8, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--ivory)')}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>{m.name}</div>
                  {m.description && <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{m.description}</div>}
                  <div style={{ fontSize: 11, color: 'var(--stone)', marginTop: 4 }}>
                    {m.packages?.length || 0} paquete{m.packages?.length !== 1 ? 's' : ''} · {m.prices?.length || 0} precio{m.prices?.length !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setPreviewOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 700, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)' }}>Vista previa</span>
              <button onClick={() => setPreviewOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 24 }}>
              <iframe
                src={`/presupuesto/${budget.slug}?preview=1`}
                style={{ width: '100%', height: '70vh', border: '1px solid var(--ivory)', borderRadius: 8 }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const S_BADGE: Record<string, string> = {
  draft: 'badge-inactive', sent: 'badge-contacted', viewed: 'badge-active',
  accepted: 'badge-confirmed', expired: 'badge-pending',
}
const S_LABEL: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviado', viewed: 'Visto',
  accepted: 'Aceptado', expired: 'Expirado',
}
```

- [ ] **Step 2: Commit**

```
git add app/budgets/[id]/edit/page.tsx
git commit -m "feat(budgets): add budget editor with line items, import, payment plan, auto-save"
```

---

### Task 6: Public Budget Page

**Files:**
- Create: `app/presupuesto/[slug]/page.tsx`
- Create: `app/presupuesto/[slug]/BudgetView.tsx`
- Create: `app/api/budgets/track/route.ts`

- [ ] **Step 1: Create the server component**

Create `app/presupuesto/[slug]/page.tsx`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import BudgetView from './BudgetView'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return {
    robots: { index: false, follow: false },
  }
}

export default async function BudgetPublicPage({ params, searchParams }: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ preview?: string }>
}) {
  const { slug } = await params
  const { preview } = await searchParams
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )

  const { data: budget } = await supabase
    .from('budgets')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!budget) return notFound()

  // Get venue branding
  const { data: venue } = await supabase
    .from('venue_onboarding')
    .select('name, logo_url, contact_email, contact_phone')
    .eq('user_id', budget.user_id)
    .maybeSingle()

  const { data: branding } = await supabase
    .from('proposal_branding')
    .select('primary_color, logo_url, font_family')
    .eq('user_id', budget.user_id)
    .maybeSingle()

  return (
    <BudgetView
      budget={budget as any}
      venue={venue as any}
      branding={branding as any}
      isPreview={preview === '1'}
    />
  )
}
```

- [ ] **Step 2: Create the client component**

Create `app/presupuesto/[slug]/BudgetView.tsx`:

```typescript
'use client'
import { useEffect } from 'react'
import type { Budget, PaymentInstallment, LineItemGroup } from '@/lib/budget-types'
import { Receipt, Calendar, Users, Clock, CheckCircle, AlertCircle } from 'lucide-react'

type Props = {
  budget: Budget
  venue: { name: string | null; logo_url: string | null; contact_email: string | null; contact_phone: string | null } | null
  branding: { primary_color: string | null; logo_url: string | null; font_family: string | null } | null
  isPreview: boolean
}

export default function BudgetView({ budget, venue, branding, isPreview }: Props) {
  const primaryColor = branding?.primary_color || '#c9963a'
  const logo = branding?.logo_url || venue?.logo_url
  const venueName = venue?.name || 'Venue'

  // Track view
  useEffect(() => {
    if (isPreview) return
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
```

- [ ] **Step 3: Create the tracking API**

Create `app/api/budgets/track/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const slug: string | undefined = body.slug
    if (!slug) return NextResponse.json({ ok: false }, { status: 400 })

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    const now = new Date().toISOString()

    // Fetch current budget
    const { data: budget } = await supabase
      .from('budgets')
      .select('id, status, first_viewed_at')
      .eq('slug', slug)
      .single()

    if (!budget) return NextResponse.json({ ok: false }, { status: 404 })

    const updates: any = {
      last_viewed_at: now,
      open_count: (budget as any).open_count ? (budget as any).open_count + 1 : 1,
    }
    if (!budget.first_viewed_at) updates.first_viewed_at = now
    if (budget.status === 'sent') updates.status = 'viewed'

    await supabase.from('budgets').update(updates).eq('id', budget.id)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[budgets/track]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
```

- [ ] **Step 4: Commit**

```
git add app/presupuesto/ app/api/budgets/
git commit -m "feat(budgets): add public budget page with branding, tracking API"
```

---

### Task 7: Lead Integration — "Crear presupuesto" Quick Action

**Files:**
- Modify: `app/leads/page.tsx`

- [ ] **Step 1: Add "Crear presupuesto" button to QuickActions**

Find the `QuickActions` component in `app/leads/page.tsx`. Locate the existing `onPdfDigital` button/action and add a "Crear presupuesto" button nearby. The exact location is in the QuickActions component — search for `function QuickActions`.

Add a new prop `onBudget` to QuickActions. In the component, add a button:

```typescript
<button className="qa qa-ghost" onClick={() => onBudget(lead)}>
  <Receipt size={11} /> Presupuesto
</button>
```

Where QuickActions is called (in LeadRow), add the handler:

```typescript
onBudget={(lead: any) => router.push(`/budgets/new?lead_id=${lead.id}`)}
```

Import `Receipt` from lucide-react at the top of the file.

- [ ] **Step 2: Commit**

```
git add app/leads/page.tsx
git commit -m "feat(budgets): add 'Crear presupuesto' quick action on lead cards"
```

---

### Task 8: Fix PaymentTemplatesTab Bug

**Files:**
- Modify: `app/budgets/page.tsx`

- [ ] **Step 1: Fix the months_before input rendering in PaymentTemplatesTab**

In the PaymentTemplatesTab in `app/budgets/page.tsx`, there is a broken conditional render:

```typescript
{installments.length > 0 && inst.due_rule === 'months_before' && (
  /* months input handled inline via grid */
  null
)}
```

Remove this block entirely — the months/days input should be part of the grid row. Update each installment row to show a months/days input when relevant:

Replace the installment mapping with:

```typescript
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
```

- [ ] **Step 2: Commit**

```
git add app/budgets/page.tsx
git commit -m "fix(budgets): fix months/days input in payment template editor"
```

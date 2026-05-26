# Stripe Connect Express — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable couples to pay budget installments online via Stripe Connect Express, with 2.5% surcharge to couple + 2.5% deducted from venue, platform absorbs Stripe fees.

**Architecture:** Stripe Connect Express — platform creates connected accounts for venues. Couples pay via Stripe Checkout Sessions with `application_fee_amount`. Stripe splits funds to venue's IBAN automatically. Existing Redsys integration remains only for venue subscription billing.

**Tech Stack:** `stripe` npm package, Next.js API routes, Supabase (PostgreSQL), Stripe Checkout (hosted), Stripe Connect Express onboarding (hosted).

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/stripe.ts` | Stripe client singleton + commission helpers |
| `app/api/stripe/create-account/route.ts` | Create Express connected account + onboarding link |
| `app/api/stripe/account-callback/page.tsx` | Post-onboarding redirect handler (client page) |
| `app/api/stripe/create-checkout/route.ts` | Create Checkout Session for budget installment |
| `app/api/stripe/webhook/route.ts` | Stripe webhook handler (checkout.session.completed, account.updated) |
| `app/api/stripe/account-status/route.ts` | GET venue's Stripe connection status |
| `app/api/stripe/dashboard-link/route.ts` | Generate Express dashboard login link |
| `components/StripeConnectBlock.tsx` | Settings UI block for connecting/disconnecting Stripe |
| `app/presupuesto/[slug]/BudgetView.tsx` | Modify: add Stripe payment flow alongside existing Redsys |
| `app/presupuesto/[slug]/page.tsx` | Modify: pass `stripeConnected` prop to BudgetView |
| `app/perfil/page.tsx` | Modify: add StripeConnectBlock in facturación section |
| `app/onboarding/page.tsx` | Modify: optional Stripe step at end of onboarding |

---

### Task 1: Install Stripe + create lib/stripe.ts

**Files:**
- Create: `lib/stripe.ts`
- Modify: `package.json` (npm install)

- [ ] **Step 1: Install stripe package**

```bash
npm install stripe
```

- [ ] **Step 2: Create lib/stripe.ts**

```typescript
// lib/stripe.ts
// Stripe client singleton + commission calculation helpers for Stripe Connect Express.

import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY not set')
    _stripe = new Stripe(key, { apiVersion: '2025-04-30.basil' })
  }
  return _stripe
}

// ── Commission helpers ─────────────────────────────────────────────

/** Platform takes 5% of base amount (2.5% from couple surcharge + 2.5% from venue) */
const PLATFORM_RATE = 0.05
/** Couple surcharge added on top of installment amount */
const COUPLE_SURCHARGE_RATE = 0.025

export type CheckoutAmounts = {
  /** Original installment amount in EUR (e.g. 1000) */
  baseAmount: number
  /** What couple pays = base × 1.025 */
  chargeAmount: number
  /** Platform application_fee = base × 0.05 (in cents for Stripe) */
  applicationFeeCents: number
  /** Total charge in cents for Stripe */
  chargeAmountCents: number
}

/**
 * Calculate all amounts for a budget installment payment.
 * @param baseAmount Installment amount in EUR (e.g. 1000.00)
 */
export function calculateCheckoutAmounts(baseAmount: number): CheckoutAmounts {
  const chargeAmount = Math.round(baseAmount * (1 + COUPLE_SURCHARGE_RATE) * 100) / 100
  const applicationFee = Math.round(baseAmount * PLATFORM_RATE * 100) / 100
  return {
    baseAmount,
    chargeAmount,
    applicationFeeCents: Math.round(applicationFee * 100),
    chargeAmountCents: Math.round(chargeAmount * 100),
  }
}
```

- [ ] **Step 3: Add env vars to .env.local (placeholder)**

Add to `.env.local`:
```
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

- [ ] **Step 4: Commit**

```bash
git add lib/stripe.ts package.json package-lock.json
git commit -m "feat(stripe): add Stripe client singleton + commission helpers"
```

---

### Task 2: SQL migration — venue_stripe_accounts + budget_payments columns

**Files:**
- Create: `supabase_migrations_stripe_connect.sql`

- [ ] **Step 1: Create migration file**

```sql
-- ──────────────────────────────────────────────────────────────────────────────
-- Stripe Connect Express — venue accounts + budget payment columns
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. New table: venue Stripe connected accounts
CREATE TABLE IF NOT EXISTS public.venue_stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id UUID,
  stripe_account_id TEXT NOT NULL UNIQUE,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One Stripe account per user (for now)
CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_stripe_user
  ON public.venue_stripe_accounts(user_id);

-- RLS: venue owner can read own record
ALTER TABLE public.venue_stripe_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own stripe account"
  ON public.venue_stripe_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access stripe accounts"
  ON public.venue_stripe_accounts FOR ALL
  USING (auth.role() = 'service_role');

-- 2. Extend budget_payments for Stripe
ALTER TABLE public.budget_payments
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'redsys'
    CHECK (payment_provider IN ('redsys', 'stripe'));

CREATE INDEX IF NOT EXISTS idx_budget_payments_stripe_session
  ON public.budget_payments(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
```

- [ ] **Step 2: Commit**

```bash
git add supabase_migrations_stripe_connect.sql
git commit -m "feat(stripe): add SQL migration for venue_stripe_accounts + budget_payments columns"
```

**Note:** User runs this manually in Supabase SQL editor (same pattern as previous migrations).

---

### Task 3: API — Create Express account + onboarding link

**Files:**
- Create: `app/api/stripe/create-account/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/stripe/create-account/route.ts
// POST: Creates a Stripe Express connected account for the venue and returns
// an Account Link URL for the Stripe-hosted onboarding flow.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function getSession() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const svc = getServiceClient()
    const stripe = getStripe()
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || ''

    // Check if user already has a connected account
    const { data: existing } = await svc
      .from('venue_stripe_accounts')
      .select('stripe_account_id, onboarding_complete')
      .eq('user_id', user.id)
      .maybeSingle()

    let accountId: string

    if (existing?.stripe_account_id) {
      // Account exists — maybe onboarding was incomplete, generate new link
      accountId = existing.stripe_account_id
    } else {
      // Create new Express connected account
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'ES',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { user_id: user.id },
      })
      accountId = account.id

      // Store in DB
      await svc.from('venue_stripe_accounts').insert({
        user_id: user.id,
        stripe_account_id: accountId,
        onboarding_complete: false,
        charges_enabled: false,
        payouts_enabled: false,
      })
    }

    // Create Account Link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/perfil?tab=facturacion&stripe=refresh`,
      return_url: `${origin}/perfil?tab=facturacion&stripe=success`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err: any) {
    console.error('[/api/stripe/create-account]', err)
    return NextResponse.json({ error: 'Error al crear cuenta Stripe' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/stripe/create-account/route.ts
git commit -m "feat(stripe): POST /api/stripe/create-account — Express onboarding"
```

---

### Task 4: API — Account status + dashboard link

**Files:**
- Create: `app/api/stripe/account-status/route.ts`
- Create: `app/api/stripe/dashboard-link/route.ts`

- [ ] **Step 1: Create account-status route**

```typescript
// app/api/stripe/account-status/route.ts
// GET: Returns venue's Stripe Connect status for the settings UI.

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getSession() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } },
    )

    const { data } = await supabase
      .from('venue_stripe_accounts')
      .select('stripe_account_id, onboarding_complete, charges_enabled, payouts_enabled, created_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!data) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      onboarding_complete: data.onboarding_complete,
      charges_enabled: data.charges_enabled,
      payouts_enabled: data.payouts_enabled,
      created_at: data.created_at,
    })
  } catch (err: any) {
    console.error('[/api/stripe/account-status]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create dashboard-link route**

```typescript
// app/api/stripe/dashboard-link/route.ts
// POST: Returns a login link to the Stripe Express dashboard for the venue.

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getStripe } from '@/lib/stripe'

async function getSession() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST() {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } },
    )

    const { data } = await supabase
      .from('venue_stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!data?.stripe_account_id) {
      return NextResponse.json({ error: 'No tienes cuenta Stripe conectada' }, { status: 404 })
    }

    const stripe = getStripe()
    const loginLink = await stripe.accounts.createLoginLink(data.stripe_account_id)

    return NextResponse.json({ url: loginLink.url })
  } catch (err: any) {
    console.error('[/api/stripe/dashboard-link]', err)
    return NextResponse.json({ error: 'Error al generar enlace' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/stripe/account-status/route.ts app/api/stripe/dashboard-link/route.ts
git commit -m "feat(stripe): GET account-status + POST dashboard-link routes"
```

---

### Task 5: API — Create Checkout Session for installment payment

**Files:**
- Create: `app/api/stripe/create-checkout/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/stripe/create-checkout/route.ts
// POST: Creates a Stripe Checkout Session for a budget installment payment.
// Public endpoint (no auth) — couples access this from the budget public page.
// Uses Stripe Connect with application_fee to split funds.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStripe, calculateCheckoutAmounts } from '@/lib/stripe'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  try {
    const { slug, installmentIndex } = await req.json()
    if (!slug || installmentIndex == null) {
      return NextResponse.json({ error: 'slug e installmentIndex requeridos' }, { status: 400 })
    }

    const svc = getServiceClient()
    const stripe = getStripe()
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || ''

    // Fetch budget
    const { data: budget, error: budgetError } = await svc
      .from('budgets')
      .select('id, user_id, venue_id, slug, couple_name, payment_plan, total_amount, status')
      .eq('slug', slug)
      .single()

    if (budgetError || !budget) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    if (budget.status === 'expired') {
      return NextResponse.json({ error: 'Presupuesto expirado' }, { status: 400 })
    }

    const plan = (budget.payment_plan || []) as any[]
    if (installmentIndex < 0 || installmentIndex >= plan.length) {
      return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 400 })
    }

    const installment = plan[installmentIndex]
    if (installment.status === 'paid') {
      return NextResponse.json({ error: 'Esta cuota ya está pagada' }, { status: 400 })
    }

    // Check venue has Stripe connected
    const { data: stripeAccount } = await svc
      .from('venue_stripe_accounts')
      .select('stripe_account_id, charges_enabled')
      .eq('user_id', budget.user_id)
      .maybeSingle()

    if (!stripeAccount?.stripe_account_id || !stripeAccount.charges_enabled) {
      return NextResponse.json({ error: 'El venue no tiene pagos online activados' }, { status: 400 })
    }

    // Calculate amounts
    const amounts = calculateCheckoutAmounts(installment.amount)
    if (amounts.chargeAmountCents <= 0) {
      return NextResponse.json({ error: 'Importe inválido' }, { status: 400 })
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: amounts.chargeAmountCents,
          product_data: {
            name: `${installment.label} — ${budget.couple_name}`,
            description: `Cuota de presupuesto (incluye 2,5% de gastos de gestión)`,
          },
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: amounts.applicationFeeCents,
        transfer_data: {
          destination: stripeAccount.stripe_account_id,
        },
      },
      success_url: `${origin}/presupuesto/${budget.slug}?paid=1&cuota=${installmentIndex}`,
      cancel_url: `${origin}/presupuesto/${budget.slug}?cuota=${installmentIndex}`,
      metadata: {
        type: 'budget_installment',
        budget_id: budget.id,
        budget_slug: budget.slug,
        installment_index: String(installmentIndex),
        venue_user_id: budget.user_id,
        base_amount: String(installment.amount),
      },
    })

    // Store pending payment record
    await svc.from('budget_payments').insert({
      budget_id: budget.id,
      installment_index: installmentIndex,
      amount: installment.amount,
      status: 'pending',
      payment_provider: 'stripe',
      stripe_checkout_session_id: session.id,
    })

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      installment: {
        label: installment.label,
        amount: installment.amount,
        chargeAmount: amounts.chargeAmount,
      },
    })
  } catch (err: any) {
    console.error('[/api/stripe/create-checkout]', err)
    return NextResponse.json({ error: 'Error al crear sesión de pago' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/stripe/create-checkout/route.ts
git commit -m "feat(stripe): POST create-checkout — Stripe Checkout Session for installments"
```

---

### Task 6: API — Stripe webhook handler

**Files:**
- Create: `app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Create the webhook route**

```typescript
// app/api/stripe/webhook/route.ts
// POST: Handles Stripe webhook events.
// - checkout.session.completed → mark budget installment as paid
// - account.updated → update venue Stripe account status

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'

// Next.js App Router: must disable body parsing for Stripe signature verification
export const runtime = 'nodejs'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    console.error('[stripe/webhook] Missing stripe-signature header')
    return new NextResponse('Missing signature', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err: any) {
    console.error('[stripe/webhook] Signature verification failed:', err.message)
    return new NextResponse('Invalid signature', { status: 400 })
  }

  const svc = getServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const meta = session.metadata || {}

        if (meta.type !== 'budget_installment') break

        const budgetId = meta.budget_id
        const installmentIndex = parseInt(meta.installment_index, 10)

        if (!budgetId || isNaN(installmentIndex)) {
          console.error('[stripe/webhook] Missing metadata in checkout session', session.id)
          break
        }

        console.log(`[stripe/webhook] checkout.session.completed — budget=${budgetId} installment=${installmentIndex}`)

        // Update budget_payments record
        await svc.from('budget_payments')
          .update({
            status: 'paid',
            stripe_payment_intent_id: typeof session.payment_intent === 'string'
              ? session.payment_intent
              : (session.payment_intent as any)?.id ?? null,
            paid_at: new Date().toISOString(),
          })
          .eq('stripe_checkout_session_id', session.id)

        // Update budget payment_plan installment status
        const { data: budget } = await svc
          .from('budgets')
          .select('payment_plan')
          .eq('id', budgetId)
          .single()

        if (budget?.payment_plan) {
          const plan = [...(budget.payment_plan as any[])]
          if (plan[installmentIndex]) {
            plan[installmentIndex] = {
              ...plan[installmentIndex],
              status: 'paid',
              paid_at: new Date().toISOString(),
            }
            await svc.from('budgets')
              .update({ payment_plan: plan })
              .eq('id', budgetId)
          }
        }

        // Transition budget status to accepted if needed
        await svc.from('budgets')
          .update({ status: 'accepted' })
          .eq('id', budgetId)
          .in('status', ['draft', 'sent', 'viewed'])

        break
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        console.log(`[stripe/webhook] account.updated — ${account.id} charges=${account.charges_enabled} payouts=${account.payouts_enabled}`)

        await svc.from('venue_stripe_accounts')
          .update({
            onboarding_complete: account.details_submitted ?? false,
            charges_enabled: account.charges_enabled ?? false,
            payouts_enabled: account.payouts_enabled ?? false,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_account_id', account.id)

        break
      }

      default:
        // Ignore unhandled events
        break
    }
  } catch (err: any) {
    console.error(`[stripe/webhook] Error processing ${event.type}:`, err)
    // Return 200 anyway — Stripe retries on non-2xx
  }

  return new NextResponse('OK', { status: 200 })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/stripe/webhook/route.ts
git commit -m "feat(stripe): webhook handler — checkout.session.completed + account.updated"
```

---

### Task 7: StripeConnectBlock component for Settings

**Files:**
- Create: `components/StripeConnectBlock.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/StripeConnectBlock.tsx
// Settings UI block: connect/disconnect Stripe Express, view status, open dashboard.
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

    // If returning from Stripe onboarding, refetch status
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('stripe') === 'success' || params.get('stripe') === 'refresh') {
        // Small delay — webhook may not have fired yet
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
```

- [ ] **Step 2: Commit**

```bash
git add components/StripeConnectBlock.tsx
git commit -m "feat(stripe): StripeConnectBlock settings component"
```

---

### Task 8: Add StripeConnectBlock to perfil/settings page

**Files:**
- Modify: `app/perfil/page.tsx`

- [ ] **Step 1: Add import at top of file**

Find the import block at the top of `app/perfil/page.tsx` and add:

```typescript
import StripeConnectBlock from '@/components/StripeConnectBlock'
```

- [ ] **Step 2: Add StripeConnectBlock section in facturación tab**

In `app/perfil/page.tsx`, find the `facturacion` section (around line 1651, after the "Forma de pago" Section closing tag `</Section>`). Insert a new Section block before the closing `</>`:

Find this code:
```tsx
                  <Section title="Forma de pago" description="Método de pago asociado a tu suscripción.">
                    <div style={{ padding: '10px 0', fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.7 }}>
                      Los pagos se gestionan mediante domiciliación bancaria (SEPA) o transferencia.
                      Para actualizar tu método de pago contacta con tu gestor.
                    </div>
                    <a href="mailto:info@foreventos.com?subject=Actualizar%20método%20de%20pago"
                      className="btn btn-ghost btn-sm" style={{ marginTop: 8, textDecoration: 'none' }}>
                      Contactar para actualizar →
                    </a>
                  </Section>
                </>
```

Replace with:
```tsx
                  <Section title="Forma de pago" description="Método de pago asociado a tu suscripción.">
                    <div style={{ padding: '10px 0', fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.7 }}>
                      Los pagos se gestionan mediante domiciliación bancaria (SEPA) o transferencia.
                      Para actualizar tu método de pago contacta con tu gestor.
                    </div>
                    <a href="mailto:info@foreventos.com?subject=Actualizar%20método%20de%20pago"
                      className="btn btn-ghost btn-sm" style={{ marginTop: 8, textDecoration: 'none' }}>
                      Contactar para actualizar →
                    </a>
                  </Section>

                  <Section title="Pagos online de presupuestos" description="Permite a las parejas pagar cuotas de presupuestos con tarjeta.">
                    <StripeConnectBlock />
                  </Section>
                </>
```

- [ ] **Step 3: Commit**

```bash
git add app/perfil/page.tsx
git commit -m "feat(stripe): add StripeConnectBlock to perfil/facturación settings"
```

---

### Task 9: Modify BudgetView — Stripe payment flow for couples

**Files:**
- Modify: `app/presupuesto/[slug]/BudgetView.tsx`
- Modify: `app/presupuesto/[slug]/page.tsx`

- [ ] **Step 1: Add stripeConnected prop to BudgetView**

In `app/presupuesto/[slug]/BudgetView.tsx`, find the Props type (around line 27):

```typescript
type Props = {
  budget: Budget
  venue: VenueInfo | null
  branding: { primary_color: string | null; logo_url: string | null; font_family: string | null } | null
  isPreview: boolean
  hasPassword: boolean
}
```

Replace with:

```typescript
type Props = {
  budget: Budget
  venue: VenueInfo | null
  branding: { primary_color: string | null; logo_url: string | null; font_family: string | null } | null
  isPreview: boolean
  hasPassword: boolean
  stripeConnected?: boolean
}
```

- [ ] **Step 2: Destructure new prop**

Find (around line 36):
```typescript
export default function BudgetView({ budget, venue, branding, isPreview, hasPassword }: Props) {
```

Replace with:
```typescript
export default function BudgetView({ budget, venue, branding, isPreview, hasPassword, stripeConnected }: Props) {
```

- [ ] **Step 3: Replace payInstallment function with Stripe-aware version**

Find the `payInstallment` function (around line 100-135):

```typescript
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
```

Replace with:

```typescript
  const payInstallment = async (index: number) => {
    setPayingIndex(index)
    setPayError(null)
    try {
      if (stripeConnected) {
        // Stripe Checkout flow
        const res = await fetch('/api/stripe/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: budget.slug, installmentIndex: index }),
        })
        const data = await res.json()
        if (!data.success || !data.checkoutUrl) {
          setPayError(index)
          setPayingIndex(null)
          return
        }
        // Redirect to Stripe Checkout
        window.location.href = data.checkoutUrl
      } else {
        // Legacy Redsys flow
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
        const form = formRef.current
        if (!form) return
        form.action = data.formData.redsysUrl
        form.method = 'POST'
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
      }
    } catch {
      setPayError(index)
      setPayingIndex(null)
    }
  }
```

- [ ] **Step 4: Update pay button text to show surcharge when Stripe**

Find the pay button (around line 388-403):

```tsx
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
```

Replace with:

```tsx
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
                            <><CreditCard size={14} /> Pagar {(stripeConnected ? Math.round(p.amount * 1.025 * 100) / 100 : p.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</>}
                        </button>
                        {stripeConnected && !isPaying && (
                          <div style={{ fontSize: 10, color: '#999', textAlign: 'center', marginTop: 4 }}>
                            Incluye 2,5% de gastos de gestión
                          </div>
                        )}
```

- [ ] **Step 5: Pass stripeConnected from page.tsx to BudgetView**

In `app/presupuesto/[slug]/page.tsx`, find the section that queries data (around line 40-51). After the branding query, add a Stripe status check:

Find:
```tsx
  const { data: branding } = await supabase
    .from('proposal_branding')
    .select('primary_color, logo_url, font_family')
    .eq('user_id', budget.user_id)
    .maybeSingle()
```

After it, add:
```tsx
  // Check if venue has Stripe connected for online payments
  const { data: stripeAccount } = await supabase
    .from('venue_stripe_accounts')
    .select('charges_enabled')
    .eq('user_id', budget.user_id)
    .maybeSingle()

  const stripeConnected = !!stripeAccount?.charges_enabled
```

Then find the BudgetView render:
```tsx
    <BudgetView
      budget={safeBudget as any}
      venue={venue as any}
      branding={branding as any}
      isPreview={preview === '1'}
      hasPassword={hasPassword}
    />
```

Replace with:
```tsx
    <BudgetView
      budget={safeBudget as any}
      venue={venue as any}
      branding={branding as any}
      isPreview={preview === '1'}
      hasPassword={hasPassword}
      stripeConnected={stripeConnected}
    />
```

- [ ] **Step 6: Commit**

```bash
git add app/presupuesto/[slug]/BudgetView.tsx app/presupuesto/[slug]/page.tsx
git commit -m "feat(stripe): Stripe Checkout payment flow in BudgetView + stripeConnected prop"
```

---

### Task 10: Optional Stripe step in venue onboarding

**Files:**
- Modify: `app/onboarding/page.tsx`

- [ ] **Step 1: Add Stripe step after existing step 2**

In `app/onboarding/page.tsx`, the current flow has 2 steps (company info → contact details → redirect to dashboard). Add an optional step 3 that offers Stripe connection.

Find the step count / max steps logic. After step 2 completes (the final save that redirects to dashboard), insert an intermediate step that shows before the redirect.

Find the section where step 2 finishes and redirects (the `handleSave` or equivalent function that calls `router.push('/dashboard')`). Modify it to:
1. After step 2 save, set `step(3)` instead of redirecting
2. Step 3 shows: "¿Quieres activar pagos online?" with two buttons:
   - "Activar ahora" → calls `/api/stripe/create-account` and redirects to Stripe onboarding
   - "Más tarde" → redirects to dashboard

Add to the JSX, after the step 2 block:

```tsx
              {step === 3 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <CreditCard size={24} style={{ color: '#b45309' }} />
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 8 }}>¿Quieres activar pagos online?</h2>
                  <p style={{ fontSize: 14, color: 'var(--warm-gray)', lineHeight: 1.6, marginBottom: 24 }}>
                    Permite a las parejas pagar las cuotas de sus presupuestos con tarjeta.
                    Solo necesitas tu IBAN y verificar tu identidad (~5 min).
                  </p>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button
                      onClick={async () => {
                        setSaving(true)
                        try {
                          const res = await fetch('/api/stripe/create-account', { method: 'POST' })
                          const data = await res.json()
                          if (data.url) window.location.href = data.url
                          else router.push(dashboardForRole(accountType))
                        } catch {
                          router.push(dashboardForRole(accountType))
                        }
                      }}
                      disabled={saving}
                      style={{
                        padding: '12px 24px', borderRadius: 10, border: 'none',
                        background: 'var(--gold, #c9963a)', color: '#fff',
                        fontSize: 14, fontWeight: 600, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      {saving ? <><Loader2 size={14} className="animate-spin" /> Conectando...</> : 'Activar ahora'}
                    </button>
                    <button
                      onClick={() => router.push(dashboardForRole(accountType))}
                      style={{
                        padding: '12px 24px', borderRadius: 10,
                        border: '1px solid var(--ivory)', background: 'transparent',
                        color: 'var(--warm-gray)', fontSize: 14, cursor: 'pointer',
                      }}
                    >
                      Más tarde
                    </button>
                  </div>
                </div>
              )}
```

Also add `CreditCard` to the lucide-react imports at the top of the file.

Change the step 2 completion to go to step 3 instead of dashboard redirect:
- Find `router.push(dashboardForRole(accountType))` in the step 2 save handler
- Replace with `setStep(3)`

- [ ] **Step 2: Commit**

```bash
git add app/onboarding/page.tsx
git commit -m "feat(stripe): optional Stripe Connect step in venue onboarding"
```

---

### Task 11: Verify TypeScript compiles + manual test checklist

**Files:** None (verification only)

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit --pretty
```

Expected: no errors.

- [ ] **Step 2: Manual test checklist**

Verify these flows manually:

**Venue Stripe onboarding:**
1. Go to `/perfil?tab=facturacion` → see "Pagos online" section with "Activar" button
2. Click "Activar pagos online" → redirected to Stripe Express onboarding
3. Complete Stripe onboarding → redirected back to settings
4. Settings shows green "Stripe conectado" badge
5. "Ver panel de Stripe" button opens Stripe Express dashboard

**Couple payment (requires Stripe test mode):**
1. Open a budget public page (`/presupuesto/{slug}`) where venue has Stripe connected
2. Payment tab shows "Pagar X€" button with surcharge amount
3. Click pay → redirected to Stripe Checkout
4. Complete payment with test card 4242 4242 4242 4242
5. Redirected back to budget → installment marked as paid

**Webhook verification:**
6. After test payment, verify `budget_payments` row has `payment_provider: 'stripe'`, `status: 'paid'`
7. Verify budget `payment_plan[index].status === 'paid'`
8. Verify budget status transitions to `accepted` (if was draft/sent/viewed)

**Onboarding:**
9. Create new venue account → after step 2, see Stripe offer screen
10. Click "Más tarde" → goes to dashboard
11. Click "Activar ahora" → goes to Stripe onboarding

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(stripe): compilation and integration fixes"
```

---

## Environment Setup Notes

Before testing, the developer must:

1. **Create Stripe account** at https://dashboard.stripe.com
2. **Enable Connect** in Stripe dashboard → Settings → Connect
3. **Get API keys** from dashboard → Developers → API keys
4. **Set up webhook** in dashboard → Developers → Webhooks:
   - Endpoint URL: `https://your-domain.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `account.updated`
   - Copy webhook signing secret
5. **Set env vars** in `.env.local`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```
6. **Run SQL migration** in Supabase SQL editor (`supabase_migrations_stripe_connect.sql`)
7. **For local webhook testing**, use [Stripe CLI](https://stripe.com/docs/stripe-cli):
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

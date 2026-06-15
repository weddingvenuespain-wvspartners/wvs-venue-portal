# Stripe Billing Integration — Design Spec

## Goal

Replace Redsys with Stripe Billing for venue subscription payments. Redsys code stays but is deactivated. Stripe handles checkout, recurring billing, payment method management (Customer Portal), and plan sync from admin.

## Decisions

- **Redsys**: Deactivated, not deleted. Easy revert.
- **Customer Portal**: Stripe-hosted for payment method changes. Our UI kept for cancellation (50-word requirement) and payment history.
- **Plan sync**: Auto-sync from admin to Stripe Products/Prices. No manual Stripe Dashboard work needed.
- **Cancellation**: Our UI with 50 words → API calls Stripe to cancel_at_period_end.

## Architecture

```
Pricing page → POST /api/stripe/create-checkout → Stripe Checkout (hosted)
  → Stripe processes payment
  → POST /api/stripe/webhook (checkout.session.completed) → create venue_subscription
  → Redirect /checkout/success

Perfil > Facturación → "Gestionar pago" → POST /api/stripe/portal-session → Stripe Customer Portal
Perfil > Cancelar (50 words) → POST /api/subscription/cancel → Stripe cancel_at_period_end

Admin > Create/Edit plan → POST /api/stripe/sync-plan → Stripe Products/Prices API
```

## Database Changes

### venue_plans — add columns

| Column | Type | Description |
|--------|------|-------------|
| `stripe_product_id` | TEXT NULL | Stripe Product ID |
| `stripe_price_ids` | JSONB NULL | Map: `{ "yearly": "price_xxx", "monthly": "price_yyy" }` keyed by billing_cycle.id |

### venue_subscriptions — add columns

| Column | Type | Description |
|--------|------|-------------|
| `stripe_customer_id` | TEXT NULL | Stripe Customer ID |
| `stripe_subscription_id` | TEXT NULL | Stripe Subscription ID |

Existing Redsys columns (`redsys_token`, `redsys_cof_txnid`, etc.) stay untouched.

## New Files

### `lib/stripe.ts`

Stripe client singleton + helpers:
- `getStripe()` — returns Stripe instance with secret key
- `getOrCreateCustomer(userId, email, name)` — find or create Stripe Customer, cache customer_id in subscription
- `syncPlanToStripe(plan)` — create/update Product + Prices

### `app/api/stripe/create-checkout/route.ts`

POST. Auth required. Body: `{ planId, cycleId, venueId? }`.

1. Validate plan exists, is active, cycle exists
2. Get or create Stripe Customer for user
3. Look up `stripe_price_ids[cycleId]` from plan
4. Create Checkout Session:
   - `mode: 'subscription'`
   - `line_items: [{ price: priceId, quantity: 1 }]`
   - `subscription_data.trial_period_days` if plan has trial
   - `subscription_data.metadata: { userId, planId, cycleId, venueId }`
   - `success_url: /checkout/success?session_id={CHECKOUT_SESSION_ID}`
   - `cancel_url: /pricing`
5. Return `{ url: session.url }`

### `app/api/stripe/webhook/route.ts`

POST. No auth (Stripe signature verification via `STRIPE_WEBHOOK_SECRET`).

Events handled:

**`checkout.session.completed`**
- Extract metadata (userId, planId, cycleId, venueId)
- Cancel any existing active/trial subscriptions for user+venue
- Create `venue_subscriptions` row: status='active' (or 'trial' if trial_period), stripe_customer_id, stripe_subscription_id
- Insert `venue_payment_history`: event_type='activated'

**`invoice.paid`**
- Find subscription by stripe_subscription_id
- Insert `venue_payment_history`: event_type='payment', amount from invoice

**`invoice.payment_failed`**
- Find subscription
- Insert `venue_payment_history`: event_type='payment_failed'
- Send dunning email via `sendPaymentFailedEmail()`

**`customer.subscription.updated`**
- Sync status changes (trialing → active, etc.)
- Update renewal_date from current_period_end

**`customer.subscription.deleted`**
- Mark subscription as 'cancelled' in venue_subscriptions

### `app/api/stripe/portal-session/route.ts`

POST. Auth required.

1. Find user's active subscription → get stripe_customer_id
2. Create Stripe Billing Portal Session:
   - `customer: stripe_customer_id`
   - `return_url: /profile?section=facturacion`
   - Configuration: allow payment method update. Disable cancellation and plan changes (handled in our UI).
3. Return `{ url: session.url }`

### `app/api/stripe/sync-plan/route.ts`

POST. Admin only. Body: `{ planId }`.

1. Fetch plan from venue_plans
2. If no `stripe_product_id`:
   - `stripe.products.create({ name, metadata: { plan_id } })`
   - Save stripe_product_id to venue_plans
3. For each billing_cycle in plan:
   - If no price_id for this cycle in stripe_price_ids:
     - `stripe.prices.create({ product, unit_amount: price*100, currency: 'eur', recurring: { interval, interval_count } })`
     - Save price_id to stripe_price_ids
   - If price changed (compare with existing):
     - Create new Price, deactivate old one
     - Update stripe_price_ids
4. If plan.is_active === false:
   - `stripe.products.update(id, { active: false })`

## Modified Files

### `app/pricing/page.tsx`

- Replace Redsys form submission with: POST `/api/stripe/create-checkout` → redirect to `session.url`
- Remove Redsys hidden form auto-submit
- Keep plan display, cycle toggle, multi-venue selector unchanged

### `app/api/subscription/cancel/route.ts`

- After marking cancelled in Supabase, also call:
  `stripe.subscriptions.update(stripe_subscription_id, { cancel_at_period_end: true })`
- Only if stripe_subscription_id exists (backward compat with old Redsys subs)

### `app/profile/page.tsx`

- Replace IBAN form section with "Gestionar método de pago" button → calls portal-session API → redirects
- Keep payment history, invoice buttons, cancellation modal unchanged

### `app/admin/page.tsx`

- After creating/editing plan, call `/api/stripe/sync-plan` to push to Stripe
- Show stripe_product_id as read-only badge on plan card (visual confirmation of sync)

### `app/checkout/success/page.tsx` (if exists)

- Update to handle Stripe session_id parameter instead of Redsys order
- Verify session status via Stripe API as fallback if webhook hasn't fired

## Redsys Deactivation

Files to deactivate (comment out route handlers, keep code):
- `app/api/redsys/create-payment/route.ts` — return 410 Gone
- `app/api/redsys/notification/route.ts` — return 410 Gone  
- `app/api/redsys/activate-from-success/route.ts` — return 410 Gone
- `lib/redsys.ts` — keep file, no changes needed

## Trial Flow

1. Plan has `trial_days > 0`
2. Checkout Session created with `subscription_data.trial_period_days`
3. Stripe creates subscription with status='trialing'
4. Webhook `checkout.session.completed`: create venue_subscriptions with status='trial', trial_end_date
5. When trial ends: Stripe auto-charges → webhook `invoice.paid` or `invoice.payment_failed`
6. Webhook `customer.subscription.updated`: update status trial → active

## Environment Variables

```
STRIPE_SECRET_KEY=sk_live_... (or sk_test_... for dev)
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... (or pk_test_... for dev)
```

## Customer Portal Configuration

Done once in Stripe Dashboard (Settings > Customer Portal):
- Payment method update: ENABLED
- Invoice history: ENABLED  
- Subscription cancellation: DISABLED (our UI handles this)
- Plan changes: DISABLED (future: enable for upgrade/downgrade)
- Branding: FOREVENTOS logo + colors (#4A6B52)

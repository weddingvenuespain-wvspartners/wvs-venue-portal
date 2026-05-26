# Stripe Connect Express — Pagos de presupuestos

## Goal

Allow couples to pay budget installments online via Stripe. Each venue connects a Stripe Express account. Platform collects a 5% total commission (2.5% from couple surcharge + 2.5% from venue). Money flows directly from Stripe to venue's bank — never through platform's bank account.

## Architecture

**Stripe Connect Express** — platform creates connected accounts for venues. Couples pay via Stripe Checkout. Stripe splits funds automatically.

**Redsys** remains solely for venue subscription billing. Budget payments migrate 100% to Stripe Connect.

## Venue Onboarding

### Flow

1. Venue clicks "Activar pagos online" (available during initial onboarding + Settings anytime)
2. Platform calls `POST /api/stripe/create-account-link` → creates Express connected account + onboarding link
3. Venue redirected to Stripe-hosted onboarding page (~5 min):
   - Business name / autónomo info
   - DNI/NIF of legal representative
   - IBAN for payouts
   - Accept Stripe terms
4. Stripe redirects back to platform callback URL
5. Platform verifies account status via `account.updated` webhook
6. `venue_stripe_accounts` record saved with `onboarding_complete = true`

### Stripe Express Account Details

- **Type:** `express` (Stripe hosts dashboard for venue)
- **Country:** `ES` (Spain) — default, could support others later
- **Capabilities:** `card_payments`, `transfers`
- **Payout schedule:** Stripe default (2-3 business days, automatic)
- Venue gets mini-dashboard hosted by Stripe (view payments, change IBAN, see payouts)

### Settings UI

- Block in venue Settings: "Pagos online"
- States:
  - **Not connected:** Button "Activar pagos online" → starts onboarding
  - **Pending verification:** Yellow badge "Verificación pendiente" + link to complete
  - **Connected:** Green badge "Stripe conectado" + link to Stripe Express dashboard + "Desconectar" option
- During initial platform onboarding: optional step "¿Quieres activar pagos online?" with same flow

## Couple Payment Flow

### Trigger

Budget public page (`/presupuesto/[slug]`) — installment with status `pending` shows "Pagar" button **only if venue has Stripe connected** (`onboarding_complete = true`).

If venue has no Stripe: no payment button. Couple sees manual payment info (bank transfer details in budget notes).

### Checkout Flow

1. Couple clicks "Pagar X€" on pending installment
2. Frontend calls `POST /api/stripe/create-checkout`
   - Params: `slug`, `installmentIndex`
   - Server calculates:
     - `base_amount` = installment amount
     - `couple_surcharge` = base_amount × 0.025 (2.5%)
     - `total_charge` = base_amount + couple_surcharge
     - `application_fee` = base_amount × 0.05 (5% of base = platform's 2.5% + venue's 2.5%)
   - Creates Stripe Checkout Session:
     - `mode: 'payment'`
     - `line_items`: one item showing installment + surcharge
     - `payment_intent_data.application_fee_amount`: application_fee (in cents)
     - `payment_intent_data.transfer_data.destination`: venue's stripe_account_id
   - Returns `checkout_session.url`
3. Frontend redirects to Stripe Checkout
4. Couple pays (card, Google Pay, Apple Pay)
5. Success → redirect to `/presupuesto/{slug}?paid=1&cuota={index}`
6. Error → redirect to `/presupuesto/{slug}?error=1&cuota={index}`

### Webhook Confirmation

- Endpoint: `POST /api/stripe/webhook`
- Event: `checkout.session.completed`
- Actions:
  - Find `budget_payments` record by `stripe_checkout_session_id`
  - Update status to `paid`, save `stripe_payment_intent_id`, `paid_at`
  - Update budget's `payment_plan[index].status` to `paid`
  - If all installments paid → auto-transition budget status to `accepted`

## Commission Model

| Concept | Calculation (1.000€ installment) |
|---------|----------------------------------|
| Couple pays | 1.025€ (installment + 2.5%) |
| Venue receives | 975€ (installment - 2.5%) |
| Platform gross | 50€ (application_fee) |
| Stripe fee (~1.4% + 0.25€) | ~14.60€ (absorbed by platform) |
| Platform net | ~35.40€ |

- Stripe fee comes out of platform's `application_fee`, not venue's payout
- Venue always receives exactly `installment × 0.975`
- Couple always pays exactly `installment × 1.025`

### Commission with WP/organizer markup

When a budget has commission_mode = 'neto' with a wedding planner commission:
- Base installment amount already includes WP markup (applied at save time)
- The 2.5%/2.5% Stripe surcharge applies on top of the marked-up amount
- WP commission tracking is separate from Stripe commission

## Database Changes

### New table: `venue_stripe_accounts`

```sql
CREATE TABLE public.venue_stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  stripe_account_id TEXT NOT NULL UNIQUE,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_venue_stripe_user ON venue_stripe_accounts(user_id);
```

### Alter `budget_payments`

```sql
ALTER TABLE public.budget_payments
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'redsys'
    CHECK (payment_provider IN ('redsys', 'stripe'));

CREATE INDEX IF NOT EXISTS idx_budget_payments_stripe_session
  ON public.budget_payments(stripe_checkout_session_id);
```

## API Routes

### `POST /api/stripe/create-account` (authenticated, venue owner)
- Creates Stripe Express connected account
- Returns account link URL for onboarding

### `POST /api/stripe/account-callback` (or GET redirect handler)
- Stripe redirects here after onboarding
- Checks account status, updates `venue_stripe_accounts`

### `POST /api/stripe/create-checkout` (public, no auth needed)
- Params: `slug`, `installmentIndex`
- Validates budget exists, installment pending, venue has Stripe
- Creates Checkout Session with application_fee + transfer_data
- Returns checkout URL

### `POST /api/stripe/webhook` (Stripe webhook, signature verified)
- Handles: `checkout.session.completed`, `account.updated`
- Updates payment status, budget status

### `GET /api/stripe/account-status` (authenticated, venue owner)
- Returns venue's Stripe connection status for Settings UI

### `POST /api/stripe/create-dashboard-link` (authenticated, venue owner)
- Returns Stripe Express dashboard login link for venue

## Environment Variables

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_CLIENT_ID=ca_...  (if using OAuth, may not be needed for Express)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

## Files to Create/Modify

### New files:
- `lib/stripe.ts` — Stripe client singleton + helpers
- `app/api/stripe/create-account/route.ts` — Create Express account + onboarding link
- `app/api/stripe/account-callback/route.ts` — Post-onboarding redirect handler
- `app/api/stripe/create-checkout/route.ts` — Create Checkout Session for installment
- `app/api/stripe/webhook/route.ts` — Stripe webhook handler
- `app/api/stripe/account-status/route.ts` — Check venue Stripe status
- `app/api/stripe/create-dashboard-link/route.ts` — Express dashboard link
- `components/StripeConnectBlock.tsx` — Settings UI block

### Modified files:
- `app/presupuesto/[slug]/BudgetView.tsx` — Add "Pagar" button when Stripe available
- `app/settings/page.tsx` (or equivalent) — Add StripeConnectBlock
- Venue onboarding flow — Add optional Stripe step

## Security

- Webhook signature verification via `stripe.webhooks.constructEvent()`
- Checkout sessions created server-side only (no client-side amount manipulation)
- `stripe_account_id` never exposed to couples
- Installment amount validated against DB before creating checkout

## NPM Dependency

```
npm install stripe
```

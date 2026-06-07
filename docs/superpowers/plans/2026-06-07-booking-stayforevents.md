# Booking StayForEvents — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build booking.stayforevents.com — a group hotel booking platform for weddings/events with Stripe payments, admin panel, rooming lists, and multi-language support.

**Architecture:** Next.js 15 App Router with route groups `(admin)` and `(booking)`. Supabase for PostgreSQL, Auth (admin only), and Storage. Stripe for all payment scenarios (full, partial, guarantee). Resend + React Email for transactional emails.

**Tech Stack:** Next.js 15, Supabase, Stripe, Resend, React Email, next-intl, Tailwind CSS, shadcn/ui, zod, @react-pdf/renderer, exceljs

---

## File Structure

```
booking-stayforevents/
├── app/
│   ├── (admin)/
│   │   ├── layout.tsx                    — Admin shell: sidebar + topbar + auth gate
│   │   ├── login/page.tsx                — Admin login page
│   │   ├── dashboard/page.tsx            — Dashboard overview
│   │   ├── events/
│   │   │   ├── page.tsx                  — Events list
│   │   │   ├── new/page.tsx              — Create event form
│   │   │   └── [eventId]/
│   │   │       ├── page.tsx              — Edit event
│   │   │       └── hotels/
│   │   │           ├── page.tsx          — Hotels list for event
│   │   │           ├── new/page.tsx      — Create hotel
│   │   │           └── [hotelId]/
│   │   │               ├── page.tsx      — Edit hotel (rooms, pricing, conditions)
│   │   │               └── rooms/
│   │   │                   ├── page.tsx  — Room types list
│   │   │                   └── [roomTypeId]/page.tsx — Edit room type + pricing
│   │   ├── bookings/
│   │   │   ├── page.tsx                  — All bookings table
│   │   │   └── [bookingId]/page.tsx      — Booking detail + actions
│   │   ├── rooming-list/page.tsx         — Rooming list + export
│   │   ├── payments/page.tsx             — Payment management
│   │   ├── waitlist/page.tsx             — Waitlist management
│   │   ├── communications/page.tsx       — Mass emails
│   │   ├── statistics/page.tsx           — Stats + charts
│   │   └── audit-log/page.tsx            — Audit history
│   │
│   ├── (booking)/
│   │   ├── layout.tsx                    — Public layout: header (logo, lang selector)
│   │   └── [eventSlug]/[hotelSlug]/
│   │       ├── page.tsx                  — Step 1: Hotel info + room selection + dates
│   │       ├── details/page.tsx          — Step 2: Guest details form
│   │       ├── payment/page.tsx          — Step 3: Summary + Stripe payment
│   │       ├── confirmation/page.tsx     — Booking confirmation
│   │       └── waitlist/page.tsx         — Waitlist signup
│   │
│   ├── api/
│   │   ├── webhooks/stripe/route.ts      — Stripe webhook handler
│   │   ├── exports/pdf/route.ts          — Generate PDF rooming list
│   │   ├── exports/excel/route.ts        — Generate Excel rooming list
│   │   └── cron/payments/route.ts        — Daily cron: auto-charge due payments
│   │
│   ├── layout.tsx                        — Root layout
│   ├── globals.css                       — Tailwind globals
│   └── not-found.tsx                     — 404
│
├── components/
│   ├── admin/
│   │   ├── sidebar.tsx                   — Admin navigation sidebar
│   │   ├── topbar.tsx                    — Admin topbar with notifications bell
│   │   ├── event-form.tsx                — Event create/edit form
│   │   ├── hotel-form.tsx                — Hotel create/edit form
│   │   ├── room-type-form.tsx            — Room type form with pricing calendar
│   │   ├── booking-table.tsx             — Bookings data table
│   │   ├── booking-detail.tsx            — Booking detail view
│   │   ├── payment-actions.tsx           — Charge/refund action buttons
│   │   ├── rooming-list-table.tsx        — Rooming list display
│   │   ├── stats-charts.tsx              — Statistics charts
│   │   └── notifications-dropdown.tsx    — In-app notifications
│   │
│   ├── booking/
│   │   ├── hotel-gallery.tsx             — Photo carousel
│   │   ├── room-card.tsx                 — Room type card with pricing
│   │   ├── date-picker.tsx               — Check-in/out date picker
│   │   ├── guest-form.tsx                — Guest details form
│   │   ├── booking-summary.tsx           — Reservation summary
│   │   ├── stripe-payment-form.tsx       — Stripe Elements wrapper
│   │   └── language-selector.tsx         — Language switcher
│   │
│   └── ui/                               — shadcn/ui components (auto-generated)
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     — Browser Supabase client
│   │   ├── server.ts                     — Server Supabase client
│   │   └── admin.ts                      — Service-role Supabase client
│   ├── stripe/
│   │   ├── client.ts                     — Stripe instance
│   │   ├── payments.ts                   — Payment Intent/Setup Intent helpers
│   │   └── webhooks.ts                   — Webhook event handlers
│   ├── email/
│   │   ├── send.ts                       — Resend send helper
│   │   └── templates/                    — React Email templates
│   │       ├── booking-confirmation.tsx
│   │       ├── payment-receipt.tsx
│   │       ├── payment-failed.tsx
│   │       ├── payment-reminder.tsx
│   │       ├── booking-cancelled.tsx
│   │       ├── group-activated.tsx
│   │       ├── group-cancelled.tsx
│   │       └── waitlist-available.tsx
│   ├── availability.ts                   — Room availability calculation
│   ├── pricing.ts                        — Price calculation helpers
│   ├── exports/
│   │   ├── pdf.tsx                       — PDF generation with react-pdf
│   │   └── excel.ts                      — Excel generation with exceljs
│   ├── validators/
│   │   ├── booking.ts                    — Booking zod schemas
│   │   ├── event.ts                      — Event zod schemas
│   │   ├── hotel.ts                      — Hotel zod schemas
│   │   └── room.ts                       — Room type zod schemas
│   ├── actions/
│   │   ├── events.ts                     — Event Server Actions
│   │   ├── hotels.ts                     — Hotel Server Actions
│   │   ├── rooms.ts                      — Room type Server Actions
│   │   ├── bookings.ts                   — Booking Server Actions
│   │   ├── payments.ts                   — Payment Server Actions
│   │   ├── waitlist.ts                   — Waitlist Server Actions
│   │   └── communications.ts            — Email Server Actions
│   ├── audit.ts                          — Audit log helper
│   └── types.ts                          — Shared TypeScript types
│
├── messages/                             — i18n translation files
│   ├── es.json
│   ├── en.json
│   ├── fr.json
│   ├── pt.json
│   ├── de.json
│   ├── ro.json
│   ├── nl.json
│   ├── it.json
│   └── ru.json
│
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql        — All tables, enums, indexes
│       └── 002_rls_policies.sql          — Row-level security policies
│
├── middleware.ts                          — Auth + noindex + rate limiting
├── next.config.ts                        — Next.js config with i18n plugin
├── tailwind.config.ts
├── package.json
├── .env.local.example                    — Environment variables template
└── vercel.json                           — Vercel cron config
```

---

## Phase 1: Project Setup + Database

### Task 1: Initialize Next.js project

**Files:**
- Create: `booking-stayforevents/package.json`
- Create: `booking-stayforevents/next.config.ts`
- Create: `booking-stayforevents/tailwind.config.ts`
- Create: `booking-stayforevents/.env.local.example`

- [ ] **Step 1: Create Next.js 15 project**

```bash
cd "C:\Users\Guillermo\OneDrive\Escritorio"
npx create-next-app@latest booking-stayforevents --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --turbopack
```

Expected: Project created at `C:\Users\Guillermo\OneDrive\Escritorio\booking-stayforevents`

- [ ] **Step 2: Install dependencies**

```bash
cd "C:\Users\Guillermo\OneDrive\Escritorio\booking-stayforevents"
npm install @supabase/supabase-js @supabase/ssr stripe @stripe/stripe-js @stripe/react-stripe-js resend @react-email/components react-email next-intl zod @react-pdf/renderer exceljs date-fns lucide-react
npm install -D supabase @types/node
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button card input label select textarea table dialog sheet dropdown-menu badge calendar tabs toast separator avatar
```

- [ ] **Step 4: Create environment variables template**

Create `.env.local.example`:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend
RESEND_API_KEY=re_...

# App
NEXT_PUBLIC_APP_URL=https://booking.stayforevents.com
CRON_SECRET=your-cron-secret
```

- [ ] **Step 5: Commit**

```bash
git init
git add -A
git commit -m "feat: initialize Next.js 15 project with dependencies"
```

---

### Task 2: Supabase setup + database schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `supabase/migrations/002_rls_policies.sql`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/admin.ts`

- [ ] **Step 1: Initialize Supabase**

```bash
npx supabase init
```

- [ ] **Step 2: Create initial schema migration**

Create `supabase/migrations/001_initial_schema.sql`:
```sql
-- Enums
CREATE TYPE event_status AS ENUM ('active', 'archived');
CREATE TYPE payment_scenario AS ENUM ('full_upfront', 'partial', 'guarantee', 'partial_guarantee');
CREATE TYPE booking_payment_status AS ENUM ('pending', 'partial', 'paid', 'refunded', 'guaranteed');
CREATE TYPE booking_status AS ENUM ('confirmed', 'guaranteed', 'cancelled', 'charged');
CREATE TYPE payment_status AS ENUM ('succeeded', 'pending', 'failed');
CREATE TYPE refund_status AS ENUM ('none', 'partial', 'full');
CREATE TYPE waitlist_status AS ENUM ('waiting', 'notified', 'converted', 'expired');
CREATE TYPE export_type AS ENUM ('pdf', 'excel');

-- Events
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  event_date DATE NOT NULL,
  couple_names TEXT NOT NULL,
  description TEXT,
  status event_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_slug ON events(slug);
CREATE INDEX idx_events_status ON events(status);

-- Hotels
CREATE TABLE hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  address TEXT,
  check_in_from DATE NOT NULL,
  check_out_until DATE NOT NULL,
  photos TEXT[] DEFAULT '{}',
  group_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, slug)
);

CREATE INDEX idx_hotels_event_id ON hotels(event_id);

-- Room Types
CREATE TABLE room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  capacity INT NOT NULL DEFAULT 2,
  inventory INT NOT NULL DEFAULT 0,
  rack_rate DECIMAL(10,2),
  meal_plan TEXT DEFAULT 'solo alojamiento',
  photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_room_types_hotel_id ON room_types(hotel_id);

-- Room Pricing (per date)
CREATE TABLE room_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  price_per_night DECIMAL(10,2) NOT NULL,
  UNIQUE(room_type_id, date)
);

CREATE INDEX idx_room_pricing_room_type_date ON room_pricing(room_type_id, date);

-- Payment Conditions
CREATE TABLE payment_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  installment_number INT NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  due_date DATE NOT NULL,
  description TEXT
);

CREATE INDEX idx_payment_conditions_hotel_id ON payment_conditions(hotel_id);

-- Cancellation Policies
CREATE TABLE cancellation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rules JSONB NOT NULL DEFAULT '[]',
  description TEXT
);

-- Hotel Conditions (group activation)
CREATE TABLE hotel_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID UNIQUE NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  min_bookings INT DEFAULT 0,
  guarantee_deadline DATE,
  charge_date DATE,
  is_activated BOOLEAN NOT NULL DEFAULT false,
  payment_scenario payment_scenario NOT NULL DEFAULT 'full_upfront'
);

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  guest_dni TEXT,
  guest_nationality TEXT,
  special_requests TEXT,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_status booking_payment_status NOT NULL DEFAULT 'pending',
  status booking_status NOT NULL DEFAULT 'confirmed',
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  confirmation_email_sent BOOLEAN NOT NULL DEFAULT false,
  confirmation_email_sent_at TIMESTAMPTZ,
  admin_notes TEXT,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  refund_amount DECIMAL(10,2) DEFAULT 0,
  refund_status refund_status NOT NULL DEFAULT 'none',
  booking_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_hotel_id ON bookings(hotel_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_guest_email ON bookings(guest_email);

-- Booking Rooms
CREATE TABLE booking_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  adults INT NOT NULL DEFAULT 2,
  children INT NOT NULL DEFAULT 0,
  price_total DECIMAL(10,2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_booking_rooms_booking_id ON booking_rooms(booking_id);
CREATE INDEX idx_booking_rooms_room_type_id ON booking_rooms(room_type_id);
CREATE INDEX idx_booking_rooms_dates ON booking_rooms(room_type_id, check_in, check_out);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  stripe_payment_intent_id TEXT,
  status payment_status NOT NULL DEFAULT 'pending',
  installment_number INT,
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_payments_booking_id ON payments(booking_id);

-- Booking Modifications
CREATE TABLE booking_modifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  field_changed TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  price_difference DECIMAL(10,2) DEFAULT 0,
  modified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Waitlist
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  room_type_id UUID REFERENCES room_types(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  requested_check_in DATE,
  requested_check_out DATE,
  status waitlist_status NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_waitlist_hotel_id ON waitlist(hotel_id);
CREATE INDEX idx_waitlist_status ON waitlist(status);

-- Exports
CREATE TABLE exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  hotel_id UUID REFERENCES hotels(id) ON DELETE SET NULL,
  type export_type NOT NULL,
  file_url TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- Notifications (in-app)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(admin_user_id, read) WHERE read = false;
```

- [ ] **Step 3: Create RLS policies**

Create `supabase/migrations/002_rls_policies.sql`:
```sql
-- Enable RLS on all tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Public read for booking flow (events + hotels + room_types + room_pricing + conditions)
CREATE POLICY "Public can read active events"
  ON events FOR SELECT
  USING (status = 'active');

CREATE POLICY "Public can read hotels of active events"
  ON hotels FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE status = 'active'));

CREATE POLICY "Public can read room types"
  ON room_types FOR SELECT
  USING (hotel_id IN (SELECT id FROM hotels WHERE event_id IN (SELECT id FROM events WHERE status = 'active')));

CREATE POLICY "Public can read room pricing"
  ON room_pricing FOR SELECT
  USING (room_type_id IN (SELECT id FROM room_types WHERE hotel_id IN (SELECT id FROM hotels WHERE event_id IN (SELECT id FROM events WHERE status = 'active'))));

CREATE POLICY "Public can read payment conditions"
  ON payment_conditions FOR SELECT
  USING (hotel_id IN (SELECT id FROM hotels WHERE event_id IN (SELECT id FROM events WHERE status = 'active')));

CREATE POLICY "Public can read cancellation policies"
  ON cancellation_policies FOR SELECT
  USING (hotel_id IN (SELECT id FROM hotels WHERE event_id IN (SELECT id FROM events WHERE status = 'active')));

CREATE POLICY "Public can read hotel conditions"
  ON hotel_conditions FOR SELECT
  USING (hotel_id IN (SELECT id FROM hotels WHERE event_id IN (SELECT id FROM events WHERE status = 'active')));

-- Public can insert bookings and booking_rooms (via anon key, validated server-side)
CREATE POLICY "Public can insert bookings"
  ON bookings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can insert booking rooms"
  ON booking_rooms FOR INSERT
  WITH CHECK (true);

-- Public can insert waitlist
CREATE POLICY "Public can insert waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (true);

-- Admin full access (via service_role key, bypasses RLS)
-- All admin operations use supabase admin client (service_role) which bypasses RLS
```

- [ ] **Step 4: Create Supabase client files**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  )
}
```

Create `lib/supabase/admin.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Supabase schema, migrations, and client setup"
```

---

### Task 3: Middleware (auth + noindex + rate limiting)

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create middleware**

Create `middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const rateLimitMap = new Map<string, { count: number; timestamp: number }>()
const RATE_LIMIT_WINDOW = 60_000 // 1 minute
const RATE_LIMIT_MAX = 30 // 30 requests per minute for public endpoints

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now - entry.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, timestamp: now })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  let response = NextResponse.next({ request })

  // noindex for all booking pages
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  // Rate limiting for public booking endpoints
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/webhooks')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
    if (rateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
  }

  // Admin auth check
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add middleware with auth, noindex, and rate limiting"
```

---

### Task 4: TypeScript types + Zod validators

**Files:**
- Create: `lib/types.ts`
- Create: `lib/validators/event.ts`
- Create: `lib/validators/hotel.ts`
- Create: `lib/validators/room.ts`
- Create: `lib/validators/booking.ts`

- [ ] **Step 1: Create shared types**

Create `lib/types.ts`:
```typescript
export type EventStatus = 'active' | 'archived'
export type PaymentScenario = 'full_upfront' | 'partial' | 'guarantee' | 'partial_guarantee'
export type BookingPaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded' | 'guaranteed'
export type BookingStatus = 'confirmed' | 'guaranteed' | 'cancelled' | 'charged'
export type PaymentStatus = 'succeeded' | 'pending' | 'failed'
export type RefundStatus = 'none' | 'partial' | 'full'
export type WaitlistStatus = 'waiting' | 'notified' | 'converted' | 'expired'
export type ExportType = 'pdf' | 'excel'

export interface Event {
  id: string
  name: string
  slug: string
  event_date: string
  couple_names: string
  description: string | null
  status: EventStatus
  created_at: string
}

export interface Hotel {
  id: string
  event_id: string
  name: string
  slug: string
  description: string | null
  address: string | null
  check_in_from: string
  check_out_until: string
  photos: string[]
  group_reference: string | null
  created_at: string
}

export interface RoomType {
  id: string
  hotel_id: string
  name: string
  description: string | null
  capacity: number
  inventory: number
  rack_rate: number | null
  meal_plan: string
  photos: string[]
  created_at: string
}

export interface RoomPricing {
  id: string
  room_type_id: string
  date: string
  price_per_night: number
}

export interface PaymentCondition {
  id: string
  hotel_id: string
  installment_number: number
  percentage: number
  due_date: string
  description: string | null
}

export interface CancellationPolicy {
  id: string
  hotel_id: string
  name: string
  rules: { before_days: number; refund_percent: number }[]
  description: string | null
}

export interface HotelConditions {
  id: string
  hotel_id: string
  min_bookings: number
  guarantee_deadline: string | null
  charge_date: string | null
  is_activated: boolean
  payment_scenario: PaymentScenario
}

export interface Booking {
  id: string
  hotel_id: string
  guest_name: string
  guest_email: string
  guest_phone: string
  guest_dni: string | null
  guest_nationality: string | null
  special_requests: string | null
  total_amount: number
  amount_paid: number
  payment_status: BookingPaymentStatus
  status: BookingStatus
  stripe_customer_id: string | null
  stripe_payment_method_id: string | null
  confirmation_email_sent: boolean
  confirmation_email_sent_at: string | null
  admin_notes: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  refund_amount: number
  refund_status: RefundStatus
  booking_date: string
  created_at: string
}

export interface BookingRoom {
  id: string
  booking_id: string
  room_type_id: string
  check_in: string
  check_out: string
  adults: number
  children: number
  price_total: number
}

export interface Payment {
  id: string
  booking_id: string
  amount: number
  stripe_payment_intent_id: string | null
  status: PaymentStatus
  installment_number: number | null
  paid_at: string | null
}

export interface BookingModification {
  id: string
  booking_id: string
  field_changed: string
  old_value: unknown
  new_value: unknown
  price_difference: number
  modified_at: string
}

export interface WaitlistEntry {
  id: string
  hotel_id: string
  room_type_id: string | null
  guest_name: string
  guest_email: string
  guest_phone: string | null
  requested_check_in: string | null
  requested_check_out: string | null
  status: WaitlistStatus
  created_at: string
}

export interface AuditLogEntry {
  id: string
  admin_user_id: string
  action: string
  entity_type: string
  entity_id: string | null
  details: unknown
  created_at: string
}

export interface Notification {
  id: string
  admin_user_id: string
  title: string
  message: string
  type: string
  entity_type: string | null
  entity_id: string | null
  read: boolean
  created_at: string
}
```

- [ ] **Step 2: Create validators**

Create `lib/validators/event.ts`:
```typescript
import { z } from 'zod'

export const createEventSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  event_date: z.string().min(1, 'Fecha requerida'),
  couple_names: z.string().min(1, 'Nombres de la pareja requeridos'),
  description: z.string().optional(),
})

export const updateEventSchema = createEventSchema.partial()

export type CreateEventInput = z.infer<typeof createEventSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
```

Create `lib/validators/hotel.ts`:
```typescript
import { z } from 'zod'

export const createHotelSchema = z.object({
  event_id: z.string().uuid(),
  name: z.string().min(1, 'Nombre requerido').max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  description: z.string().optional(),
  address: z.string().optional(),
  check_in_from: z.string().min(1, 'Fecha inicio requerida'),
  check_out_until: z.string().min(1, 'Fecha fin requerida'),
  group_reference: z.string().optional(),
  payment_scenario: z.enum(['full_upfront', 'partial', 'guarantee', 'partial_guarantee']),
  min_bookings: z.number().int().min(0).optional(),
  guarantee_deadline: z.string().optional(),
  charge_date: z.string().optional(),
})

export const updateHotelSchema = createHotelSchema.partial().omit({ event_id: true })

export type CreateHotelInput = z.infer<typeof createHotelSchema>
export type UpdateHotelInput = z.infer<typeof updateHotelSchema>
```

Create `lib/validators/room.ts`:
```typescript
import { z } from 'zod'

export const createRoomTypeSchema = z.object({
  hotel_id: z.string().uuid(),
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  capacity: z.number().int().min(1),
  inventory: z.number().int().min(0),
  rack_rate: z.number().min(0).optional(),
  meal_plan: z.string().default('solo alojamiento'),
})

export const updateRoomTypeSchema = createRoomTypeSchema.partial().omit({ hotel_id: true })

export const roomPricingSchema = z.object({
  room_type_id: z.string().uuid(),
  prices: z.array(z.object({
    date: z.string(),
    price_per_night: z.number().min(0),
  })),
})

export type CreateRoomTypeInput = z.infer<typeof createRoomTypeSchema>
export type UpdateRoomTypeInput = z.infer<typeof updateRoomTypeSchema>
export type RoomPricingInput = z.infer<typeof roomPricingSchema>
```

Create `lib/validators/booking.ts`:
```typescript
import { z } from 'zod'

export const createBookingSchema = z.object({
  hotel_id: z.string().uuid(),
  guest_name: z.string().min(1, 'Nombre requerido'),
  guest_email: z.string().email('Email inválido'),
  guest_phone: z.string().min(1, 'Teléfono requerido'),
  guest_dni: z.string().optional(),
  guest_nationality: z.string().optional(),
  special_requests: z.string().optional(),
  rooms: z.array(z.object({
    room_type_id: z.string().uuid(),
    check_in: z.string(),
    check_out: z.string(),
    adults: z.number().int().min(1),
    children: z.number().int().min(0),
  })).min(1, 'Al menos una habitación requerida'),
  locale: z.string().default('es'),
})

export const waitlistSchema = z.object({
  hotel_id: z.string().uuid(),
  room_type_id: z.string().uuid().optional(),
  guest_name: z.string().min(1),
  guest_email: z.string().email(),
  guest_phone: z.string().optional(),
  requested_check_in: z.string().optional(),
  requested_check_out: z.string().optional(),
})

export type CreateBookingInput = z.infer<typeof createBookingSchema>
export type WaitlistInput = z.infer<typeof waitlistSchema>
```

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts lib/validators/
git commit -m "feat: add TypeScript types and zod validators"
```

---

### Task 5: Core business logic (availability + pricing)

**Files:**
- Create: `lib/availability.ts`
- Create: `lib/pricing.ts`
- Create: `lib/audit.ts`

- [ ] **Step 1: Create availability calculator**

Create `lib/availability.ts`:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'

interface AvailabilityCheck {
  room_type_id: string
  check_in: string
  check_out: string
}

export async function getAvailability({ room_type_id, check_in, check_out }: AvailabilityCheck): Promise<number> {
  const supabase = createAdminClient()

  // Get room type inventory
  const { data: roomType } = await supabase
    .from('room_types')
    .select('inventory')
    .eq('id', room_type_id)
    .single()

  if (!roomType) return 0

  // Count overlapping active bookings
  const { count } = await supabase
    .from('booking_rooms')
    .select('id, bookings!inner(status)', { count: 'exact', head: true })
    .eq('room_type_id', room_type_id)
    .lt('check_in', check_out)
    .gt('check_out', check_in)
    .neq('bookings.status', 'cancelled')

  return roomType.inventory - (count ?? 0)
}

export async function checkAvailability(
  rooms: { room_type_id: string; check_in: string; check_out: string }[]
): Promise<{ available: boolean; unavailable: string[] }> {
  const unavailable: string[] = []

  for (const room of rooms) {
    const available = await getAvailability(room)
    if (available <= 0) {
      unavailable.push(room.room_type_id)
    }
  }

  return { available: unavailable.length === 0, unavailable }
}
```

- [ ] **Step 2: Create pricing calculator**

Create `lib/pricing.ts`:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { eachDayOfInterval, parseISO } from 'date-fns'

interface PriceCalculation {
  room_type_id: string
  check_in: string
  check_out: string
}

export async function calculateRoomPrice({ room_type_id, check_in, check_out }: PriceCalculation): Promise<number> {
  const supabase = createAdminClient()

  // Get all pricing for the date range (check_out night is NOT included)
  const nights = eachDayOfInterval({
    start: parseISO(check_in),
    end: parseISO(check_out),
  }).slice(0, -1) // Exclude check-out day

  const dates = nights.map(d => d.toISOString().split('T')[0])

  const { data: prices } = await supabase
    .from('room_pricing')
    .select('date, price_per_night')
    .eq('room_type_id', room_type_id)
    .in('date', dates)

  if (!prices || prices.length === 0) return 0

  // Sum up all nights
  const priceMap = new Map(prices.map(p => [p.date, p.price_per_night]))
  let total = 0

  for (const date of dates) {
    const nightPrice = priceMap.get(date)
    if (!nightPrice) {
      throw new Error(`No price configured for ${date} on room type ${room_type_id}`)
    }
    total += nightPrice
  }

  return total
}

export async function calculateBookingTotal(
  rooms: { room_type_id: string; check_in: string; check_out: string }[]
): Promise<{ total: number; breakdown: { room_type_id: string; price: number }[] }> {
  const breakdown: { room_type_id: string; price: number }[] = []
  let total = 0

  for (const room of rooms) {
    const price = await calculateRoomPrice(room)
    breakdown.push({ room_type_id: room.room_type_id, price })
    total += price
  }

  return { total, breakdown }
}
```

- [ ] **Step 3: Create audit log helper**

Create `lib/audit.ts`:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'

interface AuditEntry {
  admin_user_id: string
  action: string
  entity_type: string
  entity_id?: string
  details?: Record<string, unknown>
}

export async function logAudit({ admin_user_id, action, entity_type, entity_id, details }: AuditEntry) {
  const supabase = createAdminClient()
  await supabase.from('audit_log').insert({
    admin_user_id,
    action,
    entity_type,
    entity_id,
    details,
  })
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/availability.ts lib/pricing.ts lib/audit.ts
git commit -m "feat: add availability, pricing, and audit log helpers"
```

---

## Phase 2: Admin Panel

### Task 6: Admin layout + auth

**Files:**
- Create: `app/(admin)/layout.tsx`
- Create: `app/(admin)/login/page.tsx`
- Create: `components/admin/sidebar.tsx`
- Create: `components/admin/topbar.tsx`

- [ ] **Step 1: Create admin login page**

Create `app/(admin)/login/page.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/admin/dashboard'

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Credenciales incorrectas')
      setLoading(false)
      return
    }

    router.push(redirect)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">StayForEvents Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Create admin sidebar**

Create `components/admin/sidebar.tsx`:
```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Calendar, Hotel, Bed, BookOpen,
  CreditCard, Users, Mail, BarChart3, Shield, LogOut
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/events', label: 'Eventos', icon: Calendar },
  { href: '/admin/bookings', label: 'Reservas', icon: BookOpen },
  { href: '/admin/rooming-list', label: 'Rooming List', icon: Bed },
  { href: '/admin/payments', label: 'Pagos', icon: CreditCard },
  { href: '/admin/waitlist', label: 'Lista de espera', icon: Users },
  { href: '/admin/communications', label: 'Comunicaciones', icon: Mail },
  { href: '/admin/statistics', label: 'Estadísticas', icon: BarChart3 },
  { href: '/admin/audit-log', label: 'Auditoría', icon: Shield },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  return (
    <aside className="w-64 min-h-screen bg-white border-r flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-lg font-bold">StayForEvents</h1>
        <p className="text-xs text-gray-500">Panel de administración</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              pathname.startsWith(item.href)
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50 w-full"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Create admin topbar**

Create `components/admin/topbar.tsx`:
```typescript
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NotificationsDropdown } from './notifications-dropdown'

export function AdminTopbar() {
  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        <NotificationsDropdown />
      </div>
    </header>
  )
}
```

Create `components/admin/notifications-dropdown.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/types'

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchNotifications() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('admin_user_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(10)

      if (data) setNotifications(data)
    }
    fetchNotifications()
  }, [])

  const unreadCount = notifications.length

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} className="relative">
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">Sin notificaciones</p>
          ) : (
            notifications.map(n => (
              <div key={n.id} className="p-3 border-b last:border-0 hover:bg-gray-50">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-gray-500">{n.message}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create admin layout**

Create `app/(admin)/layout.tsx`:
```typescript
import { AdminSidebar } from '@/components/admin/sidebar'
import { AdminTopbar } from '@/components/admin/topbar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <AdminTopbar />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/(admin)/ components/admin/
git commit -m "feat: add admin layout, login, sidebar, and notifications"
```

---

### Task 7: Admin CRUD — Events

**Files:**
- Create: `lib/actions/events.ts`
- Create: `app/(admin)/events/page.tsx`
- Create: `app/(admin)/events/new/page.tsx`
- Create: `app/(admin)/events/[eventId]/page.tsx`
- Create: `components/admin/event-form.tsx`

- [ ] **Step 1: Create event Server Actions**

Create `lib/actions/events.ts`:
```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { createEventSchema, updateEventSchema, type CreateEventInput } from '@/lib/validators/event'
import { logAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function getEvents() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('events')
    .select('*, hotels(count)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getEvent(id: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createEvent(input: CreateEventInput) {
  const parsed = createEventSchema.parse(input)
  const supabase = createAdminClient()
  const serverSupabase = await createClient()
  const { data: { user } } = await serverSupabase.auth.getUser()

  const { data, error } = await supabase
    .from('events')
    .insert(parsed)
    .select()
    .single()

  if (error) throw error

  await logAudit({
    admin_user_id: user!.id,
    action: 'event.created',
    entity_type: 'event',
    entity_id: data.id,
    details: { name: parsed.name },
  })

  revalidatePath('/admin/events')
  redirect('/admin/events')
}

export async function updateEvent(id: string, input: Partial<CreateEventInput>) {
  const parsed = updateEventSchema.parse(input)
  const supabase = createAdminClient()
  const serverSupabase = await createClient()
  const { data: { user } } = await serverSupabase.auth.getUser()

  const { error } = await supabase
    .from('events')
    .update(parsed)
    .eq('id', id)

  if (error) throw error

  await logAudit({
    admin_user_id: user!.id,
    action: 'event.updated',
    entity_type: 'event',
    entity_id: id,
    details: parsed,
  })

  revalidatePath('/admin/events')
  revalidatePath(`/admin/events/${id}`)
}

export async function duplicateEvent(id: string) {
  const supabase = createAdminClient()
  const serverSupabase = await createClient()
  const { data: { user } } = await serverSupabase.auth.getUser()

  const { data: original } = await supabase.from('events').select('*').eq('id', id).single()
  if (!original) throw new Error('Event not found')

  const { id: _id, created_at: _ca, slug, ...rest } = original
  const { data: newEvent, error } = await supabase
    .from('events')
    .insert({ ...rest, slug: `${slug}-copy`, name: `${rest.name} (copia)` })
    .select()
    .single()

  if (error) throw error

  await logAudit({
    admin_user_id: user!.id,
    action: 'event.duplicated',
    entity_type: 'event',
    entity_id: newEvent.id,
    details: { original_id: id },
  })

  revalidatePath('/admin/events')
  return newEvent
}
```

- [ ] **Step 2: Create event form component**

Create `components/admin/event-form.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createEvent, updateEvent } from '@/lib/actions/events'
import type { Event } from '@/lib/types'

interface EventFormProps {
  event?: Event
}

export function EventForm({ event }: EventFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!event

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const input = {
      name: formData.get('name') as string,
      slug: formData.get('slug') as string,
      event_date: formData.get('event_date') as string,
      couple_names: formData.get('couple_names') as string,
      description: formData.get('description') as string || undefined,
    }

    try {
      if (isEdit) {
        await updateEvent(event.id, input)
      } else {
        await createEvent(input)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div>
        <Label htmlFor="name">Nombre del evento</Label>
        <Input id="name" name="name" defaultValue={event?.name} required />
      </div>
      <div>
        <Label htmlFor="slug">Slug (URL)</Label>
        <Input id="slug" name="slug" defaultValue={event?.slug} required placeholder="boda-ana-carlos" />
      </div>
      <div>
        <Label htmlFor="event_date">Fecha del evento</Label>
        <Input id="event_date" name="event_date" type="date" defaultValue={event?.event_date} required />
      </div>
      <div>
        <Label htmlFor="couple_names">Nombres de la pareja</Label>
        <Input id="couple_names" name="couple_names" defaultValue={event?.couple_names} required />
      </div>
      <div>
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" name="description" defaultValue={event?.description ?? ''} />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear evento'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Create event pages**

Create `app/(admin)/events/page.tsx`:
```typescript
import Link from 'next/link'
import { getEvents } from '@/lib/actions/events'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'

export default async function EventsPage() {
  const events = await getEvents()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Eventos</h1>
        <Link href="/admin/events/new">
          <Button><Plus className="w-4 h-4 mr-2" /> Nuevo evento</Button>
        </Link>
      </div>
      <div className="bg-white rounded-lg border">
        <table className="w-full">
          <thead className="border-b">
            <tr className="text-left text-sm text-gray-500">
              <th className="p-4">Nombre</th>
              <th className="p-4">Pareja</th>
              <th className="p-4">Fecha</th>
              <th className="p-4">Estado</th>
              <th className="p-4">Hoteles</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {events?.map(event => (
              <tr key={event.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="p-4 font-medium">{event.name}</td>
                <td className="p-4">{event.couple_names}</td>
                <td className="p-4">{event.event_date}</td>
                <td className="p-4">
                  <Badge variant={event.status === 'active' ? 'default' : 'secondary'}>
                    {event.status}
                  </Badge>
                </td>
                <td className="p-4">{event.hotels?.[0]?.count ?? 0}</td>
                <td className="p-4">
                  <Link href={`/admin/events/${event.id}`}>
                    <Button variant="ghost" size="sm">Editar</Button>
                  </Link>
                  <Link href={`/admin/events/${event.id}/hotels`}>
                    <Button variant="ghost" size="sm">Hoteles</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

Create `app/(admin)/events/new/page.tsx`:
```typescript
import { EventForm } from '@/components/admin/event-form'

export default function NewEventPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Nuevo evento</h1>
      <EventForm />
    </div>
  )
}
```

Create `app/(admin)/events/[eventId]/page.tsx`:
```typescript
import { getEvent } from '@/lib/actions/events'
import { EventForm } from '@/components/admin/event-form'
import { notFound } from 'next/navigation'

export default async function EditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const event = await getEvent(eventId)
  if (!event) notFound()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Editar evento</h1>
      <EventForm event={event} />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/actions/events.ts components/admin/event-form.tsx app/(admin)/events/
git commit -m "feat: add events CRUD (admin)"
```

---

### Task 8: Admin CRUD — Hotels + Room Types + Pricing

**Files:**
- Create: `lib/actions/hotels.ts`
- Create: `lib/actions/rooms.ts`
- Create: `components/admin/hotel-form.tsx`
- Create: `components/admin/room-type-form.tsx`
- Create: `app/(admin)/events/[eventId]/hotels/page.tsx`
- Create: `app/(admin)/events/[eventId]/hotels/new/page.tsx`
- Create: `app/(admin)/events/[eventId]/hotels/[hotelId]/page.tsx`
- Create: `app/(admin)/events/[eventId]/hotels/[hotelId]/rooms/page.tsx`
- Create: `app/(admin)/events/[eventId]/hotels/[hotelId]/rooms/[roomTypeId]/page.tsx`

- [ ] **Step 1: Create hotel Server Actions**

Create `lib/actions/hotels.ts`:
```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { createHotelSchema, updateHotelSchema, type CreateHotelInput } from '@/lib/validators/hotel'
import { logAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function getHotelsByEvent(eventId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('hotels')
    .select('*, room_types(count), hotel_conditions(*)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getHotel(id: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('hotels')
    .select('*, hotel_conditions(*), cancellation_policies(*), payment_conditions(*)')
    .eq('id', id)
    .single()
  return data
}

export async function createHotel(input: CreateHotelInput) {
  const parsed = createHotelSchema.parse(input)
  const supabase = createAdminClient()
  const serverSupabase = await createClient()
  const { data: { user } } = await serverSupabase.auth.getUser()

  const { payment_scenario, min_bookings, guarantee_deadline, charge_date, ...hotelData } = parsed

  const { data: hotel, error } = await supabase
    .from('hotels')
    .insert(hotelData)
    .select()
    .single()

  if (error) throw error

  // Create hotel conditions
  await supabase.from('hotel_conditions').insert({
    hotel_id: hotel.id,
    payment_scenario,
    min_bookings: min_bookings ?? 0,
    guarantee_deadline: guarantee_deadline ?? null,
    charge_date: charge_date ?? null,
  })

  await logAudit({
    admin_user_id: user!.id,
    action: 'hotel.created',
    entity_type: 'hotel',
    entity_id: hotel.id,
    details: { name: hotelData.name },
  })

  revalidatePath(`/admin/events/${parsed.event_id}/hotels`)
  redirect(`/admin/events/${parsed.event_id}/hotels/${hotel.id}`)
}

export async function updateHotel(id: string, eventId: string, input: Record<string, unknown>) {
  const parsed = updateHotelSchema.parse(input)
  const supabase = createAdminClient()
  const serverSupabase = await createClient()
  const { data: { user } } = await serverSupabase.auth.getUser()

  const { error } = await supabase.from('hotels').update(parsed).eq('id', id)
  if (error) throw error

  await logAudit({
    admin_user_id: user!.id,
    action: 'hotel.updated',
    entity_type: 'hotel',
    entity_id: id,
    details: parsed,
  })

  revalidatePath(`/admin/events/${eventId}/hotels/${id}`)
}

export async function updatePaymentConditions(hotelId: string, conditions: { installment_number: number; percentage: number; due_date: string; description?: string }[]) {
  const supabase = createAdminClient()

  // Delete existing and replace
  await supabase.from('payment_conditions').delete().eq('hotel_id', hotelId)
  if (conditions.length > 0) {
    await supabase.from('payment_conditions').insert(
      conditions.map(c => ({ ...c, hotel_id: hotelId }))
    )
  }
}

export async function updateCancellationPolicy(hotelId: string, policy: { name: string; rules: { before_days: number; refund_percent: number }[]; description?: string }) {
  const supabase = createAdminClient()

  // Upsert single policy per hotel
  await supabase.from('cancellation_policies').delete().eq('hotel_id', hotelId)
  await supabase.from('cancellation_policies').insert({ ...policy, hotel_id: hotelId })
}
```

- [ ] **Step 2: Create room Server Actions**

Create `lib/actions/rooms.ts`:
```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { createRoomTypeSchema, updateRoomTypeSchema, roomPricingSchema } from '@/lib/validators/room'
import type { CreateRoomTypeInput, RoomPricingInput } from '@/lib/validators/room'
import { logAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

export async function getRoomTypesByHotel(hotelId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('room_types')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('name')
  return data ?? []
}

export async function getRoomType(id: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('room_types')
    .select('*, room_pricing(*)')
    .eq('id', id)
    .single()
  return data
}

export async function createRoomType(input: CreateRoomTypeInput) {
  const parsed = createRoomTypeSchema.parse(input)
  const supabase = createAdminClient()
  const serverSupabase = await createClient()
  const { data: { user } } = await serverSupabase.auth.getUser()

  const { data, error } = await supabase
    .from('room_types')
    .insert(parsed)
    .select()
    .single()

  if (error) throw error

  await logAudit({
    admin_user_id: user!.id,
    action: 'room_type.created',
    entity_type: 'room_type',
    entity_id: data.id,
    details: { name: parsed.name },
  })

  return data
}

export async function updateRoomType(id: string, input: Record<string, unknown>) {
  const parsed = updateRoomTypeSchema.parse(input)
  const supabase = createAdminClient()

  const { error } = await supabase.from('room_types').update(parsed).eq('id', id)
  if (error) throw error
}

export async function setRoomPricing(input: RoomPricingInput) {
  const parsed = roomPricingSchema.parse(input)
  const supabase = createAdminClient()

  // Upsert all prices for this room type
  const records = parsed.prices.map(p => ({
    room_type_id: parsed.room_type_id,
    date: p.date,
    price_per_night: p.price_per_night,
  }))

  // Delete existing prices for these dates and re-insert
  const dates = records.map(r => r.date)
  await supabase
    .from('room_pricing')
    .delete()
    .eq('room_type_id', parsed.room_type_id)
    .in('date', dates)

  const { error } = await supabase.from('room_pricing').insert(records)
  if (error) throw error
}
```

- [ ] **Step 3: Create hotel form component**

Create `components/admin/hotel-form.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createHotel, updateHotel } from '@/lib/actions/hotels'
import type { Hotel, HotelConditions } from '@/lib/types'

interface HotelFormProps {
  eventId: string
  hotel?: Hotel & { hotel_conditions?: HotelConditions }
}

export function HotelForm({ eventId, hotel }: HotelFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scenario, setScenario] = useState(hotel?.hotel_conditions?.payment_scenario ?? 'full_upfront')
  const isEdit = !!hotel

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const input = {
      event_id: eventId,
      name: formData.get('name') as string,
      slug: formData.get('slug') as string,
      description: formData.get('description') as string || undefined,
      address: formData.get('address') as string || undefined,
      check_in_from: formData.get('check_in_from') as string,
      check_out_until: formData.get('check_out_until') as string,
      group_reference: formData.get('group_reference') as string || undefined,
      payment_scenario: scenario as 'full_upfront' | 'partial' | 'guarantee' | 'partial_guarantee',
      min_bookings: parseInt(formData.get('min_bookings') as string) || 0,
      guarantee_deadline: formData.get('guarantee_deadline') as string || undefined,
      charge_date: formData.get('charge_date') as string || undefined,
    }

    try {
      if (isEdit) {
        await updateHotel(hotel.id, eventId, input)
      } else {
        await createHotel(input)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div>
        <Label htmlFor="name">Nombre del hotel</Label>
        <Input id="name" name="name" defaultValue={hotel?.name} required />
      </div>
      <div>
        <Label htmlFor="slug">Slug (URL)</Label>
        <Input id="slug" name="slug" defaultValue={hotel?.slug} required placeholder="hotel-miramar" />
      </div>
      <div>
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" name="description" defaultValue={hotel?.description ?? ''} />
      </div>
      <div>
        <Label htmlFor="address">Dirección</Label>
        <Input id="address" name="address" defaultValue={hotel?.address ?? ''} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="check_in_from">Check-in desde</Label>
          <Input id="check_in_from" name="check_in_from" type="date" defaultValue={hotel?.check_in_from} required />
        </div>
        <div>
          <Label htmlFor="check_out_until">Check-out hasta</Label>
          <Input id="check_out_until" name="check_out_until" type="date" defaultValue={hotel?.check_out_until} required />
        </div>
      </div>
      <div>
        <Label htmlFor="group_reference">Referencia de grupo (para hotel)</Label>
        <Input id="group_reference" name="group_reference" defaultValue={hotel?.group_reference ?? ''} />
      </div>
      <div>
        <Label>Escenario de pago</Label>
        <Select value={scenario} onValueChange={setScenario}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="full_upfront">100% al momento</SelectItem>
            <SelectItem value="partial">Pago parcial + cobro futuro</SelectItem>
            <SelectItem value="guarantee">Solo garantía (guardar tarjeta)</SelectItem>
            <SelectItem value="partial_guarantee">Parcial + garantía</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(scenario === 'guarantee' || scenario === 'partial_guarantee') && (
        <>
          <div>
            <Label htmlFor="min_bookings">Mínimo de reservas para activar</Label>
            <Input id="min_bookings" name="min_bookings" type="number" defaultValue={hotel?.hotel_conditions?.min_bookings ?? 0} />
          </div>
          <div>
            <Label htmlFor="guarantee_deadline">Deadline cancelación gratis</Label>
            <Input id="guarantee_deadline" name="guarantee_deadline" type="date" defaultValue={hotel?.hotel_conditions?.guarantee_deadline ?? ''} />
          </div>
          <div>
            <Label htmlFor="charge_date">Fecha de cobro (si grupo se activa)</Label>
            <Input id="charge_date" name="charge_date" type="date" defaultValue={hotel?.hotel_conditions?.charge_date ?? ''} />
          </div>
        </>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear hotel'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: Create room type form with pricing calendar**

Create `components/admin/room-type-form.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createRoomType, updateRoomType, setRoomPricing } from '@/lib/actions/rooms'
import { eachDayOfInterval, parseISO, format } from 'date-fns'
import type { RoomType, RoomPricing } from '@/lib/types'

interface RoomTypeFormProps {
  hotelId: string
  checkInFrom: string
  checkOutUntil: string
  roomType?: RoomType & { room_pricing?: RoomPricing[] }
}

export function RoomTypeForm({ hotelId, checkInFrom, checkOutUntil, roomType }: RoomTypeFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!roomType

  // Generate all dates in the hotel range for pricing
  const dates = eachDayOfInterval({
    start: parseISO(checkInFrom),
    end: parseISO(checkOutUntil),
  })

  const existingPrices = new Map(
    roomType?.room_pricing?.map(p => [p.date, p.price_per_night]) ?? []
  )

  const [prices, setPrices] = useState<Map<string, number>>(existingPrices)
  const [bulkPrice, setBulkPrice] = useState('')

  function applyBulkPrice() {
    const price = parseFloat(bulkPrice)
    if (isNaN(price)) return
    const newPrices = new Map(prices)
    dates.forEach(d => {
      const dateStr = format(d, 'yyyy-MM-dd')
      newPrices.set(dateStr, price)
    })
    setPrices(newPrices)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const input = {
      hotel_id: hotelId,
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      capacity: parseInt(formData.get('capacity') as string),
      inventory: parseInt(formData.get('inventory') as string),
      rack_rate: parseFloat(formData.get('rack_rate') as string) || undefined,
      meal_plan: formData.get('meal_plan') as string || 'solo alojamiento',
    }

    try {
      let roomTypeId = roomType?.id
      if (isEdit) {
        await updateRoomType(roomType.id, input)
      } else {
        const created = await createRoomType(input)
        roomTypeId = created.id
      }

      // Save pricing
      const pricingEntries = Array.from(prices.entries())
        .filter(([_, price]) => price > 0)
        .map(([date, price_per_night]) => ({ date, price_per_night }))

      if (pricingEntries.length > 0 && roomTypeId) {
        await setRoomPricing({ room_type_id: roomTypeId, prices: pricingEntries })
      }

      window.location.reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4 max-w-lg">
        <div className="col-span-2">
          <Label htmlFor="name">Nombre tipo habitación</Label>
          <Input id="name" name="name" defaultValue={roomType?.name} required placeholder="Doble Superior" />
        </div>
        <div className="col-span-2">
          <Label htmlFor="description">Descripción</Label>
          <Textarea id="description" name="description" defaultValue={roomType?.description ?? ''} />
        </div>
        <div>
          <Label htmlFor="capacity">Capacidad (personas)</Label>
          <Input id="capacity" name="capacity" type="number" defaultValue={roomType?.capacity ?? 2} required />
        </div>
        <div>
          <Label htmlFor="inventory">Inventario (nº habitaciones)</Label>
          <Input id="inventory" name="inventory" type="number" defaultValue={roomType?.inventory ?? 0} required />
        </div>
        <div>
          <Label htmlFor="rack_rate">Precio rack hotel (€/noche)</Label>
          <Input id="rack_rate" name="rack_rate" type="number" step="0.01" defaultValue={roomType?.rack_rate ?? ''} placeholder="200.00" />
        </div>
        <div>
          <Label htmlFor="meal_plan">Régimen</Label>
          <Input id="meal_plan" name="meal_plan" defaultValue={roomType?.meal_plan ?? 'solo alojamiento'} placeholder="media pensión" />
        </div>
      </div>

      {/* Pricing calendar */}
      <div>
        <h3 className="font-medium mb-2">Precios por noche</h3>
        <div className="flex gap-2 mb-4">
          <Input
            type="number"
            step="0.01"
            placeholder="Precio para todas las fechas"
            value={bulkPrice}
            onChange={e => setBulkPrice(e.target.value)}
            className="w-60"
          />
          <Button type="button" variant="secondary" onClick={applyBulkPrice}>
            Aplicar a todas
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 max-h-64 overflow-y-auto">
          {dates.map(date => {
            const dateStr = format(date, 'yyyy-MM-dd')
            return (
              <div key={dateStr} className="text-center p-1 border rounded text-xs">
                <div className="text-gray-500">{format(date, 'dd/MM')}</div>
                <Input
                  type="number"
                  step="0.01"
                  className="h-6 text-xs text-center p-0 mt-1"
                  value={prices.get(dateStr) ?? ''}
                  onChange={e => {
                    const newPrices = new Map(prices)
                    newPrices.set(dateStr, parseFloat(e.target.value) || 0)
                    setPrices(newPrices)
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear tipo habitación'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 5: Create hotel and room pages (list + create + edit)**

Create `app/(admin)/events/[eventId]/hotels/page.tsx`:
```typescript
import Link from 'next/link'
import { getHotelsByEvent } from '@/lib/actions/hotels'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'

export default async function HotelsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const hotels = await getHotelsByEvent(eventId)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Hoteles</h1>
        <Link href={`/admin/events/${eventId}/hotels/new`}>
          <Button><Plus className="w-4 h-4 mr-2" /> Nuevo hotel</Button>
        </Link>
      </div>
      <div className="grid gap-4">
        {hotels.map(hotel => (
          <div key={hotel.id} className="bg-white p-4 rounded-lg border flex items-center justify-between">
            <div>
              <h3 className="font-medium">{hotel.name}</h3>
              <p className="text-sm text-gray-500">{hotel.address}</p>
              <div className="flex gap-2 mt-1">
                <Badge variant="outline">{hotel.hotel_conditions?.payment_scenario}</Badge>
                <Badge variant="secondary">{hotel.room_types?.[0]?.count ?? 0} tipos hab.</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/admin/events/${eventId}/hotels/${hotel.id}`}>
                <Button variant="ghost" size="sm">Editar</Button>
              </Link>
              <Link href={`/admin/events/${eventId}/hotels/${hotel.id}/rooms`}>
                <Button variant="ghost" size="sm">Habitaciones</Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

Create `app/(admin)/events/[eventId]/hotels/new/page.tsx`:
```typescript
import { HotelForm } from '@/components/admin/hotel-form'

export default async function NewHotelPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Nuevo hotel</h1>
      <HotelForm eventId={eventId} />
    </div>
  )
}
```

Create `app/(admin)/events/[eventId]/hotels/[hotelId]/page.tsx`:
```typescript
import { getHotel } from '@/lib/actions/hotels'
import { HotelForm } from '@/components/admin/hotel-form'
import { notFound } from 'next/navigation'

export default async function EditHotelPage({ params }: { params: Promise<{ eventId: string; hotelId: string }> }) {
  const { eventId, hotelId } = await params
  const hotel = await getHotel(hotelId)
  if (!hotel) notFound()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Editar hotel: {hotel.name}</h1>
      <HotelForm eventId={eventId} hotel={hotel} />
    </div>
  )
}
```

Create `app/(admin)/events/[eventId]/hotels/[hotelId]/rooms/page.tsx`:
```typescript
import { getRoomTypesByHotel } from '@/lib/actions/rooms'
import { getHotel } from '@/lib/actions/hotels'
import { RoomTypeForm } from '@/components/admin/room-type-form'
import { notFound } from 'next/navigation'

export default async function RoomsPage({ params }: { params: Promise<{ eventId: string; hotelId: string }> }) {
  const { hotelId } = await params
  const hotel = await getHotel(hotelId)
  if (!hotel) notFound()

  const roomTypes = await getRoomTypesByHotel(hotelId)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Habitaciones: {hotel.name}</h1>

      {/* Existing room types */}
      {roomTypes.map(rt => (
        <div key={rt.id} className="bg-white p-4 rounded-lg border mb-4">
          <h3 className="font-medium">{rt.name} — {rt.inventory} uds — {rt.meal_plan}</h3>
          <p className="text-sm text-gray-500">Capacidad: {rt.capacity} | Rack: €{rt.rack_rate}/noche</p>
        </div>
      ))}

      {/* New room type form */}
      <div className="bg-white p-6 rounded-lg border mt-6">
        <h2 className="text-lg font-medium mb-4">Añadir tipo de habitación</h2>
        <RoomTypeForm hotelId={hotelId} checkInFrom={hotel.check_in_from} checkOutUntil={hotel.check_out_until} />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/actions/hotels.ts lib/actions/rooms.ts components/admin/hotel-form.tsx components/admin/room-type-form.tsx "app/(admin)/events/"
git commit -m "feat: add hotels and room types CRUD with pricing calendar (admin)"
```

---

## Phase 3: Public Booking Flow

### Task 9: i18n setup with next-intl

**Files:**
- Create: `messages/es.json`
- Create: `messages/en.json`
- Modify: `next.config.ts`
- Create: `i18n/request.ts`
- Create: `i18n/routing.ts`

- [ ] **Step 1: Configure next-intl**

Create `i18n/request.ts`:
```typescript
import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !routing.locales.includes(locale as typeof routing.locales[number])) {
    locale = routing.defaultLocale
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
```

Create `i18n/routing.ts`:
```typescript
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['es', 'en', 'fr', 'pt', 'de', 'ro', 'nl', 'it', 'ru'],
  defaultLocale: 'es',
})
```

Update `next.config.ts`:
```typescript
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig = {}

export default withNextIntl(nextConfig)
```

- [ ] **Step 2: Create base translation files**

Create `messages/es.json`:
```json
{
  "booking": {
    "step1": {
      "title": "Reserva tu alojamiento",
      "selectRoom": "Selecciona habitación",
      "selectDates": "Selecciona fechas",
      "checkIn": "Check-in",
      "checkOut": "Check-out",
      "nights": "{count, plural, one {# noche} other {# noches}}",
      "perNight": "/noche",
      "groupPrice": "Precio exclusivo grupo",
      "hotelPrice": "Precio hotel",
      "available": "{count} disponibles",
      "soldOut": "Agotado",
      "continue": "Continuar",
      "adults": "Adultos",
      "children": "Niños"
    },
    "step2": {
      "title": "Datos personales",
      "fullName": "Nombre completo",
      "email": "Email",
      "phone": "Teléfono",
      "dni": "DNI / Pasaporte",
      "nationality": "Nacionalidad",
      "specialRequests": "Peticiones especiales",
      "acceptConditions": "Acepto las condiciones de reserva y la política de cancelación",
      "continue": "Continuar al pago"
    },
    "step3": {
      "title": "Resumen y pago",
      "summary": "Resumen de tu reserva",
      "room": "Habitación",
      "dates": "Fechas",
      "total": "Total",
      "payNow": "A pagar ahora",
      "payLater": "Pendiente",
      "pay": "Pagar {amount}",
      "confirmReservation": "Confirmar reserva",
      "processing": "Procesando..."
    },
    "confirmation": {
      "title": "¡Reserva confirmada!",
      "reference": "Referencia",
      "emailSent": "Recibirás un email de confirmación en breve",
      "cancellationPolicy": "Política de cancelación",
      "support": "¿Necesitas ayuda?"
    },
    "waitlist": {
      "title": "Lista de espera",
      "noAvailability": "No hay disponibilidad en este momento",
      "joinWaitlist": "Apúntate a la lista de espera y te avisaremos si hay cancelaciones",
      "submit": "Apuntarme",
      "success": "Te has apuntado correctamente. Te avisaremos por email."
    }
  }
}
```

Create `messages/en.json`:
```json
{
  "booking": {
    "step1": {
      "title": "Book your accommodation",
      "selectRoom": "Select room",
      "selectDates": "Select dates",
      "checkIn": "Check-in",
      "checkOut": "Check-out",
      "nights": "{count, plural, one {# night} other {# nights}}",
      "perNight": "/night",
      "groupPrice": "Exclusive group price",
      "hotelPrice": "Hotel price",
      "available": "{count} available",
      "soldOut": "Sold out",
      "continue": "Continue",
      "adults": "Adults",
      "children": "Children"
    },
    "step2": {
      "title": "Personal details",
      "fullName": "Full name",
      "email": "Email",
      "phone": "Phone",
      "dni": "ID / Passport",
      "nationality": "Nationality",
      "specialRequests": "Special requests",
      "acceptConditions": "I accept the booking conditions and cancellation policy",
      "continue": "Continue to payment"
    },
    "step3": {
      "title": "Summary and payment",
      "summary": "Booking summary",
      "room": "Room",
      "dates": "Dates",
      "total": "Total",
      "payNow": "Pay now",
      "payLater": "Pay later",
      "pay": "Pay {amount}",
      "confirmReservation": "Confirm reservation",
      "processing": "Processing..."
    },
    "confirmation": {
      "title": "Booking confirmed!",
      "reference": "Reference",
      "emailSent": "You will receive a confirmation email shortly",
      "cancellationPolicy": "Cancellation policy",
      "support": "Need help?"
    },
    "waitlist": {
      "title": "Waiting list",
      "noAvailability": "No availability at this moment",
      "joinWaitlist": "Join the waiting list and we'll notify you if there are cancellations",
      "submit": "Join",
      "success": "You've been added. We'll notify you by email."
    }
  }
}
```

Note: Create equivalent files for `fr.json`, `pt.json`, `de.json`, `ro.json`, `nl.json`, `it.json`, `ru.json` with translations for each language following the same structure.

- [ ] **Step 3: Commit**

```bash
git add i18n/ messages/ next.config.ts
git commit -m "feat: add i18n setup with next-intl (9 languages)"
```

---

### Task 10: Public booking layout + Step 1 (room selection)

**Files:**
- Create: `app/(booking)/layout.tsx`
- Create: `app/(booking)/[eventSlug]/[hotelSlug]/page.tsx`
- Create: `components/booking/hotel-gallery.tsx`
- Create: `components/booking/room-card.tsx`
- Create: `components/booking/date-picker.tsx`
- Create: `components/booking/language-selector.tsx`

- [ ] **Step 1: Create public booking layout**

Create `app/(booking)/layout.tsx`:
```typescript
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { LanguageSelector } from '@/components/booking/language-selector'

export default async function BookingLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">StayForEvents</span>
            <LanguageSelector />
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          {children}
        </main>
      </div>
    </NextIntlClientProvider>
  )
}
```

- [ ] **Step 2: Create language selector**

Create `components/booking/language-selector.tsx`:
```typescript
'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const languages = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ro', label: 'Română' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'it', label: 'Italiano' },
  { code: 'ru', label: 'Русский' },
]

export function LanguageSelector() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  function handleChange(newLocale: string) {
    // Store preference in cookie for next-intl
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`
    router.refresh()
  }

  return (
    <Select value={locale} onValueChange={handleChange}>
      <SelectTrigger className="w-32 h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {languages.map(lang => (
          <SelectItem key={lang.code} value={lang.code}>{lang.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 3: Create hotel gallery component**

Create `components/booking/hotel-gallery.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface HotelGalleryProps {
  photos: string[]
  hotelName: string
}

export function HotelGallery({ photos, hotelName }: HotelGalleryProps) {
  const [current, setCurrent] = useState(0)

  if (photos.length === 0) {
    return (
      <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
        <span className="text-gray-400">Sin fotos</span>
      </div>
    )
  }

  return (
    <div className="relative w-full h-64 md:h-80 rounded-lg overflow-hidden">
      <img
        src={photos[current]}
        alt={`${hotelName} - ${current + 1}`}
        className="w-full h-full object-cover"
      />
      {photos.length > 1 && (
        <>
          <button
            onClick={() => setCurrent(i => (i - 1 + photos.length) % photos.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrent(i => (i + 1) % photos.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {photos.map((_, i) => (
              <span key={i} className={`w-2 h-2 rounded-full ${i === current ? 'bg-white' : 'bg-white/50'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create room card component**

Create `components/booking/room-card.tsx`:
```typescript
'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Users, Minus, Plus } from 'lucide-react'
import type { RoomType } from '@/lib/types'

interface RoomCardProps {
  roomType: RoomType
  avgPrice: number
  available: number
  quantity: number
  onQuantityChange: (qty: number) => void
}

export function RoomCard({ roomType, avgPrice, available, quantity, onQuantityChange }: RoomCardProps) {
  const t = useTranslations('booking.step1')
  const soldOut = available <= 0

  return (
    <div className={`border rounded-lg p-4 ${soldOut ? 'opacity-50' : ''}`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-lg">{roomType.name}</h3>
          <p className="text-sm text-gray-500 mt-1">{roomType.description}</p>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {roomType.capacity}</span>
            <span>{roomType.meal_plan}</span>
          </div>
        </div>
        <div className="text-right">
          {roomType.rack_rate && (
            <span className="text-sm text-gray-400 line-through">€{roomType.rack_rate}</span>
          )}
          <div className="text-xl font-bold">€{avgPrice.toFixed(0)}<span className="text-sm font-normal text-gray-500">{t('perNight')}</span></div>
          <span className="text-xs text-green-600 font-medium">{t('groupPrice')}</span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t">
        <span className="text-sm text-gray-500">
          {soldOut ? t('soldOut') : t('available', { count: available })}
        </span>
        {!soldOut && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onQuantityChange(Math.max(0, quantity - 1))}
              disabled={quantity === 0}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="w-6 text-center font-medium">{quantity}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onQuantityChange(Math.min(available, quantity + 1))}
              disabled={quantity >= available}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create date picker component**

Create `components/booking/date-picker.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { differenceInDays, parseISO } from 'date-fns'
import type { DateRange } from 'react-day-picker'

interface BookingDatePickerProps {
  checkInFrom: string
  checkOutUntil: string
  onDatesChange: (checkIn: string | null, checkOut: string | null) => void
}

export function BookingDatePicker({ checkInFrom, checkOutUntil, onDatesChange }: BookingDatePickerProps) {
  const t = useTranslations('booking.step1')
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  const minDate = parseISO(checkInFrom)
  const maxDate = parseISO(checkOutUntil)

  function handleSelect(range: DateRange | undefined) {
    setDateRange(range)
    if (range?.from && range?.to) {
      onDatesChange(
        range.from.toISOString().split('T')[0],
        range.to.toISOString().split('T')[0]
      )
    } else {
      onDatesChange(null, null)
    }
  }

  const nights = dateRange?.from && dateRange?.to
    ? differenceInDays(dateRange.to, dateRange.from)
    : 0

  return (
    <div>
      <Label className="text-base font-medium">{t('selectDates')}</Label>
      <div className="mt-2">
        <Calendar
          mode="range"
          selected={dateRange}
          onSelect={handleSelect}
          disabled={{ before: minDate, after: maxDate }}
          numberOfMonths={2}
          className="rounded-md border"
        />
      </div>
      {nights > 0 && (
        <p className="text-sm text-gray-600 mt-2">
          {t('checkIn')}: {dateRange?.from?.toLocaleDateString()} — {t('checkOut')}: {dateRange?.to?.toLocaleDateString()} ({t('nights', { count: nights })})
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Create Step 1 page**

Create `app/(booking)/[eventSlug]/[hotelSlug]/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Step1Client } from './step1-client'

export default async function BookingStep1Page({
  params,
}: {
  params: Promise<{ eventSlug: string; hotelSlug: string }>
}) {
  const { eventSlug, hotelSlug } = await params
  const supabase = await createClient()

  // Fetch event
  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('slug', eventSlug)
    .eq('status', 'active')
    .single()

  if (!event) notFound()

  // Fetch hotel with room types and conditions
  const { data: hotel } = await supabase
    .from('hotels')
    .select('*, room_types(*, room_pricing(*)), hotel_conditions(*), cancellation_policies(*), payment_conditions(*)')
    .eq('event_id', event.id)
    .eq('slug', hotelSlug)
    .single()

  if (!hotel) notFound()

  return <Step1Client event={event} hotel={hotel} />
}
```

Create `app/(booking)/[eventSlug]/[hotelSlug]/step1-client.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { HotelGallery } from '@/components/booking/hotel-gallery'
import { RoomCard } from '@/components/booking/room-card'
import { BookingDatePicker } from '@/components/booking/date-picker'
import { Button } from '@/components/ui/button'
import type { Event, Hotel, RoomType, RoomPricing } from '@/lib/types'

interface Step1ClientProps {
  event: Event
  hotel: Hotel & {
    room_types: (RoomType & { room_pricing: RoomPricing[] })[]
    hotel_conditions: { payment_scenario: string } | null
  }
}

export function Step1Client({ event, hotel }: Step1ClientProps) {
  const t = useTranslations('booking.step1')
  const router = useRouter()
  const [checkIn, setCheckIn] = useState<string | null>(null)
  const [checkOut, setCheckOut] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  function handleDatesChange(ci: string | null, co: string | null) {
    setCheckIn(ci)
    setCheckOut(co)
  }

  function getAvgPrice(roomType: RoomType & { room_pricing: RoomPricing[] }) {
    if (roomType.room_pricing.length === 0) return 0
    const sum = roomType.room_pricing.reduce((acc, p) => acc + p.price_per_night, 0)
    return sum / roomType.room_pricing.length
  }

  const hasSelection = checkIn && checkOut && Object.values(quantities).some(q => q > 0)

  function handleContinue() {
    // Store selection in sessionStorage and navigate to step 2
    const selection = {
      event_id: event.id,
      hotel_id: hotel.id,
      check_in: checkIn,
      check_out: checkOut,
      rooms: Object.entries(quantities)
        .filter(([_, qty]) => qty > 0)
        .map(([room_type_id, qty]) => ({ room_type_id, quantity: qty })),
    }
    sessionStorage.setItem('booking_selection', JSON.stringify(selection))
    router.push(`/${event.slug}/${hotel.slug}/details`)
  }

  return (
    <div className="space-y-8">
      {/* Event header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold">{event.couple_names}</h1>
        <p className="text-gray-500">{event.name}</p>
      </div>

      {/* Hotel info */}
      <HotelGallery photos={hotel.photos} hotelName={hotel.name} />
      <div>
        <h2 className="text-xl font-bold">{hotel.name}</h2>
        <p className="text-gray-600 mt-1">{hotel.description}</p>
        {hotel.address && <p className="text-sm text-gray-500 mt-1">{hotel.address}</p>}
      </div>

      {/* Date selection */}
      <BookingDatePicker
        checkInFrom={hotel.check_in_from}
        checkOutUntil={hotel.check_out_until}
        onDatesChange={handleDatesChange}
      />

      {/* Room types */}
      <div>
        <h2 className="text-lg font-medium mb-4">{t('selectRoom')}</h2>
        <div className="space-y-4">
          {hotel.room_types.map(rt => (
            <RoomCard
              key={rt.id}
              roomType={rt}
              avgPrice={getAvgPrice(rt)}
              available={rt.inventory} // TODO: calculate real availability based on dates
              quantity={quantities[rt.id] ?? 0}
              onQuantityChange={qty => setQuantities(prev => ({ ...prev, [rt.id]: qty }))}
            />
          ))}
        </div>
      </div>

      {/* Continue button */}
      <div className="sticky bottom-4">
        <Button
          className="w-full h-12 text-lg"
          disabled={!hasSelection}
          onClick={handleContinue}
        >
          {t('continue')}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add "app/(booking)/" components/booking/
git commit -m "feat: add public booking layout and step 1 (room + date selection)"
```

---

### Task 11: Step 2 (guest details) + Step 3 (payment)

**Files:**
- Create: `app/(booking)/[eventSlug]/[hotelSlug]/details/page.tsx`
- Create: `app/(booking)/[eventSlug]/[hotelSlug]/payment/page.tsx`
- Create: `app/(booking)/[eventSlug]/[hotelSlug]/confirmation/page.tsx`
- Create: `components/booking/guest-form.tsx`
- Create: `components/booking/booking-summary.tsx`
- Create: `components/booking/stripe-payment-form.tsx`
- Create: `lib/actions/bookings.ts`

- [ ] **Step 1: Create guest form component**

Create `components/booking/guest-form.tsx`:
```typescript
'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface GuestFormProps {
  onSubmit: (data: GuestData) => void
}

export interface GuestData {
  guest_name: string
  guest_email: string
  guest_phone: string
  guest_dni: string
  guest_nationality: string
  special_requests: string
  adults: number
  children: number
}

export function GuestForm({ onSubmit }: GuestFormProps) {
  const t = useTranslations('booking.step2')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    onSubmit({
      guest_name: fd.get('guest_name') as string,
      guest_email: fd.get('guest_email') as string,
      guest_phone: fd.get('guest_phone') as string,
      guest_dni: fd.get('guest_dni') as string,
      guest_nationality: fd.get('guest_nationality') as string,
      special_requests: fd.get('special_requests') as string,
      adults: parseInt(fd.get('adults') as string) || 2,
      children: parseInt(fd.get('children') as string) || 0,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" id="guest-form">
      <div>
        <Label htmlFor="guest_name">{t('fullName')} *</Label>
        <Input id="guest_name" name="guest_name" required />
      </div>
      <div>
        <Label htmlFor="guest_email">{t('email')} *</Label>
        <Input id="guest_email" name="guest_email" type="email" required />
      </div>
      <div>
        <Label htmlFor="guest_phone">{t('phone')} *</Label>
        <Input id="guest_phone" name="guest_phone" type="tel" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="guest_dni">{t('dni')}</Label>
          <Input id="guest_dni" name="guest_dni" />
        </div>
        <div>
          <Label htmlFor="guest_nationality">{t('nationality')}</Label>
          <Input id="guest_nationality" name="guest_nationality" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="adults">{t('adults') || 'Adultos'}</Label>
          <Input id="adults" name="adults" type="number" min={1} defaultValue={2} />
        </div>
        <div>
          <Label htmlFor="children">{t('children') || 'Niños'}</Label>
          <Input id="children" name="children" type="number" min={0} defaultValue={0} />
        </div>
      </div>
      <div>
        <Label htmlFor="special_requests">{t('specialRequests')}</Label>
        <Textarea id="special_requests" name="special_requests" />
      </div>
      <div className="flex items-start gap-2">
        <input type="checkbox" id="accept" required className="mt-1" />
        <Label htmlFor="accept" className="text-sm font-normal">{t('acceptConditions')}</Label>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Create Stripe payment form**

Create `components/booking/stripe-payment-form.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface StripePaymentFormProps {
  clientSecret: string
  amount: number
  onSuccess: (paymentIntentId: string) => void
  onError: (error: string) => void
  isSetupOnly?: boolean
}

function PaymentForm({ amount, onSuccess, onError, isSetupOnly }: Omit<StripePaymentFormProps, 'clientSecret'>) {
  const t = useTranslations('booking.step3')
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)

    let result
    if (isSetupOnly) {
      result = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: window.location.origin },
        redirect: 'if_required',
      })
    } else {
      result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.origin },
        redirect: 'if_required',
      })
    }

    if (result.error) {
      onError(result.error.message ?? 'Payment failed')
      setLoading(false)
    } else {
      const id = 'paymentIntent' in result ? result.paymentIntent?.id : result.setupIntent?.id
      onSuccess(id ?? '')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" className="w-full h-12" disabled={!stripe || loading}>
        {loading
          ? t('processing')
          : isSetupOnly
            ? t('confirmReservation')
            : t('pay', { amount: `€${amount.toFixed(2)}` })
        }
      </Button>
    </form>
  )
}

export function StripePaymentForm({ clientSecret, amount, onSuccess, onError, isSetupOnly }: StripePaymentFormProps) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
      <PaymentForm amount={amount} onSuccess={onSuccess} onError={onError} isSetupOnly={isSetupOnly} />
    </Elements>
  )
}
```

- [ ] **Step 3: Create booking Server Actions**

Create `lib/actions/bookings.ts`:
```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createBookingSchema, type CreateBookingInput } from '@/lib/validators/booking'
import { calculateBookingTotal } from '@/lib/pricing'
import { checkAvailability } from '@/lib/availability'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function createBooking(input: CreateBookingInput) {
  const parsed = createBookingSchema.parse(input)
  const supabase = createAdminClient()

  // Check availability
  const rooms = parsed.rooms.map(r => ({
    room_type_id: r.room_type_id,
    check_in: r.check_in,
    check_out: r.check_out,
  }))
  const { available, unavailable } = await checkAvailability(rooms)
  if (!available) {
    throw new Error(`Rooms unavailable: ${unavailable.join(', ')}`)
  }

  // Calculate total
  const { total, breakdown } = await calculateBookingTotal(rooms)

  // Get hotel conditions
  const { data: conditions } = await supabase
    .from('hotel_conditions')
    .select('*')
    .eq('hotel_id', parsed.hotel_id)
    .single()

  const paymentScenario = conditions?.payment_scenario ?? 'full_upfront'

  // Get payment conditions for partial payments
  const { data: paymentConditions } = await supabase
    .from('payment_conditions')
    .select('*')
    .eq('hotel_id', parsed.hotel_id)
    .order('installment_number')

  // Calculate amount to charge now
  let chargeNow = total
  let setupForFuture = false

  if (paymentScenario === 'guarantee') {
    chargeNow = 0
    setupForFuture = true
  } else if (paymentScenario === 'partial' || paymentScenario === 'partial_guarantee') {
    const firstInstallment = paymentConditions?.[0]
    if (firstInstallment) {
      chargeNow = total * (firstInstallment.percentage / 100)
    }
    setupForFuture = true
  }

  // Create Stripe customer
  const customer = await stripe.customers.create({
    email: parsed.guest_email,
    name: parsed.guest_name,
    phone: parsed.guest_phone,
    metadata: { hotel_id: parsed.hotel_id },
  })

  // Create payment intent or setup intent
  let clientSecret: string
  let intentType: 'payment' | 'setup'

  if (chargeNow > 0) {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(chargeNow * 100), // cents
      currency: 'eur',
      customer: customer.id,
      setup_future_usage: setupForFuture ? 'off_session' : undefined,
      metadata: { hotel_id: parsed.hotel_id, guest_email: parsed.guest_email },
    })
    clientSecret = paymentIntent.client_secret!
    intentType = 'payment'
  } else {
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      metadata: { hotel_id: parsed.hotel_id, guest_email: parsed.guest_email },
    })
    clientSecret = setupIntent.client_secret!
    intentType = 'setup'
  }

  // Create booking record
  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      hotel_id: parsed.hotel_id,
      guest_name: parsed.guest_name,
      guest_email: parsed.guest_email,
      guest_phone: parsed.guest_phone,
      guest_dni: parsed.guest_dni ?? null,
      guest_nationality: parsed.guest_nationality ?? null,
      special_requests: parsed.special_requests ?? null,
      total_amount: total,
      amount_paid: 0,
      payment_status: paymentScenario === 'guarantee' ? 'guaranteed' : 'pending',
      status: paymentScenario === 'guarantee' ? 'guaranteed' : 'confirmed',
      stripe_customer_id: customer.id,
    })
    .select()
    .single()

  if (error) throw error

  // Create booking rooms
  const bookingRooms = parsed.rooms.map((room, i) => ({
    booking_id: booking.id,
    room_type_id: room.room_type_id,
    check_in: room.check_in,
    check_out: room.check_out,
    adults: room.adults,
    children: room.children,
    price_total: breakdown[i]?.price ?? 0,
  }))

  await supabase.from('booking_rooms').insert(bookingRooms)

  return {
    bookingId: booking.id,
    clientSecret,
    intentType,
    chargeNow,
    total,
    paymentScenario,
  }
}

export async function confirmBookingPayment(bookingId: string, paymentIntentId: string) {
  const supabase = createAdminClient()

  // Get the payment intent to extract payment method
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

  await supabase
    .from('bookings')
    .update({
      amount_paid: (paymentIntent.amount ?? 0) / 100,
      payment_status: 'partial',
      stripe_payment_method_id: paymentIntent.payment_method as string,
    })
    .eq('id', bookingId)

  // Record payment
  await supabase.from('payments').insert({
    booking_id: bookingId,
    amount: (paymentIntent.amount ?? 0) / 100,
    stripe_payment_intent_id: paymentIntentId,
    status: 'succeeded',
    installment_number: 1,
    paid_at: new Date().toISOString(),
  })
}

export async function confirmSetupIntent(bookingId: string, setupIntentId: string) {
  const supabase = createAdminClient()
  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId)

  await supabase
    .from('bookings')
    .update({
      stripe_payment_method_id: setupIntent.payment_method as string,
      payment_status: 'guaranteed',
    })
    .eq('id', bookingId)
}
```

- [ ] **Step 4: Create Step 2 page (details)**

Create `app/(booking)/[eventSlug]/[hotelSlug]/details/page.tsx`:
```typescript
'use client'

import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { GuestForm, type GuestData } from '@/components/booking/guest-form'
import { Button } from '@/components/ui/button'

export default function BookingStep2Page() {
  const t = useTranslations('booking.step2')
  const router = useRouter()
  const params = useParams()

  function handleSubmit(data: GuestData) {
    // Store guest data and navigate to payment
    const existing = JSON.parse(sessionStorage.getItem('booking_selection') ?? '{}')
    sessionStorage.setItem('booking_selection', JSON.stringify({ ...existing, guest: data }))
    router.push(`/${params.eventSlug}/${params.hotelSlug}/payment`)
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      <GuestForm onSubmit={handleSubmit} />
      <Button type="submit" form="guest-form" className="w-full mt-6 h-12">
        {t('continue')}
      </Button>
    </div>
  )
}
```

- [ ] **Step 5: Create Step 3 page (payment)**

Create `app/(booking)/[eventSlug]/[hotelSlug]/payment/page.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { StripePaymentForm } from '@/components/booking/stripe-payment-form'
import { createBooking, confirmBookingPayment, confirmSetupIntent } from '@/lib/actions/bookings'

export default function BookingStep3Page() {
  const t = useTranslations('booking.step3')
  const router = useRouter()
  const params = useParams()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [intentType, setIntentType] = useState<'payment' | 'setup'>('payment')
  const [chargeNow, setChargeNow] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function initPayment() {
      const selection = JSON.parse(sessionStorage.getItem('booking_selection') ?? '{}')
      if (!selection.hotel_id || !selection.guest) {
        router.push(`/${params.eventSlug}/${params.hotelSlug}`)
        return
      }

      try {
        const result = await createBooking({
          hotel_id: selection.hotel_id,
          guest_name: selection.guest.guest_name,
          guest_email: selection.guest.guest_email,
          guest_phone: selection.guest.guest_phone,
          guest_dni: selection.guest.guest_dni,
          guest_nationality: selection.guest.guest_nationality,
          special_requests: selection.guest.special_requests,
          rooms: selection.rooms.map((r: { room_type_id: string; quantity: number }) => ({
            room_type_id: r.room_type_id,
            check_in: selection.check_in,
            check_out: selection.check_out,
            adults: selection.guest.adults,
            children: selection.guest.children,
          })),
          locale: 'es',
        })

        setClientSecret(result.clientSecret)
        setBookingId(result.bookingId)
        setIntentType(result.intentType)
        setChargeNow(result.chargeNow)
        setTotal(result.total)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error creating booking')
      } finally {
        setLoading(false)
      }
    }
    initPayment()
  }, [])

  async function handleSuccess(intentId: string) {
    if (!bookingId) return

    if (intentType === 'payment') {
      await confirmBookingPayment(bookingId, intentId)
    } else {
      await confirmSetupIntent(bookingId, intentId)
    }

    sessionStorage.removeItem('booking_selection')
    router.push(`/${params.eventSlug}/${params.hotelSlug}/confirmation?ref=${bookingId}`)
  }

  if (loading) return <div className="text-center py-12">Cargando...</div>
  if (error) return <div className="text-center py-12 text-red-500">{error}</div>
  if (!clientSecret) return null

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

      <div className="bg-white rounded-lg border p-4 mb-6">
        <h2 className="font-medium mb-2">{t('summary')}</h2>
        <div className="flex justify-between text-sm">
          <span>{t('total')}</span>
          <span className="font-bold">€{total.toFixed(2)}</span>
        </div>
        {chargeNow < total && chargeNow > 0 && (
          <>
            <div className="flex justify-between text-sm text-green-600 mt-1">
              <span>{t('payNow')}</span>
              <span>€{chargeNow.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500 mt-1">
              <span>{t('payLater')}</span>
              <span>€{(total - chargeNow).toFixed(2)}</span>
            </div>
          </>
        )}
      </div>

      <StripePaymentForm
        clientSecret={clientSecret}
        amount={chargeNow}
        onSuccess={handleSuccess}
        onError={setError}
        isSetupOnly={intentType === 'setup'}
      />
      {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 6: Create confirmation page**

Create `app/(booking)/[eventSlug]/[hotelSlug]/confirmation/page.tsx`:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { useTranslations } from 'next-intl'
import { CheckCircle } from 'lucide-react'

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const { ref } = await searchParams
  if (!ref) return <p>Reserva no encontrada</p>

  const supabase = createAdminClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, booking_rooms(*, room_types(name))')
    .eq('id', ref)
    .single()

  if (!booking) return <p>Reserva no encontrada</p>

  return (
    <div className="max-w-lg mx-auto text-center space-y-6">
      <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
      <h1 className="text-2xl font-bold">¡Reserva confirmada!</h1>
      <div className="bg-white rounded-lg border p-4 text-left space-y-2">
        <p><strong>Referencia:</strong> {booking.id.slice(0, 8).toUpperCase()}</p>
        <p><strong>Nombre:</strong> {booking.guest_name}</p>
        <p><strong>Email:</strong> {booking.guest_email}</p>
        <p><strong>Total:</strong> €{booking.total_amount}</p>
        {booking.booking_rooms?.map((room: { id: string; check_in: string; check_out: string; room_types: { name: string } }) => (
          <p key={room.id}>
            <strong>{room.room_types?.name}:</strong> {room.check_in} → {room.check_out}
          </p>
        ))}
      </div>
      <p className="text-gray-500 text-sm">Recibirás un email de confirmación en breve</p>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add "app/(booking)/" components/booking/ lib/actions/bookings.ts
git commit -m "feat: add booking flow steps 2 (guest details) and 3 (Stripe payment)"
```

---

## Phase 4: Stripe Webhooks + Payment Management

### Task 12: Stripe webhook handler

**Files:**
- Create: `app/api/webhooks/stripe/route.ts`
- Create: `lib/stripe/webhooks.ts`
- Create: `lib/stripe/client.ts`

- [ ] **Step 1: Create Stripe client**

Create `lib/stripe/client.ts`:
```typescript
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil',
})
```

- [ ] **Step 2: Create webhook handler**

Create `app/api/webhooks/stripe/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { handlePaymentSucceeded, handlePaymentFailed, handleSetupSucceeded } from '@/lib/stripe/webhooks'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object)
        break
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object)
        break
      case 'setup_intent.succeeded':
        await handleSetupSucceeded(event.data.object)
        break
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 3: Create webhook event handlers**

Create `lib/stripe/webhooks.ts`:
```typescript
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

export async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const supabase = createAdminClient()

  // Find booking by stripe_customer_id
  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('stripe_customer_id', paymentIntent.customer as string)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!booking) return

  const amountPaid = paymentIntent.amount / 100
  const newAmountPaid = booking.amount_paid + amountPaid
  const isPaidInFull = newAmountPaid >= booking.total_amount

  // Update booking
  await supabase
    .from('bookings')
    .update({
      amount_paid: newAmountPaid,
      payment_status: isPaidInFull ? 'paid' : 'partial',
      status: 'confirmed',
      stripe_payment_method_id: paymentIntent.payment_method as string,
    })
    .eq('id', booking.id)

  // Record payment
  const { count } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', booking.id)

  await supabase.from('payments').insert({
    booking_id: booking.id,
    amount: amountPaid,
    stripe_payment_intent_id: paymentIntent.id,
    status: 'succeeded',
    installment_number: (count ?? 0) + 1,
    paid_at: new Date().toISOString(),
  })

  // Create notification for admin
  await supabase.from('notifications').insert({
    admin_user_id: '00000000-0000-0000-0000-000000000000', // Replace with actual admin user ID
    title: 'Pago recibido',
    message: `${booking.guest_name} ha pagado €${amountPaid.toFixed(2)}`,
    type: 'payment_received',
    entity_type: 'booking',
    entity_id: booking.id,
  })

  // TODO: Send confirmation email via Resend
}

export async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('stripe_customer_id', paymentIntent.customer as string)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!booking) return

  // Record failed payment
  await supabase.from('payments').insert({
    booking_id: booking.id,
    amount: paymentIntent.amount / 100,
    stripe_payment_intent_id: paymentIntent.id,
    status: 'failed',
    installment_number: null,
    paid_at: null,
  })

  // Create notification
  await supabase.from('notifications').insert({
    admin_user_id: '00000000-0000-0000-0000-000000000000',
    title: 'Pago fallido',
    message: `Pago fallido para ${booking.guest_name} (€${(paymentIntent.amount / 100).toFixed(2)})`,
    type: 'payment_failed',
    entity_type: 'booking',
    entity_id: booking.id,
  })

  // TODO: Send payment failed email to guest
}

export async function handleSetupSucceeded(setupIntent: Stripe.SetupIntent) {
  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('stripe_customer_id', setupIntent.customer as string)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!booking) return

  await supabase
    .from('bookings')
    .update({
      stripe_payment_method_id: setupIntent.payment_method as string,
      payment_status: 'guaranteed',
      status: 'guaranteed',
    })
    .eq('id', booking.id)
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/webhooks/ lib/stripe/
git commit -m "feat: add Stripe webhook handler (payment succeeded/failed, setup intent)"
```

---

### Task 13: Admin payment actions + cron

**Files:**
- Create: `lib/actions/payments.ts`
- Create: `app/api/cron/payments/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Create payment admin actions**

Create `lib/actions/payments.ts`:
```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { logAudit } from '@/lib/audit'

export async function chargeBooking(bookingId: string, amount: number) {
  const supabase = createAdminClient()
  const serverSupabase = await createClient()
  const { data: { user } } = await serverSupabase.auth.getUser()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (!booking || !booking.stripe_payment_method_id || !booking.stripe_customer_id) {
    throw new Error('Booking not found or no saved payment method')
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: 'eur',
    customer: booking.stripe_customer_id,
    payment_method: booking.stripe_payment_method_id,
    off_session: true,
    confirm: true,
  })

  await logAudit({
    admin_user_id: user!.id,
    action: 'payment.charged',
    entity_type: 'booking',
    entity_id: bookingId,
    details: { amount, payment_intent_id: paymentIntent.id },
  })

  return { success: true, paymentIntentId: paymentIntent.id }
}

export async function refundBooking(bookingId: string, amount: number) {
  const supabase = createAdminClient()
  const serverSupabase = await createClient()
  const { data: { user } } = await serverSupabase.auth.getUser()

  // Get the latest successful payment
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('status', 'succeeded')
    .order('paid_at', { ascending: false })

  if (!payments || payments.length === 0) throw new Error('No payments to refund')

  // Refund from the most recent payment intent
  const refund = await stripe.refunds.create({
    payment_intent: payments[0].stripe_payment_intent_id!,
    amount: Math.round(amount * 100),
  })

  // Update booking
  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (booking) {
    const newRefundAmount = (booking.refund_amount ?? 0) + amount
    const newAmountPaid = booking.amount_paid - amount
    await supabase
      .from('bookings')
      .update({
        refund_amount: newRefundAmount,
        amount_paid: newAmountPaid,
        refund_status: newAmountPaid <= 0 ? 'full' : 'partial',
        payment_status: newAmountPaid <= 0 ? 'refunded' : booking.payment_status,
      })
      .eq('id', bookingId)
  }

  await logAudit({
    admin_user_id: user!.id,
    action: 'payment.refunded',
    entity_type: 'booking',
    entity_id: bookingId,
    details: { amount, refund_id: refund.id },
  })

  return { success: true }
}

export async function activateGroup(hotelId: string) {
  const supabase = createAdminClient()
  const serverSupabase = await createClient()
  const { data: { user } } = await serverSupabase.auth.getUser()

  // Get all guaranteed bookings for this hotel
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('status', 'guaranteed')

  if (!bookings || bookings.length === 0) throw new Error('No guaranteed bookings to charge')

  const results: { bookingId: string; success: boolean; error?: string }[] = []

  for (const booking of bookings) {
    try {
      if (!booking.stripe_payment_method_id || !booking.stripe_customer_id) {
        results.push({ bookingId: booking.id, success: false, error: 'No payment method' })
        continue
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(booking.total_amount * 100),
        currency: 'eur',
        customer: booking.stripe_customer_id,
        payment_method: booking.stripe_payment_method_id,
        off_session: true,
        confirm: true,
      })

      await supabase
        .from('bookings')
        .update({ status: 'charged', payment_status: 'paid', amount_paid: booking.total_amount })
        .eq('id', booking.id)

      await supabase.from('payments').insert({
        booking_id: booking.id,
        amount: booking.total_amount,
        stripe_payment_intent_id: paymentIntent.id,
        status: 'succeeded',
        installment_number: 1,
        paid_at: new Date().toISOString(),
      })

      results.push({ bookingId: booking.id, success: true })
    } catch (err: unknown) {
      results.push({ bookingId: booking.id, success: false, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  // Mark hotel conditions as activated
  await supabase
    .from('hotel_conditions')
    .update({ is_activated: true })
    .eq('hotel_id', hotelId)

  await logAudit({
    admin_user_id: user!.id,
    action: 'group.activated',
    entity_type: 'hotel',
    entity_id: hotelId,
    details: { results },
  })

  return results
}

export async function cancelGroup(hotelId: string) {
  const supabase = createAdminClient()
  const serverSupabase = await createClient()
  const { data: { user } } = await serverSupabase.auth.getUser()

  await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: 'Grupo cancelado' })
    .eq('hotel_id', hotelId)
    .eq('status', 'guaranteed')

  await logAudit({
    admin_user_id: user!.id,
    action: 'group.cancelled',
    entity_type: 'hotel',
    entity_id: hotelId,
  })
}
```

- [ ] **Step 2: Create daily payment cron**

Create `app/api/cron/payments/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/client'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Find payment conditions due today
  const { data: dueConditions } = await supabase
    .from('payment_conditions')
    .select('*, hotels(id)')
    .eq('due_date', today)

  if (!dueConditions || dueConditions.length === 0) {
    return NextResponse.json({ message: 'No payments due today' })
  }

  const results: { hotel_id: string; charged: number; failed: number }[] = []

  for (const condition of dueConditions) {
    const hotelId = condition.hotel_id

    // Get bookings with saved cards that haven't been fully paid
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('hotel_id', hotelId)
      .in('payment_status', ['partial', 'guaranteed'])
      .not('stripe_payment_method_id', 'is', null)
      .neq('status', 'cancelled')

    let charged = 0
    let failed = 0

    for (const booking of bookings ?? []) {
      const amountDue = booking.total_amount * (condition.percentage / 100)
      try {
        await stripe.paymentIntents.create({
          amount: Math.round(amountDue * 100),
          currency: 'eur',
          customer: booking.stripe_customer_id!,
          payment_method: booking.stripe_payment_method_id!,
          off_session: true,
          confirm: true,
        })
        charged++
      } catch {
        failed++
      }
    }

    results.push({ hotel_id: hotelId, charged, failed })
  }

  return NextResponse.json({ results })
}
```

- [ ] **Step 3: Create Vercel cron config**

Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/payments",
      "schedule": "0 8 * * *"
    }
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/actions/payments.ts app/api/cron/ vercel.json
git commit -m "feat: add payment admin actions (charge, refund, group activation) and daily cron"
```

---

## Phase 5: Rooming List + Exports

### Task 14: Rooming list view + PDF/Excel export

**Files:**
- Create: `app/(admin)/rooming-list/page.tsx`
- Create: `components/admin/rooming-list-table.tsx`
- Create: `lib/exports/pdf.tsx`
- Create: `lib/exports/excel.ts`
- Create: `app/api/exports/pdf/route.ts`
- Create: `app/api/exports/excel/route.ts`

- [ ] **Step 1: Create rooming list page**

Create `app/(admin)/rooming-list/page.tsx`:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { RoomingListTable } from '@/components/admin/rooming-list-table'

export default async function RoomingListPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; hotel?: string }>
}) {
  const { event, hotel } = await searchParams
  const supabase = createAdminClient()

  // Fetch events for filter
  const { data: events } = await supabase.from('events').select('id, name').eq('status', 'active')

  // Fetch bookings with rooms
  let query = supabase
    .from('bookings')
    .select('*, booking_rooms(*, room_types(name, meal_plan)), hotels(name, event_id, events(name))')
    .neq('status', 'cancelled')
    .order('booking_date', { ascending: false })

  if (hotel) {
    query = query.eq('hotel_id', hotel)
  } else if (event) {
    query = query.eq('hotels.event_id', event)
  }

  const { data: bookings } = await query

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Rooming List</h1>
      <RoomingListTable bookings={bookings ?? []} events={events ?? []} selectedEvent={event} selectedHotel={hotel} />
    </div>
  )
}
```

- [ ] **Step 2: Create rooming list table component**

Create `components/admin/rooming-list-table.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface RoomingListTableProps {
  bookings: Array<{
    id: string
    guest_name: string
    guest_email: string
    guest_phone: string
    guest_dni: string | null
    guest_nationality: string | null
    special_requests: string | null
    payment_status: string
    total_amount: number
    amount_paid: number
    booking_date: string
    booking_rooms: Array<{
      check_in: string
      check_out: string
      adults: number
      children: number
      room_types: { name: string; meal_plan: string }
    }>
    hotels: { name: string }
  }>
  events: Array<{ id: string; name: string }>
  selectedEvent?: string
  selectedHotel?: string
}

export function RoomingListTable({ bookings, events, selectedEvent, selectedHotel }: RoomingListTableProps) {
  const [downloading, setDownloading] = useState(false)

  async function handleExport(type: 'pdf' | 'excel') {
    setDownloading(true)
    const params = new URLSearchParams()
    if (selectedEvent) params.set('event', selectedEvent)
    if (selectedHotel) params.set('hotel', selectedHotel)

    const response = await fetch(`/api/exports/${type}?${params}`)
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rooming-list.${type === 'pdf' ? 'pdf' : 'xlsx'}`
    a.click()
    window.URL.revokeObjectURL(url)
    setDownloading(false)
  }

  return (
    <div>
      {/* Filters + Export */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <Select defaultValue={selectedEvent ?? ''}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar por evento" /></SelectTrigger>
            <SelectContent>
              {events.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('pdf')} disabled={downloading}>
            <Download className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button variant="outline" onClick={() => handleExport('excel')} disabled={downloading}>
            <Download className="w-4 h-4 mr-2" /> Excel
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="p-3 text-left">Nombre</th>
              <th className="p-3 text-left">Habitación</th>
              <th className="p-3 text-left">Check-in</th>
              <th className="p-3 text-left">Check-out</th>
              <th className="p-3 text-left">Adultos/Niños</th>
              <th className="p-3 text-left">DNI</th>
              <th className="p-3 text-left">Nacionalidad</th>
              <th className="p-3 text-left">Régimen</th>
              <th className="p-3 text-left">Pago</th>
              <th className="p-3 text-left">Requests</th>
            </tr>
          </thead>
          <tbody>
            {bookings.flatMap(booking =>
              booking.booking_rooms.map((room, i) => (
                <tr key={`${booking.id}-${i}`} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3">{booking.guest_name}</td>
                  <td className="p-3">{room.room_types.name}</td>
                  <td className="p-3">{room.check_in}</td>
                  <td className="p-3">{room.check_out}</td>
                  <td className="p-3">{room.adults}/{room.children}</td>
                  <td className="p-3">{booking.guest_dni ?? '-'}</td>
                  <td className="p-3">{booking.guest_nationality ?? '-'}</td>
                  <td className="p-3">{room.room_types.meal_plan}</td>
                  <td className="p-3">
                    <Badge variant={booking.payment_status === 'paid' ? 'default' : 'secondary'}>
                      {booking.payment_status}
                    </Badge>
                  </td>
                  <td className="p-3 max-w-[150px] truncate">{booking.special_requests ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create PDF export**

Create `lib/exports/pdf.tsx`:
```typescript
import { renderToBuffer } from '@react-pdf/renderer'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 8 },
  title: { fontSize: 16, marginBottom: 10, fontWeight: 'bold' },
  subtitle: { fontSize: 10, marginBottom: 20, color: '#666' },
  table: { width: '100%' },
  row: { flexDirection: 'row', borderBottom: '1px solid #eee', paddingVertical: 4 },
  headerRow: { flexDirection: 'row', borderBottom: '2px solid #333', paddingBottom: 6, marginBottom: 4 },
  cell: { flex: 1, paddingHorizontal: 2 },
  headerCell: { flex: 1, paddingHorizontal: 2, fontWeight: 'bold' },
})

interface RoomingEntry {
  guest_name: string
  room_name: string
  check_in: string
  check_out: string
  adults: number
  children: number
  guest_dni: string
  nationality: string
  meal_plan: string
  payment_status: string
  special_requests: string
}

export async function generateRoomingListPDF(entries: RoomingEntry[], hotelName: string): Promise<Buffer> {
  const doc = (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Rooming List - {hotelName}</Text>
        <Text style={styles.subtitle}>Generado: {new Date().toLocaleDateString('es-ES')}</Text>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, { flex: 2 }]}>Nombre</Text>
            <Text style={styles.headerCell}>Habitación</Text>
            <Text style={styles.headerCell}>Check-in</Text>
            <Text style={styles.headerCell}>Check-out</Text>
            <Text style={styles.headerCell}>Pax</Text>
            <Text style={styles.headerCell}>DNI</Text>
            <Text style={styles.headerCell}>Nacional.</Text>
            <Text style={styles.headerCell}>Régimen</Text>
            <Text style={styles.headerCell}>Pago</Text>
          </View>
          {entries.map((entry, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.cell, { flex: 2 }]}>{entry.guest_name}</Text>
              <Text style={styles.cell}>{entry.room_name}</Text>
              <Text style={styles.cell}>{entry.check_in}</Text>
              <Text style={styles.cell}>{entry.check_out}</Text>
              <Text style={styles.cell}>{entry.adults}+{entry.children}</Text>
              <Text style={styles.cell}>{entry.guest_dni}</Text>
              <Text style={styles.cell}>{entry.nationality}</Text>
              <Text style={styles.cell}>{entry.meal_plan}</Text>
              <Text style={styles.cell}>{entry.payment_status}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )

  return await renderToBuffer(doc)
}
```

- [ ] **Step 4: Create Excel export**

Create `lib/exports/excel.ts`:
```typescript
import ExcelJS from 'exceljs'

interface RoomingEntry {
  guest_name: string
  room_name: string
  check_in: string
  check_out: string
  adults: number
  children: number
  guest_dni: string
  nationality: string
  meal_plan: string
  payment_status: string
  special_requests: string
  booking_date: string
  amount_paid: number
  total_amount: number
}

export async function generateRoomingListExcel(entries: RoomingEntry[], hotelName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Rooming List')

  // Header
  sheet.columns = [
    { header: 'Nombre', key: 'guest_name', width: 25 },
    { header: 'Habitación', key: 'room_name', width: 20 },
    { header: 'Check-in', key: 'check_in', width: 12 },
    { header: 'Check-out', key: 'check_out', width: 12 },
    { header: 'Adultos', key: 'adults', width: 8 },
    { header: 'Niños', key: 'children', width: 8 },
    { header: 'DNI', key: 'guest_dni', width: 15 },
    { header: 'Nacionalidad', key: 'nationality', width: 12 },
    { header: 'Régimen', key: 'meal_plan', width: 18 },
    { header: 'Estado pago', key: 'payment_status', width: 12 },
    { header: 'Pagado', key: 'amount_paid', width: 10 },
    { header: 'Total', key: 'total_amount', width: 10 },
    { header: 'Fecha reserva', key: 'booking_date', width: 12 },
    { header: 'Peticiones', key: 'special_requests', width: 30 },
  ]

  // Style header
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }

  // Data
  entries.forEach(entry => sheet.addRow(entry))

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
```

- [ ] **Step 5: Create export API routes**

Create `app/api/exports/pdf/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateRoomingListPDF } from '@/lib/exports/pdf'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const hotelId = searchParams.get('hotel')
  const eventId = searchParams.get('event')

  const supabase = createAdminClient()

  let query = supabase
    .from('bookings')
    .select('*, booking_rooms(*, room_types(name, meal_plan)), hotels(name)')
    .neq('status', 'cancelled')

  if (hotelId) query = query.eq('hotel_id', hotelId)

  const { data: bookings } = await query

  const entries = (bookings ?? []).flatMap(b =>
    b.booking_rooms.map((r: { room_types: { name: string; meal_plan: string }; check_in: string; check_out: string; adults: number; children: number }) => ({
      guest_name: b.guest_name,
      room_name: r.room_types.name,
      check_in: r.check_in,
      check_out: r.check_out,
      adults: r.adults,
      children: r.children,
      guest_dni: b.guest_dni ?? '',
      nationality: b.guest_nationality ?? '',
      meal_plan: r.room_types.meal_plan,
      payment_status: b.payment_status,
      special_requests: b.special_requests ?? '',
    }))
  )

  const hotelName = bookings?.[0]?.hotels?.name ?? 'Hotel'
  const buffer = await generateRoomingListPDF(entries, hotelName)

  // Store in Supabase Storage
  const filename = `rooming-list-${Date.now()}.pdf`
  await supabase.storage.from('exports').upload(filename, buffer, { contentType: 'application/pdf' })

  // Record export
  if (eventId || hotelId) {
    const { data: hotel } = hotelId ? await supabase.from('hotels').select('event_id').eq('id', hotelId).single() : { data: null }
    await supabase.from('exports').insert({
      event_id: eventId ?? hotel?.event_id,
      hotel_id: hotelId,
      type: 'pdf',
      file_url: filename,
    })
  }

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
```

Create `app/api/exports/excel/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateRoomingListExcel } from '@/lib/exports/excel'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const hotelId = searchParams.get('hotel')
  const eventId = searchParams.get('event')

  const supabase = createAdminClient()

  let query = supabase
    .from('bookings')
    .select('*, booking_rooms(*, room_types(name, meal_plan)), hotels(name)')
    .neq('status', 'cancelled')

  if (hotelId) query = query.eq('hotel_id', hotelId)

  const { data: bookings } = await query

  const entries = (bookings ?? []).flatMap(b =>
    b.booking_rooms.map((r: { room_types: { name: string; meal_plan: string }; check_in: string; check_out: string; adults: number; children: number }) => ({
      guest_name: b.guest_name,
      room_name: r.room_types.name,
      check_in: r.check_in,
      check_out: r.check_out,
      adults: r.adults,
      children: r.children,
      guest_dni: b.guest_dni ?? '',
      nationality: b.guest_nationality ?? '',
      meal_plan: r.room_types.meal_plan,
      payment_status: b.payment_status,
      amount_paid: b.amount_paid,
      total_amount: b.total_amount,
      booking_date: b.booking_date,
      special_requests: b.special_requests ?? '',
    }))
  )

  const hotelName = bookings?.[0]?.hotels?.name ?? 'Hotel'
  const buffer = await generateRoomingListExcel(entries, hotelName)

  // Store in Supabase Storage
  const filename = `rooming-list-${Date.now()}.xlsx`
  await supabase.storage.from('exports').upload(filename, buffer, {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/rooming-list/" components/admin/rooming-list-table.tsx lib/exports/ app/api/exports/
git commit -m "feat: add rooming list with PDF and Excel export"
```

---

## Phase 6: Emails

### Task 15: Email templates + sending

**Files:**
- Create: `lib/email/send.ts`
- Create: `lib/email/templates/booking-confirmation.tsx`
- Create: `lib/email/templates/payment-receipt.tsx`
- Create: `lib/email/templates/payment-failed.tsx`

- [ ] **Step 1: Create email send helper**

Create `lib/email/send.ts`:
```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface SendEmailOptions {
  to: string
  subject: string
  react: React.ReactElement
}

export async function sendEmail({ to, subject, react }: SendEmailOptions) {
  const { data, error } = await resend.emails.send({
    from: 'StayForEvents <reservas@stayforevents.com>',
    to,
    subject,
    react,
  })

  if (error) {
    console.error('Email send error:', error)
    throw error
  }

  return data
}
```

- [ ] **Step 2: Create booking confirmation template**

Create `lib/email/templates/booking-confirmation.tsx`:
```typescript
import { Html, Head, Body, Container, Section, Text, Hr, Row, Column } from '@react-email/components'

interface BookingConfirmationProps {
  guestName: string
  reference: string
  hotelName: string
  rooms: { name: string; checkIn: string; checkOut: string }[]
  totalAmount: number
  amountPaid: number
  cancellationPolicy: string
}

export function BookingConfirmationEmail({
  guestName, reference, hotelName, rooms, totalAmount, amountPaid, cancellationPolicy,
}: BookingConfirmationProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9fafb' }}>
        <Container style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
          <Section style={{ backgroundColor: '#fff', padding: 30, borderRadius: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold' }}>¡Reserva confirmada!</Text>
            <Text>Hola {guestName},</Text>
            <Text>Tu reserva ha sido confirmada correctamente.</Text>

            <Hr />

            <Text style={{ fontWeight: 'bold' }}>Referencia: {reference}</Text>
            <Text>Hotel: {hotelName}</Text>

            {rooms.map((room, i) => (
              <Row key={i}>
                <Column><Text>{room.name}: {room.checkIn} → {room.checkOut}</Text></Column>
              </Row>
            ))}

            <Hr />

            <Text>Total: €{totalAmount.toFixed(2)}</Text>
            <Text>Pagado: €{amountPaid.toFixed(2)}</Text>
            {amountPaid < totalAmount && (
              <Text>Pendiente: €{(totalAmount - amountPaid).toFixed(2)}</Text>
            )}

            <Hr />

            <Text style={{ fontSize: 12, color: '#666' }}>Política de cancelación: {cancellationPolicy}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 3: Create payment receipt and failed templates**

Create `lib/email/templates/payment-receipt.tsx`:
```typescript
import { Html, Head, Body, Container, Section, Text, Hr } from '@react-email/components'

interface PaymentReceiptProps {
  guestName: string
  amount: number
  reference: string
  installment: number
  remaining: number
}

export function PaymentReceiptEmail({ guestName, amount, reference, installment, remaining }: PaymentReceiptProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9fafb' }}>
        <Container style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
          <Section style={{ backgroundColor: '#fff', padding: 30, borderRadius: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Recibo de pago</Text>
            <Text>Hola {guestName},</Text>
            <Text>Hemos recibido tu pago correctamente.</Text>
            <Hr />
            <Text>Referencia: {reference}</Text>
            <Text>Cuota #{installment}: €{amount.toFixed(2)}</Text>
            {remaining > 0 && <Text>Pendiente: €{remaining.toFixed(2)}</Text>}
            {remaining <= 0 && <Text style={{ color: 'green' }}>✓ Reserva completamente pagada</Text>}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
```

Create `lib/email/templates/payment-failed.tsx`:
```typescript
import { Html, Head, Body, Container, Section, Text, Hr, Link } from '@react-email/components'

interface PaymentFailedProps {
  guestName: string
  amount: number
  reference: string
  retryUrl: string
}

export function PaymentFailedEmail({ guestName, amount, reference, retryUrl }: PaymentFailedProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9fafb' }}>
        <Container style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
          <Section style={{ backgroundColor: '#fff', padding: 30, borderRadius: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Problema con tu pago</Text>
            <Text>Hola {guestName},</Text>
            <Text>No hemos podido procesar el cobro de €{amount.toFixed(2)} para tu reserva {reference}.</Text>
            <Hr />
            <Text>Por favor, actualiza tu método de pago:</Text>
            <Link href={retryUrl} style={{ color: '#2563eb', fontWeight: 'bold' }}>Actualizar método de pago</Link>
            <Hr />
            <Text style={{ fontSize: 12, color: '#666' }}>Si tienes dudas, contacta con nosotros.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/email/
git commit -m "feat: add email templates and Resend integration"
```

---

## Phase 7: Remaining Admin Pages

### Task 16: Dashboard + Bookings management + Statistics

**Files:**
- Create: `app/(admin)/dashboard/page.tsx`
- Create: `app/(admin)/bookings/page.tsx`
- Create: `app/(admin)/bookings/[bookingId]/page.tsx`
- Create: `app/(admin)/statistics/page.tsx`
- Create: `app/(admin)/audit-log/page.tsx`
- Create: `app/(admin)/waitlist/page.tsx`

- [ ] **Step 1: Create admin dashboard**

Create `app/(admin)/dashboard/page.tsx`:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Hotel, BookOpen, CreditCard, AlertTriangle } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = createAdminClient()

  const [
    { count: eventCount },
    { count: bookingCount },
    { data: recentBookings },
    { data: pendingPayments },
  ] = await Promise.all([
    supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).neq('status', 'cancelled'),
    supabase.from('bookings').select('*, hotels(name)').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(5),
    supabase.from('bookings').select('*').in('payment_status', ['pending', 'partial']).neq('status', 'cancelled').limit(10),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Eventos activos</CardTitle>
            <Calendar className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{eventCount ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total reservas</CardTitle>
            <BookOpen className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{bookingCount ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pagos pendientes</CardTitle>
            <CreditCard className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{pendingPayments?.length ?? 0}</p></CardContent>
        </Card>
      </div>

      {/* Recent bookings */}
      <Card>
        <CardHeader><CardTitle>Reservas recientes</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentBookings?.map(b => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{b.guest_name}</p>
                  <p className="text-sm text-gray-500">{b.hotels?.name}</p>
                </div>
                <Badge>{b.payment_status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Create bookings list page**

Create `app/(admin)/bookings/page.tsx`:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default async function BookingsPage() {
  const supabase = createAdminClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, hotels(name, events(name)), booking_rooms(count)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reservas</h1>
      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="p-3 text-left">Huésped</th>
              <th className="p-3 text-left">Hotel</th>
              <th className="p-3 text-left">Evento</th>
              <th className="p-3 text-left">Total</th>
              <th className="p-3 text-left">Pagado</th>
              <th className="p-3 text-left">Estado</th>
              <th className="p-3 text-left">Fecha</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {bookings?.map(b => (
              <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="p-3">{b.guest_name}</td>
                <td className="p-3">{b.hotels?.name}</td>
                <td className="p-3">{b.hotels?.events?.name}</td>
                <td className="p-3">€{b.total_amount}</td>
                <td className="p-3">€{b.amount_paid}</td>
                <td className="p-3"><Badge>{b.payment_status}</Badge></td>
                <td className="p-3">{new Date(b.booking_date).toLocaleDateString('es-ES')}</td>
                <td className="p-3">
                  <Link href={`/admin/bookings/${b.id}`}>
                    <Button variant="ghost" size="sm">Ver</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create booking detail page with actions**

Create `app/(admin)/bookings/[bookingId]/page.tsx`:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PaymentActions } from '@/components/admin/payment-actions'

export default async function BookingDetailPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params
  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, booking_rooms(*, room_types(name)), hotels(name), payments(*), booking_modifications(*)')
    .eq('id', bookingId)
    .single()

  if (!booking) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reserva: {booking.guest_name}</h1>
        <Badge variant={booking.status === 'cancelled' ? 'destructive' : 'default'}>{booking.status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Guest info */}
        <Card>
          <CardHeader><CardTitle>Datos huésped</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><strong>Nombre:</strong> {booking.guest_name}</p>
            <p><strong>Email:</strong> {booking.guest_email}</p>
            <p><strong>Teléfono:</strong> {booking.guest_phone}</p>
            <p><strong>DNI:</strong> {booking.guest_dni ?? '-'}</p>
            <p><strong>Nacionalidad:</strong> {booking.guest_nationality ?? '-'}</p>
            <p><strong>Peticiones:</strong> {booking.special_requests ?? '-'}</p>
          </CardContent>
        </Card>

        {/* Payment info */}
        <Card>
          <CardHeader><CardTitle>Pagos</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>Total:</strong> €{booking.total_amount}</p>
            <p><strong>Pagado:</strong> €{booking.amount_paid}</p>
            <p><strong>Pendiente:</strong> €{(booking.total_amount - booking.amount_paid).toFixed(2)}</p>
            <p><strong>Estado:</strong> <Badge>{booking.payment_status}</Badge></p>
            {booking.refund_amount > 0 && <p><strong>Reembolsado:</strong> €{booking.refund_amount}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Rooms */}
      <Card>
        <CardHeader><CardTitle>Habitaciones</CardTitle></CardHeader>
        <CardContent>
          {booking.booking_rooms?.map((room: { id: string; room_types: { name: string }; check_in: string; check_out: string; adults: number; children: number; price_total: number }) => (
            <div key={room.id} className="flex justify-between py-2 border-b last:border-0">
              <div>
                <p className="font-medium">{room.room_types?.name}</p>
                <p className="text-sm text-gray-500">{room.check_in} → {room.check_out} | {room.adults}A/{room.children}N</p>
              </div>
              <p className="font-medium">€{room.price_total}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Payment actions */}
      <PaymentActions bookingId={bookingId} booking={booking} />

      {/* Payment history */}
      <Card>
        <CardHeader><CardTitle>Historial de pagos</CardTitle></CardHeader>
        <CardContent>
          {booking.payments?.map((p: { id: string; amount: number; status: string; paid_at: string; installment_number: number }) => (
            <div key={p.id} className="flex justify-between py-2 border-b last:border-0 text-sm">
              <span>Cuota #{p.installment_number} — €{p.amount}</span>
              <span><Badge variant={p.status === 'succeeded' ? 'default' : 'destructive'}>{p.status}</Badge></span>
              <span>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('es-ES') : '-'}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Admin notes */}
      <Card>
        <CardHeader><CardTitle>Notas admin</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm">{booking.admin_notes ?? 'Sin notas'}</p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Create payment actions component**

Create `components/admin/payment-actions.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { chargeBooking, refundBooking } from '@/lib/actions/payments'
import type { Booking } from '@/lib/types'

interface PaymentActionsProps {
  bookingId: string
  booking: Booking
}

export function PaymentActions({ bookingId, booking }: PaymentActionsProps) {
  const [chargeAmount, setChargeAmount] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const canCharge = booking.stripe_payment_method_id && booking.amount_paid < booking.total_amount && booking.status !== 'cancelled'
  const canRefund = booking.amount_paid > 0

  async function handleCharge() {
    setLoading(true)
    try {
      await chargeBooking(bookingId, parseFloat(chargeAmount))
      setMessage('Cobro realizado')
      setChargeAmount('')
      window.location.reload()
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Error')
    }
    setLoading(false)
  }

  async function handleRefund() {
    setLoading(true)
    try {
      await refundBooking(bookingId, parseFloat(refundAmount))
      setMessage('Reembolso realizado')
      setRefundAmount('')
      window.location.reload()
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Error')
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-lg border p-4 space-y-4">
      <h3 className="font-medium">Acciones de pago</h3>

      {canCharge && (
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            step="0.01"
            placeholder="Cantidad a cobrar"
            value={chargeAmount}
            onChange={e => setChargeAmount(e.target.value)}
            className="w-48"
          />
          <Button onClick={handleCharge} disabled={loading || !chargeAmount}>
            Cobrar
          </Button>
        </div>
      )}

      {canRefund && (
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            step="0.01"
            placeholder="Cantidad a reembolsar"
            value={refundAmount}
            onChange={e => setRefundAmount(e.target.value)}
            className="w-48"
          />
          <Button variant="destructive" onClick={handleRefund} disabled={loading || !refundAmount}>
            Reembolsar
          </Button>
        </div>
      )}

      {message && <p className="text-sm text-green-600">{message}</p>}
    </div>
  )
}
```

- [ ] **Step 5: Create waitlist + audit log pages**

Create `app/(admin)/waitlist/page.tsx`:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'

export default async function WaitlistPage() {
  const supabase = createAdminClient()
  const { data: entries } = await supabase
    .from('waitlist')
    .select('*, hotels(name), room_types(name)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Lista de espera</h1>
      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="p-3 text-left">Nombre</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Hotel</th>
              <th className="p-3 text-left">Tipo hab.</th>
              <th className="p-3 text-left">Fechas</th>
              <th className="p-3 text-left">Estado</th>
            </tr>
          </thead>
          <tbody>
            {entries?.map(e => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="p-3">{e.guest_name}</td>
                <td className="p-3">{e.guest_email}</td>
                <td className="p-3">{e.hotels?.name}</td>
                <td className="p-3">{e.room_types?.name ?? 'Cualquiera'}</td>
                <td className="p-3">{e.requested_check_in} → {e.requested_check_out}</td>
                <td className="p-3"><Badge>{e.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

Create `app/(admin)/audit-log/page.tsx`:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'

export default async function AuditLogPage() {
  const supabase = createAdminClient()
  const { data: logs } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Auditoría</h1>
      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="p-3 text-left">Fecha</th>
              <th className="p-3 text-left">Acción</th>
              <th className="p-3 text-left">Entidad</th>
              <th className="p-3 text-left">Detalles</th>
            </tr>
          </thead>
          <tbody>
            {logs?.map(log => (
              <tr key={log.id} className="border-b last:border-0">
                <td className="p-3">{new Date(log.created_at).toLocaleString('es-ES')}</td>
                <td className="p-3 font-mono text-xs">{log.action}</td>
                <td className="p-3">{log.entity_type} / {log.entity_id?.slice(0, 8)}</td>
                <td className="p-3 text-xs max-w-[300px] truncate">{JSON.stringify(log.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/dashboard/" "app/(admin)/bookings/" "app/(admin)/statistics/" "app/(admin)/audit-log/" "app/(admin)/waitlist/" components/admin/payment-actions.tsx
git commit -m "feat: add admin dashboard, bookings management, waitlist, and audit log"
```

---

## Phase 8: Final integrations

### Task 17: Waitlist public form + Communications page

**Files:**
- Create: `app/(booking)/[eventSlug]/[hotelSlug]/waitlist/page.tsx`
- Create: `lib/actions/waitlist.ts`
- Create: `app/(admin)/communications/page.tsx`
- Create: `lib/actions/communications.ts`

- [ ] **Step 1: Create waitlist Server Actions**

Create `lib/actions/waitlist.ts`:
```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { waitlistSchema, type WaitlistInput } from '@/lib/validators/booking'

export async function joinWaitlist(input: WaitlistInput) {
  const parsed = waitlistSchema.parse(input)
  const supabase = createAdminClient()

  const { error } = await supabase.from('waitlist').insert(parsed)
  if (error) throw error

  // Create admin notification
  await supabase.from('notifications').insert({
    admin_user_id: '00000000-0000-0000-0000-000000000000',
    title: 'Nueva entrada en lista de espera',
    message: `${parsed.guest_name} (${parsed.guest_email}) se ha apuntado`,
    type: 'waitlist_new',
    entity_type: 'waitlist',
  })

  return { success: true }
}
```

- [ ] **Step 2: Create waitlist public page**

Create `app/(booking)/[eventSlug]/[hotelSlug]/waitlist/page.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { joinWaitlist } from '@/lib/actions/waitlist'

export default function WaitlistPage() {
  const t = useTranslations('booking.waitlist')
  const params = useParams()
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)

    await joinWaitlist({
      hotel_id: fd.get('hotel_id') as string,
      guest_name: fd.get('guest_name') as string,
      guest_email: fd.get('guest_email') as string,
      guest_phone: fd.get('guest_phone') as string,
      requested_check_in: fd.get('check_in') as string,
      requested_check_out: fd.get('check_out') as string,
    })

    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="text-center py-12">
        <p className="text-lg font-medium text-green-600">{t('success')}</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
      <p className="text-gray-600 mb-6">{t('joinWaitlist')}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="hotel_id" value="" /> {/* Set from context */}
        <div>
          <Label>Nombre completo *</Label>
          <Input name="guest_name" required />
        </div>
        <div>
          <Label>Email *</Label>
          <Input name="guest_email" type="email" required />
        </div>
        <div>
          <Label>Teléfono</Label>
          <Input name="guest_phone" type="tel" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Check-in deseado</Label>
            <Input name="check_in" type="date" />
          </div>
          <div>
            <Label>Check-out deseado</Label>
            <Input name="check_out" type="date" />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Enviando...' : t('submit')}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Create communications page**

Create `lib/actions/communications.ts`:
```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { Html, Text, Body, Container, Section } from '@react-email/components'
import React from 'react'

export async function sendMassEmail(hotelId: string, subject: string, body: string) {
  const supabase = createAdminClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('guest_email, guest_name')
    .eq('hotel_id', hotelId)
    .neq('status', 'cancelled')

  if (!bookings || bookings.length === 0) return { sent: 0 }

  let sent = 0
  for (const booking of bookings) {
    try {
      await sendEmail({
        to: booking.guest_email,
        subject,
        react: React.createElement(
          Html, null,
          React.createElement(Body, { style: { fontFamily: 'sans-serif' } },
            React.createElement(Container, { style: { maxWidth: 600, margin: '0 auto', padding: 20 } },
              React.createElement(Section, { style: { backgroundColor: '#fff', padding: 30, borderRadius: 8 } },
                React.createElement(Text, null, `Hola ${booking.guest_name},`),
                React.createElement(Text, null, body)
              )
            )
          )
        ),
      })
      sent++
    } catch (err) {
      console.error(`Failed to send to ${booking.guest_email}:`, err)
    }
  }

  return { sent, total: bookings.length }
}
```

Create `app/(admin)/communications/page.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { sendMassEmail } from '@/lib/actions/communications'

export default function CommunicationsPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)

    const res = await sendMassEmail(
      fd.get('hotel_id') as string,
      fd.get('subject') as string,
      fd.get('body') as string
    )

    setResult(`Enviados: ${res.sent}/${res.total}`)
    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Comunicaciones</h1>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <div>
          <Label>Hotel ID</Label>
          <Input name="hotel_id" required placeholder="UUID del hotel" />
        </div>
        <div>
          <Label>Asunto</Label>
          <Input name="subject" required />
        </div>
        <div>
          <Label>Mensaje</Label>
          <Textarea name="body" rows={6} required />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar a todos los huéspedes'}
        </Button>
        {result && <p className="text-sm text-green-600">{result}</p>}
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add "app/(booking)/*/waitlist/" lib/actions/waitlist.ts "app/(admin)/communications/" lib/actions/communications.ts
git commit -m "feat: add waitlist public form and mass communications page"
```

---

### Task 18: Final polish — root layout, 404, global styles

**Files:**
- Create: `app/layout.tsx`
- Create: `app/not-found.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Create root layout**

Create `app/layout.tsx`:
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'StayForEvents - Booking',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Create 404 page**

Create `app/not-found.tsx`:
```typescript
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-gray-500 mb-6">Página no encontrada</p>
        <Link href="/admin/dashboard">
          <Button>Volver al panel</Button>
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx app/not-found.tsx app/globals.css
git commit -m "feat: add root layout, 404 page, and global styles"
```

---

### Task 19: Deploy configuration

**Files:**
- Verify: `vercel.json`
- Verify: `.env.local.example`

- [ ] **Step 1: Verify all env vars documented**

Ensure `.env.local.example` has all required variables (done in Task 1).

- [ ] **Step 2: Create Supabase Storage bucket**

Via Supabase Dashboard or SQL:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('exports', 'exports', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('hotel-photos', 'hotel-photos', true);
```

- [ ] **Step 3: Deploy to Vercel**

```bash
npx vercel --prod
```

Configure domain: booking.stayforevents.com in Vercel dashboard.

- [ ] **Step 4: Configure Stripe webhook**

In Stripe Dashboard:
- Add webhook endpoint: `https://booking.stayforevents.com/api/webhooks/stripe`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `setup_intent.succeeded`
- Copy signing secret to Vercel env vars

- [ ] **Step 5: Commit any remaining config**

```bash
git add -A
git commit -m "chore: finalize deployment configuration"
```

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|------------------|
| 1 | 1-5 | Project setup, DB schema, middleware, types, core logic |
| 2 | 6-8 | Admin panel with events/hotels/rooms CRUD |
| 3 | 9-11 | Public booking flow (3 steps + i18n) |
| 4 | 12-13 | Stripe webhooks, payment actions, daily cron |
| 5 | 14 | Rooming list + PDF/Excel export |
| 6 | 15 | Email templates + Resend |
| 7 | 16 | Dashboard, bookings management, stats, audit |
| 8 | 17-19 | Waitlist, communications, deploy |

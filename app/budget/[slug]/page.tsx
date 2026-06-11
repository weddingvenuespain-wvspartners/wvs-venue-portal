import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import BudgetView from './BudgetView'
import { applyCommissionToBudget } from '@/lib/budget-commission'
import { getStripe } from '@/lib/stripe'
import { handleCheckoutCompleted } from '@/lib/stripe-payment-handler'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return {
    robots: { index: false, follow: false },
  }
}

export default async function BudgetPublicPage({ params, searchParams }: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ preview?: string; paid?: string; session_id?: string }>
}) {
  const { slug } = await params
  const { preview, paid, session_id } = await searchParams
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  // Public landing reads the budget (financial + PII) by slug server-side with
  // the service role, so we can keep RLS locked down (no public anon read of
  // the budgets table).
  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // If returning from Stripe Checkout, verify and update DB before rendering
  if (paid === '1' && session_id) {
    try {
      const stripe = getStripe()
      const session = await stripe.checkout.sessions.retrieve(session_id)
      if (session.payment_status === 'paid') {
        await handleCheckoutCompleted(session)
      }
    } catch (err) {
      console.error('[presupuesto] Failed to verify checkout session:', err)
    }
  }

  const { data: budget } = await svc
    .from('budgets')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!budget) return notFound()

  const hasPassword = !!budget.password

  // Strip password from budget before sending to client + apply commission markup
  const safeBudget = applyCommissionToBudget({ ...budget, password: null })

  // Get venue branding + info for Espacio tab
  const { data: venue } = await supabase
    .from('venue_onboarding')
    .select('name, contact_email, contact_phone, description, short_bio, photo_urls, features, capacity_min, capacity_max, city, address, website')
    .eq('user_id', budget.user_id)
    .maybeSingle()

  const { data: branding } = await supabase
    .from('proposal_branding')
    .select('primary_color, logo_url, font_family')
    .eq('user_id', budget.user_id)
    .maybeSingle()

  // Check if venue has Stripe connected for online payments
  const { data: stripeAccount } = await supabase
    .from('venue_stripe_accounts')
    .select('charges_enabled')
    .eq('user_id', budget.user_id)
    .maybeSingle()

  const stripeConnected = !!stripeAccount?.charges_enabled

  // Fetch payment records for split payment tracking + history
  const { data: paymentRecords } = await svc
    .from('budget_payments')
    .select('installment_index, amount, status, paid_at, payer_name, payer_email')
    .eq('budget_id', budget.id)
    .eq('status', 'paid')
    .order('paid_at', { ascending: true })

  // Build map: installment_index → total paid so far
  const paidAmounts: Record<number, number> = {}
  for (const p of paymentRecords || []) {
    paidAmounts[p.installment_index] = (paidAmounts[p.installment_index] || 0) + Number(p.amount)
  }

  // Load contracts linked to this budget (public-facing)
  const { data: contracts } = await svc
    .from('venue_contracts')
    .select('id, contract_number, title, status, sections, total_amount, deposit_amount, wedding_date, client_name, venue_name, venue_signed_at, client_signed_at, venue_signature_url, client_signature_url, created_at')
    .eq('budget_id', budget.id)
    .in('status', ['draft', 'sent', 'signed', 'active', 'completed'])
    .order('created_at', { ascending: false })

  return (
    <BudgetView
      budget={safeBudget as any}
      venue={venue as any}
      branding={branding as any}
      isPreview={preview === '1'}
      hasPassword={hasPassword}
      stripeConnected={stripeConnected}
      paidAmounts={paidAmounts}
      paymentRecords={(paymentRecords || []) as any}
      justPaid={paid === '1'}
      contracts={(contracts || []) as any}
    />
  )
}

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

  const hasPassword = !!budget.password

  // Strip password from budget before sending to client
  const safeBudget = { ...budget, password: null }

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
      budget={safeBudget as any}
      venue={venue as any}
      branding={branding as any}
      isPreview={preview === '1'}
      hasPassword={hasPassword}
    />
  )
}

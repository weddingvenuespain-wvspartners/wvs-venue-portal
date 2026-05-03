'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { usePlanFeatures } from '@/lib/use-plan-features'
import { Loader2, AlertCircle } from 'lucide-react'
import { generateBudgetSlug, applyPaymentTemplate } from '@/lib/budget-types'

function NewBudgetContent() {
  const router = useRouter()
  const { user, loading: authLoading, activeVenue } = useAuth()
  const { isBlocked, ready } = useRequireSubscription()
  const features = usePlanFeatures()
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    if (isBlocked) return
    if (!ready) return
    if (!features.presupuestos) { router.replace('/budgets'); return }
    if (!activeVenue) return
    if (creating) return

    const leadId = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('lead_id')
      : null

    const createDraft = async () => {
      setCreating(true)
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

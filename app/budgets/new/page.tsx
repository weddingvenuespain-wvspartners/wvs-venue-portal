'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { usePlanFeatures } from '@/lib/use-plan-features'
import { Loader2, AlertCircle, FileText, ChevronLeft } from 'lucide-react'
import { generateBudgetSlug, applyPaymentTemplate } from '@/lib/budget-types'
import { cloneTemplateGroups } from '@/lib/budget-starter-templates'
import Sidebar from '@/components/Sidebar'

type CustomTemplate = {
  id: string
  name: string
  description: string | null
  is_default: boolean
  line_items: { groups: any[] }
}

function NewBudgetContent() {
  const router = useRouter()
  const { user, loading: authLoading, activeVenue } = useAuth()
  const { isBlocked, ready } = useRequireSubscription()
  const features = usePlanFeatures()
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)

  // URL params
  const leadId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('lead_id')
    : null
  const customTplParam = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('custom_template')
    : null

  // Load custom templates
  useEffect(() => {
    if (authLoading || !user || !activeVenue) return
    const load = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('budget_structure_templates')
          .select('id, name, description, is_default, line_items')
          .eq('venue_id', activeVenue.id)
          .order('created_at')
        setCustomTemplates((data as CustomTemplate[]) ?? [])
      } catch { /* table might not exist yet */ }
      setLoadingTemplates(false)
    }
    load()
  }, [user, authLoading, activeVenue?.id])

  // Auto-create draft immediately (skip template picker)
  useEffect(() => {
    if (authLoading || !user || isBlocked || !ready || !features.presupuestos || !activeVenue) return
    if (creating) return
    if (!loadingTemplates) createDraft(customTplParam)
  }, [user, authLoading, isBlocked, ready, features.presupuestos, activeVenue?.id, customTplParam, loadingTemplates])

  const createDraft = async (customTemplateId: string | null) => {
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
        .eq('venue_id', activeVenue!.id)
        .maybeSingle()
      if (lead) {
        coupleName = lead.name ?? coupleName
        coupleEmail = lead.email ?? null
        guestCount = lead.guests ?? null
        weddingDate = lead.wedding_date ?? null
      }
    }

    // Fetch proposal selections if lead has a linked proposal
    let proposalMenuData: any = null
    if (leadId) {
      const { data: proposal } = await supabase
        .from('proposals')
        .select('id')
        .eq('lead_id', leadId)
        .eq('venue_id', activeVenue!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (proposal) {
        const { data: menuSel } = await supabase
          .from('proposal_menu_selections')
          .select('*')
          .eq('proposal_id', proposal.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (menuSel) {
          proposalMenuData = menuSel
          // Override guest count from selection if couple changed it
          if (menuSel.guest_count) guestCount = menuSel.guest_count
          // Override wedding date if selection has it
          if (menuSel.wedding_date) weddingDate = menuSel.wedding_date
        }
      }
    }

    // Resolve line items from template
    let lineItemsGroups: any[] = []
    if (customTemplateId) {
      const ct = customTemplates.find(t => t.id === customTemplateId)
      if (ct?.line_items?.groups) lineItemsGroups = cloneTemplateGroups(ct.line_items.groups)
    } else {
      // No template specified — use default template if one exists
      const defTplStruct = customTemplates.find(t => t.is_default)
      if (defTplStruct?.line_items?.groups) lineItemsGroups = cloneTemplateGroups(defTplStruct.line_items.groups)
    }

    // Dynamic guest count: update qty on items that match guest count patterns
    if (guestCount && lineItemsGroups.length > 0) {
      lineItemsGroups = lineItemsGroups.map(g => ({
        ...g,
        items: g.items.map((it: any) => {
          // If item concept contains "por persona" or qty matches template's default guest placeholder
          const isPerPerson = it.concept.toLowerCase().includes('por persona')
          if (isPerPerson) {
            const newQty = guestCount!
            return { ...it, qty: newQty, subtotal: newQty * it.unit_price }
          }
          return it
        }),
      }))
    }

    // Load default payment template
    const { data: defTpl } = await supabase
      .from('budget_payment_templates')
      .select('*')
      .eq('venue_id', activeVenue!.id)
      .eq('is_default', true)
      .maybeSingle()

    const total = lineItemsGroups.reduce((s: number, g: any) =>
      s + g.items.reduce((is: number, i: any) => is + (i.subtotal || 0), 0), 0)

    const paymentPlan = defTpl
      ? applyPaymentTemplate(defTpl.installments as any[], total, weddingDate)
      : []

    const slug = generateBudgetSlug()
    const { data, error: insErr } = await supabase.from('budgets').insert({
      user_id: user!.id,
      venue_id: activeVenue!.id,
      lead_id: leadId || null,
      slug,
      couple_name: coupleName,
      couple_email: coupleEmail,
      guest_count: guestCount,
      wedding_date: weddingDate,
      status: 'draft',
      notes: proposalMenuData ? `Creado desde selección de dosier. Menú: ${proposalMenuData.selected_menu_name || 'N/A'}. Total estimado por pareja: ${proposalMenuData.estimated_total ? proposalMenuData.estimated_total.toLocaleString('es-ES') + ' €' : 'N/A'}` : null,
      line_items: { groups: lineItemsGroups },
      payment_plan: paymentPlan,
      total_amount: total,
    }).select().single()

    if (insErr || !data) {
      setError(`No se pudo crear el presupuesto: ${insErr?.message ?? 'desconocido'}`)
      return
    }

    router.replace(`/budgets/${data.id}/edit`)
  }

  if (authLoading || !ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', color: 'var(--warm-gray)', gap: 8 }}>
        <Loader2 size={16} className="animate-spin" /> Cargando...
      </div>
    )
  }

  if (!user) { router.push('/login'); return null }
  if (isBlocked) return null
  if (!features.presupuestos) { router.replace('/budgets'); return null }

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

  // Always show creating spinner — auto-create fires from useEffect
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', color: 'var(--warm-gray)', gap: 8 }}>
      <Loader2 size={16} className="animate-spin" /> Creando presupuesto...
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

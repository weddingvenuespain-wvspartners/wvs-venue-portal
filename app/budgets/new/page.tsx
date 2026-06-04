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
    let proposalConfigId: string | null = null
    let proposalModalityId: string | null = null
    let proposalLodgingConfigId: string | null = null
    let proposalRoomSelections: any[] = []
    if (leadId) {
      const { data: proposal } = await supabase
        .from('proposals')
        .select('id, commercial_config_id, modality_id, lodging_config_id, sections_data')
        .eq('lead_id', leadId)
        .eq('venue_id', activeVenue!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (proposal) {
        proposalConfigId = (proposal as any).commercial_config_id ?? null
        proposalModalityId = (proposal as any).modality_id ?? (proposal as any).sections_data?.default_modality_id ?? null
        proposalLodgingConfigId = (proposal as any).lodging_config_id ?? null

        const { data: menuSel } = await supabase
          .from('proposal_menu_selections')
          .select('*')
          .eq('proposal_id', proposal.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (menuSel) {
          proposalMenuData = menuSel
          if (menuSel.guest_count) guestCount = menuSel.guest_count
          if (menuSel.wedding_date) weddingDate = menuSel.wedding_date
        }

        // Lodging room selections
        if (proposalLodgingConfigId) {
          const { data: roomSels } = await supabase
            .from('proposal_room_selections')
            .select('*')
            .eq('proposal_id', proposal.id)
          proposalRoomSelections = roomSels ?? []
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

    // Import from proposal — pull modality price + lodging selections as initial line items
    if (proposalConfigId && proposalModalityId) {
      const { data: modality } = await supabase
        .from('venue_modalities')
        .select('*, prices:venue_modality_prices(*), packages:venue_modality_packages(*, prices:venue_modality_prices(*))')
        .eq('id', proposalModalityId)
        .maybeSingle()
      if (modality) {
        const modPrice = (modality.prices ?? [])[0]?.price ?? 0
        const importedGroup = {
          id: `imp-${Date.now()}`,
          name: 'Alquiler espacio (importado del dosier)',
          items: [{
            id: `mod-${Date.now()}`,
            concept: modality.name + (modality.duration_label ? ` · ${modality.duration_label}` : ''),
            qty: 1,
            unit_price: modPrice,
            subtotal: modPrice,
          }],
        }
        if (modPrice > 0) lineItemsGroups = [importedGroup, ...lineItemsGroups]
      }
    }

    // Import lodging selections
    if (proposalRoomSelections.length > 0) {
      const lodgingItems = proposalRoomSelections.map((s: any, idx: number) => {
        const nights = s.check_in && s.check_out
          ? Math.max(1, Math.round((new Date(s.check_out).getTime() - new Date(s.check_in).getTime()) / 86400000))
          : 1
        const total = s.computed_total ?? 0
        return {
          id: `lodg-${Date.now()}-${idx}`,
          concept: `Habitación · ${s.quantity} hab. × ${nights} noche(s)`,
          qty: s.quantity,
          unit_price: nights > 0 ? Math.round((total / s.quantity / nights) * 100) / 100 : 0,
          subtotal: total,
        }
      })
      if (lodgingItems.length > 0) {
        lineItemsGroups = [
          ...lineItemsGroups,
          { id: `imp-lodg-${Date.now()}`, name: 'Alojamiento (importado del dosier)', items: lodgingItems },
        ]
      }
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
    const basePayload: any = {
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
      commercial_config_id: proposalConfigId,
      modality_id: proposalModalityId,
      lodging_config_id: proposalLodgingConfigId,
    }
    let { data, error: insErr } = await supabase.from('budgets').insert(basePayload).select().single()
    // Retry without unknown columns (in case migration not applied yet)
    if (insErr && insErr.code === '42703') {
      const { commercial_config_id: _c, modality_id: _m, lodging_config_id: _l, ...rest } = basePayload
      const r = await supabase.from('budgets').insert(rest).select().single()
      data = r.data; insErr = r.error
    }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#7E332D', fontSize: 14 }}>
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

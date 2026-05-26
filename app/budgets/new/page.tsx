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

  // Auto-create if template selected (via URL param)
  useEffect(() => {
    if (authLoading || !user || isBlocked || !ready || !features.presupuestos || !activeVenue) return
    if (creating) return
    if (!customTplParam) return

    createDraft(customTplParam)
  }, [user, authLoading, isBlocked, ready, features.presupuestos, activeVenue?.id, customTplParam])

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

  // If creating (template selected via URL), show spinner
  if (creating || customTplParam) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', color: 'var(--warm-gray)', gap: 8 }}>
        <Loader2 size={16} className="animate-spin" /> Creando presupuesto...
      </div>
    )
  }

  // ── Template Picker UI ─────────────────────────────────────────────────────
  const pickTemplate = (customId?: string) => {
    const params = new URLSearchParams()
    if (leadId) params.set('lead_id', leadId)
    if (customId) params.set('custom_template', customId)
    router.replace(`/budgets/new?${params.toString()}`)
  }

  const calcTotal = (groups: any[]) =>
    groups.reduce((s: number, g: any) => s + g.items.reduce((is: number, i: any) => is + (i.subtotal || 0), 0), 0)

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => router.push('/budgets')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', padding: 0 }}>
              <ChevronLeft size={18} />
            </button>
            <div className="topbar-title">Nuevo presupuesto</div>
          </div>
        </div>

        <div className="page-content" style={{ maxWidth: 800 }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 22, color: 'var(--espresso)', marginBottom: 6 }}>
              Elige una plantilla
            </h2>
            <p style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.55 }}>
              Empieza desde cero o usa una estructura predefinida. Podras editar todo despues.
            </p>
          </div>

          {/* Templates */}
          {loadingTemplates ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--warm-gray)', fontSize: 12, padding: '16px 0' }}>
              <Loader2 size={14} className="animate-spin" /> Cargando plantillas...
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
              {/* En blanco */}
              <button
                onClick={() => pickTemplate()}
                style={{
                  textAlign: 'left', padding: '18px 20px',
                  background: '#fff', border: '2px dashed var(--border)', borderRadius: 12,
                  cursor: 'pointer', display: 'flex', gap: 14,
                  transition: 'border-color .15s, box-shadow .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,.08)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                  background: 'var(--cream)', border: '1.5px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FileText size={20} style={{ color: 'var(--warm-gray)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 2 }}>En blanco</div>
                  <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.45 }}>
                    {customTemplates.some(t => t.is_default)
                      ? `Usa "${customTemplates.find(t => t.is_default)!.name}" como base`
                      : 'Presupuesto vacío desde cero'}
                  </div>
                </div>
              </button>
                {customTemplates.map(ct => {
                  const total = calcTotal(ct.line_items?.groups ?? [])
                  const groupCount = ct.line_items?.groups?.length ?? 0
                  const itemCount = (ct.line_items?.groups ?? []).reduce((s: number, g: any) => s + (g.items?.length ?? 0), 0)
                  return (
                    <button
                      key={ct.id}
                      onClick={() => pickTemplate(ct.id)}
                      style={{
                        textAlign: 'left', padding: '18px 20px',
                        background: '#fff', border: `2px solid ${ct.is_default ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 12,
                        cursor: 'pointer', display: 'flex', gap: 14,
                        transition: 'border-color .15s, box-shadow .15s, transform .15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,.08)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = ct.is_default ? 'var(--gold)' : 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
                    >
                      <div style={{
                        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                        background: 'var(--cream)', border: '1.5px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <FileText size={20} style={{ color: 'var(--charcoal)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--charcoal)' }}>{ct.name}</div>
                          {ct.is_default && <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 8px', borderRadius: 10, fontWeight: 600 }}>Predeterminada</span>}
                        </div>
                        {ct.description && <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.45, marginTop: 3, marginBottom: 8 }}>{ct.description}</div>}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: ct.description ? 0 : 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, background: 'var(--cream)', color: 'var(--charcoal)', padding: '2px 8px', borderRadius: 10 }}>
                            {groupCount} grupos
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 600, background: 'var(--cream)', color: 'var(--charcoal)', padding: '2px 8px', borderRadius: 10 }}>
                            {itemCount} conceptos
                          </span>
                          {total > 0 && (
                            <span style={{ fontSize: 10, fontWeight: 600, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10 }}>
                              ~{total.toLocaleString('es-ES')} EUR
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
            </div>
          )}
        </div>
      </div>
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

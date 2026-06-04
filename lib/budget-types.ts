export type BudgetStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'expired'

export type LineItem = {
  id: string
  concept: string
  /** Optional descripción/detalle */
  description?: string | null
  qty: number
  unit_price: number
  subtotal: number
  /** Per-line IVA % (overrides global if set) */
  tax_rate?: number | null
  /** Per-line discount type */
  discount_type?: 'fixed' | 'percent' | null
  /** Per-line discount amount */
  discount_amount?: number | null
}

export type LineItemGroup = {
  id: string
  name: string
  items: LineItem[]
}

export type LineItemsData = {
  groups: LineItemGroup[]
}

export type PaymentInstallment = {
  label: string
  amount: number
  due_date: string
  status: 'pending' | 'paid'
  /** Whether this installment is refundable */
  refundable?: boolean
  /** Refund deadline (ISO date). After this date, the installment is non-refundable */
  refund_deadline?: string
  /** Refund percentage cap (0-100). E.g. 50 = refund up to 50% of this installment */
  refund_percent?: number
}

export type PaymentTemplateRule = {
  label: string
  percent: number
  due_rule: 'on_confirmation' | 'months_before' | 'days_before' | 'fixed_date'
  months?: number
  days?: number
  fixed_date?: string
}

export type PaymentTemplate = {
  id: string
  user_id: string
  venue_id: string
  name: string
  is_default: boolean
  installments: PaymentTemplateRule[]
  created_at: string
}

export type Budget = {
  id: string
  user_id: string
  venue_id: string
  lead_id: string | null
  slug: string
  couple_name: string
  couple_email: string | null
  wedding_date: string | null
  guest_count: number | null
  status: BudgetStatus
  notes: string | null
  valid_until: string | null
  line_items: LineItemsData
  payment_plan: PaymentInstallment[]
  total_amount: number
  tax_rate: number | null
  tax_included: boolean
  discount_type: 'fixed' | 'percent' | null
  discount_amount: number | null
  discount_label: string | null
  sent_at: string | null
  first_viewed_at: string | null
  last_viewed_at: string | null
  password: string | null
  includes_text: string | null
  open_count: number
  /** Source proposal — when lead has multiple proposals, pick which one feeds the budget */
  proposal_id?: string | null
  /** Commercial config (space) imported from proposal — can be changed in editor */
  commercial_config_id?: string | null
  /** Default modality from proposal */
  modality_id?: string | null
  /** Lodging commercial config from proposal */
  lodging_config_id?: string | null
  /** Custom name for the budget (separate from couple_name) */
  name?: string | null
  /** Long description of the budget */
  description?: string | null
  /** Document number (e.g. PRE-2025-001) */
  document_number?: string | null
  /** Issue date — when the budget was issued */
  issue_date?: string | null
  /** Public message shown to the client */
  message?: string | null
  created_at: string
  updated_at: string
}

export type DossierResponse = {
  proposal_id: string
  proposal_name: string
  menu_selection: {
    selected_menu_name: string | null
    guest_count: number | null
    course_choices: any
    selected_extras: any
    comments: string | null
    estimated_total: number | null
    menu_allocations: any
  } | null
  selected_date: string | null
  visit_request: any | null
  sections_data: any | null
}

export function generateBudgetSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let slug = ''
  for (let i = 0; i < 10; i++) slug += chars[Math.floor(Math.random() * chars.length)]
  return slug
}

/** Subtotal of a single line item after per-line discount (if any). */
export function calcLineSubtotal(item: LineItem): number {
  const base = item.qty * item.unit_price
  let after = base
  if (item.discount_type === 'fixed' && item.discount_amount) after -= item.discount_amount
  if (item.discount_type === 'percent' && item.discount_amount) after -= base * (item.discount_amount / 100)
  return Math.max(0, Math.round(after * 100) / 100)
}

export function calcBudgetTotal(
  groups: LineItemGroup[],
  discount: { type: 'fixed' | 'percent' | null; amount: number | null },
  taxRate: number | null,
  taxIncluded: boolean
): number {
  // Subtotal uses already-stored subtotal (set by callers) which may incorporate per-line discount
  const subtotal = groups.reduce((sum, g) => sum + g.items.reduce((s, i) => s + i.subtotal, 0), 0)
  let afterDiscount = subtotal
  if (discount.type === 'fixed' && discount.amount) afterDiscount -= discount.amount
  if (discount.type === 'percent' && discount.amount) afterDiscount -= subtotal * (discount.amount / 100)
  if (taxRate && !taxIncluded) {
    // Apply per-line tax overrides when present, fall back to global rate
    const taxAdded = groups.reduce((sum, g) => sum + g.items.reduce((s, i) => {
      const rate = (i.tax_rate ?? taxRate) || 0
      return s + i.subtotal * (rate / 100)
    }, 0), 0)
    // Replace global rate with computed sum: subtotal + taxAdded (post-global-discount adjustment)
    const discountRatio = subtotal > 0 ? afterDiscount / subtotal : 1
    afterDiscount = afterDiscount + taxAdded * discountRatio
  }
  return Math.round(afterDiscount * 100) / 100
}

export function applyPaymentTemplate(
  template: PaymentTemplateRule[],
  total: number,
  weddingDate: string | null
): PaymentInstallment[] {
  return template.map(rule => {
    const amount = Math.round((rule.percent / 100) * total * 100) / 100
    let due_date = ''
    if (rule.due_rule === 'on_confirmation') {
      due_date = new Date().toISOString().slice(0, 10)
    } else if (rule.due_rule === 'fixed_date' && rule.fixed_date) {
      due_date = rule.fixed_date
    } else if (weddingDate) {
      const wd = new Date(weddingDate + 'T12:00:00')
      if (rule.due_rule === 'months_before' && rule.months) {
        wd.setMonth(wd.getMonth() - rule.months)
      } else if (rule.due_rule === 'days_before' && rule.days) {
        wd.setDate(wd.getDate() - rule.days)
      }
      due_date = wd.toISOString().slice(0, 10)
    }
    return { label: rule.label, amount, due_date, status: 'pending' as const }
  })
}

export type BudgetStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'expired'

export type LineItem = {
  id: string
  concept: string
  qty: number
  unit_price: number
  subtotal: number
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
  open_count: number
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

export function calcBudgetTotal(
  groups: LineItemGroup[],
  discount: { type: 'fixed' | 'percent' | null; amount: number | null },
  taxRate: number | null,
  taxIncluded: boolean
): number {
  const subtotal = groups.reduce((sum, g) => sum + g.items.reduce((s, i) => s + i.subtotal, 0), 0)
  let afterDiscount = subtotal
  if (discount.type === 'fixed' && discount.amount) afterDiscount -= discount.amount
  if (discount.type === 'percent' && discount.amount) afterDiscount -= subtotal * (discount.amount / 100)
  if (taxRate && !taxIncluded) afterDiscount *= (1 + taxRate / 100)
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

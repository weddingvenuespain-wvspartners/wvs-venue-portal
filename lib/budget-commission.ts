// ──────────────────────────────────────────────────────────────────────────────
// Apply WP/organizer commission markup to a Budget before public render.
// Only "neto" mode multiplies prices; "comisionable" mode means stored
// prices already include commission.
// ──────────────────────────────────────────────────────────────────────────────

import type { Budget } from './budget-types'

type AnyBudget = Budget & {
  commission_planner_id?: string | null
  commission_percent?: number | null
  commission_mode?: 'comisionable' | 'neto' | null
  commission_amount?: number | null
}

export function applyCommissionToBudget<T extends AnyBudget>(budget: T): T {
  const pct = budget.commission_percent
  const mode = budget.commission_mode
  if (!pct || mode !== 'neto') return budget
  const factor = 1 + pct / 100

  const newGroups = (budget.line_items?.groups ?? []).map(g => ({
    ...g,
    items: g.items.map(it => {
      const unit = Math.round(it.unit_price * factor * 100) / 100
      const sub = Math.round(unit * it.qty * 100) / 100
      return { ...it, unit_price: unit, subtotal: sub }
    }),
  }))

  const newDiscountAmount = (budget as any).discount_type === 'fixed' && (budget as any).discount_amount
    ? Math.round((budget as any).discount_amount * factor * 100) / 100
    : (budget as any).discount_amount

  const newPaymentPlan = (budget.payment_plan ?? []).map(p => ({
    ...p,
    amount: Math.round(p.amount * factor * 100) / 100,
  }))

  const newTotal = Math.round((budget.total_amount ?? 0) * factor * 100) / 100

  return {
    ...budget,
    line_items: { ...budget.line_items, groups: newGroups },
    discount_amount: newDiscountAmount,
    payment_plan: newPaymentPlan,
    total_amount: newTotal,
  } as T
}

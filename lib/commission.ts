// ──────────────────────────────────────────────────────────────────────────────
// Commission helpers — WP/organizer markup logic
// ──────────────────────────────────────────────────────────────────────────────

export type CommissionMode = 'comisionable' | 'neto'

export type CommissionConfig = {
  planner_id?: string | null
  percent?: number | null
  mode?: CommissionMode | null
}

/**
 * Apply commission to a base price.
 *
 * - `comisionable`: stored price already includes commission. Returns it unchanged
 *   as `clientPrice`. Net = price * 100/(100+pct).
 * - `neto`: stored price is venue-net. Markup formula:
 *   clientPrice = netPrice × (1 + pct/100). Commission = netPrice × pct/100.
 *
 * Returns the trio { clientPrice, netPrice, commissionAmount }.
 */
export function applyCommission(
  basePrice: number,
  percent: number | null | undefined,
  mode: CommissionMode | null | undefined,
): { clientPrice: number; netPrice: number; commissionAmount: number } {
  const p = Number(percent ?? 0)
  if (!p || !mode) {
    return { clientPrice: basePrice, netPrice: basePrice, commissionAmount: 0 }
  }
  if (mode === 'neto') {
    const commissionAmount = basePrice * (p / 100)
    return {
      clientPrice: basePrice + commissionAmount,
      netPrice: basePrice,
      commissionAmount,
    }
  }
  // comisionable: extract the embedded commission
  const netPrice = basePrice * (100 / (100 + p))
  return {
    clientPrice: basePrice,
    netPrice,
    commissionAmount: basePrice - netPrice,
  }
}

/**
 * Pure client-facing markup. Use this from public-facing surfaces
 * (proposal pages, budget pages) where only the client price is needed.
 */
export function clientPrice(
  basePrice: number,
  cfg: CommissionConfig | null | undefined,
): number {
  if (!cfg) return basePrice
  return applyCommission(basePrice, cfg.percent, cfg.mode).clientPrice
}

/**
 * Compute total commission amount over a total figure.
 * Useful when total is already aggregated and we need the commission slice.
 */
export function commissionOnTotal(
  total: number,
  percent: number | null | undefined,
  mode: CommissionMode | null | undefined,
): number {
  const p = Number(percent ?? 0)
  if (!p || !mode) return 0
  if (mode === 'neto') return total * (p / 100)
  // comisionable: commission is embedded inside `total`
  return total - total * (100 / (100 + p))
}

export const COMMISSION_MODE_LABELS: Record<CommissionMode, string> = {
  comisionable: 'Comisionable (precio incluye comisión)',
  neto: 'Neto (comisión se añade al precio)',
}

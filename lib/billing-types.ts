// ── Shared billing types ──────────────────────────────────────────────────────
// Importar desde aquí en admin/planes y admin/page

export type BillingCycle = {
  id:                string   // slug: 'yearly', 'monthly', 'quarterly', etc.
  label:             string   // 'Anual', 'Mensual', 'Trimestral'
  price:             number   // importe a cobrar cada período
  interval_months:   number   // cada cuántos meses se renueva: 12, 1, 3...
  commitment_months: number   // meses mínimos de contrato (0 = sin compromiso)
  cancel_notice_days: number  // días de preaviso para cancelar (ej: 15)
}

export const EMPTY_CYCLE: BillingCycle = {
  id: '', label: '', price: 0,
  interval_months: 12, commitment_months: 12, cancel_notice_days: 15,
}

/** Presets rápidos */
export const CYCLE_PRESETS: BillingCycle[] = [
  { id: 'yearly',    label: 'Anual',       price: 350, interval_months: 12, commitment_months: 12, cancel_notice_days: 15 },
  { id: 'monthly',   label: 'Mensual',     price: 35,  interval_months: 1,  commitment_months: 12, cancel_notice_days: 15 },
  { id: 'quarterly', label: 'Trimestral',  price: 100, interval_months: 3,  commitment_months: 12, cancel_notice_days: 15 },
]

/** Avanza una fecha por los meses del ciclo */
export function advanceDateByMonths(from: string, months: number): string {
  const d = new Date(from)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

/** Fecha límite de preaviso para cancelar */
export function cancelDeadline(periodEnd: string, noticeDays: number): string {
  const d = new Date(periodEnd)
  d.setDate(d.getDate() - noticeDays)
  return d.toISOString().slice(0, 10)
}

/** Días restantes hasta una fecha */
export function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

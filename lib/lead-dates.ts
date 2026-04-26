// Helpers para trabajar con fechas de leads (date_flexibility: exact | range | multi_range | month | season | flexible).

export function pad(n: number) {
  return String(n).padStart(2, '0')
}

const addRange = (from: string, to: string): string[] => {
  const result: string[] = []
  const d = new Date(from + 'T12:00:00')
  const end = new Date((to || from) + 'T12:00:00')
  while (d <= end) {
    result.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return result
}

export function expandLeadDates(lead: any): string[] {
  const flex = lead.date_flexibility || 'exact'
  if (flex === 'exact') return lead.wedding_date ? [lead.wedding_date] : []
  if (flex === 'range' && lead.wedding_date)
    return addRange(lead.wedding_date, lead.wedding_date_to || lead.wedding_date)
  if (flex === 'multi_range')
    return (lead.wedding_date_ranges || []).flatMap((r: any) =>
      r.from ? addRange(r.from, r.to || r.from) : []
    )
  return []
}

export function expandBudgetDates(lead: any): string[] {
  const flex = lead.budget_date_flexibility || 'exact'
  if (flex === 'exact') return lead.budget_date ? [lead.budget_date] : []
  if (flex === 'range' && lead.budget_date)
    return addRange(lead.budget_date, lead.budget_date_to || lead.budget_date)
  if (flex === 'multi_range')
    return (lead.budget_date_ranges || []).flatMap((r: any) =>
      r.from ? addRange(r.from, r.to || r.from) : []
    )
  return []
}

export type LeadDateRange = { from: string; to?: string }

// Devuelve los rangos crudos pedidos por el cliente, normalizados a `[{from, to?}]`.
// Útil para enseñarlos uno a uno en la UI sin perder información (a diferencia de
// expandLeadDates que devuelve cada día individual).
export function getLeadDateRanges(lead: any): LeadDateRange[] {
  const flex = lead.date_flexibility || 'exact'
  if (flex === 'exact' && lead.wedding_date)
    return [{ from: lead.wedding_date }]
  if (flex === 'range' && lead.wedding_date)
    return [{ from: lead.wedding_date, to: lead.wedding_date_to || lead.wedding_date }]
  if (flex === 'multi_range')
    return (lead.wedding_date_ranges || []).filter((r: any) => r?.from)
  return []
}

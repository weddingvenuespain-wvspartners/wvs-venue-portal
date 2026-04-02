import { useAuth } from './auth-context'

// ── Feature flags per plan ────────────────────────────────────────────────────

export type PlanFeatures = {
  ficha: boolean
  leads: boolean
  leads_new_only: boolean      // only sees leads with status='new'
  leads_date_filter: boolean   // can filter leads by date range
  leads_export: boolean        // can export leads to CSV
  calendario: boolean
  propuestas: boolean          // access to Propuestas page
  propuestas_web: boolean      // "Web de propuesta" tab inside Comunicación
  comunicacion: boolean
  estadisticas: boolean
}

// Default = full access (premium plan behaviour). Any field set to `false` in
// the DB overrides this.
const FULL_ACCESS: PlanFeatures = {
  ficha: true,
  leads: true,
  leads_new_only: false,
  leads_date_filter: true,
  leads_export: true,
  calendario: true,
  propuestas: true,
  propuestas_web: true,
  comunicacion: true,
  estadisticas: true,
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePlanFeatures(): PlanFeatures & { planId: string; planName: string } {
  const { profile } = useAuth()

  // profile.plan is populated via the join in auth-context
  // `permissions` is the JSONB flags object; `features` is a string[] for marketing display
  const rawFeatures = (profile?.plan?.permissions ?? {}) as Partial<PlanFeatures>

  return {
    ...FULL_ACCESS,
    ...rawFeatures,
    planId:   profile?.plan?.id   ?? 'premium',
    planName: profile?.plan?.display_name ?? profile?.plan?.name ?? 'Premium',
  }
}

import { useAuth } from './auth-context'

// ── Feature flags ─────────────────────────────────────────────────────────────

export type PlanFeatures = {
  ficha:             boolean   // Mi Ficha — editar ficha del venue
  leads:             boolean   // Leads — recibir y gestionar leads
  leads_new_only:    boolean   // Restricción: solo ve leads con status='new'
  leads_date_filter: boolean   // Filtrar leads por rango de fechas
  leads_export:      boolean   // Exportar leads a CSV
  calendario:        boolean   // Calendario de disponibilidad
  propuestas:        boolean   // Propuestas digitales
  propuestas_web:    boolean   // Web de propuesta (enlace público)
  comunicacion:      boolean   // Comunicación / Tarifas y zonas
  estadisticas:      boolean   // Estadísticas y métricas
}

// ── Fallbacks (cuando el plan no tiene permissions en la DB) ──────────────────

/** Sin plan / trial: mismas funciones que básico durante el período de prueba. */
export const BASIC_FALLBACK: PlanFeatures = {
  ficha:             true,
  leads:             true,
  leads_new_only:    false,
  leads_date_filter: true,
  leads_export:      false,
  calendario:        true,
  propuestas:        false,
  propuestas_web:    false,
  comunicacion:      false,
  estadisticas:      true,
}

/** Plan premium por defecto: acceso completo. */
export const PREMIUM_FALLBACK: PlanFeatures = {
  ficha:             true,
  leads:             true,
  leads_new_only:    false,
  leads_date_filter: true,
  leads_export:      true,
  calendario:        true,
  propuestas:        true,
  propuestas_web:    true,
  comunicacion:      true,
  estadisticas:      true,
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePlanFeatures(): PlanFeatures & {
  planId:        string
  planName:      string
  planTier:      'basic' | 'premium'
  hasPlan:       boolean   // has an active or trial subscription
  isTrial:       boolean   // subscription status is 'trial'
  trialDaysLeft: number | null  // null if not trial or no end date
} {
  const { profile } = useAuth()

  const plan     = profile?.plan
  const hasPlan  = !!plan

  // Trial state from subscription_status set in auth-context
  const isTrial       = profile?.subscription_status === 'trial'
  const trialEndDate  = profile?.trial_end_date as string | null | undefined
  const trialDaysLeft = trialEndDate
    ? Math.ceil((new Date(trialEndDate).getTime() - Date.now()) / 86400000)
    : null

  // Tier:
  //   - No plan/subscription → treat as basic (not free premium)
  //   - Plan name exactly 'basic' → basic
  //   - Any other plan name → premium
  const planSlug = plan?.name ?? ''
  const planTier: 'basic' | 'premium' = (hasPlan && planSlug !== 'basic') ? 'premium' : 'basic'

  // Priority 0: per-venue feature overrides set by admin (override everything)
  const featureOverrides = (profile?.features_override ?? {}) as Partial<PlanFeatures>

  // Priority 1: explicit permissions stored in venue_plans.permissions (set from admin UI)
  const dbPermissions = (plan?.permissions ?? {}) as Partial<PlanFeatures>
  const hasExplicitPermissions = Object.keys(dbPermissions).length > 0

  // Priority 2: fallback based on tier
  // Note: trial users get the SAME features as their plan tier (not locked out during trial)
  const fallback: PlanFeatures = planTier === 'premium' ? PREMIUM_FALLBACK : BASIC_FALLBACK

  // Merge: plan permissions override fallback, then feature_overrides override everything
  const baseMerge: PlanFeatures = hasExplicitPermissions
    ? { ...fallback, ...dbPermissions }
    : fallback
  const resolved: PlanFeatures = Object.keys(featureOverrides).length > 0
    ? { ...baseMerge, ...featureOverrides }
    : baseMerge

  return {
    ...resolved,
    planId:   plan?.id           ?? '',
    planName: plan?.display_name ?? plan?.name ?? '',
    planTier,
    hasPlan,
    isTrial,
    trialDaysLeft,
  }
}

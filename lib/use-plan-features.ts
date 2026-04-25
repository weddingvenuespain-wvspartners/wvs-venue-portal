import { useAuth } from './auth-context'

// ── Feature flags ─────────────────────────────────────────────────────────────
// Convention:
//   true  = user HAS this capability  (for all features except restrictions)
//   Restrictions: true = limitation is ACTIVE (user is constrained)
//
// Tier in FEATURE_DEFS controls web visibility:
//   'basic'       → shown in both basic and premium columns (both get ✓)
//   'premium'     → shown ONLY in premium column (basic column doesn't even list it)
//   'restriction' → internal admin only, never shown on web

export type PlanFeatures = {
  // ── Basic tier (both plans include these) ──────────────────────────────────
  ficha:                  boolean  // Ficha del venue — editar y publicar
  leads:                  boolean  // Recibir y gestionar leads
  leads_date_filter:      boolean  // Filtrar leads por rango de fechas
  calendario:             boolean  // Calendario de disponibilidad
  estadisticas:           boolean  // Estadísticas básicas

  // ── Premium tier (only shown in premium column on web) ────────────────────
  estructura:             boolean  // Estructura comercial: modalidades y tarifas
  leads_export:           boolean  // Exportar leads a CSV/Excel
  pipeline:               boolean  // Pipeline visual de ventas (kanban/embudo)
  propuestas:             boolean  // Crear propuestas digitales
  propuestas_web:         boolean  // Web pública de propuesta (enlace para parejas)
  propuestas_pdf:         boolean  // Descargar propuesta en PDF
  comunicacion:           boolean  // Tarifas, zonas y períodos de precio
  estadisticas_avanzadas: boolean  // Estadísticas avanzadas e informes
  recordatorios:          boolean  // Recordatorios automáticos a parejas
  multiusuario:           boolean  // Múltiples usuarios por cuenta
  soporte_prioritario:    boolean  // Soporte prioritario por email y teléfono

  // ── Restrictions (internal — true = limitation is ACTIVE) ────────────────
  leads_new_only:         boolean  // Solo puede ver leads en estado "Nuevo"
}

// ── Feature definitions (used in admin UI and pricing pages) ──────────────────
export type FeatureTier = 'basic' | 'premium' | 'restriction'

export type FeatureDef = {
  key:         keyof PlanFeatures
  label:       string
  description: string
  tier:        FeatureTier
  dangerous?:  boolean  // red warning in admin UI (for restrictions)
}

export const FEATURE_DEFS: FeatureDef[] = [
  // ── Basic ─────────────────────────────────────────────────────────────────
  { key: 'ficha',                  tier: 'basic',       label: 'Ficha del venue',                description: 'Editar y publicar la ficha del venue en el directorio' },
  { key: 'leads',                  tier: 'basic',       label: 'Gestión de leads',               description: 'Recibir y gestionar consultas de parejas interesadas' },
  { key: 'leads_date_filter',      tier: 'basic',       label: 'Filtrar leads por fecha',         description: 'Filtrar el listado de leads por rango de fechas de boda' },
  { key: 'calendario',             tier: 'basic',       label: 'Calendario de disponibilidad',   description: 'Ver y gestionar fechas disponibles del venue' },
  { key: 'estadisticas',           tier: 'basic',       label: 'Estadísticas básicas',           description: 'Métricas de leads recibidos, visitas y conversiones' },

  // ── Premium ───────────────────────────────────────────────────────────────
  { key: 'estructura',              tier: 'premium',     label: 'Estructura comercial',           description: 'Define modalidades de alquiler y tarifas por período para tu venue' },
  { key: 'leads_export',           tier: 'premium',     label: 'Exportar leads a CSV',           description: 'Descargar todos los leads en formato Excel/CSV' },
  { key: 'pipeline',               tier: 'premium',     label: 'Pipeline de ventas',             description: 'Vista kanban del embudo comercial con etapas personalizables' },
  { key: 'propuestas',             tier: 'premium',     label: 'Propuestas digitales',           description: 'Crear y enviar propuestas personalizadas a cada pareja' },
  { key: 'propuestas_web',         tier: 'premium',     label: 'Web pública de propuesta',       description: 'Enlace público con la propuesta, accesible desde cualquier dispositivo' },
  { key: 'propuestas_pdf',         tier: 'premium',     label: 'Descarga PDF de propuesta',      description: 'Exportar cualquier propuesta en formato PDF profesional' },
  { key: 'comunicacion',           tier: 'premium',     label: 'Tarifas y zonas de precio',      description: 'Configurar tarifas, zonas geográficas y períodos de precio' },
  { key: 'estadisticas_avanzadas', tier: 'premium',     label: 'Estadísticas avanzadas',         description: 'Informes detallados, tendencias y análisis de conversión por fuente' },
  { key: 'recordatorios',          tier: 'premium',     label: 'Recordatorios automáticos',      description: 'Enviar recordatorios automáticos a parejas según etapa del pipeline' },
  { key: 'multiusuario',           tier: 'premium',     label: 'Múltiples usuarios',             description: 'Añadir miembros del equipo con acceso a la cuenta del venue' },
  { key: 'soporte_prioritario',    tier: 'premium',     label: 'Soporte prioritario',            description: 'Atención preferente por email y teléfono con tiempo de respuesta garantizado' },

  // ── Restrictions (admin internal — never shown on web) ────────────────────
  { key: 'leads_new_only',         tier: 'restriction', label: 'Solo leads nuevos',              description: 'Restringe la vista de leads únicamente a los de estado "Nuevo". Actívalo para limitar el acceso en planes de prueba.', dangerous: true },
]

// ── Fallbacks (when plan has no permissions stored in DB) ─────────────────────

export const BASIC_FALLBACK: PlanFeatures = {
  ficha:                  true,
  leads:                  true,
  leads_date_filter:      true,
  calendario:             true,
  estadisticas:           true,
  // premium → false
  estructura:             false,
  leads_export:           false,
  pipeline:               false,
  propuestas:             false,
  propuestas_web:         false,
  propuestas_pdf:         false,
  comunicacion:           false,
  estadisticas_avanzadas: false,
  recordatorios:          false,
  multiusuario:           false,
  soporte_prioritario:    false,
  // restrictions → off by default
  leads_new_only:         false,
}

export const PREMIUM_FALLBACK: PlanFeatures = {
  ficha:                  true,
  leads:                  true,
  leads_date_filter:      true,
  calendario:             true,
  estadisticas:           true,
  estructura:             true,
  leads_export:           true,
  pipeline:               true,
  propuestas:             true,
  propuestas_web:         true,
  propuestas_pdf:         true,
  comunicacion:           true,
  estadisticas_avanzadas: true,
  recordatorios:          true,
  multiusuario:           true,
  soporte_prioritario:    true,
  leads_new_only:         false,
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePlanFeatures(): PlanFeatures & {
  planId:         string
  planName:       string
  planTier:       'basic' | 'premium'
  hasPlan:        boolean        // active or trial subscription (not expired)
  isTrial:        boolean        // subscription status is 'trial'
  isTrialExpired: boolean        // trial exists but trial_end_date is in the past
  trialDaysLeft:  number | null  // null if not trial or no end date
  loading:        boolean        // true while auth context is still loading
} {
  const { profile, loading } = useAuth()

  const plan               = profile?.plan
  const subscriptionStatus = profile?.subscription_status as string | null | undefined

  const isTrial       = subscriptionStatus === 'trial'
  const trialEndDate  = profile?.trial_end_date as string | null | undefined
  const trialDaysLeft = trialEndDate
    ? Math.ceil((new Date(trialEndDate).getTime() - Date.now()) / 86400000)
    : null
  const isTrialExpired = subscriptionStatus === 'trial_expired' ||
    (isTrial && trialDaysLeft !== null && trialDaysLeft <= 0)

  const hasSubscription = !!plan || subscriptionStatus === 'active' || subscriptionStatus === 'trial'
  const hasPlan = hasSubscription && !isTrialExpired

  const planSlug  = plan?.name ?? ''
  const planTier: 'basic' | 'premium' = (hasPlan && planSlug !== 'basic') ? 'premium' : 'basic'

  const featureOverrides   = (profile?.features_override ?? {}) as Partial<PlanFeatures>
  const dbPermissions      = (plan?.permissions ?? {}) as Partial<PlanFeatures>
  const hasExplicitPermissions = Object.keys(dbPermissions).length > 0

  const fallback: PlanFeatures = planTier === 'premium' ? PREMIUM_FALLBACK : BASIC_FALLBACK

  const baseMerge: PlanFeatures = hasExplicitPermissions
    ? { ...fallback, ...dbPermissions }
    : fallback
  const resolved: PlanFeatures = Object.keys(featureOverrides).length > 0
    ? { ...baseMerge, ...featureOverrides }
    : baseMerge

  return {
    ...resolved,
    planId:        plan?.id           ?? '',
    planName:      plan?.display_name ?? plan?.name ?? '',
    planTier,
    hasPlan,
    isTrial,
    isTrialExpired,
    trialDaysLeft,
    loading,
  }
}

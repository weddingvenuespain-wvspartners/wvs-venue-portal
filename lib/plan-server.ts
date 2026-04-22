import { getServiceClient, getSession } from './auth-server'
import {
  BASIC_FALLBACK,
  PREMIUM_FALLBACK,
  type PlanFeatures,
} from './use-plan-features'

type ResolvedPlan = {
  userId:   string
  role:     string
  isAdmin:  boolean
  planTier: 'basic' | 'premium'
  hasPlan:  boolean
  features: PlanFeatures
}

/**
 * Resolves the current user's plan + effective feature flags on the server.
 * Returns null when there is no authenticated session.
 * Admins are flagged with isAdmin=true and a full PREMIUM_FALLBACK (bypass).
 */
export async function getUserPlan(): Promise<ResolvedPlan | null> {
  const session = await getSession()
  if (!session) return null

  const svc = getServiceClient()

  const { data: profile } = await svc
    .from('venue_profiles')
    .select('role, features_override, subscription_status, trial_end_date')
    .eq('user_id', session.user.id)
    .maybeSingle()

  const role = profile?.role ?? 'venue_owner'
  const isAdmin = role === 'admin'

  if (isAdmin) {
    return {
      userId:   session.user.id,
      role,
      isAdmin:  true,
      planTier: 'premium',
      hasPlan:  true,
      features: { ...PREMIUM_FALLBACK },
    }
  }

  const SELECT = 'id, status, trial_end_date, plan:venue_plans(id, name, permissions)'
  const { data: activeSub } = await svc
    .from('venue_subscriptions')
    .select(SELECT)
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: trialSub } = !activeSub
    ? await svc
        .from('venue_subscriptions')
        .select(SELECT)
        .eq('user_id', session.user.id)
        .eq('status', 'trial')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const sub = activeSub ?? trialSub
  const plan = (sub as any)?.plan ?? null
  const subscriptionStatus = (sub as any)?.status as string | null

  const isTrial = subscriptionStatus === 'trial'
  const trialEnd = (sub as any)?.trial_end_date as string | null
  const trialExpired = isTrial && trialEnd != null && new Date(trialEnd).getTime() <= Date.now()
  const hasPlan = !!plan && !trialExpired

  const planSlug = plan?.name ?? ''
  const planTier: 'basic' | 'premium' = hasPlan && planSlug !== 'basic' ? 'premium' : 'basic'

  const dbPerms = (plan?.permissions ?? {}) as Partial<PlanFeatures>
  const overrides = (profile?.features_override ?? {}) as Partial<PlanFeatures>
  const fallback = planTier === 'premium' ? PREMIUM_FALLBACK : BASIC_FALLBACK
  const hasExplicitPerms = Object.keys(dbPerms).length > 0

  const base = hasExplicitPerms ? { ...fallback, ...dbPerms } : fallback
  const features = Object.keys(overrides).length > 0 ? { ...base, ...overrides } : base

  return {
    userId: session.user.id,
    role,
    isAdmin: false,
    planTier,
    hasPlan,
    features,
  }
}

/**
 * Guard for API routes. Returns { ok: true } when the user has the feature,
 * or { ok: false, status, error } ready to be returned as JSON.
 * Admins always pass.
 */
export async function requireFeature(
  feature: keyof PlanFeatures,
): Promise<{ ok: true; userId: string } | { ok: false; status: 401 | 403; error: string }> {
  const plan = await getUserPlan()
  if (!plan) return { ok: false, status: 401, error: 'No autorizado' }
  if (plan.isAdmin) return { ok: true, userId: plan.userId }
  if (!plan.hasPlan) return { ok: false, status: 403, error: 'Se requiere un plan activo' }
  if (!plan.features[feature]) {
    return { ok: false, status: 403, error: 'Esta funcionalidad requiere el plan Premium' }
  }
  return { ok: true, userId: plan.userId }
}

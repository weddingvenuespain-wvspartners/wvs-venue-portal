import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './auth-context'
import { usePlanFeatures } from './use-plan-features'

/**
 * Redirects to /pricing if user is logged in but has no active subscription.
 * Admins are always exempt.
 * Call this at the top of every portal page.
 */
export function useRequireSubscription() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const { hasPlan } = usePlanFeatures()
  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (!loading && user && !isAdmin && !hasPlan) {
      router.replace('/pricing')
    }
  }, [loading, user, isAdmin, hasPlan, router])

  return {
    ready: !loading && !!user && (isAdmin || hasPlan),
    isBlocked: !loading && !!user && !isAdmin && !hasPlan,
  }
}

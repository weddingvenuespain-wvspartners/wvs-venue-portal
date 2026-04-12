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
  const isPending = profile?.status === 'pending_verification'

  // Only redirect when:
  // 1. Auth is fully loaded (loading = false)
  // 2. User exists
  // 3. Profile is confirmed loaded (not null) — avoids false redirect if profile fetch is slow
  // 4. User is confirmed NOT admin
  // 5. User has no active plan
  // 6. User is NOT pending verification (those stay on /pricing)
  const profileLoaded = !loading && profile !== null && profile !== undefined

  useEffect(() => {
    // Pending verification always stays on /pricing, even if they've already paid
    if (profileLoaded && user && !isAdmin && (isPending || !hasPlan)) {
      router.replace('/pricing')
    }
  }, [profileLoaded, user, isAdmin, hasPlan, isPending, router])

  return {
    ready: profileLoaded && !!user && (isAdmin || (hasPlan && !isPending)),
    isBlocked: profileLoaded && !!user && !isAdmin && (!hasPlan || isPending),
  }
}

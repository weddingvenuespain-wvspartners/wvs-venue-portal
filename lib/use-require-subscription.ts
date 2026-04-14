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
  const isPending = profile?.status === 'pending'
  const onboardingComplete = !!profile?.display_name && !!profile?.first_name

  // Only redirect when:
  // 1. Auth is fully loaded (loading = false)
  // 2. User exists
  // 3. Profile is confirmed loaded (not null) — avoids false redirect if profile fetch is slow
  // 4. User is confirmed NOT admin
  // 5. User has no active plan or hasn't completed onboarding
  const profileLoaded = !loading && profile !== null && profile !== undefined

  useEffect(() => {
    if (!profileLoaded || !user || isAdmin) return

    // If onboarding is not complete, always send to /onboarding
    if (!onboardingComplete) {
      router.replace('/onboarding')
      return
    }

    // Pending verification or no plan → /pricing
    if (isPending || !hasPlan) {
      router.replace('/pricing')
    }
  }, [profileLoaded, user, isAdmin, hasPlan, isPending, onboardingComplete, router])

  return {
    ready: profileLoaded && !!user && (isAdmin || (onboardingComplete && hasPlan && !isPending)),
    isBlocked: profileLoaded && !!user && !isAdmin && (!onboardingComplete || !hasPlan || isPending),
  }
}

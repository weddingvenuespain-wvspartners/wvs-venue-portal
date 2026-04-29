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

  // auth loading finished when loading = false, regardless of whether profile is null
  const authDone = !loading && !!user
  // profile row exists in DB (non-null after load)
  const profileLoaded = authDone && profile !== null && profile !== undefined

  useEffect(() => {
    if (!authDone || isAdmin) return

    // If profile is null after auth is done, the user has no profile row yet → onboarding
    if (!profileLoaded) {
      router.replace('/onboarding')
      return
    }

    // If onboarding is not complete, always send to /onboarding
    if (!onboardingComplete) {
      router.replace('/onboarding')
      return
    }

    // Pending verification or no plan → /pricing
    if (isPending || !hasPlan) {
      router.replace('/pricing')
    }
  }, [authDone, profileLoaded, isAdmin, hasPlan, isPending, onboardingComplete, router])

  return {
    ready: profileLoaded && !!user && (isAdmin || (onboardingComplete && hasPlan && !isPending)),
    isBlocked: profileLoaded && !!user && !isAdmin && (!onboardingComplete || !hasPlan || isPending),
  }
}

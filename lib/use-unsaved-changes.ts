'use client'
import { useCallback, useEffect, useRef } from 'react'

// Warn on tab close/refresh and intercept in-app link clicks when there are unsaved changes.
// Router.push interception is not officially supported in Next.js App Router, so we intercept
// anchor clicks at capture phase which catches <Link> navigations.
// For programmatic navigation (router.push), use the returned `confirmLeave` helper.
export function useUnsavedChanges(isDirty: boolean, message = 'Tienes cambios sin guardar. ¿Seguro que quieres salir?') {
  const dirtyRef = useRef(isDirty)
  dirtyRef.current = isDirty
  const messageRef = useRef(message)
  messageRef.current = message

  const confirmLeave = useCallback((action: () => void) => {
    if (dirtyRef.current && !window.confirm(messageRef.current)) return
    action()
  }, [])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = message
      return message
    }

    const onClickCapture = (e: MouseEvent) => {
      if (!dirtyRef.current) return
      const target = e.target as HTMLElement | null
      const anchor = target?.closest('a') as HTMLAnchorElement | null
      if (!anchor) return
      if (!anchor.href) return
      if (anchor.target === '_blank') return
      // Ignore hash-only links on same page
      const currentUrl = new URL(window.location.href)
      const targetUrl = new URL(anchor.href, window.location.href)
      if (targetUrl.origin === currentUrl.origin && targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search) return

      if (!window.confirm(message)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const onPopState = (e: PopStateEvent) => {
      if (!dirtyRef.current) return
      if (!window.confirm(message)) {
        // Re-push current URL to cancel the back navigation
        window.history.pushState(null, '', window.location.href)
      }
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClickCapture, true)
    window.addEventListener('popstate', onPopState)

    // Push an initial state so the first back press triggers popstate instead of leaving silently
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', window.location.href)
    }

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClickCapture, true)
      window.removeEventListener('popstate', onPopState)
    }
  }, [message])

  return { confirmLeave }
}

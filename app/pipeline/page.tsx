'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireSubscription } from '@/lib/use-require-subscription'
export default function PipelinePage() {
  const router = useRouter()
  const { isBlocked } = useRequireSubscription()
  useEffect(() => { router.replace('/leads') }, [router])
  if (isBlocked) return null
  return null
}

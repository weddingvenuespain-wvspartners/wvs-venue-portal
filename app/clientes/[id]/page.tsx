'use client'
import { useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
export default function RedirectClienteId({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  useEffect(() => { router.replace(`/crm/${id}`) }, [id])
  return null
}

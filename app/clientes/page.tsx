'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function RedirectClientes() {
  const router = useRouter()
  useEffect(() => { router.replace('/crm') }, [])
  return null
}

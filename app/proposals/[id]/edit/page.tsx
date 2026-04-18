'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import ProposalEditor, { type EditorProposal } from '@/components/ProposalEditor'
import { Loader2 } from 'lucide-react'

export default function ProposalEditarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { isBlocked } = useRequireSubscription()

  const [proposal, setProposal] = useState<EditorProposal | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    if (isBlocked) { router.push('/proposals'); return }
    const load = async () => {
      const supabase = createClient()
      const { data, error: err } = await supabase
        .from('proposals')
        .select('*, branding:proposal_branding(*)')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()
      if (err || !data) { setError('No se ha podido cargar la propuesta'); return }
      const branding = Array.isArray((data as any).branding) ? (data as any).branding[0] : (data as any).branding
      setProposal({
        id: data.id,
        slug: data.slug,
        couple_name: data.couple_name ?? '',
        guest_count: data.guest_count,
        wedding_date: data.wedding_date,
        price_estimate: data.price_estimate,
        personal_message: data.personal_message,
        couple_email: (data as any).couple_email ?? null,
        show_availability: data.show_availability ?? true,
        show_price_estimate: data.show_price_estimate ?? true,
        status: data.status,
        lead_id: data.lead_id,
        sections_data: (data as any).sections_data ?? null,
        template_id: (data as any).template_id ?? null,
        branding: branding ?? null,
      })
    }
    load()
  }, [user, authLoading, id, router])

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: 'var(--cream)' }}>
        <div style={{ color: '#991b1b' }}>{error}</div>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/proposals')}>← Volver a propuestas</button>
      </div>
    )
  }

  if (!proposal) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', color: 'var(--warm-gray)', gap: 8 }}>
        <Loader2 size={16} className="animate-spin" /> Cargando editor…
      </div>
    )
  }

  return <ProposalEditor proposal={proposal} />
}

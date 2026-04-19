'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Loader2, AlertCircle } from 'lucide-react'
import { getStarterTemplate } from '@/lib/proposal-starter-templates'

const MAX_PROPOSALS_PER_LEAD = 6

function generateSlug(name: string) {
  const base = (name || 'propuesta').toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
  const rand = Math.random().toString(36).slice(2, 6)
  return `${base || 'propuesta'}-${rand}`
}

function NuevaPropuestaContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    const leadId = searchParams.get('lead_id')
    const starter = getStarterTemplate(searchParams.get('template'))

    const createDraft = async () => {
      const supabase = createClient()

      // If a lead is linked, enforce max proposals per lead and pre-fill couple data
      let coupleName = starter?.couple_name ?? 'Nueva propuesta'
      let coupleEmail: string | null = null
      let guestCount: number | null = starter?.guest_count ?? null

      if (leadId) {
        const { count } = await supabase
          .from('proposals')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('lead_id', leadId)
        if ((count ?? 0) >= MAX_PROPOSALS_PER_LEAD) {
          setError(`Este lead ya tiene ${count} propuestas (máximo ${MAX_PROPOSALS_PER_LEAD}).`)
          return
        }
        const { data: lead } = await supabase
          .from('leads')
          .select('name, email, guests')
          .eq('id', leadId)
          .eq('user_id', user.id)
          .maybeSingle()
        if (lead) {
          // Lead data siempre prevalece sobre el starter
          coupleName = lead.name ?? coupleName
          coupleEmail = lead.email ?? null
          guestCount = lead.guests ?? guestCount
        }
      }

      // Get default web template (for the visual layout / template_id)
      const { data: defTpl } = await supabase
        .from('proposal_web_templates')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle()

      const slug = generateSlug(coupleName)
      const payload: any = {
        user_id: user.id,
        slug,
        couple_name: coupleName,
        couple_email: coupleEmail,
        guest_count: guestCount,
        lead_id: leadId || null,
        status: 'draft',
        show_availability: starter?.show_availability ?? true,
        show_price_estimate: starter?.show_price_estimate ?? true,
        sections_data: starter?.sections_data ?? { visual_template_id: 1 },
        template_id: defTpl?.id ?? null,
        ...(starter?.personal_message ? { personal_message: starter.personal_message } : {}),
        ...(starter?.price_estimate ? { price_estimate: starter.price_estimate } : {}),
      }

      let { data, error: insErr } = await supabase.from('proposals').insert(payload).select().single()
      // Retry without unknown columns if necessary
      if (insErr && insErr.code === '42703') {
        const { sections_data: _s, template_id: _t, show_price_estimate: _p, couple_email: _c, ...base } = payload
        const r = await supabase.from('proposals').insert(base).select().single()
        data = r.data; insErr = r.error
      }
      if (insErr || !data) {
        setError(`No se pudo crear la propuesta: ${insErr?.message ?? 'desconocido'}`)
        return
      }

      // Seed branding from starter when present (only if no row yet for this proposal)
      if (starter?.branding) {
        try {
          await supabase.from('proposal_branding').upsert({
            proposal_id: data.id,
            user_id: user.id,
            primary_color: starter.branding.primary_color,
            font_family: starter.branding.font_family,
          }, { onConflict: 'proposal_id' })
        } catch { /* noop — branding is optional */ }
      }

      router.replace(`/proposals/${data.id}/edit`)
    }

    createDraft()
  }, [user, authLoading, searchParams, router])

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: 'var(--cream)', padding: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#991b1b', fontSize: 14 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/proposals')}>← Volver a propuestas</button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', color: 'var(--warm-gray)', gap: 8 }}>
      <Loader2 size={16} className="animate-spin" /> Creando propuesta…
    </div>
  )
}

export default function NuevaPropuestaPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)' }}><Loader2 size={16} className="animate-spin" /></div>}>
      <NuevaPropuestaContent />
    </Suspense>
  )
}

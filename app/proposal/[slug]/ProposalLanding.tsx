'use client'
// app/proposal/[slug]/ProposalLanding.tsx
// Template router — selecciona entre T1…T5 según template_id
// En modo preview (?preview=1), escucha postMessage del editor para live preview.

import { useEffect, useState } from 'react'
import type { ProposalData } from './page'
import T1Impacto     from './tpl/T1Impacto'
import T2Emocion     from './tpl/T2Emocion'
import T3TodoClaro   from './tpl/T3TodoClaro'
import T4SocialProof from './tpl/T4SocialProof'
import T5Minimalista from './tpl/T5Minimalista'

export type PreviewMessage = {
  type: 'proposal-preview-update'
  patch: Partial<ProposalData>
}

export default function ProposalLanding({ data, preview }: { data: ProposalData; preview?: boolean }) {
  const [liveData, setLiveData] = useState<ProposalData>(data)

  useEffect(() => {
    if (!preview) return
    const onMessage = (e: MessageEvent<any>) => {
      const msg = e.data
      if (!msg || msg.type !== 'proposal-preview-update') return
      setLiveData(prev => ({ ...prev, ...msg.patch }))
    }
    window.addEventListener('message', onMessage)
    // Notify parent we're ready to receive state
    window.parent?.postMessage({ type: 'proposal-preview-ready' }, '*')
    return () => window.removeEventListener('message', onMessage)
  }, [preview])

  // Track view via server endpoint (RPC handles dedupe within 30 min + self-view skip).
  // Skipped in preview mode (editor iframe / template preview).
  useEffect(() => {
    if (preview) return
    if (typeof window === 'undefined') return
    let session = ''
    try {
      session = localStorage.getItem('wvs_proposal_session') || ''
      if (!session) {
        session = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
        localStorage.setItem('wvs_proposal_session', session)
      }
    } catch { session = `${Date.now()}-${Math.random().toString(36).slice(2)}` }

    fetch('/api/proposals/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: data.slug, session }),
      keepalive: true,
    }).catch(() => {})
  }, [data.slug, preview])

  const effective = preview ? liveData : data

  // Replace dynamic placeholders in personal_message
  const withPlaceholders: typeof effective = {
    ...effective,
    personal_message: effective.personal_message
      ?.replace(/\{\{pareja\}\}/gi, effective.couple_name ?? '')
      ?.replace(/\{\{invitados\}\}/gi, String(effective.guest_count ?? ''))
      ?.replace(/\{\{fecha\}\}/gi, effective.wedding_date
        ? new Date(effective.wedding_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
        : '') ?? null,
  }

  const templateId: number = (effective as any).sections_data?.visual_template_id
    ?? (effective as any).template_id
    ?? 1

  const sd = (effective as any).sections_data ?? {}
  const bgOverride  = sd.background_color as string | undefined
  const secOverride = sd.secondary_color  as string | undefined
  const colorMode   = (sd.color_mode as 'light' | 'dark' | undefined)
  const tpl = (() => {
    switch (templateId) {
      case 2:  return <T2Emocion     data={withPlaceholders} />
      case 3:  return <T3TodoClaro   data={withPlaceholders} />
      case 4:  return <T4SocialProof data={withPlaceholders} />
      case 5:  return <T5Minimalista data={withPlaceholders} />
      case 1:
      default: return <T1Impacto     data={withPlaceholders} />
    }
  })()

  const cssParts: string[] = []

  // Color mode: forces a light or dark variant on top of any template.
  if (colorMode) {
    const p = colorMode === 'dark'
      ? { canvas: '#0A0A0A', section: '#111111', altSection: '#0E0E0E', text: '#F5F5F5', border: 'rgba(255,255,255,.10)' }
      : { canvas: '#FAF7F2', section: '#FFFFFF', altSection: '#F5F0E8', text: '#1A1A1A', border: 'rgba(0,0,0,.08)' }
    cssParts.push(`
      html, body, .tpl-root { background: ${p.canvas} !important; color: ${p.text} !important }
      .tpl-root section, .tpl-root nav, .tpl-root footer,
      .tpl-root [class*="-section"],
      .tpl-root [class*="-stats"],
      .tpl-root [class*="-pkg"],
      .tpl-root [class*="-test"],
      .tpl-root [class*="-collab"],
      .tpl-root [class*="-zone"]:not([class*="img"]):not([class*="ph"]),
      .tpl-root [class*="-mosaic"],
      .tpl-root [class*="-card"],
      .tpl-root [class*="-season"],
      .tpl-root [class*="-story"]:not([class*="img"]),
      .tpl-root [class*="-inc"],
      .tpl-root [class*="-nav"],
      .tpl-root [class*="-faq"]
      { background-color: ${p.section} !important }
      .tpl-root h1, .tpl-root h2, .tpl-root h3, .tpl-root h4 { color: ${p.text} !important }
      .tpl-root [class*="-h"], .tpl-root [class*="-title"] { color: ${p.text} !important }
    `)
  } else if (bgOverride) {
    // Legacy single-color override (in case background_color is set but no mode)
    cssParts.push(`
      html, body, .tpl-root { background: ${bgOverride} !important }
      .tpl-root section, .tpl-root nav, .tpl-root footer,
      .tpl-root [class*="-section"], .tpl-root [class*="-stats"],
      .tpl-root [class*="-pkg"], .tpl-root [class*="-test"], .tpl-root [class*="-collab"],
      .tpl-root [class*="-zone"]:not([class*="img"]):not([class*="ph"]),
      .tpl-root [class*="-mosaic"], .tpl-root [class*="-card"],
      .tpl-root [class*="-season"], .tpl-root [class*="-story"]:not([class*="img"]),
      .tpl-root [class*="-inc"], .tpl-root [class*="-nav"], .tpl-root [class*="-faq"]
      { background-color: ${bgOverride} !important }
    `)
  }
  if (secOverride) cssParts.push(`:root{--tpl-secondary:${secOverride}}`)

  return (
    <>
      {cssParts.length > 0 && <style dangerouslySetInnerHTML={{ __html: cssParts.join('\n') }} />}
      {tpl}
    </>
  )
}

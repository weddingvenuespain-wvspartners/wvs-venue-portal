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

  switch (templateId) {
    case 2:  return <T2Emocion     data={withPlaceholders} />
    case 3:  return <T3TodoClaro   data={withPlaceholders} />
    case 4:  return <T4SocialProof data={withPlaceholders} />
    case 5:  return <T5Minimalista data={withPlaceholders} />
    case 1:
    default: return <T1Impacto     data={withPlaceholders} />
  }
}

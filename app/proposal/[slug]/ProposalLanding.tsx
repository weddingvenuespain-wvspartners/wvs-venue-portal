'use client'
// app/proposal/[slug]/ProposalLanding.tsx
// Template router — selecciona entre T1…T5 según template_id
// En modo preview (?preview=1), escucha postMessage del editor para live preview.

import { useEffect, useState } from 'react'
import type { ProposalData } from './page'
export type { SectionsData } from './tpl/shared'

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
  const templateId: number = (effective as any).sections_data?.visual_template_id
    ?? (effective as any).template_id
    ?? 1

  switch (templateId) {
    case 2:  return <T2Emocion     data={effective} />
    case 3:  return <T3TodoClaro   data={effective} />
    case 4:  return <T4SocialProof data={effective} />
    case 5:  return <T5Minimalista data={effective} />
    case 1:
    default: return <T1Impacto     data={effective} />
  }
}

'use client'
// app/proposal/[slug]/ProposalLanding.tsx
// Template router — selecciona entre T1…T5 según template_id

import type { ProposalData } from './page'
export type { SectionsData } from './tpl/shared'

import T1Impacto     from './tpl/T1Impacto'
import T2Emocion     from './tpl/T2Emocion'
import T3TodoClaro   from './tpl/T3TodoClaro'
import T4SocialProof from './tpl/T4SocialProof'
import T5Minimalista from './tpl/T5Minimalista'

export default function ProposalLanding({ data }: { data: ProposalData }) {
  const templateId: number = (data as any).sections_data?.visual_template_id
    ?? (data as any).template_id
    ?? 1

  switch (templateId) {
    case 2:  return <T2Emocion     data={data} />
    case 3:  return <T3TodoClaro   data={data} />
    case 4:  return <T4SocialProof data={data} />
    case 5:  return <T5Minimalista data={data} />
    case 1:
    default: return <T1Impacto     data={data} />
  }
}

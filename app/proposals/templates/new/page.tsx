'use client'
// /proposals/templates/new — editor de plantilla en modo borrador.
// No crea fila en BD; sólo se persiste al pulsar "Guardar".
// Acepta ?from=t1..t5 para precargar contenido de una de las muestras.

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import TemplateEditor, { type ContentTemplate } from '@/components/TemplateEditor'
import { getDefaultTemplate } from '@/lib/proposal-starter-templates'

const BLANK_TEMPLATE: ContentTemplate = {
  id: 'new',
  name: '',
  description: null,
  is_default: false,
  sections_data: {
    has_catering: true,
    sections_enabled: { hero: true, welcome: true, gallery: true, testimonials: true, map: true, contact: true },
  },
}

function NewTemplateContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromId = searchParams.get('from')

  const cateringParam = searchParams.get('catering')
  const modalityIdParam = searchParams.get('modality_id')

  const draftTemplate = useMemo<ContentTemplate>(() => {
    const base = (() => {
      if (!fromId) return BLANK_TEMPLATE
      const sample = getDefaultTemplate(fromId)
      if (!sample) return BLANK_TEMPLATE
      return { id: 'new', name: sample.name, description: sample.description, is_default: false, sections_data: sample.sections_data }
    })()
    // Apply catering + modality choices from modal picker
    const extraSd: Record<string, unknown> = {}
    if (cateringParam !== null) extraSd.has_catering = cateringParam === '1'
    if (modalityIdParam) extraSd.default_modality_id = modalityIdParam
    const hasPickerChoices = cateringParam !== null
    if (hasPickerChoices) extraSd.__wizard_done = true  // signal TemplateEditor to skip wizard
    return {
      ...base,
      sections_data: { ...base.sections_data, ...extraSd },
    }
  }, [fromId, cateringParam, modalityIdParam])

  return (
    <TemplateEditor
      template={draftTemplate}
      onBack={() => router.push('/proposals/templates')}
      onSave={saved => router.replace(`/proposals/templates/${saved.id}`)}
    />
  )
}

export default function NewTemplatePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--cream)' }} />}>
      <NewTemplateContent />
    </Suspense>
  )
}


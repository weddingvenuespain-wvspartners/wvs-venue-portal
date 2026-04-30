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

  const draftTemplate = useMemo<ContentTemplate>(() => {
    if (!fromId) return BLANK_TEMPLATE
    const sample = getDefaultTemplate(fromId)
    if (!sample) return BLANK_TEMPLATE
    return {
      id: 'new',
      name: sample.name,
      description: sample.description,
      is_default: false,
      sections_data: sample.sections_data,
    }
  }, [fromId])

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


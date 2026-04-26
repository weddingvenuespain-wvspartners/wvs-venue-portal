'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import TemplateEditor, { type ContentTemplate } from '@/components/TemplateEditor'

export default function TemplateEditorPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [template, setTemplate] = useState<ContentTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const id = params?.id as string

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    fetch(`/api/proposal-templates/${id}`)
      .then(async r => {
        if (!r.ok) throw new Error('No encontrado')
        return r.json()
      })
      .then(data => { setTemplate(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [id, user, authLoading, router])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)' }}>
      <Loader2 size={18} className="animate-spin" style={{ color: 'var(--warm-gray)' }} />
    </div>
  )

  if (error || !template) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--cream)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#991b1b', fontSize: 14 }}>
        <AlertCircle size={16} />{error ?? 'Plantilla no encontrada'}
      </div>
      <button className="btn btn-ghost btn-sm" onClick={() => router.push('/proposals/templates')}>← Volver a plantillas</button>
    </div>
  )

  return (
    <TemplateEditor
      template={template}
      onBack={() => router.push('/proposals/templates')}
      onSave={updated => setTemplate(updated)}
    />
  )
}

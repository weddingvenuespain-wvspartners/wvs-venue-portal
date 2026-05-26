import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// POST /api/proposals/[id]/provider-selection
// Public — couple submits own-provider selections from the proposal landing.
// Mirrors into proposal_inquiries so the venue sees it in the unified inbox.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const svc = getServiceClient()

    // Verify proposal exists
    const { data: proposal, error: propErr } = await svc
      .from('proposals')
      .select('id, slug, couple_name, user_id')
      .eq('id', id)
      .maybeSingle()

    if (propErr || !proposal) {
      return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
    }

    // Normalize payload
    // selections: Array<{ category, providerName?, type: 'per_collaborator'|'generic', price? }>
    const selections: Array<{
      category: string
      provider_name?: string
      type: 'per_collaborator' | 'generic'
      price?: string
    }> = Array.isArray(body.selections) ? body.selections : []

    if (selections.length === 0) {
      return NextResponse.json({ error: 'Sin selecciones' }, { status: 400 })
    }

    const coupleName = body.couple_name || proposal.couple_name || 'Pareja'
    const comments = body.comments?.trim?.() || null

    // Build a summary message for the inquiry
    const summaryLines = selections.map(s => {
      const label = s.type === 'generic' ? 'Proveedor externo (genérico)' : s.category
      const name = s.provider_name ? ` → ${s.provider_name}` : ''
      const price = s.price ? ` (${Number(s.price).toLocaleString('es-ES')} €)` : ''
      return `• ${label}${name}${price}`
    })
    const message = [
      'Proveedores propios seleccionados:',
      ...summaryLines,
      comments ? `\nComentarios: ${comments}` : '',
    ].filter(Boolean).join('\n')

    // Insert into proposal_inquiries
    const { error: inqErr } = await svc.from('proposal_inquiries').insert({
      proposal_id: id,
      user_id: proposal.user_id,
      kind: 'provider_selection',
      kind_label: 'Selección de proveedores',
      name: coupleName,
      email: null,
      phone: null,
      preferred_dates: [],
      message,
      status: 'new',
      payload: {
        selections,
        comments,
      },
    })

    if (inqErr) {
      console.error('[provider-selection] insert error', inqErr.message)
      return NextResponse.json({ error: 'No se ha podido guardar' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[provider-selection]', err)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}

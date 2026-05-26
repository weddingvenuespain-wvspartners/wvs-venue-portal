// POST /api/contracts/sign
// Public endpoint — couple signs a contract from the public budget view.
// Validates contract belongs to the given budget_slug to prevent cross-contract abuse.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  try {
    const { contract_id, budget_slug, signature_data, full_name, nif, address } = await req.json()
    if (!contract_id || !budget_slug || !signature_data) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Billing fields required
    if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
      return NextResponse.json({ error: 'Nombre completo obligatorio' }, { status: 400 })
    }
    if (!nif || typeof nif !== 'string' || !nif.trim()) {
      return NextResponse.json({ error: 'DNI / NIF obligatorio' }, { status: 400 })
    }
    if (!address || typeof address !== 'string' || !address.trim()) {
      return NextResponse.json({ error: 'Dirección obligatoria' }, { status: 400 })
    }

    // Basic data-URL validation
    if (typeof signature_data !== 'string' || !signature_data.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
    }

    // Limit size (data URLs can grow; cap at ~1MB)
    if (signature_data.length > 1_500_000) {
      return NextResponse.json({ error: 'Firma demasiado grande' }, { status: 400 })
    }

    // Cap text fields to prevent abuse
    const fullNameClean = full_name.trim().slice(0, 200)
    const nifClean = nif.trim().slice(0, 50)
    const addressClean = address.trim().slice(0, 500)

    const svc = getServiceClient()

    // Verify contract belongs to a budget with this slug
    const { data: budget } = await svc.from('budgets').select('id, lead_id').eq('slug', budget_slug).single()
    if (!budget) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    const { data: contract } = await svc.from('venue_contracts').select('id, status, client_signed_at, lead_id').eq('id', contract_id).eq('budget_id', budget.id).maybeSingle()
    if (!contract) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }

    if (contract.client_signed_at) {
      return NextResponse.json({ error: 'Contrato ya firmado' }, { status: 400 })
    }

    if (!['sent', 'draft'].includes(contract.status)) {
      return NextResponse.json({ error: 'No se puede firmar este contrato' }, { status: 400 })
    }

    const now = new Date().toISOString()
    await svc.from('venue_contracts').update({
      client_signature_url: signature_data,
      client_signed_at: now,
      client_name: fullNameClean,
      client_nif: nifClean,
      status: 'signed',
    }).eq('id', contract_id)

    // Save billing info to associated lead
    const leadId = contract.lead_id || budget.lead_id
    if (leadId) {
      await svc.from('leads').update({
        billing_name: fullNameClean,
        billing_nif: nifClean,
        billing_address: addressClean,
      }).eq('id', leadId)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[/api/contracts/sign]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

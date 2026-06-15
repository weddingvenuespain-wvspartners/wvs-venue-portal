import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ── GET /api/invoices/[id] ───────────────────────────────────────────────────
// Generate an HTML invoice for a payment event, rendered as PDF-ready page.
// Returns HTML that can be printed to PDF via browser print dialog.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('No autenticado', { status: 401 })

    const svc = getServiceClient()

    // Fetch payment event (only user's own)
    const { data: payment } = await svc
      .from('venue_payment_history')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!payment) return new NextResponse('Factura no encontrada', { status: 404 })

    // Fetch user profile for invoice details
    const { data: profile } = await svc
      .from('venue_profiles')
      .select('display_name, first_name, last_name')
      .eq('user_id', user.id)
      .single()

    // Fetch venue info
    const { data: venue } = await svc
      .from('venue_onboarding')
      .select('name, company_name, cif_nif, address, city, postal_code, country')
      .eq('user_id', user.id)
      .maybeSingle()

    // Fetch plan name if available
    let planName = ''
    if (payment.plan_id) {
      const { data: plan } = await svc
        .from('venue_plans')
        .select('display_name')
        .eq('id', payment.plan_id)
        .single()
      planName = plan?.display_name || ''
    }

    const date = new Date(payment.created_at)
    const invoiceNumber = `FV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${payment.reference || id.slice(0, 8).toUpperCase()}`
    const amount = payment.amount ?? 0
    const iva = amount * 0.21
    const base = amount - iva
    const clientName = venue?.company_name || venue?.name || profile?.display_name || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || user.email

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Factura ${invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; background: #fff; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #4A6B52; padding-bottom: 20px; }
    .logo { font-size: 22px; font-weight: 800; color: #4A6B52; letter-spacing: -0.5px; }
    .logo-sub { font-size: 11px; color: #888; margin-top: 2px; }
    .invoice-title { text-align: right; }
    .invoice-title h1 { font-size: 28px; color: #4A6B52; font-weight: 300; letter-spacing: 2px; }
    .invoice-title .number { font-size: 13px; color: #666; margin-top: 4px; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 32px; }
    .party { flex: 1; }
    .party-label { font-size: 9px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
    .party-name { font-size: 15px; font-weight: 600; color: #333; }
    .party-detail { font-size: 12px; color: #666; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #f8f7f5; text-align: left; padding: 10px 14px; font-size: 10px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e2dc; }
    td { padding: 12px 14px; border-bottom: 1px solid #f0ede8; font-size: 13px; }
    .amount { text-align: right; font-weight: 600; }
    .totals { margin-left: auto; width: 260px; }
    .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #666; }
    .totals .total { border-top: 2px solid #4A6B52; padding-top: 10px; margin-top: 6px; font-size: 16px; font-weight: 700; color: #333; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e2dc; font-size: 11px; color: #999; text-align: center; line-height: 1.8; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-paid { background: #EDF2ED; color: #4A6B52; }
    @media print { body { padding: 20px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:right;margin-bottom:20px;">
    <button onclick="window.print()" style="padding:8px 20px;background:#4A6B52;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">
      Imprimir / Guardar PDF
    </button>
  </div>

  <div class="header">
    <div>
      <div class="logo">FOREVENTOS</div>
      <div class="logo-sub">Plataforma de gestión para venues</div>
    </div>
    <div class="invoice-title">
      <h1>FACTURA</h1>
      <div class="number">${invoiceNumber}</div>
      <div class="number">${date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
      <div style="margin-top:6px"><span class="badge badge-paid">Pagada</span></div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">Emisor</div>
      <div class="party-name">FOREVENTOS S.L.</div>
      <div class="party-detail">
        CIF: B-XXXXXXXX<br>
        info@foreventos.com<br>
        España
      </div>
    </div>
    <div class="party" style="text-align:right">
      <div class="party-label">Cliente</div>
      <div class="party-name">${clientName}</div>
      <div class="party-detail">
        ${venue?.cif_nif ? `CIF/NIF: ${venue.cif_nif}<br>` : ''}
        ${venue?.address ? `${venue.address}<br>` : ''}
        ${venue?.postal_code || ''} ${venue?.city || ''}
        ${venue?.country ? `<br>${venue.country}` : ''}
        ${!venue?.address ? `${user.email}` : ''}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Concepto</th>
        <th>Período</th>
        <th>Referencia</th>
        <th class="amount">Importe</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <strong>Suscripción FOREVENTOS${planName ? ` — ${planName}` : ''}</strong>
          ${payment.billing_cycle ? `<br><span style="font-size:11px;color:#888">Ciclo: ${payment.billing_cycle}</span>` : ''}
        </td>
        <td>${date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}</td>
        <td style="font-size:11px;color:#888">${payment.reference || '—'}</td>
        <td class="amount">${amount.toFixed(2)} €</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Base imponible</span><span>${base.toFixed(2)} €</span></div>
    <div class="row"><span>IVA (21%)</span><span>${iva.toFixed(2)} €</span></div>
    <div class="row total"><span>TOTAL</span><span>${amount.toFixed(2)} €</span></div>
  </div>

  <div class="footer">
    FOREVENTOS · Plataforma de gestión para venues de bodas y eventos<br>
    Este documento sirve como justificante de pago. Conserve una copia para sus registros.
  </div>
</body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err: any) {
    console.error('[/api/invoices]', err)
    return new NextResponse('Error al generar factura', { status: 500 })
  }
}

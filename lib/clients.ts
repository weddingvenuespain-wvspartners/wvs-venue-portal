import { createClient } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClientType = 'pareja' | 'wedding_planner' | 'organizador' | 'empresa' | 'cliente' | 'otro'

export type Client = {
  id: string
  venue_id: string
  name: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  client_type: ClientType
  tags: string[]
  notes: string
  language: string | null
  country: string | null
  parent_client_id: string | null
  wp_commission_percent: number | null
  wp_commission_type: string | null
  wp_agreement_notes: string | null
  wp_agreement_start: string | null
  wp_agreement_end: string | null
  wp_documents: { url: string; name: string; type?: string; uploaded_at?: string }[]
  created_at: string
}

export type ClientWithStats = Client & {
  active_leads: number
  total_leads: number
  last_contact: string | null
  couple_count?: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  pareja: 'Pareja',
  wedding_planner: 'Wedding Planner',
  organizador: 'Organizador',
  empresa: 'Empresa',
  cliente: 'Cliente',
  otro: 'Otro',
}

export const CLIENT_TYPE_COLORS: Record<ClientType, { bg: string; color: string; border: string }> = {
  pareja:          { bg: '#F3EBD8', color: '#7A5A2E', border: '#E2D4AE' },
  wedding_planner: { bg: '#f3e8ff', color: '#5A4878', border: '#d8b4fe' },
  organizador:     { bg: '#f3e8ff', color: '#5A4878', border: '#d8b4fe' },
  empresa:         { bg: '#f3e8ff', color: '#5A4878', border: '#d8b4fe' },
  cliente:         { bg: '#EDF2ED', color: '#35513E', border: '#BFD2C5' },
  otro:            { bg: '#f5f5f4', color: '#57534e', border: '#d6d3d1' },
}

/** Professional contact types — can have linked couples, collaborations, commissions */
export const PROFESSIONAL_TYPES: ClientType[] = ['wedding_planner', 'organizador', 'empresa']

/** Check if a client type is a professional/collaborator (WP, organizer, company) */
export function isProfessional(clientType: ClientType | string | null | undefined): boolean {
  return PROFESSIONAL_TYPES.includes(clientType as ClientType)
}

// ── Auto-match: find or create client for a lead ──────────────────────────────

/**
 * Server-side variant — accepts any Supabase client (service-role or browser).
 * Matches by email → phone → name, or creates a new client.
 */
export async function findOrCreateClientWithClient(
  supabase: any,
  venueId: string,
  lead: { name: string; email?: string | null; phone?: string | null; whatsapp?: string | null; language?: string | null; country?: string | null; source?: string | null },
): Promise<string | null> {
  // 1. Match by email
  if (lead.email) {
    const { data: byEmail } = await supabase
      .from('clients').select('id, email, phone, whatsapp, language, country, name').eq('venue_id', venueId).eq('email', lead.email).limit(1).single()
    if (byEmail) {
      await enrichClient(supabase, byEmail, lead)
      return byEmail.id
    }
  }
  // 2. Match by phone
  if (lead.phone) {
    const { data: byPhone } = await supabase
      .from('clients').select('id, email, phone, whatsapp, language, country, name').eq('venue_id', venueId).eq('phone', lead.phone).limit(1).single()
    if (byPhone) {
      await enrichClient(supabase, byPhone, lead)
      return byPhone.id
    }
  }
  // 3. Create new
  const clientType = lead.source === 'wedding_planner' ? 'wedding_planner' : 'pareja'
  const { data: newClient, error } = await supabase
    .from('clients')
    .insert({
      venue_id: venueId,
      name: lead.name || '',
      email: lead.email || null,
      phone: lead.phone || null,
      whatsapp: lead.whatsapp || null,
      language: lead.language || null,
      country: lead.country || null,
      client_type: clientType as ClientType,
    })
    .select('id')
    .single()
  if (error) { console.error('Error creating client:', error); return null }
  return newClient?.id ?? null
}

/**
 * Auto-enrich: fill in missing fields on an existing client from new lead data.
 * Only updates null/empty fields — never overwrites existing data.
 */
async function enrichClient(
  supabase: any,
  existing: { id: string; email?: string | null; phone?: string | null; whatsapp?: string | null; language?: string | null; country?: string | null; name?: string | null },
  lead: { name?: string | null; email?: string | null; phone?: string | null; whatsapp?: string | null; language?: string | null; country?: string | null },
) {
  const updates: Record<string, string> = {}
  if (!existing.email    && lead.email)    updates.email    = lead.email
  if (!existing.phone    && lead.phone)    updates.phone    = lead.phone
  if (!existing.whatsapp && lead.whatsapp) updates.whatsapp = lead.whatsapp
  if (!existing.language && lead.language) updates.language = lead.language
  if (!existing.country  && lead.country)  updates.country  = lead.country
  if (!existing.name     && lead.name)     updates.name     = lead.name
  if (Object.keys(updates).length > 0) {
    await supabase.from('clients').update(updates).eq('id', existing.id)
  }
}

/** Browser-side variant — uses browser Supabase client */
export async function findOrCreateClient(
  venueId: string,
  lead: { name: string; email?: string | null; phone?: string | null; whatsapp?: string | null; language?: string | null; country?: string | null }
): Promise<string | null> {
  const supabase = createClient()

  // 1. Try match by email
  if (lead.email) {
    const { data: byEmail } = await supabase
      .from('clients')
      .select('id, email, phone, whatsapp, language, country, name')
      .eq('venue_id', venueId)
      .eq('email', lead.email)
      .limit(1)
      .single()
    if (byEmail) {
      await enrichClient(supabase, byEmail, lead)
      return byEmail.id
    }
  }

  // 2. Try match by phone
  if (lead.phone) {
    const { data: byPhone } = await supabase
      .from('clients')
      .select('id, email, phone, whatsapp, language, country, name')
      .eq('venue_id', venueId)
      .eq('phone', lead.phone)
      .limit(1)
      .single()
    if (byPhone) {
      await enrichClient(supabase, byPhone, lead)
      return byPhone.id
    }
  }

  // 3. No match → create new client
  const { data: newClient, error } = await supabase
    .from('clients')
    .insert({
      venue_id: venueId,
      name: lead.name || '',
      email: lead.email || null,
      phone: lead.phone || null,
      whatsapp: lead.whatsapp || null,
      language: lead.language || null,
      country: lead.country || null,
      client_type: 'pareja' as ClientType,
    })
    .select('id')
    .single()

  if (error) { console.error('Error creating client:', error); return null }
  return newClient?.id ?? null
}

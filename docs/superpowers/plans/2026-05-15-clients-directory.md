# Clients Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Clientes" section to the venue portal — a contact directory with individual detail pages, backed by a new `clients` table that groups leads under a single client identity.

**Architecture:** New Supabase table `clients` with FK `client_id` on `leads`. Client-side pages at `/clientes` (list + drawer) and `/clientes/[id]` (detail with tabs). Auto-match logic links leads to clients by email/phone. Migration script creates clients from existing leads.

**Tech Stack:** Next.js 15 App Router, Supabase (RLS), React client components, shadcn/ui (Sheet, Dialog, Select, Tabs), Lucide icons, inline styles (project convention).

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase_migrations_clients.sql` | Create | DDL: clients table, leads.client_id FK, RLS policies, migration query |
| `lib/clients.ts` | Create | Client types, auto-match helper, shared constants |
| `components/Sidebar.tsx` | Modify (line 147) | Add "Clientes" nav item between Leads and Dosieres |
| `app/clientes/page.tsx` | Create | Client list page with table, search, filters, drawer |
| `app/clientes/[id]/page.tsx` | Create | Client detail page with tabs (Peticiones, Propuestas, Notas, Info) |
| `app/leads/page.tsx` | Modify | Add client link in lead drawer, client selector in lead form |

---

### Task 1: Database Schema — `clients` table & migration

**Files:**
- Create: `supabase_migrations_clients.sql`

This SQL file is run manually in Supabase SQL Editor (project convention — no automated migration runner).

- [ ] **Step 1: Write the migration SQL**

```sql
-- ============================================================
-- WVS — Clients directory: table + leads FK + data migration
-- Run in: Supabase → SQL Editor → New Query
-- ============================================================

-- 1. Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  email       TEXT,
  phone       TEXT,
  whatsapp    TEXT,
  client_type TEXT NOT NULL DEFAULT 'pareja'
    CHECK (client_type IN ('pareja','wedding_planner','organizador','empresa','cliente','otro')),
  tags        JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes       TEXT NOT NULL DEFAULT '',
  language    TEXT,
  country     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clients_venue_id ON clients(venue_id);
CREATE INDEX IF NOT EXISTS idx_clients_email    ON clients(venue_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_phone    ON clients(venue_id, phone) WHERE phone IS NOT NULL;

-- RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY clients_select ON clients FOR SELECT
  USING (venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid()));

CREATE POLICY clients_insert ON clients FOR INSERT
  WITH CHECK (venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid()));

CREATE POLICY clients_update ON clients FOR UPDATE
  USING (venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid()));

CREATE POLICY clients_delete ON clients FOR DELETE
  USING (venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid()));

-- 2. Add client_id FK to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_leads_client_id ON leads(client_id) WHERE client_id IS NOT NULL;

-- 3. Migrate existing leads → create clients grouped by email/phone
-- Step 3a: Create clients from leads grouped by COALESCE(email, phone)
INSERT INTO clients (venue_id, name, email, phone, whatsapp, language, country, created_at)
SELECT DISTINCT ON (venue_id, COALESCE(NULLIF(email,''), '__no_email__') || '::' || COALESCE(NULLIF(phone,''), '__no_phone__'))
  venue_id,
  name,
  NULLIF(email, ''),
  NULLIF(phone, ''),
  NULLIF(whatsapp, ''),
  language,
  country,
  MIN(created_at) OVER (PARTITION BY venue_id, COALESCE(NULLIF(email,''), '__no_email__') || '::' || COALESCE(NULLIF(phone,''), '__no_phone__'))
FROM leads
WHERE client_id IS NULL
ORDER BY venue_id,
  COALESCE(NULLIF(email,''), '__no_email__') || '::' || COALESCE(NULLIF(phone,''), '__no_phone__'),
  created_at DESC;

-- Step 3b: Link leads to their newly created clients (match by email first, then phone)
UPDATE leads l
SET client_id = c.id
FROM clients c
WHERE l.client_id IS NULL
  AND l.venue_id = c.venue_id
  AND (
    (l.email IS NOT NULL AND l.email != '' AND c.email = l.email)
    OR (l.phone IS NOT NULL AND l.phone != '' AND c.phone = l.phone AND (l.email IS NULL OR l.email = ''))
  );

-- Step 3c: Any remaining leads without a match (edge case) → create individual clients
INSERT INTO clients (venue_id, name, email, phone, whatsapp, language, country, created_at)
SELECT venue_id, name, NULLIF(email,''), NULLIF(phone,''), NULLIF(whatsapp,''), language, country, created_at
FROM leads
WHERE client_id IS NULL;

UPDATE leads l
SET client_id = c.id
FROM clients c
WHERE l.client_id IS NULL
  AND l.venue_id = c.venue_id
  AND l.name = c.name
  AND l.created_at = c.created_at;
```

- [ ] **Step 2: Save to `supabase_migrations_clients.sql`**

Save the file at project root (same location as other migration files like `supabase_migrations_leads_new_fields.sql`).

- [ ] **Step 3: Run in Supabase SQL Editor**

Go to Supabase Dashboard → SQL Editor → New Query → paste and run.
Expected: tables created, leads migrated, no errors.

- [ ] **Step 4: Verify migration**

Run in SQL Editor:
```sql
SELECT count(*) FROM clients;
SELECT count(*) FROM leads WHERE client_id IS NOT NULL;
SELECT count(*) FROM leads WHERE client_id IS NULL;
```
Expected: clients count > 0, most leads have client_id, few/zero NULL.

- [ ] **Step 5: Commit**

```bash
git add supabase_migrations_clients.sql
git commit -m "feat: add clients table, leads.client_id FK, and data migration"
```

---

### Task 2: Shared Types & Auto-match Helper

**Files:**
- Create: `lib/clients.ts`

- [ ] **Step 1: Create the types and helper file**

```typescript
// lib/clients.ts
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
  created_at: string
}

export type ClientWithStats = Client & {
  active_leads: number
  total_leads: number
  last_contact: string | null
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
  pareja:          { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  wedding_planner: { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' },
  organizador:     { bg: '#dbeafe', color: '#1e3a8a', border: '#93c5fd' },
  empresa:         { bg: '#f1f5f9', color: '#334155', border: '#cbd5e1' },
  cliente:         { bg: '#ecfdf5', color: '#065f46', border: '#6ee7b7' },
  otro:            { bg: '#f5f5f4', color: '#57534e', border: '#d6d3d1' },
}

// ── Auto-match: find or create client for a lead ──────────────────────────────

export async function findOrCreateClient(
  venueId: string,
  lead: { name: string; email?: string | null; phone?: string | null; whatsapp?: string | null; language?: string | null; country?: string | null }
): Promise<string | null> {
  const supabase = createClient()

  // 1. Try match by email
  if (lead.email) {
    const { data: byEmail } = await supabase
      .from('clients')
      .select('id')
      .eq('venue_id', venueId)
      .eq('email', lead.email)
      .limit(1)
      .single()
    if (byEmail) return byEmail.id
  }

  // 2. Try match by phone
  if (lead.phone) {
    const { data: byPhone } = await supabase
      .from('clients')
      .select('id')
      .eq('venue_id', venueId)
      .eq('phone', lead.phone)
      .limit(1)
      .single()
    if (byPhone) return byPhone.id
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
      client_type: 'pareja',
    })
    .select('id')
    .single()

  if (error) { console.error('Error creating client:', error); return null }
  return newClient?.id ?? null
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/clients.ts
git commit -m "feat: add client types, constants, and auto-match helper"
```

---

### Task 3: Sidebar — Add "Clientes" Nav Item

**Files:**
- Modify: `components/Sidebar.tsx` (line 147, between leads and proposals)

- [ ] **Step 1: Add the nav item**

In `components/Sidebar.tsx`, find the `venueItems` array (line 144). Insert a new entry after the "Leads" item (line 147) and before the "Dosieres" item (line 148):

```typescript
// After this line:
{ href: '/leads',        label: 'Leads',        icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zM2 14s1-4 6-4 6 4 6 4', feature: 'leads'        },
// Add this line:
{ href: '/clientes',     label: 'Clientes',     icon: 'M1 12s2-4 7-4 7 4 7 4M8 8a3 3 0 100-6 3 3 0 000 6zM15 12s-1-2.5-3.5-3.5M12.5 5.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z', feature: 'leads' },
// Before this line:
{ href: '/proposals',    label: isMultiVenue ? 'Mis dosieres' : 'Dosieres', ...
```

The icon is a two-person SVG path. Feature gate uses `'leads'` — same as leads (any venue with leads access can see clients).

- [ ] **Step 2: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: add Clientes nav item to sidebar"
```

---

### Task 4: Client List Page — `/clientes`

**Files:**
- Create: `app/clientes/page.tsx`

This is the main client directory page. It follows the same patterns as `app/leads/page.tsx`: client component, `useAuth()`, `useRequireSubscription()`, Supabase client-side queries, inline styles.

- [ ] **Step 1: Create the page file**

Create `app/clientes/page.tsx` with this content:

```typescript
'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Plus, Search, X, Phone, Mail, MessageCircle, Users, ExternalLink, ChevronRight, Edit2, Trash2 } from 'lucide-react'
import { Client, ClientType, ClientWithStats, CLIENT_TYPE_LABELS, CLIENT_TYPE_COLORS, findOrCreateClient } from '@/lib/clients'

// ── Status labels (reused from leads) ─────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  new: 'Nuevo', contacted: 'Contactado', proposal_sent: 'Propuesta enviada',
  visit_scheduled: 'Visita programada', post_visit: 'Post-visita',
  budget_sent: 'Presupuesto enviado', won: 'Confirmado', lost: 'Perdido',
}
const STATUS_COLOR: Record<string, string> = {
  new: '#eab308', contacted: '#3b82f6', proposal_sent: '#8b5cf6',
  visit_scheduled: '#06b6d4', post_visit: '#f97316',
  budget_sent: '#10b981', won: '#22c55e', lost: '#ef4444',
}

export default function ClientesPage() {
  const { user, activeVenue, authLoading } = useAuth()
  useRequireSubscription()
  const router = useRouter()
  const supabase = createClient()

  const [clients, setClients] = useState<ClientWithStats[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Drawer state
  const [drawerClient, setDrawerClient] = useState<ClientWithStats | null>(null)
  const [drawerLeads, setDrawerLeads] = useState<any[]>([])

  // New client modal
  const [showNewModal, setShowNewModal] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', email: '', phone: '', whatsapp: '', client_type: 'pareja' as ClientType, notes: '' })
  const [saving, setSaving] = useState(false)

  // ── Data loading ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !activeVenue) return
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeVenue?.id])

  const loadData = async () => {
    if (!activeVenue) return
    setLoading(true)

    const [clientsRes, leadsRes] = await Promise.all([
      supabase.from('clients').select('*').eq('venue_id', activeVenue.id).order('created_at', { ascending: false }),
      supabase.from('leads').select('id, name, email, status, client_id, created_at, wedding_date, guests').eq('venue_id', activeVenue.id),
    ])

    const rawClients: Client[] = clientsRes.data ?? []
    const rawLeads: any[] = leadsRes.data ?? []
    setLeads(rawLeads)

    // Compute stats per client
    const withStats: ClientWithStats[] = rawClients.map(c => {
      const clientLeads = rawLeads.filter(l => l.client_id === c.id)
      const activeLeads = clientLeads.filter(l => l.status !== 'won' && l.status !== 'lost')
      const lastLead = clientLeads.sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))[0]
      return {
        ...c,
        active_leads: activeLeads.length,
        total_leads: clientLeads.length,
        last_contact: lastLead?.created_at ?? c.created_at,
      }
    })

    // Sort by last_contact desc
    withStats.sort((a, b) => (b.last_contact ?? '').localeCompare(a.last_contact ?? ''))
    setClients(withStats)
    setLoading(false)
  }

  // ── Filtering ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = clients
    if (typeFilter !== 'all') list = list.filter(c => c.client_type === typeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q)
      )
    }
    return list
  }, [clients, typeFilter, search])

  // ── Drawer ────────────────────────────────────────────────────────────────────
  const openDrawer = (client: ClientWithStats) => {
    setDrawerClient(client)
    setDrawerLeads(leads.filter(l => l.client_id === client.id))
  }

  // ── Create client ─────────────────────────────────────────────────────────────
  const createClient2 = async () => {
    if (!activeVenue || !newForm.name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('clients').insert({
      venue_id: activeVenue.id,
      name: newForm.name.trim(),
      email: newForm.email.trim() || null,
      phone: newForm.phone.trim() || null,
      whatsapp: newForm.whatsapp.trim() || null,
      client_type: newForm.client_type,
      notes: newForm.notes.trim(),
    })
    setSaving(false)
    if (!error) {
      setShowNewModal(false)
      setNewForm({ name: '', email: '', phone: '', whatsapp: '', client_type: 'pareja', notes: '' })
      loadData()
    }
  }

  // ── Delete client ─────────────────────────────────────────────────────────────
  const deleteClient = async (id: string) => {
    if (!confirm('Se eliminará este cliente. Sus peticiones (leads) se desvincularán pero no se borrarán.')) return
    // Unlink leads first
    await supabase.from('leads').update({ client_id: null }).eq('client_id', id)
    await supabase.from('clients').delete().eq('id', id)
    setDrawerClient(null)
    loadData()
  }

  // ── Format date ───────────────────────────────────────────────────────────────
  const fmtDate = (d: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // ── Auth guard ────────────────────────────────────────────────────────────────
  if (authLoading) return null
  if (!user) { router.push('/login'); return null }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cream)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--charcoal)', margin: 0 }}>Clientes</h1>
            <p style={{ fontSize: 13, color: 'var(--warm-gray)', margin: '4px 0 0' }}>
              {clients.length} contacto{clients.length !== 1 ? 's' : ''} en total
            </p>
          </div>
          <button onClick={() => setShowNewModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--gold)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            <Plus size={14} /> Nuevo cliente
          </button>
        </div>

        {/* ── Search & filters ───────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
            <input
              placeholder="Buscar por nombre, email o teléfono..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 10px 8px 30px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', background: '#fff' }}
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}>
                <X size={13} />
              </button>
            )}
          </div>
          <div style={{ width: 180 }}>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue placeholder="Todos los tipos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {(Object.keys(CLIENT_TYPE_LABELS) as ClientType[]).map(t => (
                  <SelectItem key={t} value={t}>{CLIENT_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--warm-gray)' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--warm-gray)', background: '#fff', borderRadius: 8, border: '1px solid var(--border)' }}>
            {search || typeFilter !== 'all' ? 'No se encontraron clientes con esos filtros.' : 'No hay clientes todavía.'}
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: 'var(--charcoal)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Nombre</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: 'var(--charcoal)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Tipo</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: 'var(--charcoal)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: 'var(--charcoal)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Teléfono</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 600, color: 'var(--charcoal)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Peticiones</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 600, color: 'var(--charcoal)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Último contacto</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const tc = CLIENT_TYPE_COLORS[c.client_type] ?? CLIENT_TYPE_COLORS.otro
                  return (
                    <tr key={c.id}
                      onClick={() => openDrawer(c)}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#faf9f7')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={{ padding: '12px 14px', fontWeight: 500, color: 'var(--charcoal)' }}>{c.name || '(sin nombre)'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                          {CLIENT_TYPE_LABELS[c.client_type] ?? c.client_type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#666' }}>{c.email || '—'}</td>
                      <td style={{ padding: '12px 14px', color: '#666' }}>{c.phone || '—'}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {c.active_leads > 0 ? (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#fef3c7', color: '#92400e' }}>
                            {c.active_leads} activa{c.active_leads !== 1 ? 's' : ''}
                          </span>
                        ) : c.total_leads > 0 ? (
                          <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{c.total_leads} total</span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#999', fontSize: 12 }}>{fmtDate(c.last_contact)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Quick-view Drawer ───────────────────────────────────────── */}
        <Sheet open={!!drawerClient} onOpenChange={open => { if (!open) setDrawerClient(null) }}>
          <SheetContent side="right" style={{ width: 400, padding: 0, display: 'flex', flexDirection: 'column' }}>
            <SheetTitle className="sr-only">Detalle de cliente</SheetTitle>
            {drawerClient && (() => {
              const tc = CLIENT_TYPE_COLORS[drawerClient.client_type] ?? CLIENT_TYPE_COLORS.otro
              return (
                <div style={{ flex: 1, overflow: 'auto' }}>
                  {/* Header */}
                  <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: tc.bg, border: `1px solid ${tc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: tc.color }}>
                        {(drawerClient.name || '?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--charcoal)' }}>{drawerClient.name}</div>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                          {CLIENT_TYPE_LABELS[drawerClient.client_type]}
                        </span>
                      </div>
                      <button onClick={() => deleteClient(drawerClient.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }} title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {/* Contact info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {drawerClient.email && (
                        <a href={`mailto:${drawerClient.email}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666', textDecoration: 'none' }}>
                          <Mail size={12} /> {drawerClient.email}
                        </a>
                      )}
                      {drawerClient.phone && (
                        <a href={`tel:${drawerClient.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666', textDecoration: 'none' }}>
                          <Phone size={12} /> {drawerClient.phone}
                        </a>
                      )}
                      {drawerClient.whatsapp && (
                        <a href={`https://wa.me/${drawerClient.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666', textDecoration: 'none' }}>
                          <MessageCircle size={12} /> {drawerClient.whatsapp}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Leads list */}
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--warm-gray)', marginBottom: 10 }}>
                      Peticiones ({drawerLeads.length})
                    </div>
                    {drawerLeads.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Sin peticiones vinculadas</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {drawerLeads.map((l: any) => (
                          <div key={l.id} onClick={() => router.push(`/leads?open=${l.id}`)}
                            style={{ padding: '8px 10px', background: 'var(--cream)', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[l.status] ?? '#999', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--charcoal)' }}>{l.name}</div>
                              <div style={{ fontSize: 11, color: '#999' }}>{STATUS_LABEL[l.status] ?? l.status} · {fmtDate(l.created_at)}</div>
                            </div>
                            <ChevronRight size={12} style={{ color: 'var(--warm-gray)' }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Ver ficha button */}
                  <div style={{ padding: '0 20px 20px' }}>
                    <button onClick={() => router.push(`/clientes/${drawerClient.id}`)}
                      style={{ width: '100%', padding: '10px', fontSize: 13, fontWeight: 600, color: 'var(--gold)', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <ExternalLink size={13} /> Ver ficha completa
                    </button>
                  </div>
                </div>
              )
            })()}
          </SheetContent>
        </Sheet>

        {/* ── New Client Modal ────────────────────────────────────────── */}
        <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
          <DialogContent style={{ maxWidth: 440 }}>
            <DialogTitle>Nuevo cliente</DialogTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              <input className="form-input" placeholder="Nombre *" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} />
              <input className="form-input" placeholder="Email" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder="Teléfono" style={{ flex: 1 }} value={newForm.phone} onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))} />
                <input className="form-input" placeholder="WhatsApp" style={{ flex: 1 }} value={newForm.whatsapp} onChange={e => setNewForm(f => ({ ...f, whatsapp: e.target.value }))} />
              </div>
              <Select value={newForm.client_type} onValueChange={v => setNewForm(f => ({ ...f, client_type: v as ClientType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CLIENT_TYPE_LABELS) as ClientType[]).map(t => (
                    <SelectItem key={t} value={t}>{CLIENT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <textarea className="form-textarea" placeholder="Notas (opcional)" rows={3} value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} />
              <button onClick={createClient2} disabled={saving || !newForm.name.trim()}
                style={{ padding: '10px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--gold)', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: saving || !newForm.name.trim() ? 0.5 : 1 }}>
                {saving ? 'Guardando...' : 'Crear cliente'}
              </button>
            </div>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/clientes/page.tsx
git commit -m "feat: add /clientes list page with table, search, filters, and drawer"
```

---

### Task 5: Client Detail Page — `/clientes/[id]`

**Files:**
- Create: `app/clientes/[id]/page.tsx`

- [ ] **Step 1: Create the detail page**

Create `app/clientes/[id]/page.tsx`:

```typescript
'use client'
import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ArrowLeft, Mail, Phone, MessageCircle, Edit2, Trash2, Plus, Link2, ExternalLink, ChevronRight, FileText } from 'lucide-react'
import { Client, ClientType, CLIENT_TYPE_LABELS, CLIENT_TYPE_COLORS } from '@/lib/clients'

type Tab = 'peticiones' | 'propuestas' | 'notas' | 'info'

const STATUS_LABEL: Record<string, string> = {
  new: 'Nuevo', contacted: 'Contactado', proposal_sent: 'Propuesta enviada',
  visit_scheduled: 'Visita programada', post_visit: 'Post-visita',
  budget_sent: 'Presupuesto enviado', won: 'Confirmado', lost: 'Perdido',
}
const STATUS_COLOR: Record<string, string> = {
  new: '#eab308', contacted: '#3b82f6', proposal_sent: '#8b5cf6',
  visit_scheduled: '#06b6d4', post_visit: '#f97316',
  budget_sent: '#10b981', won: '#22c55e', lost: '#ef4444',
}

const BUDGET_LABELS: Record<string, string> = {
  '<10k': 'Menos de 10.000€', '10k-15k': '10.000–15.000€', '15k-20k': '15.000–20.000€',
  '20k-25k': '20.000–25.000€', '25k-30k': '25.000–30.000€', '30k-40k': '30.000–40.000€',
  '40k-50k': '40.000–50.000€', '50k-60k': '50.000–60.000€', '60k-80k': '60.000–80.000€',
  '80k-100k': '80.000–100.000€', '>100k': 'Más de 100.000€',
}

const SOURCE_LABELS: Record<string, string> = {
  web: 'Web', whatsapp: 'WhatsApp', instagram: 'Instagram', email: 'Email',
  referral: 'Referido', manual: 'Manual', wedding_planner: 'Wedding Planner',
  wedding_venues_spain: 'WVS', bodas_net: 'Bodas.net',
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, activeVenue, authLoading } = useAuth()
  useRequireSubscription()
  const router = useRouter()
  const supabase = createClient()

  const [client, setClient] = useState<Client | null>(null)
  const [clientLeads, setClientLeads] = useState<any[]>([])
  const [proposals, setProposals] = useState<any[]>([])
  const [tab, setTab] = useState<Tab>('peticiones')
  const [loading, setLoading] = useState(true)

  // Edit modal
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', whatsapp: '', client_type: 'pareja' as ClientType, language: '', country: '' })
  const [editSaving, setEditSaving] = useState(false)

  // Link lead modal
  const [showLinkLead, setShowLinkLead] = useState(false)
  const [unlinkedLeads, setUnlinkedLeads] = useState<any[]>([])
  const [linkSearch, setLinkSearch] = useState('')

  // Notes auto-save
  const [notes, setNotes] = useState('')
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load data ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !activeVenue) return
    loadClient()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeVenue?.id, id])

  const loadClient = async () => {
    if (!activeVenue) return
    setLoading(true)

    const [clientRes, leadsRes, proposalsRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).eq('venue_id', activeVenue.id).single(),
      supabase.from('leads').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('proposals').select('id, slug, couple_name, status, created_at, lead_id').eq('venue_id', activeVenue.id),
    ])

    if (!clientRes.data) { router.push('/clientes'); return }
    setClient(clientRes.data)
    setClientLeads(leadsRes.data ?? [])
    setNotes(clientRes.data.notes ?? '')

    // Filter proposals that belong to this client's leads
    const leadIds = new Set((leadsRes.data ?? []).map((l: any) => l.id))
    setProposals((proposalsRes.data ?? []).filter((p: any) => p.lead_id && leadIds.has(p.lead_id)))

    setEditForm({
      name: clientRes.data.name ?? '',
      email: clientRes.data.email ?? '',
      phone: clientRes.data.phone ?? '',
      whatsapp: clientRes.data.whatsapp ?? '',
      client_type: clientRes.data.client_type ?? 'pareja',
      language: clientRes.data.language ?? '',
      country: clientRes.data.country ?? '',
    })
    setLoading(false)
  }

  // ── Save notes with debounce ──────────────────────────────────────────────────
  const updateNotes = (val: string) => {
    setNotes(val)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      await supabase.from('clients').update({ notes: val }).eq('id', id)
    }, 1000)
  }

  // ── Save edit ─────────────────────────────────────────────────────────────────
  const saveEdit = async () => {
    setEditSaving(true)
    await supabase.from('clients').update({
      name: editForm.name.trim(),
      email: editForm.email.trim() || null,
      phone: editForm.phone.trim() || null,
      whatsapp: editForm.whatsapp.trim() || null,
      client_type: editForm.client_type,
      language: editForm.language.trim() || null,
      country: editForm.country.trim() || null,
    }).eq('id', id)
    setEditSaving(false)
    setShowEdit(false)
    loadClient()
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  const deleteClient = async () => {
    if (!confirm('Se eliminará este cliente. Sus peticiones se desvincularán pero no se borrarán.')) return
    await supabase.from('leads').update({ client_id: null }).eq('client_id', id)
    await supabase.from('clients').delete().eq('id', id)
    router.push('/clientes')
  }

  // ── Link existing lead ────────────────────────────────────────────────────────
  const openLinkLead = async () => {
    if (!activeVenue) return
    const { data } = await supabase.from('leads').select('id, name, email, status, created_at')
      .eq('venue_id', activeVenue.id).is('client_id', null).order('created_at', { ascending: false })
    setUnlinkedLeads(data ?? [])
    setLinkSearch('')
    setShowLinkLead(true)
  }

  const linkLead = async (leadId: string) => {
    await supabase.from('leads').update({ client_id: id }).eq('id', leadId)
    setShowLinkLead(false)
    loadClient()
  }

  // ── Format helpers ────────────────────────────────────────────────────────────
  const fmtDate = (d: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // ── Auth guard ────────────────────────────────────────────────────────────────
  if (authLoading || loading) return null
  if (!user) { router.push('/login'); return null }
  if (!client) return null

  const tc = CLIENT_TYPE_COLORS[client.client_type] ?? CLIENT_TYPE_COLORS.otro
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'peticiones', label: 'Peticiones', count: clientLeads.length },
    { key: 'propuestas', label: 'Propuestas', count: proposals.length },
    { key: 'notas', label: 'Notas' },
    { key: 'info', label: 'Info' },
  ]

  // For Info tab: use data from most recent lead
  const latestLead = clientLeads[0] ?? null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cream)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px 40px', maxWidth: 900, margin: '0 auto' }}>

        {/* ── Back button ───────────────────────────────────────────── */}
        <button onClick={() => router.push('/clientes')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--warm-gray)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20, padding: 0 }}>
          <ArrowLeft size={14} /> Volver a clientes
        </button>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)', padding: '24px 28px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: tc.bg, border: `2px solid ${tc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: tc.color, flexShrink: 0 }}>
              {(client.name || '?')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--charcoal)', margin: 0 }}>{client.name}</h1>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 999, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                  {CLIENT_TYPE_LABELS[client.client_type]}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {client.email && (
                  <a href={`mailto:${client.email}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#666', textDecoration: 'none' }}>
                    <Mail size={13} /> {client.email}
                  </a>
                )}
                {client.phone && (
                  <a href={`tel:${client.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#666', textDecoration: 'none' }}>
                    <Phone size={13} /> {client.phone}
                  </a>
                )}
                {client.whatsapp && (
                  <a href={`https://wa.me/${client.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#666', textDecoration: 'none' }}>
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setShowEdit(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
                <Edit2 size={12} /> Editar
              </button>
              <button onClick={deleteClient}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 12, fontWeight: 500, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer' }}>
                <Trash2 size={12} /> Eliminar
              </button>
            </div>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                padding: '10px 20px', fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? 'var(--charcoal)' : 'var(--warm-gray)',
                background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid var(--gold)' : '2px solid transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}>
              {t.label}
              {t.count !== undefined && (
                <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: tab === t.key ? '#fef3c7' : '#f5f5f4', color: tab === t.key ? '#92400e' : '#999' }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Peticiones ─────────────────────────────────────────── */}
        {tab === 'peticiones' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={() => {
                const params = new URLSearchParams({ new: '1' })
                if (client.name) params.set('prefill_name', client.name)
                if (client.email) params.set('prefill_email', client.email)
                if (client.phone) params.set('prefill_phone', client.phone)
                params.set('prefill_client_id', id)
                router.push(`/leads?${params.toString()}`)
              }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 12, fontWeight: 500, color: 'var(--gold)', background: '#fff', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
                <Plus size={12} /> Nueva petición
              </button>
              <button onClick={openLinkLead}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', background: '#fff', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
                <Link2 size={12} /> Vincular existente
              </button>
            </div>

            {clientLeads.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--warm-gray)', background: '#fff', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
                Este cliente no tiene peticiones vinculadas.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {clientLeads.map((l: any) => (
                  <div key={l.id} onClick={() => router.push(`/leads?open=${l.id}`)}
                    style={{ background: '#fff', borderRadius: 8, border: '1px solid var(--border)', padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'box-shadow .15s' }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[l.status] ?? '#999', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--charcoal)' }}>{l.name}</div>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                        {STATUS_LABEL[l.status] ?? l.status}
                        {l.wedding_date && ` · ${fmtDate(l.wedding_date)}`}
                        {l.guests && ` · ${l.guests} invitados`}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: '#bbb' }}>{fmtDate(l.created_at)}</span>
                    <ChevronRight size={14} style={{ color: 'var(--warm-gray)' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Propuestas ─────────────────────────────────────────── */}
        {tab === 'propuestas' && (
          <div>
            {proposals.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--warm-gray)', background: '#fff', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
                No hay propuestas vinculadas a este cliente.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {proposals.map((p: any) => (
                  <div key={p.id} onClick={() => router.push(`/proposals?edit=${p.slug}`)}
                    style={{ background: '#fff', borderRadius: 8, border: '1px solid var(--border)', padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                    <FileText size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--charcoal)' }}>{p.couple_name || 'Sin nombre'}</div>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                        {p.status === 'draft' ? 'Borrador' : p.status === 'sent' ? 'Enviada' : p.status === 'viewed' ? 'Vista' : p.status} · {fmtDate(p.created_at)}
                      </div>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--warm-gray)' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Notas ─────────────────────────────────────────────── */}
        {tab === 'notas' && (
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid var(--border)', padding: '20px 24px' }}>
            <textarea
              placeholder="Escribe notas sobre este cliente..."
              value={notes}
              onChange={e => updateNotes(e.target.value)}
              style={{ width: '100%', minHeight: 200, fontSize: 13, lineHeight: 1.7, border: 'none', outline: 'none', resize: 'vertical', color: 'var(--charcoal)', fontFamily: 'inherit' }}
            />
            <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 8 }}>Guardado automático</div>
          </div>
        )}

        {/* ── Tab: Info ──────────────────────────────────────────────── */}
        {tab === 'info' && (
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid var(--border)', padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Contact details */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--warm-gray)', marginBottom: 12 }}>Contacto</div>
                <InfoRow label="Nombre" value={client.name} />
                <InfoRow label="Email" value={client.email} />
                <InfoRow label="Teléfono" value={client.phone} />
                <InfoRow label="WhatsApp" value={client.whatsapp} />
                <InfoRow label="Idioma" value={client.language} />
                <InfoRow label="País" value={client.country} />
              </div>

              {/* From latest lead */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--warm-gray)', marginBottom: 12 }}>Última petición</div>
                {latestLead ? (
                  <>
                    <InfoRow label="Fuente" value={SOURCE_LABELS[latestLead.source] ?? latestLead.source} />
                    <InfoRow label="Presupuesto" value={BUDGET_LABELS[latestLead.budget] ?? latestLead.budget} />
                    <InfoRow label="Invitados" value={latestLead.guests ? String(latestLead.guests) : null} />
                    <InfoRow label="Ceremonia" value={latestLead.ceremony_type} />
                    <InfoRow label="Fecha boda" value={fmtDate(latestLead.wedding_date)} />
                    <InfoRow label="Flexibilidad" value={latestLead.date_flexibility} />
                    {latestLead.initial_message && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 4 }}>Mensaje inicial</div>
                        <div style={{ fontSize: 12, color: 'var(--charcoal)', background: 'var(--cream)', padding: '10px 12px', borderRadius: 6, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {latestLead.initial_message}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Sin peticiones</div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 11, color: '#bbb' }}>
              Cliente creado el {fmtDate(client.created_at)} · ID: {client.id.slice(0, 8)}
            </div>
          </div>
        )}

        {/* ── Edit Client Modal ──────────────────────────────────────── */}
        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogContent style={{ maxWidth: 440 }}>
            <DialogTitle>Editar cliente</DialogTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              <input className="form-input" placeholder="Nombre" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              <input className="form-input" placeholder="Email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder="Teléfono" style={{ flex: 1 }} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                <input className="form-input" placeholder="WhatsApp" style={{ flex: 1 }} value={editForm.whatsapp} onChange={e => setEditForm(f => ({ ...f, whatsapp: e.target.value }))} />
              </div>
              <Select value={editForm.client_type} onValueChange={v => setEditForm(f => ({ ...f, client_type: v as ClientType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CLIENT_TYPE_LABELS) as ClientType[]).map(t => (
                    <SelectItem key={t} value={t}>{CLIENT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder="Idioma" style={{ flex: 1 }} value={editForm.language} onChange={e => setEditForm(f => ({ ...f, language: e.target.value }))} />
                <input className="form-input" placeholder="País" style={{ flex: 1 }} value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))} />
              </div>
              <button onClick={saveEdit} disabled={editSaving || !editForm.name.trim()}
                style={{ padding: '10px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--gold)', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: editSaving || !editForm.name.trim() ? 0.5 : 1 }}>
                {editSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Link Lead Modal ────────────────────────────────────────── */}
        <Dialog open={showLinkLead} onOpenChange={setShowLinkLead}>
          <DialogContent style={{ maxWidth: 480 }}>
            <DialogTitle>Vincular petición existente</DialogTitle>
            <input className="form-input" placeholder="Buscar por nombre o email..." value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
              style={{ marginTop: 8, marginBottom: 12 }} />
            <div style={{ maxHeight: 300, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {unlinkedLeads
                .filter(l => {
                  if (!linkSearch.trim()) return true
                  const q = linkSearch.toLowerCase()
                  return l.name?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q)
                })
                .map((l: any) => (
                  <div key={l.id} onClick={() => linkLead(l.id)}
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[l.status] ?? '#999', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--charcoal)' }}>{l.name}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>{l.email} · {fmtDate(l.created_at)}</div>
                    </div>
                  </div>
                ))}
              {unlinkedLeads.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--warm-gray)', fontSize: 12 }}>
                  No hay peticiones sin cliente asignado.
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  )
}

// ── Helper component ────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', minWidth: 80 }}>{label}</span>
      <span style={{ fontSize: 13, color: value ? 'var(--charcoal)' : '#ccc' }}>{value || '—'}</span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/clientes/[id]/page.tsx
git commit -m "feat: add /clientes/[id] detail page with tabs (peticiones, propuestas, notas, info)"
```

---

### Task 6: Leads Page Integration — Client Link in Drawer

**Files:**
- Modify: `app/leads/page.tsx`

This task adds a client link inside the lead detail drawer/sheet so users can navigate from a lead to its client page.

- [ ] **Step 1: Add client_id import and state**

At the top of `app/leads/page.tsx`, add the import for client helpers (after existing imports, around line 24):

```typescript
import { CLIENT_TYPE_LABELS, CLIENT_TYPE_COLORS } from '@/lib/clients'
```

- [ ] **Step 2: Add client link in lead detail drawer**

Find the lead detail drawer/sheet section (search for where `detailLead` or lead details are rendered in the Sheet). Add a client link row at the top of the detail content. Look for the contact info section and add before it:

```typescript
{/* Client link */}
{detailLead.client_id && (
  <div style={{ padding: '8px 14px', background: '#f8f7f5', borderRadius: 6, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', border: '1px solid var(--border)' }}
    onClick={() => router.push(`/clientes/${detailLead.client_id}`)}>
    <Users size={13} style={{ color: 'var(--gold)' }} />
    <span style={{ fontSize: 12, color: 'var(--charcoal)', flex: 1 }}>Ver ficha de cliente</span>
    <ChevronRight size={12} style={{ color: 'var(--warm-gray)' }} />
  </div>
)}
```

The exact location depends on the drawer structure. Place it right after the header section (name + status) and before the lead details grid.

- [ ] **Step 3: Auto-link new leads to clients**

In the lead creation/save handler (find where new leads are inserted via Supabase), add auto-match logic after successful insert. After the `.insert()` call succeeds, add:

```typescript
// Auto-link to client
if (insertedLead && activeVenue) {
  const { findOrCreateClient } = await import('@/lib/clients')
  const clientId = await findOrCreateClient(activeVenue.id, {
    name: form.name, email: form.email, phone: form.phone,
    whatsapp: form.whatsapp, language: form.language, country: form.country,
  })
  if (clientId) {
    await supabase.from('leads').update({ client_id: clientId }).eq('id', insertedLead.id)
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add app/leads/page.tsx
git commit -m "feat: add client link in lead drawer and auto-link new leads to clients"
```

---

### Task 7: Verify & Final Commit

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Test manually on localhost**

1. Navigate to `/clientes` — should show client list from migrated data
2. Click a client row — drawer opens with name, type, leads list
3. Click "Ver ficha completa" — navigates to `/clientes/[id]`
4. On detail page: test all 4 tabs (Peticiones, Propuestas, Notas, Info)
5. Edit a client → save → verify update
6. Create new client via "Nuevo cliente" → verify appears in list
7. Link an existing lead from the detail page
8. In `/leads`, open a lead drawer → verify "Ver ficha de cliente" link works
9. Create a new lead → verify a client is auto-created/linked

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```

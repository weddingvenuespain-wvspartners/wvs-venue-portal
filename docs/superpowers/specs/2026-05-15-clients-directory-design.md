# Clients Directory — Design Spec

## Overview

New "Clientes" section in the venue portal: a contact directory that groups leads under a single client identity. Each client has a full detail page with petitions, proposals, notes, and contact info.

## Data Model

### Table: `clients`

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | gen_random_uuid() |
| venue_id | uuid FK | venues.id, RLS |
| name | text | Full name |
| email | text | nullable |
| phone | text | nullable |
| whatsapp | text | nullable |
| client_type | text | pareja, wedding_planner, organizador, empresa, cliente, otro |
| tags | jsonb | [] string array |
| notes | text | Free-form notes |
| language | text | nullable |
| country | text | nullable |
| created_at | timestamptz | default now() |

RLS: `venue_id = auth.venue_id()` — same pattern as leads.

### Change to `leads`

- Add column `client_id uuid FK → clients.id` (nullable)
- Index on `client_id`

### Auto-match Logic (runtime)

When a lead is created:
1. Search `clients` WHERE `venue_id = X` AND (`email = lead.email` OR `phone = lead.phone`) LIMIT 1
2. If match → set `lead.client_id = client.id`
3. If no match → INSERT into `clients` with lead data, set `lead.client_id = new_client.id`

### Migration of Existing Data

1. Group all leads by `COALESCE(email, phone)` + `venue_id`
2. Per group: create `clients` record from most recent lead (name, email, phone, whatsapp, language, country)
3. Default `client_type = 'pareja'`
4. Update `client_id` on all leads in group
5. Leads with no email AND no phone → each creates its own client

## UI: Client List Page (`/clientes`)

### Sidebar
- New item "Clientes" with Users icon, between "Leads" and "Mis dosieres"
- No badge (not urgent like new leads)

### List View
- Table columns: Nombre | Tipo | Email | Teléfono | Peticiones activas | Último contacto
- Type shown as colored badge (pareja=gold, WP=purple, organizador=blue, empresa=slate, otro=gray)
- "Peticiones activas" = count of leads with status not `won`/`lost`
- "Último contacto" = MAX(leads.created_at) or clients.created_at if no leads
- Sorted by último contacto desc

### Search & Filters
- Search bar: name, email, phone
- Filter by client_type (multi-select)
- Filter by tags

### Actions
- "Nuevo cliente" button → modal with: name, email, phone, whatsapp, type, notes
- Row click → opens drawer (quick preview)
- "Ver ficha" in drawer → navigates to `/clientes/[id]`

### Drawer (Quick Preview)
- Header: name, type badge, email, phone
- List of linked leads with status badge + date
- "Ver ficha completa" button

## UI: Client Detail Page (`/clientes/[id]`)

### Header
- Large name + type badge
- Email, phone, whatsapp (clickable: mailto:, tel:, wa.me/)
- Editable tags inline
- "Editar" button → edit modal
- "Eliminar" button with confirmation

### Tab: Peticiones (default)
- List of linked leads as cards: status badge, event date, guests, ceremony type, created_at
- Click → navigates to /leads?lead=LEAD_ID
- "Vincular petición existente" → search leads without client_id → link
- "Nueva petición" → lead form pre-filled with client data

### Tab: Propuestas
- Proposals linked through client's leads
- Status (draft/sent/viewed), date, couple name
- Click → opens ProposalEditor

### Tab: Notas
- Free textarea, auto-save with debounce

### Tab: Info
- Full contact details
- Language, country
- Original source (from first lead)
- Budget (from most recent lead)
- Date flexibility
- Initial message

## Integration with Leads Page

- Lead drawer/modal: show linked client name as clickable link → `/clientes/[id]`
- Lead form: "Cliente" field with client search + "Crear nuevo" option
- Creating lead from /leads: same auto-match logic

## Manual Merge
- In client detail: "Fusionar con otro cliente" button
- Search by name/email → select
- Action: move all leads from client B to client A, delete client B
- Same venue_id only

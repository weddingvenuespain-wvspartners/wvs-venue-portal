# WVS Partners Portal

Portal de gestión para venues de Wedding Venues Spain.

## Stack
- Next.js 14 (App Router)
- Supabase (Auth + Database)
- WordPress REST API (weddingvenuesspain.com)

## Setup paso a paso

### 1. Supabase — crear tablas

Ve a tu proyecto Supabase → SQL Editor → New Query.
Copia y pega el contenido de `SUPABASE_SCHEMA.sql` y ejecuta.

### 2. Instalar dependencias

```bash
npm install
```

### 3. Variables de entorno

El archivo `.env.local` ya está configurado con tus claves.

### 4. Arrancar en local

```bash
npm run dev
```

Abre http://localhost:3000

### 5. Deploy en Vercel

1. Sube este proyecto a GitHub (nuevo repositorio)
2. Ve a vercel.com → New Project → importa el repo
3. En "Environment Variables" añade las mismas variables de `.env.local`
4. Deploy

### 6. Configurar subdominio

En tu DNS añade un CNAME:
- Name: `portal`
- Value: `cname.vercel-dns.com`

Luego en Vercel → tu proyecto → Settings → Domains → añade `portal.weddingvenuesspain.com`

### 7. Crear venue profiles

Para cada venue que quieras dar acceso:
1. El venue se registra en el portal con su email
2. Tú vas a Supabase → Table Editor → venue_profiles
3. Insertas una fila con su `user_id` y el `wp_venue_id` (el ID del post en WordPress)

Los IDs de tus venues en WordPress son:
- Ibiza Restored Farmhouse: 3940
- Ibiza Rooftop Hotel: 3156
- Secluded Castle Resort in Mallorca: 3094
- Rustic Look Villa in Mallorca: 3081
- Boutique Hotel in Deya: 3017
- Finca Son Term: 2982
- Tranquil Ibiza Oasis: 3019
- Villa in Heart of Nature: 3018
- Son Mary: 2474
- Finca Miramar: 2452

### 8. Webhook desde JetFormBuilder (leads automáticos)

En WordPress → JetFormBuilder → tu formulario de contacto → Post Submit Actions → Webhook:
- URL: `https://portal.weddingvenuesspain.com/api/webhook/lead`
- Method: POST
- Body: mapea los campos (name, email, phone, wedding_date, guests, venue_id)

Nota: el endpoint de webhook se puede añadir en `/app/api/webhook/lead/route.ts`

## Estructura del proyecto

```
app/
  login/       → Página de login (email + Google)
  dashboard/   → Panel principal con stats y resumen
  ficha/       → Edición de la ficha del venue en WordPress
  leads/       → Lista de leads recibidos
  pipeline/    → Kanban con estados de cada contacto
  crm/         → Todos los contactos con filtros
components/
  Sidebar.tsx  → Navegación lateral
lib/
  supabase.ts  → Cliente de Supabase
  wordpress.ts → Helpers para la API de WordPress
```

# Portal WVS

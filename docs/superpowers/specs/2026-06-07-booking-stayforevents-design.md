# Booking Platform — booking.stayforevents.com

## Overview

Plataforma de reservas grupales de hotel para bodas y eventos. Los organizadores (equipo stayforevents) crean eventos con hoteles, habitaciones, precios y condiciones. Los huéspedes acceden desde la web del evento (WordPress) y reservan su alojamiento, pagando por Stripe.

**Dominio:** booking.stayforevents.com  
**Proyecto nuevo desde cero.**  
**No indexable en Google.**

---

## Stack técnico

| Pieza | Herramienta |
|---|---|
| Framework | Next.js 15 App Router |
| DB + Auth + Storage | Supabase |
| Pagos | Stripe (Payment Intents + Setup Intents) |
| Emails | Resend + React Email |
| i18n | next-intl (ES, EN, FR, PT, DE, RO, NL, IT, RU) |
| UI | Tailwind CSS + shadcn/ui |
| PDF export | @react-pdf/renderer |
| Excel export | exceljs |
| Validación | zod |
| Deploy | Vercel |

---

## Arquitectura de rutas

```
booking.stayforevents.com (Vercel)
├── (admin)/              → Panel admin (protegido Supabase Auth)
│   ├── dashboard/        → Resumen eventos activos, reservas recientes, alertas
│   ├── events/           → CRUD eventos
│   ├── hotels/           → CRUD hoteles por evento
│   ├── rooms/            → Tipos hab + inventario + pricing por fecha
│   ├── bookings/         → Lista reservas, estado pagos, acciones
│   ├── rooming-list/     → Vista tabla + export PDF/Excel
│   ├── payments/         → Gestión cobros, cuotas, reembolsos
│   ├── waitlist/         → Gestión lista de espera
│   ├── communications/   → Emails masivos a huéspedes
│   └── settings/         → Config cuenta, Stripe, templates email
│
├── (booking)/            → Público (sin auth, noindex)
│   └── [eventSlug]/[hotelSlug]/
│       ├── page.tsx      → Paso 1: Info hotel + selección hab + fechas
│       ├── details/      → Paso 2: Datos personales
│       ├── payment/      → Paso 3: Resumen + pago Stripe
│       ├── confirmation/ → Confirmación reserva
│       └── waitlist/     → Formulario lista de espera
│
├── api/
│   ├── webhooks/stripe/  → Confirma pagos, actualiza estados
│   └── exports/          → Genera PDF/Excel bajo demanda
│
└── middleware.ts         → noindex headers + auth check admin + rate limiting
```

---

## Modelo de datos

### events
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | |
| name | text | "Boda Ana & Carlos" |
| slug | text, unique | "boda-ana-carlos" |
| event_date | date | Fecha del evento |
| couple_names | text | Nombres de la pareja |
| description | text | Descripción del evento |
| status | enum | active, archived |
| created_at | timestamptz | |

### hotels
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | |
| event_id | FK → events | |
| name | text | "Hotel Miramar" |
| slug | text | "hotel-miramar" |
| description | text | |
| address | text | |
| check_in_from | date | Fecha más temprana disponible |
| check_out_until | date | Fecha más tardía disponible |
| photos | text[] | URLs en Supabase Storage |
| group_reference | text | Código grupo para el hotel |
| created_at | timestamptz | |

### room_types
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | |
| hotel_id | FK → hotels | |
| name | text | "Doble Superior" |
| description | text | |
| capacity | int | Personas máximo |
| inventory | int | Total habitaciones disponibles |
| rack_rate | decimal | Precio "normal" del hotel (mostrar tachado) |
| meal_plan | text | "solo alojamiento", "media pensión", etc. |
| photos | text[] | |

### room_pricing
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | |
| room_type_id | FK → room_types | |
| date | date | |
| price_per_night | decimal | Precio por noche esa fecha |

### payment_conditions
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | |
| hotel_id | FK → hotels | |
| installment_number | int | 1, 2, 3... |
| percentage | decimal | 30, 70... |
| due_date | date | Fecha límite pago |
| description | text | "Depósito inicial", "Pago final" |

### cancellation_policies
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | |
| hotel_id | FK → hotels | |
| name | text | "Flexible", "Moderada", "Estricta" |
| rules | jsonb | Array: [{before_days, refund_percent}] |
| description | text | Texto visible al huésped |

### hotel_conditions
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | |
| hotel_id | FK → hotels | |
| min_bookings | int | Mínimo reservas para activar cobros |
| guarantee_deadline | date | Fecha límite cancelación gratis |
| charge_date | date | Fecha en que se cobra si se activa |
| is_activated | boolean | Se alcanzó el mínimo |
| payment_scenario | enum | full_upfront, partial, guarantee, partial_guarantee |

### bookings
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | |
| hotel_id | FK → hotels | |
| guest_name | text | Nombre completo |
| guest_email | text | |
| guest_phone | text | |
| guest_dni | text | DNI/Pasaporte |
| guest_nationality | text | |
| special_requests | text | |
| total_amount | decimal | |
| amount_paid | decimal | |
| payment_status | enum | pending, partial, paid, refunded, guaranteed |
| status | enum | confirmed, guaranteed, cancelled, charged |
| stripe_customer_id | text | |
| stripe_payment_method_id | text | Tarjeta guardada |
| confirmation_email_sent | boolean | |
| confirmation_email_sent_at | timestamptz | |
| admin_notes | text | Notas internas |
| cancelled_at | timestamptz | |
| cancellation_reason | text | |
| refund_amount | decimal | |
| refund_status | enum | none, partial, full |
| booking_date | timestamptz | |
| created_at | timestamptz | |

### booking_rooms
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | |
| booking_id | FK → bookings | |
| room_type_id | FK → room_types | |
| check_in | date | |
| check_out | date | |
| adults | int | |
| children | int | |
| price_total | decimal | Precio calculado para esta hab |

### payments
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | |
| booking_id | FK → bookings | |
| amount | decimal | |
| stripe_payment_intent_id | text | |
| status | enum | succeeded, pending, failed |
| installment_number | int | |
| paid_at | timestamptz | |

### booking_modifications
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | |
| booking_id | FK → bookings | |
| field_changed | text | "dates", "room_type" |
| old_value | jsonb | |
| new_value | jsonb | |
| price_difference | decimal | + cobrar más, - reembolsar |
| modified_at | timestamptz | |

### waitlist
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | |
| hotel_id | FK → hotels | |
| room_type_id | FK → room_types, nullable | |
| guest_name | text | |
| guest_email | text | |
| guest_phone | text | |
| requested_check_in | date | |
| requested_check_out | date | |
| status | enum | waiting, notified, converted, expired |
| created_at | timestamptz | |

### exports
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | |
| event_id | FK → events | |
| hotel_id | FK → hotels, nullable | |
| type | enum | pdf, excel |
| file_url | text | Supabase Storage URL |
| generated_at | timestamptz | |

### audit_log
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | |
| admin_user_id | FK | Quién hizo la acción |
| action | text | "booking.cancelled", "payment.charged", etc. |
| entity_type | text | "booking", "event", "hotel" |
| entity_id | uuid | |
| details | jsonb | Detalles del cambio |
| created_at | timestamptz | |

---

## Flujo de pagos Stripe

### Escenario A — 100% upfront
1. Huésped confirma reserva
2. Server Action crea Payment Intent (amount = total, currency = EUR)
3. Stripe Elements en frontend cobra
4. Webhook `payment_intent.succeeded` → booking.payment_status = "paid"
5. Email confirmación

### Escenario B — Pago parcial + cobro futuro
1. Huésped confirma reserva
2. Server Action crea Setup Intent + Payment Intent parcial
3. Cobra primer % + guarda tarjeta
4. Webhook → payments[1] registrado, booking.payment_status = "partial"
5. En fecha de siguiente cuota: Payment Intent off-session con tarjeta guardada
6. Webhook → payments[2] registrado
7. Si todos completados → booking.payment_status = "paid"

### Escenario D — Solo garantía (guardar tarjeta)
1. Huésped confirma reserva
2. Server Action crea Setup Intent (solo guarda tarjeta, NO cobra)
3. booking.payment_status = "guaranteed"
4. Cuando grupo alcanza mínimo Y deadline pasa:
   - Admin activa grupo → cobra todas las tarjetas guardadas
5. Si grupo no alcanza mínimo → cancela todas, no cobra

### Escenario E — Parcial + garantía
1. Cobra depósito inicial
2. Guarda tarjeta para resto
3. Resto solo se cobra si grupo se activa

### Cobro fallido
- Webhook `payment_intent.payment_failed`
- Email al huésped: "actualiza tu método de pago"
- Link a página para reintentar
- Admin puede reintentar manualmente

### Cancelación (cualquier escenario)
1. Calcular días hasta check-in
2. Aplicar regla de cancellation_policies
3. Stripe Refund (total o parcial)
4. booking.status = "cancelled"
5. Email confirmación cancelación
6. Si hay waitlist → notificar siguiente

### Modificación
1. Admin/huésped solicita cambio
2. Recalcula precio
3. Si diferencia > 0 → cobra con tarjeta guardada
4. Si diferencia < 0 → refund parcial
5. Registra en booking_modifications

---

## Cobros automáticos vs manuales

**Automáticos (Vercel Cron / Supabase Edge Function):**
- Cron diario revisa payment_conditions donde due_date = hoy
- Cobra tarjetas guardadas de bookings pendientes
- Registra resultado (éxito/fallo)
- Envía email según resultado

**Manuales (admin):**
- Botón "Cobrar siguiente cuota" en detalle reserva
- Botón "Cobrar importe custom" (cantidad libre)
- Botón "Activar grupo y cobrar todos" (escenario D masivo)
- Botón "Cancelar grupo" (cancela todo sin cobrar)

---

## Panel admin — funcionalidades completas

### Dashboard
- Eventos activos con % ocupación
- Reservas recientes
- Pagos pendientes próximos (timeline)
- Alertas: deadlines, pagos fallidos, waitlist, mínimo grupo alcanzado

### Gestión eventos y hoteles
- CRUD completo eventos
- CRUD hoteles dentro de evento
- Room types + inventario + pricing por fecha
- Condiciones de pago (escenario A/B/D/E configurable)
- Política cancelación configurable
- Condiciones de grupo (mínimo, deadlines)
- Duplicar evento/hotel como template

### Gestión reservas
- Tabla filtrable: evento, hotel, estado, fecha, pago
- Detalle reserva: datos huésped, habitaciones, pagos, timeline, historial modificaciones
- Acciones: cobrar, modificar, cancelar, añadir nota, reenviar email
- Cobros masivos (activar grupo)

### Rooming list
- Vista tabla: nombre, hab, check-in/out, adultos/niños, DNI, nacionalidad, régimen, estado pago, requests
- Filtros: fecha, tipo hab, estado pago
- Export PDF (formato limpio para hotel)
- Export Excel (editable)
- Guardados en Supabase Storage con historial

### Comunicaciones
- Emails masivos por evento/hotel/filtro
- Editor simple (texto + formato básico)
- Templates personalizables
- Tracking envío

### Estadísticas
- Ingresos por evento/hotel
- % ocupación por tipo habitación
- Revenue por noche
- Reservas en el tiempo (gráfica)

### Audit log
- Historial de acciones admin
- Quién hizo qué, cuándo, sobre qué entidad

---

## Emails automáticos

| Trigger | Destinatario | Contenido |
|---|---|---|
| Reserva confirmada | Huésped | Confirmación + resumen + política cancelación |
| Pago recibido | Huésped | Recibo de pago |
| Pago fallido | Huésped | "Actualiza método de pago" + link retry |
| Recordatorio pago pendiente | Huésped | X días antes de deadline |
| Modificación reserva | Huésped | Resumen cambios + nuevo precio |
| Cancelación | Huésped | Confirmación + info reembolso |
| Grupo activado | Huésped | "Tu reserva está confirmada definitivamente" |
| Grupo cancelado | Huésped | "Reserva cancelada, no se ha cobrado" |
| Waitlist disponible | Huésped waitlist | "Hay disponibilidad, tienes Xh para confirmar" |
| Nueva reserva | Admin | Notificación nueva reserva |
| Pago fallido | Admin | Alerta pago fallido |
| Deadline cercano | Admin | Aviso X días antes |
| Mínimo grupo alcanzado | Admin | Alerta para activar |

**Stack:** Resend (API) + React Email (templates con branding stayforevents)

---

## Notificaciones admin

- Email para eventos críticos (pago fallido, deadline)
- In-app (badge/bell en dashboard) para todo lo demás
- Configurable: qué notificaciones por email vs solo in-app

---

## Página pública de booking

### Paso 1 — Selección
- Header: nombre evento/pareja + logo stayforevents
- Fotos hotel (carousel/gallery)
- Info básica hotel (descripción, dirección)
- Lista room types:
  - Nombre, descripción, capacidad, régimen
  - ~~€200/noche~~ **€150/noche** (precio exclusivo grupo)
  - Selector cantidad
- Calendario: fechas disponibles dentro del rango del hotel
- Selector check-in / check-out
- Botón "Continuar"

### Paso 2 — Datos personales
- Nombre completo
- Email
- Teléfono
- DNI/Pasaporte
- Nacionalidad
- Nº adultos y niños por habitación
- Requests especiales
- Checkbox condiciones + política cancelación
- Botón "Continuar al pago"

### Paso 3 — Pago
- Resumen reserva (habitaciones, fechas, precio total)
- Desglose: qué se cobra ahora vs después (si aplica)
- Stripe Elements (card input)
- Botón "Pagar €X" o "Confirmar reserva" (si solo guarda tarjeta)

### Confirmación
- Resumen completo
- Número de referencia
- Info política cancelación
- Link WhatsApp/email soporte
- "Recibirás confirmación por email"

### Waitlist (si inventario agotado)
- Mensaje: "No hay disponibilidad ahora"
- Formulario: nombre, email, teléfono, fechas deseadas
- "Te avisaremos si hay cancelaciones"

---

## i18n

- 9 idiomas: ES, EN, FR, PT, DE, RO, NL, IT, RU
- Solo páginas públicas (booking) multiidioma
- Admin panel: solo español
- Selector de idioma en header de booking
- Traducciones en archivos JSON por idioma
- Emails al huésped en su idioma seleccionado

---

## Seguridad

- `middleware.ts`: rutas (booking) → `X-Robots-Tag: noindex, nofollow`
- `middleware.ts`: rutas (admin) → require Supabase session, redirect login
- RLS en Supabase: tablas solo accesibles con service_role (server-side)
- Stripe webhooks verificados con `stripe.webhooks.constructEvent`
- Datos tarjeta NUNCA tocan servidor (Stripe Elements client-side)
- Rate limiting en endpoints públicos (booking, waitlist)
- CSRF protection vía Server Actions (Next.js built-in)
- Validación con zod en todas las Server Actions
- Supabase Storage: buckets privados para exports
- Audit log de todas las acciones admin

---

## Disponibilidad

Cálculo por room_type y rango de fechas:

```
disponibilidad = room_type.inventory - COUNT(
  booking_rooms WHERE room_type_id = X
  AND check_in < requested_check_out
  AND check_out > requested_check_in
  AND booking.status NOT IN ('cancelled')
)
```

---

## Deploy

- Vercel: dominio booking.stayforevents.com
- Supabase: proyecto dedicado
- Stripe: cuenta stayforevents (modo test → live)
- Resend: dominio verificado stayforevents.com
- Variables de entorno en Vercel

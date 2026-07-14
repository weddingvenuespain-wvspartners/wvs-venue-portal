import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { buildPublicVenueColumns, slugify, revalidateWvsWeb } from '@/lib/wvs-publish'

// Aprobación admin del canal weddingvenuesspain.com.
// Antes publicaba a WordPress; ahora escribe las columnas planas de la fila
// 'published' de venue_onboarding, que la vista public_venues expone a la web
// nueva (wvs-web). La fila del editor (ficha_data) y la fila publicada son
// registros distintos unidos por wp_post_id.

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY (o NEXT_PUBLIC_SUPABASE_URL) en las variables de entorno de Vercel. ' +
      'Ve a Vercel → Settings → Environment Variables y añade SUPABASE_SERVICE_ROLE_KEY con la Service Role Key de tu proyecto Supabase.'
    )
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: caller } = await supabase
      .from('venue_profiles').select('role').eq('user_id', user.id).single()
    if (caller?.role !== 'admin') return NextResponse.json({ error: 'Solo admin' }, { status: 403 })

    const { target_user_id, venue_id, is_initial } = await req.json()

    // Service role para todas las lecturas/escrituras (salta RLS: el admin
    // necesita acceder a datos de otros usuarios)
    const svc = getServiceClient()

    // Fila del editor del usuario (multi-venue: una fila por venue)
    let onbQuery = svc.from('venue_onboarding').select('*').eq('user_id', target_user_id)
    if (venue_id) onbQuery = onbQuery.eq('venue_id', venue_id)
    const { data: onb, error: onbErr } = await onbQuery.single()
    if (!onb) {
      console.error('[apply-changes] onboarding not found', onbErr)
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    }

    // Envíos mal encaminados (venue aún no publicado que mandó changes_data en
    // vez de ficha_data): con is_initial=true tratamos changes_data como inicial
    const fichaData = is_initial
      ? (onb.ficha_data || onb.changes_data)
      : onb.changes_data
    if (!fichaData) return NextResponse.json({ error: 'Sin datos de ficha' }, { status: 400 })

    if (!String(fichaData.H1_Venue || '').trim()) {
      return NextResponse.json({ error: 'La ficha no tiene nombre de venue (H1)' }, { status: 400 })
    }

    // ID del venue publicado (antes era el post de WP; ahora es la clave que
    // une fila del editor, fila publicada y los leads del formulario).
    // Prioridad 1: venue_onboarding.wp_post_id
    // Prioridad 2: user_venues.wp_venue_id de este venue concreto (multi-venue)
    // Prioridad 3: venue_profiles.wp_venue_id (legado single-venue)
    let existingWpId: number | null = onb.wp_post_id || null
    if (!existingWpId && venue_id) {
      const { data: uvRow } = await svc
        .from('user_venues').select('wp_venue_id').eq('user_id', target_user_id).eq('id', venue_id).maybeSingle()
      existingWpId = uvRow?.wp_venue_id || null
    }
    if (!existingWpId) {
      const { data: vp } = await svc
        .from('venue_profiles').select('wp_venue_id').eq('user_id', target_user_id).maybeSingle()
      existingWpId = vp?.wp_venue_id || null
    }

    const cols = buildPublicVenueColumns(fichaData)

    // Update de la fila del editor, siempre acotado a venue_id si existe
    const scopedUpdate = (payload: Record<string, any>) => {
      let q = svc.from('venue_onboarding').update(payload).eq('user_id', target_user_id)
      if (venue_id) q = q.eq('venue_id', venue_id)
      return q
    }

    let resolvedWpId: number
    let publishedSlug: string

    if (existingWpId) {
      resolvedWpId = existingWpId

      // Fila publicada existente (las importadas tienen user_id NULL y slug)
      const { data: pubRow } = await svc
        .from('venue_onboarding')
        .select('id, slug')
        .eq('wp_post_id', existingWpId)
        .eq('status', 'published')
        .maybeSingle()

      if (pubRow) {
        publishedSlug = pubRow.slug
        const { error: pubErr } = await svc
          .from('venue_onboarding')
          .update(cols)
          .eq('id', pubRow.id)
        if (pubErr) {
          console.error('[apply-changes] publish update error', pubErr)
          return NextResponse.json({ error: `Error al publicar en la web: ${pubErr.message}` }, { status: 500 })
        }
      } else {
        // Tiene wp_post_id pero nunca se publicó en la web nueva: crear fila
        publishedSlug = await uniqueSlug(svc, slugify(cols.name))
        const { error: insErr } = await svc
          .from('venue_onboarding')
          .insert({ ...cols, user_id: null, slug: publishedSlug, status: 'published', wp_post_id: existingWpId })
        if (insErr) {
          console.error('[apply-changes] publish insert error', insErr)
          return NextResponse.json({ error: `Error al publicar en la web: ${insErr.message}` }, { status: 500 })
        }
      }

      if (is_initial) {
        // Re-aprobación de venue ya publicado: actualizar estado y guardar
        // ficha_data para que la próxima carga lea de Supabase (fast path)
        await scopedUpdate({
          status: 'approved',
          wp_post_id: existingWpId,
          reviewed_at: new Date().toISOString(),
          ficha_data: fichaData,
        })
      } else {
        // Aprobación de cambios: promover changes_data → ficha_data
        await scopedUpdate({
          ficha_data: onb.changes_data,
          changes_data: null,
          changes_status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
      }

      // venue_profiles siempre con el wp_venue_id correcto
      await svc.from('venue_profiles').upsert(
        { user_id: target_user_id, wp_venue_id: existingWpId, status: 'active' },
        { onConflict: 'user_id' }
      )

    } else {
      // Venue nuevo sin id: generamos uno sintético (max + 1). WordPress ya no
      // interviene; el id solo enlaza editor, fila publicada y leads.
      const { data: maxRow } = await svc
        .from('venue_onboarding')
        .select('wp_post_id')
        .not('wp_post_id', 'is', null)
        .order('wp_post_id', { ascending: false })
        .limit(1)
        .maybeSingle()
      resolvedWpId = (maxRow?.wp_post_id || 100000) + 1

      publishedSlug = await uniqueSlug(svc, slugify(cols.name))
      const { error: insErr } = await svc
        .from('venue_onboarding')
        .insert({ ...cols, user_id: null, slug: publishedSlug, status: 'published', wp_post_id: resolvedWpId })
      if (insErr) {
        console.error('[apply-changes] publish insert error', insErr)
        return NextResponse.json({ error: `Error al publicar en la web: ${insErr.message}` }, { status: 500 })
      }

      await svc.from('venue_profiles').upsert(
        { user_id: target_user_id, wp_venue_id: resolvedWpId, status: 'active' },
        { onConflict: 'user_id' }
      )
      await scopedUpdate({ status: 'approved', wp_post_id: resolvedWpId, reviewed_at: new Date().toISOString(), ficha_data: fichaData })

      // Alta en user_venues para que el CRM muestre el venue asignado.
      // Contamos antes para saber si es el primer venue del usuario (is_primary).
      const { count: venueCount } = await svc
        .from('user_venues')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', target_user_id)
      const isFirstVenue = (venueCount ?? 0) === 0

      const { data: uvRow } = await svc
        .from('user_venues')
        .upsert(
          { user_id: target_user_id, wp_venue_id: resolvedWpId, is_primary: isFirstVenue },
          { onConflict: 'user_id,wp_venue_id' }
        )
        .select('id')
        .single()

      // Backfill de venue_id en suscripciones sueltas (p. ej. trial de onboarding)
      if (isFirstVenue && uvRow?.id) {
        await svc
          .from('venue_subscriptions')
          .update({ venue_id: uvRow.id })
          .eq('user_id', target_user_id)
          .is('venue_id', null)
      }
    }

    // Regenerar la página en wvs-web (no fatal: ISR la refresca cada 24 h)
    await revalidateWvsWeb(publishedSlug)

    return NextResponse.json({ success: true, wp_venue_id: resolvedWpId, slug: publishedSlug })

  } catch (err: any) {
    console.error('[/api/venues/apply-changes]', err)
    const msg = err?.message || String(err) || 'Error interno desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Slug único entre las filas publicadas: "masia-x", "masia-x-2", "masia-x-3"...
async function uniqueSlug(svc: ReturnType<typeof getServiceClient>, base: string): Promise<string> {
  const fallback = base || 'venue'
  const { data: rows } = await svc
    .from('venue_onboarding')
    .select('slug')
    .like('slug', `${fallback}%`)
  const taken = new Set((rows || []).map((r: any) => r.slug))
  if (!taken.has(fallback)) return fallback
  for (let i = 2; i < 100; i++) {
    if (!taken.has(`${fallback}-${i}`)) return `${fallback}-${i}`
  }
  return `${fallback}-${Date.now()}`
}

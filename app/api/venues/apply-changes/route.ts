import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const WP_URL = process.env.NEXT_PUBLIC_WP_URL || 'https://weddingvenuesspain.com'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function getWvsToken() {
  const token = process.env.WVS_REST_TOKEN
  if (!token) throw new Error('WVS_REST_TOKEN not configured')
  return token
}

// Remove dangerous HTML tags and attributes before sending to WordPress
function stripDangerousHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}

// Strip empty block elements that contentEditable inserts (e.g. <div><br></div>)
// These are invisible in the editor but create big gaps in WordPress
function cleanPostContent(html: string): string {
  return html
    .replace(/<div>(\s*<br\s*\/?>?\s*)<\/div>/gi, '')
    .replace(/<p>(\s*<br\s*\/?>?\s*)<\/p>/gi, '')
    .trim()
}

// Clean rich text field (compact fields: zones, catering description)
// Converts <p>text</p> → text<br> to avoid big paragraph gaps in WordPress
function cleanRichField(html: string): string {
  if (!html) return ''
  return html
    .replace(/<p>(\s*<br\s*\/?>?\s*)<\/p>/gi, '')   // remove empty <p>
    .replace(/<p>(.*?)<\/p>/gi, '$1<br>')             // <p>text</p> → text<br>
    .replace(/<br\s*\/?>\s*$/i, '')                   // remove trailing <br>
    .trim()
}

// Build WP ACF payload from ficha_data JSON
function buildWpPayload(d: Record<string, any>) {
  // Gallery: send Supabase URLs — PHP will sideload them into WP media library
  const rawGallery = (d.gallery || []) as any[]
  const hFields = ['h2_gallery','h2_gallery_copy','h2_gallery_copy2','h2_gallery_copy3',
                   'h2_gallery_copy4','h2_gallery_copy5','h2_gallery_copy6','h2_gallery_copy7']
  const galleryAcf: Record<string, any> = {}
  hFields.forEach((f, i) => {
    const entry = rawGallery[i]
    galleryAcf[f] = (entry && typeof entry === 'object' ? entry.url : '') || ''
  })

  // Starting price: {value}€/{unit} — no "From" prefix
  const menuUnit = d.menuPriceUnit && d.menuPriceUnit !== '' ? `/${d.menuPriceUnit}` : ''
  const startingPrice = d.menuPriceValue ? `${d.menuPriceValue}€${menuUnit}` : ''

  // Accommodation WP formatted value (field: accommodation)
  let accommodationWp = ''
  if (d.wvsAccomHelp) {
    accommodationWp = 'Request'
  } else if (d.accommodation === 'yes') {
    accommodationWp = 'Included'
  } else if (d.accommodation === 'optional') {
    accommodationWp = 'Request'
  } else if (d.accommodation === 'no') {
    accommodationWp = '-'
  }

  // Accommodation breakdown (starting_price_breakdown_4)
  let accomBreakdownText = ''
  if (d.accommodation === 'yes') {
    const g = d.accomGuests ? `${d.accomGuests} guests` : 'guests'
    const n = d.accomNights ? ` ${d.accomNights} night${parseInt(d.accomNights) !== 1 ? 's' : ''}` : ''
    accomBreakdownText = `Included for ${g}${n}`
  } else if (d.accommodation === 'optional') {
    accomBreakdownText = 'Request'
  } else if (d.accommodation === 'no') {
    accomBreakdownText = 'Not Included'
  }
  const accomBreakdown4 = `Accommodation <br><p style="font-weight: 300;">- ${accomBreakdownText}</p>`

  // Venue fee: HTML format for WP
  const nights = parseInt(d.venueFeeNights) || 0
  const nightsText = nights === 0 ? '' : nights === 1 ? ' inc. 1 night' : ` inc. ${nights} nights`
  const venueBreakdown1 = d.venueFeeIncluded
    ? `Venue <br><p style="font-weight: 300;">- included in menu</p>`
    : `Venue <br><p style="font-weight: 300;">- starting at ${d.venueFeeValue}€${nightsText}</p>`
  const venueBreakdown1text = ''

  // Catering: HTML format for WP
  const cUnit              = d.cateringFeeUnit ? `/${d.cateringFeeUnit}` : ''
  const cateringBreakdown3 = d.cateringFeeValue
    ? `Catering & Drinks <br><p style="font-weight: 300;">- starting at ${d.cateringFeeValue}€${cUnit}</p>`
    : 'Catering & Drinks <br><p style="font-weight: 300;">- </p>'
  const cateringBreakdown3text = ''

  return {
    title: d.H1_Venue || '',
    content: stripDangerousHtml(cleanPostContent(d.postContent || '')),
    excerpt: d.shortDesc || '',
    acf: {
      H1_Venue:                        d.H1_Venue || '',
      location:                        d.location || '',
      Short_Description_of_Venue:      d.shortDesc || '',
      venue_starting_price:            startingPrice,
      Capacity_of_Venue:               d.capacity || '',
      accommodation:                   accommodationWp,
      Min_Nights_of_Venue:             d.venuePrice || '',
      wvs_accommodation_help:          d.wvsAccomHelp ? 'yes' : 'no',
      h1_image:                        d.heroImageUrl || '',      // URL — PHP sideloads to WP media
      vertical_photo:                  d.verticalPhotoUrl || '',  // URL — PHP sideloads to WP media
      section_2_image:                 d.verticalPhotoUrl || '',  // same photo → section_2_image (PHP sideloads)
      'h2-Venue_and_mini_description': d.miniDesc || '',
      mini_paragraph:                  d.miniParagraph || '',
      start_of_post_content:           d.miniParagraph || '',     // mini párrafo → start_of_post_content
      starting_price_breakdown1:            venueBreakdown1,
      starting_price_breakdown_text_area_1: stripDangerousHtml(cleanRichField(d.breakdown1text || '')),
      starting_price_breakdown_3:           cateringBreakdown3,
      starting_price_breakdown_text_area_3: cateringBreakdown3text,
      catering_and_drinks_description:      stripDangerousHtml(cleanRichField(d.breakdown3text || '')),
      starting_price_breakdown_4:           accomBreakdown4,
      starting_price_breakdown_text_area_4: '',
      Specific_Location:               d.specificLocation || '',
      Places_Nearby:                   d.placesNearby || '',
      Closest_Airport_to_Venue:        d.closestAirport || '',
      reviews_enabled:                 d.reviewsEnabled ? 1 : 0,
      reviews:                         Array.isArray(d.reviews) ? d.reviews : [],
      ...galleryAcf,
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: caller } = await supabase
      .from('venue_profiles').select('role').eq('user_id', session.user.id).single()
    if (caller?.role !== 'admin') return NextResponse.json({ error: 'Solo admin' }, { status: 403 })

    const { target_user_id, is_initial } = await req.json()

    // Use service role for all Supabase reads/writes (bypasses RLS so admin can access any user's data)
    const svc = getServiceClient()

    // Load onboarding via service role — anon client blocked by RLS for cross-user reads
    const { data: onb, error: onbErr } = await svc
      .from('venue_onboarding').select('*').eq('user_id', target_user_id).single()
    if (!onb) {
      console.error('[apply-changes] onboarding not found', onbErr)
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    }

    const fichaData = is_initial ? onb.ficha_data : onb.changes_data
    if (!fichaData) return NextResponse.json({ error: 'Sin datos de ficha' }, { status: 400 })

    const wvsToken = getWvsToken()
    const wpPayload = buildWpPayload(fichaData)
    const wvsHeaders = { 'Content-Type': 'application/json', 'X-WVS-Token': wvsToken }

    let wpRes: Response
    let resolvedWpId: number | null = null

    // Determine the existing WP post ID from venue_profiles OR onboarding wp_post_id as fallback
    const { data: targetProfile } = await svc
      .from('venue_profiles').select('wp_venue_id').eq('user_id', target_user_id).single()
    const existingWpId: number | null =
      targetProfile?.wp_venue_id || onb.wp_post_id || null

    // Store leads email in WP ACF field email_del_venue (set by venue in portal)
    const leadsEmail = fichaData?.leadsEmail || ''
    if (leadsEmail) (wpPayload.acf as any).email_del_venue = leadsEmail

    if (existingWpId) {
      // WP post already exists — always UPDATE, never create a duplicate
      wpRes = await fetch(`${WP_URL}/wp-json/wvs/v1/venue/${existingWpId}/update`, {
        method: 'POST',
        headers: wvsHeaders,
        body: JSON.stringify(wpPayload),
      })
      const wpData = await wpRes.json()
      if (!wpRes.ok) return NextResponse.json({ error: wpData.message || 'WP error' }, { status: 500 })
      resolvedWpId = existingWpId

      if (is_initial) {
        // Re-approving an already-published venue — update onboarding status
        await svc.from('venue_onboarding').update({
          status: 'approved', wp_post_id: existingWpId, reviewed_at: new Date().toISOString()
        }).eq('user_id', target_user_id)
      } else {
        // Approving submitted changes — promote changes_data → ficha_data and clear pending
        await svc.from('venue_onboarding').update({
          ficha_data: onb.changes_data,
          changes_data: null,
          changes_status: 'approved',
          reviewed_at: new Date().toISOString()
        }).eq('user_id', target_user_id)
      }

      // Ensure venue_profiles always has the correct wp_venue_id (upsert handles missing rows)
      await svc.from('venue_profiles').upsert(
        { user_id: target_user_id, wp_venue_id: existingWpId, status: 'active' },
        { onConflict: 'user_id' }
      )

    } else {
      // No WP post yet — create new
      wpRes = await fetch(`${WP_URL}/wp-json/wvs/v1/venue/create`, {
        method: 'POST',
        headers: wvsHeaders,
        body: JSON.stringify(wpPayload),
      })
      const wpData = await wpRes.json()
      if (!wpRes.ok) return NextResponse.json({ error: wpData.message || 'WP error' }, { status: 500 })
      resolvedWpId = wpData.id

      // Save WP ID — upsert ensures row is created even if venue_profiles didn't exist
      await svc.from('venue_profiles').upsert(
        { user_id: target_user_id, wp_venue_id: resolvedWpId, status: 'active' },
        { onConflict: 'user_id' }
      )
      await svc.from('venue_onboarding').update({
        status: 'approved', wp_post_id: resolvedWpId, reviewed_at: new Date().toISOString()
      }).eq('user_id', target_user_id)

      // Insert into user_venues so the CRM shows the assigned venue
      await svc.from('user_venues').upsert(
        { user_id: target_user_id, wp_venue_id: resolvedWpId },
        { onConflict: 'user_id,wp_venue_id' }
      )
    }

    return NextResponse.json({ success: true, wp_venue_id: resolvedWpId })

  } catch (err) {
    console.error('[/api/venues/apply-changes]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

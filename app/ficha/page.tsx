'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Upload, X, Send, Clock, CheckCircle, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react'
import DOMPurify from 'dompurify'

type Tab = 'info' | 'descripcion' | 'precios' | 'ubicacion' | 'fotos' | 'resenas' | 'config'
type VenuePriceMode = 'auto' | 'included' | 'none'

// ── Helpers ───────────────────────────────────────────────────────────────────

function wordCount(text: string) {
  // Strip HTML tags (content from rich text editor has tags)
  const plain = text.replace(/<[^>]*>/g, ' ').replace(/&[a-z#\d]+;/gi, ' ').replace(/\s+/g, ' ').trim()
  return plain ? plain.split(/\s+/).length : 0
}

function autoSymbol(input: string): '$' | '$$' | '$$$' | '' {
  const n = parseFloat(input.replace(/[^\d.]/g, ''))
  if (isNaN(n) || !input.trim()) return ''
  if (n < 4000)  return '$'
  if (n < 8000)  return '$$'
  return '$$$'
}

function legacyToSymbol(v: string): string {
  if (v === 'budget') return '$'
  if (v === 'mid')    return '$$'
  if (v === 'luxury' || v === 'ultra') return '$$$'
  return v
}

const REGIONS = [
  'Mallorca', 'Ibiza', 'Barcelona', 'Madrid', 'Costa Brava',
  'Alicante', 'Malaga', 'Marbella', 'Sevilla', 'Valencia',
]

const WC_COLORS = (count: number, limit: number) =>
  count > limit ? '#c0392b' : count > limit * 0.85 ? '#d97706' : 'var(--warm-gray)'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FichaPage() {
  const router = useRouter()
  const { user, profile, userVenues, loading: authLoading } = useAuth()
  const hasLoaded   = useRef(false)
  const autoSaveRef = useRef<() => void>(() => {})
  const [venue, setVenue]           = useState<any>(null)
  const [onboarding, setOnboarding] = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState<Tab>('info')
  const [saving, setSaving]         = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmSubmit, setConfirmSubmit]         = useState(false)
  const [validationErrors, setValidationErrors]   = useState<{ field: string; tab: Tab; msg: string }[]>([])
  const [isDirty, setIsDirty]       = useState(false)
  const [dirtyTabs, setDirtyTabs]   = useState<Set<Tab>>(new Set())
  const [pendingNav, setPendingNav] = useState<string | null>(null)
  const [heroLocalPreview, setHeroLocalPreview]   = useState<string | null>(null)
  const [cropState, setCropState] = useState<{ file: File; aspect: number; onCrop: (blob: Blob) => void; maxPx?: number; quality?: number } | null>(null)
  const [selectedVenueId, setSelectedVenueId]     = useState<number | null>(null)
  const [resolvedVenueWpId, setResolvedVenueWpId] = useState<number | null>(null)
  const [success, setSuccess]       = useState('')
  const [error, setError]           = useState('')

  // ── Info principal ──────────────────────────────────────────────────────────
  const [H1_Venue, setH1_Venue]     = useState('')
  const [location, setLocation]     = useState('')
  const [shortDesc, setShortDesc]   = useState('')
  const [leadsEmail, setLeadsEmail]         = useState('')
  const [leadsEmailSaved, setLeadsEmailSaved] = useState('')
  const [savingConfig, setSavingConfig]       = useState(false)
  const [configMsg, setConfigMsg]             = useState('')
  const [capacity, setCapacity]     = useState('')
  const [menuPriceValue, setMenuPriceValue] = useState('')
  const [menuPriceUnit,  setMenuPriceUnit]  = useState<'person' | 'day' | ''>('person')
  const [heroImage, setHeroImage]   = useState<{ id: number; url: string } | null>(null)
  const [uploadingHero, setUploadingHero] = useState(false)
  const [venuePriceMode, setVenuePriceMode]   = useState<VenuePriceMode>('none')
  const [venuePriceInput, setVenuePriceInput] = useState('')
  const [venuePriceSaved, setVenuePriceSaved] = useState('')

  // ── Descripción ─────────────────────────────────────────────────────────────
  const [miniDesc,      setMiniDesc]      = useState('')
  const [miniParagraph, setMiniParagraph] = useState('')
  const [postContent,   setPostContent]   = useState('')

  // ── Precios ─────────────────────────────────────────────────────────────────
  const [venueFeeValue,    setVenueFeeValue]    = useState('')
  const [venueFeeNights,   setVenueFeeNights]   = useState(0)
  const [venueFeeIncluded, setVenueFeeIncluded] = useState(false)
  const [breakdown1text,   setBreakdown1text]   = useState('')
  const [cateringFeeValue, setCateringFeeValue] = useState('')
  const [cateringFeeUnit,  setCateringFeeUnit]  = useState<'person' | 'day' | 'event'>('person')
  const [breakdown3text,   setBreakdown3text]   = useState('')
  const [accommodation,    setAccommodation]    = useState('')
  const [accomGuests,      setAccomGuests]      = useState('')
  const [accomNights,      setAccomNights]      = useState('')
  const [wvsAccomHelp,     setWvsAccomHelp]     = useState(false)

  // ── Ubicación ───────────────────────────────────────────────────────────────
  const [specificLocation, setSpecificLocation] = useState('')
  const [placesNearby,     setPlacesNearby]     = useState('')
  const [closestAirport,   setClosestAirport]   = useState('')

  // ── Fotos ───────────────────────────────────────────────────────────────────
  const [verticalPhoto,     setVerticalPhoto]     = useState<{ id: number; url: string } | null>(null)
  const [uploadingVertical, setUploadingVertical] = useState(false)
  const [hGallery,          setHGallery]          = useState<(null | { id: number; url: string })[]>(Array(8).fill(null))
  const [uploadingPhoto,    setUploadingPhoto]    = useState(false)
  const [uploadMsg,         setUploadMsg]         = useState('')

  // ── Reseñas ─────────────────────────────────────────────────────────────────
  const [reviewsEnabled, setReviewsEnabled] = useState(true)
  const [reviews, setReviews] = useState([
    { couple_name: '', country: '', text: '' },
    { couple_name: '', country: '', text: '' },
    { couple_name: '', country: '', text: '' },
  ])

  // Load once — never re-run even if profile/user re-renders (prevents data loss on tab switch)
  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    if (hasLoaded.current) return
    hasLoaded.current = true
    load()
  }, [user, profile, authLoading]) // eslint-disable-line

  // Auto-save when user switches browser tabs
  useEffect(() => {
    const handler = () => { if (document.hidden) autoSaveRef.current() }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  // Intercept all link clicks while there are unsaved changes
  useEffect(() => {
    if (!isDirty || loading) return
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href') || ''
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      try {
        const url = new URL(href, window.location.origin)
        if (url.pathname === window.location.pathname) return // same page
      } catch { return }
      e.preventDefault()
      e.stopImmediatePropagation()
      setPendingNav(href)
    }
    document.addEventListener('click', handleClick, true) // capture before Next.js router
    return () => document.removeEventListener('click', handleClick, true)
  }, [isDirty, loading])

  // Warn on browser refresh / tab close
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const load = async () => {
    const supabase = createClient()
    const [{ data: onb }, { data: uvData }] = await Promise.all([
      supabase.from('venue_onboarding').select('*').eq('user_id', user!.id).single(),
      supabase.from('user_venues').select('wp_venue_id').eq('user_id', user!.id).limit(1).maybeSingle(),
    ])
    if (onb) setOnboarding(onb)
    // selectedVenueId (multi-venue) > profile.wp_venue_id > user_venues fallback (stale auth)
    const wpVenueId = selectedVenueId || profile?.wp_venue_id || uvData?.wp_venue_id
    console.log('[ficha:load]', {
      selectedVenueId, profile_wp_venue_id: profile?.wp_venue_id,
      uvData_wp_venue_id: uvData?.wp_venue_id, wpVenueId,
      onb_changes_status: onb?.changes_status, has_changes_data: !!onb?.changes_data,
      has_ficha_data: !!onb?.ficha_data,
    })
    if (wpVenueId) {
      setResolvedVenueWpId(wpVenueId)

      const hasRealChanges = onb?.changes_data && typeof onb.changes_data === 'object' && Object.keys(onb.changes_data).length > 0
      const hasSupabaseData = (hasRealChanges && ['draft', 'submitted', 'rejected'].includes(onb?.changes_status || ''))
        || (onb?.ficha_data && typeof onb.ficha_data === 'object' && Object.keys(onb.ficha_data).length > 0)

      if (hasSupabaseData) {
        // Fast path: populate from Supabase immediately, fetch WP metadata in background
        if (hasRealChanges && ['draft', 'submitted', 'rejected'].includes(onb?.changes_status || '')) {
          console.log('[ficha:load] Fast path — using changes_data, status:', onb?.changes_status)
          populateFromFichaData(onb!.changes_data)
        } else {
          console.log('[ficha:load] Fast path — using ficha_data from Supabase')
          populateFromFichaData(onb!.ficha_data)
        }
        setLoading(false)
        setIsDirty(false); setDirtyTabs(new Set())

        // Load WP venue metadata in background (for external link, title, etc.)
        fetch(`/api/venues/wp-venue?id=${wpVenueId}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => { if (data) setVenue(data) })
          .catch(() => {})
        return
      }

      // Slow path: no Supabase data yet — must wait for WP (first-time load)
      try {
        console.log('[ficha:load] Slow path — fetching from WP')
        const res = await fetch(`/api/venues/wp-venue?id=${wpVenueId}`)
        if (res.ok) {
          const data = await res.json()
          setVenue(data)
          console.log('[ficha:wp]', { _source: data._source, title: data.title?.rendered, acf_keys: Object.keys(data.acf || {}) })
          populateFromWp(data)
        } else {
          const err = await res.json().catch(() => ({}))
          console.error('[ficha:wp error]', err)
          setError(`No se pudo cargar el venue de WordPress: ${err.error || res.status}. Contacta con soporte.`)
        }
      } catch {
        setError('Error al conectar con WordPress. Comprueba tu conexión e inténtalo de nuevo.')
      }
    } else if (onb?.ficha_data) {
      populateFromFichaData(onb.ficha_data)
    }
    setLoading(false)
    setIsDirty(false); setDirtyTabs(new Set()) // mark clean after initial load
  }

  function resolveImage(img: any): { id: number; url: string } | null {
    if (!img) return null
    if (typeof img === 'number') return img > 0 ? { id: img, url: '' } : null
    if (typeof img === 'string') return img ? { id: 0, url: img } : null   // URL string from get_field()
    if (img.url) return { id: img.id || 0, url: img.url }
    if (img.full_image_url) return { id: img.id || 0, url: img.full_image_url } // WP Photo Gallery format
    if (img.sizes?.large?.source_url) return { id: img.id || 0, url: img.sizes.large.source_url }
    if (img.sizes?.large) return { id: img.id || 0, url: img.sizes.large }
    if (img.media_details?.sizes?.large?.source_url) return { id: img.id || 0, url: img.media_details.sizes.large.source_url }
    return null
  }

  // Parse "From 36.600€ (incl. 2 nights)" → { value, nights }
  function parseLegacyFee(raw: string): { value: string; nights: number; included: boolean } {
    if (!raw) return { value: '', nights: 0, included: false }
    if (raw.toLowerCase().includes('included in menu')) return { value: '', nights: 0, included: true }
    const match = raw.match(/[\d.,]+/)
    const nightsMatch = raw.match(/(\d+)\s*night/)
    return {
      value: match ? match[0].replace(',', '.') : '',
      nights: nightsMatch ? parseInt(nightsMatch[1]) : 0,
      included: false,
    }
  }

  // Parse "From 120€/person" → { value, unit }
  function parseLegacyCatering(raw: string): { value: string; unit: 'person' | 'day' | 'event' } {
    if (!raw) return { value: '', unit: 'person' }
    const match = raw.match(/[\d.,]+/)
    const unit = raw.toLowerCase().includes('day') ? 'day' : raw.toLowerCase().includes('event') ? 'event' : 'person'
    return { value: match ? match[0].replace(',', '.') : '', unit }
  }

  // Parse "120€/person" or "From 120€ per person" legacy menu → { value, unit }
  function parseLegacyMenu(raw: string): { value: string; unit: 'person' | 'day' | '' } {
    if (!raw || raw === '-') return { value: '', unit: '' }
    const match = raw.match(/[\d.,]+/)
    const unit = raw.toLowerCase().includes('day') ? 'day' : raw.toLowerCase().includes('person') ? 'person' : 'person'
    return { value: match ? match[0].replace(',', '.') : '', unit }
  }

  // Strip HTML tags from a string (for WP content/excerpt fallback)
  function stripHtml(html: string) {
    return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim()
  }

  function populateFromWp(data: any) {
    const acfRaw = data.acf || {}
    // Custom endpoint (/wp-json/wvs/v1/venue): all fields flat under acf.*
    // Standard endpoint (/wp-json/wp/v2/venues): only photo_gallery nested under acf.photo_gallery.*
    // Merge both so either source works
    const gallery = acfRaw.photo_gallery || {}
    const acf = { ...gallery, ...acfRaw }

    // Fallbacks: use WP post title/content/excerpt when ACF fields aren't in REST yet
    setH1_Venue(acf.H1_Venue || data.title?.rendered || '')
    setLocation(acf.location || '')
    setShortDesc(acf.Short_Description_of_Venue || stripHtml(data.excerpt?.rendered || '').slice(0, 200) || '')
    setCapacity(acf.Capacity_of_Venue || '')
    const mp = parseLegacyMenu(acf.venue_starting_price || '')
    setMenuPriceValue(mp.value); setMenuPriceUnit('person')
    setHeroImage(resolveImage(acf.h1_image))

    // Vertical photo: portal writes to `vertical_photo`, WP site uses `section_2_image` (Photo Gallery)
    const vertRaw = acf.vertical_photo || acf.section_2_image
    if (Array.isArray(vertRaw)) {
      // Photo Gallery returns [[img]] or [img]
      const first = Array.isArray(vertRaw[0]) ? vertRaw[0][0] : vertRaw[0]
      if (first) setVerticalPhoto(resolveImage(first))
    } else if (vertRaw) {
      setVerticalPhoto(resolveImage(vertRaw))
    }

    const rawMin = String(acf.Min_Nights_of_Venue || '')
    const numericMin = parseFloat(rawMin.replace(/[^\d.]/g, ''))
    if (!isNaN(numericMin) && numericMin > 0 && /^\d/.test(rawMin.trim())) {
      // Stored as plain number (venuePriceInput) — restore it
      setVenuePriceInput(String(numericMin))
      setVenuePriceMode('auto')
      setVenuePriceSaved('')
    } else {
      const raw = legacyToSymbol(rawMin)
      setVenuePriceSaved(raw)
      setVenuePriceMode(raw === 'included' ? 'included' : (!raw || raw === '-') ? 'none' : 'auto')
    }
    setMiniDesc(acf['h2-Venue_and_mini_description'] || '')
    setMiniParagraph(acf.mini_paragraph || '')
    setPostContent(acf.start_of_post_content || stripHtml(data.content?.rendered || ''))
    // starting_price_breakdown1 es solo para WordPress (label "Venue") — el venue nunca lo ve
    setVenueFeeValue(''); setVenueFeeNights(0); setVenueFeeIncluded(false)
    setBreakdown1text(acf.starting_price_breakdown_text_area_1 || '')
    setBreakdown3text(acf.catering_and_drinks_description || '')
    const cat = parseLegacyCatering(acf.starting_price_breakdown_3 || '')
    setCateringFeeValue(cat.value); setCateringFeeUnit(cat.unit)
    setBreakdown3text(acf.starting_price_breakdown_text_area_3 || '')
    setAccommodation(acf.accommodation || '')
    setAccomGuests(acf.accom_guests || '')
    setAccomNights(acf.accom_nights || '')
    setWvsAccomHelp(acf.wvs_accommodation_help === 'yes')
    setSpecificLocation(acf.Specific_Location || '')
    setPlacesNearby(acf.Places_Nearby || '')
    setClosestAirport(acf.Closest_Airport_to_Venue || '')
    const hFields = ['h2_gallery','h2_gallery_copy','h2_gallery_copy2','h2_gallery_copy3',
                     'h2_gallery_copy4','h2_gallery_copy5','h2_gallery_copy6','h2_gallery_copy7']
    setHGallery(hFields.map(f => resolveImage(acf[f])))
    // Reviews: portal writes as `reviews` array OR individual testimonial_* fields
    if (Array.isArray(acf.reviews) && acf.reviews.some((r: any) => r?.text || r?.couple_name)) {
      setReviews(acf.reviews)
    } else {
      const wpReviews = [
        { couple_name: acf.testimonial_name_1 || '', country: acf.testimonial_country_1 || '', text: acf.testimonial_1 || '' },
        { couple_name: acf.testimonial_name_2 || '', country: acf.testimonial_country_2 || '', text: acf.testimonial_2 || '' },
        { couple_name: acf.testimonial_name_3 || '', country: acf.testimonial_country_3 || '', text: acf.testimonial_3 || '' },
      ]
      if (wpReviews.some(r => r.text || r.couple_name)) setReviews(wpReviews)
    }
    setReviewsEnabled(acf.reviews_enabled !== false)
  }

  function populateFromFichaData(d: any) {
    if (!d) return
    console.log('[ficha:populate]', { verticalPhotoId: d.verticalPhotoId, verticalPhotoUrl: d.verticalPhotoUrl, heroImageId: d.heroImageId, galleryCount: d.gallery?.filter(Boolean).length })
    setH1_Venue(d.H1_Venue || '')
    setLocation(d.location || '')
    setShortDesc(d.shortDesc || '')
    setCapacity(d.capacity || '')
    setMenuPriceValue(d.menuPriceValue || '')
    setMenuPriceUnit('person')
    const heroUrl = d.heroImageUrl || ''
    if (heroUrl && !heroUrl.startsWith('blob:')) setHeroImage({ id: d.heroImageId || 0, url: heroUrl })
    const vertUrl = d.verticalPhotoUrl || ''
    if (vertUrl && !vertUrl.startsWith('blob:')) setVerticalPhoto({ id: d.verticalPhotoId || 0, url: vertUrl })
    const raw = legacyToSymbol(d.venuePrice || '')
    setVenuePriceSaved(raw)
    setVenuePriceMode(raw === 'included' ? 'included' : (!raw || raw === '-') ? 'none' : 'auto')
    setVenuePriceInput(d.venuePriceInput || '')
    setMiniDesc(d.miniDesc || '')
    setMiniParagraph(d.miniParagraph || '')
    setPostContent(d.postContent || '')
    setVenueFeeValue(d.venueFeeValue || '')
    setVenueFeeNights(d.venueFeeNights || 0)
    setVenueFeeIncluded(!!d.venueFeeIncluded)
    setBreakdown1text(d.breakdown1text || '')
    setCateringFeeValue(d.cateringFeeValue || '')
    setCateringFeeUnit(d.cateringFeeUnit || 'person')
    setBreakdown3text(d.breakdown3text || '')
    setAccommodation(d.accommodation || '')
    setAccomGuests(d.accomGuests || '')
    setAccomNights(d.accomNights || '')
    setWvsAccomHelp(!!d.wvsAccomHelp)
    setSpecificLocation(d.specificLocation || '')
    setPlacesNearby(d.placesNearby || '')
    setClosestAirport(d.closestAirport || '')
    setLeadsEmail(d.leadsEmail || '')
    setLeadsEmailSaved(d.leadsEmail || '')
    if (Array.isArray(d.gallery)) {
      setHGallery(d.gallery.map((entry: any) => {
        if (!entry) return null
        if (typeof entry === 'number') return { id: entry, url: '' }
        if (typeof entry === 'object') {
          // Discard blob: URLs — they only live in the current browser tab session
          if (typeof entry.url === 'string' && entry.url.startsWith('blob:')) return null
          // Discard placeholder entries with id=0 and no real URL
          if (entry.id === 0 && !entry.url) return null
          return entry
        }
        return null
      }))
    }
    if (Array.isArray(d.reviews)) setReviews(d.reviews)
    setReviewsEnabled(d.reviewsEnabled !== false)
  }

  function buildVenueFee(): string {
    if (venueFeeIncluded) return 'Included in menu'
    if (!venueFeeValue) return ''
    const nightsStr = venueFeeNights > 0 ? ` inc. ${venueFeeNights} night${venueFeeNights > 1 ? 's' : ''}` : ''
    return `Starting at ${venueFeeValue}€${nightsStr}`
  }

  function buildAccommodation(): string {
    if (accommodation === 'yes') {
      const g = accomGuests ? `${accomGuests} guests` : 'guests'
      const n = accomNights ? ` ${accomNights} night${parseInt(accomNights) !== 1 ? 's' : ''}` : ''
      return `Included for ${g}${n}`
    }
    if (accommodation === 'optional') return 'Request'
    if (accommodation === 'no') return 'Not Included'
    return ''
  }

  function buildCateringFee(): string {
    if (!cateringFeeValue) return ''
    const units = { person: 'person', day: 'day', event: 'event' }
    return `Starting at ${cateringFeeValue}€/${units[cateringFeeUnit]}`
  }

  function buildMenuPrice(): string {
    if (!menuPriceValue || menuPriceUnit === '') return '-'
    return `From ${menuPriceValue}€ per ${menuPriceUnit}`
  }

  function resolvedVenuePrice(): string {
    if (venuePriceMode === 'none') return '-'
    if (venuePriceMode === 'included') return 'included'
    return autoSymbol(venuePriceInput) || venuePriceSaved || '-'
  }

  function collectAllFields() {
    return {
      H1_Venue, location, shortDesc, capacity,
      menuPriceValue, menuPriceUnit, menuPrice: buildMenuPrice(),
      venuePrice: resolvedVenuePrice(), venuePriceInput,
      heroImageId: heroImage?.id || null, heroImageUrl: heroImage?.url || '',
      verticalPhotoId: verticalPhoto?.id || null, verticalPhotoUrl: verticalPhoto?.url || '',
      miniDesc, miniParagraph, postContent,
      venueFeeValue, venueFeeNights, venueFeeIncluded,
      breakdown1: buildVenueFee(), breakdown1text,
      cateringFeeValue, cateringFeeUnit,
      breakdown3: buildCateringFee(), breakdown3text,
      accommodation, accomGuests, accomNights, wvsAccomHelp,
      specificLocation, placesNearby, closestAirport,
      leadsEmail,
      gallery: hGallery.map(p => p ? { id: p.id, url: p.url } : null),
      reviewsEnabled, reviews,
    }
  }

  const notify = (msg: string, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => { setSuccess(''); setError('') }, 4000)
  }

  const saveDraft = async () => {
    setSaving(true)
    const fichaData = collectAllFields()
    const isApproved = !!resolvedVenueWpId
    console.log('[ficha:save]', { isApproved, resolvedVenueWpId, verticalPhotoId: fichaData.verticalPhotoId, heroImageId: fichaData.heroImageId, galleryCount: fichaData.gallery?.filter(Boolean).length })
    try {
      const body = isApproved
        ? { changes_data: fichaData, changes_status: 'draft' }
        : { ficha_data: fichaData, status: onboarding?.status === 'submitted' ? 'submitted' : 'draft' }
      const res = await fetch('/api/venues/save-draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { notify(data.error || 'Error al guardar', true); return false }
      setIsDirty(false); setDirtyTabs(new Set())
      notify('Borrador guardado ✓'); return true
    } catch { notify('Error de conexión', true); return false }
    finally { setSaving(false) }
  }

  const submitForReview = async () => {
    setSubmitting(true)
    const fichaData = collectAllFields()
    const isApproved = !!resolvedVenueWpId
    try {
      const body = isApproved
        ? { changes_data: fichaData, changes_status: 'submitted' }
        : { ficha_data: fichaData, status: 'submitted' }
      const res = await fetch('/api/venues/save-draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { notify(data.error || 'Error al enviar', true); return }
      setOnboarding((prev: any) => ({
        ...prev,
        ...(isApproved ? { changes_status: 'submitted', changes_data: fichaData } : { status: 'submitted', ficha_data: fichaData })
      }))
      notify(isApproved ? 'Cambios enviados para revisión ✓' : 'Ficha enviada para revisión ✓')
    } catch { notify('Error de conexión', true) }
    finally { setSubmitting(false) }
  }

  // ── Auto-save (silent, on visibility change / internal tab switch) ──────────

  // Keep autoSaveRef always pointing to the latest closure
  autoSaveRef.current = () => {
    if (loading) return
    const isApproved = !!resolvedVenueWpId
    const fichaData = collectAllFields()
    const body = isApproved
      ? { changes_data: fichaData, changes_status: onboarding?.changes_status === 'submitted' ? 'submitted' : 'draft' }
      : { ficha_data: fichaData, status: onboarding?.status ?? 'draft' }
    fetch('/api/venues/save-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {})
  }

  // ── Validation before submit ─────────────────────────────────────────────────

  function validateForSubmit(): { field: string; tab: Tab; msg: string }[] {
    const errs: { field: string; tab: Tab; msg: string }[] = []

    // Info principal
    if (!H1_Venue.trim())                errs.push({ field: 'Nombre del venue',        tab: 'info',        msg: 'Obligatorio' })
    else if (wordCount(H1_Venue) > 8)    errs.push({ field: 'Nombre del venue',        tab: 'info',        msg: 'Máximo 8 palabras' })
    if (!location)                        errs.push({ field: 'Región',                  tab: 'info',        msg: 'Selecciona una región' })
    if (!shortDesc.trim())               errs.push({ field: 'Descripción corta',        tab: 'info',        msg: 'Obligatorio' })
    else if (wordCount(shortDesc) > 30)  errs.push({ field: 'Descripción corta',        tab: 'info',        msg: 'Máximo 30 palabras' })
    if (!capacity.trim())                errs.push({ field: 'Nº de invitados',          tab: 'info',        msg: 'Obligatorio' })
    if (!heroImage)                       errs.push({ field: 'Imagen hero',             tab: 'info',        msg: 'Sube la foto principal' })
    if (venuePriceMode === 'auto' && !venuePriceInput.trim())
      errs.push({ field: 'Precio del venue', tab: 'info', msg: 'Introduce el precio o selecciona otra opción' })
    if (menuPriceUnit !== '' && !menuPriceValue.trim())
      errs.push({ field: 'Starting price del menú', tab: 'info', msg: 'Introduce el precio o selecciona "no mostrar"' })

    // Descripción
    if (!miniDesc.trim())                errs.push({ field: 'Mini título (H2)',          tab: 'descripcion', msg: 'Obligatorio' })
    else if (wordCount(miniDesc) > 6)    errs.push({ field: 'Mini título',              tab: 'descripcion', msg: 'Máximo 6 palabras' })
    if (!miniParagraph.trim())           errs.push({ field: 'Mini párrafo',             tab: 'descripcion', msg: 'Obligatorio' })
    if (!postContent.trim())             errs.push({ field: 'Descripción completa',     tab: 'descripcion', msg: 'Obligatorio' })

    // Precios
    if (!accommodation)
      errs.push({ field: 'Alojamiento', tab: 'precios', msg: 'Selecciona una opción de alojamiento' })
    if (!venueFeeIncluded && !venueFeeValue.trim())
      errs.push({ field: 'Venue fee (precio)', tab: 'precios', msg: 'Indica el precio o activa "Included in menu"' })
    if (!cateringFeeValue.trim())
      errs.push({ field: 'Catering starting price', tab: 'precios', msg: 'Obligatorio' })

    // Ubicación
    if (!specificLocation.trim())
      errs.push({ field: 'Ubicación específica', tab: 'ubicacion', msg: 'Obligatorio' })
    if (!closestAirport.trim())
      errs.push({ field: 'Aeropuerto más cercano', tab: 'ubicacion', msg: 'Obligatorio' })

    // Fotos
    if (!verticalPhoto)
      errs.push({ field: 'Foto vertical', tab: 'fotos', msg: 'Sube la foto vertical del venue' })
    const galleryCount = hGallery.filter(Boolean).length
    if (galleryCount < 8)
      errs.push({ field: 'Galería de fotos', tab: 'fotos', msg: `Mínimo 8 fotos (tienes ${galleryCount})` })

    // Reseñas — si activas, las 3 completas
    if (reviewsEnabled) {
      reviews.forEach((r, i) => {
        if (!r.couple_name.trim() || !r.text.trim())
          errs.push({ field: `Reseña ${i + 1}`, tab: 'resenas', msg: 'Nombre y texto son obligatorios, o desactiva las reseñas' })
      })
    }

    return errs
  }

  const handleSubmitClick = () => {
    const errs = validateForSubmit()
    if (errs.length > 0) {
      setValidationErrors(errs)
      setActiveTab(errs[0].tab) // jump to the first tab with errors
      notify(`Faltan ${errs.length} campo${errs.length !== 1 ? 's' : ''} obligatorio${errs.length !== 1 ? 's' : ''}. Revisa los apartados marcados en rojo.`, true)
    } else {
      setValidationErrors([])
      setConfirmSubmit(true)
    }
  }

  // ── Image uploads ────────────────────────────────────────────────────────────

  const uploadImage = async (
    file: File,
    onDone: (img: { id: number; url: string }) => void,
    setUploading: (v: boolean) => void,
    label: string,
    onError?: () => void
  ) => {
    setUploading(true)
    try {
      const form = new FormData(); form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.message || `Error al subir ${label}`
        notify(msg.includes('not allowed') ? `Error de permisos en WordPress al subir ${label}. Contacta con soporte.` : msg, true)
        onError?.()
        return
      }
      onDone({ id: data.id, url: data.url })
      notify(`${label} subida ✓`)
      // Re-validate if user already tried to submit (clears stale errors)
      setValidationErrors(prev => prev.length > 0 ? validateForSubmit() : [])
    } catch {
      notify(`Error al subir ${label}`, true)
      onError?.()
    }
    finally { setUploading(false) }
  }

  const uploadGalleryPhoto = async (file: File, i: number, localPreviewUrl?: string) => {
    setUploadingPhoto(true); setUploadMsg(`Subiendo foto ${i + 1}...`)
    try {
      const form = new FormData(); form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { notify(data.message || 'Error al subir imagen', true); return }
      // Replace local preview with real WP URL (functional update avoids stale closure)
      setHGallery(prev => { const g = [...prev]; g[i] = { id: data.id, url: data.url }; return g })
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl)
      notify(`Foto ${i + 1} subida ✓`)
    } catch { notify('Error al subir imagen', true) }
    finally { setUploadingPhoto(false); setUploadMsg('') }
  }

  // Dismissable "cambios aprobados" notification — must be before early return to respect Rules of Hooks
  const approvalKey = `wvs-approval-dismissed-${user?.id}-${onboarding?.reviewed_at || ''}`
  const [approvalDismissed, setApprovalDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(approvalKey) === '1'
  })
  const dismissApproval = () => {
    localStorage.setItem(approvalKey, '1')
    setApprovalDismissed(true)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold)' }}>Cargando...</div>
    </div>
  )

  const isApproved     = !!profile?.wp_venue_id
  const mainStatus      = onboarding?.status || 'draft'
  const changesStatus   = onboarding?.changes_status || 'draft'
  const isLocked        = !isApproved && mainStatus === 'submitted'
  const isRejected      = !isApproved && mainStatus === 'rejected'
  const changesPending  = isApproved && changesStatus === 'submitted'
  const changesRejected = isApproved && changesStatus === 'rejected'
  const changesApproved = isApproved && changesStatus === 'approved'

  const ERR = '#dc2626'
  const hasError = (field: string) => validationErrors.some(e => e.field === field)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info',        label: 'Info principal' },
    { key: 'descripcion', label: 'Descripción' },
    { key: 'precios',     label: 'Precios' },
    { key: 'ubicacion',   label: 'Ubicación' },
    { key: 'fotos',       label: 'Fotos' },
    { key: 'resenas',     label: 'Reseñas' },
    { key: 'config',      label: 'Configuración' },
  ]

  const wcH1    = wordCount(H1_Venue)
  const wcShort = wordCount(shortDesc)
  const wcMini  = wordCount(miniDesc)
  const wcPara  = wordCount(miniParagraph)
  const wcPost  = wordCount(postContent)
  const wcBreak = wordCount(breakdown1text)
  const wcCat   = wordCount(breakdown3text)

  // ── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Mi ficha</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {venue && (
              <a href={venue.link} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                Ver en la web
              </a>
            )}
          </div>
        </div>

        <div className="page-content" style={{ paddingBottom: 80 }} onChange={() => { if (!loading) { setIsDirty(true); setDirtyTabs(prev => new Set(prev).add(activeTab)) } }}>

          {/* Multi-venue selector */}
          {userVenues.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--cream)', border: '1px solid var(--ivory)', borderRadius: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: 'var(--warm-gray)', fontWeight: 500, flexShrink: 0 }}>Venue activo:</span>
              <select
                className="form-input"
                style={{ fontSize: 13, padding: '5px 12px', maxWidth: 300 }}
                value={selectedVenueId ?? resolvedVenueWpId ?? ''}
                onChange={e => {
                  const id = parseInt(e.target.value)
                  setSelectedVenueId(id)
                  hasLoaded.current = false
                  load()
                }}
              >
                {userVenues.map(v => (
                  <option key={v.wp_venue_id} value={v.wp_venue_id}>Venue #{v.wp_venue_id}</option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: 'var(--stone)' }}>Los cambios afectan al venue seleccionado.</span>
            </div>
          )}

          {/* Status banners */}
          {isLocked && <StatusBanner type="pending" title="Ficha en revisión" body="Nuestro equipo está revisando tu ficha. Te avisaremos por email cuando esté aprobada." />}
          {isRejected && <StatusBanner type="error" title="Solicitud no aprobada" body={onboarding?.admin_notes || 'Corrige los campos indicados y vuelve a enviar.'} />}
          {changesPending && <StatusBanner type="pending" title="Cambios en revisión" body="Los cambios están siendo revisados. La versión actual sigue publicada." />}
          {changesRejected && <StatusBanner type="error" title="Cambios no aprobados" body={onboarding?.admin_notes || ''} />}
          {changesApproved && !approvalDismissed && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              border: '1px solid #6ee7b7', borderRadius: 10, padding: '14px 16px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>🎉</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46', marginBottom: 3 }}>
                    ¡Cambios publicados!
                  </div>
                  <div style={{ fontSize: 12, color: '#047857', lineHeight: 1.5 }}>
                    Tus últimos cambios han sido revisados y publicados en WeddingVenuesSpain.com.
                    {onboarding?.reviewed_at && (
                      <span style={{ marginLeft: 6, opacity: 0.75 }}>
                        ({new Date(onboarding.reviewed_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })})
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={dismissApproval}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#059669', padding: 2, flexShrink: 0, fontSize: 16, lineHeight: 1 }}
                title="Cerrar"
              >✕</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 4, marginBottom: 28, alignItems: 'center', position: 'sticky', top: 50, zIndex: 30, background: 'var(--cream)', paddingTop: 16, paddingBottom: 12, marginTop: -16 }}>
            {tabs.map(t => {
              const errCount = validationErrors.filter(e => e.tab === t.key).length
              const isActive = activeTab === t.key
              return (
                <button key={t.key}
                  className={`ficha-tab ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (t.key !== activeTab && isDirty) {
                      autoSaveRef.current()
                    }
                    setActiveTab(t.key)
                  }}>
                  {t.label}
                  {dirtyTabs.has(t.key) && !isLocked && (
                    <span className="dirty-tooltip-wrap" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'default', position: 'relative' }}>
                      <AlertCircle size={12} style={{ color: 'currentColor', opacity: 0.7, flexShrink: 0 }} />
                      <span className="dirty-tooltip">Hay cambios que no se han guardado</span>
                    </span>
                  )}
                  {errCount > 0 && (
                    <span style={{
                      position: 'absolute', top: -3, right: -3,
                      background: '#dc2626', color: '#fff',
                      fontSize: 8, fontWeight: 700, lineHeight: 1,
                      borderRadius: '50%', width: 14, height: 14,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>{errCount}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── INFO PRINCIPAL ──────────────────────────────────────────── */}
          {activeTab === 'info' && (
            <div>
              {/* Section title */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--espresso)', letterSpacing: '-0.02em' }}>Información principal</div>
                <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginTop: 6 }}>Gestiona los detalles básicos y la apariencia visual de tu venue.</div>
              </div>

              {/* Two-column layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 32, alignItems: 'start' }}>
                {/* Left column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Nombre del venue</span>
                      <span style={{ fontSize: 11, fontWeight: 400, color: WC_COLORS(wcH1, 8) }}>{wcH1} / 8 palabras</span>
                    </label>
                    <input className="form-input" value={H1_Venue}
                      onChange={e => setH1_Venue(e.target.value)}
                      placeholder="Ej: Villa Rosa Mallorca"
                      style={{ borderColor: wcH1 > 8 || hasError('Nombre del venue') ? ERR : undefined }}
                      disabled={isLocked} />
                    {wcH1 > 8 && <FieldError msg="Máximo 8 palabras." />}
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 5, lineHeight: 1.4 }}>
                      ⚠ El nombre forma parte del slug (URL) de la página. Si lo cambias, cambiará la URL del venue en WeddingVenuesSpain.com.
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Región</label>
                    <select className="form-input" value={location} onChange={e => setLocation(e.target.value)} disabled={isLocked} style={{ borderColor: hasError('Región') ? ERR : undefined }}>
                      <option value="">Selecciona una región...</option>
                      {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Descripción corta</span>
                      <span style={{ fontSize: 11, fontWeight: 400, color: WC_COLORS(wcShort, 30) }}>{wcShort} / 30 palabras</span>
                    </label>
                    <div style={{ fontSize: 11, color: 'var(--stone)', marginBottom: 6, lineHeight: 1.6 }}>
                      <em>"A tranquil haven in the heart of Mallorca, surrounded by olive groves and the majestic Serra de Tramuntana, offering unmatched charm and serenity."</em>
                      <br />En pocas palabras, ¿cómo describirías tu venue? Evoca el lugar y la sensación.
                    </div>
                    <textarea className="form-textarea" style={{ minHeight: 100, borderColor: wcShort > 30 || hasError('Descripción corta') ? ERR : undefined }}
                      value={shortDesc} onChange={e => setShortDesc(e.target.value)}
                      placeholder="Máximo 30 palabras. Aparece debajo del nombre del venue."
                      disabled={isLocked} />
                    {wcShort > 30 && <FieldError msg="Supera las 30 palabras." />}
                  </div>

                </div>

                {/* Right column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Máximo nº de invitados</label>
                    <input className="form-input" type="number" min={0} value={capacity}
                      onChange={e => setCapacity(e.target.value)} placeholder="Ej: 200" disabled={isLocked}
                      style={{ borderColor: hasError('Nº de invitados') ? ERR : undefined }} />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Precio base del menú</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--warm-gray)', pointerEvents: 'none' }}>€</span>
                      <input className="form-input" style={{ paddingLeft: 30, borderColor: hasError('Starting price del menú') ? ERR : undefined }} type="number" min={0} value={menuPriceValue}
                        onChange={e => setMenuPriceValue(e.target.value)} placeholder="185.00" disabled={isLocked} />
                    </div>
                    {menuPriceValue && (
                      <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>
                        Precio base por comensal (IVA no incluido)
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Precio del venue</label>
                    {!isLocked && (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                        {(['auto', 'included', 'none'] as VenuePriceMode[]).map(m => (
                          <button key={m} type="button" onClick={() => setVenuePriceMode(m)} style={{
                            padding: '7px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid',
                            borderColor: venuePriceMode === m ? 'var(--charcoal)' : 'var(--ivory)',
                            background: venuePriceMode === m ? 'var(--charcoal)' : '#fff',
                            color: venuePriceMode === m ? '#fff' : 'var(--charcoal)',
                            fontWeight: venuePriceMode === m ? 500 : 400,
                          }}>
                            {m === 'auto' ? 'Precio ($/$$/$$$ automático)' : m === 'included' ? 'Incluido' : 'No mostrar'}
                          </button>
                        ))}
                      </div>
                    )}
                    {venuePriceMode === 'auto' && (
                      <>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--warm-gray)', pointerEvents: 'none' }}>€</span>
                          <input className="form-input" style={{ paddingLeft: 30, borderColor: hasError('Precio del venue') ? ERR : undefined }} type="number" min={0} value={venuePriceInput}
                            onChange={e => setVenuePriceInput(e.target.value)} placeholder="4,500.00" disabled={isLocked} />
                        </div>
                        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.8 }}>
                          <strong style={{ color: 'var(--gold)' }}>$</strong> hasta 4.000€ · <strong style={{ color: 'var(--gold)' }}>$$</strong> 4.000–8.000€ · <strong style={{ color: 'var(--gold)' }}>$$$</strong> más de 8.000€
                        </div>
                      </>
                    )}
                    {venuePriceMode === 'included' && <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 4 }}>Se mostrará como <strong>Included</strong>.</div>}
                    {venuePriceMode === 'none' && <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 4 }}>No se mostrará ningún precio de venue.</div>}
                  </div>
                </div>
              </div>

              {/* Hero + Consejo — siempre alineados */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 32, marginTop: 28 }}>
                {/* Imagen hero */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Imagen de fondo (hero)</label>
                  <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${hasError('Imagen hero') ? ERR : 'var(--ivory)'}`, background: 'var(--cream)' }}>
                    {(heroImage?.url || heroLocalPreview) ? (
                      <>
                        <img src={heroImage?.url || heroLocalPreview!} alt="Hero" style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
                        {uploadingHero && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>Subiendo...</span>
                          </div>
                        )}
                        {!isLocked && heroImage && !uploadingHero && (
                          <button onClick={() => { setHeroImage(null); setHeroLocalPreview(null) }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>
                        )}
                      </>
                    ) : (
                      <label style={{ height: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: isLocked ? 'default' : 'pointer' }}>
                        <Upload size={22} style={{ color: hasError('Imagen hero') ? ERR : 'var(--stone)' }} />
                        <span style={{ fontSize: 11, color: hasError('Imagen hero') ? ERR : 'var(--warm-gray)' }}>Sube la foto principal (16:9)</span>
                        {!isLocked && (
                          <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingHero}
                            onChange={e => {
                              const f = e.target.files?.[0]
                              if (!f) return
                              setCropState({
                                file: f,
                                aspect: 16 / 9,
                                onCrop: async (blob) => {
                                  setCropState(null)
                                  const localUrl = URL.createObjectURL(blob)
                                  setHeroLocalPreview(localUrl)
                                  const cropped = new File([blob], 'hero.webp', { type: 'image/webp' })
                                  uploadImage(cropped, img => { setHeroImage(img); URL.revokeObjectURL(localUrl); setHeroLocalPreview(null) }, setUploadingHero, 'Imagen hero', () => { URL.revokeObjectURL(localUrl); setHeroLocalPreview(null) })
                                },
                              })
                              e.target.value = ''
                            }} />
                        )}
                      </label>
                    )}
                  </div>
                  {!isLocked && heroImage && (
                    <label style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: 'var(--gold)', cursor: 'pointer', fontWeight: 500 }}>
                      Cambiar imagen
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingHero}
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (!f) return
                          setCropState({
                            file: f,
                            aspect: 16 / 9,
                            onCrop: async (blob) => {
                              setCropState(null)
                              const localUrl = URL.createObjectURL(blob)
                              setHeroLocalPreview(localUrl)
                              const cropped = new File([blob], 'hero.webp', { type: 'image/webp' })
                              uploadImage(cropped, img => { setHeroImage(img); URL.revokeObjectURL(localUrl); setHeroLocalPreview(null) }, setUploadingHero, 'Imagen hero', () => { URL.revokeObjectURL(localUrl); setHeroLocalPreview(null) })
                            },
                          })
                          e.target.value = ''
                        }} />
                    </label>
                  )}
                </div>

                {/* Consejo */}
                <div style={{ padding: '20px 22px', background: 'var(--cream)', borderRadius: 10, alignSelf: 'start' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, fontStyle: 'italic', color: 'var(--espresso)', marginBottom: 8 }}>Consejo</div>
                  <div style={{ fontSize: 12.5, color: 'var(--warm-gray)', lineHeight: 1.7 }}>
                    Los venues con imágenes de alta resolución y descripciones que evocan sentimientos tienen un 40% más de tasa de conversión. Asegúrate de que el "Starting Price" sea competitivo para tu región.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── DESCRIPCIÓN ─────────────────────────────────────────────── */}
          {activeTab === 'descripcion' && (
            <div className="card" style={{ border: '1px solid var(--ivory)', borderRadius: 12 }}>
              <div style={{ padding: '24px 28px 18px' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--espresso)', letterSpacing: '-0.01em' }}>Descripción del venue</div>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 4 }}>Textos que aparecen en tu ficha pública.</div>
              </div>
              <div style={{ padding: '0 28px 28px' }}>

                {/* Mini título */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Mini título</span>
                    <span style={{ fontSize: 11, fontWeight: 400, color: WC_COLORS(wcMini, 6) }}>{wcMini} / 6 palabras</span>
                  </label>
                  <input className="form-input" value={miniDesc}
                    onChange={e => setMiniDesc(e.target.value)}
                    style={{ borderColor: wcMini > 6 ? '#c0392b' : hasError('Mini título (H2)') ? ERR : undefined }}
                    placeholder="Ej: A Timeless Escape by the Mediterranean"
                    disabled={isLocked} />
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>Frase breve y evocadora que aparece como subtítulo destacado. Máximo 6 palabras.</div>
                  {wcMini > 6 && <FieldError msg="Máximo 6 palabras." />}
                </div>

                {/* Mini párrafo */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Mini párrafo</span>
                    <span style={{ fontSize: 11, fontWeight: 400, color: WC_COLORS(wcPara, 60) }}>{wcPara} / 60 palabras</span>
                  </label>
                  <textarea className="form-textarea" style={{ minHeight: 90, borderColor: wcPara > 60 ? '#c0392b' : hasError('Mini párrafo') ? ERR : undefined }}
                    value={miniParagraph} onChange={e => setMiniParagraph(e.target.value)}
                    placeholder="Unas pocas frases que amplíen el mini título. Ej: Perched on a hilltop overlooking the Mediterranean, Villa Rosa is a sanctuary of elegance and tranquility, where every detail has been thoughtfully designed to make your wedding day truly unforgettable."
                    disabled={isLocked} />
                  {wcPara > 60 && <FieldError msg="Máximo 60 palabras." />}
                </div>

                {/* Descripción completa */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Descripción completa</span>
                    <span style={{ fontSize: 11, fontWeight: 400, color: WC_COLORS(wcPost, 280) }}>{wcPost} / 280 palabras</span>
                  </label>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 8, lineHeight: 1.8, padding: '10px 12px', background: 'var(--cream)', borderRadius: 6 }}>
                    <strong>Descripción pintoresca.</strong> Estructura recomendada: <strong>3 títulos</strong> con <strong>3 párrafos</strong> (máximo 280 palabras total).<br />
                    Selecciona el texto y usa la barra para aplicar <strong>negrita</strong>, <em>cursiva</em>, subrayado o título H3.
                  </div>
                  <RichTextEditor
                    value={postContent}
                    onChange={setPostContent}
                    disabled={isLocked}
                    style={{ borderColor: wcPost > 280 ? '#c0392b' : hasError('Descripción completa') ? ERR : undefined }}
                  />
                  {wcPost > 280 && <FieldError msg={`Supera las 280 palabras (${wcPost - 280} de más).`} />}
                </div>

              </div>
            </div>
          )}

          {/* ── PRECIOS ──────────────────────────────────────────────────── */}
          {activeTab === 'precios' && (
            <div className="card" style={{ border: '1px solid var(--ivory)', borderRadius: 12 }}>
              <div style={{ padding: '24px 28px 18px' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--espresso)', letterSpacing: '-0.01em' }}>Precios</div>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 4 }}>Venue fee, catering y alojamiento.</div>
              </div>
              <div style={{ padding: '0 28px 28px' }}>

                <SectionTitle>Venue fee</SectionTitle>

                {/* Venue fee structured */}
                <div className="form-group">
                  <label className="form-label">Starting price</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                    {/* "Included in menu" toggle */}
                    <button type="button" onClick={() => setVenueFeeIncluded(!venueFeeIncluded)} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, fontSize: 12,
                      cursor: 'pointer', border: '1px solid', fontWeight: 500,
                      borderColor: venueFeeIncluded ? 'var(--gold)' : 'var(--ivory)',
                      background: venueFeeIncluded ? '#fef9ec' : 'transparent',
                      color: venueFeeIncluded ? 'var(--gold)' : 'var(--warm-gray)',
                    }} disabled={isLocked}>
                      {venueFeeIncluded ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      Included in menu
                    </button>
                    {!venueFeeIncluded && (
                      <>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--warm-gray)', pointerEvents: 'none' }}>From</span>
                          <input className="form-input" style={{ paddingLeft: 44, width: 160, borderColor: hasError('Venue fee (precio)') ? ERR : undefined }} type="number" min={0}
                            value={venueFeeValue} onChange={e => setVenueFeeValue(e.target.value)}
                            placeholder="36.600" disabled={isLocked} />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>€</span>
                        <select className="form-input" style={{ width: 180 }} value={venueFeeNights}
                          onChange={e => setVenueFeeNights(parseInt(e.target.value))} disabled={isLocked}>
                          <option value={0}>Sin noches incluidas</option>
                          <option value={1}>incl. 1 noche</option>
                          <option value={2}>incl. 2 noches</option>
                          <option value={3}>incl. 3 noches</option>
                          <option value={4}>incl. 4 noches</option>
                          <option value={5}>incl. 5 noches</option>
                        </select>
                      </>
                    )}
                  </div>
                  {buildVenueFee() && (
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)', padding: '6px 10px', background: 'var(--cream)', borderRadius: 6, display: 'inline-block' }}>
                      Se mostrará: <strong style={{ color: 'var(--espresso)' }}>{buildVenueFee()}</strong>
                    </div>
                  )}
                </div>

                {/* Zonas del espacio */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Zonas del espacio e incluye</span>
                    <span style={{ fontSize: 11, fontWeight: 400, color: WC_COLORS(wcBreak, 150) }}>{wcBreak} / 150 palabras</span>
                  </label>
                  <RichTextEditor value={breakdown1text} onChange={setBreakdown1text} disabled={isLocked} minHeight={110} compact />
                  {wcBreak > 150 && <FieldError msg={`Máximo 150 palabras (${wcBreak - 150} de más).`} />}
                </div>

                <Divider />
                <SectionTitle>Catering y bebidas</SectionTitle>

                <div className="form-group">
                  <label className="form-label">Starting price</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--warm-gray)', pointerEvents: 'none' }}>From</span>
                      <input className="form-input" style={{ paddingLeft: 44, width: 150, borderColor: hasError('Catering starting price') ? ERR : undefined }} type="number" min={0}
                        value={cateringFeeValue} onChange={e => setCateringFeeValue(e.target.value)}
                        placeholder="120" disabled={isLocked} />
                    </div>
                    <select className="form-input" style={{ width: 130 }} value={cateringFeeUnit}
                      onChange={e => setCateringFeeUnit(e.target.value as any)} disabled={isLocked}>
                      <option value="person">€/person</option>
                      <option value="day">€/day</option>
                      <option value="event">€/event</option>
                    </select>
                  </div>
                  {buildCateringFee() && (
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)', padding: '6px 10px', background: 'var(--cream)', borderRadius: 6, display: 'inline-block' }}>
                      Se mostrará: <strong style={{ color: 'var(--espresso)' }}>{buildCateringFee()}</strong>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Descripción del servicio</span>
                    <span style={{ fontSize: 11, fontWeight: 400, color: WC_COLORS(wcCat, 150) }}>{wcCat} / 150 palabras</span>
                  </label>
                  <RichTextEditor value={breakdown3text} onChange={setBreakdown3text} disabled={isLocked} minHeight={110} compact />
                  {wcCat > 150 && <FieldError msg={`Máximo 150 palabras (${wcCat - 150} de más).`} />}
                </div>

                <Divider />
                <SectionTitle>Alojamiento</SectionTitle>

                <div className="form-group">
                  <select className="form-input" style={{ borderColor: hasError('Alojamiento') ? ERR : undefined }} value={accommodation} onChange={e => setAccommodation(e.target.value)} disabled={isLocked}>
                    <option value="">Selecciona...</option>
                    <option value="yes">Incluido en el venue fee</option>
                    <option value="optional">Opcional / disponible aparte</option>
                    <option value="no">No incluido</option>
                  </select>
                </div>

                {accommodation === 'yes' && (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 8 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Nº de guests</label>
                      <input className="form-input" type="number" min={1} style={{ width: 120 }}
                        value={accomGuests} onChange={e => setAccomGuests(e.target.value)}
                        placeholder="50" disabled={isLocked} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Noches incluidas</label>
                      <input className="form-input" type="number" min={1} style={{ width: 120 }}
                        value={accomNights} onChange={e => setAccomNights(e.target.value)}
                        placeholder="2" disabled={isLocked} />
                    </div>
                  </div>
                )}

                {buildAccommodation() && (
                  <div style={{ fontSize: 12, color: 'var(--warm-gray)', padding: '6px 10px', background: 'var(--cream)', borderRadius: 6, display: 'inline-block', marginBottom: 12 }}>
                    Se mostrará: <strong style={{ color: 'var(--espresso)' }}>{buildAccommodation()}</strong>
                  </div>
                )}

                <div style={{ padding: '14px 16px', background: 'var(--cream)', border: '1px solid var(--ivory)', borderRadius: 8, marginTop: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>Gestión de alojamiento con StayForEvents</div>
                  <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.6, marginBottom: 10 }}>
                    A través de StayForEvents, tus clientes acceden a una selección de hoteles con condiciones preferentes. Nos encargamos de la gestión y tu venue puede generar ingresos mediante comisiones.
                  </div>
                  <a href="https://www.stayforevents.com" target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, fontWeight: 500, color: 'var(--gold)', textDecoration: 'none', borderBottom: '1px solid var(--gold)', paddingBottom: 1 }}>
                    Más información en stayforevents.com →
                  </a>
                </div>

              </div>
            </div>
          )}

          {/* ── UBICACIÓN ────────────────────────────────────────────────── */}
          {activeTab === 'ubicacion' && (
            <div className="card" style={{ border: '1px solid var(--ivory)', borderRadius: 12 }}>
              <div style={{ padding: '24px 28px 18px' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--espresso)', letterSpacing: '-0.01em' }}>Ubicación y acceso</div>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 4 }}>Dirección, lugares cercanos y aeropuerto.</div>
              </div>
              <div style={{ padding: '0 28px 28px' }}>

                <div className="form-group">
                  <label className="form-label">Ubicación específica</label>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 6, lineHeight: 1.7 }}>
                    Dirección y/o zona concreta. No solo la región general — indica el pueblo, municipio o área. <br />
                    <em>Ej: Camí de Son Grau, s/n, Puigpunyent, Mallorca · o · Sitges, Barcelona</em>
                  </div>
                  <textarea className="form-textarea" style={{ minHeight: 80, borderColor: hasError('Ubicación específica') ? ERR : undefined }} value={specificLocation}
                    onChange={e => setSpecificLocation(e.target.value)}
                    placeholder="Dirección completa o zona específica (pueblo, municipio...)"
                    disabled={isLocked} />
                </div>

                <div className="form-group">
                  <label className="form-label">3 lugares cercanos</label>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 6, lineHeight: 1.7 }}>
                    Nombre del lugar y minutos en coche. Ej: <em>Puerto de Palma – 22 min · Deià – 50 min · Alcúdia – 50 min</em>
                  </div>
                  <textarea className="form-textarea" style={{ minHeight: 80 }} value={placesNearby}
                    onChange={e => setPlacesNearby(e.target.value)}
                    placeholder={'Lugar 1 – XX min\nLugar 2 – XX min\nLugar 3 – XX min'}
                    disabled={isLocked} />
                </div>

                <div className="form-group">
                  <label className="form-label">Aeropuerto internacional más cercano</label>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 6 }}>
                    Ej: <em>Palma de Mallorca Airport (PMI) – 14 km – 15 min</em>
                  </div>
                  <input className="form-input" style={{ borderColor: hasError('Aeropuerto más cercano') ? ERR : undefined }} value={closestAirport}
                    onChange={e => setClosestAirport(e.target.value)}
                    placeholder="Nombre del aeropuerto – XX km – XX min"
                    disabled={isLocked} />
                </div>

              </div>
            </div>
          )}

          {/* ── FOTOS ────────────────────────────────────────────────────── */}
          {activeTab === 'fotos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Photo tip */}
              <div style={{ padding: '12px 16px', background: 'var(--cream)', border: '1px solid var(--ivory)', borderRadius: 10, fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.7 }}>
                Acepta JPG, PNG o WebP. Tras seleccionar la foto podrás <strong style={{ color: 'var(--charcoal)' }}>recortarla al ratio correcto</strong> antes de subirla.
              </div>

              {/* Foto vertical */}
              <div className="card" style={{ border: '1px solid var(--ivory)', borderRadius: 12 }}>
                <div style={{ padding: '24px 28px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--espresso)', letterSpacing: '-0.01em' }}>Foto vertical</div>
                  <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>800 × 1200 px · 2:3 · .webp</span>
                </div>
                <div style={{ padding: '0 28px 28px' }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    {verticalPhoto?.url ? (
                      <div style={{ position: 'relative', width: 120, height: 135, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                        <img src={verticalPhoto.url} alt="Vertical" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {!isLocked && <button onClick={() => setVerticalPhoto(null)} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} /></button>}
                      </div>
                    ) : (
                      <div style={{ width: 120, height: 135, borderRadius: 8, border: `2px dashed ${hasError('Foto vertical') ? ERR : 'var(--ivory)'}`, background: hasError('Foto vertical') ? '#fef2f2' : 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Upload size={20} style={{ color: 'var(--stone)' }} />
                        <span style={{ fontSize: 10, color: 'var(--warm-gray)', textAlign: 'center', padding: '0 8px' }}>Sin foto</span>
                      </div>
                    )}
                    {!isLocked && (
                      <div>
                        <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                          {uploadingVertical ? 'Subiendo...' : 'Subir foto'}
                          <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingVertical}
                            onChange={e => {
                              const f = e.target.files?.[0]
                              if (!f) return
                              setCropState({
                                file: f,
                                aspect: 8 / 9,
                                maxPx: 900,
                                quality: 0.82,
                                onCrop: async (blob) => {
                                  setCropState(null)
                                  // Show local preview immediately while uploading
                                  const localUrl = URL.createObjectURL(blob)
                                  setVerticalPhoto({ id: 0, url: localUrl })
                                  const cropped = new File([blob], 'vertical.webp', { type: 'image/webp' })
                                  uploadImage(cropped, img => { setVerticalPhoto(img); URL.revokeObjectURL(localUrl) }, setUploadingVertical, 'Foto vertical', () => { URL.revokeObjectURL(localUrl); setVerticalPhoto(null) })
                                },
                              })
                              e.target.value = ''
                            }} />
                        </label>
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 6, lineHeight: 1.6 }}>Ratio 8:9 · máx 400 KB · .webp<br />Aparece destacada junto a la descripción del venue.</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Galería */}
              <div className="card" style={{ border: '1px solid var(--ivory)', borderRadius: 12 }}>
                <div style={{ padding: '24px 28px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--espresso)', letterSpacing: '-0.01em' }}>Galería</div>
                  <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>8 fotos · 4:3 · .webp · Máx 2 MB</span>
                </div>
                <div style={{ padding: '0 28px 28px' }}>
                  {uploadingPhoto && <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--gold)' }}>{uploadMsg}</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                    {hGallery.map((photo, i) => (
                      <div key={i} style={{ aspectRatio: '4/3', borderRadius: 8, overflow: 'hidden', border: `2px dashed ${photo === null && hasError('Galería de fotos') ? ERR : 'var(--ivory)'}`, position: 'relative', background: 'var(--cream)' }}>
                        {photo ? (
                          <>
                            {photo.url && <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                            {!isLocked && (
                              <button onClick={() => { const g = [...hGallery]; g[i] = null; setHGallery(g) }}
                                style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 4, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={12} />
                              </button>
                            )}
                          </>
                        ) : !isLocked ? (
                          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', cursor: 'pointer', gap: 5 }}>
                            <Upload size={16} style={{ color: 'var(--stone)' }} />
                            <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Foto {i + 1}</span>
                            <input type="file" accept="image/*" style={{ display: 'none' }}
                              onChange={e => {
                                const f = e.target.files?.[0]
                                if (!f) return
                                const idx = i
                                setCropState({
                                  file: f,
                                  aspect: 4 / 3,
                                  onCrop: async (blob) => {
                                    setCropState(null)
                                    // Show local preview immediately while uploading
                                    const localUrl = URL.createObjectURL(blob)
                                    setHGallery(prev => { const g = [...prev]; g[idx] = { id: 0, url: localUrl }; return g })
                                    const cropped = new File([blob], `gallery_${idx + 1}.webp`, { type: 'image/webp' })
                                    uploadGalleryPhoto(cropped, idx, localUrl)
                                  },
                                })
                                e.target.value = ''
                              }} />
                          </label>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>Foto {i + 1}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ── RESEÑAS ──────────────────────────────────────────────────── */}
          {activeTab === 'resenas' && (
            <div className="card" style={{ border: '1px solid var(--ivory)', borderRadius: 12 }}>
              <div style={{ padding: '24px 28px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--espresso)', letterSpacing: '-0.01em' }}>Reseñas de parejas</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: reviewsEnabled ? 'var(--gold)' : 'var(--warm-gray)' }}>
                    {reviewsEnabled ? 'Activas' : 'Desactivadas'}
                  </span>
                  <button type="button" onClick={() => setReviewsEnabled(!reviewsEnabled)} disabled={isLocked}
                    style={{ background: 'none', border: 'none', cursor: isLocked ? 'default' : 'pointer', color: reviewsEnabled ? 'var(--gold)' : 'var(--stone)' }}>
                    {reviewsEnabled ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                  </button>
                </div>
              </div>
              <div style={{ padding: '0 28px 28px' }}>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 16, lineHeight: 1.7 }}>
                  {reviewsEnabled
                    ? <><strong style={{ color: 'var(--charcoal)' }}>Las 3 reseñas son obligatorias</strong> si las tienes activas. Si no quieres mostrarlas, desactívalas con el botón de arriba.</>
                    : 'Las reseñas están desactivadas. No aparecerán en la ficha pública. Actívalas si quieres añadirlas.'
                  }
                </div>
                {!reviewsEnabled && (
                  <div style={{ padding: '16px', background: 'var(--cream)', borderRadius: 8, fontSize: 13, color: 'var(--warm-gray)', textAlign: 'center', border: '1px solid var(--ivory)' }}>
                    Reseñas desactivadas — no se mostrarán en tu ficha pública.
                    <br />
                    <button
                      type="button"
                      style={{ marginTop: 10, fontSize: 12, color: 'var(--gold)', background: 'none', border: '1px solid var(--gold)', borderRadius: 6, cursor: 'pointer', padding: '5px 14px' }}
                      onClick={() => setReviewsEnabled(true)}
                    >
                      Activar reseñas
                    </button>
                  </div>
                )}
                {reviewsEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {reviews.map((rev, i) => (
                      <div key={i} style={{ padding: '18px', background: 'var(--cream)', borderRadius: 10, border: '1px solid var(--ivory)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 12 }}>
                          Reseña {i + 1}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Nombre de la pareja</label>
                            <input className="form-input" value={rev.couple_name}
                              onChange={e => { const r = [...reviews]; r[i] = { ...r[i], couple_name: e.target.value }; setReviews(r) }}
                              placeholder="Ej: Laura & Carlos" disabled={isLocked} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">País</label>
                            <input className="form-input" value={rev.country}
                              onChange={e => { const r = [...reviews]; r[i] = { ...r[i], country: e.target.value }; setReviews(r) }}
                              placeholder="Ej: España, UK, Germany..." disabled={isLocked} />
                          </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Reseña</label>
                          <textarea className="form-textarea" style={{ minHeight: 90 }} value={rev.text}
                            onChange={e => { const r = [...reviews]; r[i] = { ...r[i], text: e.target.value }; setReviews(r) }}
                            placeholder="Texto de la reseña de la pareja..."
                            disabled={isLocked} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom buttons */}
          {/* ── CONFIGURACIÓN ────────────────────────────────────────── */}
          {activeTab === 'config' && (
            <div className="card" style={{ border: '1px solid var(--ivory)', borderRadius: 12 }}>
              <div style={{ padding: '24px 28px 18px' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--espresso)', letterSpacing: '-0.01em' }}>Configuración</div>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 4 }}>Emails de contacto y ajustes de tu ficha.</div>
              </div>
              <div style={{ padding: '0 28px 28px' }}>

                <div className="form-group">
                  <label className="form-label">Emails para recibir consultas</label>
                  <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 8, lineHeight: 1.6 }}>
                    Introduce hasta <strong>2 emails</strong> separados por coma donde recibirás las consultas de tu página en Wedding Venues Spain.<br />
                    Ej: <em>reservas@tuvenue.com, info@tuvenue.com</em>
                  </div>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="email1@tuvenue.com, email2@tuvenue.com"
                    value={leadsEmail}
                    onChange={e => {
                      const parts = e.target.value.split(',')
                      if (parts.length <= 2) setLeadsEmail(e.target.value)
                    }}
                    style={{ maxWidth: 480 }}
                  />
                  {leadsEmail && (
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {leadsEmail.split(',').map((em, i) => em.trim() && (
                        <span key={i} style={{ fontSize: 12, background: 'var(--cream)', border: '1px solid var(--ivory)', borderRadius: 20, padding: '2px 10px', color: 'var(--charcoal)' }}>
                          {em.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {configMsg && (
                  <div style={{ fontSize: 13, color: configMsg.includes('✓') ? 'var(--gold)' : '#dc2626', marginBottom: 8 }}>
                    {configMsg}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button
                    className="btn btn-primary"
                    disabled={savingConfig || leadsEmail === leadsEmailSaved}
                    onClick={async () => {
                      setSavingConfig(true)
                      setConfigMsg('')
                      try {
                        const res = await fetch('/api/venues/save-config', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ leadsEmail }),
                        })
                        const data = await res.json()
                        if (!res.ok) { setConfigMsg(data.error || 'Error al guardar'); return }
                        setLeadsEmailSaved(leadsEmail)
                        setConfigMsg('Guardado correctamente ✓')
                        setTimeout(() => setConfigMsg(''), 3000)
                      } catch { setConfigMsg('Error de conexión') }
                      finally { setSavingConfig(false) }
                    }}
                  >
                    {savingConfig ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={savingConfig || leadsEmail === leadsEmailSaved}
                    onClick={() => setLeadsEmail(leadsEmailSaved)}
                  >
                    Cancelar
                  </button>
                </div>

              </div>
            </div>
          )}

          {activeTab !== 'config' && (
            <div style={{ position: 'fixed', bottom: 0, left: 'var(--sidebar-w)', right: 0, display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 28px', borderTop: '1px solid var(--ivory)', background: '#fff', zIndex: 40, alignItems: 'center' }}>
              {/* Indicadores de estado (solo cuando no hay cambios sin guardar) */}
              {!isDirty && changesPending && (
                <span style={{ fontSize: 11, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={11} /> Cambios en revisión — edita para reenviar corregido
                </span>
              )}
              {!isDirty && !changesPending && (isApproved ? (changesStatus === 'draft' && !!onboarding?.changes_data) : (mainStatus === 'draft' && !!onboarding?.ficha_data)) && (
                <span style={{ fontSize: 11, color: '#92400e', background: '#fef9ec', border: '1px solid #fde68a', borderRadius: 6, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={11} /> Tienes cambios guardados sin enviar
                </span>
              )}
              <button className="btn btn-ghost" onClick={saveDraft} disabled={saving || !isDirty}>
                {saving ? 'Guardando...' : 'Guardar borrador'}
              </button>
              {(() => {
                // El botón solo se activa cuando el usuario ha editado algo (isDirty).
                // Así permanece apagado al abrir la ficha y se ilumina al primer cambio.
                const canSubmit = isDirty
                const isResend  = changesPending || (!isApproved && mainStatus === 'submitted')
                const btnLabel  = submitting
                  ? 'Enviando...'
                  : isResend
                    ? (isApproved ? 'Actualizar y reenviar cambios' : 'Actualizar y reenviar')
                    : (isApproved ? 'Enviar cambios para revisión' : 'Enviar para revisión')
                return (
                  <button className="btn btn-primary" onClick={handleSubmitClick} disabled={submitting || !canSubmit}
                    style={{ opacity: !canSubmit && !submitting ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                    {btnLabel}
                  </button>
                )
              })()}
            </div>
          )}

        </div>
      </div>

      {/* ── Toast notification ────────────────────────────────── */}
      {(success || error) && (
        <div style={{
          position: 'fixed', bottom: 80, right: 28, zIndex: 5000,
          padding: '12px 20px', borderRadius: 10,
          background: success ? '#15803d' : '#dc2626',
          color: '#fff', fontSize: 13, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          display: 'flex', alignItems: 'center', gap: 8,
          animation: 'toast-in 0.25s ease-out',
        }}>
          {success || error}
        </div>
      )}

      {/* ── Unsaved-changes navigation warning ──────────────────── */}
      {pendingNav && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', position: 'relative' }}>
            <button onClick={() => setPendingNav(null)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}>
              <X size={18} />
            </button>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--espresso)', marginBottom: 6 }}>Cambios sin guardar</div>
            <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 24, lineHeight: 1.6 }}>
              Tienes cambios que no has guardado todavía.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                onClick={() => { const dest = pendingNav; setPendingNav(null); setIsDirty(false); setDirtyTabs(new Set()); router.push(dest) }}
              >
                Descartar cambios
              </button>
              <button
                className="btn btn-primary"
                disabled={saving}
                onClick={async () => {
                  const saved = await saveDraft()
                  if (saved) { const dest = pendingNav; setPendingNav(null); setIsDirty(false); setDirtyTabs(new Set()); router.push(dest) }
                }}
              >
                {saving ? 'Guardando...' : 'Guardar y continuar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crop modal */}
      {cropState && (
        <CropModal
          file={cropState.file}
          aspect={cropState.aspect}
          onCrop={cropState.onCrop}
          onClose={() => setCropState(null)}
          maxPx={cropState.maxPx}
          quality={cropState.quality}
        />
      )}

      {/* Confirm modal */}
      {confirmSubmit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setConfirmSubmit(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 600, color: 'var(--espresso)', marginBottom: 12 }}>
              {isApproved ? '¿Enviar cambios para revisión?' : '¿Enviar ficha para revisión?'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.8, marginBottom: 24 }}>
              {isApproved
                ? 'Los cambios se enviarán a nuestro equipo. La versión actual seguirá publicada hasta que los aprobemos.'
                : 'Una vez enviada, no podrás editar hasta que nuestro equipo te notifique. Asegúrate de que todo es correcto.'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmSubmit(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={submitting} onClick={() => { setConfirmSubmit(false); submitForReview() }}>
                <Send size={13} /> {submitting ? 'Enviando...' : 'Sí, enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── CropModal ─────────────────────────────────────────────────────────────────
// Approach: show full image (scaled to fit screen), overlay a draggable crop frame
// with the fixed aspect ratio. The IMAGE is static; the FRAME moves.

function CropModal({ file, aspect, onCrop, onClose, maxPx = 3000, quality = 0.92 }: {
  file: File
  aspect: number   // width / height  (8/9 vertical · 16/9 hero · 4/3 gallery)
  onCrop: (blob: Blob) => void
  onClose: () => void
  maxPx?: number   // max dimension in px (default 3000)
  quality?: number // webp quality 0-1 (default 0.92)
}) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const [imgSrc]      = useState(() => URL.createObjectURL(file))
  const [imgEl,  setImgEl]  = useState<HTMLImageElement | null>(null)
  const [dispW,  setDispW]  = useState(0)   // image display dimensions (px on screen)
  const [dispH,  setDispH]  = useState(0)
  const [dispScale, setDispScale] = useState(1) // original → display ratio
  const [frameX, setFrameX] = useState(0)  // crop-frame top-left in display px
  const [frameY, setFrameY] = useState(0)
  const [frameW, setFrameW] = useState(0)  // crop-frame size in display px
  const [frameH, setFrameH] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({ mx: 0, my: 0, fx: 0, fy: 0 })

  useEffect(() => () => URL.revokeObjectURL(imgSrc), [imgSrc])

  // After image loads: compute display size and initial frame
  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setImgEl(img)

    // Scale image to fit available viewport (max 600×520, never upscale)
    const maxW = Math.min(img.naturalWidth, 600, window.innerWidth  - 80)
    const maxH = Math.min(img.naturalHeight, 520, window.innerHeight - 200)
    const sc   = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
    const dW   = Math.round(img.naturalWidth  * sc)
    const dH   = Math.round(img.naturalHeight * sc)
    setDispW(dW); setDispH(dH); setDispScale(sc)

    // Initial frame: as large as possible while fitting in the display area
    let fW = dW
    let fH = Math.round(fW / aspect)
    if (fH > dH) { fH = dH; fW = Math.round(fH * aspect) }
    setFrameW(fW); setFrameH(fH)
    setFrameX(Math.round((dW - fW) / 2))
    setFrameY(Math.round((dH - fH) / 2))
  }

  // Clamp frame position so it stays inside the image
  const clampFrame = (x: number, y: number, fw: number, fh: number) => ({
    x: Math.max(0, Math.min(dispW - fw, x)),
    y: Math.max(0, Math.min(dispH - fh, y)),
  })

  // Drag handlers (relative to container top-left)
  const getLocal = (clientX: number, clientY: number) => {
    const r = containerRef.current!.getBoundingClientRect()
    return { lx: clientX - r.left, ly: clientY - r.top }
  }
  const onPointerDown = (clientX: number, clientY: number) => {
    const { lx, ly } = getLocal(clientX, clientY)
    // Only start drag if click is inside the crop frame
    if (lx >= frameX && lx <= frameX + frameW && ly >= frameY && ly <= frameY + frameH) {
      setDragging(true)
      dragRef.current = { mx: lx, my: ly, fx: frameX, fy: frameY }
    }
  }
  const onPointerMove = (clientX: number, clientY: number) => {
    if (!dragging) return
    const { lx, ly } = getLocal(clientX, clientY)
    const { x, y } = clampFrame(
      dragRef.current.fx + lx - dragRef.current.mx,
      dragRef.current.fy + ly - dragRef.current.my,
      frameW, frameH,
    )
    setFrameX(x); setFrameY(y)
  }

  // Resize frame from slider (keeps aspect, re-centers if needed)
  const handleSize = (pct: number) => {
    // pct = 10..100 % of max possible frame
    let fW = Math.round(dispW * pct / 100)
    let fH = Math.round(fW / aspect)
    if (fH > dispH) { fH = dispH; fW = Math.round(fH * aspect) }
    setFrameW(fW); setFrameH(fH)
    setFrameX(fx => Math.max(0, Math.min(dispW - fW, fx)))
    setFrameY(fy => Math.max(0, Math.min(dispH - fH, fy)))
  }

  // Export: draw the selected region from the original image
  const handleCrop = () => {
    if (!imgEl) return
    const srcX = frameX / dispScale
    const srcY = frameY / dispScale
    const srcW = frameW / dispScale
    const srcH = frameH / dispScale
    let outW = srcW, outH = srcH
    if (outW > maxPx) { outH = Math.round(outH * maxPx / outW); outW = maxPx }
    if (outH > maxPx) { outW = Math.round(outW * maxPx / outH); outH = maxPx }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(outW); canvas.height = Math.round(outH)
    canvas.getContext('2d')!.drawImage(imgEl, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => { if (blob) onCrop(blob) }, 'image/webp', quality)
  }

  const sizePct = dispW > 0 ? Math.round((frameW / dispW) * 100) : 100

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px 24px', maxWidth: '95vw', width: dispW ? dispW + 48 : 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 600, color: 'var(--espresso)', marginBottom: 2 }}>Ajustar recorte</div>
        <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 12 }}>Arrastra el recuadro para seleccionar el área · usa el slider para cambiar el tamaño</div>

        {/* Image + crop overlay */}
        <div
          ref={containerRef}
          style={{ position: 'relative', width: dispW || 'auto', height: dispH || 'auto', borderRadius: 8, overflow: 'hidden', background: '#000', cursor: dragging ? 'move' : 'default', touchAction: 'none', userSelect: 'none' }}
          onMouseDown={e  => onPointerDown(e.clientX, e.clientY)}
          onMouseMove={e  => onPointerMove(e.clientX, e.clientY)}
          onMouseUp={()   => setDragging(false)}
          onMouseLeave={() => setDragging(false)}
          onTouchStart={e => { const t = e.touches[0]; onPointerDown(t.clientX, t.clientY) }}
          onTouchMove={e  => { e.preventDefault(); const t = e.touches[0]; onPointerMove(t.clientX, t.clientY) }}
          onTouchEnd={()  => setDragging(false)}
        >
          {/* Full image */}
          <img src={imgSrc} onLoad={handleLoad} alt=""
            style={{ display: 'block', width: dispW || 'auto', height: dispH || 'auto', pointerEvents: 'none' }} />

          {imgEl && dispW > 0 && (
            <>
              {/* 4 dimmed masks outside the crop frame */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {/* top */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: frameY, background: 'rgba(0,0,0,0.55)' }} />
                {/* bottom */}
                <div style={{ position: 'absolute', top: frameY + frameH, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)' }} />
                {/* left */}
                <div style={{ position: 'absolute', top: frameY, left: 0, width: frameX, height: frameH, background: 'rgba(0,0,0,0.55)' }} />
                {/* right */}
                <div style={{ position: 'absolute', top: frameY, left: frameX + frameW, right: 0, height: frameH, background: 'rgba(0,0,0,0.55)' }} />
              </div>

              {/* Crop frame border + rule-of-thirds grid */}
              <div style={{ position: 'absolute', left: frameX, top: frameY, width: frameW, height: frameH, boxSizing: 'border-box', border: '2px solid rgba(255,255,255,0.95)', pointerEvents: 'none' }}>
                {/* thirds lines */}
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.35) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.35) 1px,transparent 1px)', backgroundSize: `${Math.round(frameW/3)}px ${Math.round(frameH/3)}px` }} />
                {/* corner handles */}
                {([{t:0,l:0},{t:0,r:0},{b:0,l:0},{b:0,r:0}] as any[]).map((pos, i) => (
                  <div key={i} style={{ position:'absolute', width:18, height:18, ...pos,
                    borderTop:    (pos.t===0) ? '3px solid #fff' : undefined,
                    borderBottom: (pos.b===0) ? '3px solid #fff' : undefined,
                    borderLeft:   (pos.l===0) ? '3px solid #fff' : undefined,
                    borderRight:  (pos.r===0) ? '3px solid #fff' : undefined,
                  }} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Size slider */}
        {imgEl && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--warm-gray)', flexShrink: 0 }}>Tamaño</span>
            <input type="range" min={20} max={100} value={sizePct}
              onChange={e => handleSize(parseInt(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--gold)' }} />
            <span style={{ fontSize: 11, color: 'var(--warm-gray)', minWidth: 36, flexShrink: 0 }}>{sizePct}%</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleCrop} disabled={!imgEl}>Recortar y subir</button>
        </div>
      </div>
    </div>
  )
}

// ── RichTextEditor ────────────────────────────────────────────────────────────

function RichTextEditor({ value, onChange, disabled, style, minHeight = 300, compact = false }: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  style?: React.CSSProperties
  minHeight?: number
  compact?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Populate on first mount (tab switch remounts, so this catches every time)
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = DOMPurify.sanitize(value, { ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'h3', 'ul', 'ol', 'li'], ALLOWED_ATTR: [] })
  }, []) // eslint-disable-line

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, val)
    onChange(ref.current?.innerHTML || '')
  }

  const Btn = ({ label, cmd, val, title }: { label: React.ReactNode; cmd: string; val?: string; title?: string }) => (
    <button type="button" title={title || cmd}
      onMouseDown={e => { e.preventDefault(); exec(cmd, val) }}
      style={{ padding: '3px 8px', border: '1px solid var(--ivory)', borderRadius: 4, background: 'transparent', cursor: 'pointer', fontSize: 13, lineHeight: 1.2, color: 'var(--charcoal)' }}>
      {label}
    </button>
  )

  return (
    <div style={{ border: '1px solid var(--ivory)', borderRadius: 8, overflow: 'hidden', ...(style || {}) }}>
      {!disabled && (
        <div style={{ display: 'flex', gap: 4, padding: '6px 10px', background: 'var(--cream)', borderBottom: '1px solid var(--ivory)', flexWrap: 'wrap', alignItems: 'center' }}>
          <Btn label={<b>B</b>}  cmd="bold"        title="Negrita (Ctrl+B)" />
          {!compact && <Btn label={<i>I</i>}  cmd="italic"      title="Cursiva (Ctrl+I)" />}
          {!compact && <Btn label={<u>U</u>}  cmd="underline"   title="Subrayado (Ctrl+U)" />}
          <div style={{ width: 1, height: 18, background: 'var(--ivory)', margin: '0 2px' }} />
          <button type="button" title="Bullet points"
            onMouseDown={e => {
              e.preventDefault()
              ref.current?.focus()
              document.execCommand('insertUnorderedList', false)
              if (!ref.current?.querySelector('ul')) {
                document.execCommand('insertHTML', false, '<ul><li></li></ul>')
              }
              onChange(ref.current?.innerHTML || '')
            }}
            style={{ padding: '3px 8px', border: '1px solid var(--ivory)', borderRadius: 4, background: 'transparent', cursor: 'pointer', fontSize: 13, lineHeight: 1.2, color: 'var(--charcoal)' }}>
            <span style={{ fontSize: 12 }}>• Lista</span>
          </button>
          {!compact && (
            <>
              <div style={{ width: 1, height: 18, background: 'var(--ivory)', margin: '0 2px' }} />
              <Btn label={<span style={{ fontWeight: 700, fontSize: 11 }}>H3</span>} cmd="formatBlock" val="h3" title="Título (H3)" />
              <Btn label={<span style={{ fontSize: 11 }}>¶</span>}                  cmd="formatBlock" val="p"  title="Párrafo" />
            </>
          )}
        </div>
      )}
      <div ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML || '')}
        style={{ padding: '12px 14px', minHeight, outline: 'none', fontSize: 13, lineHeight: 1.9, color: 'var(--charcoal)', overflowY: 'auto' }}
      />
    </div>
  )
}

// ── Helpers components ────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--espresso)', marginBottom: 16, marginTop: 4, letterSpacing: '-0.01em' }}>{children}</div>
}
function Divider() {
  return <div style={{ borderTop: '1px solid var(--ivory)', margin: '28px 0' }} />
}
function FieldError({ msg }: { msg: string }) {
  return <div style={{ fontSize: 11, color: '#c0392b', marginTop: 4 }}>{msg}</div>
}
function StatusBanner({ type, title, body }: { type: 'pending' | 'error'; title: string; body: string }) {
  const isPending = type === 'pending'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 20px', background: isPending ? '#fef9ec' : '#fef2f2', border: `1px solid ${isPending ? '#f0d070' : '#fca5a5'}`, borderRadius: 10, marginBottom: 20 }}>
      {isPending ? <Clock size={18} style={{ color: '#d4a017', flexShrink: 0 }} /> : <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />}
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, color: isPending ? '#7a5c00' : '#991b1b' }}>{title}</div>
        {body && <div style={{ fontSize: 12, color: isPending ? '#9a7a20' : '#b91c1c', marginTop: 2 }}>{body}</div>}
      </div>
    </div>
  )
}

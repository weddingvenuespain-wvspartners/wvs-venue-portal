'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Custom elegant pin SVG — gold/warm style
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
  <defs>
    <filter id="ds" x="-20%" y="-10%" width="140%" height="130%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000" flood-opacity=".22"/>
    </filter>
    <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#C4944A"/>
      <stop offset="100%" stop-color="#9A6F35"/>
    </linearGradient>
  </defs>
  <path filter="url(#ds)" fill="url(#pg)" d="M18 0C8.06 0 0 7.84 0 17.5 0 30.62 18 48 18 48s18-17.38 18-30.5C36 7.84 27.94 0 18 0z"/>
  <circle cx="18" cy="17" r="6.5" fill="#fff" opacity=".92"/>
  <circle cx="18" cy="17" r="3" fill="#C4944A"/>
</svg>`

const PIN_ICON = typeof window !== 'undefined' ? L.divIcon({
  html: PIN_SVG,
  className: '',
  iconSize: [36, 48],
  iconAnchor: [18, 48],
  popupAnchor: [0, -48],
}) : null

interface VenueMapProps {
  address: string
  lat?: number
  lng?: number
  lightMode?: boolean
  height?: number
  borderRadius?: number
}

export default function VenueMap({ address, lat, lng, lightMode = true, height = 400, borderRadius = 16 }: VenueMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // If we already have coords, init map immediately
    if (lat != null && lng != null) {
      initMap(lat, lng)
      return
    }

    // Geocode address using free Nominatim
    if (!address) return
    const ctrl = new AbortController()
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'WVS-VenuePortal/1.0' }
    })
      .then(r => r.json())
      .then(data => {
        if (data?.[0]) {
          initMap(parseFloat(data[0].lat), parseFloat(data[0].lon))
        }
      })
      .catch(() => {})

    return () => { ctrl.abort(); destroyMap() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, lat, lng])

  function initMap(latitude: number, longitude: number) {
    destroyMap()
    if (!containerRef.current) return

    const map = L.map(containerRef.current, {
      center: [latitude, longitude],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
    })

    // Elegant grayscale tiles — CartoDB Positron (free, no key)
    const tileUrl = lightMode
      ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

    L.tileLayer(tileUrl, {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    // Add custom pin
    if (PIN_ICON) {
      L.marker([latitude, longitude], { icon: PIN_ICON }).addTo(map)
    }

    // Add subtle attribution
    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" style="color:inherit;opacity:.5">OpenStreetMap</a>')
      .addTo(map)

    mapRef.current = map

    // Force resize after mount
    setTimeout(() => map.invalidateSize(), 100)
  }

  function destroyMap() {
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }
  }

  useEffect(() => () => destroyMap(), [])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height,
        borderRadius,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 0,
      }}
    />
  )
}

'use client'
import { useState, useEffect, useRef } from 'react'
import type { SpaceGroup } from '@/lib/proposal-types'

export type SpaceSelection = { group_name: string; space_name: string }

type Props = {
  groups: SpaceGroup[]
  primary: string
  onPrimary: string
  dark?: boolean
  font?: string
  guestCount?: number
  onSelectionChange?: (selections: SpaceSelection[]) => void
  preview?: boolean
}

type ZoneModalState = {
  space: SpaceGroup['spaces'][0]
  gi: number
  si: number
  mode: string
  pricingMode: string
  interactive: boolean
  included: boolean
  max?: number
}

type PriceTier = { label: string; max_guests?: number; price: string }

function fmtEur(price: string) {
  const trimmed = price.trim()
  const isSupp = trimmed.startsWith('+')
  const raw = isSupp ? trimmed.slice(1) : trimmed
  const n = parseFloat(raw.replace('€', ''))
  if (isNaN(n)) return trimmed
  return `${isSupp ? '+' : ''}${n.toLocaleString('es-ES')}€`
}

function resolvePrice(
  space: { price?: string; price_tiers?: PriceTier[] },
  pricingMode: string,
  pricingDisplay: string | undefined,
  guestCount: number | undefined,
): string | null {
  const tiers = space.price_tiers
  if (tiers && tiers.length > 0) {
    if ((pricingDisplay ?? 'tiers_table') === 'by_guest_count' && guestCount) {
      const match = [...tiers].sort((a, b) => (a.max_guests ?? Infinity) - (b.max_guests ?? Infinity))
        .find(t => t.max_guests === undefined || guestCount <= t.max_guests)
      return match ? fmtEur(match.price) : fmtEur(tiers[tiers.length - 1].price)
    }
    return null // tiers_table: rendered separately
  }
  if (!space.price) return null
  if (pricingMode === 'group_base') { const t = space.price.trim(); return fmtEur(t.startsWith('+') ? t : `+${t}`) }
  return fmtEur(space.price)
}

function capacityOk(space: { capacity_min?: number; capacity_max?: number }, guests?: number): boolean {
  if (!guests) return true
  if (space.capacity_min && guests < space.capacity_min) return false
  if (space.capacity_max && guests > space.capacity_max) return false
  return true
}

function PhotoPlaceholder({ name, primary, dark, height = 160 }: { name: string; primary: string; dark: boolean; height?: number }) {
  const initial = name.trim()[0]?.toUpperCase() ?? '?'
  return (
    <div style={{
      width: '100%', height, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: dark ? `${primary}18` : `${primary}0d`,
      borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'}`,
    }}>
      <span style={{ fontSize: height > 200 ? '3rem' : '2rem', fontWeight: 300, color: primary, opacity: 0.4 }}>{initial}</span>
    </div>
  )
}

export default function SpaceGroupSelector({ groups, primary, onPrimary, dark = false, font, guestCount, onSelectionChange, preview }: Props) {
  const [singleSel, setSingleSel] = useState<Record<number, number>>({})
  const [multiSel,  setMultiSel]  = useState<Record<number, Set<number>>>({})
  const [optIn,     setOptIn]     = useState<Record<number, boolean | null>>({})
  const [modal,     setModal]     = useState<ZoneModalState | null>(null)
  const [isMobile,  setIsMobile]  = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const textColor  = dark ? 'rgba(255,255,255,.88)' : '#1e1e1e'
  const subColor   = dark ? 'rgba(255,255,255,.42)' : '#7a7264'
  const cardBg     = dark ? 'rgba(255,255,255,.04)' : '#ffffff'
  const cardBorder = dark ? 'rgba(255,255,255,.1)'  : '#e4ddd3'
  const secBg      = dark ? '#0c0c0c'               : '#f9f7f4'
  const divider    = dark ? 'rgba(255,255,255,.07)'  : '#ede8e0'
  const modalBg    = dark ? '#1a1814'               : '#ffffff'

  const resolveMode = (g: SpaceGroup) =>
    g.selection_mode ?? (g.requires_selection === false ? 'optional' : 'pick_one')

  const notifyChange = (ns: Record<number, number>, nm: Record<number, Set<number>>) => {
    if (!onSelectionChange) return
    const result: SpaceSelection[] = []
    groups.forEach((group, gi) => {
      const mode = resolveMode(group)
      const includedIds = new Set(group.included_zone_ids ?? [])
      if (mode === 'none') return
      if (mode === 'included_then_pick') {
        group.spaces.filter(s => includedIds.has(s.zone_id ?? s.id ?? ''))
          .forEach(s => result.push({ group_name: group.name, space_name: s.name }))
        const sel = nm[gi]
        if (sel) sel.forEach(si => {
          const sp = group.spaces[si]
          if (sp && !includedIds.has(sp.zone_id ?? sp.id ?? ''))
            result.push({ group_name: group.name, space_name: sp.name })
        })
        return
      }
      if (mode === 'pick_one') {
        const si = ns[gi]
        if (si !== undefined && si >= 0 && group.spaces[si])
          result.push({ group_name: group.name, space_name: group.spaces[si].name })
      } else {
        const sel = nm[gi]
        if (sel) sel.forEach(si => { if (group.spaces[si]) result.push({ group_name: group.name, space_name: group.spaces[si].name }) })
      }
    })
    onSelectionChange(result)
  }

  const isSpaceSelected = (gi: number, si: number, mode: string) =>
    mode === 'pick_one' ? singleSel[gi] === si : multiSel[gi]?.has(si) ?? false

  const toggleSpace = (gi: number, si: number, mode: string, max?: number) => {
    if (mode === 'pick_one') {
      const next = { ...singleSel, [gi]: singleSel[gi] === si ? -1 : si }
      setSingleSel(next); notifyChange(next, multiSel)
      return
    }
    setMultiSel(s => {
      const cur = new Set(s[gi] ?? [])
      if (cur.has(si)) cur.delete(si)
      else {
        if (max && cur.size >= max) { const first = cur.values().next().value; if (first !== undefined) cur.delete(first) }
        cur.add(si)
      }
      const next = { ...s, [gi]: cur }
      notifyChange(singleSel, next)
      return next
    })
  }

  const priceOf = (space: SpaceGroup['spaces'][0], pricingMode: string, pricingDisplay?: string): string | null => {
    const resolved = resolvePrice(space, pricingMode, pricingDisplay, guestCount)
    if (resolved) return resolved
    if (!space.price_tiers?.length) return preview ? 'Consulta precio' : null
    return null
  }

  const openModal = (m: ZoneModalState) => setModal(m)
  const closeModal = () => setModal(null)

const sliderCard: React.CSSProperties = isMobile ? { minWidth: 240, maxWidth: 240, scrollSnapAlign: 'start' } : {}

  // ── Card slider wrapper (mobile: arrows + hidden scrollbar) ─────────────────
  const CardSlider = ({ children, minW = 220 }: { children: React.ReactNode; minW?: number }) => {
    const scrollRef = useRef<HTMLDivElement>(null)
    const step = (minW + 12)
    const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * step, behavior: 'smooth' })

    if (!isMobile) return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minW}px, 1fr))`, gap: 14 }}>
        {children}
      </div>
    )

    return (
      <div style={{ position: 'relative' }}>
        {/* Prev */}
        <button type="button" onClick={() => scroll(-1)} style={{ position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)', zIndex: 2, width: 32, height: 32, borderRadius: '50%', background: dark ? 'rgba(30,28,24,.85)' : 'rgba(255,255,255,.92)', border: `1px solid ${cardBorder}`, color: textColor, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.15)', backdropFilter: 'blur(4px)' }}>‹</button>
        {/* Scrollable track */}
        <div ref={scrollRef} style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' as any, scrollbarWidth: 'none', msOverflowStyle: 'none' as any, paddingBottom: 2 }}>
          {children}
        </div>
        {/* Next */}
        <button type="button" onClick={() => scroll(1)} style={{ position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)', zIndex: 2, width: 32, height: 32, borderRadius: '50%', background: dark ? 'rgba(30,28,24,.85)' : 'rgba(255,255,255,.92)', border: `1px solid ${cardBorder}`, color: textColor, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.15)', backdropFilter: 'blur(4px)' }}>›</button>
      </div>
    )
  }

  // ── Zone detail modal ───────────────────────────────────────────────────────
  const ZoneModal = () => {
    if (!modal) return null
    const { space, gi, si, mode, pricingMode, interactive, included, max } = modal
    const groupName  = groups[gi]?.name
    const isSelected = isSpaceSelected(gi, si, mode)
    const inRange    = capacityOk(space, guestCount)
    const price      = priceOf(space, pricingMode, groups[gi]?.pricing_display)
    const tierTable  = (!price && (space.price_tiers ?? []).length > 0 && (groups[gi]?.pricing_display ?? 'tiers_table') === 'tiers_table') ? space.price_tiers! : null
    const curSel     = mode === 'pick_one' ? (singleSel[gi] !== undefined && singleSel[gi] >= 0 ? 1 : 0) : (multiSel[gi]?.size ?? 0)
    const atMax      = max !== undefined && curSel >= max && !isSelected

    const handleSelect = () => { toggleSpace(gi, si, mode, max); closeModal() }

    return (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : '20px' }}
        onMouseDown={e => { if (e.target === e.currentTarget) closeModal() }}
      >
        {/* Backdrop */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }} onClick={closeModal} />

        {/* Modal panel — bottom sheet on mobile, centered on desktop */}
        <div style={{
          position: 'relative', background: modalBg,
          borderRadius: isMobile ? '20px 20px 0 0' : 20,
          width: '100%', maxWidth: 560, maxHeight: '92vh',
          overflow: 'auto', boxShadow: '0 -8px 48px rgba(0,0,0,.3)',
          display: 'flex', flexDirection: 'column',
          margin: '0 auto',
        }}>
          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: dark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.12)' }} />
          </div>

          {/* Photo / gradient placeholder */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {space.photo_url
              ? <img src={space.photo_url} alt={space.name} style={{ width: '100%', height: 240, objectFit: 'cover', display: 'block' }} />
              : (
                <div style={{
                  height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `linear-gradient(135deg, ${primary}22 0%, ${primary}08 100%)`,
                  borderBottom: `1px solid ${primary}18`,
                }}>
                  <span style={{ fontSize: '4rem', fontWeight: 200, color: primary, opacity: 0.25, fontFamily: font }}>
                    {space.name.trim()[0]?.toUpperCase()}
                  </span>
                </div>
              )
            }
            {/* Close button */}
            <button
              type="button" onClick={closeModal}
              style={{
                position: 'absolute', top: 12, right: 12,
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(0,0,0,.4)', border: 'none', color: '#fff',
                fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}
              aria-label="Cerrar"
            >✕</button>
          </div>

          {/* Content */}
          <div style={{ padding: '24px 28px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Group context */}
            {groupName && (
              <span style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: primary, opacity: 0.7 }}>
                {groupName}
              </span>
            )}

            {/* Recommended badge */}
            {space.recommended && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 999, background: dark ? 'rgba(161,117,34,.18)' : '#fef3c7', border: '1px solid rgba(161,117,34,.4)', alignSelf: 'flex-start' }}>
                <svg viewBox="0 0 10 10" width={10} height={10} fill="none"><path d="M5 1l1.2 2.5L9 4.1 7 6l.5 3L5 7.8 2.5 9 3 6 1 4.1l2.8-.6z" stroke="#a17522" strokeWidth="1.4" strokeLinejoin="round"/></svg>
                <span style={{ fontSize: '.68rem', fontWeight: 700, color: '#a17522', letterSpacing: '.05em' }}>Recomendado para vosotros</span>
              </div>
            )}

            {/* Name + price row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: textColor, fontFamily: font, lineHeight: 1.2, flex: 1 }}>
                {space.name}
              </h3>
              {price && (
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: primary, flexShrink: 0 }}>{price}</span>
              )}
            </div>

            {/* Tier pricing table */}
            {tierTable && (
              <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${dark ? 'rgba(255,255,255,.08)' : '#e8e0d4'}` }}>
                {tierTable.map((t, ti) => (
                  <div key={ti} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: ti % 2 === 0 ? (dark ? 'rgba(255,255,255,.03)' : '#faf8f5') : 'transparent', borderTop: ti > 0 ? `1px solid ${dark ? 'rgba(255,255,255,.05)' : '#f0ebe3'}` : 'none' }}>
                    <span style={{ fontSize: '.82rem', color: subColor }}>{t.label}</span>
                    <span style={{ fontSize: '.9rem', fontWeight: 700, color: primary }}>{fmtEur(t.price)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Capacity */}
            {(space.capacity_min || space.capacity_max) && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: dark ? 'rgba(255,255,255,.05)' : '#f5f0ea', border: `1px solid ${dark ? 'rgba(255,255,255,.08)' : '#e8e0d4'}`, alignSelf: 'flex-start' }}>
                <svg viewBox="0 0 16 16" width={13} height={13} fill="none" stroke={subColor} strokeWidth="1.5">
                  <circle cx="6" cy="5" r="2.5"/><path d="M1 13c0-2.8 2.2-5 5-5s5 2.2 5 5"/>
                  <circle cx="12" cy="5" r="2" opacity=".5"/><path d="M14 13c0-2-1.3-3.7-3-4.4" opacity=".5"/>
                </svg>
                <span style={{ fontSize: '.78rem', fontWeight: 600, color: !inRange ? '#b45309' : textColor }}>
                  {space.capacity_min && space.capacity_max
                    ? `${space.capacity_min}–${space.capacity_max} pax`
                    : space.capacity_max ? `Hasta ${space.capacity_max} pax` : `Desde ${space.capacity_min} pax`}
                  {!inRange && guestCount ? ` · No ajusta a ${guestCount} pax` : ''}
                </span>
              </div>
            )}

            {/* Description */}
            {space.description && (
              <p style={{ margin: 0, fontSize: '.86rem', color: subColor, lineHeight: 1.65 }}>
                {space.description}
              </p>
            )}

            {/* Tags */}
            {space.tags && space.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {space.tags.map((tag, ti) => (
                  <span key={ti} style={{ fontSize: '.72rem', fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: dark ? 'rgba(255,255,255,.07)' : `${primary}0e`, border: `1px solid ${dark ? 'rgba(255,255,255,.1)' : `${primary}28`}`, color: dark ? 'rgba(255,255,255,.65)' : primary, letterSpacing: '.03em' }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Status badges */}
            {(included || isSelected) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {included && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '.68rem', fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: dark ? 'rgba(46,125,50,.2)' : '#e8f5e9', color: '#2e7d32', border: '1px solid rgba(46,125,50,.3)' }}>
                    <svg viewBox="0 0 10 8" width={9} height={9} fill="none"><path d="M1 4l3 3 5-6" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Incluida en vuestra celebración
                  </span>
                )}
                {!included && isSelected && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '.68rem', fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: `${primary}18`, color: primary, border: `1px solid ${primary}40` }}>
                    <svg viewBox="0 0 10 8" width={9} height={9} fill="none"><path d="M1 4l3 3 5-6" stroke={primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Elegida
                  </span>
                )}
              </div>
            )}

            {/* CTA */}
            {interactive && !included && (
              <div style={{ marginTop: 4 }}>
                {isSelected ? (
                  <button type="button" onClick={handleSelect}
                    style={{ width: '100%', padding: '14px', borderRadius: 14, border: `1.5px solid ${cardBorder}`, background: 'transparent', color: subColor, fontSize: '.85rem', fontWeight: 600, cursor: 'pointer' }}>
                    Quitar selección
                  </button>
                ) : (
                  <button type="button" onClick={handleSelect}
                    style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: primary, color: onPrimary, fontSize: '.88rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '.05em' }}>
                    {atMax ? 'Seleccionar (reemplaza actual)' : 'Seleccionar esta zona'}
                  </button>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    )
  }

  // ── Card component ──────────────────────────────────────────────────────────
  const SpaceCard = ({
    space, gi, si, mode, pricingMode, interactive, isNone, included, max, atMax,
  }: {
    space: SpaceGroup['spaces'][0]; gi: number; si: number
    mode: string; pricingMode: string; interactive: boolean; isNone: boolean
    included?: boolean; max?: number; atMax?: boolean
  }) => {
    const isSelected = isSpaceSelected(gi, si, mode)
    const inRange    = capacityOk(space, guestCount)
    const price      = priceOf(space, pricingMode, groups[gi]?.pricing_display)
    const tierTable  = (!price && (space.price_tiers ?? []).length > 0 && (groups[gi]?.pricing_display ?? 'tiers_table') === 'tiers_table') ? space.price_tiers! : null
    const isRadio    = mode === 'pick_one'
    const dimmed     = interactive && !isNone && atMax && !isSelected

    return (
      <button
        type="button"
        onClick={() => interactive && !isNone ? toggleSpace(gi, si, mode, max) : openModal({ space, gi, si, mode, pricingMode, interactive: false, included: !!included, max })}
        style={{
          ...sliderCard,
          display: 'flex', flexDirection: 'column', textAlign: 'left', padding: 0,
          background: cardBg,
          border: `2px solid ${isSelected ? primary : isNone ? 'rgba(46,125,50,.35)' : cardBorder}`,
          borderRadius: 14, overflow: 'hidden',
          cursor: 'pointer',
          transition: 'border-color .18s, box-shadow .18s, transform .12s, opacity .18s',
          opacity: dimmed ? 0.42 : inRange ? 1 : 0.5,
          boxShadow: isSelected
            ? `0 0 0 4px ${primary}22, 0 4px 16px rgba(0,0,0,.08)`
            : isNone
              ? '0 2px 8px rgba(46,125,50,.08)'
              : `0 2px 8px rgba(0,0,0,.05)`,
          transform: isSelected && interactive && !isNone ? 'translateY(-2px)' : 'none',
        }}
      >
        {space.photo_url ? (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img src={space.photo_url} alt={space.name} style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
            {/* Badges over photo */}
            <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {space.recommended && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, background: 'rgba(161,117,34,.92)', backdropFilter: 'blur(4px)' }}>
                  <svg viewBox="0 0 10 10" width={8} height={8} fill="none"><path d="M5 1l1.2 2.5L9 4.1 7 6l.5 3L5 7.8 2.5 9 3 6 1 4.1l2.8-.6z" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round"/></svg>
                  <span style={{ fontSize: '.62rem', fontWeight: 700, color: '#fff', letterSpacing: '.04em' }}>Recomendado</span>
                </div>
              )}
              {isNone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, background: 'rgba(46,125,50,.88)', backdropFilter: 'blur(4px)' }}>
                  <svg viewBox="0 0 10 8" width={8} height={8} fill="none"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span style={{ fontSize: '.62rem', fontWeight: 700, color: '#fff', letterSpacing: '.04em' }}>Incluida</span>
                </div>
              )}
              {isSelected && !isNone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, background: `${primary}dd`, backdropFilter: 'blur(4px)' }}>
                  <svg viewBox="0 0 10 8" width={8} height={8} fill="none"><path d="M1 4l3 3 5-6" stroke={onPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span style={{ fontSize: '.62rem', fontWeight: 700, color: onPrimary, letterSpacing: '.04em' }}>Elegida</span>
                </div>
              )}
            </div>
          </div>
        ) : !isNone ? (
          <PhotoPlaceholder name={space.name} primary={primary} dark={dark} />
        ) : null}
        <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {/* Badges row (no-photo case) */}
          {!space.photo_url && (space.recommended || isNone) && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 2 }}>
              {space.recommended && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: dark ? 'rgba(161,117,34,.2)' : '#fef3c7', border: '1px solid rgba(161,117,34,.35)' }}>
                  <svg viewBox="0 0 10 10" width={8} height={8} fill="none"><path d="M5 1l1.2 2.5L9 4.1 7 6l.5 3L5 7.8 2.5 9 3 6 1 4.1l2.8-.6z" stroke="#a17522" strokeWidth="1.4" strokeLinejoin="round"/></svg>
                  <span style={{ fontSize: '.6rem', fontWeight: 700, color: '#a17522', letterSpacing: '.04em' }}>Recomendado</span>
                </div>
              )}
              {isNone && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: dark ? 'rgba(46,125,50,.2)' : '#e8f5e9', border: '1px solid rgba(46,125,50,.3)' }}>
                  <svg viewBox="0 0 10 8" width={8} height={8} fill="none"><path d="M1 4l3 3 5-6" stroke="#2e7d32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span style={{ fontSize: '.6rem', fontWeight: 700, color: '#2e7d32', letterSpacing: '.04em' }}>Incluida</span>
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
            <div style={{ fontSize: '.88rem', fontWeight: 600, color: textColor, lineHeight: 1.3, flex: 1 }}>{space.name}</div>
            {/* + / ✓ toggle button */}
            {interactive && !isNone && (
              <div style={{
                flexShrink: 0, width: 26, height: 26, borderRadius: '50%', marginTop: 1,
                background: isSelected ? primary : 'transparent',
                border: `1.5px solid ${isSelected ? primary : cardBorder}`,
                transition: 'background .15s, border-color .15s, color .15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isSelected ? onPrimary : subColor,
                fontSize: isSelected ? '.72rem' : '1rem', fontWeight: 600,
              }}>
                {isSelected ? '✓' : '+'}
              </div>
            )}
            {/* Included indicator */}
            {isNone && (
              <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: '#e8f5e9', border: '1.5px solid #a5d6a7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 10 8" width={9} height={9} fill="none">
                  <path d="M1 4l3 3 5-6" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </div>
          {tierTable && (
            <div style={{ padding: '0 16px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {tierTable.map((t, ti) => (
                <div key={ti} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.68rem' }}>
                  <span style={{ color: subColor }}>{t.label}</span>
                  <span style={{ fontWeight: 700, color: primary }}>{fmtEur(t.price)}</span>
                </div>
              ))}
            </div>
          )}
          {/* Tags pills */}
          {space.tags && space.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
              {space.tags.map((tag, ti) => (
                <span key={ti} style={{ fontSize: '.6rem', fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: dark ? 'rgba(255,255,255,.07)' : `${primary}0e`, border: `1px solid ${dark ? 'rgba(255,255,255,.1)' : `${primary}28`}`, color: dark ? 'rgba(255,255,255,.6)' : primary, letterSpacing: '.03em' }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(space.capacity_min || space.capacity_max) && (
              <span style={{ fontSize: '.67rem', padding: '3px 8px', border: `1px solid ${dark ? 'rgba(255,255,255,.12)' : '#e0d8cc'}`, borderRadius: 999, color: !inRange ? '#b45309' : subColor, background: !inRange ? (dark ? 'rgba(180,83,9,.15)' : '#fffbeb') : 'transparent' }}>
                {space.capacity_min && space.capacity_max
                  ? `${space.capacity_min}–${space.capacity_max} pax`
                  : space.capacity_max ? `Hasta ${space.capacity_max} pax` : `Desde ${space.capacity_min} pax`}
              </span>
            )}
            {price && (
              <span style={{ fontSize: '.75rem', fontWeight: preview && !space.price ? 400 : 700, color: preview && !space.price ? subColor : primary, marginLeft: 'auto', fontStyle: preview && !space.price ? 'italic' : 'normal' }}>
                {price}
              </span>
            )}
            {/* Ver más — opens detail modal */}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); openModal({ space, gi, si, mode, pricingMode, interactive: interactive && !isNone, included: !!included, max }) }}
              style={{ marginLeft: 'auto', flexShrink: 0, background: 'transparent', border: `1px solid ${cardBorder}`, borderRadius: 6, padding: '3px 9px', color: subColor, fontSize: '.67rem', fontWeight: 500, cursor: 'pointer' }}
            >
              Ver más
            </button>
          </div>
        </div>
      </button>
    )
  }

  // ── Selection bar ───────────────────────────────────────────────────────────
  const SelectionBar = ({ gi, mode, spaces }: { gi: number; mode: string; spaces: SpaceGroup['spaces'] }) => {
    if (mode === 'pick_one') {
      const si = singleSel[gi]
      if (si === undefined || si < 0) return null
      return (
        <div style={{ marginTop: 16, padding: '10px 18px', background: `${primary}15`, border: `1px solid ${primary}40`, borderRadius: 10, fontSize: '.8rem', color: textColor, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg viewBox="0 0 10 8" width={12} height={12} fill="none"><path d="M1 4l3 3 5-6" stroke={primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Habéis elegido: <strong>{spaces[si]?.name}</strong>
        </div>
      )
    }
    const sel = multiSel[gi]
    if (!sel || sel.size === 0) return null
    const names = Array.from(sel).map(i => spaces[i]?.name).filter(Boolean)
    return (
      <div style={{ marginTop: 16, padding: '10px 18px', background: `${primary}15`, border: `1px solid ${primary}40`, borderRadius: 10, fontSize: '.8rem', color: textColor, display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg viewBox="0 0 10 8" width={12} height={12} fill="none"><path d="M1 4l3 3 5-6" stroke={primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Habéis elegido ({names.length}): <strong>{names.join(', ')}</strong>
      </div>
    )
  }

  return (
    <>
      {/* Zone detail modal */}
      <ZoneModal />

      <section style={{ padding: '80px 0', background: secBg }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 clamp(20px,5vw,60px)' }}>

          {/* Section heading */}
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span style={{ fontSize: '.63rem', fontWeight: 700, letterSpacing: '.22em', textTransform: 'uppercase', color: primary, display: 'block', marginBottom: 12 }}>
              Vuestros espacios
            </span>
            <h2 style={{ fontFamily: font, fontSize: 'clamp(1.7rem,3vw,2.5rem)', fontWeight: 300, color: textColor, lineHeight: 1.2, margin: 0 }}>
              Configura tu celebración
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 56 }}>
            {groups.map((group, gi) => {
              const mode        = resolveMode(group)
              const pricingMode = group.pricing_mode ?? 'per_space'
              const isOptional  = mode === 'optional' || group.optional === true
              const isNone      = mode === 'none'
              const isITP       = mode === 'included_then_pick'
              const includedIds = new Set(group.included_zone_ids ?? [])

              const optState = optIn[gi] ?? null

              const modeBadge = isNone
                ? { label: 'Todas incluidas', color: '#2e7d32', bg: dark ? 'rgba(46,125,50,.18)' : '#e8f5e9', border: 'rgba(46,125,50,.3)' }
                : isITP
                  ? { label: `Incluidas + elige ${group.pick_n_min ?? 1}`, color: '#6d4c41', bg: dark ? 'rgba(109,76,65,.2)' : '#fdf3e7', border: 'rgba(109,76,65,.3)' }
                  : mode === 'pick_one'
                    ? { label: 'Elige 1', color: dark ? '#90caf9' : '#1565c0', bg: dark ? 'rgba(144,202,249,.12)' : '#e3f2fd', border: 'rgba(21,101,192,.25)' }
                    : { label: `Elige ${group.pick_n_min ?? 1}${group.pick_n_max && group.pick_n_max !== group.pick_n_min ? `–${group.pick_n_max}` : ''}`, color: dark ? '#90caf9' : '#1565c0', bg: dark ? 'rgba(144,202,249,.12)' : '#e3f2fd', border: 'rgba(21,101,192,.25)' }

              return (
                <div key={gi} style={{ borderRadius: 18, overflow: 'hidden', border: `1px solid ${divider}`, background: dark ? 'rgba(255,255,255,.02)' : '#fff', boxShadow: '0 2px 16px rgba(0,0,0,.04)' }}>

                  {/* ── Group header ── */}
                  <div style={{ padding: '24px 28px 20px', borderBottom: `1px solid ${divider}` }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: primary, opacity: 0.7 }}>
                            Grupo {String(gi + 1).padStart(2, '0')}
                          </span>
                          <span style={{ fontSize: '.65rem', fontWeight: 600, letterSpacing: '.05em', padding: '3px 10px', borderRadius: 999, color: modeBadge.color, background: modeBadge.bg, border: `1px solid ${modeBadge.border}` }}>
                            {modeBadge.label}
                          </span>
                          {isOptional && (
                            <span style={{ fontSize: '.62rem', fontWeight: 600, letterSpacing: '.05em', padding: '3px 10px', borderRadius: 999, color: dark ? '#fbbf24' : '#92400e', background: dark ? 'rgba(251,191,36,.12)' : '#fffbeb', border: `1px solid ${dark ? 'rgba(251,191,36,.3)' : '#fde68a'}` }}>
                              Opcional
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: textColor, margin: 0, fontFamily: font }}>{group.name}</h3>
                          {pricingMode === 'group_base' && group.base_price && (
                            <span style={{ fontSize: '.95rem', fontWeight: 700, color: primary }}>{group.base_price}</span>
                          )}
                        </div>

                        {group.description && (
                          <p style={{ fontSize: '.8rem', color: subColor, marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>{group.description}</p>
                        )}

                        {group.note && (
                          <div style={{ marginTop: 10, padding: '9px 14px', background: dark ? 'rgba(255,255,255,.04)' : `${primary}0a`, borderLeft: `3px solid ${primary}55`, borderRadius: '0 8px 8px 0', fontSize: '.76rem', color: subColor, lineHeight: 1.55 }}>
                            {group.note}
                          </div>
                        )}
                      </div>

                      {/* Optional toggle */}
                      {isOptional && (
                        <div style={{ flexShrink: 0 }}>
                          {optState === null ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <p style={{ fontSize: '.72rem', color: subColor, margin: 0, textAlign: 'center' }}>¿Queréis incluirlo?</p>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button type="button" onClick={() => setOptIn(s => ({ ...s, [gi]: true }))}
                                  style={{ fontSize: '.72rem', fontWeight: 600, padding: '5px 14px', borderRadius: 8, border: `1.5px solid ${primary}`, color: primary, background: 'transparent', cursor: 'pointer' }}>
                                  Sí, añadir
                                </button>
                                <button type="button" onClick={() => setOptIn(s => ({ ...s, [gi]: false }))}
                                  style={{ fontSize: '.72rem', fontWeight: 600, padding: '5px 14px', borderRadius: 8, border: `1.5px solid ${cardBorder}`, color: subColor, background: 'transparent', cursor: 'pointer' }}>
                                  No, gracias
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setOptIn(s => ({ ...s, [gi]: null }))}
                              style={{ fontSize: '.7rem', padding: '5px 12px', borderRadius: 8, border: `1.5px solid ${optState ? primary : cardBorder}`, color: optState ? primary : subColor, background: optState ? `${primary}10` : 'transparent', cursor: 'pointer', fontWeight: 600 }}>
                              {optState ? '✓ Incluido' : '✗ No incluido'} · Cambiar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Body ── */}
                  {(!isOptional || optState !== false) && (
                    <div style={{ padding: '24px 28px 28px', opacity: isOptional && optState === null ? 0.6 : 1, transition: 'opacity .2s' }}>

                      {/* MODE: none */}
                      {isNone && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#e8f5e9', border: '1.5px solid #a5d6a7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg viewBox="0 0 10 8" width={9} height={9} fill="none"><path d="M1 4l3 3 5-6" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                            <span style={{ fontSize: '.72rem', fontWeight: 600, color: '#2e7d32' }}>Todos los espacios están incluidos en vuestra celebración</span>
                          </div>
                          <CardSlider minW={200}>
                            {group.spaces.map((space, si) => (
                              <SpaceCard key={si} space={space} gi={gi} si={si} mode={mode} pricingMode={pricingMode} interactive={false} isNone={true} included={true} />
                            ))}
                          </CardSlider>
                        </div>
                      )}

                      {/* MODE: included_then_pick */}
                      {isITP && (() => {
                        const included   = group.spaces.filter(s => includedIds.has(s.zone_id ?? s.id ?? ''))
                        const selectable = group.spaces.filter(s => !includedIds.has(s.zone_id ?? s.id ?? ''))
                        const pickMax    = group.pick_n_max ?? group.pick_n_min ?? 1
                        const pickCnt    = multiSel[gi]?.size ?? 0
                        const isAtMax    = pickCnt >= pickMax

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                            {included.length > 0 && (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: dark ? 'rgba(46,125,50,.3)' : '#e8f5e9', border: '1.5px solid rgba(46,125,50,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <svg viewBox="0 0 10 8" width={9} height={9} fill="none"><path d="M1 4l3 3 5-6" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  </div>
                                  <span style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#2e7d32' }}>
                                    Siempre incluidas
                                  </span>
                                </div>
                                <CardSlider minW={200}>
                                  {included.map((space, i) => {
                                    const si = group.spaces.indexOf(space)
                                    return <SpaceCard key={i} space={space} gi={gi} si={si} mode="none" pricingMode={pricingMode} interactive={false} isNone={true} included={true} />
                                  })}
                                </CardSlider>
                              </div>
                            )}

                            {selectable.length > 0 && (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                  <div style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: primary }}>
                                    {pickMax === 1
                                      ? 'Elige 1 zona adicional'
                                      : `Elige ${group.pick_n_min ?? 1}${group.pick_n_max && group.pick_n_max !== group.pick_n_min ? `–${group.pick_n_max}` : ''} zonas adicionales`}
                                  </div>
                                  {pickCnt > 0 && (
                                    <span style={{ fontSize: '.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: isAtMax ? '#2e7d32' : primary, color: '#fff' }}>{pickCnt}/{pickMax}</span>
                                  )}
                                </div>
                                <CardSlider>
                                  {selectable.map((space) => {
                                    const si = group.spaces.indexOf(space)
                                    const isSelected = isSpaceSelected(gi, si, 'pick_n')
                                    return <SpaceCard key={si} space={space} gi={gi} si={si} mode="pick_n" pricingMode={pricingMode} interactive={true} isNone={false} included={false} max={pickMax} atMax={isAtMax && !isSelected} />
                                  })}
                                </CardSlider>
                                <SelectionBar gi={gi} mode="pick_n" spaces={group.spaces} />
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* MODE: pick_one */}
                      {!isNone && !isITP && mode === 'pick_one' && (
                        <div>
                          <div style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: primary, marginBottom: 14 }}>
                            Elige una opción
                          </div>
                          <CardSlider>
                            {group.spaces.map((space, si) => (
                              <SpaceCard key={si} space={space} gi={gi} si={si} mode={mode} pricingMode={pricingMode} interactive={!isOptional || optState === true} isNone={false} />
                            ))}
                          </CardSlider>
                          <SelectionBar gi={gi} mode={mode} spaces={group.spaces} />
                        </div>
                      )}

                      {/* MODE: pick_n / optional */}
                      {!isNone && !isITP && mode !== 'pick_one' && (() => {
                        const pickNMax  = group.pick_n_max ?? group.pick_n_min
                        const pickNCnt  = multiSel[gi]?.size ?? 0
                        const isAtPickN = pickNMax !== undefined && pickNCnt >= pickNMax
                        return (
                          <div>
                            {!isOptional && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                <span style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: primary }}>
                                  Elige {group.pick_n_min ?? 1}
                                  {group.pick_n_max && group.pick_n_max !== group.pick_n_min ? `–${group.pick_n_max}` : ''} opciones
                                </span>
                                {pickNCnt > 0 && pickNMax && (
                                  <span style={{ fontSize: '.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: isAtPickN ? '#2e7d32' : primary, color: '#fff' }}>{pickNCnt}/{pickNMax}</span>
                                )}
                              </div>
                            )}
                            <CardSlider>
                              {group.spaces.map((space, si) => {
                                const isSelected = isSpaceSelected(gi, si, isOptional ? 'pick_n' : mode)
                                return (
                                  <SpaceCard key={si} space={space} gi={gi} si={si} mode={isOptional ? 'pick_n' : mode} pricingMode={pricingMode} interactive={!isOptional || optState === true} isNone={false} max={pickNMax} atMax={isAtPickN && !isSelected} />
                                )
                              })}
                            </CardSlider>
                            {(!isOptional || optState === true) && (
                              <SelectionBar gi={gi} mode={isOptional ? 'pick_n' : mode} spaces={group.spaces} />
                            )}
                          </div>
                        )
                      })()}

                    </div>
                  )}

                  {/* Opted out */}
                  {isOptional && optState === false && (
                    <div style={{ padding: '20px 28px', textAlign: 'center' }}>
                      <span style={{ fontSize: '.78rem', color: subColor, fontStyle: 'italic' }}>No habéis incluido este espacio opcional</span>
                    </div>
                  )}

                </div>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}

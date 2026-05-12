'use client'
import { useState } from 'react'
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
}

function capacityOk(space: { capacity_min?: number; capacity_max?: number }, guests?: number): boolean {
  if (!guests) return true
  if (space.capacity_min && guests < space.capacity_min) return false
  if (space.capacity_max && guests > space.capacity_max) return false
  return true
}

export default function SpaceGroupSelector({ groups, primary, onPrimary, dark = false, font, guestCount, onSelectionChange }: Props) {

  const [singleSel, setSingleSel] = useState<Record<number, number>>({})
  const [multiSel, setMultiSel]   = useState<Record<number, Set<number>>>({})

  const textColor  = dark ? 'rgba(255,255,255,.85)' : '#2a2a2a'
  const subColor   = dark ? 'rgba(255,255,255,.45)' : '#888'
  const cardBg     = dark ? '#111' : '#fff'
  const cardBorder = dark ? 'rgba(255,255,255,.08)' : '#e8e2d8'
  const secBg      = dark ? '#0a0a0a' : '#f9f7f4'

  const resolveMode = (group: SpaceGroup) =>
    group.selection_mode ?? (group.requires_selection === false ? 'optional' : 'pick_one')

  const notifyChange = (newSingle: Record<number, number>, newMulti: Record<number, Set<number>>) => {
    if (!onSelectionChange) return
    const result: SpaceSelection[] = []
    groups.forEach((group, gi) => {
      const mode = resolveMode(group)
      const includedIds = new Set(group.included_zone_ids ?? [])

      if (mode === 'none') {
        // all spaces always included — no client action needed, don't add to selections
        return
      }
      if (mode === 'included_then_pick') {
        // always-included spaces
        group.spaces
          .filter(s => includedIds.has(s.zone_id ?? s.id ?? ''))
          .forEach(s => result.push({ group_name: group.name, space_name: s.name }))
        // selectable picks
        const sel = newMulti[gi]
        if (sel) sel.forEach(si => {
          const space = group.spaces[si]
          if (space && !includedIds.has(space.zone_id ?? space.id ?? ''))
            result.push({ group_name: group.name, space_name: space.name })
        })
        return
      }
      if (mode === 'pick_one') {
        const si = newSingle[gi]
        if (si !== undefined && si >= 0 && group.spaces[si])
          result.push({ group_name: group.name, space_name: group.spaces[si].name })
      } else {
        const sel = newMulti[gi]
        if (sel) sel.forEach(si => { if (group.spaces[si]) result.push({ group_name: group.name, space_name: group.spaces[si].name }) })
      }
    })
    onSelectionChange(result)
  }

  const isSpaceSelected = (gi: number, si: number, mode: string): boolean => {
    if (mode === 'pick_one') return singleSel[gi] === si
    return multiSel[gi]?.has(si) ?? false
  }

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

  return (
    <section style={{ padding: '80px 0', background: secBg }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 48px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.22em', textTransform: 'uppercase', color: primary, display: 'block', marginBottom: 12 }}>
            Vuestros espacios
          </span>
          <h2 style={{ fontFamily: font, fontSize: 'clamp(1.6rem,2.8vw,2.4rem)', fontWeight: 300, color: textColor, lineHeight: 1.2, margin: 0 }}>
            Configura tu celebración
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
          {groups.map((group, gi) => {
            const mode        = resolveMode(group)
            const pricingMode = group.pricing_mode ?? 'per_space'
            const isOptional  = mode === 'optional' || group.optional === true
            const isNone      = mode === 'none'
            const isITP       = mode === 'included_then_pick'
            const includedIds = new Set(group.included_zone_ids ?? [])

            const modeLabel = isNone ? 'Incluidas'
              : isITP && isOptional ? `Incluidas + elige (opcional)`
              : isITP       ? `Incluidas + Elige ${group.pick_n_min ?? 1}`
              : isOptional  ? 'Opcional'
              : mode === 'pick_one' ? 'Elige 1'
              : `Elige ${group.pick_n_min ?? 1}${group.pick_n_max && group.pick_n_max !== group.pick_n_min ? `–${group.pick_n_max}` : ''}`

            // For none/ITP the base card grid is interactive only for selectable spaces
            const baseInteractive = !isNone && (!isOptional || pricingMode === 'group_base')

            return (
              <div key={gi}>
                {/* Group header */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: primary }}>
                      Grupo {String(gi + 1).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: '.65rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: subColor, padding: '2px 8px', border: `1px solid ${cardBorder}`, borderRadius: 999 }}>
                      {modeLabel}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: textColor }}>{group.name}</div>
                    {pricingMode === 'group_base' && group.base_price && (
                      <div style={{ fontSize: '.95rem', fontWeight: 700, color: primary }}>{group.base_price}</div>
                    )}
                  </div>
                  {group.description && <div style={{ fontSize: '.8rem', color: subColor, marginTop: 4 }}>{group.description}</div>}
                  {group.note && (
                    <div style={{ marginTop: 10, padding: '8px 14px', background: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)', borderLeft: `3px solid ${primary}`, borderRadius: '0 6px 6px 0', fontSize: '.78rem', color: subColor, lineHeight: 1.5 }}>
                      {group.note}
                    </div>
                  )}
                </div>

                {/* ── included_then_pick ── */}
                {isITP ? (() => {
                  const includedSpaces   = group.spaces.filter(s => includedIds.has(s.zone_id ?? s.id ?? ''))
                  const selectableSpaces = group.spaces.filter(s => !includedIds.has(s.zone_id ?? s.id ?? ''))
                  const pickMax = group.pick_n_max ?? group.pick_n_min ?? 1

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {/* Always-included chips */}
                      {includedSpaces.length > 0 && (
                        <div>
                          <div style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#5a8a55', marginBottom: 10 }}>
                            Siempre incluidas
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {includedSpaces.map((space, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, background: dark ? 'rgba(90,138,85,0.15)' : 'rgba(90,138,85,0.1)', border: '1px solid rgba(90,138,85,0.3)', fontSize: '.78rem', color: dark ? '#a3d4a0' : '#3a6a35', fontWeight: 500 }}>
                                <span style={{ fontSize: '.7rem' }}>✓</span> {space.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Selectable cards */}
                      {selectableSpaces.length > 0 && (
                        <div>
                          <div style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: primary, marginBottom: 10 }}>
                            Elige {group.pick_n_min ?? 1}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                            {selectableSpaces.map((space) => {
                              const si = group.spaces.indexOf(space)
                              const isSelected = isSpaceSelected(gi, si, 'pick_n')
                              const inRange = capacityOk(space, guestCount)
                              const priceDisplay = space.price ? (pricingMode === 'group_base' ? (space.price.trim().startsWith('+') ? space.price.trim() : `+${space.price.trim()}`) : space.price) : null
                              return (
                                <button key={si} type="button"
                                  onClick={() => toggleSpace(gi, si, 'pick_n', pickMax)}
                                  style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', background: cardBg, border: `2px solid ${isSelected ? primary : cardBorder}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'border-color .2s, box-shadow .2s', padding: 0, opacity: inRange ? 1 : 0.55, boxShadow: isSelected ? `0 0 0 4px ${primary}22` : '0 1px 4px rgba(0,0,0,.06)' }}>
                                  {space.photo_url && <img src={space.photo_url} alt={space.name} style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block', flexShrink: 0 }} />}
                                  <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
                                      <div style={{ fontSize: '.88rem', fontWeight: 600, color: textColor, lineHeight: 1.3 }}>{space.name}</div>
                                      <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1, background: isSelected ? primary : 'transparent', border: `2px solid ${isSelected ? primary : cardBorder}`, transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {isSelected && <div style={{ width: 10, height: 10, color: onPrimary, fontSize: 10, lineHeight: 1, fontWeight: 700 }}>✓</div>}
                                      </div>
                                    </div>
                                    {space.description && <div style={{ fontSize: '.75rem', color: subColor, lineHeight: 1.45 }}>{space.description}</div>}
                                    <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                      {(space.capacity_min || space.capacity_max) && (
                                        <span style={{ fontSize: '.68rem', padding: '3px 9px', border: `1px solid ${dark ? 'rgba(255,255,255,.15)' : '#e0d8cc'}`, borderRadius: 999, color: !inRange ? '#9a3412' : subColor }}>
                                          {space.capacity_min && space.capacity_max ? `${space.capacity_min}–${space.capacity_max} pax` : space.capacity_max ? `Hasta ${space.capacity_max} pax` : `Desde ${space.capacity_min} pax`}
                                        </span>
                                      )}
                                      {priceDisplay && <span style={{ fontSize: '.75rem', fontWeight: 700, color: primary, marginLeft: 'auto' }}>{priceDisplay}</span>}
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                          {/* Selectable feedback */}
                          {(() => {
                            const sel = multiSel[gi]
                            if (!sel || sel.size === 0) return null
                            const names = Array.from(sel).map(i => group.spaces[i]?.name).filter(Boolean)
                            return (
                              <div style={{ marginTop: 14, padding: '10px 16px', background: `${primary}18`, border: `1px solid ${primary}44`, borderRadius: 8, fontSize: '.78rem', color: textColor }}>
                                ✓ Habéis seleccionado ({names.length}): <strong>{names.join(', ')}</strong>
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  )
                })() : (
                  /* ── Standard modes (none / pick_one / pick_n / optional) ── */
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                      {group.spaces.map((space, si) => {
                        const isSelected  = isSpaceSelected(gi, si, mode)
                        const inRange     = capacityOk(space, guestCount)
                        const interactive = baseInteractive
                        const priceDisplay = (() => {
                          if (!space.price) return null
                          if (pricingMode === 'group_base') { const t = space.price.trim(); return t.startsWith('+') ? t : `+${t}` }
                          return space.price
                        })()

                        return (
                          <button key={si} type="button"
                            onClick={() => interactive && !isNone && toggleSpace(gi, si, mode, group.pick_n_max)}
                            style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', background: cardBg, border: `2px solid ${isSelected ? primary : cardBorder}`, borderRadius: 12, overflow: 'hidden', cursor: interactive && !isNone ? 'pointer' : 'default', transition: 'border-color .2s, box-shadow .2s', padding: 0, opacity: inRange ? 1 : 0.55, boxShadow: isSelected ? `0 0 0 4px ${primary}22` : '0 1px 4px rgba(0,0,0,.06)' }}>
                            {space.photo_url && <img src={space.photo_url} alt={space.name} style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block', flexShrink: 0 }} />}
                            <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
                                <div style={{ fontSize: '.88rem', fontWeight: 600, color: textColor, lineHeight: 1.3 }}>{space.name}</div>
                                {interactive && !isNone && (
                                  <div style={{ width: 18, height: 18, borderRadius: mode === 'pick_one' ? '50%' : 4, flexShrink: 0, marginTop: 1, background: isSelected ? primary : 'transparent', border: `2px solid ${isSelected ? primary : cardBorder}`, transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {isSelected && (mode === 'pick_one'
                                      ? <div style={{ width: 6, height: 6, borderRadius: '50%', background: onPrimary }} />
                                      : <div style={{ width: 10, height: 10, color: onPrimary, fontSize: 10, lineHeight: 1, fontWeight: 700 }}>✓</div>
                                    )}
                                  </div>
                                )}
                              </div>
                              {space.description && <div style={{ fontSize: '.75rem', color: subColor, lineHeight: 1.45 }}>{space.description}</div>}
                              <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                {(space.capacity_min || space.capacity_max) && (
                                  <span style={{ fontSize: '.68rem', padding: '3px 9px', border: `1px solid ${dark ? 'rgba(255,255,255,.15)' : '#e0d8cc'}`, borderRadius: 999, color: !inRange ? '#9a3412' : subColor }}>
                                    {space.capacity_min && space.capacity_max ? `${space.capacity_min}–${space.capacity_max} pax` : space.capacity_max ? `Hasta ${space.capacity_max} pax` : `Desde ${space.capacity_min} pax`}
                                  </span>
                                )}
                                {space.price_label && (
                                  <span style={{ fontSize: '.68rem', padding: '3px 9px', border: `1px solid ${dark ? 'rgba(255,255,255,.15)' : '#e0d8cc'}`, borderRadius: 999, color: subColor }}>{space.price_label}</span>
                                )}
                                {priceDisplay && <span style={{ fontSize: '.75rem', fontWeight: 700, color: primary, marginLeft: 'auto' }}>{priceDisplay}</span>}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Selection feedback */}
                    {interactive && !isNone && (() => {
                      if (mode === 'pick_one') {
                        const sel = singleSel[gi]
                        if (sel === undefined || sel < 0) return null
                        return (
                          <div style={{ marginTop: 14, padding: '10px 16px', background: `${primary}18`, border: `1px solid ${primary}44`, borderRadius: 8, fontSize: '.78rem', color: textColor }}>
                            ✓ Habéis seleccionado: <strong>{group.spaces[sel]?.name}</strong>
                          </div>
                        )
                      }
                      const sel = multiSel[gi]
                      if (!sel || sel.size === 0) return null
                      const names = Array.from(sel).map(i => group.spaces[i]?.name).filter(Boolean)
                      return (
                        <div style={{ marginTop: 14, padding: '10px 16px', background: `${primary}18`, border: `1px solid ${primary}44`, borderRadius: 8, fontSize: '.78rem', color: textColor }}>
                          ✓ Habéis seleccionado ({names.length}): <strong>{names.join(', ')}</strong>
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

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
  preview?: boolean
}

function capacityOk(space: { capacity_min?: number; capacity_max?: number }, guests?: number): boolean {
  if (!guests) return true
  if (space.capacity_min && guests < space.capacity_min) return false
  if (space.capacity_max && guests > space.capacity_max) return false
  return true
}

function PhotoPlaceholder({ name, primary, dark }: { name: string; primary: string; dark: boolean }) {
  const initial = name.trim()[0]?.toUpperCase() ?? '?'
  return (
    <div style={{
      width: '100%', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: dark ? `${primary}18` : `${primary}0d`,
      borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'}`,
    }}>
      <span style={{ fontSize: '2rem', fontWeight: 300, color: primary, opacity: 0.5 }}>{initial}</span>
    </div>
  )
}

export default function SpaceGroupSelector({ groups, primary, onPrimary, dark = false, font, guestCount, onSelectionChange, preview }: Props) {
  const [singleSel, setSingleSel] = useState<Record<number, number>>({})
  const [multiSel,  setMultiSel]  = useState<Record<number, Set<number>>>({})
  // optional groups: null = not yet decided, true = included, false = skipped
  const [optIn, setOptIn] = useState<Record<number, boolean | null>>({})

  const textColor  = dark ? 'rgba(255,255,255,.88)' : '#1e1e1e'
  const subColor   = dark ? 'rgba(255,255,255,.42)' : '#7a7264'
  const cardBg     = dark ? 'rgba(255,255,255,.04)' : '#ffffff'
  const cardBorder = dark ? 'rgba(255,255,255,.1)'  : '#e4ddd3'
  const secBg      = dark ? '#0c0c0c'               : '#f9f7f4'
  const divider    = dark ? 'rgba(255,255,255,.07)'  : '#ede8e0'

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

  const priceOf = (space: SpaceGroup['spaces'][0], pricingMode: string): string | null => {
    if (space.price) {
      if (pricingMode === 'group_base') {
        const t = space.price.trim()
        return t.startsWith('+') ? t : `+${t}`
      }
      return space.price
    }
    return preview ? 'Consulta precio' : null
  }

  // ── Card component ──────────────────────────────────────────────────────────
  const SpaceCard = ({
    space, gi, si, mode, pricingMode, interactive, isNone,
  }: {
    space: SpaceGroup['spaces'][0]; gi: number; si: number
    mode: string; pricingMode: string; interactive: boolean; isNone: boolean
  }) => {
    const isSelected = isSpaceSelected(gi, si, mode)
    const inRange    = capacityOk(space, guestCount)
    const price      = priceOf(space, pricingMode)
    const isRadio    = mode === 'pick_one'

    return (
      <button
        type="button"
        onClick={() => interactive && !isNone && toggleSpace(gi, si, mode, undefined)}
        style={{
          display: 'flex', flexDirection: 'column', textAlign: 'left', padding: 0,
          background: cardBg,
          border: `2px solid ${isSelected ? primary : cardBorder}`,
          borderRadius: 14, overflow: 'hidden',
          cursor: interactive && !isNone ? 'pointer' : 'default',
          transition: 'border-color .18s, box-shadow .18s, transform .12s',
          opacity: inRange ? 1 : 0.5,
          boxShadow: isSelected
            ? `0 0 0 4px ${primary}22, 0 4px 16px rgba(0,0,0,.08)`
            : `0 2px 8px rgba(0,0,0,.05)`,
          transform: isSelected && interactive && !isNone ? 'translateY(-2px)' : 'none',
        }}
      >
        {space.photo_url
          ? <img src={space.photo_url} alt={space.name} style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block', flexShrink: 0 }} />
          : isNone
            ? null
            : <PhotoPlaceholder name={space.name} primary={primary} dark={dark} />
        }
        <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
            <div style={{ fontSize: '.88rem', fontWeight: 600, color: textColor, lineHeight: 1.3, flex: 1 }}>{space.name}</div>
            {interactive && !isNone && (
              <div style={{
                width: 20, height: 20, borderRadius: isRadio ? '50%' : 5, flexShrink: 0, marginTop: 1,
                background: isSelected ? primary : 'transparent',
                border: `2px solid ${isSelected ? primary : cardBorder}`,
                transition: 'all .18s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isSelected && (isRadio
                  ? <div style={{ width: 7, height: 7, borderRadius: '50%', background: onPrimary }} />
                  : <svg viewBox="0 0 10 8" width={10} height={10} fill="none">
                      <path d="M1 4l3 3 5-6" stroke={onPrimary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                )}
              </div>
            )}
            {isNone && (
              <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: '#e8f5e9', border: '1.5px solid #a5d6a7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 10 8" width={9} height={9} fill="none">
                  <path d="M1 4l3 3 5-6" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </div>
          {space.description && <div style={{ fontSize: '.74rem', color: subColor, lineHeight: 1.45 }}>{space.description}</div>}
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

            const optState = optIn[gi] ?? null  // null = undecided

            // Mode badge
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
                        {/* Mode badge */}
                        <span style={{ fontSize: '.65rem', fontWeight: 600, letterSpacing: '.05em', padding: '3px 10px', borderRadius: 999, color: modeBadge.color, background: modeBadge.bg, border: `1px solid ${modeBadge.border}` }}>
                          {modeBadge.label}
                        </span>
                        {/* Optional badge */}
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

                {/* ── Body: hidden if optional and opted out ── */}
                {(!isOptional || optState !== false) && (
                  <div style={{ padding: '24px 28px 28px', opacity: isOptional && optState === null ? 0.6 : 1, transition: 'opacity .2s' }}>

                    {/* ── MODE: none (todas incluidas) ── */}
                    {isNone && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#e8f5e9', border: '1.5px solid #a5d6a7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg viewBox="0 0 10 8" width={9} height={9} fill="none"><path d="M1 4l3 3 5-6" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                          <span style={{ fontSize: '.72rem', fontWeight: 600, color: '#2e7d32' }}>Todos los espacios están incluidos en vuestra celebración</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                          {group.spaces.map((space, si) => (
                            <SpaceCard key={si} space={space} gi={gi} si={si} mode={mode} pricingMode={pricingMode} interactive={false} isNone={true} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── MODE: included_then_pick ── */}
                    {isITP && (() => {
                      const included   = group.spaces.filter(s => includedIds.has(s.zone_id ?? s.id ?? ''))
                      const selectable = group.spaces.filter(s => !includedIds.has(s.zone_id ?? s.id ?? ''))
                      const pickMax    = group.pick_n_max ?? group.pick_n_min ?? 1

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                          {included.length > 0 && (
                            <div>
                              <div style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#2e7d32', marginBottom: 12 }}>
                                Siempre incluidas
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                {included.map((space, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, background: dark ? 'rgba(46,125,50,.15)' : '#f1f8f1', border: '1px solid rgba(46,125,50,.25)' }}>
                                    <svg viewBox="0 0 10 8" width={10} height={10} fill="none"><path d="M1 4l3 3 5-6" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    <span style={{ fontSize: '.8rem', fontWeight: 600, color: dark ? '#a5d6a7' : '#2e7d32' }}>{space.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {selectable.length > 0 && (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                <div style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: primary }}>
                                  Elige {group.pick_n_min ?? 1} zona adicional
                                </div>
                                {(() => {
                                  const sel = multiSel[gi]
                                  const cnt = sel?.size ?? 0
                                  return cnt > 0 ? (
                                    <span style={{ fontSize: '.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: primary, color: onPrimary }}>{cnt}/{pickMax}</span>
                                  ) : null
                                })()}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                                {selectable.map((space) => {
                                  const si = group.spaces.indexOf(space)
                                  return <SpaceCard key={si} space={space} gi={gi} si={si} mode="pick_n" pricingMode={pricingMode} interactive={true} isNone={false} />
                                })}
                              </div>
                              <SelectionBar gi={gi} mode="pick_n" spaces={group.spaces} />
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* ── MODE: pick_one ── */}
                    {!isNone && !isITP && mode === 'pick_one' && (
                      <div>
                        <div style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: primary, marginBottom: 14 }}>
                          Elige una opción
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                          {group.spaces.map((space, si) => (
                            <SpaceCard key={si} space={space} gi={gi} si={si} mode={mode} pricingMode={pricingMode} interactive={!isOptional || optState === true} isNone={false} />
                          ))}
                        </div>
                        <SelectionBar gi={gi} mode={mode} spaces={group.spaces} />
                      </div>
                    )}

                    {/* ── MODE: pick_n / optional ── */}
                    {!isNone && !isITP && mode !== 'pick_one' && (
                      <div>
                        {!isOptional && (
                          <div style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: primary, marginBottom: 14 }}>
                            Elige {group.pick_n_min ?? 1}
                            {group.pick_n_max && group.pick_n_max !== group.pick_n_min ? `–${group.pick_n_max}` : ''} opciones
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                          {group.spaces.map((space, si) => (
                            <SpaceCard key={si} space={space} gi={gi} si={si} mode={isOptional ? 'pick_n' : mode} pricingMode={pricingMode} interactive={!isOptional || optState === true} isNone={false} />
                          ))}
                        </div>
                        {(!isOptional || optState === true) && (
                          <SelectionBar gi={gi} mode={isOptional ? 'pick_n' : mode} spaces={group.spaces} />
                        )}
                      </div>
                    )}

                  </div>
                )}

                {/* ── Opted out state ── */}
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
  )
}

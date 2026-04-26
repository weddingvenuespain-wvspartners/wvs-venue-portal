'use client'
import { useState } from 'react'
import type { SpaceGroup } from '@/lib/proposal-types'

type Props = {
  groups: SpaceGroup[]
  primary: string
  onPrimary: string
  dark?: boolean
  font?: string
}

export default function SpaceGroupSelector({ groups, primary, onPrimary, dark = false, font }: Props) {
  const [selected, setSelected] = useState<Record<number, number>>({})

  const textColor  = dark ? 'rgba(255,255,255,.85)' : '#2a2a2a'
  const subColor   = dark ? 'rgba(255,255,255,.45)' : '#888'
  const cardBg     = dark ? '#111' : '#fff'
  const cardBorder = dark ? 'rgba(255,255,255,.08)' : '#e8e2d8'
  const secBg      = dark ? '#0a0a0a' : '#f9f7f4'

  return (
    <section style={{ padding: '80px 0', background: secBg }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 48px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.22em', textTransform: 'uppercase', color: primary, display: 'block', marginBottom: 12 }}>
            Vuestros espacios
          </span>
          <h2 style={{ fontFamily: font, fontSize: 'clamp(1.6rem,2.8vw,2.4rem)', fontWeight: 300, color: textColor, lineHeight: 1.2, margin: 0 }}>
            Configura tu celebración
          </h2>
        </div>

        {/* Groups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
          {groups.map((group, gi) => (
            <div key={gi}>
              {/* Group header */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: primary, marginBottom: 4 }}>
                  Grupo {String(gi + 1).padStart(2, '0')}
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: textColor }}>{group.name}</div>
                {group.description && <div style={{ fontSize: '.8rem', color: subColor, marginTop: 4 }}>{group.description}</div>}
                {group.note && (
                  <div style={{ marginTop: 10, padding: '8px 14px', background: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)', borderLeft: `3px solid ${primary}`, borderRadius: '0 6px 6px 0', fontSize: '.78rem', color: subColor, lineHeight: 1.5 }}>
                    {group.note}
                  </div>
                )}
              </div>

              {/* Spaces grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {group.spaces.map((space, si) => {
                  const isSelected = selected[gi] === si
                  return (
                    <button
                      key={si}
                      type="button"
                      onClick={() => {
                        if (group.requires_selection !== false) {
                          setSelected(s => ({ ...s, [gi]: isSelected ? -1 : si }))
                        }
                      }}
                      style={{
                        display: 'flex', flexDirection: 'column', textAlign: 'left',
                        background: cardBg, border: `2px solid ${isSelected ? primary : cardBorder}`,
                        borderRadius: 12, overflow: 'hidden', cursor: group.requires_selection !== false ? 'pointer' : 'default',
                        transition: 'border-color .2s, box-shadow .2s', padding: 0,
                        boxShadow: isSelected ? `0 0 0 4px ${primary}22` : '0 1px 4px rgba(0,0,0,.06)',
                      }}
                    >
                      {space.photo_url && (
                        <img src={space.photo_url} alt={space.name}
                          style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block', flexShrink: 0 }} />
                      )}
                      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
                          <div style={{ fontSize: '.88rem', fontWeight: 600, color: textColor, lineHeight: 1.3 }}>{space.name}</div>
                          {group.requires_selection !== false && (
                            <div style={{
                              width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                              background: isSelected ? primary : 'transparent',
                              border: `2px solid ${isSelected ? primary : cardBorder}`,
                              transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: onPrimary }} />}
                            </div>
                          )}
                        </div>
                        {space.description && <div style={{ fontSize: '.75rem', color: subColor, lineHeight: 1.45 }}>{space.description}</div>}
                        <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          {space.capacity_max && (
                            <span style={{ fontSize: '.68rem', padding: '3px 9px', border: `1px solid ${dark ? 'rgba(255,255,255,.15)' : '#e0d8cc'}`, borderRadius: 999, color: subColor }}>
                              Hasta {space.capacity_max} pax
                            </span>
                          )}
                          {space.price_label && (
                            <span style={{ fontSize: '.68rem', padding: '3px 9px', border: `1px solid ${dark ? 'rgba(255,255,255,.15)' : '#e0d8cc'}`, borderRadius: 999, color: subColor }}>
                              {space.price_label}
                            </span>
                          )}
                          {space.price && (
                            <span style={{ fontSize: '.75rem', fontWeight: 700, color: primary, marginLeft: 'auto' }}>
                              {space.price}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Selection feedback */}
              {group.requires_selection !== false && selected[gi] !== undefined && selected[gi] >= 0 && (
                <div style={{ marginTop: 14, padding: '10px 16px', background: `${primary}18`, border: `1px solid ${primary}44`, borderRadius: 8, fontSize: '.78rem', color: textColor }}>
                  ✓ Habéis seleccionado: <strong>{group.spaces[selected[gi]]?.name}</strong>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

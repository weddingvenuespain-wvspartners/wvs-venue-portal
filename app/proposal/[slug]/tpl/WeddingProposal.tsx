'use client'
// WeddingProposal — bloque interactivo donde el invitado configura su boda:
// menú (con cursos variables), estaciones/ceremonia/AV, invitados y comentarios.
// Muestra total en vivo. Submit registra la selección y notifica al venue.

import { useMemo, useState, type CSSProperties } from 'react'
import type { ProposalData } from '../page'
import type { Menu, MenuCourse, MenuExtra, AppetizerGroup } from './shared'
import { toRgb, FadeUp, ivaLabel } from './shared'
import styles from './WeddingProposal.module.css'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function parsePrice(s: string | undefined): number {
  if (!s) return 0
  const m = s.match(/[\d.,]+/)
  if (!m) return 0
  let t = m[0]
  const lastDot = t.lastIndexOf('.')
  const lastComma = t.lastIndexOf(',')
  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) t = t.replace(/\./g, '').replace(',', '.')
    else                     t = t.replace(/,/g, '')
  } else if (lastComma !== -1) {
    const after = t.length - lastComma - 1
    t = after === 3 ? t.replace(',', '') : t.replace(',', '.')
  } else if (lastDot !== -1) {
    const after = t.length - lastDot - 1
    if (after === 3) t = t.replace('.', '')
  }
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

function formatEuro(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function getMenuPrice(menu: Menu, weddingDate: string | null | undefined): string {
  if (menu.season_prices?.length && weddingDate) {
    const match = menu.season_prices.find(sp => weddingDate >= sp.date_from && weddingDate <= sp.date_to)
    if (match) return match.price_per_person
  }
  return menu.price_per_person
}

function calcMenuAmount(menu: Menu | null, guests: number, weddingDate: string | null | undefined): number {
  if (!menu) return 0
  const perPerson = parsePrice(getMenuPrice(menu, weddingDate))
  const perPersonTotal = perPerson > 0 ? perPerson * guests : 0
  const minSpend = parsePrice(menu.min_spend)
  if (minSpend > 0 && perPersonTotal > 0) return Math.max(perPersonTotal, minSpend)
  if (minSpend > 0) return minSpend
  return perPersonTotal
}

function legacyToMenu(legacy: { name: string; price_per_person: string; description?: string; min_guests?: number }, idx: number): Menu {
  return { id: `legacy-${idx}`, name: legacy.name, price_per_person: legacy.price_per_person, description: legacy.description, min_guests: legacy.min_guests }
}

function menuId(m: Menu, idx: number): string { return m.id || `menu-${idx}` }
function extraId(e: MenuExtra, idx: number): string { return e.id || `extra-${idx}` }
function cx(...cls: Array<string | false | null | undefined>): string { return cls.filter(Boolean).join(' ') }

const CATEGORY_LABELS: Record<MenuExtra['category'], string> = {
  station: 'Estaciones y buffets', resopon: 'Resopón', open_bar: 'Barra libre',
  ceremony: 'Ceremonia', audiovisual: 'Audiovisual', music: 'Música', other: 'Otros',
}
const COCKTAIL_CATS: MenuExtra['category'][] = ['station']
const NIGHT_CATS:    MenuExtra['category'][] = ['resopon', 'open_bar']
const EVENT_CATS:    MenuExtra['category'][] = ['ceremony', 'music', 'audiovisual', 'other']

// ─── Component ─────────────────────────────────────────────────────────────────

export function WeddingProposal({
  data, menus: menusInput, extras, appetizers, legacyMenus,
  primary, onPrimary, dark = false, previewOnly = false,
}: {
  data: ProposalData
  menus: Menu[] | null
  extras: MenuExtra[] | null
  appetizers: AppetizerGroup[] | null
  legacyMenus?: Array<{ name: string; price_per_person: string; description?: string; min_guests?: number }>
  primary: string; onPrimary: string; dark?: boolean; previewOnly?: boolean
}) {
  const rgb = toRgb(primary)
  const sd = data.sections_data ?? null
  const showMenuPrices = sd?.show_menu_prices !== false

  const menus: Menu[] = useMemo(() => {
    if (menusInput?.length) return menusInput
    if (legacyMenus?.length) return legacyMenus.map(legacyToMenu)
    return []
  }, [menusInput, legacyMenus])

  const hasSeasonPrices = useMemo(() => menus.some(m => (m.season_prices?.length ?? 0) > 0), [menus])
  const dateIsFlexible = !data.wedding_date
  const originalGuests = data.guest_count ?? 100

  const [localDate, setLocalDate] = useState<string>(data.wedding_date ?? '')
  const weddingDate = localDate || null

  const [guestOverride, setGuestOverride] = useState<number | null>(null)
  const guestTarget = guestOverride ?? originalGuests

  // Per-menu allocation (multi-menu only); single menu auto-fills guestTarget
  const [menuAllocations, setMenuAllocations] = useState<Record<string, number>>({})
  const effectiveAllocations = useMemo<Record<string, number>>(() => {
    if (menus.length === 1) return { [menuId(menus[0], 0)]: guestTarget }
    return menuAllocations
  }, [menus, guestTarget, menuAllocations])

  // Which menu is shown in the right panel (multi-menu)
  const [selectedMenuIdx, setSelectedMenuIdx] = useState(0)

  const [courseChoices, setCourseChoices] = useState<Record<string, string[]>>({})
  const [selectedExtras, setSelectedExtras] = useState<Record<string, boolean>>({})
  const [comments, setComments] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalAllocated = useMemo(() => Object.values(effectiveAllocations).reduce((a, b) => a + b, 0), [effectiveAllocations])
  const guests = totalAllocated > 0 ? totalAllocated : guestTarget

  const total = useMemo(() => {
    let menuTotal = 0
    menus.forEach((m, i) => {
      const id = menuId(m, i)
      const count = effectiveAllocations[id] || 0
      if (!count) return
      menuTotal += calcMenuAmount(m, count, weddingDate)
      m.courses?.forEach((c, ci) => {
        ;(courseChoices[`${id}-c${ci}`] || []).forEach(name => {
          const item = c.items.find(it => it.name === name)
          if (item?.extra_price) menuTotal += parsePrice(item.extra_price) * count
        })
      })
    })
    let extrasTotal = 0
    extras?.forEach((e, i) => {
      if (!selectedExtras[extraId(e, i)]) return
      const p = parsePrice(e.price)
      extrasTotal += e.price_type === 'per_person' ? p * guests : p
    })
    return menuTotal + extrasTotal
  }, [menus, effectiveAllocations, weddingDate, extras, selectedExtras, courseChoices, guests])

  const missingChoices = useMemo<string[]>(() => {
    const missing: string[] = []
    menus.forEach((m, i) => {
      const id = menuId(m, i)
      if (!(effectiveAllocations[id] > 0)) return
      m.courses?.forEach((c, ci) => {
        if (!c.mode || c.mode === 'fixed') return
        const picks = courseChoices[`${id}-c${ci}`] || []
        const expected = c.mode === 'pick_one' ? 1 : (c.pick_count || 1)
        if (picks.length < expected) missing.push(`${m.name}: ${c.label}`)
      })
    })
    return missing
  }, [menus, effectiveAllocations, courseChoices])

  const extrasByCategory = useMemo(() => {
    if (!extras) return null
    const map: Partial<Record<MenuExtra['category'], Array<{ extra: MenuExtra; key: string }>>> = {}
    extras.forEach((e, i) => {
      const key = extraId(e, i)
      if (!map[e.category]) map[e.category] = []
      map[e.category]!.push({ extra: e, key })
    })
    return map
  }, [extras])

  const togglePick = (courseKey: string, itemName: string, mode: 'pick_one' | 'pick_n', pickCount: number) => {
    setCourseChoices(prev => {
      const cur = prev[courseKey] || []
      if (mode === 'pick_one') return { ...prev, [courseKey]: [itemName] }
      if (cur.includes(itemName)) return { ...prev, [courseKey]: cur.filter(n => n !== itemName) }
      if (cur.length >= pickCount) return prev
      return { ...prev, [courseKey]: [...cur, itemName] }
    })
  }

  const handleSubmit = async () => {
    setError(null)
    const allocatedMenus = menus.filter((m, i) => (effectiveAllocations[menuId(m, i)] || 0) > 0)
    if (menus.length > 0 && !allocatedMenus.length) { setError('Asigna invitados a al menos un menú'); return }
    if (missingChoices.length) { setError(`Faltan opciones en: ${missingChoices.join(', ')}`); return }
    setSending(true)
    try {
      const payload = {
        proposal_id: data.id,
        menu_allocations: allocatedMenus.map(m => {
          const i = menus.indexOf(m); const id = menuId(m, i)
          return { menu_id: id, menu_name: m.name, guest_count: effectiveAllocations[id],
            course_choices: Object.fromEntries((m.courses ?? []).map((c, ci) => [c.label, courseChoices[`${id}-c${ci}`] || []])) }
        }),
        selected_menu_id: allocatedMenus[0] ? menuId(allocatedMenus[0], menus.indexOf(allocatedMenus[0])) : null,
        selected_menu_name: allocatedMenus.map(m => m.name).join(' + ') || null,
        guest_count: guests, original_guest_count: originalGuests, guest_count_changed: guests !== originalGuests,
        course_choices: courseChoices,
        selected_extras: Object.entries(selectedExtras).filter(([, v]) => v).map(([k]) => k),
        comments, estimated_total: total, wedding_date: weddingDate,
      }
      const res = await fetch(`/api/proposals/${data.id}/menu-selection`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('No se ha podido enviar')
      setSent(true)
    } catch (e: any) {
      setError(e?.message || 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  const cssVars = {
    '--wp-primary': primary, '--wp-on-primary': onPrimary, '--wp-rgb': rgb,
    '--wp-bg': dark ? '#0d0d0d' : '#fafaf8', '--wp-card': dark ? '#141414' : '#ffffff',
    '--wp-border': dark ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.08)',
    '--wp-text': dark ? '#fff' : '#181410', '--wp-text-soft': dark ? 'rgba(255,255,255,.55)' : '#6a6560',
    '--wp-text-dim': dark ? 'rgba(255,255,255,.35)' : '#9a9590',
    '--wp-input': dark ? 'rgba(255,255,255,.04)' : '#ffffff',
    '--wp-shadow': dark ? 'none' : '0 2px 12px rgba(0,0,0,.05)',
  } as CSSProperties

  if (!menus.length && !extras?.length && !appetizers?.length) return null

  if (sent) {
    return (
      <section className={styles.wp} id="menu" style={cssVars}>
        <div className={styles.wpW} style={{ maxWidth: 640 }}>
          <div className={styles.wpOk}>
            <div className={styles.wpOkIcon}>✓</div>
            <h2 className={styles.wpOkH}>¡Recibido!</h2>
            <p className={styles.wpOkT}>Vuestra selección llegará al equipo en breve y os contactaremos para confirmar los detalles.</p>
          </div>
        </div>
      </section>
    )
  }

  // ── Helpers for menu content panel
  const renderMenuContent = (m: Menu, mIdx: number) => {
    const id = menuId(m, mIdx)
    const price = showMenuPrices ? getMenuPrice(m, weddingDate) : null
    const maxG = (m as any).max_guests as number | undefined
    return (
      <>
        {/* Header: name + price */}
        <div className={styles.wpMenuMainHead}>
          <div className={styles.wpMenuMainLeft}>
            <div className={styles.wpMenuMainName}>{m.name}</div>
            {m.subtitle && <div className={styles.wpMenuMainMeta}>{m.subtitle}</div>}
            {(m.min_guests || maxG) && (
              <span className={styles.wpMenuMainConstraint}>
                {m.min_guests && `Mín. ${m.min_guests}`}{m.min_guests && maxG && ' · '}{maxG && `Máx. ${maxG}`} invitados
              </span>
            )}
          </div>
          {(price && price !== '') || m.min_spend ? (
            <div className={styles.wpMenuMainPriceBlock}>
              {price && price !== '' && (
                <>
                  <div className={styles.wpMenuMainPriceVal}>{price.replace(/\s*€.*/, '')} <span style={{ fontSize: '1.1rem' }}>€</span></div>
                  <div className={styles.wpMenuMainPriceUnit}>por persona</div>
                </>
              )}
              {m.min_spend && <div className={styles.wpMenuMainMinSpend}>Gasto mín. {m.min_spend}</div>}
            </div>
          ) : null}
        </div>

        {/* Description (when no structured courses) */}
        {!m.courses?.length && m.description && (
          <p className={styles.wpMenuFreeText}>{m.description}</p>
        )}

        {/* Courses */}
        {(m.courses ?? []).map((c, ci) => (
          <CourseBlock
            key={ci}
            course={c}
            courseKey={`${id}-c${ci}`}
            selected={courseChoices[`${id}-c${ci}`] || []}
            onToggle={togglePick}
          />
        ))}

        {/* PDF link */}
        {m.pdf_url && (
          <a href={m.pdf_url} target="_blank" rel="noopener noreferrer" className={styles.wpPdfLink} style={{ display: 'inline-block', marginTop: 16, fontSize: '.82rem' }}>
            Ver menú completo (PDF) →
          </a>
        )}
      </>
    )
  }

  return (
    <section className={styles.wp} id="menu" style={cssVars}>
      <div className={styles.wpW}>

        {previewOnly && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--wp-primary)', background: 'rgba(var(--wp-rgb),.1)', padding: '4px 12px', borderRadius: 20 }}>
              Vista previa
            </span>
          </div>
        )}

        <FadeUp>
          <div className={styles.wpHead}>
            <span className={styles.wpTag}>Vuestra elección</span>
            <h2 className={styles.wpTitle}>Configura vuestra boda</h2>
            {!previewOnly && (
              <p className={styles.wpSub}>Elige el menú, los extras que queráis sumar y dejadnos vuestros comentarios. Cuando lo enviéis, recibiremos todos los detalles.</p>
            )}
          </div>
        </FadeUp>

        {/* Cóctel */}
        {(() => {
          const hasFoodExtras = extrasByCategory && COCKTAIL_CATS.some(cat => extrasByCategory[cat]?.length)
          const hasAppetizers = appetizers && appetizers.length > 0
          if (!hasAppetizers && !hasFoodExtras) return null
          return (
            <FadeUp>
              <div className={styles.wpSection}>
                <div className={styles.wpSectionN}>Cóctel de bienvenida</div>
                <h3 className={styles.wpSectionH}>Aperitivos y añadidos para vuestros invitados</h3>
                {hasAppetizers && (
                  <div style={{ marginBottom: hasFoodExtras ? 28 : 0 }}>
                    <div className={styles.wpXcatH} style={{ marginBottom: 12 }}>Incluidos en el menú</div>
                    {appetizers!.map((g, i) => (
                      <div key={i} className={styles.wpAppGroup}>
                        <div className={styles.wpAppLbl}>{g.label}</div>
                        <div className={styles.wpAppList}>{g.items.map((it, j) => <span key={j}>{it}</span>)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {hasFoodExtras && (
                  <div>
                    <div className={styles.wpXcatH} style={{ marginBottom: 12 }}>Añadidos opcionales</div>
                    {COCKTAIL_CATS.filter(cat => extrasByCategory![cat]?.length).map(cat => (
                      <div key={cat} className={styles.wpXcat}>
                        <div className={styles.wpXcatH}>{CATEGORY_LABELS[cat]}</div>
                        <div className={styles.wpXgrid}>
                          {extrasByCategory![cat]!.map(({ extra, key }) => {
                            const isSel = !!selectedExtras[key]
                            return (
                              <div key={key} className={cx(styles.wpX, isSel && styles.wpXsel)} onClick={() => setSelectedExtras(p => ({ ...p, [key]: !p[key] }))}>
                                <div className={styles.wpXcheck}>{isSel ? '✓' : ''}</div>
                                <div className={styles.wpXbody}>
                                  <div className={styles.wpXname}>{extra.name}</div>
                                  {extra.description && <div className={styles.wpXdesc}>{extra.description}</div>}
                                  <div className={styles.wpXprice}>{extra.price} <small>{extra.price_type === 'per_person' ? '/persona' : 'total'}</small></div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FadeUp>
          )
        })()}

        {/* ── Menús ─────────────────────────────────────────────────────── */}
        {menus.length > 0 && (
          <FadeUp>
            <div className={styles.wpSection}>
              <div className={styles.wpSectionN}>
                {menus.length > 1 ? 'Paso 1 · Elegid vuestros menús' : 'Paso 1 · Elegid vuestro menú'}
              </div>

              {/* ── SINGLE MENU ─────────────────────────────────────────── */}
              {menus.length === 1 && (() => {
                const m = menus[0]
                return (
                  <>
                    {/* Guest count control */}
                    <div className={styles.wpGuestRow}>
                      <div className={styles.wpGuestLabel}>
                        <span className={styles.wpGuestLabelMain}>Número de comensales</span>
                        {guestOverride !== null && guestOverride !== originalGuests
                          ? <button type="button" className={styles.wpGuestReset} onClick={() => setGuestOverride(null)}>Restablecer ({originalGuests} en propuesta)</button>
                          : <span className={styles.wpGuestHint}>Según la propuesta · ¿ha cambiado el número?</span>}
                      </div>
                      <div className={styles.wpStepper}>
                        <button type="button" className={styles.wpStepperBtn} onClick={() => setGuestOverride(g => Math.max(1, (g ?? originalGuests) - 1))}>−</button>
                        <span className={styles.wpStepperVal}>{guestTarget}</span>
                        <button type="button" className={styles.wpStepperBtn} onClick={() => setGuestOverride(g => (g ?? originalGuests) + 1)}>+</button>
                      </div>
                    </div>
                    {/* Menu content */}
                    <div style={{ background: 'var(--wp-card)', border: '1px solid var(--wp-border)', borderRadius: 14, padding: '28px 32px', boxShadow: 'var(--wp-shadow)' }}>
                      {renderMenuContent(m, 0)}
                    </div>
                  </>
                )
              })()}

              {/* ── MULTI MENU — split pane ──────────────────────────────── */}
              {menus.length > 1 && (() => {
                const selMenu = menus[Math.min(selectedMenuIdx, menus.length - 1)]
                return (
                  <>
                    <div className={styles.wpMenuPane}>
                      {/* Sidebar */}
                      <div className={styles.wpMenuSidebar}>
                        {menus.map((m, i) => {
                          const id = menuId(m, i)
                          const count = menuAllocations[id] || 0
                          const isSel = selectedMenuIdx === i
                          const mPrice = showMenuPrices ? getMenuPrice(m, weddingDate) : null
                          const maxG = (m as any).max_guests as number | undefined
                          return (
                            <div key={id}
                              className={cx(styles.wpMenuSidebarItem, isSel && styles.wpMenuSidebarItemSel)}
                              onClick={() => setSelectedMenuIdx(i)}>
                              <div className={styles.wpMenuSidebarInfo}>
                                <div className={styles.wpMenuSidebarName}>{m.name}</div>
                                {mPrice && mPrice !== '' && <div className={styles.wpMenuSidebarPrice}>{mPrice} /persona</div>}
                                {/* Stepper */}
                                <div className={styles.wpMenuSidebarAlloc} onClick={e => e.stopPropagation()}>
                                  <button type="button" className={styles.wpMenuSidebarStepBtn}
                                    onClick={() => setMenuAllocations(p => ({ ...p, [id]: Math.max(0, (p[id] || 0) - 1) }))}>−</button>
                                  <span className={styles.wpMenuSidebarStepVal}>{count}</span>
                                  <button type="button" className={styles.wpMenuSidebarStepBtn}
                                    onClick={() => { const next = (menuAllocations[id] || 0) + 1; if (!maxG || next <= maxG) setMenuAllocations(p => ({ ...p, [id]: next })) }}>+</button>
                                  <span style={{ fontSize: '.72rem', color: 'var(--wp-text-dim)', marginLeft: 2 }}>pax</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        {/* Sidebar footer: allocation summary */}
                        <div className={styles.wpMenuSidebarFoot}>
                          <span>{totalAllocated} / {guestTarget} pax</span>
                          {totalAllocated > 0 && totalAllocated === guestTarget && <span className={styles.wpMenuSidebarFootOk}>✓</span>}
                          {totalAllocated > guestTarget && <span className={styles.wpMenuSidebarFootOver}>+{totalAllocated - guestTarget}</span>}
                        </div>
                      </div>

                      {/* Right panel */}
                      <div className={styles.wpMenuMain}>
                        {renderMenuContent(selMenu, menus.indexOf(selMenu))}
                      </div>
                    </div>

                    {/* Guest target row below pane */}
                    <div className={styles.wpGuestRow} style={{ marginTop: 14 }}>
                      <div className={styles.wpGuestLabel}>
                        <span className={styles.wpGuestLabelMain}>Total de comensales</span>
                        {guestOverride !== null && guestOverride !== originalGuests
                          ? <button type="button" className={styles.wpGuestReset} onClick={() => setGuestOverride(null)}>Restablecer ({originalGuests} en propuesta)</button>
                          : <span className={styles.wpGuestHint}>Distribuye el número entre los menús</span>}
                      </div>
                      <div className={styles.wpStepper}>
                        <button type="button" className={styles.wpStepperBtn} onClick={() => setGuestOverride(g => Math.max(1, (g ?? originalGuests) - 1))}>−</button>
                        <span className={styles.wpStepperVal}>{guestTarget}</span>
                        <button type="button" className={styles.wpStepperBtn} onClick={() => setGuestOverride(g => (g ?? originalGuests) + 1)}>+</button>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </FadeUp>
        )}

        {/* Noche y madrugada */}
        {(() => {
          const resoponItems = extrasByCategory?.['resopon'] ?? []
          const openBarItems = extrasByCategory?.['open_bar'] ?? []
          if (!resoponItems.length && !openBarItems.length) return null
          const hasBoth = resoponItems.length > 0 && openBarItems.length > 0
          return (
            <FadeUp>
              <div className={styles.wpSection}>
                <div className={styles.wpSectionN}>Noche y madrugada</div>
                <h3 className={styles.wpSectionH}>Que la fiesta no pare</h3>
                {resoponItems.length > 0 && (
                  <div className={hasBoth ? styles.wpXcat : undefined}>
                    {hasBoth && <div className={styles.wpXcatH}>Resopón</div>}
                    <div className={styles.wpXgrid}>
                      {resoponItems.map(({ extra, key }) => {
                        const isSel = !!selectedExtras[key]
                        return (
                          <div key={key} className={cx(styles.wpX, isSel && styles.wpXsel)} onClick={() => setSelectedExtras(p => ({ ...p, [key]: !p[key] }))}>
                            <div className={styles.wpXcheck}>{isSel ? '✓' : ''}</div>
                            <div className={styles.wpXbody}>
                              <div className={styles.wpXname}>{extra.name}</div>
                              {extra.description && <div className={styles.wpXdesc}>{extra.description}</div>}
                              <div className={styles.wpXprice}>{extra.price} <small>{extra.price_type === 'per_person' ? '/persona' : 'total'}</small></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {openBarItems.length > 0 && (
                  <div className={styles.wpXcat}>
                    <div className={styles.wpXcatH}>Barra libre <span style={{ fontSize: '0.7em', fontWeight: 400, opacity: 0.65, marginLeft: 6 }}>elige una opción</span></div>
                    <div className={styles.wpXgrid}>
                      {openBarItems.map(({ extra, key }) => {
                        const isSel = !!selectedExtras[key]
                        const handleClick = () => setSelectedExtras(p => {
                          const next = { ...p }
                          openBarItems.forEach(ob => { next[ob.key] = false })
                          if (!p[key]) next[key] = true
                          return next
                        })
                        return (
                          <div key={key} className={cx(styles.wpX, isSel && styles.wpXsel)} onClick={handleClick}>
                            <div className={styles.wpXcheck}>{isSel ? '✓' : ''}</div>
                            <div className={styles.wpXbody}>
                              <div className={styles.wpXname}>{extra.name}</div>
                              {extra.description && <div className={styles.wpXdesc}>{extra.description}</div>}
                              <div className={styles.wpXprice}>{extra.price} <small>{extra.price_type === 'per_person' ? '/persona' : 'total'}</small></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </FadeUp>
          )
        })()}

        {/* Extras del evento */}
        {extrasByCategory && EVENT_CATS.some(cat => extrasByCategory[cat]?.length) && (
          <FadeUp>
            <div className={styles.wpSection}>
              <div className={styles.wpSectionN}>{menus.length > 0 ? 'Paso 2 · Extras del evento' : 'Extras del evento'}</div>
              <h3 className={styles.wpSectionH}>Personaliza vuestro día</h3>
              {EVENT_CATS.filter(cat => extrasByCategory![cat]?.length).map(cat => (
                <div key={cat} className={styles.wpXcat}>
                  <div className={styles.wpXcatH}>{CATEGORY_LABELS[cat]}</div>
                  <div className={styles.wpXgrid}>
                    {extrasByCategory![cat]!.map(({ extra, key }) => {
                      const isSel = !!selectedExtras[key]
                      const handleToggle = () => setSelectedExtras(p => {
                        if (cat === 'ceremony') {
                          const catKeys = extrasByCategory![cat]!.map(x => x.key)
                          const next: Record<string, boolean> = { ...p }
                          catKeys.forEach(k => { next[k] = false })
                          next[key] = !p[key]
                          return next
                        }
                        return { ...p, [key]: !p[key] }
                      })
                      return (
                        <div key={key} className={cx(styles.wpX, isSel && styles.wpXsel)} onClick={handleToggle}>
                          <div className={styles.wpXcheck}>{isSel ? '✓' : ''}</div>
                          <div className={styles.wpXbody}>
                            <div className={styles.wpXname}>{extra.name}</div>
                            {extra.description && <div className={styles.wpXdesc}>{extra.description}</div>}
                            <div className={styles.wpXprice}>{extra.price} <small>{extra.price_type === 'per_person' ? '/persona' : 'total'}</small></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </FadeUp>
        )}

        {/* Detalles finales */}
        {!previewOnly && (
          <FadeUp>
            <div className={styles.wpSection}>
              <div className={styles.wpSectionN}>{menus.length > 0 ? 'Paso 3 · Detalles finales' : 'Detalles finales'}</div>
              <h3 className={styles.wpSectionH}>Vuestros datos</h3>
              {dateIsFlexible && (
                <div style={{ marginBottom: 24 }}>
                  <label className={styles.wpLabel}>Fecha de la boda</label>
                  <div className={styles.wpDateWrap}>
                    <input type="date" className={cx(styles.wpInput, styles.wpDateInput)} value={localDate} onChange={e => setLocalDate(e.target.value)} />
                    {hasSeasonPrices && (
                      <div className={styles.wpDateNote}>{localDate ? 'Precio actualizado según la fecha elegida' : 'Selecciona una fecha — el precio puede variar por temporada'}</div>
                    )}
                  </div>
                </div>
              )}
              {menus.length === 0 && (
                <div style={{ marginBottom: 24 }}>
                  <label className={styles.wpLabel}>Número de invitados</label>
                  <div className={styles.wpGuests}>
                    <button type="button" className={styles.wpGbtn} onClick={() => setGuestOverride(g => Math.max(1, (g ?? originalGuests) - 5))}>−</button>
                    <input type="number" className={styles.wpInput} style={{ maxWidth: 100, textAlign: 'center' }} value={guests} onChange={e => setGuestOverride(Math.max(1, parseInt(e.target.value) || 1))} />
                    <button type="button" className={styles.wpGbtn} onClick={() => setGuestOverride(g => (g ?? originalGuests) + 5)}>+</button>
                  </div>
                  {guests !== originalGuests && <div className={cx(styles.wpGnote, styles.wpGnoteChanged)}>Estimación inicial: {originalGuests} invitados</div>}
                </div>
              )}
              <div>
                <label className={styles.wpLabel}>Comentarios o preguntas (opcional)</label>
                <textarea className={cx(styles.wpInput, styles.wpTa)} value={comments} onChange={e => setComments(e.target.value)} placeholder="Alergias, preferencias, cambios… todo lo que queráis contarnos." />
              </div>
            </div>
          </FadeUp>
        )}

        {/* Resumen + Total */}
        <FadeUp>
          <div className={styles.wpFooter}>
            <div className={styles.wpSumLines}>
              {menus.filter((m, i) => (effectiveAllocations[menuId(m, i)] || 0) > 0).map(m => {
                const i = menus.indexOf(m); const id = menuId(m, i)
                const count = effectiveAllocations[id]
                const amount = calcMenuAmount(m, count, weddingDate)
                const priceStr = getMenuPrice(m, weddingDate)
                const dimLabel = showMenuPrices ? (m.price_per_person ? `${priceStr} × ${count}` : m.min_spend ? `gasto mín. ${m.min_spend}` : '') : ''
                return (
                  <div key={id} className={styles.wpSumLine}>
                    <span className={styles.wpSumLineLbl}>
                      {m.name}
                      {menus.filter((_, j) => (effectiveAllocations[menuId(menus[j], j)] || 0) > 0).length > 1 && <span className={styles.wpSumLineDim}> · {count} personas</span>}
                      {dimLabel && <span className={styles.wpSumLineDim}> ({dimLabel})</span>}
                    </span>
                    <span className={styles.wpSumLineVal}>{showMenuPrices ? formatEuro(amount) : '—'}</span>
                  </div>
                )
              })}
              {menus.flatMap(m => {
                const i = menus.indexOf(m); const id = menuId(m, i)
                const count = effectiveAllocations[id] || 0
                if (!count) return []
                return (m.courses ?? []).flatMap((c, ci) =>
                  (courseChoices[`${id}-c${ci}`] || []).map(name => {
                    const item = c.items.find(it => it.name === name)
                    if (!item?.extra_price) return null
                    const supPrice = parsePrice(item.extra_price)
                    if (!supPrice) return null
                    return (
                      <div key={`${id}-c${ci}-${name}`} className={styles.wpSumLine}>
                        <span className={styles.wpSumLineLbl}>Suplemento · {item.name} <span className={styles.wpSumLineDim}>(+{item.extra_price} × {count})</span></span>
                        <span className={styles.wpSumLineVal}>{formatEuro(supPrice * count)}</span>
                      </div>
                    )
                  }).filter(Boolean)
                )
              })}
              {extras?.map((e, i) => {
                const key = extraId(e, i)
                if (!selectedExtras[key]) return null
                const p = parsePrice(e.price)
                const amount = e.price_type === 'per_person' ? p * guests : p
                return (
                  <div key={key} className={styles.wpSumLine}>
                    <span className={styles.wpSumLineLbl}>{e.name} <span className={styles.wpSumLineDim}>({e.price}{e.price_type === 'per_person' ? ` × ${guests}` : ''})</span></span>
                    <span className={styles.wpSumLineVal}>{formatEuro(amount)}</span>
                  </div>
                )
              })}
              <div className={styles.wpSumTotal}>
                <span className={styles.wpSumTotalLbl}>
                  Total estimado
                  {(() => { const lbl = ivaLabel(data.sections_data ?? null); return lbl ? <small style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> ({lbl})</small> : null })()}
                </span>
                <span className={styles.wpSumTotalVal}>{formatEuro(total)}</span>
              </div>
              <div className={styles.wpSumNote}>* Estimación orientativa. El precio final puede variar según disponibilidad y condiciones.</div>
            </div>
            {!previewOnly && (
              <div className={styles.wpFootAction}>
                <button className={styles.wpBtn} onClick={handleSubmit}
                  disabled={sending || (menus.length > 1 && totalAllocated === 0) || missingChoices.length > 0}>
                  {sending ? 'Enviando…' : 'Enviar nuestra selección →'}
                </button>
                {menus.length > 1 && totalAllocated === 0 && !error && <div className={styles.wpErr}>Asigna invitados a al menos un menú</div>}
                {missingChoices.length > 0 && !error && <div className={styles.wpErr}>Faltan opciones en: {missingChoices.join(', ')}</div>}
                {error && <div className={styles.wpErr}>{error}</div>}
              </div>
            )}
          </div>
        </FadeUp>

      </div>
    </section>
  )
}

// ─── Course sub-component ─────────────────────────────────────────────────────

function CourseBlock({ course, courseKey, selected, onToggle }: {
  course: MenuCourse; courseKey: string; selected: string[]
  onToggle: (key: string, name: string, mode: 'pick_one' | 'pick_n', count: number) => void
}) {
  const mode = course.mode || 'fixed'
  const pickCount = course.pick_count || 1
  const picked = selected.length
  const hint = mode === 'pick_one' ? 'Escoge 1'
    : mode === 'pick_n' ? (picked >= pickCount ? `✓ ${picked} de ${pickCount} seleccionados` : `Escoge ${pickCount} (${picked}/${pickCount})`) : null

  return (
    <div className={styles.wpCourse}>
      <div className={styles.wpCourseLbl}>
        {course.label}
        {hint && <span className={styles.wpCourseHint}>· {hint}</span>}
      </div>
      <div className={styles.wpCourseItems}>
        {course.items.map((item, i) => {
          if (mode === 'fixed') {
            return (
              <div key={i} className={styles.wpItem}>
                <span className={styles.wpItemBullet}>•</span>
                <div className={styles.wpItemBody}>
                  <div className={styles.wpItemName}>{item.name}</div>
                  {item.description && <div className={styles.wpItemDesc}>{item.description}</div>}
                </div>
                {item.extra_price && <span className={styles.wpItemExtra}>+{item.extra_price}/pers.</span>}
              </div>
            )
          }
          const isSel = selected.includes(item.name)
          const isRadio = mode === 'pick_one'
          return (
            <div key={i} className={cx(styles.wpItem, styles.wpItemPick, isSel && styles.wpItemPickSel)}
              onClick={() => onToggle(courseKey, item.name, mode as 'pick_one' | 'pick_n', pickCount)}>
              <div className={cx(styles.wpItemCheck, isRadio && styles.wpItemCheckRound)} aria-hidden="true">
                {isRadio ? <span className={styles.wpItemCheckDot} /> : <span className={styles.wpItemCheckTick}>✓</span>}
              </div>
              <div className={styles.wpItemBody}>
                <div className={styles.wpItemName}>{item.name}</div>
                {item.description && <div className={styles.wpItemDesc}>{item.description}</div>}
              </div>
              {item.extra_price && <span className={styles.wpItemExtra}>+{item.extra_price}/pers.</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
  // Quedarnos con la parte numérica (dígitos + separadores). Soporta formatos ES ("1.500,50"), EN ("1,500.50") y simples ("1500", "8 €").
  const m = s.match(/[\d.,]+/)
  if (!m) return 0
  let t = m[0]
  const lastDot = t.lastIndexOf('.')
  const lastComma = t.lastIndexOf(',')
  if (lastDot !== -1 && lastComma !== -1) {
    // El separador decimal es el ÚLTIMO que aparece
    if (lastComma > lastDot) t = t.replace(/\./g, '').replace(',', '.')
    else                     t = t.replace(/,/g, '')
  } else if (lastComma !== -1) {
    const after = t.length - lastComma - 1
    t = after === 3 ? t.replace(',', '') : t.replace(',', '.')
  } else if (lastDot !== -1) {
    const after = t.length - lastDot - 1
    if (after === 3) t = t.replace('.', '') // miles → eliminar
    // Si no, mantener como decimal
  }
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

function formatEuro(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function legacyToMenu(legacy: { name: string; price_per_person: string; description?: string; min_guests?: number }, idx: number): Menu {
  return {
    id: `legacy-${idx}`,
    name: legacy.name,
    price_per_person: legacy.price_per_person,
    description: legacy.description,
    min_guests: legacy.min_guests,
  }
}

function menuId(m: Menu, idx: number): string {
  return m.id || `menu-${idx}`
}

function extraId(e: MenuExtra, idx: number): string {
  return e.id || `extra-${idx}`
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

const CATEGORY_LABELS: Record<MenuExtra['category'], string> = {
  station: 'Estaciones y buffets',
  resopon: 'Resopón',
  ceremony: 'Ceremonia',
  audiovisual: 'Audiovisual',
  music: 'Música',
  other: 'Otros',
}

const CATEGORY_ORDER: MenuExtra['category'][] = ['ceremony', 'station', 'resopon', 'music', 'audiovisual', 'other']

// ─── Component ─────────────────────────────────────────────────────────────────

export function WeddingProposal({
  data,
  menus: menusInput,
  extras,
  appetizers,
  legacyMenus,
  primary,
  onPrimary,
  dark = false,
}: {
  data: ProposalData
  menus: Menu[] | null
  extras: MenuExtra[] | null
  appetizers: AppetizerGroup[] | null
  legacyMenus?: Array<{ name: string; price_per_person: string; description?: string; min_guests?: number }>
  primary: string
  onPrimary: string
  dark?: boolean
}) {
  const rgb = toRgb(primary)

  // Build menus: preferir nuevos estructurados; si no, fallback a legacy
  const menus: Menu[] = useMemo(() => {
    if (menusInput && menusInput.length) return menusInput
    if (legacyMenus && legacyMenus.length) return legacyMenus.map(legacyToMenu)
    return []
  }, [menusInput, legacyMenus])

  const originalGuests = data.guest_count ?? 100
  const [guests, setGuests] = useState<number>(originalGuests)
  const [selectedMenu, setSelectedMenu] = useState<string | null>(() => (menus[0] ? menuId(menus[0], 0) : null))
  const [courseChoices, setCourseChoices] = useState<Record<string, string[]>>({})
  const [selectedExtras, setSelectedExtras] = useState<Record<string, boolean>>({})
  const [comments, setComments] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = menus.find((m, i) => menuId(m, i) === selectedMenu) || null

  // ── Totales en vivo
  const total = useMemo(() => {
    const menuPrice = current ? parsePrice(current.price_per_person) * guests : 0
    let extrasTotal = 0
    if (extras) {
      extras.forEach((e, i) => {
        if (!selectedExtras[extraId(e, i)]) return
        const p = parsePrice(e.price)
        extrasTotal += e.price_type === 'per_person' ? p * guests : p
      })
    }
    // Cursos con extra_price por item
    if (current?.courses) {
      current.courses.forEach((c, ci) => {
        const ckey = `${selectedMenu}-c${ci}`
        const picks = courseChoices[ckey] || []
        picks.forEach(name => {
          const item = c.items.find(it => it.name === name)
          if (item?.extra_price) extrasTotal += parsePrice(item.extra_price) * guests
        })
      })
    }
    return menuPrice + extrasTotal
  }, [current, guests, extras, selectedExtras, courseChoices, selectedMenu])

  // ── Valida que todos los cursos variables tengan selección
  const missingChoices = useMemo<string[]>(() => {
    if (!current?.courses) return []
    const missing: string[] = []
    current.courses.forEach((c, ci) => {
      if (!c.mode || c.mode === 'fixed') return
      const ckey = `${selectedMenu}-c${ci}`
      const picks = courseChoices[ckey] || []
      const expected = c.mode === 'pick_one' ? 1 : (c.pick_count || 1)
      if (picks.length < expected) missing.push(c.label)
    })
    return missing
  }, [current, selectedMenu, courseChoices])

  // ── Agrupa extras por categoría
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

  // ── Handlers
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
    if (!selectedMenu) { setError('Elige un menú antes de enviar'); return }
    if (missingChoices.length) { setError(`Faltan opciones en: ${missingChoices.join(', ')}`); return }
    setSending(true)
    try {
      const payload = {
        proposal_id: data.id,
        selected_menu_id: selectedMenu,
        selected_menu_name: current?.name,
        guest_count: guests,
        original_guest_count: originalGuests,
        guest_count_changed: guests !== originalGuests,
        course_choices: courseChoices,
        selected_extras: Object.entries(selectedExtras).filter(([, v]) => v).map(([k]) => k),
        comments,
        estimated_total: total,
      }
      const res = await fetch(`/api/proposals/${data.id}/menu-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('No se ha podido enviar')
      setSent(true)
    } catch (e: any) {
      setError(e?.message || 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  // ── CSS variables para tematización dinámica
  const cssVars = {
    '--wp-primary': primary,
    '--wp-on-primary': onPrimary,
    '--wp-rgb': rgb,
    '--wp-bg': dark ? '#0d0d0d' : '#fafaf8',
    '--wp-card': dark ? '#141414' : '#ffffff',
    '--wp-border': dark ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.08)',
    '--wp-text': dark ? '#fff' : '#181410',
    '--wp-text-soft': dark ? 'rgba(255,255,255,.55)' : '#6a6560',
    '--wp-text-dim': dark ? 'rgba(255,255,255,.35)' : '#9a9590',
    '--wp-input': dark ? 'rgba(255,255,255,.04)' : '#ffffff',
    '--wp-shadow': dark ? 'none' : '0 2px 12px rgba(0,0,0,.05)',
  } as CSSProperties

  // ── Empty state
  if (!menus.length && !extras?.length && !appetizers?.length) {
    return null
  }

  // ── Success state
  if (sent) {
    return (
      <section className={styles.wp} id="menu" style={cssVars}>
        <div className={styles.wpW} style={{ maxWidth: 640 }}>
          <div className={styles.wpOk}>
            <div className={styles.wpOkIcon}>✓</div>
            <h2 className={styles.wpOkH}>¡Recibido!</h2>
            <p className={styles.wpOkT}>
              Vuestra selección llegará al equipo en breve y os contactaremos para confirmar los detalles.
            </p>
          </div>
        </div>
      </section>
    )
  }

  const menuPriceAmount = current ? parsePrice(current.price_per_person) * guests : 0

  return (
    <section className={styles.wp} id="menu" style={cssVars}>
      <div className={styles.wpW}>

        <FadeUp>
          <div className={styles.wpHead}>
            <span className={styles.wpTag}>Vuestra elección</span>
            <h2 className={styles.wpTitle}>Configura vuestra boda</h2>
            <p className={styles.wpSub}>
              Elige el menú, los extras que queráis sumar y dejadnos vuestros comentarios. Cuando lo enviéis, recibiremos todos los detalles.
            </p>
          </div>
        </FadeUp>

        {/* Aperitivos base */}
        {appetizers && appetizers.length > 0 && (
          <FadeUp>
            <div className={styles.wpSection}>
              <div className={styles.wpSectionN}>Aperitivos incluidos</div>
              <h3 className={styles.wpSectionH}>Bienvenida para vuestros invitados</h3>
              {appetizers.map((g, i) => (
                <div key={i} className={styles.wpAppGroup}>
                  <div className={styles.wpAppLbl}>{g.label}</div>
                  <div className={styles.wpAppList}>
                    {g.items.map((it, j) => <span key={j}>{it}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </FadeUp>
        )}

        {/* Split pane: lista de menús + detalle */}
        {menus.length > 0 && (
          <FadeUp>
            <div className={styles.wpSplit}>
              <aside className={styles.wpList}>
                <div className={styles.wpListH}>Paso 1 · Elegid vuestro menú</div>
                {menus.map((m, i) => {
                  const id = menuId(m, i)
                  const sel = id === selectedMenu
                  return (
                    <div key={id}
                      className={cx(styles.wpListItem, sel && styles.wpListItemSel)}
                      onClick={() => setSelectedMenu(id)}>
                      <div className={styles.wpListDot} />
                      <div className={styles.wpListBody}>
                        <div className={styles.wpListName}>{m.name}</div>
                        <div className={styles.wpListPrice}>{m.price_per_person} /persona</div>
                      </div>
                    </div>
                  )
                })}
              </aside>

              <div className={styles.wpDetail}>
                {!current && (
                  <div className={styles.wpDetailEmpty}>Selecciona un menú para ver su detalle.</div>
                )}

                {current && (
                  <>
                    <div className={styles.wpDetailHead}>
                      <div>
                        <h3 className={styles.wpDetailName}>{current.name}</h3>
                        {current.subtitle && <p className={styles.wpDetailSub}>{current.subtitle}</p>}
                        {current.min_guests && (
                          <div className={styles.wpDetailMin}>Mín. {current.min_guests} invitados</div>
                        )}
                      </div>
                      <div className={styles.wpDetailPrice}>
                        {current.price_per_person}
                        <small>por persona</small>
                      </div>
                    </div>

                    {current.courses && current.courses.length > 0 ? (
                      current.courses.map((c, ci) => (
                        <CourseBlock
                          key={ci}
                          course={c}
                          courseKey={`${selectedMenu}-c${ci}`}
                          selected={courseChoices[`${selectedMenu}-c${ci}`] || []}
                          onToggle={togglePick}
                        />
                      ))
                    ) : current.description ? (
                      <>
                        <p className={styles.wpMenuFreeText}>{current.description}</p>
                        {current.pdf_url && (
                          <a href={current.pdf_url} target="_blank" rel="noopener noreferrer" className={styles.wpPdfLink}>
                            Ver menú completo (PDF) →
                          </a>
                        )}
                      </>
                    ) : current.pdf_url ? (
                      <a href={current.pdf_url} target="_blank" rel="noopener noreferrer" className={styles.wpPdfLink}>
                        Ver menú completo (PDF) →
                      </a>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </FadeUp>
        )}

        {/* Extras */}
        {extrasByCategory && Object.keys(extrasByCategory).length > 0 && (
          <FadeUp>
            <div className={styles.wpSection}>
              <div className={styles.wpSectionN}>Paso 2 · Añadidos opcionales</div>
              <h3 className={styles.wpSectionH}>Personaliza vuestro día</h3>
              {CATEGORY_ORDER.filter(cat => extrasByCategory[cat]?.length).map(cat => (
                <div key={cat} className={styles.wpXcat}>
                  <div className={styles.wpXcatH}>{CATEGORY_LABELS[cat]}</div>
                  <div className={styles.wpXgrid}>
                    {extrasByCategory[cat]!.map(({ extra, key }) => {
                      const isSel = !!selectedExtras[key]
                      const exclusiveCat = cat === 'ceremony'
                      const handleToggle = () => {
                        setSelectedExtras(p => {
                          if (exclusiveCat) {
                            // En ceremony sólo una opción puede estar seleccionada a la vez
                            const catKeys = extrasByCategory![cat]!.map(x => x.key)
                            const next: Record<string, boolean> = { ...p }
                            catKeys.forEach(k => { next[k] = false })
                            next[key] = !p[key]
                            return next
                          }
                          return { ...p, [key]: !p[key] }
                        })
                      }
                      return (
                        <div key={key}
                          className={cx(styles.wpX, isSel && styles.wpXsel)}
                          onClick={handleToggle}>
                          <div className={styles.wpXcheck}>{isSel ? '✓' : ''}</div>
                          <div className={styles.wpXbody}>
                            <div className={styles.wpXname}>{extra.name}</div>
                            {extra.description && <div className={styles.wpXdesc}>{extra.description}</div>}
                            <div className={styles.wpXprice}>
                              {extra.price} <small>{extra.price_type === 'per_person' ? '/persona' : 'total'}</small>
                            </div>
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

        {/* Invitados + comentarios */}
        <FadeUp>
          <div className={styles.wpSection}>
            <div className={styles.wpSectionN}>Paso 3 · Detalles finales</div>
            <h3 className={styles.wpSectionH}>Vuestros datos</h3>

            <div style={{ marginBottom: 24 }}>
              <label className={styles.wpLabel}>Número de invitados</label>
              <div className={styles.wpGuests}>
                <button type="button" className={styles.wpGbtn} onClick={() => setGuests(g => Math.max(1, g - 5))}>−</button>
                <input type="number" className={styles.wpInput} style={{ maxWidth: 100, textAlign: 'center' }}
                  value={guests} onChange={e => setGuests(Math.max(1, parseInt(e.target.value) || 1))} />
                <button type="button" className={styles.wpGbtn} onClick={() => setGuests(g => g + 5)}>+</button>
              </div>
              {guests !== originalGuests && (
                <div className={cx(styles.wpGnote, styles.wpGnoteChanged)}>
                  Estimación inicial: {originalGuests} invitados
                </div>
              )}
            </div>

            <div>
              <label className={styles.wpLabel}>Comentarios o preguntas (opcional)</label>
              <textarea className={cx(styles.wpInput, styles.wpTa)}
                value={comments} onChange={e => setComments(e.target.value)}
                placeholder="Alergias, preferencias, cambios… todo lo que queráis contarnos." />
            </div>
          </div>
        </FadeUp>

        {/* Resumen + Presupuesto al final */}
        <FadeUp>
          <div className={styles.wpFooter}>
            <div className={styles.wpSumLines}>
              {current && (
                <div className={styles.wpSumLine}>
                  <span className={styles.wpSumLineLbl}>
                    {current.name} <span className={styles.wpSumLineDim}>({current.price_per_person} × {guests})</span>
                  </span>
                  <span className={styles.wpSumLineVal}>{formatEuro(menuPriceAmount)}</span>
                </div>
              )}
              {/* Suplementos de platos escogidos (pick_one / pick_n) */}
              {current?.courses?.flatMap((c, ci) => {
                const ckey = `${selectedMenu}-c${ci}`
                const picks = courseChoices[ckey] || []
                return picks.map(name => {
                  const item = c.items.find(it => it.name === name)
                  if (!item?.extra_price) return null
                  const supPrice = parsePrice(item.extra_price)
                  if (!supPrice) return null
                  const amount = supPrice * guests
                  return (
                    <div key={`${ckey}-${name}`} className={styles.wpSumLine}>
                      <span className={styles.wpSumLineLbl}>
                        Suplemento · {item.name} <span className={styles.wpSumLineDim}>(+{item.extra_price} × {guests})</span>
                      </span>
                      <span className={styles.wpSumLineVal}>{formatEuro(amount)}</span>
                    </div>
                  )
                })
              })}
              {extras?.map((e, i) => {
                const key = extraId(e, i)
                if (!selectedExtras[key]) return null
                const p = parsePrice(e.price)
                const amount = e.price_type === 'per_person' ? p * guests : p
                return (
                  <div key={key} className={styles.wpSumLine}>
                    <span className={styles.wpSumLineLbl}>
                      {e.name} <span className={styles.wpSumLineDim}>({e.price}{e.price_type === 'per_person' ? ` × ${guests}` : ''})</span>
                    </span>
                    <span className={styles.wpSumLineVal}>{formatEuro(amount)}</span>
                  </div>
                )
              })}
              <div className={styles.wpSumTotal}>
                <span className={styles.wpSumTotalLbl}>
                  Total estimado
                  {(() => {
                    const sec = (data as any).sections_data
                    const lbl = ivaLabel(sec)
                    return lbl ? <small style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> ({lbl})</small> : null
                  })()}
                </span>
                <span className={styles.wpSumTotalVal}>{formatEuro(total)}</span>
              </div>
              <div className={styles.wpSumNote}>
                * Estimación orientativa. El precio final puede variar según disponibilidad y condiciones.
              </div>
            </div>

            <div className={styles.wpFootAction}>
              <button className={styles.wpBtn} onClick={handleSubmit} disabled={sending || !selectedMenu}>
                {sending ? 'Enviando…' : 'Enviar nuestra selección →'}
              </button>
              {error && <div className={styles.wpErr}>{error}</div>}
            </div>
          </div>
        </FadeUp>

      </div>
    </section>
  )
}

// ─── Course sub-component ─────────────────────────────────────────────────────

function CourseBlock({
  course, courseKey, selected, onToggle,
}: {
  course: MenuCourse
  courseKey: string
  selected: string[]
  onToggle: (key: string, name: string, mode: 'pick_one' | 'pick_n', count: number) => void
}) {
  const mode = course.mode || 'fixed'
  const pickCount = course.pick_count || 1
  const picked = selected.length
  const hint = mode === 'pick_one'
    ? 'Escoge 1'
    : mode === 'pick_n'
      ? (picked >= pickCount ? `✓ ${picked} de ${pickCount} seleccionados` : `Escoge ${pickCount} (${picked}/${pickCount})`)
      : null

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
            <div key={i}
              className={cx(styles.wpItem, styles.wpItemPick, isSel && styles.wpItemPickSel)}
              onClick={() => onToggle(courseKey, item.name, mode as 'pick_one' | 'pick_n', pickCount)}>
              <div className={cx(styles.wpItemCheck, isRadio && styles.wpItemCheckRound)} aria-hidden="true">
                {isRadio
                  ? <span className={styles.wpItemCheckDot} />
                  : <span className={styles.wpItemCheckTick}>✓</span>}
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

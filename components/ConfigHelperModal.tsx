'use client'

import { useState } from 'react'
import { X, Building2, BedDouble, Users, Package, CreditCard, Layers, LayoutGrid, Check, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'

type ConfigType = 'space' | 'lodging'
type SpaceType  = 'single' | 'single_with_supplements' | 'multiple_independent'
type PriceModel = 'rental' | 'per_person' | 'package'

type Result = {
  config_type: ConfigType
  space_type?: SpaceType
  price_model?: PriceModel
  reasoning: string[]
  suggested_name: string
}

export default function ConfigHelperModal({
  onClose,
  onApply,
}: {
  onClose: () => void
  onApply: (result: { config_type: ConfigType; space_type?: SpaceType; price_model?: PriceModel; suggested_name: string }) => void
}) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<{
    propuesta?: 'evento' | 'alojamiento' | 'ambos'
    eventoTipo?: 'boda' | 'corporativo' | 'social' | 'mice'
    incluye_menu?: 'si' | 'no'
    organizacion?: 'un_espacio' | 'base_zonas' | 'multiples'
    cobro?: 'tarifa_fija' | 'por_persona' | 'paquete'
  }>({})

  const back = () => setStep(s => Math.max(0, s - 1))

  const setAnswer = <K extends keyof typeof answers>(key: K, value: typeof answers[K]) => {
    setAnswers(prev => ({ ...prev, [key]: value }))
    setTimeout(() => setStep(s => s + 1), 150)
  }

  // ── Derive result based on answers ──
  const computeResult = (): Result => {
    if (answers.propuesta === 'alojamiento') {
      return {
        config_type: 'lodging',
        reasoning: [
          'Has indicado que vendes alojamiento independiente.',
          'Necesitas catalogar tipos de habitación con precios por noche.',
          'No se mezcla con modalidades de evento.',
        ],
        suggested_name: 'Alojamiento principal',
      }
    }
    // Espacio
    const space_type: SpaceType =
      answers.organizacion === 'multiples' ? 'multiple_independent' :
      answers.organizacion === 'base_zonas' ? 'single_with_supplements' :
      'single'

    const price_model: PriceModel =
      answers.cobro === 'paquete'     ? 'package' :
      answers.cobro === 'por_persona' ? 'per_person' :
      'rental'

    const reasoning: string[] = []
    if (answers.eventoTipo === 'boda')         reasoning.push('Para bodas suele funcionar bien una config con su modalidad típica (día completo).')
    if (answers.eventoTipo === 'corporativo')  reasoning.push('Eventos corporativos suelen ser de menor duración (½ día / día).')
    if (answers.eventoTipo === 'social')       reasoning.push('Eventos sociales (cumple, bautizo) suelen ser por tramos horarios.')
    if (answers.eventoTipo === 'mice')         reasoning.push('MICE necesita modalidades específicas (plenaria + breakouts, coffee breaks).')

    if (space_type === 'single')                  reasoning.push('Espacio único: el cliente paga por todo el venue sin elegir zonas.')
    if (space_type === 'single_with_supplements') reasoning.push('Base + zonas: hay un núcleo incluido y zonas opcionales con suplemento.')
    if (space_type === 'multiple_independent')    reasoning.push('Grupos independientes: el cliente combina zonas dentro de grupos.')

    if (price_model === 'rental')     reasoning.push('Alquiler: precio fijo del espacio.')
    if (price_model === 'per_person') reasoning.push('Por persona: el total escala con asistentes.')
    if (price_model === 'package')    reasoning.push('Paquete: precio cerrado todo incluido.')

    if (answers.incluye_menu === 'si') reasoning.push('El menú irá dentro de la plantilla del dossier, no en esta config.')

    const tipoLabel = answers.eventoTipo === 'boda' ? 'Bodas' :
                      answers.eventoTipo === 'corporativo' ? 'Corporativo' :
                      answers.eventoTipo === 'social' ? 'Eventos sociales' :
                      answers.eventoTipo === 'mice' ? 'MICE' : 'Eventos'

    return {
      config_type: 'space',
      space_type, price_model,
      reasoning,
      suggested_name: tipoLabel,
    }
  }

  // ── Questions tree ──
  const Q = [
    // 0
    {
      question: '¿Qué tipo de propuesta vas a configurar?',
      hint: 'Define qué oferta principal vendes con esta configuración.',
      options: [
        { key: 'evento',       label: 'Eventos en el espacio',     sub: 'Bodas, corporativos, celebraciones', Icon: Building2 },
        { key: 'alojamiento',  label: 'Solo alojamiento',          sub: 'Habitaciones, retiros, grupos',     Icon: BedDouble },
      ],
      onPick: (k: string) => setAnswer('propuesta', k as any),
    },
    // 1 — only if evento
    {
      question: '¿Qué tipo de evento principal?',
      hint: 'Esto orienta la modalidad por defecto que crearás después.',
      options: [
        { key: 'boda',         label: 'Bodas',         sub: 'Día completo, alta inversión',          Icon: Sparkles },
        { key: 'corporativo',  label: 'Corporativo',   sub: 'Empresas, lanzamientos, galas',         Icon: Building2 },
        { key: 'social',       label: 'Sociales',      sub: 'Cumpleaños, bautizos, comuniones',      Icon: Users },
        { key: 'mice',         label: 'MICE',          sub: 'Congresos, formación, ferias',          Icon: LayoutGrid },
      ],
      onPick: (k: string) => setAnswer('eventoTipo', k as any),
    },
    // 2
    {
      question: '¿Tu venue incluye el menú/catering?',
      hint: 'No afecta a esta config, pero te diremos cómo manejarlo después.',
      options: [
        { key: 'si', label: 'Sí',  sub: 'Ofrecemos catering propio u obligatorio',          Icon: Check },
        { key: 'no', label: 'No',  sub: 'Solo alquilamos el espacio, catering aparte',     Icon: X },
      ],
      onPick: (k: string) => setAnswer('incluye_menu', k as any),
    },
    // 3
    {
      question: '¿Cómo está organizado tu espacio?',
      hint: 'Esto determina si el cliente elige zonas o paga por todo.',
      options: [
        { key: 'un_espacio',  label: 'Un único espacio',           sub: 'Todo o nada — sin zonas a elegir',           Icon: Building2 },
        { key: 'base_zonas',  label: 'Base + zonas opcionales',     sub: 'Núcleo incluido + zonas con suplemento',     Icon: Layers },
        { key: 'multiples',   label: 'Grupos de espacios',          sub: 'Cliente combina varias salas en grupos',     Icon: LayoutGrid },
      ],
      onPick: (k: string) => setAnswer('organizacion', k as any),
    },
    // 4
    {
      question: '¿Cómo cobras principalmente?',
      hint: 'El modelo principal — luego puedes tener tarifas distintas por temporada.',
      options: [
        { key: 'tarifa_fija',  label: 'Alquiler fijo',      sub: 'Precio cerrado por el espacio',          Icon: CreditCard },
        { key: 'por_persona',  label: 'Por persona',         sub: 'Total varía según comensales',           Icon: Users },
        { key: 'paquete',      label: 'Paquete cerrado',     sub: 'Todo incluido por persona o evento',     Icon: Package },
      ],
      onPick: (k: string) => setAnswer('cobro', k as any),
    },
  ]

  // ── Question flow ──
  const visibleSteps = (() => {
    if (answers.propuesta === 'alojamiento') return [0]  // lodging: only Q0
    if (answers.propuesta === 'evento')      return [0, 1, 2, 3, 4]
    return [0]
  })()

  const isDone = (
    answers.propuesta === 'alojamiento' ||
    (answers.propuesta === 'evento' && answers.eventoTipo && answers.incluye_menu && answers.organizacion && answers.cobro)
  )

  const currentQ = step < Q.length ? Q[Math.min(step, visibleSteps.length - 1)] : null

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={16} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--charcoal)' }}>¿Qué configuración necesito?</div>
              <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>
                {isDone ? 'Recomendación lista' : `Paso ${step + 1} de ${visibleSteps.length}`}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4, display: 'flex' }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px' }}>
          {!isDone && currentQ && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>{currentQ.question}</div>
              <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 16 }}>{currentQ.hint}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {currentQ.options.map(opt => {
                  const Icon = opt.Icon
                  return (
                    <button key={opt.key} onClick={() => currentQ.onPick(opt.key)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff', border: '1.5px solid var(--ivory)', borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.background = 'var(--cream)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ivory)'; e.currentTarget.style.background = '#fff' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={17} style={{ color: 'var(--gold)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)' }}>{opt.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{opt.sub}</div>
                      </div>
                      <ChevronRight size={15} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                    </button>
                  )
                })}
              </div>
              {step > 0 && (
                <button onClick={back} style={{ marginTop: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', fontSize: 12, padding: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ChevronLeft size={13} /> Volver atrás
                </button>
              )}
            </>
          )}

          {isDone && (() => {
            const r = computeResult()
            const spaceLabel = r.space_type ? ({ single: 'Espacio único', single_with_supplements: 'Base + zonas opcionales', multiple_independent: 'Grupos de espacios' }[r.space_type] ?? '') : ''
            const priceLabel = r.price_model ? ({ rental: 'Alquiler fijo', per_person: 'Por persona', package: 'Paquete cerrado' }[r.price_model] ?? '') : ''
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Check size={18} style={{ color: '#467A60' }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--charcoal)' }}>Recomendación</span>
                </div>
                <div style={{ background: 'var(--cream)', border: '1px solid var(--ivory)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Configuración sugerida</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {r.config_type === 'lodging' ? <BedDouble size={18} style={{ color: 'var(--gold)' }} /> : <Building2 size={18} style={{ color: 'var(--gold)' }} />}
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--charcoal)' }}>{r.config_type === 'lodging' ? 'Alojamiento' : 'Espacio'}</span>
                  </div>
                  {r.config_type === 'space' && (
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>
                      <strong style={{ color: 'var(--charcoal)' }}>{spaceLabel}</strong> · <strong style={{ color: 'var(--charcoal)' }}>{priceLabel}</strong>
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 4 }}>Nombre sugerido: <strong style={{ color: 'var(--charcoal)' }}>{r.suggested_name}</strong></div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Por qué</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                  {r.reasoning.map((line, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--espresso)', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--gold)', flexShrink: 0, marginTop: 2 }}>•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--ivory)' }}>
                  <button onClick={() => { setStep(0); setAnswers({}) }}
                    style={{ background: 'none', border: '1px solid var(--ivory)', borderRadius: 6, padding: '7px 14px', fontSize: 12, color: 'var(--warm-gray)', cursor: 'pointer', fontWeight: 600 }}>
                    Empezar de nuevo
                  </button>
                  <button onClick={() => onApply({ config_type: r.config_type, space_type: r.space_type, price_model: r.price_model, suggested_name: r.suggested_name })}
                    style={{ background: 'var(--gold)', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12, color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                    Crear esta configuración <ChevronRight size={13} />
                  </button>
                </div>
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

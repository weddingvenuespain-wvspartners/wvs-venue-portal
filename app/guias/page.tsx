'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import Sidebar from '@/components/Sidebar'
import { Search, ChevronDown, ChevronUp, Clock, User, Link2, BarChart3, Download, Building2, Upload, FileText, Palette, Mail, CreditCard, Star, ArrowUpCircle } from 'lucide-react'

type Guide = {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  readTime: string
  category: string
  content: string
}

const guides: Guide[] = [
  // Primeros pasos
  {
    id: 'configura-perfil',
    icon: <User size={18} />,
    title: 'Configura tu perfil',
    description: 'Aprende a completar tu perfil profesional para que sea más atractivo y aumentes tu visibilidad.',
    readTime: '3 min',
    category: 'Primeros pasos',
    content: `Tu perfil es la base de todo lo que haces en el portal. Un perfil completo genera más confianza y te ayuda a obtener mejores resultados con cada lead que recibes.

Para empezar, dirígete a Configuración y completa los campos de información personal: tu nombre o el del responsable del venue, teléfono de contacto y la URL de tu web. Estos datos aparecerán en las propuestas que envíes a las parejas, así que asegúrate de que estén actualizados.

En la sección de preferencias puedes configurar tu zona horaria (recomendamos Europe/Madrid para venues en España), el idioma y el formato de fecha. Estas preferencias afectan a cómo se muestran las fechas en los leads y en el calendario. Una vez configurado todo, el indicador de perfil completo en la parte superior te mostrará el porcentaje de completitud.`,
  },
  {
    id: 'conecta-ficha',
    icon: <Link2 size={18} />,
    title: 'Conecta tu ficha del venue',
    description: 'Vincula tu perfil de WordPress con el portal para recibir leads directamente desde tu ficha.',
    readTime: '4 min',
    category: 'Primeros pasos',
    content: `La ficha del venue en Wedding Venues Spain es el punto de entrada de la mayoría de tus leads. Para que el portal funcione correctamente, es necesario que tu perfil esté vinculado al ID de WordPress de tu ficha.

Si ya tienes una ficha publicada en nuestra plataforma, el equipo de Wedding Venues Spain te asignará el ID de WordPress correspondiente. Verás confirmado el número de ID en la sección "Venue asignado" de tu perfil (Configuración > Perfil personal). Una vez vinculado, los leads que lleguen a través de tu ficha aparecerán automáticamente en el módulo de Leads.

Si aún no tienes ficha o necesitas que te asignen el ID, contacta con tu gestor en hola@weddingvenuesspain.com. Indica tu nombre de venue y la URL de tu ficha existente. El proceso de vinculación tarda menos de 24 horas laborables.`,
  },
  {
    id: 'entiende-dashboard',
    icon: <BarChart3 size={18} />,
    title: 'Entiende el dashboard',
    description: 'Una visión general de las métricas más importantes para gestionar tu venue de forma eficiente.',
    readTime: '5 min',
    category: 'Primeros pasos',
    content: `El dashboard es tu centro de mando. Desde aquí puedes ver de un vistazo todo lo que está pasando con tu venue: nuevos leads, estado de las propuestas, próximos eventos en el calendario y el estado de tu suscripción.

En la parte superior encontrarás las estadísticas principales: número de leads recibidos, propuestas enviadas, tasa de apertura de propuestas y eventos próximos. Estas métricas se actualizan en tiempo real cada vez que carga la página.

El bloque de leads recientes te muestra las últimas solicitudes ordenadas por fecha, con el nombre de la pareja, la fecha prevista de boda y el estado del lead. Puedes hacer clic en cualquier lead para ver el detalle completo o cambiar su estado en el pipeline. El objetivo es mantener este panel limpio: procesa los leads nuevos a medida que lleguen para que no se acumulen sin gestionar.`,
  },

  // Leads
  {
    id: 'como-recibir-leads',
    icon: <Download size={18} />,
    title: 'Cómo recibir leads',
    description: 'Descubre cómo llegan los leads a tu portal y qué puedes hacer para recibir más consultas.',
    readTime: '4 min',
    category: 'Leads',
    content: `Los leads llegan a tu portal de dos formas principales: desde el formulario de contacto de tu ficha en Wedding Venues Spain y desde los enlaces directos en tus propuestas personalizadas. Cada vez que una pareja rellena el formulario de tu ficha, recibirás una notificación por email (si lo tienes activado en Configuración > Notificaciones) y el lead aparecerá automáticamente en el módulo de Leads.

Para maximizar el número de leads de calidad, asegúrate de que tu ficha esté completa y actualizada: fotos de alta calidad, descripción detallada, capacidad y precios orientativos. Los venues con fichas más completas reciben hasta un 40% más de consultas según nuestros datos internos.

Otro factor importante es la velocidad de respuesta. Los leads con respuesta en las primeras 2 horas tienen una tasa de conversión significativamente mayor. Activa las notificaciones de nuevo lead en Configuración > Notificaciones para no perderte ninguna consulta.`,
  },
  {
    id: 'gestiona-pipeline',
    icon: <Building2 size={18} />,
    title: 'Gestiona el pipeline',
    description: 'Aprende a mover leads por el pipeline para mantener un seguimiento efectivo de cada consulta.',
    readTime: '5 min',
    category: 'Leads',
    content: `El pipeline de leads es tu herramienta principal para gestionar el seguimiento de cada consulta. Está organizado en cinco columnas: Nuevo, Contactado, Visita, Propuesta y Cerrado. Cada columna representa una etapa del proceso comercial.

Cuando llega un nuevo lead, aparece en la columna "Nuevo". Lo primero que debes hacer es revisarlo y moverlo a "Contactado" una vez que hayas enviado una respuesta. Puedes arrastrar las tarjetas entre columnas para actualizar el estado, o hacerlo desde el detalle del lead con el selector de estado.

Para una gestión eficiente, intenta procesar los leads en el mismo día que llegan. Un flujo de trabajo recomendado es: recibir el lead → contactar en menos de 2 horas → programar visita → enviar propuesta → cerrar. Los leads sin actividad durante más de 7 días tienden a enfriarse. Utiliza las notas internas del lead para registrar los puntos clave de cada conversación.`,
  },
  {
    id: 'exportar-leads',
    icon: <Upload size={18} />,
    title: 'Exportar leads a Excel',
    description: 'Exporta tu base de leads en formato CSV para análisis externos o integración con tu CRM.',
    readTime: '2 min',
    category: 'Leads',
    content: `Si tienes un plan Premium, puedes exportar todos tus leads en formato CSV directamente desde el módulo de Leads. Busca el botón "Exportar CSV" en la parte superior derecha de la tabla de leads.

El archivo exportado incluye todos los campos de cada lead: nombre de la pareja, email, teléfono, fecha de boda, número de invitados, presupuesto estimado, estado en el pipeline, notas y fechas de creación y actualización. Este formato es compatible con Microsoft Excel, Google Sheets y la mayoría de CRMs del mercado.

Puedes usar esta exportación para hacer análisis de tendencias (fechas de boda más solicitadas, presupuesto medio, etc.), para crear listas de seguimiento en herramientas externas, o simplemente como copia de seguridad de tus datos. Recuerda tratar estos datos con la confidencialidad que requiere la normativa RGPD.`,
  },

  // Propuestas
  {
    id: 'primera-propuesta',
    icon: <FileText size={18} />,
    title: 'Crea tu primera propuesta',
    description: 'Paso a paso para crear una propuesta personalizada impactante para una pareja concreta.',
    readTime: '6 min',
    category: 'Propuestas',
    content: `Las propuestas personalizadas son una de las herramientas más poderosas del plan Premium. Una propuesta bien construida puede marcar la diferencia entre ganar o perder una boda.

Para crear tu primera propuesta, ve al módulo de Propuestas y haz clic en "Nueva propuesta". Selecciona el lead al que va dirigida o crea una propuesta sin lead asociado. El editor te guiará por las secciones principales: presentación del venue, servicios incluidos, precios, disponibilidad y siguiente paso.

El contenido más importante es la sección de presentación: escribe en primera persona, dirígete a la pareja por su nombre (si lo sabes), y destaca los aspectos del venue que más se alineen con lo que buscan. Evita los textos genéricos copiados de la web. Una propuesta personalizada que menciona los detalles específicos de la pareja (número de invitados, fecha prevista, estilo de boda) convierte mucho mejor. Cuando esté lista, envíasela con un enlace único y recibirás una notificación cuando la abran.`,
  },
  {
    id: 'personaliza-diseno',
    icon: <Palette size={18} />,
    title: 'Personaliza el diseño',
    description: 'Ajusta los colores, tipografías y estructura de tus propuestas para reflejar la identidad de tu venue.',
    readTime: '4 min',
    category: 'Propuestas',
    content: `Cada propuesta puede personalizarse para que refleje la imagen de tu venue. En el editor de propuestas encontrarás opciones de personalización en el panel lateral derecho.

Puedes ajustar la paleta de colores principal (recomendamos usar los colores corporativos de tu venue), subir tu logo, seleccionar una plantilla base entre las disponibles (elegante, minimalista, rústico, contemporáneo) y editar cada sección de contenido de forma independiente.

Las fotos son clave. Incluye al menos 5-8 imágenes de alta calidad que muestren diferentes espacios y momentos del venue: la entrada, el salón principal, los jardines, un banquete montado y detalles de decoración. Las propuestas con más fotos tienen tasas de apertura y tiempo de visualización significativamente mayores. Recuerda que puedes previsualizar cómo verá la propuesta la pareja antes de enviarla.`,
  },
  {
    id: 'envia-cliente',
    icon: <Mail size={18} />,
    title: 'Envía al cliente',
    description: 'Aprende a enviar la propuesta, hacer seguimiento y gestionar las respuestas de los clientes.',
    readTime: '3 min',
    category: 'Propuestas',
    content: `Una vez que tu propuesta esté lista, puedes enviársela a la pareja de varias formas. La más habitual es copiar el enlace único de la propuesta y enviarlo por email o WhatsApp directamente. El enlace funciona sin que la pareja necesite crear ninguna cuenta.

Recibirás una notificación automática cuando la pareja abra la propuesta por primera vez (si tienes las notificaciones activadas). Esto es muy útil para hacer seguimiento en el momento justo: espera unas horas después de que la abran y luego contacta con ellos para resolver dudas y dar el siguiente paso.

Si la pareja tiene preguntas, puede escribirte directamente desde el chat integrado en la propuesta. Recibirás sus mensajes en el módulo de Comunicación. El objetivo de la propuesta no es cerrar la venta, sino conseguir que pidan una visita o una videollamada. Asegúrate de que tu llamada a la acción (CTA) sea clara y directa: "Solicitar visita", "Reservar llamada" o "Confirmar disponibilidad".`,
  },

  // Suscripción
  {
    id: 'diferencias-planes',
    icon: <Star size={18} />,
    title: 'Diferencias entre planes',
    description: 'Compara el plan Básico y Premium para saber qué funcionalidades incluye cada uno.',
    readTime: '3 min',
    category: 'Suscripción',
    content: `El portal de Wedding Venues Spain ofrece dos planes: Básico y Premium. Ambos incluyen acceso a la gestión de tu ficha, el módulo de leads y el calendario de eventos.

El plan Básico está pensado para venues que están empezando o que gestionan un volumen bajo de consultas. Incluye la gestión de leads con el pipeline visual, el calendario de disponibilidad y el acceso básico al dashboard.

El plan Premium añade las funcionalidades más avanzadas: propuestas personalizadas con editor visual, el módulo de comunicación para responder mensajes desde la propuesta, estadísticas detalladas de rendimiento, exportación de leads a CSV y soporte prioritario. Si recibes más de 10-15 leads al mes, el plan Premium te amortiza rápidamente por la mejora en la tasa de conversión que aportan las propuestas personalizadas.`,
  },
  {
    id: 'actualizar-plan',
    icon: <ArrowUpCircle size={18} />,
    title: 'Cómo actualizar tu plan',
    description: 'Pasos para solicitar el upgrade de Básico a Premium a través de tu gestor.',
    readTime: '2 min',
    category: 'Suscripción',
    content: `Para actualizar tu plan de Básico a Premium, el proceso es sencillo y lo gestiona directamente tu gestor de cuenta en Wedding Venues Spain.

Desde el portal, ve a Configuración > Plan y uso y haz clic en el botón "Solicitar upgrade". Esto abrirá un email pre-rellenado para tu gestor. También puedes escribir directamente a hola@weddingvenuesspain.com indicando que quieres pasar a Premium.

Tu gestor te confirmará las condiciones del plan, el precio y la forma de pago (por domiciliación SEPA o transferencia). Una vez gestionado el pago, el upgrade se activa en menos de 24 horas y todas las funcionalidades Premium aparecerán disponibles automáticamente en tu portal sin necesidad de hacer ninguna configuración adicional.`,
  },
  {
    id: 'gestion-facturacion',
    icon: <CreditCard size={18} />,
    title: 'Gestiona tu facturación',
    description: 'Dónde encontrar tu historial de pagos y cómo gestionar tu método de pago.',
    readTime: '2 min',
    category: 'Suscripción',
    content: `Puedes consultar todo tu historial de facturación desde Configuración > Facturación. Aquí verás un registro cronológico de todos los eventos de tu suscripción: activación, pagos recibidos, cambios de plan y cualquier nota de tu gestor.

Los pagos se gestionan manualmente a través de tu gestor de cuenta, no hay ninguna pasarela de pago automatizada en el portal. Esto nos permite ser más flexibles con las condiciones de pago y adaptarnos a las necesidades de cada venue.

Si necesitas actualizar tu método de pago, solicitar una factura o tienes cualquier consulta sobre tu suscripción, contacta directamente con tu gestor en hola@weddingvenuesspain.com. Incluye en el asunto "Gestión de suscripción" para que se derive al departamento correcto de forma rápida.`,
  },
]

const categories = ['Primeros pasos', 'Leads', 'Propuestas', 'Suscripción']

export default function GuiasPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { isBlocked } = useRequireSubscription()
  const [search, setSearch] = useState('')
  const [openGuide, setOpenGuide] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user]) // eslint-disable-line

  if (isBlocked) return null

  if (loading || !user) return null

  const filtered = guides.filter(g =>
    !search ||
    g.title.toLowerCase().includes(search.toLowerCase()) ||
    g.description.toLowerCase().includes(search.toLowerCase()) ||
    g.category.toLowerCase().includes(search.toLowerCase())
  )

  const toggleGuide = (id: string) => {
    setOpenGuide(prev => prev === id ? null : id)
  }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Centro de ayuda</div>
        </div>
        <div className="page-content">

          {/* Search bar */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ position: 'relative', maxWidth: 480 }}>
              <Search size={15} style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--warm-gray)', pointerEvents: 'none',
              }} />
              <input
                className="form-input"
                type="text"
                placeholder="Buscar guías..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 36, maxWidth: 480 }}
              />
            </div>
            {search && (
              <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 8 }}>
                {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para &quot;{search}&quot;
              </div>
            )}
          </div>

          {/* Categories */}
          {categories.map(category => {
            const catGuides = filtered.filter(g => g.category === category)
            if (catGuides.length === 0) return null

            return (
              <div key={category} style={{ marginBottom: 36 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '.12em',
                  textTransform: 'uppercase', color: 'var(--warm-gray)',
                  marginBottom: 12,
                }}>
                  {category}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {catGuides.map(guide => {
                    const isOpen = openGuide === guide.id
                    return (
                      <div
                        key={guide.id}
                        className="card"
                        style={{ overflow: 'hidden' }}
                      >
                        {/* Card header — always visible */}
                        <div
                          onClick={() => toggleGuide(guide.id)}
                          style={{
                            padding: '16px 20px',
                            display: 'flex', alignItems: 'center', gap: 16,
                            cursor: 'pointer',
                            background: isOpen ? 'var(--cream)' : 'transparent',
                          }}
                        >
                          <div style={{
                            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                            background: 'var(--cream)', border: '1px solid var(--ivory)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 20,
                          }}>
                            {guide.icon}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)', marginBottom: 3 }}>
                              {guide.title}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
                              {guide.description}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                            <span style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              fontSize: 11, color: 'var(--stone)',
                            }}>
                              <Clock size={11} /> {guide.readTime}
                            </span>
                            <span style={{
                              fontSize: 11, fontWeight: 600,
                              color: isOpen ? 'var(--gold)' : 'var(--warm-gray)',
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}>
                              {isOpen ? (
                                <><ChevronUp size={14} /> Cerrar</>
                              ) : (
                                <><ChevronDown size={14} /> Leer guía</>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Expanded content */}
                        {isOpen && (
                          <div style={{
                            borderTop: '1px solid var(--ivory)',
                            padding: '20px 24px',
                            background: '#fff',
                          }}>
                            {guide.content.split('\n\n').map((paragraph, i) => (
                              <p key={i} style={{
                                fontSize: 14, color: 'var(--charcoal)',
                                lineHeight: 1.8, marginBottom: i < guide.content.split('\n\n').length - 1 ? 16 : 0,
                              }}>
                                {paragraph}
                              </p>
                            ))}
                            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--ivory)', display: 'flex', gap: 8 }}>
                              <span style={{ fontSize: 11, color: 'var(--stone)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={11} /> Lectura: {guide.readTime}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--stone)' }}>·</span>
                              <span style={{ fontSize: 11, color: 'var(--stone)' }}>{guide.category}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--warm-gray)' }}>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Search size={32} style={{ color: 'var(--warm-gray)' }} /></div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No se encontraron guías</div>
              <div style={{ fontSize: 12 }}>Intenta con otro término de búsqueda</div>
            </div>
          )}

          {/* CTA contacto */}
          <div style={{
            marginTop: 40, padding: '20px 24px', borderRadius: 12,
            background: 'linear-gradient(135deg, #fef9ec, #fef3c7)',
            border: '1px solid #fde68a',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
                ¿No encuentras lo que buscas?
              </div>
              <div style={{ fontSize: 13, color: '#b45309' }}>
                Nuestro equipo está disponible para ayudarte con cualquier consulta.
              </div>
            </div>
            <a
              href="mailto:hola@weddingvenuesspain.com?subject=Consulta%20desde%20el%20Centro%20de%20Ayuda"
              className="btn btn-primary btn-sm"
              style={{ textDecoration: 'none', flexShrink: 0 }}
            >
              Contactar soporte →
            </a>
          </div>

        </div>
      </div>
    </div>
  )
}

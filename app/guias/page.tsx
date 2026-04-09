'use client'
import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import {
  Search, BookOpen, Calendar, Users, CreditCard,
  MessageCircle, ChevronDown, ChevronUp, Mail,
  HelpCircle, CheckCircle, Zap,
} from 'lucide-react'

const QUICK_LINKS = [
  { iconKey: 'users',    title: 'Primeros pasos',       desc: 'Configura tu perfil y empieza a recibir leads',          color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  { iconKey: 'pipeline', title: 'Gestión de leads',     desc: 'Entiende el pipeline y estados de cada lead',            color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { iconKey: 'calendar', title: 'Calendario',           desc: 'Gestiona disponibilidad, visitas y reservas',            color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  { iconKey: 'zap',      title: 'Propuestas digitales', desc: 'Crea y envía propuestas profesionales',                  color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { iconKey: 'billing',  title: 'Facturación',          desc: 'Planes, facturas y gestión de suscripción',              color: '#be185d', bg: '#fdf2f8', border: '#fbcfe8' },
  { iconKey: 'chat',     title: 'Soporte directo',      desc: 'Habla con el equipo de Wedding Venues Spain',           color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
]

function getIcon(key: string) {
  if (key === 'calendar') return <Calendar size={20} />
  if (key === 'zap')      return <Zap size={20} />
  if (key === 'billing')  return <CreditCard size={20} />
  if (key === 'chat')     return <MessageCircle size={20} />
  return <Users size={20} />
}

const FAQS = [
  {
    q: '¿Cómo añado un nuevo lead?',
    a: 'Desde el dashboard, haz clic en "Nuevo lead" (botón dorado arriba a la derecha). También puedes ir a la sección Leads y usar el mismo botón. Se abrirá un formulario donde introduces nombre, email, teléfono, fecha estimada y presupuesto.',
  },
  {
    q: '¿Cómo funciona el pipeline de leads?',
    a: 'Los leads pasan por varios estados: Nuevo → En seguimiento → Visita agendada → Post-visita → Presupuesto enviado → Confirmado. Puedes mover un lead entre estados usando los botones de acción en cada fila del pipeline.',
  },
  {
    q: '¿Cómo confirmo una boda?',
    a: 'Cuando un lead está listo para confirmar, haz clic en el botón verde "Confirmar boda". Se abrirá el calendario para seleccionar la fecha exacta. Una vez confirmada, el lead pasa a Confirmado y la fecha queda reservada en tu calendario.',
  },
  {
    q: '¿Puedo cambiar la fecha de boda de un lead confirmado?',
    a: 'Sí. Abre el detalle del lead (clic en la fila) y verás la fecha de boda con un botón "Cambiar fecha". También puedes hacerlo desde el Calendario haciendo clic en la fecha reservada.',
  },
  {
    q: '¿Qué diferencia hay entre plan básico y premium?',
    a: 'El plan básico incluye gestión de leads, calendario y ficha de venue. El plan premium añade propuestas digitales personalizadas, estadísticas avanzadas, comunicación automatizada y acceso prioritario a nuevas funciones.',
  },
  {
    q: '¿Cómo envío una propuesta digital?',
    a: 'Disponible en plan Premium. Haz clic en "Presupuesto" de cualquier lead y selecciona "Presupuesto digital". Se abrirá el editor donde puedes elegir plantilla, personalizar el contenido y enviar el enlace al cliente.',
  },
  {
    q: '¿Cómo cancelo una reserva de boda?',
    a: 'Desde el tab Confirmados, abre el lead y haz clic en "Cancelar boda". También puedes ir al Calendario, hacer clic en la fecha reservada y usar el botón "Cancelar boda". La fecha quedará libre automáticamente.',
  },
  {
    q: '¿Dónde veo mis facturas?',
    a: 'En Configuración → Facturación encontrarás el historial completo de pagos, el plan activo y las opciones para actualizar tu método de pago o cambiar de plan.',
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid var(--ivory)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)', lineHeight: 1.4 }}>{q}</span>
        <span style={{ flexShrink: 0, color: 'var(--warm-gray)' }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      {open && (
        <div style={{ paddingBottom: 16, fontSize: 13, color: 'var(--charcoal)', lineHeight: 1.7 }}>{a}</div>
      )}
    </div>
  )
}

export default function GuiasPage() {
  const [search, setSearch] = useState('')
  const filtered = FAQS.filter(f =>
    !search || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Centro de ayuda</div>
        </div>
        <div className="page-content" style={{ maxWidth: 860, margin: '0 auto' }}>

          {/* Hero */}
          <div style={{ background: 'linear-gradient(135deg,#fdf8ee,#fef3d0)', border: '1px solid #f0d98a', borderRadius: 16, padding: '32px 36px', marginBottom: 24, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(201,150,58,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HelpCircle size={24} style={{ color: 'var(--gold)' }} />
              </div>
            </div>
            <div style={{ fontFamily: 'Manrope,sans-serif', fontSize: 22, fontWeight: 700, color: 'var(--espresso)', marginBottom: 6 }}>
              ¿En qué podemos ayudarte?
            </div>
            <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 20 }}>
              Guías, preguntas frecuentes y soporte del equipo de Wedding Venues Spain
            </div>
            <div style={{ position: 'relative', maxWidth: 420, margin: '0 auto' }}>
              <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Busca en las preguntas frecuentes..."
                style={{ width: '100%', paddingLeft: 38, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 10, border: '1px solid #e5ddd5', fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Quick links */}
          {!search && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
              {QUICK_LINKS.map((item, i) => (
                <div key={i}
                  style={{ background: item.bg, border: `1px solid ${item.border}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer', transition: 'transform 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, marginBottom: 10 }}>
                    {getIcon(item.iconKey)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)', marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--warm-gray)', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          )}

          {/* FAQ */}
          <div className="card" style={{ padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <BookOpen size={16} style={{ color: 'var(--gold)' }} />
              <div style={{ fontFamily: 'Manrope,sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--espresso)' }}>Preguntas frecuentes</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 20 }}>
              {search ? `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''} para "${search}"` : `${FAQS.length} preguntas`}
            </div>
            {filtered.length > 0
              ? filtered.map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a} />)
              : <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--warm-gray)', fontSize: 13 }}>Sin resultados para &ldquo;{search}&rdquo;</div>
            }
          </div>

          {/* Contact */}
          <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #86efac', borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                <CheckCircle size={15} style={{ color: '#16a34a' }} />
                <span style={{ fontFamily: 'Manrope,sans-serif', fontSize: 14, fontWeight: 700, color: '#15803d' }}>¿Necesitas más ayuda?</span>
              </div>
              <div style={{ fontSize: 12.5, color: '#166534', lineHeight: 1.5 }}>El equipo responde en menos de 24 horas en días laborables.</div>
            </div>
            <a href="mailto:soporte@weddingvenuespain.com"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
              <Mail size={14} /> Escribir al soporte
            </a>
          </div>

        </div>
      </div>
    </div>
  )
}

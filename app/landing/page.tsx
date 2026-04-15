'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Check, ChevronRight, Menu, X as XIcon,
  ChevronDown, ArrowRight, ArrowUpRight,
  BarChart3, Building2, Globe,
} from 'lucide-react'
import { FEATURE_DEFS, type PlanFeatures } from '@/lib/use-plan-features'
import type { BillingCycle } from '@/lib/billing-types'

type Plan = {
  id: string; name: string; display_name: string | null
  description: string | null; billing_cycles: BillingCycle[]
  is_active: boolean; visible_on_web: boolean
}
type Lang = 'en' | 'es'

// ─── Translations ─────────────────────────────────────────────────────────────
const TRANSLATIONS = {
  en: {
    nav: {
      features: 'Features', pricing: 'Pricing', contact: 'Contact',
      login: 'Sign in', register: 'Get started free',
    },
    hero: {
      line1: 'Your venue', line2: 'deserves more', line3: 'weddings.',
      sub: 'The platform that connects your spaces with couples from around the world. Centralise leads, digital proposals and availability in one place.',
      cta: 'Start free — 14 days', ctaSub: 'See how it works',
      stats: [
        { value: '20+', label: 'venues in Spain' },
        { value: '5,000+', label: 'interested couples' },
        { value: '14 days', label: 'free trial' },
      ],
    },
    problems: {
      eyebrow: 'The problem',
      title: "What's holding your venue back",
      items: [
        { n: '01', title: 'Leads slipping through the cracks', desc: 'Couples contact multiple venues at once. Without a centralised panel, replies arrive too late — and by the time you respond, they\'ve chosen someone else.' },
        { n: '02', title: 'Availability managed by hand', desc: 'Dates in spreadsheets, on paper or from memory. Mistakes cost bookings, and double confirmations damage your reputation.' },
        { n: '03', title: 'International couples don\'t find you', desc: 'Spain is a destination wedding hotspot for thousands of European and American couples every year. Without the right presence, that market simply doesn\'t exist for you.' },
        { n: '04', title: 'A PDF doesn\'t sell your venue — an experience does', desc: 'Your spaces deserve more than an email attachment. Interactive digital proposals convert up to 3× more than a static PDF.' },
      ],
    },
    how: {
      eyebrow: 'How it works',
      title: 'Up and running in', titleItalic: 'under 10 minutes',
      sub: 'No complex setup. No technical know-how required. Just your venue, ready to receive leads.',
      cta: 'Start now',
      steps: [
        { n: '1', t: 'Create your account', d: 'Sign up and set up your venue with photos, capacity and rates. Your listing goes live on the directory.' },
        { n: '2', t: 'Centralise your leads', d: 'Every enquiry lands in your panel. Reply, follow up and send digital proposals in minutes.' },
        { n: '3', t: 'Convert more weddings', d: 'Clear pipeline, impressive proposals and an up-to-date calendar. Close more bookings — including from international couples.' },
      ],
    },
    features: {
      eyebrow: 'The platform',
      title: 'Everything you need,', titleItalic: 'in one place',
      sub: 'A platform built for wedding venues in Spain, with everything you need to grow and convert more.',
      items: [
        { label: 'LEAD MANAGEMENT', img: 'leads',
          title: 'Never lose a couple again by responding too late',
          desc: 'Centralise every enquiry from the directory, your website or WhatsApp in one intuitive panel. Visual pipeline, advanced filters and fast replies to close more bookings.',
          bullets: ['Unified enquiry panel', 'Visual pipeline by stage', 'Filters and CSV export', 'Full history per couple'] },
        { label: 'DIGITAL PROPOSALS', img: 'prop',
          title: 'From forgotten PDF to a proposal that sells',
          desc: 'Create interactive web proposals — with gallery, rates and options — that couples can explore on any device and accept with one click. Especially effective for international couples.',
          bullets: ['Professional design in minutes', 'Integrated photo gallery', 'Perfect for the international market', 'Online acceptance with one click'] },
        { label: 'CALENDAR', img: 'cal',
          title: 'Your availability, always up to date',
          desc: 'Block dates, confirm bookings and eliminate double bookings for good. Couples see your real availability without needing to call or wait for a reply.',
          bullets: ['Clear monthly view', 'Block dates with one click', 'Zero double bookings', 'Automatic sync'] },
      ],
      mini: [
        { emoji: '📊', t: 'Stats & analytics', d: 'Leads received, conversions and trends. Understand what works and fine-tune your strategy.' },
        { emoji: '🏛️', t: 'Full venue listing', d: 'Your space presented professionally: capacity, photos, services and pricing.' },
        { emoji: '🌍', t: 'International visibility', d: 'Reach couples from across Europe and the Americas looking for venues in Spain for their destination wedding.' },
      ],
    },
    testimonials: {
      eyebrow: 'Testimonials',
      title: 'What our', titleItalic: 'venues say',
      sub: 'Real venues that have already transformed the way they work.',
      items: [
        { letter: 'C', q: 'Since using the Partner Portal, we haven\'t missed a single lead. The centralised panel gives us total visibility and we respond much faster than before. Our conversion rate has improved noticeably.', name: 'Carmen R.', role: 'Director · Finca Los Olivos, Málaga' },
        { letter: 'P', q: 'Digital proposals have been a game changer. International couples understand everything at a glance and ask far fewer questions. Conversion has gone up visibly.', name: 'Pablo M.', role: 'Owner · Hacienda Santa María, Seville' },
        { letter: 'I', q: 'The calendar was our biggest headache. Now everything is centralised, updated in real time, and we\'ve never had a double booking. It saves us hours every week.', name: 'Isabel T.', role: 'Manager · Cortijo La Ermita, Granada' },
      ],
    },
    pricing: {
      eyebrow: 'Pricing',
      title: 'Simple plans,', titleItalic: 'no surprises',
      sub: 'Choose the plan that best fits your venue',
      trial: '14-day free trial — no commitment, no card',
      monthly: 'Monthly', annual: 'Annual', save: 'Save 2 months',
      perYear: '/year', perMonth: '/month', billedAnnually: '/month billed annually',
      recommended: 'Recommended',
      cta: 'Start free',
    },
    featureLabels: [
      // Basic
      { key: 'ficha',                  label: 'Venue listing' },
      { key: 'leads',                  label: 'Lead management' },
      { key: 'leads_date_filter',      label: 'Filter leads by date' },
      { key: 'calendario',             label: 'Availability calendar' },
      { key: 'estadisticas',           label: 'Basic analytics' },
      // Premium
      { key: 'leads_export',           label: 'Export leads to CSV' },
      { key: 'pipeline',               label: 'Sales pipeline' },
      { key: 'propuestas',             label: 'Digital proposals' },
      { key: 'propuestas_web',         label: 'Public proposal page' },
      { key: 'propuestas_pdf',         label: 'Proposal PDF download' },
      { key: 'comunicacion',           label: 'Rates & pricing zones' },
      { key: 'estadisticas_avanzadas', label: 'Advanced analytics' },
      { key: 'recordatorios',          label: 'Automatic reminders' },
      { key: 'multiusuario',           label: 'Multiple users' },
      { key: 'soporte_prioritario',    label: 'Priority support' },
    ] as { key: keyof PlanFeatures; label: string }[],
    faq: {
      eyebrow: 'FAQ',
      title: 'Frequently asked', titleItalic: 'questions',
      items: [
        { q: 'Do I need technical skills to use the platform?', a: 'No. The platform is designed to be intuitive from day one. In under 10 minutes you can have your venue set up and ready to receive leads.' },
        { q: 'Can I cancel at any time?', a: 'Yes, you can cancel at any time without penalties. You keep access until the end of the paid period.' },
        { q: 'Do the proposals work for international couples?', a: 'Absolutely. Web proposals are accessible from any device in any language. Write the content in English, French or whichever language you need.' },
        { q: 'Does it work with my existing website?', a: 'Yes. You can share your venue listing and proposals via a link from any website, social media or email.' },
        { q: 'What happens when the 14-day trial ends?', a: 'Choose the plan that best fits your venue. If you decide not to continue, cancel at no cost. No surprises.' },
        { q: 'Can I manage multiple venues from one account?', a: 'Yes. If you manage more than one space, we can set up multiple venues under the same account. Contact us for more information.' },
      ],
    },
    cta: {
      title: 'Ready to fill up', titleItalic: 'with weddings?',
      sub: 'Join the best wedding venues in Spain. Attract more couples — including international ones.',
      btn: 'Create free account', btnSub: 'Already have an account',
      fine: 'No credit card · Cancel anytime · Support in English & Spanish',
    },
    footer: {
      tagline: 'The management platform for wedding venues in Spain',
      cookies: 'Cookies', privacy: 'Privacy',
      copy: '© 2026 Wedding Venues Spain. All rights reserved.',
    },
  },

  es: {
    nav: {
      features: 'Funcionalidades', pricing: 'Planes', contact: 'Contacto',
      login: 'Iniciar sesión', register: 'Empieza gratis',
    },
    hero: {
      line1: 'Tu venue', line2: 'merece más', line3: 'bodas.',
      sub: 'La plataforma que conecta tus espacios con parejas de todo el mundo. Centraliza leads, propuestas digitales y disponibilidad desde un solo lugar.',
      cta: 'Empieza gratis — 14 días', ctaSub: 'Ver cómo funciona',
      stats: [
        { value: '20+', label: 'venues en España' },
        { value: '5.000+', label: 'parejas interesadas' },
        { value: '14 días', label: 'prueba gratuita' },
      ],
    },
    problems: {
      eyebrow: 'El problema',
      title: 'Lo que frena a tu venue hoy mismo',
      items: [
        { n: '01', title: 'Leads que se pierden entre emails y WhatsApp', desc: 'Las parejas contactan varios venues a la vez. Sin un panel centralizado, la respuesta llega tarde — y cuando llegas tú, ya eligieron otro.' },
        { n: '02', title: 'Tu disponibilidad vive en un Excel o en tu cabeza', desc: 'Cada consulta requiere revisar manualmente. Los errores cuestan reservas, y las dobles confirmaciones dañan tu reputación.' },
        { n: '03', title: 'Las parejas internacionales no te encuentran', desc: 'España es destino de bodas para miles de parejas europeas y americanas cada año. Sin la presencia adecuada, ese mercado no existe para ti.' },
        { n: '04', title: 'Un PDF no vende tu venue — una experiencia sí', desc: 'Tus espacios merecen más que un archivo adjunto. Las propuestas digitales interactivas convierten hasta 3 veces más que un PDF estático.' },
      ],
    },
    how: {
      eyebrow: 'Cómo funciona',
      title: 'En marcha en', titleItalic: 'menos de 10 minutos',
      sub: 'Sin configuraciones complicadas. Sin conocimientos técnicos. Solo tu venue, listo para recibir leads.',
      cta: 'Empezar ahora',
      steps: [
        { n: '1', t: 'Crea tu cuenta', d: 'Regístrate y configura tu venue con fotos, capacidad y tarifas. Tu ficha queda publicada en el directorio.' },
        { n: '2', t: 'Centraliza tus leads', d: 'Todas las consultas llegan a tu panel. Responde, haz seguimiento y envía propuestas digitales en minutos.' },
        { n: '3', t: 'Convierte más bodas', d: 'Pipeline claro, propuestas que impresionan y calendario actualizado. Cierra más reservas, también de parejas internacionales.' },
      ],
    },
    features: {
      eyebrow: 'La plataforma',
      title: 'Todo lo que necesitas,', titleItalic: 'en un solo lugar',
      sub: 'Una plataforma diseñada para venues de bodas en España, con todo lo esencial para crecer y convertir más.',
      items: [
        { label: 'GESTIÓN DE LEADS', img: 'leads',
          title: 'Nunca más pierdas una pareja por llegar tarde',
          desc: 'Centraliza en un panel cada consulta — sea del directorio, de tu web o de WhatsApp. Pipeline visual, filtros avanzados y respuesta rápida para cerrar más.',
          bullets: ['Panel unificado de consultas', 'Pipeline visual por etapas', 'Filtros y exportación a CSV', 'Historial completo por pareja'] },
        { label: 'PROPUESTAS DIGITALES', img: 'prop',
          title: 'Del PDF olvidado a la propuesta que enamora',
          desc: 'Crea propuestas web interactivas con galería, tarifas y opciones. Las parejas las abren desde el móvil, las comparten con su familia y aceptan online. Especialmente eficaz para parejas internacionales.',
          bullets: ['Diseño profesional en minutos', 'Galería fotográfica integrada', 'Perfectas para el mercado internacional', 'Aceptación online con un clic'] },
        { label: 'CALENDARIO', img: 'cal',
          title: 'Tu disponibilidad, en tiempo real',
          desc: 'Bloquea fechas, confirma reservas y elimina los dobles bookings de una vez. Las parejas ven tu disponibilidad real sin necesidad de llamar o esperar respuesta.',
          bullets: ['Vista mensual clara', 'Bloqueo de fechas en un clic', 'Cero dobles reservas', 'Sincronización automática'] },
      ],
      mini: [
        { emoji: '📊', t: 'Estadísticas y métricas', d: 'Leads recibidos, conversiones y tendencias. Entiende qué funciona y ajusta tu estrategia.' },
        { emoji: '🏛️', t: 'Ficha de venue completa', d: 'Tu espacio presentado de forma profesional: capacidad, fotos, servicios y precios.' },
        { emoji: '🌍', t: 'Visibilidad internacional', d: 'Llega a parejas de toda Europa y América que buscan venues en España para su boda destino.' },
      ],
    },
    testimonials: {
      eyebrow: 'Testimonios',
      title: 'Lo que dicen', titleItalic: 'nuestros venues',
      sub: 'Venues reales que ya han transformado su forma de trabajar.',
      items: [
        { letter: 'C', q: 'Desde que usamos el Partner Portal, no hemos perdido ni un solo lead. El panel centralizado nos da visión total y respondemos mucho más rápido que antes. La conversión ha mejorado notablemente.', name: 'Carmen R.', role: 'Directora · Finca Los Olivos, Málaga' },
        { letter: 'P', q: 'Las propuestas digitales han sido un antes y un después. Las parejas internacionales lo entienden todo a la primera y nos preguntan mucho menos. La conversión ha subido de forma visible.', name: 'Pablo M.', role: 'Propietario · Hacienda Santa María, Sevilla' },
        { letter: 'I', q: 'El calendario era lo que más nos complicaba. Ahora está centralizado, actualizado en tiempo real y nunca hemos tenido una doble reserva. Nos ahorra horas cada semana.', name: 'Isabel T.', role: 'Gestora · Cortijo La Ermita, Granada' },
      ],
    },
    pricing: {
      eyebrow: 'Precios',
      title: 'Planes simples,', titleItalic: 'sin sorpresas',
      sub: 'Elige el plan que mejor se adapte a tu venue',
      trial: '14 días de prueba gratuita — sin compromiso ni tarjeta',
      monthly: 'Mensual', annual: 'Anual', save: 'Ahorra 2 meses',
      perYear: '/año', perMonth: '/mes', billedAnnually: '/mes facturado anualmente',
      recommended: 'Recomendado',
      cta: 'Empieza gratis',
    },
    featureLabels: [
      // Básico
      { key: 'ficha',                  label: 'Ficha del venue' },
      { key: 'leads',                  label: 'Gestión de leads' },
      { key: 'leads_date_filter',      label: 'Filtrar leads por fecha' },
      { key: 'calendario',             label: 'Calendario de disponibilidad' },
      { key: 'estadisticas',           label: 'Estadísticas básicas' },
      // Premium
      { key: 'leads_export',           label: 'Exportar leads a CSV' },
      { key: 'pipeline',               label: 'Pipeline de ventas' },
      { key: 'propuestas',             label: 'Propuestas digitales' },
      { key: 'propuestas_web',         label: 'Web pública de propuesta' },
      { key: 'propuestas_pdf',         label: 'Descarga PDF de propuesta' },
      { key: 'comunicacion',           label: 'Tarifas y zonas de precio' },
      { key: 'estadisticas_avanzadas', label: 'Estadísticas avanzadas' },
      { key: 'recordatorios',          label: 'Recordatorios automáticos' },
      { key: 'multiusuario',           label: 'Múltiples usuarios' },
      { key: 'soporte_prioritario',    label: 'Soporte prioritario' },
    ] as { key: keyof PlanFeatures; label: string }[],
    faq: {
      eyebrow: 'FAQ',
      title: 'Preguntas', titleItalic: 'frecuentes',
      items: [
        { q: '¿Necesito conocimientos técnicos?', a: 'No. La plataforma está diseñada para ser intuitiva desde el primer día. En menos de 10 minutos puedes tener tu venue configurado y listo para recibir leads.' },
        { q: '¿Puedo cancelar cuando quiera?', a: 'Sí, puedes cancelar en cualquier momento sin penalizaciones. Mantienes el acceso hasta el final del período pagado.' },
        { q: '¿Las propuestas funcionan para parejas internacionales?', a: 'Absolutamente. Las propuestas web son accesibles desde cualquier dispositivo y en cualquier idioma. Redacta el contenido en inglés, francés o el idioma que necesites.' },
        { q: '¿Es compatible con mi web actual?', a: 'Sí. Puedes compartir tu ficha y tus propuestas con cualquier enlace desde tu web, redes sociales o email.' },
        { q: '¿Qué pasa al terminar los 14 días de prueba?', a: 'Elige el plan que mejor se adapte. Si prefieres no continuar, cancela sin ningún coste. Sin sorpresas.' },
        { q: '¿Puedo gestionar varios venues desde una cuenta?', a: 'Sí. Si gestionas más de un espacio, podemos configurar múltiples venues bajo la misma cuenta. Contáctanos para más información.' },
      ],
    },
    cta: {
      title: '¿Listo para llenarte', titleItalic: 'de bodas?',
      sub: 'Únete a los mejores venues de bodas en España. Atrae a más parejas, también internacionales.',
      btn: 'Crear cuenta gratis', btnSub: 'Ya tengo cuenta',
      fine: 'Sin tarjeta · Cancela cuando quieras · Soporte en español',
    },
    footer: {
      tagline: 'La plataforma de gestión para venues de bodas en España',
      cookies: 'Cookies', privacy: 'Privacidad',
      copy: '© 2026 Wedding Venues Spain. Todos los derechos reservados.',
    },
  },
} as const

// ─── Assets & constants ───────────────────────────────────────────────────────
const LOGO_URL  = 'https://weddingvenuesspain.com/wp-content/uploads/2024/10/logo-wedding-venues-spain-white-e1732122540714.png'
const HERO_IMG  = 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1920&q=90&auto=format'
const IMGS = {
  leads: '/screenshots/leads-panel.svg',
  prop:  '/screenshots/proposals.svg',
  cal:   '/screenshots/calendar.svg',
} as const

const SERIF = "'Cormorant Garamond', Georgia, serif"
const SANS  = "'Manrope', system-ui, sans-serif"

const C = {
  dark: '#453D23', darkDeep: '#2C2614', accent: '#796F4E',
  accentLight: 'rgba(121,111,78,0.10)', accentBorder: 'rgba(121,111,78,0.20)',
  bg: '#F5F3ED', white: '#FFFFFF', border: '#E2DDD4', muted: '#9A8F78',
} as const

const MINI_ICONS = [
  <BarChart3 key="bar" size={22} color={C.accent} strokeWidth={1.8} />,
  <Building2 key="bld" size={22} color={C.accent} strokeWidth={1.8} />,
  <Globe key="glb" size={22} color={C.accent} strokeWidth={1.8} />,
]

// ─── Component ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [lang, setLang]                   = useState<Lang>('en')
  const [scrolled, setScrolled]           = useState(false)
  const [plans, setPlans]                 = useState<Plan[]>([])
  const [isMobile, setIsMobile]           = useState(false)
  const [mobileMenu, setMobileMenu]       = useState(false)
  const [billingAnnual, setBillingAnnual] = useState(true)
  const [openFaq, setOpenFaq]             = useState<number | null>(null)

  const t = TRANSLATIONS[lang]

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768)
    fn(); window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  useEffect(() => {
    fetch('/api/plans').then(r => r.json())
      .then((data: Plan[]) => setPlans([...data].sort((a, b) =>
        (a.name.toLowerCase().includes('premium') ? 1 : 0) -
        (b.name.toLowerCase().includes('premium') ? 1 : 0))))
      .catch(() => {})
  }, [])

  const scrollTo = (id: string) => {
    setMobileMenu(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  // Language dropdown
  const [langOpen, setLangOpen] = useState(false)
  useEffect(() => {
    if (!langOpen) return
    const close = () => setLangOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [langOpen])

  const LangToggle = () => (
    <div style={{ position: 'relative' }}>
      <button
        onClick={e => { e.stopPropagation(); setLangOpen(o => !o) }}
        style={{
          background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)',
          borderRadius: 6, cursor: 'pointer', fontFamily: SANS,
          fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.80)',
          letterSpacing: '0.06em', padding: '8px 10px',
          display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
        }}
        onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = '#fff' }}
        onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = 'rgba(255,255,255,0.80)' }}
      >
        <Globe size={14} strokeWidth={1.8} />
        {lang === 'en' ? 'EN' : 'ES'}
        <ChevronDown size={12} strokeWidth={2} style={{ marginLeft: -2, transition: 'transform 0.2s', transform: langOpen ? 'rotate(180deg)' : 'none' }} />
      </button>
      {langOpen && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          background: 'rgba(44,38,20,0.96)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
          padding: '4px', minWidth: 130, boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
        }}>
          {([['en', 'English'], ['es', 'Español']] as const).map(([code, label]) => (
            <button key={code} onClick={() => { setLang(code); setLangOpen(false) }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', border: 'none', borderRadius: 6, cursor: 'pointer',
              background: lang === code ? 'rgba(255,255,255,0.10)' : 'transparent',
              fontFamily: SANS, fontSize: 13, fontWeight: lang === code ? 600 : 400,
              color: lang === code ? '#fff' : 'rgba(255,255,255,0.55)',
              transition: 'all 0.15s',
            }}
            onMouseOver={e => { if (lang !== code) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseOut={e => { if (lang !== code) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ width: 16, textAlign: 'center' }}>{lang === code ? <Check size={12} strokeWidth={2.5} /> : ''}</span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div style={{ fontFamily: SANS, color: C.dark, background: C.white, overflowX: 'hidden' }}>

      {/* ─── NAV ─── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        height: 68, padding: '0 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(44,38,20,0.97)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
        transition: 'background 0.4s',
      }}>
        <Link href="/" style={{ textDecoration: 'none', lineHeight: 0 }}>
          <img src={LOGO_URL} alt="Wedding Venues Spain" style={{ height: 32, display: 'block' }} />
        </Link>

        {!isMobile && (
          <nav style={{ display: 'flex', gap: 36, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            {[
              [t.nav.features, 'funcionalidades'],
              [t.nav.pricing, 'planes'],
              [t.nav.contact, 'contacto'],
            ].map(([l, id]) => (
              <button key={id} onClick={() => scrollTo(id)} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: SANS,
                fontSize: 13, fontWeight: 500, letterSpacing: '0.02em', color: 'rgba(255,255,255,0.65)',
              }}
              onMouseOver={e => (e.currentTarget.style.color = '#fff')}
              onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
              >{l}</button>
            ))}
          </nav>
        )}

        {!isMobile && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <LangToggle />
            <Link href="/login" style={{
              textDecoration: 'none', fontFamily: SANS, fontSize: 13, fontWeight: 500,
              color: 'rgba(255,255,255,0.7)', padding: '8px 0', borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.15)', transition: 'all 0.2s',
              minWidth: 120, textAlign: 'center',
            }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.35)' }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)' }}
            >{t.nav.login}</Link>
            <Link href="/signup" style={{
              textDecoration: 'none', fontFamily: SANS, fontSize: 13, fontWeight: 600,
              color: C.white, background: C.accent, padding: '9px 0', borderRadius: 6,
              transition: 'background 0.2s',
              minWidth: 140, textAlign: 'center',
            }}
            onMouseOver={e => ((e.currentTarget as HTMLElement).style.background = '#5E5538')}
            onMouseOut={e => ((e.currentTarget as HTMLElement).style.background = C.accent)}
            >{t.nav.register}</Link>
          </div>
        )}

        {isMobile && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <LangToggle />
            <button onClick={() => setMobileMenu(!mobileMenu)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 4 }}>
              {mobileMenu ? <XIcon size={22} /> : <Menu size={22} />}
            </button>
          </div>
        )}
      </header>

      {/* Mobile menu */}
      {isMobile && mobileMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: C.darkDeep, display: 'flex', flexDirection: 'column', padding: '88px 32px 32px' }}>
          {([[t.nav.features,'funcionalidades'],[t.nav.pricing,'planes'],[t.nav.contact,'contacto']] as [string,string][]).map(([l,id]) => (
            <button key={id} onClick={() => scrollTo(id)} style={{
              background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer', fontFamily: SANS, fontSize: 20, fontWeight: 500,
              color: C.white, padding: '18px 0', textAlign: 'left',
            }}>{l}</button>
          ))}
          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link href="/login" onClick={() => setMobileMenu(false)} style={{
              textDecoration: 'none', fontFamily: SANS, fontSize: 15, fontWeight: 500,
              color: C.white, textAlign: 'center', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8, padding: '14px 0',
            }}>{t.nav.login}</Link>
            <Link href="/signup" onClick={() => setMobileMenu(false)} style={{
              textDecoration: 'none', fontFamily: SANS, fontSize: 15, fontWeight: 600,
              color: C.white, textAlign: 'center', background: C.accent, borderRadius: 8, padding: '14px 0',
            }}>{t.nav.register}</Link>
          </div>
        </div>
      )}

      {/* ─── HERO ─── */}
      <section style={{
        minHeight: '100vh', position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '110px 28px 80px' : '68px 60px 0',
      }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, backgroundImage: `url(${HERO_IMG})`, backgroundSize: 'cover', backgroundPosition: 'center 25%' }} />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: isMobile
            ? 'linear-gradient(to bottom, rgba(44,38,20,0.80) 0%, rgba(44,38,20,0.88) 100%)'
            : 'linear-gradient(105deg, rgba(44,38,20,0.90) 0%, rgba(44,38,20,0.75) 55%, rgba(44,38,20,0.40) 100%)',
        }} />

        <div style={{
          position: 'relative', zIndex: 2, maxWidth: 1100, width: '100%',
          display: 'flex', flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 40 : 0,
        }}>
          <div style={{ flex: isMobile ? undefined : '0 0 58%', maxWidth: isMobile ? '100%' : 640 }}>
            <h1 style={{ fontFamily: SERIF, margin: 0, lineHeight: 1.02, letterSpacing: '-0.01em' }}>
              <span style={{ display: 'block', fontSize: isMobile ? 52 : 76, fontWeight: 700, color: C.white }}>{t.hero.line1}</span>
              <span style={{ display: 'block', fontSize: isMobile ? 52 : 76, fontWeight: 700, color: C.white, fontStyle: 'italic' }}>{t.hero.line2}</span>
              <span style={{ display: 'block', fontSize: isMobile ? 52 : 76, fontWeight: 700, color: '#D4C49A' }}>{t.hero.line3}</span>
            </h1>
            <p style={{ fontFamily: SANS, fontSize: isMobile ? 16 : 18, color: 'rgba(255,255,255,0.52)', maxWidth: 480, lineHeight: 1.75, marginTop: 24, marginBottom: 0 }}>
              {t.hero.sub}
            </p>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12, marginTop: 36, alignItems: isMobile ? 'stretch' : 'center' }}>
              <Link href="/signup" style={{
                textDecoration: 'none', fontFamily: SANS, fontSize: 15, fontWeight: 600,
                color: C.white, background: C.accent, padding: '14px 32px', borderRadius: 6,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onMouseOver={e => ((e.currentTarget as HTMLElement).style.background = '#5E5538')}
              onMouseOut={e => ((e.currentTarget as HTMLElement).style.background = C.accent)}
              >{t.hero.cta} <ChevronRight size={15} /></Link>
              <button onClick={() => scrollTo('funcionalidades')} style={{
                fontFamily: SANS, fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.70)',
                background: 'transparent', padding: '14px 28px', borderRadius: 6, cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.18)', transition: 'all 0.2s',
              }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.4)' }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.18)' }}
              >{t.hero.ctaSub}</button>
            </div>
          </div>

          {!isMobile && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14 }}>
              {t.hero.stats.map(s => (
                <div key={s.label} style={{
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10, padding: '14px 22px', backdropFilter: 'blur(8px)',
                  display: 'flex', alignItems: 'center', gap: 14, minWidth: 210,
                }}>
                  <span style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 700, color: '#D4C49A', lineHeight: 1 }}>{s.value}</span>
                  <span style={{ fontFamily: SANS, fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {isMobile && (
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 24, paddingTop: 8, paddingBottom: 16 }}>
            {t.hero.stats.map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, color: '#D4C49A' }}>{s.value}</div>
                <div style={{ fontFamily: SANS, fontSize: 11, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── PROBLEMS ─── */}
      <section style={{ background: C.dark, padding: isMobile ? '80px 28px' : '110px 60px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ marginBottom: isMobile ? 52 : 72 }}>
            <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.accent, marginBottom: 16 }}>{t.problems.eyebrow}</div>
            <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 38 : 58, fontWeight: 700, color: C.white, margin: 0, lineHeight: 1.1, maxWidth: 640 }}>{t.problems.title}</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {t.problems.items.map((item, i) => (
              <div key={i} style={{
                display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 40,
                padding: isMobile ? '28px 0' : '36px 0', borderTop: '1px solid rgba(255,255,255,0.07)',
                alignItems: isMobile ? 'flex-start' : 'center',
              }}>
                <div style={{ fontFamily: SERIF, fontSize: isMobile ? 36 : 48, fontWeight: 700, color: 'rgba(255,255,255,0.12)', lineHeight: 1, flexShrink: 0, width: isMobile ? 'auto' : 80 }}>{item.n}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 28, fontWeight: 600, color: C.white, lineHeight: 1.25, marginBottom: 10 }}>{item.title}</div>
                  <div style={{ fontFamily: SANS, fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75 }}>{item.desc}</div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowRight size={14} color="rgba(255,255,255,0.3)" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="como-funciona" style={{ background: C.bg, padding: isMobile ? '80px 28px' : '110px 60px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 48 : 80, alignItems: isMobile ? 'flex-start' : 'center' }}>
            <div style={{ flex: '0 0 auto', maxWidth: isMobile ? '100%' : 340 }}>
              <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.accent, marginBottom: 16 }}>{t.how.eyebrow}</div>
              <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 36 : 50, fontWeight: 700, color: C.dark, margin: '0 0 20px', lineHeight: 1.1 }}>
                {t.how.title}<br /><em>{t.how.titleItalic}</em>
              </h2>
              <p style={{ fontFamily: SANS, fontSize: 15, color: C.muted, lineHeight: 1.8, margin: '0 0 32px' }}>{t.how.sub}</p>
              <Link href="/signup" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none',
                fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.white, background: C.dark,
                padding: '12px 24px', borderRadius: 6,
              }}>{t.how.cta} <ArrowRight size={14} /></Link>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {t.how.steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 24, padding: '28px 0', borderBottom: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: C.dark, color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: 20, fontWeight: 700, marginTop: 2 }}>{s.n}</div>
                  <div>
                    <div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 600, color: C.dark, marginBottom: 6 }}>{s.t}</div>
                    <div style={{ fontFamily: SANS, fontSize: 14, color: C.muted, lineHeight: 1.7 }}>{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="funcionalidades" style={{ background: C.white, padding: isMobile ? '80px 28px' : '110px 60px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 52 : 72 }}>
            <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.accent, marginBottom: 16 }}>{t.features.eyebrow}</div>
            <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 36 : 52, fontWeight: 700, color: C.dark, margin: 0, lineHeight: 1.1 }}>
              {t.features.title}<br /><em>{t.features.titleItalic}</em>
            </h2>
          </div>

          {t.features.items.map((f, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: isMobile ? 'column' : (i % 2 === 1 ? 'row-reverse' : 'row'),
              gap: isMobile ? 32 : 72, padding: isMobile ? '40px 0' : '64px 0',
              borderBottom: i < 2 ? `1px solid ${C.border}` : 'none', alignItems: 'center',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'inline-block', fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.accent, background: C.accentLight, border: `1px solid ${C.accentBorder}`, borderRadius: 4, padding: '3px 9px', marginBottom: 18 }}>{f.label}</div>
                <h3 style={{ fontFamily: SERIF, fontSize: isMobile ? 28 : 36, fontWeight: 700, color: C.dark, lineHeight: 1.2, margin: '0 0 16px' }}>{f.title}</h3>
                <p style={{ fontFamily: SANS, fontSize: 15, color: C.muted, lineHeight: 1.8, margin: '0 0 24px' }}>{f.desc}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {f.bullets.map(b => (
                    <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: C.accentLight, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Check size={10} color={C.accent} strokeWidth={2.5} />
                      </div>
                      <span style={{ fontFamily: SANS, fontSize: 14, color: C.dark, fontWeight: 500 }}>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, height: isMobile ? 260 : 380, borderRadius: 16, backgroundImage: `url(${IMGS[f.img as keyof typeof IMGS]})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundColor: C.bg, boxShadow: '0 32px 80px rgba(69,61,35,0.18)', border: `1px solid ${C.border}` }} />
            </div>
          ))}

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginTop: 56 }}>
            {t.features.mini.map((x, i) => (
              <div key={i} style={{ padding: '26px 24px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.bg, transition: 'box-shadow 0.2s' }}
              onMouseOver={e => ((e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(69,61,35,0.08)')}
              onMouseOut={e => ((e.currentTarget as HTMLElement).style.boxShadow = 'none')}
              >
                <div style={{ width: 42, height: 42, borderRadius: 10, background: C.accentLight, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>{MINI_ICONS[i]}</div>
                <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.dark, marginBottom: 8 }}>{x.t}</div>
                <div style={{ fontFamily: SANS, fontSize: 13, color: C.muted, lineHeight: 1.65 }}>{x.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section style={{ background: C.bg, padding: isMobile ? '80px 28px' : '110px 60px', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.accent, marginBottom: 16 }}>{t.testimonials.eyebrow}</div>
          <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 36 : 50, fontWeight: 700, color: C.dark, margin: '0 0 56px', lineHeight: 1.1 }}>
            {t.testimonials.title}<br /><em>{t.testimonials.titleItalic}</em>
          </h2>

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 24 }}>
            <div style={{ flex: isMobile ? undefined : '0 0 48%', background: C.dark, borderRadius: 16, padding: isMobile ? '36px 28px' : '48px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32 }}>
              <div>
                <div style={{ fontFamily: SERIF, fontSize: 72, color: C.accent, lineHeight: 0.7, marginBottom: 28, display: 'block' }}>&ldquo;</div>
                <p style={{ fontFamily: SERIF, fontSize: isMobile ? 20 : 24, fontStyle: 'italic', color: C.white, lineHeight: 1.6, margin: 0 }}>{t.testimonials.items[0].q}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: 18, color: C.white, fontWeight: 700, flexShrink: 0 }}>{t.testimonials.items[0].letter}</div>
                <div>
                  <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.white }}>{t.testimonials.items[0].name}</div>
                  <div style={{ fontFamily: SANS, fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{t.testimonials.items[0].role}</div>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {t.testimonials.items.slice(1).map((item, i) => (
                <div key={i} style={{ background: C.white, borderRadius: 14, padding: '28px 28px', border: `1px solid ${C.border}`, flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <p style={{ fontFamily: SANS, fontSize: 14, color: C.dark, lineHeight: 1.75, margin: 0, fontStyle: 'italic' }}>&ldquo;{item.q}&rdquo;</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.accentLight, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: 16, color: C.accent, fontWeight: 700, flexShrink: 0 }}>{item.letter}</div>
                    <div>
                      <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.dark }}>{item.name}</div>
                      <div style={{ fontFamily: SANS, fontSize: 11, color: C.muted, marginTop: 1 }}>{item.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="planes" style={{ background: C.white, padding: isMobile ? '80px 28px' : '110px 60px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.accent, marginBottom: 16 }}>{t.pricing.eyebrow}</div>
            <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 36 : 50, fontWeight: 700, color: C.dark, margin: '0 0 12px', lineHeight: 1.1 }}>
              {t.pricing.title}<br /><em>{t.pricing.titleItalic}</em>
            </h2>
            <p style={{ fontFamily: SANS, fontSize: 15, color: C.muted, margin: '0 0 20px' }}>{t.pricing.sub}</p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.accentLight, border: `1px solid ${C.accentBorder}`, borderRadius: 20, padding: '6px 16px', fontSize: 13, color: C.accent, fontFamily: SANS, fontWeight: 500 }}>
              <Check size={13} /> {t.pricing.trial}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 36 }}>
            <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: billingAnnual ? 400 : 600, color: billingAnnual ? C.muted : C.dark }}>{t.pricing.monthly}</span>
            <button onClick={() => setBillingAnnual(!billingAnnual)} style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: billingAnnual ? C.accent : C.border, position: 'relative', transition: 'background 0.2s', padding: 0 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: C.white, position: 'absolute', top: 3, left: billingAnnual ? 25 : 3, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }} />
            </button>
            <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: billingAnnual ? 600 : 400, color: billingAnnual ? C.dark : C.muted }}>{t.pricing.annual}</span>
            {billingAnnual && <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: '#16a34a', background: '#f0fdf4', padding: '3px 9px', borderRadius: 4 }}>{t.pricing.save}</span>}
          </div>

          {plans.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 24 }}>
              {plans.map(plan => {
                const isPremium = plan.name.toLowerCase().includes('premium')
                const cycle = plan.billing_cycles.find((c: BillingCycle) => billingAnnual ? c.interval_months === 12 : c.interval_months === 1) || plan.billing_cycles[0]
                // Build a tier lookup map from FEATURE_DEFS
                const tierMap = Object.fromEntries(FEATURE_DEFS.map(f => [f.key, f.tier]))
                // Basic: only basic tier; Premium: basic + premium (no restrictions, never show X)
                const visibleFeatures = t.featureLabels.filter(f =>
                  isPremium
                    ? tierMap[f.key] !== 'restriction'
                    : tierMap[f.key] === 'basic'
                )
                return (
                  <div key={plan.id} style={{ borderRadius: 16, padding: '36px 32px', border: isPremium ? `2px solid ${C.accent}` : `1px solid ${C.border}`, background: isPremium ? C.bg : C.white, position: 'relative', boxShadow: isPremium ? '0 12px 40px rgba(121,111,78,0.12)' : undefined }}>
                    {isPremium && <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', background: C.accent, color: C.white, fontFamily: SANS, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 16px', borderRadius: '0 0 8px 8px' }}>{t.pricing.recommended}</div>}
                    <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 700, color: C.dark, marginTop: isPremium ? 10 : 0 }}>{plan.display_name || plan.name}</div>
                    {plan.description && <div style={{ fontFamily: SANS, fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{plan.description}</div>}
                    <div style={{ margin: '20px 0', paddingBottom: 20, borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontFamily: SERIF, fontSize: 44, fontWeight: 700, color: C.dark, letterSpacing: '-0.02em' }}>{cycle?.price || 0}€</span>
                      <span style={{ fontFamily: SANS, fontSize: 14, color: C.muted, marginLeft: 4 }}>{billingAnnual ? t.pricing.perYear : t.pricing.perMonth}</span>
                      {billingAnnual && cycle && <div style={{ fontFamily: SANS, fontSize: 12, color: C.muted, marginTop: 4 }}>{Math.round(cycle.price / 12)}€{t.pricing.billedAnnually}</div>}
                    </div>
                    <div>
                      {visibleFeatures.map(f => (
                        <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                          <Check size={14} color={C.accent} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                          <span style={{ fontFamily: SANS, fontSize: 13, color: C.dark }}>{f.label}</span>
                        </div>
                      ))}
                    </div>
                    <Link href="/signup" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.white, background: isPremium ? C.accent : C.dark, padding: '14px 0', borderRadius: 8, marginTop: 28, transition: 'opacity 0.2s' }}
                    onMouseOver={e => ((e.currentTarget as HTMLElement).style.opacity = '0.85')}
                    onMouseOut={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                    >{t.pricing.cta}</Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section style={{ background: C.bg, padding: isMobile ? '80px 28px' : '110px 60px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.accent, marginBottom: 16 }}>{t.faq.eyebrow}</div>
          <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 36 : 50, fontWeight: 700, color: C.dark, margin: '0 0 44px', lineHeight: 1.1 }}>
            {t.faq.title}<br /><em>{t.faq.titleItalic}</em>
          </h2>
          {t.faq.items.map((item, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 0', gap: 16, fontFamily: SANS, textAlign: 'left' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: C.dark }}>{item.q}</span>
                <ChevronDown size={17} color={C.muted} style={{ flexShrink: 0, transition: 'transform 0.25s', transform: openFaq === i ? 'rotate(180deg)' : 'none' }} />
              </button>
              {openFaq === i && (
                <div style={{ paddingBottom: 22 }}>
                  <p style={{ fontFamily: SANS, fontSize: 14, color: C.muted, lineHeight: 1.8, margin: 0 }}>{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section style={{ background: C.dark, padding: isMobile ? '80px 28px 100px' : '110px 60px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -160, left: '50%', transform: 'translateX(-50%)', width: 560, height: 560, borderRadius: '50%', background: 'radial-gradient(circle, rgba(121,111,78,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <img src={LOGO_URL} alt="Wedding Venues Spain" style={{ height: 40, display: 'block', margin: '0 auto 36px', opacity: 0.80 }} />
          <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 38 : 60, fontWeight: 700, color: C.white, margin: '0 0 20px', lineHeight: 1.05 }}>
            {t.cta.title}<br /><em style={{ color: '#D4C49A' }}>{t.cta.titleItalic}</em>
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 16, color: 'rgba(255,255,255,0.42)', maxWidth: 440, margin: '0 auto 36px', lineHeight: 1.75 }}>{t.cta.sub}</p>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Link href="/signup" style={{ textDecoration: 'none', fontFamily: SANS, fontSize: 16, fontWeight: 600, color: C.white, background: C.accent, padding: '16px 40px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 8 }}
            onMouseOver={e => ((e.currentTarget as HTMLElement).style.background = '#5E5538')}
            onMouseOut={e => ((e.currentTarget as HTMLElement).style.background = C.accent)}
            >{t.cta.btn} <ArrowUpRight size={16} /></Link>
            <Link href="/login" style={{ textDecoration: 'none', fontFamily: SANS, fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.55)', padding: '16px 28px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)' }}>{t.cta.btnSub}</Link>
          </div>
          <div style={{ marginTop: 16, fontFamily: SANS, fontSize: 12, color: 'rgba(255,255,255,0.20)' }}>{t.cta.fine}</div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer id="contacto" style={{ background: C.darkDeep, padding: '44px 40px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 24 : 0 }}>
          <div>
            <img src={LOGO_URL} alt="Wedding Venues Spain" style={{ height: 26, display: 'block', marginBottom: 8, opacity: 0.65 }} />
            <div style={{ fontFamily: SANS, color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>{t.footer.tagline}</div>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <Link href="/cookies" style={{ fontFamily: SANS, color: 'rgba(255,255,255,0.30)', fontSize: 13, textDecoration: 'none' }}>{t.footer.cookies}</Link>
            <Link href="/privacidad" style={{ fontFamily: SANS, color: 'rgba(255,255,255,0.30)', fontSize: 13, textDecoration: 'none' }}>{t.footer.privacy}</Link>
          </div>
          <div style={{ fontFamily: SANS, color: 'rgba(255,255,255,0.30)', fontSize: 13 }}>info@weddingvenuesspain.com</div>
        </div>
        <div style={{ maxWidth: 1000, margin: '20px auto 0', paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
          <div style={{ fontFamily: SANS, color: 'rgba(255,255,255,0.15)', fontSize: 12 }}>{t.footer.copy}</div>
        </div>
      </footer>

      {/* ─── MOBILE FLOATING CTA ─── */}
      {isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 900, background: 'rgba(44,38,20,0.97)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '12px 20px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 10 }}>
          <Link href="/login" style={{ flex: 1, textDecoration: 'none', fontFamily: SANS, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.70)', textAlign: 'center', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '13px 0' }}>{t.nav.login}</Link>
          <Link href="/signup" style={{ flex: 2, textDecoration: 'none', fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.white, textAlign: 'center', background: C.accent, borderRadius: 6, padding: '13px 0' }}>{t.nav.register}</Link>
        </div>
      )}
    </div>
  )
}

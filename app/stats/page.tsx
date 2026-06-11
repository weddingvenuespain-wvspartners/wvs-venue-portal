'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import NoVenueState from '@/components/NoVenueState'
import {
  Eye, MousePointerClick, MessageSquare, TrendingUp, TrendingDown,
  Trophy, Wallet, Target, UserPlus, Receipt, AlertTriangle, Clock,
  FileText, CalendarHeart, Filter, Heart, ChevronDown, ArrowRight, Hourglass,
} from 'lucide-react'
import Link from 'next/link'
import Spinner from '@/components/Spinner'

// ── Funnel stages (lead lifecycle, in order) ──────────────────────────────────
const FUNNEL = [
  { status: 'new',             label: 'Nuevos',       color: '#8FAA94' },
  { status: 'contacted',       label: 'Contactados',  color: '#5B8794' },
  { status: 'proposal_sent',   label: 'Propuesta',    color: '#4F6D8C' },
  { status: 'visit_scheduled', label: 'Visita',       color: '#7E72A0' },
  { status: 'post_visit',      label: 'Post-visita',  color: '#9A6E8C' },
  { status: 'budget_sent',     label: 'Presupuesto',  color: '#AC8B4C' },
  { status: 'won',             label: 'Confirmado',   color: '#4A6B52' },
]
const STAGE_INDEX: Record<string, number> = Object.fromEntries(FUNNEL.map((s, i) => [s.status, i]))

// Estados legacy aún presentes en filas antiguas → etapa equivalente del embudo
const LEGACY_STAGE: Record<string, string> = {
  booked: 'won', qualified: 'contacted', proposal: 'proposal_sent',
}
const stageOf = (status: string) => LEGACY_STAGE[status] ?? status

const SOURCE_LABEL: Record<string, string> = {
  web: 'Web', whatsapp: 'WhatsApp', instagram: 'Instagram', email: 'Email',
  referral: 'Referido', manual: 'Manual', other: 'Otro', wedding_planner: 'Planner',
  wedding_venues_spain: 'Wedding Venues Spain', bodas_net: 'Bodas.net',
}

const eur = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

const MONTHS_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function EstadisticasPage() {
  const router = useRouter()
  const { user, activeVenue, loading: authLoading } = useAuth()
  const { isBlocked } = useRequireSubscription()
  const [proposals, setProposals] = useState<any[]>([])
  const [leads,     setLeads]     = useState<any[]>([])
  const [budgets,   setBudgets]   = useState<any[]>([])
  const [tasks,     setTasks]     = useState<any[]>([])
  const [ctaReqs,   setCtaReqs]   = useState<any[]>([])
  const [messages,  setMessages]  = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [openAttn,  setOpenAttn]  = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    if (!activeVenue) { setLoading(false); return }
    load()
  }, [user, authLoading, activeVenue?.id]) // eslint-disable-line

  const load = async () => {
    if (!activeVenue) return
    const supabase = createClient()
    const [
      { data: props },
      { data: leadsData },
      { data: budgetsData },
      { data: tasksData },
      { data: ctas },
      { data: msgs },
    ] = await Promise.all([
      supabase.from('proposals').select('*').eq('venue_id', activeVenue.id).order('created_at', { ascending: false }),
      supabase.from('leads').select('id, name, status, created_at, source, wedding_date').eq('venue_id', activeVenue.id),
      supabase.from('budgets').select('status, total, created_at, accepted_at, wedding_date, couple').eq('venue_id', activeVenue.id),
      supabase.from('venue_tasks').select('id, completed, due_date, priority, title').eq('venue_id', activeVenue.id).eq('user_id', user!.id),
      supabase.from('proposal_cta_requests').select('type, created_at, proposal_id'),
      supabase.from('proposal_messages').select('created_at, proposal_id'),
    ])
    if (props)       setProposals(props)
    if (leadsData)   setLeads(leadsData)
    if (budgetsData) setBudgets(budgetsData)
    if (tasksData)   setTasks(tasksData)
    if (ctas)        setCtaReqs(ctas)
    if (msgs)        setMessages(msgs)
    setLoading(false)
  }

  // ── Period helpers ──────────────────────────────────────────────────────────
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const monthStart = (offset = 0) => new Date(now.getFullYear(), now.getMonth() + offset, 1).toISOString()
  const thisMonth = monthStart(0)
  const prevMonth = monthStart(-1)

  // ── Lead metrics ──────────────────────────────────────────────────────────────
  const totalLeads   = leads.length
  const wonLeads     = leads.filter(l => stageOf(l.status) === 'won').length
  const lostLeads    = leads.filter(l => l.status === 'lost').length
  const activeLeads  = leads.filter(l => stageOf(l.status) !== 'won' && l.status !== 'lost').length
  const conversion   = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0

  const leadsThisMonth = leads.filter(l => l.created_at >= thisMonth).length
  const leadsPrevMonth = leads.filter(l => l.created_at >= prevMonth && l.created_at < thisMonth).length
  const leadsDelta = leadsPrevMonth > 0
    ? Math.round(((leadsThisMonth - leadsPrevMonth) / leadsPrevMonth) * 100)
    : (leadsThisMonth > 0 ? 100 : 0)

  // ── Revenue metrics (from budgets) ──────────────────────────────────────────────
  const acceptedBudgets = budgets.filter(b => b.status === 'accepted')
  const wonValue        = acceptedBudgets.reduce((a, b) => a + Number(b.total || 0), 0)
  const wonValueMonth   = acceptedBudgets.filter(b => (b.accepted_at || b.created_at) >= thisMonth).reduce((a, b) => a + Number(b.total || 0), 0)
  const pipelineValue   = budgets.filter(b => b.status === 'sent' || b.status === 'viewed').reduce((a, b) => a + Number(b.total || 0), 0)
  const pipelineCount   = budgets.filter(b => b.status === 'sent' || b.status === 'viewed').length
  const avgTicket       = acceptedBudgets.length > 0 ? wonValue / acceptedBudgets.length : 0

  // ── Funnel (cumulative reached, excludes lost) ────────────────────────────────
  const inPipeline = leads.filter(l => STAGE_INDEX[stageOf(l.status)] !== undefined)
  const funnelData = FUNNEL.map(stage => ({
    ...stage,
    count: inPipeline.filter(l => STAGE_INDEX[stageOf(l.status)] >= STAGE_INDEX[stage.status]).length,
  }))
  const funnelMax = funnelData[0]?.count || 1

  // ── Attention items ─────────────────────────────────────────────────────────────
  const overdueList     = tasks.filter(t => !t.completed && t.due_date < todayStr).sort((a, b) => a.due_date.localeCompare(b.due_date))
  const todayList        = tasks.filter(t => !t.completed && t.due_date === todayStr)
  const uncontactedList  = leads.filter(l => l.status === 'new').sort((a, b) => b.created_at.localeCompare(a.created_at))
  const pendingList      = budgets.filter(b => b.status === 'sent' || b.status === 'viewed').sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  const expiredList      = budgets.filter(b => b.status === 'expired').sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  const overdueTasks    = overdueList.length
  const todayTasks       = todayList.length
  const uncontactedLeads = uncontactedList.length
  const pendingBudgets   = pendingList.length
  const expiredBudgets   = expiredList.length

  // ── Sources breakdown (with win-rate) ────────────────────────────────────────────
  const sourceStats = Object.entries(
    leads.reduce((acc: Record<string, { total: number; won: number }>, l) => {
      const k = l.source || 'other'
      acc[k] = acc[k] || { total: 0, won: 0 }
      acc[k].total++
      if (stageOf(l.status) === 'won') acc[k].won++
      return acc
    }, {})
  )
    .map(([source, v]) => ({ source, ...v, rate: v.total > 0 ? Math.round((v.won / v.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)
  const srcMax = sourceStats[0]?.total || 1
  const bestSource = [...sourceStats].filter(s => s.total >= 3).sort((a, b) => b.rate - a.rate)[0]

  // ── Leads trend (last 6 months) ──────────────────────────────────────────────────
  const trend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const start = d.toISOString()
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString()
    return {
      label: MONTHS_ABBR[d.getMonth()],
      count: leads.filter(l => l.created_at >= start && l.created_at < end).length,
    }
  })
  const trendMax = Math.max(1, ...trend.map(t => t.count))

  // ── Upcoming confirmed weddings ──────────────────────────────────────────────────
  const upcomingWeddings = leads
    .filter(l => stageOf(l.status) === 'won' && l.wedding_date && l.wedding_date >= todayStr)
    .sort((a, b) => a.wedding_date.localeCompare(b.wedding_date))
    .slice(0, 30)

  const totalViews = proposals.reduce((a, p) => a + (p.views || 0), 0)

  if (isBlocked) return null

  if (!authLoading && !activeVenue) {
    return <><Sidebar /><div className="main-layout" style={{ padding: '24px 28px' }}><NoVenueState /></div></>
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </div>
  )

  const DeltaPill = ({ value, suffix = '%' }: { value: number; suffix?: string }) => {
    const cls = value > 0 ? 'up' : value < 0 ? 'down' : 'flat'
    const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : null
    return (
      <span className={`kpi-delta ${cls}`}>
        {Icon && <Icon size={11} />}{value > 0 ? '+' : ''}{value}{suffix}
      </span>
    )
  }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Estadísticas</div>
          <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>
            {now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </span>
        </div>
        <div className="page-content">

          {/* ── KPI strip ──────────────────────────────────────────────── */}
          <div className="kpi-grid">
            <div className="kpi-card accent">
              <div className="kpi-head">
                <div className="kpi-icon"><Trophy size={15} /></div>
                <div className="kpi-label">Valor ganado</div>
              </div>
              <div className="kpi-value">{eur(wonValue)}</div>
              <div className="kpi-sub">
                {wonValueMonth > 0 ? `+${eur(wonValueMonth)} este mes` : `${acceptedBudgets.length} presupuestos cerrados`}
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-head">
                <div className="kpi-icon"><Wallet size={15} /></div>
                <div className="kpi-label">Pipeline abierto</div>
              </div>
              <div className="kpi-value">{eur(pipelineValue)}</div>
              <div className="kpi-sub">{pipelineCount} presupuestos · {activeLeads} leads activos</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-head">
                <div className="kpi-icon"><Target size={15} /></div>
                <div className="kpi-label">Tasa de conversión</div>
              </div>
              <div className="kpi-value">{conversion}%</div>
              <div className="kpi-sub">{wonLeads} ganados · {lostLeads} perdidos</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-head">
                <div className="kpi-icon"><UserPlus size={15} /></div>
                <div className="kpi-label">Leads nuevos</div>
              </div>
              <div className="kpi-value">{leadsThisMonth}</div>
              <div className="kpi-sub">
                <DeltaPill value={leadsDelta} /> vs mes anterior
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-head">
                <div className="kpi-icon"><Receipt size={15} /></div>
                <div className="kpi-label">Ticket medio</div>
              </div>
              <div className="kpi-value">{eur(avgTicket)}</div>
              <div className="kpi-sub">
                {acceptedBudgets.length > 0
                  ? `sobre ${acceptedBudgets.length} ${acceptedBudgets.length === 1 ? 'presupuesto aceptado' : 'presupuestos aceptados'}`
                  : 'sin presupuestos aceptados aún'}
              </div>
            </div>
          </div>

          {/* ── Attention banner (clickable → detail) ──────────────────── */}
          {(() => {
            const cards = [
              { key: 'overdue',     n: overdueTasks,     label: 'Tareas vencidas',                 icon: AlertTriangle, level: overdueTasks > 0 ? 'crit' : 'ok' },
              { key: 'today',       n: todayTasks,        label: 'Tareas para hoy',                  icon: Clock,         level: todayTasks > 0 ? 'warn' : 'ok' },
              { key: 'uncontacted', n: uncontactedLeads,  label: 'Leads sin contactar',              icon: UserPlus,      level: uncontactedLeads > 0 ? 'warn' : 'ok' },
              { key: 'pending',     n: pendingBudgets,    label: 'Presupuestos esperando respuesta', icon: FileText,      level: pendingBudgets > 0 ? 'warn' : 'ok' },
              { key: 'expired',     n: expiredBudgets,    label: 'Presupuestos expirados',           icon: Hourglass,     level: expiredBudgets > 0 ? 'warn' : 'ok' },
            ]
            const LISTS: Record<string, any[]> = { overdue: overdueList, today: todayList, uncontacted: uncontactedList, pending: pendingList, expired: expiredList }
            const active = cards.find(c => c.key === openAttn && c.n > 0)
            return (
              <div style={{ marginBottom: 20 }}>
                <div className="attn-grid" style={{ marginBottom: active ? 12 : 0 }}>
                  {cards.map(c => {
                    const Icon = c.icon
                    const clickable = c.n > 0
                    const isOpen = openAttn === c.key && clickable
                    return (
                      <div
                        key={c.key}
                        className={`attn-card ${c.level}${isOpen ? ' sel' : ''}`}
                        style={{ cursor: clickable ? 'pointer' : 'default' }}
                        role={clickable ? 'button' : undefined}
                        tabIndex={clickable ? 0 : undefined}
                        aria-expanded={clickable ? isOpen : undefined}
                        onClick={() => clickable && setOpenAttn(isOpen ? null : c.key)}
                        onKeyDown={e => {
                          if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault()
                            setOpenAttn(isOpen ? null : c.key)
                          }
                        }}
                      >
                        <div className="attn-ico"><Icon size={18} /></div>
                        <div style={{ flex: 1 }}>
                          <div className="attn-num">{c.n}</div>
                          <div className="attn-txt">{c.label}</div>
                        </div>
                        {clickable && <ChevronDown size={16} style={{ color: 'var(--warm-gray)', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />}
                      </div>
                    )
                  })}
                </div>

                {active && (
                  <div className="card">
                    <div className="card-header">
                      <div className="card-title">{active.label}</div>
                      {(active.key === 'overdue' || active.key === 'today') && (
                        <Link href="/calendar" style={{ fontSize: 11, color: 'var(--fe-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                          Ver agenda <ArrowRight size={11} />
                        </Link>
                      )}
                      {active.key === 'uncontacted' && (
                        <Link href="/leads" style={{ fontSize: 11, color: 'var(--fe-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                          Ver leads <ArrowRight size={11} />
                        </Link>
                      )}
                      {(active.key === 'pending' || active.key === 'expired') && (
                        <Link href="/budgets" style={{ fontSize: 11, color: 'var(--fe-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                          Ver presupuestos <ArrowRight size={11} />
                        </Link>
                      )}
                    </div>
                    <div>
                      {(active.key === 'overdue' || active.key === 'today') && (active.key === 'overdue' ? overdueList : todayList).slice(0, 8).map((t, i) => {
                        const daysOver = active.key === 'overdue' ? Math.round((now.getTime() - new Date(t.due_date).getTime()) / 86400000) : 0
                        const pc = t.priority === 'alta' ? '#B0473E' : t.priority === 'media' ? '#C99A3A' : 'var(--warm-gray)'
                        return (
                          <div key={t.id || i} style={{ padding: '10px 20px', borderBottom: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: pc, flexShrink: 0 }} />
                            <div style={{ flex: 1, fontSize: 13, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                            <div style={{ fontSize: 11, color: active.key === 'overdue' ? '#B0473E' : 'var(--warm-gray)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                              {active.key === 'overdue' ? `Hace ${daysOver} ${daysOver === 1 ? 'día' : 'días'}` : 'Hoy'}
                            </div>
                          </div>
                        )
                      })}

                      {active.key === 'uncontacted' && uncontactedList.slice(0, 8).map((l, i) => (
                        <Link key={l.id || i} href="/leads" style={{ padding: '10px 20px', borderBottom: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name || 'Sin nombre'}</div>
                            <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{SOURCE_LABEL[l.source] || l.source} · {new Date(l.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</div>
                          </div>
                          <ArrowRight size={13} style={{ color: 'var(--warm-gray)' }} />
                        </Link>
                      ))}

                      {(active.key === 'pending' || active.key === 'expired') && LISTS[active.key].slice(0, 8).map((b, i) => (
                        <Link key={i} href="/budgets" style={{ padding: '10px 20px', borderBottom: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.couple || 'Presupuesto'}</div>
                            <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                              {active.key === 'expired' ? 'Expirado' : b.status === 'viewed' ? 'Visto, sin responder' : 'Enviado'} · {new Date(b.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                            </div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fe-primary)' }}>{eur(Number(b.total || 0))}</div>
                        </Link>
                      ))}

                      {LISTS[active.key].length > 8 && (
                        <div style={{ padding: '10px 20px', fontSize: 11, color: 'var(--warm-gray)', textAlign: 'center' }}>
                          y {LISTS[active.key].length - 8} más…
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── Funnel + Sources ───────────────────────────────────────── */}
          <div className="two-col align-top" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Embudo de conversión</div>
                <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{inPipeline.length} en pipeline · {lostLeads} perdidos</span>
              </div>
              <div className="card-body">
                {inPipeline.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 13 }}>
                    Aún no hay leads que mostrar
                  </div>
                ) : funnelData.map((stage, i) => {
                  const pctOfTop = Math.round((stage.count / funnelMax) * 100)
                  const prev = i > 0 ? funnelData[i - 1].count : null
                  const stepConv = prev && prev > 0 ? Math.round((stage.count / prev) * 100) : null
                  return (
                    <div key={stage.status} className="funnel-row">
                      <div className="funnel-name">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                        {stage.label}
                      </div>
                      <div className="funnel-track">
                        <div className="funnel-fill" style={{ width: `${Math.max(pctOfTop, stage.count > 0 ? 6 : 0)}%`, background: stage.color }}>
                          {stage.count}
                        </div>
                      </div>
                      <div className="funnel-conv" title="Conversión respecto a la etapa anterior">
                        {stepConv !== null ? `${stepConv}% vs ant.` : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Leads por canal</div>
                {bestSource && (
                  <span style={{ fontSize: 11, color: 'var(--fe-primary)', fontWeight: 600 }}>
                    Mejor cierre: {SOURCE_LABEL[bestSource.source] || bestSource.source} ({bestSource.rate}%)
                  </span>
                )}
              </div>
              <div className="stat-list">
                {sourceStats.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 13 }}>
                    Sin datos de canales
                  </div>
                ) : sourceStats.map(s => (
                  <div key={s.source} style={{ padding: '9px 20px', borderBottom: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 12, flex: 1, color: 'var(--charcoal)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {SOURCE_LABEL[s.source] || s.source}
                    </div>
                    <div style={{ width: 90, height: 5, background: 'var(--ivory)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round((s.total / srcMax) * 100)}%`, height: '100%', background: 'var(--fe-primary)', borderRadius: 3, transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--charcoal)', minWidth: 22, textAlign: 'right', fontWeight: 600 }}>{s.total}</div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', minWidth: 52, textAlign: 'right' }}>
                      {s.won > 0 ? `${s.rate}% cierre` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Leads trend (full width) ───────────────────────────────── */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title">Tendencia de leads</div>
              <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>últimos 6 meses</span>
            </div>
            <div className="card-body">
              {(() => {
                // Línea y área en SVG estirado (preserveAspectRatio none); puntos y
                // etiquetas como HTML en % para que no se deformen al escalar
                const H = 200, padTop = 30, padBot = 26, padXPct = 4
                const innerH = H - padTop - padBot
                const stepPct = trend.length > 1 ? (100 - padXPct * 2) / (trend.length - 1) : 0
                const pts = trend.map((m, i) => ({
                  ...m,
                  xPct: padXPct + i * stepPct,
                  y: padTop + innerH - (m.count / trendMax) * innerH,
                }))
                const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.xPct.toFixed(2)} ${p.y.toFixed(1)}`).join(' ')
                const area = `${line} L ${pts[pts.length - 1].xPct.toFixed(2)} ${padTop + innerH} L ${pts[0].xPct.toFixed(2)} ${padTop + innerH} Z`
                return (
                  <div style={{ position: 'relative', height: H }}>
                    <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--fe-primary)" stopOpacity="0.28" />
                          <stop offset="100%" stopColor="var(--fe-primary)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <line x1={padXPct} y1={padTop + innerH} x2={100 - padXPct} y2={padTop + innerH} stroke="rgba(0,0,0,0.07)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                      <path d={area} fill="url(#trendGrad)" />
                      <path d={line} fill="none" stroke="var(--fe-primary)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                    </svg>
                    {pts.map((p, i) => (
                      <div key={i}>
                        <span style={{ position: 'absolute', left: `${p.xPct}%`, top: p.y, width: 9, height: 9, borderRadius: '50%', background: '#fff', border: '2.5px solid var(--fe-primary)', transform: 'translate(-50%, -50%)' }} />
                        <span style={{ position: 'absolute', left: `${p.xPct}%`, top: p.y - 24, transform: 'translateX(-50%)', fontSize: 12, fontWeight: 700, color: 'var(--fe-text-dark)', fontFamily: 'Inter, sans-serif' }}>{p.count}</span>
                        <span style={{ position: 'absolute', left: `${p.xPct}%`, bottom: 0, transform: 'translateX(-50%)', fontSize: 10, color: 'var(--fe-text-muted)', fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em' }}>{p.label.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>

          {/* ── Upcoming weddings + proposals ──────────────────────────── */}
          <div className="two-col align-top" style={{ marginBottom: 16 }}>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Próximas bodas confirmadas</div>
                <CalendarHeart size={14} style={{ color: 'var(--fe-primary)' }} />
              </div>
              <div className="stat-list">
                {upcomingWeddings.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 13 }}>
                    No hay bodas confirmadas próximamente
                  </div>
                ) : upcomingWeddings.map((l, i) => {
                  const wd = new Date(l.wedding_date)
                  const days = Math.ceil((wd.getTime() - now.getTime()) / 86400000)
                  return (
                    <div key={i} style={{ padding: '11px 20px', borderBottom: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(74,107,82,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Heart size={14} style={{ color: 'var(--fe-primary)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.name || 'Sin nombre'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                          {wd.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} · {days > 0 ? `En ${days} días` : 'Hoy'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Propuestas más activas</div>
                <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{totalViews} aperturas totales</span>
              </div>
              <div className="stat-list">
                {proposals.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 13 }}>
                    Aún no hay propuestas
                  </div>
                ) : proposals
                    .slice()
                    .sort((a, b) => (b.views || 0) - (a.views || 0))
                    .slice(0, 30)
                    .map(p => {
                      const pCtas = ctaReqs.filter(c => c.proposal_id === p.id).length
                      const pMsgs = messages.filter(m => m.proposal_id === p.id).length
                      return (
                        <div key={p.id} style={{ padding: '10px 20px', borderBottom: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.couple_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{new Date(p.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--warm-gray)', fontSize: 11 }} title="Aperturas">
                              <Eye size={11} /> {p.views || 0}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--warm-gray)', fontSize: 11 }} title="Solicitudes CTA">
                              <MousePointerClick size={11} /> {pCtas}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--warm-gray)', fontSize: 11 }} title="Mensajes">
                              <MessageSquare size={11} /> {pMsgs}
                            </div>
                          </div>
                        </div>
                      )
                    })}
              </div>
            </div>
          </div>

          <div className="alert alert-info">
            <Filter size={14} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12 }}>
              El valor ganado y el pipeline se calculan a partir de los presupuestos aceptados y enviados. El embudo muestra cuántos leads han alcanzado cada etapa (excluyendo los perdidos); los porcentajes indican la conversión respecto a la etapa anterior.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

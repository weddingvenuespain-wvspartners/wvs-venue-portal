"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase"
import { expandLeadDates, getLeadDateRanges, pad, type LeadDateRange } from "@/lib/lead-dates"
import { Calendar, Lock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

type CalendarStatus = "libre" | "negociacion" | "reservado" | "bloqueado"
type Entry = { date: string; status: CalendarStatus; lead_id: string | null }

const MONTHS_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

const SEASON_LABEL: Record<string, string> = {
  spring: "Primavera",
  summer: "Verano",
  autumn: "Otoño",
  winter: "Invierno",
}

const FLEX_LABEL: Record<string, string> = {
  exact: "Fecha exacta",
  range: "Rango",
  multi_range: "Varios rangos",
  month: "Mes preferido",
  season: "Temporada",
  flexible: "Fecha flexible",
}

const STATUS_STYLES: Record<CalendarStatus | "ownLead", { dot: string; bg: string; text: string; border: string; label: string }> = {
  libre:       { dot: "#16a34a", bg: "#f0fdf4", text: "#166534", border: "#bbf7d0", label: "Libre" },
  negociacion: { dot: "#f59e0b", bg: "#fffbeb", text: "#92400e", border: "#fde68a", label: "En negociación" },
  reservado:   { dot: "#ef4444", bg: "#fef2f2", text: "#991b1b", border: "#fecaca", label: "Reservado" },
  bloqueado:   { dot: "#6b7280", bg: "#f3f4f6", text: "#374151", border: "#d1d5db", label: "Bloqueado" },
  ownLead:     { dot: "#a855f7", bg: "#faf5ff", text: "#6b21a8", border: "#e9d5ff", label: "Este lead" },
}

const fmtShort = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" })

const fmtFull = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })

function fmtRange(r: LeadDateRange): string {
  if (!r.to || r.from === r.to) return fmtFull(r.from)
  return `${fmtShort(r.from)} – ${fmtShort(r.to)} ${r.to.slice(0, 4)}`
}

export function LeadDatesSection({ lead }: { lead: any }) {
  const flex: string = lead.date_flexibility || "exact"
  const ranges = useMemo(() => getLeadDateRanges(lead), [lead])
  const allDates = useMemo(() => expandLeadDates(lead), [lead])

  const [entries, setEntries] = useState<Map<string, Entry>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!allDates.length || !lead.user_id) return
    let cancelled = false
    setLoading(true)
    const supabase = createClient()
    const minDate = allDates[0]
    const maxDate = allDates[allDates.length - 1]
    supabase
      .from("calendar_entries")
      .select("date, status, lead_id")
      .eq("user_id", lead.user_id)
      .gte("date", minDate)
      .lte("date", maxDate)
      .then(({ data }) => {
        if (cancelled) return
        const m = new Map<string, Entry>()
        for (const row of (data ?? []) as Entry[]) m.set(row.date, row)
        setEntries(m)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [lead.id, lead.user_id, allDates.join(",")])

  const statusFor = (date: string): CalendarStatus | "ownLead" | null => {
    const e = entries.get(date)
    if (!e) return null
    if (e.lead_id && e.lead_id === lead.id) return "ownLead"
    return e.status
  }

  // Agregado: cuántas fechas en cada estado
  const summary = useMemo(() => {
    const acc = { libre: 0, negociacion: 0, reservado: 0, bloqueado: 0, ownLead: 0 } as Record<string, number>
    for (const d of allDates) {
      const s = statusFor(d) ?? "libre"
      acc[s] += 1
    }
    return acc
  }, [allDates, entries])

  // Bloque base con cabecera
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div style={{ marginBottom: 20, padding: "14px 16px", background: "var(--cream)", border: "1px solid var(--ivory)", borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Calendar size={14} style={{ color: "var(--gold)" }} />
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--warm-gray)" }}>
          Fechas solicitadas
        </div>
        <span style={{ fontSize: 10, color: "var(--warm-gray)", fontWeight: 500, padding: "2px 8px", background: "#fff", borderRadius: 10, border: "1px solid var(--ivory)" }}>
          {FLEX_LABEL[flex] ?? flex}
        </span>
      </div>
      {children}
    </div>
  )

  // Caso "month" / "season" / "flexible": no hay fechas concretas, no se cruza con disponibilidad
  if (flex === "month") {
    if (!lead.wedding_year || !lead.wedding_month) {
      return <Wrapper><div style={{ fontSize: 13, color: "var(--warm-gray)" }}>Sin mes especificado</div></Wrapper>
    }
    return (
      <Wrapper>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--charcoal)" }}>
          {MONTHS_ES[lead.wedding_month - 1]} {lead.wedding_year}
        </div>
        <div style={{ fontSize: 11, color: "var(--warm-gray)", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
          <AlertCircle size={11} /> El cliente no ha concretado día — sin cruce con calendario
        </div>
      </Wrapper>
    )
  }

  if (flex === "season") {
    return (
      <Wrapper>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--charcoal)" }}>
          {SEASON_LABEL[lead.wedding_season] ?? lead.wedding_season} {lead.wedding_year ?? ""}
        </div>
        <div style={{ fontSize: 11, color: "var(--warm-gray)", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
          <AlertCircle size={11} /> Temporada — sin cruce con calendario
        </div>
      </Wrapper>
    )
  }

  if (flex === "flexible") {
    return (
      <Wrapper>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--charcoal)" }}>Fecha flexible</div>
        <div style={{ fontSize: 11, color: "var(--warm-gray)", marginTop: 4 }}>
          El cliente no ha indicado fechas concretas
        </div>
      </Wrapper>
    )
  }

  if (!ranges.length) {
    return (
      <Wrapper>
        <div style={{ fontSize: 13, color: "var(--warm-gray)" }}>Sin fecha asignada</div>
      </Wrapper>
    )
  }

  // Render principal: lista de rangos con fechas individuales y badges
  return (
    <Wrapper>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {ranges.map((r, i) => {
          // Expandir este rango concreto
          const dates: string[] = []
          const start = new Date(r.from + "T12:00:00")
          const end = new Date((r.to || r.from) + "T12:00:00")
          const cursor = new Date(start)
          while (cursor <= end) {
            dates.push(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`)
            cursor.setDate(cursor.getDate() + 1)
          }
          return (
            <div key={i}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--charcoal)", marginBottom: 6 }}>
                {fmtRange(r)}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {dates.map((d) => {
                  const s = statusFor(d)
                  const cfg = s ? STATUS_STYLES[s] : STATUS_STYLES.libre
                  return (
                    <span
                      key={d}
                      title={`${fmtFull(d)} · ${cfg.label}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: cfg.bg,
                        color: cfg.text,
                        border: `1px solid ${cfg.border}`,
                        fontWeight: 500,
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot }} />
                      {fmtShort(d)}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Resumen */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--ivory)", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", fontSize: 11, color: "var(--warm-gray)" }}>
        {loading ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Loader2 size={11} className="animate-spin" /> Cruzando con calendario…
          </span>
        ) : (
          <>
            {summary.libre > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={11} style={{ color: STATUS_STYLES.libre.dot }} /> {summary.libre} libre{summary.libre !== 1 ? "s" : ""}
              </span>
            )}
            {summary.ownLead > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_STYLES.ownLead.dot }} /> {summary.ownLead} este lead
              </span>
            )}
            {summary.negociacion > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_STYLES.negociacion.dot }} /> {summary.negociacion} en negociación
              </span>
            )}
            {summary.reservado > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <AlertCircle size={11} style={{ color: STATUS_STYLES.reservado.dot }} /> {summary.reservado} reservada{summary.reservado !== 1 ? "s" : ""}
              </span>
            )}
            {summary.bloqueado > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Lock size={11} style={{ color: STATUS_STYLES.bloqueado.dot }} /> {summary.bloqueado} bloqueada{summary.bloqueado !== 1 ? "s" : ""}
              </span>
            )}
          </>
        )}
      </div>
    </Wrapper>
  )
}

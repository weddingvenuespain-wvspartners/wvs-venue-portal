import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { VisitAvailability, BlockedDate } from '@/lib/proposal-types'

function pad(n: number) { return String(n).padStart(2, '0') }
function dateToIso(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
// JS getDay(): 0=Sun…6=Sat → convert to 0=Mon…6=Sun
function jsDayToWeekday(d: number) { return d === 0 ? 6 : d - 1 }

// GET /api/proposals/[id]/visit-slots
// Public — returns available visit time slots for the next 90 days.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n) => cookieStore.get(n)?.value, set() {}, remove() {} } }
    )

    // 1. Get proposal → user_id
    const { data: proposal } = await supabase
      .from('proposals')
      .select('user_id')
      .eq('id', id)
      .maybeSingle()

    if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // 2. Get visit_availability config
    const { data: settings } = await supabase
      .from('venue_settings')
      .select('visit_availability')
      .eq('user_id', proposal.user_id)
      .maybeSingle()

    const config: VisitAvailability | null = settings?.visit_availability ?? null
    if (!config?.schedule?.length) return NextResponse.json({ slots: {} })

    const today = new Date()
    const horizon = new Date(today)
    horizon.setDate(horizon.getDate() + 90)
    const todayIso = dateToIso(today)
    const horizonIso = dateToIso(horizon)

    // 3. Already-scheduled visits (block those time slots)
    const { data: visits } = await supabase
      .from('leads')
      .select('visit_date, visit_time')
      .eq('user_id', proposal.user_id)
      .eq('status', 'visit_scheduled')
      .gte('visit_date', todayIso)
      .lte('visit_date', horizonIso)

    const takenSlots: Record<string, Set<string>> = {}
    for (const v of visits ?? []) {
      if (!v.visit_date || !v.visit_time) continue
      if (!takenSlots[v.visit_date]) takenSlots[v.visit_date] = new Set()
      takenSlots[v.visit_date].add(v.visit_time)
    }

    // 4. Blocked calendar dates — normalize legacy string[] to BlockedDate[]
    const rawBlocked: Array<BlockedDate | string> = config.blocked_dates ?? []
    const blockedMap: Record<string, BlockedDate> = {}
    for (const b of rawBlocked) {
      if (typeof b === 'string') blockedMap[b] = { date: b, type: 'full' }
      else blockedMap[b.date] = b
    }

    const blockedDates = new Set<string>(Object.keys(blockedMap))
    if (config.block_booked_weddings || config.block_calendar_unavailable) {
      const { data: calEntries } = await supabase
        .from('calendar_entries')
        .select('date, status')
        .eq('user_id', proposal.user_id)
        .gte('date', todayIso)
        .lte('date', horizonIso)

      for (const e of calEntries ?? []) {
        if (config.block_booked_weddings && (e.status === 'reservado' || e.status === 'ganado')) {
          blockedDates.add(e.date)
        } else if (config.block_calendar_unavailable && e.status !== 'libre') {
          blockedDates.add(e.date)
        }
      }
    }

    // 5. Generate available slots
    const duration = config.slot_duration ?? 60
    const slots: Record<string, string[]> = {}

    for (let i = 1; i <= 90; i++) {
      const dt = new Date(today)
      dt.setDate(dt.getDate() + i)
      const dateStr = dateToIso(dt)

      const block = blockedMap[dateStr]
      if (block?.type === 'full') continue

      const weekday = jsDayToWeekday(dt.getDay())
      const daySchedule = config.schedule.find(s => s.day === weekday)
      if (!daySchedule?.enabled) continue

      const [fh, fm] = daySchedule.from.split(':').map(Number)
      const [th, tm] = daySchedule.to.split(':').map(Number)
      const fromMin = fh * 60 + fm
      const toMin = th * 60 + tm

      // Determine blocked minute ranges for partial-day blocks
      let partialBlockedRanges: Array<[number, number]> = []
      if (block?.type === 'morning') partialBlockedRanges = [[0, 13 * 60]]
      else if (block?.type === 'afternoon') partialBlockedRanges = [[13 * 60, 24 * 60]]
      else if (block?.type === 'hours') {
        if (block.ranges?.length) {
          partialBlockedRanges = block.ranges.map(r => {
            const [fh, fm] = r.from.split(':').map(Number)
            const [th, tm] = r.to.split(':').map(Number)
            return [fh * 60 + fm, th * 60 + tm] as [number, number]
          })
        } else if (block.from && block.to) {
          // legacy single range
          const [bfh, bfm] = block.from.split(':').map(Number)
          const [bth, btm] = block.to.split(':').map(Number)
          partialBlockedRanges = [[bfh * 60 + bfm, bth * 60 + btm]]
        }
      }

      const isSlotBlocked = (slotMin: number) =>
        partialBlockedRanges.some(([s, e]) => slotMin >= s && slotMin < e)

      const daySlots: string[] = []
      for (let m = fromMin; m + duration <= toMin; m += duration) {
        if (isSlotBlocked(m)) continue
        const timeStr = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
        if (!takenSlots[dateStr]?.has(timeStr)) daySlots.push(timeStr)
      }

      if (daySlots.length > 0) slots[dateStr] = daySlots
    }

    return NextResponse.json({ slots })
  } catch (err: any) {
    console.error('[visit-slots]', err)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}

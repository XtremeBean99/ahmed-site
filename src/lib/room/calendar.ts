// src/lib/room/calendar.ts
//
// The wall calendar left of the Saitama poster: the visitor's own month, with
// today circled. Pure date logic and the wall's perspective live here (tested);
// calendar-art.ts draws the page and RoomCalendar.tsx puts it on the wall.

/** A visitor-local calendar date. `month` is 0-based, like Date. */
export interface CalendarDate {
  year: number
  month: number
  day: number
}

export function calendarDate(d: Date): CalendarDate {
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
}

const DAY_MS = 86_400_000
/** Whole days since the epoch for a calendar date, free of DST and time-of-day. */
const dayNumber = ({ year, month, day }: CalendarDate) => Date.UTC(year, month, day) / DAY_MS

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

export function daysInYear(year: number): number {
  return daysInMonth(year, 1) === 29 ? 366 : 365
}

/** 1 on 1 January. */
export function dayOfYear(date: CalendarDate): number {
  return dayNumber(date) - dayNumber({ year: date.year, month: 0, day: 1 }) + 1
}

/** Monday-first column (0 Mon .. 6 Sun), the way Australian calendars print. */
export function weekdayColumn(date: CalendarDate): number {
  return (new Date(Date.UTC(date.year, date.month, date.day)).getUTCDay() + 6) % 7
}

export interface CalendarCell {
  day: number
  col: number
  row: number
}

/** Every day of the month on a Monday-first grid; at most six rows. */
export function monthGrid(year: number, month: number): CalendarCell[] {
  const first = weekdayColumn({ year, month, day: 1 })
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => {
    const slot = first + i
    return { day: i + 1, col: slot % 7, row: Math.floor(slot / 7) }
  })
}

export type OccasionId = 'newYear' | 'valentines' | 'halloween' | 'christmas' | 'newYearsEve'

/** Fixed-date occasions marked on the page with a coloured dot. */
export const OCCASIONS: { id: OccasionId; month: number; day: number }[] = [
  { id: 'newYear', month: 0, day: 1 },
  { id: 'valentines', month: 1, day: 14 },
  { id: 'halloween', month: 9, day: 31 },
  { id: 'christmas', month: 11, day: 25 },
  { id: 'newYearsEve', month: 11, day: 31 },
]

export function occasionOn(month: number, day: number): OccasionId | null {
  return OCCASIONS.find((o) => o.month === month && o.day === day)?.id ?? null
}

/** The nearest occasion today or ahead (wrapping into next year), if within `withinDays`. */
export function upcomingOccasion(today: CalendarDate, withinDays = 14): { id: OccasionId; days: number } | null {
  let best: { id: OccasionId; days: number } | null = null
  for (const o of OCCASIONS) {
    let days = dayNumber({ year: today.year, month: o.month, day: o.day }) - dayNumber(today)
    if (days < 0) days = dayNumber({ year: today.year + 1, month: o.month, day: o.day }) - dayNumber(today)
    if (days <= withinDays && (!best || days < best.days)) best = { id: o.id, days }
  }
  return best
}

/** Milliseconds until the next local midnight, when the page has to turn. */
export function msUntilMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return next.getTime() - now.getTime()
}

/** The calendar's copy (en.ts room.calendar). */
export interface CalendarCopy {
  label: string
  dayOfYear: string
  soon: string
  tomorrow: string
  occasions: Record<OccasionId, { name: string; today: string }>
}

const LONG_DATE = new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

/** "Calendar: Sunday 25 October", the accessible name and tooltip. */
export function calendarLabel(today: CalendarDate, copy: CalendarCopy): string {
  const date = LONG_DATE.format(new Date(Date.UTC(today.year, today.month, today.day))).replace(',', '')
  return copy.label.replace('{date}', date)
}

/** What a click says: the day of the year, and the next occasion if it is close. */
export function calendarNote(today: CalendarDate, copy: CalendarCopy): string {
  const parts = [copy.dayOfYear.replace('{n}', String(dayOfYear(today))).replace('{total}', String(daysInYear(today.year)))]
  const next = upcomingOccasion(today)
  if (next) {
    const o = copy.occasions[next.id]
    if (next.days === 0) parts.push(o.today)
    else if (next.days === 1) parts.push(copy.tomorrow.replace('{occasion}', o.name))
    else parts.push(copy.soon.replace('{days}', String(next.days)).replace('{occasion}', o.name))
  }
  return parts.join(' ')
}

// ── Wall placement ──────────────────────────────────────────────────────────

/**
 * The page, flat: (u, v) in page pixels, (0, 0) its top-left corner. It hangs at
 * stage (PAGE.x, PAGE.y), on the back wall between the shelf and the Saitama
 * poster, clear of the poster's punch (which reaches x 745).
 */
export const PAGE = { x: 656, y: 114, w: 74, h: 110 }

/**
 * The back wall's vanishing point, measured off the Saitama poster (its top edge
 * falls 10 px over 128, its bottom edge 23): horizontal lines on the wall meet
 * here, so the page's right edge comes out a little shorter than its left.
 */
export const WALL_VANISHING_POINT = { x: 2948, y: -75 }

/** Stage rect of the canvas the calendar is drawn into (room for the hanger, shadow and highlight). */
export const CALENDAR_RECT = { x: PAGE.x - 3, y: PAGE.y - 16, w: PAGE.w + 7, h: PAGE.h + 20 }

/** Page point -> stage point, on the wall plane. */
export function wallPoint(u: number, v: number): { x: number; y: number } {
  const vp = WALL_VANISHING_POINT
  const x = PAGE.x + u
  const y = vp.y + (PAGE.y + v - vp.y) * (vp.x - x) / (vp.x - PAGE.x)
  return { x, y }
}

/** Stage point -> page point; the inverse of wallPoint. */
export function pagePoint(x: number, y: number): { u: number; v: number } {
  const vp = WALL_VANISHING_POINT
  return { u: x - PAGE.x, v: vp.y + (y - vp.y) * (vp.x - PAGE.x) / (vp.x - x) - PAGE.y }
}

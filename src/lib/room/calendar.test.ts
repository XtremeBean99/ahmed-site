import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calendarLabel,
  calendarNote,
  dayOfYear,
  daysInMonth,
  daysInYear,
  monthGrid,
  msUntilMidnight,
  occasionOn,
  pagePoint,
  upcomingOccasion,
  wallPoint,
  weekdayColumn,
  PAGE,
  CALENDAR_RECT,
  type CalendarCopy,
} from './calendar'
import { drawCalendar, seasonFor, textWidth } from './calendar-art'

const COPY: CalendarCopy = {
  label: 'Calendar: {date}',
  dayOfYear: 'Day {n} of {total}.',
  soon: '{days} days until {occasion}.',
  tomorrow: '{occasion} is tomorrow.',
  occasions: {
    newYear: { name: "New Year's Day", today: 'Happy New Year!' },
    valentines: { name: "Valentine's Day", today: "Happy Valentine's Day!" },
    halloween: { name: 'Halloween', today: 'Happy Halloween!' },
    christmas: { name: 'Christmas', today: 'Merry Christmas!' },
    newYearsEve: { name: "New Year's Eve", today: "It's New Year's Eve!" },
  },
}

test('month lengths and leap years', () => {
  assert.equal(daysInMonth(2026, 1), 28)
  assert.equal(daysInMonth(2028, 1), 29)
  assert.equal(daysInMonth(2026, 9), 31)
  assert.equal(daysInYear(2026), 365)
  assert.equal(daysInYear(2028), 366)
  assert.equal(daysInYear(2100), 365)
})

test('weeks start on Monday', () => {
  assert.equal(weekdayColumn({ year: 2026, month: 9, day: 25 }), 6) // a Sunday
  assert.equal(weekdayColumn({ year: 2026, month: 9, day: 26 }), 0) // a Monday
})

test('the month grid places every day once, Monday first, in at most six rows', () => {
  const oct = monthGrid(2026, 9)
  assert.equal(oct.length, 31)
  assert.deepEqual(oct[0], { day: 1, col: 3, row: 0 }) // 1 October 2026 is a Thursday
  assert.deepEqual(oct[24], { day: 25, col: 6, row: 3 })
  // August 2026 starts on a Saturday and needs the sixth row.
  const aug = monthGrid(2026, 7)
  assert.deepEqual(aug.at(-1), { day: 31, col: 0, row: 5 })
  for (let y = 2020; y < 2040; y++) {
    for (let m = 0; m < 12; m++) assert.ok(monthGrid(y, m).every((c) => c.row <= 5))
  }
})

test('day of the year', () => {
  assert.equal(dayOfYear({ year: 2026, month: 0, day: 1 }), 1)
  assert.equal(dayOfYear({ year: 2026, month: 9, day: 25 }), 298)
  assert.equal(dayOfYear({ year: 2028, month: 11, day: 31 }), 366)
})

test('occasions, including across the new year', () => {
  assert.equal(occasionOn(9, 31), 'halloween')
  assert.equal(occasionOn(9, 30), null)
  assert.deepEqual(upcomingOccasion({ year: 2026, month: 9, day: 25 }), { id: 'halloween', days: 6 })
  assert.deepEqual(upcomingOccasion({ year: 2026, month: 11, day: 25 }), { id: 'christmas', days: 0 })
  assert.deepEqual(upcomingOccasion({ year: 2026, month: 11, day: 31 }), { id: 'newYearsEve', days: 0 })
  assert.deepEqual(upcomingOccasion({ year: 2026, month: 11, day: 28 }), { id: 'newYearsEve', days: 3 })
  assert.equal(upcomingOccasion({ year: 2026, month: 5, day: 1 }), null)
})

test('the label and the click note read naturally', () => {
  assert.equal(calendarLabel({ year: 2026, month: 9, day: 25 }, COPY), 'Calendar: Sunday 25 October')
  assert.equal(calendarNote({ year: 2026, month: 9, day: 25 }, COPY), 'Day 298 of 365. 6 days until Halloween.')
  assert.equal(calendarNote({ year: 2026, month: 9, day: 30 }, COPY), 'Day 303 of 365. Halloween is tomorrow.')
  assert.equal(calendarNote({ year: 2026, month: 11, day: 25 }, COPY), 'Day 359 of 365. Merry Christmas!')
  assert.equal(calendarNote({ year: 2026, month: 6, day: 1 }, COPY), 'Day 182 of 365.')
})

test('midnight is counted in local time', () => {
  assert.equal(msUntilMidnight(new Date(2026, 9, 25, 23, 59, 0)), 60_000)
})

test('the page sits on the wall in perspective and the mapping inverts', () => {
  const tl = wallPoint(0, 0)
  assert.deepEqual(tl, { x: PAGE.x, y: PAGE.y })
  const tr = wallPoint(PAGE.w, 0)
  const br = wallPoint(PAGE.w, PAGE.h)
  assert.ok(tr.y < tl.y, 'the top edge rises toward the corner, like the poster')
  assert.ok(br.y - tr.y < PAGE.h, 'the far edge is shorter')
  const back = pagePoint(br.x, br.y)
  assert.ok(Math.abs(back.u - PAGE.w) < 1e-9 && Math.abs(back.v - PAGE.h) < 1e-9)
  // The whole page fits its canvas and stays clear of the Saitama poster's punch (x 745).
  assert.ok(CALENDAR_RECT.x + CALENDAR_RECT.w < 745)
  assert.ok(wallPoint(0, PAGE.h).y < CALENDAR_RECT.y + CALENDAR_RECT.h - 2)
})

test('the art draws the canvas, circles today and is deterministic', () => {
  const today = { year: 2026, month: 9, day: 25 }
  const a = drawCalendar(today)
  assert.equal(a.length, CALENDAR_RECT.w * CALENDAR_RECT.h * 4)
  assert.deepEqual(a, drawCalendar(today))
  const marker = (d: Uint8ClampedArray) => {
    let n = 0
    for (let i = 0; i < d.length; i += 4) if (d[i] === 0xcf && d[i + 1] === 0x33 && d[i + 2] === 0x28) n++
    return n
  }
  assert.ok(marker(a) > 20, 'a red ring is drawn')
  assert.notDeepEqual(a, drawCalendar({ ...today, day: 26 }))
  // The hover outline only adds pixels; night grades the page.
  const lit = drawCalendar(today, { highlight: 2 })
  let added = 0
  for (let i = 3; i < a.length; i += 4) if (!a[i] && lit[i]) added++
  assert.ok(added > 100)
  assert.notDeepEqual(a, drawCalendar(today, { light: 'night' }))
})

test('seasons are the southern hemisphere\'s, and the header fits the page', () => {
  assert.equal(seasonFor(0), 'summer')
  assert.equal(seasonFor(3), 'autumn')
  assert.equal(seasonFor(6), 'winter')
  assert.equal(seasonFor(9), 'spring')
  assert.equal(seasonFor(11), 'summer')
  assert.ok(textWidth('SEPTEMBER 2026') < PAGE.w - 4)
})

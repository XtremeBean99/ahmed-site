import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dailyDate, dailySeed, isAcceptedDailyDate, msUntilNextDaily, parseDailyResult } from './daily'
import { createDailyBoard } from './minesweeper-engine'
import { mulberry32 } from './cards'

const NOON = new Date('2026-10-13T12:00:00Z')

test('dailyDate is the UTC date', () => {
  assert.equal(dailyDate(NOON), '2026-10-13')
  // 9am in Canberra on the 14th is still the 13th in UTC.
  assert.equal(dailyDate(new Date('2026-10-13T22:00:00Z')), '2026-10-13')
})

test('dailySeed is stable and differs by day and game', () => {
  assert.equal(dailySeed('minesweeper', '2026-10-13'), dailySeed('minesweeper', '2026-10-13'))
  assert.notEqual(dailySeed('minesweeper', '2026-10-13'), dailySeed('minesweeper', '2026-10-14'))
  assert.notEqual(dailySeed('minesweeper', '2026-10-13'), dailySeed('solitaire', '2026-10-13'))
})

test('the server takes today and yesterday only', () => {
  assert.ok(isAcceptedDailyDate('2026-10-13', NOON))
  assert.ok(isAcceptedDailyDate('2026-10-12', NOON))
  assert.ok(!isAcceptedDailyDate('2026-10-11', NOON))
  assert.ok(!isAcceptedDailyDate('2026-10-14', NOON))
  assert.ok(!isAcceptedDailyDate('13/10/2026', NOON))
})

test('msUntilNextDaily counts to UTC midnight', () => {
  assert.equal(msUntilNextDaily(NOON), 12 * 3_600_000)
})

test('parseDailyResult validates the stored shape', () => {
  assert.deepEqual(parseDailyResult({ date: '2026-10-13', won: true, time: 42 }), { date: '2026-10-13', won: true, time: 42 })
  assert.equal(parseDailyResult({ date: 'x', won: true, time: 42 }), null)
  assert.equal(parseDailyResult(null), null)
})

test('the daily board is the same for everyone and opens from the centre', () => {
  const seed = dailySeed('minesweeper', '2026-10-13')
  const a = createDailyBoard(9, 9, 10, mulberry32(seed))
  const b = createDailyBoard(9, 9, 10, mulberry32(seed))
  assert.deepEqual(a, b)
  assert.equal(a.status, 'playing')
  assert.equal(a.cells.filter((c) => c.mine).length, 10)
  const centre = a.cells[4 * 9 + 4]
  assert.equal(centre.state, 'revealed')
  assert.equal(centre.mine, false)
  assert.equal(centre.adjacent, 0)
  const other = createDailyBoard(9, 9, 10, mulberry32(dailySeed('minesweeper', '2026-10-14')))
  assert.notDeepEqual(a.cells.map((c) => c.mine), other.cells.map((c) => c.mine))
})

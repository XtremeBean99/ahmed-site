import assert from 'node:assert/strict'
import test from 'node:test'
import { boardRegionWidth, LOG_DRAWER_WIDTH, wideColumnWidths } from './layout-math'

test('wideColumnWidths uses the larger columns from 1360 px', () => {
  assert.deepEqual(wideColumnWidths(1408), { left: 260, right: 300 })
  assert.deepEqual(wideColumnWidths(1360), { left: 260, right: 300 })
})

test('wideColumnWidths uses the tighter columns below 1360 px', () => {
  assert.deepEqual(wideColumnWidths(1359), { left: 230, right: 270 })
  assert.deepEqual(wideColumnWidths(1100), { left: 230, right: 270 })
})

test('boardRegionWidth subtracts the side columns and never goes below 320', () => {
  assert.equal(boardRegionWidth(1408), 848)
  assert.equal(boardRegionWidth(1100), 600)
  assert.equal(boardRegionWidth(400), 320)
})

test('the medium log drawer has a fixed 320 px width', () => {
  assert.equal(LOG_DRAWER_WIDTH, 320)
})

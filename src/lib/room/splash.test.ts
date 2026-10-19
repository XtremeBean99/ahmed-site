import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splashPlan, SPLASH_FULL_EVERY_MS, SPLASH_TOTAL_FRAMES } from './splash'

const NOW = 1_800_000_000_000

test('first visit plays the whole animation', () => {
  assert.equal(splashPlan(0, NOW).kind, 'full')
  assert.equal(splashPlan(0, NOW).startFrame, 0)
})

test('a visit within a day of the last full play gets the short cut', () => {
  const plan = splashPlan(NOW - 60_000, NOW)
  assert.equal(plan.kind, 'short')
  assert.ok(plan.startFrame > 0 && plan.startFrame < SPLASH_TOTAL_FRAMES)
})

test('after a day the whole animation plays again', () => {
  assert.equal(splashPlan(NOW - SPLASH_FULL_EVERY_MS, NOW).kind, 'full')
})

test('a timestamp from the future counts as long ago', () => {
  assert.equal(splashPlan(NOW + 60_000, NOW).kind, 'full')
})

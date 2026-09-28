import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fromView, toView, viewSize } from './pong-view'
import { COURT_H, COURT_W, LEFT_X, RIGHT_X } from './pong-engine'

test('viewSize returns the landscape court and the transposed portrait court', () => {
  assert.deepEqual(viewSize(false), { w: COURT_W, h: COURT_H })
  assert.deepEqual(viewSize(true), { w: COURT_H, h: COURT_W })
})

test('toView is the identity in landscape', () => {
  assert.deepEqual(toView(12.5, 34.5, false), { x: 12.5, y: 34.5 })
})

test('toView transposes the engine court in portrait', () => {
  assert.deepEqual(toView(0, 7, true), { x: 7, y: COURT_W })
  assert.deepEqual(toView(COURT_W, 140, true), { x: 140, y: 0 })
})

test('fromView is the identity in landscape', () => {
  assert.deepEqual(fromView(12.5, 34.5, false), { x: 12.5, y: 34.5 })
})

test('fromView inverts toView in both orientations', () => {
  const points = [
    [0, 0],
    [COURT_W, COURT_H],
    [12, 34],
    [265, 137],
    [COURT_W, 0],
    [0, COURT_H],
  ]
  for (const [x, y] of points) {
    const portrait = toView(x, y, true)
    assert.deepEqual(fromView(portrait.x, portrait.y, true), { x, y })
    const landscape = toView(x, y, false)
    assert.deepEqual(fromView(landscape.x, landscape.y, false), { x, y })
  }
})

test('the engine left paddle maps to the bottom half and the right paddle to the top half', () => {
  const left = toView(LEFT_X, 140, true)
  const right = toView(RIGHT_X, 140, true)
  assert.equal(left.x, 140)
  assert.equal(right.x, 140)
  assert.ok(left.y > COURT_W / 2)
  assert.ok(right.y < COURT_W / 2)
})

test('fromView sends the bottom half of the portrait court to the engine left side', () => {
  const bottom = fromView(140, 400, true)
  assert.equal(bottom.y, 140, 'the view x axis is the paddle axis in the engine')
  assert.ok(bottom.x < COURT_W / 2)
  const top = fromView(140, 60, true)
  assert.equal(top.y, 140)
  assert.ok(top.x > COURT_W / 2)
})

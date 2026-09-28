// src/lib/room/gestures.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { swipeDirection, lineCells } from './gestures'

test('a negative vertical swipe is up', () => {
  assert.equal(swipeDirection(0, -40), 'up')
})

test('a positive vertical swipe is down', () => {
  assert.equal(swipeDirection(0, 40), 'down')
})

test('a negative horizontal swipe is left', () => {
  assert.equal(swipeDirection(-40, 0), 'left')
})

test('a positive horizontal swipe is right', () => {
  assert.equal(swipeDirection(40, 0), 'right')
})

test('the dominant axis wins even when the other axis moved a little', () => {
  assert.equal(swipeDirection(30, 10), 'right')
  assert.equal(swipeDirection(-10, 30), 'down')
})

test('below the threshold is null', () => {
  assert.equal(swipeDirection(10, 20), null)
})

test('exactly at the threshold registers', () => {
  assert.equal(swipeDirection(24, 0), 'right')
  assert.equal(swipeDirection(0, -24), 'up')
})

test('an exact tie is null in every quadrant', () => {
  assert.equal(swipeDirection(30, 30), null)
  assert.equal(swipeDirection(-30, -30), null)
})

test('a custom threshold applies', () => {
  assert.equal(swipeDirection(6, 12, 10), 'down')
  assert.equal(swipeDirection(8, 8, 10), null)
  assert.equal(swipeDirection(9, 0, 10), null)
})

test('lineCells: a single point', () => {
  assert.deepEqual(lineCells(3, 4, 3, 4), [{ x: 3, y: 4 }])
})

test('lineCells: a horizontal run includes both ends', () => {
  assert.deepEqual(lineCells(0, 2, 3, 2), [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }])
})

test('lineCells: steep and reversed lines have no gaps', () => {
  for (const [x0, y0, x1, y1] of [[0, 0, 3, 11], [10, 9, 1, 2], [5, 0, 5, 7], [0, 6, 9, 0]]) {
    const cells = lineCells(x0, y0, x1, y1)
    assert.deepEqual(cells[0], { x: x0, y: y0 })
    assert.deepEqual(cells[cells.length - 1], { x: x1, y: y1 })
    for (let i = 1; i < cells.length; i++) {
      assert.ok(Math.abs(cells[i].x - cells[i - 1].x) <= 1 && Math.abs(cells[i].y - cells[i - 1].y) <= 1)
    }
    assert.equal(cells.length, Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1)
  }
})

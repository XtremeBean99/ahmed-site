// src/lib/room/gestures.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { swipeDirection } from './gestures'

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

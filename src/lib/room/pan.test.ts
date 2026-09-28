import { test } from 'node:test'
import assert from 'node:assert/strict'
import { releaseVelocity, stepMomentum } from './pan'

test('releaseVelocity is 0 with fewer than two samples', () => {
  assert.equal(releaseVelocity([], 100), 0)
  assert.equal(releaseVelocity([{ t: 0, x: 10 }], 100), 0)
})

test('releaseVelocity only uses samples inside the window', () => {
  const samples = [
    { t: -10, x: -10 },
    { t: 0, x: 0 },
    { t: 50, x: 50 },
    { t: 100, x: 100 },
  ]
  assert.equal(releaseVelocity(samples, 100, 100), 1)
})

test('releaseVelocity fits a positive slope over recent samples', () => {
  const samples = [
    { t: 0, x: 0 },
    { t: 10, x: 5 },
    { t: 20, x: 20 },
  ]
  assert.ok(Math.abs(releaseVelocity(samples, 20) - 1) < 1e-9)
})

test('releaseVelocity fits a negative slope over recent samples', () => {
  const samples = [
    { t: 0, x: 40 },
    { t: 10, x: 30 },
    { t: 20, x: 10 },
  ]
  assert.ok(Math.abs(releaseVelocity(samples, 20) + 1.5) < 1e-9)
})

test('releaseVelocity is 0 when all sample times are equal', () => {
  const samples = [
    { t: 10, x: 0 },
    { t: 10, x: 40 },
    { t: 10, x: 80 },
  ]
  assert.equal(releaseVelocity(samples, 10), 0)
})

test('stepMomentum decays velocity and moves x by v*dt', () => {
  const r = stepMomentum(0, 1, 100, -500, 500)
  assert.ok(Math.abs(r.v - Math.exp(-0.4)) < 1e-9)
  assert.ok(Math.abs(r.x - r.v * 100) < 1e-9)
  assert.equal(r.done, false)
})

test('stepMomentum clamps and stops at the min edge', () => {
  const r = stepMomentum(-80, -1, 100, -100, 500)
  assert.equal(r.x, -100)
  assert.equal(r.v, 0)
  assert.equal(r.done, true)
})

test('stepMomentum clamps and stops at the max edge', () => {
  const r = stepMomentum(90, 1, 100, -500, 100)
  assert.equal(r.x, 100)
  assert.equal(r.v, 0)
  assert.equal(r.done, true)
})

test('stepMomentum is done once the speed falls below 0.02', () => {
  const r = stepMomentum(0, 0.01, 16.7, -500, 500)
  assert.equal(r.done, true)
})

test('stepMomentum with no friction keeps its velocity', () => {
  const r = stepMomentum(0, 0.5, 16.7, -500, 500, 0)
  assert.equal(r.v, 0.5)
  assert.ok(Math.abs(r.x - 0.5 * 16.7) < 1e-9)
})

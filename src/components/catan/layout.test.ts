import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hitSize, layoutFor } from './layout'

test('layoutFor picks three columns only on wide landscape screens', () => {
  assert.equal(layoutFor(1920, 1080), 'wide')
  assert.equal(layoutFor(1408, 768), 'wide')
  assert.equal(layoutFor(1180, 820), 'wide')
  assert.equal(layoutFor(1100, 700), 'wide')
})

test('layoutFor uses the medium layout on small landscape screens', () => {
  assert.equal(layoutFor(1099, 768), 'medium')
  assert.equal(layoutFor(1024, 768), 'medium')
  assert.equal(layoutFor(844, 390), 'medium')
  assert.equal(layoutFor(700, 500), 'medium')
})

test('layoutFor stacks on portrait screens and narrow landscapes', () => {
  assert.equal(layoutFor(390, 844), 'stack')
  assert.equal(layoutFor(820, 1180), 'stack')
  assert.equal(layoutFor(699, 400), 'stack')
  assert.equal(layoutFor(1200, 1300), 'stack')
})

test('hitSize is 44 px for touch and 28 px for a mouse', () => {
  assert.equal(hitSize(true), 44)
  assert.equal(hitSize(false), 28)
})

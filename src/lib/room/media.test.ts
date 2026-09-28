import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isMediaVolumeReadOnly } from './media'

test('a probe that keeps the volume it was given is writable', () => {
  assert.equal(isMediaVolumeReadOnly({ volume: 1 }), false)
})

test('a probe that ignores the volume (iOS) is read-only', () => {
  const probe = { get volume() { return 1 }, set volume(_v: number) {} }
  assert.equal(isMediaVolumeReadOnly(probe), true)
})

test('a probe that throws counts as read-only', () => {
  const probe = { get volume() { return 1 }, set volume(_v: number) { throw new Error('nope') } }
  assert.equal(isMediaVolumeReadOnly(probe), true)
})

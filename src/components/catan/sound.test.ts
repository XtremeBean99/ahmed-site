import { test } from 'node:test'
import assert from 'node:assert/strict'
import { VOICES } from './sound'

test('every sound has short, quiet voices', () => {
  for (const [name, voices] of Object.entries(VOICES)) {
    assert.ok(voices.length > 0, `${name} has no voices`)
    for (const v of voices) {
      assert.ok(v.dur > 0 && (v.at ?? 0) + v.dur <= 0.8, `${name} lasts too long`)
      assert.ok(v.gain > 0 && v.gain <= 0.6, `${name} is too loud`)
      assert.ok(v.f > 0 && (v.f2 === undefined || v.f2 > 0), `${name} needs positive frequencies`)
    }
  }
})

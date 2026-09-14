import assert from 'node:assert/strict'
import test from 'node:test'
import { PREFS_KEY, readPrefs, writePrefs, type CatanPrefsStore } from './prefs'

function store(raw: string | null): CatanPrefsStore {
  let value = raw
  return {
    getItem(key: string) {
      assert.equal(key, PREFS_KEY)
      return value
    },
    setItem(key: string, next: string) {
      assert.equal(key, PREFS_KEY)
      value = next
    },
  }
}

test('readPrefs returns defaults for SSR (no storage)', () => {
  assert.deepEqual(readPrefs(null), { botSpeed: 450 })
  assert.deepEqual(readPrefs(undefined), { botSpeed: 450 })
})

test('readPrefs returns defaults for missing, invalid JSON, and wrong values', () => {
  assert.deepEqual(readPrefs(store(null)), { botSpeed: 450 })
  assert.deepEqual(readPrefs(store('{oops')), { botSpeed: 450 })
  assert.deepEqual(readPrefs(store('42')), { botSpeed: 450 })
  assert.deepEqual(readPrefs(store('{"botSpeed":123}')), { botSpeed: 450 })
  assert.deepEqual(readPrefs(store('{"botSpeed":"fast"}')), { botSpeed: 450 })
  assert.deepEqual(readPrefs(store('{"botSpeed":null}')), { botSpeed: 450 })
})

test('readPrefs accepts every valid speed', () => {
  for (const botSpeed of [0, 200, 450, 900]) {
    assert.deepEqual(readPrefs(store(JSON.stringify({ botSpeed }))), { botSpeed })
  }
})

test('writePrefs persists JSON and is a no-op without storage', () => {
  const target = store(null)
  writePrefs(target, { botSpeed: 900 })
  assert.equal(target.getItem(PREFS_KEY), '{"botSpeed":900}')
  writePrefs(null, { botSpeed: 0 })
})

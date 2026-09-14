import assert from 'node:assert/strict'
import test from 'node:test'
import { PREFS_KEY, readPrefs, writePrefs, type CatanPrefsStore } from './prefs'

const DEFAULTS = { botSpeed: 450, tooltips: true, showBoardKey: true }

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
  assert.deepEqual(readPrefs(null), DEFAULTS)
  assert.deepEqual(readPrefs(undefined), DEFAULTS)
})

test('readPrefs returns defaults for missing, invalid JSON, and wrong values', () => {
  assert.deepEqual(readPrefs(store(null)), DEFAULTS)
  assert.deepEqual(readPrefs(store('{oops')), DEFAULTS)
  assert.deepEqual(readPrefs(store('42')), DEFAULTS)
  assert.deepEqual(readPrefs(store('{"botSpeed":123}')), DEFAULTS)
  assert.deepEqual(readPrefs(store('{"botSpeed":"fast"}')), DEFAULTS)
  assert.deepEqual(readPrefs(store('{"botSpeed":null,"tooltips":"no","showBoardKey":"yes"}')), DEFAULTS)
})

test('readPrefs accepts every valid speed and keeps each field independently', () => {
  for (const botSpeed of [0, 200, 450, 900]) {
    assert.deepEqual(readPrefs(store(JSON.stringify({ botSpeed }))), { botSpeed, tooltips: true, showBoardKey: true })
  }
  assert.deepEqual(readPrefs(store('{"botSpeed":999,"tooltips":false}')), {
    botSpeed: 450,
    tooltips: false,
    showBoardKey: true,
  })
  assert.deepEqual(readPrefs(store('{"showBoardKey":false}')), {
    botSpeed: 450,
    tooltips: true,
    showBoardKey: false,
  })
})

test('writePrefs persists JSON and is a no-op without storage', () => {
  const target = store(null)
  writePrefs(target, { botSpeed: 900, tooltips: false, showBoardKey: false })
  assert.equal(target.getItem(PREFS_KEY), '{"botSpeed":900,"tooltips":false,"showBoardKey":false}')
  writePrefs(null, { botSpeed: 0, tooltips: true, showBoardKey: true })
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultPrefs, PREFS_KEY, readPrefs, readSetup, writePrefs, type CatanPrefsStore } from './prefs'

const DEFAULTS = defaultPrefs()

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

const SETUP = {
  playerCount: 4,
  name: 'Ahmed',
  color: 'blue',
  botLevel: 'hard',
  settings: { vpToWin: 12, friendlyRobber: true, board: 'starter', botTrades: false },
}

test('defaults keep the old fields and add sound, volume, animations and no remembered setup', () => {
  assert.deepEqual(DEFAULTS, {
    botSpeed: 450,
    tooltips: true,
    showBoardKey: true,
    sound: true,
    volume: 0.6,
    animations: true,
    lastSetup: null,
  })
})

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
  assert.deepEqual(readPrefs(store('{"sound":"on","volume":2,"animations":1,"lastSetup":"x"}')), DEFAULTS)
})

test('readPrefs keeps each valid field independently (v1 prefs still load)', () => {
  for (const botSpeed of [0, 200, 450, 900]) {
    assert.deepEqual(readPrefs(store(JSON.stringify({ botSpeed }))), { ...DEFAULTS, botSpeed })
  }
  assert.deepEqual(readPrefs(store('{"botSpeed":999,"tooltips":false}')), { ...DEFAULTS, tooltips: false })
  assert.deepEqual(readPrefs(store('{"showBoardKey":false}')), { ...DEFAULTS, showBoardKey: false })
  assert.deepEqual(readPrefs(store('{"sound":false,"volume":0,"animations":false}')), {
    ...DEFAULTS,
    sound: false,
    volume: 0,
    animations: false,
  })
})

test('readPrefs restores a valid remembered setup', () => {
  const prefs = readPrefs(store(JSON.stringify({ lastSetup: SETUP })))
  assert.deepEqual(prefs.lastSetup, SETUP)
})

test('readSetup rejects bad shapes and caps the untrusted name', () => {
  assert.equal(readSetup(null), null)
  assert.equal(readSetup({ ...SETUP, playerCount: 5 }), null)
  assert.equal(readSetup({ ...SETUP, color: 'green' }), null)
  assert.equal(readSetup({ ...SETUP, botLevel: 'insane' }), null)
  assert.equal(readSetup({ ...SETUP, settings: { ...SETUP.settings, vpToWin: 20 } }), null)
  assert.equal(readSetup({ ...SETUP, settings: { ...SETUP.settings, board: 'weird' } }), null)
  assert.equal(readSetup({ ...SETUP, name: 42 }), null)
  assert.equal(readSetup({ ...SETUP, name: '   a very long player name indeed   ' })?.name, 'a very long play')
})

test('writePrefs persists JSON and is a no-op without storage', () => {
  const target = store(null)
  writePrefs(target, { ...DEFAULTS, botSpeed: 900, tooltips: false })
  assert.deepEqual(JSON.parse(target.getItem(PREFS_KEY) ?? 'null'), { ...DEFAULTS, botSpeed: 900, tooltips: false })
  writePrefs(null, DEFAULTS)
})

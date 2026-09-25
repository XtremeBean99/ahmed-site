import assert from 'node:assert/strict'
import test from 'node:test'
import { intentForKey } from './shortcut-map'

function key(key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) {
  return { key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods }
}

test('maps the single-key shortcuts', () => {
  assert.equal(intentForKey(key('r')), 'roll')
  assert.equal(intentForKey(key('R')), 'roll')
  assert.equal(intentForKey(key('e')), 'endTurn')
  assert.equal(intentForKey(key('1')), 'buildRoad')
  assert.equal(intentForKey(key('2')), 'buildSettlement')
  assert.equal(intentForKey(key('3')), 'buildCity')
  assert.equal(intentForKey(key('4')), 'buyDev')
  assert.equal(intentForKey(key('t')), 'trade')
  assert.equal(intentForKey(key('p')), 'playCard')
  assert.equal(intentForKey(key('u')), 'undo')
  assert.equal(intentForKey(key('h')), 'hint')
  assert.equal(intentForKey(key('l')), 'log')
  assert.equal(intentForKey(key('Escape')), 'cancel')
  assert.equal(intentForKey(key('?', { shiftKey: true })), 'help')
})

test('maps zoom keys including their shifted forms', () => {
  assert.equal(intentForKey(key('+', { shiftKey: true })), 'zoomIn')
  assert.equal(intentForKey(key('=')), 'zoomIn')
  assert.equal(intentForKey(key('-')), 'zoomOut')
  assert.equal(intentForKey(key('_', { shiftKey: true })), 'zoomOut')
  assert.equal(intentForKey(key('0')), 'zoomFit')
})

test('Ctrl+Z is undo but other modifiers are ignored', () => {
  assert.equal(intentForKey(key('z', { ctrlKey: true })), 'undo')
  assert.equal(intentForKey(key('r', { ctrlKey: true })), null)
  assert.equal(intentForKey(key('r', { metaKey: true })), null)
  assert.equal(intentForKey(key('r', { altKey: true })), null)
  assert.equal(intentForKey(key('z', { ctrlKey: true, shiftKey: true })), null)
})

test('Shift is only accepted for the keys that need it', () => {
  assert.equal(intentForKey(key('r', { shiftKey: true })), null)
  assert.equal(intentForKey(key('1', { shiftKey: true })), null)
  assert.equal(intentForKey(key('Escape', { shiftKey: true })), null)
})

test('unknown keys map to null', () => {
  assert.equal(intentForKey(key('x')), null)
  assert.equal(intentForKey(key('F1')), null)
})

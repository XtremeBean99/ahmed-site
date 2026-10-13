import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appFromSearch, isLinkableApp, withApp } from './deep-link'

test('appFromSearch reads a linkable app, case-insensitively', () => {
  assert.equal(appFromSearch('?app=chess'), 'chess')
  assert.equal(appFromSearch('?x=1&app=Snake'), 'snake')
})

test('appFromSearch ignores unknown apps, the terminal and the desktop', () => {
  assert.equal(appFromSearch('?app=terminal'), null)
  assert.equal(appFromSearch('?app=desktop'), null)
  assert.equal(appFromSearch('?app=<script>'), null)
  assert.equal(appFromSearch(''), null)
})

test('withApp sets, replaces and clears the param, keeping the rest', () => {
  assert.equal(withApp('/', 'pong'), '/?app=pong')
  assert.equal(withApp('/?app=pong#desk', 'chess'), '/?app=chess#desk')
  assert.equal(withApp('/?light=night&app=pong#desk', 'desktop'), '/?light=night#desk')
  assert.equal(withApp('/?app=pong', null), '/')
})

test('isLinkableApp narrows strings', () => {
  assert.ok(isLinkableApp('mahjong'))
  assert.ok(!isLinkableApp('readme'))
  assert.ok(!isLinkableApp(undefined))
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { collapseAnnouncements, makeAnnounceSummary } from './announcer'

test('collapseAnnouncements keeps short queues unchanged', () => {
  const items = ['a', 'b', 'c', 'd', 'e']
  assert.deepEqual(collapseAnnouncements(items, 'summary'), items)
})

test('collapseAnnouncements collapses a queue over the threshold into the summary', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f']
  assert.deepEqual(collapseAnnouncements(items, 'Bram\'s turn: 6 events'), ["Bram's turn: 6 events"])
})

test('makeAnnounceSummary fills the player possessive and count', () => {
  assert.equal(makeAnnounceSummary('{player} turn: {count} events', "Bram's", 4), "Bram's turn: 4 events")
  assert.equal(makeAnnounceSummary('{player} turn: {count} events', 'Your', 2), 'Your turn: 2 events')
})

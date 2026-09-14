import assert from 'node:assert/strict'
import test from 'node:test'
import { fill } from './event-text'

test('fill inserts values literally, including $ replacement patterns in names', () => {
  assert.equal(fill('{player} wins!', { player: "$'x" }), "$'x wins!")
  assert.equal(fill('{a} and {b}', { a: '$&', b: '$`' }), '$& and $`')
  assert.equal(fill('{player} wins!', { player: '$$' }), '$$ wins!')
})

test('fill leaves unknown placeholders untouched and stringifies numbers', () => {
  assert.equal(fill('{missing} {player}', { player: 'You' }), '{missing} You')
  assert.equal(fill('{count} cards', { count: 3 }), '3 cards')
})

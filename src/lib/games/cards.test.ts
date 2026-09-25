import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDeck, shuffle, mulberry32, cardId, cardName, isRed, type CardNameLabels } from './cards'

test('a deck has 52 distinct cards and a shoe repeats it', () => {
  const deck = createDeck()
  assert.equal(deck.length, 52)
  assert.equal(new Set(deck.map(cardId)).size, 52)
  assert.equal(createDeck(6).length, 312)
})

test('shuffle is a seeded permutation that leaves the input alone', () => {
  const deck = createDeck()
  const a = shuffle(deck, mulberry32(7))
  const b = shuffle(deck, mulberry32(7))
  assert.deepEqual(a, b, 'same seed, same order')
  assert.notDeepEqual(a, deck)
  assert.deepEqual([...a].map(cardId).sort(), [...deck].map(cardId).sort())
  assert.equal(cardId(deck[0]), 'AS', 'input untouched')
})

test('names and colours', () => {
  const labels: CardNameLabels = {
    ranks: ['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'],
    suits: { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' },
    card: '{rank} of {suit}',
    faceDown: 'Face-down card',
  }
  assert.equal(cardName({ rank: 12, suit: 'H' }, labels), 'Queen of hearts')
  assert.equal(cardId({ rank: 10, suit: 'D' }), '10D')
  assert.ok(isRed('D') && !isRed('C'))
})

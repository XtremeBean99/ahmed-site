import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currentPhrase, newTest, shuffledOrder, stats, secondsLeft, tick, typeInput } from './typing-engine'
import { HISCORE_GAMES, isPlausibleScore, sortBoard } from './highscores'

const PHRASES = ['abc', 'hello', 'xyz']
const fixed = () => 0 // shuffles to a fixed order

test('shuffledOrder is a permutation', () => {
  const order = shuffledOrder(10, Math.random)
  assert.deepEqual([...order].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
})

test('the clock starts on the first character', () => {
  let s = newTest(PHRASES.length, 30, fixed)
  assert.equal(s.status, 'ready')
  s = typeInput(s, '', PHRASES, 1000)
  assert.equal(s.startedAt, null)
  const first = currentPhrase(s, PHRASES)
  s = typeInput(s, first[0], PHRASES, 5000)
  assert.equal(s.startedAt, 5000)
  assert.equal(s.status, 'running')
})

test('a phrase typed to its length advances and counts its correct characters', () => {
  let s = newTest(PHRASES.length, 30, fixed)
  const first = currentPhrase(s, PHRASES)
  const wrongLast = first.slice(0, -1) + '#'
  for (let i = 1; i <= wrongLast.length; i++) s = typeInput(s, wrongLast.slice(0, i), PHRASES, 1000 + i)
  assert.equal(s.pos, 1)
  assert.equal(s.typed, '')
  assert.equal(s.doneCorrect, first.length - 1)
  assert.equal(s.keystrokes, first.length)
  assert.equal(s.goodKeystrokes, first.length - 1)
})

test('backspacing a mistake keeps it in the accuracy', () => {
  let s = newTest(PHRASES.length, 30, fixed)
  const first = currentPhrase(s, PHRASES)
  s = typeInput(s, '#', PHRASES, 0)
  s = typeInput(s, '', PHRASES, 10)
  s = typeInput(s, first[0], PHRASES, 20)
  assert.equal(s.keystrokes, 2)
  assert.equal(s.goodKeystrokes, 1)
  assert.equal(stats(s, PHRASES, 20).accuracy, 50)
})

test('input past the phrase length is cut off', () => {
  let s = newTest(PHRASES.length, 30, fixed)
  const first = currentPhrase(s, PHRASES)
  s = typeInput(s, first + 'extra', PHRASES, 0)
  assert.equal(s.pos, 1)
  assert.equal(s.keystrokes, first.length)
})

test('the test ends when time is up and ignores later input', () => {
  let s = newTest(PHRASES.length, 15, fixed)
  s = typeInput(s, currentPhrase(s, PHRASES)[0], PHRASES, 0)
  assert.equal(tick(s, 14_999).status, 'running')
  assert.equal(secondsLeft(s, 14_001), 1)
  s = tick(s, 15_000)
  assert.equal(s.status, 'done')
  assert.equal(typeInput(s, 'zz', PHRASES, 15_100), s)
})

test('WPM is correct characters / 5 per minute, held at 0 in the first second', () => {
  let s = newTest(PHRASES.length, 60, fixed)
  const first = currentPhrase(s, PHRASES)
  s = typeInput(s, first, PHRASES, 0)
  assert.equal(stats(s, PHRASES, 500).wpm, 0)
  // first.length correct chars in 6 s: (n / 5) / 0.1 min
  assert.equal(stats(s, PHRASES, 6000).wpm, Math.round(first.length / 5 / 0.1))
})

test('highscore bounds and board order', () => {
  assert.equal(isPlausibleScore('snake', 12), true)
  assert.equal(isPlausibleScore('snake', 999), false)
  assert.equal(isPlausibleScore('typing', 80.5), false)
  assert.equal(isPlausibleScore('nope', 5), false)
  assert.equal(isPlausibleScore('minesweeper', 2), false)
  const board = [{ name: 'a', score: 30 }, { name: 'b', score: 10 }, { name: 'c', score: 20 }]
  assert.deepEqual(sortBoard('minesweeper', board).map((e) => e.name), ['b', 'c', 'a'])
  assert.deepEqual(sortBoard('snake', board).map((e) => e.name), ['a', 'c', 'b'])
  assert.equal(new Set(HISCORE_GAMES.map((g) => g.key)).size, HISCORE_GAMES.length)
})

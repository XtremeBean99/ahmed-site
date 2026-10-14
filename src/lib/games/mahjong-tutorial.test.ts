import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allTiles, applyAction, validateSave } from './mahjong-engine'
import { hintFor } from './mahjong-bot'
import { coachFor, matchesCoach, playTutorial, tutorialMatch, TUTORIAL_HAND } from './mahjong-tutorial'
import { fullSet } from './mahjong-tiles'

test('the practice deal holds all 144 tiles once and is a valid state', () => {
  const s = tutorialMatch()
  assert.deepEqual([...allTiles(s)].sort(), fullSet(true).sort())
  assert.deepEqual(s.seats[0].hand, [...TUTORIAL_HAND].sort((a, b) => fullSet(false).indexOf(a) - fullSet(false).indexOf(b)))
  assert.equal(s.phase, 'draw')
  assert.equal(s.turn, 0)
  assert.ok(validateSave(JSON.parse(JSON.stringify(s))))
})

test('the coach walks every lesson in order and the hand ends in your self-drawn win', () => {
  const seen: string[] = []
  let s = tutorialMatch()
  const end = playTutorial(s)
  assert.equal(end.phase, 'handOver')
  assert.equal(end.result?.kind, 'win')
  if (end.result?.kind !== 'win') return
  assert.equal(end.result.winner, 0)
  assert.equal(end.result.selfDrawn, true)
  assert.deepEqual(end.seats[0].melds.map((m) => m.kind), ['pung', 'chow'])
  // Replay, noting the steps that ask something of you.
  s = tutorialMatch()
  for (let i = 0; i < 400 && s.phase !== 'handOver'; i++) {
    const c = coachFor(s)
    if (c.expect && seen[seen.length - 1] !== c.step) seen.push(c.step)
    s = playTutorial(s, 1)
  }
  assert.deepEqual(seen, ['discardWind', 'pung', 'discardAfterPung', 'chow', 'discardReady', 'win'])
})

test('a move the lesson does not ask for is not accepted', () => {
  let s = tutorialMatch()
  s = playTutorial(s, 1) // your first draw
  const c = coachFor(s)
  assert.equal(c.step, 'discardWind')
  assert.equal(matchesCoach(c, { type: 'discard', tile: 'c1' }), false)
  assert.equal(matchesCoach(c, { type: 'discard', tile: 'w4' }), true)
  assert.notEqual(applyAction(s, 0, { type: 'discard', tile: 'w4' }), s)
})

test('hintFor suggests a legal move with its shanten', () => {
  const s = playTutorial(tutorialMatch(), 1)
  const h = hintFor(s, 0)
  assert.ok(h)
  assert.equal(h!.action.type, 'discard')
  assert.equal(typeof h!.shanten, 'number')
  assert.equal(hintFor(tutorialMatch(), 0), null)
})

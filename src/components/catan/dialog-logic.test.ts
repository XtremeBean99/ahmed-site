import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildNewGameSetup,
  clampVpToWin,
  discardAdd,
  discardRemove,
  initialNewGameForm,
  isVpToWin,
  normalizeName,
  tooltipGesture,
  yearOfPlentyAdd,
  yearOfPlentyPair,
  yearOfPlentyRemove,
  yearOfPlentyValid,
} from './dialog-logic'

const HAND = { brick: 3, lumber: 1, wool: 0, grain: 2, ore: 0 }
const BANK = { brick: 1, lumber: 2, wool: 0, grain: 0, ore: 1 }

test('normalizeName trims and caps untrusted player names', () => {
  assert.equal(normalizeName('  Ahmed  '), 'Ahmed')
  assert.equal(normalizeName('a very long player name indeed'), 'a very long play')
  assert.equal(normalizeName('   '), '')
})

test('isVpToWin and clampVpToWin keep the target from 8 to 13', () => {
  for (const vp of [8, 10, 13]) assert.equal(isVpToWin(vp), true)
  for (const vp of [7, 14, 9.5]) assert.equal(isVpToWin(vp), false)
  assert.equal(clampVpToWin(7), 8)
  assert.equal(clampVpToWin(14), 13)
  assert.equal(clampVpToWin(9.6), 10)
})

test('initialNewGameForm uses the remembered setup or the standard defaults', () => {
  assert.deepEqual(initialNewGameForm(null), {
    playerCount: 4,
    name: 'You',
    color: 'red',
    botLevel: 'normal',
    vpToWin: 10,
    board: 'balanced',
    friendlyRobber: false,
    botTrades: true,
  })

  const form = initialNewGameForm({
    playerCount: 3,
    name: 'Ahmed',
    color: 'blue',
    botLevel: 'hard',
    settings: { vpToWin: 12, friendlyRobber: true, board: 'starter', botTrades: false },
  })
  assert.equal(form.playerCount, 3)
  assert.equal(form.name, 'Ahmed')
  assert.equal(form.color, 'blue')
  assert.equal(form.botLevel, 'hard')
  assert.equal(form.vpToWin, 12)
  assert.equal(form.friendlyRobber, true)
  assert.equal(form.board, 'starter')
  assert.equal(form.botTrades, false)
})

test('buildNewGameSetup trims the name, falls back to You, and clamps the target', () => {
  assert.deepEqual(
    buildNewGameSetup({
      playerCount: 4,
      name: '  Aisha  ',
      color: 'orange',
      botLevel: 'normal',
      vpToWin: 20,
      board: 'random',
      friendlyRobber: true,
      botTrades: false,
    }),
    {
      playerCount: 4,
      name: 'Aisha',
      color: 'orange',
      botLevel: 'normal',
      settings: { vpToWin: 13, friendlyRobber: true, board: 'random', botTrades: false },
    },
  )

  assert.equal(
    buildNewGameSetup({
      playerCount: 3,
      name: '   ',
      color: 'red',
      botLevel: 'easy',
      vpToWin: 8,
      board: 'balanced',
      friendlyRobber: false,
      botTrades: true,
    }).name,
    'You',
  )
})

test('discard selection adds and removes while respecting the hand and the amount owed', () => {
  const empty = { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 }

  const one = discardAdd(empty, 'brick', HAND, 2)
  assert.deepEqual(one, { brick: 1, lumber: 0, wool: 0, grain: 0, ore: 0 })

  const two = discardAdd(one, 'grain', HAND, 2)
  assert.deepEqual(two, { brick: 1, lumber: 0, wool: 0, grain: 1, ore: 0 })

  // Owed total reached: no more cards may be added.
  assert.deepEqual(discardAdd(two, 'lumber', HAND, 2), two)

  // Cannot add more than the hand holds.
  let capped = empty
  for (let i = 0; i < 5; i++) capped = discardAdd(capped, 'brick', HAND, 4)
  assert.equal(capped.brick, 3)

  assert.deepEqual(discardRemove(two, 'brick'), { brick: 0, lumber: 0, wool: 0, grain: 1, ore: 0 })
  assert.deepEqual(discardRemove(two, 'wool'), two)
})

test('Year of Plenty picks two resources and never exceeds the bank', () => {
  const empty = { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 }

  const one = yearOfPlentyAdd(empty, 'brick', BANK)
  assert.equal(one.brick, 1)

  // The same resource twice is allowed while the bank has it; bank has 1 brick.
  assert.deepEqual(yearOfPlentyAdd(one, 'brick', BANK), one)

  const pair = yearOfPlentyAdd(one, 'ore', BANK)
  assert.equal(pair.ore, 1)
  assert.equal(yearOfPlentyValid(pair, BANK), true)

  // Total cap of two: a third resource is rejected.
  assert.deepEqual(yearOfPlentyAdd(pair, 'lumber', BANK), pair)

  // A resource the bank cannot pay is rejected.
  const wool = yearOfPlentyAdd(empty, 'wool', BANK)
  assert.equal(wool.wool, 0)

  assert.deepEqual(yearOfPlentyPair(pair), ['brick', 'ore'])
  assert.deepEqual(yearOfPlentyPair(one), null)
  assert.deepEqual(yearOfPlentyRemove(pair, 'brick'), { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 1 })
})

test('tooltip long-press gesture opens on hold, cancels on move, closes on lift', () => {
  const idle = { kind: 'idle' } as const
  assert.deepEqual(tooltipGesture(idle, 'move'), idle)
  assert.deepEqual(tooltipGesture(idle, 'longpress'), idle)

  const pressed = tooltipGesture(idle, 'down')
  assert.deepEqual(pressed, { kind: 'pressed' })

  const moving = tooltipGesture(pressed, 'move')
  assert.deepEqual(moving, { kind: 'moving' })
  // Moving has cancelled the long-press: a late timer cannot open it.
  assert.deepEqual(tooltipGesture(moving, 'longpress'), moving)
  assert.deepEqual(tooltipGesture(moving, 'up'), idle)

  const open = tooltipGesture(pressed, 'longpress')
  assert.deepEqual(open, { kind: 'open' })
  // The auto-dismiss timeout closes it.
  assert.deepEqual(tooltipGesture(open, 'dismiss'), idle)

  const openAgain = tooltipGesture(tooltipGesture(idle, 'down'), 'longpress')
  assert.deepEqual(tooltipGesture(openAgain, 'up'), idle)
})

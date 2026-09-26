import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateAction } from '../engine'
import { give, makeTestState, putRoadPath, putSettlement, res } from '../test-fixtures'
import type { GameState, PlayerId, TradeOffer } from '../types'
import { botAcceptsTrade, chooseBotAction } from './index'
import { offerToHumanAllowed, proposeTradeAction } from './trade'

function shortState(bot: PlayerId): GameState {
  const s = makeTestState({ phase: { kind: 'main' }, current: 0 })
  putSettlement(s, bot, 17)
  putRoadPath(s, bot, [17, 22, 28])
  give(s, bot, { brick: 4, wool: 1, grain: 1 })
  s.players[bot].citiesLeft = 0
  return s
}

test('proposeTradeAction never includes a player at or above vpToWin - 2', () => {
  const s = shortState(0)
  putSettlement(s, 1, 4)
  putSettlement(s, 1, 7)
  putSettlement(s, 1, 10)
  putSettlement(s, 1, 13)
  putSettlement(s, 1, 16)
  putSettlement(s, 1, 19)
  putSettlement(s, 1, 24)
  putSettlement(s, 1, 28)
  give(s, 2, { lumber: 1 })

  const action = proposeTradeAction(s, 0, 'normal')
  assert.ok(action)
  if (action.type !== 'proposeTrade') throw new Error('unreachable')
  assert.equal(action.to.includes(1), false)
  assert.deepEqual(action.to, [2])
})

test('proposeTradeAction respects the per-turn cap for each level', () => {
  const eligible = shortState(0)
  give(eligible, 1, { lumber: 1 })
  give(eligible, 2, { lumber: 1 })

  const easyCapped = structuredClone(eligible)
  easyCapped.offersThisTurn = 1
  assert.equal(proposeTradeAction(easyCapped, 0, 'easy'), null)

  const normalCapped = structuredClone(eligible)
  normalCapped.offersThisTurn = 2
  assert.equal(proposeTradeAction(normalCapped, 0, 'normal'), null)

  assert.ok(proposeTradeAction(eligible, 0, 'easy'))
})

test('proposeTradeAction never repeats an identical proposal this turn', () => {
  const s = shortState(0)
  give(s, 1, { lumber: 1 })
  give(s, 2, { lumber: 1 })
  give(s, 3, { lumber: 1 })
  s.events.push({
    seq: s.eventSeq + 1,
    turn: s.turn,
    type: 'tradeProposed',
    player: 0,
    offerId: 1,
    to: [2],
    give: res({ brick: 2 }),
    get: res({ lumber: 1 }),
  })
  s.eventSeq += 1

  const action = proposeTradeAction(s, 0, 'normal')
  assert.equal(action?.type, 'proposeTrade')
  if (action.type !== 'proposeTrade') throw new Error('unreachable')
  assert.deepEqual(action.to, [1, 3])
})

test('Normal counters a human offer with a valid swap to a surplus resource', () => {
  const bot: PlayerId = 1
  const human: PlayerId = 0
  const offer: TradeOffer = {
    id: 1,
    from: human,
    to: [bot],
    replies: ['decline', 'pending', 'decline', 'decline'],
    counters: [null, null, null, null],
    give: res({ brick: 1 }),
    get: res({ grain: 1 }),
  }
  const s = makeTestState({ phase: { kind: 'trade', offer }, current: human })
  putSettlement(s, bot, 17)
  give(s, bot, { lumber: 2, wool: 2, grain: 1, ore: 4 })
  give(s, human, { brick: 1 })

  const action = chooseBotAction(s, bot, { level: 'normal' })
  assert.equal(action.type, 'respondTrade')
  if (action.type !== 'respondTrade') throw new Error('unreachable')
  assert.equal(action.player, bot)
  assert.equal(action.reply, 'counter')
  assert.equal(validateAction(s, action), null)
  assert.ok(action.counter)
  assert.deepEqual(action.counter.get, res({ lumber: 1 }))
  assert.deepEqual(action.counter.give, res({ brick: 1 }))
})

test('bots decline each other without countering', () => {
  const bot: PlayerId = 1
  const offer: TradeOffer = {
    id: 1,
    from: 2,
    to: [bot],
    replies: ['decline', 'pending', 'decline', 'decline'],
    counters: [null, null, null, null],
    give: res({ brick: 1 }),
    get: res({ grain: 1 }),
  }
  const s = makeTestState({ phase: { kind: 'trade', offer }, current: 2 })
  putSettlement(s, bot, 17)
  give(s, bot, { lumber: 2, wool: 2, grain: 1, ore: 4 })

  const action = chooseBotAction(s, bot, { level: 'normal' })
  assert.equal(action.type, 'respondTrade')
  if (action.type !== 'respondTrade') throw new Error('unreachable')
  assert.equal(action.reply, 'decline')
})

test('Easy never counters a human offer', () => {
  const bot: PlayerId = 1
  const human: PlayerId = 0
  const offer: TradeOffer = {
    id: 1,
    from: human,
    to: [bot],
    replies: ['decline', 'pending', 'decline', 'decline'],
    counters: [null, null, null, null],
    give: res({ wool: 1 }),
    get: res({ ore: 3 }),
  }
  const s = makeTestState({ phase: { kind: 'trade', offer }, current: human })
  putSettlement(s, bot, 17)
  give(s, bot, { lumber: 2, wool: 2, grain: 1, ore: 4 })
  give(s, human, { wool: 1 })

  const action = chooseBotAction(s, bot, { level: 'easy' })
  assert.equal(action.type, 'respondTrade')
  if (action.type !== 'respondTrade') throw new Error('unreachable')
  assert.equal(action.reply, 'decline')
})

test('botAcceptsTrade is level aware: Easy generous, Normal and Hard strict', () => {
  const bot: PlayerId = 1
  const s = makeTestState({ phase: { kind: 'main' }, current: 0 })
  putSettlement(s, bot, 17)
  give(s, bot, { grain: 1, ore: 4 })

  const offer = { from: 0, give: res({ wool: 1 }), get: res({ ore: 2 }) }
  assert.equal(botAcceptsTrade(s, bot, offer, { level: 'easy' }), true)
  assert.equal(botAcceptsTrade(s, bot, offer, { level: 'normal' }), false)
  assert.equal(botAcceptsTrade(s, bot, offer, { level: 'hard' }), false)
})

test('proposer confirms with the accepting partner who has the fewest public VP', () => {
  const bot: PlayerId = 0
  const offer: TradeOffer = {
    id: 1,
    from: bot,
    to: [1, 2],
    replies: ['decline', 'accept', 'accept', 'decline'],
    counters: [null, null, null, null],
    give: res({ brick: 1 }),
    get: res({ lumber: 1 }),
  }
  const s = makeTestState({ phase: { kind: 'trade', offer }, current: bot })
  putSettlement(s, 2, 4)
  putSettlement(s, 2, 7)
  give(s, bot, { brick: 1 })
  give(s, 1, { lumber: 1 })
  give(s, 2, { lumber: 1 })

  const action = chooseBotAction(s, bot, { level: 'normal' })
  assert.equal(action.type, 'confirmTrade')
  if (action.type !== 'confirmTrade') throw new Error('unreachable')
  assert.equal(action.partner, 1)
})

function botShort(): GameState {
  // Seat 1 is a bot one lumber short of a settlement; seat 0 is the human.
  const s = makeTestState({ phase: { kind: 'main' }, current: 1 })
  putSettlement(s, 1, 17)
  putRoadPath(s, 1, [17, 22, 28])
  give(s, 1, { brick: 4, wool: 1, grain: 1 })
  s.players[1].citiesLeft = 0
  return s
}

test('bots only ask the human for cards the human probably holds', () => {
  const poor = botShort()
  give(poor, 0, { ore: 1 })
  give(poor, 2, { lumber: 1 })
  const withoutHuman = proposeTradeAction(poor, 1, 'normal')
  assert.equal(withoutHuman?.type, 'proposeTrade')
  if (withoutHuman?.type !== 'proposeTrade') throw new Error('unreachable')
  assert.equal(withoutHuman.to.includes(0), false)

  const rich = botShort()
  give(rich, 0, { lumber: 2, ore: 3, grain: 3, wool: 2 })
  assert.equal(offerToHumanAllowed(rich, 1, 0, res({ lumber: 1 })), true)
  const withHuman = proposeTradeAction(rich, 1, 'normal')
  if (withHuman?.type !== 'proposeTrade') throw new Error('expected a proposal')
  assert.ok(withHuman.to.includes(0))
})

test('bots ask the human at most once per turn and not right after a refusal', () => {
  const s = botShort()
  give(s, 0, { lumber: 2, ore: 3, grain: 3, wool: 2 })
  const asked = structuredClone(s)
  asked.events.push({ seq: asked.eventSeq + 1, turn: asked.turn, type: 'tradeProposed', player: 1, offerId: 3, to: [0, 2], give: res({ brick: 1 }), get: res({ grain: 1 }) })
  assert.equal(offerToHumanAllowed(asked, 1, 0, res({ lumber: 1 })), false)

  const refused = structuredClone(s)
  refused.turn = 9
  refused.events.push(
    { seq: 1, turn: 7, type: 'tradeProposed', player: 1, offerId: 5, to: [0], give: res({ brick: 1 }), get: res({ lumber: 1 }) },
    { seq: 2, turn: 7, type: 'tradeReplied', player: 0, offerId: 5, reply: 'decline', counter: null },
  )
  assert.equal(offerToHumanAllowed(refused, 1, 0, res({ lumber: 1 })), false)

  const longAgo = structuredClone(refused)
  longAgo.turn = 12
  assert.equal(offerToHumanAllowed(longAgo, 1, 0, res({ lumber: 1 })), true)
})


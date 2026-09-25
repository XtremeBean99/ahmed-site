import assert from 'node:assert/strict'
import test from 'node:test'
import { en } from '@/lib/i18n/dictionaries/en'
import { makeTestState } from '@/lib/games/catan/test-fixtures'
import type { GameEvent } from '@/lib/games/catan/types'
import { fill, formatEvent, formatEventText, type EventSegment } from './event-text'

test('fill inserts values literally, including $ replacement patterns in names', () => {
  assert.equal(fill('{player} wins!', { player: "$'x" }), "$'x wins!")
  assert.equal(fill('{a} and {b}', { a: '$&', b: '$`' }), '$& and $`')
  assert.equal(fill('{player} wins!', { player: '$$' }), '$$ wins!')
})

test('fill leaves unknown placeholders untouched and stringifies numbers', () => {
  assert.equal(fill('{missing} {player}', { player: 'You' }), '{missing} You')
  assert.equal(fill('{count} cards', { count: 3 }), '3 cards')
})

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
type EventBody = DistributiveOmit<GameEvent, 'seq' | 'turn'>

function event(body: EventBody): GameEvent {
  return { ...body, seq: 1, turn: 1 } as GameEvent
}

const texts = (segments: EventSegment[]): string => segments.map((s) => s.text).join('')

test('formatEvent marks players, dice and resources in a roll and produce', () => {
  const state = makeTestState()
  const roll = formatEvent(
    state,
    event({ type: 'roll', player: 0, dice: [3, 5] }),
    en,
  )
  assert.equal(texts(roll), 'You rolled a 8')
  assert.equal(roll[0].kind, 'player')
  const dice = roll.find((s) => s.kind === 'dice')
  assert.equal(dice?.text, '8')
  assert.equal(dice?.value, 8)

  const produce = formatEvent(
    state,
    event({
      type: 'produce',
      gains: [
        { brick: 2, lumber: 0, wool: 0, grain: 0, ore: 0 },
        { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 },
        { brick: 0, lumber: 0, wool: 0, grain: 1, ore: 0 },
        { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 },
      ],
      blocked: [{ brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 }, { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 }, { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 }, { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 }],
      shortage: [],
    }),
    en,
  )
  assert.equal(texts(produce), 'You collected 2 brick, Bot 2 collected 1 grain')
  assert.deepEqual(produce.filter((s) => s.kind === 'count').map((s) => s.value), [2, 1])
  assert.deepEqual(produce.filter((s) => s.kind === 'resource').map((s) => s.resource), ['brick', 'grain'])
})

test('formatEvent keeps stolen card hidden in bot-vs-bot steals only', () => {
  const state = makeTestState()
  const botVsBot = formatEvent(
    state,
    event({ type: 'stole', player: 1, victim: 2, resource: 'ore' }),
    en,
  )
  assert.equal(texts(botVsBot), 'Bot 1 stole a card from Bot 2')
  assert.equal(botVsBot.some((s) => s.kind === 'resource'), false)

  const fromYou = formatEvent(
    state,
    event({ type: 'stole', player: 1, victim: 0, resource: 'ore' }),
    en,
  )
  assert.equal(texts(fromYou), 'Bot 1 stole ore from you')
  assert.equal(fromYou.some((s) => s.kind === 'resource' && s.resource === 'ore'), true)
})

test('formatEvent marks robber, cards and vp events', () => {
  const state = makeTestState()
  const robber = formatEvent(
    state,
    event({ type: 'robberMoved', player: 0, hex: 12 }),
    en,
  )
  assert.equal(texts(robber), 'You moved the robber to Lumber 8')
  assert.equal(robber.find((s) => s.kind === 'robber')?.text, 'robber')

  const roadBuilding = formatEvent(
    state,
    event({ type: 'playedDevCard', player: 0, card: 'roadBuilding' }),
    en,
  )
  assert.equal(texts(roadBuilding), 'You played Road Building')
  assert.equal(roadBuilding.find((s) => s.kind === 'card')?.text, 'Road Building')

  const army = formatEvent(
    state,
    event({ type: 'largestArmy', player: 0 }),
    en,
  )
  assert.equal(texts(army), 'You took Largest Army')
  assert.equal(army.find((s) => s.kind === 'vp')?.text, 'Largest Army')
})

test('formatEventText joins segments back into the full sentence', () => {
  const state = makeTestState()
  const e = event({ type: 'monopoly', player: 1, resource: 'wool', taken: 3, takenFrom: [3, 0, 0, 0] })
  assert.equal(formatEventText(state, e, en), 'Bot 1 monopolised wool, taking 3')
})

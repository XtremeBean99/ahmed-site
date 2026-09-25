import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame } from './board'
import { applyAction } from './engine'
import { EDGES, VERTICES } from './geometry'
import { give, makeTestState, putCity, putRoadPath, putSettlement, res } from './test-fixtures'
import type { GameState } from './types'

function roadChain(start: number, length: number): number[] {
  const vertices = [start]
  const used = new Set([start])
  let current = start
  while (vertices.length < length + 1) {
    const edge = VERTICES[current].edges.find((e) => {
      const [a, b] = EDGES[e].vertices
      const next = a === current ? b : a
      return !used.has(next)
    })
    assert.ok(edge !== undefined, 'expected the vertex chain to continue')
    const [a, b] = EDGES[edge].vertices
    const next = a === current ? b : a
    vertices.push(next)
    used.add(next)
    current = next
  }
  return vertices
}

function addPublicVp(state: GameState, vp: number, exclude: number[] = []): void {
  const excluded = new Set(exclude)
  let placed = 0
  for (let vertex = 0; vertex < VERTICES.length && placed < vp; vertex++) {
    if (excluded.has(vertex)) continue
    if (placed + 2 <= vp) {
      putCity(state, 0, vertex)
      placed += 2
    } else {
      putSettlement(state, 0, vertex)
      placed += 1
    }
  }
  assert.equal(placed, vp, 'could not place enough pieces for the target VP')
}

test('buying a victory point card at target-1 ends the game at once', () => {
  const state = makeTestState({ phase: { kind: 'main' }, current: 0 })
  state.devDeck = ['victoryPoint']
  addPublicVp(state, 9)
  give(state, 0, res({ wool: 1, grain: 1, ore: 1 }))

  const next = applyAction(state, { type: 'buyDevCard' })
  assert.equal(next.phase.kind, 'gameOver')
  if (next.phase.kind === 'gameOver') assert.equal(next.phase.winner, 0)
  assert.ok(next.players[0].newDevCards.includes('victoryPoint'))
  const finalRow = next.stats.vpHistory.at(-1)
  assert.ok(finalRow)
  assert.equal(finalRow[0], 10)
})

test('a Longest Road change on someone else\'s turn wins only when that player\'s turn starts', () => {
  const state = makeTestState({ phase: { kind: 'main' }, current: 3 })
  addPublicVp(state, 8)
  putRoadPath(state, 0, roadChain(0, 5))
  putSettlement(state, 3, 50)
  give(state, 3, res({ brick: 1, lumber: 1 }))
  const edge = VERTICES[50].edges.find((e) => state.roads[e] === null)
  assert.ok(edge !== undefined)

  const afterRoad = applyAction(state, { type: 'buildRoad', edge })
  assert.equal(afterRoad.longestRoadHolder, 0)
  assert.equal(afterRoad.phase.kind, 'main')

  const afterEndTurn = applyAction(afterRoad, { type: 'endTurn' })
  assert.equal(afterEndTurn.current, 0)
  assert.equal(afterEndTurn.phase.kind, 'gameOver')
  if (afterEndTurn.phase.kind === 'gameOver') assert.equal(afterEndTurn.phase.winner, 0)
})

test('a third knight before the roll grants Largest Army and can end the game before rolling', () => {
  const state = makeTestState({ phase: { kind: 'preRoll' }, current: 0 })
  addPublicVp(state, 8)
  state.players[0].knightsPlayed = 2
  state.players[0].devCards.push('knight')

  const next = applyAction(state, { type: 'playKnight' })
  assert.equal(next.players[0].knightsPlayed, 3)
  assert.equal(next.largestArmyHolder, 0)
  assert.equal(next.phase.kind, 'gameOver')
  if (next.phase.kind === 'gameOver') assert.equal(next.phase.winner, 0)
})

test('a game at target 8 ends at 8 and a game at target 13 does not end at 12', () => {
  const eight = makeTestState({ phase: { kind: 'main' }, current: 0 })
  eight.settings = { ...eight.settings, vpToWin: 8 }
  addPublicVp(eight, 8)
  give(eight, 0, res({ brick: 1, lumber: 1 }))
  const eightNext = applyAction(eight, { type: 'buildRoad', edge: VERTICES[0].edges[0] })
  assert.equal(eightNext.phase.kind, 'gameOver')

  const thirteen = makeTestState({ phase: { kind: 'main' }, current: 0 })
  thirteen.settings = { ...thirteen.settings, vpToWin: 13 }
  addPublicVp(thirteen, 12)
  give(thirteen, 0, res({ brick: 1, lumber: 1 }))
  const thirteenNext = applyAction(thirteen, { type: 'buildRoad', edge: VERTICES[0].edges[0] })
  assert.equal(thirteenNext.phase.kind, 'main')
})

test('createGame validates vpToWin as an integer in range', () => {
  assert.doesNotThrow(() => createGame({ seed: 1, playerCount: 3, settings: { vpToWin: 8 } }))
  assert.doesNotThrow(() => createGame({ seed: 1, playerCount: 3, settings: { vpToWin: 13 } }))
  assert.throws(() => createGame({ seed: 1, playerCount: 3, settings: { vpToWin: 7 } }), /vpToWin/)
  assert.throws(() => createGame({ seed: 1, playerCount: 3, settings: { vpToWin: 14 } }), /vpToWin/)
  assert.throws(() => createGame({ seed: 1, playerCount: 3, settings: { vpToWin: 10.5 } }), /vpToWin/)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HEXES, VERTICES } from './geometry'
import { longestRoadFor, updateLongestRoad } from './longest-road'
import { makeTestState, putRoadPath, putSettlement } from './test-fixtures'
import type { GameState, PlayerId } from './types'

// Audit F1 was disputed: cutting a closed ring at one vertex leaves one continuous 6-segment
// road that starts and ends at the cut, which never passes THROUGH the opposing building.

const RING_HEX = 9

function putHexLoop(state: GameState, player: PlayerId, hex: number): void {
  const vertices = HEXES[hex].vertices
  for (let i = 0; i < vertices.length; i++) {
    putRoadPath(state, player, [vertices[i], vertices[(i + 1) % vertices.length]])
  }
}

function outwardTail(from: number, edges: number): number[] {
  const ring = new Set(HEXES[RING_HEX].vertices)
  const path = [from]
  for (let i = 0; i < edges; i++) {
    const next = VERTICES[path[path.length - 1]].neighbors.find((n) => !ring.has(n) && !path.includes(n))
    assert.ok(next !== undefined)
    path.push(next)
  }
  return path
}

test('a ring cut once by an opposing settlement is still a 6-segment road', () => {
  const state = makeTestState()
  putHexLoop(state, 0, RING_HEX)
  putSettlement(state, 1, HEXES[RING_HEX].vertices[0])
  assert.equal(longestRoadFor(state, 0), 6)
})

test('a ring cut at two opposite corners splits into two 3-segment roads', () => {
  const state = makeTestState()
  putHexLoop(state, 0, RING_HEX)
  putSettlement(state, 1, HEXES[RING_HEX].vertices[0])
  putSettlement(state, 2, HEXES[RING_HEX].vertices[3])
  assert.equal(longestRoadFor(state, 0), 3)
})

test('a tail cannot join a ring through the opposing settlement at the cut', () => {
  const state = makeTestState()
  const cut = HEXES[RING_HEX].vertices[0]
  putHexLoop(state, 0, RING_HEX)
  putRoadPath(state, 0, outwardTail(cut, 2))
  assert.equal(longestRoadFor(state, 0), 8)
  putSettlement(state, 1, cut)
  assert.equal(longestRoadFor(state, 0), 6)
})

test('the cut ring still holds Longest Road', () => {
  const state = makeTestState()
  putHexLoop(state, 0, RING_HEX)
  putSettlement(state, 1, HEXES[RING_HEX].vertices[0])
  updateLongestRoad(state)
  assert.equal(state.players[0].longestRoad, 6)
  assert.equal(state.longestRoadHolder, 0)
})

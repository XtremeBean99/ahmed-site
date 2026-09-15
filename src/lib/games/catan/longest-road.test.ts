import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HEXES, VERTICES } from './geometry'
import { longestRoadFor, updateLongestRoad } from './longest-road'
import { makeTestState, putRoadPath, putSettlement } from './test-fixtures'
import type { GameState, PlayerId } from './types'

function simplePath(start: number, edgeCount: number, forbidden: number[] = []): number[] {
  const blocked = new Set(forbidden)
  const path: number[] = [start]
  const inPath = new Set<number>([start])
  const found = (function walk(v: number): boolean {
    if (path.length === edgeCount + 1) return true
    for (const n of VERTICES[v].neighbors) {
      if (inPath.has(n) || blocked.has(n)) continue
      path.push(n)
      inPath.add(n)
      if (walk(n)) return true
      inPath.delete(n)
      path.pop()
    }
    return false
  })(start)
  assert.ok(found, `no ${edgeCount}-edge path from ${start} avoiding [${forbidden.join(',')}]`)
  return path
}

function putHexLoop(state: GameState, player: PlayerId, hex: number): void {
  const vertices = HEXES[hex].vertices
  for (let i = 0; i < vertices.length; i++) {
    putRoadPath(state, player, [vertices[i], vertices[(i + 1) % vertices.length]])
  }
}

function buildArms(state: GameState, player: PlayerId, center: number, lengths: number[]): void {
  assert.equal(VERTICES[center].neighbors.length, lengths.length)
  const blocked = new Set<number>([center])
  VERTICES[center].neighbors.forEach((root, i) => {
    blocked.add(root)
    const path = [center, root]
    let prev = center
    let current = root
    while (path.length < lengths[i] + 1) {
      const next = VERTICES[current].neighbors.find((n) => n !== prev && !blocked.has(n))
      assert.ok(next !== undefined, `no arm of length ${lengths[i]} from ${center} via ${root}`)
      path.push(next)
      blocked.add(next)
      prev = current
      current = next
    }
    putRoadPath(state, player, path)
  })
}

const longestRoadEvents = (state: GameState) =>
  state.events.filter((e) => e.type === 'longestRoad').map((e) => e.player)

test('longestRoadFor counts a straight road and 0 when there are no roads', () => {
  const state = makeTestState()
  assert.equal(longestRoadFor(state, 0), 0)
  putRoadPath(state, 0, simplePath(0, 4))
  assert.equal(longestRoadFor(state, 0), 4)
})

test('branching Y and T shapes count only the longest trail', () => {
  const center = VERTICES.find((v) => v.neighbors.length === 3)!

  const yState = makeTestState()
  buildArms(yState, 0, center.id, [2, 2, 2])
  assert.equal(longestRoadFor(yState, 0), 4)

  const tState = makeTestState()
  buildArms(tState, 0, center.id, [1, 2, 3])
  assert.equal(longestRoadFor(tState, 0), 5)
})

test('a closed 6-edge loop around one hex counts as 6', () => {
  const state = makeTestState()
  putHexLoop(state, 0, 9)
  assert.equal(longestRoadFor(state, 0), 6)
})

test('a loop with a 2-edge tail counts the whole 8-edge trail', () => {
  const state = makeTestState()
  putHexLoop(state, 0, 9)
  const loopVertices = new Set(HEXES[9].vertices)
  const start = HEXES[9].vertices.find((v) => VERTICES[v].neighbors.some((n) => !loopVertices.has(n)))!
  const mid = VERTICES[start].neighbors.find((n) => !loopVertices.has(n))!
  const tip = VERTICES[mid].neighbors.find((n) => n !== start)!
  putRoadPath(state, 0, [start, mid, tip])
  assert.equal(longestRoadFor(state, 0), 8)
})

test('two loops sharing an edge count all 11 edges as one trail', () => {
  const state = makeTestState()
  putHexLoop(state, 0, 9)
  putHexLoop(state, 0, 13)
  assert.equal(state.roads.filter((r) => r === 0).length, 11)
  assert.equal(longestRoadFor(state, 0), 11)
})

test('two disconnected networks count only the max', () => {
  const state = makeTestState()
  const left = simplePath(0, 5)
  const right = simplePath(6, 3, left)
  assert.equal(new Set([...left, ...right]).size, left.length + right.length)
  putRoadPath(state, 0, left)
  putRoadPath(state, 0, right)
  assert.equal(longestRoadFor(state, 0), 5)
})

test('an opposing settlement in the middle splits a 7-edge road into 4 and 3', () => {
  const state = makeTestState()
  const path = simplePath(0, 7)
  putRoadPath(state, 0, path)
  putSettlement(state, 1, path[4])
  assert.equal(longestRoadFor(state, 0), 4)
})

test('an own settlement in the middle does not split a road', () => {
  const state = makeTestState()
  const path = simplePath(0, 7)
  putRoadPath(state, 0, path)
  putSettlement(state, 0, path[4])
  assert.equal(longestRoadFor(state, 0), 7)
})

test('award happens at exactly 5 roads and not at 4', () => {
  const five = makeTestState()
  putRoadPath(five, 0, simplePath(0, 5))
  updateLongestRoad(five)
  assert.equal(five.longestRoadHolder, 0)
  assert.equal(five.players[0].longestRoad, 5)
  assert.deepEqual(longestRoadEvents(five), [0])

  const four = makeTestState()
  putRoadPath(four, 0, simplePath(0, 4))
  updateLongestRoad(four)
  assert.equal(four.longestRoadHolder, null)
  assert.equal(four.players[0].longestRoad, 4)
  assert.deepEqual(longestRoadEvents(four), [])
})

test('a tie with the holder keeps the card', () => {
  const state = makeTestState()
  const p0 = simplePath(0, 6)
  putRoadPath(state, 0, p0)
  updateLongestRoad(state)
  assert.equal(state.longestRoadHolder, 0)

  putRoadPath(state, 1, simplePath(6, 6, p0))
  updateLongestRoad(state)
  assert.equal(state.longestRoadHolder, 0)
  assert.equal(state.players[0].longestRoad, 6)
  assert.equal(state.players[1].longestRoad, 6)
  assert.deepEqual(longestRoadEvents(state), [0])
})

test('a strictly longer road transfers the card', () => {
  const state = makeTestState()
  const p0 = simplePath(0, 6)
  putRoadPath(state, 0, p0)
  updateLongestRoad(state)
  assert.equal(state.longestRoadHolder, 0)

  putRoadPath(state, 1, simplePath(6, 7, p0))
  updateLongestRoad(state)
  assert.equal(state.longestRoadHolder, 1)
  assert.equal(state.players[0].longestRoad, 6)
  assert.equal(state.players[1].longestRoad, 7)
  assert.deepEqual(longestRoadEvents(state), [0, 1])
})

test('a holder broken below another unique leader transfers the card', () => {
  const state = makeTestState()
  const p0 = simplePath(0, 7)
  putRoadPath(state, 0, p0)
  updateLongestRoad(state)
  assert.equal(state.longestRoadHolder, 0)

  putSettlement(state, 2, p0[4])
  putRoadPath(state, 1, simplePath(6, 5, p0))
  updateLongestRoad(state)
  assert.equal(state.players[0].longestRoad, 4)
  assert.equal(state.players[1].longestRoad, 5)
  assert.equal(state.longestRoadHolder, 1)
  assert.deepEqual(longestRoadEvents(state), [0, 1])
})

test('a holder broken while two others tie leaves nobody', () => {
  const state = makeTestState()
  const p0 = simplePath(0, 7)
  putRoadPath(state, 0, p0)
  updateLongestRoad(state)
  assert.equal(state.longestRoadHolder, 0)

  putSettlement(state, 3, p0[4])
  const p1 = simplePath(6, 5, p0)
  putRoadPath(state, 1, p1)
  putRoadPath(state, 2, simplePath(20, 5, [...p0, ...p1]))
  updateLongestRoad(state)
  assert.equal(state.players[0].longestRoad, 4)
  assert.equal(state.players[1].longestRoad, 5)
  assert.equal(state.players[2].longestRoad, 5)
  assert.equal(state.longestRoadHolder, null)
  assert.deepEqual(longestRoadEvents(state), [0, null])
})

test('a holder broken but still tied for longest keeps the card', () => {
  const state = makeTestState()
  const p0 = simplePath(0, 7)
  putRoadPath(state, 0, p0)
  updateLongestRoad(state)
  assert.equal(state.longestRoadHolder, 0)

  putSettlement(state, 2, p0[5])
  putRoadPath(state, 1, simplePath(6, 5, p0))
  updateLongestRoad(state)
  assert.equal(state.players[0].longestRoad, 5)
  assert.equal(state.players[1].longestRoad, 5)
  assert.equal(state.longestRoadHolder, 0)
  assert.deepEqual(longestRoadEvents(state), [0])
})

test('a holder broken below 5 with nobody at 5+ leaves nobody', () => {
  const state = makeTestState()
  const p0 = simplePath(0, 7)
  putRoadPath(state, 0, p0)
  updateLongestRoad(state)
  assert.equal(state.longestRoadHolder, 0)

  putSettlement(state, 2, p0[4])
  putRoadPath(state, 1, simplePath(6, 4, p0))
  updateLongestRoad(state)
  assert.equal(state.players[0].longestRoad, 4)
  assert.equal(state.players[1].longestRoad, 4)
  assert.equal(state.longestRoadHolder, null)
  assert.deepEqual(longestRoadEvents(state), [0, null])
})

test('updateLongestRoad is idempotent and only emits events on change', () => {
  const state = makeTestState()
  const path = simplePath(0, 5)
  putRoadPath(state, 0, path)
  updateLongestRoad(state)
  updateLongestRoad(state)
  assert.equal(state.longestRoadHolder, 0)
  assert.deepEqual(longestRoadEvents(state), [0])

  putSettlement(state, 1, path[2])
  updateLongestRoad(state)
  assert.equal(state.longestRoadHolder, null)
  assert.deepEqual(longestRoadEvents(state), [0, null])

  updateLongestRoad(state)
  assert.equal(state.longestRoadHolder, null)
  assert.deepEqual(longestRoadEvents(state), [0, null])
})

test('updateLongestRoad caches longestRoad for every player', () => {
  const state = makeTestState({ playerCount: 4 })
  const p0 = simplePath(0, 5)
  const p1 = simplePath(6, 3, p0)
  const p2 = simplePath(20, 4, [...p0, ...p1])
  putRoadPath(state, 0, p0)
  putRoadPath(state, 1, p1)
  putRoadPath(state, 2, p2)
  for (const player of state.players) player.longestRoad = 99

  updateLongestRoad(state)
  assert.equal(state.players[0].longestRoad, 5)
  assert.equal(state.players[1].longestRoad, 3)
  assert.equal(state.players[2].longestRoad, 4)
  assert.equal(state.players[3].longestRoad, 0)
})

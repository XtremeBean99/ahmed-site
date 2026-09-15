import assert from 'node:assert/strict'
import test from 'node:test'
import { EDGES } from '../../lib/games/catan/geometry'
import { makeTestState, putRoad, putSettlement } from '../../lib/games/catan/test-fixtures'
import { hoverTargetAt } from './board-hover'
import { edgePoint, hexCenter, vertexPoint } from './board-layout'
import { harborPlateRect } from './pixel-art'

test('occupied vertex within 5 px beats robber and hex', () => {
  const state = makeTestState()
  putSettlement(state, 0, 12)
  const p = vertexPoint(12)
  assert.deepEqual(hoverTargetAt(state, p.x, p.y), { kind: 'building', vertex: 12 })
})

test('robber sprite rect reports the robber hex', () => {
  const state = makeTestState()
  state.robber = 4
  const c = hexCenter(4)
  assert.deepEqual(hoverTargetAt(state, c.x, c.y), { kind: 'robber', hex: 4 })
})

test('occupied edge within 3 px reports the road', () => {
  const state = makeTestState()
  const edge = EDGES.find((e) => e.vertices.every((v) => state.buildings[v] === null))!.id
  putRoad(state, 0, edge)
  const p = edgePoint(edge)
  assert.deepEqual(hoverTargetAt(state, p.x, p.y), { kind: 'road', edge })
})

test('harbour plate rect reports the port index', () => {
  const state = makeTestState()
  const port = state.ports[0]
  const plate = harborPlateRect(port.edge, port.type)
  const x = Math.floor(plate.x + plate.width / 2)
  const y = Math.floor(plate.y + plate.height / 2)
  assert.deepEqual(hoverTargetAt(state, x, y), { kind: 'harbor', port: 0 })
})

test('land pixel with no piece reports its hex', () => {
  const state = makeTestState()
  const c = hexCenter(3)
  assert.deepEqual(hoverTargetAt(state, c.x, c.y), { kind: 'hex', hex: 3 })
})

test('open sea reports null', () => {
  const state = makeTestState()
  assert.equal(hoverTargetAt(state, 139, 1), null)
})

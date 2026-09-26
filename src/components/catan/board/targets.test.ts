import assert from 'node:assert/strict'
import test from 'node:test'
import { edgePoint, hexCenter, vertexPoint } from '../board-layout'
import { nearestTargetAt } from './targets'
import type { TargetShapes } from './targets'

const VERTEX_TARGETS: TargetShapes = { kind: 'settlement', vertices: [12, 30], edges: [], hexes: [] }
const EDGE_TARGETS: TargetShapes = { kind: 'road', vertices: [], edges: [23, 41], hexes: [] }
const ROBBER_TARGETS: TargetShapes = { kind: 'robber', vertices: [], edges: [], hexes: [3, 4, 5] }

test('a point near a legal vertex selects that vertex', () => {
  const p = vertexPoint(12)
  assert.deepEqual(nearestTargetAt({ x: p.x + 8, y: p.y }, VERTEX_TARGETS), { kind: 'vertex', id: 12 })
})

test('a point near a legal edge selects that edge', () => {
  const p = edgePoint(23)
  assert.deepEqual(nearestTargetAt({ x: p.x, y: p.y + 5 }, EDGE_TARGETS), { kind: 'edge', id: 23 })
})

test('a point beyond the 14 px radius selects nothing', () => {
  const p = vertexPoint(30)
  assert.equal(nearestTargetAt({ x: p.x + 15, y: p.y }, VERTEX_TARGETS), null)
})

test('the nearer of a vertex and an edge wins', () => {
  const targets: TargetShapes = { kind: 'road', vertices: [12], edges: [23], hexes: [] }
  const vp = vertexPoint(12)
  const ep = edgePoint(23)
  const nearVertex = nearestTargetAt({ x: vp.x + 2, y: vp.y }, targets)
  assert.deepEqual(nearVertex, { kind: 'vertex', id: 12 })
  const nearEdge = nearestTargetAt({ x: ep.x + 2, y: ep.y }, targets)
  assert.deepEqual(nearEdge, { kind: 'edge', id: 23 })
})

test('robber moves select the hex under the finger', () => {
  const p = hexCenter(4)
  assert.deepEqual(nearestTargetAt(p, ROBBER_TARGETS), { kind: 'hex', id: 4 })
})

test('robber moves outside a legal hex select nothing', () => {
  assert.equal(nearestTargetAt(hexCenter(0), ROBBER_TARGETS), null)
})

test('no target kind selects nothing', () => {
  assert.equal(nearestTargetAt(vertexPoint(12), { kind: null, vertices: [12], edges: [], hexes: [] }), null)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COASTAL_EDGES, EDGES, HEXES, PORT_EDGES, VERTICES, edgeBetween } from './geometry'

test('standard board has 19 hexes in 3-4-5-4-3 rows, 54 vertices, 72 edges', () => {
  assert.equal(HEXES.length, 19)
  assert.equal(VERTICES.length, 54)
  assert.equal(EDGES.length, 72)
  const rows = [-2, -1, 0, 1, 2].map((r) => HEXES.filter((h) => h.r === r).length)
  assert.deepEqual(rows, [3, 4, 5, 4, 3])
})

test('adjacency is consistent', () => {
  for (const h of HEXES) {
    assert.equal(new Set(h.vertices).size, 6)
    h.edges.forEach((e, i) => {
      assert.deepEqual([...EDGES[e].vertices].sort((a, b) => a - b), [h.vertices[i], h.vertices[(i + 1) % 6]].sort((a, b) => a - b))
    })
    for (const n of h.neighbors) assert.ok(HEXES[n].neighbors.includes(h.id))
  }
  for (const v of VERTICES) {
    assert.ok(v.edges.length === 2 || v.edges.length === 3)
    assert.equal(v.neighbors.length, v.edges.length)
    for (const n of v.neighbors) assert.equal(EDGES[edgeBetween(v.id, n)!].vertices.includes(v.id), true)
  }
  assert.equal(VERTICES.filter((v) => v.hexes.length === 3).length, 24)
  assert.equal(HEXES.reduce((sum, h) => sum + h.neighbors.length, 0), 2 * 42)
})

test('30 coastal edges, 9 harbours with no shared vertices', () => {
  assert.equal(COASTAL_EDGES.length, 30)
  assert.equal(PORT_EDGES.length, 9)
  assert.equal(new Set(PORT_EDGES.flatMap((e) => EDGES[e].vertices)).size, 18)
  for (const e of PORT_EDGES) assert.equal(EDGES[e].hexes.length, 1)
})

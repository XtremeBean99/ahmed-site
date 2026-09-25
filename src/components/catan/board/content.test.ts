import assert from 'node:assert/strict'
import test from 'node:test'
import { PORT_EDGES, VERTICES } from '@/lib/games/catan/geometry'
import { vertexPoint } from '../board-layout'
import { harborPlateRect, pierSpriteRect } from '../pixel-art'
import { CONTENT_BOX } from './content'

test('content box contains every vertex point with the 3 px margin', () => {
  for (const vertex of VERTICES) {
    const p = vertexPoint(vertex.id)
    assert.ok(p.x >= CONTENT_BOX.x && p.x <= CONTENT_BOX.x + CONTENT_BOX.width - 1, `vertex ${vertex.id} x outside content box`)
    assert.ok(p.y >= CONTENT_BOX.y && p.y <= CONTENT_BOX.y + CONTENT_BOX.height - 1, `vertex ${vertex.id} y outside content box`)
  }
})

test('content box contains every harbour plate rect with the 3 px margin', () => {
  for (const edge of PORT_EDGES) {
    for (const type of ['any', 'brick'] as const) {
      const plate = harborPlateRect(edge, type)
      assert.ok(plate.x >= CONTENT_BOX.x, `plate ${edge}/${type} left outside content box`)
      assert.ok(plate.y >= CONTENT_BOX.y, `plate ${edge}/${type} top outside content box`)
      assert.ok(plate.x + plate.width - 1 <= CONTENT_BOX.x + CONTENT_BOX.width - 1, `plate ${edge}/${type} right outside content box`)
      assert.ok(plate.y + plate.height - 1 <= CONTENT_BOX.y + CONTENT_BOX.height - 1, `plate ${edge}/${type} bottom outside content box`)
    }
  }
})

test('content box contains every pier sprite rect with the 3 px margin', () => {
  for (const edge of PORT_EDGES) {
    const pier = pierSpriteRect(edge)
    assert.ok(pier.x >= CONTENT_BOX.x, `pier ${edge} left outside content box`)
    assert.ok(pier.y >= CONTENT_BOX.y, `pier ${edge} top outside content box`)
    assert.ok(pier.x + pier.width - 1 <= CONTENT_BOX.x + CONTENT_BOX.width - 1, `pier ${edge} right outside content box`)
    assert.ok(pier.y + pier.height - 1 <= CONTENT_BOX.y + CONTENT_BOX.height - 1, `pier ${edge} bottom outside content box`)
  }
})

test('content box margins are exactly 3 px on every side', () => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const vertex of VERTICES) {
    const p = vertexPoint(vertex.id)
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  for (const edge of PORT_EDGES) {
    for (const type of ['any', 'brick'] as const) {
      const plate = harborPlateRect(edge, type)
      minX = Math.min(minX, plate.x)
      minY = Math.min(minY, plate.y)
      maxX = Math.max(maxX, plate.x + plate.width - 1)
      maxY = Math.max(maxY, plate.y + plate.height - 1)
    }
    const pier = pierSpriteRect(edge)
    minX = Math.min(minX, pier.x)
    minY = Math.min(minY, pier.y)
    maxX = Math.max(maxX, pier.x + pier.width - 1)
    maxY = Math.max(maxY, pier.y + pier.height - 1)
  }
  assert.equal(CONTENT_BOX.x, minX - 3)
  assert.equal(CONTENT_BOX.y, minY - 3)
  assert.equal(CONTENT_BOX.x + CONTENT_BOX.width - 1, maxX + 3)
  assert.equal(CONTENT_BOX.y + CONTENT_BOX.height - 1, maxY + 3)
})

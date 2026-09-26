import assert from 'node:assert/strict'
import test from 'node:test'
import { EDGES, HEXES, PORT_EDGES, VERTICES } from '../../lib/games/catan/geometry'
import { makeTestState, putCity, putRoad, putSettlement } from '../../lib/games/catan/test-fixtures'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CORNER_OFFSETS,
  edgeEndpoints,
  edgePoint,
  hexAtPixel,
  hexCenter,
  vertexPoint,
} from './board-layout'
import { TILE_MASK_OFFSETS, createBuffer, drawBoard, harborPlateRect } from './pixel-art'
import { SPRITES, TILE_ANCHOR_X, TILE_ANCHOR_Y, TILE_MASK_HEIGHT, TILE_MASK_WIDTH } from './sprites'
import type { PixelBuffer } from './pixel-art'

function changedPixels(a: PixelBuffer, b: PixelBuffer): { x: number; y: number }[] {
  const diff: { x: number; y: number }[] = []
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4
      let same = true
      for (let k = 0; k < 4; k++) {
        if (a.data[i + k] !== b.data[i + k]) {
          same = false
          break
        }
      }
      if (!same) diff.push({ x, y })
    }
  }
  return diff
}

function farFromAnchors(a: PixelBuffer, b: PixelBuffer, anchors: { x: number; y: number }[], radius: number): { x: number; y: number }[] {
  return changedPixels(a, b).filter((p) => !anchors.some((anchor) => Math.hypot(p.x - anchor.x, p.y - anchor.y) <= radius))
}

function changedNear(a: PixelBuffer, b: PixelBuffer, anchor: { x: number; y: number }, radius: number): number {
  return changedPixels(a, b).filter((p) => Math.hypot(p.x - anchor.x, p.y - anchor.y) <= radius).length
}

test('every hex centre, vertex and edge maps to integer coordinates inside the canvas', () => {
  for (const hex of HEXES) {
    const p = hexCenter(hex.id)
    assert.ok(Number.isInteger(p.x), `hex ${hex.id} x not integer`)
    assert.ok(Number.isInteger(p.y), `hex ${hex.id} y not integer`)
    assert.ok(p.x >= 0 && p.x < BOARD_WIDTH, `hex ${hex.id} x out of bounds`)
    assert.ok(p.y >= 0 && p.y < BOARD_HEIGHT, `hex ${hex.id} y out of bounds`)
  }
  for (const vertex of VERTICES) {
    const p = vertexPoint(vertex.id)
    assert.ok(Number.isInteger(p.x), `vertex ${vertex.id} x not integer`)
    assert.ok(Number.isInteger(p.y), `vertex ${vertex.id} y not integer`)
    assert.ok(p.x >= 0 && p.x < BOARD_WIDTH, `vertex ${vertex.id} x out of bounds`)
    assert.ok(p.y >= 0 && p.y < BOARD_HEIGHT, `vertex ${vertex.id} y out of bounds`)
  }
  for (const edge of EDGES) {
    const p = edgePoint(edge.id)
    assert.ok(Number.isInteger(p.x), `edge ${edge.id} x not integer`)
    assert.ok(Number.isInteger(p.y), `edge ${edge.id} y not integer`)
    assert.ok(p.x >= 0 && p.x < BOARD_WIDTH, `edge ${edge.id} x out of bounds`)
    assert.ok(p.y >= 0 && p.y < BOARD_HEIGHT, `edge ${edge.id} y out of bounds`)
    for (const end of edgeEndpoints(edge.id)) {
      assert.ok(Number.isInteger(end.x), `edge ${edge.id} endpoint x not integer`)
      assert.ok(Number.isInteger(end.y), `edge ${edge.id} endpoint y not integer`)
      assert.ok(end.x >= 0 && end.x < BOARD_WIDTH, `edge ${edge.id} endpoint x out of bounds`)
      assert.ok(end.y >= 0 && end.y < BOARD_HEIGHT, `edge ${edge.id} endpoint y out of bounds`)
    }
  }
})

test('hex centres map back to their own hex via hexAtPixel', () => {
  for (const hex of HEXES) {
    const p = hexCenter(hex.id)
    assert.equal(hexAtPixel(p.x, p.y), hex.id)
  }
})

test('all hexes sharing a vertex agree on its pixel position', () => {
  for (const vertex of VERTICES) {
    const expected = vertexPoint(vertex.id)
    for (const hexId of vertex.hexes) {
      const hex = HEXES[hexId]
      const corner = hex.vertices.indexOf(vertex.id)
      const center = hexCenter(hexId)
      const fromHex = { x: center.x + CORNER_OFFSETS[corner].x, y: center.y + CORNER_OFFSETS[corner].y }
      assert.deepEqual(fromHex, expected, `vertex ${vertex.id} disagrees via hex ${hexId}`)
    }
  }
})

test('every island hex has the identical pixel mask', () => {
  const masks: string[][] = []
  for (const hex of HEXES) {
    const center = hexCenter(hex.id)
    const relative: string[] = []
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        if (hexAtPixel(x, y) === hex.id) relative.push(`${x - center.x},${y - center.y}`)
      }
    }
    relative.sort()
    masks.push(relative)
  }
  const first = masks[0]
  for (let i = 1; i < masks.length; i++) {
    assert.deepEqual(masks[i], first, `hex ${i} has a different pixel mask`)
  }
  assert.equal(first.length, TILE_MASK_OFFSETS.length)
  assert.ok(first.length > 0, 'the tile mask must contain pixels')

  const xs = TILE_MASK_OFFSETS.map((off) => off.x)
  const ys = TILE_MASK_OFFSETS.map((off) => off.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const width = Math.max(...xs) - minX + 1
  const height = Math.max(...ys) - minY + 1
  assert.equal(width, TILE_MASK_WIDTH)
  assert.equal(height, TILE_MASK_HEIGHT)
  assert.equal(-minX, TILE_ANCHOR_X)
  assert.equal(-minY, TILE_ANCHOR_Y)
})

test('every pixel is sea or exactly one hex and every hex has the same area', () => {
  const areas = new Map<number, number>()
  let sea = 0
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const hex = hexAtPixel(x, y)
      if (hex === null) {
        sea += 1
        continue
      }
      assert.ok(Number.isInteger(hex) && hex >= 0 && hex < HEXES.length, `pixel ${x},${y} maps to ${hex}`)
      areas.set(hex, (areas.get(hex) ?? 0) + 1)
    }
  }
  assert.equal(areas.size, HEXES.length)
  const sizes = [...areas.values()]
  assert.ok(sizes.every((size) => size === sizes[0]), `hex pixel areas differ: ${sizes.join(', ')}`)
  assert.equal(sizes[0], TILE_MASK_OFFSETS.length)
  assert.ok(sea > 0, 'the canvas should include sea pixels')
})

test('sea pixels return null', () => {
  assert.equal(hexAtPixel(0, 0), null)
  assert.equal(hexAtPixel(BOARD_WIDTH - 1, 0), null)
  assert.equal(hexAtPixel(0, BOARD_HEIGHT - 1), null)
  assert.equal(hexAtPixel(BOARD_WIDTH - 1, BOARD_HEIGHT - 1), null)
})

test('rasterising a fixture state is deterministic, with opaque land and transparent open sea', () => {
  const state = makeTestState()
  const a = createBuffer(BOARD_WIDTH, BOARD_HEIGHT)
  const b = createBuffer(BOARD_WIDTH, BOARD_HEIGHT)
  drawBoard(a, state)
  drawBoard(b, state)
  for (let i = 0; i < a.data.length; i++) {
    assert.equal(a.data[i], b.data[i], `pixel data differs at byte ${i}`)
  }
  let opaqueSea = 0
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const i = (y * BOARD_WIDTH + x) * 4
      if (hexAtPixel(x, y) !== null) {
        assert.equal(a.data[i + 3], 255, `land pixel ${x},${y} is transparent`)
      } else if (a.data[i + 3] !== 0) {
        opaqueSea += 1
      }
    }
  }
  for (const corner of [
    [0, 0],
    [BOARD_WIDTH - 1, 0],
    [0, BOARD_HEIGHT - 1],
    [BOARD_WIDTH - 1, BOARD_HEIGHT - 1],
  ] as const) {
    const i = (corner[1] * BOARD_WIDTH + corner[0]) * 4
    assert.equal(a.data[i + 3], 0, `open sea corner ${corner[0]},${corner[1]} should be transparent`)
  }
  assert.ok(opaqueSea > 0, 'the procedural shoreline should draw opaque pixels in the sea')
})

test('settlement, city, road and robber only change pixels near their positions', () => {
  const base = makeTestState()
  const modified = structuredClone(base)
  putSettlement(modified, 0, 12)
  putCity(modified, 0, 30)
  putRoad(modified, 0, 23)
  modified.robber = 0

  const a = createBuffer(BOARD_WIDTH, BOARD_HEIGHT)
  const b = createBuffer(BOARD_WIDTH, BOARD_HEIGHT)
  drawBoard(a, base)
  drawBoard(b, modified)

  const anchors = [vertexPoint(12), vertexPoint(30), edgePoint(23), hexCenter(0), hexCenter(9)]
  const far = farFromAnchors(a, b, anchors, 30)
  assert.deepEqual(far, [], `changed pixels far from any piece: ${JSON.stringify(far.slice(0, 5))}`)

  assert.ok(changedNear(a, b, vertexPoint(12), 12) > 0, 'settlement changed no pixels')
  assert.ok(changedNear(a, b, vertexPoint(30), 12) > 0, 'city changed no pixels')
  assert.ok(changedNear(a, b, edgePoint(23), 26) > 0, 'road changed no pixels')
  assert.ok(changedNear(a, b, hexCenter(0), 12) > 0, 'new robber changed no pixels')
  assert.ok(changedNear(a, b, hexCenter(9), 12) > 0, 'old robber was not removed')
  assert.ok(changedPixels(a, b).length > 0, 'nothing changed')
})

test('harbour label plates stay inside the canvas and entirely at sea', () => {
  for (const edge of PORT_EDGES) {
    for (const type of ['any', 'brick'] as const) {
      const plate = harborPlateRect(edge, type)
      assert.ok(plate.x >= 1 && plate.y >= 1, `label for port ${edge} out of bounds: ${JSON.stringify(plate)}`)
      assert.ok(
        plate.x + plate.width <= BOARD_WIDTH - 1 && plate.y + plate.height <= BOARD_HEIGHT - 1,
        `label for port ${edge} out of bounds: ${JSON.stringify(plate)}`,
      )
      for (let y = plate.y; y < plate.y + plate.height; y++) {
        for (let x = plate.x; x < plate.x + plate.width; x++) {
          assert.equal(hexAtPixel(x, y), null, `label for port ${edge} covers land at ${x},${y}`)
        }
      }
    }
  }
})

test('harbour label plates never sit under a city on their own corners', () => {
  const city = SPRITES.city
  for (const edge of PORT_EDGES) {
    for (const type of ['any', 'ore'] as const) {
      const plate = harborPlateRect(edge, type)
      for (const v of EDGES[edge].vertices) {
        const c = vertexPoint(v)
        const x0 = c.x - city.anchorX
        const y0 = c.y - city.anchorY
        const overlapX = Math.min(x0 + city.width, plate.x + plate.width) - Math.max(x0, plate.x)
        const overlapY = Math.min(y0 + city.height, plate.y + plate.height) - Math.max(y0, plate.y)
        assert.ok(overlapX <= 0 || overlapY <= 0, `plate for port ${edge} overlaps a city on vertex ${v}`)
      }
    }
  }
})


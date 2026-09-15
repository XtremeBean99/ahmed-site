import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import zlib from 'node:zlib'
import { EDGES } from '../../lib/games/catan/geometry'
import { makeTestState, putCity, putRoad, putSettlement } from '../../lib/games/catan/test-fixtures'
import { BOARD_HEIGHT, BOARD_WIDTH, edgeEndpoints } from './board-layout'
import { createBuffer, drawBoard, renderProceduralSprite } from './pixel-art'
import type { SpriteSet } from './pixel-art'
import { decodePNG } from './png'
import { SPRITES, SPRITE_NAMES, TILE_MASK_FILE, TILE_MASK_HEIGHT, TILE_MASK_WIDTH } from './sprites'
import { UI_SPRITES, UI_SPRITE_NAMES } from './ui-sprites'

const PUBLIC_CATAN = path.join(process.cwd(), 'public', 'catan')

function readPublicSprite(file: string) {
  return decodePNG(fs.readFileSync(path.join(PUBLIC_CATAN, file)), { inflate: zlib.inflateSync })
}

function orientationOf(edge: number): 'vertical' | 'rising' | 'falling' {
  const [a, b] = edgeEndpoints(edge)
  let dx = b.x - a.x
  let dy = b.y - a.y
  if (dx < 0) {
    dx = -dx
    dy = -dy
  }
  if (dx === 0) return 'vertical'
  return dy < 0 ? 'rising' : 'falling'
}

test('every manifest sprite exists in public/catan with exact dimensions', () => {
  for (const name of SPRITE_NAMES) {
    const meta = SPRITES[name]
    const file = path.join(PUBLIC_CATAN, meta.file)
    assert.ok(fs.existsSync(file), `${meta.file} is missing`)
    const png = readPublicSprite(meta.file)
    assert.equal(png.width, meta.width, `${meta.file} width`)
    assert.equal(png.height, meta.height, `${meta.file} height`)
  }
  const maskFile = path.join(PUBLIC_CATAN, TILE_MASK_FILE)
  assert.ok(fs.existsSync(maskFile), `${TILE_MASK_FILE} is missing`)
  const mask = readPublicSprite(TILE_MASK_FILE)
  assert.equal(mask.width, TILE_MASK_WIDTH, `${TILE_MASK_FILE} width`)
  assert.equal(mask.height, TILE_MASK_HEIGHT, `${TILE_MASK_FILE} height`)
})

test('every UI sprite file exists in public/catan with exact dimensions', () => {
  for (const name of UI_SPRITE_NAMES) {
    const meta = UI_SPRITES[name]
    const file = path.join(PUBLIC_CATAN, meta.file)
    assert.ok(fs.existsSync(file), `${meta.file} is missing`)
    const png = readPublicSprite(meta.file)
    assert.equal(png.width, meta.width, `${meta.file} width`)
    assert.equal(png.height, meta.height, `${meta.file} height`)
  }
})

test('renderProceduralSprite produces every manifest size', () => {
  for (const name of SPRITE_NAMES) {
    const meta = SPRITES[name]
    const sprite = renderProceduralSprite(name)
    assert.equal(sprite.width, meta.width, `${name} width`)
    assert.equal(sprite.height, meta.height, `${name} height`)
  }
})

test('composing from decoded PNGs equals composing from procedural sprites', () => {
  const state = makeTestState()
  const picked = new Set<'vertical' | 'rising' | 'falling'>()
  for (const edge of EDGES) {
    const orientation = orientationOf(edge.id)
    if (!picked.has(orientation)) {
      putRoad(state, 0, edge.id)
      picked.add(orientation)
    }
  }
  putSettlement(state, 0, 12)
  putCity(state, 0, 30)
  state.robber = 4

  const procedural: SpriteSet = {}
  const decoded: SpriteSet = {}
  for (const name of SPRITE_NAMES) {
    procedural[name] = renderProceduralSprite(name)
    decoded[name] = readPublicSprite(SPRITES[name].file)
  }

  const a = createBuffer(BOARD_WIDTH, BOARD_HEIGHT)
  const b = createBuffer(BOARD_WIDTH, BOARD_HEIGHT)
  drawBoard(a, state, procedural)
  drawBoard(b, state, decoded)
  for (let i = 0; i < a.data.length; i++) {
    assert.equal(a.data[i], b.data[i], `pixel byte ${i} differs between PNG and procedural composition`)
  }
})

import assert from 'node:assert/strict'
import test from 'node:test'
import type { GameState } from '@/lib/games/catan/types'
import { makeTestState, putCity, putRoad, putSettlement } from '@/lib/games/catan/test-fixtures'
import { BOARD_HEIGHT, BOARD_WIDTH } from './board-layout'
import { createBuffer, drawPiecesLayer, piecesLayerKey, staticLayerKey } from './pixel-art'
import type { PieceOverrides, SpriteSet } from './pixel-art'

function lateGameState(): GameState {
  const state = makeTestState()
  for (let edge = 0; edge < 60; edge++) putRoad(state, edge % 4, edge)
  for (let vertex = 0; vertex < 40; vertex++) putSettlement(state, vertex % 4, vertex)
  for (let vertex = 40; vertex < 48; vertex++) putCity(state, vertex % 4, vertex)
  state.robber = 3
  return state
}

test('pieces layer for a late-game state renders 50 times with a mean under 4 ms', () => {
  const state = lateGameState()
  // Warm up sprite caches.
  drawPiecesLayer(createBuffer(BOARD_WIDTH, BOARD_HEIGHT), state, {})

  const start = performance.now()
  for (let i = 0; i < 50; i++) {
    drawPiecesLayer(createBuffer(BOARD_WIDTH, BOARD_HEIGHT), state, {})
  }
  const mean = (performance.now() - start) / 50
  assert.ok(mean < 4, `mean pieces layer render was ${mean.toFixed(3)} ms`)
})

test('the static layer key does not change when only a road changes', () => {
  const base = makeTestState()
  const modified = structuredClone(base)
  putRoad(modified, 0, 23)
  const sprites: SpriteSet = { sea: createBuffer(32, 32) }
  assert.equal(staticLayerKey(base, sprites), staticLayerKey(modified, sprites))
  assert.notEqual(piecesLayerKey(base), piecesLayerKey(modified))
})

test('piece overrides only affect the pieces layer key', () => {
  const state = makeTestState()
  const overrides: PieceOverrides = { robberHex: 5, hiddenPieces: { vertices: [12], edges: [23] } }
  assert.equal(staticLayerKey(state, {}), staticLayerKey(state, {}))
  assert.notEqual(piecesLayerKey(state), piecesLayerKey(state, overrides))
})

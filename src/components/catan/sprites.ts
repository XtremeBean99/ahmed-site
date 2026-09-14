import type { Terrain } from '@/lib/games/catan/types'

/**
 * Single source of truth for every board sprite. One image pixel equals one
 * logical board pixel; the anchor is the image pixel placed on the target
 * point (hex centre, vertex, or edge midpoint rounded down). `recolor`
 * sprites are drawn with the player-colour key and tinted at composition time.
 */
export type SpriteName =
  | 'sea'
  | 'tile-brick'
  | 'tile-lumber'
  | 'tile-wool'
  | 'tile-grain'
  | 'tile-ore'
  | 'tile-desert'
  | 'token-2'
  | 'token-3'
  | 'token-4'
  | 'token-5'
  | 'token-6'
  | 'token-8'
  | 'token-9'
  | 'token-10'
  | 'token-11'
  | 'token-12'
  | 'robber'
  | 'settlement'
  | 'city'
  | 'road-vertical'
  | 'road-rising'
  | 'road-falling'
  | 'harbor-any'
  | 'harbor-brick'
  | 'harbor-lumber'
  | 'harbor-wool'
  | 'harbor-grain'
  | 'harbor-ore'
  | 'pier-vertical'
  | 'pier-rising'
  | 'pier-falling'

export interface SpriteMeta {
  file: string
  width: number
  height: number
  anchorX: number
  anchorY: number
  recolor: boolean
}

/** Measured canonical tile mask bounding box (see board-layout.test.ts). */
export const TILE_MASK_WIDTH = 38
export const TILE_MASK_HEIGHT = 43
/** Pixel of the tile sprite placed on the hex centre. */
export const TILE_ANCHOR_X = 19
export const TILE_ANCHOR_Y = 21

/** Opaque tile mask guide, exported alongside the sprites but never rendered. */
export const TILE_MASK_FILE = 'tile-mask.png'

export const TILE_SPRITES: Record<Terrain, SpriteName> = {
  brick: 'tile-brick',
  lumber: 'tile-lumber',
  wool: 'tile-wool',
  grain: 'tile-grain',
  ore: 'tile-ore',
  desert: 'tile-desert',
}

const tile = (terrain: Terrain): SpriteMeta => ({
  file: `tile-${terrain}.png`,
  width: TILE_MASK_WIDTH,
  height: TILE_MASK_HEIGHT,
  anchorX: TILE_ANCHOR_X,
  anchorY: TILE_ANCHOR_Y,
  recolor: false,
})

const token = (n: number): SpriteMeta => ({
  file: `token-${n}.png`,
  width: 11,
  height: 11,
  anchorX: 5,
  anchorY: 5,
  recolor: false,
})

const harbor = (type: 'any' | Terrain): SpriteMeta => ({
  file: `harbor-${type}.png`,
  width: type === 'any' ? 15 : 22,
  height: 11,
  anchorX: 0,
  anchorY: 0,
  recolor: false,
})

const road = (orientation: 'vertical' | 'rising' | 'falling'): SpriteMeta => {
  if (orientation === 'vertical') {
    return { file: 'road-vertical.png', width: 5, height: 21, anchorX: 2, anchorY: 10, recolor: true }
  }
  return { file: `road-${orientation}.png`, width: 18, height: 12, anchorX: 8, anchorY: 5, recolor: true }
}

const pier = (orientation: 'vertical' | 'rising' | 'falling'): SpriteMeta => {
  if (orientation === 'vertical') {
    return { file: 'pier-vertical.png', width: 3, height: 25, anchorX: 1, anchorY: 12, recolor: false }
  }
  return { file: `pier-${orientation}.png`, width: 22, height: 14, anchorX: 10, anchorY: 6, recolor: false }
}

export const SPRITES: Record<SpriteName, SpriteMeta> = {
  sea: { file: 'sea.png', width: 279, height: 265, anchorX: 0, anchorY: 0, recolor: false },
  'tile-brick': tile('brick'),
  'tile-lumber': tile('lumber'),
  'tile-wool': tile('wool'),
  'tile-grain': tile('grain'),
  'tile-ore': tile('ore'),
  'tile-desert': tile('desert'),
  'token-2': token(2),
  'token-3': token(3),
  'token-4': token(4),
  'token-5': token(5),
  'token-6': token(6),
  'token-8': token(8),
  'token-9': token(9),
  'token-10': token(10),
  'token-11': token(11),
  'token-12': token(12),
  robber: { file: 'robber.png', width: 7, height: 10, anchorX: 3, anchorY: 4, recolor: false },
  settlement: { file: 'settlement.png', width: 9, height: 9, anchorX: 4, anchorY: 4, recolor: true },
  city: { file: 'city.png', width: 13, height: 11, anchorX: 6, anchorY: 5, recolor: true },
  'road-vertical': road('vertical'),
  'road-rising': road('rising'),
  'road-falling': road('falling'),
  'harbor-any': harbor('any'),
  'harbor-brick': harbor('brick'),
  'harbor-lumber': harbor('lumber'),
  'harbor-wool': harbor('wool'),
  'harbor-grain': harbor('grain'),
  'harbor-ore': harbor('ore'),
  'pier-vertical': pier('vertical'),
  'pier-rising': pier('rising'),
  'pier-falling': pier('falling'),
}

export const SPRITE_NAMES = Object.keys(SPRITES) as SpriteName[]

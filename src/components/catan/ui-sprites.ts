/**
 * Every non-board sprite (cards, dice, icons). Same rules as the board manifest in sprites.ts:
 * PNG RGBA at 1x, alpha 0 is empty, files live in assets/pixel-art/catan/ and are copied to
 * public/catan/ by `npm run catan-sprites`. The UI draws them at integer scales only.
 */
export type UiSpriteName =
  | 'card-brick'
  | 'card-lumber'
  | 'card-wool'
  | 'card-grain'
  | 'card-ore'
  | 'card-knight'
  | 'card-road-building'
  | 'card-year-of-plenty'
  | 'card-monopoly'
  | 'card-victory-point'
  | 'card-longest-road'
  | 'card-largest-army'
  | 'card-back-resource'
  | 'card-back-development'
  | 'die-1'
  | 'die-2'
  | 'die-3'
  | 'die-4'
  | 'die-5'
  | 'die-6'
  | 'icon-brick'
  | 'icon-lumber'
  | 'icon-wool'
  | 'icon-grain'
  | 'icon-ore'
  | 'icon-vp'
  | 'icon-knight'
  | 'icon-road'
  | 'icon-cards'
  | 'icon-dev'

export interface UiSpriteMeta {
  file: string
  width: number
  height: number
}

export const CARD_WIDTH = 24
export const CARD_HEIGHT = 34
export const DIE_SIZE = 16
export const ICON_SIZE = 8

const card = (name: UiSpriteName): UiSpriteMeta => ({ file: `${name}.png`, width: CARD_WIDTH, height: CARD_HEIGHT })
const die = (name: UiSpriteName): UiSpriteMeta => ({ file: `${name}.png`, width: DIE_SIZE, height: DIE_SIZE })
const icon = (name: UiSpriteName): UiSpriteMeta => ({ file: `${name}.png`, width: ICON_SIZE, height: ICON_SIZE })

export const UI_SPRITES: Record<UiSpriteName, UiSpriteMeta> = {
  'card-brick': card('card-brick'),
  'card-lumber': card('card-lumber'),
  'card-wool': card('card-wool'),
  'card-grain': card('card-grain'),
  'card-ore': card('card-ore'),
  'card-knight': card('card-knight'),
  'card-road-building': card('card-road-building'),
  'card-year-of-plenty': card('card-year-of-plenty'),
  'card-monopoly': card('card-monopoly'),
  'card-victory-point': card('card-victory-point'),
  'card-longest-road': card('card-longest-road'),
  'card-largest-army': card('card-largest-army'),
  'card-back-resource': card('card-back-resource'),
  'card-back-development': card('card-back-development'),
  'die-1': die('die-1'),
  'die-2': die('die-2'),
  'die-3': die('die-3'),
  'die-4': die('die-4'),
  'die-5': die('die-5'),
  'die-6': die('die-6'),
  'icon-brick': icon('icon-brick'),
  'icon-lumber': icon('icon-lumber'),
  'icon-wool': icon('icon-wool'),
  'icon-grain': icon('icon-grain'),
  'icon-ore': icon('icon-ore'),
  'icon-vp': icon('icon-vp'),
  'icon-knight': icon('icon-knight'),
  'icon-road': icon('icon-road'),
  'icon-cards': icon('icon-cards'),
  'icon-dev': icon('icon-dev'),
}

export const UI_SPRITE_NAMES = Object.keys(UI_SPRITES) as UiSpriteName[]

import { SHELF_GAME_SPRITES } from './shelf-games'
import { bonsaiFrames } from './bonsai'

/**
 * Shared animation frame durations (ms). Each value is the interval between
 * sprite frames for the matching room object or component.
 */
export const SPRITE_FRAME_MS = {
  monitor: 80,
  coffee: 90,
  saitama: 50,
  poster: 120,
  bonsai: 165,
  catan: 150,
  books: 120,
  vhs: 120,
  shelfGame: 120,
  bedsideBook: 120,
} as const

/**
 * Must stay in sync with the `lighting-fade` CSS animation duration
 * in src/app/globals.css. The JS timeout releases the outgoing layer
 * after the CSS fade completes.
 */
export const LIGHTING_FADE_MS = 1500

/**
 * Registry of interactive objects on the room stage.
 * Each object has a position (in stage coords 1408×768) and a sprite.
 */

export interface RoomObjectDef {
  id: string
  /** Stage-space bounding rect of the interactive hotspot */
  x: number
  y: number
  w: number
  h: number
  /** Dictionary key for the accessible label */
  labelKey: string
  /** Sprite frames (first = default) */
  frames: string[]
  /** Navigation target or null for a button */
  href: string | null
}

export const ROOM_OBJECTS: RoomObjectDef[] = [
  {
    id: 'monitor',
    // Monitor+keyboard+mousepad. Union bbox +2px pad across the rest frame and
    // the 3 hover-highlight frames (the yellow outline extends past the art).
    x: 235,
    y: 257,
    w: 402,
    h: 350,
    labelKey: 'room.monitorLabel',
    // Frame 1 = rest, frames 2–4 = hover highlight steps (play-once-hold).
    frames: [
      '/room/monitor-1.png',
      '/room/monitor-2.png',
      '/room/monitor-3.png',
      '/room/monitor-4.png',
    ],
    href: '/home',
  },
  {
    id: 'poster',
    x: 997,
    y: 78,
    w: 134,
    h: 247,
    labelKey: 'room.posterLabel',
    // scripts/draw-poster.mjs: rest, 1 px highlight, then a 12-frame hover loop
    // (POSTER_LOOP_FROM): floating hearts, a glint across the print, a sparkle.
    frames: Array.from({ length: 14 }, (_, i) => `/room/poster-${i + 1}.png`),
    href: null,
  },
  {
    id: 'saitama',
    // Saitama (One Punch Man) poster, built from the layers of saitama.ase by
    // scripts/draw-saitama.mjs (box 16 px wider than the art on the left, for the punch):
    // rest, highlight, the punch out of the poster, the impact, then a 12-frame idle loop
    // (SAITAMA_LOOP_FROM) with the background moving.
    x: 745,
    y: 76,
    w: 193,
    h: 243,
    labelKey: 'room.saitamaLabel',
    frames: Array.from({ length: 26 }, (_, i) => `/room/saitama-${i + 1}.png`),
    href: null,
  },
  {
    id: 'bonsai',
    // Windowsill bonsai plant (scripts/draw-bonsai.mjs). It grows with visits, so Room
    // swaps in the visitor's stage (lib/room/bonsai.ts); these are the full tree's frames.
    x: 1241,
    y: 291,
    w: 99,
    h: 131,
    labelKey: 'room.bonsaiLabel',
    frames: bonsaiFrames(4),
    href: null,
  },
  {
    id: 'catan',
    // Stack of Catan boxes on the shelf, extracted from pixel-art/shelf/.
    // 3 frames: rest, then a 2-step lift+glow "pickup" sequence (play-once-hold).
    x: 75,
    y: 151,
    w: 142,
    h: 122,
    labelKey: 'room.catanLabel',
    frames: [
      '/room/catan-1.png',
      '/room/catan-2.png',
      '/room/catan-3.png',
    ],
    href: null,
  },
  {
    id: 'books',
    // Three books on the shelf, extracted from pixel-art/shelf/books1-3.png.
    // Frame 1 = rest, frames 2-3 = the highlight outline. Each spine is its
    // own hotspot (SHELF_BOOKS in src/lib/room/books.ts) and opens the reader.
    x: 164,
    y: 152,
    w: 96,
    h: 97,
    labelKey: 'room.booksLabel',
    frames: [
      '/room/books-1.png',
      '/room/books-2.png',
      '/room/books-3.png',
    ],
    href: null,
  },
  {
    id: 'vhs',
    // VHS tapes on the shelf, extracted from pixel-art/shelf/vhs1-3.png.
    // Click plays the film on the desk monitor.
    x: 239,
    y: 188,
    w: 53,
    h: 53,
    labelKey: 'room.vhsLabel',
    frames: [
      '/room/vhs-1.png',
      '/room/vhs-2.png',
      '/room/vhs-3.png',
    ],
    href: null,
  },
  {
    id: 'lamp',
    // Desk lamp hotspot (baked into background, no separate sprite)
    x: 60,
    y: 300,
    w: 110,
    h: 220,
    labelKey: 'room.lampLabel',
    frames: [],
    href: null,
  },
  {
    id: 'coffee',
    // Coffee mug on desk. Frame 1 = rest (coffecup-bedroom.png), frames 2–6 =
    // hover highlight (coffecup-bedroom1–5.png). All cropped to the union
    // bbox (160, 475, 83×83) so the animation does not jitter.
    x: 160,
    y: 475,
    w: 83,
    h: 83,
    labelKey: 'room.coffeeLabel',
    frames: [
      '/room/coffee-1.png',
      '/room/coffee-2.png',
      '/room/coffee-3.png',
      '/room/coffee-4.png',
      '/room/coffee-5.png',
      '/room/coffee-6.png',
    ],
    href: null,
  },
  {
    id: 'ipod',
    // iPod on the desk (extracted from assets/pixel-art/ipod.png via
    // scripts/extract-ipod.mjs). Single frame. Click skips the music track.
    x: 604,
    y: 450,
    w: 99,
    h: 42,
    labelKey: 'room.ipodLabel',
    frames: ['/room/ipod.png'],
    href: null,
  },
  {
    id: 'clock',
    // Digital alarm clock on the side table. Single frame; the face is blank
    // in the art; SideTableClock renders the LED digits on it. Click toggles
    // 12/24-hour display. Deliberately no hover lift.
    x: 658,
    y: 386,
    w: 71,
    h: 55,
    labelKey: 'room.sideTableClockLabel',
    frames: ['/room/side-table-clock.png'],
    href: null,
  },
]

/**
 * The desk games on the shelf, right of the VHS tapes. Drawn in the shelf's
 * perspective by scripts/draw-shelf-games.mjs (a chess set, mahjong tiles, a
 * card box, cards and chips, floppy disks, a phone and two cartridges, at
 * different depths so they overlap), cropped by scripts/extract-shelf.mjs (rest
 * + the two-step highlight, play-once-hold), which also writes their boxes and
 * pixel hit masks to shelf-games.ts. Clicking one zooms to the desk and opens
 * that app, like the VHS opens the film.
 */
export interface ShelfGameDef {
  /** Desk screen mode to open; also the label key in `room.shelfGameLabels`. */
  app: (typeof SHELF_GAME_SPRITES)[number]['app']
  x: number
  y: number
  w: number
  h: number
  /** Pixel mask for CSS clip-path, local to the box: overlapping neighbours keep their own clicks. */
  hit: string
  frames: string[]
}

/** In render order: an object later in the list stands in front of the ones it overlaps. */
export const SHELF_GAMES: ShelfGameDef[] = SHELF_GAME_SPRITES.map((s) => ({
  ...s,
  frames: [1, 2, 3].map((i) => `/room/shelf-${s.app}-${i}.png`),
}))

/**
 * The book in the side table's lower cubby: the guestbook. Cut out of the
 * closed-drawer art by scripts/extract-side-table.mjs (rest + highlight), so
 * it lifts on hover; hidden while the drawer is open, which covers it.
 */
export const BEDSIDE_BOOK = {
  x: 739,
  y: 533,
  w: 46,
  h: 55,
  frames: [1, 2, 3].map((i) => `/room/bedside-book-${i}.png`),
}

/**
 * Alternate poster art shown while the poster is toggled (click to swap, click
 * again to swap back). Cropped to the SAME union box as poster-1..5 by
 * scripts/extract-posters.mjs, so it drops onto the hotspot pixel-for-pixel.
 */
export const POSTER_ALT_FRAME = '/room/poster-alt.png'
/** The poster's hover loop starts on its third frame (after rest and the first highlight step). */
export const POSTER_LOOP_FROM = 2
/** The Saitama poster loops its idle frames once the punch has landed. */
export const SAITAMA_LOOP_FROM = 14

/**
 * Windows-98-style boot sequence drawn on the monitor glass while the PC is
 * hovered. Decorative overlay (aria-hidden). Rect is in stage coordinates,
 * the loading source canvases are top-left aligned with the stage, and the
 * content bbox is identical in all 18 frames.
 */
export const MONITOR_LOADING_RECT = { x: 270, y: 281, w: 214, h: 171 }

export const MONITOR_LOADING_FRAMES = Array.from(
  { length: 18 },
  (_, i) => `/room/monitor-loading-${i + 1}.png`,
)

/**
 * Side table between the desk and the bed. Clickable, toggles the drawer
 * open/closed (two frames: closed, open). Dims with the lamp.
 */
export const SIDE_TABLE_RECT = { x: 641, y: 409, w: 232, h: 210 }

/**
 * The clock's dark face plane in stage coords. Left/right edges are vertical;
 * top/bottom edges rise ~11° to the right, so the digit layer uses
 * skewY(CLOCK_FACE_SKEW_DEG) with transform-origin top-left (NOT rotate,
 * rotation would tilt the vertical bezel edges).
 */
export const CLOCK_FACE_RECT = { x: 679, y: 409, w: 43, h: 22 }
export const CLOCK_FACE_SKEW_DEG = -11

/**
 * The upper-right window's click target (stage coords): a click cycles the time of
 * day. The city drawn on its glass is RoomWindow (WINDOW_VIEW in window-view.ts),
 * which renders before the bonsai on the sill.
 */
export const WINDOW_GLASS = { x: 1185, y: 52, w: 223, h: 300 }

/**
 * The cat on the bed (scripts/draw-cat.mjs): 100x64 sprites, two breathing
 * frames asleep and one awake, each with a hover frame carrying the highlight.
 */
export const CAT_SIZE = { w: 100, h: 64 } as const
const catFrame = (n: number) => ({ rest: `/room/cat-${n}.png`, hover: `/room/cat-${n}-hover.png` })
export const CAT_FRAMES = { sleep: [catFrame(1), catFrame(2)], awake: catFrame(3) } as const

export interface CatSpot { x: number; y: number }
/** Where it sleeps (top-left of the sprite): mid-blanket, by the pillows, at the foot. */
export const CAT_SPOTS: readonly CatSpot[] = [
  { x: 1035, y: 440 },
  { x: 905, y: 420 },
  { x: 1150, y: 520 },
]
/** A different spot each visit. */
export const catSpotFor = (visitCount: number): CatSpot =>
  CAT_SPOTS[((visitCount % CAT_SPOTS.length) + CAT_SPOTS.length) % CAT_SPOTS.length]

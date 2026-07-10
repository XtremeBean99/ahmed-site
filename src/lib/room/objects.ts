/**
 * Shared animation frame durations (ms). Each value is the interval between
 * sprite frames for the matching room object or component.
 */
export const SPRITE_FRAME_MS = {
  monitor: 80,
  coffee: 90,
  saitama: 100,
  poster: 130,
  bonsai: 165,
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
    frames: [
      '/room/poster-1.png',
      '/room/poster-2.png',
      '/room/poster-3.png',
      '/room/poster-4.png',
      '/room/poster-5.png',
    ],
    href: null,
  },
  {
    id: 'saitama',
    // Saitama (One Punch Man) poster, 14 frames: play all then loop last two
    x: 761,
    y: 76,
    w: 177,
    h: 243,
    labelKey: 'room.saitamaLabel',
    frames: [
      '/room/saitama-1.png',
      '/room/saitama-2.png',
      '/room/saitama-3.png',
      '/room/saitama-4.png',
      '/room/saitama-5.png',
      '/room/saitama-6.png',
      '/room/saitama-7.png',
      '/room/saitama-8.png',
      '/room/saitama-9.png',
      '/room/saitama-10.png',
      '/room/saitama-11.png',
      '/room/saitama-12.png',
      '/room/saitama-13.png',
      '/room/saitama-14.png',
    ],
    href: null,
  },
  {
    id: 'bonsai',
    // Windowsill bonsai plant, extracted from pixel-art/bonsai/
    x: 1241,
    y: 291,
    w: 99,
    h: 131,
    labelKey: 'room.bonsaiLabel',
    frames: [
      '/room/bonsai-1.png',
      '/room/bonsai-2.png',
      '/room/bonsai-3.png',
      '/room/bonsai-4.png',
      '/room/bonsai-5.png',
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
    // Digital alarm clock on the side table. Single frame — the face is blank
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
 * Windows-98-style boot sequence drawn on the monitor glass while the PC is
 * hovered. Decorative overlay (aria-hidden). Rect is in stage coordinates —
 * the loading source canvases are top-left aligned with the stage, and the
 * content bbox is identical in all 18 frames.
 */
export const MONITOR_LOADING_RECT = { x: 270, y: 282, w: 214, h: 171 }

export const MONITOR_LOADING_FRAMES = Array.from(
  { length: 18 },
  (_, i) => `/room/monitor-loading-${i + 1}.png`,
)

/**
 * Side table between the desk and the bed. Clickable — toggles the drawer
 * open/closed (two frames: closed, open). Dims with the lamp.
 */
export const SIDE_TABLE_RECT = { x: 641, y: 409, w: 232, h: 210 }

/**
 * The clock's dark face plane in stage coords. Left/right edges are vertical;
 * top/bottom edges rise ~11° to the right, so the digit layer uses
 * skewY(CLOCK_FACE_SKEW_DEG) with transform-origin top-left (NOT rotate —
 * rotation would tilt the vertical bezel edges).
 */
export const CLOCK_FACE_RECT = { x: 679, y: 409, w: 43, h: 22 }
export const CLOCK_FACE_SKEW_DEG = -11

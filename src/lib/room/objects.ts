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
    // New monitor+keyboard+mouse sprite, extracted from screen-keybaord-mouse-mousapd.png
    x: 240,
    y: 261,
    w: 393,
    h: 343,
    labelKey: 'room.monitorLabel',
    frames: ['/room/monitor-desk.png'],
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
]

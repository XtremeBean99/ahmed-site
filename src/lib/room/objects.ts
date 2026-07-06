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
    x: 350,
    y: 260,
    w: 240,
    h: 200,
    labelKey: 'room.monitorLabel',
    frames: ['/room/monitor-off.png', '/room/monitor-on.png'],
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
]

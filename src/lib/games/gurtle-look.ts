import { useSyncExternalStore } from 'react'
import { GURTLE_KEYS, readJson, writeJson } from './storage'

/**
 * Which turtle the visitor sees: Gurtle, or Jurtle (the pink one with a bow).
 * Clicking the turtle on the rug or the game's mascot swaps them, and the choice
 * holds everywhere he (or she) appears: the room, the desk icon and the game.
 * Kept in games storage (GURTLE_KEYS.look) and announced on window, so every
 * open view swaps at once, other tabs included.
 */
export type GurtleLook = 'gurtle' | 'jurtle'
export const GURTLE_LOOKS: readonly GurtleLook[] = ['gurtle', 'jurtle']

/** Fired on window after the look is changed, with the new look as `detail`. */
export const GURTLE_LOOK_EVENT = 'gurtle-look'

export function parseLook(v: unknown): GurtleLook {
  return v === 'jurtle' ? 'jurtle' : 'gurtle'
}

export function otherLook(look: GurtleLook): GurtleLook {
  return look === 'gurtle' ? 'jurtle' : 'gurtle'
}

export function readLook(): GurtleLook {
  return parseLook(readJson(GURTLE_KEYS.look))
}

export function setLook(look: GurtleLook): void {
  writeJson(GURTLE_KEYS.look, look)
  window.dispatchEvent(new CustomEvent<GurtleLook>(GURTLE_LOOK_EVENT, { detail: look }))
}

/** Swaps Gurtle and Jurtle and returns the new look. */
export function toggleLook(): GurtleLook {
  const next = otherLook(readLook())
  setLook(next)
  return next
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(GURTLE_LOOK_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(GURTLE_LOOK_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/**
 * The current look, kept in step with every other view. The server and the
 * hydrating render both see Gurtle; the stored look takes over right after.
 */
export function useGurtleLook(): GurtleLook {
  return useSyncExternalStore(subscribe, readLook, () => 'gurtle')
}

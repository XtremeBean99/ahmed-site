import type { LightingState } from './lighting'
import type { Weather, WeatherKind } from './weather'

/**
 * The city through the upper-right window (art: scripts/draw-window.mjs), one still per
 * lighting state and weather, cut to the window's two panes, plus looping pixel layers:
 * rain or snow, and at night twinkling stars and an antenna light.
 */
export const WINDOW_VIEW = { x: 1211, y: 79, w: 197, h: 324 } as const

export const PRECIP_FRAMES: Record<Exclude<WeatherKind, 'clear'>, number> = { rain: 4, snow: 6 }
/** ms per frame: rain falls fast, snow drifts. */
export const PRECIP_FRAME_MS: Record<Exclude<WeatherKind, 'clear'>, number> = { rain: 90, snow: 170 }
export const TWINKLE_FRAMES = 2
export const TWINKLE_FRAME_MS = 700

export const viewSrc = (light: LightingState, kind: WeatherKind) => `/room/window/${light}-${kind}.png`

/** The precipitation layers for a frame: the base field, plus the extra one when heavy. */
export function precipSrcs(weather: Weather, frame: number): string[] {
  if (weather.kind === 'clear') return []
  const n = PRECIP_FRAMES[weather.kind]
  const f = (((frame % n) + n) % n) + 1
  const base = `/room/window/${weather.kind}-${f}.png`
  return weather.heavy ? [base, `/room/window/${weather.kind}-heavy-${f}.png`] : [base]
}

export const twinkleSrc = (frame: number) => `/room/window/twinkle-${(((frame % TWINKLE_FRAMES) + TWINKLE_FRAMES) % TWINKLE_FRAMES) + 1}.png`

/** `?weather=clear|rain|snow` (optionally `heavy-rain`, `heavy-snow`) forces the weather, for previews. */
export function weatherFromSearch(search: string): Weather | null {
  const v = new URLSearchParams(search).get('weather')?.toLowerCase()
  if (!v) return null
  const heavy = v.startsWith('heavy-')
  const kind = heavy ? v.slice(6) : v
  return kind === 'clear' || kind === 'rain' || kind === 'snow' ? { kind, heavy: heavy && kind !== 'clear' } : null
}

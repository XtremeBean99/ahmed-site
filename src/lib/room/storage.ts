const KEY = 'room-save-v1'

interface RoomSave {
  audio: boolean
  lampOn: boolean
  visitCount: number
  /** Music volume 0–1 */
  volume: number
  /** Digital clock shows 24-hour time (false = 12-hour) */
  clock24h: boolean
}

const DEFAULTS: RoomSave = { audio: true, lampOn: true, visitCount: 0, volume: 0.3, clock24h: true }

export function loadPrefs(): RoomSave {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    return {
      audio: typeof parsed.audio === 'boolean' ? parsed.audio : DEFAULTS.audio,
      lampOn: typeof parsed.lampOn === 'boolean' ? parsed.lampOn : DEFAULTS.lampOn,
      visitCount: typeof parsed.visitCount === 'number' ? parsed.visitCount : DEFAULTS.visitCount,
      volume:
        typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1
          ? parsed.volume
          : DEFAULTS.volume,
      clock24h: typeof parsed.clock24h === 'boolean' ? parsed.clock24h : DEFAULTS.clock24h,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function savePrefs(prefs: Partial<RoomSave>): void {
  try {
    const current = loadPrefs()
    const merged = { ...current, ...prefs }
    localStorage.setItem(KEY, JSON.stringify(merged))
  } catch {
    // silently ignore
  }
}

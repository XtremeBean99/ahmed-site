const KEY = 'room-save-v1'

interface RoomSave {
  audio: boolean
  lampOn: boolean
  visitCount: number
}

const DEFAULTS: RoomSave = { audio: true, lampOn: true, visitCount: 0 }

export function loadPrefs(): RoomSave {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    return {
      audio: typeof parsed.audio === 'boolean' ? parsed.audio : DEFAULTS.audio,
      lampOn: typeof parsed.lampOn === 'boolean' ? parsed.lampOn : DEFAULTS.lampOn,
      visitCount: typeof parsed.visitCount === 'number' ? parsed.visitCount : DEFAULTS.visitCount,
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

export type BotSpeed = 0 | 200 | 450 | 900

export const BOT_SPEEDS: readonly BotSpeed[] = [0, 200, 450, 900]
export const DEFAULT_BOT_SPEED: BotSpeed = 450
export const PREFS_KEY = 'catan-prefs-v1'

export interface CatanPrefs {
  botSpeed: BotSpeed
  tooltips: boolean
  showBoardKey: boolean
}

export interface CatanPrefsStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function isBotSpeed(value: unknown): value is BotSpeed {
  return value === 0 || value === 200 || value === 450 || value === 900
}

export function defaultPrefs(): CatanPrefs {
  return { botSpeed: DEFAULT_BOT_SPEED, tooltips: true, showBoardKey: true }
}

/** Reads and validates persisted prefs. Returns defaults for SSR, bad JSON, or wrong values. */
export function readPrefs(storage: Pick<CatanPrefsStore, 'getItem'> | null | undefined): CatanPrefs {
  if (!storage) return defaultPrefs()
  try {
    const raw = storage.getItem(PREFS_KEY)
    if (raw === null) return defaultPrefs()
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return defaultPrefs()
    const { botSpeed, tooltips, showBoardKey } = parsed as Record<string, unknown>
    const defaults = defaultPrefs()
    return {
      botSpeed: isBotSpeed(botSpeed) ? botSpeed : defaults.botSpeed,
      tooltips: typeof tooltips === 'boolean' ? tooltips : defaults.tooltips,
      showBoardKey: typeof showBoardKey === 'boolean' ? showBoardKey : defaults.showBoardKey,
    }
  } catch {
    return defaultPrefs()
  }
}

export function writePrefs(storage: Pick<CatanPrefsStore, 'setItem'> | null | undefined, prefs: CatanPrefs): void {
  if (!storage) return
  try {
    storage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // ignore quota / privacy-mode failures
  }
}

/** localStorage accessor that never throws and is safe to call during SSR. */
export function getCatanPrefsStorage(): CatanPrefsStore | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

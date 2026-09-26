import { DEFAULT_SETTINGS, MAX_VP_TO_WIN, MIN_VP_TO_WIN, PLAYER_COLORS } from '@/lib/games/catan/constants'
import type { BoardPreset, BotLevel, GameSettings, PlayerColor } from '@/lib/games/catan/types'

export type BotSpeed = 0 | 200 | 450 | 900

export const BOT_SPEEDS: readonly BotSpeed[] = [0, 200, 450, 900]
export const DEFAULT_BOT_SPEED: BotSpeed = 450
export const PREFS_KEY = 'catan-prefs-v1'

/** The New game dialog's last choices, offered again next time. */
export interface NewGameSetup {
  playerCount: 3 | 4
  name: string
  color: PlayerColor
  botLevel: BotLevel
  settings: GameSettings
}

export interface CatanPrefs {
  botSpeed: BotSpeed
  tooltips: boolean
  showBoardKey: boolean
  sound: boolean
  /** 0 to 1. */
  volume: number
  /** Decorative animation; the OS reduced-motion setting still turns it off. */
  animations: boolean
  lastSetup: NewGameSetup | null
}

export interface CatanPrefsStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const BOT_LEVELS: readonly BotLevel[] = ['easy', 'normal', 'hard']
const BOARD_PRESETS: readonly BoardPreset[] = ['balanced', 'random', 'starter']
const NAME_MAX = 16

function isBotSpeed(value: unknown): value is BotSpeed {
  return value === 0 || value === 200 || value === 450 || value === 900
}

export function defaultPrefs(): CatanPrefs {
  return {
    botSpeed: DEFAULT_BOT_SPEED,
    tooltips: true,
    showBoardKey: true,
    sound: true,
    volume: 0.6,
    animations: true,
    lastSetup: null,
  }
}

function readSettings(value: unknown): GameSettings | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const vpToWin = v.vpToWin
  if (typeof vpToWin !== 'number' || !Number.isInteger(vpToWin) || vpToWin < MIN_VP_TO_WIN || vpToWin > MAX_VP_TO_WIN) return null
  if (typeof v.friendlyRobber !== 'boolean' || typeof v.botTrades !== 'boolean') return null
  if (!BOARD_PRESETS.includes(v.board as BoardPreset)) return null
  return { ...DEFAULT_SETTINGS, vpToWin, friendlyRobber: v.friendlyRobber, botTrades: v.botTrades, board: v.board as BoardPreset }
}

/** Validates a stored setup; the name is untrusted text, so it is trimmed and capped. */
export function readSetup(value: unknown): NewGameSetup | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  if (v.playerCount !== 3 && v.playerCount !== 4) return null
  if (typeof v.name !== 'string') return null
  if (!PLAYER_COLORS.includes(v.color as PlayerColor)) return null
  if (!BOT_LEVELS.includes(v.botLevel as BotLevel)) return null
  const settings = readSettings(v.settings)
  if (!settings) return null
  return {
    playerCount: v.playerCount,
    name: v.name.trim().slice(0, NAME_MAX),
    color: v.color as PlayerColor,
    botLevel: v.botLevel as BotLevel,
    settings,
  }
}

/** Reads and validates persisted prefs. Returns defaults for SSR, bad JSON, or wrong values. */
export function readPrefs(storage: Pick<CatanPrefsStore, 'getItem'> | null | undefined): CatanPrefs {
  if (!storage) return defaultPrefs()
  try {
    const raw = storage.getItem(PREFS_KEY)
    if (raw === null) return defaultPrefs()
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return defaultPrefs()
    const { botSpeed, tooltips, showBoardKey, sound, volume, animations, lastSetup } = parsed as Record<string, unknown>
    const defaults = defaultPrefs()
    return {
      botSpeed: isBotSpeed(botSpeed) ? botSpeed : defaults.botSpeed,
      tooltips: typeof tooltips === 'boolean' ? tooltips : defaults.tooltips,
      showBoardKey: typeof showBoardKey === 'boolean' ? showBoardKey : defaults.showBoardKey,
      sound: typeof sound === 'boolean' ? sound : defaults.sound,
      volume: typeof volume === 'number' && volume >= 0 && volume <= 1 ? volume : defaults.volume,
      animations: typeof animations === 'boolean' ? animations : defaults.animations,
      lastSetup: readSetup(lastSetup),
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

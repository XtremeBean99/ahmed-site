// src/components/room/mahjong/mahjong-store.ts
/**
 * Mahjong desk app persistence on top of games storage: the game in progress (either mode), the settings last
 * used, and the records. Everything read back is validated; a bad value falls back to the defaults.
 */
import { MAHJONG_PREFS_KEY, MAHJONG_SAVE_KEY, MAHJONG_STATS_KEY, readJson, writeJson } from '@/lib/games/storage'
import { LAYOUT_IDS, isLayoutId, validateSave as validateSolitaire, type LayoutId, type SolitaireState } from '@/lib/games/mahjong-solitaire'
import { validateSave as validateMatch, type GameState, type RoundsMode } from '@/lib/games/mahjong-engine'
import type { BotLevel } from '@/lib/games/mahjong-bot'

export type Tab = 'solitaire' | 'four'
export type Speed = 'normal' | 'fast'

export interface Prefs {
  tab: Tab
  layout: LayoutId
  dim: boolean
  level: BotLevel
  minFaan: 0 | 1 | 3
  rounds: RoundsMode
  speed: Speed
  autoPassChow: boolean
}

export const DEFAULT_PREFS: Prefs = {
  tab: 'solitaire',
  layout: 'turtle',
  dim: true,
  level: 'normal',
  minFaan: 1,
  rounds: 'east',
  speed: 'normal',
  autoPassChow: false,
}

export function loadPrefs(): Prefs {
  const raw = readJson(MAHJONG_PREFS_KEY)
  if (!raw || typeof raw !== 'object') return DEFAULT_PREFS
  const r = raw as Record<string, unknown>
  return {
    tab: r.tab === 'four' ? 'four' : 'solitaire',
    layout: isLayoutId(r.layout) ? r.layout : DEFAULT_PREFS.layout,
    dim: r.dim !== false,
    level: r.level === 'easy' || r.level === 'hard' ? r.level : 'normal',
    minFaan: r.minFaan === 0 || r.minFaan === 3 ? r.minFaan : 1,
    rounds: r.rounds === 'full' ? 'full' : 'east',
    speed: r.speed === 'fast' ? 'fast' : 'normal',
    autoPassChow: r.autoPassChow === true,
  }
}

export function savePrefs(p: Prefs): void {
  writeJson(MAHJONG_PREFS_KEY, p)
}

/* ---------- The game in progress ---------- */

export type SavedGame =
  | { mode: 'solitaire'; game: SolitaireState; elapsed: number }
  | { mode: 'four'; game: GameState; level: BotLevel }

export function loadSave(): SavedGame | null {
  const raw = readJson(MAHJONG_SAVE_KEY)
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.mode === 'solitaire') {
    const game = validateSolitaire(r.game)
    if (!game) return null
    const elapsed = typeof r.elapsed === 'number' && Number.isFinite(r.elapsed) && r.elapsed >= 0 ? Math.floor(r.elapsed) : 0
    return { mode: 'solitaire', game, elapsed }
  }
  if (r.mode === 'four') {
    const game = validateMatch(r.game)
    if (!game || game.phase === 'matchOver') return null
    return { mode: 'four', game, level: r.level === 'easy' || r.level === 'hard' ? r.level : 'normal' }
  }
  return null
}

export function writeSave(s: SavedGame): void {
  writeJson(MAHJONG_SAVE_KEY, s)
}

export function clearSave(): void {
  writeJson(MAHJONG_SAVE_KEY, null)
}

/* ---------- Records ---------- */

export interface SolitaireRecord { best: number; wins: number }
export interface Stats {
  solitaire: Record<LayoutId, SolitaireRecord>
  four: { matches: number; matchWins: number; hands: number; handWins: number; bestFaan: number }
}

function emptyStats(): Stats {
  return {
    solitaire: { turtle: { best: 0, wins: 0 }, pyramid: { best: 0, wins: 0 }, fortress: { best: 0, wins: 0 } },
    four: { matches: 0, matchWins: 0, hands: 0, handWins: 0, bestFaan: 0 },
  }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)

export function loadStats(): Stats {
  const out = emptyStats()
  const raw = readJson(MAHJONG_STATS_KEY)
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Record<string, unknown>
  const sol = r.solitaire && typeof r.solitaire === 'object' ? (r.solitaire as Record<string, unknown>) : {}
  for (const id of LAYOUT_IDS) {
    const e = sol[id]
    if (e && typeof e === 'object') {
      const o = e as Record<string, unknown>
      out.solitaire[id] = { best: num(o.best), wins: num(o.wins) }
    }
  }
  const f = r.four && typeof r.four === 'object' ? (r.four as Record<string, unknown>) : {}
  out.four = { matches: num(f.matches), matchWins: num(f.matchWins), hands: num(f.hands), handWins: num(f.handWins), bestFaan: num(f.bestFaan) }
  return out
}

/** Records a cleared board; returns the new stats and whether the time is a new best. */
export function recordSolitaireWin(layout: LayoutId, seconds: number): { stats: Stats; isBest: boolean } {
  const stats = loadStats()
  const rec = stats.solitaire[layout]
  const isBest = seconds > 0 && (rec.best === 0 || seconds < rec.best)
  stats.solitaire[layout] = { best: isBest ? seconds : rec.best, wins: rec.wins + 1 }
  writeJson(MAHJONG_STATS_KEY, stats)
  return { stats, isBest }
}

export function recordHand(won: boolean, faan: number): Stats {
  const stats = loadStats()
  stats.four.hands++
  if (won) {
    stats.four.handWins++
    stats.four.bestFaan = Math.max(stats.four.bestFaan, faan)
  }
  writeJson(MAHJONG_STATS_KEY, stats)
  return stats
}

export function recordMatch(won: boolean): Stats {
  const stats = loadStats()
  stats.four.matches++
  if (won) stats.four.matchWins++
  writeJson(MAHJONG_STATS_KEY, stats)
  return stats
}

export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

import { emptyResources } from './helpers'
import type { GameStats, PlayerStats } from './types'

export function emptyPlayerStats(): PlayerStats {
  return {
    produced: emptyResources(),
    blocked: 0,
    stole: 0,
    robbed: 0,
    discarded: 0,
    monopolyGained: 0,
    monopolyLost: 0,
    bankTrades: 0,
    playerTrades: 0,
    devCardsBought: 0,
    devCardsPlayed: 0,
  }
}

export function emptyStats(playerCount: number): GameStats {
  return {
    rolls: Array(13).fill(0),
    players: Array.from({ length: playerCount }, emptyPlayerStats),
    vpHistory: [],
    partial: false,
  }
}

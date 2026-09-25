import { RESOURCES } from './constants'
import { emptyResources } from './helpers'
import type { GameEvent, GameState, GameStats, PlayerId, PlayerStats } from './types'

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

function totalOf(counts: Record<string, number>): number {
  return RESOURCES.reduce((sum, r) => sum + counts[r], 0)
}

function vpOf(state: GameState, player: PlayerId, includeHidden: boolean): number {
  let vp = 0
  for (const building of state.buildings) {
    if (building?.owner === player) vp += building.kind === 'city' ? 2 : 1
  }
  if (state.longestRoadHolder === player) vp += 2
  if (state.largestArmyHolder === player) vp += 2
  if (includeHidden) {
    const p = state.players[player]
    vp += [...p.devCards, ...p.newDevCards].filter((card) => card === 'victoryPoint').length
  }
  return vp
}

/** Keeps state.stats current; called from pushEvent for every event the engine emits. */
export function recordStats(state: GameState, event: GameEvent): void {
  const players = state.stats.players
  switch (event.type) {
    case 'roll':
      state.stats.rolls[event.dice[0] + event.dice[1]] += 1
      break
    case 'produce':
      for (let p = 0; p < players.length; p++) {
        const gains = event.gains[p]
        if (!gains) continue
        for (const r of RESOURCES) players[p].produced[r] += gains[r]
      }
      for (let p = 0; p < players.length; p++) {
        const blocked = event.blocked[p]
        if (blocked) players[p].blocked += totalOf(blocked)
      }
      break
    case 'setupResources':
      for (const r of RESOURCES) players[event.player].produced[r] += event.resources[r]
      break
    case 'stole':
      if (event.resource !== null) {
        players[event.player].stole += 1
        players[event.victim].robbed += 1
      }
      break
    case 'discard':
      players[event.player].discarded += totalOf(event.resources)
      break
    case 'monopoly':
      players[event.player].monopolyGained += event.taken
      for (let p = 0; p < players.length && p < event.takenFrom.length; p++) {
        players[p].monopolyLost += event.takenFrom[p]
      }
      break
    case 'maritimeTrade':
      players[event.player].bankTrades += 1
      break
    case 'domesticTrade':
      players[event.player].playerTrades += 1
      players[event.partner].playerTrades += 1
      break
    case 'boughtDevCard':
      players[event.player].devCardsBought += 1
      break
    case 'playedDevCard':
      players[event.player].devCardsPlayed += 1
      break
    case 'turnEnded':
      state.stats.vpHistory.push(state.players.map((_, p) => vpOf(state, p, false)))
      break
    case 'gameOver':
      state.stats.vpHistory.push(state.players.map((_, p) => vpOf(state, p, true)))
      break
  }
}

/** Rebuilds stats from an event list (used for v1 save migration); public VP only. */
export function recountStatsFromEvents(events: GameEvent[], playerCount: number): GameStats {
  const stats = emptyStats(playerCount)
  stats.partial = true
  const settlements = Array(playerCount).fill(0)
  const cities = Array(playerCount).fill(0)
  let longestRoadHolder: PlayerId | null = null
  let largestArmyHolder: PlayerId | null = null

  const publicVp = (player: PlayerId) =>
    settlements[player] + cities[player] * 2 + (longestRoadHolder === player ? 2 : 0) + (largestArmyHolder === player ? 2 : 0)

  for (const event of events) {
    switch (event.type) {
      case 'roll':
        stats.rolls[event.dice[0] + event.dice[1]] += 1
        break
      case 'setupSettlement':
        settlements[event.player] += 1
        break
      case 'setupResources':
        for (const r of RESOURCES) stats.players[event.player].produced[r] += event.resources[r]
        break
      case 'produce':
        for (let p = 0; p < playerCount; p++) {
          const gains = event.gains[p]
          if (!gains) continue
          for (const r of RESOURCES) stats.players[p].produced[r] += gains[r]
        }
        for (let p = 0; p < playerCount; p++) {
          const blocked = event.blocked[p]
          if (blocked) stats.players[p].blocked += totalOf(blocked)
        }
        break
      case 'discard':
        stats.players[event.player].discarded += totalOf(event.resources)
        break
      case 'stole':
        if (event.resource !== null) {
          stats.players[event.player].stole += 1
          stats.players[event.victim].robbed += 1
        }
        break
      case 'built':
        if (event.kind === 'settlement') settlements[event.player] += 1
        else if (event.kind === 'city') {
          settlements[event.player] -= 1
          cities[event.player] += 1
        }
        break
      case 'monopoly':
        stats.players[event.player].monopolyGained += event.taken
        for (let p = 0; p < playerCount && p < event.takenFrom.length; p++) {
          stats.players[p].monopolyLost += event.takenFrom[p]
        }
        break
      case 'maritimeTrade':
        stats.players[event.player].bankTrades += 1
        break
      case 'domesticTrade':
        stats.players[event.player].playerTrades += 1
        stats.players[event.partner].playerTrades += 1
        break
      case 'boughtDevCard':
        stats.players[event.player].devCardsBought += 1
        break
      case 'playedDevCard':
        stats.players[event.player].devCardsPlayed += 1
        break
      case 'longestRoad':
        longestRoadHolder = event.player
        break
      case 'largestArmy':
        largestArmyHolder = event.player
        break
      case 'turnEnded':
        stats.vpHistory.push(Array.from({ length: playerCount }, (_, p) => publicVp(p)))
        break
      case 'gameOver':
        stats.vpHistory.push(Array.from({ length: playerCount }, (_, p) => publicVp(p)))
        break
    }
  }
  return stats
}

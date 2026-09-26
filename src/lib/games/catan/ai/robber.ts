import { pips, RESOURCES } from '../constants'
import { HEXES } from '../geometry'
import { emptyResources, legalRobberHexes, robberVictims, totalCards } from '../helpers'
import { publicVp, targetBuild } from './evaluate'
import { botRandom } from './levels'
import type { Action, BotLevel, GameState, PlayerId, Resource, ResourceCounts } from '../types'

function keepAmounts(state: GameState, bot: PlayerId): ResourceCounts {
  const cost = targetBuild(state, bot).cost
  const hand = state.players[bot].resources
  const keep = emptyResources()
  for (const r of RESOURCES) keep[r] = Math.min(hand[r], cost[r])
  return keep
}

function pickDiscardResource(hand: ResourceCounts, keep: ResourceCounts, discards: ResourceCounts): Resource {
  let pick: Resource | null = null
  let pickSurplus = Number.NEGATIVE_INFINITY
  let pickHand = Number.NEGATIVE_INFINITY
  for (const r of RESOURCES) {
    const surplus = hand[r] - keep[r] - discards[r]
    if (surplus <= 0) continue
    if (surplus > pickSurplus || (surplus === pickSurplus && hand[r] > pickHand)) {
      pick = r
      pickSurplus = surplus
      pickHand = hand[r]
    }
  }
  if (pick !== null) return pick
  for (const r of RESOURCES) {
    const available = hand[r] - discards[r]
    if (available <= 0) continue
    if (pick === null || available > hand[pick] - discards[pick]) pick = r
  }
  if (pick === null) throw new Error('cannot discard enough cards')
  return pick
}

export function chooseDiscard(state: GameState, bot: PlayerId): Action {
  const owed = state.phase.kind === 'discard' ? state.phase.discards[bot] : 0
  if (owed <= 0) throw new Error('no discard owed')
  const hand = state.players[bot].resources
  const keep = keepAmounts(state, bot)
  const discards = emptyResources()
  for (let remaining = owed; remaining > 0; remaining--) {
    const r = pickDiscardResource(hand, keep, discards)
    discards[r] += 1
  }
  return { type: 'discard', player: bot, resources: discards }
}

function robberHexScore(state: GameState, bot: PlayerId, hex: number): number {
  const tile = state.tiles[hex]
  const pipCount = pips(tile.number)
  let score = 0
  for (const v of HEXES[hex].vertices) {
    const building = state.buildings[v]
    if (!building || building.owner === bot) continue
    score += pipCount * (1 + publicVp(state, building.owner))
  }
  score += robberVictims(state, hex, bot).length * 3
  return score
}

export function chooseMoveRobber(state: GameState, bot: PlayerId, level: BotLevel): Action {
  const candidates = legalRobberHexes(state)
  if (level === 'easy') {
    const rand = botRandom(state, bot)
    const opponentHexes = candidates.filter((hex) =>
      HEXES[hex].vertices.some((v) => {
        const building = state.buildings[v]
        return building !== null && building.owner !== bot
      }),
    )
    const pool = opponentHexes.length > 0 ? opponentHexes : candidates
    return { type: 'moveRobber', hex: pool[Math.floor(rand() * pool.length)] }
  }
  const avoidsOwn = candidates.filter(
    (hex) => !HEXES[hex].vertices.some((v) => state.buildings[v]?.owner === bot),
  )
  const pool = avoidsOwn.length > 0 ? avoidsOwn : candidates
  let best = pool[0]
  let bestScore = robberHexScore(state, bot, best)
  for (let i = 1; i < pool.length; i++) {
    const hex = pool[i]
    const score = robberHexScore(state, bot, hex)
    if (score > bestScore || (score === bestScore && hex < best)) {
      best = hex
      bestScore = score
    }
  }
  return { type: 'moveRobber', hex: best }
}

export function chooseSteal(state: GameState): Action {
  const candidates = state.phase.kind === 'steal' ? state.phase.candidates : []
  if (candidates.length === 0) throw new Error('no steal candidates')
  let best = candidates[0]
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]
    const cVp = publicVp(state, c)
    const bestVp = publicVp(state, best)
    const cCards = totalCards(state.players[c].resources)
    const bestCards = totalCards(state.players[best].resources)
    if (cVp > bestVp || (cVp === bestVp && cCards > bestCards) || (cVp === bestVp && cCards === bestCards && c < best)) {
      best = c
    }
  }
  return { type: 'steal', victim: best }
}

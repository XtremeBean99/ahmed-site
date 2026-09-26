import { MIN_LARGEST_ARMY } from './constants'
import { emptyResources, hasResources, isResource, legalRoads, payFromBank, pushEvent } from './helpers'
import type { DevCardType, GameState, HandlerMap, PlayerId, Resource, ResourceCounts } from './types'

function sharedValidate(state: GameState, card: DevCardType): string | null {
  if (state.phase.kind !== 'preRoll' && state.phase.kind !== 'main') return 'Dev cards can only be played in preRoll or main'
  if (state.devCardPlayedThisTurn) return 'Already played a dev card this turn'
  if (!state.players[state.current].devCards.includes(card)) return 'Card not in hand'
  return null
}

function sharedApply(state: GameState, card: Exclude<DevCardType, 'victoryPoint'>): void {
  const hand = state.players[state.current].devCards
  hand.splice(hand.indexOf(card), 1)
  state.devCardPlayedThisTurn = true
  pushEvent(state, { type: 'playedDevCard', player: state.current, card })
}

function playableRoadBuilding(state: GameState): string | null {
  if (state.players[state.current].roadsLeft === 0) return 'No road pieces left'
  if (legalRoads(state, state.current).length === 0) return 'No legal road spot'
  return null
}

function yearOfPlentyAmounts(resources: [Resource, Resource]): ResourceCounts {
  const amount = emptyResources()
  amount[resources[0]] += 1
  amount[resources[1]] += 1
  return amount
}

function isValidResourcesPair(value: unknown): value is [Resource, Resource] {
  return Array.isArray(value) && value.length === 2 && isResource(value[0]) && isResource(value[1])
}

export const devCardHandlers: HandlerMap<'playKnight' | 'playRoadBuilding' | 'playYearOfPlenty' | 'playMonopoly'> = {
  playKnight: {
    validate(state) {
      return sharedValidate(state, 'knight')
    },
    apply(state) {
      sharedApply(state, 'knight')
      const returnTo = state.phase.kind === 'preRoll' ? 'preRoll' : 'main'
      state.players[state.current].knightsPlayed += 1
      state.phase = { kind: 'moveRobber', returnTo }
    },
  },
  playRoadBuilding: {
    validate(state) {
      const shared = sharedValidate(state, 'roadBuilding')
      if (shared !== null) return shared
      return playableRoadBuilding(state)
    },
    apply(state) {
      sharedApply(state, 'roadBuilding')
      const returnTo = state.phase.kind === 'preRoll' ? 'preRoll' : 'main'
      state.phase = { kind: 'roadBuilding', remaining: Math.min(2, state.players[state.current].roadsLeft), returnTo }
    },
  },
  playYearOfPlenty: {
    validate(state, action) {
      const shared = sharedValidate(state, 'yearOfPlenty')
      if (shared !== null) return shared
      if (!isValidResourcesPair(action.resources)) return 'Invalid resources'
      if (!hasResources(state.bank, yearOfPlentyAmounts(action.resources))) return 'Bank does not have those resources'
      return null
    },
    apply(state, action) {
      sharedApply(state, 'yearOfPlenty')
      const amount = yearOfPlentyAmounts(action.resources)
      payFromBank(state, state.current, amount)
      pushEvent(state, { type: 'yearOfPlenty', player: state.current, resources: [...action.resources] })
    },
  },
  playMonopoly: {
    validate(state, action) {
      const shared = sharedValidate(state, 'monopoly')
      if (shared !== null) return shared
      if (!isResource(action.resource)) return 'Invalid resource'
      return null
    },
    apply(state, action) {
      sharedApply(state, 'monopoly')
      const resource = action.resource
      let taken = 0
      const takenFrom = state.players.map(() => 0)
      for (let p = 0; p < state.players.length; p++) {
        if (p === state.current) continue
        const n = state.players[p].resources[resource]
        if (n > 0) {
          state.players[p].resources[resource] = 0
          state.players[state.current].resources[resource] += n
          taken += n
          takenFrom[p] = n
        }
      }
      pushEvent(state, { type: 'monopoly', player: state.current, resource, taken, takenFrom })
    },
  },
}

export function updateLargestArmy(state: GameState): void {
  const holder = state.largestArmyHolder
  let next: PlayerId | null = null
  for (let p = 0; p < state.players.length; p++) {
    const knights = state.players[p].knightsPlayed
    if (knights < MIN_LARGEST_ARMY) continue
    if (holder !== null && p !== holder && knights <= state.players[holder].knightsPlayed) continue
    if (next === null || knights > state.players[next].knightsPlayed) next = p
  }
  if (next !== null && next !== holder) {
    state.largestArmyHolder = next
    pushEvent(state, { type: 'largestArmy', player: next })
  }
}

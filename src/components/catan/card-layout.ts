import { RESOURCES } from '@/lib/games/catan/constants'
import type { GameEvent, PlayerId, Resource } from '@/lib/games/catan/types'

export interface CardStackLayout {
  /** How many card sprites to draw, fanned. */
  shown: number
  /** Cards beyond `shown`, displayed as a "+n" badge. */
  extra: number
}

/** Fanned-stack layout: show up to `maxVisible` cards, badge the rest. */
export function cardStackLayout(count: number, maxVisible = 4): CardStackLayout {
  const clamped = Math.max(0, count)
  return {
    shown: Math.min(clamped, maxVisible),
    extra: Math.max(0, clamped - maxVisible),
  }
}

/** A hand over 7 cards must discard half on a roll of 7. */
export function isOverSeven(cardCount: number): boolean {
  return cardCount > 7
}

export interface ResourceGain {
  resource: Resource
  amount: number
}

function addGain(list: ResourceGain[], resource: Resource, amount: number): void {
  if (amount <= 0) return
  const existing = list.find((g) => g.resource === resource)
  if (existing) existing.amount += amount
  else list.push({ resource, amount })
}

/** Cards a single event gave to `player` (produce, setup, steal, monopoly, year of plenty, trades). */
export function eventGainsForPlayer(event: GameEvent, player: PlayerId): ResourceGain[] {
  const gains: ResourceGain[] = []
  switch (event.type) {
    case 'produce': {
      const received = event.gains[player]
      if (!received) break
      for (const r of RESOURCES) addGain(gains, r, received[r])
      break
    }
    case 'setupResources':
      if (event.player === player) {
        for (const r of RESOURCES) addGain(gains, r, event.resources[r])
      }
      break
    case 'stole':
      if (event.player === player && event.resource !== null) addGain(gains, event.resource, 1)
      break
    case 'monopoly':
      if (event.player === player) addGain(gains, event.resource, event.taken)
      break
    case 'yearOfPlenty':
      if (event.player === player) {
        addGain(gains, event.resources[0], 1)
        addGain(gains, event.resources[1], 1)
      }
      break
    case 'maritimeTrade':
      if (event.player === player) addGain(gains, event.get, 1)
      break
    case 'domesticTrade':
      if (event.player === player) {
        for (const r of RESOURCES) addGain(gains, r, event.get[r])
      }
      break
  }
  return gains
}

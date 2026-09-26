import { DEFAULT_SETTINGS, MAX_VP_TO_WIN, MIN_VP_TO_WIN, RESOURCES } from '@/lib/games/catan/constants'
import { emptyResources, totalCards } from '@/lib/games/catan/helpers'
import type { BoardPreset, BotLevel, DevCardType, PlayerColor, Resource, ResourceCounts } from '@/lib/games/catan/types'
import type { NewGameSetup } from './prefs'
import type { UiSpriteName } from './ui-sprites'

export const NAME_MAX = 16

const DEV_CARD_SPRITES: Record<DevCardType, UiSpriteName> = {
  knight: 'card-knight',
  roadBuilding: 'card-road-building',
  yearOfPlenty: 'card-year-of-plenty',
  monopoly: 'card-monopoly',
  victoryPoint: 'card-victory-point',
}

/** The UI sprite for a development card type (names are kebab-case on disk). */
export function devCardSprite(card: DevCardType): UiSpriteName {
  return DEV_CARD_SPRITES[card]
}

/** The New game dialog's form fields, kept apart from the persisted NewGameSetup. */
export interface NewGameForm {
  playerCount: 3 | 4
  name: string
  color: PlayerColor
  botLevel: BotLevel
  vpToWin: number
  board: BoardPreset
  friendlyRobber: boolean
  botTrades: boolean
}

/** Untrusted player names are trimmed and capped before they are used or stored. */
export function normalizeName(raw: string): string {
  return raw.trim().slice(0, NAME_MAX)
}

export function isVpToWin(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_VP_TO_WIN && value <= MAX_VP_TO_WIN
}

export function clampVpToWin(value: number): number {
  return Math.min(MAX_VP_TO_WIN, Math.max(MIN_VP_TO_WIN, Math.round(value)))
}

/** The form starts from the remembered setup when present, otherwise the standard defaults. */
export function initialNewGameForm(initial: NewGameSetup | null): NewGameForm {
  const settings = initial?.settings ?? DEFAULT_SETTINGS
  return {
    playerCount: initial?.playerCount ?? 4,
    name: initial?.name ?? 'You',
    color: initial?.color ?? 'red',
    botLevel: initial?.botLevel ?? 'normal',
    vpToWin: settings.vpToWin,
    board: settings.board,
    friendlyRobber: settings.friendlyRobber,
    botTrades: settings.botTrades,
  }
}

/** Builds the full NewGameSetup handed to the controller. */
export function buildNewGameSetup(form: NewGameForm): NewGameSetup {
  const name = normalizeName(form.name)
  return {
    playerCount: form.playerCount,
    name: name || 'You',
    color: form.color,
    botLevel: form.botLevel,
    settings: {
      vpToWin: clampVpToWin(form.vpToWin),
      friendlyRobber: form.friendlyRobber,
      board: form.board,
      botTrades: form.botTrades,
    },
  }
}

/** Adds one card to the discard selection, capped by the hand and the amount owed. */
export function discardAdd(
  selected: ResourceCounts,
  resource: Resource,
  hand: ResourceCounts,
  owed: number,
): ResourceCounts {
  if (selected[resource] >= hand[resource]) return selected
  if (totalCards(selected) >= owed) return selected
  return { ...selected, [resource]: selected[resource] + 1 }
}

/** Removes one card from the discard selection. */
export function discardRemove(selected: ResourceCounts, resource: Resource): ResourceCounts {
  if (selected[resource] === 0) return selected
  return { ...selected, [resource]: selected[resource] - 1 }
}

/** Adds one Year of Plenty pick, capped by the two-card total and the bank's stock. */
export function yearOfPlentyAdd(selected: ResourceCounts, resource: Resource, bank: ResourceCounts): ResourceCounts {
  if (totalCards(selected) >= 2) return selected
  if (selected[resource] >= bank[resource]) return selected
  return { ...selected, [resource]: selected[resource] + 1 }
}

/** Removes one Year of Plenty pick. */
export function yearOfPlentyRemove(selected: ResourceCounts, resource: Resource): ResourceCounts {
  if (selected[resource] === 0) return selected
  return { ...selected, [resource]: selected[resource] - 1 }
}

/** The [Resource, Resource] pair for a complete Year of Plenty selection, or null. */
export function yearOfPlentyPair(selected: ResourceCounts): [Resource, Resource] | null {
  if (totalCards(selected) !== 2) return null
  const pair: Resource[] = []
  for (const r of RESOURCES) {
    for (let i = 0; i < selected[r]; i++) pair.push(r)
  }
  return pair.length === 2 ? [pair[0], pair[1]] : null
}

export function yearOfPlentyValid(selected: ResourceCounts, bank: ResourceCounts): boolean {
  return totalCards(selected) === 2 && RESOURCES.every((r) => selected[r] <= bank[r])
}

/** An empty resource selection (typed helper for the dialogs). */
export function emptySelection(): ResourceCounts {
  return emptyResources()
}

// --- Tooltip long-press gesture (coarse pointers) ---

export type TooltipGestureState =
  | { kind: 'idle' }
  | { kind: 'pressed' }
  | { kind: 'moving' }
  | { kind: 'open' }

export type TooltipGestureEvent = 'down' | 'move' | 'up' | 'longpress' | 'dismiss'

/**
 * Pure state machine for a touch tooltip: press and hold opens it, moving cancels the
 * long-press, lifting the finger or a timeout closes it.
 */
export function tooltipGesture(state: TooltipGestureState, event: TooltipGestureEvent): TooltipGestureState {
  switch (state.kind) {
    case 'idle':
      return event === 'down' ? { kind: 'pressed' } : state
    case 'pressed':
      if (event === 'move') return { kind: 'moving' }
      if (event === 'longpress') return { kind: 'open' }
      if (event === 'up') return { kind: 'idle' }
      return state
    case 'moving':
      return event === 'up' ? { kind: 'idle' } : state
    case 'open':
      return event === 'up' || event === 'dismiss' ? { kind: 'idle' } : state
  }
}

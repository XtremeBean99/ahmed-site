'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { chooseBotAction, fallbackAction } from '@/lib/games/catan/ai'
import { createGame } from '@/lib/games/catan/board'
import { COSTS, RESOURCES } from '@/lib/games/catan/constants'
import { applyAction, humanPlayer, playersToAct, validateAction } from '@/lib/games/catan/engine'
import { HEXES } from '@/lib/games/catan/geometry'
import {
  hasResources,
  legalCities,
  legalRoads,
  legalSettlements,
  legalSetupRoads,
  legalSetupSettlements,
  maritimeRate,
  totalCards,
  victoryPoints,
} from '@/lib/games/catan/helpers'
import { clearGame, loadGame, saveGame } from '@/lib/games/catan/save'
import type { Action, GameState, PlayerId } from '@/lib/games/catan/types'
import { actionBlockReason, formatActionBlockReason } from './action-reasons'
import { type BuildMode } from './ActionBar'
import type { BoardTargets } from './BoardCanvas'
import { fill, playerSubject } from './event-text'
import { describeHover, type HoverTarget } from './hover-info'
import { type PlayableDevCard, playableDevCards } from './PlayCardDialog'
import { getCatanPrefsStorage, readPrefs, writePrefs, type BotSpeed, type CatanPrefs } from './prefs'
import { vertexDescription } from './vertex-info'

export type CatanDialog = 'trade' | 'playCard' | 'rules' | null

export interface CatanControllerOptions {
  /** localStorage key for save/resume. Defaults to the engine's `catan-save-v1`. */
  saveKey?: string
  /** When provided, start from this state instead of loading a save (tutorial mode). */
  initialState?: GameState | null
  /** Tutorial filter: disallowed human actions hide board targets and disable buttons. */
  canHumanApply?: (state: GameState, action: Action) => boolean
  /** When true, bot timers never run (a tutorial step is waiting for the human). */
  botsPaused?: boolean
  /** Replaces the computed status line while set. */
  statusOverride?: string | null
}

const DEFAULT_SAVE_KEY = 'catan-save-v1'

function readSave(key: string): GameState | null {
  if (key === DEFAULT_SAVE_KEY) return loadGame()
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as GameState
  } catch {
    return null
  }
}

function writeSave(key: string, state: GameState): void {
  if (key === DEFAULT_SAVE_KEY) {
    saveGame(state)
    return
  }
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // ignore quota / privacy-mode failures
  }
}

function clearSave(key: string): void {
  if (key === DEFAULT_SAVE_KEY) {
    clearGame()
    return
  }
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

const emptyTargets = (): BoardTargets => ({ kind: null, vertices: [], edges: [], hexes: [] })

function cardAction(card: PlayableDevCard): Action {
  if (card === 'knight') return { type: 'playKnight' }
  if (card === 'roadBuilding') return { type: 'playRoadBuilding' }
  if (card === 'yearOfPlenty') return { type: 'playYearOfPlenty', resources: ['brick', 'brick'] }
  return { type: 'playMonopoly', resource: 'brick' }
}

export function useCatanController(options: CatanControllerOptions = {}) {
  const t = useT()
  const saveKey = options.saveKey ?? DEFAULT_SAVE_KEY
  const initialState = options.initialState
  const canHumanApply = options.canHumanApply
  const botsPaused = options.botsPaused ?? false
  const statusOverride = options.statusOverride

  const [mounted, setMounted] = useState(false)
  const [game, setGame] = useState<GameState | null>(null)
  const [showNewGame, setShowNewGame] = useState(false)
  const [dialog, setDialog] = useState<CatanDialog>(null)
  const [buildMode, setBuildMode] = useState<BuildMode>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [botStalled, setBotStalled] = useState(false)
  const [prefs, setPrefs] = useState<CatanPrefs>(() => readPrefs(getCatanPrefsStorage()))
  const gameRef = useRef<GameState | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMounted(true)
    setPrefs(readPrefs(getCatanPrefsStorage()))
    if (initialState) {
      gameRef.current = initialState
      setGame(initialState)
      return
    }
    const saved = readSave(saveKey)
    if (saved) {
      gameRef.current = saved
      setGame(saved)
    } else {
      setShowNewGame(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    gameRef.current = game
    if (game) writeSave(saveKey, game)
  }, [game, saveKey])

  const updatePrefs = useCallback((patch: Partial<CatanPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      writePrefs(getCatanPrefsStorage(), next)
      return next
    })
  }, [])

  const apply = useCallback((action: Action): boolean => {
    const prev = gameRef.current
    if (!prev) return false
    try {
      const next = applyAction(prev, action)
      gameRef.current = next
      setGame(next)
      setStatus(null)
      setBotStalled(false)
      return true
    } catch (err) {
      console.error('Catan action rejected', err)
      setStatus(err instanceof Error ? err.message : String(err))
      return false
    }
  }, [])

  const replaceGame = useCallback((next: GameState): void => {
    gameRef.current = next
    setGame(next)
    setStatus(null)
    setBotStalled(false)
  }, [])

  const startNewGame = useCallback(
    (count: 3 | 4, name: string) => {
      clearSave(saveKey)
      const seed = crypto.getRandomValues(new Uint32Array(1))[0]
      const fresh = createGame({ seed, playerCount: count, humanName: name || 'You' })
      gameRef.current = fresh
      setGame(fresh)
      setShowNewGame(false)
      setDialog(null)
      setBuildMode(null)
      setStatus(null)
      setBotStalled(false)
    },
    [saveKey],
  )

  const startNewFromGameOver = useCallback(() => {
    clearSave(saveKey)
    gameRef.current = null
    setGame(null)
    setShowNewGame(true)
    setDialog(null)
    setBuildMode(null)
    setStatus(null)
    setBotStalled(false)
  }, [saveKey])

  const human = game ? humanPlayer(game) : -1
  const actors = game ? playersToAct(game) : []
  const humanActing = game !== null && human >= 0 && actors.includes(human)
  const humanSteal = game !== null && human >= 0 && game.phase.kind === 'steal' && game.current === human
  const humanDiscard =
    game !== null && human >= 0 && game.phase.kind === 'discard' && game.phase.discards[human] > 0
  const mustAnswer = showNewGame || dialog === 'trade' || dialog === 'playCard' || humanSteal || humanDiscard
  const modalOpen = showNewGame || dialog !== null || humanSteal || humanDiscard || game?.phase.kind === 'gameOver'
  const pauseBots = !game || mustAnswer || botStalled || botsPaused

  const humanAllowed = useCallback(
    (action: Action): boolean => {
      if (!canHumanApply) return true
      if (!game) return false
      return canHumanApply(game, action)
    },
    [canHumanApply, game],
  )

  const runBotAction = useCallback(
    (state: GameState, bot: number): boolean => {
      try {
        const action = chooseBotAction(state, bot)
        if (apply(action)) return true
        console.error('Bot action failed validation', action)
      } catch (err) {
        console.error('Bot could not choose an action', err)
      }
      try {
        const fallback = fallbackAction(state, bot)
        if (apply(fallback)) return true
        console.error('Bot fallback action failed validation', fallback)
      } catch (err) {
        console.error('Bot fallback action failed', err)
      }
      setStatus(t.catan.status.botStalled)
      setBotStalled(true)
      return false
    },
    [apply, t],
  )

  useEffect(() => {
    if (!game || pauseBots) return
    const bot = playersToAct(game).find((p) => game.players[p].isBot)
    if (bot === undefined) return
    const delay = game.phase.kind === 'setup' ? Math.min(prefs.botSpeed, 200) : prefs.botSpeed
    const timer = setTimeout(() => {
      const state = gameRef.current
      if (!state) return
      runBotAction(state, bot)
    }, delay)
    return () => clearTimeout(timer)
  }, [game, pauseBots, prefs.botSpeed, runBotAction])

  const skipToMyTurn = useCallback(() => {
    const initial = gameRef.current
    if (!initial) return
    let state: GameState = initial
    let steps = 0
    while (steps < 500) {
      if (state.phase.kind === 'gameOver') break
      const actors = playersToAct(state)
      if (actors.length === 0 || actors.includes(humanPlayer(state))) break
      const bot = actors.find((p) => state.players[p].isBot)
      if (bot === undefined) break
      let action: Action | null = null
      try {
        action = chooseBotAction(state, bot)
      } catch (err) {
        console.error('Bot could not choose an action while skipping', err)
      }
      if (action) {
        try {
          state = applyAction(state, action)
          steps += 1
          continue
        } catch (err) {
          console.error('Bot action failed validation while skipping', err)
        }
      }
      try {
        state = applyAction(state, fallbackAction(state, bot))
        steps += 1
      } catch (err) {
        console.error('Bot fallback action failed while skipping', err)
        setStatus(t.catan.status.botStalled)
        setBotStalled(true)
        return
      }
    }
    gameRef.current = state
    setGame(state)
    writeSave(saveKey, state)
  }, [saveKey, t])

  useEffect(() => {
    if (!mounted) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBuildMode(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mounted])

  useEffect(() => {
    if (!game || game.phase.kind === 'main') return
    setBuildMode(null)
  }, [game])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [game?.events.length])

  const targets = useMemo<BoardTargets>(() => {
    if (!game || human < 0 || !humanActing) return emptyTargets()
    const filterVertices = (list: number[], make: (v: number) => Action) =>
      canHumanApply ? list.filter((v) => canHumanApply(game, make(v))) : list
    const filterEdges = (list: number[], make: (e: number) => Action) =>
      canHumanApply ? list.filter((e) => canHumanApply(game, make(e))) : list
    const phase = game.phase
    switch (phase.kind) {
      case 'setup':
        if (phase.step === 'settlement') {
          return {
            kind: 'setupSettlement',
            vertices: filterVertices(legalSetupSettlements(game), (v) => ({ type: 'placeSetupSettlement', vertex: v })),
            edges: [],
            hexes: [],
          }
        }
        return {
          kind: 'setupRoad',
          vertices: [],
          edges: filterEdges(legalSetupRoads(game), (e) => ({ type: 'placeSetupRoad', edge: e })),
          hexes: [],
        }
      case 'moveRobber':
        return {
          kind: 'robber',
          vertices: [],
          edges: [],
          hexes: HEXES.map((h) => h.id).filter(
            (id) => id !== game.robber && (canHumanApply ? canHumanApply(game, { type: 'moveRobber', hex: id }) : true),
          ),
        }
      case 'roadBuilding':
        return {
          kind: 'road',
          vertices: [],
          edges: filterEdges(legalRoads(game, human), (e) => ({ type: 'buildRoad', edge: e })),
          hexes: [],
        }
      case 'main':
        if (buildMode === 'road') {
          return {
            kind: 'road',
            vertices: [],
            edges: filterEdges(legalRoads(game, human), (e) => ({ type: 'buildRoad', edge: e })),
            hexes: [],
          }
        }
        if (buildMode === 'settlement') {
          return {
            kind: 'settlement',
            vertices: filterVertices(legalSettlements(game, human), (v) => ({ type: 'buildSettlement', vertex: v })),
            edges: [],
            hexes: [],
          }
        }
        if (buildMode === 'city') {
          return {
            kind: 'city',
            vertices: filterVertices(legalCities(game, human), (v) => ({ type: 'buildCity', vertex: v })),
            edges: [],
            hexes: [],
          }
        }
        return emptyTargets()
      default:
        return emptyTargets()
    }
  }, [game, human, buildMode, humanActing, canHumanApply])

  const lastPlaced = useMemo(() => {
    if (!game) return null
    for (let i = game.events.length - 1; i >= 0; i--) {
      const e = game.events[i]
      if (e.type === 'built') {
        return e.kind === 'road' ? { kind: 'edge' as const, id: e.at } : { kind: 'vertex' as const, id: e.at }
      }
      if (e.type === 'setupSettlement') return { kind: 'vertex' as const, id: e.vertex }
      if (e.type === 'setupRoad') return { kind: 'edge' as const, id: e.edge }
    }
    return null
  }, [game])

  const statusText = useMemo(() => {
    if (statusOverride !== undefined && statusOverride !== null) return statusOverride
    if (!game) return t.catan.newGame
    if (status) return status
    const phase = game.phase
    const player = playerSubject(game, game.current)
    switch (phase.kind) {
      case 'setup':
        return fill(phase.step === 'settlement' ? t.catan.status.setupSettlement : t.catan.status.setupRoad, {
          player,
        })
      case 'preRoll':
        return fill(t.catan.status.preRoll, { player })
      case 'main':
        return fill(t.catan.status.main, { player })
      case 'roadBuilding':
        return fill(t.catan.status.roadBuilding, { player, remaining: phase.remaining })
      case 'moveRobber':
        return fill(t.catan.status.moveRobber, { player })
      case 'steal':
        return fill(t.catan.status.steal, { player })
      case 'discard': {
        if (human >= 0 && phase.discards[human] > 0) {
          return fill(t.catan.status.discard, { player: playerSubject(game, human), count: phase.discards[human] })
        }
        const next = phase.discards.findIndex((n) => n > 0)
        return fill(t.catan.status.discard, { player: game.players[next]?.name ?? '', count: phase.discards[next] ?? 0 })
      }
      case 'gameOver':
        if (phase.winner === human) return t.catan.status.gameOverYou
        return fill(t.catan.status.gameOver, { player: game.players[phase.winner].name })
    }
  }, [game, status, statusOverride, t, human])

  const me = game && human >= 0 ? game.players[human] : null
  const inMain = game?.phase.kind === 'main'
  const inPreRoll = game?.phase.kind === 'preRoll'

  const roadSpots = game && inMain && me && humanActing ? legalRoads(game, human) : []
  const settlementSpots = game && inMain && me && humanActing ? legalSettlements(game, human) : []
  const citySpots = game && inMain && me && humanActing ? legalCities(game, human) : []

  const allowedRoadSpots = canHumanApply && game
    ? roadSpots.filter((e) => canHumanApply(game, { type: 'buildRoad', edge: e }))
    : roadSpots
  const allowedSettlementSpots = canHumanApply && game
    ? settlementSpots.filter((v) => canHumanApply(game, { type: 'buildSettlement', vertex: v }))
    : settlementSpots
  const allowedCitySpots = canHumanApply && game
    ? citySpots.filter((v) => canHumanApply(game, { type: 'buildCity', vertex: v }))
    : citySpots

  const canRoad = Boolean(
    me && humanActing && inMain && hasResources(me.resources, COSTS.road) && allowedRoadSpots.length > 0,
  )
  const canSettlement = Boolean(
    me && humanActing && inMain && hasResources(me.resources, COSTS.settlement) && allowedSettlementSpots.length > 0,
  )
  const canCity = Boolean(me && humanActing && inMain && hasResources(me.resources, COSTS.city) && allowedCitySpots.length > 0)
  const canBuyDev = Boolean(
    me &&
      humanActing &&
      inMain &&
      hasResources(me.resources, COSTS.devCard) &&
      game &&
      game.devDeck.length > 0 &&
      humanAllowed({ type: 'buyDevCard' }),
  )
  const canRoll = Boolean(humanActing && inPreRoll && humanAllowed({ type: 'rollDice' }))
  const canEndTurn = Boolean(humanActing && inMain && humanAllowed({ type: 'endTurn' }))

  const canTrade = useMemo(() => {
    if (!game || human < 0 || !humanActing || !inMain) return false
    if (!canHumanApply) return true
    const p = game.players[human]
    for (const give of RESOURCES) {
      const rate = maritimeRate(game, human, give)
      if (p.resources[give] < rate) continue
      for (const get of RESOURCES) {
        if (get === give || game.bank[get] === 0) continue
        if (canHumanApply(game, { type: 'maritimeTrade', give, get })) return true
      }
    }
    return false
  }, [game, human, humanActing, inMain, canHumanApply])

  const playableCards = useMemo(() => {
    if (!game || human < 0) return []
    const rawPlayable = humanActing ? playableDevCards(game, human) : []
    if (!canHumanApply) return rawPlayable
    return rawPlayable.filter((card) => {
      if (card === 'yearOfPlenty') {
        return RESOURCES.some((a) =>
          RESOURCES.some(
            (b) =>
              validateAction(game, { type: 'playYearOfPlenty', resources: [a, b] }) === null &&
              canHumanApply(game, { type: 'playYearOfPlenty', resources: [a, b] }),
          ),
        )
      }
      return canHumanApply(game, cardAction(card))
    })
  }, [game, human, humanActing, canHumanApply])

  const canPlayCard = playableCards.length > 0

  const reasonMessages = useMemo(
    () => ({
      needResources: t.catan.actionBar.needResources,
      noSpot: t.catan.actionBar.noSpot,
      noPieces: t.catan.actionBar.noPieces,
      deckEmpty: t.catan.actionBar.deckEmpty,
      rollFirst: t.catan.actionBar.rollFirst,
      resourceNames: t.catan.resources,
    }),
    [t],
  )

  const blockReasons = useMemo(() => {
    if (!game || human < 0 || !me || !humanActing) return null
    if (!inMain && !inPreRoll) return null
    return {
      road: actionBlockReason(game, human, 'road'),
      settlement: actionBlockReason(game, human, 'settlement'),
      city: actionBlockReason(game, human, 'city'),
      devCard: actionBlockReason(game, human, 'devCard'),
    }
  }, [game, human, me, humanActing, inMain, inPreRoll])

  const roadReason = blockReasons?.road ?? null
  const settlementReason = blockReasons?.settlement ?? null
  const cityReason = blockReasons?.city ?? null
  const devReason = blockReasons?.devCard ?? null
  const roadReasonText = roadReason ? formatActionBlockReason(roadReason, reasonMessages) : null
  const settlementReasonText = settlementReason ? formatActionBlockReason(settlementReason, reasonMessages) : null
  const cityReasonText = cityReason ? formatActionBlockReason(cityReason, reasonMessages) : null
  const devReasonText = devReason ? formatActionBlockReason(devReason, reasonMessages) : null

  const describeVertex = useCallback(
    (vertex: number): string | null => {
      if (!game || human < 0) return null
      const setupInfo = game.phase.kind === 'setup' && game.phase.step === 'settlement'
      const buildInfo = game.phase.kind === 'main' && buildMode === 'settlement'
      if (!setupInfo && !buildInfo) return null
      return vertexDescription(game, vertex, {
        pips: t.catan.vertexInfo.pips,
        pipSingular: t.catan.vertexInfo.pipSingular,
        pipPlural: t.catan.vertexInfo.pipPlural,
        harbourAny: t.catan.vertexInfo.harbourAny,
        harbourResource: t.catan.vertexInfo.harbourResource,
        robberSuffix: t.catan.vertexInfo.robberSuffix,
        terrain: t.catan.board.terrain,
      })
    },
    [game, human, buildMode, t],
  )

  const describeHoverTarget = useCallback(
    (target: HoverTarget): string | null => (game ? describeHover(game, target, t) : null),
    [game, t],
  )

  const canSkip = Boolean(
    game && !pauseBots && dialog === null && playersToAct(game).some((p) => game.players[p].isBot),
  )

  const setBotSpeed = useCallback((speed: BotSpeed) => updatePrefs({ botSpeed: speed }), [updatePrefs])
  const setTooltips = useCallback((enabled: boolean) => updatePrefs({ tooltips: enabled }), [updatePrefs])
  const setShowBoardKey = useCallback((shown: boolean) => updatePrefs({ showBoardKey: shown }), [updatePrefs])

  return {
    mounted,
    game,
    showNewGame,
    setShowNewGame,
    dialog,
    setDialog,
    buildMode,
    setBuildMode,
    status,
    setStatus,
    resetKey,
    setResetKey,
    botStalled,
    prefs,
    botSpeed: prefs.botSpeed,
    setBotSpeed,
    tooltips: prefs.tooltips,
    setTooltips,
    showBoardKey: prefs.showBoardKey,
    setShowBoardKey,
    logRef,
    apply,
    replaceGame,
    startNewGame,
    startNewFromGameOver,
    skipToMyTurn,
    human,
    actors,
    humanActing,
    humanSteal,
    humanDiscard,
    mustAnswer,
    modalOpen,
    pauseBots,
    humanAllowed,
    targets,
    lastPlaced,
    statusText,
    me,
    inMain,
    inPreRoll,
    roadSpots: allowedRoadSpots,
    settlementSpots: allowedSettlementSpots,
    citySpots: allowedCitySpots,
    canRoad,
    canSettlement,
    canCity,
    canBuyDev,
    canRoll,
    canTrade,
    canEndTurn,
    playableCards,
    canPlayCard,
    roadReasonText,
    settlementReasonText,
    cityReasonText,
    devReasonText,
    describeVertex,
    describeHoverTarget,
    canSkip,
  }
}

export type CatanController = ReturnType<typeof useCatanController>

export function humanResourceTotals(state: GameState, player: PlayerId): number {
  return totalCards(state.players[player].resources)
}

export function humanVictoryPoints(state: GameState, player: PlayerId, includeHidden = true): number {
  return victoryPoints(state, player, includeHidden)
}

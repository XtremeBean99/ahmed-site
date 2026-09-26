'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { humanPlayer, playersToAct } from '@/lib/games/catan/engine'
import type { Action, GameState } from '@/lib/games/catan/types'
import { formatActionBlockReason } from './action-reasons'
import type { BuildMode } from './ActionBar'
import { describeHover, type HoverTarget } from './hover-info'
import { useCatanLayout } from './layout'
import {
  isTradePendingForHuman,
  selectBlockReasons,
  selectBoardTargets,
  selectCanFlags,
  selectLastPlaced,
  selectStatus,
} from './selectors'
import { useBotLoop } from './useBotLoop'
import { useCatanGame } from './useCatanGame'
import { vertexDescription } from './vertex-info'

export type CatanDialog = 'trade' | 'playCard' | 'rules' | null

export interface CatanControllerOptions {
  /** 'game' uses the versioned normal save; 'tutorial' uses the tutorial's own key. */
  mode?: 'game' | 'tutorial'
  /** When provided, start from this state instead of loading a save (tutorial mode). */
  initialState?: GameState | null
  /** Tutorial filter: disallowed human actions hide board targets and disable buttons. */
  canHumanApply?: (state: GameState, action: Action) => boolean
  /** When true, bot timers never run (a tutorial step is waiting for the human). */
  botsPaused?: boolean
  /** Replaces the computed status line while set. */
  statusOverride?: string | null
  /** When false the undo stack never grows and undo() is a no-op (tutorial mode). */
  undoEnabled?: boolean
}

export function useCatanController(options: CatanControllerOptions = {}) {
  const t = useT()
  const core = useCatanGame({
    mode: options.mode ?? 'game',
    initialState: options.initialState,
    undoEnabled: options.undoEnabled ?? true,
  })
  const canHumanApply = options.canHumanApply
  const botsPaused = options.botsPaused ?? false
  const statusOverride = options.statusOverride

  const [dialog, setDialog] = useState<CatanDialog>(null)
  const [buildMode, setBuildMode] = useState<BuildMode>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [botStalled, setBotStalled] = useState(false)

  const game = core.game
  const human = game ? humanPlayer(game) : -1
  const actors = game ? playersToAct(game) : []
  const humanActing = game !== null && human >= 0 && actors.includes(human)
  const humanSteal = game !== null && human >= 0 && game.phase.kind === 'steal' && game.current === human
  const humanDiscard =
    game !== null && human >= 0 && game.phase.kind === 'discard' && game.phase.discards[human] > 0
  const tradePending = game !== null && human >= 0 && isTradePendingForHuman(game, human)
  // The trade panel does not pause the bots: they only act then to answer the human's own offer.
  const mustAnswer = core.showNewGame || dialog === 'playCard' || humanSteal || humanDiscard || tradePending
  const modalOpen = core.showNewGame || dialog !== null || humanSteal || humanDiscard || game?.phase.kind === 'gameOver'
  const pauseBots = !game || mustAnswer || botStalled || botsPaused

  const applyCore = core.apply
  const replaceGame = core.replaceGame

  const apply = useCallback(
    (action: Action): boolean => {
      const result = applyCore(action)
      if (result.ok) {
        setStatus(null)
        setBotStalled(false)
        return true
      }
      setStatus(result.error)
      return false
    },
    [applyCore],
  )

  const onStalled = useCallback(() => {
    setStatus(t.catan.status.botStalled)
    setBotStalled(true)
  }, [t])

  const onSkip = useCallback(
    (state: GameState) => {
      replaceGame(state)
      setBotStalled(false)
    },
    [replaceGame],
  )

  const botLoop = useBotLoop({
    game,
    human,
    botSpeed: core.prefs.botSpeed,
    animations: core.prefs.animations,
    paused: pauseBots,
    stalled: botStalled,
    apply,
    onStalled,
    onSkip,
  })

  const targets = useMemo(
    () => selectBoardTargets(game, human, buildMode, canHumanApply),
    [game, human, buildMode, canHumanApply],
  )
  const flags = useMemo(() => selectCanFlags(game, human, canHumanApply), [game, human, canHumanApply])
  const lastPlaced = useMemo(() => selectLastPlaced(game), [game])
  const blockReasons = useMemo(() => selectBlockReasons(game, human, humanActing), [game, human, humanActing])

  const { coarse } = useCatanLayout()
  const statusMessages = useMemo(
    () => ({
      newGame: t.catan.newGame,
      setupSettlement: t.catan.status.setupSettlement,
      setupRoad: t.catan.status.setupRoad,
      preRoll: t.catan.status.preRoll,
      main: t.catan.status.main,
      roadBuilding: t.catan.status.roadBuilding,
      moveRobber: t.catan.status.moveRobber,
      steal: t.catan.status.steal,
      discard: t.catan.status.discard,
      gameOver: t.catan.status.gameOver,
      gameOverYou: t.catan.status.gameOverYou,
      buildMode: coarse ? t.catan.layout.buildModeStatusTouch : t.catan.layout.buildModeStatus,
    }),
    [t, coarse],
  )

  const statusInfo = useMemo(
    () => selectStatus(game, human, status, statusOverride, buildMode, statusMessages),
    [game, human, status, statusOverride, buildMode, statusMessages],
  )

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

  const roadReasonText = blockReasons?.road ? formatActionBlockReason(blockReasons.road, reasonMessages) : null
  const settlementReasonText = blockReasons?.settlement
    ? formatActionBlockReason(blockReasons.settlement, reasonMessages)
    : null
  const cityReasonText = blockReasons?.city ? formatActionBlockReason(blockReasons.city, reasonMessages) : null
  const devReasonText = blockReasons?.devCard ? formatActionBlockReason(blockReasons.devCard, reasonMessages) : null

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

  useEffect(() => {
    if (!game || game.phase.kind === 'main') return
    setBuildMode(null)
  }, [game])

  return {
    mounted: core.mounted,
    game,
    showNewGame: core.showNewGame,
    setShowNewGame: core.setShowNewGame,
    dialog,
    setDialog,
    buildMode,
    setBuildMode,
    status,
    setStatus,
    resetKey: core.resetKey,
    setResetKey: core.setResetKey,
    prefs: core.prefs,
    updatePrefs: core.updatePrefs,
    apply,
    replaceGame: core.replaceGame,
    startNewGame: core.startNewGame,
    startNewFromGameOver: core.startNewFromGameOver,
    skipToMyTurn: botLoop.skipToMyTurn,
    human,
    actors,
    humanActing,
    humanSteal,
    humanDiscard,
    tradePending,
    mustAnswer,
    modalOpen,
    pauseBots,
    botStalled,
    targets,
    lastPlaced,
    statusText: statusInfo.text,
    statusPlayer: statusInfo.player,
    statusMustAct: statusInfo.mustAct,
    me: game && human >= 0 ? game.players[human] : null,
    inMain: game?.phase.kind === 'main',
    inPreRoll: game?.phase.kind === 'preRoll',
    canRoll: flags.canRoll,
    canRoad: flags.canRoad,
    canSettlement: flags.canSettlement,
    canCity: flags.canCity,
    canBuyDev: flags.canBuyDev,
    canTrade: flags.canTrade,
    canEndTurn: flags.canEndTurn,
    playableCards: flags.playableCards,
    canPlayCard: flags.canPlayCard,
    roadReasonText,
    settlementReasonText,
    cityReasonText,
    devReasonText,
    describeVertex,
    describeHoverTarget,
    canSkip,
    canUndo: core.canUndo,
    undo: core.undo,
  }
}

export type CatanController = ReturnType<typeof useCatanController>

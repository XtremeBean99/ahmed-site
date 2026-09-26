'use client'

import { Component, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useReducedMotion } from 'framer-motion'
import { useT } from '@/lib/i18n/client'
import { applyAction } from '@/lib/games/catan/engine'
import { clearGame, saveKeyFor, saveSchemaV2 } from '@/lib/games/catan/save'
import {
  applyStepPrepare,
  createTutorialGame,
  isStepComplete,
  isTutorialActionLegal,
  parseTutorialProgress,
  serializeTutorialProgress,
  TUTORIAL_PROGRESS_KEY,
  TUTORIAL_STEPS,
  tutorialSheetFor,
} from '@/lib/games/catan/tutorial'
import type { TutorialProgress } from '@/lib/games/catan/tutorial'
import type { Action, GameState, Player } from '@/lib/games/catan/types'
import { BOARD_WIDTH, edgePoint, hexCenter, vertexPoint } from './board-layout'
import { BoardCanvas } from './BoardCanvas'
import { ActionBar } from './ActionBar'
import { BoardLegend } from './BoardLegend'
import { DevCardsPanel } from './DevCardsPanel'
import { DiceViewer } from './DiceViewer'
import { DiscardDialog } from './DiscardDialog'
import { EffectsLayer, type BoardOverrides, type BoardView } from './effects/EffectsLayer'
import { GameLog } from './GameLog'
import { HandPanel } from './HandPanel'
import { describeHint } from './hint'
import { useCatanLayout } from './layout'
import { BankStrip } from './layout/BankStrip'
import { BottomSheet } from './layout/BottomSheet'
import { BuildGrid } from './layout/BuildGrid'
import { OPPONENT_STRIP_HEIGHT, OPPONENT_STRIP_STACK_HEIGHT, wideColumnWidths } from './layout/layout-math'
import { LogDrawer } from './layout/LogDrawer'
import { OpponentStrip } from './layout/OpponentStrip'
import { ShortcutsOverlay } from './layout/ShortcutsOverlay'
import { StackActionBar } from './layout/StackActionBar'
import { YourPanel } from './layout/YourPanel'
import { NewGameDialog } from './NewGameDialog'
import { type PlayableDevCard, PlayCardDialog } from './PlayCardDialog'
import { PlayersPanel } from './PlayersPanel'
import { ResultsScreen } from './results/ResultsScreen'
import { RulesPanel } from './RulesPanel'
import { SettingsMenu } from './SettingsMenu'
import { StealDialog } from './StealDialog'
import { Tooltip, TooltipsProvider } from './Tooltip'
import { StackTopBar, TopBar } from './TopBar'
import { IncomingOffer } from './trade/IncomingOffer'
import { TradePanel } from './trade/TradePanel'
import { TutorialCoach, TutorialSpotlight } from './TutorialCoach'
import type { TutorialCoachPlacement } from './TutorialCoach'
import type { TutorialHighlight } from '@/lib/games/catan/tutorial'
import { useCatanSound } from './sound'
import { COLORS, FOCUS_CLASS, PIXEL_FONT, PixelButton } from './ui'
import { useCatanController } from './useCatanController'
import { useEventAnnouncer } from './useEventAnnouncer'
import { useShortcuts } from './useShortcuts'

type CatanMode = 'normal' | 'tutorial'
type StackSheet = 'build' | 'cards' | 'log' | 'menu' | null

interface CatanErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
  resetKey: number
  onError: () => void
}

interface CatanErrorBoundaryState {
  hasError: boolean
}

class CatanErrorBoundary extends Component<CatanErrorBoundaryProps, CatanErrorBoundaryState> {
  state: CatanErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): CatanErrorBoundaryState {
    return { hasError: true }
  }

  componentDidUpdate(prevProps: CatanErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  componentDidCatch(error: unknown) {
    console.error('Catan game failed to render', error)
    this.props.onError()
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

function HintBoardHighlight({
  highlight,
  wrapperRef,
}: {
  highlight: TutorialHighlight
  wrapperRef: RefObject<HTMLDivElement | null>
}) {
  const [marks, setMarks] = useState<{ left: number; top: number }[]>([])

  useLayoutEffect(() => {
    const measure = () => {
      const wrapper = wrapperRef.current
      const canvas = wrapper?.querySelector('canvas')
      if (!wrapper || !canvas) return
      const wrapperRect = wrapper.getBoundingClientRect()
      const canvasRect = canvas.getBoundingClientRect()
      if (canvasRect.width === 0 || canvasRect.height === 0) return
      const scale = canvasRect.width / BOARD_WIDTH
      const offsetX = canvasRect.left - wrapperRect.left
      const offsetY = canvasRect.top - wrapperRect.top
      const points: { x: number; y: number }[] = []
      for (const vertex of highlight.vertices ?? []) points.push(vertexPoint(vertex))
      for (const edge of highlight.edges ?? []) points.push(edgePoint(edge))
      for (const hex of highlight.hexes ?? []) points.push(hexCenter(hex))
      setMarks(points.map((p) => ({ left: offsetX + p.x * scale, top: offsetY + p.y * scale })))
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [highlight, wrapperRef])

  return (
    <>
      {marks.map((mark, i) => (
        <div
          key={i}
          aria-hidden
          style={{
            position: 'absolute',
            left: mark.left,
            top: mark.top,
            width: 16,
            height: 16,
            transform: 'translate(-50%, -50%)',
            border: '2px solid rgba(245, 184, 61, 0.95)',
            backgroundColor: 'rgba(245, 184, 61, 0.25)',
            boxShadow: '0 0 0 1px #1a1410',
            pointerEvents: 'none',
            zIndex: 25,
          }}
        />
      ))}
    </>
  )
}

function removeTutorialSave(): void {
  try {
    window.localStorage.removeItem(saveKeyFor('tutorial'))
    window.localStorage.removeItem(TUTORIAL_PROGRESS_KEY)
  } catch {
    // ignore storage failures
  }
}

function hasTutorialSave(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(saveKeyFor('tutorial')) !== null
  } catch {
    return false
  }
}

function readTutorialState(): GameState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(saveKeyFor('tutorial'))
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    const result = saveSchemaV2.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

function readTutorialProgress(): TutorialProgress | null {
  if (typeof window === 'undefined') return null
  try {
    return parseTutorialProgress(window.localStorage.getItem(TUTORIAL_PROGRESS_KEY))
  } catch {
    return null
  }
}

function writeTutorialProgress(progress: TutorialProgress): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(TUTORIAL_PROGRESS_KEY, serializeTutorialProgress(progress))
  } catch {
    // ignore quota / privacy-mode failures
  }
}

export function CatanGame() {
  const [mode, setMode] = useState<CatanMode>(() => (hasTutorialSave() ? 'tutorial' : 'normal'))
  const [session, setSession] = useState(0)

  const startTutorial = useCallback(() => {
    removeTutorialSave()
    setMode('tutorial')
    setSession((s) => s + 1)
  }, [])

  const exitTutorial = useCallback(() => {
    // Only the tutorial's own keys are removed; the normal game save survives.
    removeTutorialSave()
    setMode('normal')
    setSession((s) => s + 1)
  }, [])

  return <CatanGameSession key={session} mode={mode} onStartTutorial={startTutorial} onExitTutorial={exitTutorial} />
}

function CatanGameSession({
  mode,
  onStartTutorial,
  onExitTutorial,
}: {
  mode: CatanMode
  onStartTutorial: () => void
  onExitTutorial: () => void
}) {
  const t = useT()
  const router = useRouter()
  const { layout } = useCatanLayout()
  const reduceMotion = useReducedMotion()
  const tutorialActive = mode === 'tutorial'
  const [tutorialResume] = useState<TutorialProgress | null>(() => (tutorialActive ? readTutorialProgress() : null))
  const [stepIndex, setStepIndex] = useState(() => tutorialResume?.step ?? 0)
  const [tutorialFinished, setTutorialFinished] = useState(() => tutorialResume?.finished ?? false)
  const [hintVisible, setHintVisible] = useState(false)
  const [playPreselect, setPlayPreselect] = useState<PlayableDevCard | null>(null)
  const [sheet, setSheet] = useState<StackSheet>(null)
  const [keyOpen, setKeyOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [logDrawerOpen, setLogDrawerOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const preparedRef = useRef(false)
  const boardWrapRef = useRef<HTMLDivElement | null>(null)
  const boardAreaRef = useRef<HTMLDivElement | null>(null)
  const boardViewRef = useRef<BoardView | null>(null)
  const [boardOverrides, setBoardOverrides] = useState<BoardOverrides>({
    highlightHexes: [],
    robberHex: undefined,
    hiddenPieces: { vertices: [], edges: [] },
  })

  const step = TUTORIAL_STEPS[stepIndex]
  const tutorialInitial = useMemo(() => {
    if (!tutorialActive) return null
    return readTutorialState() ?? createTutorialGame()
  }, [tutorialActive])

  const canHumanApply = useCallback(
    (state: GameState, action: Action): boolean => {
      if (!tutorialActive || tutorialFinished) return true
      return isTutorialActionLegal(state, TUTORIAL_STEPS[stepIndex], action)
    },
    [tutorialActive, tutorialFinished, stepIndex],
  )

  const c = useCatanController({
    mode: tutorialActive ? 'tutorial' : 'game',
    initialState: tutorialInitial,
    canHumanApply: tutorialActive ? canHumanApply : undefined,
    botsPaused: tutorialActive && !tutorialFinished && step.completeWhen === 'next',
    statusOverride: tutorialActive && !tutorialFinished ? t.catan.tutorial.steps[step.id].title : null,
    undoEnabled: !tutorialActive,
  })

  const sound = useCatanSound(c.prefs.sound, c.prefs.volume)
  const animations = c.prefs.animations && !reduceMotion
  const announcement = useEventAnnouncer(c.game, t)
  const gameRef = useRef<GameState | null>(null)
  gameRef.current = c.game

  // A dialog, or a trade offer waiting on your answer, replaces any open sheet, drawer or menu:
  // stacked layers hid the dialog and fought over focus. Hiding them in the same render also
  // un-inerts the board, so the offer banner can take focus.
  const interrupted = c.modalOpen || c.tradePending
  useEffect(() => {
    if (!interrupted) return
    setSheet(null)
    setLogDrawerOpen(false)
    setKeyOpen(false)
    setMenuOpen(false)
  }, [interrupted])
  const openSheet = interrupted ? null : sheet
  const drawerOpen = logDrawerOpen && !interrupted

  useEffect(() => {
    preparedRef.current = false
  }, [stepIndex, tutorialActive, tutorialFinished])

  useEffect(() => {
    if (!tutorialActive) return
    writeTutorialProgress({ step: stepIndex, finished: tutorialFinished })
  }, [tutorialActive, stepIndex, tutorialFinished])

  const tutorialSheet = useMemo(() => {
    if (!tutorialActive || tutorialFinished || layout !== 'stack') return null
    if (!c.humanActing) return null
    for (const id of step.highlight.ui ?? []) {
      const sheetFor = tutorialSheetFor(id)
      if (sheetFor) return sheetFor
    }
    return null
  }, [tutorialActive, tutorialFinished, layout, step, c.humanActing])

  const autoSheetRef = useRef<StackSheet>(null)
  useEffect(() => {
    const desired = tutorialSheet as StackSheet | null
    const previous = autoSheetRef.current
    if (desired === previous) return
    autoSheetRef.current = desired
    if (desired !== null) {
      setSheet(desired)
    } else if (previous !== null) {
      setSheet((current) => (current === previous ? null : current))
    }
  }, [tutorialSheet])

  const hint = useMemo(() => {
    if ((tutorialActive && !tutorialFinished) || !c.game || c.human < 0) return null
    return describeHint(c.game, c.human)
  }, [tutorialActive, tutorialFinished, c.game, c.human])

  const applyHuman = (action: Action): boolean => {
    let before = gameRef.current
    if (!before) return false
    if (tutorialActive && !tutorialFinished) {
      const currentStep = TUTORIAL_STEPS[stepIndex]
      if (!isTutorialActionLegal(before, currentStep, action)) {
        c.setStatus(t.catan.tutorial.notAllowed)
        return false
      }
      if (currentStep.prepare && !preparedRef.current) {
        before = applyStepPrepare(before, currentStep)
        c.replaceGame(before)
        preparedRef.current = true
      }
    }
    const ok = c.apply(action)
    if (ok && tutorialActive && !tutorialFinished) {
      const currentStep = TUTORIAL_STEPS[stepIndex]
      const after = applyAction(before, action)
      if (isStepComplete(currentStep, before, after, action)) {
        setStepIndex((i) => Math.min(i + 1, TUTORIAL_STEPS.length - 1))
      }
    }
    return ok
  }

  const openPlayCard = (card: PlayableDevCard | null) => {
    setPlayPreselect(card)
    setSheet(null)
    c.setDialog('playCard')
  }

  const rematch = () => {
    if (!c.game || !c.me) return
    const bot = c.game.players.find((p) => p.isBot)
    c.startNewGame({
      playerCount: c.game.players.length === 4 ? 4 : 3,
      name: c.me.name,
      color: c.me.color,
      botLevel: bot?.level ?? 'normal',
      settings: c.game.settings,
    })
  }

  const activeHint = hintVisible ? hint : null

  const canGoBack =
    stepIndex > 0 && step.completeWhen === 'next' && TUTORIAL_STEPS[stepIndex - 1].completeWhen === 'next'

  const handleCoachNext = () => {
    if (stepIndex >= TUTORIAL_STEPS.length - 1) {
      const current = gameRef.current
      if (current) c.replaceGame(applyStepPrepare(current, TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1]))
      setTutorialFinished(true)
    } else {
      setStepIndex((i) => i + 1)
    }
  }

  const coachPlacement: TutorialCoachPlacement =
    layout === 'stack' ? (openSheet !== null && openSheet === tutorialSheet ? 'sheet' : 'dock') : 'board'

  const coach =
    tutorialActive && !tutorialFinished && c.game ? (
      <TutorialCoach
        step={step}
        stepIndex={stepIndex}
        totalSteps={TUTORIAL_STEPS.length}
        canGoBack={canGoBack}
        isLast={stepIndex === TUTORIAL_STEPS.length - 1}
        canAdvance={step.completeWhen === 'next'}
        placement={coachPlacement}
        boardRef={boardAreaRef}
        refreshKey={`${stepIndex}:${sheet ?? 'none'}:${c.game.phase.kind}:${layout}`}
        onNext={handleCoachNext}
        onBack={() => setStepIndex((i) => Math.max(i - 1, 0))}
        onExit={onExitTutorial}
      />
    ) : null

  const buildMode = c.buildMode
  const cancelOverlay = useCallback(() => {
    if (buildMode) c.setBuildMode(null)
    else if (sheet) setSheet(null)
    else if (keyOpen) setKeyOpen(false)
    else if (menuOpen) setMenuOpen(false)
    else if (logDrawerOpen) setLogDrawerOpen(false)
  }, [buildMode, c, sheet, keyOpen, menuOpen, logDrawerOpen])

  const dialogOpen = c.modalOpen || sheet !== null || keyOpen || menuOpen || logDrawerOpen || helpOpen

  useShortcuts({
    enabled: c.game !== null,
    dialogOpen,
    flags: {
      roll: c.canRoll,
      endTurn: c.canEndTurn,
      road: c.canRoad,
      settlement: c.canSettlement,
      city: c.canCity,
      buyDev: c.canBuyDev,
      trade: c.canTrade,
      playCard: c.canPlayCard,
      undo: c.canUndo,
      hint: !(tutorialActive && !tutorialFinished),
      log: layout !== 'wide',
    },
    handlers: {
      roll: () => applyHuman({ type: 'rollDice' }),
      endTurn: () => applyHuman({ type: 'endTurn' }),
      toggleRoad: () => c.setBuildMode(c.buildMode === 'road' ? null : 'road'),
      toggleSettlement: () => c.setBuildMode(c.buildMode === 'settlement' ? null : 'settlement'),
      toggleCity: () => c.setBuildMode(c.buildMode === 'city' ? null : 'city'),
      buyDev: () => applyHuman({ type: 'buyDevCard' }),
      trade: () => c.setDialog('trade'),
      playCard: () => openPlayCard(null),
      undo: () => {
        if (c.undo()) setHintVisible(false)
      },
      hint: () => setHintVisible((v) => !v),
      log: () => {
        if (layout === 'medium') setLogDrawerOpen(true)
        else if (layout === 'stack') setSheet('log')
      },
      cancel: cancelOverlay,
      help: () => setHelpOpen(true),
    },
    viewRef: boardViewRef,
  })

  const dialogState = c.game

  const onVertex = (v: number) => {
    if (!c.humanActing || !c.game) return
    const phase = c.game.phase
    if (phase.kind === 'setup' && phase.step === 'settlement') {
      applyHuman({ type: 'placeSetupSettlement', vertex: v })
    } else if (phase.kind === 'main') {
      if (c.buildMode === 'settlement' && applyHuman({ type: 'buildSettlement', vertex: v })) c.setBuildMode(null)
      else if (c.buildMode === 'city' && applyHuman({ type: 'buildCity', vertex: v })) c.setBuildMode(null)
    }
  }

  const onEdge = (e: number) => {
    if (!c.humanActing || !c.game) return
    const phase = c.game.phase
    if (phase.kind === 'setup' && phase.step === 'road') {
      applyHuman({ type: 'placeSetupRoad', edge: e })
    } else if (phase.kind === 'roadBuilding') {
      applyHuman({ type: 'buildRoad', edge: e })
    } else if (phase.kind === 'main' && c.buildMode === 'road') {
      if (applyHuman({ type: 'buildRoad', edge: e })) c.setBuildMode(null)
    }
  }

  const onHex = (h: number) => {
    if (!c.humanActing || !c.game) return
    if (c.game.phase.kind === 'moveRobber') applyHuman({ type: 'moveRobber', hex: h })
  }

  const boardArea = (
    <main ref={boardAreaRef} style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
      {c.game ? (
        <div ref={boardWrapRef} data-tutorial="board" style={{ position: 'absolute', inset: 0 }}>
          <BoardCanvas
            state={c.game}
            targets={c.targets}
            lastPlaced={c.lastPlaced}
            labels={t.catan.board}
            describeVertex={c.describeVertex}
            describeHover={c.describeHoverTarget}
            onVertex={onVertex}
            onEdge={onEdge}
            onHex={onHex}
            viewRef={boardViewRef}
            highlightHexes={boardOverrides.highlightHexes}
            robberHex={boardOverrides.robberHex}
            hiddenPieces={boardOverrides.hiddenPieces}
            animate={animations}
          />
          {activeHint ? <HintBoardHighlight highlight={activeHint.highlight} wrapperRef={boardWrapRef} /> : null}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <PixelButton variant="primary" onClick={() => c.setShowNewGame(true)}>
            {t.catan.newGame}
          </PixelButton>
        </div>
      )}
      {c.game ? <IncomingOffer game={c.game} human={c.human} apply={applyHuman} /> : null}
      {c.canSkip ? (
        <Tooltip content={t.catan.tooltips.skip}>
          <PixelButton
            data-tutorial="skip"
            onClick={c.skipToMyTurn}
            style={{ position: 'absolute', top: 8, right: 8, zIndex: 20, boxShadow: `2px 2px 0 ${COLORS.panelDark}` }}
          >
            {t.catan.skip}
          </PixelButton>
        </Tooltip>
      ) : null}
      {layout !== 'stack' ? coach : null}
    </main>
  )

  const { left: leftW, right: rightW } = wideColumnWidths(
    typeof window === 'undefined' ? 1408 : window.innerWidth,
  )

  const rightColumn =
    layout === 'wide' || layout === 'medium' ? (
      <aside
        style={{
          width: layout === 'medium' ? 280 : rightW,
          minWidth: layout === 'medium' ? 280 : rightW,
          borderLeft: `2px solid ${COLORS.panelBorder}`,
          backgroundColor: COLORS.bg,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {c.game && c.me ? (
          <>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              <DiceViewer
                state={c.game}
                inPreRoll={c.inPreRoll}
                humanActing={c.humanActing}
                canRoll={c.canRoll}
                onRoll={() => applyHuman({ type: 'rollDice' })}
              />
              <YourPanel state={c.game} human={c.human} />
              <HandPanel state={c.game} human={c.human} />
              <DevCardsPanel state={c.game} human={c.human} onPlayCard={openPlayCard} />
              <div style={{ padding: 8, borderTop: `2px solid ${COLORS.panelBorder}` }}>
                <BuildGrid
                  state={c.game}
                  human={c.human}
                  buildMode={c.buildMode}
                  onBuildModeChange={c.setBuildMode}
                  canRoad={c.canRoad}
                  canSettlement={c.canSettlement}
                  canCity={c.canCity}
                  canBuyDev={c.canBuyDev}
                  roadReasonText={c.roadReasonText}
                  settlementReasonText={c.settlementReasonText}
                  cityReasonText={c.cityReasonText}
                  devReasonText={c.devReasonText}
                  onBuyDev={() => applyHuman({ type: 'buyDevCard' })}
                />
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              <ActionBar
                canTrade={c.canTrade}
                canEndTurn={c.canEndTurn}
                canUndo={c.canUndo}
                onTrade={() => c.setDialog('trade')}
                onEndTurn={() => applyHuman({ type: 'endTurn' })}
                onUndo={() => {
                  if (c.undo()) setHintVisible(false)
                }}
                hintVisible={hintVisible}
                hintText={activeHint?.text ?? null}
                onHint={tutorialActive && !tutorialFinished ? undefined : () => setHintVisible((v) => !v)}
              />
            </div>
          </>
        ) : null}
      </aside>
    ) : null

  const leftColumn = layout === 'wide' ? (
    <aside
      style={{
        width: leftW,
        minWidth: leftW,
        borderRight: `2px solid ${COLORS.panelBorder}`,
        backgroundColor: COLORS.bg,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {c.game ? (
        <>
          <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <PlayersPanel state={c.game} human={c.human} paused={c.pauseBots} />
            <BankStrip state={c.game} />
          </div>
          <GameLog state={c.game} />
        </>
      ) : null}
    </aside>
  ) : null

  const opponentStrip =
    (layout === 'medium' || layout === 'stack') && c.game ? (
      <OpponentStrip
        state={c.game}
        human={c.human}
        height={layout === 'medium' ? OPPONENT_STRIP_HEIGHT : OPPONENT_STRIP_STACK_HEIGHT}
        paused={c.pauseBots}
      />
    ) : null

  let primaryLabel = c.statusText
  let primaryAction: (() => void) | null = null
  let canPrimary = false
  let primaryTutorialId: string | null = null
  if (c.game && c.humanActing) {
    if (c.inPreRoll) {
      primaryLabel = t.catan.actionBar.roll
      primaryAction = () => applyHuman({ type: 'rollDice' })
      canPrimary = c.canRoll
      primaryTutorialId = 'roll'
    } else if (c.inMain) {
      primaryLabel = t.catan.actionBar.endTurn
      primaryAction = () => applyHuman({ type: 'endTurn' })
      canPrimary = c.canEndTurn
      primaryTutorialId = 'end-turn'
    }
  }

  const buildSheetTitle = useId()
  const cardsSheetTitle = useId()
  const logSheetTitle = useId()
  const menuSheetTitle = useId()

  const statusPlayer: Player | null = c.game ? c.game.players[c.statusPlayer] ?? null : null

  if (!c.mounted) {
    return <div style={{ position: 'fixed', inset: 0, backgroundColor: COLORS.bg }} />
  }

  return (
    <TooltipsProvider enabled={c.prefs.tooltips}>
      <CatanErrorBoundary
        resetKey={c.resetKey}
        onError={() => {
          if (mode === 'normal') clearGame()
          else removeTutorialSave()
        }}
        fallback={
          <NewGameDialog
            initial={c.prefs.lastSetup}
            canCancel={false}
            onCancel={() => {}}
            onStart={(setup) => {
              c.startNewGame(setup)
              c.setResetKey((k) => k + 1)
            }}
          />
        }
      >
        <div
          style={{
            position: 'fixed',
            inset: 0,
            height: '100dvh',
            backgroundColor: COLORS.bg,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            paddingTop: 'env(safe-area-inset-top)',
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: 'env(safe-area-inset-right)',
          }}
        >
          <div
            inert={(c.modalOpen || openSheet !== null || drawerOpen) || undefined}
            style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            {layout === 'stack' ? (
              <StackTopBar
                statusText={c.statusText}
                statusPlayer={statusPlayer}
                statusMustAct={c.statusMustAct}
                dice={c.game?.dice ?? null}
                canRoll={c.canRoll}
                onRoll={() => applyHuman({ type: 'rollDice' })}
                canUndo={c.canUndo}
                onUndo={() => {
                  if (c.undo()) setHintVisible(false)
                }}
                onMenu={() => setSheet('menu')}
              />
            ) : (
              <TopBar
                turn={c.game?.turn ?? 0}
                statusText={c.statusText}
                statusPlayer={statusPlayer}
                statusMustAct={c.statusMustAct}
                canUndo={c.canUndo}
                hintVisible={hintVisible}
                layout={layout === 'wide' ? 'wide' : 'medium'}
                prefs={c.prefs}
                onPrefsChange={c.updatePrefs}
                onUndo={() => {
                  if (c.undo()) setHintVisible(false)
                }}
                onHint={tutorialActive && !tutorialFinished ? undefined : () => setHintVisible((v) => !v)}
                onRules={() => c.setDialog('rules')}
                onLog={() => setLogDrawerOpen(true)}
                keyOpen={keyOpen}
                onKeyToggle={() => setKeyOpen((v) => !v)}
                onKeyClose={() => setKeyOpen(false)}
                menuOpen={menuOpen}
                onMenuToggle={() => setMenuOpen((v) => !v)}
                onMenuClose={() => setMenuOpen(false)}
                onNewGame={tutorialActive ? onExitTutorial : () => c.setShowNewGame(true)}
              />
            )}
            {opponentStrip}
            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
              {leftColumn}
              {boardArea}
              {rightColumn}
            </div>
            {layout === 'stack' && coachPlacement === 'dock' ? coach : null}
            {layout === 'stack' && c.game && c.me ? <HandPanel state={c.game} human={c.human} variant="strip" /> : null}
            {layout === 'stack' && c.game ? (
              <StackActionBar
                primaryLabel={primaryLabel}
                primaryAction={primaryAction}
                canPrimary={canPrimary}
                primaryTutorialId={primaryTutorialId}
                onBuild={() => setSheet('build')}
                canTrade={c.canTrade}
                onTrade={() => c.setDialog('trade')}
                onCards={() => setSheet('cards')}
                onLog={() => setSheet('log')}
              />
            ) : null}
          </div>

          {c.game ? (
            <EffectsLayer
              game={c.game}
              human={c.human}
              boardViewRef={boardViewRef}
              animations={animations}
              sound={sound}
              onBoardOverrides={setBoardOverrides}
            />
          ) : null}

          {activeHint ? <TutorialSpotlight ids={activeHint.highlight.ui ?? []} /> : null}

          {c.showNewGame ? (
            <NewGameDialog
              initial={c.prefs.lastSetup}
              canCancel={c.game !== null}
              onCancel={() => c.setShowNewGame(false)}
              onStart={c.startNewGame}
              onTutorial={tutorialActive ? undefined : onStartTutorial}
            />
          ) : null}
          {c.dialog === 'trade' && dialogState ? (
            <TradePanel game={dialogState} human={c.human} apply={applyHuman} onClose={() => c.setDialog(null)} />
          ) : null}
          {c.dialog === 'playCard' && c.game ? (
            <PlayCardDialog
              state={c.game}
              human={c.human}
              preselect={playPreselect}
              onPlay={(action) => {
                if (applyHuman(action)) {
                  c.setDialog(null)
                  setPlayPreselect(null)
                }
              }}
              onClose={() => {
                c.setDialog(null)
                setPlayPreselect(null)
              }}
            />
          ) : null}
          {c.dialog === 'rules' ? <RulesPanel onClose={() => c.setDialog(null)} /> : null}
          {c.humanDiscard && c.game ? (
            <DiscardDialog
              state={dialogState ?? c.game}
              human={c.human}
              onConfirm={(resources) => {
                applyHuman({ type: 'discard', player: c.human, resources })
              }}
            />
          ) : null}
          {c.humanSteal && c.game ? (
            <StealDialog
              state={dialogState ?? c.game}
              onSteal={(victim) => {
                applyHuman({ type: 'steal', victim })
              }}
            />
          ) : null}
          {c.game?.phase.kind === 'gameOver' ? (
            <ResultsScreen
              game={c.game}
              human={c.human}
              onRematch={tutorialActive ? onExitTutorial : rematch}
              onNewGame={tutorialActive ? onExitTutorial : c.startNewFromGameOver}
              onBackToRoom={() => router.push('/')}
            />
          ) : null}

          {openSheet ? (
            <BottomSheet
              labelledBy={
                sheet === 'build'
                  ? buildSheetTitle
                  : sheet === 'cards'
                    ? cardsSheetTitle
                    : sheet === 'log'
                      ? logSheetTitle
                      : menuSheetTitle
              }
              onClose={() => setSheet(null)}
            >
              {coachPlacement === 'sheet' ? coach : null}
              {sheet === 'build' && c.game && c.me ? (
                <div>
                  <h2 id={buildSheetTitle} style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.text, margin: '0 0 8px' }}>
                    {t.catan.layout.sheetTitles.build}
                  </h2>
                  <BuildGrid
                    state={c.game}
                    human={c.human}
                    buildMode={c.buildMode}
                    onBuildModeChange={(mode) => {
                      c.setBuildMode(mode)
                      // The board is inert under the sheet, so choosing what to build closes it.
                      if (mode !== null) setSheet(null)
                    }}
                    canRoad={c.canRoad}
                    canSettlement={c.canSettlement}
                    canCity={c.canCity}
                    canBuyDev={c.canBuyDev}
                    roadReasonText={c.roadReasonText}
                    settlementReasonText={c.settlementReasonText}
                    cityReasonText={c.cityReasonText}
                    devReasonText={c.devReasonText}
                    onBuyDev={() => {
                      if (applyHuman({ type: 'buyDevCard' }) && tutorialActive && !tutorialFinished) setSheet(null)
                    }}
                  />
                </div>
              ) : null}
              {sheet === 'cards' && c.game && c.me ? (
                <DevCardsPanel state={c.game} human={c.human} onPlayCard={openPlayCard} titleId={cardsSheetTitle} />
              ) : null}
              {sheet === 'log' && c.game ? (
                <div style={{ display: 'flex', flexDirection: 'column', minHeight: '50dvh' }}>
                  <h2 id={logSheetTitle} style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.text, margin: '0 0 8px' }}>
                    {t.catan.layout.sheetTitles.log}
                  </h2>
                  <BankStrip state={c.game} />
                  <div style={{ flex: 1, minHeight: 0, marginTop: 8 }}>
                    <GameLog state={c.game} />
                  </div>
                </div>
              ) : null}
              {sheet === 'menu' ? (
                <div>
                  <h2 id={menuSheetTitle} style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.text, margin: '0 0 8px' }}>
                    {t.catan.layout.menu}
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <PixelButton onClick={tutorialActive ? onExitTutorial : () => c.setShowNewGame(true)} style={{ width: '100%' }}>
                      {t.catan.newGame}
                    </PixelButton>
                    <PixelButton onClick={() => c.setDialog('rules')} style={{ width: '100%' }}>
                      {t.catan.rules}
                    </PixelButton>
                    <div data-tutorial="settings">
                      <SettingsMenu prefs={c.prefs} onChange={c.updatePrefs} variant="inline" />
                    </div>
                    <div data-tutorial="legend" style={{ padding: 8, border: `2px solid ${COLORS.panelBorder}` }}>
                      <div style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.text, marginBottom: 6 }}>{t.catan.keyPanel.title}</div>
                      <BoardLegend labels={t.catan.key} />
                    </div>
                    <Link
                      href="/"
                      className={FOCUS_CLASS}
                      style={{
                        ...PIXEL_FONT,
                        fontSize: 10,
                        padding: '8px 10px',
                        backgroundColor: COLORS.panel,
                        border: `2px solid ${COLORS.panelBorder}`,
                        color: COLORS.text,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {t.catan.back}
                    </Link>
                  </div>
                </div>
              ) : null}
            </BottomSheet>
          ) : null}

          {drawerOpen && layout === 'medium' && c.game ? (
            <LogDrawer labelledBy={logSheetTitle} onClose={() => setLogDrawerOpen(false)}>
              <h2 id={logSheetTitle} style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.text, margin: '0 0 8px' }}>
                {t.catan.layout.sheetTitles.log}
              </h2>
              <BankStrip state={c.game} />
              <div style={{ flex: 1, minHeight: 0, marginTop: 8 }}>
                <GameLog state={c.game} />
              </div>
            </LogDrawer>
          ) : null}

          {helpOpen ? <ShortcutsOverlay onClose={() => setHelpOpen(false)} /> : null}

          <div
            aria-live="polite"
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
              whiteSpace: 'nowrap',
            }}
          >
            {announcement}
          </div>
        </div>
      </CatanErrorBoundary>
    </TooltipsProvider>
  )
}

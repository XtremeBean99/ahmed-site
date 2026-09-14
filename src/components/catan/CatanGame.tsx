'use client'

import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useT } from '@/lib/i18n/client'
import { MobileGate } from '@/components/room/MobileGate'
import { isMobileViewport } from '@/lib/room/useStageScale'
import { BoardCanvas } from '@/components/catan/BoardCanvas'
import { clearGame } from '@/lib/games/catan/save'
import { applyAction } from '@/lib/games/catan/engine'
import { applyStepPrepare, createTutorialGame, isStepComplete, isTutorialActionLegal, TUTORIAL_STEPS } from '@/lib/games/catan/tutorial'
import type { Action, GameState } from '@/lib/games/catan/types'
import { BOARD_WIDTH, edgePoint, hexCenter, vertexPoint } from './board-layout'
import { ActionBar } from './ActionBar'
import { BoardKeyPanel } from './BoardKeyPanel'
import { DevCardsPanel } from './DevCardsPanel'
import { DiceViewer } from './DiceViewer'
import { DiscardDialog } from './DiscardDialog'
import { fill } from './event-text'
import { GameLog } from './GameLog'
import { GameOverOverlay } from './GameOverOverlay'
import { HandPanel } from './HandPanel'
import { describeHint } from './hint'
import { NewGameDialog } from './NewGameDialog'
import { type PlayableDevCard, PlayCardDialog } from './PlayCardDialog'
import { PlayersPanel } from './PlayersPanel'
import { RulesPanel } from './RulesPanel'
import { StealDialog } from './StealDialog'
import { TooltipsProvider } from './Tooltip'
import { TopBar } from './TopBar'
import { TradeDialog } from './TradeDialog'
import { TutorialCoach, TutorialSpotlight } from './TutorialCoach'
import type { TutorialHighlight } from '@/lib/games/catan/tutorial'
import { COLORS, PIXEL_FONT, PixelButton } from './ui'
import { useCatanController } from './useCatanController'

const TUTORIAL_SAVE_KEY = 'catan-tutorial-v1'

type CatanMode = 'normal' | 'tutorial'

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

function StatusLine({ statusText, isError }: { statusText: string; isError: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-tutorial="status"
      style={{
        minHeight: 30,
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        borderTop: `2px solid ${COLORS.panelBorder}`,
      }}
    >
      <span style={{ ...PIXEL_FONT, fontSize: 10, color: isError ? COLORS.danger : COLORS.text }}>{statusText}</span>
    </div>
  )
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

export function CatanGame() {
  const [mode, setMode] = useState<CatanMode>('normal')
  const [session, setSession] = useState(0)

  const startTutorial = useCallback(() => {
    try {
      window.localStorage.removeItem(TUTORIAL_SAVE_KEY)
    } catch {
      // ignore storage failures
    }
    setMode('tutorial')
    setSession((s) => s + 1)
  }, [])

  const exitTutorial = useCallback(() => {
    clearGame()
    try {
      window.localStorage.removeItem(TUTORIAL_SAVE_KEY)
    } catch {
      // ignore storage failures
    }
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
  const tutorialActive = mode === 'tutorial'
  const [stepIndex, setStepIndex] = useState(0)
  const [tutorialFinished, setTutorialFinished] = useState(false)
  const [hintVisible, setHintVisible] = useState(false)
  const [playPreselect, setPlayPreselect] = useState<PlayableDevCard | null>(null)
  const preparedRef = useRef(false)
  const boardWrapRef = useRef<HTMLDivElement | null>(null)

  const step = TUTORIAL_STEPS[stepIndex]
  const tutorialInitial = useMemo(() => (tutorialActive ? createTutorialGame() : null), [tutorialActive])

  const canHumanApply = useCallback(
    (state: GameState, action: Action): boolean => {
      if (!tutorialActive || tutorialFinished) return true
      return isTutorialActionLegal(state, TUTORIAL_STEPS[stepIndex], action)
    },
    [tutorialActive, tutorialFinished, stepIndex],
  )

  const c = useCatanController({
    saveKey: tutorialActive ? TUTORIAL_SAVE_KEY : undefined,
    initialState: tutorialInitial,
    canHumanApply: tutorialActive ? canHumanApply : undefined,
    botsPaused: tutorialActive && !tutorialFinished && step.completeWhen === 'next',
    statusOverride: tutorialActive && !tutorialFinished ? step.title : null,
  })

  const gameRef = useRef<GameState | null>(null)
  gameRef.current = c.game

  useEffect(() => {
    preparedRef.current = false
  }, [stepIndex, tutorialActive, tutorialFinished])

  const hint = useMemo(() => {
    if ((tutorialActive && !tutorialFinished) || !c.game || c.human < 0) return null
    return describeHint(c.game, c.human)
  }, [tutorialActive, tutorialFinished, c.game, c.human])

  if (!c.mounted) {
    return <div style={{ position: 'fixed', inset: 0, backgroundColor: COLORS.bg }} />
  }
  if (isMobileViewport()) return <MobileGate />

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

  const lastEvents = c.game ? c.game.events.slice(-60) : []

  const openPlayCard = (card: PlayableDevCard | null) => {
    setPlayPreselect(card)
    c.setDialog('playCard')
  }

  const activeHint = hintVisible ? hint : null

  const canGoBack =
    stepIndex > 0 &&
    step.completeWhen === 'next' &&
    TUTORIAL_STEPS[stepIndex - 1].completeWhen === 'next'

  const handleCoachNext = () => {
    if (stepIndex >= TUTORIAL_STEPS.length - 1) {
      setTutorialFinished(true)
    } else {
      setStepIndex((i) => i + 1)
    }
  }

  const dialogState = c.game

  return (
    <TooltipsProvider enabled={c.tooltips}>
      <CatanErrorBoundary
        resetKey={c.resetKey}
        onError={() => clearGame()}
        fallback={
          <NewGameDialog
            canCancel={false}
            onCancel={() => {}}
            onStart={(count, name) => {
              c.startNewGame(count, name)
              c.setResetKey((k) => k + 1)
            }}
          />
        }
      >
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: COLORS.bg,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            inert={(c.game !== null && c.modalOpen) || undefined}
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <TopBar
              turn={c.game?.turn ?? 0}
              canSkip={c.canSkip}
              onSkip={c.skipToMyTurn}
              onRules={() => c.setDialog('rules')}
              onNewGame={tutorialActive ? onExitTutorial : () => c.setShowNewGame(true)}
              botSpeed={c.botSpeed}
              tooltips={c.tooltips}
              showBoardKey={c.showBoardKey}
              onBotSpeedChange={c.setBotSpeed}
              onTooltipsChange={c.setTooltips}
              onShowBoardKeyChange={c.setShowBoardKey}
            />

            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              <main style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                {c.game ? (
                  <div ref={boardWrapRef} data-tutorial="board" style={{ position: 'absolute', inset: 0 }}>
                    <BoardCanvas
                      state={c.game}
                      targets={c.targets}
                      lastPlaced={c.lastPlaced}
                      labels={t.catan.board}
                      describeVertex={c.describeVertex}
                      describeHover={c.describeHoverTarget}
                      onVertex={(v) => {
                        if (!c.humanActing) return
                        const phase = c.game!.phase
                        if (phase.kind === 'setup' && phase.step === 'settlement') {
                          applyHuman({ type: 'placeSetupSettlement', vertex: v })
                        } else if (phase.kind === 'main') {
                          if (c.buildMode === 'settlement' && applyHuman({ type: 'buildSettlement', vertex: v })) {
                            c.setBuildMode(null)
                          } else if (c.buildMode === 'city' && applyHuman({ type: 'buildCity', vertex: v })) {
                            c.setBuildMode(null)
                          }
                        }
                      }}
                      onEdge={(e) => {
                        if (!c.humanActing) return
                        const phase = c.game!.phase
                        if (phase.kind === 'setup' && phase.step === 'road') {
                          applyHuman({ type: 'placeSetupRoad', edge: e })
                        } else if (phase.kind === 'roadBuilding') {
                          applyHuman({ type: 'buildRoad', edge: e })
                        } else if (phase.kind === 'main' && c.buildMode === 'road') {
                          if (applyHuman({ type: 'buildRoad', edge: e })) c.setBuildMode(null)
                        }
                      }}
                      onHex={(h) => {
                        if (!c.humanActing) return
                        if (c.game!.phase.kind === 'moveRobber') applyHuman({ type: 'moveRobber', hex: h })
                      }}
                    />
                    {activeHint ? <HintBoardHighlight highlight={activeHint.highlight} wrapperRef={boardWrapRef} /> : null}
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PixelButton variant="primary" onClick={() => c.setShowNewGame(true)}>
                      {t.catan.newGame}
                    </PixelButton>
                  </div>
                )}
                {tutorialActive && !tutorialFinished && c.game ? (
                  <TutorialCoach
                    stepLabel={fill(t.catan.tutorial.step, {
                      current: stepIndex + 1,
                      total: TUTORIAL_STEPS.length,
                    })}
                    title={step.title}
                    body={step.body}
                    highlight={step.highlight}
                    canGoBack={canGoBack}
                    isLast={stepIndex === TUTORIAL_STEPS.length - 1}
                    nextLabel={t.catan.tutorial.next}
                    backLabel={t.catan.tutorial.back}
                    exitLabel={t.catan.tutorial.exit}
                    finishLabel={t.catan.tutorial.finish}
                    onNext={handleCoachNext}
                    onBack={() => setStepIndex((i) => Math.max(i - 1, 0))}
                    onExit={onExitTutorial}
                    canAdvance={step.completeWhen === 'next'}
                    actionPrompt={t.catan.tutorial.doAction}
                  />
                ) : null}
              </main>

              <aside
                style={{
                  width: 340,
                  minWidth: 340,
                  borderLeft: `2px solid ${COLORS.panelBorder}`,
                  backgroundColor: COLORS.bg,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {c.game ? (
                  <>
                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                      <DiceViewer state={c.game} />
                      <PlayersPanel state={c.game} />
                      {c.me ? (
                        <>
                          <HandPanel state={c.game} human={c.human} />
                          <DevCardsPanel state={c.game} human={c.human} onPlayCard={openPlayCard} />
                        </>
                      ) : null}
                      <BoardKeyPanel open={c.showBoardKey} onToggle={() => c.setShowBoardKey(!c.showBoardKey)} />
                      <div style={{ height: 240, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                        <GameLog state={c.game} events={lastEvents} scrollRef={c.logRef} />
                      </div>
                    </div>
                    {c.me ? (
                      <div style={{ flexShrink: 0 }}>
                        <StatusLine statusText={c.statusText} isError={c.status !== null} />
                        <ActionBar
                          game={c.game}
                          human={c.human}
                          humanActing={c.humanActing}
                          inPreRoll={c.inPreRoll}
                          inMain={c.inMain}
                          buildMode={c.buildMode}
                          onBuildModeChange={c.setBuildMode}
                          canRoll={c.canRoll}
                          canRoad={c.canRoad}
                          canSettlement={c.canSettlement}
                          canCity={c.canCity}
                          canBuyDev={c.canBuyDev}
                          canTrade={c.canTrade}
                          canPlayCard={c.canPlayCard}
                          canEndTurn={c.canEndTurn}
                          roadReasonText={c.roadReasonText}
                          settlementReasonText={c.settlementReasonText}
                          cityReasonText={c.cityReasonText}
                          devReasonText={c.devReasonText}
                          onRoll={() => applyHuman({ type: 'rollDice' })}
                          onBuyDev={() => applyHuman({ type: 'buyDevCard' })}
                          onTrade={() => c.setDialog('trade')}
                          onPlayCard={() => openPlayCard(null)}
                          onEndTurn={() => applyHuman({ type: 'endTurn' })}
                          hintText={activeHint?.text ?? null}
                          onHint={tutorialActive && !tutorialFinished ? undefined : () => setHintVisible((v) => !v)}
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div style={{ padding: 8 }}>
                    <SectionTitleFallback />
                  </div>
                )}
              </aside>
            </div>
          </div>

          {activeHint ? <TutorialSpotlight ids={activeHint.highlight.ui ?? []} /> : null}

          {c.showNewGame ? (
            <NewGameDialog
              canCancel={c.game !== null}
              onCancel={() => c.setShowNewGame(false)}
              onStart={c.startNewGame}
              onTutorial={tutorialActive ? undefined : onStartTutorial}
            />
          ) : null}
          {c.dialog === 'trade' && dialogState ? (
            <TradeDialog
              state={dialogState}
              human={c.human}
              onTrade={(action) => {
                if (applyHuman(action)) c.setDialog(null)
              }}
              onClose={() => c.setDialog(null)}
            />
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
          {c.game?.phase.kind === 'gameOver' && c.dialog !== 'rules' ? (
            <GameOverOverlay
              state={c.game}
              onNewGame={tutorialActive ? onExitTutorial : c.startNewFromGameOver}
              onRules={() => c.setDialog('rules')}
            />
          ) : null}
        </div>
      </CatanErrorBoundary>
    </TooltipsProvider>
  )
}

function SectionTitleFallback() {
  const t = useT()
  return (
    <div style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.text }}>
      {t.catan.title}: {t.catan.newGame}
    </div>
  )
}

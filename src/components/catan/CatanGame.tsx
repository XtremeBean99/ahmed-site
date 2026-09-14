'use client'

import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/client'
import { isMobileViewport } from '@/lib/room/useStageScale'
import { MobileGate } from '@/components/room/MobileGate'
import { BoardCanvas, type BoardTargets } from '@/components/catan/BoardCanvas'
import { chooseBotAction } from '@/lib/games/catan/ai'
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
  totalCards,
  victoryPoints,
} from '@/lib/games/catan/helpers'
import { clearGame, loadGame, saveGame } from '@/lib/games/catan/save'
import type { Action, GameState, PlayerColor } from '@/lib/games/catan/types'
import { Dice } from './Dice'
import { DiscardDialog } from './DiscardDialog'
import { GameOverOverlay } from './GameOverOverlay'
import { NewGameDialog } from './NewGameDialog'
import { PlayCardDialog, playableDevCards } from './PlayCardDialog'
import { ResourceIcon } from './ResourceIcon'
import { RulesPanel } from './RulesPanel'
import { StealDialog } from './StealDialog'
import { TradeDialog } from './TradeDialog'
import { fill, formatEvent, playerSubject } from './event-text'
import { COLORS, FOCUS_CLASS, Muted, PIXEL_FONT, Panel, PixelButton, SectionTitle } from './ui'

const PLAYER_COLORS: Record<PlayerColor, string> = {
  red: '#c0392b',
  blue: '#2e6fb7',
  white: '#e8e0d0',
  orange: '#e07b2a',
}

function fallbackFor(state: GameState): Action | null {
  if (validateAction(state, { type: 'rollDice' }) === null) return { type: 'rollDice' }
  if (validateAction(state, { type: 'endTurn' }) === null) return { type: 'endTurn' }
  return null
}

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

export function CatanGame() {
  const t = useT()
  const [mounted, setMounted] = useState(false)
  const [game, setGame] = useState<GameState | null>(null)
  const [showNewGame, setShowNewGame] = useState(false)
  const [dialog, setDialog] = useState<'trade' | 'playCard' | 'rules' | null>(null)
  const [buildMode, setBuildMode] = useState<'road' | 'settlement' | 'city' | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const gameRef = useRef<GameState | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMounted(true)
    const saved = loadGame()
    if (saved) {
      gameRef.current = saved
      setGame(saved)
    } else {
      setShowNewGame(true)
    }
  }, [])

  useEffect(() => {
    gameRef.current = game
    if (game) saveGame(game)
  }, [game])

  const apply = useCallback((action: Action): boolean => {
    const prev = gameRef.current
    if (!prev) return false
    try {
      const next = applyAction(prev, action)
      gameRef.current = next
      setGame(next)
      setStatus(null)
      return true
    } catch (err) {
      console.error('Catan action rejected', err)
      setStatus(err instanceof Error ? err.message : String(err))
      return false
    }
  }, [])

  const startNewGame = useCallback((count: 3 | 4, name: string) => {
    clearGame()
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]
    const fresh = createGame({ seed, playerCount: count, humanName: name || 'You' })
    gameRef.current = fresh
    setGame(fresh)
    setShowNewGame(false)
    setDialog(null)
    setBuildMode(null)
    setStatus(null)
  }, [])

  const startNewFromGameOver = useCallback(() => {
    clearGame()
    gameRef.current = null
    setGame(null)
    setShowNewGame(true)
    setDialog(null)
    setBuildMode(null)
    setStatus(null)
  }, [])

  const human = game ? humanPlayer(game) : -1
  const actors = game ? playersToAct(game) : []
  const humanActing = game !== null && human >= 0 && actors.includes(human)
  const humanSteal = game !== null && human >= 0 && game.phase.kind === 'steal' && game.current === human
  const humanDiscard =
    game !== null && human >= 0 && game.phase.kind === 'discard' && game.phase.discards[human] > 0
  const mustAnswer = showNewGame || dialog === 'trade' || dialog === 'playCard' || humanSteal || humanDiscard
  const modalOpen = showNewGame || dialog !== null || humanSteal || humanDiscard || game?.phase.kind === 'gameOver'
  const pauseBots = !game || mustAnswer

  useEffect(() => {
    if (!game || pauseBots) return
    const bot = playersToAct(game).find((p) => game.players[p].isBot)
    if (bot === undefined) return
    const delay = game.phase.kind === 'setup' ? 200 : 450
    const timer = setTimeout(() => {
      const state = gameRef.current
      if (!state) return
      try {
        const action = chooseBotAction(state, bot)
        if (!apply(action)) {
          console.error('Bot action failed validation', action)
          const fallback = fallbackFor(state)
          if (fallback) apply(fallback)
        }
      } catch (err) {
        console.error('Bot could not choose an action', err)
        const fallback = fallbackFor(state)
        if (fallback) apply(fallback)
      }
    }, delay)
    return () => clearTimeout(timer)
  }, [game, pauseBots, apply])

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
    if (!game || human < 0 || !humanActing) return { kind: null, vertices: [], edges: [], hexes: [] }
    const phase = game.phase
    switch (phase.kind) {
      case 'setup':
        if (phase.step === 'settlement') {
          return { kind: 'setupSettlement', vertices: legalSetupSettlements(game), edges: [], hexes: [] }
        }
        return { kind: 'setupRoad', vertices: [], edges: legalSetupRoads(game), hexes: [] }
      case 'moveRobber':
        return {
          kind: 'robber',
          vertices: [],
          edges: [],
          hexes: HEXES.map((h) => h.id).filter((id) => id !== game.robber),
        }
      case 'roadBuilding':
        return { kind: 'road', vertices: [], edges: legalRoads(game, human), hexes: [] }
      case 'main':
        if (buildMode === 'road') return { kind: 'road', vertices: [], edges: legalRoads(game, human), hexes: [] }
        if (buildMode === 'settlement') {
          return { kind: 'settlement', vertices: legalSettlements(game, human), edges: [], hexes: [] }
        }
        if (buildMode === 'city') {
          return { kind: 'city', vertices: legalCities(game, human), edges: [], hexes: [] }
        }
        return { kind: null, vertices: [], edges: [], hexes: [] }
      default:
        return { kind: null, vertices: [], edges: [], hexes: [] }
    }
  }, [game, human, buildMode, humanActing])

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
  }, [game, status, t, human])

  const me = game && human >= 0 ? game.players[human] : null
  const inMain = game?.phase.kind === 'main'
  const inPreRoll = game?.phase.kind === 'preRoll'

  const roadSpots = game && inMain && me && humanActing ? legalRoads(game, human) : []
  const settlementSpots = game && inMain && me && humanActing ? legalSettlements(game, human) : []
  const citySpots = game && inMain && me && humanActing ? legalCities(game, human) : []
  const canRoad = Boolean(me && humanActing && inMain && hasResources(me.resources, COSTS.road) && roadSpots.length > 0)
  const canSettlement = Boolean(
    me && humanActing && inMain && hasResources(me.resources, COSTS.settlement) && settlementSpots.length > 0,
  )
  const canCity = Boolean(me && humanActing && inMain && hasResources(me.resources, COSTS.city) && citySpots.length > 0)
  const canBuyDev = Boolean(
    me && humanActing && inMain && hasResources(me.resources, COSTS.devCard) && game && game.devDeck.length > 0,
  )
  const playableCards = game && human >= 0 && humanActing ? playableDevCards(game, human) : []
  const canPlayCard = playableCards.length > 0
  const canRoll = Boolean(humanActing && inPreRoll)
  const canTrade = Boolean(humanActing && inMain)
  const canEndTurn = Boolean(humanActing && inMain)

  const lastEvents = game ? game.events.slice(-60) : []

  if (!mounted) {
    return <div style={{ position: 'fixed', inset: 0, backgroundColor: COLORS.bg }} />
  }
  if (isMobileViewport()) return <MobileGate />

  return (
    <CatanErrorBoundary
      resetKey={resetKey}
      onError={() => clearGame()}
      fallback={
        <NewGameDialog
          canCancel={false}
          onCancel={() => {}}
          onStart={(count, name) => {
            startNewGame(count, name)
            setResetKey((k) => k + 1)
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
        inert={(game !== null && modalOpen) || undefined}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 12px',
          backgroundColor: COLORS.panel,
          borderBottom: `2px solid ${COLORS.panelBorder}`,
        }}
      >
        <h1 style={{ ...PIXEL_FONT, fontSize: 16, color: COLORS.accent, margin: 0, letterSpacing: 2 }}>
          {t.catan.title}
        </h1>
        <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted }}>
          {fill(t.catan.turn, { turn: game?.turn ?? 0 })}
        </span>
        <Dice dice={game?.dice ?? null} label={t.catan.diceLabel} />
        <div style={{ flex: 1 }} />
        <PixelButton onClick={() => setDialog('rules')}>{t.catan.rules}</PixelButton>
        <PixelButton onClick={() => setShowNewGame(true)}>{t.catan.newGame}</PixelButton>
        <Link
          href="/"
          className={FOCUS_CLASS}
          style={{
            ...PIXEL_FONT,
            fontSize: 10,
            padding: '6px 8px',
            backgroundColor: COLORS.panel,
            border: `2px solid ${COLORS.panelBorder}`,
            color: COLORS.text,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          {t.catan.back}
        </Link>
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <main style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {game ? (
            <div style={{ position: 'absolute', inset: 0 }}>
              <BoardCanvas
                state={game}
                targets={targets}
                lastPlaced={lastPlaced}
                labels={t.catan.board}
                onVertex={(v) => {
                  if (!humanActing) return
                  const phase = game.phase
                  if (phase.kind === 'setup' && phase.step === 'settlement') {
                    apply({ type: 'placeSetupSettlement', vertex: v })
                  } else if (phase.kind === 'main') {
                    if (buildMode === 'settlement' && apply({ type: 'buildSettlement', vertex: v })) setBuildMode(null)
                    else if (buildMode === 'city' && apply({ type: 'buildCity', vertex: v })) setBuildMode(null)
                  }
                }}
                onEdge={(e) => {
                  if (!humanActing) return
                  const phase = game.phase
                  if (phase.kind === 'setup' && phase.step === 'road') {
                    apply({ type: 'placeSetupRoad', edge: e })
                  } else if (phase.kind === 'roadBuilding') {
                    apply({ type: 'buildRoad', edge: e })
                  } else if (phase.kind === 'main' && buildMode === 'road') {
                    if (apply({ type: 'buildRoad', edge: e })) setBuildMode(null)
                  }
                }}
                onHex={(h) => {
                  if (!humanActing) return
                  if (game.phase.kind === 'moveRobber') apply({ type: 'moveRobber', hex: h })
                }}
              />
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PixelButton variant="primary" onClick={() => setShowNewGame(true)}>
                {t.catan.newGame}
              </PixelButton>
            </div>
          )}
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
          {game ? (
            <>
              <Panel style={{ borderWidth: 0, padding: 8 }}>
                <SectionTitle>{t.catan.players}</SectionTitle>
                <div style={{ display: 'flex', gap: 4, marginTop: 4, padding: '0 6px' }}>
                  <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted, flex: 1 }} />
                  <abbr title="Victory points" aria-label="Victory points" style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted, width: 30, textAlign: 'right', textDecoration: 'none' }}>
                    VP
                  </abbr>
                  <abbr title="Resource cards" aria-label="Resource cards" style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted, width: 26, textAlign: 'right', textDecoration: 'none' }}>
                    Res
                  </abbr>
                  <abbr title="Development cards" aria-label="Development cards" style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted, width: 26, textAlign: 'right', textDecoration: 'none' }}>
                    Dev
                  </abbr>
                  <abbr title="Knights played" aria-label="Knights played" style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted, width: 26, textAlign: 'right', textDecoration: 'none' }}>
                    Knt
                  </abbr>
                  <abbr title="Longest road" aria-label="Longest road" style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted, width: 26, textAlign: 'right', textDecoration: 'none' }}>
                    Rd
                  </abbr>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                  {game.players.map((p) => {
                    const isCurrent = game.current === p.id
                    const vp = p.isBot ? victoryPoints(game, p.id, false) : victoryPoints(game, p.id, true)
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 6px',
                          backgroundColor: isCurrent ? 'rgba(224,160,64,0.14)' : 'transparent',
                          border: isCurrent ? '2px solid #e0a040' : '2px solid transparent',
                        }}
                      >
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            backgroundColor: PLAYER_COLORS[p.color],
                            border: '1px solid #1a1410',
                            display: 'inline-block',
                            flexShrink: 0,
                          }}
                          title={p.color}
                        />
                        <span
                          style={{
                            ...PIXEL_FONT,
                            fontSize: 10,
                            color: COLORS.text,
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p.name}
                          {isCurrent ? ' \u25b8' : ''}
                        </span>
                        <span style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.text, width: 30, textAlign: 'right' }}>
                          {vp}
                        </span>
                        <span style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.muted, width: 26, textAlign: 'right' }}>
                          {totalCards(p.resources)}
                        </span>
                        <span style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.muted, width: 26, textAlign: 'right' }}>
                          {p.devCards.length + p.newDevCards.length}
                        </span>
                        <span style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.muted, width: 26, textAlign: 'right' }}>
                          {p.knightsPlayed}
                        </span>
                        <span style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.muted, width: 26, textAlign: 'right' }}>
                          {p.longestRoad}
                        </span>
                        {game.longestRoadHolder === p.id ? (
                          <span
                            title={t.catan.longestRoad}
                            style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.accent, width: 22, textAlign: 'center' }}
                          >
                            LR
                          </span>
                        ) : (
                          <span style={{ width: 22 }} />
                        )}
                        {game.largestArmyHolder === p.id ? (
                          <span
                            title={t.catan.largestArmy}
                            style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.accent, width: 22, textAlign: 'center' }}
                          >
                            LA
                          </span>
                        ) : (
                          <span style={{ width: 22 }} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </Panel>

              {me ? (
                <>
                  <Panel style={{ borderWidth: '2px 0 0 0', padding: 8 }}>
                    <SectionTitle>{t.catan.hand}</SectionTitle>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                      {RESOURCES.map((r) => (
                        <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ResourceIcon resource={r} size={16} />
                          <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.text, width: 52 }}>
                            {t.catan.resources[r]}
                          </span>
                          <span style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.text }}>{me.resources[r]}</span>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  <Panel style={{ borderWidth: '2px 0 0 0', padding: 8 }}>
                    <SectionTitle>{t.catan.devCards}</SectionTitle>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                      <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted }}>
                        {t.catan.playable}: {playableCards.length}
                      </span>
                      <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted }}>
                        {t.catan.newCard}: {me.newDevCards.length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {playableCards.map((c, i) => (
                        <span
                          key={`${c}-${i}`}
                          style={{
                            ...PIXEL_FONT,
                            fontSize: 10,
                            color: COLORS.text,
                            border: `1px solid ${COLORS.panelBorder}`,
                            padding: '2px 4px',
                          }}
                        >
                          {t.catan.playCard.cards[c].name}
                        </span>
                      ))}
                    </div>
                  </Panel>

                  <div
                    role="status"
                    aria-live="polite"
                    style={{
                      minHeight: 30,
                      padding: '6px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      borderTop: `2px solid ${COLORS.panelBorder}`,
                    }}
                  >
                    <span style={{ ...PIXEL_FONT, fontSize: 10, color: status ? COLORS.danger : COLORS.text }}>
                      {statusText}
                    </span>
                  </div>

                  <Panel style={{ borderWidth: '2px 0 0 0', padding: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {inPreRoll && humanActing ? (
                        <PixelButton
                          variant="primary"
                          disabled={!canRoll}
                          onClick={() => apply({ type: 'rollDice' })}
                          style={{ width: '100%' }}
                        >
                          {t.catan.actionBar.roll}
                        </PixelButton>
                      ) : null}
                      {inMain ? (
                        <>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <PixelButton
                              selected={buildMode === 'road'}
                              disabled={!canRoad}
                              onClick={() => setBuildMode((prev) => (prev === 'road' ? null : 'road'))}
                              aria-pressed={buildMode === 'road'}
                              aria-label={t.catan.actionBar.roadAria}
                              aria-describedby="catan-cost-road"
                              style={{ flex: 1, flexDirection: 'column', gap: 2 }}
                              title={t.catan.cost.road}
                            >
                              <span>{t.catan.actionBar.road}</span>
                              <span style={{ display: 'inline-flex', gap: 2 }}>
                                <ResourceIcon resource="brick" size={12} />
                                <ResourceIcon resource="lumber" size={12} />
                              </span>
                            </PixelButton>
                            <PixelButton
                              selected={buildMode === 'settlement'}
                              disabled={!canSettlement}
                              onClick={() => setBuildMode((prev) => (prev === 'settlement' ? null : 'settlement'))}
                              aria-pressed={buildMode === 'settlement'}
                              aria-label={t.catan.actionBar.settlementAria}
                              aria-describedby="catan-cost-settlement"
                              style={{ flex: 1, flexDirection: 'column', gap: 2 }}
                              title={t.catan.cost.settlement}
                            >
                              <span>{t.catan.actionBar.settlement}</span>
                              <span style={{ display: 'inline-flex', gap: 2 }}>
                                <ResourceIcon resource="brick" size={12} />
                                <ResourceIcon resource="lumber" size={12} />
                                <ResourceIcon resource="wool" size={12} />
                                <ResourceIcon resource="grain" size={12} />
                              </span>
                            </PixelButton>
                            <PixelButton
                              selected={buildMode === 'city'}
                              disabled={!canCity}
                              onClick={() => setBuildMode((prev) => (prev === 'city' ? null : 'city'))}
                              aria-pressed={buildMode === 'city'}
                              aria-label={t.catan.actionBar.cityAria}
                              aria-describedby="catan-cost-city"
                              style={{ flex: 1, flexDirection: 'column', gap: 2 }}
                              title={t.catan.cost.city}
                            >
                              <span>{t.catan.actionBar.city}</span>
                              <span style={{ display: 'inline-flex', gap: 2 }}>
                                <ResourceIcon resource="grain" size={12} />
                                <ResourceIcon resource="grain" size={12} />
                                <ResourceIcon resource="ore" size={12} />
                                <ResourceIcon resource="ore" size={12} />
                                <ResourceIcon resource="ore" size={12} />
                              </span>
                            </PixelButton>
                          </div>
                          <span id="catan-cost-road" hidden>
                            {t.catan.cost.road}
                          </span>
                          <span id="catan-cost-settlement" hidden>
                            {t.catan.cost.settlement}
                          </span>
                          <span id="catan-cost-city" hidden>
                            {t.catan.cost.city}
                          </span>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <PixelButton
                              disabled={!canBuyDev}
                              onClick={() => apply({ type: 'buyDevCard' })}
                              aria-label={t.catan.actionBar.buyDevCardAria}
                              aria-describedby="catan-cost-dev-card"
                              title={t.catan.cost.devCard}
                            >
                              {t.catan.actionBar.buyDevCard}
                            </PixelButton>
                            <span id="catan-cost-dev-card" hidden>
                              {t.catan.cost.devCard}
                            </span>
                            <PixelButton disabled={!canTrade} onClick={() => setDialog('trade')}>
                              {t.catan.actionBar.trade}
                            </PixelButton>
                            <PixelButton disabled={!canPlayCard} onClick={() => setDialog('playCard')}>
                              {t.catan.actionBar.playCard}
                            </PixelButton>
                            <PixelButton
                              variant="danger"
                              disabled={!canEndTurn}
                              onClick={() => apply({ type: 'endTurn' })}
                            >
                              {t.catan.actionBar.endTurn}
                            </PixelButton>
                          </div>
                          {buildMode ? <Muted>{t.catan.cancelHint}</Muted> : null}
                        </>
                      ) : null}
                      {humanActing && game.phase.kind === 'roadBuilding' ? (
                        <Muted>{fill(t.catan.status.roadBuilding, { player: playerSubject(game, human), remaining: game.phase.remaining })}</Muted>
                      ) : null}
                      {!humanActing && game.phase.kind !== 'gameOver' ? (
                        <Muted>{statusText}</Muted>
                      ) : null}
                    </div>
                  </Panel>

                  <Panel style={{ borderWidth: '2px 0 0 0', padding: 8, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <SectionTitle>{t.catan.eventLog}</SectionTitle>
                    <div
                      ref={logRef}
                      aria-live="polite"
                      style={{ flex: 1, overflowY: 'auto', marginTop: 4, paddingRight: 4, minHeight: 0 }}
                    >
                      {lastEvents.map((e) => (
                        <div
                          key={e.seq}
                          style={{
                            ...PIXEL_FONT,
                            fontSize: 10,
                            color: COLORS.muted,
                            padding: '2px 0',
                            borderBottom: `1px solid ${COLORS.panelDark}`,
                            lineHeight: 1.4,
                          }}
                        >
                          {formatEvent(game, e, t)}
                        </div>
                      ))}
                    </div>
                  </Panel>
                </>
              ) : null}
            </>
          ) : (
            <Panel style={{ borderWidth: 0, padding: 8 }}>
              <SectionTitle>{t.catan.title}</SectionTitle>
              <Muted>{t.catan.newGame}</Muted>
            </Panel>
          )}
        </aside>
      </div>
      </div>

      {showNewGame ? (
        <NewGameDialog
          canCancel={game !== null}
          onCancel={() => setShowNewGame(false)}
          onStart={startNewGame}
        />
      ) : null}
      {dialog === 'trade' && game ? (
        <TradeDialog
          state={game}
          human={human}
          onTrade={(action) => {
            if (apply(action)) setDialog(null)
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'playCard' && game ? (
        <PlayCardDialog
          state={game}
          human={human}
          onPlay={(action) => {
            if (apply(action)) setDialog(null)
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'rules' ? <RulesPanel onClose={() => setDialog(null)} /> : null}
      {humanDiscard && game ? (
        <DiscardDialog
          state={game}
          human={human}
          onConfirm={(resources) => {
            apply({ type: 'discard', player: human, resources })
          }}
        />
      ) : null}
      {humanSteal && game ? (
        <StealDialog
          state={game}
          onSteal={(victim) => {
            apply({ type: 'steal', victim })
          }}
        />
      ) : null}
      {game?.phase.kind === 'gameOver' && dialog !== 'rules' ? (
        <GameOverOverlay state={game} onNewGame={startNewFromGameOver} onRules={() => setDialog('rules')} />
      ) : null}
      </div>
    </CatanErrorBoundary>
  )
}

// src/components/room/DeskSolitaire.tsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArcadeButton,
  ArcadeFrame,
  ArcadeOverlay,
  ArcadePanel,
  ArcadeStrip,
  ARCADE,
  FELT_STYLE,
  PIXEL_FONT,
  useCanvasScale,
  useFullscreen,
  type DeskGameProps,
} from './DeskArcade'
import { CARD_H, CARD_W, cardCanvas, cardUrl } from './PlayingCard'
import { cardId, cardName, createDeck, type Card } from '@/lib/games/cards'
import { BEST_KEYS, getBest, readJson, setBestIfHigher, writeJson } from '@/lib/games/storage'
import { useSfx } from './RoomSfxProvider'
import {
  autoFinishStep,
  autoTarget,
  canAutoFinish,
  canMove,
  deal,
  draw,
  finish,
  move,
  type DrawCount,
  type Loc,
  type SolitaireState,
  type TableauPile,
} from '@/lib/games/solitaire-engine'

const COL_X = (i: number) => 83 + i * 54
const FOUND_X = (i: number) => 245 + i * 54
const TOP_Y = 8
const TABLEAU_Y = 80
const DOWN_STEP = 4
const UP_STEP = 13
const UP_STEP_MIN = 8
const FLOOR_Y = 280 - CARD_H
const STATUS_H = 22
const WASTE_FAN = 12
const DRAG_LIFT = 2
const DRAG_RUN_STEP = 16

const ALL_CARDS = createDeck()

export interface SolitaireLabels {
  table: string
  score: string
  time: string
  moves: string
  draw: string
  best: string
  undo: string
  auto: string
  newGame: string
  drawOne: string
  drawThree: string
  newGameMenu: string
  winTitle: string
  playAgain: string
  winScore: string
  winTime: string
  winMoves: string
  winAria: string
  illegal: string
  stock: string
  recycle: string
  waste: string
  foundation: string
  tableau: string
  cardAtTableau: string
  cardAtWaste: string
  cardAtFoundation: string
}

interface CardSlot {
  x: number
  y: number
  z: number
  faceUp: boolean
}

interface DealAnim {
  order: Card[]
  revealed: number
}

interface DragState {
  from: Loc
  cards: Card[]
  start: { x: number; y: number }
  pointer: { x: number; y: number }
  offset: { x: number; y: number }
  pointerId: number
  active: boolean
}

function upStepFor(pile: TableauPile): number {
  if (pile.up.length <= 1) return UP_STEP
  const avail = 252 - TABLEAU_Y - pile.down.length * DOWN_STEP - CARD_H
  return Math.max(UP_STEP_MIN, Math.min(UP_STEP, Math.floor(avail / (pile.up.length - 1))))
}

function tableauPileBottom(pile: TableauPile): number {
  if (pile.up.length > 0) return TABLEAU_Y + pile.down.length * DOWN_STEP + (pile.up.length - 1) * upStepFor(pile) + CARD_H
  if (pile.down.length > 0) return TABLEAU_Y + pile.down.length * DOWN_STEP + CARD_H
  return TABLEAU_Y + CARD_H
}

/** The deal order mirrors the engine's sequential tableau deal. */
function dealOrderOf(game: SolitaireState): Card[] {
  const order: Card[] = []
  for (const pile of game.tableau) {
    for (const card of pile.down) order.push(card)
    for (const card of pile.up) order.push(card)
  }
  return order
}

function computeSlots(game: SolitaireState, dealAnim: DealAnim | null): Map<string, CardSlot> {
  const map = new Map<string, CardSlot>()
  game.stock.forEach((card, i) => map.set(cardId(card), { x: COL_X(0), y: TOP_Y, z: i, faceUp: false }))

  const show = Math.min(3, game.waste.length)
  game.waste.forEach((card, i) => {
    const k = game.drawCount === 3 && i >= game.waste.length - show ? i - (game.waste.length - show) : 0
    map.set(cardId(card), { x: COL_X(1) + k * WASTE_FAN, y: TOP_Y, z: 24 + i, faceUp: true })
  })

  game.foundations.forEach((pile, f) => {
    pile.forEach((card, i) => map.set(cardId(card), { x: FOUND_X(f), y: TOP_Y, z: 60 + f * 13 + i, faceUp: true }))
  })

  game.tableau.forEach((pile, i) => {
    const x = COL_X(i)
    const step = upStepFor(pile)
    pile.down.forEach((card, j) => map.set(cardId(card), { x, y: TABLEAU_Y + j * DOWN_STEP, z: 200 + i * 40 + j, faceUp: false }))
    pile.up.forEach((card, k) =>
      map.set(cardId(card), { x, y: TABLEAU_Y + pile.down.length * DOWN_STEP + k * step, z: 200 + i * 40 + pile.down.length + k, faceUp: true }),
    )
  })

  if (dealAnim) {
    const dealt = new Set(dealAnim.order.slice(0, dealAnim.revealed).map(cardId))
    dealAnim.order.forEach((card, idx) => {
      if (!dealt.has(cardId(card))) map.set(cardId(card), { x: COL_X(0), y: TOP_Y, z: 500 + idx, faceUp: false })
    })
  }
  return map
}

function runFor(game: SolitaireState, loc: Loc): Card[] {
  if (loc.pile === 'waste') return game.waste.length > 0 ? [game.waste[game.waste.length - 1]] : []
  if (loc.pile === 'foundation') {
    const pile = game.foundations[loc.index]
    return pile && pile.length > 0 ? [pile[pile.length - 1]] : []
  }
  const up = game.tableau[loc.index]?.up
  return up ? up.slice(loc.card) : []
}

function destinationOf(loc: Loc): Loc | null {
  if (loc.pile === 'foundation') return { pile: 'foundation', index: loc.index }
  if (loc.pile === 'tableau') return { pile: 'tableau', index: loc.index, card: 0 }
  return null
}

function sameLoc(a: Loc, b: Loc): boolean {
  if (a.pile !== b.pile) return false
  if (a.pile === 'waste') return true
  if (a.pile === 'foundation') return b.pile === 'foundation' && a.index === b.index
  return b.pile === 'tableau' && a.index === b.index && a.card === b.card
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function EmptySlot({ glyph, recycle }: { glyph?: boolean; recycle?: boolean }) {
  const line = 'rgba(111,146,112,0.55)'
  const fill = 'rgba(0,0,0,0.12)'
  const a = ['..#..', '.#.#.', '#...#', '#...#', '#####', '#...#', '#...#']
  return (
    <svg width={CARD_W} height={CARD_H} viewBox="0 0 45 63" shapeRendering="crispEdges" aria-hidden className="pointer-events-none">
      <rect x="1" y="1" width="43" height="61" fill={fill} />
      <rect x="2" y="0" width="41" height="1" fill={line} />
      <rect x="2" y="62" width="41" height="1" fill={line} />
      <rect x="0" y="2" width="1" height="59" fill={line} />
      <rect x="44" y="2" width="1" height="59" fill={line} />
      {[
        [1, 1],
        [43, 1],
        [1, 61],
        [43, 61],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={line} />
      ))}
      {glyph &&
        a.map((row, y) =>
          row
            .split('')
            .map((px, x) => (px === '#' ? <rect key={`${x}-${y}`} x={20 + x} y={28 + y} width="1" height="1" fill="rgba(207,224,192,0.35)" /> : null)),
        )}
      {recycle && <RecycleRing />}
    </svg>
  )
}

function RecycleRing() {
  const cells: { x: number; y: number }[] = []
  for (let y = 0; y < 13; y++) {
    for (let x = 0; x < 13; x++) {
      const dx = x - 6
      const dy = y - 6
      const d = dx * dx + dy * dy
      if (d >= 26 && d <= 42 && !(y <= 2 && x >= 8)) cells.push({ x, y })
    }
  }
  cells.push({ x: 9, y: 0 }, { x: 10, y: 1 }, { x: 9, y: 1 }, { x: 8, y: 1 }, { x: 9, y: 2 })
  return (
    <svg x={16} y={25} width={13} height={13} viewBox="0 0 13 13" shapeRendering="crispEdges" aria-hidden>
      {cells.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width="1" height="1" fill="rgba(111,146,112,0.55)" />
      ))}
    </svg>
  )
}

function CardSprite({
  card,
  faceUp,
  alt,
  ring,
  shadow,
  instant,
}: {
  card: Card
  faceUp: boolean
  alt: string
  ring: boolean
  shadow: 'normal' | 'strong'
  instant: boolean
}) {
  const dur = instant ? 0 : 0.18
  const filter = shadow === 'strong' ? 'drop-shadow(2px 3px 0 rgba(20,14,10,0.35))' : 'drop-shadow(1px 1px 0 rgba(20,14,10,0.35))'
  const ringShadow = ring ? { boxShadow: `0 0 0 1px ${ARCADE.amber}, 0 0 0 2px ${ARCADE.ink}` } : undefined
  return (
    <div className="relative" style={{ width: CARD_W, height: CARD_H }}>
      <motion.img
        src={cardUrl('back')}
        alt=""
        draggable={false}
        initial={false}
        animate={{ scaleX: faceUp ? 0 : 1 }}
        transition={{ duration: dur, ease: 'easeOut' }}
        className="absolute inset-0 pointer-events-none"
        style={{ imageRendering: 'pixelated', transformOrigin: 'left center', filter, ...ringShadow }}
      />
      <motion.img
        src={cardUrl(card)}
        alt={alt}
        draggable={false}
        initial={false}
        animate={{ scaleX: faceUp ? 1 : 0 }}
        transition={{ duration: dur, ease: 'easeOut' }}
        className="absolute inset-0 pointer-events-none"
        style={{ imageRendering: 'pixelated', transformOrigin: 'right center', filter, ...ringShadow }}
      />
    </div>
  )
}

export function DeskSolitaire({ time, backLabel, desktopLabel, labels, arcade, onBack, onDesktop }: DeskGameProps<SolitaireLabels>) {
  const fs = useFullscreen()
  const { tone } = useSfx()
  const reduceMotion = useReducedMotion() === true

  const [game, setGame] = useState<SolitaireState | null>(null)
  const [best, setBest] = useState(0)
  const [bestTime, setBestTime] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [canUndo, setCanUndo] = useState(false)
  const [selected, setSelected] = useState<Loc | null>(null)
  const [pending, setPending] = useState<DragState | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [dealAnim, setDealAnim] = useState<DealAnim | null>(null)
  const [autoFinishing, setAutoFinishing] = useState(false)
  const [winPhase, setWinPhase] = useState<'cascade' | 'panel' | null>(null)
  const [winStats, setWinStats] = useState<{ score: number; time: number; moves: number } | null>(null)
  const [announce, setAnnounce] = useState('')

  const playRef = useRef<HTMLDivElement>(null)
  const cascadeRef = useRef<HTMLCanvasElement>(null)
  const newWrapRef = useRef<HTMLSpanElement>(null)
  const gameRef = useRef<SolitaireState | null>(null)
  const pendingRef = useRef<DragState | null>(null)
  const historyRef = useRef<SolitaireState[]>([])
  const startedRef = useRef(false)
  const elapsedRef = useRef(0)
  const winPhaseRef = useRef<'cascade' | 'panel' | null>(null)
  const dealAnimRef = useRef<DealAnim | null>(null)
  const suppressClickRef = useRef(false)
  const announceTimer = useRef<number | null>(null)

  const k = useCanvasScale(cascadeRef, 536)

  useEffect(() => {
    const saved = readJson('solitaire-save')
    let drawMode: DrawCount = 1
    let savedBest = 0
    let savedBestTime = 0
    if (saved && typeof saved === 'object') {
      const s = saved as Record<string, unknown>
      if (s.drawCount === 1 || s.drawCount === 3) drawMode = s.drawCount
      if (typeof s.bestScore === 'number' && Number.isFinite(s.bestScore)) savedBest = s.bestScore
      if (typeof s.bestTime === 'number' && Number.isFinite(s.bestTime)) savedBestTime = s.bestTime
    }
    setBest(Math.max(getBest(BEST_KEYS.solitaire), savedBest))
    setBestTime(savedBestTime)
    const g = deal(Math.random, drawMode)
    gameRef.current = g
    setGame(g)
    if (!reduceMotion) setDealAnim({ order: dealOrderOf(g), revealed: 0 })
  }, [reduceMotion])

  useEffect(() => {
    gameRef.current = game
  }, [game])
  useEffect(() => {
    pendingRef.current = pending
  }, [pending])
  useEffect(() => {
    elapsedRef.current = elapsed
  }, [elapsed])
  useEffect(() => {
    winPhaseRef.current = winPhase
  }, [winPhase])
  useEffect(() => {
    dealAnimRef.current = dealAnim
  }, [dealAnim])

  const apply = useCallback((prev: SolitaireState, next: SolitaireState | null) => {
    if (!next || next === prev) return
    historyRef.current.push(prev)
    gameRef.current = next
    startedRef.current = true
    setGame(next)
    setCanUndo(true)
  }, [])

  const doDraw = useCallback(() => {
    const g = gameRef.current
    if (!g || g.won) return
    const recycle = g.stock.length === 0
    const next = draw(g)
    if (!next) return
    apply(g, next)
    tone(recycle ? 'shuffle' : 'flip')
  }, [apply, tone])

  const undo = useCallback(() => {
    const prev = historyRef.current.pop()
    if (!prev) return
    gameRef.current = prev
    setGame(prev)
    setSelected(null)
    setPending(null)
    pendingRef.current = null
    setCanUndo(historyRef.current.length > 0)
  }, [])

  const startNew = useCallback(
    (drawCount: DrawCount) => {
      const g = deal(Math.random, drawCount)
      gameRef.current = g
      setGame(g)
      historyRef.current = []
      setCanUndo(false)
      setSelected(null)
      setPending(null)
      pendingRef.current = null
      setShowNew(false)
      setAutoFinishing(false)
      setWinPhase(null)
      winPhaseRef.current = null
      setWinStats(null)
      startedRef.current = false
      elapsedRef.current = 0
      setElapsed(0)
      setDealAnim(reduceMotion ? null : { order: dealOrderOf(g), revealed: 0 })
      const cv = cascadeRef.current
      if (cv) {
        const ctx = cv.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, cv.width, cv.height)
      }
    },
    [reduceMotion],
  )

  const skipDeal = useCallback(() => {
    setDealAnim(null)
  }, [])

  const announceMsg = useCallback((msg: string) => {
    setAnnounce('')
    if (announceTimer.current !== null) window.clearTimeout(announceTimer.current)
    announceTimer.current = window.setTimeout(() => setAnnounce(msg), 60)
  }, [])

  const startAutoFinish = useCallback(() => {
    if (!gameRef.current || gameRef.current.won) return
    setSelected(null)
    setAutoFinishing(true)
  }, [])

  useEffect(() => () => {
    if (announceTimer.current !== null) window.clearTimeout(announceTimer.current)
  }, [])

  // The clock starts on the first draw or move and pauses while the tab is hidden.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return
      if (startedRef.current && gameRef.current && !gameRef.current.won) setElapsed((s) => s + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const dealing = dealAnim !== null
  useEffect(() => {
    if (!dealing) return
    const id = window.setInterval(() => {
      setDealAnim((prev) => (prev ? { ...prev, revealed: Math.min(prev.order.length, prev.revealed + 1) } : prev))
    }, 25)
    return () => window.clearInterval(id)
  }, [dealing])

  useEffect(() => {
    if (dealAnim && dealAnim.revealed >= dealAnim.order.length) setDealAnim(null)
  }, [dealAnim])

  useEffect(() => {
    if (dealAnim && dealAnim.revealed > 0 && (dealAnim.revealed % 3 === 0 || dealAnim.revealed >= dealAnim.order.length)) {
      tone('deal')
    }
  }, [dealAnim, tone])

  useEffect(() => {
    if (!autoFinishing) return
    const id = window.setInterval(() => {
      const g = gameRef.current
      if (!g) return
      if (g.won) {
        setAutoFinishing(false)
        return
      }
      const next = autoFinishStep(g)
      if (next) apply(g, next)
      else setAutoFinishing(false)
    }, 90)
    return () => window.clearInterval(id)
  }, [autoFinishing, apply])

  useEffect(() => {
    if (!game || !game.won || winPhase !== null) return
    const secs = elapsedRef.current
    const final = finish(game, secs)
    if (setBestIfHigher(BEST_KEYS.solitaire, final.score)) setBest(final.score)
    if (secs > 0) setBestTime((t) => (t === 0 || secs < t ? secs : t))
    setWinStats({ score: final.score, time: secs, moves: game.moves })
    announceMsg(labels.winAria)
    setAutoFinishing(false)
    setWinPhase(reduceMotion ? 'panel' : 'cascade')
  }, [game, winPhase, reduceMotion, labels.winAria, announceMsg])

  useEffect(() => {
    if (winPhase === 'panel') tone('win')
  }, [winPhase, tone])

  useEffect(() => {
    if (!game) return
    writeJson('solitaire-save', {
      drawCount: game.drawCount,
      played: startedRef.current || game.won,
      won: game.won,
      bestScore: best,
      bestTime,
    })
  }, [game, best, bestTime])

  useEffect(() => {
    if (!showNew) return
    const onPointer = (e: PointerEvent) => {
      const wrap = newWrapRef.current
      if (wrap && !wrap.contains(e.target as Node)) setShowNew(false)
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [showNew])

  // The bouncing-cards cascade: one card at a time, Kings first, never clearing the canvas.
  useEffect(() => {
    if (winPhase !== 'cascade') return
    const canvas = cascadeRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const g = gameRef.current
    if (!g) return

    canvas.width = 536 * k
    canvas.height = 280 * k
    ctx.setTransform(k, 0, 0, k, 0, 0)

    const queue: { card: Card; x: number }[] = []
    for (let rank = 13; rank >= 1; rank--) {
      for (let f = 0; f < 4; f++) {
        const card = g.foundations[f]?.[rank - 1]
        if (card) queue.push({ card, x: FOUND_X(f) })
      }
    }

    let current: { card: Card; x: number; y: number; vx: number; vy: number } | null = null
    let raf = 0
    const end = () => setWinPhase('panel')
    const launch = (): boolean => {
      const next = queue.shift()
      if (!next) return false
      const dir = next.x <= 536 / 2 ? 1 : -1
      current = {
        card: next.card,
        x: next.x,
        y: TOP_Y,
        vx: dir * (2 + Math.random() * 3),
        vy: -(3 + Math.random() * 3),
      }
      return true
    }
    const step = () => {
      if (!current) {
        if (!launch()) {
          end()
          return
        }
        raf = requestAnimationFrame(step)
        return
      }
      const c = current
      c.vy += 0.35
      c.x += c.vx
      c.y += c.vy
      if (c.y >= FLOOR_Y) {
        c.y = FLOOR_Y
        c.vy = -Math.abs(c.vy) * 0.72
      }
      if (c.x < -CARD_W || c.x > 536) {
        current = null
        raf = requestAnimationFrame(step)
        return
      }
      ctx.drawImage(cardCanvas(c.card), Math.round(c.x), Math.round(c.y))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    const onPointer = () => end()
    const onKey = () => end()
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [winPhase, k])

  const toLocal = useCallback((e: { clientX: number; clientY: number }) => {
    const el = playRef.current
    if (!el) return { x: e.clientX, y: e.clientY }
    const r = el.getBoundingClientRect()
    const s = r.width / el.offsetWidth
    return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }
  }, [])

  const findDropTarget = useCallback((g: SolitaireState, cx: number, cy: number): Loc | null => {
    for (let f = 0; f < 4; f++) {
      const x = FOUND_X(f)
      if (cx >= x - 5 && cx <= x + 50 && cy >= TOP_Y && cy <= TOP_Y + CARD_H + 20) return { pile: 'foundation', index: f }
    }
    for (let i = 0; i < 7; i++) {
      const x = COL_X(i)
      const bottom = tableauPileBottom(g.tableau[i])
      if (cx >= x - 5 && cx <= x + 50 && cy >= TABLEAU_Y && cy <= bottom + 20) return { pile: 'tableau', index: i, card: 0 }
    }
    return null
  }, [])

  const handleCardPointerDown = (e: React.PointerEvent<HTMLButtonElement>, loc: Loc) => {
    if (dealAnimRef.current || winPhaseRef.current !== null) return
    const g = gameRef.current
    if (!g || g.won) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const run = runFor(g, loc)
    if (run.length === 0) return
    const slot = computeSlots(g, dealAnimRef.current).get(cardId(run[0]))
    if (!slot) return
    suppressClickRef.current = false
    const { x, y } = toLocal(e)
    const next: DragState = {
      from: loc,
      cards: run,
      start: { x, y },
      pointer: { x, y },
      offset: { x: x - slot.x, y: y - slot.y },
      pointerId: e.pointerId,
      active: false,
    }
    pendingRef.current = next
    setPending(next)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const handleCardPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = pendingRef.current
    if (!p || e.pointerId !== p.pointerId) return
    const { x, y } = toLocal(e)
    if (!p.active) {
      if (Math.hypot(x - p.start.x, y - p.start.y) < 3) return
      setSelected(null)
      const next = { ...p, active: true, pointer: { x, y } }
      pendingRef.current = next
      setPending(next)
      return
    }
    const next = { ...p, pointer: { x, y } }
    pendingRef.current = next
    setPending(next)
  }

  const handleCardPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = pendingRef.current
    if (!p || e.pointerId !== p.pointerId) return
    pendingRef.current = null
    setPending(null)
    if (!p.active) return
    suppressClickRef.current = true
    const g = gameRef.current
    if (!g) return
    const topIdx = p.cards.length - 1
    const topX = p.pointer.x - p.offset.x
    const topY = p.pointer.y - p.offset.y - DRAG_LIFT + topIdx * DRAG_RUN_STEP
    const target = findDropTarget(g, topX + CARD_W / 2, topY + CARD_H / 2)
    if (target && canMove(g, p.from, target)) {
      const next = move(g, p.from, target)
      if (next) {
        apply(g, next)
        tone('place')
        return
      }
    }
    tone('invalid')
    announceMsg(labels.illegal)
  }

  const handleCardClick = (loc: Loc) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (dealAnimRef.current || winPhaseRef.current !== null) return
    const g = gameRef.current
    if (!g || g.won) return
    const dest = destinationOf(loc)
    if (selected && dest && canMove(g, selected, dest)) {
      const next = move(g, selected, dest)
      if (next) {
        apply(g, next)
        tone('place')
        setSelected(null)
        return
      }
    }
    if (selected && sameLoc(selected, loc)) {
      setSelected(null)
      return
    }
    setSelected(loc)
  }

  const handleCardDouble = (loc: Loc) => {
    if (dealAnimRef.current || winPhaseRef.current !== null) return
    const g = gameRef.current
    if (!g || g.won) return
    const target = autoTarget(g, loc)
    if (target) {
      const next = move(g, loc, target)
      if (next) {
        apply(g, next)
        tone('place')
      }
    }
    setSelected(null)
  }

  const handleStockClick = () => {
    if (dealAnimRef.current || winPhaseRef.current !== null) return
    doDraw()
  }

  const handlePileClick = (to: Loc) => {
    if (dealAnimRef.current || winPhaseRef.current !== null) return
    const g = gameRef.current
    if (!g || g.won) return
    if (selected && canMove(g, selected, to)) {
      const next = move(g, selected, to)
      if (next) {
        apply(g, next)
        tone('place')
        setSelected(null)
      }
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (e.ctrlKey || e.metaKey || e.altKey) {
        if ((e.ctrlKey || e.metaKey) && !e.altKey && key === 'z') {
          e.preventDefault()
          undo()
        }
        return
      }
      if (winPhaseRef.current === 'cascade') return
      if (winPhaseRef.current === 'panel') {
        if (key === 'n') {
          e.preventDefault()
          startNew(gameRef.current?.drawCount ?? 1)
        }
        return
      }
      if (dealAnimRef.current) {
        if (key === 'n') {
          e.preventDefault()
          startNew(gameRef.current?.drawCount ?? 1)
        }
        return
      }
      if (key === 'z') {
        e.preventDefault()
        undo()
      } else if (key === 'd') {
        const g = gameRef.current
        if (g && !g.won) {
          e.preventDefault()
          doDraw()
        }
      } else if (key === 'n') {
        e.preventDefault()
        startNew(gameRef.current?.drawCount ?? 1)
      } else if (key === 'a') {
        const g = gameRef.current
        if (g && canAutoFinish(g) && !g.won) {
          e.preventDefault()
          startAutoFinish()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, doDraw, startNew, startAutoFinish])

  const layout = useMemo(() => {
    if (!game) return null
    const slots = computeSlots(game, dealAnim)
    const locs = new Map<string, Loc>()
    if (game.waste.length > 0) {
      const card = game.waste[game.waste.length - 1]
      locs.set(cardId(card), { pile: 'waste' })
    }
    game.foundations.forEach((pile, f) => {
      if (pile.length > 0) locs.set(cardId(pile[pile.length - 1]), { pile: 'foundation', index: f })
    })
    game.tableau.forEach((pile, i) => {
      pile.up.forEach((card, cardIdx) => locs.set(cardId(card), { pile: 'tableau', index: i, card: cardIdx }))
    })
    // Render bottom-to-top so DOM order alone stacks the piles correctly.
    const order = ALL_CARDS.slice().sort((a, b) => (slots.get(cardId(a))?.z ?? 0) - (slots.get(cardId(b))?.z ?? 0))
    return { slots, locs, order }
  }, [game, dealAnim])

  const selectedIds = useMemo(() => {
    const set = new Set<string>()
    if (game && selected) {
      for (const card of runFor(game, selected)) set.add(cardId(card))
    }
    return set
  }, [game, selected])

  const dragPositionFor = (card: Card) => {
    if (!pending || !pending.active) return null
    const idx = pending.cards.findIndex((c) => cardId(c) === cardId(card))
    if (idx < 0) return null
    return {
      x: pending.pointer.x - pending.offset.x,
      y: pending.pointer.y - pending.offset.y - DRAG_LIFT + idx * DRAG_RUN_STEP,
      z: 19,
    }
  }

  const ariaLabelFor = (loc: Loc, card: Card): string => {
    const name = cardName(card, arcade.cards)
    if (loc.pile === 'waste') return labels.cardAtWaste.replace('{card}', name)
    if (loc.pile === 'foundation') return labels.cardAtFoundation.replace('{card}', name).replace('{n}', String(loc.index + 1))
    return labels.cardAtTableau.replace('{card}', name).replace('{n}', String(loc.index + 1))
  }

  const slotButtonClass = 'absolute outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e8d5b0] focus-visible:outline-offset-1'
  const slotButtonStyle = { padding: 0, border: 'none', background: 'transparent' } as const

  return (
    <ArcadeFrame fs={fs} background={ARCADE.felt}>
      <ArcadeStrip
        time={time}
        fs={fs}
        arcade={arcade}
        desktopLabel={desktopLabel}
        backLabel={backLabel}
        onDesktop={onDesktop}
        onBack={onBack}
      />
      <div
        ref={playRef}
        role="group"
        aria-label={labels.table}
        className="relative flex-1 overflow-hidden"
        style={FELT_STYLE}
        onPointerDownCapture={(e) => {
          if (dealAnimRef.current) {
            e.preventDefault()
            skipDeal()
          } else if (winPhaseRef.current === 'cascade') {
            setWinPhase('panel')
          }
        }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) setSelected(null)
        }}
      >
        {game && layout && (
          <>
            {/* Stock: draws, or recycles once the waste can come back. */}
            <button
              type="button"
              className={slotButtonClass}
              style={{ left: COL_X(0), top: TOP_Y, width: CARD_W, height: CARD_H, ...slotButtonStyle }}
              onClick={handleStockClick}
              aria-label={game.stock.length === 0 && game.waste.length > 0 ? labels.recycle : labels.stock}
            >
              {game.stock.length === 0 && <EmptySlot recycle={game.waste.length > 0} />}
            </button>

            {/* Waste: only its top card is playable. */}
            <button
              type="button"
              className={slotButtonClass}
              style={{ left: COL_X(1), top: TOP_Y, width: CARD_W, height: CARD_H, ...slotButtonStyle }}
              onClick={() => setSelected(null)}
              aria-label={labels.waste}
            >
              {game.waste.length === 0 && <EmptySlot />}
            </button>

            {game.foundations.map((pile, f) => (
              <button
                key={`foundation-${f}`}
                type="button"
                className={slotButtonClass}
                style={{ left: FOUND_X(f), top: TOP_Y, width: CARD_W, height: CARD_H, ...slotButtonStyle }}
                onClick={() => handlePileClick({ pile: 'foundation', index: f })}
                aria-label={labels.foundation.replace('{n}', String(f + 1))}
              >
                {pile.length === 0 && <EmptySlot glyph />}
              </button>
            ))}

            {game.tableau.map((pile, i) => {
              const bottom = tableauPileBottom(pile)
              return (
                <button
                  key={`tableau-${i}`}
                  type="button"
                  className={slotButtonClass}
                  style={{ left: COL_X(i), top: TABLEAU_Y, width: CARD_W, height: bottom + 20 - TABLEAU_Y, ...slotButtonStyle }}
                  onClick={() => handlePileClick({ pile: 'tableau', index: i, card: 0 })}
                  aria-label={labels.tableau.replace('{n}', String(i + 1))}
                >
                  {pile.up.length === 0 && pile.down.length === 0 && <EmptySlot />}
                </button>
              )
            })}

            {layout.order.map((card) => {
              const id = cardId(card)
              const slot = layout.slots.get(id)
              if (!slot) return null
              const loc = layout.locs.get(id)
              const dragPos = dragPositionFor(card)
              const ring = selectedIds.has(id)
              return (
                <motion.div
                  key={id}
                  className={loc && slot.faceUp ? 'absolute' : 'absolute pointer-events-none'}
                  style={{ left: 0, top: 0, width: CARD_W, height: CARD_H, zIndex: dragPos ? dragPos.z : 0 }}
                  initial={false}
                  animate={{ x: dragPos ? dragPos.x : slot.x, y: dragPos ? dragPos.y : slot.y }}
                  transition={{ duration: dragPos || reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
                >
                  {loc && slot.faceUp ? (
                    <button
                      type="button"
                      aria-label={ariaLabelFor(loc, card)}
                      className="block outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a2820] focus-visible:outline-offset-1"
                      style={{ padding: 0, border: 'none', background: 'transparent', display: 'block', width: CARD_W, height: CARD_H }}
                      onPointerDown={(e) => handleCardPointerDown(e, loc)}
                      onPointerMove={handleCardPointerMove}
                      onPointerUp={handleCardPointerUp}
                      onClick={() => handleCardClick(loc)}
                      onDoubleClick={() => handleCardDouble(loc)}
                    >
                      <CardSprite card={card} faceUp={slot.faceUp} alt="" ring={ring} shadow={dragPos ? 'strong' : 'normal'} instant={reduceMotion} />
                    </button>
                  ) : (
                    <div aria-hidden className="pointer-events-none" style={{ width: CARD_W, height: CARD_H }}>
                      <CardSprite card={card} faceUp={slot.faceUp} alt="" ring={false} shadow={dragPos ? 'strong' : 'normal'} instant={reduceMotion} />
                    </div>
                  )}
                </motion.div>
              )
            })}
          </>
        )}

        <canvas
          ref={cascadeRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 z-10"
          style={{ width: 536, height: 280 }}
        />

        <div
          className="absolute left-0 right-0 bottom-0 flex items-center gap-3 pl-[10px] pr-2"
          style={{
            height: STATUS_H,
            zIndex: 15,
            backgroundColor: ARCADE.feltDark,
            borderTop: `1px solid ${ARCADE.feltLine}`,
            color: ARCADE.feltText,
            ...PIXEL_FONT,
            fontSize: 8,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>{labels.score.replace('{n}', String(game?.score ?? 0))}</span>
          <span>{labels.time.replace('{t}', fmtTime(elapsed))}</span>
          <span>{labels.moves.replace('{n}', String(game?.moves ?? 0))}</span>
          <span>{labels.draw.replace('{n}', String(game?.drawCount ?? 1))}</span>
          {best > 0 && <span>{labels.best.replace('{n}', best.toLocaleString('en-US'))}</span>}
          <span className="ml-auto flex items-center gap-1.5">
            <ArcadeButton size="sm" tone="dark" disabled={!canUndo} onClick={undo} ariaLabel={labels.undo}>
              {labels.undo}
            </ArcadeButton>
            {game && canAutoFinish(game) && !game.won && (
              <ArcadeButton size="sm" tone="cream" onClick={startAutoFinish} ariaLabel={labels.auto}>
                {labels.auto}
              </ArcadeButton>
            )}
            <span ref={newWrapRef} className="relative inline-flex">
              <ArcadeButton size="sm" tone="cream" onClick={() => setShowNew((s) => !s)} ariaLabel={labels.newGame} title={labels.newGame}>
                {labels.newGame}
              </ArcadeButton>
              {showNew && (
                <ArcadePanel className="absolute bottom-[26px] right-0 z-40 px-2 py-2" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
                  <div role="group" aria-label={labels.newGameMenu} style={{ display: 'contents' }}>
                    <ArcadeButton size="sm" tone="cream" pressed={game?.drawCount === 1} onClick={() => startNew(1)}>
                      {labels.drawOne}
                    </ArcadeButton>
                    <ArcadeButton size="sm" tone="cream" pressed={game?.drawCount === 3} onClick={() => startNew(3)}>
                      {labels.drawThree}
                    </ArcadeButton>
                  </div>
                </ArcadePanel>
              )}
            </span>
          </span>
        </div>

        {winPhase === 'panel' && winStats && (
          <ArcadeOverlay>
            <ArcadePanel
              className="px-6 py-5 text-center"
              style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}
            >
              <p style={{ fontSize: 12, margin: 0 }}>{labels.winTitle}</p>
              <p style={{ fontSize: 9, margin: 0 }}>{labels.winScore.replace('{n}', winStats.score.toLocaleString('en-US'))}</p>
              <p style={{ fontSize: 9, margin: 0 }}>{labels.winTime.replace('{t}', fmtTime(winStats.time))}</p>
              <p style={{ fontSize: 9, margin: 0 }}>{labels.winMoves.replace('{n}', String(winStats.moves))}</p>
              <ArcadeButton size="md" tone="cream" onClick={() => startNew(game?.drawCount ?? 1)} className="mt-1">
                {labels.playAgain}
              </ArcadeButton>
            </ArcadePanel>
          </ArcadeOverlay>
        )}

        <div aria-live="polite" className="sr-only">
          {announce}
        </div>
      </div>
    </ArcadeFrame>
  )
}

// src/components/room/DeskChess.tsx
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
  PIXEL_FONT,
  useFullscreen,
  type DeskGameProps,
} from './DeskArcade'
import { PORTRAIT_STRIP_H, useDeskScreen } from './ScreenStrip'
import { useSfx } from './RoomSfxProvider'
import { useStageScale } from '@/lib/room/useStageScale'
import { CHESS_SAVE_KEY, CHESS_STATS_KEY, readJson, writeJson } from '@/lib/games/storage'
import {
  bestMove,
  capturedPieces,
  isChessState,
  kingSquare,
  legalMoves,
  makeMove,
  newGame,
  squareName,
  status,
  toPgn,
  type ChessDifficulty,
  type ChessState,
  type Color,
  type Move,
  type Piece,
  type PieceType,
  type Square,
} from '@/lib/games/chess-engine'

export interface ChessLabels {
  board: string
  squareEmpty: string
  squarePiece: string
  selected: string
  legalTarget: string
  captureTarget: string
  colors: Record<Color, string>
  pieces: Record<PieceType, string>
  yourMove: string
  thinking: string
  turnOf: string
  check: string
  drawFifty: string
  drawRepetition: string
  drawMaterial: string
  resigned: string
  captured: string
  moves: string
  noMoves: string
  undo: string
  flip: string
  hint: string
  newGame: string
  resign: string
  resignConfirm: string
  copyPgn: string
  pgnCopied: string
  pgnFailed: string
  hintAnnounce: string
  menuTitle: string
  modeCpu: string
  modeTwo: string
  difficulty: string
  levels: string[]
  playAs: string
  white: string
  black: string
  random: string
  autoFlip: string
  start: string
  close: string
  record: string
  promote: string
  youWin: string
  cpuWins: string
  whiteWins: string
  blackWins: string
  drawTitle: string
  stalemateTitle: string
  byCheckmate: string
  byResignation: string
  stalemateReason: string
  playAgain: string
  review: string
  moveAnnounce: string
  hintKeys: string
  hintTouch: string
}

/* ---------- Pixel sprites ---------- */

// 10x10 fill masks ('1' body, '2' detail cut-out). The outline is grown around them at build time.
const MASKS: Record<PieceType, string[]> = {
  p: [
    '..........',
    '....11....',
    '...1111...',
    '...1111...',
    '....11....',
    '...1111...',
    '....11....',
    '...1111...',
    '..111111..',
    '..111111..',
  ],
  r: [
    '.11.11.11.',
    '.11111111.',
    '..111111..',
    '..111111..',
    '..111111..',
    '..111111..',
    '..111111..',
    '.11111111.',
    '1111111111',
    '1111111111',
  ],
  n: [
    '..11.1....',
    '.1111111..',
    '11121111..',
    '11111111..',
    '1111.1111.',
    '....11111.',
    '...111111.',
    '..1111111.',
    '.11111111.',
    '.11111111.',
  ],
  b: [
    '....11....',
    '...1111...',
    '..111211..',
    '..111111..',
    '...1111...',
    '....11....',
    '...1111...',
    '..111111..',
    '.11111111.',
    '.11111111.',
  ],
  q: [
    '....11....',
    '.1..11..1.',
    '.11.11.11.',
    '.11111111.',
    '..111111..',
    '...1111...',
    '...1111...',
    '..111111..',
    '.11111111.',
    '1111111111',
  ],
  k: [
    '....11....',
    '...1111...',
    '....11....',
    '.11111111.',
    '.11111111.',
    '..111111..',
    '...1111...',
    '..111111..',
    '.11111111.',
    '1111111111',
  ],
}

interface SpritePaths { fill: string; line: string; cut: string }

function runPath(cells: boolean[][]): string {
  let d = ''
  cells.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      if (!row[x]) { x++; continue }
      let w = 1
      while (row[x + w]) w++
      d += `M${x} ${y}h${w}v1h-${w}z`
      x += w
    }
  })
  return d
}

function buildSprite(type: PieceType): SpritePaths {
  const N = 12
  const val: number[][] = Array.from({ length: N }, () => new Array<number>(N).fill(0))
  MASKS[type].forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '.') val[y + 1][x + 1] = row[x] === '2' ? 2 : 1
    }
  })
  const solid = (x: number, y: number) => y >= 0 && y < N && x >= 0 && x < N && val[y][x] !== 0
  const fill = Array.from({ length: N }, () => new Array<boolean>(N).fill(false))
  const line = Array.from({ length: N }, () => new Array<boolean>(N).fill(false))
  const cut = Array.from({ length: N }, () => new Array<boolean>(N).fill(false))
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (val[y][x] === 1) fill[y][x] = true
      else if (val[y][x] === 2) cut[y][x] = true
      else {
        let near = false
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (solid(x + dx, y + dy)) near = true
        if (near) line[y][x] = true
      }
    }
  }
  return { fill: runPath(fill), line: runPath(line), cut: runPath(cut) }
}

const SPRITES: Record<PieceType, SpritePaths> = {
  p: buildSprite('p'), n: buildSprite('n'), b: buildSprite('b'),
  r: buildSprite('r'), q: buildSprite('q'), k: buildSprite('k'),
}

const WHITE_FILL = '#f6ead0'
const WHITE_LINE = '#2a1c10'
const BLACK_FILL = '#4a3020'
const BLACK_LINE = '#f0dcb4'

function PieceSprite({ piece, size }: { piece: Piece; size: number }) {
  const sp = SPRITES[piece.type]
  const white = piece.color === 'w'
  const line = white ? WHITE_LINE : BLACK_LINE
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden style={{ display: 'block' }}>
      <path d={sp.line} fill={line} />
      <path d={sp.fill} fill={white ? WHITE_FILL : BLACK_FILL} />
      <path d={sp.cut} fill={line} />
    </svg>
  )
}

/* ---------- Constants and helpers ---------- */

const LIGHT_SQ = '#ecd9b0'
const DARK_SQ = '#a9744f'
const BOARD_FRAME = '#3a2820'
/** Secondary text on the dark panels; ARCADE.phosphorDim is too faint there. */
const MUTED = '#b8a488'
const PANEL_BG = ARCADE.panelDark
const VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const PROMOS: PieceType[] = ['q', 'r', 'b', 'n']
const BORDER = 2
const LAND_S = 34
const PORT_STATUS_H = 22
const PORT_MOVES_MIN = 22
const PORT_CAPTURED_H = 26
const DEFAULT_PORT_S = 38

type Mode = 'cpu' | 'two'
type Side = 'w' | 'b' | 'r'

interface Settings { mode: Mode; difficulty: ChessDifficulty; side: Side; autoFlip: boolean }
interface Config extends Settings { human: Color }
interface Stats { w: number; l: number; d: number }
interface Snapshot { game: ChessState; cfg: Config; resigned: Color | null; flipped: boolean; fresh: boolean }

const DEFAULT_CFG: Config = { mode: 'cpu', difficulty: 2, side: 'w', autoFlip: false, human: 'w' }

function isDifficulty(x: unknown): x is ChessDifficulty {
  return x === 1 || x === 2 || x === 3 || x === 4
}

function loadSnapshot(): Snapshot {
  const raw = readJson(CHESS_SAVE_KEY)
  if (raw && typeof raw === 'object') {
    const s = raw as Record<string, unknown>
    const c = (s.cfg && typeof s.cfg === 'object' ? s.cfg : {}) as Record<string, unknown>
    if (isChessState(s.game)) {
      const cfg: Config = {
        mode: c.mode === 'two' ? 'two' : 'cpu',
        difficulty: isDifficulty(c.difficulty) ? c.difficulty : 2,
        side: c.side === 'b' || c.side === 'r' ? c.side : 'w',
        autoFlip: c.autoFlip === true,
        human: c.human === 'b' ? 'b' : 'w',
      }
      const resigned = s.resigned === 'w' || s.resigned === 'b' ? s.resigned : null
      return { game: s.game, cfg, resigned, flipped: s.flipped === true, fresh: false }
    }
  }
  return { game: newGame(), cfg: DEFAULT_CFG, resigned: null, flipped: false, fresh: true }
}

function loadStats(): Stats {
  const raw = readJson(CHESS_STATS_KEY)
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)
  if (raw && typeof raw === 'object') {
    const s = raw as Record<string, unknown>
    return { w: n(s.w), l: n(s.l), d: n(s.d) }
  }
  return { w: 0, l: 0, d: 0 }
}

/** Rebuilds the position after `moves`, for undo. Null if the saved history does not replay. */
function replay(moves: Move[]): ChessState | null {
  let s = newGame()
  for (const m of moves) {
    const next = makeMove(s, { from: m.from, to: m.to, promotion: m.promotion })
    if (!next) return null
    s = next
  }
  return s
}

function sortedByValue(list: PieceType[]): PieceType[] {
  return [...list].sort((a, b) => VALUE[b] - VALUE[a])
}

function sum(list: PieceType[]): number {
  return list.reduce((t, p) => t + VALUE[p], 0)
}

/* ---------- Component ---------- */

interface DragInfo { from: Square; pointerId: number; sx: number; sy: number; active: boolean; wasSel: boolean }

export function DeskChess({ time, backLabel, desktopLabel, labels, arcade, onBack, onDesktop }: DeskGameProps<ChessLabels>) {
  const fs = useFullscreen()
  const { tone } = useSfx()
  const reduceMotion = useReducedMotion() === true
  const { mobile } = useStageScale()
  const { w: screenW, h: screenH, portrait } = useDeskScreen()

  const [snap] = useState(loadSnapshot)
  const [game, setGame] = useState<ChessState>(snap.game)
  const [cfg, setCfg] = useState<Config>(snap.cfg)
  const [draft, setDraft] = useState<Settings>({ mode: snap.cfg.mode, difficulty: snap.cfg.difficulty, side: snap.cfg.side, autoFlip: snap.cfg.autoFlip })
  const [resigned, setResigned] = useState<Color | null>(snap.resigned)
  const [flipped, setFlipped] = useState(snap.flipped)
  const [menuOpen, setMenuOpen] = useState(snap.fresh)
  const [overShown, setOverShown] = useState(false)
  const [sel, setSel] = useState<Square | null>(null)
  const [cursor, setCursor] = useState<Square>(52)
  const [kbd, setKbd] = useState(false)
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null)
  const [hint, setHint] = useState<{ from: Square; to: Square; san: string } | null>(null)
  const [hintBusy, setHintBusy] = useState(false)
  const [anim, setAnim] = useState<{ n: number; from: Square; to: Square } | null>(null)
  const [drag, setDrag] = useState<{ piece: Piece; from: Square } | null>(null)
  const [stats, setStats] = useState<Stats>(loadStats)
  const [resignArmed, setResignArmed] = useState(false)
  const [pgnState, setPgnState] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [announce, setAnnounce] = useState('')

  const gameRef = useRef(game)
  const gameIdRef = useRef(0)
  const boardRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragInfo | null>(null)
  const dragElRef = useRef<HTMLDivElement>(null)
  const dragPosRef = useRef({ x: 0, y: 0 })
  const movesRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const recordedRef = useRef(false)

  const st = useMemo(() => status(game), [game])
  const over = st.kind !== 'playing' || resigned !== null
  const prevOver = useRef(over)
  const cpuMode = cfg.mode === 'cpu'
  const humanTurn = !cpuMode || game.turn === cfg.human
  const thinking = cpuMode && !over && !menuOpen && game.turn !== cfg.human
  const canInteract = !over && humanTurn && !menuOpen && promo === null
  const flip = flipped !== (cfg.mode === 'two' && cfg.autoFlip && game.turn === 'b')

  // Geometry, in logical px: the landscape board is fixed; the portrait one fills the width and what height is left.
  const bodyH = portrait ? screenH - 2 * PORTRAIT_STRIP_H : 280
  let S = LAND_S
  let showCaptured = false
  if (portrait) {
    const byWidth = Math.floor((screenW - 12 - 2 * BORDER) / 8)
    const byHeight = Math.floor((bodyH - PORT_STATUS_H - PORT_MOVES_MIN - 4 - 2 * BORDER) / 8)
    S = Math.max(24, Math.min(DEFAULT_PORT_S, byWidth, byHeight))
    showCaptured = bodyH - (8 * S + 2 * BORDER) - PORT_STATUS_H - PORT_MOVES_MIN - 4 >= PORT_CAPTURED_H
  }
  const boardPx = S * 8
  const pieceSize = Math.round(S * 0.9)

  const sqAt = useCallback((r: number, c: number): Square => (flip ? (7 - r) * 8 + (7 - c) : r * 8 + c), [flip])
  const rcOf = useCallback((sq: Square): [number, number] => {
    const r = sq >> 3
    const c = sq & 7
    return flip ? [7 - r, 7 - c] : [r, c]
  }, [flip])

  const targets = useMemo(() => {
    const map = new Map<Square, Move>()
    if (sel !== null && canInteract) for (const m of legalMoves(game, sel)) if (!map.has(m.to)) map.set(m.to, m)
    return map
  }, [game, sel, canInteract])

  const lastMove = game.history.length > 0 ? game.history[game.history.length - 1] : null
  const checkSq: Square | null = useMemo(() => {
    if (resigned === null && st.kind === 'playing' && st.check) return kingSquare(game, game.turn)
    if (st.kind === 'checkmate') return kingSquare(game, st.winner === 'w' ? 'b' : 'w')
    return null
  }, [game, st, resigned])

  const caps = useMemo(() => capturedPieces(game), [game])
  const diff = sum(caps.w) - sum(caps.b)

  // Undo: the human's last move, plus the CPU's reply to it when that is what came last.
  const undoK = useMemo(() => {
    const n = game.history.length
    if (n === 0) return 0
    if (cfg.mode === 'two') return 1
    const k = game.history[n - 1].color === cfg.human ? 1 : 2
    return n - k >= (cfg.human === 'b' ? 1 : 0) ? k : 0
  }, [game.history, cfg.mode, cfg.human])
  const canUndo = undoK > 0 && !thinking

  /* ---------- Result ---------- */
  const result = useMemo(() => {
    let winner: Color | null = null
    let reason = ''
    let title = labels.drawTitle
    if (resigned !== null) {
      winner = resigned === 'w' ? 'b' : 'w'
      reason = labels.byResignation
    } else if (st.kind === 'checkmate') {
      winner = st.winner
      reason = labels.byCheckmate
    } else if (st.kind === 'stalemate') {
      title = labels.stalemateTitle
      reason = labels.stalemateReason
    } else if (st.kind === 'draw') {
      reason = st.reason === 'fifty' ? labels.drawFifty : st.reason === 'repetition' ? labels.drawRepetition : labels.drawMaterial
    }
    if (winner) {
      title = cfg.mode === 'cpu' ? (winner === cfg.human ? labels.youWin : labels.cpuWins) : winner === 'w' ? labels.whiteWins : labels.blackWins
    }
    return { winner, title, reason }
  }, [st, resigned, cfg, labels])

  /* ---------- Moves ---------- */
  const applyMove = useCallback(
    (m: { from: Square; to: Square; promotion?: PieceType }, viaDrag: boolean): boolean => {
      const next = makeMove(gameRef.current, m)
      if (!next) {
        tone('invalid')
        return false
      }
      gameRef.current = next
      setGame(next)
      setSel(null)
      setHint(null)
      setPromo(null)
      const mv = next.history[next.history.length - 1]
      setAnim(reduceMotion || viaDrag ? null : { n: next.history.length, from: mv.from, to: mv.to })
      setAnnounce(labels.moveAnnounce.replace('{color}', labels.colors[mv.color]).replace('{san}', mv.san))
      const s = status(next)
      if (s.kind === 'playing') tone(s.check ? 'powerup' : mv.captured ? 'brick' : 'place')
      return true
    },
    [tone, reduceMotion, labels],
  )

  useEffect(() => {
    gameRef.current = game
  }, [game])

  // The CPU's turn: a short beat so "thinking" paints first, then a synchronous search.
  useEffect(() => {
    if (!thinking) return
    const id = gameIdRef.current
    const timer = window.setTimeout(() => {
      if (id !== gameIdRef.current) return
      const g = gameRef.current
      if (g.turn === cfg.human) return
      const m = bestMove(g, cfg.difficulty)
      if (id !== gameIdRef.current || !m) return
      applyMove({ from: m.from, to: m.to, promotion: m.promotion }, false)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [thinking, game, cfg.human, cfg.difficulty, applyMove])

  useEffect(() => () => { gameIdRef.current++ }, [])

  // Game over: sound, the overlay, and the record against the CPU (once per game).
  useEffect(() => {
    if (over && !prevOver.current) {
      setOverShown(true)
      if (cfg.mode === 'cpu') {
        const outcome = result.winner === null ? 'd' : result.winner === cfg.human ? 'w' : 'l'
        tone(outcome === 'w' ? 'win' : outcome === 'l' ? 'lose' : 'score')
        if (!recordedRef.current) {
          recordedRef.current = true
          setStats((s) => {
            const next = { ...s, [outcome]: s[outcome] + 1 }
            writeJson(CHESS_STATS_KEY, next)
            return next
          })
        }
      } else {
        tone(result.winner === null ? 'score' : 'win')
      }
    }
    prevOver.current = over
  }, [over, result, cfg.mode, cfg.human, tone])
  useEffect(() => {
    if (over) recordedRef.current = true
  }, [over])

  // Save the game in progress and its settings.
  useEffect(() => {
    writeJson(CHESS_SAVE_KEY, { game, cfg, resigned, flipped })
  }, [game, cfg, resigned, flipped])

  // Latest move scrolls into view.
  useEffect(() => {
    const el = movesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [game.history.length, portrait])

  useEffect(() => {
    if (!resignArmed) return
    const id = window.setTimeout(() => setResignArmed(false), 3000)
    return () => window.clearTimeout(id)
  }, [resignArmed])

  useEffect(() => {
    if (pgnState === 'idle') return
    const id = window.setTimeout(() => setPgnState('idle'), 1500)
    return () => window.clearTimeout(id)
  }, [pgnState])

  /* ---------- Actions ---------- */
  const overlayOpen = over && overShown && !menuOpen

  const resetBoardUi = () => {
    setSel(null)
    setHint(null)
    setHintBusy(false)
    setPromo(null)
    setAnim(null)
    setDrag(null)
    dragRef.current = null
    setResignArmed(false)
  }

  const startWith = useCallback((s: Settings) => {
    const human: Color = s.side === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : s.side
    const c: Config = { ...s, human }
    gameIdRef.current++
    const g = newGame()
    gameRef.current = g
    setCfg(c)
    setGame(g)
    setResigned(null)
    resetBoardUi()
    setFlipped(c.mode === 'cpu' && human === 'b')
    setCursor(c.mode === 'cpu' && human === 'b' ? 12 : 52)
    setMenuOpen(false)
    setOverShown(false)
    recordedRef.current = false
    prevOver.current = false
    setAnnounce('')
  }, [])

  const doUndo = () => {
    if (!canUndo) return
    const prev = replay(game.history.slice(0, game.history.length - undoK))
    if (!prev) return
    gameIdRef.current++
    gameRef.current = prev
    setGame(prev)
    setResigned(null)
    resetBoardUi()
    setOverShown(false)
    prevOver.current = false
    tone('select')
  }

  const doResign = () => {
    if (over) return
    if (!resignArmed) {
      setResignArmed(true)
      return
    }
    setResignArmed(false)
    setResigned(cfg.mode === 'cpu' ? cfg.human : game.turn)
    setMenuOpen(false)
    resetBoardUi()
  }

  const doHint = () => {
    if (!canInteract || hintBusy) return
    const id = gameIdRef.current
    setHintBusy(true)
    window.setTimeout(() => {
      if (id !== gameIdRef.current) return
      const m = bestMove(gameRef.current, 3)
      setHintBusy(false)
      if (m) {
        setHint({ from: m.from, to: m.to, san: m.san })
        setAnnounce(labels.hintAnnounce.replace('{move}', m.san))
      }
    }, 30)
  }

  const doCopyPgn = () => {
    try {
      const p = navigator.clipboard?.writeText(toPgn(game))
      if (!p) {
        setPgnState('fail')
        return
      }
      p.then(() => setPgnState('ok'), () => setPgnState('fail'))
    } catch {
      setPgnState('fail')
    }
  }

  const focusBoard = () => boardRef.current?.focus({ preventScroll: true })
  /** A mouse click on a toolbar button hands focus back to the board so the keys keep working. */
  const btn = (fn: () => void) => (e: React.MouseEvent) => {
    fn()
    if (e.detail > 0 && !menuOpen) focusBoard()
  }

  /** The same entry point for a click, a tap and the keyboard. */
  const tap = (sq: Square) => {
    if (!canInteract) return
    const g = gameRef.current
    if (sel !== null && sel !== sq) {
      const ms = legalMoves(g, sel).filter((m) => m.to === sq)
      if (ms.length > 0) {
        if (ms.some((m) => m.promotion)) setPromo({ from: sel, to: sq })
        else applyMove({ from: sel, to: sq }, false)
        return
      }
    }
    const p = g.board[sq]
    if (p && p.color === g.turn) {
      if (sel === sq) setSel(null)
      else {
        setSel(sq)
        setHint(null)
        tone('select')
      }
    } else {
      setSel(null)
    }
  }

  const choosePromotion = (type: PieceType) => {
    if (!promo) return
    applyMove({ from: promo.from, to: promo.to, promotion: type }, false)
  }

  /* ---------- Pointer input ---------- */
  const squareFromEvent = (e: React.PointerEvent): Square | null => {
    const el = boardRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const k = rect.width / boardPx
    const x = (e.clientX - rect.left) / k
    const y = (e.clientY - rect.top) / k
    if (x < 0 || y < 0 || x >= boardPx || y >= boardPx) return null
    return sqAt(Math.floor(y / S), Math.floor(x / S))
  }

  const localPoint = (e: React.PointerEvent) => {
    const rect = boardRef.current!.getBoundingClientRect()
    const k = rect.width / boardPx
    return { x: (e.clientX - rect.left) / k, y: (e.clientY - rect.top) / k }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const sq = squareFromEvent(e)
    if (sq === null) return
    setKbd(false)
    setCursor(sq)
    focusBoard()
    if (!canInteract) return
    const g = gameRef.current
    const p = g.board[sq]
    if (p && p.color === g.turn) {
      const wasSel = sel === sq
      if (!wasSel) {
        setSel(sq)
        setHint(null)
        tone('select')
      }
      dragRef.current = { from: sq, pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, active: false, wasSel }
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    } else {
      tap(sq)
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    if (!d.active) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return
      d.active = true
      const p = gameRef.current.board[d.from]
      if (!p) return
      dragPosRef.current = localPoint(e)
      setDrag({ piece: p, from: d.from })
    }
    const pt = localPoint(e)
    dragPosRef.current = pt
    const el = dragElRef.current
    if (el) el.style.transform = `translate(${pt.x - S / 2}px, ${pt.y - S / 2}px)`
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    dragRef.current = null
    setDrag(null)
    if (cancelled) return
    if (!d.active) {
      if (d.wasSel) setSel(null)
      return
    }
    const to = squareFromEvent(e)
    if (to === null || to === d.from) return
    const ms = legalMoves(gameRef.current, d.from).filter((m) => m.to === to)
    if (ms.length === 0) {
      tone('invalid')
      return
    }
    if (ms.some((m) => m.promotion)) setPromo({ from: d.from, to })
    else applyMove({ from: d.from, to }, true)
  }

  /* ---------- Keyboard ---------- */
  const onBoardKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const [r, c] = rcOf(cursor)
    let nr = r
    let nc = c
    switch (e.key) {
      case 'ArrowUp': nr = Math.max(0, r - 1); break
      case 'ArrowDown': nr = Math.min(7, r + 1); break
      case 'ArrowLeft': nc = Math.max(0, c - 1); break
      case 'ArrowRight': nc = Math.min(7, c + 1); break
      case 'Enter':
      case ' ':
        e.preventDefault()
        setKbd(true)
        tap(cursor)
        return
      default:
        return
    }
    e.preventDefault()
    setKbd(true)
    setCursor(sqAt(nr, nc))
  }

  // Escape closes the innermost thing first (promotion, menu, result, selection); only then does it climb
  // DeskView's app -> desktop -> room ladder. The capture phase lets this run ahead of DeskView's listener.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.fullscreenElement) return
      if (promo) setPromo(null)
      else if (menuOpen) setMenuOpen(false)
      else if (overlayOpen) setOverShown(false)
      else if (sel !== null) setSel(null)
      else return
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [promo, menuOpen, overlayOpen, sel])

  useEffect(() => {
    if (!promo) return
    const onKey = (e: KeyboardEvent) => {
      const t = PROMOS.find((p) => p === e.key.toLowerCase())
      if (t && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        choosePromotion(t)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promo])

  // Focus: the board when nothing is covering it, the first button of whichever dialog opened.
  useEffect(() => {
    if (!menuOpen && !overlayOpen && !promo) boardRef.current?.focus({ preventScroll: true })
  }, [menuOpen, overlayOpen, promo, portrait])
  useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector('button')?.focus({ preventScroll: true })
  }, [menuOpen])

  /* ---------- Rendering pieces ---------- */
  const font = portrait ? 12 : 9

  const cellLabel = (sq: Square): string => {
    const p = game.board[sq]
    const name = squareName(sq)
    const base = p
      ? labels.squarePiece.replace('{color}', labels.colors[p.color]).replace('{piece}', labels.pieces[p.type]).replace('{sq}', name)
      : labels.squareEmpty.replace('{sq}', name)
    const extra: string[] = []
    if (sel === sq) extra.push(labels.selected)
    const t = targets.get(sq)
    if (t) extra.push(t.captured || t.enPassant ? labels.captureTarget : labels.legalTarget)
    return extra.length ? `${base}, ${extra.join(', ')}` : base
  }

  const board = (
    <div
      className="relative flex-shrink-0"
      style={{
        width: boardPx + 2 * BORDER,
        height: boardPx + 2 * BORDER,
        backgroundColor: BOARD_FRAME,
        padding: BORDER,
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={boardRef}
        role="grid"
        aria-label={labels.board}
        aria-activedescendant={`chess-sq-${cursor}`}
        tabIndex={0}
        className="relative outline-none overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
        onKeyDown={onBoardKey}
        onBlur={() => setKbd(false)}
        style={{ width: boardPx, height: boardPx, touchAction: 'none', cursor: canInteract ? 'pointer' : 'default' }}
      >
        {Array.from({ length: 8 }, (_, r) => (
          <div key={r} role="row" className="absolute left-0" style={{ top: r * S, width: boardPx, height: S }}>
            {Array.from({ length: 8 }, (_, c) => {
              const sq = sqAt(r, c)
              const piece = game.board[sq]
              const dark = ((sq >> 3) + (sq & 7)) % 2 === 1
              const isLast = lastMove !== null && (sq === lastMove.from || sq === lastMove.to)
              const target = targets.get(sq)
              const isCapture = target !== undefined && (target.captured !== undefined || target.enPassant === true)
              const hinted = hint !== null && (sq === hint.from || sq === hint.to)
              const sliding = anim !== null && anim.n === game.history.length && anim.to === sq && piece
              const dragging = drag !== null && drag.from === sq
              let slideFrom: [number, number] | null = null
              if (sliding) {
                const [fr, fc] = rcOf(anim.from)
                slideFrom = [(fc - c) * S, (fr - r) * S]
              }
              const labelColor = dark ? '#ecd9b0' : '#8a5a3a'
              const sprite = piece && (
                <PieceSprite piece={piece} size={pieceSize} />
              )
              return (
                <div
                  key={c}
                  id={`chess-sq-${sq}`}
                  role="gridcell"
                  aria-label={cellLabel(sq)}
                  aria-selected={sel === sq}
                  className="absolute"
                  style={{
                    left: c * S,
                    top: 0,
                    width: S,
                    height: S,
                    backgroundColor: dark ? DARK_SQ : LIGHT_SQ,
                  }}
                >
                  {isLast && <span aria-hidden className="absolute inset-0" style={{ backgroundColor: 'rgba(232,168,58,0.5)' }} />}
                  {sel === sq && <span aria-hidden className="absolute inset-0" style={{ backgroundColor: 'rgba(122,154,74,0.65)' }} />}
                  {checkSq === sq && (
                    <span aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(179,55,44,0.95) 0%, rgba(179,55,44,0.75) 45%, rgba(179,55,44,0) 80%)' }} />
                  )}
                  {hinted && <span aria-hidden className="absolute inset-0" style={{ boxShadow: `inset 0 0 0 2px ${ARCADE.teal}`, backgroundColor: 'rgba(74,138,134,0.25)' }} />}
                  {c === 0 && (
                    <span aria-hidden className="absolute" style={{ left: 2, top: 1, fontSize: portrait ? 10 : 8, lineHeight: 1, color: labelColor, ...PIXEL_FONT }}>
                      {8 - (sq >> 3)}
                    </span>
                  )}
                  {r === 7 && (
                    <span aria-hidden className="absolute" style={{ right: 2, bottom: 1, fontSize: portrait ? 10 : 8, lineHeight: 1, color: labelColor, ...PIXEL_FONT }}>
                      {'abcdefgh'[sq & 7]}
                    </span>
                  )}
                  {piece && (
                    sliding && slideFrom ? (
                      <motion.div
                        key={`slide-${anim.n}`}
                        initial={{ x: slideFrom[0], y: slideFrom[1] }}
                        animate={{ x: 0, y: 0 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        style={{ zIndex: 5 }}
                      >
                        {sprite}
                      </motion.div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: dragging ? 0.35 : 1 }}>
                        {sprite}
                      </div>
                    )
                  )}
                  {target && !isCapture && (
                    <span aria-hidden className="absolute rounded-full pointer-events-none" style={{ left: '50%', top: '50%', width: S * 0.3, height: S * 0.3, marginLeft: -S * 0.15, marginTop: -S * 0.15, backgroundColor: 'rgba(42,28,16,0.4)' }} />
                  )}
                  {target && isCapture && (
                    <span aria-hidden className="absolute rounded-full pointer-events-none" style={{ inset: 1, border: `${Math.max(3, Math.round(S * 0.1))}px solid rgba(42,28,16,0.45)` }} />
                  )}
                  {kbd && cursor === sq && (
                    <span aria-hidden className="absolute inset-0 pointer-events-none" style={{ outline: `2px solid ${ARCADE.rust}`, outlineOffset: -2, boxShadow: 'inset 0 0 0 4px rgba(250,248,245,0.7)' }} />
                  )}
                </div>
              )
            })}
          </div>
        ))}
        {drag && (
          <div
            ref={dragElRef}
            aria-hidden
            className="absolute left-0 top-0 flex items-center justify-center pointer-events-none"
            style={{ width: S, height: S, zIndex: 20, transform: `translate(${dragPosRef.current.x - S / 2}px, ${dragPosRef.current.y - S / 2}px)` }}
          >
            <PieceSprite piece={drag.piece} size={Math.round(S * 1.1)} />
          </div>
        )}
      </div>

      {promo && (
        <ArcadeOverlay>
          <div role="group" aria-label={labels.promote}>
            <ArcadePanel className="px-3 py-2" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: font }}>{labels.promote}</p>
              <div className="flex gap-1.5">
                {PROMOS.map((t) => (
                  <ArcadeButton
                    key={t}
                    size={portrait ? 'xl' : 'lg'}
                    tone="cream"
                    ariaLabel={labels.pieces[t]}
                    onClick={() => choosePromotion(t)}
                  >
                    <PieceSprite piece={{ color: game.turn, type: t }} size={portrait ? 26 : 22} />
                  </ArcadeButton>
                ))}
              </div>
            </ArcadePanel>
          </div>
        </ArcadeOverlay>
      )}
    </div>
  )

  /* ---------- Panels ---------- */
  const turnText = cpuMode
    ? thinking ? labels.thinking : humanTurn ? labels.yourMove : labels.thinking
    : labels.turnOf.replace('{color}', labels.colors[game.turn])
  const statusLine = over
    ? `${result.title}, ${result.reason}`
    : st.kind === 'playing' && st.check
      ? `${turnText} ${labels.check}`
      : turnText
  const swatch = (c: Color, size = 10) => (
    <span
      aria-hidden
      className="inline-block flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: c === 'w' ? WHITE_FILL : BLACK_FILL, border: `2px solid ${c === 'w' ? WHITE_LINE : BLACK_LINE}`, boxSizing: 'border-box' }}
    />
  )
  const turnColor: Color = over && result.winner ? result.winner : game.turn

  const capturedRow = (color: Color, size: number) => {
    // caps.w are the black pieces White took; caps.b the white pieces Black took.
    const list = sortedByValue(color === 'w' ? caps.w : caps.b)
    const lead = color === 'w' ? diff : -diff
    const taken: Color = color === 'w' ? 'b' : 'w'
    return (
      <div className="flex items-center gap-1 min-w-0" style={{ minHeight: size + 2 }}>
        {swatch(color, 8)}
        <div className="flex items-center min-w-0 flex-wrap" style={{ gap: 0 }}>
          {list.map((t, i) => (
            <span key={i} style={{ marginRight: -2 }}><PieceSprite piece={{ color: taken, type: t }} size={size} /></span>
          ))}
        </div>
        {lead > 0 && <span style={{ fontSize: font, color: ARCADE.amber, ...PIXEL_FONT }}>+{lead}</span>}
      </div>
    )
  }

  const groups = useMemo(() => {
    const out: { n: number; w?: string; b?: string; lastIdx: number }[] = []
    game.history.forEach((m, i) => {
      if (m.color === 'w') out.push({ n: out.length + 1, w: m.san, lastIdx: i })
      else {
        const g = out[out.length - 1]
        if (g && g.b === undefined && g.w !== undefined) { g.b = m.san; g.lastIdx = i }
        else out.push({ n: out.length + 1, b: m.san, lastIdx: i })
      }
    })
    return out
  }, [game.history])

  const moveList = (
    <div
      ref={movesRef}
      aria-label={labels.moves}
      className="flex-1 min-h-0 w-full overflow-y-auto flex flex-wrap content-start"
      style={{ gap: portrait ? '2px 10px' : '1px 8px', padding: portrait ? '2px 6px' : '3px 5px', fontSize: portrait ? 12 : 9, lineHeight: 1.35, color: ARCADE.panelText, backgroundColor: portrait ? ARCADE.panel : ARCADE.crt, ...PIXEL_FONT }}
    >
      {groups.length === 0 && <span style={{ color: ARCADE.inkSoft }}>{portrait ? labels.hintTouch : labels.noMoves}</span>}
      {groups.map((g) => (
        <span key={g.n} className="whitespace-nowrap">
          <span style={{ color: ARCADE.inkSoft }}>{g.n}.</span>{' '}
          {g.w !== undefined && (
            <span style={{ color: g.lastIdx === game.history.length - 1 && g.b === undefined ? ARCADE.amber : undefined }}>{g.w}</span>
          )}
          {g.b !== undefined && (
            <>
              {g.w !== undefined ? ' ' : '… '}
              <span style={{ color: g.lastIdx === game.history.length - 1 ? ARCADE.amber : undefined }}>{g.b}</span>
            </>
          )}
        </span>
      ))}
    </div>
  )

  const pgnLabel = pgnState === 'ok' ? labels.pgnCopied : pgnState === 'fail' ? labels.pgnFailed : labels.copyPgn
  const resignLabel = resignArmed ? labels.resignConfirm : labels.resign

  const menuButtonSize = portrait ? 'xl' : 'md'
  const settingRow = (children: React.ReactNode) => <div className="flex gap-1.5 justify-center">{children}</div>
  const inProgress = !over && game.history.length > 0

  const menu = menuOpen && (
    <ArcadeOverlay>
      <div ref={menuRef} role="group" aria-label={labels.menuTitle} className="overflow-y-auto" style={{ maxHeight: '100%' }}>
        <ArcadePanel className="px-4 py-3" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch', width: portrait ? 296 : 330 }}>
          <p style={{ fontSize: portrait ? 14 : 12, margin: 0, textAlign: 'center' }}>{labels.menuTitle}</p>
          {settingRow(
            <>
              <ArcadeButton size={menuButtonSize} pressed={draft.mode === 'cpu'} onClick={() => setDraft((d) => ({ ...d, mode: 'cpu' }))}>{labels.modeCpu}</ArcadeButton>
              <ArcadeButton size={menuButtonSize} pressed={draft.mode === 'two'} onClick={() => setDraft((d) => ({ ...d, mode: 'two' }))}>{labels.modeTwo}</ArcadeButton>
            </>,
          )}
          {draft.mode === 'cpu' ? (
            <>
              <p style={{ fontSize: font, margin: 0, textAlign: 'center', color: MUTED }}>{labels.difficulty}</p>
              <div className={portrait ? 'grid grid-cols-2 gap-1.5' : 'flex gap-1.5 justify-center'}>
                {([1, 2, 3, 4] as ChessDifficulty[]).map((lv) => (
                  <ArcadeButton key={lv} size={menuButtonSize} pressed={draft.difficulty === lv} onClick={() => setDraft((d) => ({ ...d, difficulty: lv }))}>
                    {labels.levels[lv - 1]}
                  </ArcadeButton>
                ))}
              </div>
              <p style={{ fontSize: font, margin: 0, textAlign: 'center', color: MUTED }}>{labels.playAs}</p>
              {settingRow(
                <>
                  <ArcadeButton size={menuButtonSize} pressed={draft.side === 'w'} onClick={() => setDraft((d) => ({ ...d, side: 'w' }))}>{labels.white}</ArcadeButton>
                  <ArcadeButton size={menuButtonSize} pressed={draft.side === 'b'} onClick={() => setDraft((d) => ({ ...d, side: 'b' }))}>{labels.black}</ArcadeButton>
                  <ArcadeButton size={menuButtonSize} pressed={draft.side === 'r'} onClick={() => setDraft((d) => ({ ...d, side: 'r' }))}>{labels.random}</ArcadeButton>
                </>,
              )}
              <p style={{ fontSize: font, margin: 0, textAlign: 'center', color: MUTED }}>
                {labels.record.replace('{w}', String(stats.w)).replace('{l}', String(stats.l)).replace('{d}', String(stats.d))}
              </p>
            </>
          ) : (
            settingRow(
              <ArcadeButton size={menuButtonSize} pressed={draft.autoFlip} onClick={() => setDraft((d) => ({ ...d, autoFlip: !d.autoFlip }))}>{labels.autoFlip}</ArcadeButton>,
            )
          )}
          {settingRow(
            <>
              <ArcadeButton size={menuButtonSize} onClick={() => startWith(draft)}>{labels.start}</ArcadeButton>
              <ArcadeButton size={menuButtonSize} onClick={() => setMenuOpen(false)}>{labels.close}</ArcadeButton>
            </>,
          )}
          {portrait && inProgress && settingRow(
            <>
              <ArcadeButton size="xl" onClick={doResign}>{resignLabel}</ArcadeButton>
              <ArcadeButton size="xl" onClick={doCopyPgn}>{pgnLabel}</ArcadeButton>
            </>,
          )}
        </ArcadePanel>
      </div>
    </ArcadeOverlay>
  )

  const overOverlay = overlayOpen && (
    <ArcadeOverlay>
      <ArcadePanel className="px-6 py-4 text-center" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
        <p style={{ fontSize: portrait ? 16 : 14, margin: 0 }}>{result.title}</p>
        <p style={{ fontSize: font + 1, margin: 0, color: MUTED }}>{result.reason}</p>
        {cfg.mode === 'cpu' && (
          <p style={{ fontSize: font, margin: 0 }}>
            {labels.record.replace('{w}', String(stats.w)).replace('{l}', String(stats.l)).replace('{d}', String(stats.d))}
          </p>
        )}
        <div className="flex gap-1.5 mt-1">
          <ArcadeButton size={portrait ? 'xl' : 'md'} onClick={() => startWith({ mode: cfg.mode, difficulty: cfg.difficulty, side: cfg.side, autoFlip: cfg.autoFlip })}>
            {labels.playAgain}
          </ArcadeButton>
          <ArcadeButton size={portrait ? 'xl' : 'md'} onClick={() => setOverShown(false)}>{labels.review}</ArcadeButton>
        </div>
      </ArcadePanel>
    </ArcadeOverlay>
  )

  const toolbarButtons = (
    <>
      <ArcadeButton size="xl" tone="dark" disabled={!canUndo} onClick={btn(doUndo)} ariaLabel={labels.undo}>{labels.undo}</ArcadeButton>
      <ArcadeButton size="xl" tone="dark" onClick={btn(() => setFlipped((f) => !f))} ariaLabel={labels.flip}>{labels.flip}</ArcadeButton>
      <ArcadeButton size="xl" tone="dark" disabled={!canInteract || hintBusy} onClick={btn(doHint)} ariaLabel={labels.hint}>{labels.hint}</ArcadeButton>
      <ArcadeButton size="xl" tone="dark" onClick={() => { setDraft({ mode: cfg.mode, difficulty: cfg.difficulty, side: cfg.side, autoFlip: cfg.autoFlip }); setMenuOpen(true) }} ariaLabel={labels.newGame}>{labels.newGame}</ArcadeButton>
    </>
  )

  const statusBlock = (
    <div className="flex items-center gap-1.5 min-w-0" aria-live="off">
      {swatch(turnColor, portrait ? 12 : 10)}
      <span className={portrait ? 'truncate' : ''} style={{ fontSize: portrait ? 12 : 10, color: ARCADE.panelText, lineHeight: 1.25, ...PIXEL_FONT }}>{statusLine}</span>
    </div>
  )

  return (
    <ArcadeFrame fs={fs} background={PANEL_BG} portrait>
      <ArcadeStrip time={time} fs={fs} arcade={arcade} desktopLabel={desktopLabel} backLabel={backLabel} onDesktop={onDesktop} onBack={onBack}>
        {portrait && toolbarButtons}
      </ArcadeStrip>

      <div className="relative flex-1 min-h-0 overflow-hidden" style={{ backgroundColor: PANEL_BG }}>
        {portrait ? (
          <div className="absolute inset-0 flex flex-col items-center" style={{ gap: 2 }}>
            <div className="flex items-center justify-between gap-2 w-full flex-shrink-0 px-2" style={{ height: PORT_STATUS_H }}>
              {statusBlock}
              {diff !== 0 && (
                <span className="flex-shrink-0" style={{ fontSize: 12, color: ARCADE.amber, ...PIXEL_FONT }}>
                  {diff > 0 ? `${labels.colors.w[0]}+${diff}` : `${labels.colors.b[0]}+${-diff}`}
                </span>
              )}
            </div>
            {board}
            {showCaptured && (
              <div className="flex items-center justify-between gap-2 w-full flex-shrink-0 px-2" style={{ height: PORT_CAPTURED_H }}>
                {capturedRow('w', 14)}
                {capturedRow('b', 14)}
              </div>
            )}
            {moveList}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center" style={{ paddingLeft: 6, gap: 8 }}>
            {board}
            <div className="flex flex-col min-w-0 flex-1 self-stretch" style={{ gap: 4, padding: '4px 6px 4px 0' }}>
              <div style={{ minHeight: 28 }} className="flex items-center">{statusBlock}</div>
              <div className="flex flex-col" style={{ gap: 2 }}>
                <span style={{ fontSize: 8, lineHeight: 1, color: MUTED, ...PIXEL_FONT }}>{labels.captured}</span>
                {capturedRow('w', 14)}
                {capturedRow('b', 14)}
              </div>
              <ArcadePanel className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ backgroundColor: ARCADE.crt }}>
                {moveList}
              </ArcadePanel>
              <div className="grid grid-cols-3" style={{ gap: 4 }}>
                <ArcadeButton size="sm" tone="dark" disabled={!canUndo} onClick={btn(doUndo)}>{labels.undo}</ArcadeButton>
                <ArcadeButton size="sm" tone="dark" onClick={btn(() => setFlipped((f) => !f))}>{labels.flip}</ArcadeButton>
                <ArcadeButton size="sm" tone="dark" disabled={!canInteract || hintBusy} onClick={btn(doHint)}>{labels.hint}</ArcadeButton>
                <ArcadeButton size="sm" tone="dark" onClick={() => { setDraft({ mode: cfg.mode, difficulty: cfg.difficulty, side: cfg.side, autoFlip: cfg.autoFlip }); setMenuOpen(true) }}>{labels.newGame}</ArcadeButton>
                <ArcadeButton size="sm" tone="dark" disabled={over} onClick={btn(doResign)}>{resignLabel}</ArcadeButton>
                <ArcadeButton size="sm" tone="dark" onClick={btn(doCopyPgn)}>{pgnLabel}</ArcadeButton>
              </div>
              <p style={{ margin: 0, fontSize: 8, color: MUTED, lineHeight: 1.2, ...PIXEL_FONT }}>{mobile ? labels.hintTouch : labels.hintKeys}</p>
            </div>
          </div>
        )}

        {menu}
        {overOverlay}

        <div aria-live="polite" className="sr-only">
          {announce} {statusLine}
        </div>
      </div>
    </ArcadeFrame>
  )
}

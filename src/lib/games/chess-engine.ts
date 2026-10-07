// src/lib/games/chess-engine.ts
/**
 * Pure chess logic plus a time-bounded AI opponent. No DOM, no React.
 *
 * The public API is immutable: every function takes a ChessState and returns
 * new data. Internally, move generation, legality checks, perft and the AI all
 * run on a scratch `Pos` (a typed-array board with make/unmake), which is
 * rebuilt from the state at each public entry point.
 */

export type Color = 'w' | 'b'
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export interface Piece {
  color: Color
  type: PieceType
}
/** 0..63, row-major from White's view: 0 = a8, 7 = h8, 56 = a1, 63 = h1. */
export type Square = number

export interface Move {
  from: Square
  to: Square
  color: Color
  piece: PieceType
  captured?: PieceType
  /** 'q' | 'r' | 'b' | 'n' */
  promotion?: PieceType
  castle?: 'k' | 'q'
  enPassant?: boolean
  /** Pawn two-step. */
  double?: boolean
  /** Standard algebraic notation, with + / # suffix. */
  san: string
}

export interface ChessState {
  board: (Piece | null)[]
  turn: Color
  castling: { wk: boolean; wq: boolean; bk: boolean; bq: boolean }
  /** Target square behind a pawn that just double-stepped. */
  enPassant: Square | null
  /** Fifty-move clock (plies since the last capture or pawn move). */
  halfmove: number
  fullmove: number
  /** Every move played from the start position. */
  history: Move[]
  /** Repetition keys (board+turn+castling+ep) of every position reached, including the current one. */
  positions: string[]
}

export type GameStatus =
  | { kind: 'playing'; check: boolean }
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'stalemate' }
  | { kind: 'draw'; reason: 'fifty' | 'repetition' | 'material' }

export type ChessDifficulty = 1 | 2 | 3 | 4

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

// ---------------------------------------------------------------------------
// Internal representation
// ---------------------------------------------------------------------------

// Piece codes: type (1..6) | colour << 3. 0 is an empty square.
const P = 1
const N = 2
const B = 3
const R = 4
const Q = 5
const K = 6
const TYPE_CHARS = 'pnbrqk'

// Internal move: from | to << 6 | promo << 12 | flag << 15.
const F_DOUBLE = 1
const F_EP = 2
const F_CK = 3
const F_CQ = 4

// Castling bits.
const C_WK = 1
const C_WQ = 2
const C_BK = 4
const C_BQ = 8

const UNDO_DEPTH = 512

interface Pos {
  b: Int8Array
  /** 0 = white, 1 = black. */
  turn: number
  castle: number
  /** Raw en-passant target, -1 for none. */
  ep: number
  half: number
  full: number
  h1: number
  h2: number
  king: Int32Array
  n: number
  uCap: Int8Array
  uCastle: Uint8Array
  uEp: Int8Array
  uHalf: Int16Array
  uH1: Int32Array
  uH2: Int32Array
}

// Square geometry tables.
const KNIGHT_T: number[][] = []
const KING_T: number[][] = []
const PAWN_ATT: number[][][] = [[], []]
/** RAYS[sq * 8 + dir]: dirs 0..3 are orthogonal, 4..7 diagonal. */
const RAYS: number[][] = []
const DIRS = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 1],
  [1, 1],
  [1, -1],
  [-1, -1],
]
const CMASK = new Uint8Array(64).fill(15)

function initTables() {
  const KN = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ]
  for (let sq = 0; sq < 64; sq++) {
    const r = sq >> 3
    const c = sq & 7
    const inb = (rr: number, cc: number) => rr >= 0 && rr < 8 && cc >= 0 && cc < 8
    KNIGHT_T[sq] = KN.filter(([dr, dc]) => inb(r + dr, c + dc)).map(([dr, dc]) => (r + dr) * 8 + c + dc)
    const kings: number[] = []
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && inb(r + dr, c + dc)) kings.push((r + dr) * 8 + c + dc)
    KING_T[sq] = kings
    // White pawns attack toward lower row indices, black toward higher.
    PAWN_ATT[0][sq] = [-1, 1].filter((dc) => inb(r - 1, c + dc)).map((dc) => (r - 1) * 8 + c + dc)
    PAWN_ATT[1][sq] = [-1, 1].filter((dc) => inb(r + 1, c + dc)).map((dc) => (r + 1) * 8 + c + dc)
    for (let d = 0; d < 8; d++) {
      const ray: number[] = []
      let rr = r + DIRS[d][0]
      let cc = c + DIRS[d][1]
      while (inb(rr, cc)) {
        ray.push(rr * 8 + cc)
        rr += DIRS[d][0]
        cc += DIRS[d][1]
      }
      RAYS[sq * 8 + d] = ray
    }
  }
  CMASK[60] = ~(C_WK | C_WQ) & 15
  CMASK[63] = ~C_WK & 15
  CMASK[56] = ~C_WQ & 15
  CMASK[4] = ~(C_BK | C_BQ) & 15
  CMASK[7] = ~C_BK & 15
  CMASK[0] = ~C_BQ & 15
}
initTables()

// Zobrist keys, two independent 32-bit halves (deterministic PRNG).
const Z1 = new Int32Array(16 * 64)
const Z2 = new Int32Array(16 * 64)
const ZC1 = new Int32Array(16)
const ZC2 = new Int32Array(16)
const ZE1 = new Int32Array(8)
const ZE2 = new Int32Array(8)
let ZS1 = 0
let ZS2 = 0
;(function initZobrist() {
  let seed = 0x9e3779b9
  const next = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return (t ^ (t >>> 14)) | 0
  }
  for (let i = 0; i < Z1.length; i++) {
    Z1[i] = next()
    Z2[i] = next()
  }
  for (let i = 0; i < 16; i++) {
    ZC1[i] = next()
    ZC2[i] = next()
  }
  for (let i = 0; i < 8; i++) {
    ZE1[i] = next()
    ZE2[i] = next()
  }
  ZS1 = next()
  ZS2 = next()
})()

function newPosObj(): Pos {
  return {
    b: new Int8Array(64),
    turn: 0,
    castle: 0,
    ep: -1,
    half: 0,
    full: 1,
    h1: 0,
    h2: 0,
    king: new Int32Array([-1, -1]),
    n: 0,
    uCap: new Int8Array(UNDO_DEPTH),
    uCastle: new Uint8Array(UNDO_DEPTH),
    uEp: new Int8Array(UNDO_DEPTH),
    uHalf: new Int16Array(UNDO_DEPTH),
    uH1: new Int32Array(UNDO_DEPTH),
    uH2: new Int32Array(UNDO_DEPTH),
  }
}

function computeHash(p: Pos) {
  let h1 = 0
  let h2 = 0
  for (let sq = 0; sq < 64; sq++) {
    const pc = p.b[sq]
    if (pc) {
      h1 ^= Z1[pc * 64 + sq]
      h2 ^= Z2[pc * 64 + sq]
    }
  }
  h1 ^= ZC1[p.castle]
  h2 ^= ZC2[p.castle]
  if (p.turn === 1) {
    h1 ^= ZS1
    h2 ^= ZS2
  }
  p.h1 = h1
  p.h2 = h2
}

/** True when a pawn of the side to move sits next to the en-passant target (key-relevant ep). */
function epCapturable(p: Pos): boolean {
  if (p.ep < 0) return false
  const mine = P | (p.turn << 3)
  const from = PAWN_ATT[p.turn ^ 1][p.ep]
  for (let i = 0; i < from.length; i++) if (p.b[from[i]] === mine) return true
  return false
}

function isAttacked(p: Pos, sq: number, by: number): boolean {
  if (sq < 0) return false
  const b = p.b
  const pawn = P | (by << 3)
  const pa = PAWN_ATT[by ^ 1][sq]
  for (let i = 0; i < pa.length; i++) if (b[pa[i]] === pawn) return true
  const knight = N | (by << 3)
  const kn = KNIGHT_T[sq]
  for (let i = 0; i < kn.length; i++) if (b[kn[i]] === knight) return true
  const king = K | (by << 3)
  const kg = KING_T[sq]
  for (let i = 0; i < kg.length; i++) if (b[kg[i]] === king) return true
  for (let d = 0; d < 8; d++) {
    const ray = RAYS[sq * 8 + d]
    for (let i = 0; i < ray.length; i++) {
      const pc = b[ray[i]]
      if (pc === 0) continue
      if (pc >> 3 === by) {
        const t = pc & 7
        if (t === Q || (d < 4 ? t === R : t === B)) return true
      }
      break
    }
  }
  return false
}

/** Pseudo-legal generation into buf[base..]; returns the count. `capOnly` = captures and queen promotions. */
function genPseudo(p: Pos, buf: Int32Array, base: number, capOnly: boolean): number {
  const b = p.b
  const us = p.turn
  const them = us ^ 1
  let n = base
  for (let sq = 0; sq < 64; sq++) {
    const pc = b[sq]
    if (pc === 0 || pc >> 3 !== us) continue
    const t = pc & 7
    if (t === P) {
      const fwd = us === 0 ? -8 : 8
      const startRow = us === 0 ? 6 : 1
      const lastRow = us === 0 ? 0 : 7
      const to = sq + fwd
      if (b[to] === 0) {
        if (to >> 3 === lastRow) {
          buf[n++] = sq | (to << 6) | (Q << 12)
          if (!capOnly) {
            buf[n++] = sq | (to << 6) | (R << 12)
            buf[n++] = sq | (to << 6) | (B << 12)
            buf[n++] = sq | (to << 6) | (N << 12)
          }
        } else if (!capOnly) {
          buf[n++] = sq | (to << 6)
          if (sq >> 3 === startRow && b[to + fwd] === 0) buf[n++] = sq | ((to + fwd) << 6) | (F_DOUBLE << 15)
        }
      }
      const att = PAWN_ATT[us][sq]
      for (let i = 0; i < att.length; i++) {
        const tt = att[i]
        const tp = b[tt]
        if (tp !== 0 && tp >> 3 === them) {
          if (tt >> 3 === lastRow) {
            buf[n++] = sq | (tt << 6) | (Q << 12)
            if (!capOnly) {
              buf[n++] = sq | (tt << 6) | (R << 12)
              buf[n++] = sq | (tt << 6) | (B << 12)
              buf[n++] = sq | (tt << 6) | (N << 12)
            }
          } else buf[n++] = sq | (tt << 6)
        } else if (tt === p.ep && tp === 0) {
          buf[n++] = sq | (tt << 6) | (F_EP << 15)
        }
      }
    } else if (t === N || t === K) {
      const list = t === N ? KNIGHT_T[sq] : KING_T[sq]
      for (let i = 0; i < list.length; i++) {
        const tt = list[i]
        const tp = b[tt]
        if (tp === 0 ? !capOnly : tp >> 3 === them) buf[n++] = sq | (tt << 6)
      }
    } else {
      const d0 = t === R ? 0 : t === B ? 4 : 0
      const d1 = t === R ? 4 : t === B ? 8 : 8
      for (let d = d0; d < d1; d++) {
        const ray = RAYS[sq * 8 + d]
        for (let i = 0; i < ray.length; i++) {
          const tt = ray[i]
          const tp = b[tt]
          if (tp === 0) {
            if (!capOnly) buf[n++] = sq | (tt << 6)
          } else {
            if (tp >> 3 === them) buf[n++] = sq | (tt << 6)
            break
          }
        }
      }
    }
  }
  if (!capOnly) {
    if (us === 0 && b[60] === (K | 0)) {
      if (p.castle & C_WK && b[61] === 0 && b[62] === 0 && b[63] === R && !isAttacked(p, 60, 1) && !isAttacked(p, 61, 1))
        buf[n++] = 60 | (62 << 6) | (F_CK << 15)
      if (
        p.castle & C_WQ &&
        b[59] === 0 &&
        b[58] === 0 &&
        b[57] === 0 &&
        b[56] === R &&
        !isAttacked(p, 60, 1) &&
        !isAttacked(p, 59, 1)
      )
        buf[n++] = 60 | (58 << 6) | (F_CQ << 15)
    } else if (us === 1 && b[4] === (K | 8)) {
      const rook = R | 8
      if (p.castle & C_BK && b[5] === 0 && b[6] === 0 && b[7] === rook && !isAttacked(p, 4, 0) && !isAttacked(p, 5, 0))
        buf[n++] = 4 | (6 << 6) | (F_CK << 15)
      if (
        p.castle & C_BQ &&
        b[3] === 0 &&
        b[2] === 0 &&
        b[1] === 0 &&
        b[0] === rook &&
        !isAttacked(p, 4, 0) &&
        !isAttacked(p, 3, 0)
      )
        buf[n++] = 4 | (2 << 6) | (F_CQ << 15)
    }
  }
  return n - base
}

function make(p: Pos, m: number) {
  const from = m & 63
  const to = (m >> 6) & 63
  const promo = (m >> 12) & 7
  const flag = m >> 15
  const us = p.turn
  const b = p.b
  const piece = b[from]
  let capSq = to
  if (flag === F_EP) capSq = us === 0 ? to + 8 : to - 8
  const cap = b[capSq]
  const i = p.n++
  p.uCap[i] = cap
  p.uCastle[i] = p.castle
  p.uEp[i] = p.ep
  p.uHalf[i] = p.half
  p.uH1[i] = p.h1
  p.uH2[i] = p.h2
  let h1 = p.h1 ^ Z1[piece * 64 + from]
  let h2 = p.h2 ^ Z2[piece * 64 + from]
  if (cap) {
    h1 ^= Z1[cap * 64 + capSq]
    h2 ^= Z2[cap * 64 + capSq]
    b[capSq] = 0
  }
  const placed = promo ? promo | (us << 3) : piece
  b[from] = 0
  b[to] = placed
  h1 ^= Z1[placed * 64 + to]
  h2 ^= Z2[placed * 64 + to]
  if (flag === F_CK || flag === F_CQ) {
    const rf = flag === F_CK ? to + 1 : to - 2
    const rt = flag === F_CK ? to - 1 : to + 1
    const rook = b[rf]
    b[rf] = 0
    b[rt] = rook
    h1 ^= Z1[rook * 64 + rf] ^ Z1[rook * 64 + rt]
    h2 ^= Z2[rook * 64 + rf] ^ Z2[rook * 64 + rt]
  }
  const nc = p.castle & CMASK[from] & CMASK[to]
  if (nc !== p.castle) {
    h1 ^= ZC1[p.castle] ^ ZC1[nc]
    h2 ^= ZC2[p.castle] ^ ZC2[nc]
    p.castle = nc
  }
  p.ep = flag === F_DOUBLE ? (from + to) >> 1 : -1
  p.half = (piece & 7) === P || cap ? 0 : p.half + 1
  if ((piece & 7) === K) p.king[us] = to
  if (us === 1) p.full++
  p.turn = us ^ 1
  p.h1 = h1 ^ ZS1
  p.h2 = h2 ^ ZS2
}

function unmake(p: Pos, m: number) {
  const from = m & 63
  const to = (m >> 6) & 63
  const promo = (m >> 12) & 7
  const flag = m >> 15
  const i = --p.n
  const us = p.turn ^ 1
  p.turn = us
  const b = p.b
  const cap = p.uCap[i]
  b[from] = promo ? P | (us << 3) : b[to]
  if (flag === F_EP) {
    b[to] = 0
    b[us === 0 ? to + 8 : to - 8] = cap
  } else b[to] = cap
  if (flag === F_CK) {
    b[to + 1] = b[to - 1]
    b[to - 1] = 0
  } else if (flag === F_CQ) {
    b[to - 2] = b[to + 1]
    b[to + 1] = 0
  }
  if ((b[from] & 7) === K) p.king[us] = from
  if (us === 1) p.full--
  p.castle = p.uCastle[i]
  p.ep = p.uEp[i]
  p.half = p.uHalf[i]
  p.h1 = p.uH1[i]
  p.h2 = p.uH2[i]
}

const SCRATCH = new Int32Array(128 * 256)

/** Legal internal moves (pseudo-legal filtered by make/unmake king safety). Uses buffer slot `slot`. */
function genLegal(p: Pos, slot = 0): number[] {
  const base = slot * 256
  const n = genPseudo(p, SCRATCH, base, false)
  const us = p.turn
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const m = SCRATCH[base + i]
    make(p, m)
    if (!isAttacked(p, p.king[us], us ^ 1)) out.push(m)
    unmake(p, m)
  }
  return out
}

function hasLegal(p: Pos): boolean {
  const n = genPseudo(p, SCRATCH, 0, false)
  const us = p.turn
  for (let i = 0; i < n; i++) {
    const m = SCRATCH[i]
    make(p, m)
    const ok = !isAttacked(p, p.king[us], us ^ 1)
    unmake(p, m)
    if (ok) return true
  }
  return false
}

function perftRec(p: Pos, depth: number, ply: number): number {
  if (depth === 0) return 1
  const base = ply * 256
  const n = genPseudo(p, SCRATCH, base, false)
  const us = p.turn
  let total = 0
  for (let i = 0; i < n; i++) {
    const m = SCRATCH[base + i]
    make(p, m)
    if (!isAttacked(p, p.king[us], us ^ 1)) total += depth === 1 ? 1 : perftRec(p, depth - 1, ply + 1)
    unmake(p, m)
  }
  return total
}

/** Leaf-node count of the legal move tree; the standard movegen correctness check. */
export function perft(s: ChessState, depth: number): number {
  return perftRec(toPos(s), depth, 0)
}

// ---------------------------------------------------------------------------
// State <-> Pos, FEN, squares
// ---------------------------------------------------------------------------

const PIECE_OBJ: (Piece | null)[] = []
for (let c = 0; c < 2; c++)
  for (let t = 1; t <= 6; t++) PIECE_OBJ[t | (c << 3)] = Object.freeze({ color: c === 0 ? 'w' : 'b', type: TYPE_CHARS[t - 1] as PieceType }) as Piece

function toPos(s: ChessState): Pos {
  const p = newPosObj()
  p.king.fill(-1)
  for (let sq = 0; sq < 64; sq++) {
    const pc = s.board[sq]
    if (!pc) continue
    const code = (TYPE_CHARS.indexOf(pc.type) + 1) | (pc.color === 'w' ? 0 : 8)
    p.b[sq] = code
    if ((code & 7) === K) p.king[code >> 3] = sq
  }
  p.turn = s.turn === 'w' ? 0 : 1
  p.castle = (s.castling.wk ? C_WK : 0) | (s.castling.wq ? C_WQ : 0) | (s.castling.bk ? C_BK : 0) | (s.castling.bq ? C_BQ : 0)
  p.ep = s.enPassant === null ? -1 : s.enPassant
  p.half = s.halfmove
  p.full = s.fullmove
  computeHash(p)
  return p
}

function placementOf(p: Pos): string {
  const rows: string[] = []
  for (let r = 0; r < 8; r++) {
    let row = ''
    let empty = 0
    for (let c = 0; c < 8; c++) {
      const pc = p.b[r * 8 + c]
      if (pc === 0) {
        empty++
        continue
      }
      if (empty) row += empty
      empty = 0
      const ch = TYPE_CHARS[(pc & 7) - 1]
      row += pc >> 3 === 0 ? ch.toUpperCase() : ch
    }
    if (empty) row += empty
    rows.push(row)
  }
  return rows.join('/')
}

function castleStr(c: number): string {
  return (c & C_WK ? 'K' : '') + (c & C_WQ ? 'Q' : '') + (c & C_BK ? 'k' : '') + (c & C_BQ ? 'q' : '') || '-'
}

/** Repetition key: placement, turn, castling, and the ep square only when a pawn could take it. */
function keyOf(p: Pos): string {
  return `${placementOf(p)} ${p.turn === 0 ? 'w' : 'b'} ${castleStr(p.castle)} ${epCapturable(p) ? squareName(p.ep) : '-'}`
}

function parseFen(fen: string): Pos | null {
  if (typeof fen !== 'string') return null
  const parts = fen.trim().split(/\s+/)
  if (parts.length < 4 || parts.length > 6) return null
  const rows = parts[0].split('/')
  if (rows.length !== 8) return null
  const p = newPosObj()
  const kings = [0, 0]
  for (let r = 0; r < 8; r++) {
    let c = 0
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') {
        c += Number(ch)
        if (c > 8) return null
        continue
      }
      const t = TYPE_CHARS.indexOf(ch.toLowerCase())
      if (t < 0 || c > 7) return null
      const color = ch === ch.toLowerCase() ? 1 : 0
      const code = t + 1 | (color << 3)
      if (t + 1 === P && (r === 0 || r === 7)) return null
      if (t + 1 === K) kings[color]++
      p.b[r * 8 + c] = code
      if (t + 1 === K) p.king[color] = r * 8 + c
      c++
    }
    if (c !== 8) return null
  }
  if (kings[0] !== 1 || kings[1] !== 1) return null
  if (parts[1] !== 'w' && parts[1] !== 'b') return null
  p.turn = parts[1] === 'w' ? 0 : 1
  const cs = parts[2]
  if (cs !== '-') {
    if (!/^[KQkq]+$/.test(cs) || new Set(cs).size !== cs.length) return null
    if (cs.includes('K') && p.b[60] === K && p.b[63] === R) p.castle |= C_WK
    if (cs.includes('Q') && p.b[60] === K && p.b[56] === R) p.castle |= C_WQ
    if (cs.includes('k') && p.b[4] === (K | 8) && p.b[7] === (R | 8)) p.castle |= C_BK
    if (cs.includes('q') && p.b[4] === (K | 8) && p.b[0] === (R | 8)) p.castle |= C_BQ
  }
  if (parts[3] !== '-') {
    const ep = parseSquare(parts[3])
    if (ep === null) return null
    const row = ep >> 3
    if (p.turn === 0) {
      if (row !== 2 || p.b[ep] !== 0 || p.b[ep + 8] !== (P | 8)) return null
    } else if (row !== 5 || p.b[ep] !== 0 || p.b[ep - 8] !== P) return null
    p.ep = ep
  }
  if (parts.length > 4) {
    if (!/^\d+$/.test(parts[4])) return null
    p.half = Number(parts[4])
  }
  if (parts.length > 5) {
    if (!/^\d+$/.test(parts[5]) || Number(parts[5]) < 1) return null
    p.full = Number(parts[5])
  }
  // The side that just moved cannot have left its own king in check.
  if (isAttacked(p, p.king[p.turn ^ 1], p.turn)) return null
  computeHash(p)
  return p
}

function stateFromPos(p: Pos, history: Move[], positions: string[]): ChessState {
  const board: (Piece | null)[] = []
  for (let sq = 0; sq < 64; sq++) board.push(PIECE_OBJ[p.b[sq]] ?? null)
  return {
    board,
    turn: p.turn === 0 ? 'w' : 'b',
    castling: { wk: !!(p.castle & C_WK), wq: !!(p.castle & C_WQ), bk: !!(p.castle & C_BK), bq: !!(p.castle & C_BQ) },
    enPassant: p.ep < 0 ? null : p.ep,
    halfmove: p.half,
    fullmove: p.full,
    history,
    positions,
  }
}

export function fromFen(fen: string): ChessState | null {
  const p = parseFen(fen)
  if (!p) return null
  return stateFromPos(p, [], [keyOf(p)])
}

export function toFen(s: ChessState): string {
  const p = toPos(s)
  const ep = s.enPassant === null ? '-' : squareName(s.enPassant)
  return `${placementOf(p)} ${s.turn} ${castleStr(p.castle)} ${ep} ${s.halfmove} ${s.fullmove}`
}

export function newGame(): ChessState {
  return fromFen(START_FEN)!
}

export function squareName(sq: Square): string {
  return 'abcdefgh'[sq & 7] + (8 - (sq >> 3))
}

export function parseSquare(name: string): Square | null {
  if (typeof name !== 'string' || !/^[a-h][1-8]$/.test(name)) return null
  return (8 - Number(name[1])) * 8 + (name.charCodeAt(0) - 97)
}

// ---------------------------------------------------------------------------
// Public move API
// ---------------------------------------------------------------------------

/** Standard algebraic notation for internal move `m`, given all legal moves in `p`. */
function sanOf(p: Pos, legal: number[], m: number): string {
  const from = m & 63
  const to = (m >> 6) & 63
  const promo = (m >> 12) & 7
  const flag = m >> 15
  const us = p.turn
  const t = p.b[from] & 7
  let san: string
  if (flag === F_CK) san = 'O-O'
  else if (flag === F_CQ) san = 'O-O-O'
  else {
    const isCap = p.b[to] !== 0 || flag === F_EP
    if (t === P) {
      san = (isCap ? 'abcdefgh'[from & 7] + 'x' : '') + squareName(to)
      if (promo) san += '=' + TYPE_CHARS[promo - 1].toUpperCase()
    } else {
      let dis = ''
      let sameFile = false
      let sameRank = false
      let ambiguous = false
      for (const o of legal) {
        const of = o & 63
        if (of === from || ((o >> 6) & 63) !== to || (p.b[of] & 7) !== t) continue
        ambiguous = true
        if ((of & 7) === (from & 7)) sameFile = true
        if (of >> 3 === from >> 3) sameRank = true
      }
      if (ambiguous) {
        if (!sameFile) dis = 'abcdefgh'[from & 7]
        else if (!sameRank) dis = String(8 - (from >> 3))
        else dis = squareName(from)
      }
      san = TYPE_CHARS[t - 1].toUpperCase() + dis + (isCap ? 'x' : '') + squareName(to)
    }
  }
  make(p, m)
  if (isAttacked(p, p.king[p.turn], us)) san += hasLegal(p) ? '+' : '#'
  unmake(p, m)
  return san
}

function buildMove(p: Pos, legal: number[], m: number): Move {
  const from = m & 63
  const to = (m >> 6) & 63
  const promo = (m >> 12) & 7
  const flag = m >> 15
  const out: Move = {
    from,
    to,
    color: p.turn === 0 ? 'w' : 'b',
    piece: TYPE_CHARS[(p.b[from] & 7) - 1] as PieceType,
    san: sanOf(p, legal, m),
  }
  if (flag === F_EP) {
    out.captured = 'p'
    out.enPassant = true
  } else if (p.b[to]) out.captured = TYPE_CHARS[(p.b[to] & 7) - 1] as PieceType
  if (promo) out.promotion = TYPE_CHARS[promo - 1] as PieceType
  if (flag === F_CK) out.castle = 'k'
  if (flag === F_CQ) out.castle = 'q'
  if (flag === F_DOUBLE) out.double = true
  return out
}

export function legalMoves(s: ChessState, from?: Square): Move[] {
  const p = toPos(s)
  const legal = genLegal(p)
  const out: Move[] = []
  for (const m of legal) if (from === undefined || (m & 63) === from) out.push(buildMove(p, legal, m))
  return out
}

export function makeMove(s: ChessState, m: { from: Square; to: Square; promotion?: PieceType }): ChessState | null {
  const p = toPos(s)
  const legal = genLegal(p)
  let promoCode = Q
  if (m.promotion !== undefined) {
    promoCode = TYPE_CHARS.indexOf(m.promotion) + 1
    if (promoCode < N || promoCode > Q) return null
  }
  let found = -1
  for (const c of legal) {
    if ((c & 63) !== m.from || ((c >> 6) & 63) !== m.to) continue
    const cp = (c >> 12) & 7
    if (cp === 0 || cp === promoCode) {
      found = c
      break
    }
  }
  if (found < 0) return null
  const move = buildMove(p, legal, found)
  make(p, found)
  return stateFromPos(p, [...s.history, move], [...s.positions, keyOf(p)])
}

export function kingSquare(s: ChessState, color: Color): Square | null {
  for (let sq = 0; sq < 64; sq++) {
    const pc = s.board[sq]
    if (pc && pc.type === 'k' && pc.color === color) return sq
  }
  return null
}

export function inCheck(s: ChessState, color: Color = s.turn): boolean {
  const k = kingSquare(s, color)
  if (k === null) return false
  return isAttacked(toPos(s), k, color === 'w' ? 1 : 0)
}

/** K v K, K+minor v K, or only same-coloured bishops remaining. */
export function isInsufficientMaterial(s: ChessState): boolean {
  let minors = 0
  const bishopColors = new Set<number>()
  let bishops = 0
  for (let sq = 0; sq < 64; sq++) {
    const pc = s.board[sq]
    if (!pc || pc.type === 'k') continue
    if (pc.type === 'n') minors++
    else if (pc.type === 'b') {
      minors++
      bishops++
      bishopColors.add(((sq >> 3) + (sq & 7)) & 1)
    } else return false
  }
  if (minors <= 1) return true
  return minors === bishops && bishopColors.size === 1
}

export function status(s: ChessState): GameStatus {
  const p = toPos(s)
  const chk = isAttacked(p, p.king[p.turn], p.turn ^ 1)
  if (!hasLegal(p)) return chk ? { kind: 'checkmate', winner: s.turn === 'w' ? 'b' : 'w' } : { kind: 'stalemate' }
  if (isInsufficientMaterial(s)) return { kind: 'draw', reason: 'material' }
  const cur = s.positions[s.positions.length - 1]
  if (cur !== undefined && s.positions.filter((k) => k === cur).length >= 3) return { kind: 'draw', reason: 'repetition' }
  if (s.halfmove >= 100) return { kind: 'draw', reason: 'fifty' }
  return { kind: 'playing', check: chk }
}

const CAPTURE_ORDER: PieceType[] = ['q', 'r', 'b', 'n', 'p']

export function capturedPieces(s: ChessState): { w: PieceType[]; b: PieceType[] } {
  const out: { w: PieceType[]; b: PieceType[] } = { w: [], b: [] }
  for (const m of s.history) if (m.captured) out[m.color].push(m.captured)
  const rank = (t: PieceType) => CAPTURE_ORDER.indexOf(t)
  out.w.sort((a, b) => rank(a) - rank(b))
  out.b.sort((a, b) => rank(a) - rank(b))
  return out
}

export function isChessState(x: unknown): x is ChessState {
  try {
    if (typeof x !== 'object' || x === null) return false
    const s = x as Record<string, unknown>
    const isInt = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi
    if (!Array.isArray(s.board) || s.board.length !== 64) return false
    for (const pc of s.board) {
      if (pc === null) continue
      if (typeof pc !== 'object' || pc === undefined) return false
      const q = pc as Record<string, unknown>
      if (q.color !== 'w' && q.color !== 'b') return false
      if (typeof q.type !== 'string' || q.type.length !== 1 || !TYPE_CHARS.includes(q.type)) return false
    }
    if (s.turn !== 'w' && s.turn !== 'b') return false
    const c = s.castling as Record<string, unknown> | null
    if (typeof c !== 'object' || c === null) return false
    for (const k of ['wk', 'wq', 'bk', 'bq']) if (typeof c[k] !== 'boolean') return false
    if (s.enPassant !== null && !isInt(s.enPassant, 0, 63)) return false
    if (!isInt(s.halfmove, 0, 100000) || !isInt(s.fullmove, 1, 100000)) return false
    if (!Array.isArray(s.history) || s.history.length > 20000) return false
    for (const mv of s.history) {
      if (typeof mv !== 'object' || mv === null) return false
      const m = mv as Record<string, unknown>
      if (!isInt(m.from, 0, 63) || !isInt(m.to, 0, 63)) return false
      if (m.color !== 'w' && m.color !== 'b') return false
      if (typeof m.piece !== 'string' || m.piece.length !== 1 || !TYPE_CHARS.includes(m.piece)) return false
      if (typeof m.san !== 'string') return false
      for (const k of ['captured', 'promotion'])
        if (m[k] !== undefined && (typeof m[k] !== 'string' || (m[k] as string).length !== 1 || !TYPE_CHARS.includes(m[k] as string)))
          return false
      if (m.castle !== undefined && m.castle !== 'k' && m.castle !== 'q') return false
      for (const k of ['enPassant', 'double']) if (m[k] !== undefined && typeof m[k] !== 'boolean') return false
    }
    if (!Array.isArray(s.positions) || s.positions.length === 0 || s.positions.length > 20001) return false
    for (const k of s.positions) if (typeof k !== 'string' || k.length > 120) return false
    // Structural sanity: one king per side, and a position the FEN parser accepts.
    return fromFen(toFen(x as ChessState)) !== null
  } catch {
    return false
  }
}

export function toPgn(s: ChessState): string {
  const parts: string[] = []
  // Ply index of the first recorded move, derived from the final position's counters.
  const endPly = (s.fullmove - 1) * 2 + (s.turn === 'b' ? 1 : 0)
  const startPly = endPly - s.history.length
  s.history.forEach((m, i) => {
    const ply = startPly + i
    if (ply % 2 === 0) parts.push(`${ply / 2 + 1}. ${m.san}`)
    else parts.push(i === 0 ? `${(ply - 1) / 2 + 1}... ${m.san}` : m.san)
  })
  const st = status(s)
  if (st.kind === 'checkmate') parts.push(st.winner === 'w' ? '1-0' : '0-1')
  else if (st.kind === 'stalemate' || st.kind === 'draw') parts.push('1/2-1/2')
  return parts.join(' ')
}

// ---------------------------------------------------------------------------
// Evaluation (PeSTO tables, a8-first so white indexes directly)
// ---------------------------------------------------------------------------

/* prettier-ignore */
const MG_TABLES: number[][] = [
  // pawn
  [0,0,0,0,0,0,0,0, 98,134,61,95,68,126,34,-11, -6,7,26,31,65,56,25,-20, -14,13,6,21,23,12,17,-23,
   -27,-2,-5,12,17,6,10,-25, -26,-4,-4,-10,3,3,33,-12, -35,-1,-20,-23,-15,24,38,-22, 0,0,0,0,0,0,0,0],
  // knight
  [-167,-89,-34,-49,61,-97,-15,-107, -73,-41,72,36,23,62,7,-17, -47,60,37,65,84,129,73,44, -9,17,19,53,37,69,18,22,
   -13,4,16,13,28,19,21,-8, -23,-9,12,10,19,17,25,-16, -29,-53,-12,-3,-1,18,-14,-19, -105,-21,-58,-33,-17,-28,-19,-23],
  // bishop
  [-29,4,-82,-37,-25,-42,7,-8, -26,16,-18,-13,30,59,18,-47, -16,37,43,40,35,50,37,-2, -4,5,19,50,37,37,7,-2,
   -6,13,13,26,34,12,10,4, 0,15,15,15,14,27,18,10, 4,15,16,0,7,21,33,1, -33,-3,-14,-21,-13,-12,-39,-21],
  // rook
  [32,42,32,51,63,9,31,43, 27,32,58,62,80,67,26,44, -5,19,26,36,17,45,61,16, -24,-11,7,26,24,35,-8,-20,
   -36,-26,-12,-1,9,-7,6,-23, -45,-25,-16,-17,3,0,-5,-33, -44,-16,-20,-9,-1,11,-6,-71, -19,-13,1,17,16,7,-37,-26],
  // queen
  [-28,0,29,12,59,44,43,45, -24,-39,-5,1,-16,57,28,54, -13,-17,7,8,29,56,47,57, -27,-27,-16,-16,-1,17,-2,1,
   -9,-26,-9,-10,-2,-4,3,-3, -14,2,-11,-2,-5,2,14,5, -35,-8,11,2,8,15,-3,1, -1,-18,-9,10,-15,-25,-31,-50],
  // king
  [-65,23,16,-15,-56,-34,2,13, 29,-1,-20,-7,-8,-4,-38,-29, -9,24,2,-16,-20,6,22,-22, -17,-20,-12,-27,-30,-25,-14,-36,
   -49,-1,-27,-39,-46,-44,-33,-51, -14,-14,-22,-46,-44,-30,-15,-27, 1,7,-8,-64,-43,-16,9,8, -15,36,12,-54,8,-28,24,14],
]
/* prettier-ignore */
const EG_TABLES: number[][] = [
  [0,0,0,0,0,0,0,0, 178,173,158,134,147,132,165,187, 94,100,85,67,56,53,82,84, 32,24,13,5,-2,4,17,17,
   13,9,-3,-7,-7,-8,3,-1, 4,7,-6,1,0,-5,-1,-8, 13,8,8,10,13,0,2,-7, 0,0,0,0,0,0,0,0],
  [-58,-38,-13,-28,-31,-27,-63,-99, -25,-8,-25,-2,-9,-25,-24,-52, -24,-20,10,9,-1,-9,-19,-41, -17,3,22,22,22,11,8,-18,
   -18,-6,16,25,16,17,4,-18, -23,-3,-1,15,10,-3,-20,-22, -42,-20,-10,-5,-2,-20,-23,-44, -29,-51,-23,-15,-22,-18,-50,-64],
  [-14,-21,-11,-8,-7,-9,-17,-24, -8,-4,7,-12,-3,-13,-4,-14, 2,-8,0,-1,-2,6,0,4, -3,9,12,9,14,10,3,2,
   -6,3,13,19,7,10,-3,-9, -12,-3,8,10,13,3,-7,-15, -14,-18,-7,-1,4,-9,-15,-27, -23,-9,-23,-5,-9,-16,-5,-17],
  [13,10,18,15,12,12,8,5, 11,13,13,11,-3,3,8,3, 7,7,7,5,4,-3,-5,-3, 4,3,13,1,2,1,-1,2,
   3,5,8,4,-5,-6,-8,-11, -4,0,-5,-1,-7,-12,-8,-16, -6,-6,0,2,-9,-9,-11,-3, -9,2,3,-1,-5,-13,4,-20],
  [-9,22,22,27,27,19,10,20, -17,20,32,41,58,25,30,0, -20,6,9,49,47,35,19,9, 3,22,24,45,57,40,57,36,
   -18,28,19,47,31,34,39,23, -16,-27,15,6,9,17,10,5, -22,-23,-30,-16,-16,-23,-36,-32, -33,-28,-22,-43,-5,-32,-20,-41],
  [-74,-35,-18,-18,-11,15,4,-17, -12,17,14,17,17,38,23,11, 10,17,23,15,20,45,44,13, -8,22,24,27,26,33,26,3,
   -18,-4,21,24,27,23,9,-11, -19,-3,11,21,23,16,7,-9, -27,-11,4,13,14,4,-5,-17, -53,-34,-21,-11,-28,-14,-24,-43],
]
const MG_VAL = [82, 337, 365, 477, 1025, 0]
const EG_VAL = [94, 281, 297, 512, 936, 0]
const PHASE = [0, 0, 1, 1, 2, 4, 0]
// Cheap material values for move ordering and delta pruning (indexed by type 1..6).
const ORDER_VAL = [0, 100, 320, 330, 500, 900, 20000]

const MG = new Int16Array(16 * 64)
const EG = new Int16Array(16 * 64)
for (let color = 0; color < 2; color++)
  for (let t = 1; t <= 6; t++)
    for (let sq = 0; sq < 64; sq++) {
      const src = color === 0 ? sq : sq ^ 56
      MG[(t | (color << 3)) * 64 + sq] = MG_TABLES[t - 1][src] + MG_VAL[t - 1]
      EG[(t | (color << 3)) * 64 + sq] = EG_TABLES[t - 1][src] + EG_VAL[t - 1]
    }

/** Static evaluation in centipawns from the side to move's point of view. */
function evaluate(p: Pos): number {
  let mg = 0
  let eg = 0
  let phase = 0
  let bishopsW = 0
  let bishopsB = 0
  const b = p.b
  for (let sq = 0; sq < 64; sq++) {
    const pc = b[sq]
    if (pc === 0) continue
    const i = pc * 64 + sq
    if (pc < 8) {
      mg += MG[i]
      eg += EG[i]
      if (pc === B) bishopsW++
    } else {
      mg -= MG[i]
      eg -= EG[i]
      if (pc === (B | 8)) bishopsB++
    }
    phase += PHASE[pc & 7]
  }
  if (phase > 24) phase = 24
  let score = ((mg * phase + eg * (24 - phase)) / 24) | 0
  if (bishopsW >= 2) score += 30
  if (bishopsB >= 2) score -= 30
  return (p.turn === 0 ? score : -score) + 8
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const MATE = 30000
const INF = 32000
const MAXPLY = 100

const TT_BITS = 19
const TT_SIZE = 1 << TT_BITS
const TT_LOCK = new Int32Array(TT_SIZE)
const TT_DEPTH = new Int8Array(TT_SIZE)
const TT_FLAG = new Uint8Array(TT_SIZE) // 1 exact, 2 lower bound, 3 upper bound
const TT_SCORE = new Int32Array(TT_SIZE)
const TT_MOVE = new Int32Array(TT_SIZE)

const KILLERS = new Int32Array(MAXPLY * 2)
const HISTORY = new Int32Array(2 * 64 * 64)
const MOVE_SCORE = new Int32Array(128 * 256)
const REP1 = new Int32Array(2048)
const REP2 = new Int32Array(2048)

let nodes = 0
let stopped = false
let canStop = false
let deadline = 0
let repLen = 0

function searchKey(p: Pos) {
  let k1 = p.h1
  let k2 = p.h2
  if (epCapturable(p)) {
    k1 ^= ZE1[p.ep & 7]
    k2 ^= ZE2[p.ep & 7]
  }
  REP1[repLen] = k1
  REP2[repLen] = k2
  repLen++
}

function isRepeat(p: Pos): boolean {
  const last = repLen - 1
  const k1 = REP1[last]
  const k2 = REP2[last]
  const lo = Math.max(0, last - p.half)
  for (let i = last - 2; i >= lo; i -= 2) if (REP1[i] === k1 && REP2[i] === k2) return true
  return false
}

function tickClock() {
  if ((++nodes & 1023) === 0 && canStop && Date.now() > deadline) stopped = true
}

function hasPieces(p: Pos, us: number): boolean {
  for (let sq = 0; sq < 64; sq++) {
    const pc = p.b[sq]
    if (pc && pc >> 3 === us) {
      const t = pc & 7
      if (t !== P && t !== K) return true
    }
  }
  return false
}

function scoreMoves(p: Pos, base: number, n: number, ply: number, ttMove: number) {
  const us = p.turn
  for (let i = 0; i < n; i++) {
    const m = SCRATCH[base + i]
    const from = m & 63
    const to = (m >> 6) & 63
    const promo = (m >> 12) & 7
    const victim = p.b[to] & 7
    let s: number
    if (m === ttMove) s = 2_000_000
    else if (victim || (m >> 15) === F_EP) {
      const v = victim || P
      s = 1_000_000 + ORDER_VAL[v] * 10 - ORDER_VAL[p.b[from] & 7] / 100 + (promo ? 5000 : 0)
    } else if (promo) s = 900_000 + promo
    else if (m === KILLERS[ply * 2]) s = 800_000
    else if (m === KILLERS[ply * 2 + 1]) s = 790_000
    else s = HISTORY[(us * 64 + from) * 64 + to]
    MOVE_SCORE[base + i] = s
  }
}

function pickBest(base: number, i: number, n: number): number {
  let best = i
  for (let j = i + 1; j < n; j++) if (MOVE_SCORE[base + j] > MOVE_SCORE[base + best]) best = j
  if (best !== i) {
    const m = SCRATCH[base + i]
    SCRATCH[base + i] = SCRATCH[base + best]
    SCRATCH[base + best] = m
    const sc = MOVE_SCORE[base + i]
    MOVE_SCORE[base + i] = MOVE_SCORE[base + best]
    MOVE_SCORE[base + best] = sc
  }
  return SCRATCH[base + i]
}

function qsearch(p: Pos, alpha: number, beta: number, ply: number): number {
  tickClock()
  if (stopped) return 0
  const stand = evaluate(p)
  if (ply >= MAXPLY - 2) return stand
  if (stand >= beta) return stand
  if (stand > alpha) alpha = stand
  const base = ply * 256
  const n = genPseudo(p, SCRATCH, base, true)
  scoreMoves(p, base, n, ply, 0)
  const us = p.turn
  let best = stand
  for (let i = 0; i < n; i++) {
    const m = pickBest(base, i, n)
    const victim = p.b[(m >> 6) & 63] & 7
    // Delta pruning: even winning this piece cannot lift us to alpha.
    if (!((m >> 12) & 7) && stand + ORDER_VAL[victim || P] + 200 < alpha) continue
    make(p, m)
    if (isAttacked(p, p.king[us], us ^ 1)) {
      unmake(p, m)
      continue
    }
    searchKey(p)
    const score = -qsearch(p, -beta, -alpha, ply + 1)
    repLen--
    unmake(p, m)
    if (stopped) return 0
    if (score > best) {
      best = score
      if (score > alpha) {
        alpha = score
        if (alpha >= beta) break
      }
    }
  }
  return best
}

function search(p: Pos, depth: number, alpha: number, beta: number, ply: number, allowNull: boolean): number {
  tickClock()
  if (stopped) return 0
  if (ply > 0 && (p.half >= 100 || isRepeat(p))) return 0
  const us = p.turn
  const inChk = isAttacked(p, p.king[us], us ^ 1)
  if (inChk && ply < MAXPLY - 12) depth++
  if (depth <= 0) return qsearch(p, alpha, beta, ply)
  if (ply >= MAXPLY - 2) return evaluate(p)
  // Mate-distance pruning: no line can beat a mate we already have.
  alpha = Math.max(alpha, -MATE + ply)
  beta = Math.min(beta, MATE - ply - 1)
  if (alpha >= beta) return alpha

  const k1 = REP1[repLen - 1]
  const k2 = REP2[repLen - 1]
  const slot = k1 & (TT_SIZE - 1)
  let ttMove = 0
  if (TT_DEPTH[slot] >= 0 && TT_LOCK[slot] === k2 && TT_FLAG[slot]) {
    ttMove = TT_MOVE[slot]
    if (TT_DEPTH[slot] >= depth) {
      let sc = TT_SCORE[slot]
      if (sc > MATE - 200) sc -= ply
      else if (sc < -MATE + 200) sc += ply
      const f = TT_FLAG[slot]
      if (f === 1) return sc
      if (f === 2 && sc >= beta) return sc
      if (f === 3 && sc <= alpha) return sc
    }
  }

  // Null move: if passing still beats beta, the position is good enough to cut.
  if (allowNull && !inChk && depth >= 3 && beta < MATE - 200 && hasPieces(p, us) && evaluate(p) >= beta) {
    const oldEp = p.ep
    const oh1 = p.h1
    const oh2 = p.h2
    p.turn = us ^ 1
    p.ep = -1
    p.h1 ^= ZS1
    p.h2 ^= ZS2
    searchKey(p)
    const score = -search(p, depth - 3 - (depth >= 6 ? 1 : 0), -beta, -beta + 1, ply + 1, false)
    repLen--
    p.turn = us
    p.ep = oldEp
    p.h1 = oh1
    p.h2 = oh2
    if (stopped) return 0
    if (score >= beta) return score >= MATE - 200 ? beta : score
  }

  const base = ply * 256
  const n = genPseudo(p, SCRATCH, base, false)
  scoreMoves(p, base, n, ply, ttMove)
  const origAlpha = alpha
  let legal = 0
  let best = -INF
  let bestMove = 0
  for (let i = 0; i < n; i++) {
    const m = pickBest(base, i, n)
    const to = (m >> 6) & 63
    const quiet = p.b[to] === 0 && (m >> 12) === 0 && (m >> 15) !== F_EP
    make(p, m)
    if (isAttacked(p, p.king[us], us ^ 1)) {
      unmake(p, m)
      continue
    }
    legal++
    searchKey(p)
    let score: number
    if (legal === 1) score = -search(p, depth - 1, -beta, -alpha, ply + 1, true)
    else {
      const r = depth >= 3 && legal > 4 && quiet && !inChk ? 1 : 0
      score = -search(p, depth - 1 - r, -alpha - 1, -alpha, ply + 1, true)
      if (score > alpha && r > 0) score = -search(p, depth - 1, -alpha - 1, -alpha, ply + 1, true)
      if (score > alpha && score < beta) score = -search(p, depth - 1, -beta, -alpha, ply + 1, true)
    }
    repLen--
    unmake(p, m)
    if (stopped) return 0
    if (score > best) {
      best = score
      bestMove = m
      if (score > alpha) {
        alpha = score
        if (alpha >= beta) {
          if (quiet) {
            if (KILLERS[ply * 2] !== m) {
              KILLERS[ply * 2 + 1] = KILLERS[ply * 2]
              KILLERS[ply * 2] = m
            }
            const hi = (us * 64 + (m & 63)) * 64 + to
            HISTORY[hi] = Math.min(HISTORY[hi] + depth * depth, 700_000)
          }
          break
        }
      }
    }
  }
  if (legal === 0) return inChk ? -MATE + ply : 0
  let store = best
  if (store > MATE - 200) store += ply
  else if (store < -MATE + 200) store -= ply
  if (TT_DEPTH[slot] <= depth || TT_LOCK[slot] !== k2) {
    TT_LOCK[slot] = k2
    TT_DEPTH[slot] = depth
    TT_SCORE[slot] = store
    TT_MOVE[slot] = bestMove
    TT_FLAG[slot] = best <= origAlpha ? 3 : best >= beta ? 2 : 1
  }
  return best
}

interface Scored {
  move: number
  score: number
}

/**
 * One root iteration. Moves scoring within `margin` of the best keep exact
 * scores (the window's lower bound trails the best by the margin); the rest
 * fail low and are excluded from selection. Returns null if time ran out.
 */
function searchRoot(p: Pos, moves: number[], depth: number, margin: number): Scored[] | null {
  const out: Scored[] = []
  let best = -INF
  for (const m of moves) {
    const alpha = margin > 0 && best > -INF ? best - margin - 1 : best
    make(p, m)
    searchKey(p)
    const score = -search(p, depth - 1, -INF, -alpha, 1, true)
    repLen--
    unmake(p, m)
    if (stopped) return null
    out.push({ move: m, score })
    if (score > best) best = score
  }
  return out
}

const LEVELS: Record<ChessDifficulty, { depth: number; ms: number; margin: number }> = {
  1: { depth: 1, ms: 20, margin: 90 },
  2: { depth: 2, ms: 80, margin: 35 },
  3: { depth: 6, ms: 350, margin: 0 },
  4: { depth: 40, ms: 900, margin: 0 },
}

export function bestMove(s: ChessState, difficulty: ChessDifficulty, rng: () => number = Math.random): Move | null {
  const p = toPos(s)
  const legal = genLegal(p)
  if (legal.length === 0) return null
  const pick = (m: number) => buildMove(p, legal, m)
  if (legal.length === 1) return pick(legal[0])
  const cfg = LEVELS[difficulty] ?? LEVELS[2]
  // Beginners sometimes just play something.
  if (difficulty === 1 && rng() < 0.3) return pick(legal[Math.floor(rng() * legal.length) % legal.length])

  // Fresh search state; earlier positions of this game feed repetition detection.
  TT_DEPTH.fill(-1)
  KILLERS.fill(0)
  HISTORY.fill(0)
  repLen = 0
  const earlier = s.positions.slice(Math.max(0, s.positions.length - 1 - Math.min(s.halfmove, 200)), -1)
  for (const key of earlier) {
    const q = parseFen(key + ' 0 1')
    if (q) {
      REP1[repLen] = q.h1 ^ (epCapturable(q) ? ZE1[q.ep & 7] : 0)
      REP2[repLen] = q.h2 ^ (epCapturable(q) ? ZE2[q.ep & 7] : 0)
      repLen++
    }
  }
  searchKey(p)

  let margin = cfg.margin
  if (difficulty >= 2 && s.history.length < 4) margin = Math.max(margin, 20)
  nodes = 0
  stopped = false
  const start = Date.now()
  deadline = start + cfg.ms

  let ordered = legal.slice()
  let results: Scored[] = []
  for (let depth = 1; depth <= cfg.depth; depth++) {
    canStop = depth > 1
    const res = searchRoot(p, ordered, depth, margin)
    if (!res) break
    results = res
    ordered = res
      .map((r, i) => ({ r, i }))
      .sort((a, b) => b.r.score - a.r.score || a.i - b.i)
      .map((x) => x.r.move)
    if (results.reduce((mx, r) => Math.max(mx, r.score), -INF) >= MATE - 100) break
    if (Date.now() > deadline) break
  }
  canStop = false
  if (results.length === 0) return pick(legal[0])

  let top = -INF
  let topMove = results[0].move
  for (const r of results)
    if (r.score > top) {
      top = r.score
      topMove = r.move
    }
  // Forced mates (either way) are played out exactly, no randomising.
  if (margin === 0 || Math.abs(top) >= MATE - 100) return pick(topMove)
  const near = results.filter((r) => r.score >= top - margin)
  return pick(near[Math.floor(rng() * near.length) % near.length].move)
}

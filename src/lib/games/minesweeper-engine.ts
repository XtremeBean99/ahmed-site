// src/lib/games/minesweeper-engine.ts
/**
 * Pure minesweeper logic. No DOM, no React — every function returns a new
 * Board. Mines are placed on the FIRST reveal, never on or adjacent to it.
 */

export type CellState = 'hidden' | 'revealed' | 'flagged'
export type GameStatus = 'playing' | 'won' | 'lost'
export interface Cell { mine: boolean; adjacent: number; state: CellState }
export interface Board {
  rows: number
  cols: number
  mines: number
  minesPlaced: boolean
  status: GameStatus
  cells: Cell[]
}

const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
] as const

const idx = (b: Board, r: number, c: number) => r * b.cols + c
const inBounds = (b: Board, r: number, c: number) => r >= 0 && r < b.rows && c >= 0 && c < b.cols

export function createBoard(rows: number, cols: number, mines: number): Board {
  return {
    rows,
    cols,
    mines,
    minesPlaced: false,
    status: 'playing',
    cells: Array.from({ length: rows * cols }, () => ({ mine: false, adjacent: 0, state: 'hidden' as CellState })),
  }
}

function placeMines(board: Board, safeR: number, safeC: number, rng: () => number): Board {
  const safe = new Set<number>([idx(board, safeR, safeC)])
  for (const [dr, dc] of DIRS) {
    if (inBounds(board, safeR + dr, safeC + dc)) safe.add(idx(board, safeR + dr, safeC + dc))
  }
  const candidates = board.cells.map((_, i) => i).filter((i) => !safe.has(i))
  // Partial Fisher–Yates: the first `mines` entries become mines
  for (let i = 0; i < board.mines; i++) {
    const j = i + Math.floor(rng() * (candidates.length - i))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  const mineSet = new Set(candidates.slice(0, board.mines))
  const cells = board.cells.map((cell, i) => ({ ...cell, mine: mineSet.has(i) }))
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const i = r * board.cols + c
      if (cells[i].mine) continue
      let n = 0
      for (const [dr, dc] of DIRS) {
        if (inBounds(board, r + dr, c + dc) && cells[(r + dr) * board.cols + (c + dc)].mine) n++
      }
      cells[i] = { ...cells[i], adjacent: n }
    }
  }
  return { ...board, minesPlaced: true, cells }
}

export function reveal(board: Board, r: number, c: number, rng: () => number = Math.random): Board {
  if (board.status !== 'playing' || !inBounds(board, r, c)) return board
  const b = board.minesPlaced ? board : placeMines(board, r, c, rng)
  const start = idx(b, r, c)
  if (b.cells[start].state !== 'hidden') return b
  const cells = b.cells.slice()
  if (cells[start].mine) {
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].mine) cells[i] = { ...cells[i], state: 'revealed' }
    }
    return { ...b, cells, status: 'lost' }
  }
  const stack = [start]
  while (stack.length) {
    const i = stack.pop()!
    if (cells[i].state !== 'hidden') continue
    cells[i] = { ...cells[i], state: 'revealed' }
    if (cells[i].adjacent === 0) {
      const cr = Math.floor(i / b.cols)
      const cc = i % b.cols
      for (const [dr, dc] of DIRS) {
        if (inBounds(b, cr + dr, cc + dc)) {
          const ni = (cr + dr) * b.cols + (cc + dc)
          if (!cells[ni].mine && cells[ni].state === 'hidden') stack.push(ni)
        }
      }
    }
  }
  const won = cells.every((cell) => cell.mine || cell.state === 'revealed')
  return { ...b, cells, status: won ? 'won' : 'playing' }
}

export function toggleFlag(board: Board, r: number, c: number): Board {
  if (board.status !== 'playing' || !inBounds(board, r, c)) return board
  const i = idx(board, r, c)
  const cell = board.cells[i]
  if (cell.state === 'revealed') return board
  const cells = board.cells.slice()
  cells[i] = { ...cell, state: cell.state === 'flagged' ? 'hidden' : 'flagged' }
  return { ...board, cells }
}

export function flagCount(board: Board): number {
  return board.cells.reduce((n, c) => n + (c.state === 'flagged' ? 1 : 0), 0)
}

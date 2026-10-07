import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  START_FEN,
  bestMove,
  capturedPieces,
  fromFen,
  inCheck,
  isChessState,
  kingSquare,
  legalMoves,
  makeMove,
  newGame,
  parseSquare,
  perft,
  squareName,
  status,
  toFen,
  toPgn,
  type ChessState,
} from './chess-engine'

const sq = (name: string) => parseSquare(name)!

function fen(f: string): ChessState {
  const s = fromFen(f)
  assert.ok(s, `FEN should parse: ${f}`)
  return s
}

/** Play SAN-agnostic coordinate moves like "e2e4" / "e7e8q"; throws on an illegal one. */
function play(s: ChessState, ...moves: string[]): ChessState {
  for (const m of moves) {
    const next = makeMove(s, {
      from: sq(m.slice(0, 2)),
      to: sq(m.slice(2, 4)),
      promotion: m[4] as 'q' | undefined,
    })
    assert.ok(next, `illegal move ${m} in ${toFen(s)}`)
    s = next
  }
  return s
}

const sanOf = (s: ChessState, from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') =>
  legalMoves(s, sq(from)).find((m) => m.to === sq(to) && (promotion === undefined || m.promotion === promotion))?.san

// ---------------------------------------------------------------------------
// Perft
// ---------------------------------------------------------------------------

test('perft: start position', () => {
  const s = newGame()
  assert.equal(perft(s, 1), 20)
  assert.equal(perft(s, 2), 400)
  assert.equal(perft(s, 3), 8902)
  assert.equal(perft(s, 4), 197281)
})

test('perft: Kiwipete', () => {
  const s = fen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1')
  assert.equal(perft(s, 1), 48)
  assert.equal(perft(s, 2), 2039)
  assert.equal(perft(s, 3), 97862)
})

test('perft: position 3 (en passant pins, endgame)', () => {
  const s = fen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1')
  assert.equal(perft(s, 1), 14)
  assert.equal(perft(s, 2), 191)
  assert.equal(perft(s, 3), 2812)
  assert.equal(perft(s, 4), 43238)
})

test('perft: position 5 (promotions, castling rights)', () => {
  const s = fen('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8')
  assert.equal(perft(s, 1), 44)
  assert.equal(perft(s, 2), 1486)
  assert.equal(perft(s, 3), 62379)
})

test('public legalMoves agrees with perft at depth 2 from the start', () => {
  const s = newGame()
  let total = 0
  for (const m of legalMoves(s)) total += legalMoves(makeMove(s, m)!).length
  assert.equal(total, 400)
})

// ---------------------------------------------------------------------------
// FEN / squares
// ---------------------------------------------------------------------------

test('squares: a8 is 0 and h1 is 63, names round trip', () => {
  assert.equal(squareName(0), 'a8')
  assert.equal(squareName(7), 'h8')
  assert.equal(squareName(56), 'a1')
  assert.equal(squareName(63), 'h1')
  assert.equal(parseSquare('e4'), 36)
  for (let i = 0; i < 64; i++) assert.equal(parseSquare(squareName(i)), i)
  assert.equal(parseSquare('i9'), null)
  assert.equal(parseSquare('e'), null)
})

test('FEN round trip, including after moves', () => {
  assert.equal(toFen(newGame()), START_FEN)
  const s = play(newGame(), 'e2e4', 'c7c5', 'g1f3')
  assert.equal(toFen(s), 'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2')
  assert.equal(toFen(fen(toFen(s))), toFen(s))
  assert.equal(toFen(play(newGame(), 'e2e4')), 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')
})

test('fromFen rejects malformed input', () => {
  for (const bad of [
    '',
    'nonsense',
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1',
    'rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNX w KQkq - 0 1',
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1',
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e9 0 1',
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - x 1',
    '4k3/8/8/8/8/8/8/8 w - - 0 1', // no white king
    '4k3/8/8/8/8/8/8/R3K2K w - - 0 1', // two white kings
    '4k3/4R3/8/8/8/8/8/4K3 w - - 0 1', // side not to move is in check
  ])
    assert.equal(fromFen(bad), null, bad)
  assert.equal(fromFen(undefined as unknown as string), null)
})

test('new game has a single repetition key and empty history', () => {
  const s = newGame()
  assert.equal(s.history.length, 0)
  assert.equal(s.positions.length, 1)
  assert.equal(s.turn, 'w')
  assert.equal(kingSquare(s, 'w'), sq('e1'))
  assert.equal(kingSquare(s, 'b'), sq('e8'))
})

// ---------------------------------------------------------------------------
// SAN
// ---------------------------------------------------------------------------

test('SAN: pawn moves, captures and piece moves', () => {
  let s = newGame()
  assert.equal(sanOf(s, 'e2', 'e4'), 'e4')
  assert.equal(sanOf(s, 'g1', 'f3'), 'Nf3')
  s = play(s, 'e2e4', 'd7d5')
  assert.equal(sanOf(s, 'e4', 'd5'), 'exd5')
  s = play(s, 'e4d5', 'd8d5')
  assert.equal(sanOf(s, 'b1', 'c3'), 'Nc3')
  assert.equal(s.history.map((m) => m.san).join(' '), 'e4 d5 exd5 Qxd5')
})

test('SAN: castling both sides', () => {
  const s = fen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
  assert.equal(sanOf(s, 'e1', 'g1'), 'O-O')
  assert.equal(sanOf(s, 'e1', 'c1'), 'O-O-O')
  const b = play(s, 'e1g1')
  assert.equal(sanOf(b, 'e8', 'g8'), undefined, 'the rook on f1 now guards f8')
  assert.equal(sanOf(b, 'e8', 'c8'), 'O-O-O')
})

test('SAN: promotion with =Q, and check or mate suffixes', () => {
  const s = fen('3r2k1/4P3/8/8/8/8/8/6K1 w - - 0 1')
  assert.equal(sanOf(s, 'e7', 'e8', 'q'), 'e8=Q+')
  assert.equal(sanOf(s, 'e7', 'd8', 'q'), 'exd8=Q+')
  assert.equal(sanOf(s, 'e7', 'd8', 'n'), 'exd8=N')
  assert.equal(sanOf(s, 'e7', 'e8', 'n'), 'e8=N')
  assert.equal(legalMoves(s, sq('e7')).length, 8, 'two promotion squares x 4 pieces')
  // Promotion that mates.
  const m = fen('6k1/4P1pp/6p1/8/8/8/8/R5K1 w - - 0 1')
  const mate = fen('7k/5P2/6K1/8/8/8/8/8 w - - 0 1')
  assert.equal(sanOf(m, 'e7', 'e8', 'q'), 'e8=Q#')
  assert.equal(sanOf(mate, 'f7', 'f8', 'q'), 'f8=Q#')
  assert.equal(sanOf(mate, 'f7', 'f8', 'r'), 'f8=R#')
})

test('SAN: disambiguation by file, rank, and both', () => {
  // Two knights can reach d2: file disambiguates.
  const f = fen('4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1')
  assert.equal(sanOf(f, 'b1', 'd2'), 'Nbd2')
  assert.equal(sanOf(f, 'f1', 'd2'), 'Nfd2')
  // Two rooks on the same file: rank disambiguates.
  const r = fen('3k4/8/8/4R3/8/8/8/K3R3 w - - 0 1')
  assert.equal(sanOf(r, 'e1', 'e3'), 'R1e3')
  assert.equal(sanOf(r, 'e5', 'e3'), 'R5e3')
  // Three queens: one needs both file and rank.
  const q = fen('7k/8/8/8/Q3Q3/8/4Q3/4K3 w - - 0 1')
  assert.equal(sanOf(q, 'e4', 'c2'), 'Qe4c2')
  assert.equal(sanOf(q, 'a4', 'c2'), 'Qac2')
  assert.equal(sanOf(q, 'e2', 'c2'), 'Q2c2')
})

test('SAN: check suffix and en passant notation', () => {
  const s = play(newGame(), 'e2e4', 'f7f6', 'd1h5')
  assert.equal(s.history[2].san, 'Qh5+')
  assert.ok(inCheck(s))
  const ep = play(newGame(), 'e2e4', 'a7a6', 'e4e5', 'd7d5')
  assert.equal(sanOf(ep, 'e5', 'd6'), 'exd6')
})

// ---------------------------------------------------------------------------
// Special rules
// ---------------------------------------------------------------------------

test('en passant: capture removes the pawn, and only the very next move may take it', () => {
  let s = play(newGame(), 'e2e4', 'a7a6', 'e4e5', 'd7d5')
  assert.equal(s.enPassant, sq('d6'))
  const ep = legalMoves(s, sq('e5')).find((m) => m.to === sq('d6'))!
  assert.ok(ep.enPassant)
  assert.equal(ep.captured, 'p')
  const after = makeMove(s, ep)!
  assert.equal(after.board[sq('d5')], null, 'captured pawn is gone')
  assert.equal(after.board[sq('d6')]?.type, 'p')
  // Declining for a move forfeits the right.
  s = play(s, 'g1f3', 'a6a5')
  assert.equal(makeMove(s, { from: sq('e5'), to: sq('d6') }), null)
})

test('en passant is illegal when it exposes the king', () => {
  // White king a5, black rook h5: capturing b5xc6 would clear both pawns off the rank.
  const s = fen('8/8/8/KPp4r/8/8/8/7k w - c6 0 1')
  assert.equal(makeMove(s, { from: sq('b5'), to: sq('c6') }), null)
  assert.ok(makeMove(s, { from: sq('b5'), to: sq('b6') }))
})

test('castling: refused out of, through, and into check; allowed otherwise', () => {
  const ok = fen('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1')
  assert.ok(makeMove(ok, { from: sq('e1'), to: sq('g1') }))
  assert.ok(makeMove(ok, { from: sq('e1'), to: sq('c1') }))
  const out = fen('4k3/4r3/8/8/8/8/8/R3K2R w KQ - 0 1')
  assert.equal(makeMove(out, { from: sq('e1'), to: sq('g1') }), null)
  assert.equal(makeMove(out, { from: sq('e1'), to: sq('c1') }), null)
  const through = fen('4k3/5r2/8/8/8/8/8/R3K2R w KQ - 0 1')
  assert.equal(makeMove(through, { from: sq('e1'), to: sq('g1') }), null)
  assert.ok(makeMove(through, { from: sq('e1'), to: sq('c1') }), 'queenside is unaffected by an f-file rook')
  const into = fen('4k3/6r1/8/8/8/8/8/R3K2R w KQ - 0 1')
  assert.equal(makeMove(into, { from: sq('e1'), to: sq('g1') }), null)
  // The b1 square may be attacked for queenside castling; only the king path matters.
  const bAttack = fen('1r2k3/8/8/8/8/8/8/R3K3 w Q - 0 1')
  assert.ok(makeMove(bAttack, { from: sq('e1'), to: sq('c1') }))
  // Blocked by a piece.
  const blocked = fen('4k3/8/8/8/8/8/8/R2QK2R w KQ - 0 1')
  assert.equal(makeMove(blocked, { from: sq('e1'), to: sq('c1') }), null)
})

test('castling moves the rook and rights are lost on king/rook moves and rook capture', () => {
  const s = fen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
  const c = play(s, 'e1g1')
  assert.equal(c.board[sq('f1')]?.type, 'r')
  assert.equal(c.board[sq('h1')], null)
  assert.deepEqual(c.castling, { wk: false, wq: false, bk: true, bq: true })
  const rookMoved = play(s, 'h1h2')
  assert.deepEqual(rookMoved.castling, { wk: false, wq: true, bk: true, bq: true })
  // Capturing a rook on its home square removes that right.
  const cap = fen('r3k2r/8/8/8/8/8/6B1/R3K2R w KQkq - 0 1')
  const taken = play(cap, 'g2a8')
  assert.equal(taken.castling.bq, false)
  assert.equal(taken.castling.bk, true)
  // Queenside black castling puts the rook on d8.
  const bq = play(fen('r3k2r/8/8/8/8/8/8/4K3 b kq - 0 1'), 'e8c8')
  assert.equal(bq.board[sq('d8')]?.type, 'r')
  assert.equal(bq.board[sq('c8')]?.type, 'k')
})

test('promotion: defaults to queen, honours the chosen piece, makes 4 moves per square', () => {
  const s = fen('8/4P2k/8/8/8/8/8/K7 w - - 0 1')
  assert.equal(legalMoves(s, sq('e7')).length, 4)
  assert.equal(makeMove(s, { from: sq('e7'), to: sq('e8') })!.board[sq('e8')]?.type, 'q')
  assert.equal(makeMove(s, { from: sq('e7'), to: sq('e8'), promotion: 'n' })!.board[sq('e8')]?.type, 'n')
  assert.equal(makeMove(s, { from: sq('e7'), to: sq('e8'), promotion: 'k' }), null)
  const m = makeMove(s, { from: sq('e7'), to: sq('e8'), promotion: 'r' })!
  assert.equal(m.history[0].promotion, 'r')
  assert.equal(m.history[0].san, 'e8=R')
})

// ---------------------------------------------------------------------------
// Game end
// ---------------------------------------------------------------------------

test("fool's mate is checkmate with Black winning", () => {
  const s = play(newGame(), 'f2f3', 'e7e5', 'g2g4', 'd8h4')
  assert.deepEqual(status(s), { kind: 'checkmate', winner: 'b' })
  assert.equal(s.history[3].san, 'Qh4#')
  assert.equal(legalMoves(s).length, 0)
  assert.equal(toPgn(s), '1. f3 e5 2. g4 Qh4# 0-1')
})

test('stalemate', () => {
  const s = fen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')
  assert.deepEqual(status(s), { kind: 'stalemate' })
  assert.ok(!inCheck(s))
  assert.equal(legalMoves(s).length, 0)
})

test('check is reported while playing', () => {
  const s = fen('4k3/8/8/8/8/8/4R3/4K3 b - - 0 1')
  assert.deepEqual(status(s), { kind: 'playing', check: true })
  assert.deepEqual(status(newGame()), { kind: 'playing', check: false })
})

test('threefold repetition', () => {
  let s = newGame()
  const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8']
  s = play(s, ...shuffle)
  assert.equal(status(s).kind, 'playing', 'twice is not enough')
  s = play(s, ...shuffle)
  assert.deepEqual(status(s), { kind: 'draw', reason: 'repetition' })
})

test('fifty-move rule', () => {
  const s = fen('4k3/8/8/8/8/8/R7/4K3 w - - 99 80')
  assert.equal(status(s).kind, 'playing')
  const after = play(s, 'a2a3')
  assert.equal(after.halfmove, 100)
  assert.deepEqual(status(after), { kind: 'draw', reason: 'fifty' })
  // A pawn move resets the clock.
  assert.equal(play(fen('4k3/8/8/8/8/8/P7/4K3 w - - 99 80'), 'a2a3').halfmove, 0)
})

test('insufficient material', () => {
  const draw = (f: string) => assert.deepEqual(status(fen(f)), { kind: 'draw', reason: 'material' }, f)
  draw('4k3/8/8/8/8/8/8/4K3 w - - 0 1')
  draw('4k3/8/8/8/8/8/8/3BK3 w - - 0 1')
  draw('4k3/8/8/8/8/8/8/3NK3 w - - 0 1')
  draw('4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1') // c1 and f8 are both dark squares
  const live = (f: string) => assert.equal(status(fen(f)).kind, 'playing', f)
  live('4kb2/8/8/8/8/8/8/3BK3 w - - 0 1') // opposite-coloured bishops
  live('4k3/8/8/8/8/8/8/2NNK3 w - - 0 1')
  live('4k3/8/8/8/8/8/P7/4K3 w - - 0 1')
  live('4k3/8/8/8/8/8/8/3RK3 w - - 0 1')
})

test('captured pieces are tallied by side, highest value first', () => {
  const s = play(newGame(), 'e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5a5', 'c3e4')
  const caps = capturedPieces(s)
  assert.deepEqual(caps.w, ['p'])
  assert.deepEqual(caps.b, ['p'])
  const big = play(fen('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1'), 'd1d5')
  assert.deepEqual(capturedPieces(big).w, ['q'])
})

// ---------------------------------------------------------------------------
// State handling
// ---------------------------------------------------------------------------

test('makeMove is immutable and rejects illegal moves', () => {
  const s = newGame()
  const snapshot = JSON.stringify(s)
  const next = makeMove(s, { from: sq('e2'), to: sq('e4') })!
  assert.equal(JSON.stringify(s), snapshot, 'original state untouched')
  assert.notEqual(next, s)
  assert.equal(next.history.length, 1)
  assert.equal(next.turn, 'b')
  assert.equal(next.positions.length, 2)
  assert.equal(s.history.length, 0)
  assert.equal(makeMove(s, { from: sq('e2'), to: sq('e5') }), null, 'pawn cannot leap three squares')
  assert.equal(makeMove(s, { from: sq('e7'), to: sq('e5') }), null, 'not your piece')
  assert.equal(makeMove(s, { from: sq('e4'), to: sq('e5') }), null, 'empty square')
  assert.equal(makeMove(s, { from: sq('b1'), to: sq('b3') }), null)
  // A pinned piece cannot move.
  const pin = fen('4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1')
  assert.equal(makeMove(pin, { from: sq('e2'), to: sq('d2') }), null)
  assert.ok(makeMove(pin, { from: sq('e2'), to: sq('e5') }))
})

test('Move records carry the flags the UI relies on', () => {
  const s = newGame()
  const dbl = legalMoves(s, sq('e2')).find((m) => m.to === sq('e4'))!
  assert.equal(dbl.double, true)
  assert.equal(dbl.piece, 'p')
  assert.equal(dbl.color, 'w')
  assert.equal(dbl.captured, undefined)
  const castle = legalMoves(fen('4k3/8/8/8/8/8/8/R3K3 w Q - 0 1'), sq('e1')).find((m) => m.castle)!
  assert.equal(castle.castle, 'q')
  assert.equal(castle.to, sq('c1'))
})

test('isChessState accepts real states and rejects junk', () => {
  assert.ok(isChessState(newGame()))
  const played = play(newGame(), 'e2e4', 'e7e5', 'g1f3')
  assert.ok(isChessState(played))
  assert.ok(isChessState(JSON.parse(JSON.stringify(played))), 'survives a localStorage round trip')
  for (const junk of [null, undefined, 0, 'x', [], {}, { board: [] }]) assert.equal(isChessState(junk), false)
  const clone = () => JSON.parse(JSON.stringify(played)) as Record<string, unknown>
  const bad = (mutate: (s: Record<string, unknown>) => void) => {
    const c = clone()
    mutate(c)
    assert.equal(isChessState(c), false)
  }
  bad((c) => ((c.board as unknown[]).length = 63))
  bad((c) => ((c.board as unknown[])[0] = { color: 'x', type: 'p' }))
  bad((c) => ((c.board as unknown[])[0] = { color: 'w', type: 'z' }))
  bad((c) => (c.turn = 'g'))
  bad((c) => (c.castling = { wk: 1 }))
  bad((c) => (c.enPassant = 64))
  bad((c) => (c.halfmove = -1))
  bad((c) => (c.fullmove = 1.5))
  bad((c) => (c.history = [{ from: 'a', to: 1 }]))
  bad((c) => (c.positions = []))
  bad((c) => (c.positions = [1, 2]))
  bad((c) => ((c.board as unknown[])[sq('e1')] = null)) // king vanished
})

test('toPgn numbers moves and omits a result while playing', () => {
  assert.equal(toPgn(newGame()), '')
  const s = play(newGame(), 'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5')
  assert.equal(toPgn(s), '1. e4 e5 2. Nf3 Nc6 3. Bb5')
  const stale = fen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')
  assert.equal(toPgn(stale), '1/2-1/2')
})

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

const fixedRng = () => 0.5

test('AI: returns null when there are no legal moves', () => {
  const mated = play(newGame(), 'f2f3', 'e7e5', 'g2g4', 'd8h4')
  assert.equal(bestMove(mated, 3), null)
  assert.equal(bestMove(fen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), 4), null)
})

test('AI: finds mate in one at levels 3 and 4', () => {
  const back = fen('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1')
  for (const level of [3, 4] as const) {
    const m = bestMove(back, level, fixedRng)!
    assert.equal(m.san, 'Ra8#', `level ${level}`)
  }
  // Black to find a mate too (fool's mate setup).
  const fool = play(newGame(), 'f2f3', 'e7e5', 'g2g4')
  assert.equal(bestMove(fool, 3, fixedRng)!.san, 'Qh4#')
  assert.equal(bestMove(fool, 4, fixedRng)!.san, 'Qh4#')
})

test('AI: takes a hanging queen at level 3', () => {
  const s = fen('rnb1kbnr/ppp1pppp/8/8/3q4/4P3/PPPP1PPP/RNBQKBNR w KQkq - 0 1')
  assert.equal(bestMove(s, 3, fixedRng)!.san, 'exd4')
})

test('AI: always plays a legal move at every level, deterministically for a fixed rng', () => {
  const s = play(newGame(), 'e2e4', 'e7e5', 'g1f3')
  for (const level of [1, 2, 3, 4] as const) {
    const m = bestMove(s, level, fixedRng)!
    assert.ok(m, `level ${level}`)
    assert.ok(makeMove(s, m), `level ${level} move must be legal`)
  }
  assert.equal(bestMove(s, 1, () => 0.9)!.san, bestMove(s, 1, () => 0.9)!.san)
})

test('AI: level 1 plays a random move about 30% of the time but keeps playing legal moves', () => {
  const s = newGame()
  const seen = new Set<string>()
  let seed = 1
  const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  for (let i = 0; i < 40; i++) seen.add(bestMove(s, 1, rng)!.san)
  assert.ok(seen.size > 3, 'opening choice should vary')
})

test('AI: respects its time budget from a middlegame position', () => {
  const s = fen('r1bq1rk1/ppp2ppp/2n2n2/3pp3/1bPP4/2N1PN2/PP3PPP/R1BQKB1R w KQ - 0 7')
  const budgets = { 1: 250, 2: 400, 3: 900, 4: 1500 } as const
  for (const level of [1, 2, 3, 4] as const) {
    const t0 = Date.now()
    const m = bestMove(s, level, fixedRng)!
    const dt = Date.now() - t0
    assert.ok(makeMove(s, m))
    assert.ok(dt < budgets[level], `level ${level} took ${dt}ms`)
  }
})

test('AI: vs itself, a short game stays legal and ends or continues without throwing', () => {
  let s = newGame()
  let seed = 7
  const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  for (let i = 0; i < 24 && status(s).kind === 'playing'; i++) {
    const m = bestMove(s, (i % 2 === 0 ? 2 : 1) as 1 | 2, rng)!
    const next = makeMove(s, m)
    assert.ok(next, `ply ${i}: ${m.san}`)
    s = next
  }
  assert.ok(isChessState(s))
})

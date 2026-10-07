import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  advance,
  allTiles,
  applyAction,
  isHumanTurn,
  legalActions,
  newMatch,
  pendingFor,
  pendingSeats,
  startHand,
  validateSave,
  type GameState,
  type Meld,
} from './mahjong-engine'
import {
  decompositions,
  faanToPoints,
  isWinningHand,
  scoreHand,
  shanten,
  toCounts,
  waitingTiles,
  type ScoreInput,
} from './mahjong-scoring'
import { botAction, playBots, type BotLevel } from './mahjong-bot'
import { fullSet, type TileCode } from './mahjong-tiles'

const H = (s: string): TileCode[] => s.trim().split(/\s+/)
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

/** Assert every tile of the 144 set is present exactly once, plus basic shape invariants. */
function checkInvariants(s: GameState, label = ''): void {
  const got = allTiles(s).slice().sort()
  const want = fullSet(true).sort()
  assert.deepEqual(got, want, `tile conservation ${label}`)
  for (const st of s.seats) {
    assert.ok(st.melds.length <= 4)
    for (const t of st.hand) assert.ok(!/^[fs]/.test(t), 'bonus tile in a hand')
  }
  assert.ok(s.dead.length <= 14)
}

/**
 * Re-deal the loose tiles (live wall + concealed hands) so that the given seats
 * hold exactly the requested hands/melds. Other seats keep their hand sizes.
 */
function rig(
  state: GameState,
  hands: Record<number, TileCode[]>,
  melds: Record<number, Meld[]> = {},
): GameState {
  const s = clone(state)
  const pool: TileCode[] = [...s.wall, ...s.dead]
  const deadSize = s.dead.length
  const sizes = s.seats.map((x) => x.hand.length)
  for (const st of s.seats) pool.push(...st.hand)
  const take = (t: TileCode) => {
    const i = pool.indexOf(t)
    assert.ok(i >= 0, `rig: ${t} unavailable`)
    pool.splice(i, 1)
  }
  for (const [seat, ms] of Object.entries(melds)) {
    for (const m of ms) m.tiles.forEach(take)
    s.seats[+seat].melds = ms
  }
  for (const [seat, h] of Object.entries(hands)) {
    h.forEach(take)
    s.seats[+seat].hand = h.slice().sort((a, b) => fullSet(true).indexOf(a) - fullSet(true).indexOf(b))
    sizes[+seat] = h.length
  }
  for (let i = 0; i < 4; i++) {
    if (hands[i]) continue
    const h: TileCode[] = []
    while (h.length < sizes[i]) {
      const j = pool.findIndex((t) => !/^[fs]/.test(t))
      h.push(pool.splice(j, 1)[0])
    }
    s.seats[i].hand = h
  }
  for (const st of s.seats) st.hand.sort((a, b) => fullSet(true).indexOf(a) - fullSet(true).indexOf(b))
  s.dead = pool.splice(0, deadSize)
  s.wall = pool
  s.drawn = null
  s.drawnFrom = null
  return s
}

const base = (minFaan = 0, seed = 7) => advance(newMatch({ seed, minFaan }))

const baseInput = (over: Partial<ScoreInput>): ScoreInput => ({
  concealed: [],
  melds: [],
  bonus: [],
  winTile: 'd1',
  selfDrawn: false,
  seatWind: 2,
  prevailingWind: 1,
  ...over,
})
const names = (r: { breakdown: { name: string }[] }) => r.breakdown.map((b) => b.name)

// ---------------------------------------------------------------------------
// Dealing and conservation

test('newMatch deals 13 tiles per seat, bonus tiles replaced, 144 tiles accounted for', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = newMatch({ seed })
    assert.equal(s.phase, 'draw')
    assert.equal(s.dealer, 0)
    let bonus = 0
    for (const st of s.seats) {
      assert.equal(st.hand.length, 13)
      bonus += st.bonus.length
    }
    assert.equal(s.wall.length + s.dead.length + 52 + bonus, 144)
    assert.equal(s.dead.length, 14)
    checkInvariants(s, `seed ${seed}`)
  }
})

test('dealer draws a 14th tile on the first advance', () => {
  const s = advance(newMatch({ seed: 3 }))
  assert.equal(s.phase, 'discard')
  assert.equal(s.seats[0].hand.length, 14)
  assert.equal(s.seats[1].hand.length, 13)
  assert.ok(s.drawn && s.seats[0].hand.includes(s.drawn))
  assert.ok(isHumanTurn(s) && pendingFor(s, 0) && !pendingFor(s, 1))
  checkInvariants(s)
})

test('bonus tile drawn from the wall is revealed and replaced from the dead wall', () => {
  const s0 = newMatch({ seed: 5 })
  const s1 = clone(s0)
  // Put a flower on top of the live wall and a known tile at the top of the dead wall.
  const rigged = s1
  const idx = rigged.wall.findIndex((t) => /^[fs]/.test(t))
  if (idx >= 0) {
    ;[rigged.wall[idx], rigged.wall[rigged.wall.length - 1]] = [rigged.wall[rigged.wall.length - 1], rigged.wall[idx]]
  } else {
    // flowers are all in hands/bonus/dead already; pull one from the dead wall.
    const di = rigged.dead.findIndex((t) => /^[fs]/.test(t))
    assert.ok(di >= 0)
    const [fl] = rigged.dead.splice(di, 1)
    const swapped = rigged.wall.pop()!
    rigged.dead.push(swapped)
    rigged.wall.push(fl)
  }
  const top = rigged.wall[rigged.wall.length - 1]
  assert.match(top, /^[fs]/)
  const before = rigged.seats[0].bonus.length
  const wallBefore = rigged.wall.length
  const s2 = advance(rigged)
  assert.equal(s2.seats[0].bonus.length, before + 1)
  assert.ok(s2.seats[0].bonus.includes(top))
  assert.equal(s2.seats[0].hand.length, 14)
  assert.ok(!s2.seats[0].hand.some((t) => /^[fs]/.test(t)))
  assert.ok(s2.wall.length <= wallBefore - 1, 'one live tile drawn')
  checkInvariants(s2)
})

test('same seed deals identically; saves resume deterministically', () => {
  const a = newMatch({ seed: 99, minFaan: 1 })
  const b = newMatch({ seed: 99, minFaan: 1 })
  assert.deepEqual(a, b)
  assert.notDeepEqual(a.seats[0].hand, newMatch({ seed: 100 }).seats[0].hand)
  const mid = playBots(a, [0, 1], 'normal', 5) // stops at human seat
  const resumed = validateSave(JSON.parse(JSON.stringify(mid)))
  assert.ok(resumed)
  assert.deepEqual(resumed, mid)
  const f1 = playBots(mid, [], 'hard')
  const f2 = playBots(resumed!, [], 'hard')
  assert.deepEqual(f1, f2)
})

// ---------------------------------------------------------------------------
// Claims

const JUNK0 = H('d5 d1 d9 b1 b9 c1 c9 w2 w3 w4 r2 r3 r1 w1')
const CHOW1 = H('d4 d6 b3 b5 b7 c3 c5 c7 d2 d8 b2 b8 c8')
const PUNG2 = H('d5 d5 b2 b4 b6 b8 c2 c4 c6 c8 d2 d8 w3')
const RON3 = H('d4 d6 b1 b2 b3 c1 c2 c3 w1 w1 w1 r1 r1')
const RON1 = H('d4 d6 b4 b5 b6 c4 c5 c6 w2 w2 w2 r2 r2')

function afterDiscard(s: GameState): GameState {
  const out = applyAction(s, 0, { type: 'discard', tile: 'd5' })
  assert.notEqual(out, s)
  return out
}

test('chow is only offered to the player after the discarder', () => {
  const same = H('d4 d6 b3 b5 b7 c3 c5 c7 d2 d8 b2 b8 c8')
  const s = rig(base(), { 0: JUNK0, 1: same, 2: H('d4 d6 b9 b7 b5 c3 c5 c7 d2 d8 b2 b8 c8'), 3: H('d4 d6 b3 b5 b7 c3 c5 c7 d2 d8 b2 b8 c8') })
  const c = afterDiscard(s)
  assert.equal(c.phase, 'claim')
  const chows = (seat: number) => legalActions(c, seat).filter((a) => a.type === 'chow')
  assert.equal(chows(1).length, 1)
  assert.deepEqual(chows(1)[0], { type: 'chow', tiles: ['d4', 'd6'] })
  assert.equal(chows(2).length, 0)
  assert.equal(chows(3).length, 0)
  assert.ok(legalActions(c, 1).some((a) => a.type === 'pass'))
  // Applying a chow from the wrong seat is rejected.
  assert.equal(applyAction(c, 2, { type: 'chow', tiles: ['d4', 'd6'] }), c)
})

test('chow claim builds the meld, removes the river tile and forces a discard', () => {
  const c = afterDiscard(rig(base(), { 0: JUNK0, 1: CHOW1, 2: PUNG2.slice(2).concat('b9', 'b9'), 3: H('b1 b3 b5 b7 b9 c1 c3 c5 c7 c9 w2 w4 r2') }))
  let s = c
  s = applyAction(s, 1, { type: 'chow', tiles: ['d4', 'd6'] })
  for (const seat of [2, 3]) if (pendingFor(s, seat)) s = applyAction(s, seat, { type: 'pass' })
  assert.equal(s.phase, 'discard')
  assert.equal(s.turn, 1)
  assert.deepEqual(s.seats[1].melds[0].tiles, ['d4', 'd5', 'd6'])
  assert.equal(s.seats[0].discards.length, 0)
  assert.equal(s.seats[1].hand.length + 3, 14)
  assert.equal(s.drawn, null)
  checkInvariants(s)
})

test('pung beats chow', () => {
  const c = afterDiscard(rig(base(), { 0: JUNK0, 1: CHOW1, 2: PUNG2, 3: H('b1 b3 b5 b7 b9 c1 c3 c5 c7 c9 w2 w4 r2') }))
  assert.ok(legalActions(c, 2).some((a) => a.type === 'pung'))
  let s = applyAction(c, 1, { type: 'chow', tiles: ['d4', 'd6'] })
  assert.equal(s.phase, 'claim') // waits for the rest
  s = applyAction(s, 2, { type: 'pung' })
  s = applyAction(s, 3, { type: 'pass' })
  assert.equal(s.phase, 'discard')
  assert.equal(s.turn, 2)
  assert.equal(s.seats[2].melds[0].kind, 'pung')
  assert.equal(s.seats[1].melds.length, 0)
  checkInvariants(s)
})

test('ron beats pung and chow', () => {
  const c = afterDiscard(rig(base(0), { 0: JUNK0, 1: CHOW1, 2: PUNG2, 3: RON3 }))
  assert.ok(legalActions(c, 3).some((a) => a.type === 'ron'))
  let s = applyAction(c, 1, { type: 'chow', tiles: ['d4', 'd6'] })
  s = applyAction(s, 2, { type: 'pung' })
  s = applyAction(s, 3, { type: 'ron' })
  assert.equal(s.phase, 'handOver')
  assert.equal(s.result!.kind, 'win')
  if (s.result!.kind === 'win') {
    assert.equal(s.result!.winner, 3)
    assert.equal(s.result!.from, 0)
    assert.equal(s.result!.payments[3], -s.result!.payments[0])
    assert.equal(s.result!.payments.reduce((a, b) => a + b, 0), 0)
  }
  checkInvariants(s)
})

test('head bump: with two rons the nearest seat after the discarder wins', () => {
  const c = afterDiscard(rig(base(0), { 0: JUNK0, 1: RON1, 2: PUNG2, 3: RON3 }))
  assert.ok(legalActions(c, 1).some((a) => a.type === 'ron'))
  assert.ok(legalActions(c, 3).some((a) => a.type === 'ron'))
  let s = applyAction(c, 3, { type: 'ron' })
  assert.equal(s.phase, 'claim')
  s = applyAction(s, 1, { type: 'ron' })
  assert.equal(s.phase, 'claim')
  s = applyAction(s, 2, { type: 'pass' })
  assert.equal(s.phase, 'handOver')
  assert.equal(s.result!.kind === 'win' && s.result!.winner, 1)
})

test('all pass: the turn moves to the next player, who draws', () => {
  let s = afterDiscard(rig(base(), { 0: JUNK0, 1: CHOW1, 2: PUNG2, 3: H('b1 b3 b5 b7 b9 c1 c3 c5 c7 c9 w2 w4 r2') }))
  for (const seat of pendingSeats(s)) s = applyAction(s, seat, { type: 'pass' })
  assert.equal(s.phase, 'draw')
  assert.equal(s.turn, 1)
  assert.equal(s.seats[0].discards.length, 1)
  s = advance(s)
  assert.equal(s.seats[1].hand.length, 14)
  checkInvariants(s)
})

test('discard-pung of three gives a kong with a replacement draw', () => {
  const s0 = rig(base(), { 0: JUNK0, 1: CHOW1, 2: H('d5 d5 d5 b2 b4 b6 b8 c2 c4 c6 c8 d2 d8'), 3: H('b1 b3 b5 b7 b9 c1 c3 c5 c7 c9 w2 w4 r2') })
  const c = afterDiscard(s0)
  assert.ok(legalActions(c, 2).some((a) => a.type === 'kong'))
  let s = applyAction(c, 2, { type: 'kong' })
  for (const seat of pendingSeats(s)) s = applyAction(s, seat, { type: 'pass' })
  assert.equal(s.phase, 'discard')
  assert.equal(s.turn, 2)
  assert.equal(s.seats[2].melds[0].tiles.length, 4)
  assert.equal(s.seats[2].hand.length + 3, 14)
  assert.equal(s.drawnFrom, 'kong')
  checkInvariants(s)
})

/** Mark every seat as having already discarded once, so heavenly/earthly do not apply. */
function laterInHand(s: GameState): GameState {
  for (const st of s.seats) st.discardHistory.push('c9')
  return s
}

test('min faan gates ron availability', () => {
  const lax = afterDiscard(laterInHand(rig(base(0), { 0: JUNK0, 1: CHOW1, 2: PUNG2, 3: RON3 })))
  assert.ok(legalActions(lax, 3).some((a) => a.type === 'ron'))
  const strict = afterDiscard(laterInHand(rig(base(6), { 0: JUNK0, 1: CHOW1, 2: PUNG2, 3: RON3 })))
  assert.ok(!legalActions(strict, 3).some((a) => a.type === 'ron'))
})

test('robbing the kong', () => {
  const pungMeld: Meld = { kind: 'pung', tiles: ['d5', 'd5', 'd5'], from: 2, claimed: 'd5' }
  const hand0 = H('d5 d1 d9 b1 b9 c1 c9 w2 w3 w4 r3')
  const s0 = laterInHand(rig(base(0), { 0: hand0, 1: RON1, 3: H('b1 b3 b5 b7 b9 c1 c3 c5 c7 c9 w3 w4 r2') }, { 0: [pungMeld] }))
  assert.equal(s0.seats[0].hand.length + 3, 14)
  s0.drawn = 'd5'
  assert.ok(legalActions(s0, 0).some((a) => a.type === 'addKong' && a.tile === 'd5'))
  let s = applyAction(s0, 0, { type: 'addKong', tile: 'd5' })
  assert.equal(s.phase, 'claim')
  assert.equal(s.claim!.kind, 'robKong')
  assert.deepEqual(legalActions(s, 1).map((a) => a.type), ['ron', 'pass'])
  const robbed = applyAction(s, 1, { type: 'ron' })
  assert.equal(robbed.phase, 'handOver')
  const res = robbed.result!
  assert.ok(res.kind === 'win' && res.winner === 1 && res.from === 0)
  assert.ok(res.kind === 'win' && names(res.score).includes('Robbing the kong'))
  // If nobody robs, the kong completes and the declarer draws a replacement.
  s = applyAction(s, 1, { type: 'pass' })
  for (const seat of pendingSeats(s)) s = applyAction(s, seat, { type: 'pass' })
  assert.equal(s.phase, 'discard')
  assert.equal(s.seats[0].melds[0].kind, 'kong')
  assert.equal(s.seats[0].hand.length + 3, 14)
  checkInvariants(s)
})

test('concealed kong is offered with four in hand and draws a replacement', () => {
  const s0 = rig(base(), { 0: H('d5 d5 d5 d5 b1 b3 b5 b7 b9 c1 c3 c5 c7 c9') })
  assert.ok(legalActions(s0, 0).some((a) => a.type === 'concealedKong' && a.tile === 'd5'))
  const s = applyAction(s0, 0, { type: 'concealedKong', tile: 'd5' })
  assert.equal(s.phase, 'discard')
  assert.equal(s.seats[0].melds[0].concealed, true)
  assert.equal(s.seats[0].hand.length + 3, 14)
  checkInvariants(s)
})

test('tsumo ends the hand and every seat pays', () => {
  const win = H('d1 d2 d3 d4 d5 d6 b2 b3 b4 c5 c6 c7 d9 d9')
  const s0 = rig(base(0), { 0: win })
  s0.drawn = 'd9'
  assert.ok(legalActions(s0, 0).some((a) => a.type === 'tsumo'))
  const s = applyAction(s0, 0, { type: 'tsumo' })
  assert.equal(s.phase, 'handOver')
  const r = s.result!
  assert.ok(r.kind === 'win' && r.selfDrawn && r.winner === 0 && r.from === null)
  if (r.kind === 'win') {
    assert.ok(names(r.score).includes('Self-drawn'))
    const each = Math.ceil(r.score.points / 2)
    assert.deepEqual(r.payments, [each * 3, -each, -each, -each])
    assert.equal(r.dealerRetains, true)
  }
  assert.equal(s.seats.reduce((a, x) => a + x.score, 0), 0)
})

test('illegal and out-of-turn actions return the same state', () => {
  const s = base()
  assert.equal(applyAction(s, 1, { type: 'discard', tile: s.seats[1].hand[0] }), s)
  assert.equal(applyAction(s, 0, { type: 'discard', tile: 'zz' }), s)
  assert.equal(applyAction(s, 0, { type: 'pass' }), s)
  assert.equal(applyAction(s, 0, { type: 'tsumo' }), s)
  assert.deepEqual(legalActions(s, 2), [])
})

test('exhaustive draw: empty wall ends the hand; dealer retention follows the option', () => {
  const s = newMatch({ seed: 4 })
  const w = clone(s)
  w.wall = []
  const e = advance(w)
  assert.equal(e.phase, 'handOver')
  assert.equal(e.result!.kind, 'draw')
  assert.equal(e.result!.dealerRetains, true)
  const w2 = clone(newMatch({ seed: 4, dealerKeepsOnDraw: false }))
  w2.wall = []
  assert.equal(advance(w2).result!.dealerRetains, false)
  const next = startHand(e)
  assert.equal(next.dealer, 0)
  assert.equal(next.dealerStreak, 1)
  assert.equal(next.phase, 'draw')
  const next2 = startHand(advance(w2))
  assert.equal(next2.dealer, 1)
  assert.equal(next2.rotations, 1)
})

test('heavenly hand: dealer self-draw on the first turn is a limit hand', () => {
  const s0 = rig(base(0), { 0: H('d1 d2 d3 d4 d5 d6 b2 b3 b4 c5 c6 c7 d9 d9') })
  s0.drawn = 'd9'
  s0.drawnFrom = 'wall'
  const s = applyAction(s0, 0, { type: 'tsumo' })
  const r = s.result!
  assert.ok(r.kind === 'win' && r.score.limit && names(r.score).includes('Heavenly hand'))
})

test('last live tile win gets the last-tile faan', () => {
  const win = H('d1 d2 d3 d4 d5 d6 b2 b3 b4 c5 c6 c7 d9 d9')
  const s0 = laterInHand(rig(base(0), { 0: win }))
  s0.drawn = 'd9'
  s0.drawnFrom = 'wall'
  s0.wall = [] // pool contents irrelevant for this check
  const s = applyAction(s0, 0, { type: 'tsumo' })
  const r = s.result!
  assert.ok(r.kind === 'win' && names(r.score).includes('Win on last tile'))
})

// ---------------------------------------------------------------------------
// Decomposition, waits, shanten

test('nine gates 1112345678999 waits on all nine ranks', () => {
  const hand = H('d1 d1 d1 d2 d3 d4 d5 d6 d7 d8 d9 d9 d9')
  assert.deepEqual(waitingTiles(hand), ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9'])
  for (let r = 1; r <= 9; r++) {
    const full = [...hand, `d${r}`]
    assert.ok(isWinningHand(full), `d${r}`)
    const sc = scoreHand(baseInput({ concealed: full, winTile: `d${r}` }))!
    assert.ok(sc.limit && names(sc).includes('Nine gates'))
  }
})

test('tricky decompositions: 22334455 shapes', () => {
  const hand = H('d2 d2 d3 d3 d4 d4 d5 d5 b1 b2 b3 c9 c9')
  assert.deepEqual(waitingTiles(hand), ['d2', 'd5', 'c9'].sort((a, b) => fullSet(false).indexOf(a) - fullSet(false).indexOf(b)))
  // 11223344556677 can be read as seven pairs or as chows + pair.
  const pairs = H('d1 d1 d2 d2 d3 d3 d4 d4 d5 d5 d6 d6 d7 d7')
  const dec = decompositions(toCounts(pairs), 4)
  assert.ok(dec.length >= 2)
  const sc = scoreHand(baseInput({ concealed: pairs, winTile: 'd7' }))!
  assert.equal(sc.pattern, 'sevenPairs') // best reading: seven pairs + pure suit, capped
  assert.equal(sc.faan, 10)
  // 3334 waits on 2, 4, 5.
  assert.deepEqual(waitingTiles(H('d3 d3 d3 d4 b1 b2 b3 c1 c2 c3 w1 w1 w1')), ['d2', 'd4', 'd5'])
  assert.deepEqual(waitingTiles(H('d1 d2 d3 d4 d5 d6 d7 d8 b1 b1 b1 c5 c5')), ['d3', 'd6', 'd9'])
})

test('waitingTiles accounts for melds and four-of-a-kind', () => {
  assert.deepEqual(waitingTiles(H('d1 d1 d1 d1 d2 d3 b4 b5 b6 c7 c8 c9 w1')), ['w1']) // d1 is exhausted
  assert.deepEqual(waitingTiles(H('d4 d6 b1 b2 b3 c1 c2 c3 r1 r1'), 1), ['d5'])
  assert.deepEqual(waitingTiles(H('d1 d2 d3 b1 b2 b3 c4 c5 c6 w1 w1 w1 r1 r1 r1')), []) // wrong size
})

test('seven pairs and thirteen orphans are detected', () => {
  const sp = H('d1 d1 d3 d3 b5 b5 c7 c7 w1 w1 r2 r2 b9 b9')
  assert.ok(isWinningHand(sp))
  const sc = scoreHand(baseInput({ concealed: sp, winTile: 'b9' }))!
  assert.equal(sc.pattern, 'sevenPairs')
  assert.ok(names(sc).includes('Seven pairs'))
  // Four of a kind does not count as two pairs.
  assert.ok(!isWinningHand(H('d1 d1 d1 d1 d3 d3 b5 b5 c7 c7 w1 w1 r2 r2')))
  const to = H('d1 d9 b1 b9 c1 c9 w1 w2 w3 w4 r1 r2 r3 r3')
  assert.ok(isWinningHand(to))
  const t = scoreHand(baseInput({ concealed: to, winTile: 'r3' }))!
  assert.equal(t.pattern, 'thirteenOrphans')
  assert.equal(t.faan, 10)
  assert.ok(t.limit)
  assert.ok(!isWinningHand(H('d1 d9 b1 b9 c1 c9 w1 w2 w3 w4 r1 r2 d2 d2')))
})

test('shanten of known hands', () => {
  assert.equal(shanten(H('d1 d1 d1 d2 d3 d4 d5 d6 d7 d8 d9 d9 d9')), 0)
  assert.equal(shanten(H('d1 d1 d1 d2 d3 d4 d5 d6 d7 d8 d9 d9 d9 d5')), -1)
  assert.equal(shanten(H('d1 d2 d3 b4 b5 b6 c7 c8 c9 w1 w1 w2 w3')), 1)
  assert.equal(shanten(H('d1 d9 b1 b9 c1 c9 w1 w2 w3 w4 r1 r2 r3')), 0)
  assert.equal(shanten(H('d1 d1 d3 d3 b5 b5 c7 c7 w1 w1 r2 r2 b9')), 0)
  assert.equal(shanten(H('d1 d4 d7 b2 b5 b8 c3 c6 c9 w1 w2 w3 r1')), 6)
  assert.equal(shanten(H('d1 d2 d3 d5 d6 d7 b2 b3 b4 c5 c6 w1 w1')), 0)
  assert.equal(shanten(H('d1 d2 d4 d5 d7 d8 b2 b4 c3 c5 c8 w1 r1')), 4)
  // With declared melds the concealed part shrinks.
  assert.equal(shanten(H('d1 d2 d3 b4 b5 b6 c7 c8 w1 w1'), 1), 0)
  assert.equal(shanten(H('d1 d2 d3 b4 b5 b6 c7 c8 c9 w1 w1'), 1), -1)
})

// ---------------------------------------------------------------------------
// Scoring

test('common hand and concealment', () => {
  const concealed = H('d1 d2 d3 d4 d5 d6 b2 b3 b4 c5 c6 c7 d9 d9')
  const ron = scoreHand(baseInput({ concealed, winTile: 'd3' }))!
  assert.equal(ron.faan, 3)
  assert.deepEqual(names(ron).sort(), ['Common hand', 'Concealed hand', 'No flowers'])
  const tsumo = scoreHand(baseInput({ concealed, winTile: 'd3', selfDrawn: true }))!
  assert.equal(tsumo.faan, 4)
  assert.equal(tsumo.points, faanToPoints(4))
  assert.equal(tsumo.points, 16)
  // A dragon pair is not a "common hand".
  const dragonPair = scoreHand(baseInput({ concealed: H('d1 d2 d3 d4 d5 d6 b2 b3 b4 c5 c6 c7 r1 r1'), winTile: 'd3' }))!
  assert.ok(!names(dragonPair).includes('Common hand'))
})

test('all pungs with value tiles and exposed melds', () => {
  const melds: Meld[] = [
    { kind: 'pung', tiles: ['r1', 'r1', 'r1'], from: 1 },
    { kind: 'pung', tiles: ['w1', 'w1', 'w1'], from: 2 },
  ]
  const sc = scoreHand(
    baseInput({ concealed: H('b2 b2 b2 c3 c3 c3 d9 d9'), melds, winTile: 'd9', seatWind: 1, prevailingWind: 1 }),
  )!
  assert.equal(sc.faan, 7)
  assert.deepEqual(names(sc).sort(), [
    'All pungs',
    'No flowers',
    'Prevailing wind pung (East)',
    'Red dragon pung',
    'Seat wind pung (East)',
  ])
})

test('flushes, caps and limit hands', () => {
  const pure = scoreHand(baseInput({ concealed: H('d1 d2 d3 d2 d3 d4 d5 d6 d7 d7 d8 d9 d5 d5'), winTile: 'd5' }))!
  assert.equal(pure.faan, 9) // pure 6 + concealed 1 + common 1 + no flowers 1
  const mixed = scoreHand(baseInput({ concealed: H('d1 d2 d3 d4 d5 d6 d7 d8 d9 w1 w1 w1 r1 r1'), winTile: 'd9' }))!
  assert.ok(names(mixed).includes('Mixed one suit'))
  const capped = scoreHand(baseInput({ concealed: H('d1 d1 d1 d2 d2 d2 d3 d3 d3 d4 d4 d4 d5 d5'), winTile: 'd5', selfDrawn: true }))!
  assert.equal(capped.faan, 10)
  assert.ok(capped.rawFaan > 10 && capped.limit)
  const lower = scoreHand(baseInput({ concealed: H('d1 d1 d1 d2 d2 d2 d3 d3 d3 d4 d4 d4 d5 d5'), winTile: 'd5', selfDrawn: true, cap: 8 }))!
  assert.equal(lower.faan, 8)
  assert.equal(lower.points, 64)
  const honours = scoreHand(baseInput({ concealed: H('w1 w1 w1 w2 w2 w2 r1 r1 r1 r2 r2 r2 w3 w3'), winTile: 'w3' }))!
  assert.ok(names(honours).includes('All honours'))
  const terminals = scoreHand(baseInput({ concealed: H('d1 d1 d1 d9 d9 d9 b1 b1 b1 c9 c9 c9 c1 c1'), winTile: 'c1' }))!
  assert.ok(names(terminals).includes('All terminals'))
})

test('dragons and winds', () => {
  const great = scoreHand(
    baseInput({
      concealed: H('b1 b2 b3 c5 c5'),
      melds: ['r1', 'r2', 'r3'].map((t) => ({ kind: 'pung', tiles: [t, t, t] }) as Meld),
      winTile: 'b3',
    }),
  )!
  assert.ok(great.limit && great.faan === 10 && names(great).includes('Great three dragons'))
  const small = scoreHand(
    baseInput({
      concealed: H('r3 r3 b1 b2 b3 c4 c5 c6'),
      melds: ['r1', 'r2'].map((t) => ({ kind: 'pung', tiles: [t, t, t] }) as Meld),
      winTile: 'b3',
    }),
  )!
  assert.equal(small.faan, 8) // small 5 + two dragon pungs + no flowers
  assert.ok(names(small).includes('Small three dragons'))
  const fourWinds = scoreHand(
    baseInput({ concealed: H('w1 w1 w1 w2 w2 w2 w3 w3 w3 w4 w4 w4 b5 b5'), winTile: 'b5' }),
  )!
  assert.ok(fourWinds.limit && names(fourWinds).includes('Great four winds'))
  const smallWinds = scoreHand(
    baseInput({ concealed: H('w1 w1 w1 w2 w2 w2 w3 w3 w3 w4 w4 b1 b2 b3'), winTile: 'b3' }),
  )
  assert.ok(smallWinds && names(smallWinds).includes('Small four winds'))
})

test('all kongs, flowers and situational faan', () => {
  const kongs = ['d1', 'd2', 'd3', 'd4'].map((t) => ({ kind: 'kong', tiles: [t, t, t, t], concealed: true }) as Meld)
  const sc = scoreHand(baseInput({ concealed: ['b5', 'b5'], melds: kongs, winTile: 'b5' }))!
  assert.ok(sc.limit && names(sc).includes('All kongs'))
  const concealed = H('d1 d2 d3 d4 d5 d6 b2 b3 b4 c5 c6 c7 d9 d9')
  const fl = scoreHand(baseInput({ concealed, winTile: 'd3', seatWind: 1, bonus: ['f1', 's1'] }))!
  assert.equal(fl.faan, 4) // concealed + common + own flower + own season
  const set = scoreHand(baseInput({ concealed, winTile: 'd3', seatWind: 3, bonus: ['f1', 'f2', 'f3', 'f4'] }))!
  assert.ok(names(set).includes('Complete flower set') && names(set).includes('Own seat flower'))
  const all8 = scoreHand(baseInput({ concealed, winTile: 'd3', bonus: ['f1', 'f2', 'f3', 'f4', 's1', 's2', 's3', 's4'] }))!
  assert.ok(all8.limit)
  const sit = scoreHand(baseInput({ concealed, winTile: 'd3', selfDrawn: true, lastTile: true, kongReplacement: true }))!
  assert.ok(names(sit).includes('Win on last tile') && names(sit).includes('Win on kong replacement'))
  const rob = scoreHand(baseInput({ concealed, winTile: 'd3', robbingKong: true }))!
  assert.ok(names(rob).includes('Robbing the kong'))
  assert.ok(scoreHand(baseInput({ concealed, winTile: 'd3', heavenly: true }))!.limit)
  assert.ok(scoreHand(baseInput({ concealed, winTile: 'd3', earthly: true }))!.limit)
  const chicken = scoreHand(
    baseInput({
      concealed: H('d1 d2 d3 d4 d5 d6 b2 b3 b4 c5 c6 c7 r1 r1'),
      melds: [],
      winTile: 'd3',
      bonus: ['f4'],
    }),
  )!
  assert.equal(chicken.faan, 1)
  const open = scoreHand(
    baseInput({
      concealed: H('d4 d5 d6 b2 b3 b4 c5 c6 c7 r1 r1'),
      melds: [{ kind: 'chow', tiles: ['d1', 'd2', 'd3'], from: 3 }],
      winTile: 'd6',
      bonus: ['f4'],
    }),
  )!
  assert.equal(open.faan, 0)
  assert.deepEqual(names(open), ['Chicken hand'])
  assert.equal(open.points, 1)
  assert.equal(scoreHand(baseInput({ concealed: H('d1 d2 d4 d5 d6 b2 b3 b4 c5 c6 c7 r1 r1 r2'), winTile: 'r2' })), null)
})

test('payout table', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 99].map(faanToPoints), [1, 2, 4, 8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 384])
})

// ---------------------------------------------------------------------------
// validateSave

test('validateSave accepts genuine states and rejects junk', () => {
  const fresh = newMatch({ seed: 11 })
  assert.deepEqual(validateSave(clone(fresh)), fresh)
  const mid = playBots(fresh, [0], 'normal')
  assert.deepEqual(validateSave(clone(mid)), mid)
  const done = playBots(fresh, [], 'normal')
  assert.deepEqual(validateSave(clone(done)), done)
  // A live claim state.
  const c = afterDiscard(rig(base(), { 0: JUNK0, 1: CHOW1, 2: PUNG2 }))
  assert.deepEqual(validateSave(clone(c)), c)

  for (const junk of [null, undefined, 0, 'x', [], {}, { version: 1 }, true, () => 1, NaN]) {
    assert.equal(validateSave(junk), null)
  }
  const mutate = (fn: (s: GameState & Record<string, unknown>) => void) => {
    const s = clone(mid) as GameState & Record<string, unknown>
    fn(s)
    return validateSave(s)
  }
  assert.equal(mutate((s) => (s.version = 2 as never)), null, 'mutation 1')
  assert.equal(mutate((s) => (s.phase = 'bogus' as never)), null, 'mutation 2')
  assert.equal(mutate((s) => (s.turn = 7)), null, 'mutation 3')
  assert.equal(mutate((s) => (s.seats[1].hand[0] = 'zz')), null, 'mutation 4')
  assert.equal(mutate((s) => s.seats[2].hand.push('d1')), null, 'mutation 5')
  assert.equal(mutate((s) => s.wall.pop()), null, 'mutation 6')
  assert.equal(mutate((s) => (s.rng.counter = -1)), null, 'mutation 7')
  assert.equal(mutate((s) => (s.opts.minFaan = 99)), null, 'mutation 8')
  assert.equal(mutate((s) => (s.seats = s.seats.slice(0, 3))), null, 'mutation 9')
  assert.equal(mutate((s) => (s.names = ['a', 'b'])), null, 'mutation 10')
  assert.equal(mutate((s) => (s.seats[0].score = Infinity)), null, 'mutation 11')
  assert.equal(mutate((s) => (s.claim = { kind: 'discard' } as never)), null, 'mutation 12')
  assert.equal(mutate((s) => (s.result = { kind: 'draw' } as never)), null, 'mutation 13')
  assert.equal(mutate((s) => (s.seats[0].melds = [{ kind: 'pung', tiles: ['d1', 'd2', 'd3'] }])), null, 'mutation 14')
  assert.equal(mutate((s) => (s.drawn = 'b9')), null, 'mutation 15')
  assert.equal(validateSave(JSON.parse('{"__proto__":{"x":1},"version":1}')), null)
  // Forged claim: a ron nobody could make.
  const forged = clone(c) as GameState
  forged.claim!.options[3] = [{ type: 'ron' }]
  assert.equal(validateSave(forged), null)
  // handOver with a missing result
  const over = clone(done) as GameState
  over.result = null
  assert.equal(validateSave(over), null)
})


// ---------------------------------------------------------------------------
// Bots and soak

test('botAction returns only legal actions and nothing when not pending', () => {
  const s = base(0)
  for (const level of ['easy', 'normal', 'hard'] as BotLevel[]) {
    const a = botAction(s, 0, level)!
    assert.ok(legalActions(s, 0).some((x) => JSON.stringify(x) === JSON.stringify(a)), level)
    assert.equal(botAction(s, 1, level), null)
  }
})

test('bots always ron / tsumo when legal', () => {
  const c = afterDiscard(rig(base(0), { 0: JUNK0, 1: CHOW1, 2: PUNG2, 3: RON3 }))
  for (const level of ['easy', 'normal', 'hard'] as BotLevel[]) assert.deepEqual(botAction(c, 3, level), { type: 'ron' })
  const win = H('d1 d2 d3 d4 d5 d6 b2 b3 b4 c5 c6 c7 d9 d9')
  const t = rig(base(0), { 0: win })
  t.drawn = 'd9'
  for (const level of ['easy', 'normal', 'hard'] as BotLevel[]) assert.deepEqual(botAction(t, 0, level), { type: 'tsumo' })
})

test('a match plays through every hand to matchOver and stays zero-sum', () => {
  let s = newMatch({ seed: 21, rounds: 'east', minFaan: 1 })
  let hands = 0
  while (s.phase !== 'matchOver') {
    s = playBots(s, [], ['normal', 'easy', 'hard', 'normal'])
    assert.equal(s.phase, 'handOver')
    hands++
    assert.ok(hands < 100)
    s = startHand(s)
  }
  assert.equal(s.rotations, 4)
  assert.ok(hands >= 4)
  assert.equal(s.seats.reduce((a, x) => a + x.score, 0), 0)
})

test('soak: 200 bot-only hands terminate with all invariants intact', () => {
  const levels: BotLevel[] = ['easy', 'normal', 'hard']
  let wins = 0
  let draws = 0
  let maxMs = 0
  const decisionMs: number[] = []
  const t0 = Date.now()
  for (let i = 0; i < 200; i++) {
    let s = newMatch({ seed: 1000 + i, minFaan: [0, 1, 3, 3][i % 4], rounds: i % 2 ? 'east' : 'full' })
    const lv = (seat: number) => levels[(i + seat) % 3]
    let steps = 0
    while (s.phase !== 'handOver') {
      assert.ok(++steps < 1500, `seed ${1000 + i} did not terminate`)
      if (s.phase === 'draw') {
        s = advance(s)
      } else {
        const seat = pendingSeats(s)[0]
        const t = performance.now()
        const a = botAction(s, seat, lv(seat))!
        const d = performance.now() - t
        decisionMs.push(d)
        if (d > maxMs) maxMs = d
        const n = applyAction(s, seat, a)
        assert.notEqual(n, s, `bot action rejected: ${JSON.stringify(a)}`)
        s = n
      }
      if (steps % 7 === 0) checkInvariants(s, `seed ${1000 + i} step ${steps}`)
    }
    checkInvariants(s, `seed ${1000 + i} end`)
    const r = s.result!
    assert.equal(r.payments.reduce((a, b) => a + b, 0), 0)
    if (r.kind === 'win') {
      wins++
      assert.ok(r.score.faan >= s.opts.minFaan)
    } else draws++
    assert.ok(validateSave(clone(s)), 'final state validates')
  }
  decisionMs.sort((a, b) => a - b)
  const med = decisionMs[Math.floor(decisionMs.length / 2)]
  const p99 = decisionMs[Math.floor(decisionMs.length * 0.99)]
  console.log(
    `soak: 200 hands in ${Date.now() - t0} ms; wins ${wins}, draws ${draws}; bot decision median ${med.toFixed(2)} ms, p99 ${p99.toFixed(2)} ms, max ${maxMs.toFixed(1)} ms`,
  )
  assert.ok(wins > 20, 'bots should win some hands')
  assert.ok(p99 < 60, `p99 decision time ${p99}`)
})

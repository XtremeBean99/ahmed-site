import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LAYOUTS,
  LAYOUT_IDS,
  availableMoves,
  canMatch,
  freeTiles,
  generateDeal,
  hint,
  isFree,
  isStuck,
  isWon,
  newGame,
  removePair,
  renderOrder,
  selectTile,
  shuffleRemaining,
  tilesLeft,
  tilesMatch,
  undo,
  validateSave,
  type LayoutId,
  type SolitaireState,
} from './mahjong-solitaire'
import { mulberry32 } from './mahjong-tiles'

function custom(tiles: { x: number; y: number; z: number; code?: string }[]): SolitaireState {
  return {
    layoutId: 'turtle',
    seed: 0,
    tiles: tiles.map((t, id) => ({ id, code: t.code ?? 'd1', x: t.x, y: t.y, z: t.z, removed: false })),
    history: [],
    selected: null,
  }
}

const multiset = (s: SolitaireState) =>
  s.tiles.filter((t) => !t.removed).map((t) => t.code).sort()

test('tilesMatch: identical, flowers, seasons', () => {
  assert.ok(tilesMatch('d1', 'd1'))
  assert.ok(!tilesMatch('d1', 'd2'))
  assert.ok(!tilesMatch('d1', 'b1'))
  assert.ok(tilesMatch('f1', 'f4'))
  assert.ok(tilesMatch('s2', 's3'))
  assert.ok(!tilesMatch('f1', 's1'))
  assert.ok(!tilesMatch('w1', 'w2'))
  assert.ok(!tilesMatch('zz', 'zz'))
})

test('free rule: blocked from above', () => {
  const s = custom([{ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }])
  assert.ok(!isFree(s, 0))
  assert.ok(isFree(s, 1))
  // a tile just out of overlap range does not block
  const t = custom([{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 1 }])
  assert.ok(isFree(t, 0))
  // two layers up still blocks
  const u = custom([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 2 }])
  assert.ok(!isFree(u, 0))
})

test('free rule: blocked both sides vs one side', () => {
  const s = custom([{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }])
  assert.ok(isFree(s, 0))
  assert.ok(!isFree(s, 1))
  assert.ok(isFree(s, 2))
  // half-row-offset neighbours still count as adjacent
  const h = custom([{ x: 2, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 4, y: 1, z: 0 }])
  assert.ok(!isFree(h, 0))
  // neighbours on a different row or layer do not
  const o = custom([{ x: 2, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 4, y: 0, z: 1 }])
  assert.ok(isFree(o, 0)) // neighbour a row away and a layer-up tile 2 units over: neither blocks
})

test('free rule: removed tiles stop blocking', () => {
  const s = custom([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }])
  const r = removePair(s, 1, 1)
  assert.equal(r, s)
  const t = { ...s, tiles: s.tiles.map((x) => (x.id === 1 ? { ...x, removed: true } : x)) }
  assert.ok(isFree(t, 0))
  assert.ok(!isFree(t, 1))
  assert.ok(!isFree(s, 99))
})

test('layouts: even counts, no overlapping tiles on a layer, turtle is 144', () => {
  assert.equal(LAYOUTS.turtle.positions.length, 144)
  for (const id of LAYOUT_IDS) {
    const ps = LAYOUTS[id].positions
    assert.equal(LAYOUTS[id].id, id)
    assert.equal(ps.length % 2, 0, id)
    assert.ok(ps.length <= 144)
    for (let i = 0; i < ps.length; i++) {
      assert.ok(Number.isInteger(ps[i].x) && Number.isInteger(ps[i].y) && Number.isInteger(ps[i].z))
      for (let j = i + 1; j < ps.length; j++) {
        const overlap = ps[i].z === ps[j].z && Math.abs(ps[i].x - ps[j].x) < 2 && Math.abs(ps[i].y - ps[j].y) < 2
        assert.ok(!overlap, `${id}: ${i} overlaps ${j}`)
      }
    }
  }
  assert.ok(LAYOUT_IDS.length >= 3)
})

test('generated deals are solvable by replaying the generator solution', () => {
  for (const id of LAYOUT_IDS) {
    for (let seed = 1; seed <= 50; seed++) {
      const deal = generateDeal(id, seed)
      let s = newGame(id, seed)
      assert.deepEqual(s.tiles.map((t) => t.code), deal.codes)
      for (const [a, b] of deal.solution) {
        const next = removePair(s, a, b)
        assert.notEqual(next, s, `${id}/${seed}: illegal solution move`)
        s = next
      }
      assert.ok(isWon(s), `${id}/${seed}`)
    }
  }
})

test('deals are deterministic and seeds differ', () => {
  for (const id of LAYOUT_IDS) {
    assert.deepEqual(newGame(id, 42), newGame(id, 42))
    assert.notDeepEqual(newGame(id, 42).tiles.map((t) => t.code), newGame(id, 43).tiles.map((t) => t.code))
  }
})

test('turtle deal draws from the legal tile set', () => {
  const codes = newGame('turtle', 5).tiles.map((t) => t.code).sort()
  const counts = new Map<string, number>()
  for (const c of codes) counts.set(c, (counts.get(c) ?? 0) + 1)
  for (const [c, n] of counts) assert.ok(n <= (/^[fs]/.test(c) ? 1 : 4), c)
  assert.equal(codes.filter((c) => c[0] === 'f').length, 4)
  assert.equal(codes.filter((c) => c[0] === 's').length, 4)
})

test('hint always returns a legal move; hint-greedy play makes progress', () => {
  for (const id of LAYOUT_IDS) {
    let s = newGame(id, 11)
    let guard = 0
    while (!isWon(s) && !isStuck(s) && guard++ < 200) {
      const m = hint(s)
      assert.ok(m)
      assert.ok(canMatch(s, m![0], m![1]))
      s = removePair(s, m![0], m![1])
    }
    // Greedy play need not win, but it should get most of the way through.
    assert.ok(tilesLeft(s) < s.tiles.length / 2, `${id}: left ${tilesLeft(s)}`)
  }
  assert.equal(hint(custom([{ x: 0, y: 0, z: 0, code: 'd1' }, { x: 2, y: 0, z: 0, code: 'd2' }])), null)
})

test('removePair rejects illegal moves and returns the same state', () => {
  const s = newGame('turtle', 3)
  assert.equal(removePair(s, 0, 0), s)
  assert.equal(removePair(s, -1, 2), s)
  assert.equal(removePair(s, 0, 9999), s)
  const blocked = s.tiles.find((t) => !isFree(s, t.id))!
  const free = freeTiles(s)[0]
  assert.equal(removePair(s, blocked.id, free.id), s)
  const [a, b] = availableMoves(s)[0]
  const t = removePair(s, a, b)
  assert.notEqual(t, s)
  assert.equal(s.tiles[a].removed, false) // input untouched
  assert.equal(removePair(t, a, b), t) // already removed
  assert.equal(tilesLeft(t), 142)
})

test('availableMoves are exactly the matching free pairs', () => {
  const s = newGame('pyramid', 8)
  const free = freeTiles(s)
  let expected = 0
  for (let i = 0; i < free.length; i++)
    for (let j = i + 1; j < free.length; j++) if (tilesMatch(free[i].code, free[j].code)) expected++
  const moves = availableMoves(s)
  assert.equal(moves.length, expected)
  for (const [a, b] of moves) assert.ok(canMatch(s, a, b))
})

test('undo restores previous state; no-op on empty history', () => {
  const s = newGame('turtle', 21)
  assert.equal(undo(s), s)
  const [a, b] = availableMoves(s)[0]
  const t = removePair(s, a, b)
  assert.deepEqual(undo(t), s)
  const [c, d] = availableMoves(t)[0]
  assert.deepEqual(undo(undo(removePair(t, c, d))), s)
})

test('stuck and won detection', () => {
  const stuck = custom([{ x: 0, y: 0, z: 0, code: 'd1' }, { x: 2, y: 0, z: 0, code: 'd2' }])
  assert.ok(isStuck(stuck))
  assert.ok(!isWon(stuck))
  const pair = custom([{ x: 0, y: 0, z: 0, code: 'f1' }, { x: 2, y: 0, z: 0, code: 'f3' }])
  assert.ok(!isStuck(pair))
  const done = removePair(pair, 0, 1)
  assert.ok(isWon(done))
  assert.ok(!isStuck(done))
})

test('selectTile selects, deselects, switches and matches', () => {
  let s = custom([
    { x: 0, y: 0, z: 0, code: 'd1' },
    { x: 4, y: 0, z: 0, code: 'd1' },
    { x: 8, y: 0, z: 0, code: 'd2' },
    { x: 12, y: 0, z: 0, code: 'd2' },
    { x: 20, y: 0, z: 0, code: 'd3' },
    { x: 20, y: 0, z: 1, code: 'd3' },
  ])
  s = selectTile(s, 4) // blocked by tile 5
  assert.equal(s.selected, null)
  s = selectTile(s, 0)
  assert.equal(s.selected, 0)
  s = selectTile(s, 0)
  assert.equal(s.selected, null)
  s = selectTile(selectTile(s, 0), 2)
  assert.equal(s.selected, 2) // mismatch switches selection
  s = selectTile(s, 3)
  assert.equal(tilesLeft(s), 4)
  assert.equal(s.selected, null)
})

test('shuffleRemaining preserves the multiset and positions, and stays solvable', () => {
  for (const id of LAYOUT_IDS) {
    let s = newGame(id, 5)
    for (let i = 0; i < 6; i++) {
      const m = availableMoves(s)[0]
      s = removePair(s, m[0], m[1])
    }
    const before = multiset(s)
    const sh = shuffleRemaining(s, mulberry32(77))
    assert.deepEqual(multiset(sh), before)
    assert.equal(tilesLeft(sh), tilesLeft(s))
    assert.deepEqual(sh.history, [])
    sh.tiles.forEach((t, i) => {
      assert.equal(t.removed, s.tiles[i].removed)
      assert.equal(t.x, s.tiles[i].x)
      if (t.removed) assert.equal(t.code, s.tiles[i].code)
    })
    assert.notDeepEqual(
      sh.tiles.map((t) => t.code),
      s.tiles.map((t) => t.code),
    )
    assert.equal(s.history.length, 6) // input untouched
  }
})

test('shuffleRemaining output is solvable: first-tried greedy via search', () => {
  // exhaustive DFS on a small endgame to prove solvability
  let s = newGame('fortress', 9)
  while (tilesLeft(s) > 14) {
    const m = availableMoves(s)[0]
    s = removePair(s, m[0], m[1])
  }
  const solvable = (st: SolitaireState, seen = new Set<string>()): boolean => {
    if (isWon(st)) return true
    const key = st.tiles.map((t) => (t.removed ? '.' : t.code)).join('')
    if (seen.has(key)) return false
    seen.add(key)
    return availableMoves(st).some(([a, b]) => solvable(removePair(st, a, b), seen))
  }
  for (let seed = 1; seed <= 20; seed++) assert.ok(solvable(shuffleRemaining(s, mulberry32(seed))), `seed ${seed}`)
})

test('renderOrder is back-to-front and hides removed tiles', () => {
  const s = newGame('turtle', 2)
  const order = renderOrder(s)
  assert.equal(order.length, 144)
  for (let i = 1; i < order.length; i++) {
    const a = order[i - 1]
    const b = order[i]
    assert.ok(a.z < b.z || (a.z === b.z && (a.y < b.y || (a.y === b.y && a.x <= b.x))))
  }
  const [x, y] = availableMoves(s)[0]
  const t = removePair(s, x, y)
  assert.equal(renderOrder(t).length, 142)
  assert.equal(renderOrder(t, true).length, 144)
})

test('validateSave round trips JSON and rejects junk', () => {
  let s = newGame('turtle', 123)
  const [a, b] = availableMoves(s)[0]
  s = selectTile(removePair(s, a, b), freeTiles(removePair(s, a, b))[0].id)
  const parsed = validateSave(JSON.parse(JSON.stringify(s)))
  assert.deepEqual(parsed, s)
  assert.deepEqual(validateSave({ ...s, selected: undefined }), { ...s, selected: null })

  const bad: unknown[] = [
    null, undefined, 0, 'x', [], {}, true,
    { ...s, layoutId: 'nope' },
    { ...s, layoutId: '__proto__' },
    { ...s, layoutId: 'pyramid' },
    { ...s, seed: 1.5 },
    { ...s, seed: '1' },
    { ...s, tiles: s.tiles.slice(1) },
    { ...s, tiles: 'abc' },
    { ...s, history: 'x' },
    { ...s, history: [[0, 0]] },
    { ...s, history: [[0, 1]] },
    { ...s, history: [[a, 9999]] },
    { ...s, history: [[a, b], [a, b]] },
    { ...s, selected: 9999 },
    { ...s, selected: a }, // removed tile
    { ...s, selected: '1' },
    { ...s, tiles: s.tiles.map((t, i) => (i === 0 ? { ...t, code: 'zz' } : t)) },
    { ...s, tiles: s.tiles.map((t, i) => (i === 0 ? { ...t, code: 'd01' } : t)) },
    { ...s, tiles: s.tiles.map((t, i) => (i === 0 ? { ...t, x: t.x + 1 } : t)) },
    { ...s, tiles: s.tiles.map((t, i) => (i === 0 ? { ...t, id: 5 } : t)) },
    { ...s, tiles: s.tiles.map((t, i) => (i === 0 ? { ...t, removed: 'no' } : t)) },
    { ...s, tiles: s.tiles.map((t, i) => (i === 0 ? null : t)) },
    // odd number removed / unpairable remainder
    { ...s, tiles: s.tiles.map((t, i) => (i === 1 ? { ...t, removed: true } : t)) },
    { ...s, tiles: s.tiles.map((t, i) => (i === 5 ? { ...t, code: t.code === 'd1' ? 'd2' : 'd1' } : t)) },
  ]
  for (const [i, v] of bad.entries()) assert.equal(validateSave(v), null, `case ${i}`)
})

test('validateSave output does not alias hostile input', () => {
  const s = newGame('fortress', 4)
  const raw = JSON.parse(JSON.stringify({ ...s, extra: { evil: true } }))
  const out = validateSave(raw)!
  assert.ok(out)
  assert.ok(!('extra' in out))
  assert.notEqual(out.tiles, raw.tiles)
})

test('all layouts: every layout id is covered by newGame', () => {
  const ids: LayoutId[] = ['turtle', 'pyramid', 'fortress']
  for (const id of ids) assert.equal(newGame(id, 1).tiles.length, LAYOUTS[id].positions.length)
})

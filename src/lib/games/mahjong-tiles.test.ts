import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_KINDS,
  BONUS_KINDS,
  compareTiles,
  fullSet,
  isBonus,
  isHonor,
  isTerminal,
  mulberry32,
  parseTile,
  shuffle,
  tileCode,
  tileName,
} from './mahjong-tiles'

test('set sizes and per-kind counts', () => {
  assert.equal(ALL_KINDS.length, 34)
  assert.equal(BONUS_KINDS.length, 8)
  const std = fullSet(false)
  const all = fullSet(true)
  assert.equal(std.length, 136)
  assert.equal(all.length, 144)
  const counts = new Map<string, number>()
  for (const c of all) counts.set(c, (counts.get(c) ?? 0) + 1)
  assert.equal(counts.size, 42)
  for (const k of ALL_KINDS) assert.equal(counts.get(tileCode(k)), 4)
  for (const k of BONUS_KINDS) assert.equal(counts.get(tileCode(k)), 1)
})

test('code/parse round trips and rejects junk', () => {
  for (const k of [...ALL_KINDS, ...BONUS_KINDS]) assert.deepEqual(parseTile(tileCode(k)), k)
  for (const bad of ['', 'd0', 'd10', 'w5', 'r4', 'f5', 'x1', 'D1', 'd', 'dd', '__proto__', 'd1 ', 'd.5'])
    assert.equal(parseTile(bad), null, bad)
  assert.equal(parseTile(42 as unknown as string), null)
  assert.equal(tileCode({ suit: 'dragons', rank: 2 }), 'r2')
})

test('names', () => {
  assert.equal(tileName('b5'), '5 of Bamboo')
  assert.equal(tileName('d1'), '1 of Dots')
  assert.equal(tileName('c9'), '9 of Characters')
  assert.equal(tileName('r1'), 'Red Dragon')
  assert.equal(tileName('r3'), 'White Dragon')
  assert.equal(tileName('w1'), 'East Wind')
  assert.equal(tileName('f1'), 'Plum (Flower 1)')
  assert.equal(tileName('s4'), 'Winter (Season 4)')
  assert.equal(tileName({ suit: 'winds', rank: 4 }), 'North Wind')
})

test('classifiers', () => {
  assert.ok(isHonor('w2') && isHonor('r3') && !isHonor('d1'))
  assert.ok(isTerminal('d1') && isTerminal('c9') && !isTerminal('b5') && !isTerminal('w1'))
  assert.ok(isBonus('f2') && isBonus('s1') && !isBonus('d1'))
  assert.ok(!isBonus('zz') && !isHonor('zz') && !isTerminal('zz'))
})

test('compareTiles sorts canonically', () => {
  const sorted = shuffle(fullSet(true), mulberry32(7)).sort(compareTiles)
  assert.deepEqual(sorted, fullSet(true))
  assert.ok(compareTiles('d9', 'b1') < 0)
  assert.ok(compareTiles('r1', 'w4') > 0)
  assert.equal(compareTiles('d3', 'd3'), 0)
})

test('mulberry32 is deterministic and in range', () => {
  const a = mulberry32(123)
  const b = mulberry32(123)
  for (let i = 0; i < 100; i++) {
    const v = a()
    assert.equal(v, b())
    assert.ok(v >= 0 && v < 1)
  }
  assert.notEqual(mulberry32(1)(), mulberry32(2)())
})

test('shuffle is pure and preserves the multiset', () => {
  const src = fullSet(true)
  const copy = src.slice()
  const out = shuffle(src, mulberry32(99))
  assert.deepEqual(src, copy)
  assert.notDeepEqual(out, src)
  assert.deepEqual(out.slice().sort(), src.slice().sort())
  assert.deepEqual(shuffle(src, mulberry32(99)), out)
})

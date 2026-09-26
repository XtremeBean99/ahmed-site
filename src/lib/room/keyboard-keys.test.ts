import { test } from 'node:test'
import assert from 'node:assert/strict'
import { KEY_CAPS, KEYBOARD_REGION, capBox, capClipPath } from './keyboard-keys'

const R = KEYBOARD_REGION

test('every code presses exactly one cap', () => {
  const codes = KEY_CAPS.flatMap((c) => c.codes)
  assert.equal(new Set(codes).size, codes.length)
})

test('every cap lies inside the keyboard region and the 1408x768 art', () => {
  assert.ok(R.x >= 0 && R.y >= 0 && R.x + R.w <= 1408 && R.y + R.h <= 768)
  for (const cap of KEY_CAPS) {
    const b = capBox(cap)
    assert.ok(b.w > 0 && b.h > 0, cap.codes[0])
    assert.ok(b.x >= R.x && b.y >= R.y && b.x + b.w <= R.x + R.w && b.y + b.h <= R.y + R.h, cap.codes[0])
    for (const r of cap.runs) {
      assert.ok(r.length > 0 && r.length % 2 === 0, cap.codes[0])
      for (let i = 0; i < r.length; i += 2) assert.ok(r[i] < r[i + 1], cap.codes[0])
    }
  }
})

test('rows run top to bottom and the table is in row order', () => {
  const rows = [0, 1, 2, 3, 4, 5].map((n) => KEY_CAPS.filter((c) => c.row === n))
  assert.equal(rows.reduce((s, r) => s + r.length, 0), KEY_CAPS.length)
  const mid = rows.map((r) => r.reduce((s, c) => s + c.y, 0) / r.length)
  for (let i = 1; i < mid.length; i++) assert.ok(mid[i] > mid[i - 1], `row ${i}`)
  for (let i = 1; i < KEY_CAPS.length; i++) assert.ok(KEY_CAPS[i].row >= KEY_CAPS[i - 1].row)
})

test('the essential keys exist', () => {
  const codes = new Set(KEY_CAPS.flatMap((c) => c.codes))
  const need = ['Escape', 'Space', 'Enter', 'ShiftLeft', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
  for (let i = 0; i < 26; i++) need.push(`Key${String.fromCharCode(65 + i)}`)
  for (let i = 0; i < 10; i++) need.push(`Digit${i}`)
  for (const code of need) assert.ok(codes.has(code), code)
})

test('clip paths stay inside their box', () => {
  for (const cap of KEY_CAPS) {
    const b = capBox(cap)
    const d = capClipPath(cap)
    for (const m of d.matchAll(/M(-?\d+) (-?\d+)h(-?\d+)v(-?\d+)/g)) {
      const [x, y, w, h] = m.slice(1).map(Number)
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= b.w && y + h <= b.h, cap.codes[0])
    }
  }
})

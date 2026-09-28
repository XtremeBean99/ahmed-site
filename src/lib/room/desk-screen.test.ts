import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPortraitPhone, portraitGeometry, PORTRAIT_MIN_H, PORTRAIT_W, BEZEL, MUSIC_BAR_H } from './desk-screen'

test('portrait phones get the portrait screen, everything else keeps the desk', () => {
  assert.equal(isPortraitPhone(390, 844, true), true)
  assert.equal(isPortraitPhone(360, 800, true), true)
  assert.equal(isPortraitPhone(430, 932, true), true)
  assert.equal(isPortraitPhone(844, 390, true), false)
  assert.equal(isPortraitPhone(768, 1024, true), false)
  assert.equal(isPortraitPhone(390, 844, false), false)
})

test('a 390x700 phone fills the width', () => {
  const g = portraitGeometry(390, 700)
  assert.equal(g.w, PORTRAIT_W)
  assert.ok(Math.abs(g.scale - 370 / 320) < 1e-9)
  assert.equal(g.h, Math.floor((700 - BEZEL.top - BEZEL.chin - MUSIC_BAR_H) / g.scale))
  assert.equal(g.left, BEZEL.side)
  assert.equal(g.top, BEZEL.top)
})

test('a short phone clamps to the minimum height and centres', () => {
  const g = portraitGeometry(375, 548)
  assert.equal(g.h, PORTRAIT_MIN_H)
  assert.ok(g.w * g.scale <= 375 - 2 * BEZEL.side)
  assert.ok(g.left > BEZEL.side)
})

test('the screen always fits its box', () => {
  for (let w = 300; w <= 480; w += 7) {
    for (let h = 480; h <= 1000; h += 13) {
      const g = portraitGeometry(w, h)
      assert.ok(g.h >= PORTRAIT_MIN_H)
      assert.ok(g.w * g.scale <= w - 2 * BEZEL.side + 1e-6)
      assert.ok(g.h * g.scale <= h - BEZEL.top - BEZEL.chin - MUSIC_BAR_H + 1e-6)
    }
  }
})

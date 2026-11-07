import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COBWEB_RECT, GARLAND_RECT, PUMPKIN_RECT, SHELF_PINS, decorFor, decorOverride, garlandPoint, shelfLipY } from './seasonal'
import { bulbOn, drawCobweb, drawFairyLights, drawHeartGarland, drawPumpkin, fairyBulbs } from './decor-art'

const d = (year: number, month: number, day: number) => ({ year, month, day })

test('decorations go up and come down on their dates', () => {
  assert.equal(decorFor(d(2026, 9, 16)), null)
  assert.equal(decorFor(d(2026, 9, 17)), 'halloween')
  assert.equal(decorFor(d(2026, 9, 31)), 'halloween')
  assert.equal(decorFor(d(2026, 10, 1)), 'halloween')
  assert.equal(decorFor(d(2026, 10, 2)), null)
  assert.equal(decorFor(d(2026, 10, 30)), null)
  assert.equal(decorFor(d(2026, 11, 1)), 'christmas')
  assert.equal(decorFor(d(2026, 11, 31)), 'christmas')
  // The Christmas window wraps past New Year.
  assert.equal(decorFor(d(2027, 0, 1)), 'christmas')
  assert.equal(decorFor(d(2027, 0, 6)), 'christmas')
  assert.equal(decorFor(d(2027, 0, 7)), null)
  assert.equal(decorFor(d(2027, 1, 6)), null)
  assert.equal(decorFor(d(2027, 1, 7)), 'valentines')
  assert.equal(decorFor(d(2027, 1, 14)), 'valentines')
  assert.equal(decorFor(d(2027, 1, 15)), null)
  assert.equal(decorFor(d(2027, 6, 1)), null)
})

test('?decor= forces a set, none takes everything down, junk is ignored', () => {
  assert.equal(decorOverride('?decor=christmas'), 'christmas')
  assert.equal(decorOverride('?light=night&decor=halloween'), 'halloween')
  assert.equal(decorOverride('?decor=none'), null)
  assert.equal(decorOverride('?decor=easter'), undefined)
  assert.equal(decorOverride(''), undefined)
})

test('garlands hang from the shelf lip and sag between pins', () => {
  for (let s = 0; s < SHELF_PINS.length - 1; s++) {
    const a = SHELF_PINS[s], b = SHELF_PINS[s + 1]
    assert.equal(garlandPoint(a, b, 0).y, shelfLipY(a))
    assert.equal(garlandPoint(a, b, 1).y, shelfLipY(b))
    assert.ok(garlandPoint(a, b, 0.5).y > shelfLipY((a + b) / 2))
  }
  for (const bulb of fairyBulbs()) {
    assert.ok(bulb.x >= GARLAND_RECT.x && bulb.x + 2 <= GARLAND_RECT.x + GARLAND_RECT.w)
    assert.ok(bulb.y - 1 >= GARLAND_RECT.y && bulb.y + 4 <= GARLAND_RECT.y + GARLAND_RECT.h)
  }
})

test('the fairy lights twinkle but most bulbs stay on', () => {
  const n = fairyBulbs().length
  let on = 0
  for (let f = 0; f < 40; f++) for (let i = 0; i < n; i++) if (bulbOn(i, f)) on++
  const share = on / (40 * n)
  assert.ok(share > 0.7 && share < 0.9, `share on ${share}`)
  // Held still (reduced motion), every bulb is on and the frame is stable.
  assert.deepEqual(drawFairyLights({ frame: null }), drawFairyLights({ frame: null }))
  assert.notDeepEqual(drawFairyLights({ frame: 1 }), drawFairyLights({ frame: 2 }))
})

const opaque = (data: Uint8ClampedArray) => { let n = 0; for (let i = 3; i < data.length; i += 4) if (data[i] === 255) n++; return n }

test('the jack-o-lantern fits its rect, glows when lit and takes the hover outline', () => {
  const lit = drawPumpkin({ lit: true })
  const out = drawPumpkin({ lit: false })
  assert.equal(lit.length, PUMPKIN_RECT.w * PUMPKIN_RECT.h * 4)
  assert.notDeepEqual(lit, out)
  assert.ok(opaque(drawPumpkin({ highlight: 2 })) > opaque(lit))
  // Night dims the body but never the flame: the brightest pixel is the same.
  const max = (data: Uint8ClampedArray) => { let m = 0; for (let i = 0; i < data.length; i += 4) m = Math.max(m, data[i] + data[i + 1] + data[i + 2]); return m }
  assert.equal(max(drawPumpkin({ light: 'night' })), max(lit))
  assert.ok(max(drawPumpkin({ light: 'night', lit: false })) < max(lit))
})

test('the cobweb and hearts draw into their rects', () => {
  assert.equal(drawCobweb().length, COBWEB_RECT.w * COBWEB_RECT.h * 4)
  assert.ok(drawCobweb().some((v, i) => i % 4 === 3 && v > 0))
  assert.equal(drawHeartGarland().length, GARLAND_RECT.w * GARLAND_RECT.h * 4)
  assert.ok(opaque(drawHeartGarland()) > 100)
  // Lamp off dims the drawn art.
  const sum = (data: Uint8ClampedArray) => data.reduce((s, v, i) => (i % 4 === 3 ? s : s + v), 0)
  assert.ok(sum(drawHeartGarland({ lampOff: true })) < sum(drawHeartGarland()))
})

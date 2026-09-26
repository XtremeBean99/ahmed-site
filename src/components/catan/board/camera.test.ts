import assert from 'node:assert/strict'
import test from 'node:test'
import { clampPan, fitScale, kRange, zoomAtPoint } from './camera'
import { CONTENT_BOX } from './content'

const SCREENS: [string, number, number, number, number][] = [
  ['1920x1080 board area', 1360, 1044, 1, 4],
  ['1536x864 at dpr 1.25', 976, 828, 1.25, 4],
  ['1440x900 at dpr 2', 880, 864, 2, 6],
  ['1408x768 laptop', 848, 732, 1, 3],
  ['1366x768 laptop', 806, 732, 1, 3],
  ['1280x720 laptop', 780, 684, 1, 3],
  ['iPad 1180x820 at dpr 2', 680, 784, 2, 5],
  ['iPhone 390x844 at dpr 3', 390, 576, 3, 4],
]

test('fitScale gives the expected integer device-pixel k on every target screen', () => {
  for (const [name, areaW, areaH, dpr, expectedK] of SCREENS) {
    const fit = fitScale(areaW, areaH, dpr)
    assert.equal(fit.k, expectedK, `${name}: k`)
    assert.equal(fit.scale, expectedK / dpr, `${name}: scale`)
  }
})

test('fitScale centres the content box and snaps translation to device pixels', () => {
  for (const [name, areaW, areaH, dpr] of SCREENS) {
    const fit = fitScale(areaW, areaH, dpr)
    const centerX = fit.offsetX + (CONTENT_BOX.x + CONTENT_BOX.width / 2) * fit.scale
    const centerY = fit.offsetY + (CONTENT_BOX.y + CONTENT_BOX.height / 2) * fit.scale
    assert.ok(Math.abs(centerX - areaW / 2) <= 0.5 / dpr + 1e-9, `${name}: content not centred horizontally`)
    assert.ok(Math.abs(centerY - areaH / 2) <= 0.5 / dpr + 1e-9, `${name}: content not centred vertically`)
    assert.equal(fit.offsetX, Math.round(fit.offsetX * dpr) / dpr, `${name}: offsetX not snapped`)
    assert.equal(fit.offsetY, Math.round(fit.offsetY * dpr) / dpr, `${name}: offsetY not snapped`)
  }
})

test('1408x768 must give k = 3 with the moved harbour plates', () => {
  assert.equal(fitScale(848, 732, 1).k, 3)
})

test('clampPan centres the content on axes where it fits and limits empty sea where it does not', () => {
  const areaW = 848
  const areaH = 732
  const dpr = 1
  const k = 6
  const { maxK } = kRange(areaW, areaH, dpr)
  assert.ok(k <= maxK)

  const scale = k / dpr
  const contentW = CONTENT_BOX.width * scale
  const contentH = CONTENT_BOX.height * scale
  assert.ok(contentW > areaW)
  assert.ok(contentH > areaH)

  // Pan far left/up: the far edge keeps exactly 24 px of empty sea.
  const cam = clampPan(k, -5000, -5000, areaW, areaH, dpr)
  const contentLeft = cam.offsetX + CONTENT_BOX.x * scale
  const contentTop = cam.offsetY + CONTENT_BOX.y * scale
  assert.equal(contentLeft, areaW - contentW - 24)
  assert.equal(contentTop, areaH - contentH - 24)

  // Pan far right/down: the near edge keeps exactly 24 px of empty sea.
  const cam2 = clampPan(k, 5000, 5000, areaW, areaH, dpr)
  const contentLeft2 = cam2.offsetX + CONTENT_BOX.x * scale
  const contentTop2 = cam2.offsetY + CONTENT_BOX.y * scale
  assert.equal(contentLeft2, 24)
  assert.equal(contentTop2, 24)
})

test('clampPan centres a small content axis even when the user panned it', () => {
  const areaW = 2000
  const areaH = 1000
  const dpr = 1
  const k = 2
  const scale = k / dpr
  const contentW = CONTENT_BOX.width * scale
  assert.ok(contentW < areaW)
  const cam = clampPan(k, 123, 456, areaW, areaH, dpr)
  const contentLeft = cam.offsetX + CONTENT_BOX.x * scale
  assert.equal(contentLeft, (areaW - contentW) / 2)
})

test('zoomAtPoint keeps the logical point under the pointer fixed when clamping does not bind', () => {
  const areaW = 1000
  const areaH = 1000
  const dpr = 1
  const fit = fitScale(areaW, areaH, dpr)
  const viewX = 500
  const viewY = 500

  const logical = {
    x: (viewX - fit.offsetX) / fit.scale,
    y: (viewY - fit.offsetY) / fit.scale,
  }
  const zoomed = zoomAtPoint(fit.k, fit.offsetX, fit.offsetY, areaW, areaH, dpr, viewX, viewY, fit.k + 3)
  const mapped = {
    x: (viewX - zoomed.offsetX) / zoomed.scale,
    y: (viewY - zoomed.offsetY) / zoomed.scale,
  }
  // Offset snapping to device pixels may shift the anchor by up to half a CSS px.
  assert.ok(Math.abs(mapped.x - logical.x) < 0.1)
  assert.ok(Math.abs(mapped.y - logical.y) < 0.1)
  assert.equal(zoomed.k, fit.k + 3)
})

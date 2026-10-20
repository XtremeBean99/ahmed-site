import { test } from 'node:test'
import assert from 'node:assert/strict'
import { precipSrcs, twinkleSrc, viewSrc, weatherFromSearch } from './window-view'

test('one still per lighting state and weather', () => {
  assert.equal(viewSrc('night', 'snow'), '/room/window/night-snow.png')
})

test('precipitation frames loop and heavy weather adds a layer', () => {
  assert.deepEqual(precipSrcs({ kind: 'clear', heavy: false }, 3), [])
  assert.deepEqual(precipSrcs({ kind: 'rain', heavy: false }, 5), ['/room/window/rain-2.png'])
  assert.deepEqual(precipSrcs({ kind: 'snow', heavy: true }, 6), ['/room/window/snow-1.png', '/room/window/snow-heavy-1.png'])
  assert.equal(twinkleSrc(3), '/room/window/twinkle-2.png')
})

test('?weather= forces the weather and ignores anything else', () => {
  assert.deepEqual(weatherFromSearch('?weather=snow'), { kind: 'snow', heavy: false })
  assert.deepEqual(weatherFromSearch('?weather=HEAVY-rain'), { kind: 'rain', heavy: true })
  assert.equal(weatherFromSearch('?weather=hail'), null)
  assert.equal(weatherFromSearch(''), null)
})

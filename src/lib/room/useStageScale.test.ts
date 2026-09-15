import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isMobileViewport } from './useStageScale'

function withViewport(width: number, queries: Record<string, boolean>, run: () => void) {
  const g = globalThis as Record<string, unknown>
  const saved = { window: g.window, matchMedia: g.matchMedia }
  g.window = { innerWidth: width }
  g.matchMedia = (q: string) => ({ matches: queries[q] ?? false })
  try {
    run()
  } finally {
    g.window = saved.window
    g.matchMedia = saved.matchMedia
  }
}

test('touch-capable desktop with a mouse is not mobile, even if the primary pointer reads coarse', () => {
  withViewport(1920, { '(pointer: coarse)': true, '(any-pointer: fine)': true }, () => {
    assert.equal(isMobileViewport(), false)
  })
})

test('phones and tablets without any fine pointer are mobile', () => {
  withViewport(1024, { '(pointer: coarse)': true, '(any-pointer: fine)': false }, () => {
    assert.equal(isMobileViewport(), true)
  })
})

test('narrow windows are mobile even with a mouse', () => {
  withViewport(600, { '(any-pointer: fine)': true }, () => {
    assert.equal(isMobileViewport(), true)
  })
})

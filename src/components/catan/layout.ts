'use client'

import { useEffect, useState } from 'react'

/**
 * wide: three columns (opponents and log | board | your hand and actions), landscape >= 1100 px.
 * medium: board plus one right column, opponents as a strip above the board (small landscape).
 * stack: phones and portrait tablets; the board fills the middle, panels become bottom sheets.
 */
export type CatanLayout = 'wide' | 'medium' | 'stack'

export function layoutFor(width: number, height: number): CatanLayout {
  const landscape = width >= height
  if (landscape && width >= 1100) return 'wide'
  if (landscape && width >= 700) return 'medium'
  return 'stack'
}

function readLayout(): CatanLayout {
  if (typeof window === 'undefined') return 'wide'
  return layoutFor(window.innerWidth, window.innerHeight)
}

function readCoarse(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}

/** Current layout mode and whether the primary pointer is coarse (touch); updates on resize and rotation. */
export function useCatanLayout(): { layout: CatanLayout; coarse: boolean } {
  const [state, setState] = useState(() => ({ layout: readLayout(), coarse: readCoarse() }))
  useEffect(() => {
    const update = () =>
      setState((prev) => {
        const next = { layout: readLayout(), coarse: readCoarse() }
        return prev.layout === next.layout && prev.coarse === next.coarse ? prev : next
      })
    update()
    const media = window.matchMedia('(pointer: coarse)')
    window.addEventListener('resize', update)
    media.addEventListener('change', update)
    return () => {
      window.removeEventListener('resize', update)
      media.removeEventListener('change', update)
    }
  }, [])
  return state
}

/** Minimum hit-target size in CSS px for the current pointer. */
export function hitSize(coarse: boolean): number {
  return coarse ? 44 : 28
}

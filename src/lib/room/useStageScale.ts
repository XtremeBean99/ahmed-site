'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const STAGE_W = 1408
const STAGE_H = 768

export interface StageScale {
  scale: number
  mobile: boolean
  fillScale: number
}

/** No mouse or trackpad at all, or a narrow viewport — same signal used everywhere mobile is gated.
 *  any-pointer, not pointer: Firefox on touch-capable Windows desktops reports the primary pointer as coarse. */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return !matchMedia('(any-pointer: fine)').matches || window.innerWidth < 700
}

/** Computes the fit scale for the 1408x768 stage in the viewport.
 *  On mobile (coarse pointer or narrow viewport), uses fill-height scale. */
export function useStageScale(): StageScale {
  // SSR-safe initial value: the effect corrects it on the client before the
  // splash finishes, so the one-frame desktop fit scale is never visible.
  const [state, setState] = useState<StageScale>({ scale: 1, mobile: false, fillScale: 1 })
  const mobileRef = useRef(false)
  const fillScaleRef = useRef(1)

  const update = useCallback(() => {
    const fillScale = window.innerHeight / STAGE_H
    const fitScale = Math.min(window.innerWidth / STAGE_W, fillScale)
    fillScaleRef.current = fillScale
    setState({ scale: mobileRef.current ? fillScale : fitScale, mobile: mobileRef.current, fillScale })
  }, [])

  useEffect(() => {
    mobileRef.current = isMobileViewport()
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [update])

  return state
}

export { STAGE_W, STAGE_H }

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const STAGE_W = 1408
const STAGE_H = 768

export interface StageScale {
  scale: number
  mobile: boolean
  fillScale: number
}

/** Computes the fit scale for the 1408x768 stage in the viewport.
 *  On mobile (coarse pointer or narrow viewport), uses fill-height scale. */
export function useStageScale(): StageScale {
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
    mobileRef.current = matchMedia('(pointer: coarse)').matches || window.innerWidth < 700
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [update])

  return state
}

export { STAGE_W, STAGE_H }

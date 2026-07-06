'use client'

import { useState, useEffect, useCallback } from 'react'

const STAGE_W = 1408
const STAGE_H = 768

/** Computes the fit scale for letterboxing the 1408×768 stage in the viewport. */
export function useStageScale() {
  const [scale, setScale] = useState(1)

  const update = useCallback(() => {
    setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H))
  }, [])

  useEffect(() => {
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [update])

  return scale
}

export { STAGE_W, STAGE_H }

'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/**
 * The visitor's reduced-motion preference, safe to render with. framer-motion's
 * hook reads the media query on the very first client render, so a visitor with
 * reduced motion on hydrated different styles from the server's and React threw
 * the whole room away and re-rendered it. Here the server snapshot (false) is
 * used for hydration and the real value follows straight after.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false)
}

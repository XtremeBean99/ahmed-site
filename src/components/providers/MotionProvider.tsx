'use client'

import { MotionConfig } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * Forces every framer-motion animation to play regardless of the OS
 * "reduce motion" setting. With reducedMotion="never", useReducedMotion()
 * returns false everywhere, so all motion components animate as designed.
 *
 * Note: this is a deliberate accessibility trade-off requested for this site.
 * Users who set "reduce motion" will still see the full animation experience.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="never">{children}</MotionConfig>
}

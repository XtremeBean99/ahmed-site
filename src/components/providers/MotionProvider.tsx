'use client'

import { MotionConfig } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * Forces every framer-motion animation to play regardless of the OS
 * "reduce motion" setting. All highlight and pickup animations
 * (hover lifts, frame sequences, zoom transitions) play at full speed.
 *
 * Calm Mode is a separate preference that does not affect motion.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="never">{children}</MotionConfig>
}

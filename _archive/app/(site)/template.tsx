'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { EASE_OUT_EXPO, DURATION } from '@/lib/motion'
import type { ReactNode } from 'react'

export default function Template({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()
  if (reduce) return <>{children}</>
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT_EXPO }}
    >
      {children}
    </motion.div>
  )
}

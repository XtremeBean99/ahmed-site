'use client'

import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { cardHover, springSubtle } from '@/lib/motion'
import type { ReactNode } from 'react'

/** Wraps a card in a very subtle lift on hover. Reduced-motion safe. */
export function MotionCard({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      variants={cardHover}
      initial="rest"
      whileHover="hover"
      transition={springSubtle}
    >
      {children}
    </motion.div>
  )
}

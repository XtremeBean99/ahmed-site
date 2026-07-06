'use client'

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { STAGE_W, STAGE_H } from '@/lib/room/useStageScale'

interface RoomStageProps {
  children: ReactNode
  /** Fit scale factor (always letterbox) */
  scale: number
  /** Additional zoom scale applied to the stage (for monitor transition) */
  zoomScale?: number
  /** Transform origin in stage coordinates (for zoom) */
  zoomOriginX?: number
  zoomOriginY?: number
}

export function RoomStage({
  children,
  scale,
  zoomScale = 1,
  zoomOriginX = STAGE_W / 2,
  zoomOriginY = STAGE_H / 2,
}: RoomStageProps) {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: '#000000',
      }}
    >
      <motion.div
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transformOrigin: `${zoomOriginX}px ${zoomOriginY}px`,
          position: 'relative',
          flexShrink: 0,
        }}
        animate={{
          scale: scale * zoomScale,
        }}
        transition={{
          duration: zoomScale > 1 ? 0.6 : 0,
          ease: EASE_OUT_EXPO,
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}

'use client'

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { STAGE_W, STAGE_H } from '@/lib/room/useStageScale'

interface RoomStageProps {
  children: ReactNode
  scale: number
  zoomScale?: number
  zoomOriginX?: number
  zoomOriginY?: number
  panX?: number
  panY?: number
}

/** Two-element transform: outer centres + fit-scales + pans, inner zooms about monitor point. */
export function RoomStage({
  children,
  scale,
  zoomScale = 1,
  zoomOriginX = STAGE_W / 2,
  zoomOriginY = STAGE_H / 2,
  panX = 0,
  panY = 0,
}: RoomStageProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: '#000000',
      }}
    >
      <div
        id="room-stage-outer"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0,
        }}
      >
        <motion.div
          style={{
            width: STAGE_W,
            height: STAGE_H,
            position: 'relative',
            transformOrigin: `${zoomOriginX}px ${zoomOriginY}px`,
          }}
          animate={{ scale: zoomScale }}
          transition={{
            duration: zoomScale > 1 ? 0.6 : 0,
            ease: EASE_OUT_EXPO,
          }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  )
}

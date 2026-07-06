'use client'

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { STAGE_W, STAGE_H } from '@/lib/room/useStageScale'

interface RoomStageProps {
  children: ReactNode
  /** Fit scale factor (letterbox) */
  scale: number
  /** Zoom scale (1 = none, >1 = zooming into monitor) */
  zoomScale?: number
  /** Zoom origin in stage coordinates */
  zoomOriginX?: number
  zoomOriginY?: number
}

/** Two-element transform: outer centres + fit-scales about centre, inner zooms about monitor point. */
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
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: '#000000',
      }}
    >
      {/* Outer: fit-scale about centre (never shifts off-centre) */}
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0,
        }}
      >
        {/* Inner: zoom about monitor point (stage coords valid here) */}
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

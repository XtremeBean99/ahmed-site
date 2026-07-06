'use client'

import { type ReactNode } from 'react'

const STAGE_W = 1408
const STAGE_H = 768

interface RoomStageProps {
  children: ReactNode
  /** Scale factor (always fit — letterbox with black bars) */
  scale: number
}

export function RoomStage({ children, scale }: RoomStageProps) {
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
      <div
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {children}
      </div>
    </div>
  )
}

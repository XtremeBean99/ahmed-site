'use client'

import { type ReactNode } from 'react'

const STAGE_W = 1408
const STAGE_H = 768

interface RoomStageProps {
  children: ReactNode
  /** ResizeObserver-based scale factor */
  scale: number
  /** Whether to use fit-width (mobile) vs cover (desktop) */
  fitWidth: boolean
}

export function RoomStage({ children, scale, fitWidth }: RoomStageProps) {
  // For mobile (<700px): fit width with vertical letterboxing
  // For desktop: cover with overflow hidden
  const containerStyle: React.CSSProperties = fitWidth
    ? {
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: '#1a1210', // matches room floor colour
      }
    : {
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: '#1a1210',
      }

  return (
    <div style={containerStyle}>
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

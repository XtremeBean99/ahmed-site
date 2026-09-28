// src/components/room/DeskDpad.tsx
'use client'

import { useRef, useState } from 'react'
import type { SwipeDir } from '@/lib/room/gestures'
import { ARCADE } from './pixel-ui'

const ARROWS: Record<SwipeDir, string[]> = {
  up: [
    '...X...',
    '..XXX..',
    '.XXXXX.',
    '...X...',
    '...X...',
    '...X...',
    '...X...',
  ],
  down: [
    '...X...',
    '...X...',
    '...X...',
    '...X...',
    '.XXXXX.',
    '..XXX..',
    '...X...',
  ],
  left: [
    '....X..',
    '...X...',
    '..X....',
    '..XXXXX',
    '..X....',
    '...X...',
    '....X..',
  ],
  right: [
    '..X....',
    '...X...',
    '....X..',
    'XXXXX..',
    '....X..',
    '...X...',
    '..X....',
  ],
}

function Arrow({ dir, px }: { dir: SwipeDir; px: number }) {
  const rects: { x: number; y: number }[] = []
  ARROWS[dir].forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === 'X') rects.push({ x, y })
  })
  return (
    <svg width={px} height={px} viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden fill={ARCADE.panelText}>
      {rects.map((p) => (
        <rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width={1} height={1} />
      ))}
    </svg>
  )
}

/**
 * A pixel D-pad: four square buttons in a cross. Touch and pen fire on
 * pointerdown (no focus flash, no ghost click); mouse and keyboard fire on
 * click, never both.
 */
export function DeskDpad({
  onDir,
  size = 48,
  labels,
}: {
  onDir: (d: SwipeDir) => void
  size?: number
  labels: { up: string; down: string; left: string; right: string }
}) {
  const [held, setHeld] = useState<SwipeDir | null>(null)
  const firedByPointer = useRef(false)
  const gap = Math.max(2, Math.floor(size / 13))
  const arrowPx = Math.round(size / 2.5 / 7) * 7
  const notch = size >= 44 ? 5 : 3
  const border = size >= 44 ? 3 : 2

  const press = (dir: SwipeDir) => (e: React.PointerEvent<HTMLButtonElement>) => {
    setHeld(dir)
    if (e.pointerType === 'mouse') return
    e.preventDefault()
    firedByPointer.current = true
    onDir(dir)
  }
  const release = () => {
    setHeld(null)
    // If a touch tap produced no click (a cancelled tap), do not let the guard
    // swallow the next mouse or keyboard activation.
    setTimeout(() => { firedByPointer.current = false }, 0)
  }
  const click = (dir: SwipeDir) => () => {
    if (firedByPointer.current) {
      firedByPointer.current = false
      return
    }
    onDir(dir)
  }

  const buttons: { dir: SwipeDir; row: number; col: number }[] = [
    { dir: 'up', row: 0, col: 1 },
    { dir: 'left', row: 1, col: 0 },
    { dir: 'right', row: 1, col: 2 },
    { dir: 'down', row: 2, col: 1 },
  ]

  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `repeat(3, ${size}px)`, gap, touchAction: 'none' }}
    >
      {buttons.map(({ dir, row, col }) => (
        <button
          key={dir}
          type="button"
          aria-label={labels[dir]}
          onPointerDown={press(dir)}
          onPointerUp={release}
          onPointerLeave={release}
          onPointerCancel={release}
          onClick={click(dir)}
          className="outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e8d5b0] focus-visible:outline-offset-[-4px]"
          style={{
            gridRowStart: row + 1,
            gridColumnStart: col + 1,
            width: size,
            height: size,
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: held === dir ? ARCADE.panelDark : `linear-gradient(180deg, #4a3826 0%, ${ARCADE.panel} 100%)`,
            border: `${border}px solid ${ARCADE.panelBorder}`,
            clipPath: `polygon(${notch}px 0, calc(100% - ${notch}px) 0, 100% ${notch}px, 100% calc(100% - ${notch}px), calc(100% - ${notch}px) 100%, ${notch}px 100%, 0 calc(100% - ${notch}px), 0 ${notch}px)`,
            boxShadow: held === dir
              ? 'inset 2px 2px 0 rgba(0,0,0,0.4)'
              : 'inset 1px 1px 0 rgba(255,230,190,0.12), inset -2px -2px 0 rgba(0,0,0,0.3)',
            transform: held === dir ? 'translateY(1px)' : undefined,
          }}
        >
          <Arrow dir={dir} px={arrowPx} />
        </button>
      ))}
    </div>
  )
}

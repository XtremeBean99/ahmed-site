'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const PIPS: Record<number, [number, number][]> = {
  1: [[4, 4]],
  2: [
    [2, 2],
    [6, 6],
  ],
  3: [
    [2, 2],
    [4, 4],
    [6, 6],
  ],
  4: [
    [2, 2],
    [2, 6],
    [6, 2],
    [6, 6],
  ],
  5: [
    [2, 2],
    [2, 6],
    [4, 4],
    [6, 2],
    [6, 6],
  ],
  6: [
    [2, 2],
    [2, 4],
    [2, 6],
    [6, 2],
    [6, 4],
    [6, 6],
  ],
}

function Die({ value }: { value: number | null }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      style={{
        imageRendering: 'pixelated',
        backgroundColor: '#e8e0d0',
        border: '1px solid #1a1410',
        display: 'block',
        flexShrink: 0,
      }}
    >
      {value === null ? (
        <text
          x={4}
          y={5.8}
          textAnchor="middle"
          fontSize={4}
          fill="#5a4430"
          fontFamily="var(--font-pixel), monospace"
        >
          ?
        </text>
      ) : (
        PIPS[value].map(([x, y], i) => (
          <rect key={i} x={x - 0.7} y={y - 0.7} width={1.4} height={1.4} fill="#1a1410" />
        ))
      )}
    </svg>
  )
}

export function Dice({ dice, label }: { dice: [number, number] | null; label: string }) {
  const reduce = useReducedMotion()
  const [shake, setShake] = useState(false)
  const previous = useRef<[number, number] | null>(dice)

  useEffect(() => {
    const prev = previous.current
    previous.current = dice
    if (!dice) return
    if (!prev || (prev[0] === dice[0] && prev[1] === dice[1])) return
    if (reduce) return
    setShake(true)
    const id = setTimeout(() => setShake(false), 480)
    return () => clearTimeout(id)
  }, [dice, reduce])

  return (
    <motion.div
      aria-label={label}
      role="img"
      style={{ display: 'flex', gap: 4, alignItems: 'center' }}
      animate={
        reduce || !shake
          ? { rotate: 0, x: 0 }
          : { rotate: [0, -10, 10, -6, 6, 0], x: [0, -2, 2, -1, 1, 0] }
      }
      transition={{ duration: 0.45 }}
    >
      <Die value={dice ? dice[0] : null} />
      <Die value={dice ? dice[1] : null} />
    </motion.div>
  )
}

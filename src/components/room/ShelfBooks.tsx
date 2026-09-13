'use client'

import { useCallback, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { RoomObject } from './RoomObject'
import { DURATION } from '@/lib/motion'
import { useLighting, lightingSrc } from '@/lib/room/lighting'
import { useAnimationTimer } from '@/lib/room/useAnimationTimer'
import type { ShelfBook } from '@/lib/room/books'

interface ShelfBooksProps {
  x: number
  y: number
  w: number
  h: number
  /** Frame 1 = rest, frames 2-3 = the highlight outline (play-once-hold). */
  frames: string[]
  frameDuration: number
  books: ShelfBook[]
  /** Tooltip per book, keyed by book id. */
  labels: Record<string, string>
  onOpen: (bookId: string) => void
}

/**
 * The three books on the shelf. One sprite, three hotspots: hovering any spine
 * plays the shared highlight animation, clicking one opens it in the reader.
 * The art is pointer-transparent so the spine hotspots receive the events.
 */
export function ShelfBooks({ x, y, w, h, frames, frameDuration, books, labels, onOpen }: ShelfBooksProps) {
  const reduce = useReducedMotion()
  const lighting = useLighting()
  const { tick, tickRef, advanceTo, clearTimer, start, stop } = useAnimationTimer(frameDuration, reduce)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const activate = useCallback(
    (id: string) => {
      setHoveredId(id)
      if (reduce || frames.length <= 1) return
      start(() => {
        const next = tickRef.current + 1
        if (next >= frames.length) {
          advanceTo(frames.length - 1)
          clearTimer()
          return
        }
        advanceTo(next)
      })
    },
    [reduce, frames.length, start, advanceTo, clearTimer, tickRef],
  )

  const deactivate = useCallback(() => {
    setHoveredId(null)
    stop()
  }, [stop])

  return (
    <div
      className="absolute"
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        // Forward while hovered, behind its neighbours otherwise, so the catan
        // highlight is not clipped by this sprite's (transparent) box.
        zIndex: hoveredId ? 20 : undefined,
      }}
    >
      <motion.img
        src={lightingSrc(frames[tick], lighting)}
        alt=""
        draggable={false}
        aria-hidden
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ imageRendering: 'pixelated' }}
        animate={hoveredId && !reduce ? { y: -2 } : { y: 0 }}
        transition={{ duration: DURATION.fast }}
      />

      {books.map((book) => (
        <RoomObject
          key={book.id}
          label={labels[book.id] ?? book.title}
          showTooltip={hoveredId === book.id}
          onActivate={() => activate(book.id)}
          onDeactivate={deactivate}
          onClick={() => onOpen(book.id)}
          tabIndex={0}
          style={{
            position: 'absolute',
            left: book.hotspot.x,
            top: book.hotspot.y,
            width: book.hotspot.w,
            height: book.hotspot.h,
          }}
        >
          <span
            className="block"
            style={{ width: book.hotspot.w, height: book.hotspot.h }}
            aria-hidden
          />
        </RoomObject>
      ))}
    </div>
  )
}

'use client'

import { useReducedMotion } from 'framer-motion'
import { AnimatedSprite } from './AnimatedSprite'
import { SPRITE_FRAME_MS } from '@/lib/room/objects'
import { DESK_SHELF, DESK_SHELF_ITEMS } from '@/lib/room/desk-shelf'

export interface DeskShelfLabels {
  catan: string
  vhs: string
  games: Record<string, string>
  books: Record<string, string>
  /** Accessible name of the peek strip and the toggle while looking at the desk. */
  lookUp: string
  /** Accessible name of the toggle while looking at the shelf. */
  lookDown: string
  upButton: string
  downButton: string
}

interface DeskShelfProps {
  labels: DeskShelfLabels
  lampOn: boolean
  lookingUp: boolean
  onLook: (up: boolean) => void
  /** A game cartridge, box or the VHS: open that desk app. */
  onOpenApp: (app: string) => void
  onOpenBook: (id: string) => void
  onOpenCatan: () => void
}

const PIXEL: React.CSSProperties = { imageRendering: 'pixelated' }
const BUTTON_FONT: React.CSSProperties = {
  fontFamily: 'var(--font-pixel), "Courier New", monospace', fontSize: 14, color: '#e8d5b0',
  backgroundColor: '#3d2e1e', border: '2px solid #5a4430', borderRadius: 3, textShadow: '1px 1px 0 #1a0e04',
}
const FOCUS = 'outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(200,184,154,0.7)] focus-visible:outline-offset-2'

/**
 * The shelf above the desk, in the desk view's camera layer (stage coordinates
 * of the close-up; the extension sits at negative y). At rest only the items'
 * bottoms peek over the lip and the whole strip is one "look up" button; once
 * the camera has panned up, every item is its own sprite and hotspot, like in
 * the room. Clicks stop here so they never count toward the desk's
 * click-twice-to-leave.
 */
export function DeskShelf({ labels, lampOn, lookingUp, onLook, onOpenApp, onOpenBook, onOpenCatan }: DeskShelfProps) {
  const reduce = useReducedMotion()
  const fade: React.CSSProperties = { transition: reduce ? 'none' : 'opacity 0.4s ease' }
  const lip = DESK_SHELF.lip

  return (
    <div className="absolute inset-0 pointer-events-none" onClick={(e) => e.stopPropagation()}>
      {/* The shelf and wall above the close-up, lamp off under lamp on */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/room/desk-shelf-top-lamp-off.png" alt="" draggable={false} className="absolute left-0"
        style={{ ...PIXEL, top: -DESK_SHELF.extH, width: '100%', height: DESK_SHELF.extH }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/room/desk-shelf-top.png" alt="" draggable={false} className="absolute left-0"
        style={{ ...PIXEL, ...fade, top: -DESK_SHELF.extH, width: '100%', height: DESK_SHELF.extH, opacity: lampOn ? 1 : 0 }} />

      {/* The items: inert until the camera has looked up, so at rest the strip is one button */}
      <div className="absolute inset-0" inert={!lookingUp}>
        {DESK_SHELF_ITEMS.map((it) => {
          const label = it.kind === 'catan' ? labels.catan : it.kind === 'vhs' ? labels.vhs
            : it.kind === 'book' ? (labels.books[it.id] ?? it.id) : (labels.games[it.id] ?? it.id)
          const open = it.kind === 'catan' ? onOpenCatan : it.kind === 'book' ? () => onOpenBook(it.id)
            : () => onOpenApp(it.kind === 'vhs' ? 'movie' : it.id)
          // A zero-size wrapper at the origin: its sprite keeps stage coordinates and takes the pointer, the stage around it does not.
          return (
            <div key={it.id} className="absolute left-0 top-0" style={{ pointerEvents: lookingUp ? 'auto' : 'none' }}>
              <AnimatedSprite label={label} x={it.x} y={it.y} w={it.w} h={it.h} frames={it.frames}
                hitPath={it.hit} frameDuration={SPRITE_FRAME_MS.shelfGame} mode="play-once-hold" onClick={open}
                dimmed={!lampOn} />
            </div>
          )
        })}
      </div>

      {/* The lip again, over the items' feet (lamp off under lamp on) */}
      <div aria-hidden className="absolute overflow-hidden" style={{ left: lip.x, top: lip.y, width: lip.w, height: lip.h }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/room/desk-closeup-lamp-off.png" alt="" draggable={false} className="absolute max-w-none"
          style={{ ...PIXEL, left: -lip.x, top: -lip.y, width: 1408, height: 768 }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/room/desk-closeup.png" alt="" draggable={false} className="absolute max-w-none"
          style={{ ...PIXEL, ...fade, left: -lip.x, top: -lip.y, width: 1408, height: 768, opacity: lampOn ? 1 : 0 }} />
      </div>

      {/* At rest: the peeking strip looks up */}
      {!lookingUp && (
        <button type="button" aria-label={labels.lookUp} onClick={() => onLook(true)}
          className={`absolute cursor-pointer pointer-events-auto ${FOCUS}`}
          style={{ left: DESK_SHELF.peek.x, top: DESK_SHELF.peek.y, width: DESK_SHELF.peek.w, height: DESK_SHELF.peek.h }} />
      )}

      {/* The look toggle, on the wall right of the shelf */}
      <button type="button" aria-label={lookingUp ? labels.lookDown : labels.lookUp} onClick={() => onLook(!lookingUp)}
        className={`absolute cursor-pointer pointer-events-auto px-3 py-1.5 transition-transform duration-[120ms] active:scale-[0.97] ${FOCUS}`}
        style={{ ...BUTTON_FONT, left: 1000, top: 22 }}>
        {lookingUp ? labels.downButton : labels.upButton}
      </button>
    </div>
  )
}

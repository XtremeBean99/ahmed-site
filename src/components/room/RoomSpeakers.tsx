'use client'

import { useState, useCallback } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useRoomAudio } from './RoomAudioProvider'
import { RoomObject } from './RoomObject'
import { MusicNotes } from './MusicNotes'
import { useLighting, lightingSrc } from '@/lib/room/lighting'

// Stage-space geometry measured from sources/room-speakers.png.
const ART = { x: 146, y: 292, w: 435, h: 218 }
const CABINET_LEFT = { x: 148, y: 355, w: 108, h: 154 }
const CABINET_RIGHT = { x: 490, y: 290, w: 91, h: 141 }
// Driver holes (tweeter + woofer) per cabinet; notes spawn on their rims.
const HOLES_LEFT = [
  { cx: 215, cy: 408, r: 15 },
  { cx: 215, cy: 463, r: 25 },
]
const HOLES_RIGHT = [
  { cx: 546, cy: 345, r: 14 },
  { cx: 546, cy: 397, r: 24 },
]

interface RoomSpeakersProps {
  lampOn: boolean
  lampFlicker: boolean
  /** Accessible label for the mute buttons (room.audio.speakersLabel) */
  speakersLabel: string
}

/**
 * Desktop speakers flanking the monitor in the room view. The art layer
 * crossfades with the lamp exactly like the background; each cabinet is a
 * mute/unmute button; music notes emit from the driver holes while playing.
 */
export function RoomSpeakers({ lampOn, lampFlicker, speakersLabel }: RoomSpeakersProps) {
  const reduce = useReducedMotion()
  const { playing, toggle } = useRoomAudio()
  const lighting = useLighting()
  const [hovered, setHovered] = useState(false)
  const activate = useCallback(() => setHovered(true), [])
  const deactivate = useCallback(() => setHovered(false), [])

  const mutedGlyph = !playing && (
    <span
      className="absolute top-1 right-1 text-[#a09080] opacity-70 pointer-events-none"
      style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace', fontSize: '10px' }}
    >
      ✕♪
    </span>
  )

  return (
    <>
      {/* Art: lamp-off under, lamp-on crossfades/flickers like the background */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{ left: ART.x, top: ART.y, width: ART.w, height: ART.h }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={lightingSrc('/room/room-speakers-lamp-off.png', lighting)}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={lightingSrc('/room/room-speakers.png', lighting)}
          alt=""
          draggable={false}
          className={`absolute inset-0 w-full h-full ${lampFlicker && !reduce ? 'animate-[lamp-flicker_0.5s_ease-out]' : ''}`}
          style={{
            imageRendering: 'pixelated',
            opacity: lampOn ? 1 : 0,
            transition: reduce ? 'none' : 'opacity 0.4s ease',
          }}
        />
      </div>

      {/* Mute/unmute — one button per cabinet, each with its own tooltip */}
      <div
        style={{ position: 'absolute', left: CABINET_LEFT.x, top: CABINET_LEFT.y, width: CABINET_LEFT.w, height: CABINET_LEFT.h, zIndex: 2 }}
        onMouseEnter={activate}
        onMouseLeave={deactivate}
        onFocus={activate}
        onBlur={deactivate}
      >
        <RoomObject
          label={speakersLabel}
          showTooltip={hovered}
          onActivate={activate}
          onDeactivate={deactivate}
          onClick={toggle}
          tabIndex={0}
        >
          <div style={{ width: CABINET_LEFT.w, height: CABINET_LEFT.h, position: 'relative' }}>
            {mutedGlyph}
          </div>
        </RoomObject>
      </div>
      <div
        style={{ position: 'absolute', left: CABINET_RIGHT.x, top: CABINET_RIGHT.y, width: CABINET_RIGHT.w, height: CABINET_RIGHT.h, zIndex: 2 }}
        onMouseEnter={activate}
        onMouseLeave={deactivate}
        onFocus={activate}
        onBlur={deactivate}
      >
        <RoomObject
          label={speakersLabel}
          showTooltip={hovered}
          onActivate={activate}
          onDeactivate={deactivate}
          onClick={toggle}
          tabIndex={0}
        >
          <div style={{ width: CABINET_RIGHT.w, height: CABINET_RIGHT.h, position: 'relative' }}>
            {mutedGlyph}
          </div>
        </RoomObject>
      </div>

      {/* Constant-rate notes from the driver holes while music plays */}
      <MusicNotes holes={HOLES_LEFT} startDelay={0} />
      <MusicNotes holes={HOLES_RIGHT} startDelay={550} />
    </>
  )
}

'use client'

import { AnimatedSprite } from './AnimatedSprite'
import { useRoomAudio } from './RoomAudioProvider'
import type { RoomObjectDef } from '@/lib/room/objects'

/**
 * The iPod on the desk. Single-frame sprite with the shared hover/focus
 * tooltip + -2px pickup lift (via AnimatedSprite). Clicking it skips to a
 * fresh track and starts playback if music was stopped. Lives inside
 * RoomAudioProvider so it can consume the audio `skip` action.
 */
export function RoomIpod({ label, obj, onActivate }: { label: string; obj: RoomObjectDef; onActivate?: () => void }) {
  const { skip } = useRoomAudio()
  return (
    <AnimatedSprite
      label={label}
      x={obj.x}
      y={obj.y}
      w={obj.w}
      h={obj.h}
      frames={obj.frames}
      frameDuration={120}
      mode="play-once-hold"
      onClick={() => { onActivate?.(); skip() }}
    />
  )
}

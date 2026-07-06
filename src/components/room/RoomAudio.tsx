'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useReducedMotion } from 'framer-motion'

const TRACKS = [
  '/audio/2pac do for love.mp3',
  '/audio/3killsss.mp3',
  '/audio/Saffron.mp3',
]

/** Pick a random track index on first load. */
function randomTrack(): number {
  return Math.floor(Math.random() * TRACKS.length)
}

interface RoomAudioProps {
  /** Label for the mute toggle (from dictionary) */
  muteLabel?: string
  unmuteLabel?: string
}

export function RoomAudio({
  muteLabel = 'Mute music',
  unmuteLabel = 'Play music',
}: RoomAudioProps) {
  const reduce = useReducedMotion()
  const [playing, setPlaying] = useState(false)
  const [mounted, setMounted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const trackIndexRef = useRef(randomTrack())

  // Don't render anything on the server or if reduced motion is preferred
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().then(() => {
        setPlaying(true)
      }).catch(() => {
        // Browser blocked autoplay — silently ignore
      })
    }
  }, [playing])

  if (!mounted || reduce) return null

  return (
    <>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={TRACKS[trackIndexRef.current]}
        loop
        preload="none"
      />

      {/* Mute/unmute toggle — sits beside the HUD */}
      <button
        onClick={toggle}
        aria-label={playing ? muteLabel : unmuteLabel}
        className="fixed bottom-4 left-4 z-30 font-sans text-[11px] text-[#a09080] hover:text-[#c8b89a] transition-colors"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
      >
        {playing ? '♪' : '♫'}
      </button>
    </>
  )
}

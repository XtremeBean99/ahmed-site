'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useReducedMotion } from 'framer-motion'

const TRACKS = ['/audio/lo-fi-beat.mp3', '/audio/saffron.mp3']

function randomTrack(): number {
  return Math.floor(Math.random() * TRACKS.length)
}

interface RoomAudioProps {
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
  const triedAutoplay = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Try autoplay on mount
  useEffect(() => {
    if (!mounted || reduce || triedAutoplay.current) return
    triedAutoplay.current = true

    const audio = audioRef.current
    if (!audio) return

    audio.volume = 0.3

    audio.play().then(() => {
      setPlaying(true)
    }).catch(() => {
      // Autoplay blocked — try on first user interaction
      const onInteraction = () => {
        audio.play().then(() => setPlaying(true)).catch(() => {})
        document.removeEventListener('click', onInteraction)
        document.removeEventListener('keydown', onInteraction)
      }
      document.addEventListener('click', onInteraction, { once: true })
      document.addEventListener('keydown', onInteraction, { once: true })
    })
  }, [mounted, reduce])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().then(() => {
        setPlaying(true)
      }).catch(() => {})
    }
  }, [playing])

  if (!mounted || reduce) return null

  return (
    <>
      <audio
        ref={audioRef}
        src={TRACKS[trackIndexRef.current]}
        loop
        preload="auto"
      />

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

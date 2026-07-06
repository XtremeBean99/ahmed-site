'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useReducedMotion } from 'framer-motion'
import { loadPrefs, savePrefs } from '@/lib/room/storage'

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
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const trackIndexRef = useRef(randomTrack())
  const triedRef = useRef(false)

  // Create audio element and attempt autoplay once mounted
  useEffect(() => {
    if (reduce || triedRef.current) return
    triedRef.current = true

    const prefs = loadPrefs()
    if (!prefs.audio) return

    const audio = new Audio(TRACKS[trackIndexRef.current])
    audio.loop = true
    audio.volume = 0.3
    audioRef.current = audio

    // Attempt autoplay
    audio.play().then(() => {
      setPlaying(true)
    }).catch(() => {
      // Blocked — wait for any user gesture
      const onGesture = () => {
        audio.play().then(() => setPlaying(true)).catch(() => {})
        cleanup()
      }
      const cleanup = () => {
        document.removeEventListener('click', onGesture)
        document.removeEventListener('keydown', onGesture)
        document.removeEventListener('touchstart', onGesture)
      }
      document.addEventListener('click', onGesture)
      document.addEventListener('keydown', onGesture)
      document.addEventListener('touchstart', onGesture)
    })

    return () => {
      audio.pause()
      audioRef.current = null
    }
  }, [reduce])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
      setPlaying(false)
      savePrefs({ audio: false })
    } else {
      audio.play().then(() => {
        setPlaying(true)
        savePrefs({ audio: true })
      }).catch(() => {})
    }
  }, [playing])

  if (reduce) return null

  return (
    <button
      onClick={toggle}
      aria-label={playing ? muteLabel : unmuteLabel}
      className="fixed bottom-4 left-4 z-30 text-[11px] text-[#a09080] hover:text-[#c8b89a] transition-colors"
      style={{
        fontFamily: 'var(--font-pixel), "Courier New", monospace',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
      }}
    >
      MUSIC {playing ? 'ON' : 'OFF'}
    </button>
  )
}

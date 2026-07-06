'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useReducedMotion } from 'framer-motion'
import { loadPrefs, savePrefs } from '@/lib/room/storage'

const TRACKS = ['/audio/lo-fi-beat.mp3', '/audio/saffron.mp3']

function randomTrack(): number {
  return Math.floor(Math.random() * TRACKS.length)
}

export function RoomAudio() {
  const reduce = useReducedMotion()
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const trackIndexRef = useRef(randomTrack())
  const triedRef = useRef(false)

  // Ensure audio element exists (lazy-create on first demand)
  const ensureAudio = useCallback((): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current
    const audio = new Audio(TRACKS[trackIndexRef.current])
    audio.loop = true
    audio.volume = 0.3
    audio.addEventListener('ended', () => {
      // loop playlist
      trackIndexRef.current = (trackIndexRef.current + 1) % TRACKS.length
      audio.src = TRACKS[trackIndexRef.current]
      audio.load()
      audio.play().catch(() => {})
    })
    audioRef.current = audio
    return audio
  }, [])

  // Attempt autoplay on mount if pref allows
  useEffect(() => {
    if (reduce || triedRef.current) return
    triedRef.current = true

    const prefs = loadPrefs()
    if (!prefs.audio) return

    const audio = ensureAudio()
    audio.play().then(() => setPlaying(true)).catch(() => {
      // Blocked — wait for first gesture
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
  }, [reduce, ensureAudio])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const toggle = useCallback(() => {
    const audio = ensureAudio()
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
  }, [playing, ensureAudio])

  if (reduce) return null

  return (
    <button
      onClick={toggle}
      aria-label={playing ? 'Mute music' : 'Play music'}
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

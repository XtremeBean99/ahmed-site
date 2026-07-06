'use client'

import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { useReducedMotion } from 'framer-motion'
import { loadPrefs, savePrefs } from '@/lib/room/storage'
import { PLAYLIST } from '@/lib/room/playlist'

interface AudioState {
  playing: boolean
  trackIndex: number
  toggle: () => void
  nextTrack: () => void
}

const AudioCtx = createContext<AudioState | null>(null)

export function useRoomAudio(): AudioState {
  const ctx = useContext(AudioCtx)
  if (!ctx) throw new Error('useRoomAudio must be used within RoomAudioProvider')
  return ctx
}

/** Returns the audio element, creating it on first call. */
function createAudio(): HTMLAudioElement {
  const audio = new Audio()
  audio.loop = false
  audio.volume = 0.3
  return audio
}

export function RoomAudioProvider({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()
  const [playing, setPlaying] = useState(false)
  const [trackIndex, setTrackIndex] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const triedRef = useRef(false)
  const playingRef = useRef(false)

  // Initialise
  useEffect(() => {
    if (reduce) return
    const audio = createAudio()
    audioRef.current = audio
    playingRef.current = false

    // Random start
    const idx = Math.floor(Math.random() * PLAYLIST.length)
    setTrackIndex(idx)
    loadTrack(audio, idx)

    audio.addEventListener('ended', () => {
      const next = (audioRef.current ? (PLAYLIST.findIndex(t => t.src === audio.src) + 1) % PLAYLIST.length : 0)
      setTrackIndex(next)
      loadTrack(audio, next)
      if (playingRef.current) audio.play().catch(() => {})
    })

    return () => {
      audio.pause()
      audioRef.current = null
    }
  }, [reduce])

  // Autoplay
  useEffect(() => {
    if (reduce || triedRef.current) return
    triedRef.current = true
    const prefs = loadPrefs()
    if (!prefs.audio || !audioRef.current) return

    audioRef.current.play().then(() => {
      setPlaying(true)
      playingRef.current = true
    }).catch(() => {
      const onGesture = () => {
        audioRef.current?.play().then(() => {
          setPlaying(true)
          playingRef.current = true
        }).catch(() => {})
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
  }, [reduce])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
      playingRef.current = false
      savePrefs({ audio: false })
    } else {
      audio.play().then(() => {
        setPlaying(true)
        playingRef.current = true
        savePrefs({ audio: true })
      }).catch(() => {})
    }
  }, [playing])

  const nextTrack = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    const next = (trackIndex + 1) % PLAYLIST.length
    setTrackIndex(next)
    loadTrack(audio, next)
    if (playingRef.current) audio.play().catch(() => {})
  }, [trackIndex])

  if (reduce) return <>{children}</>

  return (
    <AudioCtx.Provider value={{ playing, trackIndex, toggle, nextTrack }}>
      {children}
    </AudioCtx.Provider>
  )
}

function loadTrack(audio: HTMLAudioElement, index: number) {
  const track = PLAYLIST[index]
  audio.src = track.src
  audio.load()
}

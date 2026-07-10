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
import { loadPrefs, savePrefs } from '@/lib/room/storage'
import { PLAYLIST } from '@/lib/room/playlist'

interface AudioState {
  playing: boolean
  trackIndex: number
  volume: number
  toggle: () => void
  nextTrack: () => void
  setVolume: (v: number) => void
}

const AudioCtx = createContext<AudioState | null>(null)

export function useRoomAudio(): AudioState {
  const ctx = useContext(AudioCtx)
  if (!ctx) throw new Error('useRoomAudio must be used within RoomAudioProvider')
  return ctx
}

export function RoomAudioProvider({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState(false)
  const [trackIndex, setTrackIndex] = useState(0)
  const [volume, setVolumeState] = useState(0.3)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const triedRef = useRef(false)
  const playingRef = useRef(false)
  const trackIdxRef = useRef(0)

  // Initialise audio (always — reduced motion does not affect sound)
  useEffect(() => {
    const audio = new Audio()
    audio.loop = false
    const prefs = loadPrefs()
    audio.volume = prefs.volume
    setVolumeState(prefs.volume)
    audioRef.current = audio
    playingRef.current = false

    const idx = Math.floor(Math.random() * PLAYLIST.length)
    trackIdxRef.current = idx
    setTrackIndex(idx)
    loadTrack(audio, idx)

    const onEnded = () => {
      trackIdxRef.current = pickNextIndex(trackIdxRef.current)
      setTrackIndex(trackIdxRef.current)
      loadTrack(audio, trackIdxRef.current)
      if (playingRef.current) audio.play().catch(() => {})
    }
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.pause()
      audioRef.current = null
    }
  }, [])

  // Autoplay
  useEffect(() => {
    if (triedRef.current) return
    triedRef.current = true
    const prefs = loadPrefs()
    if (!prefs.audio || !audioRef.current) return

    let cleanup: (() => void) | undefined

    audioRef.current.play().then(() => {
      setPlaying(true)
      playingRef.current = true
    }).catch(() => {
      const onGesture = () => {
        audioRef.current?.play().then(() => {
          setPlaying(true)
          playingRef.current = true
        }).catch(() => {})
        cleanup?.()
      }
      cleanup = () => {
        document.removeEventListener('click', onGesture)
        document.removeEventListener('keydown', onGesture)
        document.removeEventListener('touchstart', onGesture)
      }
      document.addEventListener('click', onGesture)
      document.addEventListener('keydown', onGesture)
      document.addEventListener('touchstart', onGesture)
    })

    return () => {
      cleanup?.()
    }
  }, [])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    // Use the ref for the current playing state so rapid toggles never
    // act on a stale closure (the `playing` state lags one render behind).
    if (playingRef.current) {
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
  }, [])

  const nextTrack = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    trackIdxRef.current = pickNextIndex(trackIdxRef.current)
    setTrackIndex(trackIdxRef.current)
    loadTrack(audio, trackIdxRef.current)
    if (playingRef.current) audio.play().catch(() => {})
  }, [])

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v))
    if (audioRef.current) audioRef.current.volume = clamped
    setVolumeState(clamped)
    savePrefs({ volume: clamped })
  }, [])

  return (
    <AudioCtx.Provider value={{ playing, trackIndex, volume, toggle, nextTrack, setVolume }}>
      {children}
    </AudioCtx.Provider>
  )
}

/** Random next index, never the current one (unless the playlist has 1 track). */
function pickNextIndex(current: number): number {
  if (PLAYLIST.length <= 1) return current
  let next = current
  while (next === current) {
    next = Math.floor(Math.random() * PLAYLIST.length)
  }
  return next
}

function loadTrack(audio: HTMLAudioElement, index: number) {
  audio.src = PLAYLIST[index].src
  audio.load()
}

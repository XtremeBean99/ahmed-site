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
  toggle: () => void
  nextTrack: () => void
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
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const triedRef = useRef(false)
  const playingRef = useRef(false)
  const trackIdxRef = useRef(0)

  // Initialise audio (always — reduced motion does not affect sound)
  useEffect(() => {
    const audio = new Audio()
    audio.loop = false
    audio.volume = 0.3
    audioRef.current = audio
    playingRef.current = false

    const idx = Math.floor(Math.random() * PLAYLIST.length)
    trackIdxRef.current = idx
    setTrackIndex(idx)
    loadTrack(audio, idx)

    audio.addEventListener('ended', () => {
      trackIdxRef.current = (trackIdxRef.current + 1) % PLAYLIST.length
      setTrackIndex(trackIdxRef.current)
      loadTrack(audio, trackIdxRef.current)
      if (playingRef.current) audio.play().catch(() => {})
    })

    return () => {
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
  }, [])

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
    trackIdxRef.current = (trackIdxRef.current + 1) % PLAYLIST.length
    setTrackIndex(trackIdxRef.current)
    loadTrack(audio, trackIdxRef.current)
    if (playingRef.current) audio.play().catch(() => {})
  }, [])

  return (
    <AudioCtx.Provider value={{ playing, trackIndex, toggle, nextTrack }}>
      {children}
    </AudioCtx.Provider>
  )
}

function loadTrack(audio: HTMLAudioElement, index: number) {
  audio.src = PLAYLIST[index].src
  audio.load()
}

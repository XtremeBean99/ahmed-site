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
  /** Advance to a fresh random track AND start playback (starts if stopped). */
  skip: () => void
  selectTrack: (index: number) => void
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
  const playedRef = useRef(new Set<number>())

  // Initialise audio, always; reduced motion does not affect sound
  useEffect(() => {
    const audio = new Audio()
    audio.loop = false
    // Fetch nothing until play(): the default ('auto') buffered megabytes of a
    // track on every visit, music on or off. play() streams it on demand.
    audio.preload = 'none'
    const prefs = loadPrefs()
    audio.volume = prefs.volume
    setVolumeState(prefs.volume)
    audioRef.current = audio
    playingRef.current = false

    const idx = Math.floor(Math.random() * PLAYLIST.length)
    trackIdxRef.current = idx
    setTrackIndex(idx)
    // No src yet: even with preload 'none' Chrome fetches the first bytes of
    // whatever src is set. ensureLoaded() sets it right before the first play().

    const onEnded = () => {
      trackIdxRef.current = pickNextIndex(trackIdxRef.current, playedRef.current)
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

    // Only user activations may start media: touchstart and touch pointerdown are not
    // (pointerup, touchend, click and keydown are), so keep listening until play() works.
    const waitForGesture = () => {
      const events = ['pointerup', 'touchend', 'click', 'keydown'] as const
      const onGesture = () => {
        if (!audioRef.current) return
        ensureLoaded(audioRef.current, trackIdxRef.current)
        audioRef.current.play().then(() => {
          setPlaying(true)
          playingRef.current = true
          cleanup?.()
        }).catch(() => {})
      }
      cleanup = () => {
        for (const type of events) document.removeEventListener(type, onGesture)
      }
      for (const type of events) document.addEventListener(type, onGesture)
    }

    // Before any gesture the browser will refuse to autoplay, but a refused
    // play() still starts downloading the track (about 1 MB measured): wait
    // for the gesture instead. After one (the desk <-> room switch remounts
    // this provider) try at once.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
      waitForGesture()
    } else {
      ensureLoaded(audioRef.current, trackIdxRef.current)
      audioRef.current.play().then(() => {
        setPlaying(true)
        playingRef.current = true
      }).catch(waitForGesture)
    }

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
      ensureLoaded(audio, trackIdxRef.current)
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
    trackIdxRef.current = pickNextIndex(trackIdxRef.current, playedRef.current)
    setTrackIndex(trackIdxRef.current)
    loadTrack(audio, trackIdxRef.current)
    if (playingRef.current) audio.play().catch(() => {})
  }, [])

  const skip = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    trackIdxRef.current = pickNextIndex(trackIdxRef.current, playedRef.current)
    setTrackIndex(trackIdxRef.current)
    loadTrack(audio, trackIdxRef.current)
    audio.play().then(() => {
      setPlaying(true)
      playingRef.current = true
      savePrefs({ audio: true })
    }).catch(() => {})
  }, [])

  const selectTrack = useCallback((index: number) => {
    const audio = audioRef.current
    if (!audio || index < 0 || index >= PLAYLIST.length) return
    playedRef.current.add(trackIdxRef.current)
    trackIdxRef.current = index
    setTrackIndex(index)
    loadTrack(audio, index)
    audio.play().then(() => {
      setPlaying(true)
      playingRef.current = true
      savePrefs({ audio: true })
    }).catch(() => {})
  }, [])

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v))
    if (audioRef.current) audioRef.current.volume = clamped
    setVolumeState(clamped)
    savePrefs({ volume: clamped })
  }, [])

  return (
    <AudioCtx.Provider value={{ playing, trackIndex, volume, toggle, nextTrack, skip, selectTrack, setVolume }}>
      {children}
    </AudioCtx.Provider>
  )
}

/** Random next index, never repeating in the same session. Exhausts the playlist, then reshuffles. */
function pickNextIndex(current: number, played: Set<number>): number {
  played.add(current)
  const remaining = PLAYLIST.map((_, i) => i).filter((i) => !played.has(i))
  if (remaining.length === 0) {
    played.clear()
    return pickNextIndex(current, played)
  }
  return remaining[Math.floor(Math.random() * remaining.length)]
}

function loadTrack(audio: HTMLAudioElement, index: number) {
  audio.src = PLAYLIST[index].src
  audio.load()
}

/** Gives a never-played element its first track. */
function ensureLoaded(audio: HTMLAudioElement, index: number) {
  if (!audio.getAttribute('src')) loadTrack(audio, index)
}

'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react'
import { loadPrefs, savePrefs } from '@/lib/room/storage'

/**
 * Interaction sound effects. Owns a small pool of preloaded <audio> elements
 * per sound and plays them on demand, gated by the `sfx` preference in
 * room-save-v1 (independent of the music `audio` pref; muting music never
 * mutes SFX). Reduced motion does NOT disable sound.
 *
 * There is no global click listener; each interaction calls `play()` explicitly.
 */

const SFX_SRC = {
  click: '/sfx/mouse-click.mp3',
  lamp: '/sfx/lamp.mp3',
  drawer: '/sfx/drawer-open.mp3',
  clock: '/sfx/clock-change.mp3',
  poster: '/sfx/poster-sound.mp3',
  pcStart: '/sfx/pc-start.mp3',
} as const

export type SfxName = keyof typeof SFX_SRC

const POOL_SIZE = 4

/**
 * Synthesized arcade sounds (Web Audio, no files). Each voice is one short
 * oscillator or band-passed noise burst; `at` offsets it within the sound.
 */
interface Voice { wave: OscillatorType | 'noise'; f: number; f2?: number; at?: number; dur: number; gain: number }
const TONES = {
  blip: [{ wave: 'square', f: 480, f2: 540, dur: 0.05, gain: 0.16 }],
  bloop: [{ wave: 'square', f: 240, dur: 0.05, gain: 0.12 }],
  select: [{ wave: 'square', f: 660, dur: 0.035, gain: 0.08 }],
  brick: [{ wave: 'square', f: 700, f2: 880, dur: 0.045, gain: 0.12 }],
  powerup: [{ wave: 'triangle', f: 400, f2: 1200, dur: 0.18, gain: 0.22 }],
  score: [
    { wave: 'triangle', f: 523, dur: 0.08, gain: 0.2 },
    { wave: 'triangle', f: 659, at: 0.08, dur: 0.08, gain: 0.2 },
    { wave: 'triangle', f: 784, at: 0.16, dur: 0.14, gain: 0.2 },
  ],
  lose: [{ wave: 'square', f: 330, f2: 110, dur: 0.4, gain: 0.12 }],
  win: [
    { wave: 'triangle', f: 523, dur: 0.09, gain: 0.2 },
    { wave: 'triangle', f: 659, at: 0.09, dur: 0.09, gain: 0.2 },
    { wave: 'triangle', f: 784, at: 0.18, dur: 0.09, gain: 0.2 },
    { wave: 'triangle', f: 1047, at: 0.27, dur: 0.28, gain: 0.22 },
  ],
  deal: [{ wave: 'noise', f: 2600, dur: 0.07, gain: 0.5 }],
  flip: [
    { wave: 'noise', f: 3400, dur: 0.04, gain: 0.45 },
    { wave: 'sine', f: 1300, at: 0.012, dur: 0.03, gain: 0.05 },
  ],
  chip: [
    { wave: 'sine', f: 2200, dur: 0.03, gain: 0.12 },
    { wave: 'sine', f: 2900, at: 0.035, dur: 0.03, gain: 0.1 },
  ],
  place: [
    { wave: 'noise', f: 900, dur: 0.05, gain: 0.5 },
    { wave: 'triangle', f: 160, dur: 0.05, gain: 0.12 },
  ],
  invalid: [{ wave: 'square', f: 150, dur: 0.1, gain: 0.1 }],
  shuffle: [0, 1, 2, 3, 4, 5].map((i) => ({ wave: 'noise' as const, f: 2200 + i * 150, at: i * 0.045, dur: 0.04, gain: 0.35 })),
} satisfies Record<string, Voice[]>

export type ToneName = keyof typeof TONES

interface SfxState {
  play: (name: SfxName) => void
  /** A synthesized arcade sound; `pitch` scales every frequency (1 = as designed). */
  tone: (name: ToneName, pitch?: number) => void
  setEnabled: (v: boolean) => void
  setVolume: (v: number) => void
}

const SfxCtx = createContext<SfxState | null>(null)

export function useSfx(): SfxState {
  const ctx = useContext(SfxCtx)
  if (!ctx) throw new Error('useSfx must be used within RoomSfxProvider')
  return ctx
}

export function RoomSfxProvider({ children }: { children: ReactNode }) {
  const poolsRef = useRef<Record<string, HTMLAudioElement[]>>({})
  const idxRef = useRef<Record<string, number>>({})
  const enabledRef = useRef(true)
  const volumeRef = useRef(0.5)

  // Build the audio pools once, from the persisted prefs (client-only).
  useEffect(() => {
    const prefs = loadPrefs()
    enabledRef.current = prefs.sfx
    volumeRef.current = prefs.sfxVolume
    for (const [name, src] of Object.entries(SFX_SRC)) {
      poolsRef.current[name] = Array.from({ length: POOL_SIZE }, () => {
        const a = new Audio(src)
        a.preload = 'auto'
        a.volume = volumeRef.current
        return a
      })
      idxRef.current[name] = 0
    }
    return () => {
      for (const pool of Object.values(poolsRef.current)) {
        for (const a of pool) { a.pause(); a.src = '' }
      }
      poolsRef.current = {}
    }
  }, [])

  const play = useCallback((name: SfxName) => {
    if (!enabledRef.current) return
    const pool = poolsRef.current[name]
    if (!pool || pool.length === 0) return
    const next = (idxRef.current[name] + 1) % pool.length
    idxRef.current[name] = next
    const a = pool[next]
    a.volume = volumeRef.current
    try {
      a.currentTime = 0
      a.play().catch(() => {})
    } catch {
      /* ignore */
    }
  }, [])

  const audioCtxRef = useRef<AudioContext | null>(null)
  const noiseRef = useRef<AudioBuffer | null>(null)
  useEffect(() => () => { void audioCtxRef.current?.close().catch(() => {}) }, [])

  const tone = useCallback((name: ToneName, pitch = 1) => {
    if (!enabledRef.current || volumeRef.current <= 0) return
    try {
      const ac = audioCtxRef.current ?? (audioCtxRef.current = new AudioContext())
      if (ac.state === 'suspended') void ac.resume()
      if (!noiseRef.current) {
        const buf = ac.createBuffer(1, ac.sampleRate / 4, ac.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
        noiseRef.current = buf
      }
      const t0 = ac.currentTime + 0.005
      const master = volumeRef.current * 0.6
      for (const v of TONES[name] as Voice[]) {
        const start = t0 + (v.at ?? 0)
        const end = start + v.dur
        const g = ac.createGain()
        g.gain.setValueAtTime(0.0001, start)
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v.gain * master), start + 0.004)
        g.gain.exponentialRampToValueAtTime(0.0001, end)
        g.connect(ac.destination)
        if (v.wave === 'noise') {
          const src = ac.createBufferSource()
          src.buffer = noiseRef.current
          const band = ac.createBiquadFilter()
          band.type = 'bandpass'
          band.frequency.value = v.f * pitch
          band.Q.value = 0.9
          src.connect(band)
          band.connect(g)
          src.start(start)
          src.stop(end)
        } else {
          const o = ac.createOscillator()
          o.type = v.wave
          o.frequency.setValueAtTime(v.f * pitch, start)
          if (v.f2) o.frequency.exponentialRampToValueAtTime(v.f2 * pitch, end)
          o.connect(g)
          o.start(start)
          o.stop(end + 0.01)
        }
      }
    } catch {
      /* no Web Audio: stay silent */
    }
  }, [])

  const setEnabled = useCallback((v: boolean) => {
    enabledRef.current = v
    savePrefs({ sfx: v })
  }, [])

  const setVolume = useCallback((v: number) => {
    volumeRef.current = v
    savePrefs({ sfxVolume: v })
    for (const pool of Object.values(poolsRef.current)) {
      for (const a of pool) { a.volume = v }
    }
  }, [])


  return <SfxCtx.Provider value={{ play, tone, setEnabled, setVolume }}>{children}</SfxCtx.Provider>
}

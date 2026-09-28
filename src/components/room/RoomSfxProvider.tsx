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
 * Interaction sound effects. Each file is fetched once as an ArrayBuffer
 * (on idle after mount) and decoded once into an AudioBuffer on a shared
 * AudioContext, which is created and resumed on the first user gesture so
 * no autoplay warning is logged. `play()` starts a buffer source through a
 * gain node set to the SFX volume. Without Web Audio everything stays silent.
 * Gated by the `sfx` preference in room-save-v1 (independent of the music
 * `audio` pref; muting music never mutes SFX). Reduced motion does NOT
 * disable sound.
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

const SFX_NAMES = Object.keys(SFX_SRC) as SfxName[]

/** A play() for a not-yet-decoded sound is kept for this long, then dropped. */
const PENDING_MS = 300

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

function createAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    return new Ctor()
  } catch {
    return null
  }
}

function startSource(ac: AudioContext, buffer: AudioBuffer, volume: number): void {
  const src = ac.createBufferSource()
  src.buffer = buffer
  const gain = ac.createGain()
  gain.gain.value = volume
  src.connect(gain)
  gain.connect(ac.destination)
  src.start()
}

export function RoomSfxProvider({ children }: { children: ReactNode }) {
  const enabledRef = useRef(true)
  const volumeRef = useRef(0.5)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const noiseRef = useRef<AudioBuffer | null>(null)
  const arrayBuffersRef = useRef(new Map<SfxName, ArrayBuffer>())
  const buffersRef = useRef(new Map<SfxName, AudioBuffer>())
  const pendingRef = useRef(new Map<SfxName, number>())
  const fetchingRef = useRef(new Set<SfxName>())

  // Fetch each file once on idle, decode once the shared context exists
  // (created on the first user gesture), and keep the prefs in refs.
  useEffect(() => {
    const prefs = loadPrefs()
    enabledRef.current = prefs.sfx
    volumeRef.current = prefs.sfxVolume

    const buffers = buffersRef.current
    const arrayBuffers = arrayBuffersRef.current
    const pending = pendingRef.current
    const fetching = fetchingRef.current

    const decodeBuffer = (name: SfxName, arrayBuffer: ArrayBuffer) => {
      const ac = audioCtxRef.current
      if (!ac) return
      // decodeAudioData detaches the buffer, so it must only ever be handed over once.
      arrayBuffers.delete(name)
      ac.decodeAudioData(arrayBuffer).then((buffer) => {
        buffers.set(name, buffer)
        const requestedAt = pending.get(name)
        pending.delete(name)
        if (requestedAt !== undefined && enabledRef.current && performance.now() - requestedAt <= PENDING_MS) {
          startSource(ac, buffer, volumeRef.current)
        }
      }).catch(() => {
        arrayBuffers.delete(name)
        pending.delete(name)
      })
    }

    const decodeReady = () => {
      const ac = audioCtxRef.current
      if (!ac) return
      for (const [name, arrayBuffer] of Array.from(arrayBuffers)) {
        decodeBuffer(name, arrayBuffer)
      }
    }

    const fetchBuffer = (name: SfxName) => {
      if (fetching.has(name)) return
      fetching.add(name)
      fetch(SFX_SRC[name]).then((res) => {
        if (!res.ok) throw new Error(`sfx fetch failed: ${res.status}`)
        return res.arrayBuffer()
      }).then((arrayBuffer) => {
        arrayBuffers.set(name, arrayBuffer)
        if (audioCtxRef.current) decodeBuffer(name, arrayBuffer)
      }).catch(() => {
        fetching.delete(name)
      })
    }

    const fetchAll = () => {
      for (const name of SFX_NAMES) fetchBuffer(name)
    }

    const idleId = typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(fetchAll)
      : window.setTimeout(fetchAll, 1)

    // A touch pointerdown is not a user activation (only pointerup, touchend, click and
    // keydown are), so listen to those and keep listening until the context really runs.
    const unlockEvents = ['pointerup', 'touchend', 'click', 'keydown'] as const
    const stopListening = () => {
      for (const type of unlockEvents) document.removeEventListener(type, onGesture, true)
    }
    const onGesture = () => {
      if (!audioCtxRef.current) audioCtxRef.current = createAudioContext()
      const ac = audioCtxRef.current
      if (!ac) return
      decodeReady()
      if (ac.state === 'running') { stopListening(); return }
      void ac.resume().then(() => { if (ac.state === 'running') stopListening() }).catch(() => {})
    }
    for (const type of unlockEvents) document.addEventListener(type, onGesture, true)

    return () => {
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId)
      else window.clearTimeout(idleId)
      stopListening()
      void audioCtxRef.current?.close().catch(() => {})
      audioCtxRef.current = null
      noiseRef.current = null
      buffers.clear()
      arrayBuffers.clear()
      pending.clear()
      fetching.clear()
    }
  }, [])

  const play = useCallback((name: SfxName) => {
    if (!enabledRef.current || volumeRef.current <= 0) return
    const ac = audioCtxRef.current
    // play() runs inside the interaction's own handler, so it may resume a suspended context.
    if (ac && ac.state === 'suspended') void ac.resume().catch(() => {})
    const buffer = buffersRef.current.get(name)
    if (ac && buffer) {
      try {
        startSource(ac, buffer, volumeRef.current)
      } catch {
        /* ignore */
      }
      return
    }
    pendingRef.current.set(name, performance.now())
    window.setTimeout(() => {
      const requestedAt = pendingRef.current.get(name)
      if (requestedAt !== undefined && performance.now() - requestedAt > PENDING_MS) {
        pendingRef.current.delete(name)
      }
    }, PENDING_MS + 50)
  }, [])

  const tone = useCallback((name: ToneName, pitch = 1) => {
    if (!enabledRef.current || volumeRef.current <= 0) return
    const ac = audioCtxRef.current
    if (!ac) return
    try {
      if (ac.state === 'suspended') void ac.resume().catch(() => {})
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
  }, [])


  return <SfxCtx.Provider value={{ play, tone, setEnabled, setVolume }}>{children}</SfxCtx.Provider>
}

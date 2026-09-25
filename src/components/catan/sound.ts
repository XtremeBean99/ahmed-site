'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'

/**
 * Catan sound effects, synthesised with Web Audio (no files, nothing to download).
 * Each voice is one short oscillator or band-passed noise burst; `at` offsets it within the sound.
 * The AudioContext is created on the first play, which always follows a user gesture in practice.
 */

export type SoundName =
  | 'dice'
  | 'land'
  | 'place'
  | 'road'
  | 'city'
  | 'card'
  | 'gain'
  | 'steal'
  | 'robber'
  | 'knight'
  | 'turn'
  | 'offer'
  | 'accept'
  | 'decline'
  | 'award'
  | 'win'
  | 'lose'
  | 'error'
  | 'click'

export interface CatanSound {
  play(name: SoundName): void
}

interface Voice {
  wave: OscillatorType | 'noise'
  f: number
  f2?: number
  at?: number
  dur: number
  gain: number
}

const noise = (f: number, at: number, dur: number, gain: number): Voice => ({ wave: 'noise', f, at, dur, gain })

export const VOICES: Record<SoundName, Voice[]> = {
  dice: [0, 1, 2, 3, 4, 5].map((i) => noise(1800 + (i % 3) * 500, i * 0.06, 0.035, 0.45)),
  land: [noise(700, 0, 0.05, 0.6), { wave: 'triangle', f: 180, dur: 0.06, gain: 0.14 }],
  place: [noise(900, 0, 0.05, 0.5), { wave: 'triangle', f: 160, dur: 0.07, gain: 0.14 }],
  road: [noise(1400, 0, 0.09, 0.35), { wave: 'triangle', f: 220, dur: 0.05, gain: 0.08 }],
  city: [
    noise(800, 0, 0.05, 0.5),
    { wave: 'triangle', f: 196, dur: 0.08, gain: 0.14 },
    { wave: 'triangle', f: 262, at: 0.08, dur: 0.1, gain: 0.14 },
  ],
  card: [noise(3400, 0, 0.04, 0.4), { wave: 'sine', f: 1300, at: 0.012, dur: 0.03, gain: 0.05 }],
  gain: [
    { wave: 'sine', f: 1568, dur: 0.05, gain: 0.08 },
    { wave: 'sine', f: 2093, at: 0.05, dur: 0.07, gain: 0.08 },
  ],
  steal: [{ wave: 'square', f: 880, f2: 330, dur: 0.14, gain: 0.07 }, noise(2600, 0.02, 0.06, 0.3)],
  robber: [{ wave: 'square', f: 196, f2: 98, dur: 0.3, gain: 0.1 }],
  knight: [
    { wave: 'square', f: 392, dur: 0.07, gain: 0.08 },
    { wave: 'square', f: 523, at: 0.07, dur: 0.07, gain: 0.08 },
    { wave: 'square', f: 659, at: 0.14, dur: 0.12, gain: 0.08 },
  ],
  turn: [
    { wave: 'triangle', f: 659, dur: 0.09, gain: 0.18 },
    { wave: 'triangle', f: 988, at: 0.09, dur: 0.16, gain: 0.18 },
  ],
  offer: [
    { wave: 'sine', f: 988, dur: 0.06, gain: 0.12 },
    { wave: 'sine', f: 1319, at: 0.07, dur: 0.08, gain: 0.12 },
  ],
  accept: [
    { wave: 'triangle', f: 523, dur: 0.07, gain: 0.16 },
    { wave: 'triangle', f: 784, at: 0.07, dur: 0.12, gain: 0.16 },
  ],
  decline: [{ wave: 'triangle', f: 330, f2: 247, dur: 0.14, gain: 0.14 }],
  award: [
    { wave: 'triangle', f: 523, dur: 0.08, gain: 0.18 },
    { wave: 'triangle', f: 659, at: 0.08, dur: 0.08, gain: 0.18 },
    { wave: 'triangle', f: 784, at: 0.16, dur: 0.16, gain: 0.18 },
  ],
  win: [
    { wave: 'triangle', f: 523, dur: 0.09, gain: 0.2 },
    { wave: 'triangle', f: 659, at: 0.09, dur: 0.09, gain: 0.2 },
    { wave: 'triangle', f: 784, at: 0.18, dur: 0.09, gain: 0.2 },
    { wave: 'triangle', f: 1047, at: 0.27, dur: 0.3, gain: 0.22 },
  ],
  lose: [{ wave: 'square', f: 330, f2: 110, dur: 0.45, gain: 0.1 }],
  error: [{ wave: 'square', f: 150, dur: 0.1, gain: 0.1 }],
  click: [{ wave: 'square', f: 660, dur: 0.03, gain: 0.06 }],
}

/** Plays Catan sounds while `enabled`, at `volume` (0 to 1). Safe to call during SSR and without Web Audio. */
export function useCatanSound(enabled: boolean, volume: number): CatanSound {
  const ctxRef = useRef<AudioContext | null>(null)
  const noiseRef = useRef<AudioBuffer | null>(null)
  const settings = useRef({ enabled, volume })
  settings.current = { enabled, volume }

  useEffect(() => () => void ctxRef.current?.close().catch(() => {}), [])

  const play = useCallback((name: SoundName) => {
    const { enabled: on, volume: level } = settings.current
    if (!on || level <= 0 || typeof window === 'undefined') return
    try {
      const ac = ctxRef.current ?? (ctxRef.current = new AudioContext())
      if (ac.state === 'suspended') void ac.resume()
      if (!noiseRef.current) {
        const buf = ac.createBuffer(1, ac.sampleRate / 4, ac.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
        noiseRef.current = buf
      }
      const t0 = ac.currentTime + 0.005
      const master = level * 0.6
      for (const v of VOICES[name]) {
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
          band.frequency.value = v.f
          band.Q.value = 0.9
          src.connect(band)
          band.connect(g)
          src.start(start)
          src.stop(end)
        } else {
          const o = ac.createOscillator()
          o.type = v.wave
          o.frequency.setValueAtTime(v.f, start)
          if (v.f2) o.frequency.exponentialRampToValueAtTime(v.f2, end)
          o.connect(g)
          o.start(start)
          o.stop(end + 0.01)
        }
      }
    } catch {
      // no Web Audio: stay silent
    }
  }, [])

  return useMemo(() => ({ play }), [play])
}

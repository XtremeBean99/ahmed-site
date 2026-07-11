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
 * Also installs a document-level listener so every primary click on the
 * site plays the click sound. Explicit `play()` calls layer on top.
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

interface SfxState {
  play: (name: SfxName) => void
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

  // Global click sound: any primary-button click anywhere on the site.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      play('click')
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [play])

  return <SfxCtx.Provider value={{ play, setEnabled, setVolume }}>{children}</SfxCtx.Provider>
}

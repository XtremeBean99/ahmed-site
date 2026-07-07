// src/lib/room/lighting.tsx
'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type LightingState = 'dawn' | 'day' | 'dusk' | 'night'

export const LIGHTING_STATES: LightingState[] = ['dawn', 'day', 'dusk', 'night']

/** dawn 05:00–07:59 · day 08:00–16:59 · dusk 17:00–19:59 · night 20:00–04:59 */
export function lightingStateForHour(hour: number): LightingState {
  if (hour >= 5 && hour < 8) return 'dawn'
  if (hour >= 8 && hour < 17) return 'day'
  if (hour >= 17 && hour < 20) return 'dusk'
  return 'night'
}

function overrideFromQuery(): LightingState | null {
  if (typeof window === 'undefined') return null
  const q = new URLSearchParams(window.location.search).get('light')
  return (LIGHTING_STATES as string[]).includes(q ?? '') ? (q as LightingState) : null
}

/**
 * The visitor-local lighting clock. SSR and the first client render always
 * return 'dusk' (the identity art) so hydration never mismatches; the real
 * state applies in an effect, then refreshes every minute and when the tab
 * becomes visible. A ?light=<state> query param overrides the clock.
 */
export function useLightingClock(): LightingState {
  const [state, setState] = useState<LightingState>('dusk')
  useEffect(() => {
    const compute = () =>
      setState(overrideFromQuery() ?? lightingStateForHour(new Date().getHours()))
    compute()
    const id = setInterval(compute, 60_000)
    const onVis = () => { if (!document.hidden) compute() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  return state
}

const LightingContext = createContext<LightingState>('dusk')

export function LightingProvider({ state, children }: { state: LightingState; children: ReactNode }) {
  return <LightingContext.Provider value={state}>{children}</LightingContext.Provider>
}

/** Current lighting state; 'dusk' outside a provider (e.g. the desk view in v1). */
export function useLighting(): LightingState {
  return useContext(LightingContext)
}

/** '/room/x.png' -> '/room/lighting/<state>/x.png'; identity for dusk. */
export function lightingSrc(path: string, state: LightingState): string {
  if (state === 'dusk') return path
  return path.replace(/^\/room\//, `/room/lighting/${state}/`)
}

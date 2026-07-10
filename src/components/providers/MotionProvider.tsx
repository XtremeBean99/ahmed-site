'use client'

import { useState, useEffect } from 'react'
import { MotionConfig } from 'framer-motion'
import type { ReactNode } from 'react'
import { loadPrefs } from '@/lib/room/storage'

/**
 * Forces every framer-motion animation to play regardless of the OS
 * "reduce motion" setting, unless the user has opted into Calm Mode
 * (Settings > Calm Mode), which restores OS reduced-motion behaviour.
 *
 * With reducedMotion="never", useReducedMotion() returns false everywhere.
 * With reducedMotion="user", the OS preference is honoured.
 *
 * Listens for `room:calm-changed` custom events dispatched by the Settings toggle.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  const [calm, setCalm] = useState(false)

  useEffect(() => {
    try { setCalm(loadPrefs().calmMode) } catch { /* ignore */ }

    const onCalm = () => {
      try { setCalm(loadPrefs().calmMode) } catch { /* ignore */ }
    }
    window.addEventListener('room:calm-changed', onCalm)
    return () => window.removeEventListener('room:calm-changed', onCalm)
  }, [])

  return <MotionConfig reducedMotion={calm ? 'user' : 'never'}>{children}</MotionConfig>
}

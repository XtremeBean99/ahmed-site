import type { Variants, Transition } from 'framer-motion'

/**
 * Single source of truth for reduced-motion behaviour outside framer-motion
 * (canvas / WebGL loops that read the media query directly).
 *
 * This site intentionally plays all animations even when the OS "reduce motion"
 * setting is on, unless Calm Mode is enabled (Settings > Calm Mode). When calm
 * mode is on, the OS preference is honoured.
 * Framer-motion components are handled separately by MotionProvider.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem('room-save-v1')
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'calmMode' in parsed
      ) {
        const v = (parsed as Record<string, unknown>).calmMode
        if (typeof v === 'boolean' && v) {
          return matchMedia('(prefers-reduced-motion: reduce)').matches
        }
      }
    }
  } catch { /* ignore */ }
  return false
}

/** Easing already used by SectionReveal; keep site motion consistent. */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

export const DURATION = {
  fast: 0.2,
  base: 0.35,
  slow: 0.75,
} as const

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

/** Subtle card lift used on hover. Pair with whileHover="hover". */
export const cardHover: Variants = {
  rest: { y: 0, scale: 1 },
  hover: { y: -2, scale: 1.01 },
}

export const springSubtle: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
}

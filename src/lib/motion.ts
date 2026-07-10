import type { Variants, Transition } from 'framer-motion'

/**
 * Single source of truth for reduced-motion behaviour outside framer-motion
 * (canvas / WebGL loops that read the media query directly).
 *
 * This site intentionally plays all animations regardless of OS settings.
 * Always returns false.
 */
export function prefersReducedMotion(): boolean {
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

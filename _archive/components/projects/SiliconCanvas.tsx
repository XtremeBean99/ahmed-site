'use client'

import dynamic from 'next/dynamic'

/**
 * Thin client wrapper that dynamic-imports the SiliconAtom 3D scene with
 * ssr: false so WebGL / Three.js never runs during server rendering.
 */
export const SiliconCanvas = dynamic(
  () =>
    import('@/components/projects/SiliconAtom').then((mod) => mod.SiliconAtom),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] md:h-[520px] w-full animate-pulse rounded-lg bg-surface border border-border" />
    ),
  },
)

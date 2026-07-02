import { renderOgImage } from '@/lib/og'

export const alt = 'Super Ninja Monk Fighter IV'
export const size = { width: 1200, height: 630 } as const
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: 'Game',
    title: 'Super Ninja Monk Fighter IV',
    subtitle: 'A fast, movement-focused 2D platformer with a hand-drawn ink-and-void aesthetic.',
  })
}

import { renderOgImage } from '@/lib/og'

export const alt = 'Super Space Monk Ninja Fighter Simulator IV | Ahmed Hussain'
export const size = { width: 1200, height: 630 } as const
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: 'Platformer',
    title: 'Super Space Monk Ninja Fighter Simulator IV',
    subtitle: 'A fast 2D platformer with a hand-drawn ink-and-void aesthetic. Play in your browser.',
  })
}

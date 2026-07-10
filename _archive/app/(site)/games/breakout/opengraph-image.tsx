import { renderOgImage } from '@/lib/og'

export const alt = 'Breakout | Ahmed Hussain'
export const size = { width: 1200, height: 630 } as const
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: 'Arcade',
    title: 'Breakout',
    subtitle: 'Clear the wall, catch falling power-ups, and chase a personal best.',
  })
}

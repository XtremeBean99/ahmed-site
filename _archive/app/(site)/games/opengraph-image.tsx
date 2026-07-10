import { renderOgImage } from '@/lib/og'

export const alt = 'Games | Ahmed Hussain'
export const size = { width: 1200, height: 630 } as const
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: 'Games',
    title: 'A break from the brief',
    subtitle: 'A live WPM typing speed test and a monochrome Breakout with power-ups.',
  })
}

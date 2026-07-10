import { renderOgImage } from '@/lib/og'

export const alt = 'Typing speed test | Ahmed Hussain'
export const size = { width: 1200, height: 630 } as const
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: 'Live WPM',
    title: 'Typing speed test',
    subtitle: 'Curated law, AI governance and cybersecurity phrases, measured in real time.',
  })
}

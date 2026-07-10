import { renderOgImage } from '@/lib/og'

export const alt = 'Code & open source'
export const size = { width: 1200, height: 630 } as const
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: 'Open source',
    title: 'Code & open source',
    subtitle: 'Public software, pulled live from GitHub.',
  })
}

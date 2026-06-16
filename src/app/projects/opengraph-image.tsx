import { renderOgImage } from '@/lib/og'

export const alt = 'AI & Cyber Litigation Tracker'
export const size = { width: 1200, height: 630 } as const
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: 'Live tracker',
    title: 'AI & Cyber Litigation Tracker',
    subtitle: 'A source-cited dataset of AI, copyright and data-protection disputes.',
  })
}

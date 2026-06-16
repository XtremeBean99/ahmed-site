import { renderOgImage } from '@/lib/og'

export const alt = 'Projects | Ahmed Hussain'
export const size = { width: 1200, height: 630 } as const
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: 'Projects',
    title: 'Selected work',
    subtitle: 'A litigation tracker, open-source code, and an interactive look at silicon.',
  })
}

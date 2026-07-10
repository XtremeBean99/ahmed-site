import { renderOgImage } from '@/lib/og'

export const alt = 'AGLC4 citation generator | Ahmed Hussain'
export const size = { width: 1200, height: 630 } as const
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: 'Legal tool',
    title: 'AGLC4 citation generator',
    subtitle:
      'Footnote and bibliography citations in the Australian Guide to Legal Citation style.',
  })
}

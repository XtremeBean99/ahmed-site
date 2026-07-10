import { renderOgImage } from '@/lib/og'

export const alt = 'Base converter | Ahmed Hussain'
export const size = { width: 1200, height: 630 } as const
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: 'Computing tool',
    title: 'Base converter',
    subtitle:
      'Decimal, binary, hex, octal and text, plus a bitwise playground, all in the browser.',
  })
}

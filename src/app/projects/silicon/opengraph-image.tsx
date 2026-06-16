import { renderOgImage } from '@/lib/og'

export const alt = 'Silicon — from atom to architecture'
export const size = { width: 1200, height: 630 } as const
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: 'Interactive',
    title: 'Silicon — from atom to architecture',
    subtitle: 'How four valence electrons end up running every computer.',
  })
}

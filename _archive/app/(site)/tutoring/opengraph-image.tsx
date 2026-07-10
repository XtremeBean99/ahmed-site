import { renderOgImage } from '@/lib/og'

export const alt = 'Private tutoring by Ahmed Hussain'
export const size = { width: 1200, height: 630 } as const
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: 'Canberra · Years 7–12',
    title: 'Private tutoring',
    subtitle: 'Physics, Maths, English & Legal Studies. Online & in person.',
  })
}

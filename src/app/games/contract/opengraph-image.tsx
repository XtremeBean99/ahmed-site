import { renderOgImage } from '@/lib/og'

export const alt = 'The Clause Game | Ahmed Hussain'
export const size = { width: 1200, height: 630 } as const
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: 'Strategy',
    title: 'The Clause Game',
    subtitle:
      'Pick clauses and win by landing a balanced, enforceable deal — too greedy and it falls apart.',
  })
}

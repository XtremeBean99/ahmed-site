import type { Metadata } from 'next'
import { GameShell } from '@/components/games/GameShell'
import { TypingTest } from '@/components/games/TypingTest'
import { JsonLd } from '@/components/seo/JsonLd'
import { getDictionary } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'Typing speed test',
  description:
    'A live WPM typing speed test on curated law, AI governance and cybersecurity phrases. Tracks words per minute and accuracy in real time.',
  alternates: { canonical: 'https://ahmedyhussain.com/games/typing-test' },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Typing speed test',
  applicationCategory: 'GameApplication',
  operatingSystem: 'Web',
  description:
    'A live WPM typing speed test on curated law, AI governance and cybersecurity phrases.',
  url: 'https://ahmedyhussain.com/games/typing-test',
  author: { '@type': 'Person', name: 'Ahmed Hussain' },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'AUD' },
}

export default async function TypingTestPage() {
  const t = (await getDictionary()).typing
  return (
    <>
      <JsonLd data={schema} />
      <GameShell eyebrow={t.eyebrow} title={t.heading} intro={t.intro}>
        <TypingTest />
      </GameShell>
    </>
  )
}

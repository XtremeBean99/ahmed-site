import type { Metadata } from 'next'
import { GameShell } from '@/components/games/GameShell'
import { Breakout } from '@/components/games/Breakout'
import { JsonLd } from '@/components/seo/JsonLd'
import { getDictionary } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'Breakout',
  description:
    'A monochrome Breakout game with falling power-ups. Clear the wall, catch power-ups, and chase a personal best, all in your browser.',
  alternates: { canonical: 'https://ahmedyhussain.com/games/breakout' },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  name: 'Breakout',
  applicationCategory: 'GameApplication',
  operatingSystem: 'Web',
  description: 'A monochrome Breakout game with falling power-ups.',
  url: 'https://ahmedyhussain.com/games/breakout',
  author: { '@type': 'Person', name: 'Ahmed Hussain' },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'AUD' },
}

export default async function BreakoutPage() {
  const t = (await getDictionary()).breakout
  return (
    <>
      <JsonLd data={schema} />
      <GameShell eyebrow={t.eyebrow} title={t.heading} intro={t.intro}>
        <Breakout />
      </GameShell>
    </>
  )
}

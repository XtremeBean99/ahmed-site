import type { Metadata } from 'next'
import { GameShell } from '@/components/games/GameShell'
import { ContractGame } from '@/components/games/ContractGame'
import { JsonLd } from '@/components/seo/JsonLd'
import { getDictionary } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'The Clause Game',
  description:
    'A contract-drafting game: pick clauses across real negotiation scenarios and win by landing a balanced, enforceable deal. Too greedy or too generous and it falls apart.',
  alternates: { canonical: 'https://ahmedyhussain.com/games/contract' },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'The Clause Game',
  applicationCategory: 'GameApplication',
  operatingSystem: 'Web',
  description:
    'A contract-drafting game where you pick clauses and win by landing a balanced, enforceable deal.',
  url: 'https://ahmedyhussain.com/games/contract',
  author: { '@type': 'Person', name: 'Ahmed Hussain' },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'AUD' },
}

export default async function ContractGamePage() {
  const t = (await getDictionary()).contractGame
  return (
    <>
      <JsonLd data={schema} />
      <GameShell eyebrow={t.eyebrow} title={t.heading} intro={t.intro}>
        <ContractGame />
      </GameShell>
    </>
  )
}

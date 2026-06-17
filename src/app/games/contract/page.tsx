import type { Metadata } from 'next'
import { GameShell } from '@/components/games/GameShell'
import { ContractGame } from '@/components/games/ContractGame'
import { JsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'The Clause Game',
  description:
    'A contract-drafting game: pick clauses across real negotiation scenarios and win by landing a balanced, enforceable deal — too greedy or too generous and it falls apart.',
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

export default function ContractGamePage() {
  return (
    <>
      <JsonLd data={schema} />
      <GameShell
        eyebrow="Strategy"
        title="The Clause Game"
        intro="You are counsel at the negotiating table. Choose a clause in every category, then lock in the deal. Land it in the balanced, enforceable zone to win the round — push too hard for your client and the other side walks; give too much away and you have failed them. Your best run stays on this device."
      >
        <ContractGame />
      </GameShell>
    </>
  )
}

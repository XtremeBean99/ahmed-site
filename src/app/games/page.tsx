import type { Metadata } from 'next'
import Link from 'next/link'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { JsonLd } from '@/components/seo/JsonLd'
import { MotionCard } from '@/components/ui/MotionCard'
import { getDictionary } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'Games',
  description:
    'Browser games by Ahmed Hussain: a live WPM typing speed test on law and technology phrases, a monochrome Breakout with power-ups, and a contract-drafting strategy game.',
  alternates: { canonical: 'https://ahmedyhussain.com/games' },
}

const collectionSchema = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Games | Ahmed Hussain',
  description:
    'Browser games: a live WPM typing speed test, a monochrome Breakout with power-ups, and a contract-drafting strategy game.',
  url: 'https://ahmedyhussain.com/games',
  isPartOf: { '@type': 'WebSite', name: 'Ahmed Hussain', url: 'https://ahmedyhussain.com' },
  author: { '@type': 'Person', name: 'Ahmed Hussain' },
}

export default async function GamesPage() {
  const t = (await getDictionary()).games
  const games = [
    { ...t.cards.typing, href: '/games/typing-test' },
    { ...t.cards.breakout, href: '/games/breakout' },
    { ...t.cards.contract, href: '/games/contract' },
  ]

  return (
    <div className="pt-32 pb-24">
      <JsonLd data={collectionSchema} />
      <div className="max-w-container mx-auto px-6">
        <SectionReveal>
          <p className="label-text mb-6">{t.eyebrow}</p>
          <h1 className="font-serif text-5xl md:text-6xl font-bold text-foreground leading-tight mb-6 text-balance max-w-3xl">
            {t.heading}
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">
            {t.intro}
          </p>
        </SectionReveal>

        <div className="mt-16 grid sm:grid-cols-2 gap-6">
          {games.map((game, i) => (
            <SectionReveal key={game.href} delay={0.08 * i}>
              <MotionCard>
                <Link
                  href={game.href}
                  className="group block border border-border rounded-lg p-8 bg-surface hover:border-muted-foreground/50 hover:bg-surface-hover transition-colors h-full flex flex-col justify-between min-h-[220px]"
                >
                <div>
                  <p className="label-text mb-4">{game.label}</p>
                  <h2 className="font-serif text-xl font-semibold text-foreground group-hover:text-muted-foreground transition-colors mb-3">
                    {game.title}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{game.desc}</p>
                </div>
                <span className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  {t.play}
                  <svg
                    className="transition-transform group-hover:translate-x-0.5"
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden
                  >
                    <path d="M2 10L10 2M4 2h6v6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
              </MotionCard>
            </SectionReveal>
          ))}
        </div>
      </div>
    </div>
  )
}

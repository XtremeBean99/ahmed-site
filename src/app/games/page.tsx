import type { Metadata } from 'next'
import Link from 'next/link'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { JsonLd } from '@/components/seo/JsonLd'
import { MotionCard } from '@/components/ui/MotionCard'

export const metadata: Metadata = {
  title: 'Games',
  description:
    'Two small browser games by Ahmed Hussain: a live WPM typing speed test on law and technology phrases, and a monochrome Breakout with power-ups.',
  alternates: { canonical: 'https://ahmedyhussain.com/games' },
}

type GameCard = {
  label: string
  title: string
  description: string
  href: string
}

const games: GameCard[] = [
  {
    label: 'Live WPM',
    title: 'Typing speed test',
    description:
      'Type curated phrases on law, AI governance and cybersecurity while a live tracker measures your words per minute and accuracy.',
    href: '/games/typing-test',
  },
  {
    label: 'Arcade',
    title: 'Breakout',
    description:
      'A monochrome take on the Atari classic: clear the wall, catch falling power-ups, and chase a personal best.',
    href: '/games/breakout',
  },
]

const collectionSchema = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Games | Ahmed Hussain',
  description:
    'Two small browser games: a live WPM typing speed test and a monochrome Breakout with power-ups.',
  url: 'https://ahmedyhussain.com/games',
  isPartOf: { '@type': 'WebSite', name: 'Ahmed Hussain', url: 'https://ahmedyhussain.com' },
  author: { '@type': 'Person', name: 'Ahmed Hussain' },
}

export default function GamesPage() {
  return (
    <div className="pt-32 pb-24">
      <JsonLd data={collectionSchema} />
      <div className="max-w-container mx-auto px-6">
        <SectionReveal>
          <p className="label-text mb-6">Games</p>
          <h1 className="font-serif text-5xl md:text-6xl font-bold text-foreground leading-tight mb-6 text-balance max-w-3xl">
            A break from the brief.
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">
            Two small things built for fun and to keep the canvas and animation muscles warm.
            Both run entirely in your browser and keep your best score on your device.
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
                  <p className="text-sm text-muted-foreground leading-relaxed">{game.description}</p>
                </div>
                <span className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  Play
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

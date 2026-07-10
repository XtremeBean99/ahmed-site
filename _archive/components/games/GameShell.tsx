import Link from 'next/link'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { getDictionary } from '@/lib/i18n/server'
import type { ReactNode } from 'react'

interface GameShellProps {
  eyebrow: string
  title: string
  intro: string
  children: ReactNode
}

/** Page chrome for a game: back-to-games link, header, then the game slot. */
export async function GameShell({ eyebrow, title, intro, children }: GameShellProps) {
  const t = await getDictionary()
  return (
    <div className="pt-32 pb-24">
      <div className="max-w-container mx-auto px-6">
        <SectionReveal>
          <Link
            href="/games"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8 label-text"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M7.5 2L3.5 6l4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t.gameShell.allGames}
          </Link>
          <p className="label-text mb-6">{eyebrow}</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground leading-tight mb-6 text-balance max-w-3xl">
            {title}
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">{intro}</p>
        </SectionReveal>
        <div className="mt-12">{children}</div>
      </div>
    </div>
  )
}

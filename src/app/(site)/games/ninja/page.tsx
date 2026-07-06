import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { BugReportForm } from '@/components/games/BugReportForm'
import { JsonLd } from '@/components/seo/JsonLd'
import { getDictionary } from '@/lib/i18n/server'
import { topScores, type LeaderboardEntry } from '@/services/leaderboard'
import { formatTimeCs } from '@/lib/ninja/format'

export const metadata: Metadata = {
  title: 'Super Space Monk Ninja Fighter Simulator IV',
  description:
    'A fast, movement-focused 2D platformer built in Godot 4.7 with a hand-drawn ink-and-void aesthetic. Play in your browser - run, jump, wall-jump, and slide through seven hand-crafted levels.',
  alternates: { canonical: 'https://ahmedyhussain.com/games/ninja' },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  name: 'Super Space Monk Ninja Fighter Simulator IV',
  applicationCategory: 'GameApplication',
  operatingSystem: 'Web',
  description:
    'A fast, movement-focused 2D platformer built in Godot 4.7 with a hand-drawn ink-and-void aesthetic.',
  url: 'https://ahmedyhussain.com/games/ninja',
  author: { '@type': 'Person', name: 'Ahmed Hussain' },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'AUD' },
}

export default async function NinjaGamePage() {
  const t = (await getDictionary()).ninjaGame

  let hundredBoard: LeaderboardEntry[] = []
  let anyBoard: LeaderboardEntry[] = []
  try {
    ;[hundredBoard, anyBoard] = await Promise.all([topScores('hundred'), topScores('any')])
  } catch {
    // leaderboards are decorative - the page must render without them
  }

  return (
    <div className="pt-32 pb-24">
      <JsonLd data={schema} />
      <div className="max-w-container mx-auto px-6">
        {/* Back link */}
        <SectionReveal>
          <Link
            href="/games"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8 label-text"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M7.5 2L3.5 6l4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            All games
          </Link>
          <p className="label-text mb-6">{t.eyebrow}</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground leading-tight mb-6 text-balance max-w-3xl">
            {t.heading}
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">
            {t.intro}
          </p>
        </SectionReveal>

        {/* Title art */}
        <SectionReveal delay={0.04}>
          <div className="mt-12 max-w-3xl overflow-hidden rounded-lg border border-border">
            <Image
              src="/games/ninja-monk.png"
              alt={t.monkAlt}
              width={1408}
              height={768}
              className="w-full grayscale"
              priority={false}
            />
          </div>
        </SectionReveal>

        {/* Play the game */}
        <SectionReveal delay={0.08}>
          <div className="mt-16">
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-4">
              {t.playHeading}
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-2xl mb-6">
              {t.playBody}
            </p>
            <a
              href="/games/ninja/index.html"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 border border-border rounded-lg px-6 py-3 text-sm font-medium text-foreground hover:bg-surface transition-colors"
            >
              {t.playButton}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="M2 2h8v8M10 2 2 10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </SectionReveal>

        {/* Leaderboards */}
        <SectionReveal delay={0.1}>
          <div className="mt-16">
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-4">
              {t.leaderboardHeading}
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-2xl mb-6">
              {t.leaderboardIntro}
            </p>
            <div className="grid gap-8 md:grid-cols-2 max-w-3xl">
              {[
                { title: t.leaderboardHundred, entries: hundredBoard, showTokens: false },
                { title: t.leaderboardAny, entries: anyBoard, showTokens: true },
              ].map((board) => (
                <div key={board.title} className="border border-border rounded-lg p-5">
                  <h3 className="text-sm font-medium text-foreground mb-4 label-text">
                    {board.title}
                  </h3>
                  {board.entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t.leaderboardEmpty}</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground text-left">
                          <th className="pb-2 font-normal w-8">{t.leaderboardRank}</th>
                          <th className="pb-2 font-normal">{t.leaderboardName}</th>
                          {board.showTokens && <th className="pb-2 font-normal text-right w-14">{t.leaderboardTokens}</th>}
                          <th className="pb-2 font-normal text-right">{t.leaderboardTime}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {board.entries.map((entry, i) => (
                          <tr key={`${entry.name}-${entry.at}`} className="border-t border-border">
                            <td className="py-2 text-muted-foreground">{i + 1}</td>
                            <td className="py-2 text-foreground">{entry.name}</td>
                            {board.showTokens && <td className="py-2 text-right text-muted-foreground">{entry.tokensPercent}%</td>}
                            <td className="py-2 text-right font-mono text-foreground">
                              {formatTimeCs(entry.timeCs)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          </div>
        </SectionReveal>

        {/* Controls */}
        <SectionReveal delay={0.12}>
          <div className="mt-16">
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-4">
              {t.controlsHeading}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed text-sm max-w-2xl">
              {t.controls.map((control: string, i: number) => (
                <li key={i}>{control}</li>
              ))}
            </ul>
          </div>
        </SectionReveal>

        {/* Features */}
        <SectionReveal delay={0.16}>
          <div className="mt-16">
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-4">
              {t.featuresHeading}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed text-sm max-w-2xl">
              {t.features.map((feature: string, i: number) => (
                <li key={i}>{feature}</li>
              ))}
            </ul>
          </div>
        </SectionReveal>

        {/* Tech */}
        <SectionReveal delay={0.2}>
          <div className="mt-16 border-t border-border pt-8">
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-4">
              {t.techHeading}
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-2xl">
              {t.techBody}
            </p>
          </div>
        </SectionReveal>

        {/* Credits */}
        <SectionReveal delay={0.24}>
          <div className="mt-16 border-t border-border pt-8">
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-4">
              {t.creditsHeading}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed text-sm max-w-2xl">
              {t.credits.map((credit: string, i: number) => (
                <li key={i}>{credit}</li>
              ))}
            </ul>
          </div>
        </SectionReveal>

        {/* Bug report */}
        <SectionReveal delay={0.28}>
          <div className="mt-16 border-t border-border pt-8">
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-4">
              {t.bugsHeading}
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-2xl mb-6">
              {t.bugsIntro}
            </p>
            <div className="max-w-xl">
              <BugReportForm
                bugsName={t.bugsName}
                bugsEmail={t.bugsEmail}
                bugsDescription={t.bugsDescription}
                bugsDescriptionPlaceholder={t.bugsDescriptionPlaceholder}
                bugsSend={t.bugsSend}
                bugsSending={t.bugsSending}
                bugsSuccess={t.bugsSuccess}
                bugsError={t.bugsError}
              />
            </div>
          </div>
        </SectionReveal>
      </div>
    </div>
  )
}

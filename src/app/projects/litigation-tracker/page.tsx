import type { Metadata } from 'next'
import Link from 'next/link'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { CircuitMesh } from '@/components/ui/CircuitMesh'
import { StatCounters, type Stat } from '@/components/projects/StatCounters'
import { CaseList } from '@/components/projects/CaseList'
import { claimCounts, lastUpdated, litigation, trackerStats } from '@/lib/litigation/data'
import { JsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'AI & Cyber Litigation Tracker',
  description:
    'AI & Cyber Litigation Tracker: a curated, source-cited dataset of artificial intelligence and data-protection cases, by Ahmed Hussain.',
  alternates: { canonical: 'https://ahmedyhussain.com/projects/litigation-tracker' },
}

const updatedLabel = new Date(lastUpdated).toLocaleDateString('en-AU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const counters: Stat[] = [
  { label: 'Cases tracked', value: trackerStats.total },
  { label: 'Active matters', value: trackerStats.active },
  { label: 'Companies named', value: trackerStats.defendants },
  { label: 'Resolved', value: trackerStats.resolved },
]

const claimBreakdown = Object.entries(claimCounts).sort((a, b) => b[1] - a[1])

const webpageSchema = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'AI & Cyber Litigation Tracker',
  description:
    'A curated, source-cited dataset of artificial intelligence, copyright and data-protection disputes.',
  url: 'https://ahmedyhussain.com/projects/litigation-tracker',
  isPartOf: { '@type': 'WebSite', name: 'Ahmed Hussain', url: 'https://ahmedyhussain.com' },
  author: { '@type': 'Person', name: 'Ahmed Hussain' },
}

export default function LitigationTrackerPage() {
  return (
    <div className="relative pt-32 pb-24">
      <JsonLd data={webpageSchema} />
      <CircuitMesh />

      <div className="relative max-w-container mx-auto px-6">
        {/* Back to projects */}
        <SectionReveal>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8 label-text"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M7.5 2L3.5 6l4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            All projects
          </Link>
        </SectionReveal>

        {/* Header */}
        <SectionReveal>
          <p className="label-text mb-6">Projects · Live tracker</p>
          <h1 className="font-serif text-5xl md:text-6xl font-bold text-foreground leading-tight mb-6 text-balance max-w-3xl">
            AI &amp; Cyber Litigation Tracker
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mb-4">
            A curated dataset of artificial intelligence, copyright, privacy and data-protection
            disputes, each record cited to its primary court source. Built where my law and computing
            work meet.
          </p>
          <p className="text-xs text-muted-foreground">
            Last reviewed {updatedLabel}. Figures describe relief sought unless an award or
            settlement is noted.
          </p>
        </SectionReveal>

        {/* Counters */}
        <SectionReveal delay={0.1}>
          <div className="mt-12">
            <StatCounters stats={counters} />
          </div>
        </SectionReveal>

        {/* Claim-type breakdown */}
        <SectionReveal delay={0.1}>
          <div className="mt-16">
            <p className="label-text mb-4">By claim type</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden">
              {claimBreakdown.map(([claim, count]) => (
                <div key={claim} className="bg-background px-4 py-5 flex flex-col gap-1">
                  <span className="font-serif text-2xl font-semibold text-foreground tabular-nums">
                    {count}
                  </span>
                  <span className="text-xs text-muted-foreground">{claim}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionReveal>

        {/* Case list */}
        <SectionReveal delay={0.1}>
          <div className="mt-20">
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-2">Case index</h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-2xl">
              Filter by claim type or status. Each entry links to its source for verification.
            </p>
            <CaseList cases={litigation} />
          </div>
        </SectionReveal>

        {/* Methodology / disclaimer */}
        <SectionReveal delay={0.1}>
          <div className="mt-20 border-t border-border pt-8 max-w-2xl">
            <p className="label-text mb-3">Method &amp; limitations</p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Records are compiled from public court filings and reporting, then checked against the
              primary docket, which for United States federal matters is accessed through
              CourtListener and the RECAP archive. Relief sought is recorded separately from relief
              awarded; most matters listed are unresolved, so any monetary figure is a claim, not a
              finding of liability.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This page is an information resource, not legal advice, and does not characterise the
              merits of any party&rsquo;s position. To suggest a correction or a case to add,{' '}
              <Link
                href="/#contact"
                className="text-foreground underline underline-offset-2 hover:no-underline"
              >
                get in touch
              </Link>
              .
            </p>
          </div>
        </SectionReveal>
      </div>
    </div>
  )
}

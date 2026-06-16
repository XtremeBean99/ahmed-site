import type { Metadata } from 'next'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { CircuitMesh } from '@/components/ui/CircuitMesh'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Projects',
  description:
    'Projects by Ahmed Hussain. Software and research work where law meets technology.',
  alternates: { canonical: 'https://ahmedyhussain.com/projects' },
}

export default function ProjectsPage() {
  return (
    <div className="relative pt-32 pb-24">
      <CircuitMesh />
      <div className="relative max-w-container mx-auto px-6">

        {/* Header */}
        <SectionReveal>
          <p className="label-text mb-6">Projects</p>
          <h1 className="font-serif text-5xl md:text-6xl font-bold text-foreground leading-tight mb-6 text-balance max-w-2xl">
            Work and research.
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-xl mb-16">
            Projects in software engineering and legal technology. This page will expand as work
            reaches a stage suitable for sharing.
          </p>
        </SectionReveal>

        {/* Status banner */}
        <SectionReveal delay={0.1}>
          <div className="border border-dashed border-border rounded-lg px-8 py-12 text-center mb-16">
            <span className="inline-flex items-center gap-2 label-text mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse inline-block" />
              Under development
            </span>
            <p className="font-serif text-2xl font-semibold text-foreground mb-3">
              Projects are in progress.
            </p>
            <p className="text-muted-foreground text-base max-w-sm mx-auto">
              Check back later, or{' '}
              <Link href="/#contact" className="text-foreground underline underline-offset-2 hover:no-underline">
                get in touch
              </Link>{' '}
              to discuss collaboration.
            </p>
          </div>
        </SectionReveal>

        {/* Placeholder project cards */}
        <SectionReveal delay={0.15}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { label: 'Software', description: 'A technical project combining law and software engineering.' },
              { label: 'Research', description: 'An empirical study of AI governance frameworks.' },
              { label: 'Tool', description: 'A developer utility for legal document processing.' },
            ].map((p, i) => (
              <div
                key={i}
                className="border border-dashed border-border rounded-lg p-7 flex flex-col gap-4 opacity-50"
                aria-hidden="true"
              >
                <p className="label-text">{p.label}</p>
                <div className="h-4 bg-surface rounded w-3/4" />
                <p className="text-sm text-muted-foreground">{p.description}</p>
              </div>
            ))}
          </div>
        </SectionReveal>

      </div>
    </div>
  )
}

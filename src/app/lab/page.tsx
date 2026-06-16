import type { Metadata } from 'next'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { CornerSigils } from '@/components/ui/CyberSigils'

export const metadata: Metadata = {
  title: 'Lab',
  description:
    'An experimental space for interface and visual studies, including the cyber-sigil background motifs used across the site.',
  alternates: { canonical: 'https://ahmedyhussain.com/lab' },
}

export default function LabPage() {
  return (
    <>
      <CornerSigils />
      <div className="min-h-screen flex flex-col justify-center">
      <div className="max-w-container mx-auto px-6 pt-32 pb-24">
        <SectionReveal>
          <p className="label-text mb-6">Lab</p>
          <h1 className="font-serif text-5xl md:text-6xl font-bold text-foreground leading-tight mb-6 text-balance max-w-2xl">
            Experiments in progress.
          </h1>
        </SectionReveal>

        <SectionReveal delay={0.1}>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-xl mb-4">
            A space for interface and visual experiments. The faint circuit pattern sits
            behind every page on the site; the brighter corner motifs are exclusive to this
            page, kept deliberately subtle so they add depth without competing with the content.
          </p>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-xl">
            This page is a testbed, so expect it to change.
          </p>
        </SectionReveal>
      </div>
      </div>
    </>
  )
}

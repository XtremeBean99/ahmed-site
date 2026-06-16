import type { Metadata } from 'next'
import { CyberSigils } from '@/components/ui/CyberSigils'
import { SectionReveal } from '@/components/ui/SectionReveal'

export const metadata: Metadata = {
  title: 'Lab',
  description:
    'An experimental space for interface and visual studies, including discreet cyber-sigil background motifs.',
  alternates: { canonical: 'https://ahmedyhussain.com/lab' },
}

export default function LabPage() {
  return (
    <>
      <CyberSigils />

      <div className="relative z-10 min-h-screen flex flex-col justify-center">
        <div className="max-w-container mx-auto px-6 pt-32 pb-24">
          <SectionReveal>
            <p className="label-text mb-6">Lab</p>
            <h1 className="font-serif text-5xl md:text-6xl font-bold text-foreground leading-tight mb-6 text-balance max-w-2xl">
              Experiments in progress.
            </h1>
          </SectionReveal>

          <SectionReveal delay={0.1}>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-xl mb-4">
              A space for interface and visual experiments. The motifs drifting in the
              corners are cyber-sigil studies, kept deliberately faint so they sit behind
              the content rather than competing with it.
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

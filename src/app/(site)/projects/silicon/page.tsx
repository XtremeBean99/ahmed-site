import type { Metadata } from 'next'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { SiliconCanvas } from '@/components/projects/SiliconCanvas'
import { JsonLd } from '@/components/seo/JsonLd'
import { getDictionary } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'Silicon: from atom to architecture',
  description:
    'An interactive 3D model of a silicon atom, with an explainer on how its four valence electrons end up running every computer.',
  alternates: { canonical: 'https://ahmedyhussain.com/projects/silicon' },
}

const webpageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Silicon: from atom to architecture',
  description:
    'An interactive 3D model of a silicon atom, with an explainer on how its four valence electrons end up running every computer.',
  url: 'https://ahmedyhussain.com/projects/silicon',
  isPartOf: { '@type': 'WebSite', name: 'Ahmed Hussain', url: 'https://ahmedyhussain.com' },
  author: { '@type': 'Person', name: 'Ahmed Hussain' },
}

export default async function SiliconPage() {
  const t = (await getDictionary()).silicon
  return (
    <div className="pt-32 pb-24">
      <JsonLd data={webpageSchema} />
      <div className="max-w-container mx-auto px-6">
        {/* Header */}
        <SectionReveal>
          <p className="label-text mb-6">{t.eyebrow}</p>
          <h1 className="font-serif text-5xl md:text-6xl font-bold text-foreground leading-tight mb-6 text-balance max-w-3xl">
            {t.heading}
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mb-4">
            {t.intro}
          </p>
        </SectionReveal>

        {/* 3D Render */}
        <SectionReveal delay={0.08}>
          <div className="mt-12">
            <SiliconCanvas />
            <p className="text-xs text-muted-foreground mt-3 text-center">
              {t.caption}
            </p>
          </div>
        </SectionReveal>

        {/* Explainer. Prose with inline emphasis is stored as HTML in the
            dictionary and rendered here; `.rich strong` styles the emphasis. */}
        <div className="rich mt-20 max-w-2xl space-y-16">
          {/* 1. Why Silicon */}
          <SectionReveal delay={0.1}>
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-4">
              {t.s1heading}
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: t.s1p1 }} />
            <p className="text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: t.s1p2 }} />
          </SectionReveal>

          {/* 2. Doping */}
          <SectionReveal delay={0.1}>
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-4">
              {t.s2heading}
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: t.s2p1 }} />
            <p className="text-muted-foreground leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: t.s2p2 }} />
            <p className="text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: t.s2p3 }} />
          </SectionReveal>

          {/* 3. The Transistor */}
          <SectionReveal delay={0.1}>
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-4">
              {t.s3heading}
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: t.s3p1 }} />
            <p className="text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: t.s3p2 }} />
          </SectionReveal>

          {/* 4. From Sand to CPU */}
          <SectionReveal delay={0.1}>
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-4">
              {t.s4heading}
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              {t.s4intro}
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed text-sm">
              <li dangerouslySetInnerHTML={{ __html: t.s4b1 }} />
              <li dangerouslySetInnerHTML={{ __html: t.s4b2 }} />
              <li dangerouslySetInnerHTML={{ __html: t.s4b3 }} />
              <li dangerouslySetInnerHTML={{ __html: t.s4b4 }} />
              <li dangerouslySetInnerHTML={{ __html: t.s4b5 }} />
            </ul>
          </SectionReveal>

          {/* 5. Tie-back */}
          <SectionReveal delay={0.1}>
            <div className="border-t border-border pt-8">
              <p className="label-text mb-3">{t.s5label}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t.s5body}
              </p>
            </div>
          </SectionReveal>
        </div>
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { JsonLd } from '@/components/seo/JsonLd'
import { getDictionary } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'Super Ninja Monk Fighter IV',
  description:
    'A fast, movement-focused 2D platformer built in Godot 4.7 with a hand-drawn ink-and-void aesthetic. Six hand-crafted levels, fluid wall-jumping and sliding, and a ghost-runner replay system.',
  alternates: { canonical: 'https://ahmedyhussain.com/projects/ninja' },
}

const webpageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Super Ninja Monk Fighter IV',
  description:
    'A fast, movement-focused 2D platformer built in Godot 4.7 with a hand-drawn ink-and-void aesthetic. Six hand-crafted levels, fluid wall-jumping and sliding, and a ghost-runner replay system.',
  url: 'https://ahmedyhussain.com/projects/ninja',
  isPartOf: { '@type': 'WebSite', name: 'Ahmed Hussain', url: 'https://ahmedyhussain.com' },
  author: { '@type': 'Person', name: 'Ahmed Hussain' },
}

export default async function NinjaPage() {
  const t = (await getDictionary()).ninja
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
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">
            {t.intro}
          </p>
        </SectionReveal>

        {/* Gameplay description */}
        <SectionReveal delay={0.08}>
          <div className="mt-16">
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-4">
              {t.gameplayHeading}
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-2xl">
              {t.gameplayBody}
            </p>
          </div>
        </SectionReveal>

        {/* Video showcase placeholder */}
        <SectionReveal delay={0.12}>
          <div className="mt-16">
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-4">
              {t.videoHeading}
            </h2>
            <div className="border border-dashed border-border rounded-lg bg-surface flex items-center justify-center min-h-[320px]">
              <p className="text-muted text-sm">{t.videoPlaceholder}</p>
            </div>
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
      </div>
    </div>
  )
}

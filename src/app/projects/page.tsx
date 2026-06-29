import type { Metadata } from 'next'
import Link from 'next/link'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { JsonLd } from '@/components/seo/JsonLd'
import { MotionCard } from '@/components/ui/MotionCard'
import { getDictionary } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'Projects',
  description:
    'Selected work by Ahmed Hussain: open-source code, an interactive 3D look at silicon, an AGLC4 citation generator, and a base converter.',
  alternates: { canonical: 'https://ahmedyhussain.com/projects' },
}

const collectionSchema = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Projects | Ahmed Hussain',
  description:
    'Selected work: open-source code, an interactive 3D look at silicon, an AGLC4 citation generator, and a base converter.',
  url: 'https://ahmedyhussain.com/projects',
  isPartOf: { '@type': 'WebSite', name: 'Ahmed Hussain', url: 'https://ahmedyhussain.com' },
  author: { '@type': 'Person', name: 'Ahmed Hussain' },
}

export default async function ProjectsPage() {
  const t = (await getDictionary()).projects
  const projects: {
    label: string
    title: string
    desc: string
    href?: string
    external?: boolean
  }[] = [
    { ...t.cards.armoire, href: 'https://armoire.ahmedyhussain.com', external: true },
    { ...t.cards.code, href: '/projects/code' },
    { ...t.cards.silicon, href: '/projects/silicon' },
    { ...t.cards.aglc4, href: '/projects/aglc4' },
    { ...t.cards.converter, href: '/projects/base-converter' },
    { ...t.cards.dev, href: undefined },
  ]

  return (
    <div className="pt-32 pb-24">
      <JsonLd data={collectionSchema} />
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

        {/* Cards */}
        <div className="mt-16 grid sm:grid-cols-2 gap-6">
          {projects.map((project, i) => {
            const cardClass =
              'group block border border-border rounded-lg p-8 bg-surface hover:border-muted-foreground/50 hover:bg-surface-hover transition-colors h-full flex flex-col justify-between min-h-[220px]'
            const cardInner = (
              <>
                <div>
                  <p className="label-text mb-4">{project.label}</p>
                  <h2 className="font-serif text-xl font-semibold text-foreground group-hover:text-muted-foreground transition-colors mb-3">
                    {project.title}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {project.desc}
                  </p>
                </div>
                <span className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  {project.external ? t.viewExternal : t.view}
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
              </>
            )
            return (
              <SectionReveal key={i} delay={0.08 * i}>
                {project.href ? (
                  /* Real card (clickable) */
                  <MotionCard>
                    {project.external ? (
                      <a
                        href={project.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cardClass}
                      >
                        {cardInner}
                      </a>
                    ) : (
                      <Link href={project.href} className={cardClass}>
                        {cardInner}
                      </Link>
                    )}
                  </MotionCard>
                ) : (
                  /* In-progress card: not clickable, dashed border */
                  <div className="border border-dashed border-border rounded-lg p-8 h-full flex flex-col justify-between min-h-[220px]">
                    <div>
                      <p className="label-text mb-4">{project.label}</p>
                      <h2 className="font-serif text-xl font-semibold text-foreground mb-3">
                        {project.title}
                      </h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {project.desc}
                      </p>
                    </div>
                    <span className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse inline-block" />
                      {t.comingSoon}
                    </span>
                  </div>
                )}
              </SectionReveal>
            )
          })}
        </div>
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { JsonLd } from '@/components/seo/JsonLd'
import { MotionCard } from '@/components/ui/MotionCard'

export const metadata: Metadata = {
  title: 'Projects',
  description:
    'Selected work by Ahmed Hussain: open-source code, an interactive 3D look at silicon, an AGLC4 citation generator, and a base converter.',
  alternates: { canonical: 'https://ahmedyhussain.com/projects' },
}

type ProjectCard = {
  label: string
  title: string
  description: string
  href?: string // present = clickable; absent = "in progress"
}

const projects: ProjectCard[] = [
  {
    label: 'Open source',
    title: 'My Github Projects',
    description:
      'Public repositories pulled live from GitHub: the software side of my law-and-computing work.',
    href: '/projects/code',
  },
  {
    label: 'Interactive',
    title: 'Silicon: from atom to architecture',
    description:
      'An interactive 3D model of a silicon atom, with an explainer on how its four valence electrons end up running every computer.',
    href: '/projects/silicon',
  },
  {
    label: 'Legal tool',
    title: 'AGLC4 citation generator',
    description:
      'Build footnote and bibliography citations in the Australian Guide to Legal Citation (4th ed) style — cases, legislation, articles, books, web pages and Hansard — and copy them straight into your work.',
    href: '/projects/aglc4',
  },
  {
    label: 'Computing tool',
    title: 'Base converter',
    description:
      'Convert live between decimal, binary, hex, octal and UTF-8 text, with a bitwise playground for AND, OR, XOR, NOT and shifts. Arbitrary-precision, all in the browser.',
    href: '/projects/base-converter',
  },
  {
    label: 'Research',
    title: 'In development',
    description:
      'Empirical and doctrinal work on AI governance. I will publish it here as it develops.',
    // no href → renders the "coming soon" treatment
  },
]

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

export default function ProjectsPage() {
  return (
    <div className="pt-32 pb-24">
      <JsonLd data={collectionSchema} />
      <div className="max-w-container mx-auto px-6">
        {/* Header */}
        <SectionReveal>
          <p className="label-text mb-6">Projects</p>
          <h1 className="font-serif text-5xl md:text-6xl font-bold text-foreground leading-tight mb-6 text-balance max-w-3xl">
            Selected work.
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">
            A curated selection of my most recent professional &amp; personal projects.
          </p>
        </SectionReveal>

        {/* Cards */}
        <div className="mt-16 grid sm:grid-cols-2 gap-6">
          {projects.map((project, i) => (
            <SectionReveal key={i} delay={0.08 * i}>
              {project.href ? (
                /* Real card (clickable) */
                <MotionCard>
                  <Link
                    href={project.href}
                    className="group block border border-border rounded-lg p-8 bg-surface hover:border-muted-foreground/50 hover:bg-surface-hover transition-colors h-full flex flex-col justify-between min-h-[220px]"
                  >
                    <div>
                      <p className="label-text mb-4">{project.label}</p>
                      <h2 className="font-serif text-xl font-semibold text-foreground group-hover:text-muted-foreground transition-colors mb-3">
                        {project.title}
                      </h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {project.description}
                      </p>
                    </div>
                    <span className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      View project
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
              ) : (
                /* In-progress card: not clickable, dashed border */
                <div className="border border-dashed border-border rounded-lg p-8 h-full flex flex-col justify-between min-h-[220px]">
                  <div>
                    <p className="label-text mb-4">{project.label}</p>
                    <h2 className="font-serif text-xl font-semibold text-foreground mb-3">
                      {project.title}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {project.description}
                    </p>
                  </div>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse inline-block" />
                    Coming soon
                  </span>
                </div>
              )}
            </SectionReveal>
          ))}
        </div>
      </div>
    </div>
  )
}

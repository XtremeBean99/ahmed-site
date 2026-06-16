import Link from 'next/link'
import { SectionReveal } from '@/components/ui/SectionReveal'

type ProjectCard = {
  label: string
  title: string
  description: string
  href?: string // present = clickable; absent = "in progress"
  external?: boolean
}

const projects: ProjectCard[] = [
  {
    label: 'Live tracker',
    title: 'AI & Cyber Litigation Tracker',
    description:
      'A curated, source-cited dataset of AI, copyright and data-protection disputes, each record verified against its primary court docket.',
    href: '/projects',
  },
  {
    label: 'Open source',
    title: 'Code & open source',
    description:
      'Public repositories pulled live from GitHub — the software side of my law-and-computing work.',
    href: '/projects/code',
  },
  {
    label: 'Interactive',
    title: 'Silicon — from atom to architecture',
    description:
      'An interactive 3D model of a silicon atom, with an explainer on how its four valence electrons end up running every computer.',
    href: '/projects/silicon',
  },
  {
    label: 'Research',
    title: 'In development',
    description:
      'Empirical and doctrinal work on AI governance. I will publish it here as it develops.',
    // no href → renders the "coming soon" treatment
  },
]

export function ProjectsPreview() {
  return (
    <section
      id="projects-preview"
      aria-labelledby="projects-heading"
      className="py-32 border-t border-border"
    >
      <div className="max-w-container mx-auto px-6">
        <SectionReveal>
          <div className="mb-16">
            <p className="label-text mb-6">Projects</p>
            <h2
              id="projects-heading"
              className="font-serif text-4xl md:text-5xl font-bold text-foreground text-balance max-w-lg"
            >
              Selected work.
            </h2>
          </div>
        </SectionReveal>

        <div className="grid sm:grid-cols-2 gap-6">
          {projects.map((project, i) => (
            <SectionReveal key={i} delay={0.08 * i}>
              {project.href ? (
                /* Real card — clickable */
                <Link
                  href={project.href}
                  className="group block border border-border rounded-lg p-8 bg-surface hover:border-muted-foreground/50 hover:bg-surface-hover transition-colors h-full flex flex-col justify-between min-h-[200px]"
                >
                  <div>
                    <p className="label-text mb-4">{project.label}</p>
                    <h3 className="font-serif text-xl font-semibold text-foreground group-hover:text-muted-foreground transition-colors mb-3">
                      {project.title}
                    </h3>
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
              ) : (
                /* In-progress card — not clickable, dashed border */
                <div className="border border-dashed border-border rounded-lg p-8 h-full flex flex-col justify-between min-h-[200px]">
                  <div>
                    <p className="label-text mb-4">{project.label}</p>
                    <h3 className="font-serif text-xl font-semibold text-foreground mb-3">
                      {project.title}
                    </h3>
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
    </section>
  )
}

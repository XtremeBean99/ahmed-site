import { SectionReveal } from '@/components/ui/SectionReveal'

const placeholderProjects = [
  { label: 'Software', title: 'In Development', description: 'An applied project bringing together law and software. I will publish it here once it is ready to share.' },
  { label: 'Research', title: 'In Development', description: 'Empirical and doctrinal work on AI governance. I will share it here as it develops.' },
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
              Work in progress.
            </h2>
          </div>
        </SectionReveal>

        <div className="grid sm:grid-cols-2 gap-6">
          {placeholderProjects.map((project, i) => (
            <SectionReveal key={i} delay={0.08 * i}>
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
                <span className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted label-text">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse inline-block" />
                  Coming soon
                </span>
              </div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  )
}

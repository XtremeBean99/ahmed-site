import { SectionReveal } from '@/components/ui/SectionReveal'

const skillGroups = [
  {
    category: 'Programming',
    skills: ['Python', 'TypeScript', 'JavaScript', 'Java', 'SQL', 'Bash'],
  },
  {
    category: 'Web & Frameworks',
    skills: ['React', 'Next.js', 'Node.js', 'REST APIs', 'PostgreSQL', 'Prisma'],
  },
  {
    category: 'Security & Infrastructure',
    skills: ['Linux', 'Git', 'Docker', 'OWASP Top 10', 'Networking basics'],
  },
  {
    category: 'Legal',
    skills: ['Contract Law', 'Administrative Law', 'Constitutional Law', 'Legal Research', 'Statutory Interpretation'],
  },
]

export function Skills() {
  return (
    <section id="skills" aria-labelledby="skills-heading" className="py-32 border-t border-border">
      <div className="max-w-container mx-auto px-6">
        <SectionReveal>
          <p className="label-text mb-6">Skills</p>
          <h2
            id="skills-heading"
            className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-16 text-balance max-w-lg"
          >
            Technical &amp; legal capability.
          </h2>
        </SectionReveal>

        <div className="grid sm:grid-cols-2 gap-8">
          {skillGroups.map((group, i) => (
            <SectionReveal key={group.category} delay={0.06 * i}>
              <div className="border border-border rounded-lg p-7">
                <p className="label-text mb-5">{group.category}</p>
                <ul className="flex flex-wrap gap-2" role="list">
                  {group.skills.map((skill) => (
                    <li
                      key={skill}
                      className="text-sm text-muted-foreground border border-border-subtle rounded-md px-3 py-1.5 bg-surface hover:border-border hover:text-foreground transition-colors"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
              </div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  )
}

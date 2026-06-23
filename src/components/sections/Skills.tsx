import { SectionReveal } from '@/components/ui/SectionReveal'
import { getDictionary } from '@/lib/i18n/server'

export async function Skills() {
  const t = (await getDictionary()).skills

  // Technical items are proper nouns and stay identical across locales; only the
  // group titles and the Legal items are translated.
  const skillGroups = [
    { category: t.programming, skills: ['Python', 'TypeScript', 'JavaScript', 'Java', 'SQL', 'Bash'] },
    { category: t.web, skills: ['React', 'Next.js', 'Node.js', 'REST APIs', 'PostgreSQL', 'Prisma'] },
    { category: t.security, skills: ['Linux', 'Git', 'Docker', 'OWASP Top 10', 'Networking basics'] },
    { category: t.legal, skills: t.legalItems },
  ]

  return (
    <section id="skills" aria-labelledby="skills-heading" className="py-32 border-t border-border">
      <div className="max-w-container mx-auto px-6">
        <SectionReveal>
          <p className="label-text mb-6">{t.eyebrow}</p>
          <h2
            id="skills-heading"
            className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-16 text-balance max-w-lg"
          >
            {t.heading}
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

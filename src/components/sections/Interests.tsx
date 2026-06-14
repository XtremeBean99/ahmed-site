import { SectionReveal } from '@/components/ui/SectionReveal'

const interests = [
  {
    title: 'Legal Technology',
    description: 'How software is transforming legal practice, access to justice, and judicial processes.',
  },
  {
    title: 'Software Engineering',
    description: 'Building systems that are reliable and easy to reason about, with care taken over correctness and clarity.',
  },
  {
    title: 'Cybersecurity',
    description: 'Technical security, vulnerability research, and the intersection of security with law.',
  },
  {
    title: 'Artificial Intelligence',
    description: 'Machine learning systems, their limitations, and the emerging legal frameworks around them.',
  },
  {
    title: 'Privacy & Data',
    description: 'Data protection law, surveillance, and the technical architecture of privacy.',
  },
  {
    title: 'Digital Governance',
    description: 'Regulatory approaches to platform power, algorithmic accountability, and digital markets.',
  },
  {
    title: 'Technology Policy',
    description: 'How governments legislate technology, and whether the rules we already have are fit for it.',
  },
  {
    title: 'Research',
    description: 'Empirical and doctrinal legal research at the intersection of law and technical systems.',
  },
  {
    title: 'Emerging Technologies',
    description: 'Blockchain, biometrics, autonomous systems, and their legal implications.',
  },
]

export function Interests() {
  return (
    <section
      id="interests"
      aria-labelledby="interests-heading"
      className="py-32 border-t border-border"
    >
      <div className="max-w-container mx-auto px-6">
        <SectionReveal>
          <p className="label-text mb-6">Professional Interests</p>
          <h2
            id="interests-heading"
            className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-16 text-balance max-w-lg"
          >
            Areas of focus.
          </h2>
        </SectionReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border">
          {interests.map((interest, i) => (
            <SectionReveal key={interest.title} delay={0.04 * i}>
              <div className="bg-background p-8 h-full hover:bg-surface transition-colors">
                <h3 className="font-serif text-lg font-semibold text-foreground mb-3">
                  {interest.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {interest.description}
                </p>
              </div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  )
}

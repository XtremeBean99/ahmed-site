import { SectionReveal } from '@/components/ui/SectionReveal'
import { getDictionary } from '@/lib/i18n/server'

export async function Interests() {
  const t = (await getDictionary()).interests

  return (
    <section
      id="interests"
      aria-labelledby="interests-heading"
      className="py-32 border-t border-border"
    >
      <div className="max-w-container mx-auto px-6">
        <SectionReveal>
          <p className="label-text mb-6">{t.eyebrow}</p>
          <h2
            id="interests-heading"
            className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-16 text-balance max-w-lg"
          >
            {t.heading}
          </h2>
        </SectionReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border">
          {t.cards.map((interest, i) => (
            <SectionReveal key={interest.title} delay={0.04 * i}>
              <div className="bg-background p-8 h-full hover:bg-surface transition-colors">
                <h3 className="font-serif text-lg font-semibold text-foreground mb-3">
                  {interest.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {interest.desc}
                </p>
              </div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  )
}

import { SectionReveal } from '@/components/ui/SectionReveal'
import { ParallaxImage } from '@/components/ui/ParallaxImage'
import { getDictionary } from '@/lib/i18n/server'

export async function About() {
  const t = (await getDictionary()).about

  return (
    <section id="about" aria-labelledby="about-heading" className="py-32 border-t border-border">
      <div className="max-w-container mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-center">

          {/* Text */}
          <div>
            <SectionReveal>
              <p className="label-text mb-6">{t.eyebrow}</p>
              <h2
                id="about-heading"
                className="font-serif text-4xl md:text-5xl font-bold text-foreground leading-tight mb-8 text-balance"
              >
                {t.headingLine1}
                <br />
                {t.headingLine2}
              </h2>
            </SectionReveal>

            <SectionReveal delay={0.1}>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                {t.p1}
              </p>
            </SectionReveal>

            <SectionReveal delay={0.2}>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                {t.p2}
              </p>
            </SectionReveal>

            <SectionReveal delay={0.25}>
              <p className="text-muted-foreground text-lg leading-relaxed">
                {t.p3}
              </p>
            </SectionReveal>
          </div>

          {/* Image */}
          <SectionReveal delay={0.15} className="hidden md:block">
            <ParallaxImage
              src="/lawyer.jpg"
              alt={t.imageAlt}
              className="h-[520px] rounded-lg"
            />
          </SectionReveal>

        </div>
      </div>
    </section>
  )
}

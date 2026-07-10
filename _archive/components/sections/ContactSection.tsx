import { SectionReveal } from '@/components/ui/SectionReveal'
import { ContactForm } from '@/components/ui/ContactForm'
import { getDictionary } from '@/lib/i18n/server'

export async function ContactSection() {
  const t = (await getDictionary()).contact

  return (
    <section id="contact" aria-labelledby="contact-heading" className="py-32 border-t border-border">
      <div className="max-w-container mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 md:gap-24">

          {/* Heading column */}
          <div>
            <SectionReveal>
              <p className="label-text mb-6">{t.eyebrow}</p>
              <h2
                id="contact-heading"
                className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-6 text-balance"
              >
                {t.heading}
              </h2>
            </SectionReveal>
            <SectionReveal delay={0.1}>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                {t.intro}
              </p>
              <ul className="space-y-3 text-sm text-muted-foreground" role="list">
                <li className="flex items-center gap-3">
                  <span className="text-muted">●</span>
                  {t.bullet1}
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-muted">●</span>
                  {t.bullet2}
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-muted">●</span>
                  {t.bullet3}
                </li>
              </ul>
              <p className="text-sm text-muted-foreground mt-8">
                {t.emailPromptBefore}
                <a
                  href="mailto:ahmedyhussain07@gmail.com"
                  className="text-foreground underline underline-offset-2 hover:no-underline"
                >
                  ahmedyhussain07@gmail.com
                </a>
                {t.emailPromptAfter}
              </p>
            </SectionReveal>
          </div>

          {/* Form column */}
          <SectionReveal delay={0.15}>
            <ContactForm />
          </SectionReveal>

        </div>
      </div>
    </section>
  )
}

import { SectionReveal } from '@/components/ui/SectionReveal'
import { ContactForm } from '@/components/ui/ContactForm'

export function ContactSection() {
  return (
    <section id="contact" aria-labelledby="contact-heading" className="py-32 border-t border-border">
      <div className="max-w-container mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 md:gap-24">

          {/* Heading column */}
          <div>
            <SectionReveal>
              <p className="label-text mb-6">Contact</p>
              <h2
                id="contact-heading"
                className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-6 text-balance"
              >
                Let&rsquo;s talk.
              </h2>
            </SectionReveal>
            <SectionReveal delay={0.1}>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                Whether you have a question about tutoring, want to discuss legal technology, or simply
                want to connect — I am happy to hear from you.
              </p>
              <ul className="space-y-3 text-sm text-muted-foreground" role="list">
                <li className="flex items-center gap-3">
                  <span className="text-muted">●</span>
                  Tutoring enquiries (Years 7–12)
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-muted">●</span>
                  Professional introductions
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-muted">●</span>
                  Research or academic collaboration
                </li>
              </ul>
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

import type { Metadata } from 'next'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { getDictionary } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms of Use for ahmedyhussain.com',
  alternates: { canonical: 'https://ahmedyhussain.com/legal/terms' },
  robots: { index: false },
}

export default async function TermsPage() {
  const dict = await getDictionary()
  const t = dict.legal.terms

  return (
    <div className="pt-32 pb-24">
      <div className="max-w-prose mx-auto px-6">
        <SectionReveal>
          <p className="label-text mb-6">{dict.legal.eyebrow}</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">
            {t.title}
          </h1>
          <p className="text-muted-foreground text-sm mb-16">
            {dict.legal.effectiveDate}: {t.date}
          </p>
        </SectionReveal>

        <div className="prose prose-invert prose-zinc max-w-none space-y-8 text-muted-foreground leading-relaxed">

          <SectionReveal delay={0.06}>
            <section aria-labelledby="terms-acceptance">
              <h2 id="terms-acceptance" className="font-serif text-xl font-semibold text-foreground mb-3">
                {t.s1h}
              </h2>
              <p>{t.s1b}</p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.08}>
            <section aria-labelledby="terms-ip">
              <h2 id="terms-ip" className="font-serif text-xl font-semibold text-foreground mb-3">
                {t.s2h}
              </h2>
              <p>{t.s2b1}</p>
              <p className="mt-4">{t.s2b2}</p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.1}>
            <section aria-labelledby="terms-prohibited">
              <h2 id="terms-prohibited" className="font-serif text-xl font-semibold text-foreground mb-3">
                {t.s3h}
              </h2>
              <p>{t.s3intro}</p>
              <ul className="mt-3 space-y-2 list-disc list-inside">
                {t.s3items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.12}>
            <section aria-labelledby="terms-ai">
              <h2 id="terms-ai" className="font-serif text-xl font-semibold text-foreground mb-3">
                {t.s4h}
              </h2>
              <p>{t.s4p1}</p>
              <p className="mt-4">{t.s4p2}</p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.14}>
            <section aria-labelledby="terms-accuracy">
              <h2 id="terms-accuracy" className="font-serif text-xl font-semibold text-foreground mb-3">
                {t.s5h}
              </h2>
              <p>{t.s5b}</p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.16}>
            <section aria-labelledby="terms-liability">
              <h2 id="terms-liability" className="font-serif text-xl font-semibold text-foreground mb-3">
                {t.s6h}
              </h2>
              <p>{t.s6b}</p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.18}>
            <section aria-labelledby="terms-governing">
              <h2 id="terms-governing" className="font-serif text-xl font-semibold text-foreground mb-3">
                {t.s7h}
              </h2>
              <p>{t.s7b}</p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.2}>
            <section aria-labelledby="terms-contact">
              <h2 id="terms-contact" className="font-serif text-xl font-semibold text-foreground mb-3">
                {t.s8h}
              </h2>
              <p>{t.s8b}</p>
            </section>
          </SectionReveal>

        </div>
      </div>
    </div>
  )
}

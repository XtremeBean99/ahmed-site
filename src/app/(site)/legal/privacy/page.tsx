import type { Metadata } from 'next'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { getDictionary } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for ahmedyhussain.com',
  alternates: { canonical: 'https://ahmedyhussain.com/legal/privacy' },
  robots: { index: false },
}

export default async function PrivacyPage() {
  const dict = await getDictionary()
  const t = dict.legal.privacy

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

        <div className="space-y-8 text-muted-foreground leading-relaxed">

          <SectionReveal delay={0.06}>
            <section aria-labelledby="privacy-overview">
              <h2 id="privacy-overview" className="font-serif text-xl font-semibold text-foreground mb-3">
                {t.s1h}
              </h2>
              <p>{t.s1b}</p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.08}>
            <section aria-labelledby="privacy-collected">
              <h2 id="privacy-collected" className="font-serif text-xl font-semibold text-foreground mb-3">
                {t.s2h}
              </h2>
              <p>{t.s2intro}</p>
              <ul className="mt-3 space-y-2 list-disc list-inside">
                {t.s2items.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <p className="mt-4">{t.s2after}</p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.1}>
            <section aria-labelledby="privacy-use">
              <h2 id="privacy-use" className="font-serif text-xl font-semibold text-foreground mb-3">
                {t.s3h}
              </h2>
              <p>{t.s3intro}</p>
              <ul className="mt-3 space-y-2 list-disc list-inside">
                {t.s3items.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <p className="mt-4">{t.s3after}</p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.12}>
            <section aria-labelledby="privacy-storage">
              <h2 id="privacy-storage" className="font-serif text-xl font-semibold text-foreground mb-3">
                {t.s4h}
              </h2>
              <p>{t.s4p1}</p>
              <p className="mt-4">{t.s4p2}</p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.14}>
            <section aria-labelledby="privacy-retention">
              <h2 id="privacy-retention" className="font-serif text-xl font-semibold text-foreground mb-3">
                {t.s5h}
              </h2>
              <p>{t.s5b}</p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.16}>
            <section aria-labelledby="privacy-cookies">
              <h2 id="privacy-cookies" className="font-serif text-xl font-semibold text-foreground mb-3">
                {t.s6h}
              </h2>
              <p>{t.s6p1}</p>
              <p className="mt-4">{t.s6p2}</p>
              <p className="mt-4">{t.s6p3}</p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.18}>
            <section aria-labelledby="privacy-rights">
              <h2 id="privacy-rights" className="font-serif text-xl font-semibold text-foreground mb-3">
                {t.s7h}
              </h2>
              <p>{t.s7b}</p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.2}>
            <section aria-labelledby="privacy-contact">
              <h2 id="privacy-contact" className="font-serif text-xl font-semibold text-foreground mb-3">
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

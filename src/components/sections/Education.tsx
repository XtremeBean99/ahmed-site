import { SectionReveal } from '@/components/ui/SectionReveal'
import { getDictionary } from '@/lib/i18n/server'

export async function Education() {
  const t = (await getDictionary()).education

  return (
    <section
      id="education"
      aria-labelledby="education-heading"
      className="py-32 border-t border-border"
    >
      <div className="max-w-container mx-auto px-6">
        <SectionReveal>
          <p className="label-text mb-6">{t.eyebrow}</p>
          <h2
            id="education-heading"
            className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-16 text-balance max-w-lg"
          >
            {t.heading}
          </h2>
        </SectionReveal>

        <SectionReveal delay={0.1}>
          <div className="border border-border rounded-lg overflow-hidden">
            {/* University header */}
            <div className="px-8 py-6 border-b border-border bg-surface flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-serif text-xl font-semibold text-foreground">
                  {t.university}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{t.location}</p>
              </div>
              <span className="inline-flex items-center gap-2 text-xs label-text border border-border rounded-full px-3 py-1 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 inline-block" />
                {t.status}
              </span>
            </div>

            {/* Degrees */}
            <div className="divide-y divide-border">
              <div className="px-8 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-foreground font-medium">{t.degree1}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t.degree1desc}
                  </p>
                </div>
                <p className="text-xs text-muted shrink-0">BCom</p>
              </div>
              <div className="px-8 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-foreground font-medium">
                    {t.degree2} <span className="text-muted-foreground">{t.honours}</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t.degree2desc}
                  </p>
                </div>
                <p className="text-xs text-muted shrink-0">LLB(Hons)</p>
              </div>
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  )
}

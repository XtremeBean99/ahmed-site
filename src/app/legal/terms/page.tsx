import type { Metadata } from 'next'
import { SectionReveal } from '@/components/ui/SectionReveal'

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms of Use for ahmedyhussain.com',
  alternates: { canonical: 'https://ahmedyhussain.com/legal/terms' },
  robots: { index: false },
}

const EFFECTIVE = '14 June 2026'

export default function TermsPage() {
  return (
    <div className="pt-32 pb-24">
      <div className="max-w-prose mx-auto px-6">
        <SectionReveal>
          <p className="label-text mb-6">Legal</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">
            Terms of Use
          </h1>
          <p className="text-muted-foreground text-sm mb-16">Effective: {EFFECTIVE}</p>
        </SectionReveal>

        <div className="prose prose-invert prose-zinc max-w-none space-y-8 text-muted-foreground leading-relaxed">

          <SectionReveal delay={0.06}>
            <section aria-labelledby="terms-acceptance">
              <h2 id="terms-acceptance" className="font-serif text-xl font-semibold text-foreground mb-3">
                1. Acceptance
              </h2>
              <p>
                By accessing or using ahmedyhussain.com (the &ldquo;Site&rdquo;), you agree to be
                bound by these Terms of Use. If you do not agree, do not use the Site.
              </p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.08}>
            <section aria-labelledby="terms-ip">
              <h2 id="terms-ip" className="font-serif text-xl font-semibold text-foreground mb-3">
                2. Intellectual Property
              </h2>
              <p>
                All content on this Site, including but not limited to text, design, layout,
                graphics, and code, is the intellectual property of Ahmed Hussain and is protected
                by Australian and international copyright law.
              </p>
              <p className="mt-4">
                Copyright &copy; Ahmed Hussain. All rights reserved.
              </p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.1}>
            <section aria-labelledby="terms-prohibited">
              <h2 id="terms-prohibited" className="font-serif text-xl font-semibold text-foreground mb-3">
                3. Prohibited Uses
              </h2>
              <p>You expressly agree that you will not, without prior written permission:</p>
              <ul className="mt-3 space-y-2 list-disc list-inside">
                <li>Scrape, crawl, or otherwise automatically extract content from this Site</li>
                <li>
                  Use any content from this Site to train, fine-tune, or otherwise develop artificial
                  intelligence or machine learning models
                </li>
                <li>
                  Ingest any content into vector databases, embedding stores, or similar retrieval
                  systems for AI purposes
                </li>
                <li>Reproduce, redistribute, or republish content without attribution and permission</li>
                <li>Create derivative works based on content from this Site</li>
                <li>
                  Use this Site in any manner that could interfere with its operation or impose an
                  unreasonable load on its infrastructure
                </li>
              </ul>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.12}>
            <section aria-labelledby="terms-ai">
              <h2 id="terms-ai" className="font-serif text-xl font-semibold text-foreground mb-3">
                4. AI and Automated Systems
              </h2>
              <p>
                All content on this Site is copyrighted and may not be reproduced, redistributed,
                scraped, indexed for AI training, used in machine learning datasets, or incorporated
                into generative AI systems without prior written permission from Ahmed Hussain.
              </p>
              <p className="mt-4">
                Operators of AI crawlers and large language model training pipelines are on notice
                that access to this Site for the purpose of data collection is prohibited. This
                prohibition is reflected in the Site&rsquo;s robots.txt file and HTTP response
                headers.
              </p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.14}>
            <section aria-labelledby="terms-accuracy">
              <h2 id="terms-accuracy" className="font-serif text-xl font-semibold text-foreground mb-3">
                5. Accuracy of Information
              </h2>
              <p>
                Content on this Site is provided for informational purposes only and does not
                constitute legal advice. While I make reasonable efforts to ensure accuracy, I make
                no representations as to the completeness or currency of information provided.
              </p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.16}>
            <section aria-labelledby="terms-liability">
              <h2 id="terms-liability" className="font-serif text-xl font-semibold text-foreground mb-3">
                6. Limitation of Liability
              </h2>
              <p>
                To the extent permitted by law, Ahmed Hussain excludes all liability for loss or
                damage of any kind arising from your use of this Site or reliance on its content.
              </p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.18}>
            <section aria-labelledby="terms-governing">
              <h2 id="terms-governing" className="font-serif text-xl font-semibold text-foreground mb-3">
                7. Governing Law
              </h2>
              <p>
                These Terms are governed by the laws of the Australian Capital Territory, Australia.
                Any dispute arising from these Terms will be subject to the jurisdiction of the
                courts of the ACT.
              </p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.2}>
            <section aria-labelledby="terms-contact">
              <h2 id="terms-contact" className="font-serif text-xl font-semibold text-foreground mb-3">
                8. Contact
              </h2>
              <p>
                For permissions or queries regarding these Terms, contact:{' '}
                <a
                  href="mailto:ahmedyhussain07@gmail.com"
                  className="text-foreground underline underline-offset-2 hover:no-underline"
                >
                  ahmedyhussain07@gmail.com
                </a>
              </p>
            </section>
          </SectionReveal>

        </div>
      </div>
    </div>
  )
}

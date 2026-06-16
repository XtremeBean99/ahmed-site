import type { Metadata } from 'next'
import { SectionReveal } from '@/components/ui/SectionReveal'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for ahmedyhussain.com',
  alternates: { canonical: 'https://ahmedyhussain.com/legal/privacy' },
  robots: { index: false },
}

const EFFECTIVE = '16 June 2026'

export default function PrivacyPage() {
  return (
    <div className="pt-32 pb-24">
      <div className="max-w-prose mx-auto px-6">
        <SectionReveal>
          <p className="label-text mb-6">Legal</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground text-sm mb-16">Effective: {EFFECTIVE}</p>
        </SectionReveal>

        <div className="space-y-8 text-muted-foreground leading-relaxed">

          <SectionReveal delay={0.06}>
            <section aria-labelledby="privacy-overview">
              <h2 id="privacy-overview" className="font-serif text-xl font-semibold text-foreground mb-3">
                1. Overview
              </h2>
              <p>
                This Privacy Policy explains how ahmedyhussain.com (&ldquo;Site&rdquo;) collects,
                uses, and stores personal information. I am committed to handling your data
                responsibly and in accordance with the Australian Privacy Act 1988 (Cth) and
                applicable Australian Privacy Principles.
              </p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.08}>
            <section aria-labelledby="privacy-collected">
              <h2 id="privacy-collected" className="font-serif text-xl font-semibold text-foreground mb-3">
                2. Information Collected
              </h2>
              <p>
                When you submit the contact form on this Site, I collect:
              </p>
              <ul className="mt-3 space-y-2 list-disc list-inside">
                <li>Your name</li>
                <li>Your email address</li>
                <li>The subject and content of your message</li>
              </ul>
              <p className="mt-4">
                I do not collect or log your IP address, and the contact form does not set
                cookies or tracking identifiers.
              </p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.1}>
            <section aria-labelledby="privacy-use">
              <h2 id="privacy-use" className="font-serif text-xl font-semibold text-foreground mb-3">
                3. How Information Is Used
              </h2>
              <p>Information you submit is used solely to:</p>
              <ul className="mt-3 space-y-2 list-disc list-inside">
                <li>Respond to your enquiry or message</li>
              </ul>
              <p className="mt-4">
                The contact form is protected from automated spam by a hidden honeypot field
                rather than by collecting any data about you. Your data is never sold, shared with
                third parties for marketing, or used for any purpose beyond responding to your
                contact.
              </p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.12}>
            <section aria-labelledby="privacy-storage">
              <h2 id="privacy-storage" className="font-serif text-xl font-semibold text-foreground mb-3">
                4. Data Storage and Security
              </h2>
              <p>
                This Site has no database. Contact form submissions are delivered to me by email
                through Resend (resend.com) and are not stored on the Site itself. Email is
                transmitted using TLS encryption.
              </p>
              <p className="mt-4">
                Reasonable technical and organisational security measures are in place to protect
                your data from unauthorised access or disclosure.
              </p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.14}>
            <section aria-labelledby="privacy-retention">
              <h2 id="privacy-retention" className="font-serif text-xl font-semibold text-foreground mb-3">
                5. Retention
              </h2>
              <p>
                Because submissions are sent by email and not stored on the Site, retention is
                limited to my email records, kept only as long as necessary to respond to your
                enquiry and for reasonable record-keeping purposes. You may request deletion of
                your data at any time.
              </p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.16}>
            <section aria-labelledby="privacy-cookies">
              <h2 id="privacy-cookies" className="font-serif text-xl font-semibold text-foreground mb-3">
                6. Cookies, Analytics and Local Storage
              </h2>
              <p>
                This Site does not use tracking cookies, advertising pixels, or social media
                tracking scripts.
              </p>
              <p className="mt-4">
                The Site uses Vercel Speed Insights to measure anonymous, aggregated performance
                metrics such as page load times. It does not use cookies and does not identify you.
              </p>
              <p className="mt-4">
                The games in the Games section save your best score in your browser using local
                storage. That information stays on your device, is never transmitted to me or any
                third party, and you can clear it at any time through your browser settings.
              </p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.18}>
            <section aria-labelledby="privacy-rights">
              <h2 id="privacy-rights" className="font-serif text-xl font-semibold text-foreground mb-3">
                7. Your Rights
              </h2>
              <p>
                Under the Australian Privacy Principles, you have the right to access, correct, or
                request deletion of personal information held about you. To exercise these rights,
                contact me at the address below.
              </p>
            </section>
          </SectionReveal>

          <SectionReveal delay={0.2}>
            <section aria-labelledby="privacy-contact">
              <h2 id="privacy-contact" className="font-serif text-xl font-semibold text-foreground mb-3">
                8. Contact
              </h2>
              <p>
                Privacy enquiries:{' '}
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

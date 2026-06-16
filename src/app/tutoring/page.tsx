import type { Metadata } from 'next'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { ContactForm } from '@/components/ui/ContactForm'
import { JsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Tutoring',
  description:
    'Private tutoring by Ahmed Hussain in Canberra. Years 7–12. Physics, Mathematics, English, Legal Studies and more. Online $50/hr, in-person $60/hr.',
  keywords: [
    'Canberra tutor',
    'private tutor Canberra',
    'Year 11 tutor',
    'Year 12 tutor',
    'physics tutor Canberra',
    'maths tutor Canberra',
    'legal studies tutor',
    'ACT BSSS tutoring',
    'ANU tutoring',
  ],
  alternates: { canonical: 'https://ahmedyhussain.com/tutoring' },
}

const year1112 = [
  { subject: 'Physics', note: 'ACT BSSS curriculum' },
  { subject: 'Mathematics', note: 'Methods & Specialist' },
  { subject: 'English', note: 'Literature & Language' },
  { subject: 'Legal Studies', note: 'ACT BSSS curriculum' },
]

const year710 = [
  'Mathematics', 'English', 'History', 'Geography',
  'Legal Studies', 'Commerce', 'Business', 'Economics',
]

const faqs = [
  {
    q: 'Where do sessions take place?',
    a: 'Sessions are available online via video call, at the Australian National University campus, or at a Canberra location arranged in advance.',
  },
  {
    q: 'How long is each session?',
    a: 'Sessions are typically one hour. Longer sessions can be arranged on request.',
  },
  {
    q: 'What year levels do you tutor?',
    a: 'Years 7–10 for most non-science subjects, and Years 11–12 for Physics, Mathematics, English, and Legal Studies in line with the ACT BSSS curriculum.',
  },
  {
    q: 'Do you offer trial sessions?',
    a: 'Please get in touch to discuss your requirements. I am happy to discuss how I can best support your learning before committing.',
  },
  {
    q: 'How do I book a session?',
    a: 'Use the contact form below or email me directly. I will respond within one business day to arrange a suitable time.',
  },
]

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  serviceType: 'Private tutoring',
  provider: { '@type': 'Person', name: 'Ahmed Hussain' },
  areaServed: { '@type': 'City', name: 'Canberra' },
  description:
    'Private tutoring for Years 7–12: Physics, Mathematics, English and Legal Studies, online or in person.',
  offers: [
    {
      '@type': 'Offer',
      name: 'Online session',
      price: '50',
      priceCurrency: 'AUD',
      unitText: 'hour',
    },
    {
      '@type': 'Offer',
      name: 'In-person session',
      price: '60',
      priceCurrency: 'AUD',
      unitText: 'hour',
    },
  ],
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
}

export default function TutoringPage() {
  return (
    <div className="pt-32 pb-24">
      <JsonLd data={serviceSchema} />
      <JsonLd data={faqSchema} />
      <div className="max-w-container mx-auto px-6">

        {/* Header */}
        <SectionReveal>
          <p className="label-text mb-6">Tutoring</p>
          <h1 className="font-serif text-5xl md:text-6xl font-bold text-foreground leading-tight mb-6 text-balance max-w-2xl">
            Private tutoring,<br />Canberra.
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mb-4">
            I offer one-on-one tutoring for secondary school students in Canberra. My approach
            puts understanding ahead of memorisation. The aim is to build the kind of structured thinking that
            holds up in exams and well after them.
          </p>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mb-16">
            Sessions are available online and in person at the ANU campus or nearby locations.
          </p>
        </SectionReveal>

        {/* Services */}
        <SectionReveal delay={0.08}>
          <div className="grid md:grid-cols-2 gap-8 mb-24">

            {/* Years 11–12 */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-7 py-5 border-b border-border bg-surface">
                <p className="label-text mb-1">Senior secondary</p>
                <h2 className="font-serif text-2xl font-bold text-foreground">Years 11–12</h2>
              </div>
              <ul className="divide-y divide-border" role="list">
                {year1112.map(({ subject, note }) => (
                  <li key={subject} className="px-7 py-4 flex items-center justify-between">
                    <span className="text-foreground font-medium">{subject}</span>
                    <span className="text-xs text-muted-foreground">{note}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Years 7–10 */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-7 py-5 border-b border-border bg-surface">
                <p className="label-text mb-1">Middle secondary</p>
                <h2 className="font-serif text-2xl font-bold text-foreground">Years 7–10</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  All non-science subjects available
                </p>
              </div>
              <div className="px-7 py-6">
                <ul className="flex flex-wrap gap-2" role="list">
                  {year710.map((s) => (
                    <li
                      key={s}
                      className="text-sm text-muted-foreground border border-border-subtle rounded-md px-3 py-1.5 bg-surface"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>
        </SectionReveal>

        {/* Pricing */}
        <SectionReveal delay={0.1}>
          <div className="mb-24">
            <p className="label-text mb-8">Pricing</p>
            <div className="grid sm:grid-cols-2 gap-6 max-w-2xl">
              <div className="border border-border rounded-lg p-8">
                <p className="label-text mb-4">Online</p>
                <p className="font-serif text-5xl font-bold text-foreground mb-2">$50</p>
                <p className="text-muted-foreground text-sm">per hour</p>
                <ul className="mt-6 space-y-2 text-sm text-muted-foreground" role="list">
                  <li>Via video call</li>
                  <li>Flexible scheduling</li>
                  <li>Screen sharing for worked examples</li>
                </ul>
              </div>
              <div className="border border-border rounded-lg p-8">
                <p className="label-text mb-4">In Person</p>
                <p className="font-serif text-5xl font-bold text-foreground mb-2">$60</p>
                <p className="text-muted-foreground text-sm">per hour</p>
                <ul className="mt-6 space-y-2 text-sm text-muted-foreground" role="list">
                  <li>ANU campus</li>
                  <li>Canberra by arrangement</li>
                  <li>Printed materials available</li>
                </ul>
              </div>
            </div>
          </div>
        </SectionReveal>

        {/* FAQ */}
        <SectionReveal delay={0.1}>
          <div className="mb-24">
            <p className="label-text mb-8">FAQ</p>
            <div className="border border-border rounded-lg divide-y divide-border max-w-2xl">
              {faqs.map(({ q, a }) => (
                <details key={q} className="group">
                  <summary className="flex items-center justify-between px-7 py-5 cursor-pointer list-none text-foreground font-medium hover:bg-surface transition-colors">
                    {q}
                    <svg
                      className="shrink-0 ml-4 transition-transform group-open:rotate-45 text-muted-foreground"
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden
                    >
                      <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                    </svg>
                  </summary>
                  <p className="px-7 pb-5 text-muted-foreground text-sm leading-relaxed">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </SectionReveal>

        {/* Contact */}
        <SectionReveal delay={0.1}>
          <div className="grid md:grid-cols-2 gap-16">
            <div>
              <p className="label-text mb-6">Enquire</p>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4 text-balance">
                Book a session.
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Use this form to enquire about tutoring. Include your year level and the subjects you
                need help with, and I will get back to you within one business day.
              </p>
            </div>
            <ContactForm defaultSubject="Tutoring enquiry" />
          </div>
        </SectionReveal>

      </div>
    </div>
  )
}

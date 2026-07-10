import type { Metadata } from 'next'
import { Hero } from '@/components/sections/Hero'
import { About } from '@/components/sections/About'
import { Interests } from '@/components/sections/Interests'
import { Education } from '@/components/sections/Education'
import { Skills } from '@/components/sections/Skills'
import { ContactSection } from '@/components/sections/ContactSection'
import { JsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Ahmed Hussain · Law, Computing & Technology',
  description:
    'Personal website of Ahmed Hussain, a BCom / LLB(Hons) candidate at ANU in Canberra, working where law meets computing and the governance of artificial intelligence.',
  alternates: { canonical: 'https://ahmedyhussain.com/home' },
}

const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Ahmed Hussain',
  url: 'https://ahmedyhussain.com',
  jobTitle: 'BCom / LLB(Hons) candidate',
  description:
    'Working where law meets computing and the governance of artificial intelligence.',
  alumniOf: {
    '@type': 'CollegeOrUniversity',
    name: 'Australian National University',
  },
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Canberra',
    addressRegion: 'ACT',
    addressCountry: 'AU',
  },
  knowsAbout: [
    'Law',
    'Artificial intelligence governance',
    'Software engineering',
    'Cybersecurity',
  ],
  sameAs: [
    'https://www.linkedin.com/in/ahmed-hussain-0880ba25a/',
    'https://github.com/XtremeBean99',
  ],
}

export default function HomePage() {
  return (
    <>
      <JsonLd data={personSchema} />
      <Hero />
      <About />
      <Interests />
      <Education />
      <Skills />
      <ContactSection />
    </>
  )
}

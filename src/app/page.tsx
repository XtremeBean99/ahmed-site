import type { Metadata } from 'next'
import { Hero } from '@/components/sections/Hero'
import { About } from '@/components/sections/About'
import { Interests } from '@/components/sections/Interests'
import { Education } from '@/components/sections/Education'
import { Skills } from '@/components/sections/Skills'
import { ProjectsPreview } from '@/components/sections/ProjectsPreview'
import { ContactSection } from '@/components/sections/ContactSection'

export const metadata: Metadata = {
  title: 'Ahmed Hussain · Law, Computing & Technology',
  description:
    'Personal website of Ahmed Hussain, a BCom / LLB(Hons) candidate at ANU in Canberra, working where law meets computing and the governance of artificial intelligence.',
  alternates: { canonical: 'https://ahmedyhussain.com' },
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <About />
      <Interests />
      <Education />
      <Skills />
      <ProjectsPreview />
      <ContactSection />
    </>
  )
}

import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/server'
import { Room } from '@/components/room/Room'
import { JsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: "Ahmed's Room",
  description:
    'Step into my digital room — a cosy pixel-art space and the front door to my personal website.',
  alternates: { canonical: 'https://ahmedyhussain.com' },
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

export default async function RoomPage() {
  const dict = await getDictionary()

  return (
    <>
      <JsonLd data={personSchema} />
      <Room
        dict={{
          room: dict.room,
        }}
      />
    </>
  )
}

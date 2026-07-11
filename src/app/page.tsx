import type { Metadata } from 'next'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getDictionary } from '@/lib/i18n/server'
import { Room } from '@/components/room/Room'
import { RoomSfxProvider } from '@/components/room/RoomSfxProvider'
import { XtremeSplash } from '@/components/room/XtremeSplash'
import { JsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: "Ahmed's Room",
  description:
    'Step into my digital room, a cosy pixel-art space and the front door to my personal website.',
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
  const readmeContent = await readFile(join(process.cwd(), 'assets', 'site-text.txt'), 'utf-8')
  return (
    <>
      <JsonLd data={personSchema} />
      <XtremeSplash>
        <RoomSfxProvider>
          <Room
            dict={{
              room: dict.room,
              desk: dict.desk,
              legal: dict.legal,
            }}
            readmeContent={readmeContent}
          />
        </RoomSfxProvider>
      </XtremeSplash>
    </>
  )
}

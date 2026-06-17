import type { Metadata } from 'next'
import { ToolShell } from '@/components/projects/ToolShell'
import { Aglc4Generator } from '@/components/projects/Aglc4Generator'
import { JsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'AGLC4 citation generator',
  description:
    'Generate footnote and bibliography citations in the Australian Guide to Legal Citation (4th ed) style: cases, legislation, journal articles, books, web pages and Hansard.',
  alternates: { canonical: 'https://ahmedyhussain.com/projects/aglc4' },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AGLC4 citation generator',
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Web',
  description:
    'Generate AGLC4 footnote and bibliography citations for cases, legislation, journal articles, books, web pages and Hansard.',
  url: 'https://ahmedyhussain.com/projects/aglc4',
  author: { '@type': 'Person', name: 'Ahmed Hussain' },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'AUD' },
}

export default function Aglc4Page() {
  return (
    <>
      <JsonLd data={schema} />
      <ToolShell
        eyebrow="Legal tool"
        title="AGLC4 citation generator"
        intro="Build footnote and bibliography citations in the Australian Guide to Legal Citation (4th ed) style. Choose a source type, fill in the fields, and the citation updates as you type — ready to copy into your essay or memo."
      >
        <Aglc4Generator />
      </ToolShell>
    </>
  )
}

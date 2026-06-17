import type { Metadata } from 'next'
import { ToolShell } from '@/components/projects/ToolShell'
import { BaseConverter } from '@/components/projects/BaseConverter'
import { JsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Base converter',
  description:
    'Live converter between decimal, binary, hexadecimal, octal and UTF-8 text, with a bitwise playground (AND, OR, XOR, NOT, shifts). Arbitrary-precision, runs in your browser.',
  alternates: { canonical: 'https://ahmedyhussain.com/projects/base-converter' },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Base converter',
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Web',
  description:
    'Live converter between decimal, binary, hexadecimal, octal and UTF-8 text, with a bitwise playground.',
  url: 'https://ahmedyhussain.com/projects/base-converter',
  author: { '@type': 'Person', name: 'Ahmed Hussain' },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'AUD' },
}

export default function BaseConverterPage() {
  return (
    <>
      <JsonLd data={schema} />
      <ToolShell
        eyebrow="Computing tool"
        title="Base converter"
        intro="Convert between decimal, binary, hexadecimal, octal and UTF-8 text — edit any field and the rest follow live. Then experiment with AND, OR, XOR, NOT and shifts in the bitwise playground. Everything is arbitrary-precision and runs entirely in your browser."
      >
        <BaseConverter />
      </ToolShell>
    </>
  )
}

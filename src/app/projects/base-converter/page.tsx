import type { Metadata } from 'next'
import { ToolShell } from '@/components/projects/ToolShell'
import { BaseConverter } from '@/components/projects/BaseConverter'
import { JsonLd } from '@/components/seo/JsonLd'
import { getDictionary } from '@/lib/i18n/server'

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

export default async function BaseConverterPage() {
  const t = (await getDictionary()).baseConverter
  return (
    <>
      <JsonLd data={schema} />
      <ToolShell eyebrow={t.eyebrow} title={t.heading} intro={t.intro}>
        <BaseConverter />
      </ToolShell>
    </>
  )
}

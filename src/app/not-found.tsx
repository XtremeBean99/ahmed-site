import Link from 'next/link'
import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/server'

export const metadata: Metadata = { title: '404 · Page Not Found' }

export default async function NotFound() {
  const t = (await getDictionary()).notFound
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
      <p className="label-text mb-6">{t.label}</p>
      <h1 className="font-serif text-5xl md:text-6xl font-bold text-foreground mb-6">
        {t.heading}
      </h1>
      <p className="text-muted-foreground text-lg mb-10 max-w-sm">
        {t.body}
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-foreground border border-border px-5 py-2.5 rounded-md hover:bg-surface-hover transition-colors"
      >
        {t.home}
      </Link>
    </div>
  )
}

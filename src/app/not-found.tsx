import Link from 'next/link'
import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/server'

export const metadata: Metadata = { title: '404 \u00b7 Page Not Found' }

export default async function NotFound() {
  const t = (await getDictionary()).notFound
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
      <p className="text-sm tracking-[0.2em] uppercase text-zinc-500 mb-6">{t.label}</p>
      <h1 className="text-5xl md:text-6xl font-bold text-zinc-100 mb-6">
        {t.heading}
      </h1>
      <p className="text-zinc-400 text-lg mb-10 max-w-sm">
        {t.body}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-100 border border-zinc-700 px-5 py-2.5 rounded-md hover:bg-zinc-800 transition-colors"
        >
          {t.home}
        </Link>
      </div>
    </div>
  )
}

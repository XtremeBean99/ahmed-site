import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '404 — Page Not Found' }

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
      <p className="label-text mb-6">404</p>
      <h1 className="font-serif text-5xl md:text-6xl font-bold text-foreground mb-6">
        Page not found.
      </h1>
      <p className="text-muted-foreground text-lg mb-10 max-w-sm">
        This page does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-foreground border border-border px-5 py-2.5 rounded-md hover:bg-surface-hover transition-colors"
      >
        Return home
      </Link>
    </div>
  )
}

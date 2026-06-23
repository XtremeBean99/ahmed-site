'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/client'
import { locales, LOCALE_LABELS, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'

/**
 * EN / FR switch. Writes the locale cookie and refreshes the route so server
 * components re-render in the chosen language. URLs stay the same.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { locale, t } = useI18n()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function choose(next: Locale) {
    if (next === locale) return
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`
    startTransition(() => router.refresh())
  }

  return (
    <div
      role="group"
      aria-label={t.language.label}
      className={cn(
        'inline-flex items-center rounded-md border border-border overflow-hidden text-xs',
        pending && 'opacity-60',
        className,
      )}
    >
      {locales.map((l, i) => {
        const active = l === locale
        return (
          <button
            key={l}
            type="button"
            onClick={() => choose(l)}
            aria-pressed={active}
            aria-label={l === 'en' ? t.language.en : t.language.fr}
            className={cn(
              'px-2.5 py-1 font-medium tracking-wide transition-colors',
              i > 0 && 'border-l border-border',
              active
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {LOCALE_LABELS[l]}
          </button>
        )
      })}
    </div>
  )
}

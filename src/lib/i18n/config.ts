/**
 * Locale configuration for the site.
 *
 * The site is bilingual (English + French). Locale is chosen client-side via a
 * header toggle and persisted in a cookie; server components read that cookie
 * (see ./server) so the whole tree renders in the active language. There are no
 * locale-prefixed URLs — English is the canonical URL for SEO.
 */

export const locales = ['en', 'fr'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

/** Cookie that stores the visitor's chosen locale. */
export const LOCALE_COOKIE = 'locale'

/** One year, in seconds — how long the locale cookie persists. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** Human-readable label for each locale, shown in the language toggle. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'EN',
  fr: 'FR',
}

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value)
}

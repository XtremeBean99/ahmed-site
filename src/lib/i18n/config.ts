/**
 * Locale configuration for the site. English only.
 */

export const locales = ['en'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

/** Cookie that stores the visitor's chosen locale (retained for compatibility). */
export const LOCALE_COOKIE = 'locale'
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'en'
}

import 'server-only'
import { cookies, headers } from 'next/headers'
import { defaultLocale, isLocale, locales, LOCALE_COOKIE, type Locale } from './config'
import { en, type Dictionary } from './dictionaries/en'
import { fr } from './dictionaries/fr'

const DICTIONARIES: Record<Locale, Dictionary> = { en, fr }

/** Best-effort locale from an Accept-Language header (first matching tag wins). */
function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null
  for (const part of header.split(',')) {
    const tag = part.split(';')[0].trim().toLowerCase().split('-')[0]
    if (isLocale(tag) && (locales as readonly string[]).includes(tag)) return tag
  }
  return null
}

/**
 * Resolve the active locale for the current request. An explicit choice (the
 * locale cookie, set by the language toggle) always wins; on a first visit with
 * no cookie we fall back to the browser's Accept-Language. Reading the cookie
 * opts pages into dynamic rendering - an accepted trade-off for cookie-based
 * (URL-stable) language switching.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value
  if (isLocale(value)) return value

  const accept = (await headers()).get('accept-language')
  return localeFromAcceptLanguage(accept) ?? defaultLocale
}

/** The dictionary for the current request's locale. */
export async function getDictionary(): Promise<Dictionary> {
  return DICTIONARIES[await getLocale()]
}

'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Locale } from './config'
import type { Dictionary } from './dictionaries/en'

interface I18nValue {
  locale: Locale
  t: Dictionary
}

const I18nContext = createContext<I18nValue | null>(null)

/**
 * Makes the active locale + dictionary available to client components. Fed by
 * the server layout, which reads the locale cookie. On a language switch the
 * layout re-renders (via router.refresh) and passes a new dictionary down, so
 * consumers re-render in the new language while keeping their local state.
 */
export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale
  dict: Dictionary
  children: ReactNode
}) {
  return <I18nContext.Provider value={{ locale, t: dict }}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider')
  return ctx
}

/** Convenience hook for components that only need the dictionary. */
export function useT(): Dictionary {
  return useI18n().t
}

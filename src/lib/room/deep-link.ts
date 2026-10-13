/**
 * Shareable links into the desk: `/?app=chess` lands on the desk with Chess
 * open, and the address bar follows whichever app is open so it can be
 * copied as is. The desktop and README (the landing screen) clear the param;
 * the terminal is left out on purpose, it stays a Konami-code secret.
 */
export const LINKABLE_APPS = [
  'paint', 'minesweeper', 'snake', 'blackjack', 'solitaire', 'pong', 'breakout', 'chess', 'mahjong',
  'music', 'legal', 'guestbook', 'settings', 'movie', 'typing', 'highscores', 'request',
] as const

export type LinkableApp = (typeof LINKABLE_APPS)[number]

export const APP_PARAM = 'app'

export function isLinkableApp(app: string | null | undefined): app is LinkableApp {
  return typeof app === 'string' && (LINKABLE_APPS as readonly string[]).includes(app)
}

/** The app a search string (`?app=chess&x=1`) asks for, or null. Case-insensitive. */
export function appFromSearch(search: string): LinkableApp | null {
  const app = new URLSearchParams(search).get(APP_PARAM)?.toLowerCase()
  return isLinkableApp(app) ? app : null
}

/**
 * The same URL with `app` set to `app` (or removed when `app` is not
 * linkable). Other params and the hash are kept. Takes and returns a
 * path + search + hash string, so it is safe to hand to history.replaceState.
 */
export function withApp(pathSearchHash: string, app: string | null): string {
  const url = new URL(pathSearchHash, 'http://x')
  if (isLinkableApp(app)) url.searchParams.set(APP_PARAM, app)
  else url.searchParams.delete(APP_PARAM)
  return url.pathname + url.search + url.hash
}

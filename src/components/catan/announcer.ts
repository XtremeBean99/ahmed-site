import { fill } from './event-text'

/** More than this many queued announcements collapse into one summary. */
export const ANNOUNCE_SUMMARY_THRESHOLD = 5

/**
 * Collapses a queue that has grown too long into a single summary line so the
 * aria-live region never reads a long backlog of individual events.
 */
export function collapseAnnouncements(items: readonly string[], summary: string): string[] {
  if (items.length <= ANNOUNCE_SUMMARY_THRESHOLD) return items.slice()
  return [summary]
}

/** "Bram's turn: 4 events" style summary, using the possessive subject form. */
export function makeAnnounceSummary(template: string, possessivePlayer: string, count: number): string {
  return fill(template, { player: possessivePlayer, count })
}

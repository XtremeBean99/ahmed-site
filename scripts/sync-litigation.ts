/**
 * CourtListener review helper for the AI & Cyber Litigation Tracker.
 *
 * Read-only. For every US case in the dataset that has a docket number, this
 * queries the free CourtListener API (no key required at standard rate limits)
 * and reports whether the docket has been modified since the record was last
 * reviewed. It does NOT edit the dataset; it produces a review queue for you to
 * action by hand, keeping a human in the loop before anything is published.
 *
 * Usage:
 *   npm run sync:litigation
 *
 * Docs: https://www.courtlistener.com/help/api/rest/
 */

import { litigation } from '../src/lib/litigation/data'

const DOCKETS_ENDPOINT = 'https://www.courtlistener.com/api/rest/v4/dockets/'
const USER_AGENT = 'ahmedyhussain.com litigation tracker review script (contact: ahmedyhussain07@gmail.com)'
const RATE_DELAY_MS = 1200

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface DocketResult {
  date_modified?: string
  date_filed?: string
  absolute_url?: string
}

async function lookupDocket(docketNumber: string): Promise<DocketResult | undefined> {
  const url = `${DOCKETS_ENDPOINT}?docket_number=${encodeURIComponent(docketNumber)}`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (res.status === 429) throw new Error('rate limited (429) — slow down or add an API token')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as { results?: DocketResult[] }
  return data.results?.[0]
}

async function main() {
  const targets = litigation.filter((c) => c.docket && c.jurisdiction === 'US')
  console.log(`Checking ${targets.length} US dockets against CourtListener.\n`)

  const reviewQueue: string[] = []

  for (const c of targets) {
    try {
      const r = await lookupDocket(c.docket as string)
      if (!r) {
        console.log(`?   ${(c.docket as string).padEnd(16)}  no match            ${c.caseName}`)
      } else {
        const modified = (r.date_modified ?? '').slice(0, 10) || '—'
        const hasActivity = modified !== '—' && modified > c.lastReviewed
        console.log(
          `${hasActivity ? 'NEW' : 'ok '} ${(c.docket as string).padEnd(16)}  ` +
            `modified ${modified}  reviewed ${c.lastReviewed}  ${c.caseName}`
        )
        if (hasActivity) {
          const link = r.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : c.source.url
          reviewQueue.push(`${c.caseName} (${c.docket}) — docket activity ${modified}\n    ${link}`)
        }
      }
    } catch (err) {
      console.log(`!   ${(c.docket as string).padEnd(16)}  error: ${(err as Error).message}  ${c.caseName}`)
    }
    await sleep(RATE_DELAY_MS)
  }

  console.log('\n----- Review queue -----')
  if (reviewQueue.length === 0) {
    console.log('No dockets show activity after their last review date.')
  } else {
    console.log(`${reviewQueue.length} case(s) to review:\n`)
    reviewQueue.forEach((line) => console.log('• ' + line))
    console.log('\nVerify each against its docket, update the record, and bump lastReviewed.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

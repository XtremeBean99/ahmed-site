'use client'

import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

const KEY = 'analytics-optout'

// Visit any page with ?notrack to exclude this browser; ?notrack=0 opts back in.
function optedOut(): boolean {
  try {
    const flag = new URLSearchParams(window.location.search).get('notrack')
    if (flag === '0') localStorage.removeItem(KEY)
    else if (flag !== null) localStorage.setItem(KEY, '1')
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function filter<T>(event: T): T | null {
  return optedOut() ? null : event
}

export function VercelMetrics() {
  return (
    <>
      <SpeedInsights beforeSend={filter} />
      <Analytics beforeSend={filter} />
    </>
  )
}

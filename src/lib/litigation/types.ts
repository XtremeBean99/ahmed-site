/**
 * Types for the AI & Cyber Litigation Tracker.
 *
 * Design note: relief is split into `claimed` and `awarded` deliberately. Most
 * records describe relief sought in a pleading, not adjudicated liability.
 * Never collapse the two into a single "damages" figure.
 */

export const JURISDICTIONS = ['US', 'UK', 'EU', 'AU'] as const
export type Jurisdiction = (typeof JURISDICTIONS)[number]

export const CLAIM_TYPES = [
  'Copyright',
  'Trademark',
  'Privacy',
  'Biometric',
  'Defamation',
  'Discrimination',
  'Data protection',
  'Product liability',
] as const
export type ClaimType = (typeof CLAIM_TYPES)[number]

export const CASE_STATUSES = [
  'Pending',
  'In discovery',
  'Partial ruling',
  'On appeal',
  'Settled',
  'Dismissed',
  'Judgment',
] as const
export type CaseStatus = (typeof CASE_STATUSES)[number]

export interface Relief {
  /** Relief sought, as pleaded. e.g. "Unspecified", "USD 1.5B (class)". */
  claimed?: string
  /** Relief actually ordered or agreed. null until adjudicated/settled. */
  awarded?: string | null
  note?: string
}

export interface SourceRef {
  label: string
  url: string
}

export interface Litigation {
  id: string
  caseName: string
  plaintiffs: string[]
  defendants: string[]
  court: string
  jurisdiction: Jurisdiction
  /** Docket or neutral citation, where confirmed. */
  docket?: string
  /** ISO 'YYYY-MM-DD' (or 'YYYY-MM' where the day is not confirmed). */
  filed: string
  claimTypes: ClaimType[]
  status: CaseStatus
  relief?: Relief
  /** One neutral sentence stating public-record facts only. */
  summary: string
  /** Authoritative source for verification (docket page where available). */
  source: SourceRef
  /** ISO date this record was last checked against its source. */
  lastReviewed: string
}

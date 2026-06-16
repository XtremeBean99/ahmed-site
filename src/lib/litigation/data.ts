import type { CaseStatus, ClaimType, Jurisdiction, Litigation } from './types'

/**
 * Seed dataset for the AI & Cyber Litigation Tracker.
 *
 * SOURCING AND VERIFICATION
 * Each record is compiled from public reporting and, where available, the
 * primary court docket. This is a discovery-layer seed: before publishing or
 * relying on any specific figure, verify the record against the cited source
 * (the docket itself for US federal matters, via CourtListener / RECAP).
 *
 * Where a precise docket-page URL was not confirmed, `source.url` points to a
 * real CourtListener or National Archives search so the exact record can be
 * located and the link upgraded during review. Replace these with deep docket
 * links as you verify each case.
 *
 * Relief: `claimed` is relief sought as pleaded; `awarded` stays null until a
 * matter is adjudicated or settled. Do not present claimed relief as liability.
 *
 * Last full review: 2026-06-16.
 */

const cl = (q: string) =>
  `https://www.courtlistener.com/?q=${encodeURIComponent(q)}`

export const litigation: Litigation[] = [
  {
    id: 'nyt-microsoft-openai',
    caseName: 'The New York Times Company v. Microsoft Corporation',
    plaintiffs: ['The New York Times Company'],
    defendants: ['Microsoft', 'OpenAI'],
    court: 'S.D.N.Y.',
    jurisdiction: 'US',
    docket: '1:23-cv-11195',
    filed: '2023-12-27',
    claimTypes: ['Copyright'],
    status: 'In discovery',
    relief: { claimed: 'Unspecified damages and injunction', awarded: null },
    summary:
      'Alleges unauthorised use of millions of Times articles to train GPT models; consolidated as In re OpenAI, Inc., Copyright Infringement Litigation.',
    source: {
      label: 'CourtListener docket',
      url: 'https://www.courtlistener.com/docket/68117049/the-new-york-times-company-v-microsoft-corporation/',
    },
    lastReviewed: '2026-06-16',
  },
  {
    id: 'authors-guild-openai',
    caseName: 'Authors Guild v. OpenAI, Inc.',
    plaintiffs: ['Authors Guild', 'Named authors (class)'],
    defendants: ['OpenAI', 'Microsoft'],
    court: 'S.D.N.Y.',
    jurisdiction: 'US',
    docket: '1:23-cv-08292',
    filed: '2023-09-19',
    claimTypes: ['Copyright'],
    status: 'In discovery',
    relief: { claimed: 'Statutory damages and injunction (class)', awarded: null },
    summary:
      'Class action by fiction authors alleging their books were copied to train large language models; consolidated in the In re OpenAI proceeding.',
    source: { label: 'CourtListener', url: cl('Authors Guild v OpenAI') },
    lastReviewed: '2026-06-16',
  },
  {
    id: 'tremblay-openai',
    caseName: 'Tremblay v. OpenAI, Inc.',
    plaintiffs: ['Paul Tremblay', 'Mona Awad (class)'],
    defendants: ['OpenAI'],
    court: 'N.D. Cal.',
    jurisdiction: 'US',
    docket: '3:23-cv-03223',
    filed: '2023-06-28',
    claimTypes: ['Copyright'],
    status: 'In discovery',
    relief: { claimed: 'Statutory damages and injunction (class)', awarded: null },
    summary:
      'Authors allege ChatGPT was trained on their books obtained from shadow-library datasets without permission.',
    source: { label: 'CourtListener', url: cl('Tremblay v OpenAI') },
    lastReviewed: '2026-06-16',
  },
  {
    id: 'kadrey-meta',
    caseName: 'Kadrey v. Meta Platforms, Inc.',
    plaintiffs: ['Richard Kadrey', 'Sarah Silverman', 'Ta-Nehisi Coates (class)'],
    defendants: ['Meta Platforms'],
    court: 'N.D. Cal.',
    jurisdiction: 'US',
    docket: '3:23-cv-03417',
    filed: '2023-07-07',
    claimTypes: ['Copyright'],
    status: 'Partial ruling',
    relief: { claimed: 'Statutory damages and injunction (class)', awarded: null },
    summary:
      'On 25 June 2025 the court granted summary judgment for Meta on training as fair use on the record presented, while allowing certain distribution-related claims to proceed.',
    source: {
      label: 'Justia (Doc. 598)',
      url: 'https://law.justia.com/cases/federal/district-courts/california/candce/3:2023cv03417/415175/598/',
    },
    lastReviewed: '2026-06-16',
  },
  {
    id: 'bartz-anthropic',
    caseName: 'Bartz v. Anthropic PBC',
    plaintiffs: ['Andrea Bartz', 'Charles Graeber', 'Kirk Wallace Johnson (class)'],
    defendants: ['Anthropic'],
    court: 'N.D. Cal.',
    jurisdiction: 'US',
    docket: '3:24-cv-05417',
    filed: '2024-08-19',
    claimTypes: ['Copyright'],
    status: 'Settled',
    relief: {
      claimed: 'Class damages',
      awarded: 'USD 1.5B settlement',
      note: 'Reported as the largest US copyright settlement; covers c. 482,000 pirated titles. Final approval pending as at last review.',
    },
    summary:
      'Authors alleged Anthropic downloaded pirated books to train Claude; the parties reached a USD 1.5 billion class settlement in 2025.',
    source: { label: 'CourtListener', url: cl('Bartz v Anthropic') },
    lastReviewed: '2026-06-16',
  },
  {
    id: 'concord-anthropic',
    caseName: 'Concord Music Group, Inc. v. Anthropic PBC',
    plaintiffs: ['Concord Music Group', 'Universal Music', 'ABKCO'],
    defendants: ['Anthropic'],
    court: 'N.D. Cal. (transf. from M.D. Tenn.)',
    jurisdiction: 'US',
    filed: '2023-10-18',
    claimTypes: ['Copyright'],
    status: 'Pending',
    relief: { claimed: 'Statutory damages and injunction', awarded: null },
    summary:
      'Music publishers allege Claude reproduced copyrighted song lyrics; an early motion for a preliminary injunction on guardrails was resolved by stipulation.',
    source: { label: 'CourtListener', url: cl('Concord Music Anthropic') },
    lastReviewed: '2026-06-16',
  },
  {
    id: 'andersen-stability',
    caseName: 'Andersen v. Stability AI Ltd.',
    plaintiffs: ['Sarah Andersen', 'Kelly McKernan', 'Karla Ortiz (class)'],
    defendants: ['Stability AI', 'Midjourney', 'DeviantArt', 'Runway'],
    court: 'N.D. Cal.',
    jurisdiction: 'US',
    docket: '3:23-cv-00201',
    filed: '2023-01-13',
    claimTypes: ['Copyright', 'Trademark'],
    status: 'In discovery',
    relief: { claimed: 'Damages and injunction (class)', awarded: null },
    summary:
      'Visual artists allege image generators were trained on billions of scraped images; surviving claims proceeded to discovery with trial scheduled for September 2026.',
    source: { label: 'CourtListener', url: cl('Andersen v Stability AI') },
    lastReviewed: '2026-06-16',
  },
  {
    id: 'getty-stability-us',
    caseName: 'Getty Images (US), Inc. v. Stability AI, Inc.',
    plaintiffs: ['Getty Images'],
    defendants: ['Stability AI'],
    court: 'D. Del.',
    jurisdiction: 'US',
    docket: '1:23-cv-00135',
    filed: '2023-02-03',
    claimTypes: ['Copyright', 'Trademark'],
    status: 'Pending',
    relief: { claimed: 'Damages and injunction', awarded: null },
    summary:
      'Alleges copying of millions of Getty images to train Stable Diffusion, plus trademark claims over reproduced watermarks.',
    source: { label: 'CourtListener', url: cl('Getty Images Stability AI Delaware') },
    lastReviewed: '2026-06-16',
  },
  {
    id: 'getty-stability-uk',
    caseName: 'Getty Images (US) Inc & Ors v. Stability AI Ltd',
    plaintiffs: ['Getty Images'],
    defendants: ['Stability AI'],
    court: 'High Court of Justice (England & Wales), Chancery',
    jurisdiction: 'UK',
    filed: '2023-05',
    claimTypes: ['Copyright', 'Trademark'],
    status: 'Judgment',
    relief: {
      claimed: 'Injunction and damages',
      awarded: null,
      note: 'Judgment handed down 4 November 2025; secondary copyright claim rejected, with extremely limited trademark findings on early model versions.',
    },
    summary:
      'The first UK judgment on copyright and generative-AI training; the High Court rejected the secondary infringement claim and made only narrow trademark findings.',
    source: {
      label: 'Find Case Law (National Archives)',
      url: 'https://caselaw.nationalarchives.gov.uk/',
    },
    lastReviewed: '2026-06-16',
  },
  {
    id: 'thomson-reuters-ross',
    caseName: 'Thomson Reuters Enterprise Centre GmbH v. Ross Intelligence Inc.',
    plaintiffs: ['Thomson Reuters'],
    defendants: ['Ross Intelligence'],
    court: 'D. Del.',
    jurisdiction: 'US',
    docket: '1:20-cv-00613',
    filed: '2020-05-06',
    claimTypes: ['Copyright'],
    status: 'On appeal',
    relief: { claimed: 'Damages and injunction', awarded: null },
    summary:
      'On 11 February 2025 the court granted summary judgment for Thomson Reuters, rejecting a fair-use defence for copying Westlaw headnotes to build a competing research tool; the ruling was expressly limited to non-generative AI.',
    source: { label: 'CourtListener', url: cl('Thomson Reuters Ross Intelligence') },
    lastReviewed: '2026-06-16',
  },
  {
    id: 'disney-universal-midjourney',
    caseName: 'Disney Enterprises, Inc. v. Midjourney, Inc.',
    plaintiffs: ['Disney', 'Universal', 'DreamWorks'],
    defendants: ['Midjourney'],
    court: 'C.D. Cal.',
    jurisdiction: 'US',
    docket: '2:25-cv-05275',
    filed: '2025-06-11',
    claimTypes: ['Copyright'],
    status: 'Pending',
    relief: { claimed: 'Unspecified damages and injunction; jury demanded', awarded: null },
    summary:
      'Studios allege Midjourney generates near-identical copies of iconic characters such as Darth Vader, Elsa and the Minions without authorisation.',
    source: {
      label: 'CourtListener docket',
      url: 'https://www.courtlistener.com/docket/70513159/disney-enterprises-inc-v-midjourney-inc/',
    },
    lastReviewed: '2026-06-16',
  },
  {
    id: 'dowjones-perplexity',
    caseName: 'Dow Jones & Company, Inc. v. Perplexity AI, Inc.',
    plaintiffs: ['Dow Jones', 'NYP Holdings'],
    defendants: ['Perplexity AI'],
    court: 'S.D.N.Y.',
    jurisdiction: 'US',
    docket: '1:24-cv-07984',
    filed: '2024-10-21',
    claimTypes: ['Copyright', 'Trademark'],
    status: 'Pending',
    relief: { claimed: 'Damages and injunction', awarded: null },
    summary:
      'Publishers of the Wall Street Journal and New York Post allege copying for a retrieval index and verbatim reproduction in outputs; the court denied dismissal and transfer.',
    source: {
      label: 'CourtListener docket',
      url: 'https://www.courtlistener.com/docket/69280523/dow-jones-company-inc-v-perplexity-ai-inc/',
    },
    lastReviewed: '2026-06-16',
  },
  {
    id: 'doe-github-copilot',
    caseName: 'Doe v. GitHub, Inc.',
    plaintiffs: ['Anonymous developers (class)'],
    defendants: ['GitHub', 'Microsoft', 'OpenAI'],
    court: 'N.D. Cal.',
    jurisdiction: 'US',
    docket: '4:22-cv-06823',
    filed: '2022-11-03',
    claimTypes: ['Copyright'],
    status: 'On appeal',
    relief: { claimed: 'Damages and injunction (class)', awarded: null },
    summary:
      'Developers allege GitHub Copilot reproduces licensed open-source code without attribution; most claims were dismissed and the dispute proceeded on appeal.',
    source: { label: 'CourtListener', url: cl('Doe v GitHub Copilot') },
    lastReviewed: '2026-06-16',
  },
  {
    id: 'raw-story-openai',
    caseName: 'Raw Story Media, Inc. v. OpenAI, Inc.',
    plaintiffs: ['Raw Story Media', 'AlterNet Media'],
    defendants: ['OpenAI'],
    court: 'S.D.N.Y.',
    jurisdiction: 'US',
    docket: '1:24-cv-01514',
    filed: '2024-02-28',
    claimTypes: ['Copyright'],
    status: 'Dismissed',
    relief: { claimed: 'DMCA statutory damages', awarded: null },
    summary:
      'A DMCA section 1202 claim over removal of copyright-management information from training data was dismissed in November 2024 for lack of standing, with leave to amend.',
    source: { label: 'CourtListener', url: cl('Raw Story Media OpenAI') },
    lastReviewed: '2026-06-16',
  },
  {
    id: 'intercept-openai',
    caseName: 'The Intercept Media, Inc. v. OpenAI, Inc.',
    plaintiffs: ['The Intercept Media'],
    defendants: ['OpenAI', 'Microsoft'],
    court: 'S.D.N.Y.',
    jurisdiction: 'US',
    docket: '1:24-cv-01515',
    filed: '2024-02-28',
    claimTypes: ['Copyright'],
    status: 'Pending',
    relief: { claimed: 'DMCA statutory damages', awarded: null },
    summary:
      'A parallel DMCA section 1202 action in which part of the claim survived dismissal and proceeded against OpenAI.',
    source: { label: 'CourtListener', url: cl('Intercept Media OpenAI') },
    lastReviewed: '2026-06-16',
  },
  {
    id: 'walters-openai',
    caseName: 'Walters v. OpenAI, L.L.C.',
    plaintiffs: ['Mark Walters'],
    defendants: ['OpenAI'],
    court: 'Superior Court of Gwinnett County, Georgia',
    jurisdiction: 'US',
    filed: '2023-06-05',
    claimTypes: ['Defamation'],
    status: 'Dismissed',
    relief: { claimed: 'General and punitive damages', awarded: null },
    summary:
      'A defamation claim over an allegedly false ChatGPT output was resolved in OpenAI’s favour on summary judgment in 2025, with the court finding the output was not actionable as a statement of fact.',
    source: { label: 'CourtListener', url: cl('Walters v OpenAI') },
    lastReviewed: '2026-06-16',
  },
  {
    id: 'clearview-bipa',
    caseName: 'In re Clearview AI, Inc. Consumer Privacy Litigation',
    plaintiffs: ['Consumer class'],
    defendants: ['Clearview AI'],
    court: 'N.D. Ill. (MDL)',
    jurisdiction: 'US',
    filed: '2021-01',
    claimTypes: ['Privacy', 'Biometric'],
    status: 'Settled',
    relief: {
      claimed: 'BIPA statutory damages and injunction',
      awarded: 'Equity-based class settlement',
      note: 'Settlement gave the class a stake in the company’s value rather than a fixed cash fund.',
    },
    summary:
      'Consolidated Illinois Biometric Information Privacy Act litigation over Clearview’s scraping of facial images, resolved by a novel equity-based class settlement.',
    source: { label: 'CourtListener', url: cl('Clearview AI Consumer Privacy Litigation') },
    lastReviewed: '2026-06-16',
  },
  {
    id: 'mobley-workday',
    caseName: 'Mobley v. Workday, Inc.',
    plaintiffs: ['Derek Mobley (collective)'],
    defendants: ['Workday'],
    court: 'N.D. Cal.',
    jurisdiction: 'US',
    docket: '3:23-cv-00770',
    filed: '2023-02-21',
    claimTypes: ['Discrimination'],
    status: 'Pending',
    relief: { claimed: 'Damages and injunctive relief (collective)', awarded: null },
    summary:
      'Alleges Workday’s AI-based applicant-screening tools produce age, race and disability discrimination; the court allowed an ADEA collective action to proceed to notice.',
    source: { label: 'CourtListener', url: cl('Mobley v Workday') },
    lastReviewed: '2026-06-16',
  },
]

/* ---- Derived aggregates (computed once at module load) ---- */

const ACTIVE_STATUSES: CaseStatus[] = ['Pending', 'In discovery', 'Partial ruling', 'On appeal']

export function countBy<T extends string>(
  items: Litigation[],
  pick: (c: Litigation) => T[] | T
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of items) {
    const v = pick(c)
    const arr = Array.isArray(v) ? v : [v]
    for (const k of arr) out[k] = (out[k] ?? 0) + 1
  }
  return out
}

export const jurisdictionCounts = countBy(litigation, (c) => c.jurisdiction) as Record<
  Jurisdiction,
  number
>
export const claimCounts = countBy(litigation, (c) => c.claimTypes) as Record<ClaimType, number>
export const statusCounts = countBy(litigation, (c) => c.status) as Record<CaseStatus, number>

export const trackerStats = {
  total: litigation.length,
  active: litigation.filter((c) => ACTIVE_STATUSES.includes(c.status)).length,
  defendants: new Set(litigation.flatMap((c) => c.defendants)).size,
  jurisdictions: new Set(litigation.map((c) => c.jurisdiction)).size,
  resolved: litigation.filter((c) => c.status === 'Settled' || c.status === 'Dismissed' || c.status === 'Judgment')
    .length,
}

export const lastUpdated = litigation
  .map((c) => c.lastReviewed)
  .sort()
  .at(-1)!
